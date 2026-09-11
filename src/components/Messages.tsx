import { useEffect, useMemo, useState } from 'react'
import { Mail, MessageCircle, Search, Send, UserRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Messages({ profile }: any) {
  const [people, setPeople] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<any>(null)
  const selected = people.find(person => person.id === selectedId)

  function appendMessage(message: any) {
    setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
  }

  async function loadPeople() {
    // Only show people who are actually part of a conversation with the current user.
    // Do not expose every profile as a possible chat in the Messages screen.
    const { data: relatedMessages, error: messageError } = await supabase
      .from('messages')
      .select('sender_id,recipient_id,created_at')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    if (messageError) {
      setPeople([])
      return
    }

    const participantIds = Array.from(new Set((relatedMessages || []).map(message =>
      message.sender_id === profile.id ? message.recipient_id : message.sender_id
    ).filter(Boolean)))

    if (participantIds.length === 0) {
      setPeople([])
      setSelectedId('')
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,email,role,bio,avatar_url')
      .in('id', participantIds)
      .order('full_name')

    if (profileError) {
      setPeople([])
      return
    }

    setPeople(profiles || [])
    setSelectedId(current => {
      if (current && (profiles || []).some(person => person.id === current)) return current
      return profiles?.[0]?.id || ''
    })
  }

  async function loadMessages() {
    if (!selectedId) {
      setMessages([])
      return
    }

    // The conversation is strictly between the logged-in user and the selected participant.
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${profile.id})`)
      .order('created_at')

    setMessages(data || [])

    // Only mark messages addressed to the current user as read.
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', selectedId)
      .eq('recipient_id', profile.id)
      .is('read_at', null)
  }

  useEffect(() => { loadPeople() }, [profile.id])
  useEffect(() => { loadMessages() }, [selectedId, profile.id])

  useEffect(() => {
    const channel = supabase.channel(`messages:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${profile.id}` }, payload => {
        if (payload.new.sender_id === selectedId) appendMessage(payload.new)
        loadPeople()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${profile.id}` }, payload => {
        if (payload.new.recipient_id === selectedId) appendMessage(payload.new)
        loadPeople()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile.id, selectedId])

  async function send(e: any) {
    e.preventDefault()
    const text = body.trim()
    if (!text || !selectedId || sending) return

    setSending(true)
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: selectedId,
      body: text,
    })
    setSending(false)

    if (!error) {
      setBody('')
      await loadPeople()
    }
  }

  const filteredPeople = useMemo(() =>
    people.filter(person => `${person.full_name} ${person.email}`.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  )

  return <div className="page messages-page">
    <div className="page-title"><div><span className="eyebrow">MESSAGES</span><h1>Chat</h1><p>Only your existing conversations are shown.</p></div></div>
    <div className="messages-shell panel">
      <aside className="conversation-list">
        <div className="message-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." /></div>
        {filteredPeople.map(person => <button key={person.id} className={`conversation-person ${selectedId === person.id ? 'active' : ''}`} onClick={() => setSelectedId(person.id)}>
          {person.avatar_url ? <img className="user-avatar user-avatar-image" src={person.avatar_url} alt="" /> : <div className="user-avatar">{person.full_name?.[0] || 'U'}</div>}
          <div><strong>{person.full_name}</strong><small>{person.role}</small></div>
        </button>)}
        {filteredPeople.length === 0 && <div className="empty"><UserRound size={25} /><p>No conversations yet.</p></div>}
      </aside>
      <section className="chat-panel">
        {selected ? <>
          <div className="chat-head">
            {selected.avatar_url ? <img className="user-avatar user-avatar-image" src={selected.avatar_url} alt="" /> : <div className="user-avatar">{selected.full_name?.[0] || 'U'}</div>}
            <div><strong>{selected.full_name}</strong><small>{selected.role}</small></div>
            {profile.role === 'teacher' && selected.role === 'student' && <button className="btn secondary small profile-view-btn" type="button" onClick={() => setViewingProfile(selected)}><UserRound size={13} />View profile</button>}
            <span className="realtime-dot">● Live</span>
          </div>
          <div className="chat-messages">{messages.length === 0 ? <div className="empty"><MessageCircle size={28} /><strong>Start the conversation</strong><p>Messages appear instantly for both users.</p></div> : messages.map(message => <div key={message.id} className={`message-bubble ${message.sender_id === profile.id ? 'mine' : 'theirs'}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>)}</div>
          <form className="chat-compose" onSubmit={send}><input value={body} onChange={e => setBody(e.target.value)} maxLength={4000} placeholder={`Message ${selected.full_name}...`} /><button className="btn primary" disabled={!body.trim() || sending}><Send size={15} />{sending ? 'Sending...' : 'Send'}</button></form>
        </> : <div className="empty"><MessageCircle size={32} /><strong>No conversation selected</strong><p>Messages will appear here when another user sends you a message or you start a conversation.</p></div>}
      </section>
    </div>

    {viewingProfile && <div className="profile-view-backdrop" role="dialog" aria-modal="true" onClick={() => setViewingProfile(null)}>
      <section className="profile-view-modal" onClick={e => e.stopPropagation()}>
        <button className="icon-btn close" type="button" onClick={() => setViewingProfile(null)} aria-label="Close"><X size={17} /></button>
        <div className="profile-view-top">
          {viewingProfile.avatar_url ? <img className="profile-view-photo" src={viewingProfile.avatar_url} alt={`${viewingProfile.full_name} profile`} /> : <div className="profile-view-photo profile-view-placeholder"><UserRound size={40} /></div>}
          <div><span className="profile-role">Student</span><h2>{viewingProfile.full_name || 'Student'}</h2><p>{viewingProfile.email}</p></div>
        </div>
        <div className="profile-view-section"><span>About</span><p>{viewingProfile.bio?.trim() || 'This student has not added a bio yet.'}</p></div>
        <div className="profile-view-section"><span>Account</span><p><Mail size={14} />{viewingProfile.email}</p></div>
        <button className="btn primary full" type="button" onClick={() => setViewingProfile(null)}>Close</button>
      </section>
    </div>}
  </div>
}
