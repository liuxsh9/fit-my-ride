import { useRef, useState, useCallback } from 'react'
import { type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { calcKneeAngle, calcTorsoAngle, calcElbowAngle, detectBDC } from '../lib/angles'

const WINDOW_SIZE = 30

export interface AngleState {
  knee: number | null       // null until first BDC detected
  torso: number | null
  elbow: number | null
}

export interface AccumulatedAngles {
  kneeReadings: number[]
  torsoReadings: number[]
  elbowReadings: number[]
}

export function useAngleCalculator() {
  const torsoBuffer = useRef<number[]>([])
  const elbowBuffer = useRef<number[]>([])
  const ankleYHistory = useRef<number[]>([])
  const kneeAtBDC = useRef<number[]>([])

  const [angles, setAngles] = useState<AngleState>({ knee: null, torso: null, elbow: null })
  const accumulated = useRef<AccumulatedAngles>({ kneeReadings: [], torsoReadings: [], elbowReadings: [] })

  const processResults = useCallback((results: PoseLandmarkerResult) => {
    if (!results.landmarks || results.landmarks.length === 0) return
    const lms = results.landmarks[0]

    // Torso: sliding window average
    const torso = calcTorsoAngle(lms)
    if (torso !== null) {
      torsoBuffer.current = [...torsoBuffer.current.slice(-(WINDOW_SIZE - 1)), torso]
    }

    // Elbow: sliding window average
    const elbow = calcElbowAngle(lms)
    if (elbow !== null) {
      elbowBuffer.current = [...elbowBuffer.current.slice(-(WINDOW_SIZE - 1)), elbow]
    }

    // Knee: BDC detection via ankle Y history
    // Use higher-visibility ankle (indices 27=left, 28=right)
    const ankleY = lms[27].visibility >= lms[28].visibility
      ? lms[27].y
      : lms[28].y
    ankleYHistory.current = [...ankleYHistory.current.slice(-20), ankleY]

    const bdcIdx = detectBDC(ankleYHistory.current)
    if (bdcIdx !== null) {
      // Capture knee angles around BDC frame (we work with current snapshot)
      const knee = calcKneeAngle(lms)
      if (knee !== null) {
        kneeAtBDC.current = [...kneeAtBDC.current.slice(-(WINDOW_SIZE - 1)), knee]
      }
    }

    const avgTorso = torsoBuffer.current.length > 0
      ? torsoBuffer.current.reduce((a, b) => a + b, 0) / torsoBuffer.current.length
      : null
    const avgElbow = elbowBuffer.current.length > 0
      ? elbowBuffer.current.reduce((a, b) => a + b, 0) / elbowBuffer.current.length
      : null
    const avgKnee = kneeAtBDC.current.length > 0
      ? kneeAtBDC.current.reduce((a, b) => a + b, 0) / kneeAtBDC.current.length
      : null

    accumulated.current = {
      kneeReadings: [...kneeAtBDC.current],
      torsoReadings: [...torsoBuffer.current],
      elbowReadings: [...elbowBuffer.current],
    }

    setAngles({ knee: avgKnee, torso: avgTorso, elbow: avgElbow })
  }, [])

  const reset = useCallback(() => {
    torsoBuffer.current = []
    elbowBuffer.current = []
    ankleYHistory.current = []
    kneeAtBDC.current = []
    accumulated.current = { kneeReadings: [], torsoReadings: [], elbowReadings: [] }
    setAngles({ knee: null, torso: null, elbow: null })
  }, [])

  return { angles, accumulated: accumulated.current, processResults, reset }
}
