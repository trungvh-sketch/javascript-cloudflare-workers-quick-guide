import { PDFDocument } from 'pdf-lib';

/**
 * Utility to convert base64 string, URL, Buffer, Uint8Array, or ArrayBuffer to a standalone Uint8Array with byteOffset 0.
 */
async function toUint8ArrayAsync(data) {
  if (data instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
    // Slice to guarantee a standalone ArrayBuffer starting at offset 0
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof data === 'string') {
    const trimmed = data.trim();

    // 1. Fetch image if URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${trimmed} (Status ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // 2. Decode Base64 string
    const base64Clean = trimmed.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(base64Clean, 'base64');
      return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } else {
      const binaryString = atob(base64Clean);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }
  throw new Error("Invalid image data format. Expected Uint8Array, ArrayBuffer, Buffer, Base64 string, or Image URL.");
}

/**
 * Converts a single image or an array of images (buffers, base64 strings, or URLs) into a single PDF document.
 * 
 * @param {Array<Uint8Array | ArrayBuffer | string>} images - Single image or array of images (Buffer/Uint8Array, Base64 string, or Image URL).
 * @returns {Promise<Uint8Array>} - The generated PDF document bytes.
 */
export async function imagesToPdf(images) {
  const imageList = Array.isArray(images) ? images : [images];

  if (imageList.length === 0) {
    throw new Error("No images provided for PDF conversion.");
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < imageList.length; i++) {
    const rawBytes = await toUint8ArrayAsync(imageList[i]);

    let embeddedImage;
    let embedError = null;

    // Check magic numbers: PNG starts with 0x89 0x50 0x4E 0x47, JPG starts with 0xFF 0xD8
    const isPng = rawBytes[0] === 0x89 && rawBytes[1] === 0x50 && rawBytes[2] === 0x4E && rawBytes[3] === 0x47;

    if (isPng) {
      try {
        embeddedImage = await pdfDoc.embedPng(rawBytes);
      } catch (err) {
        embedError = err;
      }
    } else {
      try {
        embeddedImage = await pdfDoc.embedJpg(rawBytes);
      } catch (err) {
        embedError = err;
      }
    }

    // Fallback attempt if format detection was ambiguous
    if (!embeddedImage) {
      try {
        embeddedImage = isPng ? await pdfDoc.embedJpg(rawBytes) : await pdfDoc.embedPng(rawBytes);
      } catch (fallbackErr) {
        throw new Error(
          `Failed to embed image at index ${i}. Ensure image is a valid PNG or JPG file. Details: ${embedError ? embedError.message : fallbackErr.message}`
        );
      }
    }

    // Add a page matching the image dimensions
    const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    });
  }

  return await pdfDoc.save();
}
