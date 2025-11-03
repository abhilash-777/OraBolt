const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Orders = require("../../models/orderSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const {generateInvoice} = require("../../utils/invoiceGenereator");
const fs = require("fs");
const path = require("path");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
require("dotenv").config();

function generateOtp(){
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationMail = async function (email,otp,message) {
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
            subject:`OraBolt verification code for ${message}`,
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
            return res.redirect("/pageNotFound");
        }
        const otp = generateOtp();
        const emailSend = await sendVerificationMail(email,otp,"forgot password");
        if(!emailSend){
            return res.redirect("/pageNotFound");
        }
        req.session.userOtp = otp;
        req.session.email = email;
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000;
        res.render("forgotVerify-otp");
        console.log("forgot reset otp:",otp);

    } catch (error) {
        console.error("forgot password error:",error);
        return res.redirect("/pageNotFound");
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
        }else{
            return res.status(400).json({success:false,message:"Wrong OTP. Please check OTP"})
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
        return res.json({success:false,redirectUrl:"/pageNotFound"});
    }
};

const renderProfileTab = async function (req,res,tabName,errorMsg) {
    try {
        const userId = req.session?.user?._id;
        const findUser = await User.findById(userId);
        if(!findUser){
            console.log("user not found");
            return res.redirect("/pageNotFound")
        }
        let addresses = [];
        let orders = [];
        let wallet = null;

        if(tabName === "addresses"){
            addresses = await Address.find({userId}).sort({createdOn:-1});
        }
        if(tabName === "orders"){
            orders = await Orders.find({userId})
            .populate("orderedItems.product")
            .sort({createdOn:-1});
        }

        if(tabName == "wallet"){
            wallet = await Wallet.findOne({userId});
            if(!wallet){
                wallet = new Wallet({
                    userId:userId,
                    balance:0,
                    transactions:[]
                });
                await wallet.save();
            }
            if(wallet.transactions && wallet.transactions.length > 0){
                wallet.transactions.sort((a,b) => new Date(b.date) - new Date(a.date));
            }
        }

        return res.render("profile",{user:findUser,activeTab:tabName,addresses,orders,wallet});
    } catch (error) {
        console.error(`${errorMsg}:${error}`);
        return res.redirect("/pageNotFound");
    }
}

const loadProfile = (req,res) => renderProfileTab(req,res,"profile","Error occur on profile tab");

const loadEditProfile = async(req,res) => {
    try {
        const userId = req.session?.user?._id;
        const findUser = await User.findById(userId);
        if(!findUser){
            console.log("user not found");
        }
        res.render("editProfile",{user:findUser});
    } catch (error) {
        console.error("error to load edit profile:",error);
        return res.redirect("/pageNotFound");
    }
};

const updateProfile = async (req,res) => {
    try {
        const {name,phone,email} = req.body;
        const userId = req.session?.user?._id;
        const findUser = await User.findById(userId);
        if(!findUser){
            return res.status(404).json({success:false,message:"User not found"});
        }

        // Check if email is being changed
        const isEmailChanged = email !== findUser.email;

        if(isEmailChanged) {
            // Only send OTP if email is being changed
            const otp = generateOtp();
            const emailSend = sendVerificationMail(email,otp,"update email");
            if(!emailSend){
                return res.status(400).json({success:false,message:"Failed to send email for otp verification"});
            }
            req.session.userOtp = otp;
            req.session.userData = {name,phone,email};
            req.session.otpExpiry = Date.now() + 10 * 60 * 1000;
            console.log("otp sent:",otp);
            return res.status(200).json({
                success:true,
                message:"OTP sent for email verification",
                redirectUrl:`/verifyUpdate`
            });
        } else {
            // Directly update name and phone without OTP
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {$set: {name, phone}},
                {new: true}
            );
            
            req.session.user = updatedUser;
            
            return res.status(200).json({
                success:true,
                message:"Profile updated successfully",
                redirectUrl:`/profile`
            });
        }
        
    } catch (error) {
        console.error("error occurred while updating:",error);
        return res.status(400).json({success:false,message:"error occurred while updating the profile"});
    }
};

