const mongoose = require("mongoose");
const Wallet = require("./walletSchema");

const {Schema} = mongoose;

const userSchema = new Schema({
    name:{
        type : String,
        required : true,
    },
    email : {
        type : String,
        required : true,
        unique : true,
    },
    phone : {
        type : String,
        required : false,
        unique : false,
        sparse : true,
        default : null
    },
    googleId : {
        type : String,
        unique : true,
        sparse:true
    },
    password : {
        type : String,
        required : false
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    isAdmin : {
        type : Boolean,
        default : false
    },
    profileImage:{
        type:String,
        default:null
    },
    cart : [{
        type : Schema.Types.ObjectId,
        ref : "Cart"
    }],
    wishlist : [{
        type : Schema.Types.ObjectId,
        ref : "wishlist"
    }],
    orderHistory : [{
        type : Schema.Types.ObjectId,
        ref : "Order"
    }],
    createdOn : {
        type : Date,
        default : Date.now
    },
    referralCode : {
        type : String,
        unique : true,
        required : true
    },
    referredBy : {
        type : Schema.Types.ObjectId,
        ref : "User",
        default : null
    },
    redeemed : {
        type : Boolean
    },
    redeemedUsers : [{
        type : Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory : [{
        category : {
            type : Schema.Types.ObjectId,
            ref : "Category"
        },
        brand : {
            type : String 
        },
        searchOn : {
            type : Date,
            default : Date.now
        }
    }]
});

userSchema.post("save",async function (doc) {
    if(!doc.isNew)return
    const existingWallet = await Wallet.findOne({userId:doc._id});
    if(!existingWallet){
        await Wallet.create({userId:doc._id});
    }
});

const User = mongoose.model("User",userSchema);

module.exports = User;