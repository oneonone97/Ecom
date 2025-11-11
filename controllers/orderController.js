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