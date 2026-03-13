import { useRef, useState, useCallback, useEffect } from 'react'
import { type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { isPostureStable } from '../lib/angles'

type Landmark = { x: number; y: number; visibility: number }

export function useCalibration(onStable: () => void) {
  const historyRef = useRef<Array<[Landmark, Landmark, Landmark]>>([])
  const [isStable, setIsStable] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [hasDetected, setHasDetected] = useState(false)
  const stableRef = useRef(false)

  // Show skip button after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 30_000)
    return () => clearTimeout(timer)
  }, [])

  const processResults = useCallback((results: PoseLandmarkerResult) => {
    if (stableRef.current) return
    if (!results.landmarks || results.landmarks.length === 0) return

    const lms = results.landmarks[0]
    setHasDetected(true)

    // Track hip(23/24 avg), knee(25/26 avg), ankle(27/28 avg) — pick left side
    const frame: [Landmark, Landmark, Landmark] = [lms[23], lms[25], lms[27]]
    historyRef.current = [...historyRef.current.slice(-59), frame]

    if (isPostureStable(historyRef.current)) {
      stableRef.current = true
      setIsStable(true)
      setTimeout(onStable, 500) // brief pause so user sees the green state
    }
  }, [onStable])

  return { isStable, hasDetected, showSkip, processResults }
}