const loadEmailVerify = async(req,res) => {
    try {
        const userId = req.session?.user?._id;
        const findUser = await User.findById(userId);
        res.render("verifyEmail",{user:findUser,newEmail:req.session?.userData?.email});
    } catch (error) {
        console.log("error while loading email verify page:",error);
        return res.redirect("/pageNotFound");
    }
};

const verifyUpdateEmail = async (req,res) => {
    try {
        const sessionOtp = req.session.userOtp;
        const {userInputOtp} = req.body;
        if(!userInputOtp){
            return res.status(404).json({success:false,message:"OTP should required"});
        }
        if(!sessionOtp||!req.session?.userData){
            return res.status(404).json({success:false,message:"session is expired, Please resend update request."});
        }
        if(Date.now() > req.session?.otpExpiry){
            return res.status(404).json({success:false,messaga:"OTP expired. Please resend OTP."})
        }
        if(sessionOtp !== userInputOtp){
            return res.status(400).json({success:false,message:"OTP does not match, Please enter correct OTP."});
        }
        const userId = req.session?.user?.id;
        console.log("logined user id:",userId);
        const updateData = req.session.userData;
        const currentUser = await User.findById(userId);
        if(!currentUser){
            return res.status(400).json({success:false,message:"User not found"});
        }
        if(updateData.email !== currentUser.email){
            const existingEmail = await User.findOne({email:updateData.email,_id:{$ne:userId}});
            if(existingEmail){
                return res.status(400).json({success:false,message:"Email already exists."})
            }
        }
        const updatedUser = await User.findByIdAndUpdate(userId,{$set:{
            name:updateData.name,
            phone:updateData.phone,
            email:updateData.email
        }},{new:true});

        delete req.session.userData;
        delete req.session.userOtp;
        delete req.session.otpExpiry;

        req.session.user = updatedUser;

        return res.status(200).json({success:true,message:"Profile updated successfully",redirectUrl:`/profile`});

    } catch (error) {
        console.log("something wrong while updating profile:",error);
        return res.redirect("/pageError");
    }
};

const resendOtp = async (req, res) => {
    try {
        const userId = req.session?.user?._id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if session has userData with the new email
        if (!req.session?.userData?.email) {
            return res.status(400).json({
                success: false,
                message: "No email found in session. Please restart the update process.",
                redirectUrl: `/editProfile`
            });
        }

        const newEmail = req.session.userData.email;
        const otp = generateOtp(); // Ensure generateOtp is defined
        const emailSend = sendVerificationMail(newEmail, otp, "update email"); // Ensure sendVerificationMail is defined
        if (!emailSend) {
            return res.status(400).json({ success: false, message: "Failed to send OTP email" });
        }

        // Update session with new OTP and expiry
        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
        console.log("Resent OTP:", otp);

        return res.status(200).json({ success: true, message: "OTP resent successfully" });
    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Server error while resending OTP" });
    }
};

const uploadProfileImage = async (req, res) => {
    try {
        const userId = req.session?.user?._id;
        console.log("logined user id:",userId);
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Save the file path to the user document
        const imagePath = `/uploads/profileImage/${req.file.filename}`;
        user.profileImage = imagePath;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            redirectUrl: `/profile`
        });
    } catch (error) {
        console.error("Error uploading profile image:", error);
        return res.status(500).json({ success: false, message: "Error uploading profile image" });
    }
};

const removeProfileImage = async (req, res) => {
    try {
        const userId = req.session?.user?._id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.profileImage) {
            const imagePath = path.join(__dirname, '..', 'public', user.profileImage);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); // Delete the file
            }
            user.profileImage = null;
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: "Profile image removed successfully",
            redirectUrl: `/profile`
        });
    } catch (error) {
        console.error("Error removing profile image:", error);
        return res.status(500).json({ success: false, message: "Error removing profile image" });
    }
};

const loadAddress = async (req,res) => renderProfileTab(req,res,"addresses","Error occur on address tab");

const loadAddAddress = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        if(!userId){
            console.log("user not found");
        }
        const userData = await User.findById(userId);
        if(!userData){
            console.log("user data not found.");
        }
        console.log("user data:",userData);
        res.render("addAddress",{user:userData});
    } catch (error) {
        console.log("error occure while loading add address:",error);
        return res.redirect("/pageNotFound")
    }
};

