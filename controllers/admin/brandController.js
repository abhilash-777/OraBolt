const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const loadBrandPage = async function (req,res) {

    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;
        const brandData = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
        const totalBrand = await Brand.countDocuments();
        const totalPage = Math.ceil(totalBrand/limit);
        const reverseBrand = brandData.reverse();
        res.render("brand",{
            data:reverseBrand,
            currentPage:page,
            totalPage:totalPage,
            totalBrand:totalBrand
        })

    } catch (error) {
        res.redirect("/admin/pageError");
    }
    
};

const addBrand = async function (req,res) {

    try {
        
        const brandName = req.body.name;
        const findBrand = await Brand.findOne({brandName});

        if(findBrand){

            const page = 1;
            const limit = 5;
            const brandData = await Brand.find({}).sort({createdAt:-1}).limit(limit);
            const totalBrand = await Brand.countDocuments();
            const totalPage = Math.ceil(totalBrand/limit);

            return res.render("brand",{
                data : brandData,
                currentPage:page,
                totalPage:totalPage,
                totalBrand:totalBrand,
                errorMessage:"Brand already exists"
            })

        }else{
            const image = req.file.filename;
            const newBrand = new Brand({
                brandName,
                brandImage:[image]
            })
            if(!image){
                return res.render("brand",{
                    errorMessage:"please upload a brand image",
                })
            }
            await newBrand.save();
            res.redirect("/admin/brand");
        }
        
    } catch (error) {
        console.log("error add brand:",error);
        res.redirect("/admin/pageError");
    }
    
};

const blockBrand = async function (req,res) {

    try {
        const {id} = req.query;
        if(!id){
            return res.status(400).json({error:"BrandId missing"});
        }
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/brand");        
    } catch (error) {
        return res.status(400).json({error:"error block brand"});
    }
    
};

const unBlockBrand = async function (req,res) {

    try {
        const {id} = req.query;
        if(!id){
            return res.status(400).json({error:"BrandId missing"});
        }
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/brand");
    } catch (error) {
        return res.status(400).json({error:"error unblock brand"});
    }
    
};

const deleteBrand = async function (req,res) {

    try {
        const brandId = req.params.id;
        const brand = await Brand.findById(brandId);
        if(!brand){
            return res.status(404).json({success:false,error:"brandId not found"});
        }
        await Brand.findByIdAndDelete(brandId);
        return res.status(200).json({success:true});
    } catch (error) {
        return res.status(400).json({error:"error delete brand"});
    }
    
};


module.exports = {
    loadBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}