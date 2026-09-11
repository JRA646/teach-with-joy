import { useEffect, useMemo, useState } from 'react'
import { Mail, MessageCircle, Search, Send, UserRound, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Messages({ profile }: any) {
  const [people, setPeople] = useState<any[]>([])
  const [directory, setDirectory] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [searchingPeople, setSearchingPeople] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<any>(null)
  const selected = directory.find(person => person.id === selectedId) || people.find(person => person.id === selectedId)

  function appendMessage(message: any) {
    setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
  }

  async function loadPeople() {
    const { data: relatedMessages, error: messageError } = await supabase
      .from('messages')
      .select('sender_id,recipient_id,created_at')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    if (messageError) { setPeople([]); return }

    const participantIds = Array.from(new Set((relatedMessages || []).map(message => message.sender_id === profile.id ? message.recipient_id : message.sender_id).filter(Boolean)))
    if (participantIds.length === 0) { setPeople([]); return }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,email,role,bio,avatar_url')
      .in('id', participantIds)
      .order('full_name')

    if (profileError) { setPeople([]); return }
    setPeople(profiles || [])
  }

  async function searchPeople(value: string) {
    const term = value.trim()
    if (term.length < 2) { setDirectory([]); setSearchingPeople(false); return }
    setSearchingPeople(true)
    const safe = term.replace(/[%_]/g, '\\$&')
    const { data, error } = await supabase
      .from('profiles')
      .select('id,full_name,email,role,bio,avatar_url')
      .neq('id', profile.id)
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,role.ilike.%${safe}%`)
      .order('full_name')
      .limit(20)
    setDirectory(error ? [] : (data || []))
    setSearchingPeople(false)
  }

  async function loadMessages() {
    if (!selectedId) { setMessages([]); return }
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${profile.id})`)
      .order('created_at')
    setMessages(data || [])
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('sender_id', selectedId).eq('recipient_id', profile.id).is('read_at', null)
  }

  useEffect(() => { void loadPeople() }, [profile.id])
  useEffect(() => { void searchPeople(search) }, [search, profile.id])
  useEffect(() => { void loadMessages() }, [selectedId, profile.id])

  useEffect(() => {
    const channel = supabase.channel(`messages:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${profile.id}` }, payload => {
        if (payload.new.sender_id === selectedId) appendMessage(payload.new)
        void loadPeople()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${profile.id}` }, payload => {
        if (payload.new.recipient_id === selectedId) appendMessage(payload.new)
        void loadPeople()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id, selectedId])

  async function send(e: any) {
    e.preventDefault()
    const text = body.trim()
    if (!text || !selectedId || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({ sender_id: profile.id, recipient_id: selectedId, body: text })
    setSending(false)
    if (!error) { setBody(''); setSearch(''); setDirectory([]); await loadPeople(); await loadMessages() }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredPeople = useMemo(() => !normalizedSearch ? people : people.filter(person => `${person.full_name} ${person.email} ${person.role}`.toLowerCase().includes(normalizedSearch)), [people, normalizedSearch])

  return <div className="page messages-page">
    <div className="page-title"><div><span className="eyebrow">MESSAGES</span><h1>Chat</h1><p>Search any teacher, student, or admin to start a private conversation.</p></div></div>
    <div className="messages-shell panel">
      <aside className="conversation-list">
        <div className="message-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or conversations..." /></div>
        {normalizedSearch && <div className="message-section-label">PEOPLE</div>}
        {normalizedSearch && (searchingPeople ? <div className="empty compact">Searching...</div> : directory.map(person => <button key={`directory-${person.id}`} className={`conversation-person directory-person ${selectedId === person.id ? 'active' : ''}`} onClick={() => setSelectedId(person.id)}>{person.avatar_url ? <img className="user-avatar user-avatar-image" src={person.avatar_url} alt="" /> : <div className="user-avatar">{person.full_name?.[0] || 'U'}</div>}<div><strong>{person.full_name}</strong><small>{person.role} · {person.email}</small></div><UserPlus size={14} /></button>))}
        {!normalizedSearch && <div className="message-section-label">CONVERSATIONS</div>}
        {filteredPeople.map(person => <button key={person.id} className={`conversation-person ${selectedId === person.id ? 'active' : ''}`} onClick={() => setSelectedId(person.id)}>{person.avatar_url ? <img className="user-avatar user-avatar-image" src={person.avatar_url} alt="" /> : <div className="user-avatar">{person.full_name?.[0] || 'U'}</div>}<div><strong>{person.full_name}</strong><small>{person.role}</small></div></button>)}
        {normalizedSearch && directory.length === 0 && filteredPeople.length === 0 && !searchingPeople && <div className="empty compact"><UserRound size={25}/><p>No people found.</p></div>}
        {!normalizedSearch && filteredPeople.length === 0 && <div className="empty"><UserRound size={25} /><p>No conversations yet. Search a person above to start one.</p></div>}
      </aside>
      <section className="chat-panel">
        {selected ? <>
          <div className="chat-head">
            {selected.avatar_url ? <img className="user-avatar user-avatar-image" src={selected.avatar_url} alt="" /> : <div className="user-avatar">{selected.full_name?.[0] || 'U'}</div>}
            <div><strong>{selected.full_name}</strong><small>{selected.role}</small></div>
            <div className="chat-head-actions">
              <button className="btn secondary small" type="button" onClick={() => setViewingProfile(selected)}><UserRound size={13} /> View profile</button>
              <span className="realtime-dot">● Live</span>
            </div>
          </div>
          <div className="chat-messages">{messages.length === 0 ? <div className="empty"><MessageCircle size={28} /><strong>Start the conversation</strong><p>This is a private conversation. Your first message will create the thread.</p></div> : messages.map(message => <div key={message.id} className={`message-bubble ${message.sender_id === profile.id ? 'mine' : 'theirs'}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>)}</div>
          <form className="chat-compose" onSubmit={send}><input value={body} onChange={e => setBody(e.target.value)} maxLength={4000} placeholder={`Message ${selected.full_name}...`} /><button className="btn primary" disabled={!body.trim() || sending}><Send size={15} />{sending ? 'Sending...' : 'Send'}</button></form>
        </> : <div className="empty"><MessageCircle size={32} /><strong>No conversation selected</strong><p>Search for a person on the left to start a private conversation.</p></div>}
      </section>
    </div>

    {viewingProfile && <div className="profile-view-backdrop" role="dialog" aria-modal="true" onClick={() => setViewingProfile(null)}><section className="profile-view-modal" onClick={e => e.stopPropagation()}><button className="icon-btn close" type="button" onClick={() => setViewingProfile(null)} aria-label="Close"><X size={17} /></button><div className="profile-view-top">{viewingProfile.avatar_url ? <img className="profile-view-photo" src={viewingProfile.avatar_url} alt={`${viewingProfile.full_name} profile`} /> : <div className="profile-view-photo profile-view-placeholder"><UserRound size={40} /></div>}<div><span className="profile-role">{viewingProfile.role}</span><h2>{viewingProfile.full_name || 'User'}</h2><p>{viewingProfile.email}</p></div></div><div className="profile-view-section"><span>About</span><p>{viewingProfile.bio?.trim() || 'No bio added yet.'}</p></div><div className="profile-view-section"><span>Account</span><p><Mail size={14} />{viewingProfile.email}</p></div><button className="btn primary full" type="button" onClick={() => setViewingProfile(null)}>Close</button></section></div>}
  </div>
}
