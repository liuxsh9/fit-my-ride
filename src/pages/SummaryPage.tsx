import { useEffect } from 'react'
import { type AccumulatedAngles } from '../hooks/useAngleCalculator'
import { useSessions, type Session } from '../hooks/useSessions'
import { getRecommendations } from '../lib/recommendations'
import { calcSessionScore } from '../lib/scoring'

interface Props {
  accumulated: AccumulatedAngles
  duration: number
  onRestart: () => void
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MetricRow({ label, angle, lower, upper }: { label: string; angle: number | null; lower: number; upper: number }) {
  const inRange = angle !== null && angle >= lower && angle <= upper
  const color = angle === null ? '#666' : inRange ? '#4caf50' : '#f44336'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #222' }}>
      <span style={{ color: '#aaa' }}>{label}</span>
      <span style={{ color, fontWeight: 600, fontSize: 18 }}>
        {angle === null ? '--' : `${Math.round(angle)}°`}
      </span>
      <span style={{ color: '#555', fontSize: 13 }}>目标 {lower}–{upper}°</span>
    </div>
  )
}

export default function SummaryPage({ accumulated, duration, onRestart }: Props) {
  const avgKnee = avg(accumulated.kneeReadings)
  const avgTorso = avg(accumulated.torsoReadings)
  const avgElbow = avg(accumulated.elbowReadings)
  const score = calcSessionScore(avgKnee, avgTorso, avgElbow)
  const recommendations = getRecommendations(avgKnee, avgTorso, avgElbow)
  const { sessions, saveSession } = useSessions()

  useEffect(() => {
    saveSession({ avgKneeAngle: avgKnee, avgTorsoAngle: avgTorso, avgElbowAngle: avgElbow, duration })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // save once on mount

  const mins = Math.floor(duration / 60)
  const secs = duration % 60

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>本次 Fitting 分析结果</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>骑行时长：{mins}分{secs}秒</p>

      {/* Score */}
      <div style={{ textAlign: 'center', background: '#1a1a2e', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: score >= 80 ? '#4caf50' : score >= 60 ? '#ffc107' : '#f44336' }}>
          {score}
        </div>
        <div style={{ color: '#888', fontSize: 14 }}>综合评分（满分 100）</div>
      </div>

      {/* Metrics */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: '8px 20px', marginBottom: 20 }}>
        <MetricRow label="膝盖角度" angle={avgKnee} lower={140} upper={150} />
        <MetricRow label="躯干角度" angle={avgTorso} lower={35} upper={45} />
        <MetricRow label="手肘角度" angle={avgElbow} lower={150} upper={165} />
      </div>

      {/* Recommendations */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>调整建议</h2>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14, color: '#ddd' }}>
            <span>💡</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* History — show if more than 1 session exists */}
      {sessions.length > 1 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>历史记录</h2>
          {sessions.slice(0, 5).map((s: Session) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', fontSize: 13 }}>
              <span style={{ color: '#888' }}>{formatDate(s.timestamp)}</span>
              <span style={{ color: s.score >= 80 ? '#4caf50' : s.score >= 60 ? '#ffc107' : '#f44336', fontWeight: 600 }}>
                {s.score} 分
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        style={{
          width: '100%', background: '#4fc3f7', color: '#000',
          border: 'none', borderRadius: 10, padding: '14px 20px',
          fontSize: 16, fontWeight: 600, cursor: 'pointer',
        }}
      >
        重新分析 →
      </button>
    </div>
  )
}
