const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const subCategory = require("../../models/subCategorySchema");
const Brand = require("../../models/brandSchema");
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
                redirectUrl: "/"
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

        if (user) {
            const userData = await User.findById(req.session?.user?._id);
            const productId = req.params.id;
            if(!mongoose.Types.ObjectId.isValid(productId)){
                return res.status(400).render("page-404",{error:"Invalid ProductId"});
            }
            const productData = await Product.findById(productId).lean();
            if(!productData){
                return res.status(404).render("page-404",{error:"Product Not Found"});
            }
            const similarProducts = await Product.find({category:productData.category,
                _id:{$ne:productId}}).limit(6).lean();
            return res.render("product", {user:userData, product: productData,similarProducts});
            
        }else{
            return res.render("home",{user:null});
        }
        
    } catch (error) {
        console.log("Error occure in page loading:",error);
        return res.status(500).render("page-404",{error:"Something went wrong.Please try again"})
    }
    
};

const loadCart = async function (req,res) {

    try {

        const user = req.session?.user;
        if(user){
            const productId = req.params.id;
            const userData = await User.findById(req.session?.user?._id);
            if(!productId){
                return res.status(400).json({success:false,error:"no product in the user request"});
            }
            const productData = await Product.findById(productId).lean();
            return res.render("cart",{user:userData,product:productData});
        }else{
            return res.render("home",{user:null});
        }
        
    } catch (error) {
        console.log("cart not found",error);
        return res.redirect("/");
    }
    
};

const loadCheckout = async function (req,res) {

    try {

        const user = req.session?.user;
        if(user){
            const productId = req.params.id;
            const userData = await User.findById(req.session?.user?._id);
            if(!productId){
                return res.status(400).json({success:false,error:"Product is missing"})
            }
            const productData = await Product.findById(productId);
            return res.render("checkout",{user:userData,product:productData});
        }else{
            return res.render("home",{user:null});
        }
        
    } catch (error) {
        console.error("checkout error",error);
        return res.redirect('/');
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
    loadCart,
    loadCheckout,
    loadContact,
};  