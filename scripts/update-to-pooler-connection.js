/**
 * Script to update DATABASE_URL to use Supabase Connection Pooler
 * 
 * The connection pooler is more reliable for serverless/deployed applications
 * compared to direct database connections.
 * 
 * Usage: node scripts/update-to-pooler-connection.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Your Supabase project information
const SUPABASE_PROJECT_REF = 'jvtbbtymefaolozvdpet';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function escapePassword(password) {
  return encodeURIComponent(password);
}

function generatePoolerConnectionString(password, port = '6543', region = null) {
  const encodedPassword = escapePassword(password);
  // Connection pooler uses different host format
  // Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:[PORT]/postgres
  const regionPart = region || getRegion();
  return `postgresql://postgres.${SUPABASE_PROJECT_REF}:${encodedPassword}@aws-0-${regionPart}.pooler.supabase.com:${port}/postgres?sslmode=require`;
}

function generateDirectConnectionString(password) {
  const encodedPassword = escapePassword(password);
  return `postgresql://postgres:${encodedPassword}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require`;
}

// Try to detect region from existing connection string
function getRegion() {
  const dbUrl = process.env.DATABASE_URL || '';
  // Common regions: us-east-1, us-west-1, eu-west-1, ap-southeast-1, etc.
  // Default to us-east-1 if can't detect
  if (dbUrl.includes('us-east')) return 'us-east-1';
  if (dbUrl.includes('us-west')) return 'us-west-1';
  if (dbUrl.includes('eu-west')) return 'eu-west-1';
  if (dbUrl.includes('ap-southeast')) return 'ap-southeast-1';
  if (dbUrl.includes('ap-south')) return 'ap-south-1';
  return 'us-east-1'; // Default
}

async function updateToPoolerConnection() {
  try {
    console.log('\n🔧 Supabase Connection Pooler Setup');
    console.log('=====================================\n');
    console.log(`Project: ${SUPABASE_PROJECT_REF}`);
    console.log('\n📋 Connection Pooler Benefits:');
    console.log('   • Better for serverless/deployed applications');
    console.log('   • More reliable DNS resolution');
    console.log('   • Handles connection pooling automatically');
    console.log('   • Supports transaction mode (port 6543) and session mode (port 5432)\n');

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

    // Ask for connection type
    console.log('\n📡 Connection Pooler Port Options:');
    console.log('   1. Port 6543 (Transaction mode) - Recommended for most apps');
    console.log('   2. Port 5432 (Session mode) - For apps requiring session features');
    console.log('   3. Keep direct connection (db.*.supabase.co:5432)\n');
    
    const choice = await question('Choose option (1/2/3) [default: 1]: ') || '1';

    let databaseUrl;
    let connectionType;

    if (choice === '3') {
      databaseUrl = generateDirectConnectionString(password.trim());
      connectionType = 'Direct Connection';
    } else {
      const port = choice === '2' ? '5432' : '6543';
      databaseUrl = generatePoolerConnectionString(password.trim(), port);
      connectionType = `Connection Pooler (Port ${port})`;
    }

    console.log(`\n📝 Generated ${connectionType} string:`);
    console.log(`DATABASE_URL=${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

    // Update or add DATABASE_URL
    let updatedContent = envContent;
    
    // Remove existing DATABASE_URL if present
    updatedContent = updatedContent.replace(/^DATABASE_URL=.*$/gm, '');
    
    // Remove trailing empty lines
    updatedContent = updatedContent.trim();
    
    // Add updated configuration
    if (updatedContent && !updatedContent.endsWith('\n')) {
      updatedContent += '\n';
    }
    
    updatedContent += '\n# Database Configuration - Using Connection Pooler\n';
    updatedContent += `DATABASE_URL=${databaseUrl}\n`;

    // Write to .env file
    fs.writeFileSync(envPath, updatedContent, 'utf8');
    
    console.log('✅ Successfully updated .env file!');
    console.log(`\n📋 Connection Type: ${connectionType}`);
    console.log('\n📋 Next steps:');
    console.log('1. Test connection: node scripts/test-db-connection.js');
    console.log('2. Restart your server: npm start');
    console.log('3. Test login/register endpoints\n');
    
  } catch (error) {
    console.error('\n❌ Error updating connection:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
if (require.main === module) {
  updateToPoolerConnection()
    .then(() => {
      console.log('Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = updateToPoolerConnection;
