const mongoose = require("mongoose");
const {Schema} = mongoose;

const wishlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    products: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        addedOn: {
            type: Date,
            default: Date.now
        },
        // Store offer details at time of adding
        effectivePrice: {
            type: Number,
            required: true
        },
        regularPrice: {
            type: Number,
            required: true
        },
        appliedOfferPercentage: {
            type: Number,
            default: 0
        },
        appliedOfferId: {
            type: Schema.Types.ObjectId,
            ref: "Offer",
            default: null
        },
        savings: {
            type: Number,
            default: 0
        },
        hasOffer: {
            type: Boolean,
            default: false
        },
        isDeleted:{
            type:Boolean,
            default:false
        }
    }]
}, {timestamps: true});

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;