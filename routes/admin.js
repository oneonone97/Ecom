const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validateRequest, validateId } = require('../middleware/validation');
const {
  getDashboard,
  getAnalytics,
  getInventoryOverview,
  updateProductStock,
  bulkUpdateStock,
  getAllOrders,
  updateOrderStatus,
  getSystemStats,
  getUsers,
  updateUserStatus,
  clearCache,
  exportData
} = require('../controllers/adminController');

// Validation schemas
const updateStockSchema = {
  stock: {
    isNumeric: {
      errorMessage: 'Stock must be a number'
    },
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Stock must be non-negative'
    }
  },
  reason: {
    optional: true,
    isString: {
      errorMessage: 'Reason must be a string'
    },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Reason cannot exceed 100 characters'
    }
  }
};

const updateOrderStatusSchema = {
  status: {
    isIn: {
      options: [['pending', 'processing', 'shipped', 'delivered', 'cancelled']],
      errorMessage: 'Invalid order status'
    }
  }
};

const updateUserStatusSchema = {
  isActive: {
    isBoolean: {
      errorMessage: 'isActive must be a boolean'
    }
  }
};

// Apply authentication and admin restriction to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard and Analytics
router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/stats', getSystemStats);

// Inventory Management
router.get('/inventory', getInventoryOverview);
router.put('/inventory/:productId/stock', validateId, validateRequest(updateStockSchema), updateProductStock);
router.put('/inventory/bulk-update', validateRequest(updateStockSchema), bulkUpdateStock);

// Order Management
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', validateId, validateRequest(updateOrderStatusSchema), updateOrderStatus);

// User Management
router.get('/users', getUsers);
router.put('/users/:id/status', validateId, validateRequest(updateUserStatusSchema), updateUserStatus);

// System Management
router.delete('/cache', clearCache);

// Data Export
router.get('/export/:type', exportData);

module.exports = router;