import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessions } from '../hooks/useSessions'

beforeEach(() => localStorage.clear())

describe('useSessions', () => {
  it('starts with empty sessions', () => {
    const { result } = renderHook(() => useSessions())
    expect(result.current.sessions).toHaveLength(0)
  })

  it('saves a session and retrieves it', () => {
    const { result } = renderHook(() => useSessions())
    act(() => {
      result.current.saveSession({ avgKneeAngle: 145, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 300 })
    })
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].avgKneeAngle).toBe(145)
  })

  it('persists across hook re-mounts', () => {
    const { result: r1 } = renderHook(() => useSessions())
    act(() => {
      r1.current.saveSession({ avgKneeAngle: 145, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 300 })
    })
    const { result: r2 } = renderHook(() => useSessions())
    expect(r2.current.sessions).toHaveLength(1)
  })

  it('caps at 20 sessions, dropping oldest', () => {
    const { result } = renderHook(() => useSessions())
    act(() => {
      for (let i = 0; i < 22; i++) {
        result.current.saveSession({ avgKneeAngle: i, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 60 })
      }
    })
    expect(result.current.sessions).toHaveLength(20)
    // oldest (i=0) should be gone, newest (i=21) should be first
    expect(result.current.sessions[0].avgKneeAngle).toBe(21)
  })
})
