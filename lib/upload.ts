import { v2 as cloudinary } from 'cloudinary';
import logger from "@/lib/logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Saves a file (either locally or to Cloudinary depending on environment).
 * 
 * @param file - The file object (usually from FormData)
 * @param folder - The subfolder to save to (e.g., 'students', 'documents')
 * @returns The public URL path to the saved file
 */
export async function saveFile(file: File, folder: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // If Cloudinary env vars are present, upload to Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `modern-nursery/${folder}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            logger.error({ err: error }, "Cloudinary upload failed");
            return reject(error);
          }
          if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error("Cloudinary upload result is undefined"));
          }
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Fallback to local filesystem (only for dev)
  if (process.env.NODE_ENV === 'production') {
    logger.error("Local file upload attempted in production. This will fail on serverless platforms like Vercel. Please configure Cloudinary.");
    throw new Error("File upload failed: Cloudinary not configured in production.");
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  const filename = `${Date.now()}-${safeName}`;

  // Use /tmp for ephemeral storage in serverless if needed, or public/uploads for local dev
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const baseDir = isServerless ? '/tmp' : path.join(process.cwd(), 'public');

  const uploadDir = path.join(baseDir, 'uploads', folder);

  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);

  // If serverless, we can't serve from /tmp directly via URL, so this is just a placeholder
  // Realistically, you MUST use Cloudinary or S3 for Vercel
  return `/uploads/${folder}/${filename}`;
}

/**
 * Deletes a file.
 * 
 * @param fileUrl - The public URL path of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  // Check if it's a Cloudinary URL
  if (fileUrl.includes('cloudinary.com')) {
    try {
      // Extract public_id from URL
      // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/modern-nursery/students/my_photo.jpg
      const parts = fileUrl.split('/');
      const filenameWithExt = parts[parts.length - 1];
      const folderPath = parts.slice(parts.indexOf('modern-nursery')).join('/').replace('/' + filenameWithExt, '');
      const publicId = `${folderPath}/${filenameWithExt.split('.')[0]}`; // Remove extension

      await cloudinary.uploader.destroy(publicId);
      return;
    } catch (error) {
      logger.error({ err: error }, `Failed to delete file from Cloudinary: ${fileUrl}`);
      return;
    }
  }

  // Local filesystem deletion
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    // Only attempt if it looks like a local path
    if (fileUrl.startsWith('/uploads/')) {
      const relativePath = fileUrl.substring(1);
      const filePath = path.join(process.cwd(), 'public', relativePath);
      await fs.unlink(filePath);
    }
  } catch (error) {
    logger.error({ err: error }, `Failed to delete file: ${fileUrl}`);
  }
}
