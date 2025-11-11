const express = require('express');
const { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories,
  searchProducts,
  getCacheStats,
  clearCache,
  getNewProducts,
  getSaleProducts
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { validateProduct, validateProductUpdate, validateId, validatePagination } = require('../middleware/validation');
const { validateCSRF } = require('../middleware/csrf');
const { uploadSingle } = require('../middleware/fileUpload');

const router = express.Router();

// Search and categories routes (must be before /:id)
router.get('/search', searchProducts);
router.get('/categories', getCategories);
router.get('/new', getNewProducts);
router.get('/sale', getSaleProducts);

// Cache management routes (admin only)
router.get('/cache/stats', protect, authorize('admin'), getCacheStats);
router.delete('/cache', protect, authorize('admin'), validateCSRF, clearCache);

router.route('/')
  .get(validatePagination, getProducts)
  .post(
    protect, 
    authorize('admin'), 
    validateCSRF, 
    uploadSingle('image'),
    validateProduct, 
    createProduct
  );

router.route('/:id')
  .get(validateId, getProduct)
  .put(
    protect, 
    authorize('admin'), 
    validateCSRF, 
    validateId, 
    uploadSingle('image'),
    validateProductUpdate, 
    updateProduct
  )
  .delete(protect, authorize('admin'), validateCSRF, validateId, deleteProduct);

module.exports = router;