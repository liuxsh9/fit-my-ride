import { useState, useCallback } from 'react'
import { calcSessionScore } from '../lib/scoring'

export interface Session {
  id: string
  timestamp: number
  duration: number
  avgKneeAngle: number | null
  avgTorsoAngle: number | null
  avgElbowAngle: number | null
  score: number
}

const STORAGE_KEY = 'bike-fitting-sessions'
const MAX_SESSIONS = 20

function load(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(sessions: Session[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // quota exceeded — silently ignore
  }
}

interface SaveInput {
  avgKneeAngle: number | null
  avgTorsoAngle: number | null
  avgElbowAngle: number | null
  duration: number
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(() => load())

  const saveSession = useCallback((input: SaveInput) => {
    const session: Session = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      duration: input.duration,
      avgKneeAngle: input.avgKneeAngle,
      avgTorsoAngle: input.avgTorsoAngle,
      avgElbowAngle: input.avgElbowAngle,
      score: calcSessionScore(input.avgKneeAngle, input.avgTorsoAngle, input.avgElbowAngle),
    }
    setSessions(prev => {
      const updated = [session, ...prev].slice(0, MAX_SESSIONS)
      save(updated)
      return updated
    })
    return session
  }, [])

  return { sessions, saveSession }
}
