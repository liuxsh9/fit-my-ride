import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useVoiceFeedback } from '../hooks/useVoiceFeedback'

describe('useVoiceFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const mockSynth = {
      speak: vi.fn(),
      cancel: vi.fn(),
      speaking: false,
    }
    vi.stubGlobal('speechSynthesis', mockSynth)
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text = ''
      lang = ''
      rate = 1
      constructor(t: string) { this.text = t }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not speak when angles are in range', () => {
    const { result } = renderHook(() => useVoiceFeedback())
    act(() => { result.current.update({ knee: 145, torso: 40, elbow: 157 }) })
    vi.advanceTimersByTime(5000)
    expect(speechSynthesis.speak).not.toHaveBeenCalled()
  })

  it('speaks after 3 seconds of out-of-range angle', () => {
    const { result } = renderHook(() => useVoiceFeedback())
    act(() => {
      result.current.update({ knee: 130, torso: 40, elbow: 157 }) // knee too low
    })
    act(() => { vi.advanceTimersByTime(3100) })
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    const utterance = (speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(utterance.text).toContain('升高坐垫')
  })

  it('does not repeat within 30 seconds', () => {
    const { result } = renderHook(() => useVoiceFeedback())
    act(() => { result.current.update({ knee: 130, torso: 40, elbow: 157 }) })
    act(() => { vi.advanceTimersByTime(3100) })
    act(() => { vi.advanceTimersByTime(5000) }) // 8 seconds total, still in cooldown
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
  })

  it('speaks again after 30-second cooldown', () => {
    const { result } = renderHook(() => useVoiceFeedback())
    act(() => { result.current.update({ knee: 130, torso: 40, elbow: 157 }) })
    act(() => { vi.advanceTimersByTime(3100) })
    act(() => { vi.advanceTimersByTime(30100) }) // past cooldown
    act(() => { result.current.update({ knee: 130, torso: 40, elbow: 157 }) })
    act(() => { vi.advanceTimersByTime(3100) })
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2)
  })
})
