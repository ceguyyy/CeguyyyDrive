const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const AppError = require('./AppError');

class PdfService {
    async convertToPdfIfNeeded(fileBuffer, mimeType, originalName) {
        if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
            return {
                buffer: fileBuffer,
                mimeType: 'application/pdf',
                fileName: originalName.toLowerCase().endsWith('.pdf') ? originalName : `${originalName}.pdf`
            };
        }

        try {
            const pdfDoc = await PDFDocument.create();

            if (mimeType && mimeType.startsWith('image/')) {
                let img;
                try {
                    img = await pdfDoc.embedPng(fileBuffer);
                } catch (e1) {
                    try {
                        img = await pdfDoc.embedJpg(fileBuffer);
                    } catch (e2) {
                        throw new AppError('Unsupported image format for automatic PDF conversion. Please upload a PNG, JPG, or PDF.', 400);
                    }
                }

                const page = pdfDoc.addPage([img.width, img.height]);
                page.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height,
                });
            } else {
                // Text or fallback conversion
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const page = pdfDoc.addPage([595.28, 841.89]); // A4 standard
                const { width, height } = page.getSize();

                let textContent = '';
                try {
                    textContent = fileBuffer.toString('utf-8');
                } catch (e) {
                    textContent = 'Unable to extract text content.';
                }

                const fontSize = 11;
                const lineHeight = 16;
                const margin = 50;
                const maxCharsPerLine = 80;

                const lines = [];
                const rawLines = textContent.split(/\r?\n/);
                for (const rawLine of rawLines) {
                    if (rawLine.length <= maxCharsPerLine) {
                        lines.push(rawLine);
                    } else {
                        let remaining = rawLine;
                        while (remaining.length > 0) {
                            lines.push(remaining.substring(0, maxCharsPerLine));
                            remaining = remaining.substring(maxCharsPerLine);
                        }
                    }
                }

                let currentPage = page;
                let y = height - margin;

                for (const line of lines) {
                    if (y < margin) {
                        currentPage = pdfDoc.addPage([595.28, 841.89]);
                        y = height - margin;
                    }
                    currentPage.drawText(line || ' ', {
                        x: margin,
                        y: y,
                        size: fontSize,
                        font: font,
                        color: rgb(0.1, 0.1, 0.1),
                    });
                    y -= lineHeight;
                }
            }

            const pdfBytes = await pdfDoc.save();
            const baseName = originalName.replace(/\.[^/.]+$/, '');
            return {
                buffer: Buffer.from(pdfBytes),
                mimeType: 'application/pdf',
                fileName: `${baseName}.pdf`
            };
        } catch (err) {
            console.error('PDF Conversion error:', err);
            if (err instanceof AppError) throw err;
            throw new AppError('Failed to convert file to PDF format for approval.', 500);
        }
    }

    async embedSignatureAndWatermark(pdfBuffer, { requesterName, approverName, approverRole, signatureBase64, dateStr }) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // 1. Embed Signature Image if provided
            let sigImg = null;
            if (signatureBase64) {
                try {
                    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
                    const sigBuffer = Buffer.from(base64Data, 'base64');
                    try {
                        sigImg = await pdfDoc.embedPng(sigBuffer);
                    } catch (e1) {
                        sigImg = await pdfDoc.embedJpg(sigBuffer);
                    }
                } catch (sigErr) {
                    console.warn('Could not embed signature image:', sigErr.message);
                }
            }

            const pages = pdfDoc.getPages();

            // 2. Add Watermark across EVERY page
            const watermarkText = `APPROVED | Req: ${requesterName} | Appr: ${approverName} (${approverRole})`;
            for (const page of pages) {
                const { width, height } = page.getSize();
                // Draw diagonal watermark in center of page
                page.drawText(watermarkText, {
                    x: Math.max(20, width / 6),
                    y: height / 2,
                    size: 16,
                    font: boldFont,
                    color: rgb(0.85, 0.2, 0.2),
                    opacity: 0.18,
                    rotate: degrees(35),
                });
            }

            // 3. Draw Digital Signature Box on the LAST page
            if (pages.length > 0) {
                const lastPage = pages[pages.length - 1];
                const { width } = lastPage.getSize();
                const boxWidth = 220;
                const boxHeight = sigImg ? 90 : 60;
                const boxX = width - boxWidth - 30;
                const boxY = 30;

                // Draw background white rectangle with border for readability over any existing content
                lastPage.drawRectangle({
                    x: boxX,
                    y: boxY,
                    width: boxWidth,
                    height: boxHeight,
                    color: rgb(0.98, 0.98, 0.98),
                    borderColor: rgb(0.2, 0.4, 0.8),
                    borderWidth: 1.5,
                    opacity: 0.95,
                });

                let currentY = boxY + boxHeight - 18;

                // Header title
                lastPage.drawText('DIGITALLY APPROVED & SIGNED', {
                    x: boxX + 10,
                    y: currentY,
                    size: 9,
                    font: boldFont,
                    color: rgb(0.1, 0.3, 0.7),
                });
                currentY -= 14;

                // Draw Signature Image inside the box
                if (sigImg) {
                    const maxImgWidth = boxWidth - 20;
                    const maxImgHeight = 35;
                    let imgW = sigImg.width;
                    let imgH = sigImg.height;
                    const ratio = Math.min(maxImgWidth / imgW, maxImgHeight / imgH);
                    imgW = imgW * ratio;
                    imgH = imgH * ratio;

                    lastPage.drawImage(sigImg, {
                        x: boxX + 10,
                        y: currentY - imgH + 5,
                        width: imgW,
                        height: imgH,
                    });
                    currentY -= (imgH + 2);
                }

                // Approver Name & Role
                lastPage.drawText(`By: ${approverName} (${approverRole})`, {
                    x: boxX + 10,
                    y: currentY,
                    size: 8,
                    font: font,
                    color: rgb(0.1, 0.1, 0.1),
                });
                currentY -= 11;

                // Date
                lastPage.drawText(`Date: ${dateStr}`, {
                    x: boxX + 10,
                    y: currentY,
                    size: 7.5,
                    font: font,
                    color: rgb(0.4, 0.4, 0.4),
                });
            }

            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);
        } catch (err) {
            console.error('Embed signature and watermark error:', err);
            throw new AppError('Failed to process PDF watermark and signature.', 500);
        }
    }
}

module.exports = new PdfService();
