'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  Loader2,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react'

interface Props {
  label: string
  hint?: string
  facingMode: 'user' | 'environment'
  onCapture: (blob: Blob) => void
  captured: boolean
  onRetake: () => void
}

type CameraErrorType =
  | 'permission'
  | 'not-found'
  | 'not-readable'
  | 'security'
  | 'unknown'
  | null

export default function CameraCapture({
  label,
  hint,
  facingMode,
  onCapture,
  captured,
  onRetake,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement>(null)

  const canvasRef =
    useRef<HTMLCanvasElement>(null)

  const streamRef =
    useRef<MediaStream | null>(null)

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null)

  const [starting, setStarting] =
    useState(false)

  const [error, setError] =
    useState('')

  const [errorType, setErrorType] =
    useState<CameraErrorType>(null)

  const [active, setActive] =
    useState(false)

  const [showPermissionModal, setShowPermissionModal] =
    useState(false)

  const stopStream =
    useCallback(() => {
      streamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop(),
        )

      streamRef.current = null
      setActive(false)
    }, [])

  useEffect(() => {
    return () => {
      stopStream()

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }
    }
  }, [
    stopStream,
    previewUrl,
  ])

  useEffect(() => {
    if (
      active &&
      streamRef.current &&
      videoRef.current
    ) {
      videoRef.current.srcObject =
        streamRef.current

      videoRef.current
        .play()
        .catch((err) => {
          console.error(
            'Video play failed:',
            err,
          )
        })
    }
  }, [active])

  const resetCameraError =
    () => {
      setError('')
      setErrorType(null)
    }

  const getCameraError =
    (err: unknown) => {
      if (
        typeof window ===
          'undefined'
      ) {
        return
      }

      if (
        err instanceof DOMException
      ) {
        switch (err.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            setErrorType(
              'permission',
            )
            setError(
              'Camera permission is required.',
            )
            setShowPermissionModal(
              true,
            )
            return

          case 'NotFoundError':
          case 'DevicesNotFoundError':
            setErrorType(
              'not-found',
            )
            setError(
              'No camera was found on this device.',
            )
            return

          case 'NotReadableError':
          case 'TrackStartError':
            setErrorType(
              'not-readable',
            )
            setError(
              'Your camera is currently being used by another app or browser tab.',
            )
            return

          case 'SecurityError':
          case 'TypeError':
            setErrorType(
              'security',
            )
            setError(
              'Camera access is not available in this browser or connection.',
            )
            return

          default:
            break
        }
      }

      setErrorType('unknown')
      setError(
        'Could not access your camera. Please try again.',
      )
    }

  async function startCamera() {
    resetCameraError()
    setStarting(true)

    try {
      if (
        typeof navigator ===
          'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        setErrorType(
          'security',
        )
        setError(
          'Camera access is not supported by this browser.',
        )
        return
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode,
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 960,
              },
            },
            audio: false,
          },
        )

      streamRef.current =
        stream

      setActive(true)
    } catch (err) {
      console.error(
        'Camera start failed:',
        err,
      )

      getCameraError(err)
    } finally {
      setStarting(false)
    }
  }

  function capture() {
    const video =
      videoRef.current

    const canvas =
      canvasRef.current

    if (
      !video ||
      !canvas ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return
    }

    canvas.width =
      video.videoWidth

    canvas.height =
      video.videoHeight

    const ctx =
      canvas.getContext(
        '2d',
      )

    if (!ctx) return

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    canvas.toBlob(
      (blob) => {
        if (!blob) return

        if (previewUrl) {
          URL.revokeObjectURL(
            previewUrl,
          )
        }

        const url =
          URL.createObjectURL(
            blob,
          )

        setPreviewUrl(url)
        onCapture(blob)
        stopStream()
      },
      'image/jpeg',
      0.9,
    )
  }

  function retake() {
    if (previewUrl) {
      URL.revokeObjectURL(
        previewUrl,
      )
    }

    setPreviewUrl(null)
    onRetake()
    resetCameraError()

    void startCamera()
  }

  function closePermissionModal() {
    setShowPermissionModal(
      false,
    )
  }

  function tryAgain() {
    setShowPermissionModal(
      false,
    )

    window.setTimeout(
      () => {
        void startCamera()
      },
      150,
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {label}
          </p>

          {captured && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
              <Check size={12} />
              Captured
            </span>
          )}
        </div>

        {hint && (
          <p className="mb-3 text-xs leading-5 text-zinc-500">
            {hint}
          </p>
        )}

        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="w-full rounded-xl border border-zinc-800 object-cover"
            />

            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
            >
              <RotateCcw
                size={13}
              />
              Retake
            </button>
          </div>
        ) : active ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            <button
              type="button"
              onClick={capture}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              <Camera size={15} />
              Capture
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              void startCamera()
            }
            disabled={starting}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-500 transition hover:border-orange-500/50 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? (
              <Loader2
                size={20}
                className="animate-spin"
              />
            ) : (
              <Camera size={20} />
            )}

            <span className="text-xs font-medium">
              {starting
                ? 'Opening camera...'
                : 'Open camera'}
            </span>
          </button>
        )}

        {error &&
          !showPermissionModal && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              <AlertCircle
                size={13}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p>
                  {error}
                </p>

                {errorType ===
                  'not-readable' && (
                  <button
                    type="button"
                    onClick={() =>
                      void startCamera()
                    }
                    className="mt-1.5 font-semibold underline underline-offset-2"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}
      </div>

      {/* CAMERA PERMISSION MODAL */}
      {showPermissionModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-permission-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      '#FFF4E8',
                    color:
                      '#C96A00',
                  }}
                >
                  <Camera
                    size={20}
                  />
                </div>

                <button
                  type="button"
                  onClick={
                    closePermissionModal
                  }
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black/50"
                >
                  <X size={16} />
                </button>
              </div>

              <h2
                id="camera-permission-title"
                className="mt-5 text-lg font-semibold text-zinc-900"
              >
                Camera permission is needed
              </h2>

              <p className="mt-2 text-sm leading-5 text-zinc-500">
                Dinezy needs your camera to
                capture your KYC documents and
                live selfie. We do not allow
                gallery uploads for this step.
              </p>

              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <p className="text-xs font-semibold text-zinc-800">
                  {errorType ===
                  'permission'
                    ? 'How to allow camera access'
                    : 'Please check your camera'}
                </p>

                <div className="mt-3 space-y-2.5">
                  <PermissionStep
                    number="1"
                    text="Tap Allow when your browser asks for camera access."
                  />

                  <PermissionStep
                    number="2"
                    text="If you previously blocked it, open your browser's site permissions and switch Camera to Allow."
                  />

                  <PermissionStep
                    number="3"
                    text="Come back to this page and tap Try again."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <Settings
                  size={15}
                  className="mt-0.5 shrink-0 text-amber-600"
                />

                <p className="text-[11px] leading-4 text-amber-800">
                  On some phones, you may also
                  need to enable camera access in
                  your device settings.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={
                    closePermissionModal
                  }
                  className="flex-1 rounded-xl border border-zinc-200 bg-white py-3 text-xs font-semibold text-zinc-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={tryAgain}
                  className="flex-1 rounded-xl bg-orange-500 py-3 text-xs font-semibold text-white transition hover:bg-orange-400"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PermissionStep({
  number,
  text,
}: {
  number: string
  text: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-700">
        {number}
      </span>

      <p className="text-[11px] leading-4 text-zinc-500">
        {text}
      </p>
    </div>
  )
}
