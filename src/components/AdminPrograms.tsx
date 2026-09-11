import { useEffect, useState } from 'react'
import { CalendarDays, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Profile = any
const contractDefaults = { monthly: { sessions: 20, postponements: 0, ebooks: 0 }, three_month: { sessions: 60, postponements: 3, ebooks: 2 } }

export default function AdminPrograms() {
  const [students, setStudents] = useState<Profile[]>([])
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const [p, e] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,role').in('role', ['student','teacher']).order('full_name'),
      supabase.from('enrollments').select('*').order('created_at', { ascending: false })
    ])
    if (p.error) setError(p.error.message); if (e.error) setError(e.error.message)
    setStudents((p.data || []).filter(x => x.role === 'student')); setTeachers((p.data || []).filter(x => x.role === 'teacher')); setEnrollments(e.data || [])
  }
  async function loadSessions(id: string) { const { data, error: e } = await supabase.from('sessions').select('*').eq('enrollment_id', id).order('session_number'); if (e) setError(e.message); setSessions(data || []) }
  useEffect(() => { void load() }, [])

  async function saveSession(s: any, date: string, time: string) {
    if (!date || !time) return
    const start = new Date(`${date}T${time}`)
    const { error: e } = await supabase.from('sessions').update({ scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime()+3600000).toISOString(), status: s.status === 'unassigned' ? 'scheduled' : s.status }).eq('id', s.id)
    if (e) setError(e.message); else void loadSessions(selected.id)
  }

  return <div className="admin-programs"><div className="admin-program-header"><div><span className="admin-kicker">PROGRAM MANAGEMENT</span><h1>Enrollments & session ledger</h1><p>Create contracts, review generated sessions, and schedule classes.</p></div><div><button className="admin-btn" onClick={() => { void load(); if (selected) void loadSessions(selected.id) }}><RefreshCw size={16}/> Refresh</button> <button className="admin-btn primary" onClick={() => setShowCreate(true)}><Plus size={16}/> New enrollment</button></div></div>
    {error && <div className="admin-error">{error}</div>}
    <div className="admin-program-layout"><section className="admin-card"><h3>Enrollments</h3><div className="admin-program-list">{enrollments.map(e => { const student=students.find(x=>x.id===e.student_id), teacher=teachers.find(x=>x.id===e.teacher_id); return <button key={e.id} className={selected?.id===e.id?'admin-program-item active':'admin-program-item'} onClick={()=>{setSelected(e);void loadSessions(e.id)}}><strong>{student?.full_name || 'Student'}</strong><span>{teacher?.full_name || 'Unassigned'} · {e.contract_type==='three_month'?'3-Month':'Monthly'}</span><small>{e.start_date} → {e.end_date} · {e.payment_status}</small></button> })}{!enrollments.length&&<p>No enrollments yet.</p>}</div></section>
      <section className="admin-card">{selected ? <><div className="admin-program-detail-head"><div><h3>{students.find(x=>x.id===selected.student_id)?.full_name || 'Student program'}</h3><p>{teachers.find(x=>x.id===selected.teacher_id)?.full_name || 'Teacher not assigned'} · {selected.total_sessions} sessions</p></div><span className="admin-pill">{selected.status}</span></div><div className="admin-program-stats"><div><strong>{sessions.filter(s=>s.counts_as_session).length}</strong><span>Consumed</span></div><div><strong>{sessions.filter(s=>s.status==='completed'&&s.counts_as_session).length}</strong><span>Completed</span></div><div><strong>{Math.max(selected.total_sessions-sessions.filter(s=>s.counts_as_session).length,0)}</strong><span>Remaining</span></div><div><strong>{Math.max(selected.postponements_total-selected.postponements_used,0)}</strong><span>Postponements</span></div></div><div className="admin-session-table"><div className="admin-session-head"><span>#</span><span>Date</span><span>Status</span><span>Lesson plan</span><span>Action</span></div>{sessions.map(s=><AdminSessionRow key={s.id} session={s} onSave={saveSession}/>)}</div></>:<div className="admin-empty"><CalendarDays size={32}/><h3>Select an enrollment</h3><p>Review the full session ledger and schedule dates here.</p></div>}</section></div>
    {showCreate&&<CreateEnrollment students={students} teachers={teachers} close={()=>setShowCreate(false)} done={()=>{setShowCreate(false);void load()}}/>}
  </div>
}

function AdminSessionRow({session,onSave}:{session:any;onSave:(s:any,d:string,t:string)=>void}) { const [date,setDate]=useState(session.scheduled_start?new Date(session.scheduled_start).toISOString().slice(0,10):''); const [time,setTime]=useState(session.scheduled_start?new Date(session.scheduled_start).toTimeString().slice(0,5):'10:00'); return <div className="admin-session-row"><span>{session.session_number}{session.makeup_for?' ↻':''}</span><span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></span><span className="admin-pill">{session.status.replaceAll('_',' ')}</span><span>{session.lesson_plan||'—'}</span><button className="admin-btn" onClick={()=>onSave(session,date,time)}>Save</button></div> }

function CreateEnrollment({students,teachers,close,done}:{students:Profile[];teachers:Profile[];close:()=>void;done:()=>void}) { const [student,setStudent]=useState(students[0]?.id||''); const [teacher,setTeacher]=useState(teachers[0]?.id||''); const [contract,setContract]=useState<'monthly'|'three_month'>('monthly'); const [start,setStart]=useState(new Date().toISOString().slice(0,10)); const [amount,setAmount]=useState(0); const [notes,setNotes]=useState(''); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const d=contractDefaults[contract]; const end=new Date(`${start}T00:00:00`); end.setMonth(end.getMonth()+(contract==='three_month'?3:1)); end.setDate(end.getDate()-1)
  async function submit(e:any){e.preventDefault();setError('');if(!student){setError('Select a student.');return}setSaving(true);const {data:user}=await supabase.auth.getUser();const {error:e2}=await supabase.from('enrollments').insert({student_id:student,teacher_id:teacher||null,contract_type:contract,start_date:start,end_date:end.toISOString().slice(0,10),monthly_sessions:20,total_sessions:d.sessions,postponements_total:d.postponements,ebook_total:d.ebooks,payment_amount:amount,payment_status:'pending',status:'active',notes:notes||null,created_by:user.user?.id});if(e2)setError(e2.message);else done();setSaving(false)}
  return <div className="modal-backdrop"><div className="auth-modal"><button className="icon-btn close" onClick={close}>×</button><span className="eyebrow">NEW ENROLLMENT</span><h2>Create student program</h2>{error&&<div className="form-error">{error}</div>}<form className="stack" onSubmit={submit}><label>Student<select value={student} onChange={e=>setStudent(e.target.value)}>{students.map(x=><option key={x.id} value={x.id}>{x.full_name||x.email}</option>)}</select></label><label>Teacher<select value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">Unassigned</option>{teachers.map(x=><option key={x.id} value={x.id}>{x.full_name||x.email}</option>)}</select></label><label>Contract<select value={contract} onChange={e=>setContract(e.target.value as any)}><option value="monthly">Monthly · 20 sessions</option><option value="three_month">3-Month · 60 sessions · 3 postponements · 2 e-books</option></select></label><label>Start date<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Upfront payment<input type="number" min="0" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><div className="program-notice">This creates <strong>{d.sessions} session records</strong> automatically.</div><div className="modal-actions"><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving?'Creating...':'Create enrollment'}</button></div></form></div></div>
}
