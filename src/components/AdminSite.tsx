import { useEffect, useState } from 'react'
import { GraduationCap, Palette, LogOut, LayoutDashboard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminEditor from './AdminEditor'
import AdminTheme from './AdminTheme'

type Page = 'home' | 'about' | 'schedule' | 'pricing' | 'contact'
type Section = Page | 'overview' | 'theme'

const labels: Record<Section, string> = {
  overview: 'Overview',
  home: 'Home',
  about: 'About',
  schedule: 'Scheduling',
  pricing: 'Pricing',
  contact: 'Contact',
  theme: 'Color Theme',
}

export default function AdminSite() {
  const [session, setSession] = useState<any>(null)
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Section>('overview')
  const [content, setContent] = useState<Record<string, any>>({})
  const [theme, setTheme] = useState<any>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function checkAdmin(userId: string) {
    const { data, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (adminError) return { authorized: false, error: adminError.message }
    return { authorized: Boolean(data?.user_id), error: '' }
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      setError('')
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      const currentSession = data.session
      setSession(currentSession)

      if (!currentSession) {
        setLoading(false)
        return
      }

      const admin = await checkAdmin(currentSession.user.id)
      if (!mounted) return

      if (admin.error) {
        setError(admin.error)
        setLoading(false)
        return
      }

      if (!admin.authorized) {
        setError('This account is not authorized to access the admin area.')
        setLoading(false)
        return
      }

      setAuthorized(true)
      await load()
      if (mounted) setLoading(false)
    }

    initialize()
    return () => {
      mounted = false
    }
  }, [])

  async function load() {
    const [contentResult, themeResult] = await Promise.all([
      supabase.from('site_content').select('page,content'),
      supabase.from('site_theme').select('*').eq('id', 1).maybeSingle(),
    ])

    if (contentResult.error) {
      setError(contentResult.error.message)
      return
    }

    const nextContent: Record<string, any> = {}
    ;(contentResult.data || []).forEach((row: any) => {
      nextContent[row.page] = row.content
    })

    setContent(nextContent)
    if (themeResult.error) setError(themeResult.error.message)
    setTheme(themeResult.data || { id: 1 })
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')

    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error || !result.data.user) {
      setError(result.error?.message || 'Unable to sign in.')
      return
    }

    const userId = result.data.user.id
    const admin = await checkAdmin(userId)
    if (admin.error) {
      setError(admin.error)
      return
    }

    if (!admin.authorized) {
      await supabase.auth.signOut()
      setError('This account is not authorized to access the admin area.')
      return
    }

    setSession(result.data.session)
    setAuthorized(true)
    await load()
  }

  async function save() {
    setError('')
    setSuccess('')

    const isTheme = page === 'theme'
    const payload = isTheme
      ? { ...theme, id: 1, updated_by: session?.user?.id }
      : {
          page,
          content: content[page] || {},
          updated_by: session?.user?.id,
          updated_at: new Date().toISOString(),
        }

    const result = await supabase
      .from(isTheme ? 'site_theme' : 'site_content')
      .upsert(payload, { onConflict: isTheme ? 'id' : 'page' })

    if (result.error) {
      setError(result.error.message)
      return
    }

    setSuccess('Saved successfully.')
    await load()
    window.setTimeout(() => setSuccess(''), 2500)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function getTitle(section: Section) {
    return labels[section]
  }

  if (loading) return <div className="admin-loader">Loading TeachWithJoy Admin...</div>
  if (!session || !authorized) return <Login error={error} submit={login} />

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span><GraduationCap size={19} /></span>
          <b>TeachWithJoy</b>
        </div>

        <Nav active={page === 'overview'} onClick={() => setPage('overview')}>
          <LayoutDashboard /> Overview
        </Nav>

        {(Object.keys(labels) as Section[]).filter((item): item is Page => item !== 'overview' && item !== 'theme').map((item) => (
          <Nav key={item} active={page === item} onClick={() => setPage(item)}>
            {labels[item]}
          </Nav>
        ))}

        <Nav active={page === 'theme'} onClick={() => setPage('theme')}>
          <Palette /> Color Theme
        </Nav>

        <button className="admin-nav logout" onClick={signOut}>
          <LogOut /> Sign out
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">TEACHWITHJOY CMS</span>
            <h2>{getTitle(page)}</h2>
          </div>
          <button className="admin-view-site" onClick={() => (window.location.href = '/')}>View site</button>
        </header>

        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">✓ {success}</div>}

        {page === 'overview' ? (
          <Overview go={setPage} />
        ) : page === 'theme' ? (
          <AdminTheme theme={theme} setTheme={setTheme} save={save} />
        ) : (
          <AdminEditor
            page={page}
            value={content[page] || {}}
            setContent={setContent}
            save={save}
          />
        )}
      </main>
    </div>
  )
}

function Login({ error, submit }: { error: string; submit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="admin-auth-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-brand">
          <span><GraduationCap /></span>
          <b>TeachWithJoy</b>
        </div>
        <div className="admin-kicker">ADMINISTRATION</div>
        <h1>Manage your site.</h1>
        <p>Sign in with an authorized administrator account.</p>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        {error && <div className="admin-error">{error}</div>}
        <button className="admin-btn primary">Sign in</button>
        <button type="button" className="admin-back" onClick={() => (window.location.href = '/')}>← Back to site</button>
      </form>
    </div>
  )
}

function Nav({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'admin-nav active' : 'admin-nav'} onClick={onClick}>
      {children}
    </button>
  )
}

function Overview({ go }: { go: (page: Section) => void }) {
  return (
    <div className="admin-overview">
      <section className="admin-welcome">
        <div>
          <span className="admin-kicker">CONTENT MANAGEMENT</span>
          <h1>Keep TeachWithJoy up to date.</h1>
          <p>Edit public pages and modify the color theme.</p>
        </div>
        <Palette size={28} />
      </section>
      <div className="admin-card-grid">
        {(Object.keys(labels) as Section[]).filter((item): item is Page => item !== 'overview' && item !== 'theme').map((item) => (
          <button className="admin-content-card" key={item} onClick={() => go(item)}>
            <span>{labels[item]}</span>
            <strong>Edit content</strong>
          </button>
        ))}
        <button className="admin-content-card" onClick={() => go('theme')}>
          <span>Brand</span>
          <strong>Modify color theme</strong>
        </button>
      </div>
    </div>
  )
}
