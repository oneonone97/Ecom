const logger = require('../utils/logger');
const BaseService = require('./BaseService');
const db = require('../utils/database');
const sql = require('../utils/postgres');

class OrderService extends BaseService {
  constructor(cartService, paymentService, notificationService) {
    super();
    this.cartService = cartService;
    this.paymentService = paymentService;
    this.notificationService = notificationService;
    // No repository dependency - using direct database access
  }

  async createOrder(userId, orderData) {
    // Use database transaction support
    return await sql.begin(async (sql) => {
      try {
        const { shippingAddress, paymentMethod, orderNotes, billingAddress } = orderData;

        // Get cart for user
        const cart = await this.cartService.getUserCart(userId);

        if (!cart.items || cart.items.length === 0) {
          throw new Error('Cart is empty');
        }

        // Validate shipping address
        this.validateShippingAddress(shippingAddress);

        // Process each cart item with stock validation
        let totalAmount = 0;
        const orderItems = [];

        for (const item of cart.items) {
          // Get product details
          const product = await db.products.findByPk(item.id);
          if (!product) {
            throw new Error(`Product ${item.id} not found`);
          }

          // Check stock availability
          if (product.stock < item.quantity) {
            throw new Error(`${product.name} does not have enough items in stock. Available: ${product.stock}, Requested: ${item.quantity}`);
          }

          // Calculate item total (convert from paise to rupees)
          const itemTotal = (product.price_paise / 100) * item.quantity;
          totalAmount += itemTotal;

          // Prepare order item data
          orderItems.push({
            productId: item.id,
            quantity: item.quantity,
            price_paise: product.price_paise,
            productName: product.name,
            productImage: product.imageUrl
          });
        }

        // Calculate shipping cost
      const shippingCost = this.calculateShippingCost(shippingAddress, totalAmount);

      // Calculate tax
      const taxAmount = this.calculateTax(totalAmount, shippingAddress);

      // Final total including shipping and tax
      const finalTotal = totalAmount + shippingCost + taxAmount;

      // Create order data
      const orderData = {
        userId,
        totalAmount: parseFloat(finalTotal.toFixed(2)),
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod,
        shippingAddress: JSON.stringify(shippingAddress),
        billingAddress: billingAddress ? JSON.stringify(billingAddress) : JSON.stringify(shippingAddress),
        orderNotes,
        shippingCost: parseFloat(shippingCost.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        subtotal: parseFloat(totalAmount.toFixed(2))
      };

      // Create order
      const order = await db.orders.create(orderData);

      // Create order items
      for (const item of orderItems) {
        await db.orderItems.create({
          orderId: order.id,
          ...item
        });
      }

      // Update product stock atomically using direct SQL within transaction
      for (const item of cart.items) {
        const product = await db.products.findByPk(item.id);
        const newStock = product.stock - item.quantity;

        if (newStock < 0) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }

        // Update stock using transaction SQL
        await sql`
          UPDATE "Products"
          SET "stock" = ${newStock}, "updatedAt" = NOW()
          WHERE "id" = ${item.id}
        `;

        logger.info('Stock updated for order', {
          productId: item.id,
          productName: product.name,
          oldStock: product.stock,
          newStock: newStock,
          orderId: order.id
        });
      }

      // Clear user cart
      await this.cartService.clearUserCart(userId);
      
      // Process payment if required (after transaction commits)
      if (paymentMethod !== 'cash_on_delivery') {
        // Payment processing will be handled after order creation
        // For now, we'll set payment status to pending
        await db.orders.update(order.id, { paymentStatus: 'pending' });
      }

      // Send order confirmation (async, don't wait)
      this.sendOrderConfirmation(order).catch(error => {
        logger.error('Failed to send order confirmation:', error);
      });

      logger.info('Order created successfully', {
        userId,
        orderId: order.id,
        totalAmount: finalTotal,
        itemCount: orderItems.length,
        paymentMethod
      });

      // Return order with items
      return await this.getOrderById(order.id);

    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
    });
  }

  async getOrderById(orderId) {
    try {
      // Get order with items using JOIN
      const orderData = await db.orders.findWithRelations(
        { id: orderId },
        [
          {
            type: 'LEFT_JOIN',
            table: 'OrderItems',
            localKey: 'id',
            foreignKey: 'orderId'
          },
          {
            type: 'LEFT_JOIN',
            table: 'Users',
            localKey: 'userId',
            foreignKey: 'id'
          }
        ]
      );

      if (!orderData || orderData.length === 0) {
        return null;
      }

      const order = orderData[0];
      const items = [];

      // Group order items
      orderData.forEach(row => {
        if (row.productId && row.productName) {
          items.push({
            id: row.id,
            productId: row.productId,
            productName: row.productName,
            productImage: row.productImage,
            quantity: row.quantity,
            price_paise: row.price_paise,
            subtotal: (row.price_paise * row.quantity) / 100
          });
        }
      });

      return {
        id: order.id,
        userId: order.userId,
        userEmail: order.email,
        items,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        orderNotes: order.orderNotes,
        shippingCost: order.shippingCost,
        taxAmount: order.taxAmount,
        subtotal: order.subtotal,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    } catch (error) {
      logger.error('Error getting order by ID:', error);
      throw error;
    }
  }


  async getOrdersByUserId(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const orders = await db.orders.findAll({
        where: { userId },
        orderBy: 'createdAt DESC',
        limit,
        offset
      });

      const total = await db.orders.count({ where: { userId } });

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user orders:', error);
      throw error;
    }
  }

  async getAllOrders(options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const orders = await db.orders.findAll({
        orderBy: 'createdAt DESC',
        limit,
        offset
      });

      const total = await db.orders.count();

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting all orders:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, newStatus) {
    try {
      const order = await this.getOrderById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      this.validateStatusTransition(order.status, newStatus);

      // Update order status
      await db.orders.update(orderId, { status: newStatus });

      // Handle stock restoration for cancelled orders
      if (newStatus === 'cancelled') {
        await this.restoreStock(order);
      }

      // Send status update notification
      const updatedOrder = await this.getOrderById(orderId);
      this.sendStatusUpdateNotification(updatedOrder).catch(error => {
        logger.error('Failed to send status update notification:', error);
      });

      logger.info('Order status updated', {
        orderId,
        oldStatus: order.status,
        newStatus
      });

      return updatedOrder;
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  async cancelOrder(orderId, userId = null, isAdmin = false, reason = null) {
    try {
      const order = await this.getOrderById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Check permissions
      if (!isAdmin && order.userId !== userId) {
        throw new Error('Not authorized to cancel this order');
      }

      // Check if order can be cancelled
      if (['shipped', 'delivered'].includes(order.status)) {
        throw new Error('Cannot cancel order that has been shipped or delivered');
      }

      // Update order status to cancelled
      await db.orders.update(orderId, { status: 'cancelled' });

      // Restore stock
      await this.restoreStock(order);

      // Process refund if payment was made (simplified for now)
      if (order.paymentStatus === 'paid') {
        try {
          // TODO: Implement actual refund processing
          await db.orders.update(orderId, { paymentStatus: 'refunded' });
        } catch (refundError) {
          logger.error('Failed to process refund for cancelled order:', refundError);
          // Don't fail the cancellation if refund fails
        }
      }

      // Send cancellation notification
      const cancelledOrder = await this.getOrderById(orderId);
      this.sendCancellationNotification(cancelledOrder, reason).catch(error => {
        logger.error('Failed to send cancellation notification:', error);
      });

      logger.info('Order cancelled', {
        orderId,
        userId: order.userId,
        reason,
        cancelledBy: isAdmin ? 'admin' : `user-${userId}`
      });

      return cancelledOrder;
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  async getOrderAnalytics(startDate, endDate) {
    try {
      // TODO: Implement order analytics using database queries
      // For now, return basic analytics
      const totalOrders = await db.orders.count();
      const totalRevenue = await db.orders.aggregate('totalAmount', 'SUM');

      return {
        totalOrders,
        totalRevenue: totalRevenue || 0,
        period: {
          startDate,
          endDate
        },
        conversionMetrics: {
          completionRate: 0,
          cancellationRate: 0
        }
      };
    } catch (error) {
      logger.error('Error getting order analytics:', error);
      throw error;
    }
  }

  async getTopProducts(limit = 10, startDate = null, endDate = null) {
    try {
      // TODO: Implement top products query using JOIN with OrderItems
      return [];
    } catch (error) {
      logger.error('Error getting top products:', error);
      throw error;
    }
  }

  async getRecentOrders(limit = 10) {
    try {
      return await db.orders.findAll({
        orderBy: 'createdAt DESC',
        limit
      });
    } catch (error) {
      logger.error('Error getting recent orders:', error);
      throw error;
    }
  }

  // Private helper methods
  validateShippingAddress(address) {
    const requiredFields = ['firstName', 'lastName', 'address', 'city', 'postalCode', 'country'];
    const missingFields = requiredFields.filter(field => !address[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required shipping address fields: ${missingFields.join(', ')}`);
    }
  }

  calculateShippingCost(shippingAddress, orderTotal) {
    // Simple shipping calculation - in reality this would be more complex
    const baseShipping = 10.00;
    const freeShippingThreshold = 100.00;
    
    if (orderTotal >= freeShippingThreshold) {
      return 0;
    }
    
    // Could add logic for different countries, weight-based shipping, etc.
    return baseShipping;
  }

  calculateTax(orderTotal, shippingAddress) {
    // Simple tax calculation - in reality this would use tax services
    const taxRates = {
      'US': 0.08,
      'CA': 0.13,
      'UK': 0.20,
      // Add more countries as needed
    };
    
    const taxRate = taxRates[shippingAddress.country] || 0;
    return orderTotal * taxRate;
  }

  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [], // No transitions from delivered
      'cancelled': [] // No transitions from cancelled
    };
    
    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  async restoreStock(order) {
    try {
      for (const item of order.items) {
        const product = await db.products.findByPk(item.productId);
        if (product) {
          const newStock = product.stock + item.quantity;
          await db.products.update(item.productId, { stock: newStock });

          logger.info('Stock restored for cancelled order', {
            productId: item.productId,
            quantity: item.quantity,
            oldStock: product.stock,
            newStock,
            orderId: order.id
          });
        }
      }
    } catch (error) {
      logger.error('Error restoring stock for cancelled order:', error);
      // Don't throw - stock restoration failure shouldn't fail the cancellation
    }
  }

  async sendOrderConfirmation(order) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendOrderConfirmation(order);
      }
    } catch (error) {
      logger.error('Failed to send order confirmation:', error);
    }
  }

  async sendStatusUpdateNotification(order) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendOrderStatusUpdate(order);
      }
    } catch (error) {
      logger.error('Failed to send status update notification:', error);
    }
  }

  async sendCancellationNotification(order, reason) {
    try {
      if (this.notificationService) {
        await this.notificationService.sendOrderCancellation(order, reason);
      }
    } catch (error) {
      logger.error('Failed to send cancellation notification:', error);
    }
  }
}

module.exports = OrderService;