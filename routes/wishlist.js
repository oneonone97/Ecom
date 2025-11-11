const express = require('express');
const router = express.Router();
const {
  getUserWishlists,
  getDefaultWishlist,
  createWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  updateWishlistItem,
  deleteWishlist,
  clearWishlist
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');
const { validateCSRF } = require('../middleware/csrf');
const { validateRequest } = require('../middleware/validation');

/**
 * Validation schemas
 */
const createWishlistSchema = {
  name: {
    optional: true,
    isString: {
      errorMessage: 'Name must be a string'
    },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Name cannot exceed 100 characters'
    }
  },
  description: {
    optional: true,
    isString: {
      errorMessage: 'Description must be a string'
    },
    isLength: {
      options: { max: 500 },
      errorMessage: 'Description cannot exceed 500 characters'
    }
  },
  isPublic: {
    optional: true,
    isBoolean: {
      errorMessage: 'isPublic must be a boolean'
    }
  }
};

const addItemSchema = {
  productId: {
    notEmpty: {
      errorMessage: 'Product ID is required'
    },
    isInt: {
      errorMessage: 'Product ID must be an integer'
    }
  },
  priority: {
    optional: true,
    isIn: {
      options: [['low', 'medium', 'high']],
      errorMessage: 'Priority must be low, medium, or high'
    }
  },
  notes: {
    optional: true,
    isString: {
      errorMessage: 'Notes must be a string'
    },
    isLength: {
      options: { max: 200 },
      errorMessage: 'Notes cannot exceed 200 characters'
    }
  }
};

const updateItemSchema = {
  priority: {
    optional: true,
    isIn: {
      options: [['low', 'medium', 'high']],
      errorMessage: 'Priority must be low, medium, or high'
    }
  },
  notes: {
    optional: true,
    isString: {
      errorMessage: 'Notes must be a string'
    },
    isLength: {
      options: { max: 200 },
      errorMessage: 'Notes cannot exceed 200 characters'
    }
  }
};

// All wishlist routes require authentication
router.use(protect);

// Get all user wishlists
router.get('/', getUserWishlists);

// Get default wishlist
router.get('/default', getDefaultWishlist);

// Create new wishlist - SECURITY: CSRF protection enabled
router.post('/', validateCSRF, validateRequest(createWishlistSchema), createWishlist);

// Wishlist item operations - SECURITY: CSRF protection enabled
router.post('/:wishlistId/items', validateCSRF, validateRequest(addItemSchema), addItemToWishlist);
router.put('/:wishlistId/items/:itemId', validateCSRF, validateRequest(updateItemSchema), updateWishlistItem);
router.delete('/:wishlistId/items/:productId', validateCSRF, removeItemFromWishlist);
router.delete('/:wishlistId/items', validateCSRF, clearWishlist);

// Delete wishlist - SECURITY: CSRF protection enabled
router.delete('/:wishlistId', validateCSRF, deleteWishlist);

module.exports = router;

