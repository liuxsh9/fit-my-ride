import { describe, it, expect } from 'vitest'
import {
  calcAngle,
  calcKneeAngle,
  calcTorsoAngle,
  calcElbowAngle,
  detectBDC,
  isPostureStable,
} from '../lib/angles'

type LM = { x: number; y: number; visibility: number }
const lm = (x: number, y: number, v = 1.0): LM => ({ x, y, visibility: v })

describe('calcAngle', () => {
  it('computes 90 degrees for a right angle', () => {
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })
    expect(angle).toBeCloseTo(90, 1)
  })
  it('computes 180 degrees for a straight line', () => {
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })
    expect(angle).toBeCloseTo(180, 1)
  })
  it('computes 0 degrees when p1 and p3 are same direction', () => {
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0.5 })
    expect(angle).toBeCloseTo(0, 1)
  })
})

describe('calcKneeAngle', () => {
  it('returns null when all landmarks are low confidence', () => {
    const lms = Array(33).fill(null).map(() => lm(0, 0, 0.3))
    expect(calcKneeAngle(lms)).toBeNull()
  })
  it('returns angle when left side has higher visibility', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    lms[23] = lm(0.4, 0.3, 0.9) // left hip
    lms[25] = lm(0.4, 0.5, 0.9) // left knee
    lms[27] = lm(0.4, 0.7, 0.9) // left ankle — straight line → ~180°
    const result = calcKneeAngle(lms)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(180, 5)
  })
})

describe('calcTorsoAngle', () => {
  it('returns 0 degrees for upright posture', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.9))
    lms[11] = lm(0.5, 0.2, 0.9)
    lms[12] = lm(0.5, 0.2, 0.9)
    lms[23] = lm(0.5, 0.6, 0.9)
    lms[24] = lm(0.5, 0.6, 0.9)
    expect(calcTorsoAngle(lms)).toBeCloseTo(0, 1)
  })
  it('returns ~45 degrees for 45-degree forward lean', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.9))
    lms[11] = lm(0.5, 0.2, 0.9)
    lms[12] = lm(0.5, 0.2, 0.9)
    lms[23] = lm(0.7, 0.4, 0.9)
    lms[24] = lm(0.7, 0.4, 0.9)
    expect(calcTorsoAngle(lms)).toBeCloseTo(45, 1)
  })
  it('returns null when shoulder landmarks are low confidence', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    expect(calcTorsoAngle(lms)).toBeNull()
  })
})

describe('calcElbowAngle', () => {
  it('returns null when no side has confidence > 0.5', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    expect(calcElbowAngle(lms)).toBeNull()
  })
  it('uses left side when left elbow has higher visibility', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    lms[11] = lm(0.3, 0.3, 0.9)
    lms[13] = lm(0.3, 0.5, 0.9)
    lms[15] = lm(0.3, 0.7, 0.9)
    const result = calcElbowAngle(lms)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(180, 5)
  })
})

describe('detectBDC', () => {
  it('returns null when history is too short', () => {
    expect(detectBDC([0.5, 0.6])).toBeNull()
  })
  it('detects local maximum at middle of array', () => {
    const history = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6]
    expect(detectBDC(history)).toBe(5)
  })
  it('returns null when no clear peak', () => {
    const history = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    expect(detectBDC(history)).toBeNull()
  })
})

describe('isPostureStable', () => {
  it('returns false when fewer than 60 frames', () => {
    const shortHistory = Array(30).fill([
      lm(0.3, 0.5, 0.9), lm(0.3, 0.6, 0.9), lm(0.3, 0.7, 0.9),
    ])
    expect(isPostureStable(shortHistory)).toBe(false)
  })
  it('returns true when landmarks are stable and confident', () => {
    const stableFrame = [lm(0.3, 0.5, 0.9), lm(0.3, 0.6, 0.9), lm(0.3, 0.7, 0.9)]
    const history = Array(60).fill(stableFrame)
    expect(isPostureStable(history)).toBe(true)
  })
  it('returns false when standard deviation is too high', () => {
    const history = Array(60).fill(null).map((_, i) => [
      lm(0.3 + i * 0.01, 0.5, 0.9),
      lm(0.3, 0.6, 0.9),
      lm(0.3, 0.7, 0.9),
    ])
    expect(isPostureStable(history)).toBe(false)
  })
})
