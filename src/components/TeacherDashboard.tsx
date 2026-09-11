import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, GraduationCap, RefreshCw, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Props = { profile: any; openPage?: (page: string) => void }

export default function TeacherDashboard({ profile, openPage }: Props) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [e, s, p] = await Promise.all([
      supabase.from('enrollments').select('*').eq('teacher_id', profile.id).eq('status', 'active').order('start_date', { ascending: false }),
      supabase.from('sessions').select('*').eq('teacher_id', profile.id).order('scheduled_start', { ascending: true, nullsFirst: false }),
      supabase.from('profiles').select('id,full_name,email').eq('role', 'student').order('full_name'),
    ])
    setEnrollments(e.data || [])
    setSessions(s.data || [])
    setStudents(p.data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile.id])

  const todayKey = new Date().toDateString()
  const todaysSessions = useMemo(() => sessions.filter(s => s.scheduled_start && new Date(s.scheduled_start).toDateString() === todayKey), [sessions, todayKey])
  const upcoming = useMemo(() => sessions.find(s => s.scheduled_start && new Date(s.scheduled_start) > new Date() && !['completed', 'student_absent', 'teacher_absent', 'teacher_cancelled', 'student_cancelled', 'holiday', 'postponed'].includes(s.status)), [sessions])
  const totalContracted = enrollments.reduce((sum, e) => sum + Number(e.total_sessions || 0), 0)
  const consumed = sessions.filter(s => s.counts_as_session).length
  const completed = sessions.filter(s => s.status === 'completed' && s.counts_as_session).length
  const makeups = sessions.filter(s => s.makeup_for && ['unassigned', 'scheduled', 'confirmed', 'in_progress'].includes(s.status)).length
  const postponements = enrollments.reduce((sum, e) => sum + Math.max(Number(e.postponements_total || 0) - Number(e.postponements_used || 0), 0), 0)

  async function generateForEnrollment(id: string) {
    await supabase.rpc('generate_enrollment_session_schedule', { p_enrollment_id: id })
    await load()
  }

  return <div className="page teacher-dashboard-page">
    <div className="page-title">
      <div>
        <span className="eyebrow">TEACHER DASHBOARD</span>
        <h1>Welcome back, {profile.full_name?.split(' ')[0] || 'Teacher'}! 👋</h1>
        <p>Your teaching day, active programs, attendance, and make-ups at a glance.</p>
      </div>
      <div className="program-toolbar">
        <button className="btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button>
        <button className="btn primary" onClick={() => openPage?.('programs')}><GraduationCap size={16}/> Manage programs</button>
      </div>
    </div>

    {loading ? <div className="panel empty-state"><Clock3 size={28}/><strong>Loading teacher dashboard...</strong></div> : <>
      <div className="stat-grid teacher-dashboard-stats">
        <div className="stat"><div><Users size={18}/></div><small>Students</small><strong>{students.length}</strong></div>
        <div className="stat"><div><GraduationCap size={18}/></div><small>Active programs</small><strong>{enrollments.length}</strong></div>
        <div className="stat"><div><CheckCircle2 size={18}/></div><small>Completed sessions</small><strong>{completed}</strong></div>
        <div className="stat"><div><CalendarDays size={18}/></div><small>Remaining sessions</small><strong>{Math.max(totalContracted - consumed, 0)}</strong></div>
      </div>

      <div className="dashboard-grid teacher-dashboard-grid">
        <section className="panel">
          <div className="panel-head"><div><h3>Today's classes</h3><p className="panel-subtitle">Record attendance after each lesson. Time passing alone never marks a lesson completed.</p></div><button onClick={() => openPage?.('attendance')}>Open attendance</button></div>
          {todaysSessions.length ? todaysSessions.map(session => <TeacherSessionCard key={session.id} session={session}/>) : <div className="empty-state"><CalendarDays size={30}/><h3>No classes scheduled today</h3><p>Use Students & Programs to generate or adjust your schedule.</p></div>}
        </section>

        <section className="panel">
          <div className="panel-head"><div><h3>Program health</h3><p className="panel-subtitle">Exceptions that may need your attention.</p></div></div>
          <div className="teacher-health-list">
            <div><strong>{makeups}</strong><span>Pending make-ups</span></div>
            <div><strong>{postponements}</strong><span>Postponements remaining</span></div>
            <div><strong>{Math.max(totalContracted - consumed, 0)}</strong><span>Sessions to deliver</span></div>
          </div>
          {upcoming && <div className="upcoming-mini"><span className="eyebrow">NEXT CLASS</span><strong>{new Date(upcoming.scheduled_start).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong><span>Session {upcoming.session_number}</span></div>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h3>Active programs</h3><p className="panel-subtitle">Generate missing dates using approved preferred schedules, teacher availability, and PH/KR holidays.</p></div></div>
        {enrollments.length ? <div className="teacher-program-list">{enrollments.map(e => <div className="teacher-program-row" key={e.id}><div><strong>{e.contract_type === 'three_month' ? '3-Month' : 'Monthly'} program</strong><small>Started {new Date(e.start_date).toLocaleDateString()}</small></div><span>{e.total_sessions} sessions</span><button className="btn small" onClick={() => void generateForEnrollment(e.id)}><CalendarDays size={14}/> Generate schedule</button></div>)}</div> : <div className="empty-state"><GraduationCap size={30}/><h3>No active programs</h3><p>Create your first enrollment in Students & Programs.</p></div>}
      </section>
    </>}
  </div>
}

function TeacherSessionCard({ session }: { session: any }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function mark(status: string) {
    setSaving(true); setMessage('')
    const { error } = await supabase.rpc('record_session_attendance', { p_session_id: session.id, p_status: status })
    setSaving(false)
    setMessage(error ? error.message : status === 'completed' ? 'Lesson completed.' : `${status.replaceAll('_', ' ')} recorded.`)
  }
  return <div className="teacher-session-card">
    <div className="teacher-session-time"><strong>{new Date(session.scheduled_start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</strong><span>Session {session.session_number}</span></div>
    <div className="teacher-session-main"><strong>{session.lesson_plan || 'Lesson session'}</strong><span>{session.meeting_provider?.replaceAll('_',' ')}</span>{session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noreferrer">Join class</a>}</div>
    <div className="teacher-session-actions"><button disabled={saving} className="status-action success" onClick={() => void mark('completed')}>Completed</button><button disabled={saving} className="status-action warning" onClick={() => void mark('student_absent')}>Student absent</button><button disabled={saving} className="status-action danger" onClick={() => void mark('teacher_absent')}>Teacher absent</button></div>
    {message && <small className="teacher-session-message">{message}</small>}
  </div>
}
