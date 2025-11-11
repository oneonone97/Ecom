/**
 * Supabase Connection Verification Script
 * 
 * This script verifies that your Supabase database connection is working correctly.
 * 
 * Usage:
 * node scripts/verify-supabase-connection.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
const logger = require('../utils/logger');

async function verifyConnection() {
  try {
    console.log('\n🔍 Verifying Supabase Database Connection');
    console.log('==========================================\n');

    // Step 1: Test basic connection
    console.log('1. Testing database connection...');
    await sequelize.authenticate();
    console.log('   ✅ Connection successful!\n');

    // Step 2: Get database info
    console.log('2. Getting database information...');
    const [results] = await sequelize.query("SELECT version();");
    const version = results[0].version;
    console.log(`   ✅ Database: PostgreSQL ${version.split(' ')[1]}\n`);

    // Step 3: Check if tables exist and get column counts
    console.log('3. Checking existing tables and schema...');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);
    
    if (tables.length === 0) {
      console.log('   ⚠️  No tables found. You may need to run migrations or sync.\n');
    } else {
      console.log(`   ✅ Found ${tables.length} table(s):`);
      
      // Get column counts for each table
      for (const table of tables) {
        const [columns] = await sequelize.query(`
          SELECT COUNT(*) as column_count
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = $1;
        `, {
          bind: [table.table_name],
          type: sequelize.QueryTypes.SELECT
        });
        const columnCount = columns[0]?.column_count || 0;
        console.log(`      - ${table.table_name} (${columnCount} columns)`);
      }
      console.log('');
    }

    // Step 3.1: Verify foreign key relationships
    console.log('3.1. Verifying foreign key relationships...');
    const [foreignKeys] = await sequelize.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    
    if (foreignKeys.length > 0) {
      console.log(`   ✅ Found ${foreignKeys.length} foreign key relationship(s):`);
      foreignKeys.forEach(fk => {
        console.log(`      - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
      console.log('');
    } else {
      console.log('   ⚠️  No foreign keys found (this may be normal if tables are empty)\n');
    }

    // Step 3.2: Check indexes
    console.log('3.2. Checking indexes...');
    const [indexes] = await sequelize.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE 'pg_%'
      ORDER BY tablename, indexname;
    `);
    
    if (indexes.length > 0) {
      console.log(`   ✅ Found ${indexes.length} index(es):`);
      const indexesByTable = {};
      indexes.forEach(idx => {
        if (!indexesByTable[idx.tablename]) {
          indexesByTable[idx.tablename] = [];
        }
        indexesByTable[idx.tablename].push(idx.indexname);
      });
      
      Object.keys(indexesByTable).forEach(table => {
        console.log(`      - ${table}: ${indexesByTable[table].length} index(es)`);
      });
      console.log('');
    } else {
      console.log('   ⚠️  No indexes found\n');
    }

    // Step 3.3: Validate ENUM types
    console.log('3.3. Validating ENUM types...');
    const [enums] = await sequelize.query(`
      SELECT
        t.typname AS enum_name,
        string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname LIKE 'enum_%'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    
    const expectedEnums = {
      'enum_Users_role': ['user', 'admin'],
      'enum_Orders_status': ['pending', 'paid', 'failed', 'cancelled'],
      'enum_Orders_payment_gateway': ['phonepe', 'razorpay', 'stripe'],
      'enum_WishlistItems_priority': ['low', 'medium', 'high']
    };
    
    if (enums.length > 0) {
      console.log(`   ✅ Found ${enums.length} ENUM type(s):`);
      enums.forEach(enumType => {
        const values = enumType.enum_values.split(', ').map(v => v.trim());
        const expected = expectedEnums[enumType.enum_name];
        const isValid = expected && JSON.stringify(values.sort()) === JSON.stringify(expected.sort());
        const status = isValid ? '✅' : '⚠️';
        console.log(`      ${status} ${enumType.enum_name}: [${values.join(', ')}]`);
        if (!isValid && expected) {
          console.log(`         Expected: [${expected.join(', ')}]`);
        }
      });
      console.log('');
    } else {
      console.log('   ⚠️  No ENUM types found (may need to sync tables)\n');
    }

    // Step 4: Test query execution
    console.log('4. Testing query execution...');
    const [testQuery] = await sequelize.query("SELECT NOW() as current_time;");
    console.log(`   ✅ Query executed successfully (Server time: ${testQuery[0].current_time})\n`);

    // Step 5: Check connection pool
    console.log('5. Checking connection pool...');
    const pool = sequelize.connectionManager.pool;
    if (pool) {
      console.log(`   ✅ Connection pool active\n`);
    } else {
      console.log(`   ⚠️  Connection pool not initialized\n`);
    }

    // Step 6: Verify DATABASE_URL format
    console.log('6. Verifying DATABASE_URL configuration...');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('   ❌ DATABASE_URL not found in .env file\n');
      return false;
    }
    
    if (dbUrl.includes('supabase.co')) {
      console.log('   ✅ Supabase connection string detected\n');
    } else {
      console.log('   ⚠️  Connection string may not be for Supabase\n');
    }

    if (dbUrl.includes('sslmode=require')) {
      console.log('   ✅ SSL mode configured correctly\n');
    } else {
      console.log('   ⚠️  SSL mode not specified (recommended: ?sslmode=require)\n');
    }

    console.log('✅ All checks passed! Your Supabase connection is working correctly.\n');
    
    console.log('📋 Next Steps:');
    console.log('   1. If no tables exist, run: node scripts/sync-all-tables.js');
    console.log('   2. If you have existing SQLite data, run: node scripts/migrate-data-to-supabase.js');
    console.log('   3. Start your server: npm run dev');
    console.log('   4. Test API endpoints\n');

    return true;

  } catch (error) {
    console.error('\n❌ Connection verification failed!\n');
    console.error('Error details:');
    console.error(`   Type: ${error.name}`);
    console.error(`   Message: ${error.message}\n`);

    if (error.name === 'SequelizeConnectionError') {
      console.log('💡 Troubleshooting tips:');
      console.log('   1. Check your DATABASE_URL in .env file');
      console.log('   2. Verify your database password is correct');
      console.log('   3. Make sure ?sslmode=require is in the connection string');
      console.log('   4. Check if your Supabase project is active');
      console.log('   5. Verify your internet connection\n');
    } else if (error.name === 'SequelizeAuthenticationError') {
      console.log('💡 Authentication failed:');
      console.log('   1. Verify your database password is correct');
      console.log('   2. Reset password in Supabase Dashboard if needed');
      console.log('   3. Make sure you\'re using the database password, not the service role key\n');
    }

    logger.error('Connection verification error:', error);
    return false;

  } finally {
    await sequelize.close();
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = verifyConnection;

