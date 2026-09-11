import { useEffect, useState } from 'react'
import { BookOpen, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TeacherSubjects() {
  const [items, setItems] = useState<any[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const { data, error: e } = await supabase.from('subjects').select('*').order('name')
    if (e) setError(e.message)
    setItems(data || [])
  }
  useEffect(() => { void load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!name.trim()) { setError('Subject name is required.'); return }
    setSaving(true)
    const { error: insertError } = await supabase.from('subjects').insert({ name: name.trim(), description: description.trim() || null, is_active: true })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setName(''); setDescription(''); await load()
  }

  async function remove(id: string) {
    if (!window.confirm('Deactivate this subject? Existing records will remain intact.')) return
    const { error: e } = await supabase.from('subjects').update({ is_active: false }).eq('id', id)
    if (e) setError(e.message); else await load()
  }

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">TEACHER TOOLS</span><h1>Subjects</h1><p>Manage the subjects that can be used in lessons and program sessions.</p></div><button className="btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button></div>
    {error && <div className="form-error">{error}</div>}
    <div className="subject-layout">
      <section className="panel"><div className="panel-head"><h3>Create a subject</h3></div><form className="stack" onSubmit={add}><label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Business English"/></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Short description"/></label><button className="btn primary" disabled={saving}><Plus size={16}/>{saving ? 'Adding...' : 'Add subject'}</button></form></section>
      <section className="panel"><div className="panel-head"><h3>Active subjects</h3></div>{items.filter(x => x.is_active).map(x => <div className="subject-row" key={x.id}><div className="subject-icon"><BookOpen size={17}/></div><div><strong>{x.name}</strong><small>{x.description || 'No description yet'}</small></div><span className="status success">Active</span><button className="icon-btn danger-icon" title="Deactivate" onClick={() => void remove(x.id)}><Trash2 size={16}/></button></div>)}{items.filter(x => x.is_active).length === 0 && <div className="empty-state"><BookOpen size={30}/><h3>No active subjects</h3><p>Create the first subject for your lessons.</p></div>}</section>
    </div>
  </div>
}
