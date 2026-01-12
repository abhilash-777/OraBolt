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
    productOffer:{
        type:Number,
        default:0,
        min:0,
        max:100
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
},{timestamps:true});

productSchema.pre("save",function(next){
    if(this.isModified("regularPrice") || this.isModified("productOffer")){
        if(this.productOffer > 0){
            this.salePrice = Math.round(this.regularPrice * (1 - this.productOffer / 100));
        }else{
            this.salePrice = this.regularPrice;
        }
    }
    next();
});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;