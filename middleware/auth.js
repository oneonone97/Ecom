const jwt = require('jsonwebtoken');
const db = require('../utils/database');
const logger = require('../utils/logger');
const { getTokenBlacklist } = require('../config/redis');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    // Check if token is blacklisted
    const tokenBlacklist = getTokenBlacklist();
    const isBlacklisted = await tokenBlacklist.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      logger.logSecurity('Blacklisted token used', {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Token has been revoked. Please log in again.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and validate existence and active status
    let user;
    try {
      user = await db.users.findByPk(decoded.id);
    } catch (dbError) {
      logger.error('Database error during user lookup:', {
        error: dbError.message,
        errorName: dbError.name,
        errorCode: dbError.code,
        userId: decoded.id,
        stack: dbError.stack
      });
      
      // Handle specific "Tenant or user not found" error from Supabase
      if (dbError.message && dbError.message.includes('Tenant or user not found')) {
        logger.logSecurity('Access attempt with token for non-existent user (Supabase error)', {
          userId: decoded.id,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND'
          }
        });
      }
      
      // Generic database error
      return res.status(500).json({
        success: false,
        message: 'Database error occurred. Please try again.'
      });
    }

    if (!user) {
      logger.logSecurity('Access attempt with token for non-existent user', {
        userId: decoded.id,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists. Please log in again.'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      logger.logSecurity('Access attempt with deactivated user account', {
        userId: user.id,
        email: user.email,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Account has been deactivated. Please contact support.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      logger.logSecurity('Invalid JWT token used', {
        error: err.message,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authentication token' 
      });
    } else if (err.name === 'TokenExpiredError') {
      logger.logSecurity('Expired JWT token used', {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token has expired. Please log in again.' 
      });
    }
    
    logger.logError(err, req);
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized to access this route' 
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

// Logout and blacklist token
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const tokenBlacklist = getTokenBlacklist();
      const decoded = jwt.decode(token);
      
      if (decoded && decoded.exp) {
        const expirationTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (expirationTime > 0) {
          await tokenBlacklist.addToken(token, expirationTime);
        }
      }

      logger.info('User logged out successfully', {
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};