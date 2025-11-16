const db = require('../utils/database');
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

    // Get all wishlists for user
    const wishlists = await db.wishlists.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    // Get items for each wishlist and enrich with product data
    const enrichedWishlists = await Promise.all(
      wishlists.map(async (wishlist) => {
        const items = await db.wishlistItems.findAll({
          where: { wishlistId: wishlist.id }
        });

        // Get product details for each item
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const product = await db.products.findByPk(item.productId);
            if (product && product.image_url) {
              const imageGallery = getImageGallery(product.image_url);
              return {
                ...item,
                product: {
                  ...product,
                  image_gallery: imageGallery.gallery,
                  images: imageGallery
                }
              };
            }
            return { ...item, product };
          })
        );

        return {
          ...wishlist,
          items: itemsWithProducts
        };
      })
    );

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

    // Find or create default wishlist
    let wishlist = await db.wishlists.findOne({
      where: { userId: req.user.id, name: 'Default Wishlist' }
    });

    if (!wishlist) {
      // Create default wishlist if it doesn't exist
      wishlist = await db.wishlists.create({
        userId: req.user.id,
        name: 'Default Wishlist'
      });
    }

    // Get items with product details
    const items = await db.wishlistItems.findAll({
      where: { wishlistId: wishlist.id }
    });

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await db.products.findByPk(item.productId);
        if (product && product.image_url) {
          const imageGallery = getImageGallery(product.image_url);
          return {
            ...item,
            product: {
              id: product.id,
              name: product.name,
              price_paise: product.price_paise,
              sale_price_paise: product.sale_price_paise,
              image_url: product.image_url,
              stock: product.stock,
              description: product.description,
              categoryId: product.categoryId,
              featured: product.featured,
              is_new: product.is_new,
              is_sale: product.is_sale,
              image_gallery: imageGallery.gallery,
              images: imageGallery
            }
          };
        }
        return { ...item, product };
      })
    );

    const wishlistData = {
      ...wishlist,
      items: itemsWithProducts
    };

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

    const wishlist = await db.wishlists.create({
      userId: req.user.id,
      name: name || 'My Wishlist',
      description: description || null,
      isPublic: isPublic || false
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
    const { productId } = req.body;
    
    logger.info(`Adding product ${productId} to wishlist ${wishlistId}`);

    // Find wishlist and verify ownership
    const wishlist = await db.wishlists.findOne({
      where: { id: wishlistId, userId: req.user.id }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Check if product exists
    const product = await db.products.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if item already exists
    const existingItem = await db.wishlistItems.findOne({
      where: { wishlistId, productId }
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in this wishlist'
      });
    }

    // Add item to wishlist
    const item = await db.wishlistItems.create({
      wishlistId,
      productId
    });

    // Get product data
    const itemWithProduct = {
      ...item,
      product
    };

    res.status(201).json({
      success: true,
      data: itemWithProduct,
      message: 'Item added to wishlist successfully'
    });
  } catch (error) {
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
    const wishlist = await db.wishlists.findOne({
      where: { id: wishlistId, userId: req.user.id }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Find and delete item
    const item = await db.wishlistItems.findOne({
      where: { wishlistId, productId }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist'
      });
    }

    await db.wishlistItems.destroy(item.id);

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist successfully'
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
    const wishlist = await db.wishlists.findOne({
      where: { id: wishlistId, userId: req.user.id }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Find and update item
    const item = await db.wishlistItems.findByPk(itemId);

    if (!item || item.wishlistId !== parseInt(wishlistId)) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    // Update item (if priority/notes columns exist)
    const updateData = {};
    if (priority !== undefined) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    const updatedItem = await db.wishlistItems.update(itemId, updateData);

    // Get product data
    const product = await db.products.findByPk(item.productId);
    const itemWithProduct = {
      ...updatedItem,
      product
    };

    res.status(200).json({
      success: true,
      data: itemWithProduct,
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
    const wishlist = await db.wishlists.findOne({
      where: { id: wishlistId, userId: req.user.id }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Delete all items first
    const items = await db.wishlistItems.findAll({
      where: { wishlistId }
    });
    
    for (const item of items) {
      await db.wishlistItems.destroy(item.id);
    }

    // Delete wishlist
    await db.wishlists.destroy(wishlistId);

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
    const wishlist = await db.wishlists.findOne({
      where: { id: wishlistId, userId: req.user.id }
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Delete all items
    const items = await db.wishlistItems.findAll({
      where: { wishlistId }
    });
    
    for (const item of items) {
      await db.wishlistItems.destroy(item.id);
    }

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
      count: items.length
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