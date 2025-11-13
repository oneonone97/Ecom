const sql = require('../utils/postgres');

async function checkUsersSchema() {
  try {
    console.log('Checking Users table schema...');

    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Users'
      ORDER BY ordinal_position
    `;

    console.log('Users table columns:');
    result.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await sql.end();
  }
}

checkUsersSchema();
