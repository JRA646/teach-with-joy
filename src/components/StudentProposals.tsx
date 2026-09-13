import { useEffect, useState } from 'react'
import { CalendarClock, Check, MessageSquare, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function StudentProposals({ profile }: { profile: any }) {
  const [proposals, setProposals] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [counter, setCounter] = useState<Record<string,{day:string;start:string;end:string;note:string}>>({})
  const [openCounter, setOpenCounter] = useState('')

  const load = async () => {
    const { data } = await supabase.from('teacher_proposals').select('*').eq('student_id', profile.id).in('status',['pending','countered']).order('created_at',{ascending:false})
    setProposals(data || [])
  }
  useEffect(() => { void load() }, [profile.id])

  const respond = async (id: string, action: 'accepted'|'rejected'|'countered') => {
    setMessage('')
    const c = counter[id] || { day:'2', start:'18:00', end:'19:00', note:'' }
    const { data, error } = await supabase.rpc('respond_to_teacher_proposal', { p_proposal_id:id, p_action:action, p_day_of_week:Number(c.day), p_start_time:c.start, p_end_time:c.end, p_note:c.note || null })
    if (error) { setMessage(error.message); return }
    if (action === 'accepted' && data) {
      const { error: genError } = await supabase.rpc('generate_recurring_series_sessions', { p_series_id:data })
      if (genError) { setMessage(genError.message); return }
    }
    setMessage(action === 'accepted' ? 'Lesson proposal accepted and sessions scheduled.' : action === 'countered' ? 'Counter proposal sent to your teacher.' : 'Proposal rejected.')
    setOpenCounter('')
    await load()
  }

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">SCHEDULING</span><h1>Lesson Proposals</h1><p>Review your teacher's recurring schedule proposals and accept, reject, or suggest another time.</p></div></div>
    {message && <div className="form-error" style={{marginBottom:16}}>{message}</div>}
    <section className="panel"><div className="panel-head"><div><h3><CalendarClock size={18}/> Proposals awaiting your response</h3><p className="panel-subtitle">Accepted proposals generate the next weekly sessions in your active program.</p></div></div>
      {proposals.length ? <div className="stack">{proposals.map(p => <article key={p.id} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:14,padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><strong>{days[p.day_of_week]} · {p.start_time?.slice(0,5)}–{p.end_time?.slice(0,5)}</strong><div style={{fontSize:13,opacity:.75,marginTop:5}}>{p.proposed_start_date} → {p.proposed_end_date} · {p.recurrence_weeks} weekly lessons</div></div><span className="program-status">{p.status}</span></div>
        {p.teacher_note && <p style={{margin:'12px 0 0'}}><MessageSquare size={14} style={{verticalAlign:'-2px'}}/> {p.teacher_note}</p>}
        {p.status === 'countered' && <div style={{marginTop:12,padding:12,borderRadius:10,background:'var(--surface-muted,#f7f7f8)',fontSize:13}}>Your counter proposal is waiting for the teacher.</div>}
        {p.status === 'pending' && <>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button className="btn primary small" onClick={()=>void respond(p.id,'accepted')}><Check size={14}/> Accept</button><button className="btn small" onClick={()=>void respond(p.id,'rejected')}><X size={14}/> Reject</button><button className="btn small" onClick={()=>{setOpenCounter(openCounter===p.id?'':p.id);setCounter(x=>({...x,[p.id]:x[p.id]||{day:String(p.day_of_week),start:p.start_time?.slice(0,5),end:p.end_time?.slice(0,5),note:''}}))}}><Send size={14}/> Counter proposal</button></div>
          {openCounter === p.id && <div style={{marginTop:14,display:'grid',gap:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}><label>Day<select value={counter[p.id]?.day || String(p.day_of_week)} onChange={e=>setCounter(x=>({...x,[p.id]:{...x[p.id],day:e.target.value}}))}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label>Start<input type="time" value={counter[p.id]?.start || p.start_time?.slice(0,5)} onChange={e=>setCounter(x=>({...x,[p.id]:{...x[p.id],start:e.target.value}}))}/></label><label>End<input type="time" value={counter[p.id]?.end || p.end_time?.slice(0,5)} onChange={e=>setCounter(x=>({...x,[p.id]:{...x[p.id],end:e.target.value}}))}/></label></div><label>Message<textarea rows={2} value={counter[p.id]?.note || ''} onChange={e=>setCounter(x=>({...x,[p.id]:{...x[p.id],note:e.target.value}}))} placeholder="Could we do Wednesday at 7 PM instead?"/></label><button className="btn primary small" onClick={()=>void respond(p.id,'countered')}><Send size={14}/> Send counter proposal</button></div>}
        </>}
      </article>)}</div> : <div className="empty-state"><CalendarClock size={30}/><h3>No lesson proposals</h3><p>When your teacher proposes a recurring schedule, it will appear here.</p></div>}
    </section>
  </div>
}
