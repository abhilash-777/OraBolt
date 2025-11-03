const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const {applyOffersToProducts,getEffectivePrice} = require("../../utils/offer");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { default: mongoose } = require("mongoose");
const Offer = require("../../models/offerSchems");

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

        const { name, phone, email, password, confirmPassword,referral } = req.body;
        if (password !== confirmPassword) {
            return res.render('signup', { message: "Password dose not matching" });
        }
        let referredBy = null;
        if(referral && referral.trim() !== ""){
            const trimmedReferrel = referral.trim();
            if(!/^\d{6}$/.test(trimmedReferrel)){
                return res.render("signup",{message:"Invalid referral code. Please enter a valid code."})
            }
            const ReferredUser = await User.findOne({referralCode:trimmedReferrel});
            if(!ReferredUser){
                return res.render("signup",{message:"Referred user not found. Please enter correct referral code."});
            }
            referredBy = ReferredUser._id;
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('signup', { message: "User already exists" });
        }

        const otp = generateOtp();
        const newReferral = generateOtp();

        const emailSend = await sendEmailVerification(email, otp);
        if (!emailSend) {
            return res.json({ message: "Email-Error" });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password,referralCode:newReferral,referred:referredBy};
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
                password: hashPassword,
                referralCode:user.referralCode,
                referredBy:user.referred||null
            });

            await saveUserData.save();
            if(user.referred){
                const referrelBonus = 100;
                const referrerWallet = await Wallet.findOne({userId:user.referred});
                if(referrerWallet){
                    referrerWallet.balance += referrelBonus;
                    referrerWallet.transactions.push({
                        type:"credit",
                        amount:referrelBonus,
                        description:`Referral bonus for referring ${user.name}`,
                        date:new Date()
                    });
                    await referrerWallet.save();
                }else{
                    const newWallet = new Wallet({
                        userId:user.referred,
                        balance:referrelBonus,
                        transactions:[{
                            type:"credit",
                            amount:referrelBonus,
                            description:`Referrel bonus for referring ${user.name}`,
                            date:new Date()
                        }]
                    });
                    await newWallet.save();
                }
                const newUserBonus = 50; // ₹50 welcome bonus
                const newUserWallet = new Wallet({
                    userId: saveUserData._id,
                    balance: newUserBonus,
                    transactions: [{
                        type: 'credit',
                        amount: newUserBonus,
                        description: 'Welcome bonus for using referral code',
                        date: new Date()
                    }]
                });
                await newUserWallet.save();
            }
            req.session.user = {_id:saveUserData._id};
            // Clear OTP data
            delete req.session.userOtp;
            delete req.session.userData;
            delete req.session.otpExpiry;
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
            return res.render("userLogin", { message: "Invalid user or password" });
        }
        if (findUser.isBlocked) {
            return res.render("userLogin", { message: "User is blocked by Admin" });
        }
        if (!password || !findUser.password) {
            return res.render("userLogin", { message: "Password missing" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("userLogin", { message: "Incorrect password" });
        }

        req.session.user = {_id:findUser._id};
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

        const productsData = await Product.find({isBlocked:false})
        .populate("category")
        .sort({createdAt:-1})
        .lean();

        const processedProducts = await applyOffersToProducts(productsData);

        let wishlistProductIds = [];
        if (user) {
            const userData = await User.findById(req.session.user._id);
            const wishlist = await Wishlist.findOne({userId:user._id}).lean();
            if(wishlist && wishlist.products){
                wishlistProductIds = wishlist.products.map(p => p.productId.toString());
            }
            return res.render("home", { user: userData ,products:processedProducts,wishlistProductIds:wishlistProductIds});
        }else{
            return res.render("home",{user:null,products:processedProducts,wishlistProductIds:[]});
        }
    } catch (error) {
        console.log("Home Page Not Found");
        res.status(404).send("Server Error!")
    }
};

