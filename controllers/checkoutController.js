const { container } = require('../container/serviceRegistration');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * CheckoutController
 * 
 * Handles HTTP concerns only - request validation, response formatting, error handling.
 * Delegates business logic to CheckoutService.
 * Follows Single Responsibility Principle - only responsible for HTTP request/response handling.
 */
class CheckoutController {
  /**
   * Create a new order and initiate payment
   * @route POST /api/checkout/create-order
   * @access Private
   */
  async createOrder(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: errors.array()
          }
        });
      }

      const { items, address } = req.body;
      const userId = req.user.id;

      logger.info('Checkout create order request', {
        userId: userId,
        itemCount: items?.length || 0
      });

      // Get CheckoutService from DI container
      const checkoutService = container.resolve('checkoutService');

      // Delegate to service
      const result = await checkoutService.initiateCheckout(userId, {
        items,
        address
      });

      logger.info('Order created successfully', {
        orderId: result.orderId,
        userId: userId,
        gateway: result.gateway
      });

      res.status(201).json({
        success: true,
        data: {
          orderId: result.orderId,
          paymentUrl: result.paymentUrl,
          merchantTransactionId: result.merchantTransactionId,
          amount: result.amount,
          currency: result.currency,
          receipt: result.receipt,
          gateway: result.gateway
        }
      });

    } catch (error) {
      logger.error('Error creating order', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const errorCode = error.code || 'ORDER_CREATION_FAILED';

      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message || 'Failed to create order',
          statusCode: statusCode,
          code: errorCode
        }
      });
    }
  }

  /**
   * Verify payment and update order status
   * @route POST /api/checkout/verify
   * @access Private
   */
  async verifyPayment(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: errors.array()
          }
        });
      }

      const { orderId, ...paymentData } = req.body;
      const userId = req.user.id;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Order ID is required',
            statusCode: 400,
            code: 'MISSING_ORDER_ID'
          }
        });
      }

      logger.info('Payment verification request', {
        orderId: orderId,
        userId: userId
      });

      // Get CheckoutService from DI container
      const checkoutService = container.resolve('checkoutService');

      // Delegate to service
      const result = await checkoutService.verifyPayment(orderId, paymentData);

      logger.info('Payment verified', {
        orderId: orderId,
        success: result.success,
        status: result.status
      });

      res.json({
        success: result.success,
        data: {
          orderId: result.orderId,
          status: result.status,
          message: result.message,
          gateway: result.gateway
        }
      });

    } catch (error) {
      logger.error('Error verifying payment', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const errorCode = error.code || 'PAYMENT_VERIFICATION_FAILED';

      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message || 'Failed to verify payment',
          statusCode: statusCode,
          code: errorCode
        }
      });
    }
  }

  /**
   * Check payment status
   * @route GET /api/checkout/payment-status/:merchantTransactionId
   * @access Private
   */
  async checkPaymentStatus(req, res) {
    try {
      const { merchantTransactionId } = req.params;
      const userId = req.user.id;

      if (!merchantTransactionId) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Merchant transaction ID is required',
            statusCode: 400,
            code: 'MISSING_TRANSACTION_ID'
          }
        });
      }

      logger.info('Payment status check request', {
        merchantTransactionId: merchantTransactionId,
        userId: userId
      });

      // Get CheckoutService from DI container
      const checkoutService = container.resolve('checkoutService');

      // Delegate to service
      const result = await checkoutService.checkPaymentStatus(merchantTransactionId);

      res.json({
        success: result.success,
        data: {
          orderId: result.orderId,
          status: result.status,
          message: result.message,
          gateway: result.gateway
        }
      });

    } catch (error) {
      logger.error('Error checking payment status', {
        error: error.message,
        merchantTransactionId: req.params?.merchantTransactionId
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message || 'Failed to check payment status',
          statusCode: statusCode,
          code: 'STATUS_CHECK_FAILED'
        }
      });
    }
  }

  /**
   * Handle PhonePE webhook events (SDK format)
   * @route POST /api/checkout/phonepe-webhook
   * @access Public (with signature verification)
   */
  async handlePhonePeWebhook(req, res) {
    try {
      const webhookData = req.body;
      const xVerify = req.headers['x-verify'] || req.headers['X-VERIFY'];

      logger.info('PhonePE webhook received', {
        merchantTransactionId: webhookData?.merchantTransactionId || 
                              webhookData?.merchant_transaction_id ||
                              webhookData?.data?.merchantTransactionId,
        hasXVerify: !!xVerify,
        webhookCode: webhookData?.code
      });

      // Add X-VERIFY header to webhook data for signature verification
      if (xVerify) {
        webhookData.xVerify = xVerify;
        webhookData['X-VERIFY'] = xVerify;
      }

      // Also add headers for reference
      webhookData.headers = {
        'x-verify': xVerify,
        'X-VERIFY': xVerify
      };

      // Get CheckoutService from DI container
      const checkoutService = container.resolve('checkoutService');

      // Delegate to service
      const result = await checkoutService.handleWebhook(webhookData, 'phonepe');

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error handling PhonePE webhook', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Webhook processing failed',
          statusCode: 500,
          code: 'WEBHOOK_PROCESSING_FAILED'
        }
      });
    }
  }

  /**
   * Handle Razorpay webhook events
   * @route POST /api/checkout/razorpay-webhook
   * @access Public (with signature verification)
   */
  async handleRazorpayWebhook(req, res) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const webhookBody = JSON.stringify(req.body);

      if (!signature) {
        logger.logSecurity('Razorpay webhook request without signature', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Missing signature' 
        });
      }

      logger.info('Razorpay webhook received', {
        event: req.body?.event,
        orderId: req.body?.payload?.order?.entity?.id
      });

      // Get CheckoutService from DI container
      const checkoutService = container.resolve('checkoutService');

      // Add signature to webhook data
      const webhookData = {
        ...req.body,
        signature: signature
      };

      // Delegate to service
      const result = await checkoutService.handleWebhook(webhookData, 'razorpay');

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error handling Razorpay webhook', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Webhook processing failed',
          statusCode: 500,
          code: 'WEBHOOK_PROCESSING_FAILED'
        }
      });
    }
  }

  /**
   * Get payment gateway configuration for frontend
   * @route GET /api/checkout/config
   * @access Public
   */
  async getConfig(req, res) {
    try {
      // Get PaymentGatewayFactory from DI container
      const paymentGatewayFactory = container.resolve('paymentGatewayFactory');
      
      const gateway = paymentGatewayFactory.getDefaultGateway();
      const config = gateway.getFrontendConfig();

      if (!config) {
        return res.status(503).json({
          success: false,
          error: {
            message: 'Payment gateway is not configured',
            statusCode: 503,
            code: 'GATEWAY_NOT_CONFIGURED'
          }
        });
      }

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      logger.error('Error getting payment gateway config', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to get payment configuration',
          statusCode: 500,
          code: 'CONFIG_ERROR'
        }
      });
    }
  }
}

module.exports = new CheckoutController();
