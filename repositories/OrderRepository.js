const BaseRepository = require('./BaseRepository');
const { Order, OrderItem } = require('../models/Order');
const Product = require('../models/Product');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { getImageGallery } = require('../utils/imageUtils');

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  async createOrder(orderData, orderItems, transaction = null) {
    try {
      const options = transaction ? { transaction } : {};
      
      // Create the order
      const order = await this.model.create(orderData, options);
      
      // Create order items
      const itemsWithOrderId = orderItems.map(item => ({
        ...item,
        orderId: order.id
      }));
      
      await OrderItem.bulkCreate(itemsWithOrderId, options);
      
      // Fetch the complete order with items
      return await this.findOrderById(order.id, transaction);
    } catch (error) {
      logger.error('Error creating order in repository:', error);
      throw error;
    }
  }

  async findOrderById(orderId, transaction = null) {
    try {
      const options = {
        include: [
          {
            model: OrderItem,
            as: 'items',
            include: [{
              model: Product,
              as: 'Product',
              attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url', 'stock', 'description', 'categoryId', 'featured', 'is_new', 'is_sale']
            }]
          }
        ]
      };
      
      if (transaction) {
        options.transaction = transaction;
      }
      
      const order = await this.model.findByPk(orderId, options);
      
      // Enrich products with image galleries
      if (order && order.items) {
        const orderData = order.toJSON();
        orderData.items = orderData.items.map(item => {
          if (item.Product && item.Product.image_url) {
            const imageGallery = getImageGallery(item.Product.image_url);
            return {
              ...item,
              Product: {
                ...item.Product,
                image_gallery: imageGallery.gallery,
                images: imageGallery // For frontend compatibility
              }
            };
          }
          return item;
        });
        return orderData;
      }
      
      return order;
    } catch (error) {
      logger.error('Error finding order by ID:', error);
      throw error;
    }
  }

  async findOrdersByUserId(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = null,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      const whereClause = { userId };
      if (status) {
        whereClause.status = status;
      }

      const queryOptions = {
        where: whereClause,
        include: [
          {
            model: OrderItem,
            as: 'items',
            include: [{
              model: Product,
              as: 'Product',
              attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url', 'stock', 'description', 'categoryId', 'featured', 'is_new', 'is_sale']
            }]
          }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const result = await this.model.findAndCountAll(queryOptions);
      
      // Enrich products with image galleries
      const enrichedOrders = result.rows.map(order => {
        const orderData = order.toJSON();
        if (orderData.items && Array.isArray(orderData.items)) {
          orderData.items = orderData.items.map(item => {
            if (item.Product && item.Product.image_url) {
              const imageGallery = getImageGallery(item.Product.image_url);
              return {
                ...item,
                Product: {
                  ...item.Product,
                  image_gallery: imageGallery.gallery,
                  images: imageGallery // For frontend compatibility
                }
              };
            }
            return item;
          });
        }
        return orderData;
      });
      
      return {
        orders: enrichedOrders,
        totalCount: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: parseInt(page),
        hasNext: page * limit < result.count,
        hasPrev: page > 1
      };
    } catch (error) {
      logger.error('Error finding orders by user ID:', error);
      throw error;
    }
  }

  async findAllOrders(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = null,
        startDate = null,
        endDate = null,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      const whereClause = {};
      
      if (status) {
        whereClause.status = status;
      }
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.createdAt[Op.lte] = new Date(endDate);
        }
      }

      const queryOptions = {
        where: whereClause,
        include: [
          {
            model: OrderItem,
            as: 'items'
          }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const result = await this.model.findAndCountAll(queryOptions);
      
      return {
        orders: result.rows,
        totalCount: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: parseInt(page),
        hasNext: page * limit < result.count,
        hasPrev: page > 1
      };
    } catch (error) {
      logger.error('Error finding all orders:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, transaction = null) {
    try {
      const options = transaction ? { transaction } : {};
      
      const [updatedRows] = await this.model.update(
        { 
          status,
          updatedAt: new Date()
        },
        {
          where: { id: orderId },
          ...options
        }
      );

      if (updatedRows === 0) {
        throw new Error('Order not found or not updated');
      }

      return await this.findOrderById(orderId, transaction);
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  async updatePaymentStatus(orderId, paymentStatus, transaction = null) {
    try {
      const options = transaction ? { transaction } : {};
      
      const [updatedRows] = await this.model.update(
        { 
          paymentStatus,
          updatedAt: new Date()
        },
        {
          where: { id: orderId },
          ...options
        }
      );

      if (updatedRows === 0) {
        throw new Error('Order not found or not updated');
      }

      return await this.findOrderById(orderId, transaction);
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw error;
    }
  }

  async cancelOrder(orderId, transaction = null) {
    try {
      const options = transaction ? { transaction } : {};
      
      // First check if order can be cancelled
      const order = await this.findOrderById(orderId, transaction);
      if (!order) {
        throw new Error('Order not found');
      }

      if (['shipped', 'delivered'].includes(order.status)) {
        throw new Error('Cannot cancel order that has been shipped or delivered');
      }

      const [updatedRows] = await this.model.update(
        { 
          status: 'cancelled',
          updatedAt: new Date()
        },
        {
          where: { id: orderId },
          ...options
        }
      );

      if (updatedRows === 0) {
        throw new Error('Order not found or not updated');
      }

      return await this.findOrderById(orderId, transaction);
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  async getOrderAnalytics(startDate, endDate) {
    try {
      const whereClause = {};
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.createdAt[Op.lte] = new Date(endDate);
        }
      }

      const [
        totalOrders,
        totalRevenuePaise,
        ordersByStatus,
        averageOrderValuePaise
      ] = await Promise.all([
        // Total orders count
        this.model.count({ where: whereClause }),
        
        // Total revenue (in paise)
        this.model.sum('total_amount_paise', { where: whereClause }),
        
        // Orders by status
        this.model.findAll({
          where: whereClause,
          attributes: [
            'status',
            [this.model.sequelize.fn('COUNT', this.model.sequelize.col('id')), 'count'],
            [this.model.sequelize.fn('SUM', this.model.sequelize.col('total_amount_paise')), 'revenuePaise']
          ],
          group: ['status'],
          raw: true
        }),
        
        // Average order value (in paise)
        this.model.findOne({
          where: whereClause,
          attributes: [
            [this.model.sequelize.fn('AVG', this.model.sequelize.col('total_amount_paise')), 'average']
          ],
          raw: true
        })
      ]);

      // Convert from paise to rupees (divide by 100)
      const totalRevenue = (parseFloat(totalRevenuePaise) || 0) / 100;
      const averageOrderValue = (parseFloat(averageOrderValuePaise?.average) || 0) / 100;

      return {
        totalOrders: totalOrders || 0,
        totalRevenue: totalRevenue,
        averageOrderValue: averageOrderValue,
        ordersByStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = {
            count: parseInt(item.count),
            revenue: (parseFloat(item.revenuePaise) || 0) / 100
          };
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting order analytics:', error);
      throw error;
    }
  }

  async getTopProducts(limit = 10, startDate = null, endDate = null) {
    try {
      const whereClause = {};
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.createdAt[Op.lte] = new Date(endDate);
        }
      }

      const topProducts = await OrderItem.findAll({
        include: [
          {
            model: Order,
            where: whereClause,
            attributes: []
          }
        ],
        attributes: [
          'productId',
          'productName',
          [OrderItem.sequelize.fn('SUM', OrderItem.sequelize.col('quantity')), 'totalQuantity'],
          [OrderItem.sequelize.fn('SUM', 
            OrderItem.sequelize.literal('quantity * unit_price_paise')
          ), 'totalRevenuePaise'],
          [OrderItem.sequelize.fn('COUNT', OrderItem.sequelize.col('OrderItem.id')), 'orderCount']
        ],
        group: ['productId', 'productName'],
        order: [[OrderItem.sequelize.fn('SUM', OrderItem.sequelize.col('quantity')), 'DESC']],
        limit: parseInt(limit),
        raw: true
      });

      return topProducts.map(product => ({
        productId: product.productId,
        productName: product.productName,
        totalQuantity: parseInt(product.totalQuantity),
        // Convert from paise to rupees (divide by 100)
        totalRevenue: (parseFloat(product.totalRevenuePaise) || 0) / 100,
        orderCount: parseInt(product.orderCount)
      }));
    } catch (error) {
      logger.error('Error getting top products:', error);
      throw error;
    }
  }

  async getRecentOrders(limit = 10) {
    try {
      return await this.model.findAll({
        attributes: [
          'id',
          'userId',
          'total_amount_paise',
          'currency',
          'status',
          'razorpay_order_id',
          'razorpay_payment_id',
          'razorpay_signature',
          'receipt',
          'paymentMethod',
          'address_json',
          'orderNotes',
          'createdAt',
          'updatedAt'
        ],
        include: [
          {
            model: OrderItem,
            as: 'items',
            attributes: [
              'id',
              'orderId',
              'productId',
              'quantity',
              'unit_price_paise',
              'productName',
              'productDescription',
              'createdAt',
              'updatedAt'
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      });
    } catch (error) {
      logger.error('Error getting recent orders:', error);
      throw error;
    }
  }

  async findOrdersByProduct(productId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = null
      } = options;

      const whereClause = {};
      if (status) {
        whereClause.status = status;
      }

      const queryOptions = {
        include: [
          {
            model: OrderItem,
            as: 'items',
            where: { productId },
            required: true
          }
        ],
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const result = await this.model.findAndCountAll(queryOptions);
      
      return {
        orders: result.rows,
        totalCount: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: parseInt(page)
      };
    } catch (error) {
      logger.error('Error finding orders by product:', error);
      throw error;
    }
  }
}

module.exports = OrderRepository;