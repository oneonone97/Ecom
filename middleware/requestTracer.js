const logger = require('../utils/logger');

const requestTracer = (req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`);
  
  res.on('finish', () => {
    logger.info(`Response Sent: ${res.statusCode} for ${req.method} ${req.originalUrl}`);
  });

  next();
};

module.exports = requestTracer;