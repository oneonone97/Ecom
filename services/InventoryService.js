const logger = require('../utils/logger');
const BaseService = require('./BaseService');
const db = require('../utils/database');

class InventoryService extends BaseService {
  constructor(cacheService, notificationService) {
    super();
    this.cacheService = cacheService;
    this.notificationService = notificationService;
    // No repository dependency - using direct database access
    
    // Inventory thresholds
    this.LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 10;
    this.OUT_OF_STOCK_THRESHOLD = 0;
    this.CRITICAL_STOCK_THRESHOLD = 5;
  }

  async updateStock(productId, newStock, reason = 'manual_adjustment', orderId = null) {
    try {
      const product = await db.products.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const oldStock = product.stock;
      const stockDifference = newStock - oldStock;

      // Update product stock
      const updatedProduct = await db.products.update(productId, {
        stock: newStock
      });

      // Log inventory movement
      await this.logInventoryMovement({
        productId,
        productName: product.name,
        movementType: stockDifference > 0 ? 'inbound' : 'outbound',
        quantity: Math.abs(stockDifference),
        oldStock,
        newStock,
        reason,
        orderId
      });

      // Check for stock alerts
      await this.checkStockAlerts(updatedProduct);

      // Invalidate product cache
      await this.cacheService.invalidateProduct(productId);

      logger.info('Stock updated successfully', {
        productId,
        productName: product.name,
        oldStock,
        newStock,
        difference: stockDifference,
        reason
      });

      return {
        product: updatedProduct,
        stockMovement: {
          oldStock,
          newStock,
          difference: stockDifference,
          reason
        }
      };
    } catch (error) {
      logger.error('Error updating stock:', error);
      throw error;
    }
  }

