const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new Map();
    this.defaultTTL = 300; // 5 minutes
    this.maxMemoryCacheSize = 1000;
    
    try {
      this.redisClient = getRedisClient();
    } catch (error) {
      logger.warn('Redis not available, using memory cache fallback');
    }
  }

  async get(key) {
    try {
      if (this.redisClient) {
        const value = await this.redisClient.get(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed.expires && Date.now() > parsed.expires) {
            await this.delete(key);
            return null;
          }
          logger.debug('Cache hit (Redis)', { key });
          return parsed.data;
        }
      }

      // Fallback to memory cache
      const memoryValue = this.memoryCache.get(key);
      if (memoryValue) {
        if (memoryValue.expires && Date.now() > memoryValue.expires) {
          this.memoryCache.delete(key);
          return null;
        }
        logger.debug('Cache hit (Memory)', { key });
        return memoryValue.data;
      }

      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = this.defaultTTL) {
    try {
      const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
      const cacheData = { data: value, expires };

      if (this.redisClient) {
        await this.redisClient.setEx(key, ttlSeconds || this.defaultTTL, JSON.stringify(cacheData));
        logger.debug('Cache set (Redis)', { key, ttl: ttlSeconds });
      } else {
        // Fallback to memory cache with size limit
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
          const firstKey = this.memoryCache.keys().next().value;
          this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(key, cacheData);
        logger.debug('Cache set (Memory)', { key, ttl: ttlSeconds });
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async delete(key) {
    try {
      if (this.redisClient) {
        await this.redisClient.del(key);
      }
      this.memoryCache.delete(key);
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async clear(pattern = '*') {
    try {
      if (this.redisClient) {
        if (pattern === '*') {
          await this.redisClient.flushDb();
        } else {
          const keys = await this.redisClient.keys(pattern);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        }
      }
      
      if (pattern === '*') {
        this.memoryCache.clear();
      } else {
        // Simple pattern matching for memory cache
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
      
      logger.info('Cache cleared', { pattern });
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  async getOrSet(key, fetchFunction, ttlSeconds = this.defaultTTL) {
    // Add timeout to cache get operation
    const getWithTimeout = Promise.race([
      this.get(key),
      new Promise((resolve) => setTimeout(() => resolve(null), 1000)) // 1 second timeout
    ]);

    const cached = await getWithTimeout;
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await fetchFunction();
      if (value !== null && value !== undefined) {
        // Don't wait for cache set, fire and forget to avoid blocking
        this.set(key, value, ttlSeconds).catch(err => {
          logger.warn('Cache set failed (non-blocking):', err);
        });
      }
      return value;
    } catch (error) {
      logger.error('Cache getOrSet fetch error:', error);
      throw error;
    }
  }

  generateKey(...parts) {
    return parts.join(':');
  }

  async getStats() {
    try {
      const stats = {
        type: this.redisClient ? 'redis' : 'memory',
        memorySize: this.memoryCache.size,
        maxMemorySize: this.maxMemoryCacheSize
      };

      if (this.redisClient) {
        const info = await this.redisClient.info('memory');
        stats.redisMemory = info;
      }

      return stats;
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { error: error.message };
    }
  }

  async invalidateByPattern(pattern) {
    await this.clear(pattern);
  }

  async invalidateUser(userId) {
    await this.invalidateByPattern(`user:${userId}:*`);
  }

  async invalidateProduct(productId) {
    await this.invalidateByPattern(`product:${productId}:*`);
    await this.delete('products:all');
    await this.invalidateByPattern('products:category:*');
  }

  async warmupCache() {
    logger.info('Starting cache warmup');
    
    try {
      // Warmup common product queries
      const ProductRepository = require('../repositories/ProductRepository');
      const productRepo = new ProductRepository();
      
      // Cache popular products
      const popularProducts = await productRepo.findAll({ limit: 50 });
      await this.set('products:popular', popularProducts, 3600); // 1 hour
      
      // Cache product categories
      const categories = await productRepo.getCategories();
      await this.set('products:categories', categories, 7200); // 2 hours
      
      logger.info('Cache warmup completed');
    } catch (error) {
      logger.error('Cache warmup error:', error);
    }
  }
}

module.exports = CacheService;