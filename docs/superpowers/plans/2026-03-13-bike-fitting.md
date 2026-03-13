# Bike Fitting App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based road cycling fitting guidance app that uses a laptop camera to measure knee/torso/elbow angles in real time and gives visual + voice feedback.

**Architecture:** Vite + React SPA with no backend. MediaPipe PoseLandmarker runs in-browser via WASM. Camera stream and pose results are shared via React Context to avoid rebuilding the MediaPipe pipeline on page transitions. Pure angle/scoring logic lives in `src/lib/` for easy unit testing.

**Tech Stack:** Vite 5, React 18, TypeScript, `@mediapipe/tasks-vision` v0.10.x, Canvas API, Web Speech API, Vitest, React Testing Library

---

## Chunk 1: Project Setup + Contexts + Browser Check

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] **Step 1: Create project with Vite**

```bash
cd /Users/lxs/code/test-superpowers
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — type `y`. When asked for framework: react, variant: react-ts.

- [ ] **Step 2: Install dependencies**

```bash
npm install @mediapipe/tasks-vision
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vite to support Vitest and WASM**

Replace `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

- [ ] **Step 4: Create test setup file**

```bash
mkdir -p src/test
```

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Download MediaPipe model to public/models/**

```bash
mkdir -p public/models
node -e "
const https = require('https');
const fs = require('fs');
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const dest = 'public/models/pose_landmarker_lite.task';
const file = fs.createWriteStream(dest);
https.get(url, r => r.pipe(file).on('finish', () => { console.log('Downloaded'); file.close(); }));
"
```

Expected: file `public/models/pose_landmarker_lite.task` exists (≈ 5-7 MB).

- [ ] **Step 7: Replace src/App.tsx with minimal shell**

```tsx
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
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`. Visit in Chrome — see page switcher.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+React+TS project with MediaPipe model"
```

---

### Task 2: BrowserCheck component

**Files:**
- Create: `src/components/BrowserCheck.tsx`
- Create: `src/test/BrowserCheck.test.tsx`

BrowserCheck detects unsupported browsers (Firefox/Safari) by checking for SharedArrayBuffer (required for WASM SIMD) and shows a warning overlay.

- [ ] **Step 1: Write failing test**

Create `src/test/BrowserCheck.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrowserCheck from '../components/BrowserCheck'

describe('BrowserCheck', () => {
  it('renders children when browser is supported', () => {
    // SharedArrayBuffer is defined in jsdom test env
    render(
      <BrowserCheck>
        <div>app content</div>
      </BrowserCheck>
    )
    expect(screen.getByText('app content')).toBeInTheDocument()
  })

  it('shows unsupported message when SharedArrayBuffer is undefined', () => {
    const orig = globalThis.SharedArrayBuffer
    // @ts-ignore
    delete globalThis.SharedArrayBuffer
    render(
      <BrowserCheck>
        <div>app content</div>
      </BrowserCheck>
    )
    expect(screen.queryByText('app content')).not.toBeInTheDocument()
    expect(screen.getByText(/请使用 Chrome 或 Edge/i)).toBeInTheDocument()
    // @ts-ignore
    globalThis.SharedArrayBuffer = orig
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/BrowserCheck.test.tsx
```

Expected: FAIL — `Cannot find module '../components/BrowserCheck'`

- [ ] **Step 3: Implement BrowserCheck**

Create `src/components/BrowserCheck.tsx`:

```tsx
interface Props {
  children: React.ReactNode
}

export default function BrowserCheck({ children }: Props) {
  const supported = typeof SharedArrayBuffer !== 'undefined'
  if (!supported) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#111', color: '#fff',
        flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24 }}>浏览器不支持</h1>
        <p>请使用 Chrome 或 Edge 浏览器打开此应用。</p>
        <p style={{ color: '#888', fontSize: 14 }}>
          本应用需要 WebAssembly SIMD 支持，Firefox 和 Safari 暂不兼容。
        </p>
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/BrowserCheck.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Wrap App with BrowserCheck in main.tsx**

Edit `src/main.tsx`:

```tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add BrowserCheck for unsupported browser detection"
```

---

### Task 3: CameraContext

**Files:**
- Create: `src/context/CameraContext.tsx`
- Create: `src/test/CameraContext.test.tsx`

Manages camera stream lifecycle. Exposes: `stream`, `videoRef`, `availableDevices`, `selectedDeviceId`, `setSelectedDeviceId`, `error`, `requestCamera()`.

- [ ] **Step 1: Write failing test**

Create `src/test/CameraContext.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CameraProvider, useCameraContext } from '../context/CameraContext'

const mockStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream

function TestConsumer() {
  const { error, stream } = useCameraContext()
  return <div>{error ? `error:${error}` : stream ? 'has-stream' : 'no-stream'}</div>
}

