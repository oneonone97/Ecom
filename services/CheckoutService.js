const logger = require('../utils/logger');
const db = require('../utils/database');
const sql = require('../utils/postgres');

/**
 * CheckoutService
 * 
 * Orchestrates checkout flow using gateway abstraction.
 * Follows Single Responsibility Principle - only responsible for checkout orchestration.
 * Follows Dependency Inversion Principle - depends on abstractions (IPaymentGateway, services).
 */
class CheckoutService {
  constructor(
    paymentGatewayFactory,
    orderService,
    cartService,
    orderValidator,
    paymentVerifier
  ) {
    this.paymentGatewayFactory = paymentGatewayFactory;
    this.orderService = orderService;
    this.cartService = cartService;
    this.orderValidator = orderValidator;
    this.paymentVerifier = paymentVerifier;
    // Product operations now handled by OrderService
  }

  /**
   * Initiate checkout process
   * @param {number} userId - User ID
   * @param {Object} checkoutData - Checkout data
   * @param {Array} checkoutData.items - Cart items
   * @param {Object} checkoutData.address - Shipping address
   * @returns {Promise<Object>} Checkout initiation result with payment URL
   */
  async initiateCheckout(userId, checkoutData) {
    try {
      const { items, address } = checkoutData;

      logger.info('Initiating checkout', {
        userId,
        itemCount: items?.length || 0
      });

      // Validate cart items
      const cartValidation = this.orderValidator.validateCartItems(items);
      if (!cartValidation.isValid) {
        await transaction.rollback();
        throw new Error(`Cart validation failed: ${cartValidation.errors.join(', ')}`);
      }

      // Validate shipping address
      const addressValidation = this.orderValidator.validateShippingAddress(address);
      if (!addressValidation.isValid) {
        await transaction.rollback();
        throw new Error(`Address validation failed: ${addressValidation.errors.join(', ')}`);
      }

      // Validate stock availability
      const stockValidation = await this.orderValidator.validateStockAvailability(
        items,
        async (productId) => {
          const product = await db.products.findByPk(productId);
          return product ? product.stock : 0;
        }
      );

      if (!stockValidation.isValid) {
        throw new Error(`Stock validation failed: ${stockValidation.errors.join(', ')}`);
      }

      // Calculate total amount
      let totalAmountPaise = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = await db.products.findByPk(item.productId);

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        // Use sale price if available, otherwise regular price
        const unitPricePaise = product.sale_price_paise || product.price_paise;
        const itemTotal = unitPricePaise * item.quantity;

        validatedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPricePaise: unitPricePaise,
          productName: product.name,
          productDescription: product.description
        });

