import { imagesToPdf } from "./imageToPdf.js";
import { uploadToCloudinary } from "./cloudinary.js";

// Dành cho Cloudflare Worker - CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cloudinary-Secret, X-Cloudinary-Cloud-Name, X-Cloudinary-Api-Key",
};

/**
 * Utility to wrap Response with CORS headers
 */
function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    // Xử lý Preflight request (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // GET /
    if (request.method === "GET" && url.pathname === "/") {
      return withCors(Response.json({
        message: "API Cloudflare Worker Convert Image to PDF & Cloudinary Upload",
        endpoints: {
          "POST /convert-to-pdf": "Upload images (multipart/form-data, raw binary, or JSON base64/URLs) to generate PDF. Add ?cloudinary=true & apiSecret to push directly to Cloudinary."
        }
      }));
    }

    // POST /convert-to-pdf
    if (request.method === "POST" && url.pathname === "/convert-to-pdf") {
      try {
        const contentType = request.headers.get("content-type") || "";
        const imageInputs = [];

        let isCloudinaryEnabled = url.searchParams.has("cloudinary");
        let cloudName = env.CLOUDINARY_CLOUD_NAME || request.headers.get("X-Cloudinary-Cloud-Name") || "ehc7ifjh";
        let apiKey = env.CLOUDINARY_API_KEY || request.headers.get("X-Cloudinary-Api-Key") || "685937516173479";
        let apiSecret = env.CLOUDINARY_API_SECRET || request.headers.get("X-Cloudinary-Secret") || "";
        let publicId = "";

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          for (const [key, value] of formData.entries()) {
            if (key === "cloudinary" && (value === "true" || value === "1")) {
              isCloudinaryEnabled = true;
            } else if (key === "apiSecret" || key === "api_secret") {
              apiSecret = value.toString();
            } else if (key === "cloudName" || key === "cloud_name") {
              cloudName = value.toString();
            } else if (key === "apiKey" || key === "api_key") {
              apiKey = value.toString();
            } else if (key === "publicId" || key === "public_id") {
              publicId = value.toString();
            } else if (key === "urls" && typeof value === "string" && value.trim()) {
              imageInputs.push(value.trim());
            } else if (value && typeof value === "object" && typeof value.arrayBuffer === "function") {
              const buffer = await value.arrayBuffer();
              if (buffer.byteLength > 0) {
                imageInputs.push(new Uint8Array(buffer));
              }
            }
          }
        } else if (contentType.includes("application/json")) {
          const body = await request.json();
          const images = body.images || body.files || (body.image ? [body.image] : []);
          for (const img of (Array.isArray(images) ? images : [images])) {
            imageInputs.push(img);
          }
          if (body.cloudinary) isCloudinaryEnabled = true;
          if (body.apiSecret || body.api_secret) apiSecret = body.apiSecret || body.api_secret;
          if (body.cloudName || body.cloud_name) cloudName = body.cloudName || body.cloud_name;
          if (body.apiKey || body.api_key) apiKey = body.apiKey || body.api_key;
          if (body.publicId || body.public_id) publicId = body.publicId || body.public_id;
        } else {
          // Raw binary body fallback
          const buffer = await request.arrayBuffer();
          if (buffer.byteLength > 0) {
            imageInputs.push(new Uint8Array(buffer));
          }
        }

        if (imageInputs.length === 0) {
          return withCors(Response.json(
            { error: "No image files or URLs found in request." },
            { status: 400 }
          ));
        }

        // Convert list of images / URLs into a single PDF
        const pdfBytes = await imagesToPdf(imageInputs);

        // Upload to Cloudinary if requested or if apiSecret provided
        if (isCloudinaryEnabled || apiSecret) {
          const cloudinaryResult = await uploadToCloudinary(pdfBytes, {
            cloudName,
            apiKey,
            apiSecret,
            publicId,
          });

          return withCors(Response.json({
            message: "PDF generated and uploaded to Cloudinary successfully!",
            cloudinary: cloudinaryResult,
          }));
        }

        // Return PDF binary file response
        return withCors(new Response(pdfBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="converted.pdf"',
            "Content-Length": pdfBytes.byteLength.toString(),
          },
        }));
      } catch (err) {
        return withCors(Response.json({ error: err.message }, { status: 500 }));
      }
    }

    // GET /status
    if (request.method === "GET" && url.pathname === "/status") {
      return withCors(Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      }));
    }

    // 404 fallback
    return withCors(Response.json(
      {
        error: "Not found",
      },
      { status: 404 },
    ));
  },
};