const loadShop = async function (req,res) {
    try {
        const user = req.session.user;

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

        const processedProducts = await applyOffersToProducts(products);

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

        let wishlistProductIds = [];
        if (user) {
            const userData = await User.findById(req.session?.user?._id);
            const wishlist = await Wishlist.findOne({userId:user._id}).lean();
            if(wishlist && wishlist.products){
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }
            return res.render("shop", { 
                user: userData,
                currentPage:page,
                totalPage:totalPages,
                totalProduct:totalProducts, 
                products:processedProducts,
                categories,
                subcategories,
                brands,
                colors:allColor,
                priceRange:priceRange[0]||{minPrice:0,maxPrice:100000},
                currentFilters,
                query:req.query,
                wishlistProductIds:wishlistProductIds
            });
        }else{
            return res.render("shop",{user:user||null,
                currentPage:page,
                totalPage:totalPages,
                totalProduct:totalProducts, 
                products:processedProducts,
                categories,
                subcategories,
                brands,
                colors:allColor,
                priceRange:priceRange[0]||{minPrice:0,maxPrice:100000},
                currentFilters,
                query:req.query,
                wishlistProductIds:[]
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
        const productId = req.params.id;

        if(!mongoose.Types.ObjectId.isValid(productId)){
            return res.render("page-404",{error:"Invalid Product Id"})
        }
        const productData = await Product.findById(productId).lean();
        if(!productData){
            return res.render("page-404",{error:"Product not found"});
        }
        const processedProducts = await applyOffersToProducts(productData);
        const similarProducts = await Product.find({category:productData.category,_id:{$ne:productId}}).limit(6).lean();
        let isWishlist = false;
        let userData = null;
        if(user){
            userData = await User.findById(user._id);
            const userWishlist = await Wishlist.findOne({userId:user._id,"products.productId":productId});
            isWishlist = !!userWishlist
        }
        return res.render("product",{user:userData,product:processedProducts,similarProducts,isWishlist})
        
    } catch (error) {
        console.log("Error occure in page loading:",error);
        return res.status(500).render("page-404",{error:"Something went wrong.Please try again"})
    }
};

const loadWishlist = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        const userData = await User.findById(userId);
        if(!userData){
            console.log("User Data not found");
            return res.redirect("/pageNotFound");
        }
        const wishlist = await Wishlist.findOne({userId:userId})
        .populate({
            path:"products.productId",
            select:"productName image regularPrice quantity status"
        });

        const products = wishlist ? wishlist.products : [];
        res.render("wishlist",{user:userData,wishlistItems:products,title:"My Wishlist"});
    } catch (error) {
        console.log("error while load wishlist:",error);
        return res.redirect("/pageNotFound");
    }
};

const addToWishlist = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        if(!userId)return res.json({success:false,message:"User not found"});

        const {productId} = req.params;
        if(!productId)return res.json({success:false,message:"Product is missing"});

        const product = await Product.findById(productId);
        if(!product)return res.json({success:false,message:"Product is not found"});

        let wishlist = await Wishlist.findOne({userId});
        if(!wishlist){
            wishlist = new Wishlist({
                userId,
                products:[{
                    productId,
                    addedOn:new Date()
                }]
            });
            await wishlist.save();
        }else{
            const existingProduct = wishlist.products.find(p => p.productId.toString() === productId);
            console.log("existing product in wishlist",existingProduct);
            if(existingProduct){
                return res.json({success:false,message:"Product already in wishlist"});
            }
            wishlist.products.push({
                productId,
                addedOn:new Date()
            });
            await wishlist.save();
        }
        return res.status(200).json({success:true,message:"Added to wishlist successfully."});
    } catch (error) {
        console.log("error while adding to wishlist");
        return res.json({success:false,message:"Something went wrong!"})
    }
};

const removeFromWishlist = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        if(!userId){
            if(res)return res.json({success:false,message:"User not found"});
            return;
        }

        const {productId} = req.params;
        if(!productId){
            if(res)return res.json({success:false,message:"Product ID is missing"});
            return;
        }

        const wishlist = await Wishlist.findOne({userId});
        if(!wishlist){
            if(res)return res.json({success:false,message:"wishlist items not found"});
            return;
        }

        wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
        if(wishlist.products.length === 0){
            await Wishlist.findByIdAndDelete(wishlist._id);
        }else{
            await wishlist.save();
        }

        return res.status(200).json({success:true,message:"Item removed from wishlist.",redirectUrl:"/wishlist"});

    } catch (error) {
        console.log("something went wrong while removeing item from wishlist");
        return res.json({success:false,message:"Something went wrong"});
    }
};

