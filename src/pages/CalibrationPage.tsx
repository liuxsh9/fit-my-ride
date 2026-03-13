import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useCalibration } from '../hooks/useCalibration'
import { drawPoseSkeleton } from '../lib/poseRenderer'

interface Props {
  onReady: () => void
}

export default function CalibrationPage({ onReady }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results, resultsRef } = usePoseContext()
  const { isStable, hasDetected, showSkip, processResults } = useCalibration(onReady)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  // Keep refs in sync so the rAF loop reads current values without being in deps
  const isStableRef = useRef(false)
  isStableRef.current = isStable

  // Process results whenever they change
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Render loop: feed video frames to MediaPipe, draw dots on canvas
  // Uses resultsRef/isStableRef (not state) so the loop is stable and never restarts mid-stream.
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2 || video.paused || video.ended) {
      animRef.current = requestAnimationFrame(renderLoop)
      return
    }
    processFrame(video)

    const ctx = canvas.getContext('2d')!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const lms = resultsRef.current?.landmarks?.[0]
    if (lms) {
      // Draw horizontal reference line at hip height (only when hips are visible)
      const hipL = lms[23], hipR = lms[24]
      if (hipL?.visibility > 0.3 || hipR?.visibility > 0.3) {
        const hipY = ((hipL.y + hipR.y) / 2) * canvas.height
        ctx.strokeStyle = 'rgba(100,100,255,0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(0, hipY)
        ctx.lineTo(canvas.width, hipY)
        ctx.stroke()
        ctx.setLineDash([])
      }
      drawPoseSkeleton(ctx, canvas, lms, isStableRef.current ? '#4caf50' : '#4fc3f7')
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame, resultsRef])

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop])

  // Set video source when stream available
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.muted = true  // React's muted JSX prop is unreliable; set imperatively
    video.srcObject = stream
    video.play().catch(err => console.error('[CalibrationPage] video.play() rejected:', err))
  }, [stream, videoRef])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>姿态校准</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>
        {!hasDetected
          ? '请站在摄像头前，确保全身入镜。'
          : !isStable
          ? '检测到您了！请骑上自行车，保持骑行姿态静止约 2 秒，系统将自动进入分析。'
          : '姿态稳定，即将开始分析…'}
      </p>

      <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

        {/* Status overlay */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '8px 16px', textAlign: 'center',
        }}>
          {!hasDetected && <p style={{ margin: 0, color: '#ffa' }}>⌛ 等待检测到人体，请站入画面…</p>}
          {hasDetected && !isStable && (
            <p style={{ margin: 0, color: '#4fc3f7' }}>
              🚴 请骑上自行车，保持静止约 2 秒…
            </p>
          )}
          {isStable && <p style={{ margin: 0, color: '#4caf50', fontWeight: 600 }}>✅ 姿态稳定！即将开始分析…</p>}
        </div>
      </div>

      {!hasDetected && (
        <div style={{ marginTop: 12, padding: 12, background: '#1a1a2e', borderRadius: 8, fontSize: 13, color: '#aaa' }}>
          💡 提示：请确保身体完整入镜，光线充足，摄像头从侧面拍摄
        </div>
      )}

      {hasDetected && !isStable && (
        <div style={{ marginTop: 12, padding: 12, background: '#1a2e1a', borderRadius: 8, fontSize: 13, color: '#aaa' }}>
          💡 骑上车后，双手握把，踩到最低点，保持 2 秒不动即可完成校准
        </div>
      )}

      {showSkip && !isStable && (
        <button
          onClick={onReady}
          style={{
            marginTop: 16, width: '100%', background: '#333', color: '#fff',
            border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 14,
          }}
        >
          跳过校准，直接开始 →
        </button>
      )}
    </div>
  )
}
