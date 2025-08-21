const mongoose = require("mongoose");

const {Schema} = mongoose;

const productSchema = new Schema ({
    productName : {
        type : String,
        required : true
    },
    description : {
        type : String ,
        required : true
    },
    brand : {
        type : Schema.Types.ObjectId,
        ref:"Brand",
        required : true
    },
    category : {
        type : Schema.Types.ObjectId,
        ref : "Category",
        required : true
    },
    subcategory:{
        type:Schema.Types.ObjectId,
        ref:"SubCategory",
        required:true
    },
    regularPrice : {
        type : Number,
        required : true
    },
    salePrice : {
        type : Number,
        required : true
    },
    productOffer : {
        type : Number,
        default : 0
    },
    quantity : {
        type : Number,
        default : 0
    },
    color : {
        type : String,
        required :true
    },
    image : {
        type : [String],
        required : true
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    status : {
        type : String,
        enum : ["Available","Out of Stock","Not Available"],
        required : true,
        default : "Available"
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;