const addToCartFromWishlist = async (req,res) => {
    try {
        const userId = req.session?.user?._id;
        if(!userId)return res.json({success:false,message:"User not found"});

        const {productId} = req.params;
        if(!productId)return res.json({success:false,message:"ProductId is missing"});

        const product = await Product.findById(productId).populate("category").lean();
        if(!product||product.status !== "Available"){
            return res.json({success:false,message:"Product is not available"});
        }

        const{price:effectivePrice,percentage,offerId} = await getEffectivePrice(product);

        let cart = await Cart.findOne({userId});
        if(!cart){
            cart = new Cart({
                userId,
                items:[{
                    productId,
                    quantity:1,
                    price:effectivePrice,
                    totalPrice:effectivePrice * 1,
                    regularPrice:product.regularPrice,
                    appliedOfferPercentage:percentage,
                    appliedOfferId:offerId || null,
                }]
            });
            await cart.save()
        }else{
            const existingItem = cart.items.find(item => item.productId.toString() === productId);
            if(existingItem){
                existingItem.quantity += 1;
                existingItem.totalPrice = effectivePrice * existingItem.quantity;
                existingItem.price = effectivePrice;
                existingItem.appliedOfferPercentage = percentage;
                existingItem.appliedOfferId = offerId || null;
                return res.json({success:false,message:"Item already in cart"})
            }else{
                cart.items.push({
                    productId,
                    quantity:1,
                    price:effectivePrice,
                    totalPrice:effectivePrice,
                    regularPrice:product.regularPrice,
                    appliedOfferPercentage:percentage,
                    appliedOfferId:offerId || null,
                })
            }
            await cart.save();
        }
        const wishlist = await Wishlist.findOne({userId});
        if(wishlist){
            wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
            if(wishlist.products.length === 0){
                await Wishlist.findByIdAndUpdate(wishlist._id)
            }else{
                await wishlist.save();
            }
        }

        return res.status(200).json({success:true,message:"Added to cart successfull."});
    } catch (error) {
        console.log("something wrong while adding to cart from wishlist");
        return res.json({ success: false, message: "Something went wrong!" });
    }
};

const addToCart = async (req,res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({redirectUrl:"/login"});

        const {productId,quantity} = req.body;
        const MAX_QTY_LIMIT = 5;
        const quantityToAdd = parseInt(quantity)||1;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({message: "Invalid product ID" });
        }

        const product = await Product.findById(productId).populate("category").lean();
        if (!product || product.isBlocked || product.status !== "Available") {
            return res.status(400).json({message: "Product is unavailable"});
        }

        const {price:effectivePrice,offerId,percentage} = await getEffectivePrice(product);

        if(product.quantity <= 0){
            return res.status(400).json({message: "Out of stock"});
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
            if (newQuantity > product.quantity) {
                return res.status(400).json({
                    message: `Only ${product.quantity} unit(s) available in stock.`,
                });
            }
            existingItem.quantity = newQuantity;
            existingItem.price = effectivePrice;
            existingItem.totalPrice = effectivePrice * newQuantity;
            existingItem.appliedOfferPercentage = percentage;
            existingItem.appliedOfferId = offerId || null;
        } else {
            if (quantityToAdd > product.quantity) {
                return res.status(400).json({
                    message: `Only ${product.quantity} unit(s) available in stock.`,
                });
            }
            cart.items.push({
                productId,
                quantity: quantityToAdd,
                price: effectivePrice,
                totalPrice: effectivePrice * quantityToAdd,
                regularPrice:product.regularPrice,
                appliedOfferPercentage:percentage,
                appliedOfferId:offerId||null,
            });
        }

        await cart.save();

        // Remove from wishlist if it exists
        await Wishlist.updateOne(
            { userId: user._id },
            { $pull: { items: { productId } } }
        );

        return res.status(200).json({ success:true,message: "Product added to cart" });
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
        const errorMsg = req.session?.stockError || null ;
        req.session.stockError = null;

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
        return res.render("cart",{user:userData,cartItems ,errorMsg});
    } catch (error) {
        console.log("error occure while load cart:",error);
        return res.redirect("/pageNotFound");
    }
};

