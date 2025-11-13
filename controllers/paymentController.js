const paymentService = require('../services/PaymentService');
const db = require('../utils/database');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, orderId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    logger.info(`Creating payment intent for user ${req.user.id}`, { amount, orderId });

    const metadata = {
      userId: req.user.id.toString(),
      userEmail: req.user.email
    };

    if (orderId) {
      metadata.orderId = orderId.toString();
    }

    const paymentIntent = await paymentService.createPaymentIntent(
      amount,
      'usd',
      metadata
    );

    res.status(200).json({
      success: true,
      data: paymentIntent
    });
  } catch (error) {
    logger.error('Error creating payment intent:', error);
    next(error);
  }
};

/**
 * @desc    Create checkout session
 * @route   POST /api/payments/create-checkout
 * @access  Private
 */
const createCheckoutSession = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    logger.info(`Creating checkout session for order ${orderId}`);

    // Get order with items
    const order = await db.orders.findByPk(orderId);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items
    const orderItems = await db.orderItems.findAll({ where: { orderId } });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?cancelled=true`;

    const metadata = {
      orderId: orderId.toString(),
      userId: req.user.id.toString()
    };

    const session = await paymentService.createCheckoutSession(
      order.items,
      successUrl,
      cancelUrl,
      metadata
    );

    // Update order with session ID
    await order.update({
      paymentMethod: 'stripe',
      orderNotes: JSON.stringify({ stripeSessionId: session.sessionId })
    });

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    next(error);
  }
};

/**
 * @desc    Verify payment status
 * @route   GET /api/payments/verify/:sessionId
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Verifying payment session ${sessionId}`);

    const session = await paymentService.getCheckoutSession(sessionId);

    if (session.status === 'paid') {
      // Find and update order
      const orders = await db.orders.findAll();
      const order = orders.find(o =>
        o.userId === req.user.id &&
        o.orderNotes &&
        o.orderNotes.includes(sessionId)
      );

      if (order && order.paymentStatus !== 'paid') {
        await order.update({
          paymentStatus: 'paid',
          status: 'processing'
        });

        // Send confirmation email
        await order.reload({ include: ['items'] });
        const user = await db.users.findByPk(req.user.id);
        await emailService.sendOrderConfirmation(order, user);

        logger.info(`Order ${order.id} payment confirmed`);
      }
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error verifying payment:', error);
    next(error);
  }
};

/**
 * @desc    Handle Stripe webhooks
 * @route   POST /api/payments/webhook
 * @access  Public (validated by Stripe signature)
 */
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing stripe signature'
      });
    }

    logger.info('Received Stripe webhook');

    const event = paymentService.verifyWebhookSignature(
      req.body,
      signature
    );

    if (!event) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    await paymentService.handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling webhook:', error);
    next(error);
  }
};

/**
 * @desc    Request refund
 * @route   POST /api/payments/refund
 * @access  Private (Admin only)
 */
const requestRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;
    
    logger.info(`Processing refund for order ${orderId}`, { amount, reason });

    // Get order
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order payment not completed'
      });
    }

    // Extract payment intent ID from order notes
    let paymentIntentId = null;
    try {
      const notes = JSON.parse(order.orderNotes);
      paymentIntentId = notes.paymentIntentId || notes.stripeSessionId;
    } catch (error) {
      logger.warn('Could not parse order notes for payment ID');
    }

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment information not found'
      });
    }

    const refund = await paymentService.createRefund(
      paymentIntentId,
      amount,
      reason
    );

    // Update order status
    await order.update({
      paymentStatus: 'refunded',
      status: 'cancelled'
    });

    logger.info(`Refund processed for order ${orderId}`, { refundId: refund.id });

    res.status(200).json({
      success: true,
      data: refund,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    logger.error('Error processing refund:', error);
    next(error);
  }
};

module.exports = {
  createPaymentIntent,
  createCheckoutSession,
  verifyPayment,
  handleWebhook,
  requestRefund
};

