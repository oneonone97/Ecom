/**
 * Script to test demo user login and debug authentication issues
 * Usage: node scripts/test-demo-login.js
 */

const sequelize = require('../config/database');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

async function testDemoLogin() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Database connection established');

    // Find demo user
    const demoUser = await User.findOne({
      where: { email: 'demo@example.com' }
    });

    if (!demoUser) {
      console.log('❌ Demo user not found!');
      return;
    }

    console.log('\n📋 Demo User Details:');
    console.log(`   ID: ${demoUser.id}`);
    console.log(`   Email: ${demoUser.email}`);
    console.log(`   Name: ${demoUser.name}`);
    console.log(`   Role: ${demoUser.role}`);
    console.log(`   Is Active: ${demoUser.isActive}`);
    console.log(`   Login Attempts: ${demoUser.loginAttempts}`);
    console.log(`   Lock Until: ${demoUser.lockUntil}`);

    // Test password verification
    const testPassword = 'demo123';
    const isPasswordValid = await bcrypt.compare(testPassword, demoUser.password);
    
    console.log(`\n🔑 Password Test:`);
    console.log(`   Expected Password: ${testPassword}`);
    console.log(`   Password Hash: ${demoUser.password}`);
    console.log(`   Password Valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log('\n⚠️  Password verification failed!');
      console.log('   This suggests the password was not hashed correctly during user creation.');
      
      // Try to manually update the password
      console.log('\n🔄 Attempting to fix password...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      
      await demoUser.update({ password: hashedPassword });
      
      // Test again
      const isFixed = await bcrypt.compare(testPassword, demoUser.password);
      console.log(`   Password Fixed: ${isFixed}`);
      
      if (isFixed) {
        console.log('✅ Password has been fixed successfully!');
      }
    } else {
      console.log('✅ Password verification works correctly!');
    }

    // Test login attempts and lock status
    console.log(`\n🔒 Account Status:`);
    console.log(`   Is Locked: ${demoUser.isLocked()}`);
    
    if (demoUser.isLocked()) {
      console.log('   Account is locked - this may prevent login!');
      console.log('   Resetting login attempts...');
      await demoUser.resetLoginAttempts();
      console.log('   Login attempts reset.');
    }

    console.log('\n✅ Demo user test completed!');
    
  } catch (error) {
    logger.error('Error testing demo user:', error);
    console.error('\n❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the test
testDemoLogin();
