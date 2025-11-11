/**
 * Script to create a demo user
 * Usage: node scripts/create-demo-user.js
 */

const sequelize = require('../config/database');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Create demo user
 */
async function createDemoUser() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Database connection established');

    // Sync models
    await sequelize.sync();
    logger.info('Database synchronized');

    // Demo user credentials
    const demoData = {
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'demo123',
      role: 'user',
      isActive: true
    };

    // Check if demo user already exists
    const existingUser = await User.findOne({
      where: { email: demoData.email }
    });

    if (existingUser) {
      logger.warn(`Demo user already exists: ${demoData.email}`);
      console.log('\n╔════════════════════════════════════════════════════╗');
      console.log('║         DEMO USER ALREADY EXISTS!                  ║');
      console.log('╚════════════════════════════════════════════════════╝');
      console.log(`\nEmail: ${demoData.email}`);
      console.log(`Password: ${demoData.password}`);
      console.log('\n✅ You can use these credentials to login!\n');
      process.exit(0);
    }

    // Create demo user
    const demoUser = await User.create(demoData);

    logger.info('Demo user created successfully', {
      id: demoUser.id,
      email: demoUser.email,
      role: demoUser.role
    });

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║       DEMO USER CREATED SUCCESSFULLY! ✓            ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('\n📧 Demo User Credentials:');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log(`   │ Email:    ${demoData.email.padEnd(30)}│`);
    console.log(`   │ Password: ${demoData.password.padEnd(30)}│`);
    console.log('   └─────────────────────────────────────────────┘');
    console.log('\n✅ You can now share these credentials!');
    console.log('\n🌐 Login at: http://localhost:3000/login');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to create demo user:', error);
    console.error('\n❌ Error creating demo user:', error.message);
    process.exit(1);
  }
}

// Run the script
createDemoUser();
