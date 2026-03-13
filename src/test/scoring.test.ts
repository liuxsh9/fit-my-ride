import { describe, it, expect } from 'vitest'
import { calcMetricScore, calcSessionScore } from '../lib/scoring'

describe('calcMetricScore', () => {
  it('returns 100 when angle is at midpoint', () => {
    expect(calcMetricScore(145, 140, 150)).toBe(100)
  })
  it('returns 0 when angle is at boundary', () => {
    expect(calcMetricScore(140, 140, 150)).toBe(0) // deviation = 5 = halfRange → 0
    expect(calcMetricScore(135, 140, 150)).toBe(0) // beyond boundary → clamped to 0
  })
  it('returns ~50 when halfway between midpoint and boundary', () => {
    expect(calcMetricScore(142.5, 140, 150)).toBeCloseTo(50, 1)
  })
  it('clamps to 0 for angles far outside range', () => {
    expect(calcMetricScore(120, 140, 150)).toBe(0)
    expect(calcMetricScore(200, 140, 150)).toBe(0)
  })
})

describe('calcSessionScore', () => {
  it('returns 100 for perfect angles', () => {
    expect(calcSessionScore(145, 40, 157.5)).toBe(100)
  })
  it('returns weighted score for mixed results', () => {
    // knee=135 (0 pts, weight 0.5), torso=40 perfect (100, weight 0.3), elbow=157.5 perfect (100, weight 0.2)
    // score = 0*0.5 + 100*0.3 + 100*0.2 = 50
    const score = calcSessionScore(135, 40, 157.5)
    expect(score).toBe(50)
  })
  it('handles null angles (skips metric, re-normalizes weights)', () => {
    // knee null → only torso (0.3) + elbow (0.2), both perfect → 100
    const score = calcSessionScore(null, 40, 157.5)
    expect(score).toBe(100)
  })
  it('returns 0 when all angles are null', () => {
    expect(calcSessionScore(null, null, null)).toBe(0)
  })
})