const addAddress = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        const existingAddresses = await Address.find({userId});
        if(!userId){
            return res.status(404).json({success:false,message:"Unauthorized: Please login"})
        }
        const{addressType,name,address,phone,altPhone,street,city,state,pincode,landMark} = req.body;
        if(!addressType||!name||!address||!phone||!street||!city||!state||!pincode||!landMark){
            return res.status(404).json({success:false,message:"All field required. Please fill all fields"});
        }
        if(!/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(phone)){
            return res.status(400).json({success:false,message:"Invalid phone number"});
        }
        if(!/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(altPhone)){
            return res.status(400).json({success:false,message:"Invalid alternative phone number"});
        }
        if(!/^[1-9][0-9]{5}$/.test(pincode)){
            return res.status(400).json({success:false,message:"Invalid pincode"});
        }

        const newAddress = new Address({
            userId,
            addressType,
            name,
            address,
            phone,
            altPhone,
            street,
            city,
            state,
            pincode,
            landMark,
            isDefault:existingAddresses.length === 0
        });

        await newAddress.save();
        
        return res.status(200).json({success:true,message:"Added Successfully.",address:newAddress,redirectUrl:`/addresses`})

    } catch (error) {
        console.error("Something wrong while create a address:",error);
        return res.redirect("/pageError");
    }
};

const loadEditAddress = async (req,res) => {
    try {
        const addressId = req.params.addressId;
        const findAddress = await Address.findById(addressId);
        if(!findAddress){
            console.log("Address not found");
            return res.redirect("/pageNotFound");
        }
        const findUser = await User.findById(findAddress.userId);
        if(!findUser){
            console.log("User not found");
            return res.redirect("/pageNotFound");
        }
        res.render("editAddress",{user:findUser,address:findAddress,activeTab:"addresses"});
    } catch (error) {
        console.log("error while loading edit address");
        return res.redirect("/pageNotFound");
    }
};

const editAddress = async (req,res) => {
    try {
        const addressId = req.params.addressId;
        const {addressType,name,address,phone,altPhone,street,city,state,pincode,landMark} = req.body;
        if(!addressId){
            return res.status(404).json({success:false,message:"Address not found"});
        }
        
        if(!addressType||!name||!address||!phone||!altPhone||!street||!city|!state||!pincode||!landMark){
            return res.status(404).json({success:false,message:"All fields required"});
        }

        if(!/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(phone)){
            return res.status(400).json({success:false,message:"Invalid phone number"});
        }
        if(!/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(altPhone)){
            return res.status(400).json({success:false,message:"Invalid alternative phone number"});
        }
        if(!/^[1-9][0-9]{5}$/.test(pincode)){
            return res.status(400).json({success:false,message:"Invalid pincode"});
        }

        const findAddress = await Address.findById(addressId);
        if(!findAddress){
            return res.status(404).json({success:false,message:"Address not found"});
        }

        findAddress.addressType = addressType;
        findAddress.name = name;
        findAddress.address = address;
        findAddress.phone = phone;
        findAddress.altPhone = altPhone;
        findAddress.street = street;
        findAddress.city = city;
        findAddress.state = state;
        findAddress.pincode = pincode;
        findAddress.landMark = landMark;
        await findAddress.save();

        return res.status(200).json({success:true,message:"Address edited successfully.",redirectUrl:`/addresses`});
        
    } catch (error) {
        console.log("something wrong while editing:",error);
        return res.redirect("/pageNotFound");
    }
}

const setDefaultAddress = async (req,res) => {
    try {
        const {userId,addressId} = req.params;
        if(!userId )return res.json({success:false,message:"User not found"});
        if(!addressId)return res.json({success:false,message:"Address ID is missing"});

        const findAddress = await Address.findById({_id:addressId,userId});
        if(!findAddress){
            return res.json({success:false,message:"Address not found"});
        }

        await Address.updateMany({userId},{$set:{isDefault:false}});
        await Address.findByIdAndUpdate(addressId,{$set:{isDefault:true}});

        return res.status(200).json({success:true,message:"Address set to default"});
    } catch (error) {
        console.log("error occure setting address default:",error);
        return res.json({success:false,message:"Something wrong while set address default"});
    }
};

