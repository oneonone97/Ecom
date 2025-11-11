const Joi = require('joi');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { sanitize } = require('dompurify');
const { JSDOM } = require('jsdom');

// Initialize DOMPurify with JSDOM for server-side HTML sanitization
const window = new JSDOM('').window;
const DOMPurify = require('dompurify')(window);

// Comprehensive validation schemas using Joi
const schemas = {
  // User validation schemas
  userRegistration: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name can only contain letters and spaces',
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters'
      }),
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .max(255)
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email cannot exceed 255 characters'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters'
      })
  }),

  userLogin: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .max(255)
      .lowercase()
      .required(),
    password: Joi.string()
      .min(1)
      .max(128)
      .required()
  }),

  userUpdate: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .optional(),
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .max(255)
      .lowercase()
      .optional(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-()]+$/)
      .min(10)
      .max(20)
      .optional(),
    address: Joi.object({
      street: Joi.string().max(255).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().pattern(/^[\d\-\s]+$/).max(20).optional(),
      country: Joi.string().max(100).optional()
    }).optional()
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string()
      .min(1)
      .max(128)
      .required(),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      })
  }),

  // Product validation schemas
  product: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.min': 'Product name must be at least 2 characters long',
        'string.max': 'Product name cannot exceed 255 characters'
      }),
    description: Joi.string()
      .trim()
      .min(10)
      .max(2000)
      .required()
      .messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    price: Joi.number()
      .positive()
      .precision(2)
      .max(1000000)
      .required()
      .messages({
        'number.positive': 'Price must be a positive number',
        'number.max': 'Price cannot exceed 1,000,000'
      }),
    category: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Category must be at least 2 characters long',
        'string.max': 'Category cannot exceed 100 characters'
      }),
    stock: Joi.number()
      .integer()
      .min(0)
      .max(100000)
      .required()
      .messages({
        'number.integer': 'Stock must be a whole number',
        'number.min': 'Stock cannot be negative',
        'number.max': 'Stock cannot exceed 100,000'
      }),
    sku: Joi.string()
      .pattern(/^[A-Z0-9\-_]+$/)
      .max(50)
      .optional()
      .messages({
        'string.pattern.base': 'SKU can only contain uppercase letters, numbers, hyphens, and underscores'
      }),
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
  }),

  productUpdate: Joi.object({
    name: Joi.string().trim().min(2).max(255).optional(),
    description: Joi.string().trim().min(10).max(2000).optional(),
    price: Joi.number().positive().precision(2).max(1000000).optional(),
    category: Joi.string().trim().min(2).max(100).optional(),
    stock: Joi.number().integer().min(0).max(100000).optional(),
    sku: Joi.string().pattern(/^[A-Z0-9\-_]+$/).max(50).optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional()
  }),

  // Cart validation schemas
  cartItem: Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).max(100).required()
  }),

  // Order validation schemas
  order: Joi.object({
    shippingAddress: Joi.object({
      street: Joi.string().trim().min(5).max(255).required(),
      city: Joi.string().trim().min(2).max(100).required(),
      state: Joi.string().trim().min(2).max(100).required(),
      zipCode: Joi.string().pattern(/^[\d\-\s]+$/).min(5).max(20).required(),
      country: Joi.string().trim().min(2).max(100).required()
    }).required(),
    paymentMethod: Joi.string()
      .valid('credit_card', 'debit_card', 'paypal', 'stripe')
      .required(),
    notes: Joi.string().max(500).optional()
  }),

  // Pagination and query schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'price').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  search: Joi.object({
    q: Joi.string().trim().min(1).max(100).required(),
    category: Joi.string().trim().max(100).optional(),
    minPrice: Joi.number().positive().optional(),
    maxPrice: Joi.number().positive().optional(),
    inStock: Joi.boolean().optional()
  })
};

// Sanitization helper
const sanitizeInput = (obj) => {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj.trim());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return obj;
};

// Main validation middleware factory
const validate = (schemaName, target = 'body') => {
  return async (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        logger.error(`Validation schema '${schemaName}' not found`);
        return res.status(500).json({
          success: false,
          message: 'Internal validation error'
        });
      }

      // Get data to validate based on target
      let dataToValidate;
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      // Sanitize input
      const sanitizedData = sanitizeInput(dataToValidate);

      // Validate with Joi
      const { error, value } = schema.validate(sanitizedData, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.logSecurity('Validation failed', {
          schema: schemaName,
          errors: errorDetails,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorDetails
        });
      }

      // Replace original data with validated and sanitized data
      if (target === 'body') {
        req.body = value;
      } else if (target === 'query') {
        req.query = value;
      } else if (target === 'params') {
        req.params = value;
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal validation error'
      });
    }
  };
};

// Express-validator middleware for additional checks
const expressValidators = {
  validateId: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('ID must be a positive integer')
      .toInt(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID parameter',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  validateEmail: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Email validation failed',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  validatePrice: [
    body('price')
      .isFloat({ min: 0.01, max: 1000000 })
      .withMessage('Price must be between 0.01 and 1,000,000')
      .toFloat(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Price validation failed',
          errors: errors.array()
        });
      }
      next();
    }
  ]
};

// File upload validation
const validateFileUpload = (allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      });
    }

    // Additional security checks
    const dangerousPatterns = [
      /\.php$/i,
      /\.exe$/i,
      /\.bat$/i,
      /\.sh$/i,
      /\.js$/i,
      /\.html$/i,
      /\.htm$/i
    ];

    if (dangerousPatterns.some(pattern => pattern.test(req.file.originalname))) {
      return res.status(400).json({
        success: false,
        message: 'File type not allowed for security reasons'
      });
    }

    next();
  };
};

// Rate limiting validation
const validateRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    keyGenerator: (req) => {
      // Use IP and user ID (if authenticated) for rate limiting
      const userId = req.user?.id || 'anonymous';
      return `${req.ip}-${userId}`;
    },
    onLimitReached: (req) => {
      logger.logSecurity('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });
    }
  });
};

// SQL injection prevention
const preventSQLInjection = (req, res, next) => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /('|(\\')|(;)|(--)|(\|)|(\*)|(%)|(\+)|(=))/g,
    /((\%3D)|(=))[^\n]*((\%27)|(')|((\%3B)|(;)))/gi,
    /((\%27)|')union/gi
  ];

  const checkForSQLInjection = (obj) => {
    if (typeof obj === 'string') {
      return sqlInjectionPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkForSQLInjection);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForSQLInjection);
    }
    
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    logger.logSecurity('SQL injection attempt detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid input detected'
    });
  }

  next();
};

module.exports = {
  validate,
  schemas,
  expressValidators,
  validateFileUpload,
  validateRateLimit,
  preventSQLInjection,
  sanitizeInput
};