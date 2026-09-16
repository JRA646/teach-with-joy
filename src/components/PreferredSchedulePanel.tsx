import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, Check, Clock3, Plus, Save, Trash2 } from 'lucide-react'
import '../program-preferences.css'
import { supabase } from '../lib/supabase'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
type Status = 'requested' | 'approved' | 'rejected'
type Row = { id?: string; day_of_week: number; start_time: string; end_time: string; priority: number; status: Status; notes?: string }
const newRow = (priority: number): Row => ({ day_of_week: 1, start_time: '18:00', end_time: '19:00', priority, status: 'requested' })
function timeMinutes(value: string) { const [h, m] = value.split(':').map(Number); return h * 60 + m }
function formatTime(value: string) { const [h, m] = value.split(':').map(Number); const date = new Date(2000, 0, 1, h, m); return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }

export default function PreferredSchedulePanel({ enrollmentId, onGenerated }: { enrollmentId: string; onGenerated?: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setError(''); setMessage('')
    const { data, error: e } = await supabase.from('preferred_schedules').select('*').eq('enrollment_id', enrollmentId).order('priority').order('day_of_week').order('start_time')
    if (e) { setError(e.message); setLoaded(true); return }
    setRows((data || []).map(x => ({ ...x, start_time: String(x.start_time).slice(0, 5), end_time: String(x.end_time).slice(0, 5) })))
    setLoaded(true)
  }
  useEffect(() => { setLoaded(false); void load() }, [enrollmentId])

  const approvedCount = useMemo(() => rows.filter(x => x.status === 'approved').length, [rows])
  const requestedCount = useMemo(() => rows.filter(x => x.status === 'requested').length, [rows])
  function patch(index: number, value: Partial<Row>) { setError(''); setMessage(''); setRows(current => current.map((row, i) => i === index ? { ...row, ...value } : row)) }
  function addRow() { if (rows.length >= 7) return setError('You can add up to 7 preferred time windows.'); setError(''); setRows(current => [...current, newRow(current.length + 1)]) }
  function remove(index: number) { setError(''); setMessage(''); setRows(current => current.filter((_, i) => i !== index).map((row, i) => ({ ...row, priority: i + 1 }))) }
  function validate() { for (const [index, row] of rows.entries()) { if (timeMinutes(row.end_time) <= timeMinutes(row.start_time)) { setError(`Preference ${index + 1}: end time must be later than start time.`); return false } } return true }

  async function save() {
    if (!validate()) return
    setSaving(true); setError(''); setMessage('')
    const { error: deleteError } = await supabase.from('preferred_schedules').delete().eq('enrollment_id', enrollmentId)
    if (deleteError) { setError(deleteError.message); setSaving(false); return }
    if (rows.length) {
      const { error: insertError } = await supabase.from('preferred_schedules').insert(rows.map((row, index) => ({ enrollment_id: enrollmentId, day_of_week: row.day_of_week, start_time: row.start_time, end_time: row.end_time, priority: index + 1, status: row.status, notes: row.notes || null })))
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }
    setSaving(false); setMessage('Preferred schedule saved successfully.'); await load()
  }

  async function generate() {
    if (!validate()) return
    if (!approvedCount) return setError('Approve at least one preferred time before generating the contract schedule.')
    setGenerating(true); setError(''); setMessage('')
    const { data, error: e } = await supabase.rpc('generate_enrollment_session_schedule', { p_enrollment_id: enrollmentId })
    setGenerating(false)
    if (e) return setError(e.message)
    setMessage(`Schedule generator assigned ${Number(data?.scheduled || 0)} session(s).`); onGenerated?.()
  }

  return <section className="panel preferred-schedule-panel">
    <div className="preferred-schedule-header"><div className="preferred-schedule-title"><div className="preferred-schedule-icon"><CalendarDays size={18}/></div><div><h3>Preferred schedule</h3><p className="panel-subtitle">Choose the student's available time windows. Approve the ones you want the scheduler to use.</p></div></div><button className="btn small" onClick={addRow} disabled={saving || generating || rows.length >= 7}><Plus size={14}/> Add preference</button></div>
    {loaded && rows.length > 0 && <div className="preferred-schedule-summary"><span><strong>{rows.length}</strong> preference{rows.length === 1 ? '' : 's'}</span><span className="preferred-summary-approved"><Check size={13}/> {approvedCount} approved</span>{requestedCount > 0 && <span>{requestedCount} awaiting approval</span>}</div>}
    {error && <div className="form-error preferred-schedule-feedback"><AlertCircle size={15}/><span>{error}</span></div>}{message && <div className="form-success compact preferred-schedule-feedback"><Check size={15}/><span>{message}</span></div>}
    {rows.length ? <div className="preferred-schedule-table"><div className="preferred-schedule-table-head"><span>Day</span><span>Start time</span><span>End time</span><span>Status</span><span>Actions</span></div>{rows.map((row, index) => <div className="preferred-schedule-row" key={row.id || index}><div className="preferred-field preferred-day-field"><Clock3 size={14}/><select aria-label={`Preference ${index + 1} day`} value={row.day_of_week} onChange={e => patch(index, { day_of_week: Number(e.target.value) })}>{dayNames.map((name, day) => <option key={name} value={day}>{name}</option>)}</select></div><label className="preferred-time-field"><span className="mobile-field-label">Start</span><input aria-label={`Preference ${index + 1} start time`} type="time" value={row.start_time} onChange={e => patch(index, { start_time: e.target.value })}/><small>{formatTime(row.start_time)}</small></label><label className="preferred-time-field"><span className="mobile-field-label">End</span><input aria-label={`Preference ${index + 1} end time`} type="time" value={row.end_time} onChange={e => patch(index, { end_time: e.target.value })}/><small>{formatTime(row.end_time)}</small></label><label className={`preferred-status-field status-${row.status}`}><span className="mobile-field-label">Status</span><select aria-label={`Preference ${index + 1} status`} value={row.status} onChange={e => patch(index, { status: e.target.value as Status })}><option value="approved">Approved</option><option value="requested">Requested</option><option value="rejected">Rejected</option></select></label><div className="preferred-row-actions"><span className="preferred-duration">{timeMinutes(row.end_time) > timeMinutes(row.start_time) ? `${Math.round((timeMinutes(row.end_time) - timeMinutes(row.start_time)) / 60 * 10) / 10}h` : 'Invalid time'}</span><button className="icon-btn danger-icon" onClick={() => remove(index)} disabled={saving || generating} title="Remove preference" aria-label={`Remove preference ${index + 1}`}><Trash2 size={15}/></button></div></div>)}</div> : <div className="empty-state preferred-empty"><div className="preferred-empty-icon"><CalendarDays size={24}/></div><h3>No preferred times</h3><p>Add at least one day and time window before generating the contract schedule.</p><button className="btn" onClick={addRow}><Plus size={14}/> Add first preference</button></div>}
    <div className="preferred-schedule-footer"><div className="preferred-schedule-help"><strong>{approvedCount ? 'Ready for scheduling' : 'Approval needed'}</strong><span>{approvedCount ? `${approvedCount} approved window${approvedCount === 1 ? '' : 's'} available to the scheduler.` : 'Approve at least one time window to generate sessions.'}</span></div><div className="preferred-schedule-actions"><button className="btn" disabled={saving || generating} onClick={() => void save()}><Save size={14}/>{saving ? 'Saving...' : 'Save preferences'}</button><button className="btn primary" disabled={generating || saving || approvedCount === 0} onClick={() => void generate()}><CalendarDays size={14}/>{generating ? 'Generating...' : 'Generate contract schedule'}</button></div></div>
  </section>
}
