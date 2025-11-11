const logger = require('../utils/logger');

/**
 * PaymentVerifier Service
 * 
 * Handles payment verification logic independently.
 * Follows Single Responsibility Principle - only responsible for payment verification.
 */
class PaymentVerifier {
  constructor() {
    // Verification statuses
    this.STATUS_SUCCESS = 'SUCCESS';
    this.STATUS_FAILED = 'FAILED';
    this.STATUS_PENDING = 'PENDING';
  }

  /**
   * Verify payment response using gateway
   * @param {Object} paymentResponse - Payment response from gateway
   * @param {IPaymentGateway} gateway - Payment gateway instance
   * @returns {Promise<Object>} Verification result
   */
  async verifyPaymentResponse(paymentResponse, gateway) {
    try {
      if (!paymentResponse) {
        throw new Error('Payment response is required');
      }

      if (!gateway) {
        throw new Error('Payment gateway is required');
      }

      if (typeof gateway.verifyPayment !== 'function') {
        throw new Error('Gateway does not implement verifyPayment method');
      }

      logger.info('Verifying payment response', {
        gateway: gateway.getGatewayName(),
        hasResponse: !!paymentResponse
      });

      // Delegate verification to gateway
      const verificationResult = await gateway.verifyPayment(paymentResponse);

      logger.info('Payment verification completed', {
        gateway: gateway.getGatewayName(),
        success: verificationResult.success,
        verified: verificationResult.verified
      });

      return {
        success: verificationResult.success || false,
        verified: verificationResult.verified || false,
        status: verificationResult.success ? this.STATUS_SUCCESS : this.STATUS_FAILED,
        gateway: verificationResult.gateway || gateway.getGatewayName(),
        transactionId: verificationResult.transactionId || verificationResult.paymentId || null,
        merchantTransactionId: verificationResult.merchantTransactionId || verificationResult.orderId || null,
        amount: verificationResult.amount || null,
        currency: verificationResult.currency || 'INR',
        code: verificationResult.code || null,
        state: verificationResult.state || null,
        message: verificationResult.message || 'Payment verification completed',
        rawResponse: verificationResult
      };

    } catch (error) {
      logger.error('Error verifying payment response', {
        error: error.message,
        stack: error.stack,
        gateway: gateway?.getGatewayName()
      });

      return {
        success: false,
        verified: false,
        status: this.STATUS_FAILED,
        message: `Verification failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Extract payment details from response
   * @param {Object} response - Payment response
   * @param {string} gatewayType - Gateway type ('phonepe', 'razorpay', etc.)
   * @returns {Object} Extracted payment details
   */
  extractPaymentDetails(response, gatewayType) {
    try {
      if (!response) {
        throw new Error('Response is required');
      }

      if (!gatewayType) {
        throw new Error('Gateway type is required');
      }

      let paymentDetails = {
        gateway: gatewayType,
        transactionId: null,
        merchantTransactionId: null,
        amount: null,
        currency: 'INR',
        status: null,
        code: null,
        message: null
      };

      // Gateway-specific extraction
      if (gatewayType === 'phonepe') {
        paymentDetails.merchantTransactionId = response.merchantTransactionId || response.merchant_transaction_id;
        paymentDetails.transactionId = response.transactionId || response.transaction_id;
        paymentDetails.amount = response.amount;
        paymentDetails.code = response.code;
        paymentDetails.status = response.code === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'FAILED';
        paymentDetails.message = response.message || 'Payment processed';
      } else if (gatewayType === 'razorpay') {
        paymentDetails.merchantTransactionId = response.razorpay_order_id;
        paymentDetails.transactionId = response.razorpay_payment_id;
        paymentDetails.amount = response.amount;
        paymentDetails.status = response.status || 'UNKNOWN';
        paymentDetails.message = response.message || 'Payment processed';
      }

      logger.info('Payment details extracted', {
        gateway: gatewayType,
        transactionId: paymentDetails.transactionId,
        merchantTransactionId: paymentDetails.merchantTransactionId
      });

      return paymentDetails;

    } catch (error) {
      logger.error('Error extracting payment details', {
        error: error.message,
        gatewayType
      });

      return {
        gateway: gatewayType,
        error: error.message
      };
    }
  }

  /**
   * Determine order status from payment verification
   * @param {Object} verificationResult - Verification result from gateway
   * @returns {string} Order status ('paid', 'failed', 'pending')
   */
  determineOrderStatus(verificationResult) {
    try {
      if (!verificationResult) {
        return 'pending';
      }

      if (verificationResult.success && verificationResult.verified) {
        return 'paid';
      }

      if (verificationResult.verified && !verificationResult.success) {
        return 'failed';
      }

      // Check gateway-specific status codes
      if (verificationResult.code === 'PAYMENT_SUCCESS') {
        return 'paid';
      }

      if (verificationResult.code === 'PAYMENT_FAILED' || verificationResult.code === 'PAYMENT_ERROR') {
        return 'failed';
      }

      if (verificationResult.status === 'captured' || verificationResult.status === 'SUCCESS') {
        return 'paid';
      }

      if (verificationResult.status === 'failed' || verificationResult.status === 'FAILED') {
        return 'failed';
      }

      return 'pending';
    } catch (error) {
      logger.error('Error determining order status', {
        error: error.message
      });
      return 'pending';
    }
  }

  /**
   * Validate verification result
   * @param {Object} verificationResult - Verification result
   * @returns {Object} Validation result
   */
  validateVerificationResult(verificationResult) {
    try {
      if (!verificationResult) {
        return {
          isValid: false,
          errors: ['Verification result is required']
        };
      }

      const errors = [];

      if (typeof verificationResult.success !== 'boolean') {
        errors.push('Verification result must have a boolean success field');
      }

      if (typeof verificationResult.verified !== 'boolean') {
        errors.push('Verification result must have a boolean verified field');
      }

      if (!verificationResult.gateway) {
        errors.push('Verification result must specify gateway');
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          errors
        };
      }

      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      logger.error('Error validating verification result', {
        error: error.message
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
}

module.exports = PaymentVerifier;

