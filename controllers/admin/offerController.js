const mongoose = require("mongoose");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Offer = require("../../models/offerSchems");

function getOfferStatus(offer) {
  const now = new Date();
  if (!offer.isActive) return "Inactive";
  if (new Date(offer.endDate) < now) return "Expired";
  return "Active";
}

const loadOffers = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");
        const page = parseInt(req.query.page)||1;
        const limit = 6;
        const skip = (page - 1) * limit;
        
        const now = new Date();
        const activeCount = await Offer.countDocuments({isActive:true,endDate:{$gte:now}});
        const inactiveCount = await Offer.countDocuments({
            $or:[
                {isActive:false},
                {isActive:true,endDate:{$lt:now}}
            ]
        });
        
        const offers = await Offer.find()
        .populate("category","name")
        .populate("product","productName")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
        .lean();

        offers.forEach(offer => (offer.displayStatus = getOfferStatus(offer)))
        
        const totalOffers = await Offer.countDocuments();
        const totalPages = Math.ceil(totalOffers/limit);
        res.render("offers",{offers,activeCount,inactiveCount,currentPage:page,totalPages,totalOffers,limit});
    } catch (error) {
        console.log("something wrong while loading:",error);
        return res.redirect("/admin/pageError");
    }
};

const loadAddOffer = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");
        const categories = await Category.find({isListed:true});
        const products = await Product.find({isBlocked:false});
        res.render("add-offer",{categories,products});
    } catch (error) {
        console.log("error while loading add offer page:",error);
        return res.redirect("/admin/pageError");
    }
};

const addOffer = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");

        const {offerName,offerType,offerValue,offerAppliedTo,categories,products,startDate,endDate} = req.body;
        if(!offerName||!offerType||!offerValue||!offerAppliedTo||!startDate||!endDate){
            return res.status(404).json({success:false,message:"All fields required"});
        }

        // Validate categories or products based on offerAppliedTo
        if (offerAppliedTo === "category" && (!categories || !Array.isArray(categories) || categories.length === 0)) {
            return res.status(400).json({ success: false, message: "At least one category is required" });
        }
        if (offerAppliedTo === "product" && (!products || !Array.isArray(products) || products.length === 0)) {
            return res.status(400).json({ success: false, message: "At least one product is required" });
        }

        // Validate ObjectIds for categories or products
        if (offerAppliedTo === "category") {
            const validCategories = await Category.find({ _id: { $in: categories } });
            if (validCategories.length !== categories.length) {
                return res.status(400).json({ success: false, message: "One or more category IDs are invalid" });
            }
        }
        if (offerAppliedTo === "product") {
            const validProducts = await Product.find({ _id: { $in: products } });
            if (validProducts.length !== products.length) {
                return res.status(400).json({ success: false, message: "One or more product IDs are invalid" });
            }
        }

        // Check for existing offers on selected categories or products
        if (offerAppliedTo === "category") {
            const existingOffers = await Offer.find({
                offerAppliedTo: "category",
                category: { $in: categories },
                isActive: true,
                endDate: { $gte: new Date() } // Only consider active offers that haven't expired
            }).populate("category", "name");

            if (existingOffers.length > 0) {
                const categoryNames = existingOffers
                    .map(offer => offer.category.map(cat => cat.name).join(", "))
                    .join("; ");
                return res.status(400).json({
                    success: false,
                    message: `The following categories already have active offers: ${categoryNames}`
                });
            }
        }
        if (offerAppliedTo === "product") {
            const existingOffers = await Offer.find({
                offerAppliedTo: "product",
                product: { $in: products },
                isActive: true,
                endDate: { $gte: new Date() } // Only consider active offers that haven't expired
            }).populate("product", "productName");

            if (existingOffers.length > 0) {
                const productNames = existingOffers
                    .map(offer => offer.product.map(prod => prod.productName).join(", "))
                    .join("; ");
                return res.status(400).json({
                    success: false,
                    message: `The following products already have active offers: ${productNames}`
                });
            }
        }

        const existOffer = await Offer.findOne({name:offerName});
        if(existOffer){
            return res.json({success:false,message:"Offer is already exist!"});
        }

        const newOffer = new Offer({
            name:offerName,
            offerType,
            percentage:offerValue,
            offerAppliedTo,
            category:offerAppliedTo === "category"?categories:[],
            product:offerAppliedTo === "product"?products:[],
            startDate,
            endDate
        });

        await newOffer.save();
        return res.status(200).json({success:true,message:"Offer added successfully."});

    } catch (error) {
        console.log("Something wrong while adding an offer:",error);
        return res.json({success:false,message:"Something wrong while adding an offer"});
    }
};

