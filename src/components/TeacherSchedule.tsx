import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function TeacherSchedule({ profile, openPage }: { profile: any; openPage?: (page: string) => void }) {
  const [availability, setAvailability] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [day, setDay] = useState(1)
  const [start, setStart] = useState('18:00')
  const [end, setEnd] = useState('19:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const [{ data: a, error: ae }, { data: s, error: se }] = await Promise.all([
      supabase.from('teacher_availability').select('*').eq('teacher_id', profile.id).eq('active', true).order('day_of_week').order('start_time'),
      supabase.from('sessions').select('*').eq('teacher_id', profile.id).not('scheduled_start', 'is', null).gte('scheduled_start', new Date().toISOString()).order('scheduled_start').limit(50),
    ])
    if (ae) setError(ae.message)
    if (se) setError(se.message)
    setAvailability(a || [])
    setSessions(s || [])
  }
  useEffect(() => { void load() }, [profile.id])

  const grouped = useMemo(() => {
    const map = new Map<number, any[]>()
    availability.forEach(a => map.set(a.day_of_week, [...(map.get(a.day_of_week) || []), a]))
    return map
  }, [availability])

  async function addAvailability() {
    setSaving(true); setError('')
    const { error: e } = await supabase.from('teacher_availability').insert({ teacher_id: profile.id, day_of_week: day, start_time: start, end_time: end, timezone: 'Asia/Manila', active: true })
    setSaving(false)
    if (e) { setError(e.message); return }
    await load()
  }

  async function removeAvailability(id: string) {
    setError('')
    const { error: e } = await supabase.from('teacher_availability').update({ active: false }).eq('id', id).eq('teacher_id', profile.id)
    if (e) setError(e.message); else await load()
  }

  return <div className="page">
    <div className="page-title">
      <div><span className="eyebrow">SCHEDULE</span><h1>Teacher schedule</h1><p>Set recurring teaching availability and review upcoming program sessions.</p></div>
      <div className="program-toolbar"><button className="btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button><button className="btn primary" onClick={() => openPage?.('programs')}><CalendarDays size={16}/> Manage programs</button></div>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="schedule-layout">
      <section className="panel">
        <div className="panel-head"><div><h3>Recurring availability</h3><p className="panel-subtitle">These hours are used when generating program schedules. Each teacher has their own working days.</p></div></div>
        <div className="teacher-availability-form">
          <label>Day<select value={day} onChange={e => setDay(Number(e.target.value))}>{days.map((x, i) => <option value={i} key={x}>{x}</option>)}</select></label>
          <label>Start<input type="time" value={start} onChange={e => setStart(e.target.value)}/></label>
          <label>End<input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label>
          <button className="btn primary" disabled={saving} onClick={() => void addAvailability()}><Plus size={16}/> Add</button>
        </div>
        <div className="availability-list">{availability.length ? availability.map(a => <div className="availability-row" key={a.id}><span className="availability-day">{days[a.day_of_week]}</span><strong>{String(a.start_time).slice(0,5)} – {String(a.end_time).slice(0,5)}</strong><span className="status success"><Check size={12}/> Available</span><button className="icon-btn danger-icon" title="Remove availability" onClick={() => void removeAvailability(a.id)}><Trash2 size={16}/></button></div>) : <div className="empty-state"><CalendarDays size={30}/><h3>No recurring availability yet</h3><p>Add the days and times when you can teach.</p></div>}</div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h3>Upcoming program sessions</h3><p className="panel-subtitle">These are generated from enrollments, preferences, availability and holidays.</p></div></div>
        {sessions.length ? <div className="upcoming-session-list">{sessions.map(s => <div className="upcoming-session-row" key={s.id}><div><strong>Session {s.session_number}</strong><small>{new Date(s.scheduled_start).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</small></div><span className="program-status">{s.status.replaceAll('_',' ')}</span></div>)}</div> : <div className="empty-state"><CalendarDays size={30}/><h3>No upcoming program sessions</h3><p>Create an enrollment and generate its schedule.</p></div>}
      </section>
    </div>
  </div>
}
