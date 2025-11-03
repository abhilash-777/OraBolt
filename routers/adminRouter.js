const express = require('express');
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require('../controllers/admin/categoryController');
const subCategoryController = require("../controllers/admin/subCategoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const offerController = require("../controllers/admin/offerController");
const couponController = require("../controllers/admin/couponController");
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

//dashboard Managemanet
router.get('/api/chart-data', adminController.getChartDataAPI);
router.get("/sales-report",adminController.generateSalesReport);

// user management
router.get("/user", customerController.customerInfo);
router.get('/blockCustomer', customerController.blockCustomer);
router.get('/unBlockCustomer', customerController.unBlockCustomer);

// category management
router.get('/category', categoryController.categoryInfo);
router.post('/category', categoryController.addCategory);
router.get('/category/edit/:id',categoryController.loadEditCategory);
router.patch('/category/edit/:id',categoryController.editCategory);
router.delete('/category/:id',categoryController.deleteCategory);
router.post('/category/toggleList',categoryController.toggleList);

//sub category management
router.get('/subCategory', subCategoryController.subCategoryInfo);
router.post('/subCategory', subCategoryController.addSubCategory);
router.get('/subCategory/edit/:id',subCategoryController.loadEditSubCategory);
router.patch('/subCategory/edit/:id',subCategoryController.editSubCategory);
router.delete('/subCategory/:id',subCategoryController.deleteSubCategory);
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
router.delete("/productLists/remove/:id",productController.deleteProduct);
router.post('/productLists/toggleList',productController.toggleList);

//order Management
router.get("/order-list", orderController.loadOrderList);
router.get("/order-details/:id", orderController.loadOrderDetails)
router.post("/order-delete/:id", orderController.deleteOrder);
// Update overall order status
router.post("/order-status/:id", orderController.updateOrderStatus);
router.post("/order/payment-status/:id", orderController.updatePaymentStatus);
router.post("/order/item-status/:orderId/:itemId", orderController.updateItemStatus);
// Update return request status (Approve / Reject)
router.post("/order/item-return/:orderId/:itemId", orderController.handleReturnDecision);

//offer management
router.get("/offers",offerController.loadOffers);
router.get("/offers/add",offerController.loadAddOffer);
router.post("/offers/add",offerController.addOffer);
router.get("/offers/edit",offerController.loadEditOffer);
router.put("/offers/edit",offerController.editOffer);
router.delete("/offers/remove/:id",offerController.deleteOffer);
router.patch("/offers/toggle/:id",offerController.statusChange);

//coupon management
router.get("/coupons", couponController.getAllCoupons);
router.get("/coupons/create", couponController.getCreateCoupon);
router.post("/coupons/create", couponController.createCoupon);
router.delete("/coupons/delete/:id", couponController.deleteCoupon);
router.patch("/coupons/toggle-status/:id", couponController.toggleCouponStatus);

module.exports = router;