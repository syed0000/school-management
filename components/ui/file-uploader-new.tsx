"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, X, Camera, SwitchCamera, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface FileUploaderProps {
  onFileSelect: (file: File | null) => void
  label?: string
  accept?: string
  className?: string
  previewUrl?: string | null
}

type Mode = "idle" | "upload" | "camera"

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export function FileUploader({
  onFileSelect,
  label = "Upload File",
  accept = "image/*",
  className = "",
  previewUrl,
}: FileUploaderProps) {
  /* ── state ── */
  const [dragActive, setDragActive] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("idle")
  const [cameraAvailable, setCameraAvailable] = useState(false)

  // Camera states
  const [streaming, setStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [cameraError, setCameraError] = useState<string | null>(null)

  /* ── refs ── */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── detect camera availability once on mount ── */
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      setCameraAvailable(true)
    }
  }, [])

  /* ── helpers ── */
  const displayPreview = localPreview || previewUrl

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }, [])

  // Clean up stream when component unmounts or mode leaves camera
  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  /* ── file-upload helpers ── */
  const handleFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    onFileSelect(file)
    setMode("idle")
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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLocalPreview(null)
    onFileSelect(null)
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
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" })
      const objectUrl = URL.createObjectURL(blob)
      setLocalPreview(objectUrl)
      onFileSelect(file)
      stopStream()
      setMode("idle")
    }, "image/jpeg", 0.92)
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

        <div className="relative w-full rounded-xl overflow-hidden border-2 border-primary/30 bg-black shadow-lg"
          style={{ minHeight: 220 }}>

          {/* Video feed */}
          <video
            ref={videoRef}
            className="w-full max-h-72 object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Hidden canvas for snapshot */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center gap-3">
              <Camera className="w-8 h-8 text-destructive" />
              <p className="text-sm text-white">{cameraError}</p>
            </div>
          )}

          {/* Top-right: close */}
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
              {/* Flip camera */}
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

              {/* Capture shutter */}
              <button
                type="button"
                onClick={capturePhoto}
                className="h-14 w-14 rounded-full bg-white border-4 border-primary shadow-xl hover:scale-95 transition-transform active:scale-90 focus:outline-none"
                title="Capture photo"
                aria-label="Capture photo"
              />

              {/* Spacer to balance flip button */}
              <div className="h-9 w-9" />
            </div>
          )}

          {/* Viewfinder overlay corner marks */}
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
     RENDER: Normal (preview / upload zone)
  ───────────────────────────────────────── */
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Upload drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden ${
          dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!displayPreview ? triggerUpload : undefined}
      >
        {displayPreview ? (
          <div className="relative w-full h-full group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); triggerUpload() }}
              >
                <Upload className="h-3 w-3 mr-1" /> Change
              </Button>
              {cameraAvailable && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); openCamera() }}
                >
                  <Camera className="h-3 w-3 mr-1" /> Recapture
                </Button>
              )}
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-4 pb-5 gap-2">
            <Upload className="w-7 h-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center px-2">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Camera button (shown below when no preview yet) */}
      {cameraAvailable && !displayPreview && (
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
    </div>
  )
}
