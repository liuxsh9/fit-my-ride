import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BrowserCheck from '../components/BrowserCheck'

describe('BrowserCheck', () => {
  it('renders children when browser is supported', () => {
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
