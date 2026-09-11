export type ContractType = 'monthly' | 'three_month'
export type SessionStatus = 'completed' | 'student_absent' | 'teacher_absent' | 'teacher_cancelled' | 'student_cancelled' | 'postponed' | 'holiday' | 'no_show' | 'technical_issue' | 'scheduled' | 'confirmed' | 'in_progress'

export const contractRules = {
  monthly: { sessions: 20, postponements: 0, ebooks: 0 },
  three_month: { sessions: 60, postponements: 3, ebooks: 2 },
} as const

export function countsAsSession(status: SessionStatus, current = true) {
  if (['completed', 'student_absent', 'student_cancelled', 'no_show', 'technical_issue'].includes(status)) return true
  if (['teacher_absent', 'teacher_cancelled', 'postponed', 'holiday'].includes(status)) return false
  return current
}

export function replacementRequired(status: SessionStatus) {
  return ['teacher_absent', 'teacher_cancelled', 'postponed', 'holiday'].includes(status)
}

export function remainingSessions(total: number, consumed: number) {
  return Math.max(total - consumed, 0)
}

export function remainingPostponements(total: number, used: number) {
  return Math.max(total - used, 0)
}
