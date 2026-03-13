import { useRef, useCallback, useEffect } from 'react'
import { type AngleState } from './useAngleCalculator'

const TRIGGER_DELAY_MS = 3000
const COOLDOWN_MS = 30_000

interface MetricRule {
  key: keyof AngleState
  lower: number
  upper: number
  lowMsg: string
  highMsg: string
}

const RULES: MetricRule[] = [
  { key: 'knee', lower: 140, upper: 150, lowMsg: '膝盖角度偏小，建议升高坐垫', highMsg: '膝盖角度偏大，建议降低坐垫' },
  { key: 'torso', lower: 35, upper: 45, lowMsg: '上体过于前倾，建议调高把立', highMsg: '上体过于直立，注意前倾姿势' },
  { key: 'elbow', lower: 150, upper: 165, lowMsg: '手肘弯曲过多，尝试放松手臂', highMsg: '手肘接近伸直，建议更换更短把立' },
]

export function useVoiceFeedback() {
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window
  // timer ref: key -> setTimeout id for trigger
  const triggerTimers = useRef<Record<keyof AngleState, ReturnType<typeof setTimeout> | null>>({ knee: null, torso: null, elbow: null })
  // cooldown ref: key -> setTimeout id for cooldown end
  const cooldownTimers = useRef<Record<keyof AngleState, ReturnType<typeof setTimeout> | null>>({ knee: null, torso: null, elbow: null })
  // in cooldown flag
  const inCooldown = useRef<Record<keyof AngleState, boolean>>({ knee: false, torso: false, elbow: false })

  function speak(text: string) {
    if (!speechAvailable) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  }

  function clearTrigger(key: keyof AngleState) {
    if (triggerTimers.current[key] !== null) {
      clearTimeout(triggerTimers.current[key]!)
      triggerTimers.current[key] = null
    }
  }

  const update = useCallback((angles: AngleState) => {
    for (const rule of RULES) {
      const angle = angles[rule.key]

      if (angle === null) {
        clearTrigger(rule.key)
        continue
      }

      const inRange = angle >= rule.lower && angle <= rule.upper
      if (inRange) {
        clearTrigger(rule.key)
        continue
      }

      // Out of range - start trigger timer if not already running
      if (triggerTimers.current[rule.key] === null) {
        const capturedAngle = angle
        const capturedKey = rule.key
        const capturedRule = rule
        triggerTimers.current[capturedKey] = setTimeout(() => {
          triggerTimers.current[capturedKey] = null
          if (!inCooldown.current[capturedKey]) {
            const msg = capturedAngle < capturedRule.lower ? capturedRule.lowMsg : capturedRule.highMsg
            speak(msg)
            inCooldown.current[capturedKey] = true
            // clear any existing cooldown timer
            if (cooldownTimers.current[capturedKey] !== null) {
              clearTimeout(cooldownTimers.current[capturedKey]!)
            }
            cooldownTimers.current[capturedKey] = setTimeout(() => {
              inCooldown.current[capturedKey] = false
              cooldownTimers.current[capturedKey] = null
            }, COOLDOWN_MS)
          }
        }, TRIGGER_DELAY_MS)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const key of ['knee', 'torso', 'elbow'] as Array<keyof AngleState>) {
        clearTrigger(key)
        if (cooldownTimers.current[key] !== null) {
          clearTimeout(cooldownTimers.current[key]!)
        }
      }
    }
  }, [])

  return { update, speechAvailable }
}
