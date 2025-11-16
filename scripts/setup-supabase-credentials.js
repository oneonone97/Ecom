/**
 * Setup Supabase Credentials
 * 
 * This script helps you get your Supabase URL and API keys
 * from the Supabase Dashboard.
 * 
 * Usage: node scripts/setup-supabase-credentials.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔧 Supabase Credentials Setup');
console.log('==============================\n');

console.log('📋 To get your Supabase credentials:\n');
console.log('1. Go to: https://supabase.com/dashboard');
console.log('2. Select your project: jvtbbtymefaolozvdpet');
console.log('3. Go to: Settings → API\n');
console.log('You need two values:\n');
console.log('   a) Project URL');
console.log('      - Found under "Project URL"');
console.log('      - Format: https://jvtbbtymefaolozvdpet.supabase.co\n');
console.log('   b) Service Role Key (for server-side operations)');
console.log('      - Found under "Project API keys"');
console.log('      - Click "Reveal" next to "service_role" key');
console.log('      - ⚠️  Keep this secret! Never expose it in client-side code\n');
console.log('   c) Anon Key (optional, for public operations)');
console.log('      - Found under "Project API keys"');
console.log('      - The "anon" or "public" key\n');

// Check if credentials are already set
const envPath = path.join(__dirname, '..', '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

const hasSupabaseUrl = envContent.includes('SUPABASE_URL=');
const hasServiceKey = envContent.includes('SUPABASE_SERVICE_ROLE_KEY=');
const hasAnonKey = envContent.includes('SUPABASE_ANON_KEY=');

console.log('📊 Current Status:\n');
console.log(`   SUPABASE_URL: ${hasSupabaseUrl ? '✅ Set' : '❌ Not set'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${hasServiceKey ? '✅ Set' : '❌ Not set'}`);
console.log(`   SUPABASE_ANON_KEY: ${hasAnonKey ? '✅ Set' : '❌ Not set'}\n`);

if (!hasSupabaseUrl || !hasServiceKey) {
  console.log('⚠️  Missing required credentials!\n');
  console.log('After getting your credentials from Supabase Dashboard:');
  console.log('1. Add them to your .env file:');
  console.log('   SUPABASE_URL=https://jvtbbtymefaolozvdpet.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
  console.log('   SUPABASE_ANON_KEY=your-anon-key-here (optional)\n');
  console.log('2. Also add them to Vercel environment variables\n');
} else {
  console.log('✅ All required credentials are set!\n');
}

// Try to extract from DATABASE_URL if available
const dbUrl = process.env.DATABASE_URL || '';
const match = dbUrl.match(/@db\.([^.]+)\.supabase\.co/);

if (match && !hasSupabaseUrl) {
  const projectRef = match[1];
  const supabaseUrl = `https://${projectRef}.supabase.co`;
  console.log('💡 Detected Supabase project from DATABASE_URL:');
  console.log(`   Suggested SUPABASE_URL: ${supabaseUrl}\n`);
  
  // Ask if user wants to add it
  console.log('You can add this to your .env file:');
  console.log(`SUPABASE_URL=${supabaseUrl}\n`);
}

console.log('📚 Documentation:');
console.log('   https://supabase.com/docs/guides/api\n');
