const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const loadBrandPage = async function (req,res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;

        const search = req.query.search||"";
        const filter = {
            isDeleted:false,
            brandName:{$regex:search,$options:'i'}
        }

        const brandData = await Brand.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({createdAt:-1});
        const totalBrand = await Brand.countDocuments(filter);
        const totalPage = Math.ceil(totalBrand/limit);
        const reverseBrand = brandData;

        res.render("brand",{
            data:reverseBrand,
            currentPage:page,
            totalPage:totalPage,
            totalBrand:totalBrand,
            search
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

const toggleList = async (req,res) => {
    try{
        const {brandId,isBlocked} = req.body;
        if(!brandId)return res.status(400).json({success:false,message:"Brand ID is missing."});

        const brand = await Brand.findById(brandId);
        if(!brand)return res.status(400).json({success:false,message:"Brand not found."});

        brand.isBlocked = isBlocked;
        brand.save();

        return res.status(200).json({success:true,message:"Status updated"});
    }catch(error){
        console.log("Something wrong while processing:",error);
        return res.status(500).json({success:false,message:"Something wrong while processing"})
    }
};

const deleteBrand = async function (req,res) {

    try {
        const brandId = req.params.id;
        const brand = await Brand.findById(brandId);
        if(!brand){
            return res.status(404).json({success:false,error:"brandId not found"});
        }
        brand.isDeleted = true;
        brand.save();
        return res.status(200).json({success:true});
    } catch (error) {
        return res.status(400).json({error:"error delete brand"});
    }
    
};


module.exports = {
    loadBrandPage,
    addBrand,
    toggleList,
    deleteBrand
}