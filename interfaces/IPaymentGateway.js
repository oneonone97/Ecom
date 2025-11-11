/**
 * IPaymentGateway Interface
 * 
 * Defines the contract for all payment gateway implementations.
 * Follows Interface Segregation Principle (ISP) - focused on essential payment operations.
 * 
 * All payment gateway implementations must implement this interface to ensure
 * Liskov Substitution Principle (LSP) - any gateway can replace another.
 */

class IPaymentGateway {
  /**
   * Create a payment request/session
   * @param {Object} orderData - Order data including amount, currency, orderId, etc.
   * @returns {Promise<Object>} Payment request response with payment URL and transaction ID
   * @throws {Error} If payment request creation fails
   */
  async createPaymentRequest(orderData) {
    throw new Error('createPaymentRequest must be implemented by payment gateway');
  }

  /**
   * Verify payment response/callback
   * @param {Object} paymentData - Payment response data from gateway
   * @returns {Promise<Object>} Verification result with payment status and details
   * @throws {Error} If payment verification fails
   */
  async verifyPayment(paymentData) {
    throw new Error('verifyPayment must be implemented by payment gateway');
  }

  /**
   * Check payment status
   * @param {string} transactionId - Transaction ID to check
   * @returns {Promise<Object>} Payment status information
   * @throws {Error} If status check fails
   */
  async checkPaymentStatus(transactionId) {
    throw new Error('checkPaymentStatus must be implemented by payment gateway');
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Webhook payload (stringified JSON)
   * @param {string} signature - Webhook signature from headers
   * @returns {boolean} True if signature is valid, false otherwise
   */
  verifyWebhookSignature(payload, signature) {
    throw new Error('verifyWebhookSignature must be implemented by payment gateway');
  }

  /**
   * Check if gateway is properly configured
   * @returns {boolean} True if configured, false otherwise
   */
  isConfigured() {
    throw new Error('isConfigured must be implemented by payment gateway');
  }

  /**
   * Get frontend configuration for payment gateway
   * @returns {Object|null} Frontend configuration or null if not configured
   */
  getFrontendConfig() {
    throw new Error('getFrontendConfig must be implemented by payment gateway');
  }

  /**
   * Get gateway name/type
   * @returns {string} Gateway name (e.g., 'phonepe', 'razorpay', 'stripe')
   */
  getGatewayName() {
    throw new Error('getGatewayName must be implemented by payment gateway');
  }

  /**
   * Initiate refund (optional - not all gateways support this)
   * @param {Object} refundData - Refund data including original transaction ID, refund ID, and amount
   * @returns {Promise<Object>} Refund initiation result
   * @throws {Error} If refund initiation fails or method not supported
   */
  async initiateRefund(refundData) {
    throw new Error('initiateRefund is not supported by this payment gateway');
  }
}

module.exports = IPaymentGateway;

