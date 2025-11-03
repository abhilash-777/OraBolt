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
        //console.log("admin data", email, password);
        const admin = await User.findOne({ email, isAdmin: true });
        //console.log("stored admin data:", admin);

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
        const ordersCount = await Order.countDocuments();
        const categoryCount = await Category.countDocuments({isListed:true});

        const revenueData = await Order.aggregate([
            {
                $match: { 
                    status: {$nin:["Cancelled","Returned"]},
                    paymentStatus: {$in:["Paid","Pending"]}
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
                    status: { $nin: ["Cancelled", "Returned"] },
                    paymentStatus: { $in: ["Paid", "Pending"] }
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

// sales Report Generation
const generateSalesReport = async (req, res) => {
    try {
        const { period, startDate, endDate, reportType = 'view' } = req.query;
        
        let start, end = new Date();
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        // Set date range based on filter
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
            status: { $nin: ['Cancelled',"Returned"] }, 
            paymentStatus: { $in: ['Paid', 'Pending'] } 
        };

        // Get orders with populated data
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });

        // Calculate report data
        const reportData = calculateSalesData(orders);
        
        // Add date info to report data
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

// calculate sales data from orders
const calculateSalesData = (orders) => {
    let totalSales = 0;
    let totalOrders = orders.length;
    let totalDiscount = 0;
    let totalAmount = 0;

    orders.forEach(order => {
        const orderAmount = order.totalPrice || 0;
        const orderDiscount = order.discount || 0;
        const finalPrice = order.finalPrice || 0;
        
        totalAmount += orderAmount;
        totalDiscount += orderDiscount;
        totalSales += finalPrice; // Use finalPrice as it's after discount
    });

    return {
        totalSales: Math.round(totalSales * 100) / 100,
        totalOrders,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0
    };
};

// generate PDF Report
const generatePDFReport = async (reportData, res) => {
    try {
        const doc = new PDFDocument();
        const filename = `sales-report-${Date.now()}.pdf`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        
        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Period: ${reportData.period}`);
        doc.text(`Date Range: ${reportData.startDate.toDateString()} - ${reportData.endDate.toDateString()}`);
        doc.moveDown();
        
        // Summary section
        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown();
        doc.text(`Total Orders: ${reportData.totalOrders}`);
        doc.text(`Total Sales: ₹${reportData.totalSales}`);
        doc.text(`Total Discount: ₹${reportData.totalDiscount}`);
        doc.text(`Total Amount (Before Discount): ₹${reportData.totalAmount}`);
        doc.text(`Average Order Value: ₹${reportData.averageOrderValue}`);
        doc.moveDown();

        // Orders detail section
        if (reportData.orders && reportData.orders.length > 0) {
            doc.fontSize(14).text('Order Details', { underline: true });
            doc.moveDown();
            
            reportData.orders.forEach((order, index) => {
                const orderId = order.orderId;
                const customerName = order.userId?.name || 'N/A';
                const totalPrice = order.totalPrice || 0;
                const discount = order.discount || 0;
                const finalPrice = order.finalPrice || 0;
                const status = order.status;
                const paymentStatus = order.paymentStatus;
                
                doc.text(`${index + 1}. Order #${orderId}`);
                doc.text(`   Customer: ${customerName}`);
                doc.text(`   Amount: ₹${totalPrice} | Discount: ₹${discount} | Final: ₹${finalPrice}`);
                doc.text(`   Status: ${status} | Payment: ${paymentStatus}`);
                if (index < reportData.orders.length - 1) doc.moveDown(0.5);
            });
        } else {
            doc.text('No orders found for the selected period.');
        }

        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ success: false, message: "Error generating PDF" });
    }
};

// generate Excel Report
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
        worksheet.addRow(['Average Order Value', `₹${reportData.averageOrderValue}`]);
        worksheet.addRow([]);
        worksheet.addRow(['ORDER DETAILS']);
        worksheet.addRow([]);

        // Add headers for order data
        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Customer', key: 'customer', width: 20 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Discount', key: 'discount', width: 12 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Payment Status', key: 'paymentStatus', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 15 }
        ];

        worksheet.addRow(['Order ID', 'Date', 'Customer', 'Total Amount', 'Discount', 'Final Amount', 'Status', 'Payment Status', 'Payment Method']);

        // Add order data
        if (reportData.orders && reportData.orders.length > 0) {
            reportData.orders.forEach(order => {
                const orderId = order.orderId;
                const customerName = order.userId?.name || 'N/A';
                const totalPrice = order.totalPrice || 0;
                const discount = order.discount || 0;
                const finalPrice = order.finalPrice || 0;
                const status = order.status;
                const paymentStatus = order.paymentStatus;
                const paymentMethod = order.paymentMethod || 'N/A';
                
                worksheet.addRow({
                    orderId: orderId,
                    date: order.createdOn.toDateString(),
                    customer: customerName,
                    totalAmount: `₹${totalPrice}`,
                    discount: `₹${discount}`,
                    finalAmount: `₹${finalPrice}`,
                    status: status,
                    paymentStatus: paymentStatus,
                    paymentMethod: paymentMethod
                });
            });
        } else {
            worksheet.addRow(['No orders found for the selected period.']);
        }

        // Style the header row
        const headerRow = worksheet.getRow(14); // Adjust based on your row count
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };

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

const logout = async function (req, res) {

    try {
        req.session.destroy((err) => {
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
    getChartDataAPI,
    generateSalesReport,
    pageError,
    logout
}