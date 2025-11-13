const sql = require('../utils/postgres');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

    // Try a simple query
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Test result:', result);

    // Try to get table count
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('Available tables:', tables.map(t => t.table_name));

    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Host:', error.hostname || 'Unknown');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testConnection();
