const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

// Set upload directories based on environment
// In serverless, use /tmp (only writable location)
// In non-serverless, use local uploads directory
const uploadDir = isServerless 
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');
const productImagesDir = path.join(uploadDir, 'products');
const userAvatarsDir = path.join(uploadDir, 'avatars');

// Ensure upload directories exist (only create if not serverless or if using /tmp)
if (isServerless) {
  // In serverless, use /tmp which should be writable
  [uploadDir, productImagesDir, userAvatarsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        logger.warn(`Could not create upload directory ${dir}:`, error.message);
      }
    }
  });
  
  // Warn that /tmp is ephemeral in serverless - files will be lost
  logger.warn('Running in serverless environment. Uploads stored in /tmp (ephemeral). Consider using cloud storage (S3, Supabase Storage) for production.');
} else {
  // In non-serverless, create directories normally
  [uploadDir, productImagesDir, userAvatarsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        logger.error(`Could not create upload directory ${dir}:`, error.message);
      }
    }
  });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadDir;
    
    if (req.route.path.includes('/products')) {
      uploadPath = productImagesDir;
    } else if (req.route.path.includes('/users') || req.route.path.includes('/profile')) {
      uploadPath = userAvatarsDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${timestamp}-${randomString}${extension}`;
    
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files at once
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      
      if (req.file) {
        // Add file info to request
        req.fileInfo = {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: `/uploads/${path.relative(uploadDir, req.file.path).replace(/\\/g, '/')}`
        };
        
        logger.info('File uploaded successfully', {
          originalName: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          path: req.file.path
        });
      }
      
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      
      if (req.files && req.files.length > 0) {
        // Add files info to request
        req.filesInfo = req.files.map(file => ({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          url: `/uploads/${path.relative(uploadDir, file.path).replace(/\\/g, '/')}`
        }));
        
        logger.info('Multiple files uploaded successfully', {
          count: req.files.length,
          files: req.files.map(f => ({ name: f.originalname, size: f.size }))
        });
      }
      
      next();
    });
  };
};

// Middleware for fields with multiple files
const uploadFields = (fields) => {
  return (req, res, next) => {
    const fieldsUpload = upload.fields(fields);
    
    fieldsUpload(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      
      if (req.files) {
        // Process each field
        req.filesInfo = {};
        
        Object.keys(req.files).forEach(fieldName => {
          req.filesInfo[fieldName] = req.files[fieldName].map(file => ({
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            url: `/uploads/${path.relative(uploadDir, file.path).replace(/\\/g, '/')}`
          }));
        });
        
        logger.info('Field files uploaded successfully', {
          fields: Object.keys(req.files),
          totalFiles: Object.values(req.files).reduce((sum, files) => sum + files.length, 0)
        });
      }
      
      next();
    });
  };
};

// Error handler for upload errors
const handleUploadError = (err, req, res, next) => {
  logger.error('File upload error:', err);
  
  let message = 'File upload failed';
  let statusCode = 400;
  
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum is 5 files.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      default:
        message = `Upload error: ${err.message}`;
    }
  } else if (err.code === 'INVALID_FILE_TYPE') {
    message = err.message;
  } else {
    message = 'Internal server error during file upload';
    statusCode = 500;
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

// Utility function to delete uploaded file
const deleteUploadedFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error('Error deleting file:', err);
        reject(err);
      } else {
        logger.info('File deleted successfully:', filePath);
        resolve();
      }
    });
  });
};

// Utility function to validate image dimensions (optional)
const validateImageDimensions = (filePath, maxWidth = 2048, maxHeight = 2048) => {
  return new Promise((resolve, reject) => {
    const sharp = require('sharp'); // You'll need to install sharp: npm install sharp
    
    sharp(filePath)
      .metadata()
      .then(metadata => {
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          reject(new Error(`Image dimensions too large. Maximum: ${maxWidth}x${maxHeight}`));
        } else {
          resolve(metadata);
        }
      })
      .catch(reject);
  });
};

// Utility function to resize image (optional)
const resizeImage = (inputPath, outputPath, width, height) => {
  return new Promise((resolve, reject) => {
    const sharp = require('sharp');
    
    sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath)
      .then(resolve)
      .catch(reject);
  });
};

// Middleware to clean up uploaded files on error
const cleanupOnError = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if response indicates an error
    if (res.statusCode >= 400) {
      // Clean up uploaded files
      const filesToDelete = [];
      
      if (req.file) {
        filesToDelete.push(req.file.path);
      }
      
      if (req.files) {
        if (Array.isArray(req.files)) {
          filesToDelete.push(...req.files.map(f => f.path));
        } else {
          Object.values(req.files).forEach(files => {
            if (Array.isArray(files)) {
              filesToDelete.push(...files.map(f => f.path));
            }
          });
        }
      }
      
      // Delete files asynchronously (don't wait)
      filesToDelete.forEach(filePath => {
        deleteUploadedFile(filePath).catch(err => {
          logger.error('Failed to clean up file on error:', err);
        });
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteUploadedFile,
  validateImageDimensions,
  resizeImage,
  cleanupOnError,
  uploadDir,
  productImagesDir,
  userAvatarsDir
};