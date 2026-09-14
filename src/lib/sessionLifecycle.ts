export const SESSION_STATUSES = [
  'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed',
  'teacher_absent', 'student_absent', 'teacher_cancelled', 'student_cancelled',
  'rescheduled', 'no_show', 'holiday', 'technical_issue',
] as const

export type SessionStatus = typeof SESSION_STATUSES[number]

const transitions: Record<SessionStatus, readonly SessionStatus[]> = {
  scheduled: ['confirmed', 'cancelled', 'postponed', 'rescheduled', 'teacher_cancelled', 'student_cancelled', 'holiday', 'technical_issue'],
  confirmed: ['in_progress', 'cancelled', 'postponed', 'rescheduled', 'teacher_cancelled', 'student_cancelled', 'holiday', 'technical_issue'],
  in_progress: ['completed', 'teacher_absent', 'student_absent', 'no_show', 'technical_issue'],
  completed: [],
  cancelled: [],
  postponed: ['rescheduled', 'cancelled'],
  teacher_absent: ['rescheduled', 'cancelled'],
  student_absent: [],
  teacher_cancelled: ['rescheduled', 'cancelled'],
  student_cancelled: [],
  rescheduled: ['scheduled', 'confirmed', 'cancelled'],
  no_show: [],
  holiday: ['rescheduled'],
  technical_issue: ['rescheduled', 'in_progress', 'cancelled'],
}

export function canTransition(from: string, to: string): boolean {
  if (!SESSION_STATUSES.includes(from as SessionStatus) || !SESSION_STATUSES.includes(to as SessionStatus)) return false
  return transitions[from as SessionStatus].includes(to as SessionStatus)
}

export function transitionSession(from: SessionStatus, to: SessionStatus): SessionStatus {
  if (!canTransition(from, to)) throw new Error(`Invalid session transition: ${from} -> ${to}`)
  return to
}

export function isTerminalSessionStatus(status: string): boolean {
  return ['completed', 'cancelled', 'student_absent', 'student_cancelled', 'no_show'].includes(status)
}
