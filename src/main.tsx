import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BrowserCheck from './components/BrowserCheck'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserCheck>
      <App />
    </BrowserCheck>
  </StrictMode>,
)
