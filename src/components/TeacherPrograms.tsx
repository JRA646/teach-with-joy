import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Users, GraduationCap, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProgramWorkspace from './ProgramWorkspace'
import PreferredSchedulePanel from './PreferredSchedulePanel'

type Profile = any
type Enrollment = any

const contractDefaults = {
  monthly: { sessions: 20, postponements: 0, ebooks: 0 },
  three_month: { sessions: 60, postponements: 3, ebooks: 2 },
}

export default function TeacherPrograms({ profile }: { profile: Profile }) {
  const [students, setStudents] = useState<Profile[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')

  async function loadData() {
    setError('')
    const [{ data: studentData, error: studentError }, { data: enrollmentData, error: enrollmentError }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,role').eq('role', 'student').order('full_name'),
      supabase.from('enrollments').select('*').eq('teacher_id', profile.id).in('status', ['active', 'completed']).order('start_date', { ascending: false }),
    ])
    if (studentError) setError(studentError.message)
    if (enrollmentError) setError(enrollmentError.message)
    setStudents(studentData || [])
    setEnrollments(enrollmentData || [])
    setSelectedEnrollmentId(current => current && enrollmentData?.some(x => x.id === current) ? current : enrollmentData?.[0]?.id || '')
  }

  useEffect(() => { void loadData() }, [profile.id])

  const activeEnrollments = enrollments.filter(x => x.status === 'active')
  const selectedProgram = enrollments.find(x => x.id === selectedEnrollmentId)

  return <div className="page teacher-programs-page">
    <div className="page-title">
      <div><span className="eyebrow">TEACHER PROGRAMS</span><h1>Students & Programs</h1><p>Manage enrollments, preferred schedules, 20-session programs, attendance, make-ups, and progress.</p></div>
      <div className="program-toolbar"><button className="btn" onClick={() => { void loadData(); setRefreshKey(x => x + 1) }}><RefreshCw size={16}/> Refresh</button><button className="btn primary" onClick={() => { setError(''); setShowCreate(true) }}><Plus size={16}/> New enrollment</button></div>
    </div>
    {error && <div className="form-error">{error}</div>}

    <div className="program-stats stat-grid">
      <div className="stat-card"><div><strong>{students.length}</strong><small>Students</small></div></div>
      <div className="stat-card"><div><strong>{activeEnrollments.length}</strong><small>Active programs</small></div></div>
      <div className="stat-card"><div><strong>{enrollments.reduce((sum, x) => sum + Number(x.total_sessions || 0), 0)}</strong><small>Contracted sessions</small></div></div>
      <div className="stat-card"><div><strong>{enrollments.reduce((sum, x) => sum + Number(x.postponements_total || 0) - Number(x.postponements_used || 0), 0)}</strong><small>Postponements left</small></div></div>
    </div>

    <section className="panel teacher-student-list">
      <div className="panel-head"><div><h3><Users size={18}/> My students</h3><p className="panel-subtitle">Students are shown even before they have a program. Enroll them when they are ready.</p></div></div>
      {students.length ? <div className="teacher-student-grid">{students.map(student => {
        const program = enrollments.find(x => x.student_id === student.id && x.status === 'active')
        return <button key={student.id} className={`teacher-student-card ${program?.id === selectedEnrollmentId ? 'selected' : ''}`} onClick={() => program && setSelectedEnrollmentId(program.id)}>
          <div className="teacher-student-avatar"><GraduationCap size={18}/></div><div className="teacher-student-info"><strong>{student.full_name || student.email}</strong><span>{student.email}</span></div><span className={`program-status ${program ? 'success' : ''}`}>{program ? (program.contract_type === 'three_month' ? '3-Month' : 'Monthly') : 'No program'}</span>
        </button>
      })}</div> : <div className="empty-state"><Users size={30}/><h3>No students found</h3><p>Create student accounts first, then enroll them here.</p></div>}
    </section>

    {selectedProgram && <PreferredSchedulePanel enrollmentId={selectedProgram.id} onGenerated={() => setRefreshKey(x => x + 1)}/>} 

    <section className="panel">
      <div className="panel-head"><div><h3><CalendarDays size={18}/> Programs & session ledger</h3><p className="panel-subtitle">Select a program above to manage its schedule and attendance.</p></div></div>
      {enrollments.length ? <ProgramWorkspace key={`${refreshKey}-${selectedEnrollmentId}`} profile={profile} enrollmentId={selectedEnrollmentId}/> : <div className="empty-state"><GraduationCap size={30}/><h3>No program yet</h3><p>Select one of your students and use <strong>New enrollment</strong> to create the 20-session or 3-month program.</p><button className="btn primary" onClick={() => setShowCreate(true)}><Plus size={16}/> Create first enrollment</button></div>}
    </section>

    {showCreate && <CreateEnrollment students={students} teacherId={profile.id} close={() => setShowCreate(false)} done={() => { setShowCreate(false); void loadData(); setRefreshKey(x => x + 1) }}/>} 
  </div>
}

function CreateEnrollment({ students, teacherId, close, done }: { students: Profile[]; teacherId: string; close: () => void; done: () => void }) {
  const [student, setStudent] = useState(students[0]?.id || '')
  const [contract, setContract] = useState<'monthly' | 'three_month'>('monthly')
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const d = contractDefaults[contract]
  const end = new Date(`${start}T00:00:00`)
  end.setMonth(end.getMonth() + (contract === 'three_month' ? 3 : 1))
  end.setDate(end.getDate() - 1)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!student) { setError('Select a student.'); return }
    if (!start) { setError('Select a start date.'); return }
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid payment amount.'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('enrollments').insert({ student_id: student, teacher_id: teacherId, contract_type: contract, start_date: start, end_date: end.toISOString().slice(0, 10), monthly_sessions: 20, total_sessions: d.sessions, postponements_total: d.postponements, ebook_total: d.ebooks, payment_amount: amount, payment_status: 'pending', status: 'active', notes: notes || null, created_by: user.user?.id || teacherId })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    done()
  }

  return <div className="modal-backdrop"><div className="auth-modal"><button className="icon-btn close" onClick={close}>×</button><span className="eyebrow">NEW ENROLLMENT</span><h2>Enroll a student</h2><p>Choose the student and contract. The account will own the enrollment and its generated session ledger.</p>{error && <div className="form-error">{error}</div>}<form className="stack" onSubmit={submit}><label>Student<select value={student} onChange={e => setStudent(e.target.value)}>{students.length === 0 && <option value="">No students found</option>}{students.map(x => <option key={x.id} value={x.id}>{x.full_name || x.email}</option>)}</select></label><label>Contract<select value={contract} onChange={e => setContract(e.target.value as 'monthly' | 'three_month')}><option value="monthly">Monthly · 20 sessions</option><option value="three_month">3-Month · 60 sessions · 3 postponements · 2 e-books</option></select></label><label>Start date<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label><label>Upfront payment (₱)<input type="number" min="0" step="1" value={amount} onChange={e => setAmount(Number(e.target.value))}/></label><label>Notes<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}/></label><div className="program-notice">This creates <strong>{d.sessions} session records</strong> automatically. Student absence consumes a session; teacher absence and eligible postponements create make-up sessions.</div><div className="modal-actions"><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving || !students.length}>{saving ? 'Creating...' : 'Create enrollment'}</button></div></form></div></div>
}
