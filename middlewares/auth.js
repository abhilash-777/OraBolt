const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
    try {
        const sessionUserId = req.session.user?req.session.user._id:null;
        const passportUserId = req.user?req.user._id:null;
        const userId = sessionUserId || passportUserId;
        if(!userId){
            return res.redirect("/login");
        }
        const user = await User.findById(userId);
        if(user && !user.isBlocked){
            return next();
        }else{
            return res.redirect("/login");
        }
    } catch (error) {
        console.error("error in authendication middleware:",error);
        res.status(500).send("Internal server error");
    }
};

const adminAuth = (req, res, next) => {
    if(req.session && req.session.admin){
        return next();
    }else{
        return res.redirect("/admin/login");
    }
};

module.exports = {
    userAuth,
    adminAuth,
}