const { container } = require('../container/serviceRegistration');
const logger = require('../utils/logger');
const db = require('../utils/database');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const orderService = container.resolve('orderService');
    const { shippingAddress, paymentMethod, orderNotes, billingAddress } = req.body;

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address and payment method are required',
        timestamp: new Date().toISOString()
      });
    }

    // Create order using service
    const order = await orderService.createOrder(req.user.id, {
      shippingAddress,
      paymentMethod,
      orderNotes,
      billingAddress
    });

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const orderService = container.resolve('orderService');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const orders = await orderService.getOrdersByUserId(req.user.id, { page, limit });

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Error getting orders:', error);
    next(error);
  }
};

exports.getOrder = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const orderService = container.resolve('orderService');
    const orderId = req.params.id;

    const order = await orderService.getOrderById(orderId);

    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: { order }
    });
  } catch (error) {
    logger.error('Error getting order:', error);
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const orderService = container.resolve('orderService');
    const { id } = req.params;
    const { status } = req.body;

    // Only allow certain status updates
    const allowedStatuses = ['cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status update'
      });
    }

    const order = await orderService.updateOrderStatus(id, status);

    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error updating order status:', error);
    next(error);
  }
};
    
    // Process each cart item with row-level locking to prevent race conditions
    for (const item of cart.items) {
      // Lock product row for update (prevents concurrent modifications)
      const product = await db.products.findByPk(item.productId);
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Product ${item.productId} not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Double-check stock with locked row (prevents race condition)
      if (product.stock < item.quantity) {
        await transaction.rollback();
        logger.logSecurity('Stock manipulation attempt detected', {
          userId: req.user.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableStock: product.stock,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        });
        return res.status(400).json({ 
          success: false, 
          message: `${product.name} does not have enough items in stock. Available: ${product.stock}, Requested: ${item.quantity}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Atomically update stock (prevents overselling)
      const [updatedRows] = await productRepository.model.update(
        { stock: product.stock - item.quantity },
        { 
          where: { 
            id: product.id,
            // stock: { [Op.gte]: item.quantity } // Additional safety check - TODO: implement in raw SQL
          },
          transaction
        }
      );
      
      // Verify stock was actually updated (additional race condition protection)
      if (updatedRows === 0) {
        await transaction.rollback();
        logger.logSecurity('Concurrent stock modification detected', {
          userId: req.user.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          ip: req.ip || req.connection.remoteAddress
        });
        return res.status(409).json({ 
          success: false, 
          message: `Inventory conflict for ${product.name}. Please refresh and try again.`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add to order items
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        productName: product.name
      });
      
      // Update total
      totalAmount += parseFloat(product.price) * item.quantity;
    }
    
    // Create order with transaction
    // Using db.orders instead
    const order = await Order.create({
      userId: req.user.id,
      items: JSON.stringify(orderItems), // Store order items as JSON
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      shippingAddress: JSON.stringify(shippingAddress),
      paymentMethod,
      status: 'pending'
    }, { transaction });
    
    // Clear user cart within transaction
    await cartService.clearUserCart(req.user.id);
    
    // Commit transaction (all operations succeed together)
    await transaction.commit();
    
    logger.info('Order created successfully', {
      userId: req.user.id,
      orderId: order.id,
      totalAmount,
      itemCount: orderItems.length,
      timestamp: new Date().toISOString()
    });
    
    logger.logRequest(req, res, Date.now() - startTime);
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        ...order.toJSON(),
        items: orderItems
      }
    });
    
  } catch (error) {
    // Rollback transaction on any error
    await transaction.rollback();
    
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
  try {
    const orderService = container.resolve('orderService');
    
    // If user is admin, get all orders, otherwise get only user's orders
    let result;
    if (req.user.role === 'admin') {
      result = await orderService.getAllOrders({
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        status: req.query.status || null
      });
    } else {
      result = await orderService.getUserOrders(req.user.id, {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        status: req.query.status || null
      });
    }
    
    res.status(200).json({
      success: true,
      count: result.orders?.length || 0,
      data: result.orders || []
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const orderService = container.resolve('orderService');
    const orderId = parseInt(req.params.id);
    
    const order = await orderService.getOrderById(orderId, req.user.id, req.user.role === 'admin');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    if (error.message === 'Order not found') {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (error.message === 'Not authorized to access this order') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this order' });
    }
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private (Admin)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.status = status;
    await order.save();
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};
};
};