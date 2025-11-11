const BaseService = require('./BaseService');
const CartRepository = require('../repositories/CartRepository');
const ProductRepository = require('../repositories/ProductRepository');
const logger = require('../utils/logger');

class CartService extends BaseService {
  constructor(
    cartRepository = new CartRepository(),
    productRepository = new ProductRepository()
  ) {
    super(cartRepository);
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
    this.logger = logger; // Add this line to fix the undefined logger
  }

  async getUserCart(userId) {
    try {
      let cart = await this.cartRepository.getCartWithCalculations(userId);
      
      if (!cart) {
        // Create empty cart if none exists
        const [newCart] = await this.cartRepository.findOrCreateUserCart(userId);
        cart = {
          ...newCart.toJSON(),
          items: [],
          totalItems: 0,
          totalPrice: 0
        };
      }

      return cart;
    } catch (error) {
      throw this.handleError(error, 'getUserCart');
    }
  }

  async addItemToCart(userId, productId, quantity) {
    try {
        // First verify product exists
        const product = await this.productRepository.findById(productId);
        if (!product) {
            const error = new Error(`Product with ID ${productId} not found`);
            error.statusCode = 404;
            error.code = 'PRODUCT_NOT_FOUND';
            throw error;
        }

        // Find or create cart
        let cart = await this.cartRepository.findByUserId(userId);
        
        // Create new cart if it doesn't exist
        if (!cart) {
            cart = await this.cartRepository.create({
                userId
            });
            logger.info('New cart created', { userId, cartId: cart.id });
        }

        // Use CartItem to add/update item
        const price = product.price_paise;
        await this.cartRepository.addItemToCart(cart.id, productId, quantity, price);
        
        logger.info('Cart item added/updated', {
            userId,
            cartId: cart.id,
            productId,
            quantity,
            price
        });

        // Return the full cart with Product associations
        const fullCart = await this.cartRepository.getCartWithCalculations(userId);
        
        return fullCart;

    } catch (error) {
        logger.error('Error in addItemToCart:', {
            userId,
            productId,
            quantity,
            error: error.message
        });
        
        // Preserve product not found errors
        if (error.code === 'PRODUCT_NOT_FOUND' || error.message.includes('Product') && error.message.includes('not found')) {
            error.statusCode = error.statusCode || 404;
            error.code = error.code || 'PRODUCT_NOT_FOUND';
            throw error;
        }
        
        throw this.handleError(error, 'addItemToCart');
    }
  }

  async updateCartItemQuantity(userId, itemId, quantity) {
    try {
      if (!quantity || quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      return await this.cartRepository.executeInTransaction(async (transaction) => {
        // Find cart item
        const cartItem = await this.cartRepository.findCartItem(itemId, userId, transaction);
        if (!cartItem) {
          throw new Error('Cart item not found');
        }

        // Check stock availability
        if (cartItem.Product.stock < quantity) {
          throw new Error(`Only ${cartItem.Product.stock} items available in stock`);
        }

        // Update quantity
        await this.cartRepository.updateCartItemQuantity(itemId, quantity, userId, transaction);

        logger.info('Cart item quantity updated', {
          userId,
          itemId,
          oldQuantity: cartItem.quantity,
          newQuantity: quantity,
          productName: cartItem.Product.name,
          timestamp: new Date().toISOString()
        });

        // Return the full updated cart
        return await this.cartRepository.getCartWithCalculations(userId, transaction);
      });
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'updateCartItemQuantity');
    }
  }

