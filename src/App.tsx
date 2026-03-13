import { useState, useRef } from 'react'
import { CameraProvider } from './context/CameraContext'
import { PoseProvider } from './context/PoseContext'
import SetupPage from './pages/SetupPage'
import CalibrationPage from './pages/CalibrationPage'
import RidingPage from './pages/RidingPage'
import { type AccumulatedAngles } from './hooks/useAngleCalculator'

export type Page = 'setup' | 'calibration' | 'riding' | 'summary'

export default function App() {
  const [page, setPage] = useState<Page>('setup')
  const sessionData = useRef<{ accumulated: AccumulatedAngles; duration: number } | null>(null)

  function handleRidingStop(accumulated: AccumulatedAngles, duration: number) {
    sessionData.current = { accumulated, duration }
    setPage('summary')
  }

  return (
    <CameraProvider>
      <PoseProvider>
        <div style={{ fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
          {page === 'setup' && <SetupPage onReady={() => setPage('calibration')} />}
          {page === 'calibration' && <CalibrationPage onReady={() => setPage('riding')} />}
          {page === 'riding' && <RidingPage onStop={handleRidingStop} />}
          {page === 'summary' && (
            <div style={{ padding: 24 }}>
              <p>Summary page coming soon</p>
              <p>Duration: {sessionData.current?.duration}s</p>
              <button type="button" onClick={() => setPage('setup')}>← Restart</button>
            </div>
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
