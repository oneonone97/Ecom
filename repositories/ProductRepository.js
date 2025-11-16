const db = require('../utils/database');
const logger = require('../utils/logger');
const { getImageGallery } = require('../utils/imageUtils');

/**
 * ProductRepository
 * Provides product data access methods using the database abstraction layer
 */
class ProductRepository {
  /**
   * Find products with pagination and filters
   */
  async findProductsWithPagination(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = {};
      const orderBy = [];

      // Build where conditions
      if (filters.category) {
        conditions.categoryId = filters.category;
      }
      
      if (filters.is_new === 'true' || filters.is_new === true) {
        conditions.is_new = true;
      }
      
      if (filters.is_sale === 'true' || filters.is_sale === true) {
        conditions.is_sale = true;
      }

      // Price filters - will filter after query
      const priceFilters = {};
      if (filters.minPrice) {
        priceFilters.minPrice = parseFloat(filters.minPrice);
      }
      if (filters.maxPrice) {
        priceFilters.maxPrice = parseFloat(filters.maxPrice);
      }

      // Stock filter - will filter after query (Supabase doesn't support > operator directly)
      const stockFilter = filters.inStock === 'true' || filters.inStock === true;

      // Build order by
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = (filters.sortOrder || 'DESC').toUpperCase();
      orderBy.push([sortBy, sortOrder]);

      // Get products - get more than needed to account for filtering
      const fetchLimit = stockFilter || priceFilters.minPrice || priceFilters.maxPrice ? limit * 3 : limit;
      
      let products;
      if (Object.keys(conditions).length > 0) {
        products = await db.products.findAll({
          where: conditions,
          order: orderBy,
          limit: fetchLimit,
          offset
        });
      } else {
        products = await db.products.findAll({
          order: orderBy,
          limit: fetchLimit,
          offset
        });
      }

      // Apply stock filter if needed
      let filteredProducts = products;
      if (stockFilter) {
        filteredProducts = filteredProducts.filter(product => (product.stock || 0) > 0);
      }

      // Apply price filters if needed
      if (priceFilters.minPrice || priceFilters.maxPrice) {
        filteredProducts = filteredProducts.filter(product => {
          const price = product.price_paise / 100; // Convert paise to rupees
          if (priceFilters.minPrice && price < priceFilters.minPrice) return false;
          if (priceFilters.maxPrice && price > priceFilters.maxPrice) return false;
          return true;
        });
      }

      // Apply pagination after filtering
      filteredProducts = filteredProducts.slice(0, limit);

      // Get total count (approximate - for better performance, count should be done with same filters)
      const count = await db.products.count(conditions);

      return {
        rows: filteredProducts,
        count: filteredProducts.length, // Use filtered count
        totalCount: count
      };
    } catch (error) {
      logger.error('Error in findProductsWithPagination:', error);
      throw error;
    }
  }

  /**
   * Find product by ID
   */
  async findById(productId) {
    try {
      const product = await db.products.findByPk(productId);
      return product;
    } catch (error) {
      logger.error('Error in findById:', error);
      throw error;
    }
  }

  /**
   * Search products
   */
  async searchProducts(searchTerm, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;
      
      // Get all products and filter by search term
      // Note: For better performance, this should use full-text search
      const allProducts = await db.products.findAll({
        limit: 1000 // Get more products for search
      });

      // Filter by search term (name, description, SKU)
      const searchLower = searchTerm.toLowerCase();
      const filtered = allProducts.filter(product => {
        const name = (product.name || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        
        return name.includes(searchLower) || 
               description.includes(searchLower) || 
               sku.includes(searchLower);
      });

      // Apply pagination
      const paginated = filtered.slice(offset, offset + limit);

      return {
        rows: paginated,
        count: filtered.length
      };
    } catch (error) {
      logger.error('Error in searchProducts:', error);
      throw error;
    }
  }

  /**
   * Get new products
   */
  async getNewProducts(limit = 8) {
    try {
      const products = await db.products.findAll({
        where: { is_new: true },
        order: [['createdAt', 'DESC']],
        limit
      });
      return products;
    } catch (error) {
      logger.error('Error in getNewProducts:', error);
      throw error;
    }
  }

  /**
   * Get sale products
   */
  async getSaleProducts(limit = 8) {
    try {
      const products = await db.products.findAll({
        where: { is_sale: true },
        order: [['createdAt', 'DESC']],
        limit
      });
      return products;
    } catch (error) {
      logger.error('Error in getSaleProducts:', error);
      throw error;
    }
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit = 8) {
    try {
      const products = await db.products.findAll({
        where: { featured: true },
        order: [['createdAt', 'DESC']],
        limit
      });
      return products;
    } catch (error) {
      logger.error('Error in getFeaturedProducts:', error);
      throw error;
    }
  }

  /**
   * Find product by ID (alias for findById)
   */
  async findProductById(productId) {
    return this.findById(productId);
  }

  /**
   * Update product
   */
  async updateProduct(productId, data) {
    try {
      const product = await db.products.update(productId, data);
      return product;
    } catch (error) {
      logger.error('Error in updateProduct:', error);
      throw error;
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    try {
      await db.products.destroy(productId);
      return true;
    } catch (error) {
      logger.error('Error in deleteProduct:', error);
      throw error;
    }
  }

  /**
   * Enrich products with image gallery
   */
  enrichWithImageGallery(products) {
    if (!products) return null;
    
    try {
      if (Array.isArray(products)) {
        return products.map(product => {
          try {
            const gallery = getImageGallery(product);
            return {
              ...product,
              image_gallery: gallery?.gallery || [],
              images: gallery || {}
            };
          } catch (error) {
            logger.warn(`Error enriching product ${product.id} with images:`, error.message);
            return {
              ...product,
              image_gallery: [],
              images: {}
            };
          }
        });
      } else {
        try {
          const gallery = getImageGallery(products);
          return {
            ...products,
            image_gallery: gallery?.gallery || [],
            images: gallery || {}
          };
        } catch (error) {
          logger.warn(`Error enriching product ${products.id} with images:`, error.message);
          return {
            ...products,
            image_gallery: [],
            images: {}
          };
        }
      }
    } catch (error) {
      logger.error('Error in enrichWithImageGallery:', error);
      // Return products without enrichment if gallery fails
      return products;
    }
  }
}

module.exports = ProductRepository;
