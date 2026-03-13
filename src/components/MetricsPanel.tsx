import { type AngleState } from '../hooks/useAngleCalculator'

interface Props {
  angles: AngleState
}

interface MetricConfig {
  key: keyof AngleState
  label: string
  lower: number
  upper: number
}

const METRICS: MetricConfig[] = [
  { key: 'knee', label: '膝盖角度', lower: 140, upper: 150 },
  { key: 'torso', label: '躯干角度', lower: 35, upper: 45 },
  { key: 'elbow', label: '手肘角度', lower: 150, upper: 165 },
]

type Status = 'good' | 'warn' | 'bad' | 'unknown'

function getStatus(angle: number | null, lower: number, upper: number): Status {
  if (angle === null) return 'unknown'
  if (angle >= lower && angle <= upper) return 'good'
  if (angle >= lower - 5 && angle <= upper + 5) return 'warn'
  return 'bad'
}

function getProgressPercent(angle: number | null, lower: number, upper: number): number {
  if (angle === null) return 0
  const range = upper - lower
  const pos = Math.max(0, Math.min(1, (angle - (lower - range / 2)) / (range * 2)))
  return Math.round(pos * 100)
}

const STATUS_COLORS: Record<Status, string> = {
  good: '#4caf50',
  warn: '#ffc107',
  bad: '#f44336',
  unknown: '#555',
}

export default function MetricsPanel({ angles }: Props) {
  return (
    <div style={styles.panel}>
      {METRICS.map(({ key, label, lower, upper }) => {
        const angle = angles[key]
        const status = getStatus(angle, lower, upper)
        const color = STATUS_COLORS[status]
        const progress = getProgressPercent(angle, lower, upper)

        return (
          <div key={key} style={{ ...styles.card, borderLeft: `3px solid ${color}` }}>
            <div style={styles.cardLabel}>{label}</div>
            <div style={{ ...styles.cardValue, color }}>
              {angle === null ? '--' : `${Math.round(angle)}°`}
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%`, background: color }} />
              {/* Target range indicator */}
              <div style={styles.targetZone} />
            </div>
            <div style={styles.rangeLabel}>目标: {lower}° – {upper}°</div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
    height: '100%', justifyContent: 'center',
  },
  card: {
    background: '#1a1a2e', borderRadius: 10, padding: '14px 16px',
  },
  cardLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 10 },
  progressTrack: { position: 'relative', height: 6, background: '#333', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.15s, background 0.3s' },
  targetZone: {
    position: 'absolute', top: 0, left: '33%', width: '33%', height: '100%',
    background: 'rgba(255,255,255,0.08)', borderRadius: 3,
  },
  rangeLabel: { fontSize: 11, color: '#666' },
}
