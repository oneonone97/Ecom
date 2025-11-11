const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email Service for sending transactional emails
 * Supports order confirmations, password resets, welcome emails, etc.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    try {
      if (process.env.NODE_ENV === 'production') {
        // Production SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
      } else {
        // Development - use Ethereal email (test account)
        this.createTestAccount();
      }
      
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Create test email account for development
   */
  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      logger.info('Development email account created:', {
        user: testAccount.user,
        viewUrl: 'https://ethereal.email/messages'
      });
    } catch (error) {
      logger.error('Failed to create test email account:', error);
    }
  }

  /**
   * Send email helper method
   */
  async sendEmail({ to, subject, text, html }) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized, skipping email');
        return null;
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'MyShop <noreply@myshop.com>',
        to,
        subject,
        text,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully:', {
        to,
        subject,
        messageId: info.messageId
      });

      // Log preview URL for development
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return info;
    } catch (error) {
      logger.error('Error sending email:', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to MyShop!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MyShop!</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name}!</h2>
            <p>Thank you for joining MyShop. We're excited to have you as a customer!</p>
            <p>Start shopping now and discover amazing products at great prices.</p>
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" class="button">Start Shopping</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2025 MyShop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to MyShop, ${user.name}! Thank you for joining us.`;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(order, user) {
    const subject = `Order Confirmation #${order.id}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .order-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .item { border-bottom: 1px solid #ddd; padding: 10px 0; }
          .total { font-size: 18px; font-weight: bold; color: #4CAF50; margin-top: 15px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you for your order, ${user.name}!</h2>
            <p>Your order has been confirmed and will be shipped soon.</p>
            <div class="order-details">
              <h3>Order #${order.id}</h3>
              <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
              ${order.items ? order.items.map(item => `
                <div class="item">
                  <strong>${item.productName}</strong> x ${item.quantity}
                  <span style="float: right;">$${parseFloat(item.price).toFixed(2)}</span>
                </div>
              `).join('') : ''}
              <p class="total">Total: $${parseFloat(order.totalAmount).toFixed(2)}</p>
            </div>
            <h3>Shipping Address</h3>
            <p>
              ${order.shippingAddress?.address || ''}<br>
              ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}<br>
              ${order.shippingAddress?.country || ''}
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact us at support@myshop.com</p>
            <p>&copy; 2025 MyShop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Thank you for your order #${order.id}! Total: $${order.totalAmount}`;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdate(order, user, oldStatus) {
    const subject = `Order #${order.id} - Status Updated`;
    const statusMessages = {
      processing: 'Your order is now being processed.',
      shipped: 'Your order has been shipped!',
      delivered: 'Your order has been delivered.',
      cancelled: 'Your order has been cancelled.'
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Status Update</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name}!</h2>
            <p>Your order #${order.id} status has been updated.</p>
            <p><strong>New Status:</strong> ${order.status.toUpperCase()}</p>
            <p>${statusMessages[order.status] || 'Your order status has been updated.'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 MyShop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Order #${order.id} status updated to: ${order.status}`;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name}!</h2>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 MyShop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Reset your password using this link: ${resetUrl}`;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send price drop notification for wishlist items
   */
  async sendPriceDropNotification(user, product, oldPrice, newPrice) {
    const discount = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
    const subject = `Price Drop Alert: ${product.name}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .product { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .price { font-size: 24px; font-weight: bold; color: #FF9800; }
          .old-price { text-decoration: line-through; color: #999; }
          .button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔥 Price Drop Alert!</h1>
          </div>
          <div class="content">
            <h2>Great news, ${user.name}!</h2>
            <p>A product in your wishlist just got cheaper!</p>
            <div class="product">
              <h3>${product.name}</h3>
              <p>${product.description}</p>
              <p class="old-price">Was: $${parseFloat(oldPrice).toFixed(2)}</p>
              <p class="price">Now: $${parseFloat(newPrice).toFixed(2)}</p>
              <p><strong>Save ${discount}%!</strong></p>
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products/${product.id}" class="button">View Product</a>
              </p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2025 MyShop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Price drop on ${product.name}! Now $${newPrice} (was $${oldPrice})`;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }
}

// Export singleton instance
module.exports = new EmailService();

