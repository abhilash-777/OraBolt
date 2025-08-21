const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
require("dotenv").config();

function generateOtp(){
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationMail = async function (email,otp) {
    try {

        const transport = await nodemailer.createTransport({
            service:"gmail",
            secure:false,
            port:587,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        });

        const mailInfo = await transport.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"OraBolt verification code for forgot password",
            text:`Your OTP is :${otp}`,
            html:`<b> Your OTP is :${otp} </b>`
        });
        return true;
        
    } catch (error) {
        console.error("Email send error:",error);
        return false;
    }
};

const securePassword = async function (password) {
    try {
        const hashPass = await bcrypt.hash(password, 10);
        return hashPass
    } catch (error) {
        console.error("password hashing error:",error);
    }
};

const loadForgot = async function (req,res) {
    try {
        res.render("forgotPassword");
    } catch (error) {
        console.error("error to load forgot password:",error);
        return res.status(500).json({success:false,error:"Internam server error"});
    }
};

const forgotPasword = async function (req,res) {
    try {
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(!findUser){
            return res.status(404).json({success:false,error:"User not found"});
        }
        const otp = generateOtp();
        const emailSend = await sendVerificationMail(email,otp);
        if(!emailSend){
            return res.status(400).json({success:false,error:"send verification mail error"});
        }
        req.session.userOtp = otp;
        req.session.email = email;
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000;
        res.render("forgotVerify-otp");
        console.log("forgot reset otp:",otp);

    } catch (error) {
        console.error("forgot password error:",error);
        return res.redirect("/pageError");
    }
};

const forgotResendOtp = async function (req,res) {
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(404).json({success:false,message:"Email not found in session"});
        }
        const otp = generateOtp();
        req.session.userOtp = otp;
        const sendMail = sendVerificationMail(email,otp);
        if(!sendMail){
            return res.status(400).json({success:false,message:"Error to send otp into mail"});
        }
        return res.status(200).json({success:true});
    } catch (error) {
        console.error("error in resend otp:",error);
        return res.status(500).json({success:false,message:"Internal server error"});
    }
}

const verifyForgototp = async function (req,res) {
    try {
        const enderedOtp = (req.body.otp||"").trim();
        console.log(`userOtp in session:${req.session?.userOtp},
            user input otp:${enderedOtp}`);
        if(!enderedOtp){
            return res.status(404).json({success:false,message:"OTP required"});
        }
        if(enderedOtp === req.session?.userOtp){
            req.session.resetEmail = req.session.resetEmail||req.session?.email;
            req.session.resetVerified = true;
            return res.status(200).json({success:true,redirectUrl:"/resetPassword"})
        }
        
    } catch (error) {
        console.error("OTP verification error:",error);
        return res.status(500).json({success:false,message:"Internal server error.Please try again"});
    }
};

const getResetPassword = async function (req,res) {
    try {
        res.render("resetPassword");
    } catch (error) {
        console.error("error to load reset password page:",error);
        return res.redirect("/pageError");
    }
};

const resetPassword = async function (req,res) {
    try {
        const {password,confirmPassword} = req.body;
        if(!password||!confirmPassword){
            return res.status(404).json({success:false,message:"Password required"});
        }
        const trimPass = password.trim();
        const trimConfirmPass = confirmPassword.trim();
        if(trimPass !== trimConfirmPass){
            return res.status(400).json({success:false,message:"password does not match"});
        }
        const strongEnough = trimPass.length >= 8 && /[A-Z]/.test(trimPass) && /[a-z]/.test(trimPass) && /\d/.test(trimPass);
        if (!strongEnough) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8+ chars with upper, lower, and a digit"
            });
        }

        const userMail = req.session?.resetEmail;
        if(!userMail){
            return res.status(404).json({success:false,message:"User not found in session"});
        }
        const findUser = await User.findOne({email:userMail});
        if(!findUser){
            return res.status(404).json({success:false,message:"Use not found"});
        }

        const hashPass = await securePassword(trimPass);
    
        await User.findOneAndUpdate({_id:findUser._id},{$set:{password:hashPass}});

        delete req.session.resetEmail;
        delete req.session.resetVerified;
        delete req.session.userOtp;
        delete req.session.otpExpiry;

        return res.status(200).json({success:true,redirectUrl:"/login"});

    } catch (error) {
        console.error("error in reset password:",error);
        return res.json({success:false,redirectUrl:"/pageError"});
    }
};

module.exports = {
    loadForgot,
    forgotPasword,
    verifyForgototp,
    getResetPassword,
    forgotResendOtp,
    resetPassword
}