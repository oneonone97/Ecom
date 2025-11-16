/**
 * Utility functions for handling product images
 */

const fs = require('fs');
const path = require('path');
const { listFiles, getPublicUrl, isConfigured } = require('./supabaseStorage');

/**
 * Get all images from a product folder
 * @param {string} imageUrl - Current image URL (e.g., "products/FOLDER_NAME/image.jpg")
 * @param {string} productName - Optional product name to match ezyZip folder (fallback when imageUrl is placeholder)
 * @returns {Array<string>} Array of image URLs
 */
function getAllProductImages(imageUrl, productName = null) {
  try {
    // If it's a full URL (Supabase Storage or CDN), return it as-is
    if (imageUrl && (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')))) {
      return [imageUrl];
    }
    
    // Handle placeholder values - try to find images in ezyZip folder using product name
    const isPlaceholder = !imageUrl || 
        imageUrl === 'no-image.jpg' || 
        imageUrl === 'placeholder.jpg' ||
        (typeof imageUrl === 'string' && !imageUrl.includes('/') && !imageUrl.startsWith('http'));
    
    if (isPlaceholder && productName) {
      // Try to find images in ezyZip folder using product name
      // Try multiple possible paths (from utils folder, from root, etc.)
      const possibleEzyZipPaths = [
        path.join(__dirname, '../../ezyZip', productName),  // From utils folder
        path.join(__dirname, '../ezyZip', productName),     // Alternative
        path.join(process.cwd(), 'ezyZip', productName)      // From project root
      ];
      
      for (const ezyZipPath of possibleEzyZipPaths) {
        if (fs.existsSync(ezyZipPath)) {
          try {
            const files = fs.readdirSync(ezyZipPath);
            const imageFiles = files
              .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
              .sort(); // Sort alphabetically for consistent order
            
            if (imageFiles.length > 0) {
              // Found images in ezyZip folder - return URLs
              const imageUrls = imageFiles.map(file => {
                // Use forward slashes for URLs (works on both Windows and Unix)
                // Ensure path starts with / for frontend (absolute path from public folder)
                const urlPath = `products/ezyZip/${productName}/${file}`;
                return urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
              });
              return imageUrls;
            }
          } catch (error) {
            // If reading ezyZip folder fails, try next path
            console.warn(`Could not read ezyZip folder at ${ezyZipPath}:`, error.message);
            continue;
          }
        }
      }
    }
    
    // If still placeholder and no product name or ezyZip folder not found, return placeholder
    if (isPlaceholder) {
      return ['/placeholder.jpg'];
    }
    
    // Ensure imageUrl is a string before using string methods
    if (typeof imageUrl !== 'string') {
      return ['/placeholder.jpg'];
    }

    // Extract folder name from image_url
    // Format: "products/FOLDER_NAME/image.jpg" or "products/ezyZip/FOLDER_NAME/image.jpg"
    const parts = imageUrl.split('/');
    let folderName = null;
    let basePath = 'products';

    // Handle both "products/FOLDER/image.jpg" and "products/ezyZip/FOLDER/image.jpg"
    if (parts.length >= 3) {
      if (parts[1] === 'ezyZip' && parts.length >= 4) {
        folderName = parts[2];
        basePath = 'products/ezyZip';
      } else {
        folderName = parts[1];
      }
    }

    if (!folderName) {
      // Ensure single image has leading slash
      return imageUrl.startsWith('/') ? [imageUrl] : [`/${imageUrl}`];
    }

    // Try multiple possible paths
    const possiblePaths = [
      path.join(__dirname, '../../myshopReact/my-project/public', basePath, folderName),
      path.join(__dirname, '../../ezyZip', folderName),
      path.join(__dirname, '../../myshopReact/my-project/public/products', folderName)
    ];

    let folderPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        folderPath = possiblePath;
        break;
      }
    }

    if (!folderPath) {
      // Folder not found, return single image with leading slash
      return imageUrl.startsWith('/') ? [imageUrl] : [`/${imageUrl}`];
    }

    // Read all image files from folder
    const files = fs.readdirSync(folderPath);
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .sort(); // Sort alphabetically for consistent order

    if (imageFiles.length === 0) {
      // No images found, return original with leading slash
      return imageUrl.startsWith('/') ? [imageUrl] : [`/${imageUrl}`];
    }

    // Determine the correct base path for URLs
    // Check which path was found
    let urlBasePath = basePath;
    if (folderPath.includes('ezyZip')) {
      urlBasePath = 'products/ezyZip';
    } else if (folderPath.includes('public/products')) {
      urlBasePath = 'products';
    }

    // Build image URLs - ensure they start with / for frontend
    const imageUrls = imageFiles.map(file => {
      // Use forward slashes for URLs (works on both Windows and Unix)
      // Ensure path starts with / for frontend (absolute path from public folder)
      const urlPath = `${urlBasePath}/${folderName}/${file}`;
      return urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    });

    return imageUrls;
  } catch (error) {
    console.error('Error getting product images:', error);
    // Return single image on error
    return imageUrl ? [imageUrl] : ['/placeholder.jpg'];
  }
}

