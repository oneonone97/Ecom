require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./utils/database');
const logger = require('./utils/logger');

// Test the authentication error
async function testAuthError() {
  try {
    console.log('Testing authentication with existing user...');

    // Get a user from the database
    const user = await db.users.findByPk(7); // demo@example.com user
    console.log('User found:', { id: user.id, email: user.email, isActive: user.isActive });

    // Create a JWT token for this user
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('JWT token created successfully');

    // Now try to verify the token like the middleware does
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);

    // Try to find the user again (this is where the error might occur)
    console.log('Finding user by ID from token...');
    const foundUser = await db.users.findByPk(decoded.id);

    if (!foundUser) {
      console.error('ERROR: User not found despite existing in database!');
      return false;
    }

    console.log('User found successfully:', { id: foundUser.id, email: foundUser.email });
    return true;

  } catch (error) {
    console.error('Auth test error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    return false;
  }
}

// Test direct database query
async function testDirectQuery() {
  try {
    console.log('\nTesting direct SQL query...');
    const sql = require('./utils/postgres');

    const result = await sql`SELECT * FROM "Users" WHERE id = 7`;
    console.log('Direct query result:', result);

    if (result.length === 0) {
      console.error('ERROR: User not found with direct query!');
      return false;
    }

    console.log('Direct query successful');
    return true;

  } catch (error) {
    console.error('Direct query error:', error);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('🔍 Testing Authentication Error Reproduction');
  console.log('==========================================\n');

  const authTest = await testAuthError();
  const directTest = await testDirectQuery();

  console.log('\n📋 Test Results:');
  console.log('   - Auth middleware simulation:', authTest ? '✅ PASS' : '❌ FAIL');
  console.log('   - Direct database query:', directTest ? '✅ PASS' : '❌ FAIL');

  if (!authTest || !directTest) {
    console.log('\n❌ Issue reproduced! The "Tenant or user not found" error is likely caused by:');
    console.log('   1. Database connection issues');
    console.log('   2. Incorrect table/column names');
    console.log('   3. Data type mismatches');
    console.log('   4. Transaction/locking issues');
  } else {
    console.log('\n✅ No issues found with basic authentication flow');
  }
}

runTests().catch(console.error);
