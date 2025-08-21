const mongoose = require("mongoose");

const {Schema} = mongoose;

const categorySchema = new Schema({
    name : {
        type : String,
        required : true,
        unique:true
    },
    description : {
        type : String,
        required : true
    },
    isListed : {
        type : Boolean,
        default : false
    },
    offer : {
        type  : Number,
        default : 0
    },
    offerAddedAt:{
        type:Date,
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
},{timestamps:true});


const Category = mongoose.model("Category",categorySchema);

module.exports = Category;