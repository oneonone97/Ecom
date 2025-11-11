/**
 * Supabase Environment Setup Helper
 * 
 * This script helps you set up the DATABASE_URL in your .env file for Supabase.
 * 
 * Usage:
 * node scripts/setup-supabase-env.js
 * 
 * It will prompt you for the database password and update your .env file.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Your Supabase project information
const SUPABASE_PROJECT_REF = 'jvtbbtymefaolozvdpet';
const SUPABASE_HOST = `db.${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_PORT = '5432';
const SUPABASE_DB = 'postgres';
const SUPABASE_USER = 'postgres';

// Supabase API configuration (optional, for future use)
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dGJidHltZWZhb2xvenZkcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ4NDUyNywiZXhwIjoyMDc3MDYwNTI3fQ.q3y3j45vz1FusaOxTR6zV9erOZl90MB3NuQTxok8K3I';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function escapePassword(password) {
  // URL encode special characters in password
  return encodeURIComponent(password);
}

function generateConnectionString(password) {
  const encodedPassword = escapePassword(password);
  return `postgresql://${SUPABASE_USER}:${encodedPassword}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}?sslmode=require`;
}

async function setupSupabaseEnv() {
  try {
    console.log('\n🔧 Supabase Environment Setup');
    console.log('================================\n');
    console.log(`Project: ${SUPABASE_PROJECT_REF}`);
    console.log(`Host: ${SUPABASE_HOST}\n`);

    // Check if .env file exists
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('✅ Found existing .env file\n');
    } else {
      console.log('⚠️  .env file not found, will create new one\n');
    }

    // Get database password
    console.log('Enter your Supabase database password:');
    console.log('(This is the password you set when creating the project)');
    console.log('(If you forgot it, reset it in Supabase Dashboard → Settings → Database)\n');
    
    const password = await question('Database Password: ');
    
    if (!password || password.trim() === '') {
      console.error('\n❌ Password cannot be empty');
      process.exit(1);
    }

    // Generate connection string
    const databaseUrl = generateConnectionString(password.trim());
    
    console.log('\n📝 Generated connection string:');
    console.log(`DATABASE_URL=${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

    // Update or add DATABASE_URL
    let updatedContent = envContent;
    
    // Remove existing DATABASE_URL if present
    updatedContent = updatedContent.replace(/^DATABASE_URL=.*$/gm, '');
    
    // Remove existing Supabase config if present
    updatedContent = updatedContent.replace(/^SUPABASE_URL=.*$/gm, '');
    updatedContent = updatedContent.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/gm, '');
    
    // Remove trailing empty lines
    updatedContent = updatedContent.trim();
    
    // Add Supabase configuration
    if (updatedContent && !updatedContent.endsWith('\n')) {
      updatedContent += '\n';
    }
    
    updatedContent += '\n# Supabase Database Configuration\n';
    updatedContent += `DATABASE_URL=${databaseUrl}\n`;
    updatedContent += '\n# Supabase API Configuration (optional, for future use)\n';
    updatedContent += `SUPABASE_URL=${SUPABASE_URL}\n`;
    updatedContent += `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}\n`;

    // Write to .env file
    fs.writeFileSync(envPath, updatedContent, 'utf8');
    
    console.log('✅ Successfully updated .env file!');
    console.log('\n📋 Next steps:');
    console.log('1. Test connection: npm run dev');
    console.log('2. Create tables: node scripts/sync-all-tables.js');
    console.log('3. Migrate data (if needed): node scripts/migrate-data-to-supabase.js\n');
    
  } catch (error) {
    console.error('\n❌ Error setting up Supabase environment:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
if (require.main === module) {
  setupSupabaseEnv()
    .then(() => {
      console.log('Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupSupabaseEnv;

