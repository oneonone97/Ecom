const logger = require('../utils/logger');

/**
 * Middleware to require admin role
 * Must be used after the protect middleware
 */
const requireAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated (should be set by protect middleware)
    if (!req.user) {
      logger.logSecurity('Admin access attempt without authentication', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Authentication required.',
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED'
        }
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      logger.logSecurity('Non-admin user attempted admin access', {
        userId: req.user.id,
        userRole: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Admin privileges required.',
          statusCode: 403,
          code: 'ADMIN_ACCESS_REQUIRED'
        }
      });
    }

    // Check if user account is active
    if (!req.user.isActive) {
      logger.logSecurity('Inactive admin user attempted access', {
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Account is inactive.',
          statusCode: 403,
          code: 'ACCOUNT_INACTIVE'
        }
      });
    }

    // User is authenticated admin with active account
    logger.info('Admin access granted', {
      userId: req.user.id,
      email: req.user.email,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      url: req.originalUrl
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        statusCode: 500,
        code: 'INTERNAL_ERROR'
      }
    });
  }
};

module.exports = requireAdmin;
