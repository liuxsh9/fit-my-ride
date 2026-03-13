import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useAngleCalculator, type AccumulatedAngles } from '../hooks/useAngleCalculator'
import SkeletonOverlay from '../components/SkeletonOverlay'
import MetricsPanel from '../components/MetricsPanel'

interface Props {
  onStop: (accumulated: AccumulatedAngles, durationSec: number) => void
}

export default function RidingPage({ onStop }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results } = usePoseContext()
  const { angles, accumulated, processResults, reset } = useAngleCalculator()
  const animRef = useRef<number>(0)
  const startTimeRef = useRef(Date.now())

  // Set video source
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
    startTimeRef.current = Date.now()
    reset()
  }, [stream, videoRef, reset])

  // Process pose results
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Render loop
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused && !video.ended) {
      processFrame(video)
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame])

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop])

  // ESC / Space to stop
  const handleStop = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    onStop(accumulated, duration)
  }, [accumulated, onStop])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        handleStop()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleStop])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      {/* Left: camera + skeleton */}
      <div style={{ flex: 2, position: 'relative', background: '#000' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        <SkeletonOverlay videoRef={videoRef} results={results} angles={angles} />

        {/* Stop button */}
        <button
          type="button"
          onClick={handleStop}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,50,50,0.8)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 14px',
            cursor: 'pointer', fontSize: 13,
          }}
        >
          停止 (ESC)
        </button>
      </div>

      {/* Right: metrics */}
      <div style={{ flex: 1, background: '#111', minWidth: 220, maxWidth: 300 }}>
        <MetricsPanel angles={angles} />
      </div>
    </div>
  )
}
