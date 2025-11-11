const { Wishlist, WishlistItem } = require('../models/Wishlist');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const { getImageGallery } = require('../utils/imageUtils');

/**
 * @desc    Get all wishlists for current user
 * @route   GET /api/wishlists
 * @access  Private
 */
const getUserWishlists = async (req, res, next) => {
  try {
    logger.info(`Fetching wishlists for user ${req.user.id}`);

    const wishlists = await Wishlist.getUserWishlists(req.user.id);

    // Enrich products with image galleries
    const enrichedWishlists = wishlists.map(wishlist => {
      const wishlistData = wishlist.toJSON ? wishlist.toJSON() : wishlist;
      if (wishlistData.items && Array.isArray(wishlistData.items)) {
        wishlistData.items = wishlistData.items.map(item => {
          if (item.product && item.product.image_url) {
            const imageGallery = getImageGallery(item.product.image_url);
            return {
              ...item,
              product: {
                ...item.product,
                image_gallery: imageGallery.gallery,
                images: imageGallery // For frontend compatibility
              }
            };
          }
          return item;
        });
      }
      return wishlistData;
    });

    res.status(200).json({
      success: true,
      count: enrichedWishlists.length,
      data: enrichedWishlists
    });
  } catch (error) {
    logger.error('Error fetching user wishlists:', error);
    next(error);
  }
};

/**
 * @desc    Get default wishlist for current user
 * @route   GET /api/wishlists/default
 * @access  Private
 */
const getDefaultWishlist = async (req, res, next) => {
  try {
    logger.info(`Fetching default wishlist for user ${req.user.id}`);

    const wishlist = await Wishlist.getDefaultWishlist(req.user.id);
    
    // Load items for the wishlist
    await wishlist.reload({
      include: [{
        model: WishlistItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url', 'stock', 'description', 'categoryId', 'featured', 'is_new', 'is_sale']
        }]
      }],
      order: [
        [{ model: WishlistItem, as: 'items' }, 'addedAt', 'DESC']
      ]
    });

    // Enrich products with image galleries
    const wishlistData = wishlist.toJSON();
    if (wishlistData.items && Array.isArray(wishlistData.items)) {
      wishlistData.items = wishlistData.items.map(item => {
        if (item.product && item.product.image_url) {
          const imageGallery = getImageGallery(item.product.image_url);
          return {
            ...item,
            product: {
              ...item.product,
              image_gallery: imageGallery.gallery,
              images: imageGallery // For frontend compatibility
            }
          };
        }
        return item;
      });
    }

    res.status(200).json({
      success: true,
      data: wishlistData
    });
  } catch (error) {
    logger.error('Error fetching default wishlist:', error);
    next(error);
  }
};

/**
 * @desc    Create a new wishlist
 * @route   POST /api/wishlists
 * @access  Private
 */
const createWishlist = async (req, res, next) => {
  try {
    const { name, description, isPublic } = req.body;
    
    logger.info(`Creating wishlist for user ${req.user.id}`, { name });

    const wishlist = await Wishlist.create({
      userId: req.user.id,
      name: name || 'My Wishlist',
      description,
      isPublic: isPublic || false,
      isDefault: false
    });

    res.status(201).json({
      success: true,
      data: wishlist,
      message: 'Wishlist created successfully'
    });
  } catch (error) {
    logger.error('Error creating wishlist:', error);
    next(error);
  }
};

/**
 * @desc    Add item to wishlist
 * @route   POST /api/wishlists/:wishlistId/items
 * @access  Private
 */
const addItemToWishlist = async (req, res, next) => {
  try {
    const { wishlistId } = req.params;
    const { productId, priority, notes } = req.body;
    
    logger.info(`Adding product ${productId} to wishlist ${wishlistId}`);

    // Find wishlist and verify ownership
    const wishlist = await Wishlist.findOne({
      where: {
        id: wishlistId,
        userId: req.user.id
      }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Add item to wishlist
    const item = await wishlist.addItem(productId, {
      priority: priority || 'medium',
      notes: notes || null,
      priceWhenAdded: product.price
    });

    // Reload with product data
    await item.reload({
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    res.status(201).json({
      success: true,
      data: item,
      message: 'Item added to wishlist successfully'
    });
  } catch (error) {
    if (error.message === 'Product is already in this wishlist') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    logger.error('Error adding item to wishlist:', error);
    next(error);
  }
};

/**
 * @desc    Remove item from wishlist
 * @route   DELETE /api/wishlists/:wishlistId/items/:productId
 * @access  Private
 */
const removeItemFromWishlist = async (req, res, next) => {
  try {
    const { wishlistId, productId } = req.params;
    
    logger.info(`Removing product ${productId} from wishlist ${wishlistId}`);

    // Find wishlist and verify ownership
    const wishlist = await Wishlist.findOne({
      where: {
        id: wishlistId,
        userId: req.user.id
      }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Remove item
    const result = await wishlist.removeItem(productId);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Error removing item from wishlist:', error);
    next(error);
  }
};

/**
 * @desc    Update wishlist item
 * @route   PUT /api/wishlists/:wishlistId/items/:itemId
 * @access  Private
 */
const updateWishlistItem = async (req, res, next) => {
  try {
    const { wishlistId, itemId } = req.params;
    const { priority, notes } = req.body;
    
    logger.info(`Updating wishlist item ${itemId}`);

    // Find wishlist and verify ownership
    const wishlist = await Wishlist.findOne({
      where: {
        id: wishlistId,
        userId: req.user.id
      }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Find and update item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlistId: wishlistId
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    if (priority) await item.updatePriority(priority);
    if (notes !== undefined) await item.updateNotes(notes);

    await item.reload({
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    res.status(200).json({
      success: true,
      data: item,
      message: 'Wishlist item updated successfully'
    });
  } catch (error) {
    logger.error('Error updating wishlist item:', error);
    next(error);
  }
};

/**
 * @desc    Delete wishlist
 * @route   DELETE /api/wishlists/:wishlistId
 * @access  Private
 */
const deleteWishlist = async (req, res, next) => {
  try {
    const { wishlistId } = req.params;
    
    logger.info(`Deleting wishlist ${wishlistId}`);

    // Find wishlist and verify ownership
    const wishlist = await Wishlist.findOne({
      where: {
        id: wishlistId,
        userId: req.user.id
      }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Prevent deletion of default wishlist
    if (wishlist.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default wishlist'
      });
    }

    await wishlist.destroy();

    res.status(200).json({
      success: true,
      message: 'Wishlist deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting wishlist:', error);
    next(error);
  }
};

/**
 * @desc    Clear all items from wishlist
 * @route   DELETE /api/wishlists/:wishlistId/items
 * @access  Private
 */
const clearWishlist = async (req, res, next) => {
  try {
    const { wishlistId } = req.params;
    
    logger.info(`Clearing all items from wishlist ${wishlistId}`);

    // Find wishlist and verify ownership
    const wishlist = await Wishlist.findOne({
      where: {
        id: wishlistId,
        userId: req.user.id
      }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    const result = await wishlist.clearAll();

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error clearing wishlist:', error);
    next(error);
  }
};

module.exports = {
  getUserWishlists,
  getDefaultWishlist,
  createWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  updateWishlistItem,
  deleteWishlist,
  clearWishlist
};

