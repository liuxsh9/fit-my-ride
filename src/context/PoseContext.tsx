import {
  createContext, useContext, useEffect, useRef, useState, useCallback
} from 'react'
import type { ReactNode } from 'react'
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

interface PoseContextValue {
  landmarker: PoseLandmarker | null
  results: PoseLandmarkerResult | null
  isLoading: boolean
  loadError: string | null
  processFrame: (video: HTMLVideoElement) => void
}

const PoseContext = createContext<PoseContextValue | null>(null)

export function PoseProvider({ children }: { children: ReactNode }) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null)
  const [results, setResults] = useState<PoseLandmarkerResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const lastVideoTime = useRef(-1)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          '/node_modules/@mediapipe/tasks-vision/wasm'
        )
        const pl = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (!cancelled) {
          landmarkerRef.current = pl
          setLandmarker(pl)
        } else {
          pl.close()
        }
      } catch (e) {
        if (!cancelled) setLoadError('MediaPipe 加载失败，请检查网络或使用 Chrome 浏览器。')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const processFrame = useCallback((video: HTMLVideoElement) => {
    if (!landmarker || video.currentTime === lastVideoTime.current) return
    lastVideoTime.current = video.currentTime
    const res = landmarker.detectForVideo(video, performance.now())
    setResults(res)
  }, [landmarker])

  return (
    <PoseContext.Provider value={{ landmarker, results, isLoading, loadError, processFrame }}>
      {children}
    </PoseContext.Provider>
  )
}

export function usePoseContext() {
  const ctx = useContext(PoseContext)
  if (!ctx) throw new Error('usePoseContext must be used within PoseProvider')
  return ctx
}
