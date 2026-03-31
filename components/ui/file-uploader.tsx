"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, X, Camera, SwitchCamera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImagePreview } from "@/components/ui/image-preview"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface FileUploaderProps {
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  accept?: string
  id?: string
  className?: string
  previewWidth?: number
  previewHeight?: number
}

type Mode = "idle" | "camera"

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export function FileUploader({
  value,
  onChange,
  label = "Upload File",
  accept = "image/*",
  id,
  className = "",
  previewWidth = 100,
  previewHeight = 100,
}: FileUploaderProps) {
  /* ── state ── */
  const [dragActive, setDragActive] = useState(false)
  const [mode, setMode] = useState<Mode>("idle")
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [cameraError, setCameraError] = useState<string | null>(null)

  /* ── refs ── */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── detect camera once on mount ── */
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      setCameraAvailable(true)
    }
  }, [])

  /* ── stop stream on unmount ── */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }, [])

  useEffect(() => () => stopStream(), [stopStream])

  /* ── file-upload helpers ── */
  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    setMode("idle")
  }

  const triggerUpload = () => fileInputRef.current?.click()

  /* ── camera helpers ── */
  const startCamera = useCallback(
    async (facing: "user" | "environment" = facingMode) => {
      setCameraError(null)
      stopStream()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStreaming(true)
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access and try again."
            : "Unable to access camera. It may be in use by another app."
        setCameraError(msg)
      }
    },
    [facingMode, stopStream]
  )

  const openCamera = () => {
    setMode("camera")
    startCamera(facingMode)
  }

  const closeCamera = () => {
    stopStream()
    setMode("idle")
    setCameraError(null)
  }

  const flipCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment"
    setFacingMode(next)
    startCamera(next)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    onChange(dataUrl)
    stopStream()
    setMode("idle")
  }

  /* ─────────────────────────────────────────
     RENDER: Camera view
  ───────────────────────────────────────── */
  if (mode === "camera") {
    return (
      <div className={`space-y-2 ${className}`}>
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}

        <div
          className="relative w-full rounded-xl overflow-hidden border-2 border-primary/30 bg-black shadow-lg"
          style={{ minHeight: 220 }}
        >
          <video
            ref={videoRef}
            className="w-full max-h-72 object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center gap-3">
              <Camera className="w-8 h-8 text-destructive" />
              <p className="text-sm text-white">{cameraError}</p>
            </div>
          )}

          {/* Close */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={closeCamera}
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          {/* Bottom controls */}
          {streaming && !cameraError && (
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-3 p-3 bg-gradient-to-t from-black/70 to-transparent">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-white/20 text-white hover:bg-white/40 backdrop-blur-sm"
                onClick={flipCamera}
                title="Flip camera"
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={capturePhoto}
                className="h-14 w-14 rounded-full bg-white border-4 border-primary shadow-xl hover:scale-95 transition-transform active:scale-90 focus:outline-none"
                title="Capture photo"
                aria-label="Capture photo"
              />

              <div className="h-9 w-9" />
            </div>
          )}

          {/* Viewfinder corner marks */}
          {streaming && !cameraError && (
            <>
              <div className="pointer-events-none absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-sm" />
              <div className="pointer-events-none absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-sm" />
              <div className="pointer-events-none absolute bottom-16 left-8 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-sm" />
              <div className="pointer-events-none absolute bottom-16 right-8 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-sm" />
            </>
          )}
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────────
     RENDER: Normal (preview / drop zone)
  ───────────────────────────────────────── */
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {!value ? (
        <>
          <div
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
              dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerUpload}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-1">
              <Upload className="w-8 h-8 mb-1 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Accepts {accept.replace("/*", "")} files
              </p>
            </div>
            <input
              id={id}
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={handleChange}
            />
          </div>

          {cameraAvailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={openCamera}
            >
              <Camera className="h-3.5 w-3.5" />
              Capture with Camera
            </Button>
          )}
        </>
      ) : (
        <div className="relative inline-block group">
          <ImagePreview
            src={value}
            alt="Preview"
            width={previewWidth}
            height={previewHeight}
            className="rounded-md object-cover border"
          />
          {/* Hover overlay for recapture / change */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={triggerUpload}
            >
              <Upload className="h-3 w-3 mr-1" /> Change
            </Button>
            {cameraAvailable && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={openCamera}
              >
                <Camera className="h-3 w-3 mr-1" /> Recapture
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
          <input
            id={id}
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  )
}