const loadEditOffer = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");
 
        const {offerId} = req.query;
        if(!offerId)return res.status(404).json({success:false,message:"Offer Id is missing"});

        const offer = await Offer.findById(offerId);
        if(!offer)return res.status(404).json({success:false,message:"Offer not found"});

        const categories = await Category.find({isListed:true});
        const products = await Product.find({isBlocked:false});

        res.render("edit-offer",{offer,categories,products});
    } catch (error) {
        console.log("error while loading edit offer page:",error);
        return res.redirect("/admin/pageError");
    }
};

const editOffer = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");

        const {id,offerName,offerType,offerValue,offerAppliedTo,category,product,startDate,endDate} = req.body;

        const offer = await Offer.findById(id);
        if(!offer)return res.status(404).json({success:false,message:"Offer Id is missing"});

        if(!offerName||!offerType||!offerValue||!offerAppliedTo||!startDate||!endDate){
            return res.status(404).json({success:false,message:"All fields required"});
        }

        // Validate categories or products based on offerAppliedTo
        if (offerAppliedTo === "category" && (!category || !Array.isArray(category) || category.length === 0)) {
            return res.status(400).json({ success: false, message: "At least one category is required" });
        }
        if (offerAppliedTo === "product" && (!product || !Array.isArray(product) || product.length === 0)) {
            return res.status(400).json({ success: false, message: "At least one product is required" });
        }

        // Validate ObjectIds for categories or products
        if (offerAppliedTo === "category") {
            const validCategories = await Category.find({ _id: { $in: category } });
            if (validCategories.length !== category.length) {
                return res.status(400).json({ success: false, message: "One or more category IDs are invalid" });
            }
        }
        if (offerAppliedTo === "product") {
            const validProducts = await Product.find({ _id: { $in: product } });
            if (validProducts.length !== product.length) {
                return res.status(400).json({ success: false, message: "One or more product IDs are invalid" });
            }
        }

        // Check for existing offers on selected categories or products
        if (offerAppliedTo === "category") {
            const existingOffers = await Offer.find({
                offerAppliedTo: "category",
                category: { $in: category },
                isActive: true,
                endDate: { $gte: new Date() } // Only consider active offers that haven't expired
            }).populate("category", "name");

            if (existingOffers.length > 0) {
                const categoryNames = existingOffers
                    .map(offer => offer.category.map(cat => cat.name).join(", "))
                    .join("; ");
                return res.status(400).json({
                    success: false,
                    message: `The following categories already have active offers: ${categoryNames}`
                });
            }
        }
        if (offerAppliedTo === "product") {
            const existingOffers = await Offer.find({
                offerAppliedTo: "product",
                product: { $in: product },
                isActive: true,
                endDate: { $gte: new Date() } // Only consider active offers that haven't expired
            }).populate("product", "productName");

            if (existingOffers.length > 0) {
                const productNames = existingOffers
                    .map(offer => offer.product.map(prod => prod.productName).join(", "))
                    .join("; ");
                return res.status(400).json({
                    success: false,
                    message: `The following products already have active offers: ${productNames}`
                });
            }
        }

        offer.name = offerName;
        offer.offerType = offerType;
        offer.percentage = offerValue;
        offer.offerAppliedTo = offerAppliedTo;
        offer.category = offerAppliedTo === "category" ? category : [];
        offer.product = offerAppliedTo === "product" ? product : [];
        offer.startDate = startDate;
        offer.endDate = endDate;

        await offer.save();
        return res.status(200).json({success:true,message:"Offer updated successfully."});

    } catch (error) {
        console.log("error while editing an offer:",error);
        return res.redirect("/admin/pageError");
    }
};

const deleteOffer = async (req,res) => {
    try {
        const admin = req.session?.admin;
        if(!admin)return res.redirect("/admin/login");

        const offerId = req.params?.id;
        if(!offerId)return res.json({success:false,message:"Order Id is missing"});

        await Offer.findByIdAndDelete(offerId);
        return res.status(200).json({success:true,message:"Offer deleted successfully."})
    } catch (error) {
        console.log("error while deleting an offer:",error);
        return res.redirect("/admin/pageError");
    }
};

const statusChange = async (req, res) => {
    try {
        const admin = req.session?.admin;
        if (!admin) return res.redirect("/admin/login");

        const { id } = req.params;
        const offer = await Offer.findById(id);
        if (!offer) return res.json({ success: false, message: "Offer not found." });

        const now = new Date();
        if(new Date(offer.endDate) < now && !offer.isActive){
            return res.json({success:false,message:"Cannot activate expired offer"});
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        res.json({
            success: true,
            message: `Offer ${offer.isActive ? "activated" : "deactivated"} successfully.`,
            newStatus:getOfferStatus(offer)
        });
    } catch (error) {
        console.log("Error toggling offer status:", error);
        res.json({ success: false, message: "Something went wrong while changing offer status." });
    }
};

module.exports = {
    loadOffers,
    loadAddOffer,
    addOffer,
    loadEditOffer,
    editOffer,
    deleteOffer,
    statusChange,
};