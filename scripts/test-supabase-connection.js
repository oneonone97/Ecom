/**
 * Test Supabase Client Connection
 * 
 * This script tests the Supabase client connection to ensure
 * it's properly configured and working.
 * 
 * Usage: node scripts/test-supabase-connection.js
 */

require('dotenv').config();
const { testConnection, getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');

async function testSupabaseSetup() {
  console.log('🔧 Testing Supabase Client Connection');
  console.log('====================================\n');

  // Check environment variables
  console.log('📋 Environment Variables Check:\n');
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set'}\n`);

  if (!process.env.SUPABASE_URL) {
    console.log('❌ SUPABASE_URL is not set!\n');
    console.log('Please run: node scripts/setup-supabase-credentials.js');
    console.log('Then add SUPABASE_URL to your .env file.\n');
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY) {
    console.log('❌ Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set!\n');
    console.log('Please run: node scripts/setup-supabase-credentials.js');
    console.log('Then add at least one key to your .env file.\n');
    process.exit(1);
  }

  // Test connection
  console.log('🔌 Testing Connection...\n');
  const result = await testConnection();

  if (result.success) {
    console.log('✅ Supabase connection successful!\n');
    
    // Test a simple query
    console.log('📊 Testing Database Query...\n');
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from('Users').select('id, email').limit(5);
      
      if (error) {
        console.log('❌ Query test failed:', error.message);
        console.log('   This might be a permissions issue. Check your API key.\n');
      } else {
        console.log(`✅ Query test successful! Found ${data.length} user(s)\n`);
        if (data.length > 0) {
          console.log('Sample users:');
          data.forEach((user, index) => {
            console.log(`   ${index + 1}. ID: ${user.id}, Email: ${user.email}`);
          });
          console.log('');
        }
      }
    } catch (error) {
      console.log('❌ Query test error:', error.message);
    }

    console.log('✅ All tests passed! Supabase client is ready to use.\n');
    console.log('📋 Next Steps:');
    console.log('1. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel');
    console.log('2. Redeploy your application');
    console.log('3. Your app will now use Supabase client (better for serverless)\n');
    
    return true;
  } else {
    console.log('❌ Supabase connection failed!');
    console.log(`   Error: ${result.error}\n`);
    console.log('💡 Troubleshooting:');
    console.log('1. Verify SUPABASE_URL is correct (format: https://[PROJECT-REF].supabase.co)');
    console.log('2. Verify your API key is correct');
    console.log('3. Check if your Supabase project is active (not paused)');
    console.log('4. Ensure your API key has the correct permissions\n');
    
    return false;
  }
}

// Run test
if (require.main === module) {
  testSupabaseSetup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testSupabaseSetup;
