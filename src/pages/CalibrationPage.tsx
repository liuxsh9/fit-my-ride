import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useCalibration } from '../hooks/useCalibration'
import { drawPoseSkeleton } from '../lib/poseRenderer'

interface Props {
  onReady: () => void
}

const STEPS = ['站入画面', '骑上自行车', '保持静止']

export default function CalibrationPage({ onReady }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results, resultsRef } = usePoseContext()
  const { isStable, hasDetected, showSkip, processResults } = useCalibration(onReady)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const isStableRef = useRef(false)
  isStableRef.current = isStable

  const stepIndex = !hasDetected ? 0 : !isStable ? 1 : 2

  // Process results for calibration logic
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Stable render loop
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
      const hipL = lms[23], hipR = lms[24]
      if (hipL?.visibility > 0.3 || hipR?.visibility > 0.3) {
        const hipY = ((hipL.y + hipR.y) / 2) * canvas.height
        ctx.strokeStyle = 'rgba(100,100,255,0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([6, 6])
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

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.muted = true
    video.srcObject = stream
    video.play().catch(err => console.error('[CalibrationPage] video.play() rejected:', err))
  }, [stream, videoRef])

  const statusMsg = !hasDetected
    ? '请站在摄像头侧面，确保全身入镜'
    : !isStable
    ? '检测到了！请骑上自行车，保持静止约 2 秒'
    : '✅ 姿态稳定，即将开始分析…'

  const statusColor = !hasDetected ? '#ffc107' : !isStable ? '#4fc3f7' : '#4caf50'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#080808', overflow: 'hidden' }}>

      {/* Step indicator */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        <span style={{ fontSize: 15, color: '#666', marginRight: 16 }}>姿态校准</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
          {STEPS.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: i < stepIndex ? '#4caf50' : i === stepIndex ? '#4fc3f7' : '#222',
                  border: `2px solid ${i < stepIndex ? '#4caf50' : i === stepIndex ? '#4fc3f7' : '#333'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: i <= stepIndex ? '#000' : '#555',
                }}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 13,
                  color: i < stepIndex ? '#4caf50' : i === stepIndex ? '#fff' : '#555',
                  whiteSpace: 'nowrap',
                }}>{step}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 8px',
                  background: i < stepIndex ? '#4caf50' : '#222',
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Video — takes remaining space */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Mirror wrapper */}
        <div style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', position: 'relative' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        </div>

        {/* Status message overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '48px 32px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: statusColor, textAlign: 'center' }}>
            {statusMsg}
          </p>
          {hasDetected && !isStable && (
            <p style={{ margin: 0, fontSize: 14, color: '#888' }}>
              双手握把，踩到最低点，保持不动
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      {showSkip && !isStable && (
        <div style={{ padding: '12px 24px', flexShrink: 0, borderTop: '1px solid #1a1a1a' }}>
          <button
            onClick={onReady}
            style={{
              width: '100%', background: '#222', color: '#888',
              border: '1px solid #333', borderRadius: 10, padding: '12px 20px',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            跳过校准，直接开始 →
          </button>
        </div>
      )}
    </div>
  )
}
