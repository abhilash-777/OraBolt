const express = require('express');
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require('../controllers/admin/categoryController');
const subCategoryController = require("../controllers/admin/subCategoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const { adminAuth, userAuth } = require("../middlewares/auth");
const multer = require("multer");
const {uploadBrand,uploadProduct} = require("../utils/multer");
const { route } = require('./userRouter');

const router = express.Router();

router.get("/pageError", adminController.pageError);

// login management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

router.use(adminAuth);
router.get('/', adminController.loadDash);

// admin management
router.get("/user", customerController.customerInfo);
router.get('/blockCustomer', customerController.blockCustomer);
router.get('/unBlockCustomer', customerController.unBlockCustomer);

// category management
router.get('/category', categoryController.categoryInfo);
router.post('/category', categoryController.addCategory);
router.get('/category/edit/:id',categoryController.loadEditCategory);
router.patch('/category/edit/:id',categoryController.editCategory);
router.delete('/category/:id',categoryController.deleteCategory);
router.post('/category/offer',categoryController.addOffer); 
router.post('/category/toggleList',categoryController.toggleList);

//sub category management
router.get('/subCategory', subCategoryController.subCategoryInfo);
router.post('/subCategory', subCategoryController.addSubCategory);
router.get('/subCategory/edit/:id',subCategoryController.loadEditSubCategory);
router.patch('/subCategory/edit/:id',subCategoryController.editSubCategory);
router.delete('/subCategory/:id',subCategoryController.deleteSubCategory);
router.post('/subCategory/offer',subCategoryController.addOffer);
router.post('/subCategory/toggleList',subCategoryController.toggleList);

//brand management
router.get('/brand',brandController.loadBrandPage);
router.post('/brand',uploadBrand.single("image"),brandController.addBrand);
router.get('/brand/blockBrand',brandController.blockBrand);
router.get('/brand/unBlockBrand',brandController.unBlockBrand);
router.delete('/brand/:id',brandController.deleteBrand);


//product management
router.use("/addProduct",(error,req,res,next) => {
    if(error instanceof multer.MulterError){
            if(error.code === "LIMIT_FILE_SIZE"){
            return res.redirect("/admin/addProduct?error=File too large . Max file size is 10MB per file.");
        }
            if(error.code === "LIMIT_FILE_COUNT"){
            return res.redirect("/admin/addProduct?error=Too many files . max 5 files allowed");
        }
    }
    if(error.message.includes("Invalid file type")){
        return res.redirect("/admin/addProduct?error=Invalid file type. only JPEG,JPG or PNG are allowed")
    }
    next(error);
});
router.get('/addProduct',productController.loadProduct);
router.post('/addProduct',uploadProduct.array("images",10),productController.addProduct);
router.get("/productLists",productController.loadProductsList);
router.get("/productLists/edit/:id",productController.loadEditProduct);
router.post("/productLists/edit/:id",uploadProduct.array("croppedImages",10),productController.editProduct);
router.post('/productLists/toggleList',productController.toggleList);

module.exports = router;