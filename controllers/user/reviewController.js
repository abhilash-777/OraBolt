const Review = require('../../models/reviewSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

// Check if user is eligible to review a product
const checkReviewEligibility = async (req, res) => {
    try {
        const { productId, orderId } = req.params;
        const userId = req.session.user._id;

        // Check if order exists and is delivered
        const order = await Order.findOne({
            _id: new mongoose.Types.ObjectId(orderId),
            userId: userId,
            "orderedItems.product": new mongoose.Types.ObjectId(productId),
            "orderedItems.status": "Delivered"
        });

        if (!order) {
            return res.json({ 
                eligible: false, 
                message: "Product must be delivered to write a review" 
            });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({
            productId: new mongoose.Types.ObjectId(productId),
            userId: userId,
            orderId: new mongoose.Types.ObjectId(orderId)
        });

        if (existingReview) {
            return res.json({ 
                eligible: false, 
                message: "You have already reviewed this product",
                review: existingReview
            });
        }

        return res.json({ 
            eligible: true, 
            message: "You can review this product" 
        });

    } catch (error) {
        console.error("Error checking review eligibility:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error checking review eligibility" 
        });
    }
};

// Submit a new review
const submitReview = async (req, res) => {
    try {
        const { productId, orderId, rating, title, comment, images } = req.body;
        const userId = req.session.user._id;

        // Validate inputs
        if (!productId || !orderId || !rating || !title || !comment) {
            return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                message: "Rating must be between 1 and 5" 
            });
        }

        const ordId = new mongoose.Types.ObjectId(orderId);
        const proId = new mongoose.Types.ObjectId(productId);

        // Verify order and delivery status
        const order = await Order.findOne({
            _id: ordId,
            userId: userId,
            "orderedItems.product": proId,
            "orderedItems.status": "Delivered"
        });

        if (!order) {
            return res.status(403).json({ 
                success: false, 
                message: "You can only review delivered products" 
            });
        }

        // Check for existing review
        const existingReview = await Review.findOne({
            productId: proId,
            userId: userId,
            orderId: ordId
        });

        if (existingReview) {
            return res.status(400).json({ 
                success: false, 
                message: "You have already reviewed this product" 
            });
        }

        // Create new review
        const review = new Review({
            productId: proId,
            userId: userId,
            orderId: ordId,
            rating: parseInt(rating),
            title: title.trim(),
            comment: comment.trim(),
            images: images || [],
            isVerifiedPurchase: true,
            status: 'approved' // Auto-approve or set to 'pending' for manual review
        });

        await review.save();

        // Update product rating
        await updateProductRating(productId);

        return res.status(201).json({ 
            success: true, 
            message: "Review submitted successfully",
            review: review
        });

    } catch (error) {
        console.error("Error submitting review:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error submitting review" 
        });
    }
};

// Get all reviews for a product
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'recent'; // recent, helpful, rating-high, rating-low
        const filterRating = req.query.rating ? parseInt(req.query.rating) : null;

        const query = {
            productId: productId,
            status: 'approved'
        };

        if (filterRating) {
            query.rating = filterRating;
        }

        let sortOptions = {};
        switch(sortBy) {
            case 'helpful':
                sortOptions = { helpfulCount: -1, createdAt: -1 };
                break;
            case 'rating-high':
                sortOptions = { rating: -1, createdAt: -1 };
                break;
            case 'rating-low':
                sortOptions = { rating: 1, createdAt: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        const skip = (page - 1) * limit;

        const reviews = await Review.find(query)
            .populate('userId', 'name')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalReviews = await Review.countDocuments(query);

        // Get rating summary
        const ratingSummary = await Review.aggregate([
            {
                $match: {
                    productId: new mongoose.Types.ObjectId(productId),
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                    ratings: { $push: "$rating" }
                }
            }
        ]);

        let ratingData = {
            average: 0,
            total: 0,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };

        if (ratingSummary.length > 0) {
            ratingData.average = Math.round(ratingSummary[0].avgRating * 10) / 10;
            ratingData.total = ratingSummary[0].totalReviews;
            ratingSummary[0].ratings.forEach(rating => {
                ratingData.distribution[rating]++;
            });
        }

        return res.json({
            success: true,
            reviews: reviews,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews: totalReviews,
                hasNext: page * limit < totalReviews,
                hasPrev: page > 1
            },
            ratingData: ratingData
        });

    } catch (error) {
        console.error("Error getting product reviews:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error loading reviews" 
        });
    }
};

