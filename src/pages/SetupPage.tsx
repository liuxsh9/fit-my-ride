import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { drawPoseSkeleton, getBodyGroupStatus, getPoseGuidance } from '../lib/poseRenderer'

interface Props {
  onReady: () => void
}

export default function SetupPage({ onReady }: Props) {
  const { stream, error: camError, requestCamera, availableDevices, selectedDeviceId, setSelectedDeviceId, videoRef } = useCameraContext()
  const { isLoading: modelLoading, loadError: modelError, processFrame, results, resultsRef } = usePoseContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const canProceed = !!stream && !modelLoading && !modelError
  const lms = results?.landmarks?.[0] ?? null
  const hasDetected = !!lms
  const bodyStatus = lms ? getBodyGroupStatus(lms) : null
  const guidance = bodyStatus ? getPoseGuidance(bodyStatus) : null

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.muted = true  // React's muted JSX prop is unreliable; set imperatively
    video.srcObject = stream
    video.play().catch(err => console.error('[SetupPage] video.play() rejected:', err))
  }, [stream, videoRef])

  // Render loop: process frames and draw skeleton dots
  // NOTE: resultsRef (not results state) used here so this callback is stable —
  // putting results state in deps would restart the rAF loop on every single frame.
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
      drawPoseSkeleton(ctx, canvas, lms)
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame, resultsRef])

  useEffect(() => {
    if (!stream) return
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop, stream])

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>自行车 Fitting 分析</h1>
      <p style={styles.subtitle}>公路车姿态实时检测工具</p>

      {/* Camera position guide */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>📷 摄像头摆放要求</h2>
        <div style={styles.guideGrid}>
          <div style={styles.guideGood}>
            <div style={styles.guideIcon}>✅</div>
            <p><strong>正确</strong>：从<strong>侧面</strong>拍摄，与骑手方向呈 90°</p>
            <p>距离约 2-3 米，高度与腰部齐平</p>
          </div>
          <div style={styles.guideBad}>
            <div style={styles.guideIcon}>❌</div>
            <p><strong>错误</strong>：正面或背面拍摄无法测量关节角度</p>
          </div>
        </div>
      </div>

      {/* Camera device selector */}
      {availableDevices.length > 1 && (
        <div style={styles.card}>
          <label style={styles.label}>选择摄像头：</label>
          <select
            value={selectedDeviceId ?? ''}
            onChange={e => setSelectedDeviceId(e.target.value)}
            style={styles.select}
          >
            {availableDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `摄像头 ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Camera permission */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🎥 摄像头权限</h2>
        {stream ? (
          <p style={styles.success}>✅ 已授权</p>
        ) : camError ? (
          <>
            <p style={styles.error}>{camError}</p>
            <button style={styles.button} onClick={requestCamera}>重试</button>
          </>
        ) : (
          <button style={styles.button} onClick={requestCamera}>授权摄像头</button>
        )}
      </div>

      {/* Live pose preview — only shown after camera is authorized */}
      {stream && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>🦴 姿态检测预览</h2>
          <p style={styles.hint}>站在摄像头侧面确认骨骼正常识别，无需全身入镜。</p>
          {/* Mirror wrapper */}
          <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', marginTop: 8, transform: 'scaleX(-1)' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          </div>
          {/* Status & badges — outside the mirrored wrapper so text isn't flipped */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!hasDetected && (
              <span style={{ fontSize: 13, color: '#ffc107' }}>⌛ 等待检测，请站入画面…</span>
            )}
            {bodyStatus?.map(s => (
              <span key={s.name} style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 10,
                background: s.detected ? '#1a3d1a' : s.partial ? '#3d3a10' : '#222',
                color: s.detected ? '#4caf50' : s.partial ? '#ffc107' : '#555',
                border: `1px solid ${s.detected ? '#4caf5055' : s.partial ? '#ffc10755' : '#333'}`,
              }}>
                {s.detected ? '✓' : s.partial ? '~' : '○'} {s.name}
              </span>
            ))}
          </div>
          {guidance && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#ffc107' }}>💡 {guidance}</p>}
          {!guidance && hasDetected && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4caf50' }}>✅ 关键关节检测正常</p>}
        </div>
      )}

      {/* Model loading */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🧠 AI 模型</h2>
        {modelLoading ? (
          <div>
            <style>{`@keyframes shimmer { 0%{width:0%} 50%{width:80%} 100%{width:0%;margin-left:100%} }`}</style>
            <div style={styles.progressBar}><div style={{ ...styles.progressFill, animation: 'shimmer 1.5s ease-in-out infinite' }} /></div>
            <p style={styles.hint}>正在加载姿态检测模型（约 6MB）…</p>
          </div>
        ) : modelError ? (
          <p style={styles.error}>{modelError}</p>
        ) : (
          <p style={styles.success}>✅ 已加载</p>
        )}
      </div>

      <button
        style={{ ...styles.button, ...styles.primaryButton, opacity: canProceed ? 1 : 0.4 }}
        disabled={!canProceed}
        onClick={onReady}
      >
        {hasDetected ? '✅ 姿态检测正常，开始校准 →' : '开始校准 →'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: '0 auto', padding: 24 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: '#888', marginBottom: 24 },
  card: { background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  guideGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  guideGood: { background: '#0d2d1a', borderRadius: 8, padding: 12, fontSize: 13 },
  guideBad: { background: '#2d0d0d', borderRadius: 8, padding: 12, fontSize: 13 },
  guideIcon: { fontSize: 24, marginBottom: 8 },
  label: { display: 'block', marginBottom: 8, fontSize: 14 },
  select: { background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 12px', width: '100%' },
  button: { background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 },
  primaryButton: { background: '#4fc3f7', color: '#000', width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 600, marginTop: 8 },
  success: { color: '#4fc', margin: 0 },
  error: { color: '#f66', margin: '0 0 8px' },
  hint: { color: '#888', fontSize: 13, marginTop: 8 },
  progressBar: { background: '#333', borderRadius: 4, height: 8, overflow: 'hidden' },
  progressFill: { background: '#4fc3f7', height: '100%', borderRadius: 4, transition: 'width 0.3s' },
}
