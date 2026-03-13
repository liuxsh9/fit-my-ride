import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'
import type { RefObject } from 'react'

interface CameraContextValue {
  stream: MediaStream | null
  videoRef: RefObject<HTMLVideoElement>
  availableDevices: MediaDeviceInfo[]
  selectedDeviceId: string | null
  setSelectedDeviceId: (id: string) => void
  error: string | null
  requestCamera: () => Promise<void>
}

const CameraContext = createContext<CameraContextValue | null>(null)

export function CameraProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const requestCamera = useCallback(async () => {
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' },
      }
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAvailableDevices(devices.filter(d => d.kind === 'videoinput'))
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'NotAllowedError'
        ? '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头。'
        : '无法访问摄像头，请检查设备连接。'
      setError(msg)
    }
  }, [selectedDeviceId])

  return (
    <CameraContext.Provider value={{
      stream, videoRef, availableDevices,
      selectedDeviceId, setSelectedDeviceId,
      error, requestCamera,
    }}>
      {error && (
        <span role="alert" aria-live="assertive" data-testid="camera-error">
          error:{error}
        </span>
      )}
      {children}
    </CameraContext.Provider>
  )
}

export function useCameraContext() {
  const ctx = useContext(CameraContext)
  if (!ctx) throw new Error('useCameraContext must be used within CameraProvider')
  return ctx
}
