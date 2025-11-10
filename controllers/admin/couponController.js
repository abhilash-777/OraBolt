const Coupon = require("../../models/couponSchema");

// Get all coupons
const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find()
    .populate("usedBy.user","name email")
    .sort({ createdOn: -1 });
    res.render("coupon", { coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.redirect("/admin/pageError");
  }
};

// Get create coupon page
const getCreateCoupon = (req, res) => {
  res.render("createCoupon");
};

// Create new coupon
const createCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, startDate, endDate } = req.body;

    // Check if coupon name already exists
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      return res.status(400).json({success:false,message:"Coupon name already exists."})
    }

    const coupon = new Coupon({
      name,
      offerPrice: parseFloat(offerPrice),
      minimumPrice: parseFloat(minimumPrice),
      createdOn: new Date(startDate),
      expireOn: new Date(endDate),
      isList: true
    });

    await coupon.save();
    return res.status(200).json({success:true});
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({success:false,message:"Something wrong while processing"})
  }
};

const loadEditCoupon = async (req,res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if(!coupon)return res.status(404).render("coupon",{message:"Coupon not found"});
    res.render("edit-coupon",{coupon});
  } catch (error) {
    return res.redirect("/admin/pageError");
  }
};

const editCoupon = async (req,res) => {
  try {
    const couponId = req.params.id;
    if(!couponId)return res.status(404).json({success:false,message:"Coupon id is missing"});

    const {name,offerPrice,minimumPrice,startDate,endDate,useageLimit} = req.body;
    if(!name||!offerPrice||!minimumPrice||!startDate||!endDate){
      return res.status(404).json({success:false,message:"All fields are required. Please fill the fields"});
    }
    const coupon = await Coupon.findById(couponId);
    const currentCouponStartDate = new Date(coupon.createdOn).toISOString().split('T')[0];
    if(!coupon)return res.status(404).json({success:false,message:"Coupon not found"});
    if(currentCouponStartDate !== startDate)return res.json({success:false,message:"Coupon start date cannot changeable"});
    if(new Date(startDate) > new Date(endDate))return res.json({success:false,message:"End date cannot be before start Date"});
    if(useageLimit && useageLimit < 0){
      return res.json({success:false,message:"Useage limit count cannot allow below 0."});
    }

    coupon.name = name;
    coupon.offerPrice = offerPrice;
    coupon.minimumPrice = minimumPrice;
    coupon.createdOn = startDate;
    coupon.expireOn = endDate;
    coupon.usageLimit = useageLimit;

    await coupon.save();
    return res.status(200).json({success:true,message:"Coupon updated successfully."});

  } catch (error) {
    console.log("Something wrong while processing:",error);
    return res.status(500).json({success:false,message:"Something wrong while processing"});
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if(!id)return res.status(404).json({success:false,message:"coupon id is minssing"});
    await Coupon.findByIdAndDelete(id);
    return res.status(200).json({success:true})
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ success:false,message: "Error deleting coupon" });
  }
};

// Toggle coupon status
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    
    if (!coupon) {
      return res.status(404).json({success:false,message: "Coupon not found" });
    }

    const now = new Date();
    if (now > coupon.expireOn) {
      return res.status(400).json({success:false,message: "Cannot toggle status for expired coupons" });
    }

    coupon.isList = !coupon.isList;
    await coupon.save();
    
    return res.status(200).json({success:true})
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res.status(500).json({ success:false,message: "Error updating coupon status" });
  }
};

// Apply coupon (for users)
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, orderAmount } = req.body;
        const userId = req.user._id; // Assuming you have user authentication

        const validation = await Coupon.validateCoupon(couponCode, userId, parseFloat(orderAmount));
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }

        res.json({
            success: true,
            message: "Coupon applied successfully",
            discountAmount: validation.discountAmount,
            finalAmount: validation.finalAmount,
            coupon: {
                name: validation.coupon.name,
                offerPrice: validation.coupon.offerPrice
            }
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({
            success: false,
            message: "Error applying coupon"
        });
    }
};

// Mark coupon as used (call this when order is placed)
const markCouponAsUsed = async (couponId, userId, orderId) => {
    try {
        const coupon = await Coupon.findById(couponId);
        if (coupon) {
            await coupon.markAsUsed(userId, orderId);
        }
    } catch (error) {
        console.error("Error marking coupon as used:", error);
        throw error;
    }
};

module.exports = {
    getAllCoupons,
    getCreateCoupon,
    createCoupon,
    loadEditCoupon,
    editCoupon,
    deleteCoupon,
    toggleCouponStatus,
    applyCoupon,
    markCouponAsUsed
};