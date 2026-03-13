import { useRef, useEffect, useCallback } from 'react'
import { type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { type AngleState } from '../hooks/useAngleCalculator'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  results: PoseLandmarkerResult | null
  angles: AngleState
}

// MediaPipe pose connections (subset relevant to fitting)
const CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
]

type Status = 'good' | 'warn' | 'bad' | 'unknown'

function angleStatus(
  angle: number | null,
  lower: number,
  upper: number,
  warnMargin = 5
): Status {
  if (angle === null) return 'unknown'
  if (angle >= lower && angle <= upper) return 'good'
  if (angle >= lower - warnMargin && angle <= upper + warnMargin) return 'warn'
  return 'bad'
}

const STATUS_COLORS: Record<Status, string> = {
  good: '#4caf50',
  warn: '#ffc107',
  bad: '#f44336',
  unknown: '#555',
}

export default function SkeletonOverlay({ videoRef, results, angles }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!results?.landmarks?.[0]) return
    const lms = results.landmarks[0]

    const kneeStatus = angleStatus(angles.knee, 140, 150)
    const torsoStatus = angleStatus(angles.torso, 35, 45)
    const elbowStatus = angleStatus(angles.elbow, 150, 165)

    function colorForJoints(a: number, b: number): string {
      // knee limbs: 23-25-27 (left), 24-26-28 (right)
      const kneeJoints = new Set([23, 24, 25, 26, 27, 28])
      const torsoJoints = new Set([11, 12, 23, 24])
      const elbowJoints = new Set([11, 12, 13, 14, 15, 16])
      if (kneeJoints.has(a) && kneeJoints.has(b)) return STATUS_COLORS[kneeStatus]
      if (torsoJoints.has(a) && torsoJoints.has(b)) return STATUS_COLORS[torsoStatus]
      if (elbowJoints.has(a) && elbowJoints.has(b)) return STATUS_COLORS[elbowStatus]
      return '#888'
    }

    // Draw connections
    ctx.lineWidth = 3
    CONNECTIONS.forEach(([a, b]) => {
      const la = lms[a], lb = lms[b]
      if (la.visibility < 0.5 || lb.visibility < 0.5) return
      ctx.strokeStyle = colorForJoints(a, b)
      ctx.beginPath()
      ctx.moveTo(la.x * canvas.width, la.y * canvas.height)
      ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height)
      ctx.stroke()
    })

    // Draw dots
    lms.forEach((lm) => {
      if (lm.visibility < 0.5) return
      ctx.beginPath()
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    })

    // Angle labels
    function drawLabel(text: string, lm: { x: number; y: number }, color: string) {
      const x = lm.x * canvas!.width
      const y = lm.y * canvas!.height - 12
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      const w = ctx.measureText(text).width
      ctx.fillRect(x - 2, y - 14, w + 8, 18)
      ctx.fillStyle = color
      ctx.fillText(text, x + 2, y)
    }

    if (angles.knee !== null) {
      const kneeLm = lms[25].visibility > lms[26].visibility ? lms[25] : lms[26]
      drawLabel(`${Math.round(angles.knee)}°`, kneeLm, STATUS_COLORS[kneeStatus])
    }
    if (angles.torso !== null) {
      const shoulderMid = { x: (lms[11].x + lms[12].x) / 2, y: (lms[11].y + lms[12].y) / 2 }
      drawLabel(`${Math.round(angles.torso)}°`, shoulderMid, STATUS_COLORS[torsoStatus])
    }
    if (angles.elbow !== null) {
      const elbowLm = lms[13].visibility > lms[14].visibility ? lms[13] : lms[14]
      drawLabel(`${Math.round(angles.elbow)}°`, elbowLm, STATUS_COLORS[elbowStatus])
    }
  }, [videoRef, results, angles])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
