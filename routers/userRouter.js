const express = require("express");
const router = express.Router();
const userControl = require("../controllers/user/userControl");
const profileController = require("../controllers/user/profileController");
const passport = require("passport");
const {userAuth , adminAuth,resetVerification} = require("../middlewares/auth");

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
router.get("/cart/:id",userControl.loadCart);
router.get("/checkout/:id",userControl.loadCheckout);

router.get("/contact",userControl.loadContact);


module.exports = router;