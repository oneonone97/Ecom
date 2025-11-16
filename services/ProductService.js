const logger = require('../utils/logger');
const BaseService = require('./BaseService');
const db = require('../utils/database');
const { uploadImage, deleteImage, isConfigured } = require('../utils/supabaseStorage');
const fs = require('fs');
const path = require('path');

class ProductService extends BaseService {
  constructor(cacheService, productRepository) {
    super();
    this.cacheService = cacheService;
    this.productRepository = productRepository;
  }

  /**
   * Upload product image to Supabase Storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalFilename - Original filename
   * @param {string} mimetype - File MIME type
   * @param {string} productId - Product ID for organizing files
   * @returns {Promise<string>} Public URL of uploaded image
   */
  async uploadProductImage(fileBuffer, originalFilename, mimetype, productId) {
    if (!isConfigured()) {
      throw new Error('Supabase Storage is not configured');
    }

    try {
      const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';
      const fileExtension = path.extname(originalFilename).toLowerCase();
      const filePath = `products/${productId}/main${fileExtension}`;

      const publicUrl = await uploadImage(fileBuffer, bucketName, filePath, mimetype);

      logger.info('Product image uploaded to Supabase', {
        productId,
        filePath,
        publicUrl
      });

      return publicUrl;
    } catch (error) {
      logger.error('Failed to upload product image to Supabase:', error);
      throw error;
    }
  }

  /**
   * Delete product image from Supabase Storage
   * @param {string} imageUrl - Supabase image URL to delete
   * @param {string} productId - Product ID for logging
   * @returns {Promise<boolean>} Success status
   */
  async deleteProductImage(imageUrl, productId) {
    if (!imageUrl || !imageUrl.includes('supabase.co')) {
      return true; // Not a Supabase URL, nothing to delete
    }

    if (!isConfigured()) {
      logger.warn('Supabase Storage not configured, cannot delete image');
      return false;
    }

    try {
      // Extract file path from Supabase URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      // Supabase Storage URL format: /storage/v1/object/public/{bucket}/{path}
      if (pathParts.length >= 6 && pathParts[1] === 'storage' && pathParts[2] === 'v1' && pathParts[3] === 'object' && pathParts[4] === 'public') {
        const bucketName = pathParts[5];
        const filePath = pathParts.slice(6).join('/'); // Everything after bucket name

        await deleteImage(bucketName, filePath);
        logger.info('Product image deleted from Supabase', {
          productId,
          bucketName,
          filePath
        });
        return true;
      }
    } catch (error) {
      logger.error('Failed to delete product image from Supabase:', error);
    }

    return false;
  }

  /**
   * Process image upload for product creation/update
   * @param {Object} req - Express request object with file
   * @param {string} productId - Product ID (for updates)
   * @returns {Promise<string|null>} Public URL or null if no image
   */
  async processProductImageUpload(req, productId = null) {
    if (!req.file) {
      return null;
    }

    try {
      // Read the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);

      // Use provided productId or generate temp ID
      const finalProductId = productId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Upload to Supabase
      const publicUrl = await this.uploadProductImage(
        fileBuffer,
        req.file.originalname,
        req.file.mimetype,
        finalProductId
      );

      // Clean up local temp file
      fs.unlinkSync(req.file.path);

      return publicUrl;
    } catch (error) {
      logger.error('Failed to process product image upload:', error);
      // Clean up temp file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          logger.error('Failed to clean up temp file:', cleanupError);
        }
      }
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      // Validate product data
      await this.validateProductData(productData);

      // Check if product name already exists in category
      const existingProduct = await db.products.findOne({
        where: {
          name: productData.name,
          categoryId: productData.categoryId
        }
      });

      if (existingProduct) {
        throw new Error(`Product '${productData.name}' already exists in this category`);
      }

      // Prepare product data for database
      const dbProductData = {
        name: productData.name,
        description: productData.description,
        price_paise: productData.price * 100, // Convert to paise
        stock: productData.stock,
        categoryId: productData.categoryId,
        imageUrl: productData.imageUrl || null,
        isActive: productData.isActive !== undefined ? productData.isActive : true
      };

      // Create product
      const product = await db.products.create(dbProductData);

      // Invalidate relevant caches
      if (this.cacheService) {
        await this.cacheService.invalidateByPattern('products:*');
        await this.cacheService.invalidateByPattern('categories:*');
      }

      logger.info('Product created successfully', {
        productId: product.id,
        name: product.name,
        categoryId: product.categoryId
      });

