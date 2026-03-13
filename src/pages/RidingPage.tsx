import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useAngleCalculator, type AccumulatedAngles } from '../hooks/useAngleCalculator'
import { useVoiceFeedback } from '../hooks/useVoiceFeedback'
import SkeletonOverlay from '../components/SkeletonOverlay'

interface Props {
  onStop: (accumulated: AccumulatedAngles, durationSec: number) => void
}

type Status = 'good' | 'warn' | 'bad' | 'unknown'

function getStatus(angle: number | null, lower: number, upper: number): Status {
  if (angle === null) return 'unknown'
  if (angle >= lower && angle <= upper) return 'good'
  if (angle >= lower - 5 && angle <= upper + 5) return 'warn'
  return 'bad'
}

const STATUS_BG: Record<Status, string> = {
  good: '#0a2a0a',
  warn: '#2a1e00',
  bad: '#2a0a0a',
  unknown: '#111',
}
const STATUS_COLOR: Record<Status, string> = {
  good: '#4caf50',
  warn: '#ffc107',
  bad: '#f44336',
  unknown: '#555',
}
const STATUS_LABEL: Record<Status, string> = {
  good: '✓ 正常',
  warn: '! 偏差',
  bad: '✗ 异常',
  unknown: '— 等待',
}

interface MetricCardProps {
  label: string
  angle: number | null
  lower: number
  upper: number
}

function MetricCard({ label, angle, lower, upper }: MetricCardProps) {
  const status = getStatus(angle, lower, upper)
  const color = STATUS_COLOR[status]
  const bg = STATUS_BG[status]
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: bg,
      borderRight: '1px solid #1a1a1a', padding: '12px 8px', gap: 4,
    }}>
      <div style={{ fontSize: 13, color: '#666', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>
        {angle === null ? '--' : Math.round(angle)}
        {angle !== null && <span style={{ fontSize: 36, fontWeight: 400 }}>°</span>}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, color,
        background: color + '22', borderRadius: 20, padding: '2px 12px',
      }}>
        {STATUS_LABEL[status]}
      </div>
      <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>
        目标 {lower}–{upper}°
      </div>
    </div>
  )
}

export default function RidingPage({ onStop }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results, resultsRef } = usePoseContext()
  const { angles, accumulated, processResults, reset } = useAngleCalculator()
  const { update: updateVoice } = useVoiceFeedback()
  const animRef = useRef<number>(0)
  const startTimeRef = useRef(Date.now())

  // Set video source
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.muted = true
    video.srcObject = stream
    video.play().catch(err => console.error('[RidingPage] video.play() rejected:', err))
    startTimeRef.current = Date.now()
    reset()
  }, [stream, videoRef, reset])

  // Process pose results
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  useEffect(() => {
    updateVoice(angles)
  }, [angles, updateVoice])

  // Render loop — stable, no state in deps
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    if (video && video.readyState >= 2 && !video.paused && !video.ended) {
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
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); handleStop() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleStop])

  // For SkeletonOverlay we still need angles from state (angles is already AngleState)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#080808', overflow: 'hidden' }}>

      {/* Video area — takes all remaining space */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Mirror wrapper */}
        <div style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', position: 'relative' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
          />
          <SkeletonOverlay videoRef={videoRef} results={results} angles={angles} />
        </div>

        {/* Stop button — outside mirror wrapper so text isn't flipped */}
        <button
          type="button"
          onClick={handleStop}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(200,40,40,0.85)', color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 20px',
            cursor: 'pointer', fontSize: 15, fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}
        >
          停止 ESC
        </button>

        {/* Recording indicator */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 14px',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#f44336',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          <span style={{ fontSize: 13, color: '#aaa' }}>分析中</span>
        </div>
      </div>

      {/* Metrics bar — fixed height, always visible */}
      <div style={{
        height: 200, display: 'flex',
        borderTop: '1px solid #1a1a1a', flexShrink: 0,
      }}>
        <MetricCard label="膝盖角度" angle={angles.knee} lower={140} upper={150} />
        <MetricCard label="躯干角度" angle={angles.torso} lower={35} upper={45} />
        <MetricCard label="手肘角度" angle={angles.elbow} lower={150} upper={165} />
      </div>
    </div>
  )
}
