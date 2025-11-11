/**
 * Migration: Add PhonePE fields to Orders table
 * 
 * This migration adds PhonePE-specific fields and payment_gateway enum to the Orders table.
 * Run this migration using: node migrations/add-phonepe-fields.js
 */

const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

async function addPhonePEFields() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Starting migration: Add PhonePE fields to Orders table...');

    // Check if SQLite (for development) or PostgreSQL (for production)
    const dialect = sequelize.getDialect();
    
    if (dialect === 'sqlite') {
      // SQLite doesn't support ALTER TABLE ADD COLUMN for ENUM, so we'll add the fields separately
      // Note: SQLite doesn't support ENUM, so we'll use TEXT with a CHECK constraint
      
      // Add payment_gateway field
      await sequelize.query(`
        ALTER TABLE Orders ADD COLUMN payment_gateway TEXT DEFAULT 'phonepe' CHECK(payment_gateway IN ('phonepe', 'razorpay', 'stripe'));
      `, { transaction });

      // Add PhonePE fields
      await sequelize.query(`
        ALTER TABLE Orders ADD COLUMN phonepe_merchant_transaction_id TEXT;
      `, { transaction });

      await sequelize.query(`
        ALTER TABLE Orders ADD COLUMN phonepe_transaction_id TEXT;
      `, { transaction });

      await sequelize.query(`
        ALTER TABLE Orders ADD COLUMN phonepe_payment_instrument_type TEXT;
      `, { transaction });

      // Create unique index on phonepe_merchant_transaction_id
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_phonepe_merchant_transaction_id ON Orders(phonepe_merchant_transaction_id);
      `, { transaction });

    } else if (dialect === 'postgres') {
      // PostgreSQL supports ENUM and proper ALTER TABLE
      
      // Create ENUM type if it doesn't exist
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE payment_gateway_enum AS ENUM ('phonepe', 'razorpay', 'stripe');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `, { transaction });

      // Add payment_gateway field
      await sequelize.query(`
        ALTER TABLE "Orders" 
        ADD COLUMN IF NOT EXISTS payment_gateway payment_gateway_enum DEFAULT 'phonepe';
      `, { transaction });

      // Add PhonePE fields
      await sequelize.query(`
        ALTER TABLE "Orders" 
        ADD COLUMN IF NOT EXISTS phonepe_merchant_transaction_id VARCHAR(255);
      `, { transaction });

      await sequelize.query(`
        ALTER TABLE "Orders" 
        ADD COLUMN IF NOT EXISTS phonepe_transaction_id VARCHAR(255);
      `, { transaction });

      await sequelize.query(`
        ALTER TABLE "Orders" 
        ADD COLUMN IF NOT EXISTS phonepe_payment_instrument_type VARCHAR(50);
      `, { transaction });

      // Create unique index on phonepe_merchant_transaction_id
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_phonepe_merchant_transaction_id 
        ON "Orders"(phonepe_merchant_transaction_id) 
        WHERE phonepe_merchant_transaction_id IS NOT NULL;
      `, { transaction });
    }

    await transaction.commit();
    console.log('✅ Migration completed successfully: PhonePE fields added to Orders table');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  addPhonePEFields()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = addPhonePEFields;

