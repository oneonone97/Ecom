const logger = require('../utils/logger');
const BaseService = require('./BaseService');

class NotificationService extends BaseService {
  constructor() {
    super();
    this.emailService = null;
    this.smsService = null;
    this.pushNotificationService = null;
    
    // Initialize notification providers
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize email service (using nodemailer as example)
    this.initializeEmailService();
    
    // Initialize SMS service (could use Twilio, AWS SNS, etc.)
    this.initializeSMSService();
    
    // Initialize push notifications (could use Firebase, OneSignal, etc.)
    this.initializePushNotificationService();
  }

  initializeEmailService() {
    try {
      const nodemailer = require('nodemailer');
      
      // Configure based on environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      if (emailConfig.auth.user && emailConfig.auth.pass) {
        this.emailService = nodemailer.createTransporter(emailConfig);
        logger.info('Email service initialized successfully');
      } else {
        logger.warn('Email credentials not provided. Email notifications disabled.');
      }
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  initializeSMSService() {
    try {
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (twilioAccountSid && twilioAuthToken) {
        const twilio = require('twilio');
        this.smsService = twilio(twilioAccountSid, twilioAuthToken);
        logger.info('SMS service (Twilio) initialized successfully');
      } else {
        logger.warn('Twilio credentials not provided. SMS notifications disabled.');
      }
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
    }
  }

  initializePushNotificationService() {
    try {
      const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (firebaseServiceAccount) {
        const admin = require('firebase-admin');
        const serviceAccount = JSON.parse(firebaseServiceAccount);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        
        this.pushNotificationService = admin.messaging();
        logger.info('Push notification service (Firebase) initialized successfully');
      } else {
        logger.warn('Firebase credentials not provided. Push notifications disabled.');
      }
    } catch (error) {
      logger.error('Failed to initialize push notification service:', error);
    }
  }

  // Order-related notifications
  async sendOrderConfirmation(order) {
    try {
      const emailContent = this.generateOrderConfirmationEmail(order);
      
      if (this.emailService && order.userEmail) {
        await this.sendEmail({
          to: order.userEmail,
          subject: `Order Confirmation - Order #${order.id}`,
          html: emailContent.html,
          text: emailContent.text
        });
      }

      // Send push notification if user has enabled it
      if (this.pushNotificationService && order.userId) {
        await this.sendPushNotification(order.userId, {
          title: 'Order Confirmed!',
          body: `Your order #${order.id} has been confirmed.`,
          data: {
            type: 'order_confirmation',
            orderId: order.id.toString()
          }
        });
      }

      logger.info('Order confirmation sent', {
        orderId: order.id,
        userId: order.userId,
        email: order.userEmail
      });
    } catch (error) {
      logger.error('Failed to send order confirmation:', error);
      throw error;
    }
  }

  async sendOrderStatusUpdate(order) {
    try {
      const emailContent = this.generateOrderStatusUpdateEmail(order);
      
      if (this.emailService && order.userEmail) {
        await this.sendEmail({
          to: order.userEmail,
          subject: `Order Update - Order #${order.id}`,
          html: emailContent.html,
          text: emailContent.text
        });
      }

      if (this.pushNotificationService && order.userId) {
        await this.sendPushNotification(order.userId, {
          title: 'Order Status Update',
          body: `Your order #${order.id} is now ${order.status}.`,
          data: {
            type: 'order_status_update',
            orderId: order.id.toString(),
            status: order.status
          }
        });
      }

      logger.info('Order status update sent', {
        orderId: order.id,
        status: order.status,
        userId: order.userId
      });
    } catch (error) {
      logger.error('Failed to send order status update:', error);
      throw error;
    }
  }

  async sendOrderCancellation(order, reason) {
    try {
      const emailContent = this.generateOrderCancellationEmail(order, reason);
      
      if (this.emailService && order.userEmail) {
        await this.sendEmail({
          to: order.userEmail,
          subject: `Order Cancelled - Order #${order.id}`,
          html: emailContent.html,
          text: emailContent.text
        });
      }

      if (this.pushNotificationService && order.userId) {
        await this.sendPushNotification(order.userId, {
          title: 'Order Cancelled',
          body: `Your order #${order.id} has been cancelled.`,
          data: {
            type: 'order_cancellation',
            orderId: order.id.toString(),
            reason: reason || 'No reason provided'
          }
        });
      }

      logger.info('Order cancellation notification sent', {
        orderId: order.id,
        userId: order.userId,
        reason
      });
    } catch (error) {
      logger.error('Failed to send order cancellation notification:', error);
      throw error;
    }
  }

  // Inventory-related notifications
  async sendLowStockAlert(product) {
    try {
      const adminEmails = this.getAdminEmails();
      const emailContent = this.generateLowStockAlertEmail(product);
      
      if (this.emailService && adminEmails.length > 0) {
        for (const email of adminEmails) {
          await this.sendEmail({
            to: email,
            subject: `Low Stock Alert - ${product.name}`,
            html: emailContent.html,
            text: emailContent.text
          });
        }
      }

      logger.info('Low stock alert sent', {
        productId: product.id,
        productName: product.name,
        stock: product.stock
      });
    } catch (error) {
      logger.error('Failed to send low stock alert:', error);
      throw error;
    }
  }

  async sendCriticalStockAlert(product) {
    try {
      const adminEmails = this.getAdminEmails();
      const emailContent = this.generateCriticalStockAlertEmail(product);
      
      if (this.emailService && adminEmails.length > 0) {
        for (const email of adminEmails) {
          await this.sendEmail({
            to: email,
            subject: `CRITICAL STOCK ALERT - ${product.name}`,
            html: emailContent.html,
            text: emailContent.text,
            priority: 'high'
          });
        }
      }

      logger.warn('Critical stock alert sent', {
        productId: product.id,
        productName: product.name,
        stock: product.stock
      });
    } catch (error) {
      logger.error('Failed to send critical stock alert:', error);
      throw error;
    }
  }

  async sendOutOfStockAlert(product) {
    try {
      const adminEmails = this.getAdminEmails();
      const emailContent = this.generateOutOfStockAlertEmail(product);
      
      if (this.emailService && adminEmails.length > 0) {
        for (const email of adminEmails) {
          await this.sendEmail({
            to: email,
            subject: `OUT OF STOCK - ${product.name}`,
            html: emailContent.html,
            text: emailContent.text,
            priority: 'high'
          });
        }
      }

      logger.error('Out of stock alert sent', {
        productId: product.id,
        productName: product.name,
        stock: product.stock
      });
    } catch (error) {
      logger.error('Failed to send out of stock alert:', error);
      throw error;
    }
  }

  // User-related notifications
  async sendWelcomeEmail(user) {
    try {
      const emailContent = this.generateWelcomeEmail(user);
      
      if (this.emailService && user.email) {
        await this.sendEmail({
          to: user.email,
          subject: 'Welcome to MyShop!',
          html: emailContent.html,
          text: emailContent.text
        });
      }

      logger.info('Welcome email sent', {
        userId: user.id,
        email: user.email
      });
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    try {
      const emailContent = this.generatePasswordResetEmail(user, resetToken);
      
      if (this.emailService && user.email) {
        await this.sendEmail({
          to: user.email,
          subject: 'Password Reset Request',
          html: emailContent.html,
          text: emailContent.text
        });
      }

      logger.info('Password reset email sent', {
        userId: user.id,
        email: user.email
      });
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  // Core notification methods
  async sendEmail(emailData) {
    if (!this.emailService) {
      logger.warn('Email service not available');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@myshop.com',
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        priority: emailData.priority || 'normal'
      };

      const result = await this.emailService.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendSMS(phoneNumber, message) {
    if (!this.smsService) {
      logger.warn('SMS service not available');
      return false;
    }

    try {
      const result = await this.smsService.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info('SMS sent successfully', {
        to: phoneNumber,
        sid: result.sid
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      throw error;
    }
  }

  async sendPushNotification(userId, notification) {
    if (!this.pushNotificationService) {
      logger.warn('Push notification service not available');
      return false;
    }

    try {
      // In a real implementation, you'd get the user's device tokens from database
      const deviceTokens = await this.getUserDeviceTokens(userId);
      
      if (deviceTokens.length === 0) {
        logger.info('No device tokens found for user', { userId });
        return false;
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens: deviceTokens
      };

      const result = await this.pushNotificationService.sendMulticast(message);
      
      logger.info('Push notification sent', {
        userId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result.successCount > 0;
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  // Email template generators
  generateOrderConfirmationEmail(order) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmation</h2>
        <p>Thank you for your order! Your order #${order.id} has been confirmed.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Total Amount:</strong> $${order.totalAmount}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3>Items Ordered</h3>
          ${this.generateOrderItemsHTML(order.items)}
        </div>
        
        <p>We'll send you another email when your order ships.</p>
        <p>Thank you for shopping with MyShop!</p>
      </div>
    `;

    const text = `
      Order Confirmation
      
      Thank you for your order! Your order #${order.id} has been confirmed.
      
      Order Details:
      Order ID: #${order.id}
      Total Amount: $${order.totalAmount}
      Status: ${order.status}
      Order Date: ${new Date(order.createdAt).toLocaleDateString()}
      
      We'll send you another email when your order ships.
      Thank you for shopping with MyShop!
    `;

    return { html, text };
  }

  generateOrderStatusUpdateEmail(order) {
    const statusMessages = {
      processing: 'Your order is being processed.',
      shipped: 'Your order has been shipped!',
      delivered: 'Your order has been delivered.',
      cancelled: 'Your order has been cancelled.'
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Status Update</h2>
        <p>Your order #${order.id} status has been updated.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Current Status: ${order.status}</h3>
          <p>${statusMessages[order.status] || 'Your order status has been updated.'}</p>
        </div>
        
        <p>You can track your order by logging into your account.</p>
        <p>Thank you for shopping with MyShop!</p>
      </div>
    `;

    const text = `
      Order Status Update
      
      Your order #${order.id} status has been updated.
      Current Status: ${order.status}
      ${statusMessages[order.status] || 'Your order status has been updated.'}
      
      You can track your order by logging into your account.
      Thank you for shopping with MyShop!
    `;

    return { html, text };
  }

  generateOrderCancellationEmail(order, reason) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Cancellation</h2>
        <p>Your order #${order.id} has been cancelled.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Cancellation Details</h3>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Amount:</strong> $${order.totalAmount}</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        
        <p>If you paid for this order, a refund will be processed within 3-5 business days.</p>
        <p>If you have any questions, please contact our customer service.</p>
      </div>
    `;

    const text = `
      Order Cancellation
      
      Your order #${order.id} has been cancelled.
      
      Order ID: #${order.id}
      Amount: $${order.totalAmount}
      ${reason ? `Reason: ${reason}` : ''}
      
      If you paid for this order, a refund will be processed within 3-5 business days.
      If you have any questions, please contact our customer service.
    `;

    return { html, text };
  }

  generateLowStockAlertEmail(product) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">Low Stock Alert</h2>
        <p>The following product is running low on stock:</p>
        
        <div style="background: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; margin: 20px 0;">
          <h3>${product.name}</h3>
          <p><strong>Product ID:</strong> ${product.id}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Current Stock:</strong> ${product.stock}</p>
          <p><strong>Price:</strong> $${product.price}</p>
        </div>
        
        <p>Please consider restocking this item soon.</p>
      </div>
    `;

    const text = `
      Low Stock Alert
      
      The following product is running low on stock:
      
      Product: ${product.name}
      Product ID: ${product.id}
      Category: ${product.category}
      Current Stock: ${product.stock}
      Price: $${product.price}
      
      Please consider restocking this item soon.
    `;

    return { html, text };
  }

  generateCriticalStockAlertEmail(product) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">CRITICAL STOCK ALERT</h2>
        <p>The following product has critically low stock:</p>
        
        <div style="background: #ffebee; padding: 20px; border-left: 4px solid #f44336; margin: 20px 0;">
          <h3>${product.name}</h3>
          <p><strong>Product ID:</strong> ${product.id}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Current Stock:</strong> ${product.stock}</p>
          <p><strong>Price:</strong> $${product.price}</p>
        </div>
        
        <p><strong>URGENT:</strong> Please restock this item immediately to avoid stockouts.</p>
      </div>
    `;

    const text = `
      CRITICAL STOCK ALERT
      
      The following product has critically low stock:
      
      Product: ${product.name}
      Product ID: ${product.id}
      Category: ${product.category}
      Current Stock: ${product.stock}
      Price: $${product.price}
      
      URGENT: Please restock this item immediately to avoid stockouts.
    `;

    return { html, text };
  }

  generateOutOfStockAlertEmail(product) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">OUT OF STOCK</h2>
        <p>The following product is now out of stock:</p>
        
        <div style="background: #ffcdd2; padding: 20px; border-left: 4px solid #d32f2f; margin: 20px 0;">
          <h3>${product.name}</h3>
          <p><strong>Product ID:</strong> ${product.id}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Current Stock:</strong> ${product.stock}</p>
          <p><strong>Price:</strong> $${product.price}</p>
        </div>
        
        <p><strong>IMMEDIATE ACTION REQUIRED:</strong> This product needs to be restocked immediately.</p>
      </div>
    `;

    const text = `
      OUT OF STOCK
      
      The following product is now out of stock:
      
      Product: ${product.name}
      Product ID: ${product.id}
      Category: ${product.category}
      Current Stock: ${product.stock}
      Price: $${product.price}
      
      IMMEDIATE ACTION REQUIRED: This product needs to be restocked immediately.
    `;

    return { html, text };
  }

  generateWelcomeEmail(user) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to MyShop!</h2>
        <p>Hi ${user.name},</p>
        <p>Welcome to MyShop! We're excited to have you as part of our community.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>What's next?</h3>
          <ul>
            <li>Browse our extensive product catalog</li>
            <li>Add items to your wishlist</li>
            <li>Enjoy secure and fast checkout</li>
            <li>Track your orders in real-time</li>
          </ul>
        </div>
        
        <p>If you have any questions, our customer support team is here to help.</p>
        <p>Happy shopping!</p>
      </div>
    `;

    const text = `
      Welcome to MyShop!
      
      Hi ${user.name},
      
      Welcome to MyShop! We're excited to have you as part of our community.
      
      What's next?
      - Browse our extensive product catalog
      - Add items to your wishlist
      - Enjoy secure and fast checkout
      - Track your orders in real-time
      
      If you have any questions, our customer support team is here to help.
      Happy shopping!
    `;

    return { html, text };
  }

  generatePasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset for your MyShop account.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      </div>
    `;

    const text = `
      Password Reset Request
      
      Hi ${user.name},
      
      You requested a password reset for your MyShop account.
      
      Click the link below to reset your password:
      ${resetUrl}
      
      This link will expire in 1 hour for security reasons.
      If you didn't request this reset, please ignore this email.
    `;

    return { html, text };
  }

  // Helper methods
  generateOrderItemsHTML(items) {
    if (!items || items.length === 0) {
      return '<p>No items found</p>';
    }

    return items.map(item => `
      <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
        <p><strong>${item.productName || 'Product'}</strong></p>
        <p>Quantity: ${item.quantity} × $${item.price} = $${(item.quantity * item.price).toFixed(2)}</p>
      </div>
    `).join('');
  }

  getAdminEmails() {
    // In a real implementation, you'd fetch admin emails from database
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').filter(email => email.trim());
    return adminEmails.length > 0 ? adminEmails : ['admin@myshop.com'];
  }

  async getUserDeviceTokens(userId) {
    // In a real implementation, you'd fetch device tokens from database
    // For now, return empty array
    return [];
  }
}

module.exports = NotificationService;