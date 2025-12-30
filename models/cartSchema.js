const mongoose = require("mongoose")

const {Schema} = mongoose;

const cartSchema = new Schema ({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    items : [{
        productId : {
            type : Schema.Types.ObjectId,
            ref : "Product",
            required : true
        },
        quantity : {
            type : Number,
            default : 1
        },
        price : {
            type : Number,
            required : true
        },
        totalPrice : {
            type : Number,
            required : true
        },
        regularPrice:{
            type:Number,
            required:true
        },
        appliedOfferPercentage:{
            type:Number,
            default:0,
            min:0,
            max:100
        },
        appliedOfferId:{
            type:Schema.Types.ObjectId,
            ref:"Offer",
            default:null
        },
        status : {
            type : String ,
            default : "Placed",
            enum:["Placed","Cancelled"]
        },
        cancellationReason : {
            type : String,
            default : "none"
        }
    }]
},{timestamps:true})

cartSchema.virtual("cartTotal").get(function(){
    return this.items.reduce((sum,i) => sum + i.totalPrice,0);
});

const Cart = mongoose.model("Cart",cartSchema);

module.exports = Cart;