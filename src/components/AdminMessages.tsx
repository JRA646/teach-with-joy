import { useEffect, useState } from 'react'
import { Check, Mail, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Message = { id:number; name:string; email:string; message:string; status:'new'|'read'|'replied'|'archived'; created_at:string }

export default function AdminMessages(){
  const [items,setItems]=useState<Message[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=async()=>{setLoading(true);const{data,error}=await supabase.from('contact_messages').select('*').order('created_at',{ascending:false});if(error)setError(error.message);else setItems((data||[]) as Message[]);setLoading(false)}
  useEffect(()=>{void load();const channel=supabase.channel('admin-contact-messages').on('postgres_changes',{event:'*',schema:'public',table:'contact_messages'},()=>void load()).subscribe();return()=>{supabase.removeChannel(channel)}},[])
  const update=async(id:number,status:Message['status'])=>{const{error}=await supabase.from('contact_messages').update({status}).eq('id',id);if(error)setError(error.message);else setItems(x=>x.map(m=>m.id===id?{...m,status}:m))}
  const archive=async(id:number)=>update(id,'archived')
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">INBOX</span><h3>Contact messages</h3><p>Messages submitted from the public Contact page appear here in real time.</p></div><button className="admin-btn secondary" onClick={load}><RefreshCw size={14}/> Refresh</button></div>{error&&<div className="admin-error">{error}</div>}{loading?<div className="admin-empty">Loading messages…</div>:items.length===0?<div className="admin-empty"><Mail size={22}/><strong>No contact messages yet.</strong><span>New messages from the website will appear here.</span></div>:<div className="admin-message-list">{items.map(m=><article className={'admin-message '+(m.status==='new'?'unread':'')} key={m.id}><div className="admin-message-head"><div><strong>{m.name}</strong><a href={`mailto:${m.email}`}>{m.email}</a></div><time>{new Date(m.created_at).toLocaleString()}</time></div><p>{m.message}</p><div className="admin-message-actions"><span className={'admin-status '+m.status}>{m.status}</span>{m.status==='new'&&<button className="admin-btn secondary" onClick={()=>update(m.id,'read')}><Check size={14}/> Mark read</button>}{m.status!=='archived'&&<button className="admin-btn secondary" onClick={()=>archive(m.id)}><Trash2 size={14}/> Archive</button>}</div></article>)}</div>}</section>
}
