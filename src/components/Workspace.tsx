import { useEffect, useState } from 'react'
import {
  Bell, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  GraduationCap, LayoutDashboard, LogOut, MessageCircle, Plus, RefreshCw, Trash2, UserRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Notifications from './Notifications'
import Messages from './Messages'

export default function Workspace({ profile }: any) {
  const [page, setPage] = useState('dashboard')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [realtimeVersion, setRealtimeVersion] = useState(0)
  const nav = profile.role === 'teacher'
    ? [['dashboard', 'Dashboard'], ['schedule', 'Schedule'], ['bookings', 'My Bookings'], ['messages', 'Messages'], ['subjects', 'Subjects'], ['profile', 'Profile']]
    : [['dashboard', 'Dashboard'], ['schedule', 'Schedule'], ['bookings', 'My Bookings'], ['messages', 'Messages'], ['profile', 'Profile']]

  useEffect(() => {
    let active = true
    async function loadUnread() {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', profile.id).is('read_at', null)
      if (active) setUnread(count || 0)
    }
    loadUnread()
    const channel = supabase.channel(`workspace-realtime:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` }, () => { loadUnread(); setRealtimeVersion(v => v + 1) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${profile.id}` }, () => setRealtimeVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${profile.id}` }, () => setRealtimeVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => setRealtimeVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => setRealtimeVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => setRealtimeVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => setRealtimeVersion(v => v + 1))
      .subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [profile.id])

  return <div className="app-shell"><header className="app-header"><Brand /><div className="top-user"><button className="notification-button" title="Notifications" onClick={() => setNotificationsOpen(true)}><Bell size={18} />{unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}</button><div className="user-avatar">{profile.full_name?.[0] || 'U'}</div><div><strong>{profile.full_name}</strong><small>{profile.role}</small></div></div></header><div className="app-body"><aside className="sidebar">{nav.map(([id, label]) => <button key={id} onClick={() => setPage(id)} className={page === id ? 'nav-item active' : 'nav-item'}>{id === 'dashboard' ? <LayoutDashboard /> : id === 'schedule' ? <CalendarDays /> : id === 'bookings' ? <CheckCircle2 /> : id === 'messages' ? <MessageCircle /> : id === 'subjects' ? <BookOpen /> : <UserRound />}{label}</button>)}<button className="nav-item bottom" onClick={() => supabase.auth.signOut()}><LogOut />Log Out</button></aside><main className="main-content">{page === 'dashboard' && <Dashboard key={realtimeVersion} profile={profile} go={() => setPage('schedule')} />}{page === 'schedule' && <Schedule key={realtimeVersion} profile={profile} />}{page === 'bookings' && <Bookings key={realtimeVersion} profile={profile} />}{page === 'messages' && <Messages profile={profile} />}{page === 'subjects' && <Subjects key={realtimeVersion} />}{page === 'profile' && <Profile profile={profile} />}</main></div>{notificationsOpen && <Notifications profile={profile} close={() => setNotificationsOpen(false)} />}</div>
}

function Dashboard({ profile, go }: any) {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { load() }, [])
  async function load() { const f = profile.role === 'teacher' ? 'teacher_id' : 'student_id'; const { data } = await supabase.from('bookings').select('*,subject:subjects(*)').eq(f, profile.id).order('starts_at'); setItems(data || []) }
  const next = items.find(x => new Date(x.starts_at) > new Date() && x.status !== 'cancelled')
  return <div className="page"><div className="page-title"><div><span className="eyebrow">{profile.role.toUpperCase()} DASHBOARD</span><h1>Welcome back, {profile.full_name.split(' ')[0]}! 👋</h1><p>Here’s what’s happening with your learning.</p></div><button className="btn primary" onClick={go}>{profile.role === 'student' ? 'Book a Session' : 'Manage Schedule'}</button></div><div className="stat-grid"><Stat label="Upcoming Sessions" value={next ? '1' : '0'} icon={<CalendarDays />} /><Stat label="Completed Sessions" value={String(items.filter(x => x.status === 'completed').length)} icon={<CheckCircle2 />} /><Stat label="Total Sessions" value={String(items.length)} icon={<BookOpen />} /><Stat label="Progress" value={items.length ? '85%' : '0%'} icon="✦" /></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h3>Upcoming Session</h3></div>{next ? <BookingCard booking={next} /> : <Empty text={profile.role === 'student' ? 'Pick a time from the schedule to get started.' : 'Create available slots for students to book.'} />}</section><section className="panel"><div className="panel-head"><h3>Recent Bookings</h3></div>{items.slice(0, 5).map(x => <BookingRow key={x.id} booking={x} />)}</section></div></div>
}

