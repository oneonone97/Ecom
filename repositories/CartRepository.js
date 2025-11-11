const BaseRepository = require('./BaseRepository');
const { Cart, CartItem } = require('../models/Cart');
const Product = require('../models/Product');
const { Op } = require('sequelize');
const { getImageGallery } = require('../utils/imageUtils');

class CartRepository extends BaseRepository {
  constructor() {
    super(Cart);
  }

  async findUserCart(userId, includeItems = true, transaction = null) {
    try {
      const options = {
        where: { userId }
      };

      if (includeItems) {
        options.include = [{
          model: CartItem,
          as: 'items',
          include: [{
            model: Product,
            attributes: ['id', 'name', 'description', 'price_paise', 'sale_price_paise', 'image_url', 'stock', 'categoryId']
          }]
        }];
      }

      if (transaction) {
        options.transaction = transaction;
      }

      return await this.model.findOne(options);
    } catch (error) {
      throw new Error(`Error finding user cart: ${error.message}`);
    }
  }

  async findOrCreateUserCart(userId, transaction = null) {
    try {
      const options = {
        where: { userId },
        defaults: { userId }
      };

      if (transaction) {
        options.transaction = transaction;
      }

      return await this.model.findOrCreate(options);
    } catch (error) {
      throw new Error(`Error finding or creating user cart: ${error.message}`);
    }
  }

  async addItemToCart(cartId, productId, quantity, price, transaction = null) {
    try {
      const options = {
        where: { cartId, productId }
      };

      if (transaction) {
        options.transaction = transaction;
      }

      const existingItem = await CartItem.findOne(options);

      if (existingItem) {
        const updateOptions = {
          quantity: existingItem.quantity + quantity,
          price: price
        };

        if (transaction) {
          updateOptions.transaction = transaction;
        }

        return await existingItem.update(updateOptions);
      } else {
        const createOptions = {
          cartId,
          productId,
          quantity,
          price
        };

        if (transaction) {
          createOptions.transaction = transaction;
        }

        return await CartItem.create(createOptions);
      }
    } catch (error) {
      throw new Error(`Error adding item to cart: ${error.message}`);
    }
  }

  async updateCartItemQuantity(itemId, quantity, userId, transaction = null) {
    try {
      const options = {
        where: { id: itemId },
        include: [{
          model: Cart,
          where: { userId }
        }]
      };

      if (transaction) {
        options.transaction = transaction;
      }

      const cartItem = await CartItem.findOne(options);

      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Correctly pass transaction in the options object (second argument)
      return await cartItem.update({ quantity }, { transaction });
    } catch (error) {
      throw new Error(`Error updating cart item quantity: ${error.message}`);
    }
  }

  async removeCartItem(itemId, userId) {
    try {
      const cartItem = await CartItem.findOne({
        where: { id: itemId },
        include: [{
          model: Cart,
          where: { userId }
        }]
      });

      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      await cartItem.destroy();
      return true;
    } catch (error) {
      throw new Error(`Error removing cart item: ${error.message}`);
    }
  }

  async clearUserCart(userId, transaction = null) {
    try {
      const cart = await this.findUserCart(userId, false);
      
      if (!cart) {
        throw new Error('Cart not found');
      }

      const options = {
        where: { cartId: cart.id }
      };

      if (transaction) {
        options.transaction = transaction;
      }

      await CartItem.destroy(options);
      return true;
    } catch (error) {
      throw new Error(`Error clearing user cart: ${error.message}`);
    }
  }

  async getCartItemsCount(userId) {
    try {
      const cart = await this.findUserCart(userId, true);
      
      if (!cart || !cart.items) {
        return 0;
      }

      return cart.items.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      throw new Error(`Error getting cart items count: ${error.message}`);
    }
  }

  async getCartTotalPrice(userId) {
    try {
      const cart = await this.findUserCart(userId, true);
      
      if (!cart || !cart.items) {
        return 0;
      }

      return cart.items.reduce((total, item) => {
        return total + (item.quantity * parseFloat(item.price));
      }, 0);
    } catch (error) {
      throw new Error(`Error getting cart total price: ${error.message}`);
    }
  }

  async validateCartStock(userId) {
    try {
      const cart = await this.findUserCart(userId, true);
      
      if (!cart || !cart.items) {
        return { isValid: true, errors: [] };
      }

      const errors = [];
      
      for (const item of cart.items) {
        if (item.Product.stock < item.quantity) {
          errors.push({
            productId: item.productId,
            productName: item.Product.name,
            requestedQuantity: item.quantity,
            availableStock: item.Product.stock
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      throw new Error(`Error validating cart stock: ${error.message}`);
    }
  }

  async findCartItem(itemId, userId, transaction = null) {
    try {
      const options = {
        where: { id: itemId },
        include: [{
          model: Cart,
          where: { userId }
        }, {
          model: Product
        }]
      };

      if (transaction) {
        options.transaction = transaction;
      }

      return await CartItem.findOne(options);
    } catch (error) {
      throw new Error(`Error finding cart item: ${error.message}`);
    }
  }

  async getCartWithCalculations(userId, transaction = null) {
    try {
      const cart = await this.findUserCart(userId, true, transaction);
      
      if (!cart) {
        return null;
      }

      const totalItems = cart.items ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;
      const totalPrice = cart.items ? cart.items.reduce((total, item) => {
        return total + (item.quantity * parseFloat(item.price));
      }, 0) : 0;

      // Enrich products with image galleries
      const enrichedItems = cart.items ? cart.items.map(item => {
        const itemData = item.toJSON ? item.toJSON() : item;
        if (itemData.Product) {
          const imageGallery = getImageGallery(itemData.Product.image_url);
          return {
            ...itemData,
            Product: {
              ...itemData.Product,
              image_gallery: imageGallery.gallery,
              images: imageGallery // For frontend compatibility
            }
          };
        }
        return itemData;
      }) : [];

      return {
        ...cart.toJSON(),
        items: enrichedItems,
        totalItems,
        totalPrice: parseFloat(totalPrice.toFixed(2))
      };
    } catch (error) {
      throw new Error(`Error getting cart with calculations: ${error.message}`);
    }
  }

  async removeOutOfStockItems(userId, transaction = null) {
    try {
      const cart = await this.findUserCart(userId, true);
      
      if (!cart || !cart.items) {
        return [];
      }

      const outOfStockItems = cart.items.filter(item => item.Product.stock === 0);
      
      if (outOfStockItems.length > 0) {
        const itemIds = outOfStockItems.map(item => item.id);
        
        const options = {
          where: { id: { [Op.in]: itemIds } }
        };

        if (transaction) {
          options.transaction = transaction;
        }

        await CartItem.destroy(options);
      }

      return outOfStockItems.map(item => ({
        productId: item.productId,
        productName: item.Product.name,
        quantity: item.quantity
      }));
    } catch (error) {
      throw new Error(`Error removing out of stock items: ${error.message}`);
    }
  }

  async findByUserId(userId) {
    return await this.model.findOne({ where: { userId } });
  }

  async create(cartData) {
    return await this.model.create(cartData);
  }

  async save(cart) {
    if (cart.isNew) {
      return await cart.save();
    }
    return await this.model.update(cart, {
      where: { id: cart.id }
    });
  }
}

module.exports = CartRepository;
