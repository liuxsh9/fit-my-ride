import { useState } from 'react'
import { CameraProvider } from './context/CameraContext'
import { PoseProvider } from './context/PoseContext'
import SetupPage from './pages/SetupPage'
import CalibrationPage from './pages/CalibrationPage'

export type Page = 'setup' | 'calibration' | 'riding' | 'summary'

export default function App() {
  const [page, setPage] = useState<Page>('setup')
  return (
    <CameraProvider>
      <PoseProvider>
        <div style={{ fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
          {page === 'setup' && <SetupPage onReady={() => setPage('calibration')} />}
          {page === 'calibration' && <CalibrationPage onReady={() => setPage('riding')} />}
          {page === 'riding' && (
            <div style={{ padding: 24 }}>
              <p>Riding page coming soon</p>
              <button onClick={() => setPage('summary')}>→ Summary</button>
            </div>
          )}
          {page === 'summary' && (
            <div style={{ padding: 24 }}>
              <p>Summary page coming soon</p>
              <button onClick={() => setPage('setup')}>← Restart</button>
            </div>
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
