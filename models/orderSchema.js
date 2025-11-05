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
                enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled","Return Requested","Return Approved","Return Rejected","Returned"],
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
        address: {
            addressType: {
                type: String,
                required: true,
                enum: ["Home", "Work", "Other"]
            },
            name: {
                type: String,
                required: true
            },
            address: {
                type: String,
                required: true
            },
            street: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            landMark: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            pincode: {
                type: Number,
                required: true
            },
            phone: {
                type: String,
                required: true
            },
            altPhone: {
                type: String
            }
        },
        invoice : {
            type : Date
        },
        status : {
            type : String,
            required : true,
            enum : ["Pending","Payment Pending","Processing","Shipped","Delivered","Cancelled","Return Request","Partial Return","Returned"]
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
            enum: ['Paid', 'Pending', 'Cancelled','Failed','Refunded','Refund Initiated','Partial Refund Initiated'],
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
    });

    // Auto-generate orderId before saving
orderSchema.pre('save', async function(next) {
    if (!this.orderId) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderId = `ORD${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

    const Order = mongoose.model("Order",orderSchema);

    module.exports = Order;