import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
type Row = { id?: string; day_of_week: number; start_time: string; end_time: string; priority: number; status: 'requested' | 'approved' | 'rejected'; notes?: string }

export default function PreferredSchedulePanel({ enrollmentId, onGenerated }: { enrollmentId: string; onGenerated?: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError(''); setMessage('')
    const { data, error: e } = await supabase.from('preferred_schedules').select('*').eq('enrollment_id', enrollmentId).order('priority').order('day_of_week').order('start_time')
    if (e) setError(e.message)
    setRows((data || []).map(x => ({ ...x, start_time: String(x.start_time).slice(0,5), end_time: String(x.end_time).slice(0,5) })))
  }
  useEffect(() => { void load() }, [enrollmentId])

  function addRow() {
    setRows(current => [...current, { day_of_week: 1, start_time: '18:00', end_time: '19:00', priority: current.length + 1, status: 'approved' }])
  }
  function patch(index: number, patch: Partial<Row>) { setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)) }
  async function save() {
    setSaving(true); setError(''); setMessage('')
    const { error: deleteError } = await supabase.from('preferred_schedules').delete().eq('enrollment_id', enrollmentId)
    if (deleteError) { setError(deleteError.message); setSaving(false); return }
    if (rows.length) {
      const { error: insertError } = await supabase.from('preferred_schedules').insert(rows.map((r, i) => ({ enrollment_id: enrollmentId, day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, priority: i + 1, status: r.status, notes: r.notes || null })))
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }
    setSaving(false); setMessage('Preferred schedule saved.')
    await load()
  }
  async function remove(index: number) { setRows(current => current.filter((_, i) => i !== index)) }
  async function generate() {
    setGenerating(true); setError(''); setMessage('')
    const { data, error: e } = await supabase.rpc('generate_enrollment_session_schedule', { p_enrollment_id: enrollmentId })
    setGenerating(false)
    if (e) { setError(e.message); return }
    setMessage(`Schedule generator assigned ${Number(data?.scheduled || 0)} session(s).`)
    onGenerated?.()
  }

  return <section className="panel preferred-schedule-panel">
    <div className="panel-head"><div><h3>Preferred schedule</h3><p className="panel-subtitle">Approve the student's preferred time windows, then generate the contract schedule.</p></div><button className="btn small" onClick={addRow}><Plus size={14}/> Add preference</button></div>
    {rows.length ? <div className="preferred-schedule-table">{rows.map((r,i) => <div className="preferred-schedule-row" key={r.id || i}><select value={r.day_of_week} onChange={e => patch(i,{day_of_week:Number(e.target.value)})}>{dayNames.map((x,d)=><option key={x} value={d}>{x}</option>)}</select><input type="time" value={r.start_time} onChange={e=>patch(i,{start_time:e.target.value})}/><input type="time" value={r.end_time} onChange={e=>patch(i,{end_time:e.target.value})}/><select value={r.status} onChange={e=>patch(i,{status:e.target.value as Row['status']})}><option value="approved">Approved</option><option value="requested">Requested</option><option value="rejected">Rejected</option></select><button className="icon-btn danger-icon" onClick={()=>void remove(i)} title="Remove preference"><Trash2 size={15}/></button></div>)}</div> : <div className="empty-state preferred-empty"><Plus size={28}/><h3>No preferred times</h3><p>Add the days/times the student prefers.</p></div>}
    <div className="preferred-schedule-actions"><button className="btn" disabled={saving} onClick={() => void save()}><Save size={14}/> {saving ? 'Saving...' : 'Save preferences'}</button><button className="btn primary" disabled={generating || !rows.some(x=>x.status==='approved')} onClick={() => void generate()}>{generating ? 'Generating...' : 'Generate contract schedule'}</button></div>
    {error && <div className="form-error">{error}</div>}{message && <div className="form-success compact">{message}</div>}
  </section>
}
