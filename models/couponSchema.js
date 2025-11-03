const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expireOn: {
        type: Date,
        required: true
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 1
    },
    minimumPrice: {
        type: Number,
        required: true,
        min: 0
    },
    isList: {
        type: Boolean,
        default: true
    },
    usedBy: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        usedAt: {
            type: Date,
            default: Date.now
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order"
        }
    }],
    usageLimit: {
        type: Number,
        default: null // null means no limit
    }
}, {
    timestamps: true
});

// Method to check if user has already used this coupon
couponSchema.methods.hasUserUsed = function(userId) {
    return this.usedBy.some(usage => usage.user.equals(userId));
};

// Method to mark coupon as used by a user
couponSchema.methods.markAsUsed = function(userId, orderId = null) {
    this.usedBy.push({
        user: userId,
        orderId: orderId,
        usedAt: new Date()
    });
    return this.save();
};

// Static method to validate coupon for a user
couponSchema.statics.validateCoupon = async function(couponName, userId, orderAmount) {
 try {
        const coupon = await this.findOne({
            name: couponName.toUpperCase().trim(),
            isList: true,
            expireOn: { $gte: new Date() }
        });

        if (!coupon) {
            return { isValid: false, message: "Invalid or expired coupon" };
        }

        if (orderAmount < coupon.minimumPrice) {
            return { 
                isValid: false, 
                message: `Minimum order amount should be ₹${coupon.minimumPrice}` 
            };
        }

        if (coupon.hasUserUsed(userId)) {
            return { isValid: false, message: "You have already used this coupon" };
        }

        if (coupon.usageLimit && coupon.usedBy.length >= coupon.usageLimit) {
            return { isValid: false, message: "Coupon usage limit reached" };
        }

        return { 
            isValid: true, 
            coupon: coupon,
            discountAmount: coupon.offerPrice,
            finalAmount: orderAmount - coupon.offerPrice
        };
    } catch (error) {
        console.error("Error validating coupon:", error);
        return { isValid: false, message: "Error validating coupon" };
    }
};

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;