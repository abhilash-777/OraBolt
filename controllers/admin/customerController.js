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
        return res.status(200).json({success:true,message:"Successfully blocked the user."});
        
    } catch (error) {
        return res.status(500).json({success:false,error:"Somthing wrong while processing"});
    }
};

const unBlockCustomer = async function (req,res) {
    try {

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        return res.status(200).json({success:true,message:"Successfully unblocked the user."});
        
    } catch (error) {
        return res.status(500).json({success:false,error:"Somthing wrong while processing"});
    }
};

module.exports = {
    customerInfo,
    blockCustomer,
    unBlockCustomer
}