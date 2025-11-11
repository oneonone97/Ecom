/**
 * Supabase Storage Client Utility
 * 
 * This utility provides functions for uploading and managing images in Supabase Storage.
 * 
 * Usage:
 * const supabase = require('./utils/supabaseStorage');
 * const url = await uploadImage(fileBuffer, 'products', 'image.jpg');
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set. Supabase Storage features will not work.');
}

// Create Supabase client with service role key (for server-side operations)
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null;

/**
 * Upload an image to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} bucketName - Storage bucket name (e.g., 'products')
 * @param {string} filePath - Path in bucket (e.g., 'product-1/image.jpg')
 * @param {string} contentType - MIME type (e.g., 'image/jpeg')
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadImage(fileBuffer, bucketName, filePath, contentType = 'image/jpeg') {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  try {
    // Upload file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: contentType,
        upsert: true // Overwrite if exists
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Supabase Storage upload error:', error);
    throw error;
  }
}

/**
 * Delete an image from Supabase Storage
 * @param {string} bucketName - Storage bucket name
 * @param {string} filePath - Path to file in bucket
 * @returns {Promise<boolean>} Success status
 */
async function deleteImage(bucketName, filePath) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Supabase Storage delete error:', error);
    throw error;
  }
}

/**
 * Get public URL for an image in Supabase Storage
 * @param {string} bucketName - Storage bucket name
 * @param {string} filePath - Path to file in bucket
 * @returns {string} Public URL
 */
function getPublicUrl(bucketName, filePath) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * List files in a bucket
 * @param {string} bucketName - Storage bucket name
 * @param {string} folder - Folder path (optional)
 * @returns {Promise<Array>} List of files
 */
async function listFiles(bucketName, folder = '') {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folder);

    if (error) {
      throw new Error(`List failed: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Supabase Storage list error:', error);
    throw error;
  }
}

/**
 * Check if Supabase Storage is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!supabase;
}

module.exports = {
  supabase,
  uploadImage,
  deleteImage,
  getPublicUrl,
  listFiles,
  isConfigured
};

