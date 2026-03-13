// src/App.tsx
import { useState } from 'react'

export type Page = 'setup' | 'calibration' | 'riding' | 'summary'

export default function App() {
  const [page, setPage] = useState<Page>('setup')
  return (
    <div style={{ fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
      <pre style={{ padding: 16 }}>Current page: {page}</pre>
      <button onClick={() => setPage('setup')}>Setup</button>
      <button onClick={() => setPage('calibration')}>Calibration</button>
      <button onClick={() => setPage('riding')}>Riding</button>
      <button onClick={() => setPage('summary')}>Summary</button>
    </div>
  )
}
