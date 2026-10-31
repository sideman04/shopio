import { api } from './apiClient'

/**
 * File uploads.
 *
 * Uploads are stored by the PHP API outside the document root and returned as
 * relative `/media/...` paths. Validators require absolute URLs, so callers get
 * an absolute URL while the original path is kept for reference.
 */

export interface UploadedImage {
  url: string
  path: string
  mimeType: string
  sizeBytes?: number
  width?: number
  height?: number
}

export interface UploadedDocument {
  url: string
  path: string
  mimeType: string
  sizeBytes?: number
  originalName?: string
}

export function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(url.startsWith('/') ? url : `/${url}`, base).toString()
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData()
  form.append('file', file)
  const response = await api.upload<UploadedImage>('/uploads/images', form)
  return { ...response.data, url: absoluteMediaUrl(response.data.url) }
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const form = new FormData()
  form.append('file', file)
  const response = await api.upload<UploadedDocument>('/uploads/documents', form)
  return { ...response.data, url: absoluteMediaUrl(response.data.url) }
}

/** Human-readable file size. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
