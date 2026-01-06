const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Category = require("../../models/categorySchema");
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.render("login", { message: null });
};

const login = async function (req, res) {
    try {

        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.render("login",{message:"Admin not found"});
        }
        const passwordMatch = await bcrypt.compare(password, admin.password);
        if(!passwordMatch){
            return res.render("login",{message:"Password does not match"});
        }
        req.session.admin = {
            id:admin._id,
            email:admin.email
        };
        return res.redirect("/admin");

    } catch (error) {
        console.log("Login error", error);
        return res.redirect('/admin/pageError');
    }
};

const pageError = async function (req, res) {
    try {
        res.render("admin-error")
    } catch (error) {
        res.status(500).json({error:"Internal server error"});
    }
}

const loadDash = async function (req, res) {
    try {
        const productsCount = await Product.countDocuments({isBlocked:false});
        const ordersCount = await Order.countDocuments({status:{$ne:"Payment Pending"}});
        const categoryCount = await Category.countDocuments({isListed:true});

        const revenueData = await Order.aggregate([
            {
                $match: { 
                    status: {$nin:["Cancelled","Returned","Payment Pending"]},
                    paymentStatus: {$in:["Paid","Pending","Partial Refund Initiated"]}
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$finalPrice" },
                    totalRefunds: { $sum: "$refundAmount" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const discountData = await Order.aggregate([
            {
                $match: { 
                    status: {$nin:["Cancelled","Returned","Payment Pending"]},
                    paymentStatus: {$in:["Paid","Pending"]}
                }
            },
            {
                $group:{
                    _id:null,
                    totalDiscount:{$sum:"$discount"}
                }
            },{$project:{_id:0,totalDiscount:1}}
        ]);

        const netRevenue = revenueData.length > 0 ? 
        (revenueData[0].totalRevenue - revenueData[0].totalRefunds) : 0;

        // get chart data for different time periods
        const dailyData = await getSalesData('daily');
        const weeklyData = await getSalesData('weekly');
        const monthlyData = await getSalesData('monthly');
        const yearlyData = await getSalesData('yearly');

        res.render("dashboard", {
            productsCount,
            categoryCount,
            ordersCount,
            totalRevenue:netRevenue,
            totalDiscount:discountData[0].totalDiscount > 0 ? discountData[0].totalDiscount : 0,
            chartData: {
                daily: dailyData,
                weekly: weeklyData,
                monthly: monthlyData,
                yearly: yearlyData
            }
        });
    } catch (error) {
        console.error('Dashboard Error:', error.message);
        res.redirect("/admin/pageError");
    }
};

const loadSalesReportPage = async (req, res) => {
    try {
        res.render("sales-report", {
            title: "Sales Report"
        });
    } catch (error) {
        console.error('Sales Report Page Error:', error.message);
        res.redirect("/admin/pageError");
    }
};

// get sales data for different time periods
const getSalesData = async (period) => {
    try {
        let dateFormat, daysBack;
        const now = new Date();
        let startDate = new Date(now);
        
        switch (period) {
            case 'daily':
                // Last 7 days
                daysBack = 7;
                dateFormat = '%Y-%m-%d';
                startDate.setDate(now.getDate() - daysBack + 1);
                break;
                
            case 'weekly':
                // Last 8 weeks
                daysBack = 56; // 8 weeks
                dateFormat = '%Y-%U';
                startDate.setDate(now.getDate() - daysBack + 1);
                break;
                
            case 'monthly':
                // Last 12 months
                daysBack = 365; // 12 months
                dateFormat = '%Y-%m';
                startDate.setDate(now.getDate() - daysBack + 1);
                break;
                
            case 'yearly':
                // Last 5 years
                daysBack = 1825; // 5 years
                dateFormat = '%Y';
                startDate.setDate(now.getDate() - daysBack + 1);
                break;
        }

        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        const salesData = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    status: { $nin: ["Cancelled", "Returned","Payment Pending"] },
                    paymentStatus: { $in: ["Paid", "Pending","Partial Refund Initiated"] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: dateFormat,
                            date: "$createdOn"
                        }
                    },
                    revenue: { $sum: "$finalPrice" },
                    orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        return salesData;

    } catch (error) {
        console.error(`Error getting ${period} sales data:`, error);
        return [];
    }
};

// api endpoint for chart data
const getChartDataAPI = async (req, res) => {
    try {
        const { period } = req.query;
        
        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
            return res.status(400).json({ error: 'Invalid period' });
        }

        const chartData = await getSalesData(period);
        res.json({ success: true, data: chartData });
        
    } catch (error) {
        console.error('Chart API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to get date range for period (used by best sellers)
const getDateRangeForPeriod = (period) => {
    const now = new Date();
    let startDate = new Date(now);
    let daysBack;

    switch (period) {
        case 'daily':
            daysBack = 7;
            startDate.setDate(now.getDate() - daysBack + 1);
            break;
        case 'weekly':
            daysBack = 56;
            startDate.setDate(now.getDate() - daysBack + 1);
            break;
        case 'monthly':
            daysBack = 365;
            startDate.setDate(now.getDate() - daysBack + 1);
            break;
        case 'yearly':
            daysBack = 1825;
            startDate.setDate(now.getDate() - daysBack + 1);
            break;
        default:
            daysBack = 365;
            startDate.setDate(now.getDate() - daysBack + 1);
    }

    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
};

// Get top 10 best selling products with period filter
const getTopProducts = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const dateRange = getDateRangeForPeriod(period);

        const topProducts = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    },
                    status: { $nin: ["Cancelled", "Returned","Payment Pending"] },
                    paymentStatus: { $in: ["Paid", "Pending","Partial Refund Initiated"] }
                }
            },
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.status": { $nin: ["Cancelled", "Returned"] }
                }
            },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$orderedItems.quantity", "$orderedItems.price"] 
                        } 
                    }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $project: {
                    productName: "$productInfo.productName",
                    productImage: "$productInfo.image",
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({ success: true, data: topProducts });
    } catch (error) {
        console.error('Top Products Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Get top 10 best selling categories with period filter
const getTopCategories = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const dateRange = getDateRangeForPeriod(period);

        const topCategories = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    },
                    status: { $nin: ["Cancelled", "Returned","Payment Pending"] },
                    paymentStatus: { $in: ["Paid", "Pending","Partial Refund Initiated"] }
                }
            },
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.status": { $nin: ["Cancelled", "Returned"] }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.category",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$orderedItems.quantity", "$orderedItems.price"] 
                        } 
                    }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $project: {
                    categoryName: "$categoryInfo.name",
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({ success: true, data: topCategories });
    } catch (error) {
        console.error('Top Categories Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Get top 10 best selling brands with period filter
const getTopBrands = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const dateRange = getDateRangeForPeriod(period);

        const topBrands = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    },
                    status: { $nin: ["Cancelled", "Returned","Payment Pending"] },
                    paymentStatus: { $in: ["Paid", "Pending","Partial Refund Initiated"] }
                }
            },
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.status": { $nin: ["Cancelled", "Returned"] }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $lookup: {
                    from: "brands",
                    localField: "productInfo.brand",
                    foreignField: "_id",
                    as: "brandInfo"
                }
            },
            { $unwind: "$brandInfo" },
            {
                $group: {
                    _id: "$brandInfo._id",
                    brandName: { $first: "$brandInfo.brandName" },
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$orderedItems.quantity", "$orderedItems.price"] 
                        } 
                    }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 0,
                    brandName: 1,
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({ success: true, data: topBrands });
    } catch (error) {
        console.error('Top Brands Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// calculate sales data from orders
const calculateSalesData = (orders) => {
    let totalOrders = 0;
    let totalSales = 0;
    let totalDiscount = 0;
    let totalAmount = 0;
    let totalRefunded = 0;

    orders.forEach(order => {
        // Only count orders that are not cancelled/returned for sales metrics
        if (order.status !== 'Cancelled' && order.status !== 'Returned') {
            totalOrders++;
            totalSales += order.finalPrice || 0;
            totalDiscount += order.discount || 0;
            totalAmount += order.totalPrice || 0;
        }
        
        // Calculate refunded amount
        // order.refundAmount if it exists
        if (order.refundAmount && order.refundAmount > 0) {
            totalRefunded += order.refundAmount;
            console.log(`Order ${order.orderId}: Refund from order.refundAmount = ₹${order.refundAmount}`);
        } 
        // Calculate from fully cancelled/returned orders
        else if (order.status === 'Cancelled' || order.status === 'Returned') {
            // Only count if payment was made (not COD or Pending)
            if (order.paymentStatus === 'Refunded' || 
                order.paymentStatus === 'Refund Initiated' ||
                order.paymentStatus === 'Partial Refund Initiated' ||
                order.paymentStatus === 'Paid') {
                totalRefunded += order.finalPrice || 0;
                console.log(`Order ${order.orderId}: Full order refund = ₹${order.finalPrice}`);
            }
        }
        // Calculate item-level refunds for partial returns
        else if (order.orderedItems && order.orderedItems.length > 0) {
            let itemRefunds = 0;
            order.orderedItems.forEach(item => {
                if (item.status === 'Cancelled' || item.status === 'Returned') {
                    const itemTotal = (item.price || 0) * (item.quantity || 1);
                    itemRefunds += itemTotal;
                }
            });
            
            if (itemRefunds > 0 && (order.paymentStatus === 'Paid' || 
                                     order.paymentStatus === 'Partial Refund Initiated' ||
                                     order.paymentStatus === 'Refund Initiated')) {
                totalRefunded += itemRefunds;
                console.log(`Order ${order.orderId}: Item-level refunds = ₹${itemRefunds}`);
            }
        }
    });

    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    console.log(`Total Refunded Amount: ₹${totalRefunded.toFixed(2)}`);

    return {
        totalOrders,
        totalSales: totalSales.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        totalRefunded: totalRefunded.toFixed(2),
        averageOrderValue: averageOrderValue.toFixed(2)
    };
};

// Helper function to check if item has offer (price is less than regular price)
const hasItemOffer = (item) => {
    return false; 
};

// Helper function to get product status from order
const getProductStatus = (item, order) => {
    // Check item status
    if (item.status) {
        return item.status;
    }
    
    // Fallback to order status
    return order.status;
};

// Update the generateSalesReport to populate product details
const generateSalesReport = async (req, res) => {
    try {
        const { period, startDate, endDate, reportType = 'view' } = req.query;
        
        let start, end = new Date();
        end.setHours(23, 59, 59, 999);
        
        switch (period) {
            case 'daily':
                start = new Date();
                start.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                start = new Date();
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                start = new Date();
                start.setMonth(start.getMonth() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'yearly':
                start = new Date();
                start.setFullYear(start.getFullYear() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'custom':
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date();
                start.setHours(0, 0, 0, 0);
        }

        const query = {
            createdOn: {
                $gte: start,
                $lte: end
            },
            status: { $nin: ['Cancelled',"Returned","Payment Pending"] }, 
            paymentStatus: { $in: ['Paid', 'Pending',"Failed","Partial Refund Initiated"] } 
        };

        // Get orders with populated data
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });

        // Calculate report data
        const reportData = calculateSalesData(orders);
        
        reportData.period = period;
        reportData.startDate = start;
        reportData.endDate = end;
        reportData.orders = orders;

        if (reportType === 'pdf') {
            return generatePDFReport(reportData, res);
        } else if (reportType === 'excel') {
            return generateExcelReport(reportData, res);
        } else {
            res.json({
                success: true,
                data: reportData
            });
        }

    } catch (error) {
        console.error("Sales report error:", error);
        res.status(500).json({
            success: false,
            message: "Error generating sales report"
        });
    }
};

// Generate PDF Report with Item Details
const generatePDFReport = async (reportData, res) => {
    try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const filename = `sales-report-${Date.now()}.pdf`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        
        doc.pipe(res);

        // Title - Centered and bold
        doc.fontSize(24).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
        doc.moveDown(1.5);
        
        // Period info - Centered
        const periodInfo = [
            `Period: ${reportData.period.charAt(0).toUpperCase() + reportData.period.slice(1)}`,
            `Date Range: ${reportData.startDate.toDateString()} - ${reportData.endDate.toDateString()}`
        ];
        doc.fontSize(11).font('Helvetica').text(periodInfo.join(' | '), { align: 'center' });
        doc.moveDown(1.5);
        
        // Summary section
        doc.fontSize(16).font('Helvetica-Bold').text('Summary', 50, doc.y);
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica');
        const summaryItems = [
            `Total Orders: ${reportData.totalOrders || 0}`,
            `Total Sales(Final): ${formatCurrency(reportData.totalSales)}`,
            `Total Discount: ${formatCurrency(reportData.totalDiscount)}`,
            `Total Amount (Before Discount): ${formatCurrency(reportData.totalAmount)}`,
            `Total Refunded: ${formatCurrency(reportData.totalRefunded || 0)}`,
            `Average Order Value: ${formatCurrency(reportData.averageOrderValue)}`
        ];
        
        let summaryY = doc.y + 10;
        summaryItems.forEach((item, index) => {
            doc.text(`• ${item}`, 60, summaryY + (index * 18));
        });
        doc.moveDown(2.5);

        // Orders detail section with items
        if (reportData.orders && reportData.orders.length > 0) {
            doc.fontSize(16).font('Helvetica-Bold').text('Order Details', 50, doc.y);
            doc.moveDown(1);
            
            reportData.orders.forEach((order, orderIndex) => {
                // Check if we need a new page
                if (doc.y > doc.page.height - 200) {
                    doc.addPage();
                }
                
                // Order Header Box
                const orderHeaderY = doc.y;
                doc.fillColor('#4a90e2')
                   .rect(50, orderHeaderY, 495, 25)
                   .fill();
                
                doc.fillColor('white').fontSize(11).font('Helvetica-Bold');
                doc.text(`#${order.orderId}`, 60, orderHeaderY + 7, { continued: true })
                   .text(`  |  ${new Date(order.createdOn).toLocaleDateString('en-IN')}`, { continued: true })
                   .text(`  |  ${order.userId?.name || 'N/A'}`, { continued: true })
                   .text(`  |  ${order.status}`, { align: 'left' });
                
                doc.moveDown(0.5);
                
                // Order Summary
                doc.fillColor('black').fontSize(10).font('Helvetica');
                const orderSummaryY = doc.y;
                doc.text(`Total: ${formatCurrency(order.totalPrice)}`, 60, orderSummaryY, { continued: true })
                   .text(`  |  Discount: ${formatCurrency(order.discount)}`, { continued: true })
                   .text(`  |  Final: ${formatCurrency(order.finalPrice)}`, { continued: true })
                   .text(`  |  Payment: ${order.paymentStatus}`, { align: 'left' });
                
                doc.moveDown(0.8);
                
                // Items Table Header
                const itemTableY = doc.y;
                doc.fillColor('#e8f4f8')
                   .rect(60, itemTableY, 485, 18)
                   .fill();
                
                doc.fillColor('#333').fontSize(9).font('Helvetica-Bold');
                doc.text('Item Name', 65, itemTableY + 5, { width: 200, continued: false });
                doc.text('Qty', 270, itemTableY + 5, { width: 30, continued: false });
                doc.text('Price', 305, itemTableY + 5, { width: 70, align: 'right', continued: false });
                doc.text('Total', 380, itemTableY + 5, { width: 70, align: 'right', continued: false });
                doc.text('Status', 455, itemTableY + 5, { width: 85, continued: false });
                
                doc.moveDown(0.3);
                
                // Items
                if (order.orderedItems && order.orderedItems.length > 0) {
                    doc.fontSize(8).font('Helvetica');
                    
                    order.orderedItems.forEach((item, itemIndex) => {
                        // Check if we need a new page
                        if (doc.y > doc.page.height - 100) {
                            doc.addPage();
                        }
                        
                        const itemY = doc.y + 5;
                        const itemName = item.name || 'N/A';
                        const truncatedName = itemName.length > 40 ? itemName.substring(0, 40) + '...' : itemName;
                        const itemPrice = item.price || 0;
                        const itemTotal = itemPrice * (item.quantity || 1);
                        const productStatus = getProductStatus(item, order);
                        const hasOffer = hasItemOffer(item);
                        
                        // Alternating background
                        if (itemIndex % 2 === 0) {
                            doc.fillColor('#f9f9f9')
                               .rect(60, itemY - 3, 485, 16)
                               .fill();
                        }
                        
                        doc.fillColor('black');
                        doc.text(truncatedName, 65, itemY, { width: 200, continued: false });
                        doc.text((item.quantity || 1).toString(), 270, itemY, { width: 30, continued: false });
                        
                        // Show price with offer indicator if applicable
                        if (hasOffer) {
                            doc.fillColor('#d32f2f');
                            doc.text(formatCurrency(itemPrice) + ' *', 305, itemY, { width: 70, align: 'right', continued: false });
                        } else {
                            doc.fillColor('black');
                            doc.text(formatCurrency(itemPrice), 305, itemY, { width: 70, align: 'right', continued: false });
                        }
                        
                        doc.fillColor('black');
                        doc.text(formatCurrency(itemTotal), 380, itemY, { width: 70, align: 'right', continued: false });
                        
                        // Color code status
                        if (productStatus === 'Cancelled' || productStatus === 'Returned') {
                            doc.fillColor('#d32f2f');
                        } else if (productStatus === 'Delivered') {
                            doc.fillColor('#388e3c');
                        } else {
                            doc.fillColor('#f57c00');
                        }
                        doc.text(productStatus, 455, itemY, { width: 85, continued: false });
                        doc.fillColor('black');
                        
                        doc.moveDown(0.4);
                    });
                    
                    // Add note about offers
                    const hasAnyOffer = order.orderedItems.some(item => hasItemOffer(item));
                    if (hasAnyOffer) {
                        doc.fontSize(7).fillColor('#666')
                           .text('* Offer price applied', 65, doc.y + 5);
                        doc.fillColor('black');
                    }
                }
                
                // Separator line between orders
                doc.moveDown(0.5);
                doc.strokeColor('#ddd')
                   .lineWidth(1)
                   .moveTo(50, doc.y)
                   .lineTo(545, doc.y)
                   .stroke();
                doc.moveDown(1);
            });
        } else {
            doc.fontSize(12).text('No orders found for the selected period.', { align: 'center' });
            doc.moveDown(1);
        }
        
        // Add footer to all pages
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.fontSize(10).font('Helvetica-Oblique').fillColor('black').text(
                `Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i + 1} of ${range.count}`, 
                50, doc.page.height - 30, 
                { align: 'center', width: 495 }
            );
        }
        
        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ success: false, message: "Error generating PDF" });
    }
};

