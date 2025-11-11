'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the categoryId column, allowing nulls for now
    await queryInterface.addColumn('Products', 'categoryId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow nulls temporarily
      references: {
        model: 'Categories',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Or 'CASCADE' if you want to delete products when a category is deleted
    });

    // We are about to clear all data in the seed script, so we don't need to populate the new column.
    // If we were preserving data, we would run a query here to populate categoryId based on the old category string.

    // Now, remove the old category column
    await queryInterface.removeColumn('Products', 'category');

    // Finally, alter the categoryId column to not allow nulls
    await queryInterface.changeColumn('Products', 'categoryId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Add the old category column back
    await queryInterface.addColumn('Products', 'category', {
      type: Sequelize.STRING(100),
      allowNull: true, // Allow nulls temporarily
    });

    // If we were preserving data, we would run a query here to populate the category string based on categoryId.

    // Remove the categoryId column
    await queryInterface.removeColumn('Products', 'categoryId');

    // Finally, alter the category column to not allow nulls
    await queryInterface.changeColumn('Products', 'category', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
  }
};