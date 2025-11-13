const logger = require('../utils/logger');

// Standard error response format
const formatErrorResponse = (statusCode, message, errorCode = null, details = null) => {
  const response = {
    success: false,
    error: {
      message,
      statusCode,
      ...(errorCode && { code: errorCode }),
      timestamp: new Date().toISOString()
    }
  };
  
  // Never include stack traces or sensitive details in production
  if (process.env.NODE_ENV === 'development' && details) {
    // Only include safe details in development
    const safeDetails = {};
    if (details.field) safeDetails.field = details.field;
    if (details.originalError) safeDetails.originalError = details.originalError;
    
    response.error.details = safeDetails;
    
    // Stack traces only in development and never with sensitive data
    if (details.stack && !message.toLowerCase().includes('password') && 
        !message.toLowerCase().includes('token') && 
        !message.toLowerCase().includes('secret')) {
      response.error.stack = details.stack;
    }
  }
  
  return response;
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = null;
  let details = null;

  // Log error
  logger.error(`Error ${statusCode}: ${message}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: err.stack
  });

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
    details = err.errors.map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));
  }

  // Sequelize unique constraint error
  else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'Duplicate field value';
    errorCode = 'DUPLICATE_FIELD';
    const field = err.errors[0]?.path || 'unknown';
    details = { field, value: err.errors[0]?.value || 'unknown' };
  }

  // Sequelize foreign key constraint error
  else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid reference ID';
    errorCode = 'INVALID_REFERENCE';
    details = { table: err.table, field: err.fields };
  }

  // Sequelize database connection error
  else if (err.name === 'SequelizeConnectionError') {
    statusCode = 503;
    message = 'Database connection error';
    errorCode = 'DATABASE_CONNECTION_ERROR';
  }

  // Sequelize timeout error
  else if (err.name === 'SequelizeTimeoutError') {
    statusCode = 503;
    message = 'Database operation timeout';
    errorCode = 'DATABASE_TIMEOUT';
  }

  // Service layer errors (custom business logic errors)
  else if (err.message && typeof err.message === 'string') {
    // Handle common service layer error patterns
    if (err.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'RESOURCE_NOT_FOUND';
    } else if (err.message.includes('already exists')) {
      statusCode = 409;
      errorCode = 'RESOURCE_ALREADY_EXISTS';
    } else if (err.message.includes('validation') || err.message.includes('invalid')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (err.message.includes('unauthorized') || err.message.includes('access denied')) {
      statusCode = 403;
      errorCode = 'ACCESS_DENIED';
    } else if (err.message.includes('authentication') || err.message.includes('login') || err.message.includes('password')) {
      statusCode = 401;
      errorCode = 'AUTHENTICATION_ERROR';
    }
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  }

  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorCode = 'TOKEN_EXPIRED';
  }


  // Rate limit errors
  else if (err.statusCode === 429) {
    message = 'Too many requests, please try again later';
    errorCode = 'RATE_LIMIT_EXCEEDED';
  }

  // Sanitize error messages in production
  if (process.env.NODE_ENV === 'production') {
    // Generic error messages for production
    if (statusCode === 500) {
      message = 'Internal server error';
    }
    
    // Remove potentially sensitive information from error messages
    if (message.includes('ENOENT') || message.includes('EACCES')) {
      message = 'Resource access error';
    }
    
    if (message.includes('connect') && message.includes('ECONNREFUSED')) {
      message = 'Service temporarily unavailable';
    }
  }

  const response = formatErrorResponse(statusCode, message, errorCode, {
    originalError: err.name,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    ...details
  });

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
