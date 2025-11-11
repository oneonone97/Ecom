const express = require('express');
const { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeCartItem, 
  clearCart 
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const { validateCSRF } = require('../middleware/csrf');

const router = express.Router();

// All cart routes require authentication
router.use(protect);

// SECURITY: CSRF protection ENABLED for all state-changing cart operations
router.route('/')
  .get(getCart)
  .post(validateCSRF, addToCart)
  .delete(validateCSRF, clearCart);

router.route('/:itemId')
  .put(validateCSRF, updateCartItem)
  .delete(validateCSRF, removeCartItem);

module.exports = router;