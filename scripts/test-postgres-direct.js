/**
 * Test Direct PostgreSQL Connection
 * 
 * This script tests the direct postgres library connection to Supabase.
 * 
 * Usage:
 * node scripts/test-postgres-direct.js
 */

require('dotenv').config();
const sql = require('../utils/postgres');

async function testDirectConnection() {
  try {
    console.log('\n🔍 Testing Direct PostgreSQL Connection');
    console.log('=======================================\n');

    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const [result] = await sql`SELECT version() as version`;
    console.log(`   ✅ Connected to: ${result.version.split(' ')[0]} ${result.version.split(' ')[1]}\n`);

    // Test 2: List all tables
    console.log('2. Listing all tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `;
    console.log(`   ✅ Found ${tables.length} table(s):`);
    tables.forEach(table => {
      console.log(`      - ${table.table_name}`);
    });
    console.log('');

    // Test 3: Count rows in Users table
    console.log('3. Testing query on Users table...');
    const [userCount] = await sql`SELECT COUNT(*) as count FROM "Users"`;
    console.log(`   ✅ Users table has ${userCount.count} row(s)\n`);

    // Test 4: Get sample data
    console.log('4. Getting sample products...');
    const products = await sql`
      SELECT id, name, price_paise, stock 
      FROM "Products" 
      LIMIT 5
    `;
    console.log(`   ✅ Retrieved ${products.length} product(s):`);
    products.forEach(product => {
      const price = (product.price_paise / 100).toFixed(2);
      console.log(`      - ${product.name} (₹${price}, Stock: ${product.stock})`);
    });
    console.log('');

    // Test 5: Test transaction
    console.log('5. Testing transaction...');
    await sql.begin(async (sql) => {
      const [result] = await sql`SELECT NOW() as current_time`;
      console.log(`   ✅ Transaction successful (Time: ${result.current_time})\n`);
    });

    console.log('✅ All direct PostgreSQL connection tests passed!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Direct PostgreSQL connection test failed!\n');
    console.error('Error:', error.message);
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    return false;
  } finally {
    await sql.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testDirectConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = testDirectConnection;

