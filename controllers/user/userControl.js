const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { default: mongoose } = require("mongoose");

require("dotenv").config();

const loadSignup = async function (req, res) {
    try {
        if(req.session.user || req.user){
            return res.redirect("/");
        }
        return res.render("signup");
    } catch (error) {
        console.log("home page not loading", error);
        res.status(500).send("server Error");
    }
};
let MAX_QTY_LIMIT = 5;
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

async function sendEmailVerification(email, otp) {

    try {

        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            console.error("Email credential not configured properly");
            return false;
        }

        const transport = await nodemailer.createTransport({
            service:"gmail",
            port: 587,
            secure: false,
            requireTLS:true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        transport.verify((error, success) => {
            if (error) {
                console.log("Transport verify error", error)
            } else {
                console.log("server is ready to take message", success)
            }
        });

        const info = await transport.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "OraBolt verification code for your accound setup?",
            text: `Your OTP is : ${otp}`,
            html: `<b> Your OTP is : ${otp} </b>`
        })

        return info.accepted.length > 0

    } catch (error) {
        console.error("Error , sending mail", error);
        return false;
    }

};

const signup = async function (req, res) {
    try {

        const { name, phone, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('signup', { message: "Password dose not matching" });
        }

        const findUser = await User.findOne({ email });

        if (findUser) {
            return res.render('signup', { message: "User already exists" });
        }

        const otp = generateOtp();

        const emailSend = await sendEmailVerification(email, otp);

        if (!emailSend) {
            return res.json({ message: "Email-Error" });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000;
        console.log("signup otp:",otp);
        res.render('verify-otp');

    } catch (error) {

        console.error("Sign up error", error);
        res.redirect('/pageNotFound');

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

const verify_otp = async function (req, res) {

    try {

        const { otp } = req.body;

        if (!req.session.userOtp || !req.session.userData) {
            return res.status(400).json({ success: false, message: "Session expired. Please signup again." });
        }
        
        if (Date.now() > req.session.otpExpiry) {
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        const existUser = await User.findOne({ email: req.session?.userData?.email });
        if (existUser) {
            return res.status(400).json({ success: false, message: "User Already exists" });
        }

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const hashPassword = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: hashPassword
            });

            await saveUserData.save();
            req.session.user = {_id:saveUserData._id};
            res.json({
                success: true,
                redirectUrl: "/login"
            });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP please try again" })
        }

    } catch (error) {
        console.error("Error verifing otp", error);
        res.status(500).json({ success: false, message: "An error occured" })
    }

};

const resend_otp = async function (req, res) {

    try {

        const { email } = req.session.userData;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSend = await sendEmailVerification(email, otp);

        if (emailSend) {
            console.log("resend OTP Success", otp);
            res.status(200).json({ success: true, message: "Resend OTP success" });
        } else {
            res.status(500).json({ success: false, message: "Resend OTP faild . please try again" });
        }

    } catch (error) {
        console.error("Resending OTP Error", error);
        res.status(400).json({ success: false, message: "Internal server error . please try again" });
    }

};

const loadLogin = async function (req, res) {

    try {
        if(req.session.user || req.user){
            return res.redirect("/");
        }
        return res.render("userLogin");
    } catch (error) {
        res.redirect('/pageNotFound');
    }

};

const login = async function (req, res) {

    try {
        const { email, password } = req.body;

        const findUser = await User.findOne({ isAdmin: 0, email });

        if (!findUser) {
            console.log("User not found");
            return res.render("userLogin", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            console.log("User is blocked");
            return res.render("userLogin", { message: "User is blocked by Admin" });
        }

        if (!password || !findUser.password) {
            console.log("Missing password values");
            return res.render("userLogin", { message: "Password missing" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            console.log("Incorrect password");
            return res.render("userLogin", { message: "Incorrect password" });
        }

        req.session.user = {_id:findUser._id};

        console.log("Login success");
        return res.redirect("/"); 

    } catch (error) {
        console.error("Login error:", error);
        return res.render("userLogin", { message: "Login failed, try again later" });
    }

};

const logout = async function (req,res) {
    try {
        req.session.destroy((err) => {
            if(err){
                return res.redirect('/pageNotFound');
            }else{
                return res.redirect('/login');
            }
        })
        
    } catch (error) {
        console.log("Logout error",error);
        return res.redirect('/pageNotFound');
    }
};

const pageNotFound = async function (req, res) {
    try {
        res.status(404).render("page-404",{error:"Page Not Found"})
    } catch (error) {
        console.log("error handling error:",error);
    }
};

const loadHome = async function (req, res) {
    try {

        const user = req.session.user;
        if (user) {
            const userData = await User.findById(req.session.user._id);
            return res.render("home", { user: userData });
        }else{
            return res.render("home",{user:null});
        }
        

    } catch (error) {
        console.log("Home Page Not Found");
        res.status(404).send("Server Error!")
    }
};

const loadShop = async function (req,res) {

    try {
        const user = req.session.user;
        console.log("session log",req.session?.user);

        let filter = {isBlocked:false};
        if(req.query.subcategories){
            if (Array.isArray(req.query.subcategories)) {
                filter.subcategory = { $in: req.query.subcategories };
            } else {
                filter.subcategory = req.query.subcategories;
            }
        }
        if(req.query.category){
            filter.category = req.query.category;
        }
        if
        (req.query.brand){
            filter.brand = req.query.brand;
        }
        if(req.query.minPrice||req.query.maxPrice){
            filter.salePrice = {};
            if(req.query.minPrice){
                filter.salePrice.$gte = parseInt(req.query.minPrice);
            }
            if(req.query.maxPrice){
                filter.salePrice.$lte = parseInt(req.query.maxPrice);
            }
        }
        if(req.query.color){
            filter.color = new RegExp(req.query.color,'i');
        }
        if(req.query.status && req.query.status !== 'all'){
            filter.status = req.query.status
        }
        if(req.query.search){
            filter.$or = [
                {productName:new RegExp(req.query.search,'i')},
                {description:new RegExp(req.query.search,'i')}
            ];
        }

        let sortOptions = {};
        const sortBy = req.query.sortBy||'newest';
        switch (sortBy) {
            case 'price_low':
                sortOptions = {salePrice:1};
                break;
            case 'price_high':
                sortOptions = {salePrice:-1};
                break;
            case 'name_asc':
                sortOptions = {productName:1};
                break;
            case 'name_desc':
                sortOptions = {productName:-1};
                break;
            case 'newest':
                sortOptions = {createdAt:-1};
                break;
            case 'oldest':
                sortOptions = {createdAt:1};
                break;
            case 'popularity':
                sortOptions = {quantity:-1};
                break;
            default:
                sortOptions = {createdAt:-1}
        }

        const page = parseInt(req.query.page)||1;
        const limit =  parseInt(req.query.limit)||6;
        const skip = (page-1)*limit;

        const products = await Product.find(filter)
        .populate('category','name')
        .populate('subcategory','name')
        .populate('brand','brandName')
        .skip(skip)
        .limit(limit)
        .sort(sortOptions)
        .lean();

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts/limit);

        const categories = await Category.find({isListed:true}).lean();
        const subcategories = await subCategory.find({isListed:true}).lean();
        const brands = await Brand.find({isBlocked:false}).lean();

        const allColor = await Product.distinct('color',{isBlocked:false});
        const priceRange = await Product.aggregate([
            {$match:{isBlocked:false}},
            {$group:{_id:null,
                minPrice:{$min:"$salePrice"},
                maxPrice:{$max:"$salePrice"}
            }}
        ]);

        const currentFilters = {
            subcategories:req.query.subcategories||'',
            category:req.query.category||'',
            brand:req.query.brand||'',
            minPrice:req.query.minPrice||'',
            maxPrice:req.query.maxPrice||'',
            color:req.query.color||'',
            status:req.query.status||'all',
            search:req.query.search||'',
            sortBy:sortBy,
            limit:limit
        };
         
        if (user) {
            const userData = await User.findById(req.session?.user?._id);
            return res.render("shop", { 
                user: userData,
                currentPage:page,
                totalPage:totalPages,
                totalProduct:totalProducts, 
                products:products,
                categories,
                subcategories,
                brands,
                colors:allColor,
                priceRange:priceRange[0]||{minPrice:0,maxPrice:100000},
                currentFilters,
                query:req.query
            });
        }else{
            return res.render("shop",{user:user||null,
                currentPage:page,
                totalPage:totalPages,
                totalProduct:totalProducts, 
                products:products,
                categories,
                subcategories,
                brands,
                colors:allColor,
                priceRange:priceRange[0]||{minPrice:0,maxPrice:100000},
                currentFilters,
                query:req.query
            });
        }
    } catch (error) {
        console.error("shop page not found",error);
        return res.redirect("/");
    }

};

const loadProduct = async function (req,res) {

    try {
        const user = req.session.user;
        // console.log("session log",req.session?.user);
        const productId = req.params.id;

        if(!mongoose.Types.ObjectId.isValid(productId)){
            return res.render("page-404",{error:"Invalid Product Id"})
        }
        const productData = await Product.findById(productId).lean();
        if(!productData){
            return res.render("page-404",{error:"Product not found"});
        }
        const similarProducts = await Product.find({category:productData.category,_id:{$ne:productId}}).limit(6).lean();
        let userData = null;
        if(user){
            userData = await User.findById(user._id);
        }
        return res.render("product",{user:userData,product:productData,similarProducts})
        
    } catch (error) {
        console.log("Error occure in page loading:",error);
        return res.status(500).render("page-404",{error:"Something went wrong.Please try again"})
    }
};

const addToCart = async (req,res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({redirectUrl:"/login"});

        const {productId,quantity} = req.body;
        console.log("product id:",productId);
        const quantityToAdd = parseInt(quantity)||1;
        const product = await Product.findById(productId);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }
        if (!product || product.isBlocked) {
            return res.status(400).json({message: "Product is unavailable"});
        }else if(product.quantity <= 0){
            return res.status(400).json({message: "Out of stock"});
        }

        if (product.stock <= 0) {
            return res.status(400).json({ message: "Out of stock" });
        }

        let cart = await Cart.findOne({ userId: user._id });
        if (!cart) {
            cart = new Cart({ userId: user._id, items: [] });
        }

        const existingItem = cart.items.find((item) => item.productId.toString() === productId);

        if (existingItem) {
            let newQuantity = existingItem.quantity + quantityToAdd;
            if(newQuantity > MAX_QTY_LIMIT){
                return res.status(400).json({
                    message: `You can only add up to ${MAX_QTY_LIMIT} units of this product.`,
                });
            }
            existingItem.quantity = newQuantity;
            existingItem.totalPrice = existingItem.quantity * product.regularPrice;
        } else {
            cart.items.push({
                productId,
                quantity: quantityToAdd,
                price: product.regularPrice,
                totalPrice: product.regularPrice * quantityToAdd,
            });
        }

        await cart.save();

        // Remove from wishlist if it exists
        await Wishlist.updateOne(
            { userId: user._id },
            { $pull: { items: { productId } } }
        );

        return res.status(200).json({ message: "Product added to cart" });
    } catch (error) {
        console.error("Add to cart error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const loadCartPage = async(req,res) => {
    try {
        const userId = req.session?.user._id||req.user._id;
        if(!userId){
            return res.redirect("/login");
        }
        const userData = await User.findById(userId);
        const cart = await Cart.findOne({userId:userId}).populate("items.productId").lean();
        if(!cart||!cart.items||cart.items.length === 0){
            return res.render("cart",{user:userData,cartItems:[]})
        }
        const cartItems = cart?.items?.map((item) => {
            const product = item.productId;
            let availabilityStatus = "Available";
            if(!product){
                availabilityStatus = "Not Available";
            }else if(product.isBlocked){
                availabilityStatus = "Not Available"
            }else if(product.quantity <= 0||product.stock <= 0){
                availabilityStatus = "Out of Stock"
            }

            return {...item,
                availabilityStatus,
            isOutOfStock:availabilityStatus === "Out of Stock" ||availabilityStatus === "Not Available"}
        });
        return res.render("cart",{user:userData,cartItems});
    } catch (error) {
        console.log("error occure while load cart:",error);
        return res.redirect("/pageNotFound");
    }
};

const updateQuantity = async (req, res) => {
    try {
        const { productId, action } = req.body;
        const user = req.session?.user;

        const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
        if(!cart){
            return res.status(404).json({ message: "Cart not found" });
        }

        const item = cart.items.find((i) => i.productId._id.toString() === productId);
        if (!item) return res.status(404).json({message: "Item not found" });

        if (action === "increase") {
            if (item.quantity >= MAX_QTY_LIMIT)
                return res.status(400).json({message: "You can only add upto 5 unit of this product" });
            if (item.productId.stock <= item.quantity)
                return res.status(400).json({message: "No more stock" });
            item.quantity += 1;
        } else if (action === "decrease") {
            if (item.quantity > 1) item.quantity -= 1;
            else return res.status(400).json({message: "Minimum quantity is 1" });
        }

        item.totalPrice = item.quantity * item.price;
        await cart.save();
        return res.json({success: true});
    } catch (error) {
        console.log("updateQuantity error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            return res.redirect("/login");
        }

        const { productId } = req.params;
        
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        // Remove item from cart
        const result = await Cart.updateOne(
            { userId: user._id }, 
            { $pull: { items: { productId } } }
        );

        if (result.modifiedCount === 0) {
            console.log("No item found to remove");
        }

        // Check if request came from checkout page
        const referer = req.get('Referer') || '';
        if (referer.includes('/checkout')) {
            return res.redirect("/checkout");
        }

        // Default redirect to cart page
        res.redirect("/cart");
    } catch (error) {
        console.log("Remove from cart error:", error);
        
        // Check referer for redirect
        const referer = req.get('Referer') || '';
        if (referer.includes('/checkout')) {
            return res.redirect("/checkout");
        }
        
        res.redirect("/cart");
    }
};

const loadCheckoutPage = async(req,res) => {
    try {
        const user = req.session?.user;
        if(!user)return res.redirect("/login");

        const addresses = await Address.find({userId:user._id}).lean();
        const cart = await Cart.findOne({userId:user._id}).populate({
            path:"items.productId",
            select:"productName image regularPrice salePrice quantity status isBlocked"})
            .lean();
        let cartItems = [];
        let subTotal = 0;

        if (cart && cart.items && cart.items.length > 0) {
            cartItems = cart.items
                .filter(item => item.productId != null) 
                .map(item => {
                    const price = item.price || item.productId.salePrice || item.productId.regularPrice;
                    const itemTotal = price * item.quantity;
                    
                    return {
                        ...item,
                        productId: {
                            ...item.productId,
                            name: item.productId.productName, 
                        },
                        calculatedTotal: itemTotal
                    };
                });
            
            // Calculate subtotal
            subTotal = cartItems
                .filter(item => !item.productId.isBlocked && item.productId.status !== 'unlisted')
                .reduce((sum, item) => sum + item.totalPrice, 0);
        }

        return res.render("checkout", {
            user,
            addresses,
            cartItems,
            subTotal
        });
    } catch (error) {
        console.log("error occure while load cart:",error);
        return res.redirect("/pageNotFound");
    }
};

const addAddress = async (req,res) => {
    try {
        const user = req.session?.user;
        if(!user)return res.json({redirectUrl:"/pageNotFound"});
        const {addressType,name,address,phone,altPhone,street,city,state,pincode,landMark} = req.body;
        if(!name || !address || !phone || !city || !state || !pincode) {
            return res.status(400).json({success: false, message: "Please fill all required fields"});
        }

        const newAddress = new Address({userId:user._id,addressType,name,address,phone,altPhone,street,city,state,pincode,landMark});
        await newAddress.save();
        return res.status(200).json({success:true,message:"New Address added successfully."});
    } catch (error) {
        console.log("error occure while adding address:",error);
        return res.json({redirectUrl:"/pageNotFound"});
    }
};

const editAddress = async (req,res) => {
    try {
        const user = req.session?.user;
        if(!user)return res.json({redirectUrl:"/pageNotFound"});
        const {id} = req.params;
        const {addressType,name,address,street,city,state,pincode,landMark,phone,altPhone,} = req.body;
        await Address.updateOne({_id:id,userId:user._id},{$set:{addressType,name,address,phone,altPhone,street,city,state,pincode,landMark}});
        return res.status(200).json({success:true,message:"Addressa updated successfully."});
    } catch (error) {
        console.log("error occure while editing address:",error);
        return res.status(500).json({redirectUrl:"/pageNotFound"});
    }
};

const selectAddress = async (req, res) => {
    try {

        const user = req.session?.user;
        if (!user) {
            return res.json({ success: false, redirectUrl: "/pageNotFound" });
        }

        const { selectedAddress } = req.body;

        if (!selectedAddress) {
            return res.json({ success: false, message: "Please select a delivery address" });
        }

        const address = await Address.findOne({ _id: selectedAddress, userId: user._id });
        if (!address) return res.json({ success: false, message: "Address not found" });

        await Address.updateMany({ userId: user._id }, { $set: { isDefault: false } });
        await Address.updateOne({ _id: selectedAddress }, { $set: { isDefault: true } });

        req.session.selectedAddress = address._id;

        return res.json({ success: true, message: "Address selected successfully" });
    } catch (error) {
        console.error("Error in selectAddress:", error);
        return res.json({ success: false, message: "Internal error" });
    }
};

const removeBlockedItem = async (req, res) => {
    try {
        const user = req.session?.user;
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: "User not authenticated",
                redirectUrl: "/login" 
            });
        }

        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        const result = await Cart.updateOne(
            { userId: user._id },
            { 
                $pull: { 
                    items: { 
                        productId: new mongoose.Types.ObjectId(productId) 
                    } 
                } 
            }
        );

        const cartAfter = await Cart.findOne({ userId: user._id });

        if (result.modifiedCount > 0) {
            return res.status(200).json({
                success: true,
                message: "Item removed successfully.",
                redirectUrl: "/checkout"
            });
        } else {
            console.log("No items were modified - item not found");
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

    } catch (error) {
        console.log("Error while removing blocked item:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const placeOrder = async (req,res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.json({ redirectUrl: "/pageNotFound" });

        const selectedAddressId = req.session.selectedAddress;
        if (!selectedAddressId)return res.json({ message: "Please select a delivery address" });

        const  {paymentMethod} = req.body;

        const cart = await Cart.findOne({ userId: user._id }).populate({
            path:'items.productId',
            select:"productName image regularPrice salePrice stock status isBlocked"
        });
        if (!cart || cart.items.length === 0)return res.json({ message: "Cart is empty" });

        const address = await Address.findById(selectedAddressId);
        if (!address)return res.json({ message: "Address not found" });

        // Calculate total
        const totalPrice = cart.items.reduce((sum, item) => {
            return sum + (Number(item.productId.regularPrice) * Number(item.quantity));
        }, 0);

        let discount = 0;
        const finalPrice = totalPrice - discount;

        console.log(`totalprice:${totalPrice},
            finalprice:${finalPrice},
            discount:${discount}`);

        const orderedItems = cart.items.map((item) => {
            const product = item.productId;
            
            return {
                product: product._id,
                name: product.productName, 
                image: product.image[0],
                quantity: item.quantity,
                price: product.salePrice || product.regularPrice
            };
        });

        let paymentStatus = "Pending";
        let paymentDate = null;
        let transactionId = null;

        if (paymentMethod === "Cash On Delivery") {
            paymentStatus = "Pending"; // Paid after delivery
        } else if (paymentMethod === "Razorpay") {
            paymentStatus = "Paid"; // Suppose paid immediately
            paymentDate = new Date();
            transactionId = "RAZOR-" + Math.floor(Math.random() * 100000000);
        } else if (paymentMethod === "Wallet") {
            paymentStatus = "Paid";
            paymentDate = new Date();
        }

        // Create order
        const newOrder = new Order({
            userId:req.session.user._id,
            orderedItems: orderedItems,
            totalPrice,
            discount,
            finalPrice,
            address: selectedAddressId, // should store ObjectId of address
            status: "Pending", // must match your enum
            createdOn: new Date(),
            couponApplied: false,
            invoice: new Date(),
            paymentMethod,
            paymentStatus,
            transactionId,
            paymentDate
        });

        await newOrder.save();

        // Decrease stock
        for (const item of cart.items) {
            const updateResult = await Product.findByIdAndUpdate(
                item.productId._id,
                { $inc: { quantity: -item.quantity } },
                { new: true }
            );
            
            if (updateResult) {
                console.log(`✅ Stock updated for ${item.productId.productName}: ${updateResult.quantity} remaining`);
            }
        }

        // Clear cart
        await Cart.findOneAndUpdate(
            { userId: user._id },
            { $set: { items: [] } }
        );

        // Clear selected address from session
        delete req.session.selectedAddress;

        return res.json({ success: true, orderId:newOrder.orderId,amount:newOrder.finalPrice,email:req.session.user.email });
    } catch (error) {
        console.log("error while placing order:",error);
        return res.redirect("/pageNotFound");
    }
};

const orderSuccess = async(req,res) => {
    try {
        const {orderId} = req.query;
        const order = await Order.findOne({orderId:orderId}).populate("address");
        if(!order){
            return res.redirect("/pageNotFound");
        }
        res.render("order",{order,user:req.session?.user})
    } catch (error) {
        console.log("error while load success page:",error);
        return res.redirect("/pageNotFound");
    }
};

const loadContact = async function (req,res) {
    try {

        const user = req.session?.user;
        if(user){
            const userData = await User.findById(req.session?.user?._id);
            return res.render("contact",{user:userData});
        }else{
            return res.render("home",{user:null});
        }
        
    } catch (error) {
        console.error("contact page not found",error);
        return res.redirect("/");
    }
};

module.exports = {
    loadHome,
    pageNotFound,
    loadSignup,
    signup,
    verify_otp,
    resend_otp,
    loadLogin,
    login,
    logout,
    loadShop,
    loadProduct,
    addToCart,
    loadCartPage,
    removeFromCart,
    updateQuantity,
    loadCheckoutPage,
    addAddress,
    editAddress,
    selectAddress,
    removeBlockedItem,
    placeOrder,
    orderSuccess,
    loadContact,
};  