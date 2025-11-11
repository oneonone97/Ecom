const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');

/**
 * Payment Service using Stripe
 * Handles payment processing, refunds, and webhook events
 */
class PaymentService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('Stripe secret key not configured. Payment features will be disabled.');
    }
  }

  /**
   * Create a payment intent for checkout
   */
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      logger.info('Creating payment intent:', { amount, currency });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created:', { id: paymentIntent.id });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(paymentIntentId) {
    try {
      logger.info('Confirming payment:', { paymentIntentId });

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      };
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(orderItems, successUrl, cancelUrl, metadata = {}) {
    try {
      logger.info('Creating checkout session for items:', { count: orderItems.length });

      const lineItems = orderItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.productName,
            description: item.productDescription || '',
            images: item.image ? [item.image] : []
          },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'],
        },
      });

      logger.info('Checkout session created:', { id: session.id });

      return {
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Retrieve checkout session
   */
  async getCheckoutSession(sessionId) {
    try {
      logger.info('Retrieving checkout session:', { sessionId });

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return {
        id: session.id,
        status: session.payment_status,
        amountTotal: session.amount_total / 100,
        currency: session.currency,
        customerEmail: session.customer_details?.email,
        shippingDetails: session.shipping_details
      };
    } catch (error) {
      logger.error('Error retrieving checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId, amount = null, reason = null) {
    try {
      logger.info('Creating refund:', { paymentIntentId, amount, reason });

      const refundData = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        refundData.reason = reason;
      }

      const refund = await stripe.refunds.create(refundData);

      logger.info('Refund created:', { id: refund.id });

      return {
        id: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
        currency: refund.currency
      };
    } catch (error) {
      logger.error('Error creating refund:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        logger.warn('Stripe webhook secret not configured');
        return null;
      }

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      return event;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event) {
    try {
      logger.info('Processing webhook event:', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object);
          break;
        
        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;
        
        default:
          logger.info('Unhandled webhook event type:', event.type);
      }

      return { received: true };
    } catch (error) {
      logger.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    logger.info('Payment succeeded:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100
    });
    
    // Update order status in database
    // This should be implemented based on your order management logic
    return paymentIntent;
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(paymentIntent) {
    logger.warn('Payment failed:', {
      id: paymentIntent.id,
      lastError: paymentIntent.last_payment_error
    });
    
    // Update order status and notify user
    return paymentIntent;
  }

  /**
   * Handle completed checkout
   */
  async handleCheckoutComplete(session) {
    logger.info('Checkout completed:', {
      id: session.id,
      amount: session.amount_total / 100
    });
    
    // Create order in database and send confirmation email
    return session;
  }

  /**
   * Handle refund
   */
  async handleRefund(charge) {
    logger.info('Refund processed:', {
      id: charge.id,
      amountRefunded: charge.amount_refunded / 100
    });
    
    // Update order status and notify user
    return charge;
  }

  /**
   * Get customer payment methods
   */
  async getCustomerPaymentMethods(customerId) {
    try {
      logger.info('Retrieving payment methods:', { customerId });

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year
      }));
    } catch (error) {
      logger.error('Error retrieving payment methods:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(email, name, metadata = {}) {
    try {
      logger.info('Creating Stripe customer:', { email, name });

      const customer = await stripe.customers.create({
        email,
        name,
        metadata
      });

      logger.info('Stripe customer created:', { id: customer.id });

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name
      };
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Calculate application fee (for marketplace scenarios)
   */
  calculateApplicationFee(amount, percentage = 10) {
    return Math.round(amount * (percentage / 100) * 100) / 100;
  }
}

// Export singleton instance
module.exports = new PaymentService();
