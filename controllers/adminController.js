const { container } = require('../container/serviceRegistration');
const logger = require('../utils/logger');

// @desc    Get dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboard = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const orderService = container.resolve('orderService');
    const inventoryService = container.resolve('inventoryService');
    const userService = container.resolve('userService');
    
    // Get date ranges
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Helper function to add timeout to promises
    const withTimeout = (promise, timeoutMs = 5000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    };

    // Get analytics data in parallel with error handling and timeouts
    // Use Promise.allSettled so one failure doesn't block others
    const results = await Promise.allSettled([
      withTimeout(orderService.getOrderAnalytics(today.toISOString(), null), 5000),
      withTimeout(orderService.getOrderAnalytics(lastWeek.toISOString(), null), 5000),
      withTimeout(orderService.getOrderAnalytics(lastMonth.toISOString(), null), 5000),
      withTimeout(inventoryService.getInventoryReport({ includeLowStock: false, includeOutOfStock: false }), 5000),
      withTimeout(orderService.getTopProducts(5, lastMonth.toISOString(), null), 5000),
      withTimeout(orderService.getRecentOrders(10), 5000),
      withTimeout(inventoryService.getLowStockProducts(10), 5000),
      withTimeout(inventoryService.getOutOfStockProducts(), 5000)
    ]);

    // Extract results with defaults for failed queries
    const getResult = (index, defaultValue) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.warn(`Dashboard query ${index} failed:`, result.reason?.message || result.reason);
        return defaultValue;
      }
    };

    const todayAnalytics = getResult(0, { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, ordersByStatus: {} });
    const weekAnalytics = getResult(1, { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, ordersByStatus: {} });
    const monthAnalytics = getResult(2, { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, ordersByStatus: {} });
    const inventoryReport = getResult(3, { summary: { totalProducts: 0, totalStockValue: 0, stockByCategory: {}, stockStatus: {} } });
    const topProducts = getResult(4, []);
    const recentOrders = getResult(5, []);
    const lowStockProducts = getResult(6, []);
    const outOfStockProducts = getResult(7, []);

    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100).toFixed(1);
    };

    const dashboard = {
      summary: {
        todayOrders: todayAnalytics.totalOrders,
        todayRevenue: todayAnalytics.totalRevenue,
        weeklyOrders: weekAnalytics.totalOrders,
        weeklyRevenue: weekAnalytics.totalRevenue,
        monthlyOrders: monthAnalytics.totalOrders,
        monthlyRevenue: monthAnalytics.totalRevenue,
        averageOrderValue: monthAnalytics.averageOrderValue
      },
      growth: {
        ordersGrowth: calculateGrowth(weekAnalytics.totalOrders, 0), // Would compare to previous week
        revenueGrowth: calculateGrowth(weekAnalytics.totalRevenue, 0) // Would compare to previous week
      },
      inventory: {
        totalProducts: inventoryReport.summary.totalProducts,
        totalStock: inventoryReport.summary.totalStockValue,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        stockStatus: inventoryReport.summary.stockStatus
      },
      charts: {
        ordersByStatus: monthAnalytics.ordersByStatus,
        stockByCategory: inventoryReport.summary.stockByCategory
      },
      lists: {
        topProducts: topProducts,
        recentOrders: recentOrders.slice(0, 5), // Limit to 5 for dashboard
        lowStockProducts: lowStockProducts.slice(0, 5),
        outOfStockProducts: outOfStockProducts.slice(0, 5)
      },
      alerts: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        criticalAlerts: lowStockProducts.filter(p => p.stock <= 5).length
      }
    };

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get detailed analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
exports.getAnalytics = async (req, res, next) => {
  try {
    const orderService = container.resolve('orderService');
    const { startDate, endDate, period = 'month' } = req.query;
    
    const analytics = await orderService.getOrderAnalytics(startDate, endDate);
    const topProducts = await orderService.getTopProducts(20, startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: {
        analytics,
        topProducts,
        period,
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get inventory overview
// @route   GET /api/admin/inventory
// @access  Private/Admin
exports.getInventoryOverview = async (req, res, next) => {
  try {
    const inventoryService = container.resolve('inventoryService');
    
    const report = await inventoryService.getInventoryReport({
      includeCategories: true,
      includeStockStatus: true,
      includeLowStock: true,
      includeOutOfStock: true
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update product stock
// @route   PUT /api/admin/inventory/:productId/stock
// @access  Private/Admin
exports.updateProductStock = async (req, res, next) => {
  try {
    const inventoryService = container.resolve('inventoryService');
    const { productId } = req.params;
    const { stock, reason = 'admin_adjustment' } = req.body;
    
    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock must be a non-negative number'
      });
    }

    const result = await inventoryService.updateStock(productId, stock, reason);

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Bulk update stock
// @route   PUT /api/admin/inventory/bulk-update
// @access  Private/Admin
exports.bulkUpdateStock = async (req, res, next) => {
  try {
    const inventoryService = container.resolve('inventoryService');
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required and cannot be empty'
      });
    }

    const result = await inventoryService.bulkUpdateStock(updates);

    res.status(200).json({
      success: true,
      message: 'Bulk stock update completed',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get all orders with admin view
// @route   GET /api/admin/orders
// @access  Private/Admin
exports.getAllOrders = async (req, res, next) => {
  try {
    const orderService = container.resolve('orderService');
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'DESC'
    };

    const result = await orderService.getAllOrders(options);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update order status (admin)
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const orderService = container.resolve('orderService');
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const order = await orderService.updateOrderStatus(id, status, null, true);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getSystemStats = async (req, res, next) => {
  try {
    const cacheService = container.resolve('cacheService');
    const inventoryService = container.resolve('inventoryService');
    
    // Get cache stats
    const cacheStats = await cacheService.getStats().catch(() => null);
    
    // Get recent inventory movements
    const recentMovements = await inventoryService.getRecentInventoryMovements(20);
    
    // Get system info
    const systemStats = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      pid: process.pid
    };

    res.status(200).json({
      success: true,
      data: {
        system: systemStats,
        cache: cacheStats,
        recentInventoryMovements: recentMovements
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get users list (admin)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const userService = container.resolve('userService');
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive
    } = req.query;

    // This would need to be implemented in UserService
    const users = await userService.getAllUsers ? 
      await userService.getAllUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        role,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      }) : 
      { users: [], totalCount: 0, totalPages: 0, currentPage: 1 };

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update user status (admin)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res, next) => {
  try {
    const userService = container.resolve('userService');
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    // This would need to be implemented in UserService
    if (!userService.updateUserStatus) {
      return res.status(501).json({
        success: false,
        message: 'User status update not implemented'
      });
    }

    const user = await userService.updateUserStatus(id, isActive);

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Clear cache (admin)
// @route   DELETE /api/admin/cache
// @access  Private/Admin
exports.clearCache = async (req, res, next) => {
  try {
    const cacheService = container.resolve('cacheService');
    const { pattern } = req.query;
    
    if (pattern) {
      await cacheService.invalidateByPattern(pattern);
    } else {
      await cacheService.flush();
    }

    logger.info('Cache cleared by admin', {
      adminId: req.user.id,
      pattern: pattern || 'all',
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Export data (admin)
// @route   GET /api/admin/export/:type
// @access  Private/Admin
exports.exportData = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;
    
    let data;
    let filename;
    
    switch (type) {
      case 'orders':
        const orderService = container.resolve('orderService');
        const orders = await orderService.getAllOrders({
          startDate,
          endDate,
          limit: 10000 // Large limit for export
        });
        data = orders.orders;
        filename = `orders-export-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
        
      case 'products':
        const productRepository = container.resolve('productRepository');
        const products = await productRepository.findAll();
        data = products;
        filename = `products-export-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
        
      case 'inventory':
        const inventoryService = container.resolve('inventoryService');
        const inventory = await inventoryService.getInventoryReport();
        data = inventory;
        filename = `inventory-export-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Supported: orders, products, inventory'
        });
    }
    
    if (format === 'csv') {
      // Convert to CSV (simplified)
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(data);
    }
    
    logger.info('Data exported by admin', {
      adminId: req.user.id,
      type,
      format,
      recordCount: Array.isArray(data) ? data.length : 1
    });
    
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
}