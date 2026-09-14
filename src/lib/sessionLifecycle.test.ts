import { describe, expect, it } from 'vitest'
import { canTransition, isTerminalSessionStatus, transitionSession } from './sessionLifecycle'

describe('session lifecycle', () => {
  it('allows normal lesson progression', () => {
    expect(canTransition('scheduled', 'confirmed')).toBe(true)
    expect(canTransition('confirmed', 'in_progress')).toBe(true)
    expect(transitionSession('in_progress', 'completed')).toBe('completed')
  })

  it('rejects impossible transitions', () => {
    expect(canTransition('completed', 'scheduled')).toBe(false)
    expect(() => transitionSession('completed', 'scheduled')).toThrow()
  })

  it('identifies terminal statuses', () => {
    expect(isTerminalSessionStatus('completed')).toBe(true)
    expect(isTerminalSessionStatus('postponed')).toBe(false)
  })
})
