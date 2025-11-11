const { Product } = require('../models');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

/**
 * Migration script to convert price fields from decimal to paise (integer)
 * and add new fields: sale_price_paise, is_new, is_sale, image_url
 */
async function migrateToPaise() {
  try {
    logger.info('Starting migration to paise-based pricing...');

    // Check if migration is needed
    const products = await Product.findAll({
      attributes: ['id', 'price', 'price_paise', 'image', 'image_url']
    });

    if (products.length === 0) {
      logger.info('No products found. Migration not needed.');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      try {
        const updateData = {};

        // Convert price to paise if price_paise is null
        if (product.price && !product.price_paise) {
          updateData.price_paise = Math.round(product.price * 100);
          logger.info(`Converting price ${product.price} to ${updateData.price_paise} paise for product ${product.id}`);
        }

        // Migrate image to image_url if needed
        if (product.image && !product.image_url) {
          updateData.image_url = product.image;
          logger.info(`Migrating image field to image_url for product ${product.id}`);
        }

        // Set default values for new fields if not set
        if (product.is_new === null || product.is_new === undefined) {
          updateData.is_new = false;
        }

        if (product.is_sale === null || product.is_sale === undefined) {
          updateData.is_sale = false;
        }

        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          await product.update(updateData);
          migratedCount++;
          logger.info(`Migrated product ${product.id}`);
        } else {
          skippedCount++;
        }

      } catch (error) {
        logger.error(`Error migrating product ${product.id}:`, error.message);
      }
    }

    logger.info(`Migration completed. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);

    // Verify migration
    const verifyProducts = await Product.findAll({
      attributes: ['id', 'price_paise', 'sale_price_paise', 'is_new', 'is_sale', 'image_url'],
      limit: 5
    });

    logger.info('Sample migrated products:', verifyProducts.map(p => ({
      id: p.id,
      price_paise: p.price_paise,
      sale_price_paise: p.sale_price_paise,
      is_new: p.is_new,
      is_sale: p.is_sale,
      image_url: p.image_url
    })));

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback migration (convert paise back to decimal)
 */
async function rollbackFromPaise() {
  try {
    logger.info('Starting rollback from paise-based pricing...');

    const products = await Product.findAll({
      attributes: ['id', 'price_paise']
    });

    let rollbackCount = 0;

    for (const product of products) {
      if (product.price_paise) {
        const priceInRupees = product.price_paise / 100;
        await product.update({ price: priceInRupees });
        rollbackCount++;
        logger.info(`Rolled back product ${product.id}: ${product.price_paise} paise -> ${priceInRupees} rupees`);
      }
    }

    logger.info(`Rollback completed. Updated: ${rollbackCount} products`);

  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    const command = process.argv[2];

    switch (command) {
      case 'migrate':
        await migrateToPaise();
        break;
      case 'rollback':
        await rollbackFromPaise();
        break;
      default:
        logger.info('Usage: node migrate-to-paise.js [migrate|rollback]');
        process.exit(1);
    }

    logger.info('Migration script completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateToPaise,
  rollbackFromPaise
};