const deleteAddress = async(req,res) => {
    try {
        const{addressId} = req.params;
        const address = await Address.findById(addressId);
        if(address.isDefault){
            return res.status(400).json({success:false,message:"Default address can't delete!"});
        }
        await Address.findByIdAndDelete(addressId);
        return res.status(200).json({success:true,message:"Address deleted successfully.",redirectUrl:`/addresses`})
    } catch (error) {
        console.log("error occure while deleting address:",error);
        return res.redirect("/pageNotFound");
    }
};

const loadOrder = async (req,res) => renderProfileTab(req,res,"orders","Error occur on order tab");

const loadOrderDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findById(user._id);
        if(!user){
            return res.json({success:false,messge:"User not found"})
        }
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId)
            .populate('orderedItems.product')
            .populate('address')
            .populate('userId');
        
        if (!order) { 
            return res.redirect('/pageNotFound');
        }
        
        res.render('order-details', {user:userData, order });
    } catch (error) {
        console.error('Error loading order details:', error);
        res.redirect('/pageNotFound');
    }
};

const cancelAllOrder = async (req,res) => {
    try {
        const {orderId} = req.params;
        const order = await Orders.findById(orderId);
        if(!order){
            return res.json({success:false,message:"Order not found"});
        }
        const validStatuses = ['Pending', 'Processing', 'Shipped'];
        if (!validStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot cancel order with status: ${order.status}` 
            });
        }

        for(let item of order.orderedItems){
            if(item.status !== "Cancelled"){
                const product = await Product.findById(item.product);
                if(product){
                    product.quantity += item.quantity;
                    await product.save();
                }else{
                    console.log("product restoration failed!");
                }
            }
        }

        //calculate refund amount
        const refundAmount = order.finalPrice;

        // Update order status and all items
        order.status = 'Cancelled';
        order.orderedItems.forEach(item => {
            item.status = 'Cancelled';
        });

        //Update order final price to 0
        order.finalPrice = 0;

        // Update payment status if needed (assuming refund is initiated)
        if (order.paymentStatus === 'Paid') {
            order.paymentStatus = "Refunded";
            order.refundAmount = refundAmount;
            order.refundDate = new Date();

            let wallet = await Wallet.findOne({userId:order.userId});
            if(!wallet){
                wallet = new Wallet({
                    userId:order.userId,
                    balance:refundAmount,
                    transactions:[{
                        type:"credit",
                        amount:refundAmount,
                        description:`Refund for cancelled order ${order.orderId||order._id}`,
                        date:new Date()
                    }]
                });
            }else{
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    type:"credit",
                    amount:refundAmount,
                    description:`Refund for cancelled order ${order.orderId||order._id}`,
                    data:new Date()
                })
            }
            await wallet.save();
        }else if(order.paymentStatus === 'Pending'){
            order.paymentStatus = "Cancelled";
        }
        await order.save();

        return res.json({ 
            success: true, 
            message: 'Order cancelled successfully',
            redirectUrl: `/orders?userId=${order.userId}`
        });
    } catch (error) {
        console.error("Error while canceling whole order:", error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel order'
        });
    }
};

const cancelSingleItem = async (req,res) => {
    try {
        const { orderId, itemId } = req.params;
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid order or item ID" 
            });
        }

        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if order status allows item cancellation
        const validStatuses = ['Pending', 'Processing', 'Shipped'];
        if (!validStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot cancel item in order with status: ${order.status}` 
            });
        }

        // Find the item to cancel
        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }

        // Check if item is already cancelled
        if (item.status === 'Cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: "Item is already cancelled" 
            });
        }

        const product = await Product.findById(item.product);
        if(product){
            product.quantity += item.quantity;
            await product.save();
        }else{
            console.log("product quantity restoration failed!");
        }

        const originalSubTotal = order.orderedItems.reduce((sum,i) => sum + (i.price * i.quantity),0);
        console.log("Original sub total price before any discounts:",originalSubTotal);
        const itemOriginalPrice = item.price * item.quantity;
        console.log("Item original price:",itemOriginalPrice);
        const itemProportion = itemOriginalPrice/originalSubTotal;
        console.log("item proportion:",itemProportion);
        const finalPriceWithoutShipping = order.finalPrice - (order.shippingCost || 0);
        console.log("total discount amount (difference between original and final, excluding shipping):",finalPriceWithoutShipping);
        const totalDiscount = originalSubTotal - finalPriceWithoutShipping;
        console.log("total discount:",totalDiscount);
        const itemDiscountShare = totalDiscount * itemProportion;
        console.log("single item discount share:",itemDiscountShare);

        const itemRefundAmount = Math.round((itemOriginalPrice - itemDiscountShare) *100) / 100;
        console.log("item refund amount:",itemRefundAmount);

        // Update item status
        item.status = 'Cancelled';

        // Recalculate order totals
        const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
        order.finalPrice = Math.max(0,order.finalPrice - itemRefundAmount);
        
        // Add shipping cost if applicable
        if (order.shippingCost) {
            order.finalPrice += order.shippingCost;
        }

        if (order.paymentStatus === 'Paid') {
            // If already some refund initiated, add to it
            order.refundAmount = (order.refundAmount || 0) + itemRefundAmount;
            
            // If all items cancelled, full refund
            if (activeItems.length === 0) {
                order.paymentStatus = 'Refunded';
                order.status = "Cancelled";
                // const totalRefund = order.totalPrice; // Full original amount
                // order.refundAmount = totalRefund;
                order.finalPrice = 0;
            } else {
                order.paymentStatus = 'Partial Refund';
            }
            
            order.refundDate = new Date();
            let wallet = await Wallet.findOne({userId:order.userId});
            if(!wallet){
                wallet = new Wallet({
                    userId:order.userId,
                    balance:itemRefundAmount,
                    transactions:[{
                        type:"credit",
                        amount:itemRefundAmount,
                        description:`Refund for cancelled item in order ${order.orderId||order._id}`,
                        date:new Date()
                    }]
                });
            }else{
                wallet.balance += itemRefundAmount;
                wallet.transactions.push({
                    type:"credit",
                    amount:itemRefundAmount,
                    description:`Refund for cancelled item ${order.orderId||order._id}`,
                    date:new Date()
                });
            }
            await wallet.save();
        }else if(order.paymentStatus === "Pending"){
            if(activeItems.length === 0){
                order.status = "Cancelled";
                order.paymentStatus = "Cancelled";
            }
        }

        await order.save();

        return res.json({ 
            success: true, 
            message: order.paymentStatus === "Refunded" ||order.paymentStatus === "Partial Refund Initiated" ? 
                "Item cancelled successfull.Refund amount added to your wallet.":'Item cancelled successfully',
            redirectUrl: `/orders/details/${orderId}`
        });
    } catch (error) {
        console.error("Error while canceling an item in order:", error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel item'
        }); 
    }
};

