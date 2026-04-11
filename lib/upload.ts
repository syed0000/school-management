import { v2 as cloudinary } from 'cloudinary';
import logger from "@/lib/logger";
import sharp from 'sharp';
import { contaboKeyFromPublicUrl, deleteFromContabo, getContaboStorageConfig, putToContabo } from "@/lib/contabo-storage";
import { getStorageRootFolder } from "@/lib/storage-root";

const LEGACY_STORAGE_ROOT = "modern-nursery"

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
  let buffer: Buffer = Buffer.from(bytes);

  // Compress if it's an image
  if (file.type.startsWith('image/')) {
    try {
      // Aim for 20-40 KB
      const quality = 75;
      const width = 1000;
      
      const sharpInstance = sharp(buffer)
        .resize(width, width, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality }); // Using webp as it's most efficient for small sizes

      buffer = await sharpInstance.toBuffer();

      // If still over 40KB, aggressively compress
      if (buffer.length > 40 * 1024) {
        buffer = await sharp(buffer)
          .resize(800, 800, { fit: 'inside' })
          .webp({ quality: 50 })
          .toBuffer();
      }
      
      // If still over 40KB, even more aggressively compress
      if (buffer.length > 40 * 1024) {
        buffer = await sharp(buffer)
          .resize(600, 600, { fit: 'inside' })
          .webp({ quality: 30 })
          .toBuffer();
      }

      logger.info(`Image compressed to ${Math.round(buffer.length / 1024)} KB`);
    } catch (err) {
      logger.error({ err }, "Image compression failed, using original file");
    }
  }

  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "")
  let safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  
  // If we converted to webp, ensure extension matches
  if (file.type.startsWith('image/')) {
    safeName = safeName.replace(/\.[^/.]+$/, "") + ".webp";
  }
  
  const filename = `${Date.now()}-${safeName}`;
  const rootFolder = getStorageRootFolder()

  const contaboCfg = getContaboStorageConfig()
  if (contaboCfg) {
    try {
      const key = `${rootFolder}/${normalizedFolder}/${filename}`
      const contentType = file.type.startsWith("image/") ? "image/webp" : (file.type || "application/octet-stream")
      return await putToContabo({ cfg: contaboCfg, key, body: buffer, contentType })
    } catch (error) {
      logger.error({ err: error }, "Contabo upload failed")
    }
  }

  // If Cloudinary env vars are present, upload to Cloudinary (legacy)
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${rootFolder}/${normalizedFolder}`,
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
    logger.error("Local file upload attempted in production. Configure Contabo Object Storage (recommended) or Cloudinary.");
    throw new Error("File upload failed: no remote storage configured in production.");
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // Use /tmp for ephemeral storage in serverless if needed, or public/uploads for local dev
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const baseDir = isServerless ? '/tmp' : path.join(process.cwd(), 'public');

  const uploadDir = path.join(baseDir, 'uploads', normalizedFolder);

  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);

  // If serverless, we can't serve from /tmp directly via URL, so this is just a placeholder
  // Realistically, you MUST use Cloudinary or S3 for Vercel
  return `/uploads/${normalizedFolder}/${filename}`;
}

/**
 * Deletes a file.
 * 
 * @param fileUrl - The public URL path of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  const rootFolder = getStorageRootFolder()

  const contaboCfg = getContaboStorageConfig()
  if (contaboCfg) {
    const key = contaboKeyFromPublicUrl(contaboCfg, fileUrl)
    if (key) {
      try {
        await deleteFromContabo({ cfg: contaboCfg, key })
      } catch (error) {
        logger.error({ err: error }, `Failed to delete file from Contabo Object Storage: ${fileUrl}`)
      }
      return
    }
  }

  // Check if it's a Cloudinary URL
  if (fileUrl.includes('cloudinary.com')) {
    try {
      // Extract public_id from URL
      // Example: https://res.cloudinary.com/<cloud>/image/upload/v123/<root>/students/my_photo.jpg
      const parts = fileUrl.split('/');
      const filenameWithExt = parts[parts.length - 1];
      const rootIndex = parts.findIndex((p) => p === rootFolder || p === LEGACY_STORAGE_ROOT)
      if (rootIndex === -1) return
      const folderPath = parts.slice(rootIndex).join('/').replace('/' + filenameWithExt, '');
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
