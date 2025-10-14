const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
    try {
        const userId = req.session?.user?._id || req.user?._id;
        const acceptsJson = req.xhr || (req.headers.accept || '').includes('application/json');
        if (!userId) {
            if (acceptsJson) {
                return res.status(401).json({ success: false, redirectUrl: '/login' });
            }else{
                return res.redirect("/login")
            }
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            req.session.destroy(() => res.redirect("/login"));
            return;
        }

        req.session.user = user; // attach user for downstream routes
        next();
    } catch (error) {
        console.error("Error in authentication middleware:", error);
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