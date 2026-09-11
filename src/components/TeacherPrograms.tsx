import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProgramWorkspace from './ProgramWorkspace'

type Profile = any

const contractDefaults = {
  monthly: { sessions: 20, postponements: 0, ebooks: 0 },
  three_month: { sessions: 60, postponements: 3, ebooks: 2 },
}

export default function TeacherPrograms({ profile }: { profile: Profile }) {
  const [students, setStudents] = useState<Profile[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')

  async function loadStudents() {
    setError('')
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id,full_name,email,role')
      .eq('role', 'student')
      .order('full_name')
    if (e) setError(e.message)
    setStudents(data || [])
  }

  useEffect(() => { void loadStudents() }, [])

  return <div className="page">
    <div className="page-title">
      <div>
        <span className="eyebrow">TEACHER PROGRAMS</span>
        <h1>Students & Programs</h1>
        <p>Enroll your students, schedule their sessions, and manage attendance and progress.</p>
      </div>
      <div className="program-toolbar">
        <button className="btn" onClick={() => { void loadStudents(); setRefreshKey(x => x + 1) }}><RefreshCw size={16} /> Refresh</button>
        <button className="btn primary" onClick={() => { setError(''); setShowCreate(true) }}><Plus size={16} /> New enrollment</button>
      </div>
    </div>
    {error && <div className="form-error">{error}</div>}
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <div><h3><Users size={18} /> Teacher-owned enrollment</h3><p className="panel-subtitle">Only students enrolled under your teacher account are managed here.</p></div>
      </div>
      <ProgramWorkspace key={refreshKey} profile={profile} />
    </section>
    {showCreate && <CreateEnrollment students={students} teacherId={profile.id} close={() => setShowCreate(false)} done={() => { setShowCreate(false); setRefreshKey(x => x + 1) }} />}
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
    e.preventDefault()
    setError('')
    if (!student) { setError('Select a student.'); return }
    if (!start) { setError('Select a start date.'); return }
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid payment amount.'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('enrollments').insert({
      student_id: student,
      teacher_id: teacherId,
      contract_type: contract,
      start_date: start,
      end_date: end.toISOString().slice(0, 10),
      monthly_sessions: 20,
      total_sessions: d.sessions,
      postponements_total: d.postponements,
      ebook_total: d.ebooks,
      payment_amount: amount,
      payment_status: 'pending',
      status: 'active',
      notes: notes || null,
      created_by: user.user?.id || teacherId,
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    done()
  }

  return <div className="modal-backdrop">
    <div className="auth-modal">
      <button className="icon-btn close" onClick={close}>×</button>
      <span className="eyebrow">NEW ENROLLMENT</span>
      <h2>Enroll a student</h2>
      <p>Choose the student and contract. The teacher account will automatically own the enrollment and generated sessions.</p>
      {error && <div className="form-error">{error}</div>}
      <form className="stack" onSubmit={submit}>
        <label>Student<select value={student} onChange={e => setStudent(e.target.value)}>{students.length === 0 && <option value="">No students found</option>}{students.map(x => <option key={x.id} value={x.id}>{x.full_name || x.email}</option>)}</select></label>
        <label>Contract<select value={contract} onChange={e => setContract(e.target.value as 'monthly' | 'three_month')}><option value="monthly">Monthly · 20 sessions</option><option value="three_month">3-Month · 60 sessions · 3 postponements · 2 e-books</option></select></label>
        <label>Start date<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Upfront payment (₱)<input type="number" min="0" step="1" value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
        <label>Notes<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
        <div className="program-notice">This creates <strong>{d.sessions} session records</strong> automatically. You can schedule and manage them from Programs.</div>
        <div className="modal-actions"><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving || !students.length}>{saving ? 'Creating...' : 'Create enrollment'}</button></div>
      </form>
    </div>
  </div>
}
