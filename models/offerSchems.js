const mongoose = require("mongoose");
const {Schema} = mongoose;

const offerSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    offerType: {
        type: String,
        required: true,
        enum: ['percentage'] 
    },
    percentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    offerAppliedTo: {
        type: String,
        required: true,
        enum: ['category', 'product'] 
    },
    
    category: [{
        type: Schema.Types.ObjectId,
        ref: 'Category'
    }],
    
    product: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
offerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

offerSchema.pre("findOneAndUpdate",function(next){
    const update = this.getUpdate();
    if(update.startDate){
        return next(new Error("Start date cannot be modified"));
    }
});

// Virtual for checking if offer is currently active based on dates
offerSchema.virtual('isCurrentlyActive').get(function() {
    const now = new Date();
    return this.isActive && this.startDate <= now && this.endDate >= now;
});

// Method to get applied to text
offerSchema.methods.getAppliedToText = function() {
    switch(this.offerAppliedTo) {
        case 'category':
            return 'Category';
        case 'product':
            return 'Product';
        default:
            return 'Unknown';
    }
};

// Validation to ensure either category or product is provided based on offerAppliedTo
offerSchema.pre('save', function(next) {
    if (this.offerAppliedTo === 'category' && (!this.category || this.category.length === 0)) {
        return next(new Error('Category is required when offer is applied to category'));
    }
    if (this.offerAppliedTo === 'product' && (!this.product || this.product.length === 0)) {
        return next(new Error('Product is required when offer is applied to product'));
    }
    next();
});

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;