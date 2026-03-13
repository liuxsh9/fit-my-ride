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
