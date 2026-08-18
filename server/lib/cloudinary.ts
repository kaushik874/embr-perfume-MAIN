import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 data URL to Cloudinary and return the secure URL.
 * @param dataUrl  Full data URL like "data:image/png;base64,iVBOR..."
 * @param folder   Cloudinary folder to organize uploads (e.g. "hero", "products")
 */
export async function uploadToCloudinary(
  dataUrl: string,
  folder: string,
): Promise<string> {
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
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `embr/${folder}`,
    resource_type: "video",
  });
  return result.secure_url;
}

export { cloudinary };
