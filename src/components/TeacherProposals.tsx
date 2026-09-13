import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, MessageSquare, Plus, Send, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Proposal = any

type Props = { profile: any }
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function TeacherProposals({ profile }: Props) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState({ startDate: new Date().toISOString().slice(0,10), endDate: '', day: '2', start: '18:00', end: '19:00', weeks: 12, provider: 'teach_with_joy', url: '', note: '' })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('enrollments').select('id,student_id,contract_type,start_date,end_date,profiles:student_id(full_name,email)').eq('teacher_id', profile.id).eq('status','active').order('start_date',{ascending:false}),
      supabase.from('teacher_proposals').select('*').eq('teacher_id', profile.id).order('created_at',{ascending:false}),
    ])
    setEnrollments(e || []); setProposals(p || [])
    setSelected(current => current || e?.[0]?.id || '')
  }
  useEffect(() => { void load() }, [profile.id])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('')
    if (!selected) { setMessage('Select an active enrollment.'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('create_teacher_proposal', { p_enrollment_id: selected, p_start_date: form.startDate, p_end_date: form.endDate || form.startDate, p_day_of_week: Number(form.day), p_start_time: form.start, p_end_time: form.end, p_recurrence_weeks: Number(form.weeks), p_meeting_provider: form.provider, p_meeting_url: form.url || null, p_note: form.note || null })
    setSaving(false)
    if (error) { setMessage(error.message); return }
    setMessage(`Proposal ${String(data).slice(0,8)} created and sent to the student.`)
    setForm(x => ({ ...x, note: '', url: '' }))
    void load()
  }

  const acceptCounter = async (id: string) => {
    const { error } = await supabase.rpc('teacher_accept_counter_proposal', { p_proposal_id: id })
    if (error) setMessage(error.message); else { setMessage('Counter proposal accepted.'); await load(); const p = proposals.find(x => x.id === id); if (p) await supabase.rpc('generate_recurring_series_sessions', { p_series_id: p.id }) }
  }

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">SCHEDULING WORKFLOW</span><h1>Lesson Proposals</h1><p>Propose a recurring weekly lesson, let the student accept or counter, then generate the schedule.</p></div></div>
    {message && <div className="form-error" style={{marginBottom:16}}>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'minmax(320px,1fr) minmax(320px,1.25fr)',gap:16,alignItems:'start'}}>
      <section className="panel"><div className="panel-head"><div><h3><Plus size={18}/> New proposal</h3><p className="panel-subtitle">Weekly lessons are generated from the accepted proposal.</p></div></div>
        <form className="stack" onSubmit={create}>
          <label>Student / enrollment<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select active enrollment</option>{enrollments.map(e=><option key={e.id} value={e.id}>{e.profiles?.full_name || e.profiles?.email} · {e.contract_type === 'three_month' ? '3-Month' : 'Monthly'}</option>)}</select></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Start date<input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label><label>End date<input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Day<select value={form.day} onChange={e=>setForm({...form,day:e.target.value})}>{days.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label><label>Weeks<input type="number" min="1" max="52" value={form.weeks} onChange={e=>setForm({...form,weeks:Number(e.target.value)})}/></label></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Start time<input type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>End time<input type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label></div>
          <label>Meeting provider<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}><option value="teach_with_joy">Teach With Joy</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="google_meet">Google Meet</option><option value="other">Other</option></select></label>
          <label>Meeting URL (optional)<input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..."/></label>
          <label>Message to student<textarea rows={3} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="I propose every Tuesday at 6 PM..."/></label>
          <button className="btn primary" disabled={saving || !selected}><Send size={15}/>{saving ? 'Sending...' : 'Send proposal'}</button>
        </form>
      </section>
      <section className="panel"><div className="panel-head"><div><h3><CalendarClock size={18}/> Sent proposals</h3><p className="panel-subtitle">Negotiation history stays separate from the session ledger.</p></div></div>
        {proposals.length ? <div className="stack">{proposals.map(p=><ProposalCard key={p.id} proposal={p} onAcceptCounter={()=>void acceptCounter(p.id)}/>)}</div> : <div className="empty-state"><CalendarClock size={30}/><h3>No proposals yet</h3><p>Create the first recurring lesson proposal for an active student.</p></div>}
      </section>
    </div>
  </div>
}

function ProposalCard({ proposal, onAcceptCounter }: { proposal: Proposal; onAcceptCounter: ()=>void }) {
  const status = proposal.status
  return <div style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:14,padding:16}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><strong>{days[proposal.day_of_week]} · {proposal.start_time?.slice(0,5)}–{proposal.end_time?.slice(0,5)}</strong><span className="program-status">{status}</span></div>
    <div style={{fontSize:13,opacity:.75,marginTop:6}}>{proposal.proposed_start_date} → {proposal.proposed_end_date} · weekly for {proposal.recurrence_weeks} weeks</div>
    {proposal.teacher_note && <p style={{margin:'10px 0 0'}}><MessageSquare size={14} style={{verticalAlign:'-2px'}}/> {proposal.teacher_note}</p>}
    {status === 'countered' && <button className="btn primary small" style={{marginTop:12}} onClick={onAcceptCounter}><CheckCircle2 size={14}/> Accept counter</button>}
    {status === 'accepted' && <div style={{marginTop:10,fontSize:13}}><CheckCircle2 size={14} style={{verticalAlign:'-2px'}}/> Accepted; recurring series created.</div>}
    {status === 'rejected' && <div style={{marginTop:10,fontSize:13}}><XCircle size={14} style={{verticalAlign:'-2px'}}/> Student rejected this proposal.</div>}
  </div>
}