      return product;
    } catch (error) {
      logger.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId, updateData) {
    try {
      // Validate update data
      await this.validateProductUpdateData(updateData);
      
      // Check if product exists
      const existingProduct = await db.products.findByPk(productId);
      if (!existingProduct) {
        throw new Error('Product not found');
      }

      // If name or category is being changed, check for duplicates
      if ((updateData.name && updateData.name !== existingProduct.name) ||
          (updateData.categoryId && updateData.categoryId !== existingProduct.categoryId)) {
        const nameToCheck = updateData.name || existingProduct.name;
        const categoryToCheck = updateData.categoryId || existingProduct.categoryId;

        const duplicate = await db.products.findOne({
          where: {
            name: nameToCheck,
            categoryId: categoryToCheck
          }
        });
        if (duplicate && duplicate.id !== parseInt(productId)) {
          throw new Error(`Product '${nameToCheck}' already exists in this category`);
        }
      }

      // Prepare update data for database
      const dbUpdateData = {};
      if (updateData.name !== undefined) dbUpdateData.name = updateData.name;
      if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
      if (updateData.price !== undefined) dbUpdateData.price_paise = updateData.price * 100;
      if (updateData.stock !== undefined) dbUpdateData.stock = updateData.stock;
      if (updateData.categoryId !== undefined) dbUpdateData.categoryId = updateData.categoryId;
      if (updateData.imageUrl !== undefined) dbUpdateData.imageUrl = updateData.imageUrl;
      if (updateData.isActive !== undefined) dbUpdateData.isActive = updateData.isActive;

      // Update product
      const updatedProduct = await db.products.update(productId, dbUpdateData);
      
      // Invalidate caches
      if (this.cacheService) {
        await this.cacheService.invalidateProduct(productId);
        if (updateData.categoryId && updateData.categoryId !== existingProduct.categoryId) {
          await this.cacheService.invalidateByPattern('categories:*');
        }
      }
      
      logger.info('Product updated successfully', {
        productId: updatedProduct.id,
        changes: Object.keys(updateData)
      });

      return updatedProduct;
    } catch (error) {
      logger.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(productId) {
    try {
      // Check if product exists
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if product is in any active orders or carts
      const isInUse = await this.checkProductInUse(productId);
      if (isInUse.inOrders || isInUse.inCarts) {
        throw new Error('Cannot delete product: it is referenced in existing orders or carts');
      }

      // Soft delete or hard delete based on configuration
      await this.productRepository.deleteProduct(productId);
      
      // Invalidate caches
      await this.cacheService.invalidateProduct(productId);
      await this.cacheService.invalidateByPattern('categories:*');
      
      logger.info('Product deleted successfully', {
        productId: product.id,
        name: product.name
      });

      return { message: 'Product deleted successfully' };
    } catch (error) {
      logger.error('Error deleting product:', error);
      throw error;
    }
  }

  async getProductWithRecommendations(productId, userId = null) {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Get related products (same category, exclude current product)
      const relatedProducts = await this.productRepository.findProductsWithPagination(
        1, 4, 
        { 
          category: product.category,
          excludeId: productId 
        }
      );

      // Get user's view history if authenticated
      let viewHistory = [];
      if (userId) {
        await this.recordProductView(userId, productId);
        viewHistory = await this.getUserViewHistory(userId, 4);
      }

      return {
        product,
        relatedProducts: relatedProducts.rows,
        viewHistory
      };
    } catch (error) {
      logger.error('Error getting product with recommendations:', error);
      throw error;
    }
  }

  async searchProducts(searchTerm, filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'relevance' } = options;
      
      // Enhanced search with multiple criteria
      const searchResults = await this.productRepository.searchProducts(searchTerm, {
        ...filters,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        sortBy
      });

      // Log search for analytics
      logger.info('Product search performed', {
        searchTerm,
        filters,
        resultCount: searchResults.count,
        page,
        limit
      });

      return {
        products: searchResults.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(searchResults.count / limit),
          totalItems: searchResults.count,
          itemsPerPage: parseInt(limit)
        },
        searchTerm,
        filters
      };
    } catch (error) {
      logger.error('Error searching products:', error);
      throw error;
    }
  }

  async updateStock(productId, newStock, reason = 'manual_adjustment') {
    try {
      const product = await this.productRepository.findProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const oldStock = product.stock;
      const updatedProduct = await this.productRepository.updateProduct(productId, { 
        stock: newStock 
      });

      // Log stock change
      logger.info('Stock updated', {
        productId,
        productName: product.name,
        oldStock,
        newStock,
        difference: newStock - oldStock,
        reason
      });

      // Check for low stock alert
      if (newStock <= 5 && newStock > 0) {
        logger.warn('Low stock alert', {
          productId,
          productName: product.name,
          stock: newStock
        });
      }

      // Check for out of stock
      if (newStock === 0) {
        logger.warn('Product out of stock', {
          productId,
          productName: product.name
        });
      }

      // Invalidate product cache
      await this.cacheService.invalidateProduct(productId);

      return updatedProduct;
    } catch (error) {
      logger.error('Error updating stock:', error);
      throw error;
    }
  }

  async getFeaturedProducts(limit = 8) {
    try {
      const cacheKey = this.cacheService.generateKey('products', 'featured', limit);
      
      return await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          return await this.productRepository.getFeaturedProducts(limit);
        },
        600 // 10 minutes cache
      );
    } catch (error) {
      logger.error('Error getting featured products:', error);
      throw error;
    }
  }

  async getProductsByCategory(category, page = 1, limit = 12, sortBy = 'name') {
    try {
      const cacheKey = this.cacheService.generateKey(
        'products', 'category', category, page, limit, sortBy
      );
      
      return await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          const result = await this.productRepository.findProductsWithPagination(
            page, limit, 
            { category, sortBy }
          );
          
          return {
            products: result.rows,
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(result.count / limit),
              totalItems: result.count,
              itemsPerPage: limit
            },
            category
          };
        },
        300 // 5 minutes cache
      );
    } catch (error) {
      logger.error('Error getting products by category:', error);
      throw error;
    }
  }

  // Private helper methods
  async validateProductData(productData) {
    const requiredFields = ['name', 'description', 'price', 'categoryId', 'stock'];
    const missingFields = requiredFields.filter(field => !productData[field] && productData[field] !== 0);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate category exists
    if (productData.categoryId) {
      const category = await db.categories.findOne({
        where: { id: productData.categoryId, isActive: true }
      });

      if (!category) {
        throw new Error(`Category with ID ${productData.categoryId} not found. Please create categories first or use a valid category ID.`);
      }
    }

    if (productData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (productData.stock < 0) {
      throw new Error('Stock cannot be negative');
    }

    if (productData.name.length > 100) {
      throw new Error('Product name cannot exceed 100 characters');
    }

    if (productData.description.length > 500) {
      throw new Error('Product description cannot exceed 500 characters');
    }
  }

  async validateProductUpdateData(updateData) {
    // Validate category exists if being updated
    if (updateData.categoryId) {
      const category = await db.categories.findOne({
        where: { id: updateData.categoryId, isActive: true }
      });

      if (!category) {
        throw new Error(`Category with ID ${updateData.categoryId} not found. Please create categories first or use a valid category ID.`);
      }
    }

    if (updateData.price !== undefined && updateData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (updateData.stock !== undefined && updateData.stock < 0) {
      throw new Error('Stock cannot be negative');
    }

    if (updateData.name && updateData.name.length > 100) {
      throw new Error('Product name cannot exceed 100 characters');
    }

    if (updateData.description && updateData.description.length > 500) {
      throw new Error('Product description cannot exceed 500 characters');
    }
  }

  async checkProductInUse(productId) {
    // This would typically check order items and cart items
    // For now, return false to allow deletion
    // TODO: Implement actual checks when OrderItem and CartItem models are available
    return {
      inOrders: false,
      inCarts: false
    };
  }

  async recordProductView(userId, productId) {
    try {
      // Store in cache for quick access, could also store in database
      const viewKey = this.cacheService.generateKey('user_views', userId);
      const views = await this.cacheService.get(viewKey) || [];
      
      // Add to front, remove duplicates, keep last 10
      const updatedViews = [productId, ...views.filter(id => id !== productId)].slice(0, 10);
      
      await this.cacheService.set(viewKey, updatedViews, 86400); // 24 hours
    } catch (error) {
      logger.error('Error recording product view:', error);
      // Don't throw - this is not critical
    }
  }

  async getUserViewHistory(userId, limit = 10) {
    try {
      const viewKey = this.cacheService.generateKey('user_views', userId);
      const viewedProductIds = await this.cacheService.get(viewKey) || [];
      
      if (viewedProductIds.length === 0) {
        return [];
      }

      // Get products for viewed IDs
      const products = await Promise.all(
        viewedProductIds.slice(0, limit).map(id => 
          this.productRepository.findProductById(id)
        )
      );
      
      return products.filter(Boolean); // Remove null products
    } catch (error) {
      logger.error('Error getting user view history:', error);
      return [];
    }
  }
}

module.exports = ProductService;