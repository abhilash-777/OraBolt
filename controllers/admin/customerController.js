const User = require("../../models/userSchema");

const customerInfo = async function (req,res) {

    try {

        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        let page = 1;
        if(req.query.page){
            page = parseInt(req.query.page);
        }
        const limit = 6;
        const userData =  await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*",$options:"i"}},
                {email:{$regex:".*"+search+".*",$options:"i"}},
            ]
        })
        .limit(limit)
        .skip((page-1)*limit)
        .exec();

        const count = await User.countDocuments({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*",$options:"i"}},
                {email:{$regex:".*"+search+".*",$options:"i"}},
            ]
        });

        const totalPage = Math.ceil(count/limit);

        res.render('customers',{
            data:userData,
            currentPage:page,
            totalPages:totalPage,
            totalUsers:count,
            search
        });

    } catch (error) {
        console.error("Error loading customer info",error);
        res.redirect('/admin/pageError');
    }
    
};

const blockCustomer = async function (req,res) {

    try {

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect(`/admin/user?page=${req.query.page || 1}`)
        
    } catch (error) {
        res.redirect('/admin/pageError');
    }
    
};

const unBlockCustomer = async function (req,res) {

    try {

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect(`/admin/user?page=${req.query.page || 1}`);
        
    } catch (error) {
        res.redirect("/admin/pageError");
    }
    
};

module.exports = {
    customerInfo,
    blockCustomer,
    unBlockCustomer
}