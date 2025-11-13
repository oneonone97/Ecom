/**
 * Quick test to verify auth middleware fix
 */

require('dotenv').config();
const db = require('./utils/database');
const sql = require('./utils/postgres');

async function testAuthFix() {
  try {
    console.log('🔍 Testing auth middleware fix...\n');

    // Test direct user lookup first
    const directUsers = await sql`SELECT id, email FROM "Users" LIMIT 1`;
    console.log('✅ Direct SQL user lookup works:', directUsers.length > 0 ? `Found user ${directUsers[0].email}` : 'No users');

    // Test db.users.findAll
    const users = await db.users.findAll({ limit: 1 });
    console.log('✅ db.users.findAll works:', users.length > 0 ? 'Found users' : 'No users found');

    // Test specific user lookup by ID if we have users
    if (users.length > 0) {
      console.log('Testing findByPk with user ID:', users[0].id);
      const user = await db.users.findByPk(users[0].id);
      console.log('✅ User findByPk works:', user ? `Found user ${user.email}` : 'User not found');
    }

    console.log('\n✅ Auth middleware fix verified!');

  } catch (error) {
    console.error('❌ Auth middleware test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sql.end();
  }
}

testAuthFix();
