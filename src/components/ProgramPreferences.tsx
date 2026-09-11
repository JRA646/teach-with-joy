import { useEffect, useState } from 'react'
import { Clock3, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

const days = [
  ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'],
  ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday'],
]

export default function ProgramPreferences({ profile }: { profile: any }) {
  const [enrollmentId, setEnrollmentId] = useState('')
  const [rows, setRows] = useState([{ day: '1', start: '18:00', end: '19:00' }])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { void load() }, [profile.id])

  async function load() {
    setError(''); setMessage('')
    const { data: enrollments, error: e } = await supabase.from('enrollments').select('id').eq('student_id', profile.id).in('status', ['active', 'draft']).order('start_date', { ascending: false })
    if (e) { setError(e.message); return }
    const enrollment = enrollments?.[0]
    if (!enrollment) return
    setEnrollmentId(enrollment.id)
    const { data, error: pe } = await supabase.from('preferred_schedules').select('day_of_week,start_time,end_time').eq('enrollment_id', enrollment.id).order('priority').order('day_of_week')
    if (pe) { setError(pe.message); return }
    if (data?.length) setRows(data.slice(0, 3).map(x => ({ day: String(x.day_of_week), start: String(x.start_time).slice(0, 5), end: String(x.end_time).slice(0, 5) })))
  }

  function updateRow(index: number, key: 'day' | 'start' | 'end', value: string) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }

  async function save() {
    if (!enrollmentId) { setError('You need an active program before submitting preferred times.'); return }
    setError(''); setMessage(''); setSaving(true)
    await supabase.from('preferred_schedules').delete().eq('enrollment_id', enrollmentId)
    const payload = rows.filter(x => x.start && x.end).map((x, i) => ({ enrollment_id: enrollmentId, day_of_week: Number(x.day), start_time: x.start, end_time: x.end, priority: i + 1, status: 'requested' }))
    const { error: e } = payload.length ? await supabase.from('preferred_schedules').insert(payload) : { error: null as any }
    setSaving(false)
    if (e) { setError(e.message); return }
    setMessage('Preferred times saved. Your teacher can use these when scheduling the 20 sessions.')
    await load()
  }

  if (!enrollmentId) return null

  return <section className="panel program-preferences">
    <div className="panel-head"><div><span className="eyebrow">SCHEDULE PREFERENCE</span><h3>When do you prefer your classes?</h3><p className="panel-subtitle">These are preferences, not per-lesson bookings. Your teacher will use them to build your program schedule.</p></div></div>
    {error && <div className="form-error">{error}</div>}
    {message && <div className="program-notice">{message}</div>}
    <div className="program-preference-list">{rows.map((row, i) => <div className="program-preference-row" key={i}><Clock3 size={17}/><select value={row.day} onChange={e => updateRow(i, 'day', e.target.value)}>{days.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="time" value={row.start} onChange={e => updateRow(i, 'start', e.target.value)}/><span>to</span><input type="time" value={row.end} onChange={e => updateRow(i, 'end', e.target.value)}/></div>)}</div>
    {rows.length < 3 && <button className="btn small" onClick={() => setRows(current => [...current, { day: '1', start: '18:00', end: '19:00' }])}>+ Add another preference</button>}
    <div className="modal-actions"><button className="btn primary" disabled={saving} onClick={save}><Save size={16}/>{saving ? 'Saving...' : 'Save preferred times'}</button></div>
  </section>
}
