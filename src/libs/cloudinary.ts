import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId?: string) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

/** Construye la URL a partir del publicId, solo para el endpoint GET */
export function buildImageUrl(publicId?: string) {
  if (!publicId) return undefined;
  return cloudinary.url(publicId, { secure: true });
}

export default cloudinary;
