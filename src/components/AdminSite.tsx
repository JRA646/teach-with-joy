import { useEffect, useState } from 'react'
import { GraduationCap, Palette, LogOut, LayoutDashboard, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminEditor from './AdminEditor'
import AdminTheme from './AdminTheme'
import AdminMessages from './AdminMessages'
import './admin-enhancements.css'

type Page = 'home' | 'about' | 'schedule' | 'pricing' | 'contact'
type Section = Page | 'overview' | 'theme' | 'messages'
const labels: Record<Section, string> = { overview: 'Overview', home: 'Home', about: 'About', schedule: 'Scheduling', pricing: 'Pricing', contact: 'Contact', theme: 'Color Theme', messages: 'Messages' }
const editablePages: Page[] = ['home', 'about', 'schedule', 'pricing', 'contact']

const defaultTheme = {
  site_name: 'TeachWithJoy', footer_text: '', copyright_text: '',
  primary_color: '#ff7f32', primary_dark: '#e7651c', accent_color: '#ffe28a',
  background_color: '#fff4e8', surface_color: '#ffffff', text_color: '#3a2418', muted_color: '#8a6f5a'
}

export default function AdminSite() {
  const [session, setSession] = useState<any>(null)
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Section>('overview')
  const [content, setContent] = useState<Record<string, any>>({})
  const [theme, setTheme] = useState<any>(defaultTheme)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadTheme() {
    const { data, error } = await supabase.from('site_theme').select('*').eq('id', 1).maybeSingle()
    if (!error && data) setTheme({ ...defaultTheme, ...data })
  }

  async function checkAdmin() {
    const { data, error } = await supabase.rpc('is_admin')
    return { authorized: !error && data === true, error: error?.message || '' }
  }

  async function load() {
    const [c, t] = await Promise.all([
      supabase.from('site_content').select('page,content'),
      supabase.from('site_theme').select('*').eq('id', 1).maybeSingle()
    ])
    if (c.error) { setError(c.error.message); return }
    const next: Record<string, any> = {}
    ;(c.data || []).forEach((row: any) => { next[row.page] = row.content || {} })
    setContent(next)
    if (t.error) setError(t.error.message)
    setTheme({ ...defaultTheme, ...(t.data || {}) })
  }

  async function initialize() {
    setError('')
    await loadTheme()
    const { data, error } = await supabase.auth.getSession()
    if (error) { setError(error.message); setLoading(false); return }
    const current = data.session
    setSession(current)
    if (!current) { setAuthorized(false); setLoading(false); return }
    const admin = await checkAdmin()
    if (admin.error) { setError(admin.error); setAuthorized(false); setLoading(false); return }
    if (!admin.authorized) { setError('This account is not authorized to access the admin area.'); setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    await load()
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    void initialize()
    const { data } = supabase.auth.onAuthStateChange(async () => { if (mounted) await initialize() })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const f = new FormData(event.currentTarget)
    const email = String(f.get('email') || '').trim()
    const password = String(f.get('password') || '')
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error || !result.data.user) { setError(result.error?.message || 'Unable to sign in.'); return }
    const admin = await checkAdmin()
    if (admin.error) { setError(admin.error); await supabase.auth.signOut(); return }
    if (!admin.authorized) { await supabase.auth.signOut(); setError('This account is not authorized to access the admin area.'); return }
    setSession(result.data.session); setAuthorized(true); setLoading(false); await load()
  }

  async function save() {
    setError(''); setSuccess('')
    const isTheme = page === 'theme'
    const payload = isTheme
      ? { ...theme, id: 1, updated_by: session?.user?.id }
      : { page, content: content[page] || {}, updated_by: session?.user?.id, updated_at: new Date().toISOString() }
    const result = await supabase.from(isTheme ? 'site_theme' : 'site_content').upsert(payload, { onConflict: isTheme ? 'id' : 'page' })
    if (result.error) { setError(result.error.message); return }
    setSuccess('Saved successfully.')
    await load()
    window.setTimeout(() => setSuccess(''), 2500)
  }

  async function signOut() { await supabase.auth.signOut(); window.location.href = '/' }

  if (loading) return <div className="admin-loader">Loading {theme.site_name || 'TeachWithJoy'} Admin...</div>
  if (!session || !authorized) return <Login error={error} submit={login} theme={theme} />

  const themeVars = {
    '--admin-primary': theme.primary_color || defaultTheme.primary_color,
    '--admin-primary-dark': theme.primary_dark || defaultTheme.primary_dark,
    '--admin-accent': theme.accent_color || defaultTheme.accent_color,
    '--admin-background': theme.background_color || defaultTheme.background_color,
    '--admin-surface': theme.surface_color || defaultTheme.surface_color,
    '--admin-text': theme.text_color || defaultTheme.text_color,
    '--admin-muted': theme.muted_color || defaultTheme.muted_color,
  } as React.CSSProperties

  return <div className="admin-shell" style={themeVars}>
    <aside className="admin-sidebar">
      <div className="admin-brand"><span><GraduationCap size={19} /></span><b>{theme.site_name || 'TeachWithJoy'}</b></div>
      <Nav active={page === 'overview'} onClick={() => setPage('overview')}><LayoutDashboard /> Overview</Nav>
      {editablePages.map(x => <Nav key={x} active={page === x} onClick={() => setPage(x)}>{labels[x]}</Nav>)}
      <Nav active={page === 'messages'} onClick={() => setPage('messages')}><Mail /> Messages</Nav>
      <Nav active={page === 'theme'} onClick={() => setPage('theme')}><Palette /> Color Theme</Nav>
      <button className="admin-nav logout" onClick={signOut}><LogOut /> Sign out</button>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-kicker">{theme.site_name || 'TEACHWITHJOY'} CMS</span><h2>{labels[page]}</h2></div><button className="admin-view-site" onClick={() => window.open('/', '_blank')}>View site</button></header>
      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">✓ {success}</div>}
      {page === 'overview' ? <Overview go={setPage} /> : page === 'theme' ? <AdminTheme theme={theme} setTheme={setTheme} save={save} /> : page === 'messages' ? <AdminMessages /> : <AdminEditor page={page} value={content[page] || {}} setContent={setContent} save={save} />}
    </main>
  </div>
}

function Login({ error, submit, theme }: { error: string; submit: (event: React.FormEvent<HTMLFormElement>) => void; theme: any }) {
  const vars = { '--admin-primary': theme.primary_color || '#ff7f32', '--admin-primary-dark': theme.primary_dark || '#e7651c', '--admin-accent': theme.accent_color || '#ffe28a', '--admin-background': theme.background_color || '#fff4e8', '--admin-surface': theme.surface_color || '#ffffff', '--admin-text': theme.text_color || '#3a2418', '--admin-muted': theme.muted_color || '#8a6f5a' } as React.CSSProperties
  return <div className="admin-auth-page" style={vars}><form className="admin-login-card" onSubmit={submit}><div className="admin-brand"><span><GraduationCap /></span><b>{theme.site_name || 'TeachWithJoy'}</b></div><div className="admin-kicker">ADMINISTRATION</div><h1>Manage your site.</h1><p>Sign in with an authorized administrator account.</p><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Password" required />{error && <div className="admin-error">{error}</div>}<button className="admin-btn primary">Sign in</button><button type="button" className="admin-back" onClick={() => window.location.href = '/'}>← Back to site</button></form></div>
}

function Nav({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) { return <button className={active ? 'admin-nav active' : 'admin-nav'} onClick={onClick}>{children}</button> }
function Overview({ go }: { go: (page: Section) => void }) { return <div className="admin-overview"><section className="admin-welcome"><div><span className="admin-kicker">CONTENT MANAGEMENT</span><h1>Keep your site up to date.</h1><p>Edit page content, repeatable sections with visual controls, branding, theme, and incoming contact messages.</p></div><Palette size={28} /></section><div className="admin-card-grid">{editablePages.map(x => <button className="admin-content-card" key={x} onClick={() => go(x)}><span>{labels[x]}</span><strong>Edit content</strong></button>)}<button className="admin-content-card" onClick={() => go('messages')}><span>Contact</span><strong>View messages</strong></button><button className="admin-content-card" onClick={() => go('theme')}><span>Brand</span><strong>Site name, footer & theme</strong></button></div></div>}
