require("dotenv").config();
const express = require("express");
const path = require("path");
const database = require("./config/db");
const userRouter = require("./routers/userRouter");
const adminRouter = require("./routers/adminRouter");
const passport = require("./config/passport");
const session = require("express-session");
const cron = require('node-cron');
const methodOverride = require("method-override");
const Category = require('./models/categorySchema');
const multer = require("multer");

const app = express();

app.use((req,res,next) => {
    res.setHeader("Cache-Control","no-store","no-cache","must-revalidate","proxy-revalidate");
    res.setHeader("Pragma","no-cache");
    res.setHeader("Expires","0");
    res.setHeader("Surrogate-Control","no-store");
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly:true,
        secure: false,
        maxAge: 86400000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/admin'), path.join(__dirname, 'views/user')]);
app.use(express.static(path.join(__dirname,"public")));
app.use(express.static(path.join(__dirname,"public/admin/assets")));
app.use(methodOverride('_method'));

database();

cron.schedule('0 0 * * 1', async function () {
    const now = new Date();
    const twoweekAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
        const result = await Category.updateMany(
            {
                offer:{$gt:0},
                offerAddedAt:{$lt:twoweekAgo}
            },
            {
                $set:{offer:0},
                $unset:{offerAddedAt:""}
            }
        );
        console.log("result removed Count:",result.modifiedCount);
    } catch (error) {
        console.log("error removing offer",error);
    }
});

app.use('/admin', adminRouter);
app.use('/', userRouter);

app.use((error,req,res,next) => {
    if(error instanceof multer.MulterError){
        if(error.code === "LIMIT_FILE_SIZE"){
            return res.redirect("/admin/addProduct?error=File too large . Max size is 10MB per file.");
        }
        if(error.code === "LIMIT_FILE_COUNT"){
            return res.redirect("/admin.addProduct?error=Too many files . Max 5 Files allowed.");
        }
        if(error.code === "LIMIT_UNEXPECTED_FILE"){
            return res.redirect("/admin/addProduct?error=Unexpected file field");
        }
    }
    if(error.message.includes("Invalid file type")){
        return res.redirect("/admin/addProduct?error=Invalid file type. only JPEG , JPG and PNG are allowed");
    }
    next(error);
});

app.listen(process.env.PORT, () => {
    console.log("server is running");
});