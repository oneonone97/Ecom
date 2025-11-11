const BaseRepository = require('./BaseRepository');
const Product = require('../models/Product');
const { Op, fn, col } = require('sequelize');
const { getImageGallery } = require('../utils/imageUtils');

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }
  async findProductsWithPagination(page = 1, limit = 10, filters = {}) {
    try {
      const whereCondition = {};
      
      if (filters.category) {
        // Handle category filtering - can be ID, name, or slug
        const Category = require('../models/Category');
        let categoryId = filters.category;
        
        // If category is not a number, try to find by name or slug
        if (isNaN(categoryId)) {
          const category = await Category.findOne({
            where: {
              [Op.or]: [
                { name: categoryId },
                { slug: categoryId }
              ]
            },
            attributes: ['id']
          });
          
          if (category) {
            categoryId = category.id;
          } else {
            // If category not found, return empty results
            return { count: 0, rows: [] };
          }
        }
        
        whereCondition.categoryId = categoryId;
      }
      
      if (filters.search) {
        whereCondition[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      if (filters.minPrice) {
        whereCondition.price_paise = { [Op.gte]: filters.minPrice * 100 };
      }
      
      if (filters.maxPrice) {
        if (whereCondition.price_paise) {
          whereCondition.price_paise[Op.lte] = filters.maxPrice * 100;
        } else {
          whereCondition.price_paise = { [Op.lte]: filters.maxPrice * 100 };
        }
      }
      
      if (filters.inStock === 'true') {
        whereCondition.stock = { [Op.gt]: 0 };
      }
      
      if (filters.is_new === 'true') {
        whereCondition.is_new = true;
      }
      
      if (filters.is_sale === 'true') {
        whereCondition.is_sale = true;
      }
      
      if (filters.excludeId) {
        whereCondition.id = { [Op.ne]: filters.excludeId };
      }

      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'DESC';

      return await this.findAndCountAll(whereCondition, {
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        include: [{
          model: require('../models/Category'),
          as: 'category',
          attributes: ['id', 'name', 'slug', 'description', 'image']
        }]
      });
    } catch (error) {
      throw new Error(`Error finding products with pagination: ${error.message}`);
    }
  }

  async createProduct(productData) {
    try {
      return await this.create(productData);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Product with this name already exists');
      }
      throw new Error(`Error creating product: ${error.message}`);
    }
  }

  async updateProduct(productId, updateData) {
    try {
      const result = await this.update({ id: productId }, updateData);
      if (result.updatedRowsCount === 0) {
        throw new Error('Product not found');
      }
      return await this.findById(productId);
    } catch (error) {
      throw new Error(`Error updating product: ${error.message}`);
    }
  }

  async deleteProduct(productId) {
    try {
      const deletedCount = await this.delete({ id: productId });
      if (deletedCount === 0) {
        throw new Error('Product not found');
      }
      return true;
    } catch (error) {
      throw new Error(`Error deleting product: ${error.message}`);
    }
  }

  async updateStock(productId, quantity, operation = 'decrease') {
    try {
      return await this.executeInTransaction(async (transaction) => {
        const product = await this.findById(productId, { transaction });
        
        if (!product) {
          throw new Error('Product not found');
        }

        let newStock;
        if (operation === 'decrease') {
          if (product.stock < quantity) {
            throw new Error('Insufficient stock');
          }
          newStock = product.stock - quantity;
        } else if (operation === 'increase') {
          newStock = product.stock + quantity;
        } else {
          throw new Error('Invalid operation. Use "increase" or "decrease"');
        }

        await this.update(
          { id: productId },
          { stock: newStock },
          { transaction }
        );

        return await this.findById(productId, { transaction });
      });
    } catch (error) {
      throw new Error(`Error updating stock: ${error.message}`);
    }
  }

  async findLowStockProducts(threshold = 10) {
    try {
      return await this.findAll(
        { stock: { [Op.lte]: threshold } },
        { order: [['stock', 'ASC']] }
      );
    } catch (error) {
      throw new Error(`Error finding low stock products: ${error.message}`);
    }
  }

  async findOutOfStockProducts() {
    try {
      return await this.findAll(
        { stock: 0 },
        { order: [['updatedAt', 'DESC']] }
      );
    } catch (error) {
      throw new Error(`Error finding out of stock products: ${error.message}`);
    }
  }

  async getProductCategories() {
    try {
      const Category = require('../models/Category');
      
      // Get distinct category IDs from products
      const products = await this.model.findAll({
        attributes: ['categoryId'],
        group: ['categoryId'],
        raw: true
      });
      
      const categoryIds = products.map(p => p.categoryId).filter(Boolean);
      
      // Get the actual category details
      const categories = await Category.findAll({
        where: { id: { [Op.in]: categoryIds } },
        attributes: ['id', 'name', 'slug', 'description', 'image'],
        order: [['name', 'ASC']]
      });
      
      return categories;
    } catch (error) {
      throw new Error(`Error getting product categories: ${error.message}`);
    }
  }

  // Alias for CacheService compatibility
  async getCategories() {
    return await this.getProductCategories();
  }

  /**
   * Enrich product(s) with image galleries from folders
   * @param {Object|Array} product(s) - Single product or array of products
   * @returns {Object|Array} Product(s) with image_gallery field added
   */
  enrichWithImageGallery(products) {
    if (Array.isArray(products)) {
      return products.map(product => {
        const productData = product.toJSON ? product.toJSON() : product;
        const imageGallery = getImageGallery(productData.image_url);
        return {
          ...productData,
          image_gallery: imageGallery.gallery,
          images: imageGallery // For frontend compatibility
        };
      });
    } else {
      const productData = products.toJSON ? products.toJSON() : products;
      const imageGallery = getImageGallery(productData.image_url);
      return {
        ...productData,
        image_gallery: imageGallery.gallery,
        images: imageGallery // For frontend compatibility
      };
    }
  }

  async findProductsByIds(productIds) {
    try {
      return await this.findAll({
        id: { [Op.in]: productIds }
      });
    } catch (error) {
      throw new Error(`Error finding products by IDs: ${error.message}`);
    }
  }

  async getProductStats() {
    try {
      const totalProducts = await this.count();
      const inStockProducts = await this.count({ stock: { [Op.gt]: 0 } });
      const outOfStockProducts = await this.count({ stock: 0 });
      const categories = await this.getProductCategories();

      return {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        totalCategories: categories.length,
        categories
      };
    } catch (error) {
      throw new Error(`Error getting product stats: ${error.message}`);
    }
  }
}

module.exports = ProductRepository;
