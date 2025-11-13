/**
 * Script to create a demo user
 * Usage: node scripts/create-demo-user.js
 */

const db = require('../utils/database');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

/**
 * Create demo user
 */
async function createDemoUser() {
  try {
    // Demo user credentials
    const demoData = {
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'demo123',
      role: 'user',
      isActive: true,
      isVerified: false
    };

    // Check if demo user already exists
    const existingUser = await db.users.findOne({ email: demoData.email });

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

    // Hash the password
    const saltRounds = 12; // Same as UserService
    const hashedPassword = await bcrypt.hash(demoData.password, saltRounds);

    // Create demo user (matching actual Supabase schema)
    const userData = {
      name: demoData.name,
      email: demoData.email.toLowerCase().trim(),
      password: hashedPassword,
      role: demoData.role,
      isActive: demoData.isActive,
      loginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating user with data:', userData);

    const demoUser = await db.users.create(userData);

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
