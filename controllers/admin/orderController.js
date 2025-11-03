const {Schema, default: mongoose} = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");

const loadOrderList = async (req, res) => {
    try {
        const admin = req.session?.admin;
        if (!admin) return res.redirect("/admin/pageError");

        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get search and filter parameters
        const searchQuery = req.query.search || "";
        const statusFilter = req.query.status || "";

        // Build query object
        let query = {};

        // Search by order ID or user name/email
        if (searchQuery) {
            const users = await User.find({
                $or: [
                    { name: { $regex: searchQuery, $options: "i" } },
                    { email: { $regex: searchQuery, $options: "i" } }
                ]
            }).select("_id");

            const userIds = users.map(user => user._id);

            query.$or = [
                { orderId: { $regex: searchQuery, $options: "i" } },
                { userId: { $in: userIds } }
            ];
        }

        // Filter by status
        if (statusFilter && statusFilter !== "Show all") {
            query.status = statusFilter;
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch orders with pagination
        const orders = await Order.find(query)
            .populate("userId", "name email")
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        res.render("orderList", {
            admin,
            orders,
            currentPage: page,
            totalPages,
            limit,
            searchQuery,
            statusFilter,
            totalOrders
        });
    } catch (error) {
        console.log("Error while loading order list:", error);
        return res.redirect("/admin/pageError");
    }
};

// ========== ORDER DETAILS ==========
const loadOrderDetails = async (req, res) => {
    try {
        const admin = req.session?.admin;
        if (!admin) return res.redirect("/admin/pageError");

        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate("userId", "name email phone createdOn")
            .populate("address" , "name phone street city state pincode")
            .populate("orderedItems.product", "productName price image")
            .lean();

        if (!order) return res.redirect("/admin/order-list");

        res.render("orderDetails", { admin, order });
    } catch (error) {
        console.log("Error while loading order details:", error);
        return res.redirect("/admin/pageError");
    }
};

// DELETE ORDER
const deleteOrder = async (req, res) => {
    try {
      const admin = req.session?.admin;
      if (!admin) return res.redirect("/admin/pageError");

        await Order.findByIdAndDelete(req.params.id);
        res.redirect("/admin/order-list");
    } catch (error) {
        console.log("Error deleting order:", error);
        res.redirect("/admin/pageError");
    }
};

// UPDATE ORDER
const updateOrderStatus = async (req, res) => {
    try{
      const admin = req.session?.admin;
      if (!admin) return res.json({success:false,message:"Admin not found"});

    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) return res.json({success:false,message:"Order not found"});

    order.status = status;
    order.orderedItems.forEach(item => item.status = status);
    await order.save();

    return res.status(200).json({success:true,message:"Order status updated.",redirectUrl:`/admin/order-details/${orderId}`});
  } catch (error) {
    console.log("Error updating order status:", error);
    return res.json({success:false,message:"something went wrong while updating order status."})
  }
};

