const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

class RazorpayService {
  constructor() {
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
   * Create a Razorpay order
   * @param {number} amount_paise - Amount in paise (INR)
   * @param {string} currency - Currency code (default: INR)
   * @param {string} receipt - Unique receipt identifier
   * @param {Object} notes - Additional notes
   * @returns {Promise<Object>} Razorpay order response
   */
  async createOrder(amount_paise, currency = 'INR', receipt, notes = {}) {
    try {
      if (!this.razorpay.key_id || !this.razorpay.key_secret) {
        throw new Error('Razorpay credentials not configured');
      }

      const options = {
        amount: amount_paise,
        currency: currency,
        receipt: receipt,
        notes: notes,
        payment_capture: 1, // Auto capture payment
      };

      logger.info('Creating Razorpay order', { 
        amount_paise, 
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

      return order;
    } catch (error) {
      logger.error('Failed to create Razorpay order', {
        error: error.message,
        amount_paise,
        currency,
        receipt
      });
      throw new Error(`Failed to create payment order: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay payment signature
   * @param {string} razorpay_order_id - Order ID from Razorpay
   * @param {string} razorpay_payment_id - Payment ID from Razorpay
   * @param {string} razorpay_signature - Signature from Razorpay
   * @returns {boolean} Verification result
   */
  verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature) {
    try {
      if (!this.razorpay.key_secret) {
        logger.error('Razorpay key secret not configured for signature verification');
        return false;
      }

      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', this.razorpay.key_secret)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === razorpay_signature;
      
      logger.info('Razorpay signature verification', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        isValid,
        expectedSignature: expectedSignature.substring(0, 8) + '...',
        receivedSignature: razorpay_signature.substring(0, 8) + '...'
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying Razorpay signature', {
        error: error.message,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });
      return false;
    }
  }

  /**
   * Verify Razorpay webhook signature
   * @param {string} webhookBody - Raw webhook body
   * @param {string} signature - Webhook signature header
   * @returns {boolean} Verification result
   */
  verifyWebhookSignature(webhookBody, signature) {
    try {
      if (!this.webhookSecret) {
        logger.error('Razorpay webhook secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(webhookBody)
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      logger.info('Razorpay webhook signature verification', {
        isValid,
        expectedSignature: expectedSignature.substring(0, 8) + '...',
        receivedSignature: signature.substring(0, 8) + '...'
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying Razorpay webhook signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Fetch Razorpay order details
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
   * Fetch Razorpay payment details
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
   * Refund a payment
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

  /**
   * Check if Razorpay is properly configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return this.isConfiguredFlag;
  }

  /**
   * Get Razorpay configuration for frontend
   * @returns {Object} Frontend configuration
   */
  getFrontendConfig() {
    if (!this.isConfiguredFlag) {
      return null;
    }
    
    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      currency: 'INR',
      name: process.env.SHOP_NAME || 'MyShop',
      description: process.env.SHOP_DESCRIPTION || 'E-commerce Store',
      prefill: {
        email: '',
        name: ''
      },
      theme: {
        color: '#8D6E63' // Primary color from theme
      }
    };
  }
}

module.exports = new RazorpayService();
