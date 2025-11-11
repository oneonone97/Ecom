const PhonePEGateway = require('./gateways/PhonePEGateway');
const RazorpayGateway = require('./gateways/RazorpayGateway');
const logger = require('../utils/logger');

/**
 * PaymentGatewayFactory
 * 
 * Factory class for creating payment gateway instances.
 * Follows Factory Pattern and Single Responsibility Principle - only responsible for gateway selection.
 * 
 * Uses environment variable PAYMENT_GATEWAY to determine which gateway to use.
 * Defaults to 'phonepe' if not specified.
 */
class PaymentGatewayFactory {
  constructor() {
    this.gateways = new Map();
    this.defaultGateway = process.env.PAYMENT_GATEWAY || 'phonepe';
    
    // Initialize gateways
    this.initializeGateways();
  }

  /**
   * Initialize all available gateways
   */
  initializeGateways() {
    try {
      // Initialize PhonePE Gateway
      const phonepeGateway = new PhonePEGateway();
      this.gateways.set('phonepe', phonepeGateway);
      
      // Initialize Razorpay Gateway
      const razorpayGateway = new RazorpayGateway();
      this.gateways.set('razorpay', razorpayGateway);

      logger.info('Payment gateways initialized', {
        availableGateways: Array.from(this.gateways.keys()),
        defaultGateway: this.defaultGateway
      });
    } catch (error) {
      logger.error('Error initializing payment gateways', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payment gateway instance
   * @param {string} gatewayType - Gateway type ('phonepe', 'razorpay', etc.)
   * @returns {IPaymentGateway} Payment gateway instance
   * @throws {Error} If gateway type is not supported
   */
  getGateway(gatewayType = null) {
    const requestedGateway = gatewayType || this.defaultGateway;
    
    if (!this.gateways.has(requestedGateway)) {
      const availableGateways = Array.from(this.gateways.keys()).join(', ');
      logger.error('Unsupported payment gateway requested', {
        requested: requestedGateway,
        available: availableGateways
      });
      throw new Error(`Unsupported payment gateway: ${requestedGateway}. Available: ${availableGateways}`);
    }

    const gateway = this.gateways.get(requestedGateway);
    
    if (!gateway.isConfigured()) {
      logger.warn('Requested payment gateway is not configured', {
        gateway: requestedGateway
      });
      throw new Error(`Payment gateway '${requestedGateway}' is not configured. Please check environment variables.`);
    }

    logger.info('Payment gateway retrieved', {
      gateway: requestedGateway,
      configured: gateway.isConfigured()
    });

    return gateway;
  }

  /**
   * Get default gateway
   * @returns {IPaymentGateway} Default payment gateway instance
   */
  getDefaultGateway() {
    return this.getGateway(this.defaultGateway);
  }

  /**
   * Get all available gateways
   * @returns {Array<string>} List of available gateway names
   */
  getAvailableGateways() {
    return Array.from(this.gateways.keys());
  }

  /**
   * Check if a gateway is available
   * @param {string} gatewayType - Gateway type
   * @returns {boolean} True if gateway is available
   */
  isGatewayAvailable(gatewayType) {
    return this.gateways.has(gatewayType);
  }

  /**
   * Get gateway configuration status
   * @param {string} gatewayType - Gateway type
   * @returns {boolean} True if gateway is configured
   */
  isGatewayConfigured(gatewayType) {
    if (!this.gateways.has(gatewayType)) {
      return false;
    }
    return this.gateways.get(gatewayType).isConfigured();
  }
}

// Export singleton instance
module.exports = new PaymentGatewayFactory();

