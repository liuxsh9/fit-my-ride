type Point = { x: number; y: number }
type Landmark = { x: number; y: number; visibility: number }

export function calcAngle(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

const CONFIDENCE_THRESHOLD = 0.5

export function calcKneeAngle(landmarks: Landmark[]): number | null {
  const leftVis = Math.min(landmarks[23].visibility, landmarks[25].visibility, landmarks[27].visibility)
  const rightVis = Math.min(landmarks[24].visibility, landmarks[26].visibility, landmarks[28].visibility)
  if (leftVis < CONFIDENCE_THRESHOLD && rightVis < CONFIDENCE_THRESHOLD) return null
  const [hip, knee, ankle] = leftVis >= rightVis
    ? [landmarks[23], landmarks[25], landmarks[27]]
    : [landmarks[24], landmarks[26], landmarks[28]]
  return calcAngle(hip, knee, ankle)
}

export function calcTorsoAngle(landmarks: Landmark[]): number | null {
  const shoulderVis = Math.min(landmarks[11].visibility, landmarks[12].visibility)
  const hipVis = Math.min(landmarks[23].visibility, landmarks[24].visibility)
  if (shoulderVis < CONFIDENCE_THRESHOLD || hipVis < CONFIDENCE_THRESHOLD) return null
  const shoulderMid = { x: (landmarks[11].x + landmarks[12].x) / 2, y: (landmarks[11].y + landmarks[12].y) / 2 }
  const hipMid = { x: (landmarks[23].x + landmarks[24].x) / 2, y: (landmarks[23].y + landmarks[24].y) / 2 }
  const dx = shoulderMid.x - hipMid.x
  const dy = shoulderMid.y - hipMid.y
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI
}

export function calcElbowAngle(landmarks: Landmark[]): number | null {
  const leftVis = Math.min(landmarks[11].visibility, landmarks[13].visibility, landmarks[15].visibility)
  const rightVis = Math.min(landmarks[12].visibility, landmarks[14].visibility, landmarks[16].visibility)
  if (leftVis < CONFIDENCE_THRESHOLD && rightVis < CONFIDENCE_THRESHOLD) return null
  const [shoulder, elbow, wrist] = leftVis >= rightVis
    ? [landmarks[11], landmarks[13], landmarks[15]]
    : [landmarks[12], landmarks[14], landmarks[16]]
  return calcAngle(shoulder, elbow, wrist)
}

export function detectBDC(ankleYHistory: number[]): number | null {
  if (ankleYHistory.length < 5) return null
  for (let i = 2; i < ankleYHistory.length - 2; i++) {
    if (
      ankleYHistory[i] > ankleYHistory[i - 1] &&
      ankleYHistory[i] > ankleYHistory[i - 2] &&
      ankleYHistory[i] > ankleYHistory[i + 1] &&
      ankleYHistory[i] > ankleYHistory[i + 2]
    ) return i
  }
  return null
}

export function isPostureStable(history: Array<[Landmark, Landmark, Landmark]>): boolean {
  if (history.length < 60) return false
  const recent = history.slice(-60)
  for (const frameIdx of [0, 1, 2] as const) {
    if (recent.some(frame => frame[frameIdx].visibility < CONFIDENCE_THRESHOLD)) return false
    const xs = recent.map(f => f[frameIdx].x)
    const ys = recent.map(f => f[frameIdx].y)
    if (stddev(xs) > 0.01 || stddev(ys) > 0.01) return false
  }
  return true
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
