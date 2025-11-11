const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get all reviews for a product
 * @route GET /api/products/:productId/reviews
 */
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const reviews = await Review.findAndCountAll({
      where: { productId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      reviews: reviews.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: reviews.count,
        pages: Math.ceil(reviews.count / limit)
      }
    });
  } catch (error) {
    logger.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

/**
 * Create a review for a product
 * @route POST /api/products/:productId/reviews
 */
exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      where: { productId, userId }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Create review
    const review = await Review.create({
      productId,
      userId,
      rating,
      comment
    });

    // Update product rating
    await updateProductRating(productId);

    // Fetch the created review with user details
    const createdReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    logger.info(`Review created for product ${productId} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: createdReview
    });
  } catch (error) {
    logger.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
};

/**
 * Update a review
 * @route PUT /api/reviews/:id
 */
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Update review
    await review.update({
      rating: rating || review.rating,
      comment: comment !== undefined ? comment : review.comment
    });

    // Update product rating
    await updateProductRating(review.productId);

    const updatedReview = await Review.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    logger.info(`Review ${id} updated by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    logger.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: error.message
    });
  }
};

/**
 * Delete a review
 * @route DELETE /api/reviews/:id
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review or is admin
    if (review.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    const productId = review.productId;
    await review.destroy();

    // Update product rating
    await updateProductRating(productId);

    logger.info(`Review ${id} deleted by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    logger.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
};

/**
 * Get user's reviews
 * @route GET /api/users/me/reviews
 */
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user.id;

    const reviews = await Review.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'image', 'price']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    logger.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user reviews',
      error: error.message
    });
  }
};

/**
 * Helper function to update product rating
 */
async function updateProductRating(productId) {
  try {
    const reviews = await Review.findAll({
      where: { productId },
      attributes: ['rating']
    });

    if (reviews.length === 0) {
      await Product.update(
        { rating: null, reviews: 0 },
        { where: { id: productId } }
      );
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = (totalRating / reviews.length).toFixed(1);

    await Product.update(
      { rating: parseFloat(avgRating), reviews: reviews.length },
      { where: { id: productId } }
    );
  } catch (error) {
    logger.error('Update product rating error:', error);
  }
}
