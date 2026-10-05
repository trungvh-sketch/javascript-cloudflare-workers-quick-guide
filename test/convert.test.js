import { imagesToPdf } from '../src/imageToPdf.js';
import sharp from 'sharp';

async function test() {
  console.log("Testing imageToPdf conversion...");
  
  // Create a 200x200 Red PNG image buffer
  const pngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
  }).png().toBuffer();

  // Create a 300x200 Blue JPEG image buffer
  const jpgBuffer = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 3,
      background: { r: 0, g: 0, b: 255 }
    }
  }).jpeg().toBuffer();

  // Test 1: Single image buffer
  const pdf1 = await imagesToPdf(pngBuffer);
  console.log("✓ Test 1 Passed: Single PNG buffer. PDF size:", pdf1.byteLength, "bytes");

  // Test 2: Multiple images (PNG + JPG)
  const pdf2 = await imagesToPdf([pngBuffer, jpgBuffer]);
  console.log("✓ Test 2 Passed: Multiple images (PNG + JPG). PDF size:", pdf2.byteLength, "bytes");

  // Test 3: Base64 JPEG input
  const base64Jpg = `data:image/jpeg;base64,${jpgBuffer.toString('base64')}`;
  const pdf3 = await imagesToPdf([base64Jpg]);
  console.log("✓ Test 3 Passed: Base64 JPEG input. PDF size:", pdf3.byteLength, "bytes");

  // Test 4: Array of URLs (Public Image URLs)
  console.log("Testing image URLs...");
  const imageUrls = [
    'https://raw.githubusercontent.com/pdf-lib/pdf-lib/master/assets/cat_riding_a_unicorn.jpg',
    'https://raw.githubusercontent.com/pdf-lib/pdf-lib/master/assets/minions_banana_slug.png'
  ];
  const pdf4 = await imagesToPdf(imageUrls);
  console.log("✓ Test 4 Passed: Multiple Image URLs. PDF size:", pdf4.byteLength, "bytes");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

test().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
