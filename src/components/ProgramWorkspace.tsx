import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileText, GraduationCap, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Session = any
type Enrollment = any
const terminalStatuses = ['completed', 'student_absent', 'teacher_absent', 'teacher_cancelled', 'student_cancelled', 'postponed', 'holiday', 'no_show', 'technical_issue']
const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase())
const statusClass = (status: string) => status === 'completed' ? 'program-status success' : ['teacher_absent','student_absent','student_cancelled','teacher_cancelled'].includes(status) ? 'program-status warning' : ['holiday','postponed'].includes(status) ? 'program-status info' : 'program-status'

export default function ProgramWorkspace({ profile }: { profile: any }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [teacher, setTeacher] = useState<any>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'calendar' | 'ledger'>('calendar')

  async function loadEnrollments() {
    const field = profile.role === 'teacher' ? 'teacher_id' : 'student_id'
    const { data, error: e } = await supabase.from('enrollments').select('*').eq(field, profile.id).in('status', ['active','completed']).order('start_date', { ascending: false })
    if (e) { setError(e.message); setLoading(false); return }
    setEnrollments(data || [])
    if (!selectedEnrollmentId && data?.[0]) setSelectedEnrollmentId(data[0].id)
    if (!data?.length) setLoading(false)
  }

  async function loadProgram() {
    if (!selectedEnrollmentId) return
    const [{ data, error: se }, { data: e, error: ee }] = await Promise.all([
      supabase.from('sessions').select('*').eq('enrollment_id', selectedEnrollmentId).order('scheduled_start', { ascending: true, nullsFirst: false }).order('session_number', { ascending: true }),
      supabase.from('enrollments').select('*').eq('id', selectedEnrollmentId).single()
    ])
    if (se) setError(se.message); if (ee) setError(ee.message)
    setSessions(data || [])
    if (e?.teacher_id) { const { data: t } = await supabase.from('profiles').select('id,full_name,email,avatar_url').eq('id', e.teacher_id).maybeSingle(); setTeacher(t || null) } else setTeacher(null)
    setLoading(false)
  }

  useEffect(() => { void loadEnrollments() }, [profile.id, profile.role])
  useEffect(() => { void loadProgram() }, [selectedEnrollmentId])
  useEffect(() => {
    if (!selectedEnrollmentId) return
    const channel = supabase.channel(`program:${selectedEnrollmentId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `enrollment_id=eq.${selectedEnrollmentId}` }, loadProgram).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enrollments', filter: `id=eq.${selectedEnrollmentId}` }, () => { loadEnrollments(); loadProgram() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedEnrollmentId])

  const enrollment = enrollments.find(x => x.id === selectedEnrollmentId)
  const consumed = sessions.filter(s => s.counts_as_session).length
  const completed = sessions.filter(s => s.status === 'completed' && s.counts_as_session).length
  const remaining = Math.max(Number(enrollment?.total_sessions || 0) - consumed, 0)
  const postponementsRemaining = Math.max(Number(enrollment?.postponements_total || 0) - Number(enrollment?.postponements_used || 0), 0)
  const upcoming = sessions.find(s => s.scheduled_start && new Date(s.scheduled_start) > new Date() && !terminalStatuses.includes(s.status))
  const months = useMemo(() => { const groups: Record<string, Session[]> = {}; sessions.forEach(s => { const key = s.scheduled_start ? new Date(s.scheduled_start).toLocaleString('en-US',{month:'long',year:'numeric'}) : 'Needs scheduling'; (groups[key] ||= []).push(s) }); return Object.entries(groups) }, [sessions])

  if (loading) return <div className="screen-loader">Loading your program...</div>
  if (!enrollments.length) return <div className="page"><section className="panel"><div className="empty-state"><GraduationCap size={30}/><h3>No active program yet</h3><p>Your enrollment and class schedule will appear here once an administrator creates your program.</p></div></section></div>

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">ENROLLMENT</span><h1>My learning program</h1><p>Program calendar, attendance, make-ups, postponements and lesson records.</p></div><div className="program-toolbar"><select value={selectedEnrollmentId} onChange={e=>setSelectedEnrollmentId(e.target.value)}>{enrollments.map(e=><option key={e.id} value={e.id}>{e.contract_type === 'three_month' ? '3-Month' : 'Monthly'} · {e.start_date}</option>)}</select><button className="btn" onClick={()=>{void loadEnrollments();void loadProgram()}}><RefreshCw size={16}/>Refresh</button></div></div>
    <div className="program-summary"><div className="program-hero panel"><div><span className="eyebrow">{enrollment?.contract_type === 'three_month' ? '3-MONTH PROGRAM' : 'MONTHLY PROGRAM'}</span><h2>{profile.role === 'teacher' ? 'Assigned student program' : 'Your learning program'}</h2><p>{teacher ? <>Teacher: <strong>{teacher.full_name}</strong></> : 'Teacher not assigned yet'}</p></div><div className="program-progress"><strong>{completed}/{enrollment?.total_sessions}</strong><span>completed</span></div></div><div className="stat-grid program-stats"><div className="stat-card"><div><strong>{enrollment?.total_sessions}</strong><small>Total sessions</small></div></div><div className="stat-card"><div><strong>{completed}</strong><small>Completed</small></div></div><div className="stat-card"><div><strong>{remaining}</strong><small>Remaining</small></div></div><div className="stat-card"><div><strong>{postponementsRemaining}</strong><small>Postponements left</small></div></div></div></div>
    <section className="panel program-next"><div><span className="eyebrow">NEXT CLASS</span><h3>{upcoming ? `Session ${upcoming.session_number}` : 'No upcoming class'}</h3><p>{upcoming ? `${new Date(upcoming.scheduled_start).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} · ${new Date(upcoming.scheduled_start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}` : 'Ask your administrator or teacher to schedule the next session.'}</p></div>{upcoming?.meeting_url && <a className="btn primary" href={upcoming.meeting_url} target="_blank" rel="noreferrer">Join class</a>}</section>
    <section className="panel"><div className="panel-head"><div><h3>Program calendar</h3><p className="panel-subtitle">Your spreadsheet workflow is now a live session ledger.</p></div><div className="program-view-toggle"><button className={view==='calendar'?'btn primary small':'btn small'} onClick={()=>setView('calendar')}><CalendarDays size={15}/>Calendar</button><button className={view==='ledger'?'btn primary small':'btn small'} onClick={()=>setView('ledger')}><FileText size={15}/>Ledger</button></div></div>{view==='calendar'?<div className="program-months">{months.map(([month,items])=><div className="program-month" key={month}><h4>{month}</h4>{items.map(s=><SessionRow key={s.id} session={s} role={profile.role} onManage={()=>setSelectedSession(s)}/>)}</div>)}</div>:<div className="session-ledger">{sessions.map(s=><SessionRow key={s.id} session={s} role={profile.role} onManage={()=>setSelectedSession(s)}/>)}</div>}</section>
    <section className="panel"><div className="panel-head"><div><h3>Contract benefits & rules</h3><p className="panel-subtitle">These rules are enforced by the session workflow.</p></div></div><div className="program-benefits"><div><strong>{enrollment?.monthly_sessions}</strong><span>sessions per month</span></div><div><strong>{enrollment?.postponements_total}</strong><span>postponements included</span></div><div><strong>{enrollment?.ebook_total}</strong><span>free e-books</span></div><div><strong>₱</strong><span>upfront enrollment payment</span></div></div><ul className="program-rules"><li>Student absence consumes a session and does not create a make-up.</li><li>Teacher absence does not consume the session and automatically creates a make-up.</li><li>Holidays do not consume sessions.</li><li>Teacher confirmation is required before a lesson is considered completed.</li></ul></section>
    {selectedSession && <SessionEditor session={selectedSession} role={profile.role} postponementsRemaining={postponementsRemaining} close={()=>setSelectedSession(null)} saved={()=>{setSelectedSession(null);void loadProgram();void loadEnrollments()}}/>}
  </div>
}

function SessionRow({session,role,onManage}:{session:Session;role:string;onManage:()=>void}) { const date=session.scheduled_start?new Date(session.scheduled_start):null; return <div className="session-row program-session-row"><div className="session-number">{session.session_number}</div><div className="session-main"><strong>{session.makeup_for?`Make-up #${session.session_number}`:`Session ${session.session_number}`}</strong><span>{date?`${date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · ${date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`:'Needs scheduling'}{session.lesson_plan?` · ${session.lesson_plan}`:''}</span>{session.makeup_for&&<small>Replacement session</small>}</div><span className={statusClass(session.status)}>{statusLabel(session.status)}</span>{role==='teacher'&&<button className="btn small" onClick={onManage}>Manage</button>}</div> }

function SessionEditor({session,role,postponementsRemaining,close,saved}:{session:Session;role:string;postponementsRemaining:number;close:()=>void;saved:()=>void}) {
  const [status,setStatus]=useState(session.status),[lessonPlan,setLessonPlan]=useState(session.lesson_plan||''),[progress,setProgress]=useState(session.progress_notes||''),[homework,setHomework]=useState(session.homework||''),[changes,setChanges]=useState(session.change_notes||''),[date,setDate]=useState(session.scheduled_start?new Date(session.scheduled_start).toISOString().slice(0,10):''),[time,setTime]=useState(session.scheduled_start?new Date(session.scheduled_start).toTimeString().slice(0,5):'10:00'),[meetingUrl,setMeetingUrl]=useState(session.meeting_url||''),[provider,setProvider]=useState(session.meeting_provider||'teach_with_joy'),[saving,setSaving]=useState(false),[error,setError]=useState('')
  async function saveAttendance(){setError('');if(status==='postponed'&&postponementsRemaining<=0){setError('No postponement privileges remaining.');return}setSaving(true);const {error:e}=await supabase.rpc('record_session_attendance',{p_session_id:session.id,p_status:status,p_lesson_plan:lessonPlan||null,p_progress_notes:progress||null,p_homework:homework||null,p_change_notes:changes||null});if(e){setError(e.message);setSaving(false);return}await saveSchedule(false);setSaving(false);saved()}
  async function saveSchedule(showDone=true){if(role!=='teacher')return;const user=(await supabase.auth.getUser()).data.user;const payload:any={meeting_provider:provider,meeting_url:meetingUrl||null};if(date&&time){const start=new Date(`${date}T${time}`);if(Number.isNaN(start.getTime())){setError('Invalid date/time.');return}payload.scheduled_start=start.toISOString();payload.scheduled_end=new Date(start.getTime()+3600000).toISOString();if(session.status==='unassigned'&&status==='unassigned')payload.status='scheduled'}const {error:e}=await supabase.from('sessions').update(payload).eq('id',session.id).eq('teacher_id',user?.id);if(e)setError(e.message);else if(showDone)saved()}
  return <div className="modal-backdrop"><div className="auth-modal program-editor"><button className="icon-btn close" onClick={close}>×</button><div className="program-editor-title"><div className="session-number">{session.session_number}</div><div><span className="eyebrow">SESSION</span><h2>{session.makeup_for?'Make-up session':`Session ${session.session_number}`}</h2></div></div>{error&&<div className="form-error">{error}</div>}{role==='teacher'?<><label>Attendance / status<select value={status} onChange={e=>setStatus(e.target.value)}>{['scheduled','confirmed','in_progress','completed','student_absent','teacher_absent','student_cancelled','teacher_cancelled','postponed','holiday','technical_issue'].map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select></label>{status==='postponed'&&<div className="program-notice">Postponements remaining: <strong>{postponementsRemaining}</strong>. A replacement session will be created automatically.</div>}<div className="form-grid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Start time<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div><div className="form-grid"><label>Meeting provider<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="teach_with_joy">Teach With Joy</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="google_meet">Google Meet</option><option value="other">Other</option></select></label><label>Meeting URL<input value={meetingUrl} onChange={e=>setMeetingUrl(e.target.value)} placeholder="https://..."/></label></div><label>Lesson plan<input value={lessonPlan} onChange={e=>setLessonPlan(e.target.value)} placeholder="e.g. Pen lesson"/></label><label>Progress / remarks<textarea value={progress} onChange={e=>setProgress(e.target.value)} rows={3}/></label><label>Homework<textarea value={homework} onChange={e=>setHomework(e.target.value)} rows={2}/></label><label>Changes / unusual remarks<textarea value={changes} onChange={e=>setChanges(e.target.value)} rows={2}/></label><div className="modal-actions"><button className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving} onClick={saveAttendance}>{saving?'Saving...':'Save session'}</button></div></>:<><div className="program-detail-list"><div><span>Status</span><strong>{statusLabel(session.status)}</strong></div><div><span>Scheduled</span><strong>{session.scheduled_start?new Date(session.scheduled_start).toLocaleString():'Not scheduled'}</strong></div><div><span>Lesson plan</span><strong>{session.lesson_plan||'—'}</strong></div><div><span>Progress</span><strong>{session.progress_notes||'—'}</strong></div><div><span>Homework</span><strong>{session.homework||'—'}</strong></div><div><span>Remarks</span><strong>{session.change_notes||'—'}</strong></div></div>{session.meeting_url&&<a className="btn primary full" href={session.meeting_url} target="_blank" rel="noreferrer">Join class</a>}<button className="btn full" onClick={close}>Close</button></>}</div></div>
}
