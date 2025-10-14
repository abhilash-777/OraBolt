const {Schema, default: mongoose} = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const loadOrderList = async (req, res) => {
    try {
        const admin = req.session?.admin;
        if (!admin) return res.redirect("/admin/pageError");

        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
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

// ========== UPDATE ORDER ==========
const updateOrder = async (req, res) => {
    try {
        const admin = req.session?.admin;
        if (!admin) return res.redirect("/admin/pageError");

        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.redirect("/admin/order-list");
    } catch (error) {
        console.log("Error updating order:", error);
        res.redirect("/admin/pageError");
    }
};

// ========== DELETE ORDER ==========
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

      item.status = status;
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
      item.returnRequest.status = 'Return Approved';
      item.status = 'Return Approved';

      // Calculate refund amount
      const itemRefund = item.price * item.quantity;
      order.refundAmount = (order.refundAmount || 0) + itemRefund;

      // Update payment status
      if (order.paymentStatus === 'Paid') {
        const allItemsReturnedOrCancelled = order.orderedItems.every(
          i => i.returnRequest?.status === 'Return Approved' || i.status === 'Cancelled'
        );
        order.paymentStatus = allItemsReturnedOrCancelled ? 'Refund Initiated' : 'Partial Refund Initiated';
      }

    } else {
      // Reject return
      item.returnRequest.status = 'Rejected';
      item.returnRequest.rejectionReason = rejectionReason.trim();
      item.status = 'Delivered'; // Revert to delivered for rejected return
    }

    // Set resolution details
    item.returnRequest.resolvedOn = new Date();

    // Update overall order status
    const hasRequestedReturns = order.orderedItems.some(
      i => i.returnRequest?.status === 'Return Requested'
    );

    if (!hasRequestedReturns) {
      const allReturnedOrCancelled = order.orderedItems.every(
        i => i.returnRequest?.status === 'Return Approved' || i.status === 'Cancelled'
      );
      const someReturned = order.orderedItems.some(
        i => i.returnRequest?.status === 'Return Approved'
      );

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
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    updatePaymentStatus,
    updateItemStatus,
    handleReturnDecision
};