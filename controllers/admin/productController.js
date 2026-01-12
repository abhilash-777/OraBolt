const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { default: mongoose } = require("mongoose");

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

        const CategoryDoc = await Category.findById(product.category);
        const subcategoryDoc = await subCategory.findById(product.subcategory);
        const brandDoc = await Brand.findById(product.brand)
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
        const brand = await Brand.find({isDeleted:false,isBlocked:false});
        const category = await Category.find({isDeleted:false,isListed:true});
        const subcategory = await subCategory.find({isDeleted:false,isListed:true});

        const page = parseInt(req.query.page)||1;
        const limit = 6;
        const skip = (page-1)*limit;

        const filter = {isDeleted:false};

        if(req.query.category && req.query.category !== ""){
            filter.category = req.query.category;
        }
        if(req.query.status && req.query.status !== "all"){
            const statusValue = req.query.status.trim().replace(/\s+/g, " ");
            filter.status = { $regex: `^${statusValue}$`, $options: "i" };
        }
        if(req.query.search && req.query.search.trim() !== ""){
            const searchRegex = new RegExp(req.query.search.trim(),'i');
            filter.$or = [
                {productName:searchRegex},
                {description:searchRegex}
            ]
        }

        const productData = await Product.find(filter)
        .populate("category","name")
        .populate("brand","brandName")
        .skip(skip)
        .limit(limit)
        .sort({createdAt:-1})
        .lean();
        const totalProduct = await Product.countDocuments(filter);
        const totalPage = Math.ceil(totalProduct/limit);

        const successMessage = req.query.success;
        const errorMessage = req.query.error;

        if(category && brand && subcategory){
            res.render("products",{
                category: category,
                query:req.query,
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
        return res.redirect("/admin/pageError");
    }
};

const getProduct = async function (req, res) {
    try {
        const productId = req.params.id;
        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(productId).lean();

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Send the product with ObjectId values as strings for the form
        res.json({
            success: true,
            product: {
                productName: product.productName,
                description: product.description,
                brand: product.brand.toString(),
                category: product.category.toString(),
                subcategory: product.subcategory.toString(),
                color: product.color,
                regularPrice: product.regularPrice,
                salePrice: product.salePrice,
                quantity: product.quantity,
                image: product.image || []
            }
        });
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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

const editProduct = async function (req,res) {
    try {
        const productId = req.params.id;
        const {productName,description,brand,color,quantity,regularPrice,salePrice,category,subcategory,deleteImages} = req.body;

        const product = await Product.findById(productId);
        if(!product){
            return res.status(400).json({success:false,error:"Product not found"});
        }

        const projectRoot = path.resolve(__dirname,"../../");
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

        const categoryDoc = await Category.findById(category);
        const subcategoryDoc = await subCategory.findById(subcategory);
        const brandDoc = await Brand.findById(brand);
        if (!categoryDoc || !subcategoryDoc || !brandDoc) {
            return res.status(400).json({ success: false, message: "Invalid category, subcategory, or brand ID" });
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

const deleteProduct = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.json({success:false,message:"Admin not found"});

        const productId = req.params?.id;
        if(!productId)return res.json({success:false,message:"Product id is missing"});

        const product = await Product.findById(productId);
        if(!product){
            return res.status(400).json({success:false,message:"Product not found"});
        }

        product.isDeleted = true;
        product.save();
        
        return res.json({success:true,message:"Product deleted successfull.",redirectUrl:"/admin/productLists"});
    } catch (error) {
        console.log("something went wrong while removing product.");
        return res.json({success:false,message:"something went wrong"});
    }
};

module.exports = {
    addProduct,
    loadProductsList,
    getProduct,
    toggleList,
    editProduct,
    deleteProduct
}