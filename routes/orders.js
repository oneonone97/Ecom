const express = require('express');
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const { validateCSRF } = require('../middleware/csrf');

const router = express.Router();

// All order routes require authentication
router.use(protect);

// SECURITY: CSRF protection for state-changing operations
router.route('/')
  .get(getOrders)
  .post(validateCSRF, createOrder);

router.route('/:id')
  .get(getOrder)
  .put(validateCSRF, authorize('admin'), updateOrderStatus);

module.exports = router;