  async removeCartItem(userId, itemId) {
    try {
      const cartItem = await this.cartRepository.findCartItem(itemId, userId);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      await this.cartRepository.removeCartItem(itemId, userId);

      logger.info('Item removed from cart', {
        userId,
        itemId,
        productName: cartItem.Product.name,
        quantity: cartItem.quantity,
        timestamp: new Date().toISOString()
      });

      // Return the full updated cart
      return await this.cartRepository.getCartWithCalculations(userId);
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'removeCartItem');
    }
  }

  async clearUserCart(userId) {
    try {
      return await this.cartRepository.executeInTransaction(async (transaction) => {
        const cart = await this.cartRepository.findUserCart(userId, true);
        if (!cart) {
          throw new Error('Cart not found');
        }

        const itemCount = cart.items ? cart.items.length : 0;
        
        await this.cartRepository.clearUserCart(userId, transaction);

        logger.info('Cart cleared', {
          userId,
          itemsRemoved: itemCount,
          timestamp: new Date().toISOString()
        });

        return { message: 'Cart cleared successfully' };
      });
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'clearUserCart');
    }
  }

  async validateCartForCheckout(userId) {
    try {
      const cart = await this.cartRepository.findUserCart(userId, true);
      
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      const validation = await this.cartRepository.validateCartStock(userId);
      
      if (!validation.isValid) {
        const errors = validation.errors.map(error => 
          `${error.productName}: requested ${error.requestedQuantity}, available ${error.availableStock}`
        );
        throw new Error(`Stock validation failed: ${errors.join(', ')}`);
      }

      // Calculate totals
      const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
      const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.quantity * parseFloat(item.price));
      }, 0);

      return {
        isValid: true,
        cart: {
          ...cart.toJSON(),
          totalItems,
          totalPrice: parseFloat(totalPrice.toFixed(2))
        }
      };
    } catch (error) {
      throw this.handleError(error, 'validateCartForCheckout');
    }
  }

  async removeOutOfStockItems(userId) {
    try {
      return await this.cartRepository.executeInTransaction(async (transaction) => {
        const removedItems = await this.cartRepository.removeOutOfStockItems(userId, transaction);
        
        if (removedItems.length > 0) {
          logger.info('Out of stock items removed from cart', {
            userId,
            removedItems,
            timestamp: new Date().toISOString()
          });
        }

        return {
          removedItems,
          message: removedItems.length > 0 
            ? `${removedItems.length} out of stock items removed from cart`
            : 'No out of stock items found'
        };
      });
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'removeOutOfStockItems');
    }
  }

  async getCartStatistics(userId) {
    try {
      const cart = await this.cartRepository.findUserCart(userId, true);
      
      if (!cart || !cart.items) {
        return {
          totalItems: 0,
          totalPrice: 0,
          uniqueProducts: 0,
          averageItemPrice: 0
        };
      }

      const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
      const totalPrice = cart.items.reduce((total, item) => {
        return total + (item.quantity * parseFloat(item.price));
      }, 0);
      const uniqueProducts = cart.items.length;
      const averageItemPrice = uniqueProducts > 0 ? totalPrice / totalItems : 0;

      return {
        totalItems,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        uniqueProducts,
        averageItemPrice: parseFloat(averageItemPrice.toFixed(2))
      };
    } catch (error) {
      throw this.handleError(error, 'getCartStatistics');
    }
  }

  async syncCartWithStock(userId) {
    try {
      return await this.cartRepository.executeInTransaction(async (transaction) => {
        const cart = await this.cartRepository.findUserCart(userId, true);
        
        if (!cart || !cart.items) {
          return { updated: [], removed: [] };
        }

        const updated = [];
        const removed = [];

        for (const item of cart.items) {
          if (item.Product.stock === 0) {
            // Remove out of stock items
            await this.cartRepository.removeCartItem(item.id, userId);
            removed.push({
              productName: item.Product.name,
              quantity: item.quantity
            });
          } else if (item.quantity > item.Product.stock) {
            // Update quantity to available stock
            await this.cartRepository.updateCartItemQuantity(
              item.id,
              item.Product.stock,
              userId,
              transaction
            );
            updated.push({
              productName: item.Product.name,
              oldQuantity: item.quantity,
              newQuantity: item.Product.stock
            });
          }
        }

        logger.info('Cart synced with stock', {
          userId,
          updatedItems: updated.length,
          removedItems: removed.length,
          timestamp: new Date().toISOString()
        });

        return { updated, removed };
      });
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'syncCartWithStock');
    }
  }
}

module.exports = CartService;