// Update single item's status
const updateItemStatus = async (req, res) => {
  try {
      const admin = req.session?.admin;
      if (!admin) return res.json({success:false,message:"Admin not found"});

      const { orderId, itemId } = req.params;
      const { status } = req.body;

      if(!mongoose.isValidObjectId(orderId)||!mongoose.isValidObjectId(itemId))return res.json({success:false,message:"Invalid order or item ID"});

      const order = await Order.findById(orderId);
      if (!order) return res.json({success:false,message:"Order not found"});

      const item = order.orderedItems.id(itemId);
      if (!item) return res.json({success:false,message:"Item not found"});;

      const oldStatus = item.status;
      if(status === 'Returned' && oldStatus !== 'Returned'){
        const product = await Product.findById(item.product);
        if(product){
          product.quantity += item.quantity;
          await product.save();
          console.log(`Restored ${item.quantity} units to product ${product.productName}`);
        }

        if(item.returnRequest){
          item.returnRequest.status = "Returned";
          item.returnRequest.resolvedOn = new Date();
        }
      }

      item.status = status;

      const activeItems = order.orderedItems.filter(i => 
        i.status !== 'Cancelled' && i.status !== 'Returned'
      );
      if(activeItems.length === 0){
        const allCancelled = order.orderedItems.every(i => i.status === 'Cancelled');
        const allReturned = order.orderedItems.every(i => i.status === 'Returned');
        if(allReturned){
          order.status = "Returned";
        }else if(allCancelled){
          order.status = "Cancelled";
        }else{
          order.status = "Returned";
        }
      }else{
        const statusPriority = {
          'Pending':1,
          'Processing':2,
          'Shipped':3,
          "Delivered":4
        };

        const maxStatus = activeItems.reduce((max,item) => {
          const itemPriority = statusPriority[item.status]||0;
          const maxPriority = statusPriority[max] || 0;
          return itemPriority > maxPriority ? item.status : max;
        },"Pending");

        order.status = maxStatus;
      }
      await order.save();

      return res.json({success:true,message:"Item status updated.",redirectUrl:`/admin/order-details/${orderId}`});
  } catch (error) {
      console.log("Error updating item status:", error);
      return res.json({success:false,message:"Oops , Something went wrong"});
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const admin = req.session?.admin;
    if (!admin) return res.json({success:false,message:"Admin not found"});

    const { id } = req.params;
    const { paymentStatus } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.json({success:false,message:"Order not found"});

    order.paymentStatus = paymentStatus;
    await order.save();

    return res.json({success:true,message:"Order payment status updated.",redirectUrl:`/admin/order-details/${id}`})
  } catch (err) {
    console.error("Error updating payment status:", err);
    return res.json({success:false,message:"Someting went wrong while updating order payment status."})
  }
};

