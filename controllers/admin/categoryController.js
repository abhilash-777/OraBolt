const { default: mongoose } = require("mongoose");
const Category = require("../../models/categorySchema");


const categoryInfo = async function (req,res) {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1) * limit;

        const searchQuery = req.query.search ? req.query.search.trim() : "";

        let filter = {};
        if (searchQuery) {
            filter = {
                $or: [
                    { name: { $regex: searchQuery, $options: "i" } },
                    { description: { $regex: searchQuery, $options: "i" } }
                ]
            };
        }

        const categoryData = await Category.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({createdAt:-1});

        const totalCategory = await Category.countDocuments();
        const totalPage = Math.ceil(totalCategory/limit);

        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPage,
            totalCategories:totalCategory,
            searchQuery
        })
        
    } catch (error) {
        console.error("Category info error",error);
        res.redirect("/admin/pageError");
    }
};

const addCategory = async function (req,res) {
    const {name,description} = req.body;
    try {

        const trimmedName = name.trim();
        const existCategory = await Category.findOne({name:{$regex:new RegExp(`^${trimmedName}$`,'i')}});
        if(existCategory){
           return res.json({success:false,error:"Category already exists"});
        }else{
            const newCategory = new Category({
                name:trimmedName,
                description,
            });
            await newCategory.save();
            return res.status(200).json({success:true,redirectUrl:"/admin/category"});
        }

    } catch (error) {
        return res.status(500).json({error:"Internal Server Error"});
    } 
};

const loadEditCategory = async function (req,res) {

    try {
        const categoryId = req.params.id;
        if(!mongoose.Types.ObjectId.isValid(categoryId)){
            return res.redirect("/admin/pageError")
        }
        const category = await Category.findById(categoryId);
        if(!category){
            return res.status(400).json({error:"error Category not found"});
        }
        res.render("editCategory",{category});
    } catch (error) {
        console.error("error to load edit category page:",error);
        return res.status(500).json({error:"Internal server error"});
    }
    
};

const editCategory = async function (req,res) {

    try {
        const {name,description} = req.body;
        const categoryId = req.params.id;
        if(!mongoose.Types.ObjectId.isValid(categoryId)){
            return res.redirect("/admin/pageError")
        }
        if(!name||!description){
            return res.status(400).json({success:false,error:"Invalid fields.All fields are required!"});
        }

        const trimName = name.trim();
        const trimDescription = description.trim();
        if(!trimName||!trimDescription){
            return res.status(400).json({success:false,error:"fields cannot be empty after trimming!"});
        }

        const existingCategory = await Category.findOne({name:{$regex:new RegExp(`^${trimName}$`,'i')},_id:{$ne:categoryId}});
        if(existingCategory){
            return res.status(400).json({message:"Category name already exist"});
        }

        const updatedCategory = await Category.findByIdAndUpdate(categoryId,
            {name:trimName,description:trimDescription},
            {new:true,runValidators:true}
        );
        if(!updatedCategory){
            return res.status(400).json({success:false,message:"Category not found"});
        }

        res.status(200).json({success:true,message:"Category updated successfully",category:updatedCategory});

    } catch (error) {
        if(error.code === 11000){
            return res.status(400).json({success:false,error:"Category name already exists!"});
        }else{
            console.error("Edit category error:",error);
            return res.status(500).json({success:false,error:"Internal server error"});
        }
    }
    
};

const deleteCategory = async function (req,res) {
    try {
        const categoryId = req.params.id;
        if(!mongoose.Types.ObjectId.isValid(categoryId)){
            return res.redirect("/admin/pageError")
        }
        const category = await Category.findById(categoryId);
        if(!category){
            return res.status(400).json({success:false,message:"Category not found"});
        }
        await Category.findByIdAndDelete(categoryId);
        return res.status(200).json({success:true});
    } catch (error) {
        console.error("delete category error:",error);
        return res.status(500).json({success:false,error:"Internal server error"});
    } 
};

const toggleList = async function (req,res) {
    try {

        const {categoryId,isListed} = req.body;
        if(!categoryId){
            return res.status(400).status({success:false,error:"Missing Category Id"});
        }
        await Category.findByIdAndUpdate(categoryId,{isListed:isListed});
        res.status(200).json({success:true,message:`Category ${isListed ? 'Listed':'UnListed'}`});
        
    } catch (error) {
        console.error("error toggle listing",error);
        res.status(500).json({success:false,message:"Server error"});
    }  
};

module.exports = {
    categoryInfo,
    addCategory,
    loadEditCategory,
    editCategory,
    deleteCategory,
    toggleList
}