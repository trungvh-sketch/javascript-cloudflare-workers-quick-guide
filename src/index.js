import { imagesToPdf } from "./imageToPdf.js";

// Dành cho Cloudflare Worker - CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
        message: "API Cloudflare Worker Convert Image to PDF is running",
        endpoints: {
          "POST /convert-to-pdf": "Upload images (multipart/form-data, raw binary, or JSON base64/URLs) to generate PDF."
        }
      }));
    }

    // POST /convert-to-pdf
    if (request.method === "POST" && url.pathname === "/convert-to-pdf") {
      try {
        const contentType = request.headers.get("content-type") || "";
        const imageInputs = [];

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          for (const [key, value] of formData.entries()) {
            if (key === "urls" && typeof value === "string" && value.trim()) {
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
    //OKeee

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