const downloadInvoice = async (req, res) => {   
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to download invoice' 
            });
        }

        // Fetch order details
        const order = await Orders.findById(orderId)
            .populate('orderedItems.product')
            .populate('address');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Verify order belongs to user
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access' 
            });
        }

        // Fetch user details
        const userData = await User.findById(userId);

        // Create invoices directory if it doesn't exist
        const invoicesDir = path.join(__dirname, '../public/invoices');
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
        }

        // Generate unique filename
        const fileName = `invoice_${order.orderId}_${Date.now()}.pdf`;
        const filePath = path.join(invoicesDir, fileName);

        // Generate PDF
        await generateInvoice(order, userData, filePath);

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order.orderId}.pdf`);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        // Delete file after sending (optional)
        fileStream.on('end', () => {
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 1000);
        });

        fileStream.on('error', (error) => {
            console.error('Error streaming file:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error downloading invoice' 
                });
            }
        });

    } catch (error) {
        console.error('Error generating invoice:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to generate invoice' 
            });
        }
    }
};

const returnItem = async (req,res) => {
    try {
        const { orderId, itemId } = req.params;
        const {reason} = req.body;

        // Validate ObjectIds
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid order or item ID' 
            });
        }
        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide at least 10 characters for the return reason' 
            });
        }
         if (reason.trim().length > 500) {
            return res.status(400).json({ 
                success: false, 
                message: 'Return reason cannot exceed 500 characters' 
            });
        }

        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Find the item to return
        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }

        // Check if item is delivered
        if (item.status !== 'Delivered' && item.status !== "Return Rejected") {
            return res.status(400).json({ 
                success: false, 
                message: 'Only delivered items or items with rejected returns can request a return' 
            });
        }

        // Check if return already requested
        if (item.returnRequest.status === 'Return Requested') {
            return res.status(400).json({ 
                success: false, 
                message: 'Return request already submitted. Please wait for admin approval.' 
            });
        }

        if (item.returnRequest.status === 'Return Approved') {
            return res.status(400).json({ 
                success: false, 
                message: 'Return request already approved' 
            });
        }

        if (item.returnRequest.status === 'Returned') {
            return res.status(400).json({ 
                success: false, 
                message: 'Item already returned' 
            });
        }

        const previousRejection = item.returnRequest?.status === 'Return Rejected' ? {
            previousRejectionReason: item.returnRequest.rejectionReason,
            previousRejectionDate: item.returnRequest.resolvedOn
        } : {};

        // Create/Update return request
        item.returnRequest = {
            status: 'Return Requested',
            reason: reason.trim(),
            requestedOn: new Date(),
            resolvedOn: null,
            rejectionReason: null,
            ...previousRejection
        };
        item.status = 'Return Requested';

        // Update order status if needed
        const allItemsReturnedOrCancelled = order.orderedItems.every(i => 
            i.returnRequest.status === "Return Requested" ||
            i.returnRequest.status === "Return Approved" ||
            i.status === "Cancelled" ||
            i.status === "Return Requested" ||
            i.status === 'Returned'
        )
        if (allItemsReturnedOrCancelled) {
            order.status = 'Return Request';
        }

        await order.save();

        return res.json({ 
            success: true, 
            message: 'Return request submitted successfully. Please wait for admin approval.',
            redirectUrl: `/orders/details/${orderId}`
        });

    } catch (error) {
        console.error("Error while returning an item in order:", error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to submit return request'
        });
    }
};

const loadWallet = async (req,res) => renderProfileTab(req,res,"wallet","Error occur on wallet tab");

const loadPassword = async (req,res) => renderProfileTab(req,res,"password","Error occur on password tab");

const changePassword = async (req,res) => {
    try {
        const userId = req.session?.user?.id;
        const {currPassword,newPassword,confirmPassword} = req.body;

        const existUser = await User.findById(userId);
        if(!existUser){
            return res.json({success:false,message:"User not found"});
        }

        if(!currPassword||!newPassword||!confirmPassword){
            return res.json({success:false,message:"All fields are required"});
        }

        const isMatch = await bcrypt.compare(currPassword,existUser.password);
        if(!isMatch){
            return res.json({success:false,message:"Wrong current password"});
        }

        if(currPassword === newPassword){
            return res.json({success:false,message:"Please try with new password"});
        }

        if(newPassword !== confirmPassword){
            return res.json({success:false,message:"Password doesn't match , Please enter correct password"});
        }

        const hashPass = await securePassword(newPassword);
        await User.findByIdAndUpdate(userId,{$set:{password:hashPass}});
        return res.status(200).json({success:true,message:"Password changed successfully.",redirectUrl:`/manage-password`});
    } catch (error) {
        console.log("error occure while changing password");
        return res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadForgot,
    forgotPasword,
    verifyForgototp,
    getResetPassword,
    forgotResendOtp,
    resetPassword,
    loadProfile,
    loadEditProfile,
    updateProfile,
    loadEmailVerify,
    verifyUpdateEmail,
    resendOtp,
    uploadProfileImage,
    removeProfileImage,
    loadAddress,
    loadAddAddress,
    addAddress,
    loadEditAddress,
    editAddress,
    setDefaultAddress,
    deleteAddress,
    loadOrder,
    loadOrderDetails,
    cancelAllOrder,
    cancelSingleItem,
    downloadInvoice,
    returnItem,
    loadWallet,
    loadPassword,
    changePassword
}