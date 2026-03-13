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
