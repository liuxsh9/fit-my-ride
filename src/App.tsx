import { useState } from 'react'
import { CameraProvider } from './context/CameraContext'
import { PoseProvider } from './context/PoseContext'
import SetupPage from './pages/SetupPage'

export type Page = 'setup' | 'calibration' | 'riding' | 'summary'

export default function App() {
  const [page, setPage] = useState<Page>('setup')
  return (
    <CameraProvider>
      <PoseProvider>
        <div style={{ fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
          {page === 'setup' && <SetupPage onReady={() => setPage('calibration')} />}
          {page !== 'setup' && (
            <div style={{ padding: 16 }}>
              <p>Current page: {page}</p>
              <button onClick={() => setPage('calibration')}>Calibration</button>
              <button onClick={() => setPage('riding')}>Riding</button>
              <button onClick={() => setPage('summary')}>Summary</button>
            </div>
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
