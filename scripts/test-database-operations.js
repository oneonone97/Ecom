/**
 * Database Operations Testing Script
 * 
 * This script tests CRUD operations for all models to verify database functionality.
 * 
 * Usage:
 * node scripts/test-database-operations.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
const logger = require('../utils/logger');

// Import all models
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { Cart, CartItem } = require('../models/Cart');
const { Order, OrderItem } = require('../models/Order');
const Review = require('../models/Review');
const { Wishlist, WishlistItem } = require('../models/Wishlist');
const RefreshToken = require('../models/RefreshToken');

// Test data storage for cleanup
const testData = {
  users: [],
  categories: [],
  products: [],
  carts: [],
  orders: [],
  reviews: [],
  wishlists: []
};

async function testUserOperations() {
  try {
    console.log('\n1. Testing User operations...');
    
    // Create
    const testUser = await User.create({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      role: 'user'
    });
    testData.users.push(testUser);
    console.log('   ✅ User created:', testUser.id);
    
    // Read
    const foundUser = await User.findByPk(testUser.id);
    if (!foundUser) throw new Error('User not found after creation');
    console.log('   ✅ User read successful');
    
    // Update
    await testUser.update({ name: 'Updated Test User' });
    await testUser.reload();
    if (testUser.name !== 'Updated Test User') throw new Error('User update failed');
    console.log('   ✅ User update successful');
    
    // Password hashing test
    const isPasswordMatch = await testUser.matchPassword('testpassword123');
    if (!isPasswordMatch) throw new Error('Password matching failed');
    console.log('   ✅ Password hashing and matching works');
    
    return testUser;
  } catch (error) {
    console.error('   ❌ User operations failed:', error.message);
    throw error;
  }
}

async function testCategoryOperations() {
  try {
    console.log('\n2. Testing Category operations...');
    
    // Create
    const testCategory = await Category.create({
      name: 'Test Category',
      slug: `test-category-${Date.now()}`,
      description: 'Test category description',
      isActive: true
    });
    testData.categories.push(testCategory);
    console.log('   ✅ Category created:', testCategory.id);
    
    // Read
    const foundCategory = await Category.findByPk(testCategory.id);
    if (!foundCategory) throw new Error('Category not found after creation');
    console.log('   ✅ Category read successful');
    
    // Update
    await testCategory.update({ name: 'Updated Test Category' });
    await testCategory.reload();
    if (testCategory.name !== 'Updated Test Category') throw new Error('Category update failed');
    console.log('   ✅ Category update successful');
    
    return testCategory;
  } catch (error) {
    console.error('   ❌ Category operations failed:', error.message);
    throw error;
  }
}

async function testProductOperations(category) {
  try {
    console.log('\n3. Testing Product operations...');
    
    // Create
    const testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price_paise: 10000, // 100.00 INR
      sale_price_paise: 8000, // 80.00 INR
      categoryId: category.id,
      stock: 10,
      featured: true,
      is_new: true,
      is_sale: true
    });
    testData.products.push(testProduct);
    console.log('   ✅ Product created:', testProduct.id);
    
    // Read with category
    const foundProduct = await Product.findByPk(testProduct.id, {
      include: [{ model: Category, as: 'category' }]
    });
    if (!foundProduct) throw new Error('Product not found after creation');
    if (!foundProduct.category) throw new Error('Product category relationship failed');
    console.log('   ✅ Product read with relationship successful');
    
    // Update
    await testProduct.update({ stock: 20 });
    await testProduct.reload();
    if (testProduct.stock !== 20) throw new Error('Product update failed');
    console.log('   ✅ Product update successful');
    
    return testProduct;
  } catch (error) {
    console.error('   ❌ Product operations failed:', error.message);
    throw error;
  }
}

async function testCartOperations(user, product) {
  try {
    console.log('\n4. Testing Cart operations...');
    
    // Create cart
    const testCart = await Cart.create({
      userId: user.id
    });
    testData.carts.push(testCart);
    console.log('   ✅ Cart created:', testCart.id);
    
    // Create cart item
    const cartItem = await CartItem.create({
      cartId: testCart.id,
      productId: product.id,
      quantity: 2,
      price: 80.00
    });
    console.log('   ✅ CartItem created:', cartItem.id);
    
    // Read cart with items
    const foundCart = await Cart.findByPk(testCart.id, {
      include: [{ model: CartItem, as: 'items' }]
    });
    if (!foundCart) throw new Error('Cart not found');
    if (foundCart.items.length !== 1) throw new Error('Cart items relationship failed');
    console.log('   ✅ Cart read with items successful');
    
    // Update cart item
    await cartItem.update({ quantity: 3 });
    await cartItem.reload();
    if (cartItem.quantity !== 3) throw new Error('CartItem update failed');
    console.log('   ✅ CartItem update successful');
    
    return { cart: testCart, cartItem };
  } catch (error) {
    console.error('   ❌ Cart operations failed:', error.message);
    throw error;
  }
}

async function testOrderOperations(user, product) {
  try {
    console.log('\n5. Testing Order operations...');
    
    // Create order
    const testOrder = await Order.create({
      userId: user.id,
      total_amount_paise: 16000, // 160.00 INR
      currency: 'INR',
      status: 'pending',
      payment_gateway: 'phonepe',
      address_json: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zip: '12345',
        country: 'India'
      }
    });
    testData.orders.push(testOrder);
    console.log('   ✅ Order created:', testOrder.id);
    
    // Create order item
    const orderItem = await OrderItem.create({
      orderId: testOrder.id,
      productId: product.id,
      quantity: 2,
      unit_price_paise: 8000,
      productName: product.name,
      productDescription: product.description
    });
    console.log('   ✅ OrderItem created:', orderItem.id);
    
    // Read order with items
    const foundOrder = await Order.findByPk(testOrder.id, {
      include: [{ model: OrderItem, as: 'items' }]
    });
    if (!foundOrder) throw new Error('Order not found');
    if (foundOrder.items.length !== 1) throw new Error('Order items relationship failed');
    console.log('   ✅ Order read with items successful');
    
    // Test ENUM values
    await testOrder.update({ status: 'paid' });
    await testOrder.reload();
    if (testOrder.status !== 'paid') throw new Error('Order status ENUM update failed');
    console.log('   ✅ Order ENUM (status) update successful');
    
    await testOrder.update({ payment_gateway: 'razorpay' });
    await testOrder.reload();
    if (testOrder.payment_gateway !== 'razorpay') throw new Error('Order payment_gateway ENUM update failed');
    console.log('   ✅ Order ENUM (payment_gateway) update successful');
    
    return { order: testOrder, orderItem };
  } catch (error) {
    console.error('   ❌ Order operations failed:', error.message);
    throw error;
  }
}

async function testReviewOperations(user, product) {
  try {
    console.log('\n6. Testing Review operations...');
    
    // Create review
    const testReview = await Review.create({
      userId: user.id,
      productId: product.id,
      rating: 5,
      title: 'Great Product',
      comment: 'This is a test review comment that meets the minimum length requirement.',
      isVerifiedPurchase: true,
      isApproved: true
    });
    testData.reviews.push(testReview);
    console.log('   ✅ Review created:', testReview.id);
    
    // Read review
    const foundReview = await Review.findByPk(testReview.id);
    if (!foundReview) throw new Error('Review not found after creation');
    console.log('   ✅ Review read successful');
    
    // Update review
    await testReview.update({ rating: 4, helpfulCount: 1 });
    await testReview.reload();
    if (testReview.rating !== 4 || testReview.helpfulCount !== 1) throw new Error('Review update failed');
    console.log('   ✅ Review update successful');
    
    // Test average rating calculation
    const avgRating = await Review.getAverageRating(product.id);
    if (!avgRating || avgRating.averageRating === '0') throw new Error('Average rating calculation failed');
    console.log('   ✅ Review average rating calculation works');
    
    return testReview;
  } catch (error) {
    console.error('   ❌ Review operations failed:', error.message);
    throw error;
  }
}

async function testWishlistOperations(user, product) {
  try {
    console.log('\n7. Testing Wishlist operations...');
    
    // Create wishlist
    const testWishlist = await Wishlist.create({
      userId: user.id,
      name: 'Test Wishlist',
      description: 'Test wishlist description',
      isPublic: false,
      isDefault: true
    });
    testData.wishlists.push(testWishlist);
    console.log('   ✅ Wishlist created:', testWishlist.id);
    
    // Add item to wishlist
    await testWishlist.addItem(product.id, {
      priority: 'high',
      notes: 'Test note'
    });
    console.log('   ✅ WishlistItem added via instance method');
    
    // Read wishlist with items
    const foundWishlist = await Wishlist.findByPk(testWishlist.id, {
      include: [{ model: WishlistItem, as: 'items' }]
    });
    if (!foundWishlist) throw new Error('Wishlist not found');
    if (foundWishlist.items.length !== 1) throw new Error('Wishlist items relationship failed');
    console.log('   ✅ Wishlist read with items successful');
    
    // Test ENUM values
    const wishlistItem = foundWishlist.items[0];
    await wishlistItem.update({ priority: 'low' });
    await wishlistItem.reload();
    if (wishlistItem.priority !== 'low') throw new Error('WishlistItem priority ENUM update failed');
    console.log('   ✅ WishlistItem ENUM (priority) update successful');
    
    // Test wishlist methods
    const itemCount = await testWishlist.getItemCount();
    if (itemCount !== 1) throw new Error('Wishlist getItemCount method failed');
    console.log('   ✅ Wishlist instance methods work');
    
    return { wishlist: testWishlist, wishlistItem };
  } catch (error) {
    console.error('   ❌ Wishlist operations failed:', error.message);
    throw error;
  }
}

async function testRelationships() {
  try {
    console.log('\n8. Testing relationships...');
    
    // Test User -> Orders relationship
    const user = testData.users[0];
    const userOrders = await Order.findAll({ where: { userId: user.id } });
    if (userOrders.length === 0) throw new Error('User-Orders relationship failed');
    console.log('   ✅ User -> Orders relationship works');
    
    // Test Product -> Reviews relationship
    const product = testData.products[0];
    const productReviews = await Review.findAll({ where: { productId: product.id } });
    if (productReviews.length === 0) throw new Error('Product-Reviews relationship failed');
    console.log('   ✅ Product -> Reviews relationship works');
    
    // Test Category -> Products relationship
    const category = testData.categories[0];
    const categoryProducts = await Product.findAll({ where: { categoryId: category.id } });
    if (categoryProducts.length === 0) throw new Error('Category-Products relationship failed');
    console.log('   ✅ Category -> Products relationship works');
    
    console.log('   ✅ All relationships working correctly');
  } catch (error) {
    console.error('   ❌ Relationship tests failed:', error.message);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    console.log('\n9. Cleaning up test data...');
    
    // Delete in reverse order of dependencies
    for (const review of testData.reviews) {
      await review.destroy();
    }
    for (const order of testData.orders) {
      await OrderItem.destroy({ where: { orderId: order.id } });
      await order.destroy();
    }
    for (const wishlist of testData.wishlists) {
      await WishlistItem.destroy({ where: { wishlistId: wishlist.id } });
      await wishlist.destroy();
    }
    for (const cart of testData.carts) {
      await CartItem.destroy({ where: { cartId: cart.id } });
      await cart.destroy();
    }
    for (const product of testData.products) {
      await product.destroy();
    }
    for (const category of testData.categories) {
      await category.destroy();
    }
    for (const user of testData.users) {
      await RefreshToken.destroy({ where: { userId: user.id } });
      await user.destroy();
    }
    
    console.log('   ✅ Test data cleaned up');
  } catch (error) {
    console.error('   ⚠️  Cleanup error (non-critical):', error.message);
  }
}

async function runTests() {
  try {
    console.log('\n🧪 DATABASE OPERATIONS TEST');
    console.log('============================\n');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Run tests in sequence
    const user = await testUserOperations();
    const category = await testCategoryOperations();
    const product = await testProductOperations(category);
    await testCartOperations(user, product);
    await testOrderOperations(user, product);
    await testReviewOperations(user, product);
    await testWishlistOperations(user, product);
    await testRelationships();
    
    // Cleanup
    await cleanupTestData();
    
    console.log('\n✅ ALL DATABASE OPERATIONS TESTS PASSED!\n');
    console.log('📋 Summary:');
    console.log('   - User CRUD: ✅');
    console.log('   - Category CRUD: ✅');
    console.log('   - Product CRUD: ✅');
    console.log('   - Cart CRUD: ✅');
    console.log('   - Order CRUD: ✅');
    console.log('   - Review CRUD: ✅');
    console.log('   - Wishlist CRUD: ✅');
    console.log('   - Relationships: ✅');
    console.log('   - ENUM types: ✅');
    console.log('   - Instance methods: ✅\n');
    
    return true;
  } catch (error) {
    console.error('\n❌ DATABASE OPERATIONS TEST FAILED!\n');
    console.error('Error:', error.message);
    logger.error('Database operations test error:', error);
    
    // Attempt cleanup even on failure
    await cleanupTestData();
    
    return false;
  } finally {
    await sequelize.close();
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = runTests;

