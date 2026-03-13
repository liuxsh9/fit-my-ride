import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
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
