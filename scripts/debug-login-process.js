/**
 * Script to debug the entire login process step by step
 * Usage: node scripts/debug-login-process.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../config/database');
const User = require('../models/User');
const UserRepository = require('../repositories/UserRepository');
const UserService = require('../services/UserService');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

async function debugLoginProcess() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Database connection established');

    const testEmail = 'demo@example.com';
    const testPassword = 'demo123';

    console.log('\n🔍 DEBUGGING LOGIN PROCESS');
    console.log('============================');
    
    console.log(`\n1. Testing with credentials:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);

    // Step 1: Test UserRepository directly
    console.log(`\n2. Testing UserRepository.findByEmailWithPassword()...`);
    const userRepo = new UserRepository();
    const user = await userRepo.findByEmailWithPassword(testEmail);
    
    if (!user) {
      console.log('   ❌ User not found in repository!');
      return;
    }
    
    console.log(`   ✅ User found: ${user.name} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Is Active: ${user.isActive}`);
    console.log(`   Login Attempts: ${user.loginAttempts}`);
    console.log(`   Lock Until: ${user.lockUntil}`);

    // Step 2: Test password verification directly
    console.log(`\n3. Testing password verification...`);
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    console.log(`   Password Hash: ${user.password}`);
    console.log(`   Password Valid: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      console.log('   ❌ Password verification failed!');
      return;
    }
    console.log('   ✅ Password verification passed!');

    // Step 3: Test UserService login method
    console.log(`\n4. Testing UserService.loginUser()...`);
    const userService = new UserService(userRepo);
    
    try {
      const result = await userService.loginUser(testEmail, testPassword);
      console.log('   ✅ Login successful!');
      console.log(`   User: ${result.user.name}`);
      console.log(`   Token: ${result.accessToken.substring(0, 20)}...`);
    } catch (error) {
      console.log(`   ❌ Login failed: ${error.message}`);
      console.log(`   Error Stack: ${error.stack}`);
      
      // Check if it's a specific error type
      if (error.message.includes('not found')) {
        console.log('   → User not found issue');
      } else if (error.message.includes('password')) {
        console.log('   → Password verification issue');
      } else if (error.message.includes('locked')) {
        console.log('   → Account locked issue');
      } else if (error.message.includes('active')) {
        console.log('   → Account inactive issue');
      }
    }

    console.log('\n✅ Debug process completed!');
    
  } catch (error) {
    logger.error('Error during debug process:', error);
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the debug
debugLoginProcess();