describe('CameraContext', () => {
  it('exposes no stream initially', () => {
    render(<CameraProvider><TestConsumer /></CameraProvider>)
    expect(screen.getByText('no-stream')).toBeInTheDocument()
  })

  it('sets error when camera permission denied', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })
    let ctx: ReturnType<typeof useCameraContext>
    function Capture() {
      ctx = useCameraContext()
      return null
    }
    render(<CameraProvider><Capture /></CameraProvider>)
    await act(async () => { await ctx!.requestCamera() })
    expect(screen.queryByText(/error/)).toBeTruthy()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/CameraContext.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement CameraContext**

```bash
mkdir -p src/context
```

Create `src/context/CameraContext.tsx`:

```tsx
import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'

interface CameraContextValue {
  stream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
  availableDevices: MediaDeviceInfo[]
  selectedDeviceId: string | null
  setSelectedDeviceId: (id: string) => void
  error: string | null
  requestCamera: () => Promise<void>
}

const CameraContext = createContext<CameraContextValue | null>(null)

export function CameraProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const requestCamera = useCallback(async () => {
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' },
      }
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAvailableDevices(devices.filter(d => d.kind === 'videoinput'))
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'NotAllowedError'
        ? '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头。'
        : '无法访问摄像头，请检查设备连接。'
      setError(msg)
    }
  }, [selectedDeviceId])

  return (
    <CameraContext.Provider value={{
      stream, videoRef, availableDevices,
      selectedDeviceId, setSelectedDeviceId,
      error, requestCamera,
    }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCameraContext() {
  const ctx = useContext(CameraContext)
  if (!ctx) throw new Error('useCameraContext must be used within CameraProvider')
  return ctx
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/CameraContext.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add CameraContext for camera stream management"
```

---

### Task 4: PoseContext

**Files:**
- Create: `src/context/PoseContext.tsx`

PoseContext owns the `PoseLandmarker` singleton. Exposes: `landmarker`, `results`, `isLoading`, `loadError`, `processFrame(video)`.

No unit tests for this context — it wraps the MediaPipe API which is not testable in jsdom. Integration tested manually.

- [ ] **Step 1: Create PoseContext**

```bash
mkdir -p src/context
```

Create `src/context/PoseContext.tsx`:

```tsx
import {
  createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode
} from 'react'
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

interface PoseContextValue {
  landmarker: PoseLandmarker | null
  results: PoseLandmarkerResult | null
  isLoading: boolean
  loadError: string | null
  processFrame: (video: HTMLVideoElement) => void
}

const PoseContext = createContext<PoseContextValue | null>(null)

export function PoseProvider({ children }: { children: ReactNode }) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null)
  const [results, setResults] = useState<PoseLandmarkerResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const lastVideoTime = useRef(-1)

  useEffect(() => {
    async function load() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          '/node_modules/@mediapipe/tasks-vision/wasm'
        )
        const pl = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceScore: 0.5,
          minTrackingConfidence: 0.5,
        })
        setLandmarker(pl)
      } catch (e) {
        setLoadError('MediaPipe 加载失败，请检查网络或使用 Chrome 浏览器。')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const processFrame = useCallback((video: HTMLVideoElement) => {
    if (!landmarker || video.currentTime === lastVideoTime.current) return
    lastVideoTime.current = video.currentTime
    const res = landmarker.detectForVideo(video, performance.now())
    setResults(res)
  }, [landmarker])

  return (
    <PoseContext.Provider value={{ landmarker, results, isLoading, loadError, processFrame }}>
      {children}
    </PoseContext.Provider>
  )
}

export function usePoseContext() {
  const ctx = useContext(PoseContext)
  if (!ctx) throw new Error('usePoseContext must be used within PoseProvider')
  return ctx
}
```

- [ ] **Step 2: Wire contexts into App**

Replace `src/App.tsx`:

```tsx
import { useState } from 'react'
import { CameraProvider } from './context/CameraContext'
import { PoseProvider } from './context/PoseContext'

export type Page = 'setup' | 'calibration' | 'riding' | 'summary'

export default function App() {
  const [page, setPage] = useState<Page>('setup')
  return (
    <CameraProvider>
      <PoseProvider>
        <div style={{ fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
          <pre style={{ padding: 16 }}>Current page: {page}</pre>
          <button onClick={() => setPage('setup')}>Setup</button>
          <button onClick={() => setPage('calibration')}>Calibration</button>
          <button onClick={() => setPage('riding')}>Riding</button>
          <button onClick={() => setPage('summary')}>Summary</button>
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add PoseContext for MediaPipe PoseLandmarker lifecycle"
```

---

## Chunk 2: Pure Logic — Angles, Scoring, Recommendations

### Task 5: Angle calculation library

**Files:**
- Create: `src/lib/angles.ts`
- Create: `src/test/angles.test.ts`

Pure functions with zero dependencies. All MediaPipe landmark types are just `{x, y, visibility?}` objects.

- [ ] **Step 1: Write failing tests**

Create `src/test/angles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  calcAngle,
  calcKneeAngle,
  calcTorsoAngle,
  calcElbowAngle,
  detectBDC,
  isPostureStable,
} from '../lib/angles'

type LM = { x: number; y: number; visibility: number }

// Helper: make a landmark
const lm = (x: number, y: number, v = 1.0): LM => ({ x, y, visibility: v })

describe('calcAngle', () => {
  it('computes 90 degrees for a right angle', () => {
    // p1 directly above p2, p3 directly right of p2
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })
    expect(angle).toBeCloseTo(90, 1)
  })
  it('computes 180 degrees for a straight line', () => {
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })
    expect(angle).toBeCloseTo(180, 1)
  })
  it('computes 0 degrees when p1 and p3 are same direction', () => {
    const angle = calcAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0.5 })
    expect(angle).toBeCloseTo(0, 1)
  })
})

describe('calcKneeAngle', () => {
  it('returns null when all landmarks are low confidence', () => {
    const lms = Array(33).fill(null).map(() => lm(0, 0, 0.3))
    expect(calcKneeAngle(lms)).toBeNull()
  })
  it('returns angle when left side has higher visibility', () => {
    // left side: hip=23, knee=25, ankle=27; right: 24,26,28
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    // Set left side with high visibility and a clear angle
    lms[23] = lm(0.4, 0.3, 0.9) // left hip
    lms[25] = lm(0.4, 0.5, 0.9) // left knee
    lms[27] = lm(0.4, 0.7, 0.9) // left ankle — straight line → ~180°
    const result = calcKneeAngle(lms)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(180, 5)
  })
})

describe('calcTorsoAngle', () => {
  it('returns 0 degrees for upright posture', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.9))
    lms[11] = lm(0.5, 0.2, 0.9) // left shoulder
    lms[12] = lm(0.5, 0.2, 0.9) // right shoulder
    lms[23] = lm(0.5, 0.6, 0.9) // left hip
    lms[24] = lm(0.5, 0.6, 0.9) // right hip
    // shoulder midpoint directly above hip midpoint → 0° from vertical
    expect(calcTorsoAngle(lms)).toBeCloseTo(0, 1)
  })
  it('returns ~45 degrees for 45-degree forward lean', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.9))
    // shoulder midpoint at (0.5, 0.2), hip midpoint at (0.7, 0.4)
    // vector from hip to shoulder: (-0.2, -0.2) → 45° from vertical
    lms[11] = lm(0.5, 0.2, 0.9)
    lms[12] = lm(0.5, 0.2, 0.9)
    lms[23] = lm(0.7, 0.4, 0.9)
    lms[24] = lm(0.7, 0.4, 0.9)
    expect(calcTorsoAngle(lms)).toBeCloseTo(45, 1)
  })
  it('returns null when shoulder landmarks are low confidence', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    expect(calcTorsoAngle(lms)).toBeNull()
  })
})

describe('calcElbowAngle', () => {
  it('returns null when no side has confidence > 0.5', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    expect(calcElbowAngle(lms)).toBeNull()
  })
  it('uses left side when left elbow has higher visibility', () => {
    const lms = Array(33).fill(null).map(() => lm(0.5, 0.5, 0.3))
    // left: shoulder=11, elbow=13, wrist=15
    lms[11] = lm(0.3, 0.3, 0.9) // left shoulder
    lms[13] = lm(0.3, 0.5, 0.9) // left elbow
    lms[15] = lm(0.3, 0.7, 0.9) // left wrist — straight line
    const result = calcElbowAngle(lms)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(180, 5)
  })
})

describe('detectBDC', () => {
  it('returns null when history is too short', () => {
    expect(detectBDC([0.5, 0.6])).toBeNull()
  })
  it('detects local maximum at middle of array', () => {
    // ankle Y values: going up then down — peak at index 5
    const history = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6]
    expect(detectBDC(history)).toBe(5)
  })
  it('returns null when no clear peak', () => {
    const history = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] // monotone increasing
    expect(detectBDC(history)).toBeNull()
  })
})

describe('isPostureStable', () => {
  it('returns false when fewer than 60 frames', () => {
    const shortHistory = Array(30).fill([
      lm(0.3, 0.5, 0.9), lm(0.3, 0.6, 0.9), lm(0.3, 0.7, 0.9),
    ])
    expect(isPostureStable(shortHistory)).toBe(false)
  })
  it('returns true when landmarks are stable and confident', () => {
    const stableFrame = [lm(0.3, 0.5, 0.9), lm(0.3, 0.6, 0.9), lm(0.3, 0.7, 0.9)]
    const history = Array(60).fill(stableFrame)
    expect(isPostureStable(history)).toBe(true)
  })
  it('returns false when standard deviation is too high', () => {
    const history = Array(60).fill(null).map((_, i) => [
      lm(0.3 + i * 0.01, 0.5, 0.9),
      lm(0.3, 0.6, 0.9),
      lm(0.3, 0.7, 0.9),
    ])
    expect(isPostureStable(history)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/angles.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement angles.ts**

```bash
mkdir -p src/lib
```

Create `src/lib/angles.ts`:

```typescript
type Point = { x: number; y: number }
type Landmark = { x: number; y: number; visibility: number }

/**
 * Calculate the angle at vertex p2, formed by rays p2→p1 and p2→p3.
 * Returns degrees [0, 180].
 */
export function calcAngle(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

const CONFIDENCE_THRESHOLD = 0.5

/**
 * Knee angle at BDC: hip→knee→ankle. Picks the side with higher visibility.
 * Returns null if neither side has sufficient confidence.
 */
export function calcKneeAngle(landmarks: Landmark[]): number | null {
  // Left: hip=23, knee=25, ankle=27; Right: hip=24, knee=26, ankle=28
  const leftVis = Math.min(
    landmarks[23].visibility, landmarks[25].visibility, landmarks[27].visibility
  )
  const rightVis = Math.min(
    landmarks[24].visibility, landmarks[26].visibility, landmarks[28].visibility
  )
  if (leftVis < CONFIDENCE_THRESHOLD && rightVis < CONFIDENCE_THRESHOLD) return null
  const [hip, knee, ankle] = leftVis >= rightVis
    ? [landmarks[23], landmarks[25], landmarks[27]]
    : [landmarks[24], landmarks[26], landmarks[28]]
  return calcAngle(hip, knee, ankle)
}

/**
 * Torso angle: angle between shoulder-midpoint→hip-midpoint line and screen vertical (Y axis).
 * 0° = fully upright, 90° = horizontal.
 * Returns null if shoulder/hip landmarks are low confidence.
 */
export function calcTorsoAngle(landmarks: Landmark[]): number | null {
  // Shoulders: 11=left, 12=right; Hips: 23=left, 24=right
  const shoulderVis = Math.min(landmarks[11].visibility, landmarks[12].visibility)
  const hipVis = Math.min(landmarks[23].visibility, landmarks[24].visibility)
  if (shoulderVis < CONFIDENCE_THRESHOLD || hipVis < CONFIDENCE_THRESHOLD) return null

  const shoulderMid = {
    x: (landmarks[11].x + landmarks[12].x) / 2,
    y: (landmarks[11].y + landmarks[12].y) / 2,
  }
  const hipMid = {
    x: (landmarks[23].x + landmarks[24].x) / 2,
    y: (landmarks[23].y + landmarks[24].y) / 2,
  }
  // Vector from hip to shoulder
  const dx = shoulderMid.x - hipMid.x
  const dy = shoulderMid.y - hipMid.y
  // Angle from vertical (Y axis): atan2 of |dx| vs |dy|
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI
}

/**
 * Elbow angle: shoulder→elbow→wrist. Picks the side with higher visibility.
 * Returns null if neither side has sufficient confidence.
 */
export function calcElbowAngle(landmarks: Landmark[]): number | null {
  // Left: shoulder=11, elbow=13, wrist=15; Right: shoulder=12, elbow=14, wrist=16
  const leftVis = Math.min(
    landmarks[11].visibility, landmarks[13].visibility, landmarks[15].visibility
  )
  const rightVis = Math.min(
    landmarks[12].visibility, landmarks[14].visibility, landmarks[16].visibility
  )
  if (leftVis < CONFIDENCE_THRESHOLD && rightVis < CONFIDENCE_THRESHOLD) return null
  const [shoulder, elbow, wrist] = leftVis >= rightVis
    ? [landmarks[11], landmarks[13], landmarks[15]]
    : [landmarks[12], landmarks[14], landmarks[16]]
  return calcAngle(shoulder, elbow, wrist)
}

/**
 * Detect Bottom Dead Center (BDC) in ankle Y coordinate history.
 * BDC = local maximum of ankle Y (Y increases downward).
 * Requires at least 5 frames. Returns index of peak, or null.
 */
export function detectBDC(ankleYHistory: number[]): number | null {
  if (ankleYHistory.length < 5) return null
  for (let i = 2; i < ankleYHistory.length - 2; i++) {
    if (
      ankleYHistory[i] > ankleYHistory[i - 1] &&
      ankleYHistory[i] > ankleYHistory[i - 2] &&
      ankleYHistory[i] > ankleYHistory[i + 1] &&
      ankleYHistory[i] > ankleYHistory[i + 2]
    ) {
      return i
    }
  }
  return null
}

/**
 * Stability check for calibration: last 60 frames of [hip, knee, ankle] landmarks.
 * Returns true when stddev of normalized coords < 0.01 and all confidence > 0.5.
 */
export function isPostureStable(
  history: Array<[Landmark, Landmark, Landmark]>
): boolean {
  if (history.length < 60) return false
  const recent = history.slice(-60)

  for (const frameIdx of [0, 1, 2]) {
    if (recent.some(frame => frame[frameIdx].visibility < CONFIDENCE_THRESHOLD)) return false
    const xs = recent.map(f => f[frameIdx].x)
    const ys = recent.map(f => f[frameIdx].y)
    if (stddev(xs) > 0.01 || stddev(ys) > 0.01) return false
  }
  return true
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/angles.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add angle calculation library with full test coverage"
```

---

### Task 6: Scoring and recommendations

**Files:**
- Create: `src/lib/scoring.ts`
- Create: `src/lib/recommendations.ts`
- Create: `src/test/scoring.test.ts`
- Create: `src/test/recommendations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcMetricScore, calcSessionScore } from '../lib/scoring'

describe('calcMetricScore', () => {
  it('returns 100 when angle is at midpoint', () => {
    expect(calcMetricScore(145, 140, 150)).toBe(100)
  })
  it('returns 0 when angle is at boundary', () => {
    expect(calcMetricScore(140, 140, 150)).toBe(0) // at lower boundary — deviation = 5 = halfRange → score = 0
    expect(calcMetricScore(135, 140, 150)).toBe(0) // beyond lower boundary → clamped to 0
  })
  it('returns ~50 when angle is halfway between midpoint and boundary', () => {
    // midpoint=145, halfRange=5; deviation=2.5 → score = 100 - 2.5/5*100 = 50
    expect(calcMetricScore(142.5, 140, 150)).toBeCloseTo(50, 1)
  })
  it('clamps to 0 for angles far outside range', () => {
    expect(calcMetricScore(120, 140, 150)).toBe(0)
    expect(calcMetricScore(200, 140, 150)).toBe(0)
  })
})

describe('calcSessionScore', () => {
  it('returns 100 for perfect angles', () => {
    expect(calcSessionScore(145, 40, 157.5)).toBe(100)
  })
  it('returns weighted score for mixed results', () => {
    // knee at lower boundary (0 pts), torso perfect (100), elbow perfect (100)
    // score = 0*0.5 + 100*0.3 + 100*0.2 = 50
    const score = calcSessionScore(135, 40, 157.5) // knee=135 is far below 140
    expect(score).toBe(50)
  })
  it('handles null angles (skips that metric from weighted average)', () => {
    // knee null → only torso+elbow, re-weighted 0.3+0.2 → normalize to 1.0
    const score = calcSessionScore(null, 40, 157.5)
    expect(score).toBe(100)
  })
})
```

Create `src/test/recommendations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getRecommendations } from '../lib/recommendations'

describe('getRecommendations', () => {
  it('returns all-good message when all angles are in range', () => {
    const recs = getRecommendations(145, 40, 157.5)
    expect(recs).toHaveLength(1)
    expect(recs[0]).toContain('状态良好')
  })
  it('returns knee recommendation when knee angle is too low', () => {
    const recs = getRecommendations(135, 40, 157.5)
    expect(recs.some(r => r.includes('升高坐垫'))).toBe(true)
  })
  it('returns torso recommendation when torso angle is too high', () => {
    const recs = getRecommendations(145, 50, 157.5)
    expect(recs.some(r => r.includes('直立'))).toBe(true)
  })
  it('returns elbow recommendation when elbow angle is too high', () => {
    const recs = getRecommendations(145, 40, 170)
    expect(recs.some(r => r.includes('接近伸直'))).toBe(true)
  })
  it('handles null angles gracefully', () => {
    expect(() => getRecommendations(null, null, null)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm run test:run -- src/test/scoring.test.ts src/test/recommendations.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement scoring.ts**

Create `src/lib/scoring.ts`:

```typescript
/**
 * Score a single angle metric against its target range.
 * Returns 0-100: 100 at midpoint, 0 at or beyond range boundaries.
 */
export function calcMetricScore(
  angle: number,
  lowerBound: number,
  upperBound: number
): number {
  const midpoint = (lowerBound + upperBound) / 2
  const halfRange = (upperBound - lowerBound) / 2
  return Math.max(0, 100 - (Math.abs(angle - midpoint) / halfRange) * 100)
}

const WEIGHTS = { knee: 0.5, torso: 0.3, elbow: 0.2 }

/**
 * Calculate overall session score (0-100 integer).
 * Null angles are excluded and weights re-normalized.
 */
export function calcSessionScore(
  avgKnee: number | null,
  avgTorso: number | null,
  avgElbow: number | null
): number {
  const entries: Array<{ score: number; weight: number }> = []
  if (avgKnee !== null)
    entries.push({ score: calcMetricScore(avgKnee, 140, 150), weight: WEIGHTS.knee })
  if (avgTorso !== null)
    entries.push({ score: calcMetricScore(avgTorso, 35, 45), weight: WEIGHTS.torso })
  if (avgElbow !== null)
    entries.push({ score: calcMetricScore(avgElbow, 150, 165), weight: WEIGHTS.elbow })

  if (entries.length === 0) return 0
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
  const weighted = entries.reduce((s, e) => s + e.score * (e.weight / totalWeight), 0)
  return Math.round(weighted)
}
```

- [ ] **Step 4: Implement recommendations.ts**

Create `src/lib/recommendations.ts`:

```typescript
export function getRecommendations(
  avgKnee: number | null,
  avgTorso: number | null,
  avgElbow: number | null
): string[] {
  const recs: string[] = []

  if (avgKnee !== null) {
    if (avgKnee < 140) recs.push('膝盖伸展角度偏小，建议升高坐垫约 5-10mm')
    else if (avgKnee > 150) recs.push('膝盖伸展角度偏大，建议降低坐垫约 5-10mm')
  }
  if (avgTorso !== null) {
    if (avgTorso < 35) recs.push('上体过于前倾，建议调高把立或缩短把立长度')
    else if (avgTorso > 45) recs.push('上体过于直立，建议降低把立或更换更长把立')
  }
  if (avgElbow !== null) {
    if (avgElbow < 150) recs.push('手肘弯曲过多，建议更换更长把立或调整把位')
    else if (avgElbow > 165) recs.push('手肘接近伸直，建议更换更短把立，保持轻微弯曲')
  }

  if (recs.length === 0) recs.push('当前 fitting 状态良好，继续保持！')
  return recs
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm run test:run -- src/test/scoring.test.ts src/test/recommendations.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add scoring formula and recommendation mapping with tests"
```

---

## Chunk 3: SetupPage + CalibrationPage

### Task 7: useAngleCalculator hook

**Files:**
- Create: `src/hooks/useAngleCalculator.ts`

Consumes `PoseLandmarkerResult` and maintains sliding window buffers. Returns current computed angles.

No unit test (integrates with React context); covered by manual testing in RidingPage.

- [ ] **Step 1: Create useAngleCalculator.ts**

```bash
mkdir -p src/hooks
```

Create `src/hooks/useAngleCalculator.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add useAngleCalculator hook with BDC detection and sliding windows"
```

---

### Task 8: SetupPage

**Files:**
- Create: `src/pages/SetupPage.tsx`

Shows camera position guide, requests camera permission, displays model loading progress, and advances to calibration when both camera and model are ready.

- [ ] **Step 1: Create SetupPage.tsx**

```bash
mkdir -p src/pages
```

Create `src/pages/SetupPage.tsx`:

```tsx
import { useEffect } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'

interface Props {
  onReady: () => void
}

export default function SetupPage({ onReady }: Props) {
  const { stream, error: camError, requestCamera, availableDevices, selectedDeviceId, setSelectedDeviceId } = useCameraContext()
  const { isLoading: modelLoading, loadError: modelError } = usePoseContext()

  const canProceed = !!stream && !modelLoading && !modelError

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>自行车 Fitting 分析</h1>
      <p style={styles.subtitle}>公路车姿态实时检测工具</p>

      {/* Camera position guide */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>📷 摄像头摆放要求</h2>
        <div style={styles.guideGrid}>
          <div style={styles.guideGood}>
            <div style={styles.guideIcon}>✅</div>
            <p><strong>正确</strong>：从<strong>侧面</strong>拍摄，与骑手方向呈 90°</p>
            <p>距离约 2-3 米，高度与腰部齐平</p>
          </div>
          <div style={styles.guideBad}>
            <div style={styles.guideIcon}>❌</div>
            <p><strong>错误</strong>：正面或背面拍摄无法测量关节角度</p>
          </div>
        </div>
      </div>

      {/* Camera device selector */}
      {availableDevices.length > 1 && (
        <div style={styles.card}>
          <label style={styles.label}>选择摄像头：</label>
          <select
            value={selectedDeviceId ?? ''}
            onChange={e => setSelectedDeviceId(e.target.value)}
            style={styles.select}
          >
            {availableDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `摄像头 ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Camera permission */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🎥 摄像头权限</h2>
        {stream ? (
          <p style={styles.success}>✅ 已授权</p>
        ) : camError ? (
          <>
            <p style={styles.error}>{camError}</p>
            <button style={styles.button} onClick={requestCamera}>重试</button>
          </>
        ) : (
          <button style={styles.button} onClick={requestCamera}>授权摄像头</button>
        )}
      </div>

      {/* Model loading */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🧠 AI 模型</h2>
        {modelLoading ? (
          <div>
            <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: '60%' }} /></div>
            <p style={styles.hint}>正在加载姿态检测模型（约 6MB）…</p>
          </div>
        ) : modelError ? (
          <p style={styles.error}>{modelError}</p>
        ) : (
          <p style={styles.success}>✅ 已加载</p>
        )}
      </div>

      <button
        style={{ ...styles.button, ...styles.primaryButton, opacity: canProceed ? 1 : 0.4 }}
        disabled={!canProceed}
        onClick={onReady}
      >
        开始校准 →
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: '0 auto', padding: 24 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: '#888', marginBottom: 24 },
  card: { background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  guideGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  guideGood: { background: '#0d2d1a', borderRadius: 8, padding: 12, fontSize: 13 },
  guideBad: { background: '#2d0d0d', borderRadius: 8, padding: 12, fontSize: 13 },
  guideIcon: { fontSize: 24, marginBottom: 8 },
  label: { display: 'block', marginBottom: 8, fontSize: 14 },
  select: { background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 12px', width: '100%' },
  button: { background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 },
  primaryButton: { background: '#4fc3f7', color: '#000', width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 600, marginTop: 8 },
  success: { color: '#4caf50', margin: 0 },
  error: { color: '#f44336', marginBottom: 12 },
  hint: { color: '#888', fontSize: 13, marginTop: 8 },
  progressBar: { background: '#333', borderRadius: 4, height: 6 },
  progressFill: { background: '#4fc3f7', height: '100%', borderRadius: 4, transition: 'width 0.3s' },
}
```

- [ ] **Step 2: Wire SetupPage into App**

Update `src/App.tsx`:

```tsx
import { useState, useRef } from 'react'
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
              <p>Page: {page}</p>
              <button onClick={() => setPage('setup')}>← Back to Setup</button>
            </div>
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open Chrome at `http://localhost:5173` — verify:
- Camera guide shows correct/incorrect diagrams
- "授权摄像头" button triggers browser permission dialog
- After permission granted, "✅ 已授权" appears
- Model loading progress shows, then "✅ 已加载"
- "开始校准" button becomes active only when both are ready

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement SetupPage with camera guide and model loading"
```

---

### Task 9: CalibrationPage

**Files:**
- Create: `src/pages/CalibrationPage.tsx`
- Create: `src/hooks/useCalibration.ts`

Runs PoseLandmarker on each video frame and checks stability. Shows video with skeleton dots, green checkmark when stable, skip button after 30s.

- [ ] **Step 1: Create useCalibration hook**

Create `src/hooks/useCalibration.ts`:

```typescript
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
```

- [ ] **Step 2: Create CalibrationPage.tsx**

Create `src/pages/CalibrationPage.tsx`:

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useCalibration } from '../hooks/useCalibration'

interface Props {
  onReady: () => void
}

export default function CalibrationPage({ onReady }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results } = usePoseContext()
  const { isStable, hasDetected, showSkip, processResults } = useCalibration(onReady)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Process results whenever they change
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Render loop: feed video frames to MediaPipe, draw dots on canvas
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) {
      animRef.current = requestAnimationFrame(renderLoop)
      return
    }
    processFrame(video)

    const ctx = canvas.getContext('2d')!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results?.landmarks?.[0]) {
      const lms = results.landmarks[0]
      // Draw horizontal reference line at hip height
      const hipY = ((lms[23].y + lms[24].y) / 2) * canvas.height
      ctx.strokeStyle = 'rgba(100,100,255,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, hipY)
      ctx.lineTo(canvas.width, hipY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw landmark dots
      lms.forEach(lm => {
        if (lm.visibility < 0.5) return
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
        ctx.fillStyle = isStable ? '#4caf50' : '#4fc3f7'
        ctx.fill()
      })
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame, results, isStable])

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop])

  // Set video source when stream available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
  }, [stream, videoRef])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>姿态校准</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>
        请骑上自行车，保持骑行姿态。系统检测到稳定骑行姿势后将自动进入分析界面。
      </p>

      <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

        {/* Status overlay */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '8px 16px', textAlign: 'center',
        }}>
          {!hasDetected && <p style={{ margin: 0, color: '#ffa' }}>⌛ 等待检测到人体…</p>}
          {hasDetected && !isStable && (
            <p style={{ margin: 0, color: '#4fc3f7' }}>
              🔄 检测中，请保持骑行姿态静止约 2 秒…
            </p>
          )}
          {isStable && <p style={{ margin: 0, color: '#4caf50', fontWeight: 600 }}>✅ 姿态稳定！即将开始分析…</p>}
        </div>
      </div>

      {!hasDetected && (
        <div style={{ marginTop: 12, padding: 12, background: '#1a1a2e', borderRadius: 8, fontSize: 13, color: '#aaa' }}>
          💡 提示：请确保身体完整入镜，光线充足，摄像头从侧面拍摄
        </div>
      )}

      {showSkip && !isStable && (
        <button
          onClick={onReady}
          style={{
            marginTop: 16, width: '100%', background: '#333', color: '#fff',
            border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 14,
          }}
        >
          跳过校准，直接开始 →
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire CalibrationPage into App**

Update `src/App.tsx`:

```tsx
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
```

- [ ] **Step 4: Verify calibration flow in browser**

1. Complete setup (grant camera, wait for model)
2. Move to calibration page — video should display
3. Stand/sit still in front of camera — blue dots should appear on body
4. After ~2 seconds of stillness, dots turn green and page advances
5. After 30 seconds without stable detection, "跳过校准" button appears

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement CalibrationPage with stability detection and skip button"
```

---

## Chunk 4: RidingPage — SkeletonOverlay + MetricsPanel

### Task 10: SkeletonOverlay component

**Files:**
- Create: `src/components/SkeletonOverlay.tsx`

Canvas drawn over the video, showing colored skeleton lines and floating angle labels. Color = green/yellow/red based on angle status.

- [ ] **Step 1: Create SkeletonOverlay.tsx**

Create `src/components/SkeletonOverlay.tsx`:

```tsx
import { useRef, useEffect, useCallback } from 'react'
import { type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { type AngleState } from '../hooks/useAngleCalculator'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>
  results: PoseLandmarkerResult | null
  angles: AngleState
}

// MediaPipe pose connections (subset relevant to fitting)
const CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
]

type Status = 'good' | 'warn' | 'bad' | 'unknown'

function angleStatus(
  angle: number | null,
  lower: number,
  upper: number,
  warnMargin = 5
): Status {
  if (angle === null) return 'unknown'
  if (angle >= lower && angle <= upper) return 'good'
  if (angle >= lower - warnMargin && angle <= upper + warnMargin) return 'warn'
  return 'bad'
}

const STATUS_COLORS: Record<Status, string> = {
  good: '#4caf50',
  warn: '#ffc107',
  bad: '#f44336',
  unknown: '#555',
}

export default function SkeletonOverlay({ videoRef, results, angles }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!results?.landmarks?.[0]) return
    const lms = results.landmarks[0]

    const kneeStatus = angleStatus(angles.knee, 140, 150)
    const torsoStatus = angleStatus(angles.torso, 35, 45)
    const elbowStatus = angleStatus(angles.elbow, 150, 165)

    function colorForJoints(a: number, b: number): string {
      // knee limbs: 23-25-27 (left), 24-26-28 (right)
      const kneeJoints = new Set([23, 24, 25, 26, 27, 28])
      const torsoJoints = new Set([11, 12, 23, 24])
      const elbowJoints = new Set([11, 12, 13, 14, 15, 16])
      if (kneeJoints.has(a) && kneeJoints.has(b)) return STATUS_COLORS[kneeStatus]
      if (torsoJoints.has(a) && torsoJoints.has(b)) return STATUS_COLORS[torsoStatus]
      if (elbowJoints.has(a) && elbowJoints.has(b)) return STATUS_COLORS[elbowStatus]
      return '#888'
    }

    // Draw connections
    ctx.lineWidth = 3
    CONNECTIONS.forEach(([a, b]) => {
      const la = lms[a], lb = lms[b]
      if (la.visibility < 0.5 || lb.visibility < 0.5) return
      ctx.strokeStyle = colorForJoints(a, b)
      ctx.beginPath()
      ctx.moveTo(la.x * canvas.width, la.y * canvas.height)
      ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height)
      ctx.stroke()
    })

    // Draw dots
    lms.forEach((lm, i) => {
      if (lm.visibility < 0.5) return
      ctx.beginPath()
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    })

    // Angle labels
    function drawLabel(text: string, lm: { x: number; y: number }, color: string) {
      const x = lm.x * canvas.width
      const y = lm.y * canvas.height - 12
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      const w = ctx.measureText(text).width
      ctx.fillRect(x - 2, y - 14, w + 8, 18)
      ctx.fillStyle = color
      ctx.fillText(text, x + 2, y)
    }

    if (angles.knee !== null) {
      const kneeLm = lms[25].visibility > lms[26].visibility ? lms[25] : lms[26]
      drawLabel(`${Math.round(angles.knee)}°`, kneeLm, STATUS_COLORS[kneeStatus])
    }
    if (angles.torso !== null) {
      const shoulderMid = { x: (lms[11].x + lms[12].x) / 2, y: (lms[11].y + lms[12].y) / 2 }
      drawLabel(`${Math.round(angles.torso)}°`, shoulderMid, STATUS_COLORS[torsoStatus])
    }
    if (angles.elbow !== null) {
      const elbowLm = lms[13].visibility > lms[14].visibility ? lms[13] : lms[14]
      drawLabel(`${Math.round(angles.elbow)}°`, elbowLm, STATUS_COLORS[elbowStatus])
    }
  }, [videoRef, results, angles])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add SkeletonOverlay with colored joints and angle labels"
```

---

### Task 11: MetricsPanel component

**Files:**
- Create: `src/components/MetricsPanel.tsx`
- Create: `src/test/MetricsPanel.test.tsx`

Right-side panel showing three metric cards with current angle, progress bar, and target range.

- [ ] **Step 1: Write failing test**

Create `src/test/MetricsPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MetricsPanel from '../components/MetricsPanel'

describe('MetricsPanel', () => {
  it('shows -- for null knee angle', () => {
    render(<MetricsPanel angles={{ knee: null, torso: 40, elbow: 155 }} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })
  it('shows rounded angle values', () => {
    render(<MetricsPanel angles={{ knee: 144.7, torso: 40.3, elbow: 155.1 }} />)
    expect(screen.getByText('145°')).toBeInTheDocument()
    expect(screen.getByText('40°')).toBeInTheDocument()
    expect(screen.getByText('155°')).toBeInTheDocument()
  })
  it('shows target ranges', () => {
    render(<MetricsPanel angles={{ knee: 145, torso: 40, elbow: 157 }} />)
    expect(screen.getByText(/140.*150/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/MetricsPanel.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement MetricsPanel.tsx**

Create `src/components/MetricsPanel.tsx`:

```tsx
import { type AngleState } from '../hooks/useAngleCalculator'

interface Props {
  angles: AngleState
}

interface MetricConfig {
  key: keyof AngleState
  label: string
  lower: number
  upper: number
  unit: string
}

const METRICS: MetricConfig[] = [
  { key: 'knee', label: '膝盖角度', lower: 140, upper: 150, unit: '°' },
  { key: 'torso', label: '躯干角度', lower: 35, upper: 45, unit: '°' },
  { key: 'elbow', label: '手肘角度', lower: 150, upper: 165, unit: '°' },
]

type Status = 'good' | 'warn' | 'bad' | 'unknown'

function getStatus(angle: number | null, lower: number, upper: number): Status {
  if (angle === null) return 'unknown'
  if (angle >= lower && angle <= upper) return 'good'
  if (angle >= lower - 5 && angle <= upper + 5) return 'warn'
  return 'bad'
}

function getProgressPercent(angle: number | null, lower: number, upper: number): number {
  if (angle === null) return 0
  const range = upper - lower
  const pos = Math.max(0, Math.min(1, (angle - (lower - range / 2)) / (range * 2)))
  return Math.round(pos * 100)
}

const STATUS_COLORS: Record<Status, string> = {
  good: '#4caf50',
  warn: '#ffc107',
  bad: '#f44336',
  unknown: '#555',
}

export default function MetricsPanel({ angles }: Props) {
  return (
    <div style={styles.panel}>
      {METRICS.map(({ key, label, lower, upper }) => {
        const angle = angles[key]
        const status = getStatus(angle, lower, upper)
        const color = STATUS_COLORS[status]
        const progress = getProgressPercent(angle, lower, upper)

        return (
          <div key={key} style={{ ...styles.card, borderLeft: `3px solid ${color}` }}>
            <div style={styles.cardLabel}>{label}</div>
            <div style={{ ...styles.cardValue, color }}>
              {angle === null ? '--' : `${Math.round(angle)}°`}
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%`, background: color }} />
              {/* Target range indicator */}
              <div style={styles.targetZone} />
            </div>
            <div style={styles.rangeLabel}>目标: {lower}° – {upper}°</div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
    height: '100%', justifyContent: 'center',
  },
  card: {
    background: '#1a1a2e', borderRadius: 10, padding: '14px 16px',
  },
  cardLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 10 },
  progressTrack: { position: 'relative', height: 6, background: '#333', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.15s, background 0.3s' },
  targetZone: {
    position: 'absolute', top: 0, left: '33%', width: '33%', height: '100%',
    background: 'rgba(255,255,255,0.08)', borderRadius: 3,
  },
  rangeLabel: { fontSize: 11, color: '#666' },
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/MetricsPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add MetricsPanel with angle cards and progress bars"
```

---

### Task 12: RidingPage

**Files:**
- Create: `src/pages/RidingPage.tsx`

Left/right split layout. Left: video + SkeletonOverlay. Right: MetricsPanel. ESC/Space stops session.

- [ ] **Step 1: Create RidingPage.tsx**

Create `src/pages/RidingPage.tsx`:

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { useCameraContext } from '../context/CameraContext'
import { usePoseContext } from '../context/PoseContext'
import { useAngleCalculator } from '../hooks/useAngleCalculator'
import SkeletonOverlay from '../components/SkeletonOverlay'
import MetricsPanel from '../components/MetricsPanel'
import { type AccumulatedAngles } from '../hooks/useAngleCalculator'

interface Props {
  onStop: (accumulated: AccumulatedAngles, durationSec: number) => void
}

export default function RidingPage({ onStop }: Props) {
  const { videoRef, stream } = useCameraContext()
  const { processFrame, results } = usePoseContext()
  const { angles, accumulated, processResults, reset } = useAngleCalculator()
  const animRef = useRef<number>(0)
  const startTimeRef = useRef(Date.now())

  // Set video source
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
    startTimeRef.current = Date.now()
    reset()
  }, [stream, videoRef, reset])

  // Process pose results
  useEffect(() => {
    if (results) processResults(results)
  }, [results, processResults])

  // Render loop
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused && !video.ended) {
      processFrame(video)
    }
    animRef.current = requestAnimationFrame(renderLoop)
  }, [videoRef, processFrame])

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animRef.current)
  }, [renderLoop])

  // ESC / Space to stop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        handleStop()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [accumulated])

  function handleStop() {
    cancelAnimationFrame(animRef.current)
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    onStop(accumulated, duration)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      {/* Left: camera + skeleton */}
      <div style={{ flex: 2, position: 'relative', background: '#000' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        <SkeletonOverlay videoRef={videoRef} results={results} angles={angles} />

        {/* Stop button */}
        <button
          onClick={handleStop}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,50,50,0.8)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 14px',
            cursor: 'pointer', fontSize: 13,
          }}
        >
          停止 (ESC)
        </button>
      </div>

      {/* Right: metrics */}
      <div style={{ flex: 1, background: '#111', minWidth: 220, maxWidth: 300 }}>
        <MetricsPanel angles={angles} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire RidingPage into App**

Update `src/App.tsx`:

```tsx
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
              <button onClick={() => setPage('setup')}>← Restart</button>
            </div>
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
```

- [ ] **Step 3: Verify in browser**

1. Complete setup + calibration
2. RidingPage shows: video on left (2/3), metrics on right (1/3)
3. After a few seconds, angles appear and skeleton lines show in the video
4. Press ESC → navigates to placeholder summary page

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement RidingPage with split layout, SkeletonOverlay and MetricsPanel"
```

---

## Chunk 5: VoiceFeedback + SummaryPage + Sessions

### Task 13: useVoiceFeedback hook

**Files:**
- Create: `src/hooks/useVoiceFeedback.ts`
- Create: `src/test/useVoiceFeedback.test.ts`

Triggers speech synthesis when angles are out of range for > 3 seconds, with 30s cooldown per metric.

- [ ] **Step 1: Write failing test**

Create `src/test/useVoiceFeedback.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/useVoiceFeedback.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement useVoiceFeedback.ts**

Create `src/hooks/useVoiceFeedback.ts`:

```typescript
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
  const outOfRangeStart = useRef<Record<keyof AngleState, number | null>>({ knee: null, torso: null, elbow: null })
  const lastSpoken = useRef<Record<keyof AngleState, number>>({ knee: 0, torso: 0, elbow: 0 })

  function speak(text: string) {
    if (!speechAvailable) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  }

  const update = useCallback((angles: AngleState) => {
    const now = Date.now()

    for (const rule of RULES) {
      const angle = angles[rule.key]
      if (angle === null) {
        outOfRangeStart.current[rule.key] = null
        continue
      }

      const inRange = angle >= rule.lower && angle <= rule.upper
      if (inRange) {
        outOfRangeStart.current[rule.key] = null
        continue
      }

      // Out of range
      if (outOfRangeStart.current[rule.key] === null) {
        outOfRangeStart.current[rule.key] = now
      }
      const elapsed = now - outOfRangeStart.current[rule.key]!
      const sinceLastSpoken = now - lastSpoken.current[rule.key]

      if (elapsed >= TRIGGER_DELAY_MS && sinceLastSpoken >= COOLDOWN_MS) {
        const msg = angle < rule.lower ? rule.lowMsg : rule.highMsg
        speak(msg)
        lastSpoken.current[rule.key] = now
        break // only speak one at a time (priority: first rule wins = knee)
      }
    }
  }, [])

  return { update, speechAvailable }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/useVoiceFeedback.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate voice feedback into RidingPage**

Edit `src/pages/RidingPage.tsx` — add these lines:

After the existing imports, add:
```tsx
import { useVoiceFeedback } from '../hooks/useVoiceFeedback'
```

Inside the `RidingPage` component, after `useAngleCalculator()`:
```tsx
const { update: updateVoice, speechAvailable } = useVoiceFeedback()
```

Add a `useEffect` that calls `updateVoice` whenever angles change:
```tsx
useEffect(() => {
  updateVoice(angles)
}, [angles, updateVoice])
```

Add a voice status badge in the right panel area (before `</div>` of right panel):
```tsx
{!speechAvailable && (
  <div style={{ padding: '8px 16px', color: '#888', fontSize: 12 }}>
    🔇 语音不可用
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add useVoiceFeedback with 3s trigger and 30s cooldown"
```

---

### Task 14: useSessions hook

**Files:**
- Create: `src/hooks/useSessions.ts`
- Create: `src/test/useSessions.test.ts`

Read/write session history in localStorage.

- [ ] **Step 1: Write failing test**

Create `src/test/useSessions.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessions } from '../hooks/useSessions'

beforeEach(() => localStorage.clear())

describe('useSessions', () => {
  it('starts with empty sessions', () => {
    const { result } = renderHook(() => useSessions())
    expect(result.current.sessions).toHaveLength(0)
  })

  it('saves a session and retrieves it', () => {
    const { result } = renderHook(() => useSessions())
    act(() => {
      result.current.saveSession({ avgKneeAngle: 145, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 300 })
    })
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].avgKneeAngle).toBe(145)
  })

  it('persists across hook re-mounts', () => {
    const { result: r1 } = renderHook(() => useSessions())
    act(() => {
      r1.current.saveSession({ avgKneeAngle: 145, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 300 })
    })
    const { result: r2 } = renderHook(() => useSessions())
    expect(r2.current.sessions).toHaveLength(1)
  })

  it('caps at 20 sessions, dropping oldest', () => {
    const { result } = renderHook(() => useSessions())
    act(() => {
      for (let i = 0; i < 22; i++) {
        result.current.saveSession({ avgKneeAngle: i, avgTorsoAngle: 40, avgElbowAngle: 157, duration: 60 })
      }
    })
    expect(result.current.sessions).toHaveLength(20)
    // oldest (i=0) should be gone, newest (i=21) should be first
    expect(result.current.sessions[0].avgKneeAngle).toBe(21)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/test/useSessions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement useSessions.ts**

Create `src/hooks/useSessions.ts`:

```typescript
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/test/useSessions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add useSessions hook with localStorage persistence"
```

---

### Task 15: SummaryPage

**Files:**
- Create: `src/pages/SummaryPage.tsx`

Shows session results: average angles vs targets, score, recommendations, history list.

- [ ] **Step 1: Create SummaryPage.tsx**

Create `src/pages/SummaryPage.tsx`:

```tsx
import { useEffect } from 'react'
import { type AccumulatedAngles } from '../hooks/useAngleCalculator'
import { useSessions, type Session } from '../hooks/useSessions'
import { getRecommendations } from '../lib/recommendations'
import { calcSessionScore } from '../lib/scoring'

interface Props {
  accumulated: AccumulatedAngles
  duration: number
  onRestart: () => void
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MetricRow({ label, angle, lower, upper }: { label: string; angle: number | null; lower: number; upper: number }) {
  const inRange = angle !== null && angle >= lower && angle <= upper
  const color = angle === null ? '#666' : inRange ? '#4caf50' : '#f44336'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #222' }}>
      <span style={{ color: '#aaa' }}>{label}</span>
      <span style={{ color, fontWeight: 600, fontSize: 18 }}>
        {angle === null ? '--' : `${Math.round(angle)}°`}
      </span>
      <span style={{ color: '#555', fontSize: 13 }}>目标 {lower}–{upper}°</span>
    </div>
  )
}

export default function SummaryPage({ accumulated, duration, onRestart }: Props) {
  const avgKnee = avg(accumulated.kneeReadings)
  const avgTorso = avg(accumulated.torsoReadings)
  const avgElbow = avg(accumulated.elbowReadings)
  const score = calcSessionScore(avgKnee, avgTorso, avgElbow)
  const recommendations = getRecommendations(avgKnee, avgTorso, avgElbow)
  const { sessions, saveSession } = useSessions()

  useEffect(() => {
    saveSession({ avgKneeAngle: avgKnee, avgTorsoAngle: avgTorso, avgElbowAngle: avgElbow, duration })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // save once on mount

  const mins = Math.floor(duration / 60)
  const secs = duration % 60

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>本次 Fitting 分析结果</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>骑行时长：{mins}分{secs}秒</p>

      {/* Score */}
      <div style={{ textAlign: 'center', background: '#1a1a2e', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: score >= 80 ? '#4caf50' : score >= 60 ? '#ffc107' : '#f44336' }}>
          {score}
        </div>
        <div style={{ color: '#888', fontSize: 14 }}>综合评分（满分 100）</div>
      </div>

      {/* Metrics */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: '8px 20px', marginBottom: 20 }}>
        <MetricRow label="膝盖角度" angle={avgKnee} lower={140} upper={150} />
        <MetricRow label="躯干角度" angle={avgTorso} lower={35} upper={45} />
        <MetricRow label="手肘角度" angle={avgElbow} lower={150} upper={165} />
      </div>

      {/* Recommendations */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>调整建议</h2>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14, color: '#ddd' }}>
            <span>💡</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* History */}
      {sessions.length > 1 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>历史记录</h2>
          {sessions.slice(0, 5).map((s: Session) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', fontSize: 13 }}>
              <span style={{ color: '#888' }}>{formatDate(s.timestamp)}</span>
              <span style={{ color: s.score >= 80 ? '#4caf50' : s.score >= 60 ? '#ffc107' : '#f44336', fontWeight: 600 }}>
                {s.score} 分
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onRestart}
        style={{
          width: '100%', background: '#4fc3f7', color: '#000',
          border: 'none', borderRadius: 10, padding: '14px 20px',
          fontSize: 16, fontWeight: 600, cursor: 'pointer',
        }}
      >
        重新分析 →
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire SummaryPage into App**

Replace `src/App.tsx` with the final version:

```tsx
import { useState, useRef } from 'react'
import { CameraProvider } from './context/CameraContext'
import { PoseProvider } from './context/PoseContext'
import SetupPage from './pages/SetupPage'
import CalibrationPage from './pages/CalibrationPage'
import RidingPage from './pages/RidingPage'
import SummaryPage from './pages/SummaryPage'
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
          {page === 'summary' && sessionData.current && (
            <SummaryPage
              accumulated={sessionData.current.accumulated}
              duration={sessionData.current.duration}
              onRestart={() => setPage('setup')}
            />
          )}
        </div>
      </PoseProvider>
    </CameraProvider>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass (angles, scoring, recommendations, BrowserCheck, MetricsPanel, useSessions, useVoiceFeedback)

- [ ] **Step 4: Verify full flow in browser**

1. Setup → grant camera, wait for model → click "开始校准"
2. Calibration → sit on bike, stay still → auto-advances after 2s stability
3. Riding → video + skeleton on left, 3 metric cards on right
4. Press ESC → Summary page with score, recommendations, and history
5. "重新分析" → back to Setup

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement SummaryPage and complete full app flow"
```

---

## Chunk 6: Polish + Global CSS + Register to Toolbox

### Task 16: Global styles and final polish

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`

- [ ] **Step 1: Update index.css**

Replace `src/index.css`:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #111;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button { cursor: pointer; }
button:focus-visible { outline: 2px solid #4fc3f7; outline-offset: 2px; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1a1a2e; }
::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
```

- [ ] **Step 2: Update index.html title**

Edit `index.html`, change `<title>` to:
```html
<title>自行车 Fitting 分析</title>
```

- [ ] **Step 3: Run all tests one final time**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 4: Build and verify production bundle**

```bash
npm run build
```

Expected: Build succeeds in `dist/`. Check that `dist/models/pose_landmarker_lite.task` exists.

- [ ] **Step 5: Register to local toolbox**

```bash
npm run dev &
sleep 2
curl -X POST http://localhost:3000/api/tools/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"bike-fitting","displayName":"自行车 Fitting 分析","description":"公路车姿态实时检测，膝盖/躯干/手肘角度分析 + 语音指导","url":"http://localhost:5173","health":"/"}' \
  || echo "Toolbox not running, skipping registration"
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: add global styles, polish, and register to toolbox"
```
