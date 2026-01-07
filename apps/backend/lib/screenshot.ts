/**
 * MODULE: Screenshot Capture & Storage
 *
 * Captures screenshots of sandbox preview URLs and stores them in R2.
 * Used for generating project thumbnails shown in the project grid.
 *
 * FLOW:
 * 1. Receive sandbox URL
 * 2. Use Puppeteer to capture screenshot
 * 3. Upload to R2 bucket under thumbnails/{userId}/{projectId}.png
 * 4. Return public URL for the thumbnail
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g., https://pub-xxx.r2.dev or custom domain

// Lazy-loaded S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  ) {
    console.log("[SCREENSHOT] R2 not configured, cannot upload screenshots");
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

/**
 * Capture a screenshot of a URL and upload to R2.
 * Returns the public URL of the uploaded thumbnail, or null on failure.
 */
export async function captureAndUploadScreenshot(
  sandboxUrl: string,
  userId: string,
  projectId: string
): Promise<string | null> {
  const client = getS3Client();
  if (!client) {
    return null;
  }

  // R2_PUBLIC_URL is required for the thumbnail to be accessible
  if (!R2_PUBLIC_URL) {
    console.log(
      "[SCREENSHOT] R2_PUBLIC_URL not set, skipping screenshot (thumbnails won't be accessible without it)"
    );
    return null;
  }

  try {
    console.log(
      `[SCREENSHOT] Capturing screenshot for project ${projectId}...`
    );
    console.log(`[SCREENSHOT] URL: ${sandboxUrl}`);

    // Dynamically import puppeteer to avoid issues if not installed
    let puppeteer;
    try {
      puppeteer = await import("puppeteer");
    } catch {
      console.log(
        "[SCREENSHOT] Puppeteer not installed, skipping screenshot capture"
      );
      return null;
    }

    // Launch browser
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set viewport for consistent screenshots
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Navigate to the sandbox URL with timeout
    await page.goto(sandboxUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit for any animations to settle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture screenshot as buffer
    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    await browser.close();

    // Upload to R2
    const key = `thumbnails/${userId}/${projectId}.png`;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: screenshotBuffer as Buffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000", // Cache for 1 year (will be replaced on update)
      })
    );

    // Construct public URL (R2_PUBLIC_URL is guaranteed to exist at this point)
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log(`[SCREENSHOT] ✓ Uploaded thumbnail: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error("[SCREENSHOT] Error capturing/uploading screenshot:", error);
    return null;
  }
}

/**
 * Delete a project's thumbnail from R2.
 */
export async function deleteThumbnail(
  userId: string,
  projectId: string
): Promise<boolean> {
  const client = getS3Client();
  if (!client) {
    return false;
  }

  try {
    const key = `thumbnails/${userId}/${projectId}.png`;

    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    console.log(`[SCREENSHOT] ✓ Deleted thumbnail for project ${projectId}`);
    return true;
  } catch (error) {
    console.error("[SCREENSHOT] Error deleting thumbnail:", error);
    return false;
  }
}

/**
 * Check if screenshot capture is available (puppeteer installed + R2 configured + public URL set).
 */
export function isScreenshotEnabled(): boolean {
  // R2_PUBLIC_URL is required for thumbnails to be accessible
  // Without it, the internal R2 URL won't work in the browser
  const enabled = !!(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME &&
    R2_PUBLIC_URL
  );

  if (!enabled) {
    console.log(`[SCREENSHOT] Screenshot disabled. Config check:`, {
      hasAccountId: !!R2_ACCOUNT_ID,
      hasAccessKey: !!R2_ACCESS_KEY_ID,
      hasSecretKey: !!R2_SECRET_ACCESS_KEY,
      hasBucket: !!R2_BUCKET_NAME,
      hasPublicUrl: !!R2_PUBLIC_URL,
      publicUrl: R2_PUBLIC_URL ? R2_PUBLIC_URL.slice(0, 30) + "..." : "NOT SET",
    });
  }

  return enabled;
}
