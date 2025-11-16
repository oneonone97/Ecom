require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./utils/database');
const sql = require('./utils/postgres');
const logger = require('./utils/logger');

/**
 * Debug script to identify and fix "Tenant or user not found" errors
 *
 * Usage: node debug-tenant-error.js
 */

async function debugTenantError() {
  console.log('🔍 Debugging "Tenant or user not found" Error');
  console.log('==============================================\n');

  try {
    // 1. Check database connection
    console.log('1. Testing database connection...');
    const [version] = await sql`SELECT version() as version`;
    console.log(`   ✅ Connected to: ${version.version.split(' ')[0]} ${version.version.split(' ')[1]}\n`);

    // 2. Check users table
    console.log('2. Checking users in database...');
    const users = await sql`SELECT id, email, "isActive", role FROM "Users"`;
    console.log(`   Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`     - ID: ${user.id}, Email: ${user.email}, Active: ${user.isActive}, Role: ${user.role}`);
    });
    console.log('');

    // 3. Test user lookup with different scenarios
    console.log('3. Testing user lookup scenarios...');

    // Test with existing user ID
    const testUserId = users[0]?.id;
    if (testUserId) {
      console.log(`   Testing lookup for user ID: ${testUserId}`);
      const user1 = await db.users.findByPk(testUserId);
      console.log(`   ✅ Found user: ${user1 ? user1.email : 'NOT FOUND'}`);

      // Test with non-existent user ID
      const nonExistentId = 999999;
      console.log(`   Testing lookup for non-existent user ID: ${nonExistentId}`);
      const user2 = await db.users.findByPk(nonExistentId);
      console.log(`   ✅ Result: ${user2 ? user2.email : 'NOT FOUND (expected)'}`);
    }
    console.log('');

    // 4. Test JWT token creation and validation
    console.log('4. Testing JWT token operations...');
    if (users.length > 0) {
      const testUser = users[0];
      const token = jwt.sign(
        { id: testUser.id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      console.log('   ✅ JWT token created successfully');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`   ✅ JWT token verified: user ID ${decoded.id}`);

      const foundUser = await db.users.findByPk(decoded.id);
      console.log(`   ✅ User lookup from JWT: ${foundUser ? foundUser.email : 'NOT FOUND'}`);
    }
    console.log('');

    // 5. Check for database constraints
    console.log('5. Checking database constraints...');
    const constraints = await sql`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name = 'Users'
      ORDER BY tc.constraint_name
    `;

    console.log(`   Found ${constraints.length} constraints on Users table:`);
    constraints.forEach(constraint => {
      console.log(`     - ${constraint.constraint_name} (${constraint.constraint_type}): ${constraint.column_name}`);
    });
    console.log('');

    // 6. Test potential error scenarios
    console.log('6. Testing potential error scenarios...');

    // Test invalid JWT
    try {
      const invalidToken = jwt.sign({ id: 999999 }, 'wrong-secret');
      jwt.verify(invalidToken, process.env.JWT_SECRET);
      console.log('   ❌ Invalid token was accepted (unexpected)');
    } catch (jwtError) {
      console.log('   ✅ Invalid JWT properly rejected');
    }

    // Test expired JWT
    try {
      const expiredToken = jwt.sign(
        { id: testUserId, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );
      jwt.verify(expiredToken, process.env.JWT_SECRET);
      console.log('   ❌ Expired token was accepted (unexpected)');
    } catch (jwtError) {
      console.log('   ✅ Expired JWT properly rejected');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Debug script failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  } finally {
    await sql.end();
  }
}

// Recommendations
function printRecommendations() {
  console.log('📋 Recommendations to fix "Tenant or user not found" error:');
  console.log('========================================================');
  console.log('');
  console.log('1. IMMEDIATE FIXES:');
  console.log('   - Ensure JWT_SECRET is set in .env file');
  console.log('   - Verify DATABASE_URL is correct and accessible');
  console.log('   - Check that user IDs in JWT tokens match database records');
  console.log('');
  console.log('2. ERROR HANDLING IMPROVEMENTS:');
  console.log('   - Added try-catch around database operations in auth middleware');
  console.log('   - Enhanced error handler to properly handle PostgresError');
  console.log('   - Added specific handling for "Tenant or user not found" message');
  console.log('');
  console.log('3. DEBUGGING STEPS:');
  console.log('   - Run this debug script: node debug-tenant-error.js');
  console.log('   - Check application logs for detailed error information');
  console.log('   - Verify JWT tokens are not corrupted or tampered with');
  console.log('   - Ensure database connection is stable');
  console.log('');
  console.log('4. MONITORING:');
  console.log('   - Add database connection health checks');
  console.log('   - Monitor for JWT token validation failures');
  console.log('   - Log authentication attempts and failures');
  console.log('');
}

async function main() {
  await debugTenantError();
  printRecommendations();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { debugTenantError, printRecommendations };
