const express = require("express");
const router = express.Router();
const userControl = require("../controllers/user/userControl");
const profileController = require("../controllers/user/profileController");
const passport = require("passport");
const {userAuth , adminAuth,resetVerification} = require("../middlewares/auth");
const {uploadProfileImage} = require("../utils/multer");

router.get('/pageNotFound',userControl.pageNotFound);

router.get('/signup',userControl.loadSignup);
router.post('/signup',userControl.signup);

router.post("/verify-otp",userControl.verify_otp); 
router.post("/resend-otp",userControl.resend_otp);

router.get('/login',userControl.loadLogin);
router.post('/login',userControl.login);
router.get("/forgotPassword",profileController.loadForgot);
router.post("/forgotPassword",profileController.forgotPasword);
router.post("/forgotVerifyotp",profileController.verifyForgototp);
router.post("/resendForgotOtp",profileController.forgotResendOtp);
router.get("/resetPassword",profileController.getResetPassword);
router.post("/resetPassword",profileController.resetPassword);
router.get('/logout',userControl.logout);

router.get("/auth/google",passport.authenticate('google',{scope:["profile","email"]}));
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:'/login'}),(req,res) => {
    req.session.user = {_id:req.user._id};
    res.redirect('/');
});

router.get('/',userControl.loadHome);
router.get("/shop",userControl.loadShop);
router.get("/product/:id",userControl.loadProduct);
router.use(userAuth);
//cart management
router.get("/cart",userControl.loadCartPage);
router.post("/cart/add",userControl.addToCart);
router.put("/cart/update",userControl.updateQuantity);
router.get("/cart/remove/:productId",userControl.removeFromCart);

//checkout management
router.get("/checkout",userControl.loadCheckoutPage);
router.post("/address/add",userControl.addAddress);
router.post("/address/edit/:id",userControl.editAddress);
router.post("/checkout/select-address",userControl.selectAddress);
router.delete("/checkout/remove/:productId",userControl.removeBlockedItem);
router.post("/checkout/place-order",userControl.placeOrder);
router.get("/order-success",userControl.orderSuccess);

router.get("/contact",userControl.loadContact);

// profile management
router.get("/profile/:userId",profileController.loadProfile);
router.get("/editProfile/:userId",profileController.loadEditProfile);
router.put("/editProfile/:userId",profileController.updateProfile);
router.get("/verifyUpdate/:userId",profileController.loadEmailVerify);
router.put("/verifyUpdate/:userId",profileController.verifyUpdateEmail);
router.post("/resend-otp/:userId", profileController.resendOtp);
router.post("/uploadProfileImage/:userId",uploadProfileImage.single('profileImage'),profileController.uploadProfileImage);
router.delete("/removeProfileImage/:userId",profileController.removeProfileImage);
//address management
router.get("/addresses/:userId",profileController.loadAddress);
router.get("/addAddress",profileController.loadAddAddress);
router.post("/addAddress",profileController.addAddress);
router.post("/setDefault/:userId/:addressId",profileController.setDefaultAddress);
router.get("/editAddress/:addressId",profileController.loadEditAddress);
router.put("/editAddress/:addressId",profileController.editAddress);
router.delete("/deleteAddress/:userId/:addressId",profileController.deleteAddress);
//order management
router.get("/orders/:userId",profileController.loadOrder);
router.get("/orders/details/:orderId",profileController.loadOrderDetails);
router.get("/download-invoice/:orderId", profileController.downloadInvoice);
router.post("/orders/cancel-order/:orderId",profileController.cancelAllOrder);
router.post("/orders/cancel-items/:orderId/:itemId",profileController.cancelSingleItem);
router.post("/orders/return-item/:orderId/:itemId",profileController.returnItem);
//Password management
router.get("/manage-password/:userId",profileController.loadPassword);
router.put("/manage-password/:userId",profileController.changePassword);
//wallet management
router.get("/wallet/:userId",profileController.loadWallet);

module.exports = router;