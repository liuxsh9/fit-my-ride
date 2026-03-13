import { describe, it, expect } from 'vitest'
import { getRecommendations } from '../lib/recommendations'

describe('getRecommendations', () => {
  it('returns all-good message when all angles are in range', () => {
    const recs = getRecommendations(145, 40, 157.5)
    expect(recs).toHaveLength(1)
    expect(recs[0]).toContain('状态良好')
  })
  it('returns knee recommendation when knee angle is too low', () => {
    const recs = getRecommendations(135, 40, 157.5)
    expect(recs.some(r => r.includes('升高坐垫'))).toBe(true)
  })
  it('returns torso recommendation when torso angle is too high', () => {
    const recs = getRecommendations(145, 50, 157.5)
    expect(recs.some(r => r.includes('直立'))).toBe(true)
  })
  it('returns elbow recommendation when elbow angle is too high', () => {
    const recs = getRecommendations(145, 40, 170)
    expect(recs.some(r => r.includes('接近伸直'))).toBe(true)
  })
  it('handles null angles gracefully', () => {
    expect(() => getRecommendations(null, null, null)).not.toThrow()
  })
})
