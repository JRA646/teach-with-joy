import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, GraduationCap, RefreshCw, Users, ArrowRight, Video } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Props = { profile: any; openPage?: (page: string) => void }
const terminal = ['completed', 'student_absent', 'teacher_absent', 'teacher_cancelled', 'student_cancelled', 'postponed', 'holiday', 'no_show', 'technical_issue']

export default function TeacherDashboard({ profile, openPage }: Props) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
  const todaysSessions = useMemo(() => sessions.filter(s => s.scheduled_start && new Date(s.scheduled_start).toDateString() === todayKey).sort((a,b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [sessions, todayKey])
  const upcoming = useMemo(() => sessions.find(s => s.scheduled_start && new Date(s.scheduled_start) > new Date() && !terminal.includes(s.status)), [sessions])
  const totalContracted = enrollments.reduce((sum, e) => sum + Number(e.total_sessions || 0), 0)
  const consumed = sessions.filter(s => s.counts_as_session).length
  const completed = sessions.filter(s => s.status === 'completed' && s.counts_as_session).length
  const makeups = sessions.filter(s => s.makeup_for && ['unassigned', 'scheduled', 'confirmed', 'in_progress'].includes(s.status)).length
  const postponements = enrollments.reduce((sum, e) => sum + Math.max(Number(e.postponements_total || 0) - Number(e.postponements_used || 0), 0), 0)
  const awaitingAttendance = sessions.filter(s => s.scheduled_start && new Date(s.scheduled_start) < new Date() && !terminal.includes(s.status)).length
  const ungenerated = sessions.filter(s => !s.scheduled_start && s.status === 'unassigned' && !s.makeup_for).length
  const actionCount = awaitingAttendance + makeups + ungenerated

  async function generateForEnrollment(id: string) {
    setMessage('')
    const { data, error } = await supabase.rpc('generate_enrollment_session_schedule', { p_enrollment_id: id })
    if (error) setMessage(error.message)
    else setMessage(`Schedule generation completed${data?.scheduled ? ` · ${data.scheduled} sessions scheduled` : ''}.`)
    await load()
  }

  return <div className="page teacher-dashboard-page">
    <div className="teacher-dashboard-hero">
      <div>
        <span className="eyebrow">TEACHER DASHBOARD</span>
        <h1>Good morning, {profile.full_name?.split(' ')[0] || 'Teacher'} 👋</h1>
        <p>{todaysSessions.length ? `You have ${todaysSessions.length} class${todaysSessions.length === 1 ? '' : 'es'} today.` : 'Your teaching day, active programs, and attendance at a glance.'}</p>
      </div>
      <div className="program-toolbar"><button className="btn" onClick={() => void load()}><RefreshCw size={16}/>Refresh</button><button className="btn primary" onClick={() => openPage?.('programs')}><GraduationCap size={16}/>Manage programs</button></div>
    </div>

    {message && <div className="form-success compact">{message}</div>}

    {loading ? <div className="panel empty-state"><Clock3 size={28}/><strong>Loading your teaching workspace...</strong></div> : <>
      <div className="stat-grid teacher-dashboard-stats">
        <div className="stat teacher-kpi"><div><Users size={18}/></div><small>Students</small><strong>{students.length}</strong><span>Students connected to you</span></div>
        <div className="stat teacher-kpi"><div><GraduationCap size={18}/></div><small>Active programs</small><strong>{enrollments.length}</strong><span>Current enrollments</span></div>
        <div className="stat teacher-kpi"><div><CheckCircle2 size={18}/></div><small>Completed sessions</small><strong>{completed}</strong><span>Teacher-confirmed lessons</span></div>
        <div className="stat teacher-kpi"><div><CalendarDays size={18}/></div><small>Sessions remaining</small><strong>{Math.max(totalContracted - consumed, 0)}</strong><span>Still to deliver</span></div>
      </div>

      <div className="teacher-dashboard-grid">
        <section className="panel teacher-today-panel">
          <div className="panel-head"><div><h3>Today's classes</h3><p className="panel-subtitle">Join classes quickly and record attendance when the lesson is actually finished.</p></div><button onClick={() => openPage?.('attendance')}>Open attendance <ArrowRight size={13}/></button></div>
          {todaysSessions.length ? <div className="teacher-today-list">{todaysSessions.map(session => <TeacherSessionCard key={session.id} session={session}/>)}</div> : <div className="empty-state compact-empty"><CalendarDays size={28}/><h3>No classes scheduled today</h3><p>Use Students & Programs to generate or adjust your schedule.</p><button className="btn primary" onClick={() => openPage?.('programs')}>Open programs</button></div>}
        </section>

        <section className="panel teacher-action-panel">
          <div className="panel-head"><div><h3>Action required</h3><p className="panel-subtitle">Items that may need your attention.</p></div><span className={`action-count ${actionCount ? 'attention' : 'clear'}`}>{actionCount}</span></div>
          {actionCount ? <div className="action-list">
            {awaitingAttendance > 0 && <button className="action-item" onClick={() => openPage?.('attendance')}><AlertCircle size={16}/><span><strong>{awaitingAttendance} session{awaitingAttendance === 1 ? '' : 's'} need attendance</strong><small>Past scheduled sessions without a terminal status.</small></span><ArrowRight size={14}/></button>}
            {makeups > 0 && <button className="action-item" onClick={() => openPage?.('attendance')}><CalendarDays size={16}/><span><strong>{makeups} pending make-up{makeups === 1 ? '' : 's'}</strong><small>Replacement sessions still need scheduling or completion.</small></span><ArrowRight size={14}/></button>}
            {ungenerated > 0 && <button className="action-item" onClick={() => openPage?.('programs')}><Clock3 size={16}/><span><strong>{ungenerated} sessions need scheduling</strong><small>Generate dates from approved preferences and availability.</small></span><ArrowRight size={14}/></button>}
          </div> : <div className="action-clear"><CheckCircle2 size={26}/><strong>You're all caught up</strong><span>No immediate action is required.</span></div>}
        </section>
      </div>

      <section className="panel teacher-program-health-panel">
        <div className="panel-head"><div><h3>Program health</h3><p className="panel-subtitle">Quick operational metrics across your active programs.</p></div></div>
        <div className="teacher-health-list"><div><strong>{makeups}</strong><span>Pending make-ups</span></div><div><strong>{postponements}</strong><span>Postponements remaining</span></div><div><strong>{Math.max(totalContracted - consumed, 0)}</strong><span>Sessions to deliver</span></div></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Active programs</h3><p className="panel-subtitle">Monitor delivery and generate missing dates from approved preferences, teacher availability, and PH/KR holidays.</p></div><button onClick={() => openPage?.('programs')}>View all <ArrowRight size={13}/></button></div>
        {enrollments.length ? <div className="teacher-program-list">{enrollments.map(e => { const consumedFor = sessions.filter(s => s.enrollment_id === e.id && s.counts_as_session).length; const progress = e.total_sessions ? Math.min(100, Math.round(consumedFor / Number(e.total_sessions) * 100)) : 0; return <div className="teacher-program-row" key={e.id}><div><strong>{e.contract_type === 'three_month' ? '3-Month' : 'Monthly'} program</strong><small>Started {new Date(e.start_date).toLocaleDateString()} · {progress}% delivered</small><div className="teacher-program-progress"><span style={{width:`${progress}%`}}/></div></div><span>{consumedFor}/{e.total_sessions}</span><button className="btn small" onClick={() => void generateForEnrollment(e.id)}><CalendarDays size={14}/> Generate schedule</button></div>})}</div> : <div className="empty-state"><GraduationCap size={30}/><h3>No active programs</h3><p>Create your first enrollment in Students & Programs.</p></div>}
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
    <div className="teacher-session-main"><strong>{session.lesson_plan || 'Lesson session'}</strong><span>{session.meeting_provider?.replaceAll('_',' ')}</span>{session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noreferrer"><Video size={13}/>Join class</a>}</div>
    <div className="teacher-session-actions"><button disabled={saving} className="status-action success" onClick={() => void mark('completed')}>Completed</button><button disabled={saving} className="status-action warning" onClick={() => void mark('student_absent')}>Student absent</button><button disabled={saving} className="status-action danger" onClick={() => void mark('teacher_absent')}>Teacher absent</button></div>
    {message && <small className="teacher-session-message">{message}</small>}
  </div>
}
