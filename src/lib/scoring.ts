export function calcMetricScore(angle: number, lowerBound: number, upperBound: number): number {
  const midpoint = (lowerBound + upperBound) / 2
  const halfRange = (upperBound - lowerBound) / 2
  return Math.max(0, 100 - (Math.abs(angle - midpoint) / halfRange) * 100)
}

const WEIGHTS = { knee: 0.5, torso: 0.3, elbow: 0.2 }

export function calcSessionScore(
  avgKnee: number | null,
  avgTorso: number | null,
  avgElbow: number | null
): number {
  const entries: Array<{ score: number; weight: number }> = []
  if (avgKnee !== null) entries.push({ score: calcMetricScore(avgKnee, 140, 150), weight: WEIGHTS.knee })
  if (avgTorso !== null) entries.push({ score: calcMetricScore(avgTorso, 35, 45), weight: WEIGHTS.torso })
  if (avgElbow !== null) entries.push({ score: calcMetricScore(avgElbow, 150, 165), weight: WEIGHTS.elbow })
  if (entries.length === 0) return 0
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
  const weighted = entries.reduce((s, e) => s + e.score * (e.weight / totalWeight), 0)
  return Math.round(weighted)
}
