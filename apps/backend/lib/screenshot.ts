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
import { serverConfig, isR2Configured } from "@appwit/config/server";

const { r2 } = serverConfig;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!isR2Configured()) {
    console.log("[SCREENSHOT] R2 not configured, cannot upload screenshots");
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId!,
        secretAccessKey: r2.secretAccessKey!,
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

  if (!r2.publicUrl) {
    console.log(
      "[SCREENSHOT] R2_PUBLIC_URL not set, skipping screenshot (thumbnails won't be accessible without it)"
    );
    return null;
  }

  if (r2.publicUrl.includes(".r2.cloudflarestorage.com")) {
    console.warn(
      "[SCREENSHOT] R2_PUBLIC_URL appears to be a private S3 endpoint. Thumbnails may not be publicly accessible."
    );
  }

  try {
    console.log(
      `[SCREENSHOT] Capturing screenshot for project ${projectId}...`
    );
    console.log(`[SCREENSHOT] URL: ${sandboxUrl}`);

    let puppeteer;
    try {
      puppeteer = await import("puppeteer");
    } catch {
      console.log(
        "[SCREENSHOT] Puppeteer not installed, skipping screenshot capture"
      );
      return null;
    }

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

    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    await page.goto(sandboxUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    await browser.close();

    const key = `thumbnails/${userId}/${projectId}.png`;

    await client.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: screenshotBuffer as Buffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000",
      })
    );

    const publicUrl = `${r2.publicUrl}/${key}`;

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
        Bucket: r2.bucketName,
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
  const enabled = isR2Configured() && !!r2.publicUrl;

  if (!enabled) {
    console.log(`[SCREENSHOT] Screenshot disabled. Config check:`, {
      hasAccountId: !!r2.accountId,
      hasAccessKey: !!r2.accessKeyId,
      hasSecretKey: !!r2.secretAccessKey,
      hasBucket: !!r2.bucketName,
      hasPublicUrl: !!r2.publicUrl,
      publicUrl: r2.publicUrl ? r2.publicUrl.slice(0, 30) + "..." : "NOT SET",
    });
  }

  return enabled;
}
