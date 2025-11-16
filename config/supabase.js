/**
 * Supabase Client Configuration
 * 
 * This provides a Supabase client instance that handles connection pooling
 * automatically, making it ideal for serverless environments like Vercel.
 * 
 * The Supabase client uses PostgREST API which handles connection pooling
 * and is more reliable than direct PostgreSQL connections in serverless.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  logger.warn('SUPABASE_URL is not set. Supabase client will not be initialized.');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Using anon key if available.');
}

/**
 * Get Supabase URL from DATABASE_URL if SUPABASE_URL is not set
 * Format: https://[PROJECT-REF].supabase.co
 */
function getSupabaseUrl() {
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }

  // Extract from DATABASE_URL if available
  const dbUrl = process.env.DATABASE_URL || '';
  const match = dbUrl.match(/@db\.([^.]+)\.supabase\.co/);
  
  if (match) {
    const projectRef = match[1];
    return `https://${projectRef}.supabase.co`;
  }

  throw new Error('SUPABASE_URL is required. Set it in .env file or it will be extracted from DATABASE_URL.');
}

/**
 * Initialize Supabase client
 * 
 * Uses service role key for server-side operations (bypasses RLS)
 * For client-side operations, use anon key instead
 */
let supabaseClient = null;

function initializeSupabase() {
  try {
    const supabaseUrl = getSupabaseUrl();
    
    // Use service role key for admin operations (bypasses Row Level Security)
    // For public operations, you can use SUPABASE_ANON_KEY instead
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });

    logger.info('Supabase client initialized successfully', {
      url: supabaseUrl,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY
    });

    return supabaseClient;
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
    throw error;
  }
}

/**
 * Get Supabase client instance
 * Initializes if not already initialized
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    return initializeSupabase();
  }
  return supabaseClient;
}

/**
 * Test Supabase connection
 */
async function testConnection() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('Users').select('count').limit(1);
    
    if (error) {
      throw error;
    }
    
    return { success: true, message: 'Supabase connection successful' };
  } catch (error) {
    logger.error('Supabase connection test failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getSupabaseClient,
  initializeSupabase,
  testConnection
};