// Mark a review as helpful
const markReviewHelpful = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.session.user._id;

        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ 
                success: false, 
                message: "Review not found" 
            });
        }

        // Check if user already marked as helpful
        const alreadyMarked = review.helpfulUsers.some(
            id => id.toString() === userId.toString()
        );

        if (alreadyMarked) {
            // Remove helpful mark
            review.helpfulUsers = review.helpfulUsers.filter(
                id => id.toString() !== userId.toString()
            );
            review.helpfulCount = Math.max(0, review.helpfulCount - 1);
        } else {
            // Add helpful mark
            review.helpfulUsers.push(userId);
            review.helpfulCount += 1;
        }

        await review.save();

        return res.json({ 
            success: true, 
            helpful: !alreadyMarked,
            helpfulCount: review.helpfulCount
        });

    } catch (error) {
        console.error("Error marking review helpful:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error updating review" 
        });
    }
};

// Get user's reviewable orders
const getReviewableOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const deliveredOrders = await Order.find({
            userId: userId,
            "orderedItems.status": "Delivered"
        })
        .populate('orderedItems.product')
        .sort({ createdAt: -1 })
        .lean();

        // Filter products that haven't been reviewed
        const reviewableProducts = [];

        for (const order of deliveredOrders) {
            for (const item of order.orderedItems) {
                if (item.status === 'Delivered') {
                    const existingReview = await Review.findOne({
                        productId: item.product._id,
                        userId: userId,
                        orderId: order._id
                    });

                    if (!existingReview) {
                        reviewableProducts.push({
                            orderId: order._id,
                            orderDate: order.createdAt,
                            product: item.product,
                            quantity: item.quantity
                        });
                    }
                }
            }
        }

        return res.json({ 
            success: true, 
            reviewableProducts: reviewableProducts 
        });

    } catch (error) {
        console.error("Error getting reviewable orders:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error loading reviewable products" 
        });
    }
};

// Helper function to update product rating
async function updateProductRating(productId) {
    try {
        const stats = await Review.aggregate([
            {
                $match: {
                    productId: new mongoose.Types.ObjectId(productId),
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            await Product.findByIdAndUpdate(productId, {
                averageRating: Math.round(stats[0].averageRating * 10) / 10,
                totalReviews: stats[0].totalReviews
            });
        }
    } catch (error) {
        console.error("Error updating product rating:", error);
    }
}

// Update user's own review
const updateUserReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, title, comment } = req.body;
        const userId = req.session.user._id;

        // Validate inputs
        if (!rating || !title || !comment) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Find review and verify ownership
        const review = await Review.findOne({
            _id: reviewId,
            userId: userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you don't have permission to edit it"
            });
        }

        // Update review
        review.rating = parseInt(rating);
        review.title = title.trim();
        review.comment = comment.trim();
        review.status = 'approved'; // Keep approved or change to pending based on your needs

        await review.save();

        // Update product rating
        await updateProductRating(review.productId);

        return res.json({
            success: true,
            message: "Review updated successfully",
            review: review
        });

    } catch (error) {
        console.error("Error updating review:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating review"
        });
    }
};

// Delete user's own review
const deleteUserReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.session.user._id;

        // Find review and verify ownership
        const review = await Review.findOne({
            _id: reviewId,
            userId: userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you don't have permission to delete it"
            });
        }

        const productId = review.productId;

        await Review.findByIdAndDelete(reviewId);

        // Update product rating
        await updateProductRating(productId);

        return res.json({
            success: true,
            message: "Review deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting review:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting review"
        });
    }
};

module.exports = {
    checkReviewEligibility,
    submitReview,
    getProductReviews,
    markReviewHelpful,
    getReviewableOrders,
    updateUserReview,
    deleteUserReview
};