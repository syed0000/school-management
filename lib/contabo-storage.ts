import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"

export type ContaboStorageConfig = {
  endpoint: string
  bucket: string
  publicBaseUrl: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export function getContaboStorageConfig(): ContaboStorageConfig | null {
  const accessKeyId = process.env.CONTABO_ACCESS_KEY?.trim()
  const secretAccessKey = process.env.CONTABO_SECRET_KEY?.trim()
  const region = process.env.CONTABO_REGION?.trim() || "us-east-1"

  if (!accessKeyId || !secretAccessKey) return null

  const publicUrlRaw = process.env.CONTABO_PUBLIC_URL?.trim()
  const endpointRaw = process.env.CONTABO_ENDPOINT?.trim()
  const bucketRaw = process.env.CONTABO_BUCKET?.trim()

  if (publicUrlRaw) {
    try {
      const parsed = parseContaboPublicUrl(publicUrlRaw)
      return {
        endpoint: parsed.endpoint,
        bucket: parsed.bucket,
        publicBaseUrl: parsed.publicBaseUrl,
        region,
        accessKeyId,
        secretAccessKey,
      }
    } catch {
      return null
    }
  }

  if (!endpointRaw || !bucketRaw) return null

  const endpoint = normalizeEndpoint(endpointRaw)
  const bucket = bucketRaw.replace(/^\/+|\/+$/g, "")
  if (!bucket) return null
  return {
    endpoint,
    bucket,
    publicBaseUrl: `${endpoint}/${bucket}`,
    region,
    accessKeyId,
    secretAccessKey,
  }
}

export function parseContaboPublicUrl(publicUrl: string): {
  endpoint: string
  bucket: string
  publicBaseUrl: string
} {
  const u = new URL(publicUrl)
  const endpoint = normalizeEndpoint(`${u.protocol}//${u.host}`)
  const parts = u.pathname.split("/").filter(Boolean)
  const bucket = parts[0]
  if (!bucket) {
    throw new Error("CONTABO_PUBLIC_URL must include the bucket as the first path segment")
  }
  return { endpoint, bucket, publicBaseUrl: `${endpoint}/${bucket}` }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/g, "")
}

export function createContaboS3Client(cfg: ContaboStorageConfig): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

export function buildContaboPublicObjectUrl(cfg: ContaboStorageConfig, key: string): string {
  const safeKey = key.replace(/^\/+/g, "")
  return `${cfg.publicBaseUrl}/${safeKey}`
}

export function contaboKeyFromPublicUrl(cfg: ContaboStorageConfig, fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl)
    const base = new URL(cfg.publicBaseUrl + "/")
    if (u.host !== base.host) return null
    const path = u.pathname.replace(/^\/+/g, "")
    const basePath = base.pathname.replace(/^\/+/g, "").replace(/\/+$/g, "")
    if (!path.startsWith(basePath + "/")) return null
    return decodeURIComponent(path.slice((basePath + "/").length))
  } catch {
    return null
  }
}

export async function uploadToContabo(params: {
  cfg: ContaboStorageConfig
  key: string
  body: Buffer
  contentType?: string
}): Promise<string> {
  const { cfg, key, body, contentType } = params
  const s3 = createContaboS3Client(cfg)

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
  })
  await uploader.done()
  return buildContaboPublicObjectUrl(cfg, key)
}

export async function deleteFromContabo(params: { cfg: ContaboStorageConfig; key: string }): Promise<void> {
  const { cfg, key } = params
  const s3 = createContaboS3Client(cfg)
  await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
}

export async function putToContabo(params: {
  cfg: ContaboStorageConfig
  key: string
  body: Buffer
  contentType?: string
}): Promise<string> {
  const { cfg, key, body, contentType } = params
  const s3 = createContaboS3Client(cfg)
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return buildContaboPublicObjectUrl(cfg, key)
}
