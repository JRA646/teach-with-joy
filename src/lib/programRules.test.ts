import { describe, expect, it } from 'vitest'
import { contractRules, countsAsSession, remainingPostponements, remainingSessions, replacementRequired } from './programRules'

describe('program contract rules', () => {
  it('gives monthly contracts 20 sessions and no postponements', () => {
    expect(contractRules.monthly).toEqual({ sessions: 20, postponements: 0, ebooks: 0 })
  })

  it('gives 3-month contracts 60 sessions, 3 postponements and 2 ebooks', () => {
    expect(contractRules.three_month).toEqual({ sessions: 60, postponements: 3, ebooks: 2 })
  })
})

describe('session accounting', () => {
  it('counts completed and student absence', () => {
    expect(countsAsSession('completed')).toBe(true)
    expect(countsAsSession('student_absent')).toBe(true)
  })

  it('does not count teacher absence, postponement, or holiday', () => {
    expect(countsAsSession('teacher_absent')).toBe(false)
    expect(countsAsSession('teacher_cancelled')).toBe(false)
    expect(countsAsSession('postponed')).toBe(false)
    expect(countsAsSession('holiday')).toBe(false)
  })

  it('flags statuses that need replacement sessions', () => {
    expect(replacementRequired('teacher_absent')).toBe(true)
    expect(replacementRequired('postponed')).toBe(true)
    expect(replacementRequired('student_absent')).toBe(false)
  })

  it('never returns negative remaining counts', () => {
    expect(remainingSessions(20, 7)).toBe(13)
    expect(remainingSessions(20, 22)).toBe(0)
    expect(remainingPostponements(3, 1)).toBe(2)
    expect(remainingPostponements(3, 4)).toBe(0)
  })
})
