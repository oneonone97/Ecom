const redis = require('redis');
const logger = require('../utils/logger');

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

let redisClient = null;

const initializeRedis = async () => {
  // In serverless, if no Redis URL is provided, skip initialization and use fallback
  if (isServerless && !process.env.REDIS_URL) {
    logger.warn('Redis URL not configured in serverless environment. Using in-memory fallback.');
    return null;
  }

  try {
    const redisConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    };

    // Add password if provided
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    logger.info('Redis connection test successful');

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    
    // In serverless or development, continue without Redis (use memory fallback)
    if (isServerless || process.env.NODE_ENV !== 'production') {
      logger.warn(`Running without Redis in ${isServerless ? 'serverless' : 'development'} mode. Using in-memory fallback.`);
      return null;
    } else {
      // In non-serverless production, Redis is critical
      throw error;
    }
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    // In serverless or development, return null instead of throwing
    // This allows graceful fallback to in-memory storage
    if (isServerless || process.env.NODE_ENV !== 'production') {
      return null;
    }
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};

// Token blacklist management
class TokenBlacklist {
  constructor(client) {
    this.client = client;
    this.prefix = 'blacklist:';
  }

  async addToken(token, expirationTime) {
    if (!this.client || !this.client.isReady) {
      // Fallback to in-memory storage for development or when Redis is not ready
      if (!global.tokenBlacklist) {
        global.tokenBlacklist = new Set();
      }
      global.tokenBlacklist.add(token);

      // Clean up expired tokens after expiration time
      setTimeout(() => {
        global.tokenBlacklist.delete(token);
      }, expirationTime * 1000);

      return;
    }

    try {
      const key = `${this.prefix}${token}`;
      await this.client.setEx(key, expirationTime, 'blacklisted');
      logger.info(`Token blacklisted: ${token.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      throw error;
    }
  }

  async isTokenBlacklisted(token) {
    if (!this.client || !this.client.isReady) {
      // Fallback to in-memory storage for development or when Redis is not ready
      return global.tokenBlacklist ? global.tokenBlacklist.has(token) : false;
    }

    try {
      const key = `${this.prefix}${token}`;
      const result = await this.client.get(key);
      return result === 'blacklisted';
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false; // Fail open for availability
    }
  }

  async removeToken(token) {
    if (!this.client) {
      // Fallback to in-memory storage for development
      if (global.tokenBlacklist) {
        global.tokenBlacklist.delete(token);
      }
      return;
    }

    try {
      const key = `${this.prefix}${token}`;
      await this.client.del(key);
      logger.info(`Token removed from blacklist: ${token.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Failed to remove token from blacklist:', error);
    }
  }

  async clearAllTokens() {
    if (!this.client) {
      // Clear in-memory storage
      global.tokenBlacklist = new Set();
      return;
    }

    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} blacklisted tokens`);
      }
    } catch (error) {
      logger.error('Failed to clear token blacklist:', error);
    }
  }
}

// Session management
class SessionManager {
  constructor(client) {
    this.client = client;
    this.prefix = 'session:';
  }

  async createSession(userId, sessionData, expirationTime = 24 * 60 * 60) {
    if (!this.client) {
      // Fallback for development
      return `dev_session_${userId}_${Date.now()}`;
    }

    try {
      const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const key = `${this.prefix}${sessionId}`;
      
      await this.client.setEx(key, expirationTime, JSON.stringify({
        userId,
        createdAt: new Date().toISOString(),
        ...sessionData
      }));

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    if (!this.client) {
      return null; // No session data in development fallback
    }

    try {
      const key = `${this.prefix}${sessionId}`;
      const sessionData = await this.client.get(key);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  async deleteSession(sessionId) {
    if (!this.client) {
      return; // No-op for development
    }

    try {
      const key = `${this.prefix}${sessionId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error('Failed to delete session:', error);
    }
  }

  async refreshSession(sessionId, expirationTime = 24 * 60 * 60) {
    if (!this.client) {
      return; // No-op for development
    }

    try {
      const key = `${this.prefix}${sessionId}`;
      await this.client.expire(key, expirationTime);
    } catch (error) {
      logger.error('Failed to refresh session:', error);
    }
  }
}

let tokenBlacklist = null;
let sessionManager = null;

const getTokenBlacklist = () => {
  if (!tokenBlacklist) {
    tokenBlacklist = new TokenBlacklist(redisClient);
  }
  return tokenBlacklist;
};

const getSessionManager = () => {
  if (!sessionManager) {
    sessionManager = new SessionManager(redisClient);
  }
  return sessionManager;
};

module.exports = {
  initializeRedis,
  getRedisClient,
  getTokenBlacklist,
  getSessionManager
};