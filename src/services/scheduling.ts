import { supabase } from '../lib/supabase'

export type SchedulingStatus =
  | 'AVAILABLE'
  | 'CONFLICT'
  | 'OUTSIDE_AVAILABILITY'
  | 'BLACKED_OUT'
  | 'HOLIDAY'
  | 'INVALID'

export type ScheduleCheck = {
  status: SchedulingStatus | string
  available: boolean
  teacher_available?: boolean
  student_available?: boolean
  holiday?: boolean
  blackout?: boolean
  conflict?: boolean
  local_date?: string
  day_of_week?: number
  timezone?: string
  reasons?: string[]
}

export type AvailabilityInput = {
  userId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone?: string
}

export async function checkScheduleSlot(input: {
  teacherId: string
  studentId: string
  start: string
  end: string
  timezone?: string
}): Promise<ScheduleCheck> {
  const { data, error } = await supabase.rpc('check_schedule_slot', {
    p_teacher_id: input.teacherId,
    p_student_id: input.studentId,
    p_start: input.start,
    p_end: input.end,
    p_timezone: input.timezone ?? 'Asia/Manila',
  })
  if (error) throw new Error(error.message)
  return (data ?? {
    status: 'INVALID',
    available: false,
    reasons: ['No scheduling result returned'],
  }) as ScheduleCheck
}

export async function addTeacherAvailability(input: AvailabilityInput) {
  const { error } = await supabase.from('teacher_availability').insert({
    teacher_id: input.userId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    timezone: input.timezone ?? 'Asia/Manila',
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function removeTeacherAvailability(teacherId: string, id: string) {
  const { error } = await supabase.from('teacher_availability').update({ is_active: false }).eq('id', id).eq('teacher_id', teacherId)
  if (error) throw new Error(error.message)
}

export async function addStudentAvailability(input: AvailabilityInput) {
  const { error } = await supabase.from('student_availability').insert({
    student_id: input.userId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    timezone: input.timezone ?? 'Asia/Manila',
    active: true,
  })
  if (error) throw new Error(error.message)
}

export async function removeStudentAvailability(studentId: string, id: string) {
  const { error } = await supabase.from('student_availability').update({ active: false }).eq('id', id).eq('student_id', studentId)
  if (error) throw new Error(error.message)
}

export async function addAvailabilityException(input: {
  teacherId?: string
  studentId?: string
  date: string
  startTime?: string
  endTime?: string
  allDay?: boolean
  reason?: string
}) {
  if ((input.teacherId ? 1 : 0) + (input.studentId ? 1 : 0) !== 1) {
    throw new Error('Exactly one teacher or student is required for an availability exception.')
  }
  const { error } = await supabase.from('availability_exceptions').insert({
    teacher_id: input.teacherId ?? null,
    student_id: input.studentId ?? null,
    exception_date: input.date,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    all_day: input.allDay ?? true,
    reason: input.reason ?? null,
    active: true,
  })
  if (error) throw new Error(error.message)
}

export async function generateRecurringSeriesSessions(seriesId: string) {
  const { data, error } = await supabase.rpc('generate_recurring_series_sessions', { p_series_id: seriesId })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export async function rescheduleSession(input: {
  sessionId: string
  start: string
  end: string
  reason?: string
  timezone?: string
}) {
  const { data, error } = await supabase.rpc('reschedule_session', {
    p_session_id: input.sessionId,
    p_new_start: input.start,
    p_new_end: input.end,
    p_reason: input.reason ?? null,
    p_timezone: input.timezone ?? 'Asia/Manila',
  })
  if (error) throw new Error(error.message)
  return data as { session_id: string; status: string; scheduled_start: string; scheduled_end: string }
}

export async function cancelSession(input: {
  sessionId: string
  reason?: string
  createReplacement?: boolean
}) {
  const { data, error } = await supabase.rpc('cancel_session', {
    p_session_id: input.sessionId,
    p_reason: input.reason ?? null,
    p_create_replacement: input.createReplacement ?? false,
  })
  if (error) throw new Error(error.message)
  return data as { session_id: string; status: string; replacement_session_id?: string | null }
}

export async function skipSession(input: { sessionId: string; reason?: string }) {
  const { data, error } = await supabase.rpc('skip_session', {
    p_session_id: input.sessionId,
    p_reason: input.reason ?? null,
  })
  if (error) throw new Error(error.message)
  return data as { session_id: string; status: string; counts_as_session: boolean }
}

export async function createSessionReplacement(input: {
  sessionId: string
  start: string
  end: string
  reason?: string
  timezone?: string
}) {
  const { data, error } = await supabase.rpc('create_session_replacement', {
    p_session_id: input.sessionId,
    p_new_start: input.start,
    p_new_end: input.end,
    p_reason: input.reason ?? null,
    p_timezone: input.timezone ?? 'Asia/Manila',
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function logSchedulingEvent(input: {
  entityType: string
  entityId?: string
  action: string
  status?: string
  details?: Record<string, unknown>
}) {
  const { data, error } = await supabase.rpc('log_scheduling_event', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_action: input.action,
    p_status: input.status ?? null,
    p_details: input.details ?? {},
  })
  if (error) throw new Error(error.message)
  return data as string
}
