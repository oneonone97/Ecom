const { container, createFactory } = require('./DIContainer');

// Import repositories
// Repositories removed - now using direct database access
// const UserRepository = require('../repositories/UserRepository');
const ProductRepository = require('../repositories/ProductRepository');
// const CartRepository = require('../repositories/CartRepository');
// const OrderRepository = require('../repositories/OrderRepository');

// Import services
// Services - keeping these but they may need updates
const UserService = require('../services/UserService');
const CartService = require('../services/CartService');
const CacheService = require('../services/CacheService');
const ProductService = require('../services/ProductService');
const OrderService = require('../services/OrderService');
const PaymentService = require('../services/PaymentService');
const InventoryService = require('../services/InventoryService');
const NotificationService = require('../services/NotificationService');

// Import new SOLID architecture services
const PhonePEGateway = require('../services/gateways/PhonePEGateway');
const RazorpayGateway = require('../services/gateways/RazorpayGateway');
const PaymentGatewayFactory = require('../services/PaymentGatewayFactory');
const CheckoutService = require('../services/CheckoutService');
const OrderValidator = require('../services/OrderValidator');
const PaymentVerifier = require('../services/PaymentVerifier');

// Import utils
const logger = require('../utils/logger');

// Repositories removed - services now use direct database access
// container.registerSingleton('userRepository', createFactory(UserRepository));
container.registerSingleton('productRepository', createFactory(ProductRepository));
// container.registerSingleton('cartRepository', createFactory(CartRepository));
// container.registerSingleton('orderRepository', createFactory(OrderRepository));

// Register core services
container.registerSingleton('cacheService', createFactory(CacheService));
container.registerSingleton('notificationService', createFactory(NotificationService));
// PaymentService is exported as an instance, not a class
container.registerInstance('paymentService', PaymentService);

// Register payment gateways
container.registerSingleton('phonepeGateway', createFactory(PhonePEGateway));
container.registerSingleton('razorpayGateway', createFactory(RazorpayGateway));

// Register payment gateway factory (already a singleton instance)
container.registerInstance('paymentGatewayFactory', PaymentGatewayFactory);

// Register validation and verification services
container.registerSingleton('orderValidator', createFactory(OrderValidator));
container.registerSingleton('paymentVerifier', createFactory(PaymentVerifier));

// Register business services (repositories removed)
container.registerSingleton('userService', createFactory(UserService), []);
container.registerSingleton('cartService', createFactory(CartService), []);
container.registerSingleton('productService', createFactory(ProductService), ['cacheService', 'productRepository']);
container.registerSingleton('inventoryService', createFactory(InventoryService), ['cacheService', 'notificationService', 'productRepository']);
container.registerSingleton('orderService', createFactory(OrderService), ['cartService', 'paymentService', 'notificationService']);

// Register checkout service with dependencies
container.registerSingleton('checkoutService', createFactory(CheckoutService), [
  'paymentGatewayFactory',
  'orderService',
  'cartService',
  'orderValidator',
  'paymentVerifier'
]);

// Register utilities
container.registerInstance('logger', logger);

// Helper function to get all services
const getServices = () => ({
  // Repositories
  // Repositories removed - using direct database access
  // userRepository: container.resolve('userRepository'),
  // productRepository: container.resolve('productRepository'),
  // cartRepository: container.resolve('cartRepository'),
  // orderRepository: container.resolve('orderRepository'),
  
  // Core services
  cacheService: container.resolve('cacheService'),
  notificationService: container.resolve('notificationService'),
  paymentService: container.resolve('paymentService'),
  
  // Business services
  userService: container.resolve('userService'),
  cartService: container.resolve('cartService'),
  productService: container.resolve('productService'),
  inventoryService: container.resolve('inventoryService'),
  orderService: container.resolve('orderService'),
  
  // Utilities
  logger: container.resolve('logger')
});

// Validation function to ensure all services are properly registered
const validateContainer = () => {
  const requiredServices = [
    // Core services
    'cacheService',
    'notificationService',
    'paymentService',

    // Payment gateways
    'phonepeGateway',
    'razorpayGateway',
    'paymentGatewayFactory',

    // Validation and verification
    'orderValidator',
    'paymentVerifier',

    // Business services
    'userService',
    'cartService',
    'productService',
    'inventoryService',
    'orderService',
    'checkoutService',

    // Utilities
    'logger'
  ];

  const missing = requiredServices.filter(service => !container.has(service));
  
  if (missing.length > 0) {
    throw new Error(`Missing required services: ${missing.join(', ')}`);
  }

  return true;
};

// Initialize container with error handling
const initializeContainer = () => {
  try {
    validateContainer();
    console.log('✅ Dependency injection container initialized successfully');
    console.log(`📦 Registered services: ${container.getRegisteredServices().join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize dependency injection container:', error.message);
    throw error;
  }
};

module.exports = {
  container,
  getServices,
  validateContainer,
  initializeContainer
};