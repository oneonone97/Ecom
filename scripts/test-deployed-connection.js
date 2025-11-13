// Test script to simulate deployed environment connection
const postgres = require('postgres');

// Simulate production environment settings
process.env.NODE_ENV = 'production';

// Your current database URL
const connectionString = process.env.DATABASE_URL;

console.log('Testing connection with production settings...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Database URL exists:', !!connectionString);

const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: { undefined: null }
});

async function testConnection() {
  try {
    console.log('Attempting connection...');
    const result = await sql`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Connection successful!');
    console.log('Result:', result);

    // Try to get user count
    const users = await sql`SELECT COUNT(*) as count FROM "Users"`;
    console.log('Users in database:', users[0].count);

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Host:', error.hostname);

    if (error.code === 'ENOTFOUND') {
      console.log('\n🔍 This is the same DNS error your deployed app is getting!');
      console.log('The Supabase host cannot be resolved from this network location.');
    }
  } finally {
    await sql.end();
  }
}

testConnection();
