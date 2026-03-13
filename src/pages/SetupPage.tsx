import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'

interface Props {
  onReady: () => void
}

export default function SetupPage({ onReady }: Props) {
  const { stream, error: camError, requestCamera, availableDevices, selectedDeviceId, setSelectedDeviceId, videoRef } = useCameraContext()
  const { isLoading: modelLoading, loadError: modelError, processFrame, results } = usePoseContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const canProceed = !!stream && !modelLoading && !modelError
  const hasDetected = !!(results?.landmarks?.[0])

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
  }, [stream, videoRef])

  // Render loop: process frames and draw skeleton dots
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
      // Draw connections
      const CONNECTIONS: [number, number][] = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24],
        [23, 25], [25, 27], [24, 26], [26, 28],
      ]
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(79,195,247,0.7)'
      CONNECTIONS.forEach(([a, b]) => {
        const la = lms[a], lb = lms[b]
        if (la.visibility < 0.5 || lb.visibility < 0.5) return
        ctx.beginPath()
        ctx.moveTo(la.x * canvas.width, la.y * canvas.height)
        ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height)
        ctx.stroke()
      })
      lms.forEach(lm => {
        if (lm.visibility < 0.5) return
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#4fc3f7'
        ctx.fill()
      })
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame, results])

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
          <p style={styles.hint}>请站在摄像头前，确保全身入镜，确认骨骼检测正常后再进入校准。</p>
          <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '4px 12px',
              fontSize: 13, whiteSpace: 'nowrap',
              color: hasDetected ? '#4caf50' : '#ffeb3b',
            }}>
              {hasDetected ? '✅ 检测到人体姿态' : '⌛ 等待检测人体，请站入画面…'}
            </div>
          </div>
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
