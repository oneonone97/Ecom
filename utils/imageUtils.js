/**
 * Utility functions for handling product images
 */

const fs = require('fs');
const path = require('path');

/**
 * Get all images from a product folder
 * @param {string} imageUrl - Current image URL (e.g., "products/FOLDER_NAME/image.jpg")
 * @returns {Array<string>} Array of image URLs
 */
function getAllProductImages(imageUrl) {
  try {
    if (!imageUrl || imageUrl === 'no-image.jpg' || !imageUrl.includes('/')) {
      // Ensure placeholder has leading slash
      return imageUrl ? (imageUrl.startsWith('/') ? [imageUrl] : [`/${imageUrl}`]) : ['/placeholder.jpg'];
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
 * @param {string} imageUrl - Current image URL
 * @returns {Object} Image gallery object with main, thumbnail, and gallery array
 */
function getImageGallery(imageUrl) {
  const allImages = getAllProductImages(imageUrl);
  // Ensure mainImage has leading slash
  let mainImage = allImages[0] || imageUrl || '/placeholder.jpg';
  if (mainImage && !mainImage.startsWith('/')) {
    mainImage = `/${mainImage}`;
  }
  
  return {
    main: mainImage,
    thumbnail: mainImage,
    gallery: allImages.length > 0 ? allImages : [mainImage]
  };
}

module.exports = {
  getAllProductImages,
  getPrimaryImage,
  getImageGallery
};

