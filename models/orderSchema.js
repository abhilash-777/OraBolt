    const mongoose = require ("mongoose");

    const {Schema} = mongoose;

    function generateUniqueOrderId() {
        const randomPart = Math.floor(100000 + Math.random() * 900000);
        return `ORD${randomPart}`;
    }

    const orderSchema = new Schema ({
        orderId : {
            type : String,
            default : generateUniqueOrderId,
            unique : true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        orderedItems : [{
            product : {
                type : Schema.Types.ObjectId,
                ref : "Product",
                required : true
            },
            name:{type:String},
            image:{type:String},
            quantity : {
                type : Number,
                required : true
            },
            price : {
                type : Number,
                default : 0
            },
            status: {
                type: String,
                enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled","Return Requested","Return Approved","Return Rejected"],
                default: "Pending"
            },
            returnRequest: {
                reason: { type: String },
                rejectionReason:{type:String},
                status: { type: String,
                    enum: ["None", "Return Requested", "Return Approved", "Return Rejected", "Returned"],
                    default: "None"
                },
                requestedOn: { type: Date },
                resolvedOn: { type: Date }
            }
        }],
        totalPrice : {
            type : Number,
            required : true
        },
        discount : {
            type : Number,
            default : 0
        },
        finalPrice : {
            type : Number,
            required : true
        },
        address : {
            type : Schema.Types.ObjectId,
            ref : "Address",
            required : true
        },
        invoice : {
            type : Date
        },
        status : {
            type : String,
            required : true,
            enum : ["Pending","Processing","Shipped","Delivered","Cancelled","Return Request","Returned"]
        },
        createdOn : {
            type : Date,
            default : Date.now,
            required : true
        },
        couponApplied : {
            type : Boolean,
            default : false
        },
        paymentMethod: {
            type: String,
            enum: ['Razorpay', 'Cash On Delivery', 'Wallet'],
            default: 'Cash On Delivery'
        },
        paymentStatus: {
            type: String,
            enum: ['Paid', 'Pending', 'Failed','Refunded','Refund Initiated','Partial Refund Initiated'],
            default: 'Pending'
        },
        transactionId: {
            type: String
        },
        paymentDate: {
            type: Date
        },
        refundAmount:{
            type:Number,
            default:0
        },
        refundDate:{
            type:Date
        }
    })

    const Order = mongoose.model("Order",orderSchema);

    module.exports = Order;