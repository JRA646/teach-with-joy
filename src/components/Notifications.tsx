import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Clock3, MessageCircle, CalendarDays, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Notifications({ profile, close }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` }, payload => {
        setItems(current => [payload.new, ...current].slice(0, 50))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` }, payload => {
        setItems(current => current.map(item => item.id === payload.new.id ? payload.new : item))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  const unread = items.filter(item => !item.read_at).length

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('recipient_id', profile.id)
    setItems(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  async function markAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', profile.id).is('read_at', null)
    setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
  }

  return <div className="modal-backdrop notification-backdrop" onClick={close}>
    <div className="notification-modal" onClick={e => e.stopPropagation()}>
      <div className="notification-head"><div><span className="eyebrow">ACTIVITY</span><h2>Notifications {unread > 0 && <span className="notification-count">{unread}</span>}</h2></div><button className="icon-btn" onClick={close}><X size={17} /></button></div>
      {unread > 0 && <button className="mark-all" onClick={markAll}><CheckCheck size={14} />Mark all as read</button>}
      <div className="notification-list">
        {loading ? <div className="empty">Loading notifications...</div> : items.length === 0 ? <EmptyNotifications /> : items.map(item => <button className={`notification-item ${item.read_at ? '' : 'unread'}`} key={item.id} onClick={() => markRead(item.id)}><div className="notification-icon">{item.type === 'message' ? <MessageCircle size={16} /> : item.type === 'booking' ? <CalendarDays size={16} /> : <Bell size={16} />}</div><div><strong>{item.title}</strong><p>{item.body}</p><small><Clock3 size={11} />{new Date(item.created_at).toLocaleString()}</small></div></button>)}
      </div>
    </div>
  </div>
}

function EmptyNotifications() { return <div className="empty"><div><Bell size={28} /></div><strong>You're all caught up</strong><p>New bookings and messages will appear here in real time.</p></div> }