const updateQuantity = async (req, res) => {
    try {
        const { productId, action } = req.body;
        const user = req.session?.user;
        const MAX_QTY_LIMIT = 5;

        const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
        if(!cart){
            return res.status(404).json({ message: "Cart not found" });
        }

        const item = cart.items.find((i) => i.productId._id.toString() === productId);
        if (!item) return res.status(404).json({message: "Item not found" });

        if (action === "increase") {
            if (item.quantity >= MAX_QTY_LIMIT)
                return res.status(400).json({message: "You can only add upto 5 unit of this product" });
            if (item.productId.quantity <= item.quantity)
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
        const {productId,qty} = req.query;
        let cartItems = [];
        let subTotal = 0;

        if(productId){
            const product = await Product.findOne({_id:productId,isBlocked:false,status:"Available"}).lean();
            if(!product)return res.redirect("/shop");

            const quantity = parseInt(qty) > 0 ? parseInt(qty) : 1;
            if(quantity > product.quantity){
                return res.render("cart",{user,cartItems:[],errorMsg:`Only ${product.quantity} unit(s) available for ${product.productName}`})
            }
            const price = product.regularPrice || product.salePrice;
            const itemTotal = price * quantity;

            cartItems.push({
                productId:{
                    ...product,
                    name:product.productName,
                },
                quantity,
                calculatedTotal:itemTotal
            });
            subTotal = itemTotal;
        }else{
            const cart = await Cart.findOne({userId:user._id}).populate({
                path:"items.productId",
                select:"productName image regularPrice salePrice quantity status isBlocked"
            }).lean();

            let stockError = null;
            if (cart && cart.items && cart.items.length > 0) {
                cartItems = cart.items
                    .filter(item => item.productId != null) 
                    .map(item => {
                        const product = item.productId;
                        const price = item.price || item.productId.salePrice || item.productId.regularPrice;
                        const itemTotal = price * item.quantity;
                    
                        if(item.quantity > product.quantity){
                            stockError = `Only ${product.quantity} unit(s) of ${product.productName} available. Please reduce quantity.`;
                        }
                        return {
                            ...item,
                            productId: {
                                ...item.productId,
                                name: item.productId.productName, 
                            },
                            calculatedTotal: itemTotal
                        };
                    });

                    if(stockError){
                        req.session.stockError = stockError;
                        return res.redirect("/cart");
                    }
            
                 // Calculate subtotal
                subTotal = cartItems
                .filter(item => !item.productId.isBlocked && item.productId.status !== 'unlisted')
                .reduce((sum, item) => sum + item.totalPrice, 0);
            }
        }

        return res.render("checkout", {
            user,
            addresses,
            cartItems,
            subTotal,
            finalPrice:subTotal
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
        if(!addressType||!name||!address||!phone||!street||!city||!state||!pincode||!landMark) {
            return res.status(400).json({success: false, message: "Please fill all required fields"});
        }
        if(altPhone && !/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(altPhone)){
            return res.json({success:false,message:"Phone number should be a 10 digit valid number"});
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
        if(!addressType||!name||!address||!phone||!street||!city||!state||!pincode||!landMark) {
            return res.status(400).json({success: false, message: "Please fill all required fields"});
        }
        if(!/^(?!([6-9])\1{9})[6-9]\d{9}$/.test(altPhone)){
            return res.json({success:false,message:"Phone number should be a 10 digit valid number"});
        }
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

const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue'
            });
        }

        const { finalAmount, currency = 'INR' } = req.body;
        if (!finalAmount || finalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(finalAmount * 100), // amount convert into paise (multiply by 100)
            currency: currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1 // Auto capture payment
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);

        return res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount:razorpayOrder.amount,
            currency:razorpayOrder.currency,
            key: process.env.RAZORPAY_TEST_KEY_ID
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};

// Verify Razorpay Payment
const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        // Create signature
        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_TEST_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        // Verify signature
        if (razorpay_signature === expectedSign) {
            return res.json({
                success: true,
                message: 'Payment verified successfully',
                paymentId: razorpay_payment_id
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};

// Get available coupons for user
const getAvailableCoupons = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            return res.json({ success: false, message: "User not authenticated" });
        }

        // Find all active coupons that haven't expired
        const coupons = await Coupon.find({
            isList: true,
            expireOn: { $gte: new Date() }
        }).sort({ offerPrice: -1 });

        // Filter coupons that user hasn't used and meet usage limits
        const availableCoupons = [];
        
        for (const coupon of coupons) {
            // Check if user has already used this coupon
            const hasUsed = coupon.usedBy.some(usage => 
                usage.user.toString() === user._id.toString()
            );
            
            // Check usage limit
            const isWithinLimit = !coupon.usageLimit || coupon.usedBy.length < coupon.usageLimit;
            
            if (!hasUsed && isWithinLimit) {
                availableCoupons.push(coupon);
            }
        }

        res.json({
            success: true,
            coupons: availableCoupons
        });
    } catch (error) {
        console.error("Error fetching available coupons:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching available coupons"
        });
    }
};

