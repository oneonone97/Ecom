const BaseService = require('./BaseService');
const db = require('../utils/database');
const logger = require('../utils/logger');

class CartService extends BaseService {
  constructor() {
    super();
    // No repository dependencies - using direct database access
  }

  async getUserCart(userId) {
    try {
      // Get cart with items and product details using JOIN
      const cartData = await db.carts.findWithRelations(
        { userId },
        [
          {
            type: 'LEFT_JOIN',
            table: 'CartItems',
            localKey: 'id',
            foreignKey: 'cartId'
          },
          {
            type: 'LEFT_JOIN',
            table: 'Products',
            localKey: 'CartItems.productId',
            foreignKey: 'id'
          }
        ]
      );

      if (!cartData || cartData.length === 0) {
        // Create empty cart if none exists
        const newCart = await db.carts.create({ userId });
        return {
          ...newCart,
          items: [],
          totalItems: 0,
          totalPrice: 0
        };
      }

      // Aggregate cart data
      const cart = cartData[0];
      const items = [];
      let totalItems = 0;
      let totalPrice = 0;

      // Group cart items by product
      const itemMap = new Map();

      cartData.forEach(row => {
        if (row.productId && row.name) {
          const itemKey = row.productId;
          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
              id: row.productId,
              name: row.name,
              price_paise: row.price_paise,
              stock: row.stock,
              imageUrl: row.imageUrl,
              quantity: row.quantity || 0,
              subtotal: 0
            });
          }
          const item = itemMap.get(itemKey);
          item.quantity += row.quantity || 0;
          item.subtotal = item.quantity * (row.price_paise || 0);
        }
      });

      // Convert map to array and calculate totals
      items.push(...itemMap.values());
      totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

      return {
        id: cart.id,
        userId: cart.userId,
        items,
        totalItems,
        totalPrice,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt
      };
    } catch (error) {
      logger.error('Error getting user cart:', error);
      throw error;
    }
  }

  async addItemToCart(userId, productId, quantity) {
    try {
        // First verify product exists and has stock
        const product = await db.products.findByPk(productId);
        if (!product) {
            const error = new Error(`Product with ID ${productId} not found`);
            error.statusCode = 404;
            error.code = 'PRODUCT_NOT_FOUND';
            throw error;
        }

        if (product.stock < quantity) {
            const error = new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
            error.statusCode = 400;
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
        }

        // Find or create cart
        let cart = await db.carts.findOne({ userId });

        if (!cart) {
            cart = await db.carts.create({ userId });
            logger.info('New cart created', { userId, cartId: cart.id });
        }

        // Check if item already exists in cart
        const existingItem = await db.cartItems.findOne({
          cartId: cart.id,
          productId
        });

        if (existingItem) {
            // Update existing item
            await db.cartItems.update(existingItem.id, {
                quantity: existingItem.quantity + quantity,
                price_paise: product.price_paise
            });
        } else {
            // Add new item
            await db.cartItems.create({
                cartId: cart.id,
                productId,
                quantity,
                price_paise: product.price_paise
            });
        }

        logger.info('Cart item added/updated', {
            userId,
            cartId: cart.id,
            productId,
            quantity,
            price_paise: product.price_paise
        });

        // Return the full cart with calculations
        return await this.getUserCart(userId);

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

      // Find cart item with product details
      const cartItem = await db.cartItems.findWithRelations(
        { id: itemId },
        [
          {
            type: 'INNER_JOIN',
            table: 'Carts',
            localKey: 'cartId',
            foreignKey: 'id'
          },
          {
            type: 'INNER_JOIN',
            table: 'Products',
            localKey: 'productId',
            foreignKey: 'id'
          }
        ]
      );

      if (!cartItem || cartItem.length === 0 || cartItem[0].userId !== userId) {
        throw new Error('Cart item not found');
      }

      const item = cartItem[0];

      // Check stock availability
      if (item.stock < quantity) {
        throw new Error(`Only ${item.stock} items available in stock`);
      }

      // Update quantity
      await db.cartItems.update(itemId, { quantity });

      logger.info('Cart item quantity updated', {
        userId,
        itemId,
        oldQuantity: item.quantity,
        newQuantity: quantity,
        productName: item.name,
        timestamp: new Date().toISOString()
      });

      // Return the full updated cart
      return await this.getUserCart(userId);
    } catch (error) {
      logger.error('Error updating cart item quantity:', error);
      throw error;
    }
  }

  async removeCartItem(userId, itemId) {
    try {
      // Find cart item with cart ownership verification
      const cartItem = await db.cartItems.findWithRelations(
        { id: itemId },
        [{
          type: 'INNER_JOIN',
          table: 'Carts',
          localKey: 'cartId',
          foreignKey: 'id'
        }]
      );

      if (!cartItem || cartItem.length === 0 || cartItem[0].userId !== userId) {
        throw new Error('Cart item not found');
      }

      await db.cartItems.destroy(itemId);

      logger.info('Item removed from cart', {
        userId,
        itemId,
        productName: cartItem[0].name,
        quantity: cartItem[0].quantity,
        timestamp: new Date().toISOString()
      });

      // Return the full updated cart
      return await this.getUserCart(userId);
    } catch (error) {
      logger.error('Error removing cart item:', error);
      throw error;
    }
  }

  async clearUserCart(userId) {
    try {
      // Find user's cart
      const cart = await db.carts.findOne({ userId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Get count of items before deletion
      const itemCount = await db.cartItems.count({ cartId: cart.id });

      // Delete all cart items (we'd need to implement a batch delete method)
      // For now, we'll need to get all items and delete them one by one
      const items = await db.cartItems.findAll({ where: { cartId: cart.id } });
      for (const item of items) {
        await db.cartItems.destroy(item.id);
      }

      logger.info('Cart cleared', {
        userId,
        itemsRemoved: itemCount,
        timestamp: new Date().toISOString()
      });

      return { message: 'Cart cleared successfully' };
    } catch (error) {
      logger.error('Error clearing cart:', error);
      throw error;
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