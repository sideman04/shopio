import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/services/apiClient'
import { uploadImage } from '@/services/uploadService'
import { Button } from './Button'

/* -------------------------------------------------------------------------- */
/* Dropzone                                                                    */
/* -------------------------------------------------------------------------- */

export interface FileDropzoneProps {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  /** Maximum size per file in bytes. */
  maxSize?: number
  className?: string
  compact?: boolean
  onFiles: (files: File[]) => void | Promise<void>
}

/**
 * Accessible drag-and-drop file picker. Validation is intentionally minimal
 * (size/selection); the API re-validates MIME type and size server-side.
 */
export function FileDropzone({
  accept = 'image/jpeg,image/png,image/webp',
  multiple = false,
  disabled = false,
  label = 'Upload a file',
  hint,
  maxSize = 5 * 1024 * 1024,
  className,
  compact = false,
  onFiles,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const files = Array.from(list)
    const tooLarge = files.find((file) => file.size > maxSize)
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than ${Math.round(maxSize / 1024 / 1024)} MB.`)
      return
    }

    setError(null)
    setBusy(true)
    try {
      await onFiles(multiple ? files : files.slice(0, 1))
    } catch (err) {
      setError(errorMessage(err, 'The upload failed. Please try again.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled && !busy) void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'group flex w-full flex-col items-center justify-center rounded-card border-2 border-dashed text-center transition',
          compact ? 'gap-1.5 px-4 py-5' : 'gap-2 px-6 py-8',
          dragging
            ? 'border-ink bg-ink-50'
            : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/40',
          (disabled || busy) && 'cursor-not-allowed opacity-60',
        )}
        aria-label={label}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-500 group-hover:bg-ink-200">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-5 w-5" aria-hidden="true" />}
        </span>
        <span className="text-sm font-medium text-ink">
          {busy ? 'Uploading…' : label}
        </span>
        {!compact && (
          <span className="text-xs text-ink-500">
            Drag and drop, or click to browse
            {hint ? ` · ${hint}` : ''}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || busy}
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Single image                                                                */
/* -------------------------------------------------------------------------- */

export interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
  className?: string
  previewClassName?: string
}

export function ImageUpload({
  value,
  onChange,
  label = 'Upload image',
  hint,
  error,
  disabled,
  className,
  previewClassName,
}: ImageUploadProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <div className={cn('relative overflow-hidden rounded-card border border-ink-200 bg-ink-50', previewClassName)}>
          <img src={value} alt="Upload preview" className="h-full w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white/95"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : null}
      <FileDropzone
        label={value ? 'Replace image' : label}
        hint={hint ?? 'JPG, PNG or WebP up to 5 MB'}
        disabled={disabled}
        compact={Boolean(value)}
        onFiles={async (files) => {
          const uploaded = await uploadImage(files[0])
          onChange(uploaded.url)
        }}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Multiple images                                                             */
/* -------------------------------------------------------------------------- */

export interface MultiImageUploadProps {
  values: string[]
  onChange: (urls: string[]) => void
  max?: number
  label?: string
  hint?: string
  disabled?: boolean
  className?: string
}

export function MultiImageUpload({
  values,
  onChange,
  max = 8,
  label = 'Upload images',
  hint,
  disabled,
  className,
}: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const remaining = Math.max(0, max - values.length)

  return (
    <div className={cn('space-y-3', className)}>
      {values.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {values.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-card border border-ink-200 bg-ink-50">
              <img src={url} alt={`Image ${index + 1}`} className="aspect-square h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Primary
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                disabled={disabled}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-danger-600 shadow-sm transition hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 disabled:opacity-50"
                aria-label={`Remove image ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <FileDropzone
          label={values.length ? 'Add more images' : label}
          hint={hint ?? `JPG, PNG or WebP · up to ${max} images`}
          multiple
          disabled={disabled || uploading}
          compact={values.length > 0}
          onFiles={async (files) => {
            setUploading(true)
            try {
              const selected = files.slice(0, remaining)
              const uploaded = await Promise.all(selected.map((file) => uploadImage(file)))
              onChange([...values, ...uploaded.map((item) => item.url)])
            } finally {
              setUploading(false)
            }
          }}
        />
      )}

      {values.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          The first image becomes the primary listing photo.
        </p>
      )}
    </div>
  )
}
