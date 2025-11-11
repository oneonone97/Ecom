const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
        location: error.location
      })),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage("Name can only contain letters, spaces, apostrophes, periods, and hyphens"),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Product validation rules for creation
const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  
  body('category')
    .custom((value) => {
      // Accept either category name (string, 2-50 chars) or category ID (number or numeric string)
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // Check if it's a numeric string (category ID)
        if (!isNaN(trimmed) && trimmed !== '') {
          return true; // Valid category ID
        }
        // Check if it's a category name (2-50 chars)
        if (trimmed.length >= 2 && trimmed.length <= 50) {
          return true; // Valid category name
        }
      } else if (typeof value === 'number' || !isNaN(value)) {
        return true; // Valid category ID (number)
      }
      throw new Error('Category must be a valid category name (2-50 characters) or category ID');
    }),
  
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  handleValidationErrors
];

// Product validation rules for updates (partial)
const validateProductUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  
  body('category')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true; // Optional field
      }
      // Accept either category name (string, 2-50 chars) or category ID (number or numeric string)
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // Check if it's a numeric string (category ID)
        if (!isNaN(trimmed) && trimmed !== '') {
          return true; // Valid category ID
        }
        // Check if it's a category name (2-50 chars)
        if (trimmed.length >= 2 && trimmed.length <= 50) {
          return true; // Valid category name
        }
      } else if (typeof value === 'number' || !isNaN(value)) {
        return true; // Valid category ID (number)
      }
      throw new Error('Category must be a valid category name (2-50 characters) or category ID');
    }),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  handleValidationErrors
];

// Cart validation rules
const validateCartItem = [
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Valid product ID is required'),
  
  body('quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10'),
  
  handleValidationErrors
];

// Order validation rules
const validateOrder = [
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Street address must be between 5 and 100 characters'),
  
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  
  body('shippingAddress.state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  
  body('shippingAddress.zipCode')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please provide a valid ZIP code'),
  
  body('paymentMethod')
    .isIn(['credit_card', 'debit_card', 'paypal', 'cash_on_delivery'])
    .withMessage('Invalid payment method'),
  
  handleValidationErrors
];

// Dynamic validation function for admin routes
const validateRequest = (schema) => {
  return [
    // Convert schema to express-validator rules
    ...Object.entries(schema).map(([field, rules]) => {
      let validator = body(field);
      
      if (rules.optional) {
        validator = validator.optional();
      }
      
      if (rules.notEmpty) {
        validator = validator.notEmpty().withMessage(rules.notEmpty.errorMessage || `${field} is required`);
      }
      
      if (rules.isString) {
        validator = validator.isString().withMessage(rules.isString.errorMessage || `${field} must be a string`);
      }
      
      if (rules.isNumeric) {
        validator = validator.isNumeric().withMessage(rules.isNumeric.errorMessage || `${field} must be a number`);
      }
      
      if (rules.isFloat) {
        validator = validator.isFloat(rules.isFloat.options || {}).withMessage(rules.isFloat.errorMessage || `${field} must be a valid number`);
      }
      
      if (rules.isBoolean) {
        validator = validator.isBoolean().withMessage(rules.isBoolean.errorMessage || `${field} must be a boolean`);
      }
      
      if (rules.isIn) {
        validator = validator.isIn(rules.isIn.options).withMessage(rules.isIn.errorMessage || `${field} has invalid value`);
      }
      
      if (rules.isLength) {
        validator = validator.isLength(rules.isLength.options).withMessage(rules.isLength.errorMessage || `${field} length is invalid`);
      }
      
      if (rules.isEmail) {
        validator = validator.isEmail().withMessage(rules.isEmail.errorMessage || `${field} must be a valid email`);
      }
      
      return validator;
    }),
    handleValidationErrors
  ];
};

// Common validation rules
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// Checkout validation rules
const validateCheckoutOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Cart items are required'),
  
  body('items.*.productId')
    .isInt({ min: 1 })
    .withMessage('Valid product ID is required for each item'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10 for each item'),
  
  body('address.name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('address.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('address.phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Valid 10-digit phone number is required'),
  
  body('address.address')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  
  body('address.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  
  body('address.state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  
  body('address.pincode')
    .matches(/^\d{6}$/)
    .withMessage('Valid 6-digit pincode is required'),
  
  handleValidationErrors
];

const validatePaymentVerification = [
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Razorpay order ID is required'),
  
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),
  
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Razorpay signature is required'),
  
  body('orderId')
    .isInt({ min: 1 })
    .withMessage('Valid order ID is required'),
  
  handleValidationErrors
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProduct,
  validateProductUpdate,
  validateCartItem,
  validateOrder,
  validateCheckoutOrder,
  validatePaymentVerification,
  validateId,
  validatePagination,
  validateRequest,
  handleValidationErrors
};