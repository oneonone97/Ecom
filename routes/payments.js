const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  createCheckoutSession,
  verifyPayment,
  handleWebhook,
  requestRefund
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { validateCSRF } = require('../middleware/csrf');
const { validateRequest } = require('../middleware/validation');

/**
 * Validation schemas
 */
const createPaymentIntentSchema = {
  amount: {
    notEmpty: {
      errorMessage: 'Amount is required'
    },
    isFloat: {
      options: { min: 0.5 },
      errorMessage: 'Amount must be at least $0.50'
    }
  },
  orderId: {
    optional: true,
    isInt: {
      errorMessage: 'Order ID must be an integer'
    }
  }
};

const createCheckoutSchema = {
  orderId: {
    notEmpty: {
      errorMessage: 'Order ID is required'
    },
    isInt: {
      errorMessage: 'Order ID must be an integer'
    }
  }
};

const refundSchema = {
  orderId: {
    notEmpty: {
      errorMessage: 'Order ID is required'
    },
    isInt: {
      errorMessage: 'Order ID must be an integer'
    }
  },
  amount: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Amount must be positive'
    }
  },
  reason: {
    optional: true,
    isString: {
      errorMessage: 'Reason must be a string'
    }
  }
};

// Webhook endpoint (no auth, validated by Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected payment endpoints - SECURITY: CSRF protection enabled
router.post('/create-intent', protect, validateCSRF, validateRequest(createPaymentIntentSchema), createPaymentIntent);
router.post('/create-checkout', protect, validateCSRF, validateRequest(createCheckoutSchema), createCheckoutSession);
router.get('/verify/:sessionId', protect, verifyPayment);

// Admin only - refunds - SECURITY: CSRF protection enabled
router.post('/refund', protect, validateCSRF, authorize('admin'), validateRequest(refundSchema), requestRefund);

module.exports = router;

