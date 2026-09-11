import { useEffect, useState } from 'react'
import { CalendarCheck, CheckCircle2, Clock3, RefreshCw, UserX, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TeacherAttendance({ profile }: { profile: any }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const start = new Date(`${date}T00:00:00`).toISOString()
    const endDate = new Date(`${date}T00:00:00`); endDate.setDate(endDate.getDate() + 1)
    const { data, error: e } = await supabase.from('sessions').select('*').eq('teacher_id', profile.id).gte('scheduled_start', start).lt('scheduled_start', endDate.toISOString()).order('scheduled_start')
    if (e) setError(e.message)
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile.id, date])

  return <div className="page">
    <div className="page-title">
      <div><span className="eyebrow">ATTENDANCE</span><h1>Today's attendance</h1><p>Record the actual outcome of each class. Scheduled time never automatically means completed.</p></div>
      <div className="program-toolbar"><input className="attendance-date-input" type="date" value={date} onChange={e => setDate(e.target.value)}/><button className="btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button></div>
    </div>
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="panel empty-state"><Clock3 size={28}/><strong>Loading attendance...</strong></div> : sessions.length ? <section className="panel attendance-list">{sessions.map(s => <AttendanceRow key={s.id} session={s} saved={load}/>)}</section> : <section className="panel empty-state"><CalendarCheck size={36}/><h3>No sessions for this date</h3><p>Schedule a session from Students & Programs.</p></section>}
  </div>
}

function AttendanceRow({ session, saved }: { session: any; saved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const terminal = ['completed','student_absent','teacher_absent','teacher_cancelled','student_cancelled','postponed','holiday','no_show','technical_issue'].includes(session.status)
  async function mark(status: string) {
    setSaving(true); setError('')
    const { error: e } = await supabase.rpc('record_session_attendance', { p_session_id: session.id, p_status: status })
    setSaving(false)
    if (e) { setError(e.message); return }
    await saved()
  }
  return <article className="attendance-row">
    <div className="attendance-time"><strong>{session.scheduled_start ? new Date(session.scheduled_start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '—'}</strong><small>Session {session.session_number}</small></div>
    <div className="attendance-copy"><strong>{session.makeup_for ? 'Make-up session' : `Session ${session.session_number}`}</strong><span>{session.lesson_plan || 'No lesson plan yet'}</span>{session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noreferrer">Open meeting</a>}</div>
    <span className={`program-status ${session.status === 'completed' ? 'success' : ['teacher_absent','student_absent'].includes(session.status) ? 'warning' : 'info'}`}>{session.status.replaceAll('_',' ')}</span>
    <div className="attendance-actions">
      <button disabled={saving} className="status-action success" onClick={() => void mark('completed')}><CheckCircle2 size={14}/> Completed</button>
      <button disabled={saving} className="status-action warning" onClick={() => void mark('student_absent')}><UserX size={14}/> Student absent</button>
      <button disabled={saving} className="status-action danger" onClick={() => void mark('teacher_absent')}><XCircle size={14}/> Teacher absent</button>
      {!terminal && <button disabled={saving} className="status-action neutral" onClick={() => void mark('postponed')}>Postpone</button>}
    </div>
    {error && <small className="form-error attendance-row-error">{error}</small>}
  </article>
}
