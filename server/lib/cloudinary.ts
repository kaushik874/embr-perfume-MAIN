import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfig() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      `Cloudinary credentials missing. cloud_name=${cloud_name ? "SET" : "MISSING"}, api_key=${api_key ? "SET" : "MISSING"}, api_secret=${api_secret ? "SET" : "MISSING"}. Check your .env file or hosting environment variables.`
    );
  }

  cloudinary.config({ cloud_name, api_key, api_secret });
  configured = true;
}

/**
 * Upload a base64 data URL to Cloudinary and return the secure URL.
 * @param dataUrl  Full data URL like "data:image/png;base64,iVBOR..."
 * @param folder   Cloudinary folder to organize uploads (e.g. "hero", "products")
 */
export async function uploadToCloudinary(
  dataUrl: string,
  folder: string,
): Promise<string> {
  ensureConfig();
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `embr/${folder}`,
    resource_type: "auto",
  });
  return result.secure_url;
}

/**
 * Upload raw base64 (without data URL prefix) with explicit mime type.
 * @param base64Data  Raw base64 string (no data: prefix)
 * @param mimeType    MIME type like "image/png"
 * @param folder      Cloudinary folder
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  mimeType: string,
  folder: string,
): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return uploadToCloudinary(dataUrl, folder);
}

/**
 * Upload a video to Cloudinary.
 */
export async function uploadVideoToCloudinary(
  dataUrl: string,
  folder: string,
): Promise<string> {
  ensureConfig();
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `embr/${folder}`,
    resource_type: "video",
  });
  return result.secure_url;
}

export { cloudinary };
