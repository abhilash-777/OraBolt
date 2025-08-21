const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");


const loadLogin = (req, res) => {

    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.render("login", { message: null });

};

const login = async function (req, res) {

    try {

        const { email, password } = req.body;
        //console.log("admin data", email, password);
        const admin = await User.findOne({ email, isAdmin: true });
        //console.log("stored admin data:", admin);

        if (!admin) {
            console.log("No admin found");
            return res.redirect("/admin/login");
        }
        const passwordMatch = await bcrypt.compare(password, admin.password);
        if(!passwordMatch){
            console.error("password is does not match!");
            return res.redirect("/admin/login");
        }
        req.session.admin = {
            id:admin._id,
            email:admin.email
        };
        return res.redirect("/admin");

    } catch (error) {
        console.log("Login error", error);
        return res.redirect('/admin/pageError');
    }

};

const pageError = async function (req, res) {
    try {
        res.render("admin-error")
    } catch (error) {
        res.status(500).json({error:"Internal server error"});
    }
}

const loadDash = async function (req, res) {
    try {
        res.render("dashboard");
    } catch (error) {
        res.redirect("/admin/pageError");
    }
};

const logout = async function (req, res) {

    try {
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying ssession", err);
                return res.redirect('/admin/pageError');
            }
            return res.redirect("/admin/login");
        })
    } catch (error) {
        console.error("logout failed", error);
        res.redirect("/admin/pageError");
    }

}

module.exports = {
    loadLogin,
    login,
    loadDash,
    pageError,
    logout
}