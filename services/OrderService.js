const logger = require('../utils/logger');
const BaseService = require('./BaseService');
const sequelize = require('../config/database');

class OrderService extends BaseService {
  constructor(orderRepository, cartService, productRepository, paymentService, notificationService) {
    super();
    this.orderRepository = orderRepository;
    this.cartService = cartService;
    this.productRepository = productRepository;
    this.paymentService = paymentService;
    this.notificationService = notificationService;
  }

  async createOrder(userId, orderData) {
    const transaction = await sequelize.transaction();
    
    try {
      const { shippingAddress, paymentMethod, orderNotes, billingAddress } = orderData;
      
      // Validate and get cart with stock validation
      const cartValidation = await this.cartService.validateCartForCheckout(userId);
      
      if (!cartValidation.isValid) {
        await transaction.rollback();
        throw new Error('Cart validation failed: ' + cartValidation.reason);
      }
      
      const cart = cartValidation.cart;
      
      if (!cart.items || cart.items.length === 0) {
        await transaction.rollback();
        throw new Error('Cart is empty');
      }
      
      // Validate shipping address
      this.validateShippingAddress(shippingAddress);
      
      // Process each cart item with atomic stock updates
      let totalAmount = 0;
      const orderItems = [];
      const stockUpdates = [];
      
      for (const item of cart.items) {
        // Lock product row for update (prevents concurrent modifications)
        const product = await this.productRepository.model.findByPk(item.productId, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        
        if (!product) {
          await transaction.rollback();
          throw new Error(`Product ${item.productId} not found`);
        }
        
        // Double-check stock with locked row
        if (product.stock < item.quantity) {
          await transaction.rollback();
          throw new Error(`${product.name} does not have enough items in stock. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
        
        // Calculate item total
        const itemTotal = parseFloat(product.price) * item.quantity;
        totalAmount += itemTotal;
        
        // Prepare order item
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          productName: product.name,
          productDescription: product.description
        });
        
        // Prepare stock update
        stockUpdates.push({
          productId: product.id,
          newStock: product.stock - item.quantity,
          productName: product.name
        });
      }
      
      // Calculate shipping cost
      const shippingCost = this.calculateShippingCost(shippingAddress, totalAmount);
      
      // Calculate tax
      const taxAmount = this.calculateTax(totalAmount, shippingAddress);
      
      // Final total including shipping and tax
      const finalTotal = totalAmount + shippingCost + taxAmount;
      
      // Create order data
      const orderCreateData = {
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
      
      // Create order and order items
      const order = await this.orderRepository.createOrder(orderCreateData, orderItems, transaction);
      
      // Update product stock atomically
      for (const stockUpdate of stockUpdates) {
        const [updatedRows] = await this.productRepository.model.update(
          { stock: stockUpdate.newStock },
          { 
            where: { 
              id: stockUpdate.productId,
              stock: { [sequelize.Op.gte]: orderItems.find(item => item.productId === stockUpdate.productId).quantity }
            },
            transaction
          }
        );
        
        if (updatedRows === 0) {
          await transaction.rollback();
          throw new Error(`Inventory conflict for ${stockUpdate.productName}. Please refresh and try again.`);
        }
        
        logger.info('Stock updated for order', {
          productId: stockUpdate.productId,
          productName: stockUpdate.productName,
          newStock: stockUpdate.newStock,
          orderId: order.id
        });
      }
      
      // Clear user cart
      await this.cartService.clearUserCart(userId);
      
      // Process payment if required
      if (paymentMethod !== 'cash_on_delivery') {
        try {
          const paymentResult = await this.paymentService.processPayment({
            orderId: order.id,
            amount: finalTotal,
            paymentMethod,
            customerInfo: {
              userId,
              email: order.userEmail, // This would come from user data
              shippingAddress
            }
          });
          
          if (paymentResult.success) {
            await this.orderRepository.updatePaymentStatus(order.id, 'paid', transaction);
          } else {
            await this.orderRepository.updatePaymentStatus(order.id, 'failed', transaction);
            // Don't rollback the order, just mark payment as failed
            logger.warn('Payment failed for order', {
              orderId: order.id,
              paymentError: paymentResult.error
            });
          }
        } catch (paymentError) {
          logger.error('Payment processing error:', paymentError);
          await this.orderRepository.updatePaymentStatus(order.id, 'failed', transaction);
          // Continue with order creation even if payment fails
        }
      }
      
      // Commit transaction
      await transaction.commit();
      
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
      
      return await this.orderRepository.findOrderById(order.id);
      
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrderById(orderId, userId = null, isAdmin = false) {
    try {
      const order = await this.orderRepository.findOrderById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Check permissions
      if (!isAdmin && order.userId !== userId) {
        throw new Error('Not authorized to access this order');
      }
      
      return order;
    } catch (error) {
      logger.error('Error getting order by ID:', error);
      throw error;
    }
  }

  async getUserOrders(userId, options = {}) {
    try {
      return await this.orderRepository.findOrdersByUserId(userId, options);
    } catch (error) {
      logger.error('Error getting user orders:', error);
      throw error;
    }
  }

  async getAllOrders(options = {}) {
    try {
      return await this.orderRepository.findAllOrders(options);
    } catch (error) {
      logger.error('Error getting all orders:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, newStatus, userId = null, isAdmin = false) {
    try {
      const order = await this.orderRepository.findOrderById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Validate status transition
      this.validateStatusTransition(order.status, newStatus);
      
      // Check permissions
      if (!isAdmin && order.userId !== userId) {
        throw new Error('Not authorized to update this order');
      }
      
      // Users can only cancel pending orders
      if (!isAdmin && newStatus !== 'cancelled') {
        throw new Error('Users can only cancel orders');
      }
      
      if (!isAdmin && newStatus === 'cancelled' && order.status !== 'pending') {
        throw new Error('Can only cancel pending orders');
      }
      
      const updatedOrder = await this.orderRepository.updateOrderStatus(orderId, newStatus);
      
      // Handle stock restoration for cancelled orders
      if (newStatus === 'cancelled') {
        await this.restoreStock(order);
      }
      
      // Send status update notification
      this.sendStatusUpdateNotification(updatedOrder).catch(error => {
        logger.error('Failed to send status update notification:', error);
      });
      
      logger.info('Order status updated', {
        orderId,
        oldStatus: order.status,
        newStatus,
        updatedBy: isAdmin ? 'admin' : `user-${userId}`
      });
      
      return updatedOrder;
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  async cancelOrder(orderId, userId = null, isAdmin = false, reason = null) {
    try {
      const order = await this.orderRepository.findOrderById(orderId);
      
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
      
      const cancelledOrder = await this.orderRepository.cancelOrder(orderId);
      
      // Restore stock
      await this.restoreStock(order);
      
      // Process refund if payment was made
      if (order.paymentStatus === 'paid') {
        try {
          await this.paymentService.processRefund({
            orderId,
            amount: order.totalAmount,
            reason: reason || 'Order cancellation'
          });
          
          await this.orderRepository.updatePaymentStatus(orderId, 'refunded');
        } catch (refundError) {
          logger.error('Failed to process refund for cancelled order:', refundError);
          // Don't fail the cancellation if refund fails
        }
      }
      
      // Send cancellation notification
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
      const analytics = await this.orderRepository.getOrderAnalytics(startDate, endDate);
      
      // Add additional calculated metrics
      analytics.conversionMetrics = {
        completionRate: analytics.ordersByStatus?.delivered ? 
          (analytics.ordersByStatus.delivered.count / analytics.totalOrders * 100).toFixed(2) : 0,
        cancellationRate: analytics.ordersByStatus?.cancelled ? 
          (analytics.ordersByStatus.cancelled.count / analytics.totalOrders * 100).toFixed(2) : 0
      };
      
      return analytics;
    } catch (error) {
      logger.error('Error getting order analytics:', error);
      throw error;
    }
  }

  async getTopProducts(limit = 10, startDate = null, endDate = null) {
    try {
      return await this.orderRepository.getTopProducts(limit, startDate, endDate);
    } catch (error) {
      logger.error('Error getting top products:', error);
      throw error;
    }
  }

  async getRecentOrders(limit = 10) {
    try {
      return await this.orderRepository.getRecentOrders(limit);
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
        await this.productRepository.model.increment(
          'stock',
          {
            by: item.quantity,
            where: { id: item.productId }
          }
        );
        
        logger.info('Stock restored for cancelled order', {
          productId: item.productId,
          quantity: item.quantity,
          orderId: order.id
        });
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