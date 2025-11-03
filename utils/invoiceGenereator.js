// utils/invoiceGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateInvoice(order, userData, filePath) {
    return new Promise((resolve, reject) => {
        try {
            // Create a PDF document
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50,
                bufferPages: true
            });

            // Pipe to file
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Company Header
            doc.fontSize(20)
               .fillColor('#2c3e50')
               .text('OraBolt', 50, 50, { align: 'left' })
               .fontSize(10)
               .fillColor('#7f8c8d')
               .text('', 50, 75)
               .text('Benglure, Karnataka - 560060', 50, 88)
               .text('Phone: +91-XXXXXXXXXX', 50, 101)
               .text('Email: admin@oraboltofficial369gmail.com', 50, 114);

            // Invoice Title
            doc.fontSize(28)
               .fillColor('#e74c3c')
               .text('INVOICE', 400, 50, { align: 'right' });

            // Order Details Box
            doc.fontSize(10)
               .fillColor('#2c3e50')
               .text(`Invoice #: ${order.orderId}`, 350, 85, { align: 'right' })
               .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString('en-IN', {
                   day: '2-digit',
                   month: 'short',
                   year: 'numeric'
               })}`, 350, 100, { align: 'right' })
               .text(`Payment Method: ${order.paymentMethod || 'COD'}`, 350, 115, { align: 'right' })
               .text(`Payment Status: ${order.paymentStatus || 'Pending'}`, 350, 130, { align: 'right' });

            // Order Status
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Order Status: ', 350, 145, { continued: true, align: 'right' })
               .fillColor(getStatusColor(order.status))
               .text(order.status, { align: 'right' });

            // Horizontal line
            doc.strokeColor('#bdc3c7')
               .lineWidth(1)
               .moveTo(50, 150)
               .lineTo(550, 150)
               .stroke();

            // Billing Information
            doc.fontSize(12)
               .fillColor('#2c3e50')
               .font('Helvetica-Bold')
               .text('Bill To:', 50, 190);

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(order.address?.name || userData.name || 'N/A', 50, 210)
               .text(order.address?.address || 'N/A', 50, 225, { width: 250 })
               .text(`${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`, 50, 240)
               .text(`Phone: ${order.address?.phone || userData.phone || 'N/A'}`, 50, 255)
               .text(`Email: ${userData.email || 'N/A'}`, 50, 270);

            // Shipping Information (if different)
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('Ship To:', 320, 190);

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(order.address?.name || userData.name || 'N/A', 320, 210)
               .text(order.address?.address || 'N/A', 320, 225, { width: 230 })
               .text(`${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`, 320, 240)
               .text(`Phone: ${order.address?.phone || userData.phone || 'N/A'}`, 320, 255);

            // Table Header
            const tableTop = 310;
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .rect(50, tableTop, 500, 25)
               .fill('#3498db');

            doc.fillColor('#ffffff')
               .text('Item', 60, tableTop + 8,{width:180})
               .text('Status', 245, tableTop + 8, { width: 75, align: 'center' })
               .text('Qty', 325, tableTop + 8, { width: 35, align: 'center' })
               .text('Price', 365, tableTop + 8, { width: 80, align: 'right' })
               .text('Amount', 450, tableTop + 8, { width: 90, align: 'right' });

            // Table Items
            let yPosition = tableTop + 35;
            doc.font('Helvetica').fillColor('#2c3e50');

            order.orderedItems.forEach((item, index) => {
                const productName = item.product?.productName || item.name || 'Product';
                const quantity = item.quantity;
                const price = item.price;
                const total = price * quantity;
                const itemStatus = item.status || 'Pending';

                // Alternate row background
                if (index % 2 === 0) {
                    doc.rect(50, yPosition - 5, 500, 25).fill('#ecf0f1');
                }

                // Product Name (wrapped if too long)
                doc.fillColor('#2c3e50')
                   .fontSize(9)
                   .text(productName, 60, yPosition, { width: 170, ellipsis: true });

                // Item Status with color coding
                doc.fontSize(8)
                   .fillColor(getStatusColor(itemStatus))
                   .font('Helvetica-Bold')
                   .text(itemStatus, 240, yPosition + 2, { width: 70, align: 'center' });

                doc.fontSize(9)
                   .fillColor('#2c3e50')
                   .font('Helvetica')
                   .text(quantity.toString(), 320, yPosition, { width: 50, align: 'center' })
                   .text(`₹${price.toLocaleString('en-IN')}`, 380, yPosition, { width: 80, align: 'right' })
                   .text(`₹${total.toLocaleString('en-IN')}`, 470, yPosition, { width: 70, align: 'right' });

               // Show return/cancellation info if applicable
                if (item.status === 'Cancelled' || 
                    item.status === 'Returned' || 
                    item.returnRequest?.status === 'Return Requested' ||
                    item.returnRequest?.status === 'Return Approved') {
                    yPosition += 12;
                    doc.fontSize(7)
                       .fillColor('#7f8c8d')
                       .font('Helvetica-Oblique')
                       .text(
                           item.status === 'Cancelled' ? '(Item Cancelled)' :
                           item.status === 'Returned' ? '(Item Returned)' :
                           item.returnRequest?.status === 'Return Requested' ? '(Return Pending)' :
                           '(Return Approved)',
                           60, yPosition, { width: 170 }
                       );
                }

                yPosition += 30;

                // Check if we need a new page
                if (yPosition > 680) {
                    doc.addPage();
                    yPosition = 50;
                }
            });

            // Summary Box
            yPosition += 20;
            const summaryTop = yPosition;

            // Subtotal
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#34495e')
               .text('Subtotal:', 370, summaryTop, { width: 90, align: 'right' })
               .text(`₹${(order.totalPrice || order.finalPrice).toLocaleString('en-IN')}`, 470, summaryTop, { width: 70, align: 'right' });

            // Discount
            if (order.discount && order.discount > 0) {
                yPosition += 20;
                doc.text('Discount:', 370, yPosition, { width: 90, align: 'right' })
                   .fillColor('#27ae60')
                   .text(`-₹${order.discount.toLocaleString('en-IN')}`, 470, yPosition, { width: 70, align: 'right' })
                   .fillColor('#34495e');
            }

            // Coupon Discount
            if (order.couponDiscount && order.couponDiscount > 0) {
                yPosition += 20;
                doc.text('Coupon Discount:', 370, yPosition, { width: 90, align: 'right' })
                   .fillColor('#27ae60')
                   .text(`-₹${order.couponDiscount.toLocaleString('en-IN')}`, 470, yPosition, { width: 70, align: 'right' })
                   .fillColor('#34495e');
            }

            // Shipping
            yPosition += 20;
            const shippingText = (order.shippingCost && order.shippingCost > 0) 
                ? `₹${order.shippingCost.toLocaleString('en-IN')}` 
                : 'FREE';
            doc.text('Shipping:', 370, yPosition, { width: 90, align: 'right' })
               .fillColor(shippingText === 'FREE' ? '#27ae60' : '#34495e')
               .text(shippingText, 470, yPosition, { width: 70, align: 'right' });

            // Total Line
            yPosition += 10;
            doc.strokeColor('#bdc3c7')
               .lineWidth(1)
               .moveTo(370, yPosition)
               .lineTo(550, yPosition)
               .stroke();

            // Total Amount
            yPosition += 15;
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('Total Amount:', 370, yPosition, { width: 90, align: 'right' })
               .fontSize(14)
               .fillColor('#e74c3c')
               .text(`₹${order.finalPrice.toLocaleString('en-IN')}`, 470, yPosition, { width: 70, align: 'right' });

            // Footer
            const footerTop = 750;
            doc.fontSize(8)
               .fillColor('#7f8c8d')
               .font('Helvetica')
               .text('Thank you for your business!', 50, footerTop, { align: 'center', width: 500 })
               .text('This is a computer generated invoice and does not require a signature.', 50, footerTop + 15, { align: 'center', width: 500 })
               .text('For any queries, please contact our customer support.', 50, footerTop + 30, { align: 'center', width: 500 });

            // Finalize PDF
            doc.end();

            stream.on('finish', () => {
                resolve(filePath);
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to get color for status
function getStatusColor(status) {
    const statusColors = {
        'Pending': '#f39c12',
        'Processing': '#3498db',
        'Shipped': '#9b59b6',
        'Delivered': '#27ae60',
        'Cancelled': '#e74c3c',
        'Return Requested': '#e67e22',
        'Return Approved': '#16a085',
        'Return Rejected': '#c0392b',
        'Returned': '#95a5a6'
    };
    return statusColors[status] || '#34495e';
}

module.exports = { generateInvoice };