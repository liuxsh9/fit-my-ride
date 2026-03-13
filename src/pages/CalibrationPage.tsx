import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useCalibration } from '../hooks/useCalibration'

interface Props {
  onReady: () => void
}

export default function CalibrationPage({ onReady }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results } = usePoseContext()
  const { isStable, hasDetected, showSkip, processResults } = useCalibration(onReady)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Process results whenever they change
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Render loop: feed video frames to MediaPipe, draw dots on canvas
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) {
      animRef.current = requestAnimationFrame(renderLoop)
      return
    }
    processFrame(video)

    const ctx = canvas.getContext('2d')!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results?.landmarks?.[0]) {
      const lms = results.landmarks[0]
      // Draw horizontal reference line at hip height
      const hipY = ((lms[23].y + lms[24].y) / 2) * canvas.height
      ctx.strokeStyle = 'rgba(100,100,255,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, hipY)
      ctx.lineTo(canvas.width, hipY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw landmark dots
      lms.forEach(lm => {
        if (lm.visibility < 0.5) return
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
        ctx.fillStyle = isStable ? '#4caf50' : '#4fc3f7'
        ctx.fill()
      })
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame, results, isStable])

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop])

  // Set video source when stream available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
  }, [stream, videoRef])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>姿态校准</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>
        请骑上自行车，保持骑行姿态。系统检测到稳定骑行姿势后将自动进入分析界面。
      </p>

      <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

        {/* Status overlay */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '8px 16px', textAlign: 'center',
        }}>
          {!hasDetected && <p style={{ margin: 0, color: '#ffa' }}>⌛ 等待检测到人体…</p>}
          {hasDetected && !isStable && (
            <p style={{ margin: 0, color: '#4fc3f7' }}>
              🔄 检测中，请保持骑行姿态静止约 2 秒…
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
