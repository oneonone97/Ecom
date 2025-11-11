/**
 * Debug script to check user credentials
 * Usage: node scripts/debug-user.js
 */

const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');
const User = require('../models/User');

async function debugUser() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('\n✓ Database connected\n');

    // Find the admin user
    const admin = await User.findOne({
      where: { email: 'admin@myshop.com' }
    });

    if (!admin) {
      console.log('❌ Admin user NOT found in database!');
      console.log('   Run: create-admin.bat to create it.\n');
      process.exit(1);
    }

    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║           USER INFORMATION                         ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`\nID:            ${admin.id}`);
    console.log(`Name:          ${admin.name}`);
    console.log(`Email:         ${admin.email}`);
    console.log(`Role:          ${admin.role}`);
    console.log(`Active:        ${admin.isActive}`);
    console.log(`Login Attempts: ${admin.loginAttempts || 0}`);
    console.log(`Locked:        ${admin.lockUntil ? 'YES until ' + new Date(admin.lockUntil) : 'NO'}`);
    console.log(`Password Hash: ${admin.password.substring(0, 20)}...`);
    console.log(`\n════════════════════════════════════════════════════\n`);

    // Test password
    const testPasswords = [
      'Admin@123',
      'admin@123', 
      'Admin123',
      'Admin@123 ',
      ' Admin@123'
    ];

    console.log('Testing passwords:\n');
    
    for (const testPass of testPasswords) {
      const isValid = await bcrypt.compare(testPass, admin.password);
      const displayPass = testPass.replace(/ /g, '·'); // Show spaces
      console.log(`  ${isValid ? '✓' : '✗'} "${displayPass}" ${isValid ? '← CORRECT!' : ''}`);
    }

    console.log('\n════════════════════════════════════════════════════\n');

    if (admin.lockUntil && admin.lockUntil > Date.now()) {
      console.log('⚠️  ACCOUNT IS LOCKED!');
      const unlockTime = new Date(admin.lockUntil);
      const minutesLeft = Math.ceil((admin.lockUntil - Date.now()) / (1000 * 60));
      console.log(`   Will unlock at: ${unlockTime.toLocaleString()}`);
      console.log(`   Minutes remaining: ${minutesLeft}\n`);
      
      console.log('To unlock immediately, run:');
      console.log('   node -e "const s=require(\'./config/database\');const U=require(\'./models/User\');(async()=>{await s.sync();await U.update({loginAttempts:0,lockUntil:null},{where:{email:\'admin@myshop.com\'}});console.log(\'Unlocked!\');process.exit();})();"');
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugUser();

