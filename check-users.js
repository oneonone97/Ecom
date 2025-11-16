require('dotenv').config();
const sql = require('./utils/postgres');

async function checkUsers() {
  try {
    console.log('Checking users in database...');
    const users = await sql`SELECT id, email, "isActive", role FROM "Users"`;
    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, Active: ${user.isActive}, Role: ${user.role}`);
    });

    // Check if there are any database functions or triggers
    console.log('\nChecking for database functions...');
    const functions = await sql`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
    `;
    console.log(`Found ${functions.length} functions:`);
    functions.forEach(func => {
      console.log(`- ${func.routine_name} (${func.routine_type})`);
    });

    // Check for triggers
    console.log('\nChecking for triggers...');
    const triggers = await sql`
      SELECT trigger_name, event_object_table, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `;
    console.log(`Found ${triggers.length} triggers:`);
    triggers.forEach(trigger => {
      console.log(`- ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.event_manipulation} ${trigger.action_timing})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkUsers();
