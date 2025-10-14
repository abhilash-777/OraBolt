const mongoose = require("mongoose");

const {Schema} = mongoose;

const addressSchema = new Schema({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    }, 
    addressType: {
        type: String,
        required: true,
        enum: ["Home", "Work", "Other"],
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    street:{
        type:String,
        required:true
    },
    city: {
        type: String,
        required: true
    },
    landMark: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: Number,
        required: true,
        match: /^\d{6}$/
    },
    phone: {
        type: String,
        required: true,
        match: /^\d{10}$/
    },
    altPhone: {
        type: String,
        match: /^\d{10}$/
    },
    isDefault: {
        type: Boolean,
        default: false
    }
},{timestamps:true})


const Address = mongoose.model("Address",addressSchema);

module.exports = Address;