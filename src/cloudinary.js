/**
 * Cloudinary Upload Module for Cloudflare Workers & Node.js
 */

/**
 * Computes SHA-1 hex signature required for signed Cloudinary API requests.
 */
async function generateSignature(paramsToSign, apiSecret) {
  const sortedKeys = Object.keys(paramsToSign).sort();
  const stringToSign = sortedKeys
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&") + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads a PDF binary buffer (or any file buffer) to Cloudinary via REST API.
 * 
 * @param {Uint8Array} fileBytes - Binary data of the file to upload.
 * @param {Object} options - Cloudinary credentials and upload options.
 * @param {string} options.cloudName - Cloudinary cloud_name (e.g. "ehc7ifjh").
 * @param {string} options.apiKey - Cloudinary api_key (e.g. "685937516173479").
 * @param {string} options.apiSecret - Cloudinary api_secret.
 * @param {string} [options.publicId] - Optional public_id.
 * @param {string} [options.resourceType] - Resource type: "raw" (default for PDF), "image", or "auto".
 * @returns {Promise<Object>} Cloudinary upload response object (secure_url, public_id, url, etc.).
 */
export async function uploadToCloudinary(fileBytes, options = {}) {
  const cloudName = options.cloudName || "ehc7ifjh";
  const apiKey = options.apiKey || "685937516173479";
  const apiSecret = options.apiSecret;

  if (!apiSecret) {
    throw new Error("Missing Cloudinary api_secret. Please provide apiSecret in request or environment.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = options.publicId || `pdf_${Date.now()}`;
  const resourceType = options.resourceType || "raw"; // "raw" preserves PDF files perfectly

  const paramsToSign = {
    public_id: publicId,
    timestamp: timestamp,
  };

  const signature = await generateSignature(paramsToSign, apiSecret);

  // Convert Uint8Array to base64 Data URL
  let binary = "";
  const len = fileBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(fileBytes[i]);
  }
  const base64Data = btoa(binary);
  const dataUrl = `data:application/pdf;base64,${base64Data}`;

  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("public_id", publicId);
  formData.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Cloudinary Upload Error [Status ${response.status}]: ${responseData.error?.message || JSON.stringify(responseData)}`);
  }

  return {
    success: true,
    public_id: responseData.public_id,
    secure_url: responseData.secure_url,
    url: responseData.url,
    bytes: responseData.bytes,
    format: responseData.format,
    rawResponse: responseData,
  };
}
