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
               .text(`Invoice #: ${order.orderId}`, 400, 85, { align: 'right' })
               .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString('en-IN', {
                   day: '2-digit',
                   month: 'short',
                   year: 'numeric'
               })}`, 400, 100, { align: 'right' })
               .text(`Payment Method: ${order.paymentMethod || 'COD'}`, 400, 115, { align: 'right' })
               .text(`Payment Status: ${order.paymentStatus || 'Pending'}`, 400, 130, { align: 'right' });

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
               .text('Bill To:', 50, 170);

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(order.address?.name || userData.name || 'N/A', 50, 190)
               .text(order.address?.address || 'N/A', 50, 205, { width: 250 })
               .text(`${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`, 50, 220)
               .text(`Phone: ${order.address?.phone || userData.phone || 'N/A'}`, 50, 235)
               .text(`Email: ${userData.email || 'N/A'}`, 50, 250);

            // Shipping Information (if different)
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('Ship To:', 320, 170);

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(order.address?.name || userData.name || 'N/A', 320, 190)
               .text(order.address?.address || 'N/A', 320, 205, { width: 230 })
               .text(`${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`, 320, 220)
               .text(`Phone: ${order.address?.phone || userData.phone || 'N/A'}`, 320, 235);

            // Table Header
            const tableTop = 290;
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .rect(50, tableTop, 500, 25)
               .fill('#3498db');

            doc.fillColor('#ffffff')
               .text('Item', 60, tableTop + 8)
               .text('Qty', 320, tableTop + 8, { width: 50, align: 'center' })
               .text('Price', 380, tableTop + 8, { width: 80, align: 'right' })
               .text('Amount', 470, tableTop + 8, { width: 70, align: 'right' });

            // Table Items
            let yPosition = tableTop + 35;
            doc.font('Helvetica').fillColor('#2c3e50');

            order.orderedItems.forEach((item, index) => {
                const productName = item.product?.productName || item.name || 'Product';
                const quantity = item.quantity;
                const price = item.price;
                const total = price * quantity;

                // Alternate row background
                if (index % 2 === 0) {
                    doc.rect(50, yPosition - 5, 500, 25).fill('#ecf0f1');
                }

                doc.fillColor('#2c3e50')
                   .fontSize(10)
                   .text(productName, 60, yPosition, { width: 250 })
                   .text(quantity.toString(), 320, yPosition, { width: 50, align: 'center' })
                   .text(`₹${price.toLocaleString('en-IN')}`, 380, yPosition, { width: 80, align: 'right' })
                   .text(`₹${total.toLocaleString('en-IN')}`, 470, yPosition, { width: 70, align: 'right' });

                yPosition += 25;

                // Check if we need a new page
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }
            });

            // Summary Box
            yPosition += 20;
            const summaryTop = yPosition;

            // Subtotal
            doc.fontSize(10)
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

module.exports = { generateInvoice };