// applyCoupon function
const applyCoupon = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            return res.json({ success: false, message: "User not authenticated" });
        }

        const { couponCode, orderAmount } = req.body;

        if (!couponCode) {
            return res.json({
                success: false,
                message: "Please enter a coupon code"
            });
        }

        // Ensure orderAmount is a number
        const numericOrderAmount = parseFloat(orderAmount);

        const validation = await Coupon.validateCoupon(couponCode, user._id, numericOrderAmount);
        
        if (!validation.isValid) {
            return res.json({
                success: false,
                message: validation.message
            });
        }

        res.json({
            success: true,
            message: "Coupon applied successfully",
            discountAmount: validation.discountAmount,
            finalAmount: validation.finalAmount,
            coupon: {
                _id: validation.coupon._id,
                name: validation.coupon.name,
                offerPrice: validation.coupon.offerPrice
            }
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({
            success: false,
            message: "Error applying coupon"
        });
    }
};

const getWalletBalance = async (req,res) => {
    try {
        const wallet = await Wallet.findOne({userId:req.session.user._id});
        if(!wallet)return res.json({success:false,message:"Wallet not found"});
        return res.status(200).json({success:true,balance:wallet?.balance||0});
    } catch (error) {
        console.log("something error while processing");
        return res.json({success:false,message:"Failed to fetch wallet"});
    }
};