const handleReturnDecision = async (req, res) => {
  try {
    const admin = req.session?.admin;
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized: Admin access required' });

    const { orderId, itemId } = req.params;
    const { action, rejectionReason } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or item ID' });
    }

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action. Must be 'approve' or 'reject'" });
    }

    // Validate rejection reason if rejecting
    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length < 10)) {
      return res.status(400).json({ success: false, message: "Please provide at least 10 characters for rejection reason" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // Check if there's a pending return request
    if (item.returnRequest?.status !== 'Return Requested') {
      return res.status(400).json({ success: false, message: "No pending return request found for this item" });
    }

    if (action === 'approve') {
      const product = await Product.findById(item.product);
      if(product){
        product.quantity += item.quantity;
        await product.save();
      }

      const originalSubTotal = order.orderedItems.reduce((sum,i) => sum + (i.price * i.quantity),0);
      
      const itemOriginalPrice = item.price * item.quantity;
      
       // Add safety check for division by zero
      if (!originalSubTotal || originalSubTotal === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot calculate refund: Invalid order total"
        });
      }
      const itemProportion = itemOriginalPrice/originalSubTotal;
      
      const currentActiveItems = order.orderedItems.filter(i => i.status !== "Cancelled" && i.status !== "Returned" && i._id.toString() !== itemId.toString());

      if (currentActiveItems.length === 0) {
        const itemRefundAmount = order.finalPrice - (order.shippingCost || 0);
        
        // Update item status
        item.returnRequest.status = 'Returned';
        item.returnRequest.resolvedOn = new Date();
        item.status = 'Returned';
        
        order.finalPrice = 0;
        order.refundAmount = (order.refundAmount || 0) + itemRefundAmount;
        order.refundDate = new Date();
        order.status = 'Returned';
        order.paymentStatus = 'Refunded';
        
        // Add to wallet
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
          wallet = new Wallet({
            userId: order.userId,
            balance: itemRefundAmount,
            transactions: [{
              type: "credit",
              amount: itemRefundAmount,
              description: `Refund for returned item in order ${order.orderId || order._id}`,
              date: new Date()
            }]
          });
        } else {
          wallet.balance += itemRefundAmount;
          wallet.transactions.push({
            type: "credit",
            amount: itemRefundAmount,
            description: `Refund for returned item in order ${order.orderId || order._id}`,
            date: new Date()
          });
        }
        await wallet.save();
        await order.save();
        
        return res.json({
          success: true,
          message: `Return approved successfully. ₹${itemRefundAmount.toFixed(2)} refunded to user's wallet.`,
          redirectUrl: `/admin/order-details/${orderId}`,
        });
      }

      const currentSubTotal = currentActiveItems.reduce((sum,i) => sum + (i.price * i.quantity),0);

      const originalDiscountRate = (originalSubTotal - (order.finalPrice -(order.shippingCost||0)))/originalSubTotal;
      
      const remainingDiscount = currentSubTotal * originalDiscountRate;
      
      const newFinalPrice = currentSubTotal - remainingDiscount + (order.shippingCost||0);
      
      // Calculate refund amount
      const itemRefundAmount = Math.round((order.finalPrice - newFinalPrice) * 100) / 100;

      // Validate refund amount
      if (isNaN(itemRefundAmount) || itemRefundAmount < 0) {
        console.error("Invalid refund calculation:", {
          originalSubTotal,
          itemOriginalPrice,
          itemProportion,
          currentSubTotal,
          totalDiscount,
          itemDiscountShare,
          itemRefundAmount
        });
        return res.status(400).json({
          success: false,
          message: "Cannot calculate refund amount. Please contact support."
        });
      }

      // Update item status
      item.returnRequest.status = 'Returned';
      item.returnRequest.resolvedOn = new Date();
      item.status = 'Returned';

      // Update order financials
      order.finalPrice = Math.max(0, order.finalPrice - itemRefundAmount);
      
      order.refundAmount = (order.refundAmount || 0) + itemRefundAmount;
      
      order.refundDate = new Date();

      // Add refund to user's wallet
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: itemRefundAmount,
          transactions: [{
            type: "credit",
            amount: itemRefundAmount,
            description: `Refund for returned item in order ${order.orderId || order._id}`,
            date: new Date()
          }]
        });
      } else {
        wallet.balance += itemRefundAmount;
        wallet.transactions.push({
          type: "credit",
          amount: itemRefundAmount,
          description: `Refund for returned item in order ${order.orderId || order._id}`,
          date: new Date()
        });
      }
      await wallet.save();

      // Update payment status
      const remainingActiveItems = order.orderedItems.filter(i => 
        i.status !== 'Cancelled' && i.status !== 'Returned'
      );

      if (remainingActiveItems.length === 0) {
        // All items returned or cancelled
        order.status = 'Returned';
        order.paymentStatus = 'Refunded';
        order.finalPrice = 0;
      } else {
        // Partial return
        order.status = 'Partial Return';
        order.paymentStatus = "Partial Refund Initiated";
      }

    } else {
      // Reject return
      item.returnRequest.status = 'Return Rejected';
      item.returnRequest.rejectionReason = rejectionReason.trim();
      item.status = 'Return Rejected'; // Revert to delivered for rejected return
    }

    // Set resolution details
    item.returnRequest.resolvedOn = new Date();

    const allReturnedOrCancelled = order.orderedItems.every(
      i => i.returnRequest?.status === 'Return Approved' || i.status === 'Cancelled' || i.status === "Returned"
    );
    if(allReturnedOrCancelled){
      order.finalPrice = 0;
      order.refundAmount = order.totalPrice;
    }

    // Update overall order status
    const hasRequestedReturns = order.orderedItems.some(
      i => i.returnRequest?.status === 'Return Requested'
    );
    const someReturned = order.orderedItems.some(
      i => i.returnRequest?.status === 'Return Approved'
    );

    if (!hasRequestedReturns) {
      if (allReturnedOrCancelled) {
        order.status = 'Returned'; // All items are returned or cancelled
      } else if (someReturned) {
        order.status = 'Processing'; // Some items are returned, others are not
      } else {
        order.status = 'Delivered'; // No items are returned (e.g., all rejected)
      }
    }

    await order.save();

    return res.json({
      success: true,
      message: `Return request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      redirectUrl: `/admin/order-details/${orderId}`,
    });
  } catch (error) {
    console.log("Error processing return decision:", error);
    return res.json({ success: false, message: "Something went wrong while processing return request" });
  }
};


module.exports = {
  loadOrderList,
  loadOrderDetails,
  deleteOrder,
  updateOrderStatus,
  updatePaymentStatus,
  updateItemStatus,
  handleReturnDecision
};