/**
 * Get the main/primary image from a product
 * @param {string} imageUrl - Current image URL
 * @returns {string} Primary image URL
 */
function getPrimaryImage(imageUrl) {
  const allImages = getAllProductImages(imageUrl);
  return allImages[0] || imageUrl || '/placeholder.jpg';
}

/**
 * Get image gallery for a product
 * @param {Object|string} productOrImageUrl - Product object or image URL string
 * @returns {Object} Image gallery object with main, thumbnail, and gallery array
 */
async function getImageGalleryFromSupabase(productId, imageUrl) {
  // Try to get images from Supabase Storage
  if (!isConfigured()) {
    return null;
  }

  try {
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    const folderPath = `products/${productId}`;
    
    // List all files in the product folder
    const files = await listFiles(bucketName, folderPath);
    
    if (!files || files.length === 0) {
      return null;
    }

    // Filter image files and get public URLs
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (imageFiles.length === 0) {
      return null;
    }

    // Get public URLs for all images
    const imageUrls = imageFiles.map(file => 
      getPublicUrl(bucketName, `${folderPath}/${file.name}`)
    );

    return {
      main: imageUrls[0] || imageUrl,
      thumbnail: imageUrls[0] || imageUrl,
      gallery: imageUrls.length > 0 ? imageUrls : [imageUrl]
    };
  } catch (error) {
    // If listing fails, return null to fall back to other methods
    return null;
  }
}

/**
 * Get image gallery for a product
 * @param {Object|string} productOrImageUrl - Product object or image URL string
 * @returns {Object} Image gallery object with main, thumbnail, and gallery array
 */
function getImageGallery(productOrImageUrl) {
  // Handle both product object and image URL string
  const product = typeof productOrImageUrl === 'object' ? productOrImageUrl : null;
  let imageUrl = typeof productOrImageUrl === 'string' 
    ? productOrImageUrl 
    : (product?.image_url || product?.imageUrl);
  
  // Get product name for ezyZip folder lookup (fallback when imageUrl is placeholder)
  const productName = product?.name || null;
  
  // Handle placeholder values - try to find images in ezyZip folder using product name
  const isPlaceholder = !imageUrl || 
      imageUrl === 'no-image.jpg' || 
      imageUrl === 'placeholder.jpg' ||
      (typeof imageUrl === 'string' && !imageUrl.includes('/') && !imageUrl.startsWith('http'));
  
  // If imageUrl is a Supabase Storage URL (starts with https://), use it directly
  // In serverless environments, we can't scan filesystem, so use the URL as-is
  if (imageUrl && (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')))) {
    // It's already a full URL (Supabase Storage or CDN)
    return {
      main: imageUrl,
      thumbnail: imageUrl,
      gallery: [imageUrl]
    };
  }
  
  // For local paths, try to get images from filesystem (only works in local dev)
  // In production/serverless, this will fail gracefully and return the single image
  try {
    // Pass product name to getAllProductImages so it can find ezyZip folder when imageUrl is placeholder
    const allImages = getAllProductImages(imageUrl, productName);
    
    // Ensure mainImage has leading slash for local paths
    let mainImage = allImages[0] || imageUrl || '/placeholder.jpg';
    if (mainImage && typeof mainImage === 'string' && !mainImage.startsWith('/') && !mainImage.startsWith('http')) {
      mainImage = `/${mainImage}`;
    }
    
    return {
      main: mainImage,
      thumbnail: mainImage,
      gallery: allImages.length > 0 ? allImages : [mainImage]
    };
  } catch (error) {
    // In serverless, filesystem access fails - return placeholder
    return {
      main: '/placeholder.jpg',
      thumbnail: '/placeholder.jpg',
      gallery: ['/placeholder.jpg']
    };
  }
}

module.exports = {
  getAllProductImages,
  getPrimaryImage,
  getImageGallery
};