// Generate Excel Report with Item Details
const generateExcelReport = async (reportData, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');
        
        // Add summary section
        worksheet.addRow(['SALES REPORT SUMMARY']);
        worksheet.addRow([`Period: ${reportData.period}`]);
        worksheet.addRow([`Date Range: ${reportData.startDate.toDateString()} - ${reportData.endDate.toDateString()}`]);
        worksheet.addRow([]);
        worksheet.addRow(['Total Orders', reportData.totalOrders]);
        worksheet.addRow(['Total Sales (Final)', `₹${reportData.totalSales}`]);
        worksheet.addRow(['Total Discount', `₹${reportData.totalDiscount}`]);
        worksheet.addRow(['Total Amount (Before Discount)', `₹${reportData.totalAmount}`]);
        worksheet.addRow(['Total Refunded', `₹${reportData.totalRefunded || 0}`]);
        worksheet.addRow(['Average Order Value', `₹${reportData.averageOrderValue}`]);
        worksheet.addRow([]);
        worksheet.addRow(['ORDER DETAILS WITH ITEMS']);
        worksheet.addRow([]);

        // Add headers for order and item data
        const headerRow = worksheet.addRow([
            'Order ID', 
            'Date', 
            'Customer', 
            'Order Total', 
            'Order Discount', 
            'Order Final', 
            'Order Status', 
            'Payment Status',
            'Item Name',
            'Item Qty',
            'Item Price',
            'Item Total',
            'Offer Applied',
            'Item Status'
        ]);

        // Style the header row
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4A90E2' }
        };
        headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Add order and item data
        if (reportData.orders && reportData.orders.length > 0) {
            reportData.orders.forEach(order => {
                const orderId = order.orderId;
                const orderDate = order.createdOn.toDateString();
                const customerName = order.userId?.name || 'N/A';
                const totalPrice = order.totalPrice || 0;
                const discount = order.discount || 0;
                const finalPrice = order.finalPrice || 0;
                const status = order.status;
                const paymentStatus = order.paymentStatus;
                
                if (order.orderedItems && order.orderedItems.length > 0) {
                    order.orderedItems.forEach((item, index) => {
                        const itemName = item.name || 'N/A';
                        const itemQty = item.quantity || 1;
                        const itemPrice = item.price || 0;
                        const itemTotal = itemPrice * itemQty;
                        const hasOffer = hasItemOffer(item);
                        const productStatus = getProductStatus(item, order);
                        
                        const row = worksheet.addRow([
                            index === 0 ? orderId : '',
                            index === 0 ? orderDate : '',
                            index === 0 ? customerName : '',
                            index === 0 ? `₹${totalPrice}` : '',
                            index === 0 ? `₹${discount}` : '',
                            index === 0 ? `₹${finalPrice}` : '',
                            index === 0 ? status : '',
                            index === 0 ? paymentStatus : '',
                            itemName,
                            itemQty,
                            `₹${itemPrice.toFixed(2)}`,
                            `₹${itemTotal.toFixed(2)}`,
                            hasOffer ? 'Yes' : 'No',
                            productStatus
                        ]);
                        
                        // Color code item status
                        const statusCell = row.getCell(14);
                        if (productStatus === 'Cancelled' || productStatus === 'Returned') {
                            statusCell.font = { color: { argb: 'FFD32F2F' }, bold: true };
                        } else if (productStatus === 'Delivered') {
                            statusCell.font = { color: { argb: 'FF388E3C' }, bold: true };
                        } else {
                            statusCell.font = { color: { argb: 'FFF57C00' } };
                        }
                        
                        // Highlight offer applied
                        if (hasOffer) {
                            row.getCell(11).font = { color: { argb: 'FFD32F2F' }, bold: true };
                            row.getCell(13).font = { color: { argb: 'FFD32F2F' }, bold: true };
                        }
                    });
                } else {
                    // Order with no items
                    worksheet.addRow([
                        orderId,
                        orderDate,
                        customerName,
                        `₹${totalPrice}`,
                        `₹${discount}`,
                        `₹${finalPrice}`,
                        status,
                        paymentStatus,
                        'No items',
                        '',
                        '',
                        '',
                        '',
                        ''
                    ]);
                }
            });
        } else {
            worksheet.addRow(['No orders found for the selected period.']);
        }

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Set response headers
        const filename = `sales-report-${Date.now()}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Excel generation error:", error);
        res.status(500).json({ success: false, message: "Error generating Excel file" });
    }
};

// Format currency helper
function formatCurrency(amount) {
    return `₹${parseFloat(amount || 0).toFixed(2)}`;
}

const logout = async function (req, res) {

    try {
        delete req.session.admin;
        delete req.session.adminId;
        req.session.save((err) => {
            if (err) {
                console.error("Error destroying ssession", err);
                return res.redirect('/admin/pageError');
            }
            return res.redirect("/admin/login");
        })
    } catch (error) {
        console.error("logout failed", error);
        res.redirect("/admin/pageError");
    }

}

module.exports = {
    loadLogin,
    login,
    loadDash,
    loadSalesReportPage,
    getChartDataAPI,
    getTopProducts,
    getTopCategories,
    getTopBrands,
    generateSalesReport,
    pageError,
    logout
}