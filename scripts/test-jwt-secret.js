/**
 * Script to test JWT secret configuration
 * Usage: node scripts/test-jwt-secret.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const logger = require('../utils/logger');

console.log('\n🔑 JWT SECRET TEST');
console.log('===================');

console.log(`\n1. Environment Variables:`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`   JWT_SECRET Length: ${process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0}`);

if (process.env.JWT_SECRET) {
  console.log(`   JWT_SECRET Preview: ${process.env.JWT_SECRET.substring(0, 20)}...`);
} else {
  console.log('   ❌ JWT_SECRET is undefined!');
}

console.log(`\n2. Testing JWT signing:`);
try {
  const jwt = require('jsonwebtoken');
  const testPayload = { id: 1, test: true };
  const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
  console.log(`   ✅ JWT signing successful!`);
  console.log(`   Token: ${token.substring(0, 50)}...`);
  
  // Test verification
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(`   ✅ JWT verification successful!`);
  console.log(`   Decoded: ${JSON.stringify(decoded)}`);
  
} catch (error) {
  console.log(`   ❌ JWT error: ${error.message}`);
}
