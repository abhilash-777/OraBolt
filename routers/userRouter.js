const express = require("express");
const router = express.Router();
const userControl = require("../controllers/user/userControl");
const profileController = require("../controllers/user/profileController");
const reviewController = require("../controllers/user/reviewController");
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
router.get("/forgotVerifyotp",profileController.loadForgotVerifyOtp);
router.post("/forgotVerifyotp",profileController.verifyForgototp);
router.post("/resendForgotOtp",profileController.forgotResendOtp);
router.get("/resetPassword",profileController.getResetPassword);
router.post("/resetPassword",profileController.resetPassword);
router.get('/logout',userControl.logout);

router.get("/auth/google",passport.authenticate('google',{scope:["profile","email"]}));
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:'/login'}),(req,res) => {
    if(req.user){
        req.session.user = {_id:req.user._id};
        res.redirect("/");
    }else{
        res.redirect("/login");
    }
});

router.get('/',userControl.loadHome);
router.get("/shop",userControl.loadShop);
router.get("/product/:id",userControl.loadProduct);

// Review management
router.get('/review/check/:productId/:orderId', userAuth, reviewController.checkReviewEligibility);
router.post('/review/submit', userAuth, reviewController.submitReview);
router.get('/review/product/:productId', reviewController.getProductReviews);
router.post('/review/helpful/:reviewId', userAuth, reviewController.markReviewHelpful);
router.get('/review/my-orders', userAuth, reviewController.getReviewableOrders);
// Update user's own review
router.put('/review/update/:reviewId', userAuth, reviewController.updateUserReview);
// Delete user's own review
router.delete('/review/delete/:reviewId', userAuth, reviewController.deleteUserReview);

// contact management
router.get("/contact",userControl.loadContact);
router.post("/contact/send-message",userControl.sendMessage);

router.use(userAuth);
//wishlist management
router.get("/wishlist",userControl.loadWishlist);
router.post("/wishlist/add/:productId",userControl.addToWishlist);
router.delete("/wishlist/remove/:productId",userControl.removeFromWishlist);
router.post("/wishlist/add-to-cart/:productId",userControl.addToCartFromWishlist);
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
router.get("/wallet-balance",userControl.getWalletBalance);
router.get("/checkout/available-coupons",userControl.getAvailableCoupons);
router.post("/checkout/apply-coupon",userControl.applyCoupon);
router.post("/checkout/place-order",userControl.placeOrder);
router.get("/order-success",userControl.orderSuccess);
// Razorpay integration routes
router.post("/checkout/create-razorpay-order", userControl.createRazorpayOrder);
router.post("/checkout/verify-payment", userControl.verifyPayment);
// retry payment
router.post('/order/retry-payment',userControl.retryPayment);
router.post('/order/update-payment',userControl.updateOrderPayment);

// profile management
router.get("/profile",profileController.loadProfile);
router.get("/editProfile",profileController.loadEditProfile);
router.put("/editProfile",profileController.updateProfile);
router.get("/verifyUpdate",profileController.loadEmailVerify);
router.put("/verifyUpdate",profileController.verifyUpdateEmail);
router.post("/resend-otp", profileController.resendOtp);
router.post("/uploadProfileImage",uploadProfileImage.single('profileImage'),profileController.uploadProfileImage);
router.delete("/removeProfileImage",profileController.removeProfileImage);

//address management
router.get("/addresses",profileController.loadAddress);
router.get("/addAddress",profileController.loadAddAddress);
router.post("/addAddress",profileController.addAddress);
router.post("/setDefault/:userId/:addressId",profileController.setDefaultAddress);
router.get("/editAddress/:addressId",profileController.loadEditAddress);
router.put("/editAddress/:addressId",profileController.editAddress);
router.delete("/deleteAddress/:addressId",profileController.deleteAddress);

//order management
router.get("/orders",profileController.loadOrder);
router.get("/orders/details/:orderId",profileController.loadOrderDetails);
router.get("/download-invoice/:orderId", profileController.downloadInvoice);
router.post("/orders/cancel-order/:orderId",profileController.cancelAllOrder);
router.post("/orders/cancel-items/:orderId/:itemId",profileController.cancelSingleItem);
router.post("/orders/return-item/:orderId/:itemId",profileController.returnItem);

//Password management
router.get("/manage-password",profileController.loadPassword);
router.put("/manage-password",profileController.changePassword);
//wallet management
router.get("/wallet",profileController.loadWallet);

module.exports = router;