const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const mongoose = require("mongoose");

const subCategoryInfo = async function (req,res) {

    try {

        const page = parseInt(req.query.page)||1;
        const limit = 5;
        const skip = (page-1) * limit;

        const subCategoryData = await subCategory.find({})
        .populate("categoryId")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);
        const totalSubCategories = await subCategory.countDocuments();
        const totalPage = Math.ceil(totalSubCategories/limit);

        const categories = await Category.find({isListed:true});

        return res.render("subCategory",{
            cat:subCategoryData,
            currentPage:page,
            totalPages:totalPage,
            totalSubCategory:totalSubCategories,
            categories,
        });
        
    } catch (error) {
        console.error("Sub category info error:",error);
        res.redirect("/admin/pageError")
    }
    
};

const addSubCategory = async function (req,res) {
    
    const {name,description,offer,categoryId} = req.body;
    try {
        const trimmedName = name.trim()

        const existSubCategory = await subCategory.findOne({name:{$regex:new RegExp(`^${trimmedName}$`,'i')}});

        if(existSubCategory){
            return res.json({success:false,error:"This subcategory already exists"});
        }else{
            const newSubCategory = new subCategory({
                name,
                description,
                categoryId,
                offer:offer||0,
                offerAddedAt:offer?new Date():null
            });
            await newSubCategory.save();
            return res.json({success:true,message:"Sub Category added successfully"});
        }

    } catch (error) {
        console.error("error in creating subcategory:",error);
        return res.status(500).json({success:false,error:"Invalid server error"});
    }
    
};

const loadEditSubCategory = async function (req,res) {

    try {

        const subCategoryId = req.params.id;
        const subcategory = await subCategory.findById(subCategoryId).populate("categoryId");
        if(!subcategory){
            return res.status(404).json({error:"error sub category not found"});
        }
        const categories = await Category.find({isListed:true});
        res.render("editSubCategory",{subcategory,categories});
        
    } catch (error) {
        
    }
    
};

const editSubCategory = async function (req,res) {

    try {
        const {name,description,categoryId} = req.body;
        const subcategoryId = req.params.id;

        if(!name||!description ||!categoryId){
            return res.status(400).json({success:false,error:"All fields are required"});
        }

        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        if(!trimmedName||!trimmedDescription){
            return res.status(400).json({success:false,error:"Field cannot be empty after trimming"});
        }

        const existSubCategory = await subCategory.findOne({name:{$regex:new RegExp(`^${trimmedName}$`,'i')},_id:{$ne:subcategoryId}});
        if(existSubCategory){
            return res.status(400).json({success:false,error:"This SubCategory already exists!"});
        }

        const updatedSubcategory = await subCategory.findByIdAndUpdate(subcategoryId,
            {name:trimmedName,description:trimmedDescription,categoryId},
            {new:true,runValidators:true}
        );
        if(!updatedSubcategory){
            return res.status(404).json({success:false,error:"SubCategory not found"});
        }

        return res.status(200).json({success:true,message:"Updated successfully."});
    } catch (error) {
        if(error.code === 11000){
            return res.status(400).json({success:false,error:"SubCategory name already exists!"});
        }else{
            console.error("Edit category error:",error);
            return res.status(500).json({success:false,error:"Internal server error"});
        }
    }
    
};

const deleteSubCategory = async function (req,res) {

    try {
        const subCategoryId = req.params.id;
        const subcategory = await subCategory.findById(subCategoryId);
        if(!subcategory){
            return res.status(404).json({success:false,error:"SubCategory not found!"});
        }

        await subCategory.findByIdAndDelete(subCategoryId);
        return res.status(200).json({success:true,message:"SubCategory deleted successfully."});

    } catch (error) {
        console.error("error in delete sub category:",error);
        return res.status(500).json({success:false,error:"Internal server  error"});
    }
    
};

const toggleList = async function (req,res) {

    try {

        const {subCategoryId,isListed} = req.body;
        if(!subCategoryId){
            return res.status(400).json({success:false,error:"Missing Sub CategoryId"});
        }
        await subCategory.findByIdAndUpdate(subCategoryId,{isListed:isListed});
        res.status(200).json({success:true,message:`Sub Category${isListed}?'listed':'Unlisted'`});
        
    } catch (error) {
        console.error("error listing and unlisting sub Category:",error);
        res.status(500).json({success:false,error:"Internal server error"});
    }
    
};

const addOffer = async function (req,res){

    try {

        const {subCategoryId,offer} = req.body;
        const parsedOffer = Number(offer);
        if(!subCategoryId||isNaN(parsedOffer)){
            return res.status(400).json({success:false,error:"Invalid data"});
        }
        await subCategory.findByIdAndUpdate(subCategoryId,{offer:parsedOffer,offerAddedAt:parsedOffer > 0 ? new Date():null});
        res.json({success:true});
        
    } catch (error) {
        console.error("error updating offer:",error);
        res.status(500).json({success:false,error:"Internal server error"});
    }
    
}

module.exports = {
    subCategoryInfo,
    addSubCategory,
    loadEditSubCategory,
    editSubCategory,
    deleteSubCategory,
    toggleList,
    addOffer
}