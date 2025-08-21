const mongoose = require("mongoose");

const {Schema} = mongoose;

const subCategorySchema = new Schema({
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
    categoryId:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
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


const subCategory = mongoose.model("SubCategory",subCategorySchema);

module.exports = subCategory;