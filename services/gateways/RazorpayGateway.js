const Razorpay = require('razorpay');
const crypto = require('crypto');
const IPaymentGateway = require('../../interfaces/IPaymentGateway');
const logger = require('../../utils/logger');

/**
 * RazorpayGateway
 * 
 * Implements IPaymentGateway interface for Razorpay payment gateway integration.
 * Refactored from razorpayService.js to follow SOLID principles.
 * Follows Single Responsibility Principle - handles only Razorpay-specific payment logic.
 */
class RazorpayGateway extends IPaymentGateway {
  constructor() {
    super();
    this.isConfiguredFlag = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    
    if (this.isConfiguredFlag) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    } else {
      this.razorpay = null;
      logger.warn('Razorpay credentials not configured. Payment features will be disabled.');
    }
    
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  /**
   * Create a payment request (Razorpay order)
   * @param {Object} orderData - Order data
   * @param {number} orderData.amount - Amount in paise
   * @param {string} orderData.currency - Currency code (default: INR)
   * @param {string} orderData.receipt - Receipt identifier
   * @param {Object} orderData.notes - Additional notes
   * @returns {Promise<Object>} Payment request response
   */
  async createPaymentRequest(orderData) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Razorpay is not configured');
      }

      const {
        amount,
        currency = 'INR',
        receipt,
        notes = {}
      } = orderData;

      if (!amount || !receipt) {
        throw new Error('Amount and receipt are required');
      }

      const options = {
        amount: amount, // Amount in paise
        currency: currency,
        receipt: receipt,
        notes: notes,
        payment_capture: 1, // Auto capture payment
      };

      logger.info('Creating Razorpay order', { 
        amount, 
        currency, 
        receipt,
        notes: Object.keys(notes).length > 0 ? 'present' : 'none'
      });

      const order = await this.razorpay.orders.create(options);
      
      logger.info('Razorpay order created successfully', { 
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      });

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        gateway: 'razorpay'
      };
    } catch (error) {
      logger.error('Failed to create Razorpay order', {
        error: error.message,
        amount: orderData?.amount,
        currency: orderData?.currency,
        receipt: orderData?.receipt
      });
      throw new Error(`Failed to create payment order: ${error.message}`);
    }
  }

  /**
   * Verify payment response
   * @param {Object} paymentData - Payment response data
   * @param {string} paymentData.razorpay_order_id - Razorpay order ID
   * @param {string} paymentData.razorpay_payment_id - Razorpay payment ID
   * @param {string} paymentData.razorpay_signature - Razorpay signature
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(paymentData) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Razorpay is not configured');
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = paymentData;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error('Missing required payment data');
      }

      const isValidSignature = this.verifyWebhookSignature(
        `${razorpay_order_id}|${razorpay_payment_id}`,
        razorpay_signature
      );

      if (!isValidSignature) {
        logger.logSecurity('Invalid Razorpay payment signature', {
          razorpay_order_id,
          razorpay_payment_id
        });

        return {
          success: false,
          verified: false,
          message: 'Invalid payment signature',
          gateway: 'razorpay'
        };
      }

      // Fetch payment details to confirm
      const payment = await this.razorpay.payments.fetch(razorpay_payment_id);

      logger.info('Razorpay payment verified', {
        razorpay_order_id,
        razorpay_payment_id,
        status: payment.status,
        success: payment.status === 'captured'
      });

      return {
        success: payment.status === 'captured',
        verified: true,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        message: payment.status === 'captured' ? 'Payment successful' : 'Payment not captured',
        gateway: 'razorpay'
      };

    } catch (error) {
      logger.error('Error verifying Razorpay payment', {
        error: error.message,
        stack: error.stack,
        paymentData: {
          razorpay_order_id: paymentData?.razorpay_order_id
        }
      });

      return {
        success: false,
        verified: false,
        message: `Verification failed: ${error.message}`,
        gateway: 'razorpay'
      };
    }
  }

  /**
   * Check payment status
   * @param {string} orderId - Razorpay order ID
   * @returns {Promise<Object>} Payment status information
   */
  async checkPaymentStatus(orderId) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Razorpay is not configured');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const order = await this.razorpay.orders.fetch(orderId);
      
      logger.info('Razorpay order status checked', {
        orderId: order.id,
        status: order.status,
        amount: order.amount
      });

      return {
        success: order.status === 'paid',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        message: `Order status: ${order.status}`,
        gateway: 'razorpay'
      };
    } catch (error) {
      logger.error('Failed to check Razorpay payment status', {
        error: error.message,
        orderId
      });
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Webhook payload (stringified JSON or signature string)
   * @param {string} signature - Webhook signature header
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.razorpay?.key_secret) {
        logger.error('Razorpay key secret not configured for signature verification');
        return false;
      }

      // For payment verification, payload is the signature string
      // For webhook verification, payload is the webhook body
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.razorpay.key_secret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      logger.info('Razorpay signature verification', {
        isValid,
        expectedPrefix: expectedSignature.substring(0, 8) + '...',
        receivedPrefix: signature?.substring(0, 8) + '...'
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying Razorpay signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if gateway is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return this.isConfiguredFlag;
  }

  /**
   * Get frontend configuration
   * @returns {Object|null} Frontend configuration
   */
  getFrontendConfig() {
    if (!this.isConfigured()) {
      return null;
    }
    
    return {
      gateway: 'razorpay',
      keyId: process.env.RAZORPAY_KEY_ID,
      currency: 'INR',
      name: process.env.SHOP_NAME || 'MyShop',
      description: process.env.SHOP_DESCRIPTION || 'E-commerce Store',
      prefill: {
        email: '',
        name: ''
      },
      theme: {
        color: '#8D6E63'
      }
    };
  }

  /**
   * Get gateway name
   * @returns {string} Gateway name
   */
  getGatewayName() {
    return 'razorpay';
  }

  /**
   * Fetch Razorpay order details (legacy method for backward compatibility)
   * @param {string} orderId - Razorpay order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      
      logger.info('Fetched Razorpay order', {
        orderId: order.id,
        status: order.status,
        amount: order.amount
      });

      return order;
    } catch (error) {
      logger.error('Failed to fetch Razorpay order', {
        error: error.message,
        orderId
      });
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }

  /**
   * Fetch Razorpay payment details (legacy method for backward compatibility)
   * @param {string} paymentId - Razorpay payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPayment(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      logger.info('Fetched Razorpay payment', {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount
      });

      return payment;
    } catch (error) {
      logger.error('Failed to fetch Razorpay payment', {
        error: error.message,
        paymentId
      });
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Create a refund (legacy method for backward compatibility)
   * @param {string} paymentId - Razorpay payment ID
   * @param {number} amount_paise - Amount to refund in paise
   * @param {string} notes - Refund notes
   * @returns {Promise<Object>} Refund details
   */
  async createRefund(paymentId, amount_paise, notes = '') {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount_paise,
        notes: notes
      });

      logger.info('Created Razorpay refund', {
        refundId: refund.id,
        paymentId: paymentId,
        amount: refund.amount,
        status: refund.status
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create Razorpay refund', {
        error: error.message,
        paymentId,
        amount_paise
      });
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }
}

module.exports = RazorpayGateway;

