const { container } = require('../../container/serviceRegistration');
const ProductService = require('../../services/ProductService');

describe('ProductService', () => {
  let productService;
  let productRepository;
  let cacheService;

  beforeAll(() => {
    productRepository = container.resolve('productRepository');
    cacheService = container.resolve('cacheService');
    productService = new ProductService(productRepository, cacheService);
  });

  beforeEach(async () => {
    await global.testHelpers.clearDatabase();
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const productData = {
        name: 'Test Product',
        description: 'A test product',
        price: 99.99,
        category: 'Electronics',
        stock: 50
      };

      const result = await productService.createProduct(productData);

      expect(result).toBeDefined();
      expect(result.name).toBe(productData.name);
      expect(result.price).toBe('99.99');
      expect(result.stock).toBe(50);
    });

    it('should throw error for duplicate product name in same category', async () => {
      const productData = {
        name: 'Test Product',
        description: 'A test product',
        price: 99.99,
        category: 'Electronics',
        stock: 50
      };

      // Create first product
      await productService.createProduct(productData);

      // Try to create duplicate
      await expect(productService.createProduct(productData))
        .rejects
        .toThrow('already exists');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Test Product'
        // Missing required fields
      };

      await expect(productService.createProduct(invalidData))
        .rejects
        .toThrow('Missing required fields');
    });

    it('should validate price is positive', async () => {
      const invalidData = {
        name: 'Test Product',
        description: 'A test product',
        price: -10,
        category: 'Electronics',
        stock: 50
      };

      await expect(productService.createProduct(invalidData))
        .rejects
        .toThrow('Price must be greater than 0');
    });
  });

  describe('updateProduct', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct();
    });

    it('should update product successfully', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 149.99
      };

      const result = await productService.updateProduct(product.id, updateData);

      expect(result.name).toBe('Updated Product');
      expect(parseFloat(result.price)).toBe(149.99);
    });

    it('should throw error when product not found', async () => {
      await expect(productService.updateProduct(999, { name: 'Test' }))
        .rejects
        .toThrow('Product not found');
    });

    it('should validate price when updating', async () => {
      await expect(productService.updateProduct(product.id, { price: -10 }))
        .rejects
        .toThrow('Price must be greater than 0');
    });
  });

  describe('deleteProduct', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct();
    });

    it('should delete product successfully', async () => {
      const result = await productService.deleteProduct(product.id);

      expect(result.message).toBe('Product deleted successfully');
    });

    it('should throw error when product not found', async () => {
      await expect(productService.deleteProduct(999))
        .rejects
        .toThrow('Product not found');
    });
  });

  describe('searchProducts', () => {
    beforeEach(async () => {
      await global.testHelpers.createTestProduct({
        name: 'iPhone 13',
        description: 'Apple smartphone',
        category: 'Smartphones'
      });
      await global.testHelpers.createTestProduct({
        name: 'Samsung Galaxy',
        description: 'Android smartphone',
        category: 'Smartphones'
      });
      await global.testHelpers.createTestProduct({
        name: 'MacBook Pro',
        description: 'Apple laptop',
        category: 'Laptops'
      });
    });

    it('should search products by name', async () => {
      const result = await productService.searchProducts('iPhone');

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('iPhone 13');
    });

    it('should search products by description', async () => {
      const result = await productService.searchProducts('Apple');

      expect(result.products).toHaveLength(2);
    });

    it('should return empty results for no matches', async () => {
      const result = await productService.searchProducts('nonexistent');

      expect(result.products).toHaveLength(0);
    });
  });

  describe('updateStock', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct({ stock: 100 });
    });

    it('should update stock successfully', async () => {
      const result = await productService.updateStock(product.id, 50, 'manual_adjustment');

      expect(result.product.stock).toBe(50);
      expect(result.stockMovement.oldStock).toBe(100);
      expect(result.stockMovement.newStock).toBe(50);
      expect(result.stockMovement.difference).toBe(-50);
    });

    it('should throw error when product not found', async () => {
      await expect(productService.updateStock(999, 50))
        .rejects
        .toThrow('Product not found');
    });
  });

  describe('getFeaturedProducts', () => {
    beforeEach(async () => {
      await global.testHelpers.createTestProduct({ featured: true });
      await global.testHelpers.createTestProduct({ featured: true });
      await global.testHelpers.createTestProduct({ featured: false });
    });

    it('should return only featured products', async () => {
      const result = await productService.getFeaturedProducts(10);

      expect(result).toHaveLength(2);
      result.forEach(product => {
        expect(product.featured).toBe(true);
      });
    });

    it('should respect limit parameter', async () => {
      const result = await productService.getFeaturedProducts(1);

      expect(result).toHaveLength(1);
    });
  });
});