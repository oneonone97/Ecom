const logger = require('../utils/logger');

/**
 * OrderValidator Service
 * 
 * Handles all order validation logic independently.
 * Follows Single Responsibility Principle - only responsible for validation.
 */
class OrderValidator {
  constructor() {
    // Validation rules
    this.minQuantity = 1;
    this.maxQuantity = 1000;
    this.requiredAddressFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode'];
  }

  /**
   * Validate cart items
   * @param {Array} cartItems - Cart items to validate
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateCartItems(cartItems) {
    try {
      if (!cartItems || !Array.isArray(cartItems)) {
        return {
          isValid: false,
          errors: ['Cart items must be an array'],
          reason: 'INVALID_CART_FORMAT'
        };
      }

      if (cartItems.length === 0) {
        return {
          isValid: false,
          errors: ['Cart is empty'],
          reason: 'EMPTY_CART'
        };
      }

      const errors = [];

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        
        // Validate required fields
        if (!item.productId) {
          errors.push(`Item ${i + 1}: Product ID is required`);
        }

        if (!item.quantity || item.quantity < this.minQuantity) {
          errors.push(`Item ${i + 1}: Quantity must be at least ${this.minQuantity}`);
        }

        if (item.quantity > this.maxQuantity) {
          errors.push(`Item ${i + 1}: Quantity cannot exceed ${this.maxQuantity}`);
        }

        if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity)) {
          errors.push(`Item ${i + 1}: Quantity must be an integer`);
        }
      }

      if (errors.length > 0) {
        logger.warn('Cart items validation failed', {
          errors,
          itemCount: cartItems.length
        });

        return {
          isValid: false,
          errors,
          reason: 'INVALID_CART_ITEMS'
        };
      }

      logger.info('Cart items validated successfully', {
        itemCount: cartItems.length
      });

      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      logger.error('Error validating cart items', {
        error: error.message,
        stack: error.stack
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        reason: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate shipping address
   * @param {Object} address - Shipping address object
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateShippingAddress(address) {
    try {
      if (!address || typeof address !== 'object') {
        return {
          isValid: false,
          errors: ['Address is required and must be an object'],
          reason: 'INVALID_ADDRESS_FORMAT'
        };
      }

      const errors = [];
      const missingFields = [];

      // Check required fields
      for (const field of this.requiredAddressFields) {
        if (!address[field] || (typeof address[field] === 'string' && address[field].trim() === '')) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        errors.push(`Missing required address fields: ${missingFields.join(', ')}`);
      }

      // Validate email format
      if (address.email && !this.isValidEmail(address.email)) {
        errors.push('Invalid email format');
      }

      // Validate phone format (Indian phone numbers)
      if (address.phone && !this.isValidPhone(address.phone)) {
        errors.push('Invalid phone number format. Must be 10 digits');
      }

      // Validate pincode (Indian pincodes are 6 digits)
      if (address.pincode && !this.isValidPincode(address.pincode)) {
        errors.push('Invalid pincode format. Must be 6 digits');
      }

      // Validate name length
      if (address.name && address.name.length < 2) {
        errors.push('Name must be at least 2 characters long');
      }

      if (address.name && address.name.length > 100) {
        errors.push('Name cannot exceed 100 characters');
      }

      if (errors.length > 0) {
        logger.warn('Shipping address validation failed', {
          errors,
          addressFields: Object.keys(address)
        });

        return {
          isValid: false,
          errors,
          reason: 'INVALID_ADDRESS'
        };
      }

      logger.info('Shipping address validated successfully');

      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      logger.error('Error validating shipping address', {
        error: error.message,
        stack: error.stack
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        reason: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate stock availability
   * @param {Array} items - Items with productId and quantity
   * @param {Function} getProductStock - Function to get product stock by ID
   * @returns {Promise<Object>} Validation result with isValid flag and errors array
   */
  async validateStockAvailability(items, getProductStock) {
    try {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return {
          isValid: false,
          errors: ['Items array is required'],
          reason: 'INVALID_ITEMS'
        };
      }

      if (!getProductStock || typeof getProductStock !== 'function') {
        return {
          isValid: false,
          errors: ['Product stock checker function is required'],
          reason: 'INVALID_STOCK_CHECKER'
        };
      }

      const errors = [];
      const stockChecks = [];

      for (const item of items) {
        if (!item.productId) {
          errors.push('Product ID is required for stock validation');
          continue;
        }

        try {
          const stock = await getProductStock(item.productId);
          
          if (stock === null || stock === undefined) {
            errors.push(`Product ${item.productId}: Stock information not available`);
            continue;
          }

          if (stock < item.quantity) {
            errors.push(`Product ${item.productId}: Insufficient stock. Available: ${stock}, Requested: ${item.quantity}`);
          }

          stockChecks.push({
            productId: item.productId,
            requested: item.quantity,
            available: stock,
            sufficient: stock >= item.quantity
          });
        } catch (error) {
          logger.error('Error checking stock for product', {
            productId: item.productId,
            error: error.message
          });
          errors.push(`Product ${item.productId}: Error checking stock - ${error.message}`);
        }
      }

      if (errors.length > 0) {
        logger.warn('Stock availability validation failed', {
          errors,
          stockChecks
        });

        return {
          isValid: false,
          errors,
          reason: 'INSUFFICIENT_STOCK',
          stockChecks
        };
      }

      logger.info('Stock availability validated successfully', {
        itemCount: items.length,
        stockChecks
      });

      return {
        isValid: true,
        errors: [],
        stockChecks
      };

    } catch (error) {
      logger.error('Error validating stock availability', {
        error: error.message,
        stack: error.stack
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        reason: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate payment data
   * @param {Object} paymentData - Payment data to validate
   * @param {string} gatewayType - Payment gateway type
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validatePaymentData(paymentData, gatewayType = 'phonepe') {
    try {
      if (!paymentData || typeof paymentData !== 'object') {
        return {
          isValid: false,
          errors: ['Payment data is required'],
          reason: 'INVALID_PAYMENT_DATA'
        };
      }

      const errors = [];

      // Gateway-specific validation
      if (gatewayType === 'phonepe') {
        if (!paymentData.merchantTransactionId) {
          errors.push('Merchant transaction ID is required for PhonePE');
        }

        if (!paymentData.response) {
          errors.push('Payment response is required for PhonePE');
        }

        if (!paymentData.xVerify) {
          errors.push('X-VERIFY signature is required for PhonePE');
        }
      } else if (gatewayType === 'razorpay') {
        if (!paymentData.razorpay_order_id) {
          errors.push('Razorpay order ID is required');
        }

        if (!paymentData.razorpay_payment_id) {
          errors.push('Razorpay payment ID is required');
        }

        if (!paymentData.razorpay_signature) {
          errors.push('Razorpay signature is required');
        }
      }

      if (errors.length > 0) {
        logger.warn('Payment data validation failed', {
          errors,
          gatewayType
        });

        return {
          isValid: false,
          errors,
          reason: 'INVALID_PAYMENT_DATA'
        };
      }

      logger.info('Payment data validated successfully', {
        gatewayType
      });

      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      logger.error('Error validating payment data', {
        error: error.message,
        stack: error.stack
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        reason: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (Indian)
   * @param {string} phone - Phone number
   * @returns {boolean} True if valid
   */
  isValidPhone(phone) {
    // Remove spaces and special characters
    const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
    // Indian phone numbers: 10 digits, optionally starting with +91
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    return phoneRegex.test(cleanedPhone);
  }

  /**
   * Validate pincode format (Indian)
   * @param {string} pincode - Pincode
   * @returns {boolean} True if valid
   */
  isValidPincode(pincode) {
    // Indian pincodes are 6 digits
    const pincodeRegex = /^\d{6}$/;
    return pincodeRegex.test(pincode);
  }
}

module.exports = OrderValidator;

