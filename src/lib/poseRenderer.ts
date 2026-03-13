type Lm = { x: number; y: number; visibility: number }

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
]

/**
 * Draw skeleton with opacity proportional to landmark visibility.
 * Landmarks with visibility >= 0.15 are shown (dimmed if < 0.5).
 */
export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lms: Lm[],
  dotColor = '#4fc3f7',
  lineColor = 'rgba(79,195,247,1)',
) {
  const MIN_VIS = 0.15

  // Connections
  ctx.lineWidth = 2
  POSE_CONNECTIONS.forEach(([a, b]) => {
    const la = lms[a], lb = lms[b]
    if (!la || !lb || la.visibility < MIN_VIS || lb.visibility < MIN_VIS) return
    const alpha = Math.max(0.25, Math.min(la.visibility, lb.visibility))
    ctx.globalAlpha = alpha
    ctx.strokeStyle = lineColor
    ctx.beginPath()
    ctx.moveTo(la.x * canvas.width, la.y * canvas.height)
    ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height)
    ctx.stroke()
  })

  // Dots
  lms.forEach(lm => {
    if (!lm || lm.visibility < MIN_VIS) return
    const alpha = Math.max(0.25, lm.visibility)
    const radius = 2 + lm.visibility * 3
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, radius, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()
  })

  ctx.globalAlpha = 1
}

// Key body groups for bike fitting
export const BODY_GROUPS = [
  { name: '肩', indices: [11, 12] },
  { name: '肘', indices: [13, 14] },
  { name: '腕', indices: [15, 16] },
  { name: '髋', indices: [23, 24] },
  { name: '膝', indices: [25, 26] },
  { name: '踝', indices: [27, 28] },
] as const

export type BodyGroupStatus = { name: string; detected: boolean; partial: boolean }

export function getBodyGroupStatus(lms: Lm[]): BodyGroupStatus[] {
  return BODY_GROUPS.map(g => ({
    name: g.name,
    detected: g.indices.some(i => (lms[i]?.visibility ?? 0) >= 0.5),
    partial: g.indices.some(i => {
      const v = lms[i]?.visibility ?? 0
      return v >= 0.15 && v < 0.5
    }),
  }))
}

/** Returns an actionable guidance string, or null if all key joints are detected. */
export function getPoseGuidance(status: BodyGroupStatus[]): string | null {
  const get = (name: string) => status.find(s => s.name === name)
  if (!get('肩')?.detected) return '请靠近或向前，确保上半身入镜'
  if (!get('髋')?.detected) return '请稍微后退，确保髋部入镜'
  if (!get('膝')?.detected) return '请继续后退，确保膝盖入镜'
  if (!get('踝')?.detected) return '请再后退一些，确保踝部入镜'
  return null
}