function Schedule({ profile }: any) {
  const [date, setDate] = useState(new Date())
  const [slots, setSlots] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [add, setAdd] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { load() }, [date.toDateString()])
  async function load() {
    setError('')
    const { data: sub, error: subjectError } = await supabase.from('subjects').select('*').eq('is_active', true).order('name')
    if (subjectError) setError(subjectError.message)
    setSubjects(sub || [])
    const a = new Date(date); a.setHours(0, 0, 0, 0)
    const b = new Date(a); b.setDate(b.getDate() + 1)
    let q = supabase.from('availability_slots').select('*,subject:subjects(*)').gte('starts_at', a.toISOString()).lt('starts_at', b.toISOString()).order('starts_at')
    if (profile.role === 'teacher') q = q.eq('teacher_id', profile.id); else q = q.eq('status', 'available')
    const { data, error: slotError } = await q
    if (slotError) setError(slotError.message)
    setSlots(data || [])
  }
  async function bookSelected() {
    if (!selected) return
    setError('')
    const { error: bookingError } = await supabase.rpc('book_slot', { p_slot_id: selected.id })
    if (bookingError) { setError(bookingError.message); await load(); return }
    setSelected(null); await load()
  }
  async function deleteSlot(slot: any) {
    if (slot.status === 'booked') { setError('Booked slots cannot be deleted. Cancel the booking first.'); return }
    if (!window.confirm('Delete this availability slot?')) return
    const { error: deleteError } = await supabase.from('availability_slots').delete().eq('id', slot.id).eq('teacher_id', profile.id)
    if (deleteError) { setError(deleteError.message); return }
    setSelected(null); await load()
  }
  const days = Array.from({ length: 35 }, (_, i) => { const d = new Date(date.getFullYear(), date.getMonth(), 1); d.setDate(i - d.getDay() + 1); return d })
  return <div className="page"><div className="page-title"><div><span className="eyebrow">SCHEDULE</span><h1>{profile.role === 'teacher' ? 'Manage your schedule' : 'Schedule a Session'}</h1><p>Choose a date and time that works for you.</p></div>{profile.role === 'teacher' && <button className="btn primary" onClick={() => { setError(''); setAdd(true) }}><Plus />Add availability</button>}</div>{error && <div className="form-error">{error}</div>}<div className="schedule-layout"><section className="panel"><div className="month-head"><button className="icon-btn" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ChevronLeft /></button><strong>{date.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong><button className="icon-btn" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ChevronRight /></button></div><div className="weekday-row">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(x => <span key={x}>{x}</span>)}</div><div className="calendar-grid">{days.map((d, i) => <button key={i} className={(d.toDateString() === date.toDateString() ? 'selected ' : '') + (d.getMonth() !== date.getMonth() ? 'muted' : '')} onClick={() => setDate(d)}>{d.getDate()}</button>)}</div></section><section className="panel day-panel"><div className="day-title"><small>{date.toLocaleString('en-US', { weekday: 'long' })}</small><h3>{date.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3></div><div className="slot-list">{['09:00', '10:00', '13:00', '14:00', '16:00', '17:00'].map(t => { const s = slots.find(x => { const d = new Date(x.starts_at); return d.getHours() === Number(t.slice(0, 2)) }); const available = !!s && s.status === 'available'; return <button key={t} disabled={!available} className={available ? 'time-slot active' : 'time-slot'} onClick={() => available && setSelected(s)}>{new Date('2000-01-01T' + t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}<small>{available ? s.subject?.name : s?.status === 'booked' ? 'Booked' : 'Unavailable'}</small></button> })}</div></section><section className="panel"><h3>Session Details</h3>{selected ? <div className="slot-details"><div className="subject-pill">{selected.subject?.name}</div><p>{new Date(selected.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><p>{new Date(selected.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(selected.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p><div className="price-row"><span>Price</span><strong>₱{Number(selected.price).toLocaleString()}</strong></div>{profile.role === 'student' && <button className="btn primary full" onClick={bookSelected}>Continue to booking</button>}{profile.role === 'teacher' && <button className="btn danger full" onClick={() => deleteSlot(selected)}><Trash2 />Delete availability</button>}</div> : <Empty text="Choose an available slot to see details." />}</section></div>{add && <AddSlot subjects={subjects} teacherId={profile.id} close={() => setAdd(false)} done={() => { setAdd(false); load() }} />}</div>
}

function AddSlot({ subjects, teacherId, close, done }: any) {
  const [subject, setSubject] = useState(subjects[0]?.id || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [price, setPrice] = useState(500)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: any) {
    e.preventDefault(); setError('')
    if (!subject) { setError('Please create or select a subject first.'); return }
    if (!date || !time) { setError('Please choose a date and start time.'); return }
    if (!Number.isFinite(price) || price < 0) { setError('Please enter a valid price.'); return }
    const s = new Date(`${date}T${time}`); const en = new Date(s.getTime() + 3600000)
    if (Number.isNaN(s.getTime())) { setError('The selected date or time is invalid.'); return }
    if (s <= new Date()) { setError('Please choose a future date and time.'); return }
    setSaving(true)
    const { data: existing, error: existingError } = await supabase.from('availability_slots').select('id').eq('teacher_id', teacherId).eq('starts_at', s.toISOString()).neq('status', 'cancelled').maybeSingle()
    if (existingError) { setError(existingError.message); setSaving(false); return }
    if (existing) { setError('You already have an availability slot at this time.'); setSaving(false); return }
    const { error: insertError } = await supabase.from('availability_slots').insert({ teacher_id: teacherId, subject_id: subject, starts_at: s.toISOString(), ends_at: en.toISOString(), price, status: 'available' })
    setSaving(false); if (insertError) { setError(insertError.message); return }; done()
  }
  return <div className="modal-backdrop"><div className="auth-modal"><button className="icon-btn close" onClick={close}>×</button><h2>Add availability</h2>{error && <div className="form-error">{error}</div>}<form className="stack" onSubmit={submit}><label>Subject<select value={subject} onChange={e => setSubject(e.target.value)}>{subjects.length === 0 && <option value="">No active subjects</option>}{subjects.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Date<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} /></label><label>Start time<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label><label>Price<input type="number" min="0" step="1" value={price} onChange={e => setPrice(Number(e.target.value))} /></label><button className="btn primary full" disabled={saving || !subject}>{saving ? 'Creating slot...' : 'Create Slot'}</button></form></div></div>
}

function Bookings({ profile }: any) {
  const [items, setItems] = useState<any[]>([])
  const [reschedule, setReschedule] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => { load() }, [])
  async function load() { const f = profile.role === 'teacher' ? 'teacher_id' : 'student_id'; const { data, error: loadError } = await supabase.from('bookings').select('*,subject:subjects(*)').eq(f, profile.id).order('starts_at', { ascending: false }); if (loadError) setError(loadError.message); setItems(data || []) }
  async function cancel(booking: any) {
    if (booking.status === 'cancelled') return
    const reason = window.prompt('Optional cancellation reason:')
    if (reason === null) return
    setError('')
    const { error: cancelError } = await supabase.rpc('cancel_booking', { p_booking_id: booking.id, p_reason: reason })
    if (cancelError) { setError(cancelError.message); return }
    await load()
  }
  return <div className="page"><div className="page-title"><div><span className="eyebrow">BOOKINGS</span><h1>My Bookings</h1><p>{items.length} total sessions.</p></div></div>{error && <div className="form-error">{error}</div>}<section className="panel list-panel">{items.length ? items.map(x => <BookingCard key={x.id} booking={x} profile={profile} onCancel={cancel} onReschedule={() => setReschedule(x)} />) : <Empty text="Your booked sessions will appear here." />}</section>{reschedule && <RescheduleModal booking={reschedule} teacherId={profile.id} close={() => setReschedule(null)} done={async () => { setReschedule(null); await load() }} />}</div>
}

function RescheduleModal({ booking, teacherId, close, done }: any) {
  const [slots, setSlots] = useState<any[]>([])
  const [slotId, setSlotId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { load() }, [teacherId])
  async function load() {
    const { data, error: loadError } = await supabase.from('availability_slots').select('*,subject:subjects(*)').eq('teacher_id', teacherId).eq('status', 'available').gt('starts_at', new Date().toISOString()).order('starts_at')
    if (loadError) setError(loadError.message)
    setSlots(data || []); setLoading(false)
  }
  async function submit(e: any) {
    e.preventDefault(); if (!slotId) return
    setSaving(true); setError('')
    const { error: rpcError } = await supabase.rpc('reschedule_booking', { p_booking_id: booking.id, p_new_slot_id: slotId })
    setSaving(false)
    if (rpcError) { setError(rpcError.message); await load(); return }
    await done()
  }
  return <div className="modal-backdrop"><div className="auth-modal"><button className="icon-btn close" onClick={close}>×</button><h2>Reschedule session</h2><p>Choose a new available time for {booking.subject?.name || 'this session'}.</p>{error && <div className="form-error">{error}</div>}{loading ? <div className="empty">Loading available times...</div> : slots.length === 0 ? <div className="empty"><strong>No available times</strong><p>Create a new availability slot first.</p></div> : <form className="stack" onSubmit={submit}><label>New schedule<select value={slotId} onChange={e => setSlotId(e.target.value)}><option value="">Select a time</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{new Date(slot.starts_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · {slot.subject?.name || 'Lesson'}</option>)}</select></label><button className="btn primary full" disabled={!slotId || saving}><RefreshCw size={15} />{saving ? 'Rescheduling...' : 'Confirm reschedule'}</button></form>}</div></div>
}

function Subjects() {
  const [items, setItems] = useState<any[]>([]); const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  async function load() { const { data, error: loadError } = await supabase.from('subjects').select('*').order('name'); if (loadError) setError(loadError.message); setItems(data || []) }
  useEffect(() => { load() }, [])
  async function add(e: any) { e.preventDefault(); setError(''); if (!name.trim()) { setError('Subject name is required.'); return }; setSaving(true); const { error: insertError } = await supabase.from('subjects').insert({ name: name.trim(), description: desc.trim(), is_active: true }); setSaving(false); if (insertError) { setError(insertError.message); return }; setName(''); setDesc(''); await load() }
  async function remove(subject: any) { if (!window.confirm(`Remove “${subject.name}” from the active subject list?`)) return; setError(''); const { error: deleteError } = await supabase.from('subjects').update({ is_active: false }).eq('id', subject.id); if (deleteError) { setError(deleteError.message); return }; await load() }
  return <div className="page"><div className="page-title"><div><span className="eyebrow">TEACHER TOOLS</span><h1>Subjects</h1><p>Manage the subjects students can book.</p></div></div>{error && <div className="form-error">{error}</div>}<div className="subject-layout"><section className="panel"><h3>Create a subject</h3><form className="stack" onSubmit={add}><label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="IELTS Speaking" /></label><label>Description<textarea value={desc} onChange={e => setDesc(e.target.value)} /></label><button className="btn primary" disabled={saving}><Plus />{saving ? 'Adding...' : 'Add subject'}</button></form></section><section className="panel">{items.filter(x => x.is_active).map(x => <div className="subject-row" key={x.id}><div className="subject-icon"><BookOpen /></div><div><strong>{x.name}</strong><small>{x.description || 'No description yet'}</small></div><span className="status success">Active</span><button className="icon-btn danger-icon" title="Remove subject" onClick={() => remove(x)}><Trash2 size={17} /></button></div>)}{items.filter(x => x.is_active).length === 0 && <Empty text="Create your first subject to make availability slots bookable." />}</section></div></div>
}

function Profile({ profile }: any) {
  const [name, setName] = useState(profile.full_name); const [bio, setBio] = useState(profile.bio || '')
  useEffect(() => { setName(profile.full_name); setBio(profile.bio || '') }, [profile.id, profile.full_name, profile.bio])
  return <div className="page"><div className="page-title"><div><span className="eyebrow">PROFILE</span><h1>Your profile</h1></div></div><section className="panel profile-card"><div className="profile-main"><div className="big-avatar">{profile.full_name[0]}</div><div><h2>{profile.full_name}</h2><p>{profile.email} · {profile.role}</p></div></div><div className="profile-form"><label>Full name<input value={name} onChange={e => setName(e.target.value)} /></label><label>Bio<textarea value={bio} onChange={e => setBio(e.target.value)} /></label><button className="btn primary" onClick={async () => { await supabase.from('profiles').update({ full_name: name, bio }).eq('id', profile.id) }}>Save profile</button></div></section></div>
}

function BookingCard({ booking, profile, onCancel, onReschedule }: any) {
  const cancelled = booking.status === 'cancelled'
  return <div className={`booking-card ${cancelled ? 'booking-cancelled' : ''}`}><div className="date-box"><strong>{new Date(booking.starts_at).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</strong><b>{new Date(booking.starts_at).getDate()}</b></div><div className="booking-copy"><strong>{booking.subject?.name || 'Lesson'}</strong><span><CalendarDays />{new Date(booking.starts_at).toLocaleDateString()}</span><span><Clock3 />{new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · 60 min</span>{booking.cancelled_at && <small>Cancelled {new Date(booking.cancelled_at).toLocaleString()}</small>}</div><div className="booking-actions"><span className={`status ${cancelled ? 'danger' : 'success'}`}>{booking.status}</span>{!cancelled && new Date(booking.starts_at) > new Date() && <>{profile?.role === 'teacher' && <button className="btn secondary small" onClick={onReschedule}><RefreshCw size={13} />Reschedule</button>}<button className="btn danger small" onClick={() => onCancel(booking)}><Trash2 size={13} />Cancel</button></>}</div></div>
}
function BookingRow({ booking }: any) { return <div className="booking-row"><BookOpen /><div><strong>{booking.subject?.name || 'Lesson'}</strong><small>{new Date(booking.starts_at).toLocaleDateString()} · {new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></div><span className={`status ${booking.status === 'cancelled' ? 'danger' : 'success'}`}>{booking.status}</span></div> }
function Stat({ label, value, icon }: any) { return <div className="stat"><div>{icon}</div><small>{label}</small><strong>{value}</strong></div> }
function Empty({ text }: any) { return <div className="empty"><div><CalendarDays size={28} /></div><strong>No sessions yet</strong><p>{text}</p></div> }
function Brand() { return <div className="brand"><div className="brand-icon"><GraduationCap size={20} /></div><strong>TeachWithJoy</strong></div> }