        totalAmountPaise += itemTotal;
      }

      // Generate unique merchant transaction ID
      const merchantTransactionId = `TXN_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`;
      const receipt = `receipt_${Date.now()}_${userId}`;

      // Get payment gateway
      const gateway = this.paymentGatewayFactory.getDefaultGateway();
      const gatewayName = gateway.getGatewayName();

      // Prepare order data for payment gateway
      const orderDataForGateway = {
        amount: totalAmountPaise,
        currency: 'INR',
        orderId: null, // Will be set after order creation
        merchantTransactionId: merchantTransactionId,
        receipt: receipt,
        userInfo: {
          userId: userId,
          name: address.name,
          email: address.email,
          phone: address.phone
        }
      };

      // Use transaction for atomicity
      const result = await sql.begin(async (sql) => {
        // Create database order first
        const order = await db.orders.create({
          userId: userId,
          total_amount_paise: totalAmountPaise,
          currency: 'INR',
          status: 'pending',
          payment_gateway: gatewayName,
          phonepe_merchant_transaction_id: gatewayName === 'phonepe' ? merchantTransactionId : null,
          receipt: receipt,
          address_json: JSON.stringify(address) // Ensure it's stored as JSON
        });

        // Update order data with order ID
        orderDataForGateway.orderId = order.id;

        // Create order items
        const orderItems = await Promise.all(
          validatedItems.map(item =>
            db.orderItems.create({
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unit_price_paise: item.unitPricePaise,
              productName: item.productName,
              productDescription: item.productDescription
            })
          )
        );

        // Update product stock using direct SQL
        for (const item of validatedItems) {
          await sql`
            UPDATE "Products"
            SET "stock" = "stock" - ${item.quantity}, "updatedAt" = NOW()
            WHERE "id" = ${item.productId}
          `;
        }

        return { order, orderItems, orderDataForGateway };
      });

      const { order, orderDataForGateway: finalOrderDataForGateway } = result;

      // Create payment request via gateway (after transaction is committed)
      let paymentRequest;
      try {
        paymentRequest = await gateway.createPaymentRequest(finalOrderDataForGateway);
      } catch (gatewayError) {
        // If payment gateway fails, mark order as failed
        await db.orders.update(order.id, { status: 'failed' });
        logger.error('Payment gateway error after order creation', {
          orderId: order.id,
          error: gatewayError.message
        });
        throw new Error(`Failed to create payment request: ${gatewayError.message}`);
      }

      // Update order with gateway-specific transaction IDs
      if (gatewayName === 'phonepe') {
        await db.orders.update(order.id, {
          phonepe_merchant_transaction_id: merchantTransactionId,
          phonepe_transaction_id: paymentRequest.transactionId || null
        });
      } else if (gatewayName === 'razorpay') {
        await db.orders.update(order.id, {
          razorpay_order_id: paymentRequest.orderId || null
        });
      }

      logger.info('Checkout initiated successfully', {
        orderId: order.id,
        userId: userId,
        totalAmountPaise: totalAmountPaise,
        gateway: gatewayName,
        merchantTransactionId: merchantTransactionId
      });

      return {
        success: true,
        orderId: order.id,
        paymentUrl: paymentRequest.paymentUrl || null,
        merchantTransactionId: merchantTransactionId,
        gateway: gatewayName,
        amount: totalAmountPaise,
        currency: 'INR',
        receipt: receipt
      };

    } catch (error) {
      logger.error('Error initiating checkout', {
        error: error.message,
        stack: error.stack,
        userId: userId
      });
      throw error;
    }
  }

  /**
   * Verify payment and update order status
   * @param {number} orderId - Order ID
   * @param {Object} paymentResponse - Payment response from gateway
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(orderId, paymentResponse) {
    try {
      logger.info('Verifying payment', {
        orderId: orderId
      });

      // Find order
      const order = await db.orders.findByPk(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'pending') {
        throw new Error(`Order ${orderId} is already processed. Current status: ${order.status}`);
      }

      // Get payment gateway
      const gatewayName = order.payment_gateway || 'phonepe';
      const gateway = this.paymentGatewayFactory.getGateway(gatewayName);

      // Validate payment data
      const paymentValidation = this.orderValidator.validatePaymentData(paymentResponse, gatewayName);
      if (!paymentValidation.isValid) {
        throw new Error(`Payment data validation failed: ${paymentValidation.errors.join(', ')}`);
      }

      // Verify payment using gateway
      const verificationResult = await this.paymentVerifier.verifyPaymentResponse(
        paymentResponse,
        gateway
      );

      // Determine order status
      const orderStatus = this.paymentVerifier.determineOrderStatus(verificationResult);

      // Update order with payment details
      const updateData = {
        status: orderStatus
      };

      if (gatewayName === 'phonepe') {
        updateData.phonepe_transaction_id = verificationResult.transactionId;
        updateData.phonepe_payment_instrument_type = paymentResponse.paymentInstrument?.type || null;
      } else if (gatewayName === 'razorpay') {
        updateData.razorpay_payment_id = verificationResult.transactionId;
        updateData.razorpay_signature = paymentResponse.razorpay_signature;
      }

      await db.orders.update(orderId, updateData);

      // Clear cart if payment successful
      if (orderStatus === 'paid') {
        await this.cartService.clearUserCart(order.userId);
        logger.info('Cart cleared after successful payment', {
          userId: order.userId,
          orderId: orderId
        });
      }

      logger.info('Payment verified successfully', {
        orderId: orderId,
        status: orderStatus,
        gateway: gatewayName,
        success: verificationResult.success
      });

      return {
        success: verificationResult.success,
        orderId: orderId,
        status: orderStatus,
        message: verificationResult.message || 'Payment verification completed',
        gateway: gatewayName
      };

    } catch (error) {
      logger.error('Error verifying payment', {
        error: error.message,
        stack: error.stack,
        orderId: orderId
      });
      throw error;
    }
  }

  /**
   * Check payment status
   * @param {string} merchantTransactionId - Merchant transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(merchantTransactionId) {
    try {
      logger.info('Checking payment status', {
        merchantTransactionId: merchantTransactionId
      });

      // Find order by merchant transaction ID
      const order = await db.orders.findOne({
        phonepe_merchant_transaction_id: merchantTransactionId
      });

      if (!order) {
        throw new Error('Order not found for merchant transaction ID');
      }

      // Get payment gateway
      const gatewayName = order.payment_gateway || 'phonepe';
      const gateway = this.paymentGatewayFactory.getGateway(gatewayName);

      // Check status via gateway
      const statusResult = await gateway.checkPaymentStatus(merchantTransactionId);

      // Update order status if changed
      if (statusResult.success && order.status === 'pending') {
        await db.orders.update(order.id, { status: 'paid' });
        await this.cartService.clearUserCart(order.userId);
      } else if (!statusResult.success && order.status === 'pending') {
        await db.orders.update(order.id, { status: 'failed' });
      }

      return {
        success: statusResult.success,
        orderId: order.id,
        status: order.status,
        gateway: gatewayName,
        message: statusResult.message || 'Status check completed'
      };

    } catch (error) {
      logger.error('Error checking payment status', {
        error: error.message,
        merchantTransactionId: merchantTransactionId
      });
      throw error;
    }
  }

  /**
   * Handle webhook events
   * @param {Object} webhookData - Webhook data
   * @param {string} gatewayType - Gateway type
   * @returns {Promise<Object>} Webhook handling result
   */
  async handleWebhook(webhookData, gatewayType) {
    try {
      logger.info('Handling webhook', {
        gateway: gatewayType
      });

      // Get payment gateway
      const gateway = this.paymentGatewayFactory.getGateway(gatewayType);

      // Verify webhook signature
      const payload = typeof webhookData === 'string' ? webhookData : JSON.stringify(webhookData);
      const signature = webhookData.xVerify || webhookData.signature || webhookData['x-razorpay-signature'];

      if (!signature) {
        throw new Error('Webhook signature is missing');
      }

      const isValidSignature = gateway.verifyWebhookSignature(payload, signature);

      if (!isValidSignature) {
        logger.logSecurity('Invalid webhook signature', {
          gateway: gatewayType
        });
        throw new Error('Invalid webhook signature');
      }

      // Process webhook based on gateway type
      if (gatewayType === 'phonepe') {
        return await this.handlePhonePeWebhook(webhookData);
      } else if (gatewayType === 'razorpay') {
        return await this.handleRazorpayWebhook(webhookData);
      }

      return {
        success: true,
        message: 'Webhook processed'
      };

    } catch (error) {
      logger.error('Error handling webhook', {
        error: error.message,
        gateway: gatewayType
      });
      throw error;
    }
  }

  /**
   * Handle PhonePE webhook (SDK format)
   * @param {Object} webhookData - PhonePE webhook data from SDK
   * @returns {Promise<Object>} Processing result
   */
  async handlePhonePeWebhook(webhookData) {
    try {
      // SDK webhook format may have different structure
      // Handle both old format and new SDK format
      const merchantTransactionId = webhookData.merchantTransactionId || 
                                    webhookData.merchant_transaction_id ||
                                    webhookData.data?.merchantTransactionId ||
                                    webhookData.response?.merchantTransactionId;
      
      if (!merchantTransactionId) {
        logger.error('Merchant transaction ID not found in PhonePe webhook', {
          webhookKeys: Object.keys(webhookData),
          webhookData: JSON.stringify(webhookData).substring(0, 500)
        });
        throw new Error('Merchant transaction ID not found in webhook');
      }

      logger.info('Processing PhonePe webhook', {
        merchantTransactionId,
        webhookCode: webhookData.code,
        hasData: !!webhookData.data
      });

      const order = await db.orders.findOne({
        phonepe_merchant_transaction_id: merchantTransactionId
      });

      if (!order) {
        logger.error('Order not found for PhonePe webhook', {
          merchantTransactionId
        });
        throw new Error(`Order not found for merchant transaction ID: ${merchantTransactionId}`);
      }

      // Verify payment using gateway's verifyPayment method
      // SDK webhook data structure: { code, data: { merchantTransactionId, transactionId, ... }, response (base64), xVerify }
      const paymentData = {
        merchantTransactionId: merchantTransactionId,
        transactionId: webhookData.data?.transactionId || webhookData.transactionId,
        code: webhookData.code || webhookData.data?.code,
        response: webhookData.response || webhookData.data?.response,
        xVerify: webhookData.xVerify || webhookData['X-VERIFY'] || webhookData.headers?.['x-verify']
      };

      // Verify payment
      const verificationResult = await this.verifyPayment(order.id, paymentData);

      return {
        success: true,
        orderId: order.id,
        status: verificationResult.status,
        message: 'PhonePE webhook processed successfully'
      };

    } catch (error) {
      logger.error('Error handling PhonePE webhook', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle Razorpay webhook
   * @param {Object} webhookData - Razorpay webhook data
   * @returns {Promise<Object>} Processing result
   */
  async handleRazorpayWebhook(webhookData) {
    try {
      const razorpayOrderId = webhookData.payload?.order?.entity?.id || webhookData.order_id;
      
      if (!razorpayOrderId) {
        throw new Error('Razorpay order ID not found in webhook');
      }

      const order = await db.orders.findOne({
        razorpay_order_id: razorpayOrderId
      });

      if (!order) {
        throw new Error(`Order not found for Razorpay order ID: ${razorpayOrderId}`);
      }

      // Process webhook event
      const event = webhookData.event || webhookData.type;

      if (event === 'payment.captured' || event === 'order.paid') {
        await db.orders.update(order.id, { status: 'paid' });
        await this.cartService.clearUserCart(order.userId);
      } else if (event === 'payment.failed') {
        await db.orders.update(order.id, { status: 'failed' });
      }

      return {
        success: true,
        orderId: order.id,
        status: order.status,
        message: 'Razorpay webhook processed successfully'
      };

    } catch (error) {
      logger.error('Error handling Razorpay webhook', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CheckoutService;

