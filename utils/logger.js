const winston = require('winston');
const path = require('path');

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'myshop-api' },
  transports: [],
});

// In serverless environments, only use console transport
// File system is read-only except for /tmp, and file logging doesn't persist anyway
if (isServerless) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }));
} else {
  // In non-serverless environments, use file transports
  const fs = require('fs');
  const logsDir = path.join(__dirname, '../logs');
  
  // Create logs directory if it doesn't exist (only in non-serverless)
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      // If we can't create the directory, fall back to console only
      console.warn('Could not create logs directory, using console logging only:', error.message);
    }
  }
  
  // Only add file transports if directory exists or was created successfully
  if (fs.existsSync(logsDir)) {
    // Write all logs with level `error` and below to `error.log`
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
    
    // Write all logs with level `info` and below to `combined.log`
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
  }
  
  // Always add console transport for non-serverless environments
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper methods for common logging patterns
logger.logRequest = (req, res, responseTime) => {
  logger.log('info', 'HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('Content-Length') || 0
  });
};

logger.logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
  }
  
  logger.error('Application Error', errorInfo);
};

logger.logSecurity = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = logger;