  async adjustStock(productId, quantity, reason = 'manual_adjustment') {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const newStock = Math.max(0, product.stock + quantity);
      return await this.updateStock(productId, newStock, reason);
    } catch (error) {
      logger.error('Error adjusting stock:', error);
      throw error;
    }
  }

  async reserveStock(productId, quantity, orderId) {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
      }

      // For now, we'll directly reduce stock
      // In a more advanced system, you might have a separate reserved_stock field
      const newStock = product.stock - quantity;
      
      return await this.updateStock(productId, newStock, 'order_reservation', orderId);
    } catch (error) {
      logger.error('Error reserving stock:', error);
      throw error;
    }
  }

  async releaseReservedStock(productId, quantity, orderId) {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const newStock = product.stock + quantity;
      
      return await this.updateStock(productId, newStock, 'reservation_release', orderId);
    } catch (error) {
      logger.error('Error releasing reserved stock:', error);
      throw error;
    }
  }

  async checkStockAvailability(productId, requestedQuantity) {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        return {
          available: false,
          reason: 'Product not found'
        };
      }

      const isAvailable = product.stock >= requestedQuantity;
      
      return {
        available: isAvailable,
        availableStock: product.stock,
        requestedQuantity,
        reason: isAvailable ? null : 'Insufficient stock'
      };
    } catch (error) {
      logger.error('Error checking stock availability:', error);
      return {
        available: false,
        reason: 'Error checking availability'
      };
    }
  }

  async bulkCheckStockAvailability(items) {
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          const availability = await this.checkStockAvailability(item.productId, item.quantity);
          return {
            productId: item.productId,
            ...availability
          };
        })
      );

      const allAvailable = results.every(result => result.available);
      const unavailableItems = results.filter(result => !result.available);

      return {
        allAvailable,
        items: results,
        unavailableItems
      };
    } catch (error) {
      logger.error('Error in bulk stock availability check:', error);
      throw error;
    }
  }

  async getLowStockProducts(threshold = this.LOW_STOCK_THRESHOLD) {
    try {
      // Direct query without cache to avoid timeout issues
      const products = await this.productRepository.model.findAll({
        where: {
          stock: {
            [Op.lte]: threshold,
            [Op.gt]: this.OUT_OF_STOCK_THRESHOLD
          }
        },
        attributes: ['id', 'name', 'categoryId', 'stock', 'price_paise'],
        order: [['stock', 'ASC']],
        limit: 100
      });

      return products.map(product => ({
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        stock: product.stock,
        price: (product.price_paise || 0) / 100, // Convert paise to rupees
        stockStatus: this.getStockStatus(product.stock)
      }));
    } catch (error) {
      logger.error('Error getting low stock products:', error);
      throw error;
    }
  }

  async getOutOfStockProducts() {
    try {
      // Direct query without cache to avoid timeout issues
      const products = await this.productRepository.model.findAll({
        where: {
          stock: this.OUT_OF_STOCK_THRESHOLD
        },
        attributes: ['id', 'name', 'categoryId', 'stock', 'price_paise', 'updatedAt'],
        order: [['updatedAt', 'DESC']],
        limit: 100
      });

      return products.map(product => ({
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        stock: product.stock,
        price: (product.price_paise || 0) / 100, // Convert paise to rupees
        lastUpdated: product.updatedAt
      }));
    } catch (error) {
      logger.error('Error getting out of stock products:', error);
      throw error;
    }
  }

  async getInventoryReport(options = {}) {
    try {
      const {
        includeCategories = true,
        includeStockStatus = true,
        includeLowStock = false, // Don't include by default to avoid timeout
        includeOutOfStock = false // Don't include by default to avoid timeout
      } = options;

      const report = {
        generatedAt: new Date().toISOString(),
        summary: {},
        details: {}
      };

      // Get total products and stock summary with timeout protection
      const [totalProducts, totalStock, stockByCategory] = await Promise.allSettled([
        this.productRepository.model.count(),
        this.productRepository.model.sum('stock'),
        includeCategories ? this.getStockByCategory() : Promise.resolve({})
      ]);

      report.summary = {
        totalProducts: totalProducts.status === 'fulfilled' ? totalProducts.value : 0,
        totalStockValue: totalStock.status === 'fulfilled' ? (totalStock.value || 0) : 0,
        stockByCategory: stockByCategory.status === 'fulfilled' ? stockByCategory.value : {}
      };

      // Get stock status breakdown
      if (includeStockStatus) {
        const [inStock, lowStock, criticalStock, outOfStock] = await Promise.allSettled([
          this.productRepository.model.count({
            where: { stock: { [Op.gt]: this.LOW_STOCK_THRESHOLD } }
          }),
          this.productRepository.model.count({
            where: { 
              stock: { 
                [Op.lte]: this.LOW_STOCK_THRESHOLD,
                [Op.gt]: this.CRITICAL_STOCK_THRESHOLD
              }
            }
          }),
          this.productRepository.model.count({
            where: { 
              stock: { 
                [Op.lte]: this.CRITICAL_STOCK_THRESHOLD,
                [Op.gt]: this.OUT_OF_STOCK_THRESHOLD
              }
            }
          }),
          this.productRepository.model.count({
            where: { stock: this.OUT_OF_STOCK_THRESHOLD }
          })
        ]);

        report.summary.stockStatus = {
          inStock: inStock.status === 'fulfilled' ? inStock.value : 0,
          lowStock: lowStock.status === 'fulfilled' ? lowStock.value : 0,
          criticalStock: criticalStock.status === 'fulfilled' ? criticalStock.value : 0,
          outOfStock: outOfStock.status === 'fulfilled' ? outOfStock.value : 0
        };
      }

      // Get detailed lists only if requested (to avoid timeout)
      if (includeLowStock) {
        try {
          report.details.lowStockProducts = await this.getLowStockProducts();
        } catch (error) {
          logger.warn('Failed to get low stock products:', error);
          report.details.lowStockProducts = [];
        }
      }

      if (includeOutOfStock) {
        try {
          report.details.outOfStockProducts = await this.getOutOfStockProducts();
        } catch (error) {
          logger.warn('Failed to get out of stock products:', error);
          report.details.outOfStockProducts = [];
        }
      }

      return report;
    } catch (error) {
      logger.error('Error generating inventory report:', error);
      throw error;
    }
  }

  async getStockByCategory() {
    try {
      // Using db.categories instead
      const Product = this.productRepository.model;
      
      // Use raw query with proper JOIN for better compatibility
      const results = await Product.sequelize.query(
        `SELECT 
          COALESCE(c.name, 'Uncategorized') as categoryName,
          COUNT(p.id) as productCount,
          COALESCE(SUM(p.stock), 0) as totalStock,
          COALESCE(AVG(p.stock), 0) as averageStock
        FROM Products p
        LEFT JOIN Categories c ON p.categoryId = c.id
        GROUP BY c.id, c.name
        ORDER BY categoryName`,
        {
          type: Product.sequelize.QueryTypes.SELECT,
          raw: true
        }
      );

      return results.reduce((acc, result) => {
        acc[result.categoryName] = {
          productCount: parseInt(result.productCount) || 0,
          totalStock: parseInt(result.totalStock) || 0,
          averageStock: parseFloat(result.averageStock) || 0
        };
        return acc;
      }, {});
    } catch (error) {
      logger.error('Error getting stock by category:', error);
      throw error;
    }
  }

  async logInventoryMovement(movementData) {
    try {
      // In a real system, you'd store this in a separate InventoryMovement table
      // For now, we'll just log it
      logger.info('Inventory movement logged', {
        timestamp: new Date().toISOString(),
        ...movementData
      });

      // You could also store in cache for recent movements
      const movementsKey = this.cacheService.generateKey('inventory', 'movements', 'recent');
      const recentMovements = await this.cacheService.get(movementsKey) || [];
      
      recentMovements.unshift({
        timestamp: new Date().toISOString(),
        ...movementData
      });

      // Keep only last 100 movements in cache
      const trimmedMovements = recentMovements.slice(0, 100);
      await this.cacheService.set(movementsKey, trimmedMovements, 86400); // 24 hours

    } catch (error) {
      logger.error('Error logging inventory movement:', error);
      // Don't throw - logging failures shouldn't break inventory operations
    }
  }

  async getRecentInventoryMovements(limit = 50) {
    try {
      const movementsKey = this.cacheService.generateKey('inventory', 'movements', 'recent');
      const movements = await this.cacheService.get(movementsKey) || [];
      
      return movements.slice(0, limit);
    } catch (error) {
      logger.error('Error getting recent inventory movements:', error);
      return [];
    }
  }

  async checkStockAlerts(product) {
    try {
      const stockStatus = this.getStockStatus(product.stock);
      
      if (stockStatus === 'out_of_stock') {
        await this.sendOutOfStockAlert(product);
      } else if (stockStatus === 'critical_stock') {
        await this.sendCriticalStockAlert(product);
      } else if (stockStatus === 'low_stock') {
        await this.sendLowStockAlert(product);
      }
    } catch (error) {
      logger.error('Error checking stock alerts:', error);
      // Don't throw - alert failures shouldn't break inventory operations
    }
  }

  getStockStatus(stock) {
    if (stock <= this.OUT_OF_STOCK_THRESHOLD) {
      return 'out_of_stock';
    } else if (stock <= this.CRITICAL_STOCK_THRESHOLD) {
      return 'critical_stock';
    } else if (stock <= this.LOW_STOCK_THRESHOLD) {
      return 'low_stock';
    } else {
      return 'in_stock';
    }
  }

  async sendOutOfStockAlert(product) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendOutOfStockAlert(product);
      }
      
      logger.warn('OUT OF STOCK ALERT', {
        productId: product.id,
        productName: product.name,
        category: product.category,
        stock: product.stock
      });
    } catch (error) {
      logger.error('Failed to send out of stock alert:', error);
    }
  }

  async sendCriticalStockAlert(product) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendCriticalStockAlert(product);
      }
      
      logger.warn('CRITICAL STOCK ALERT', {
        productId: product.id,
        productName: product.name,
        category: product.category,
        stock: product.stock,
        threshold: this.CRITICAL_STOCK_THRESHOLD
      });
    } catch (error) {
      logger.error('Failed to send critical stock alert:', error);
    }
  }

  async sendLowStockAlert(product) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendLowStockAlert(product);
      }
      
      logger.info('LOW STOCK ALERT', {
        productId: product.id,
        productName: product.name,
        category: product.category,
        stock: product.stock,
        threshold: this.LOW_STOCK_THRESHOLD
      });
    } catch (error) {
      logger.error('Failed to send low stock alert:', error);
    }
  }

  // Utility methods for batch operations
  async bulkUpdateStock(updates) {
    try {
      const results = [];
      
      for (const update of updates) {
        try {
          const result = await this.updateStock(
            update.productId,
            update.newStock,
            update.reason || 'bulk_update'
          );
          results.push({ ...update, success: true, result });
        } catch (error) {
          results.push({ ...update, success: false, error: error.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      logger.info('Bulk stock update completed', {
        total: updates.length,
        successful: successCount,
        failed: failureCount
      });
      
      return {
        results,
        summary: {
          total: updates.length,
          successful: successCount,
          failed: failureCount
        }
      };
    } catch (error) {
      logger.error('Error in bulk stock update:', error);
      throw error;
    }
  }
}

module.exports = InventoryService;