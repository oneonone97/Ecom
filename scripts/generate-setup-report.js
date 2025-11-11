/**
 * Generate Supabase Setup Report
 * 
 * This script generates a comprehensive report of the Supabase database setup.
 * 
 * Usage:
 * node scripts/generate-setup-report.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

async function generateReport() {
  try {
    console.log('\n📊 Generating Supabase Setup Report...\n');
    
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      database: {},
      tables: [],
      foreignKeys: [],
      indexes: [],
      enums: [],
      statistics: {}
    };
    
    // Get database info
    const [versionResult] = await sequelize.query("SELECT version();");
    report.database = {
      version: versionResult[0].version,
      connection: process.env.DATABASE_URL ? 'Configured' : 'Not configured',
      isSupabase: process.env.DATABASE_URL?.includes('supabase.co') || false
    };
    
    // Get all tables with row counts
    console.log('📋 Gathering table information...');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);
    
    for (const table of tables) {
      const [rowCount] = await sequelize.query(`
        SELECT COUNT(*) as count FROM "${table.table_name}";
      `);
      
      const columns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
      `, {
        bind: [table.table_name],
        type: sequelize.QueryTypes.SELECT
      });
      
      report.tables.push({
        name: table.table_name,
        rowCount: parseInt(rowCount[0].count),
        columnCount: columns.length,
        columns: columns.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default
        }))
      });
    }
    
    // Get foreign keys
    console.log('🔗 Gathering foreign key information...');
    const [foreignKeys] = await sequelize.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    
    report.foreignKeys = foreignKeys.map(fk => ({
      table: fk.table_name,
      column: fk.column_name,
      referencesTable: fk.foreign_table_name,
      referencesColumn: fk.foreign_column_name,
      constraintName: fk.constraint_name
    }));
    
    // Get indexes
    console.log('📑 Gathering index information...');
    const [indexes] = await sequelize.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE 'pg_%'
      ORDER BY tablename, indexname;
    `);
    
    const indexesByTable = {};
    indexes.forEach(idx => {
      if (!indexesByTable[idx.tablename]) {
        indexesByTable[idx.tablename] = [];
      }
      indexesByTable[idx.tablename].push({
        name: idx.indexname,
        definition: idx.indexdef
      });
    });
    
    report.indexes = Object.keys(indexesByTable).map(table => ({
      table,
      indexes: indexesByTable[table]
    }));
    
    // Get ENUM types
    console.log('🔤 Gathering ENUM type information...');
    const [enums] = await sequelize.query(`
      SELECT
        t.typname AS enum_name,
        string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname LIKE 'enum_%'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    
    report.enums = enums.map(e => ({
      name: e.enum_name,
      values: e.enum_values.split(', ').map(v => v.trim())
    }));
    
    // Calculate statistics
    console.log('📈 Calculating statistics...');
    report.statistics = {
      totalTables: report.tables.length,
      totalRows: report.tables.reduce((sum, t) => sum + t.rowCount, 0),
      totalColumns: report.tables.reduce((sum, t) => sum + t.columnCount, 0),
      totalForeignKeys: report.foreignKeys.length,
      totalIndexes: indexes.length,
      totalEnums: report.enums.length
    };
    
    // Generate markdown report
    const markdown = generateMarkdownReport(report);
    
    // Write report file
    const reportPath = path.join(__dirname, '..', 'SUPABASE_SETUP_REPORT.md');
    fs.writeFileSync(reportPath, markdown, 'utf8');
    
    console.log(`\n✅ Report generated: ${reportPath}\n`);
    console.log('📊 Summary:');
    console.log(`   - Tables: ${report.statistics.totalTables}`);
    console.log(`   - Total Rows: ${report.statistics.totalRows}`);
    console.log(`   - Foreign Keys: ${report.statistics.totalForeignKeys}`);
    console.log(`   - Indexes: ${report.statistics.totalIndexes}`);
    console.log(`   - ENUM Types: ${report.statistics.totalEnums}\n`);
    
    return report;
  } catch (error) {
    console.error('\n❌ Report generation failed:', error.message);
    logger.error('Report generation error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

function generateMarkdownReport(report) {
  let md = `# Supabase Database Setup Report\n\n`;
  md += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
  md += `---\n\n`;
  
  // Database Information
  md += `## Database Information\n\n`;
  md += `- **Version:** ${report.database.version}\n`;
  md += `- **Connection:** ${report.database.connection}\n`;
  md += `- **Provider:** ${report.database.isSupabase ? 'Supabase' : 'PostgreSQL'}\n\n`;
  
  // Statistics
  md += `## Statistics\n\n`;
  md += `- **Total Tables:** ${report.statistics.totalTables}\n`;
  md += `- **Total Rows:** ${report.statistics.totalRows}\n`;
  md += `- **Total Columns:** ${report.statistics.totalColumns}\n`;
  md += `- **Foreign Keys:** ${report.statistics.totalForeignKeys}\n`;
  md += `- **Indexes:** ${report.statistics.totalIndexes}\n`;
  md += `- **ENUM Types:** ${report.statistics.totalEnums}\n\n`;
  
  // Tables
  md += `## Tables\n\n`;
  report.tables.forEach(table => {
    md += `### ${table.name}\n\n`;
    md += `- **Rows:** ${table.rowCount}\n`;
    md += `- **Columns:** ${table.columnCount}\n\n`;
    md += `**Columns:**\n\n`;
    md += `| Column | Type | Nullable | Default |\n`;
    md += `|--------|------|----------|----------|\n`;
    table.columns.forEach(col => {
      const defaultVal = col.default ? col.default.substring(0, 50) : '-';
      md += `| ${col.name} | ${col.type} | ${col.nullable ? 'Yes' : 'No'} | ${defaultVal} |\n`;
    });
    md += `\n`;
  });
  
  // Foreign Keys
  md += `## Foreign Key Relationships\n\n`;
  md += `| Table | Column | References Table | References Column |\n`;
  md += `|-------|--------|------------------|------------------|\n`;
  report.foreignKeys.forEach(fk => {
    md += `| ${fk.table} | ${fk.column} | ${fk.referencesTable} | ${fk.referencesColumn} |\n`;
  });
  md += `\n`;
  
  // Indexes
  md += `## Indexes\n\n`;
  report.indexes.forEach(tableIndex => {
    md += `### ${tableIndex.table}\n\n`;
    tableIndex.indexes.forEach(idx => {
      md += `- **${idx.name}**\n`;
      md += `  \`\`\`sql\n  ${idx.definition}\n  \`\`\`\n\n`;
    });
  });
  
  // ENUM Types
  md += `## ENUM Types\n\n`;
  report.enums.forEach(enumType => {
    md += `### ${enumType.name}\n\n`;
    md += `**Values:** ${enumType.values.join(', ')}\n\n`;
  });
  
  // Expected Tables Checklist
  md += `## Expected Tables Checklist\n\n`;
  const expectedTables = [
    'Users', 'Categories', 'Products', 'Carts', 'CartItems',
    'Orders', 'OrderItems', 'Reviews', 'Wishlists', 'WishlistItems', 'RefreshTokens'
  ];
  
  expectedTables.forEach(tableName => {
    const exists = report.tables.some(t => t.name === tableName);
    md += `- [${exists ? 'x' : ' '}] ${tableName}\n`;
  });
  md += `\n`;
  
  md += `---\n\n`;
  md += `*This report was auto-generated by the Supabase setup script.*\n`;
  
  return md;
}

// Run report generation if called directly
if (require.main === module) {
  generateReport()
    .then(() => {
      console.log('Report generation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Report generation failed:', error);
      process.exit(1);
    });
}

module.exports = generateReport;

