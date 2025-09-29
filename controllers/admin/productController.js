const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const loadProduct = async function (req,res) {

    try {

        const category = await Category.find({isListed:true});
        const subcategory = await subCategory.find({isListed:true})
        const brand = await Brand.find({isBlocked:false});

        const successMessage = req.query.success;
        const errorMessage = req.query.error;
        
        res.render("addProduct",{
            category:category,
            brand:brand,
            subcategory:subcategory,
            success:successMessage,
            error:errorMessage
        });
        
    } catch (error) {
        return res.redirect("/admin/pageError");
    }
    
};

const validateProductData = (data) => {
    const requiredField = ["productName","description","category","brand","subcategory","color","regularPrice","salePrice","quantity"];
    return requiredField.every(field => data[field] && data[field].toString().trim() !== "");
};

const processImages = async function (files,folderName) {
    const images = [];
    const uploadDir = path.join(__dirname,`../../public/uploads/${folderName}`);
    if(!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir,{recursive:true});
    }
    for(const file of files){
        const originalPath = file.path;
        const resizedFilename = `resized-${Date.now()}-${file.filename}`;
        const resizedPath = path.join(uploadDir,resizedFilename);
        try {
            await sharp(originalPath)
            .resize({
                width:1200,
                height:1200,
                fit:"inside",
                withoutEnlargement:true
            })
            .toFile(resizedPath);
            images.push(resizedFilename);
            if(fs.existsSync(originalPath)){
                fs.unlinkSync(originalPath);
            }
        } catch (error) {
            console.error("Error: processing image ",error);
        }
    }
    return images
};

const addProduct = async function (req,res) {

    try {

        const product = req.body;
        if(!validateProductData(product)||!(req.files && req.files.length > 0)){
            return res.status(400).json({success:false,message:"Please fill all required fields!"});
        }
        const productExists = await Product.findOne({productName:{$regex:new RegExp(`^${product.productName}$`,'i')}});

        if(productExists){
            return res.status(400).json({success:false,message:"Product already exists. Please try with another product name"});
        }

        let images = [];
        if(req.files?.length > 0){
            images = await processImages(req.files,"productsImages");
        }

        const CategoryDoc = await Category.findOne({name:product.category});
        const subcategoryDoc = await subCategory.findOne({name:product.subcategory});
        const brandDoc = await Brand.findOne({brandName:product.brand})
        if(!CategoryDoc||!subcategoryDoc){
            return res.status(400).json({message:"Invalid category name or subcategory name"});
        }
        if(!brandDoc){
            return res.status(404).json({message:"brand name is required"});
        }

        const newProduct = new Product({
            productName:product.productName,
            description:product.description,
            brand:brandDoc._id,
            category:CategoryDoc._id,
            subcategory:subcategoryDoc._id,
            regularPrice:parseFloat(product.regularPrice),
            salePrice:parseFloat(product.salePrice),
            quantity:parseInt(product.quantity),
            color:product.color,
            image:images,
            status:"Available"
        });

        await newProduct.save();
        res.status(200).json({success:true,message:"Product added successfully"});
        
    } catch (error) {
        console.log("error add product:",error);
        return res.status(500).json({success:false,message:"Something went wrong!"});
    }
    
};

const loadProductsList = async function (req,res) {

    try {

        const brand = await Brand.find();
        const category = await Category.find({isListed:true});
        const subcategory = await subCategory.find({isListed:true});
        const page = req.query.page||1;
        const limit = 6;
        const skip = (page-1)*limit;

        const productData = await Product.find()
        .populate("category","name")
        .populate("brand","brandName")
        .skip(skip)
        .limit(limit)
        .sort({createdAt:-1})
        .lean();
        const totalProduct = await Product.countDocuments();
        const totalPage = Math.ceil(totalProduct/limit);

        const successMessage = req.query.success;
        const errorMessage = req.query.error;

        if(category && brand && subcategory){
            res.render("products",{
                category: category,
                brand: brand,
                subcategory: subcategory,
                currentPage: page,
                product: productData,
                totalProducts: totalProduct,
                totalPages: totalPage,
                success: successMessage,
                error: errorMessage
            });
        }else{
            res.render("admin-error");
        }
        
    } catch (error) {
        return res.status(400).json({error:"error to load product list page:"});
    }
    
};

const toggleList = async function (req,res) {

    try {
        const {productId,isBlocked} = req.body;
        if(!productId){
            return res.status(400).json({success:false,error:"error , product ID not found"});
        }
        await Product.findByIdAndUpdate(productId,{isBlocked:isBlocked});
        return res.status(200).json({success:true,message:`Product${isBlocked?"Listed":"UnListed"}`});
    } catch (error) {
        console.error("error , product listing and unlisting:",error);
        res.status(500).json({message:"Internal server"});
    }
    
};

const loadEditProduct = async (req,res) => {

    try {

        const productId = req.params.id;
        const product = await Product.findById(productId)
        .populate("category")
        .populate("subcategory")
        .populate("brand");
        const category = await Category.find({});
        const brand = await Brand.find({});
        const subcategory = await subCategory.find({});

        if(!product){
            return res.status(400).json({success:false,error:"product not found"});
        }
        res.render("editProduct",{product,category,brand,subcategory});
    } catch (error) {
        console.error("error to load edit product:",error);
        return res.status(500).json({success:false,error:"Internal server error"});
    }
    
};

const editProduct = async function (req,res) {

    try {
        const productId = req.params.id;
        const {productName,description,brand,
            color,quantity,regularPrice,
            salePrice,category,subcategory,deleteImages} = req.body;

        const product = await Product.findById(productId);
        if(!product){
            return res.status(400).json({success:false,error:"Product not found"});
        }

        const projectRoot = path.resolve("../../");
        const del = deleteImages ? JSON.parse(deleteImages):[];
        if(Array.isArray(del) && del.length){
            product.image = product.image.filter(img => {
                if(del.includes(img)){
                    const filePath = path.join(projectRoot,"public/uploads/productsImages",img);
                    try {
                        if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    } catch (error) {
                        console.warn("something error:",error);
                    }
                    return false
                }
                return true
            })
        }

        if(req.files && req.files?.length > 0){
            req.files.forEach(file => {
                product.image.push(file.filename);
            });
        }

        Object.assign(product,{
            productName,description,brand,color,quantity,category,subcategory,regularPrice,salePrice
        })

        await product.save()
        res.json({success:true,message:"Product updated successfully",productId});

    } catch (error) {
        console.error("error editing product:",error);
        res.status(500).json({success:false,error:"Internal server"});
    }
    
};

module.exports = {
    loadProduct,
    addProduct,
    loadProductsList,
    toggleList,
    loadEditProduct,
    editProduct
}