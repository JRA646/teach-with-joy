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
  const [notice, setNotice] = useState('')

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
    setSaving(true); setError(''); setNotice('')
    if (!start || !end || start >= end) {
      setError('End time must be later than start time.')
      setSaving(false)
      return
    }

    const overlap = availability.some(a => a.day_of_week === day && String(a.start_time).slice(0, 5) === start && String(a.end_time).slice(0, 5) === end)
    if (overlap) {
      setError('This recurring availability already exists.')
      setSaving(false)
      return
    }

    const { error: e } = await supabase.from('teacher_availability').insert({ teacher_id: profile.id, day_of_week: day, start_time: start, end_time: end, timezone: 'Asia/Manila', active: true })
    setSaving(false)
    if (e) { setError(e.message); return }
    setNotice(`${days[day]} ${formatTime(start)}–${formatTime(end)} is now available.`)
    await load()
  }

  async function removeAvailability(id: string) {
    setError(''); setNotice('')
    const { error: e } = await supabase.from('teacher_availability').update({ active: false }).eq('id', id).eq('teacher_id', profile.id)
    if (e) setError(e.message); else { setNotice('Recurring availability removed.'); await load() }
  }

  const sessionDays = useMemo(() => {
    const groups = new Map<string, any[]>()
    sessions.forEach(session => {
      const key = new Date(session.scheduled_start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      groups.set(key, [...(groups.get(key) || []), session])
    })
    return [...groups.entries()].slice(0, 10)
  }, [sessions])

  return <div className="page">
    <div className="page-title">
      <div><span className="eyebrow">SCHEDULE</span><h1>Teacher schedule</h1><p>Set recurring teaching availability and review upcoming program sessions.</p></div>
      <div className="program-toolbar"><button className="btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button><button className="btn primary" onClick={() => openPage?.('programs')}><CalendarDays size={16}/> Manage programs</button></div>
    </div>
    {error && <div className="form-error">{error}</div>}
    {notice && <div className="form-success compact">{notice}</div>}
    <div className="schedule-layout">
      <section className="panel">
        <div className="panel-head"><div><h3>Recurring availability</h3><p className="panel-subtitle">Set the days and hours when you can teach. These settings are used by the program schedule generator.</p></div></div>
        <div className="teacher-availability-form">
          <label>Day<select value={day} onChange={e => setDay(Number(e.target.value))}>{days.map((x, i) => <option value={i} key={x}>{x}</option>)}</select></label>
          <label>Start<input type="time" value={start} onChange={e => setStart(e.target.value)}/></label>
          <label>End<input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label>
          <button className="btn primary" disabled={saving} onClick={() => void addAvailability()}><Plus size={16}/> {saving ? 'Adding…' : 'Add'}</button>
        </div>
        <div className="availability-list">{availability.length ? availability.map(a => <div className="availability-row" key={a.id}><span className="availability-day">{days[a.day_of_week]}</span><strong>{formatTime(String(a.start_time).slice(0,5))} – {formatTime(String(a.end_time).slice(0,5))}</strong><span className="status success"><Check size={12}/> Available</span><button className="icon-btn danger-icon" title="Remove availability" onClick={() => void removeAvailability(a.id)}><Trash2 size={16}/></button></div>) : <div className="empty-state"><CalendarDays size={30}/><h3>No recurring availability yet</h3><p>Add the days and times when you can teach.</p></div>}</div>
        {availability.length > 0 && <div className="schedule-tip">Tip: set every day/time block you can reliably teach. Students' preferred times are matched against these windows.</div>}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h3>Upcoming program sessions</h3><p className="panel-subtitle">Generated sessions already assigned to your teaching calendar.</p></div></div>
        {sessionDays.length ? <div className="upcoming-session-list">{sessionDays.map(([label, daySessions]) => <div className="session-day-group" key={label}><strong className="session-day-label">{label}</strong>{daySessions.map((s: any) => <div className="upcoming-session-row" key={s.id}><div><strong>Session {s.session_number}</strong><small>{new Date(s.scheduled_start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</small></div><span className={`program-status ${s.status === 'completed' ? 'success' : s.status.includes('absent') ? 'warning' : 'info'}`}>{s.status.replaceAll('_',' ')}</span></div>)}</div>)}</div> : <div className="empty-state"><CalendarDays size={30}/><h3>No upcoming program sessions</h3><p>Create an enrollment, approve preferences, then generate its schedule.</p><button className="btn primary" onClick={() => openPage?.('programs')}>Open Students & Programs</button></div>}
      </section>
    </div>
  </div>
}

function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const date = new Date(2000, 0, 1, hour, minute)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
