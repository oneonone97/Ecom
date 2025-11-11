const { container } = require('../container/serviceRegistration');
const logger = require('../utils/logger');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const cartService = container.resolve('cartService');
    const cart = await cartService.getUserCart(req.user.id);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
exports.addToCart = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const cartService = container.resolve('cartService');
    const { productId, quantity = 1 } = req.body;
    
    const cart = await cartService.addItemToCart(req.user.id, productId, quantity);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const cartService = container.resolve('cartService');
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be at least 1',
        timestamp: new Date().toISOString()
      });
    }
    
    const cartItem = await cartService.updateCartItemQuantity(req.user.id, itemId, quantity);

    logger.logRequest(req, res, Date.now() - startTime);
    
    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: cartItem
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
exports.removeCartItem = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const cartService = container.resolve('cartService');
    const { itemId } = req.params;
    
    const cart = await cartService.removeCartItem(req.user.id, itemId);

    logger.logRequest(req, res, Date.now() - startTime);
    
    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Clear user cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const cartService = container.resolve('cartService');
    const result = await cartService.clearUserCart(req.user.id);

    logger.logRequest(req, res, Date.now() - startTime);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};