const placeOrder = async (req,res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.json({ redirectUrl: "/pageNotFound" });

        const selectedAddressId = req.session.selectedAddress;
        if (!selectedAddressId)return res.json({ message: "Please select a delivery address" });

        const  {paymentMethod , razorpayPaymentId , razorpayOrderId,appliedCouponCode} = req.body;

        if (!['Cash On Delivery', 'Razorpay', 'Wallet'].includes(paymentMethod)) {
            return res.json({ message: "Invalid payment method" });
        }

        const cart = await Cart.findOne({ userId: user._id }).populate({
            path:'items.productId',
            select:"productName image regularPrice salePrice stock status isBlocked"
        });
        if (!cart || cart.items.length === 0)return res.json({ message: "Cart is empty" });

        for (const item of cart.items) {
            const product = item.productId;
            
            if (!product || product.isBlocked||product.status !== "Available") {
                return res.json({ 
                    message: `Product ${product?.productName || 'unknown'} is no longer available` 
                });
            }

            if (product.quantity < item.quantity) {
                return res.json({ 
                    message: `Insufficient stock for ${product.productName}. Only ${product.quantity} available.` 
                });
            }
        }

        const address = await Address.findById(selectedAddressId);
        if (!address)return res.json({ message: "Address not found" });

        // Calculate total
        const totalPrice = cart.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        let discount = 0;
        let couponApplied = false;
        let couponId = null;

        if(appliedCouponCode){
            const couponValidation = await Coupon.validateCoupon(appliedCouponCode,user._id,totalPrice);
            if(couponValidation.isValid){
                discount = couponValidation.discountAmount;
                couponApplied = true;
                couponId = couponValidation.coupon._id;
            }else{
                console.log('Coupon validation failed:', couponValidation.message);
                return res.json({success:false,message:couponValidation.message})
            }
        }

        const finalPrice = totalPrice - discount;

        const orderedItems = cart.items.map((item) => {
            const product = item.productId;
            
            return {
                product: product._id,
                name: product.productName, 
                image: product.image[0],
                quantity: item.quantity,
                price: item.price
            };
        });

        let paymentStatus = "Pending";
        let paymentDate = null;
        let transactionId = null;

        if (paymentMethod === "Cash On Delivery") {
            paymentStatus = "Pending"; // Paid after delivery
        } else if (paymentMethod === "Razorpay") {
            if (!razorpayPaymentId || !razorpayOrderId) {
                return res.json({ 
                    success: false, 
                    message: "Payment details missing for Razorpay" 
                });
            }
            paymentStatus = "Paid";
            paymentDate = new Date();
            transactionId = razorpayPaymentId;
        } else if (paymentMethod === "Wallet") {
            const wallet = await Wallet.findOne({userId:req.session.user._id});
            if(!wallet)return res.json({success:false,message:"Wallet not found"});

            if(wallet.balance < finalPrice){
                return res.json({success:false,message:`Insufficient wallet balance:₹${wallet.balance}.Required:₹${finalPrice}`});
            }

            wallet.balance -= finalPrice;
            wallet.transactions.push({
                type:"debit",
                amount:finalPrice,
                description:`Order payment.`,
            });
            await wallet.save();

            paymentStatus = "Paid";
            paymentDate = new Date();
            transactionId = "WALLET-" + Date.now();
        }

        // Create order
        const newOrder = new Order({
            userId:req.session.user._id,
            orderedItems: orderedItems,
            totalPrice,
            discount,
            finalPrice,
            address: {
                addressType:address.addressType,
                name:address.name,
                address:address.address,
                phone:address.phone,
                altPhone:address.altPhone,
                street:address.street,
                city:address.city,
                state:address.state,
                pincode:address.pincode,
                landMark:address.landMark
            },
            status: "Pending", // must match your enum
            createdOn: new Date(),
            couponApplied: couponApplied,
            invoice: new Date(),
            paymentMethod,
            paymentStatus,
            transactionId,
            paymentDate
        });

        await newOrder.save();

        // Mark coupon as used if applied
        if (couponApplied && couponId) {
            await Coupon.findByIdAndUpdate(
                couponId,
                {
                    $push: {
                        usedBy: {
                            user: user._id,
                            usedAt: new Date(),
                            orderId: newOrder._id
                        }
                    }
                }
            );
        }

        // Decrease stock
        for (const item of cart.items) {
            await Product.findByIdAndUpdate(
                item.productId._id,
                { $inc: { quantity: -item.quantity } },
                { new: true }
            );
        }

        // Clear cart
        await Cart.findOneAndUpdate(
            { userId: user._id },
            { $set: { items: [] } }
        );

        // Clear selected address from session
        delete req.session.selectedAddress;

        return res.json({ 
            success: true, 
            orderId:newOrder.orderId,
            amount:newOrder.finalPrice,
            email:req.session.user.email,
            message:"Order placed successfully",
        });
    } catch (error) {
        console.log("error while placing order:",error);
        return res.status(500).json({
            success: false,
            message: "Failed to place order. Please try again."
        });
    }
};

const orderSuccess = async(req,res) => {
    try {
        const {orderId} = req.query;
        if (!orderId) {
            return res.redirect("/pageNotFound");
        }
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
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    addToCartFromWishlist,
    addToCart,
    loadCartPage,
    removeFromCart,
    updateQuantity,
    loadCheckoutPage,
    addAddress,
    editAddress,
    selectAddress,
    removeBlockedItem,
    createRazorpayOrder,
    verifyPayment,
    getAvailableCoupons,
    applyCoupon,
    getWalletBalance,
    placeOrder,
    orderSuccess,
    loadContact,
};  