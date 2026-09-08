import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'register'
type Page = 'home' | 'about' | 'schedule' | 'pricing' | 'contact'

type AuthProps = {
  mode: AuthMode
  close: () => void
  change: (mode: AuthMode) => void
}

const hero =
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1400&q=85'

const pageContent: Record<Exclude<Page, 'home'>, { eyebrow: string; title: string; text: string }> = {
  about: {
    eyebrow: 'ABOUT TEACHWITHJOY',
    title: 'Teaching that feels personal.',
    text: 'TeachWithJoy connects learners with thoughtful teachers through simple scheduling, focused one-on-one lessons, and a workspace that keeps every session organized.',
  },
  schedule: {
    eyebrow: 'SCHEDULING',
    title: 'Find a time that fits your life.',
    text: 'Choose a subject, browse real teacher availability, and reserve a session without the back-and-forth. Your upcoming lessons stay in one place.',
  },
  pricing: {
    eyebrow: 'PRICING',
    title: 'Simple plans for steady progress.',
    text: 'Start with flexible lesson credits or choose a monthly plan when you are ready to make learning a consistent habit.',
  },
  contact: {
    eyebrow: 'CONTACT',
    title: 'We are here to help.',
    text: 'Questions about lessons, schedules, or getting started? Reach the TeachWithJoy team and we will help you find the right next step.',
  },
}

export default function PublicSite() {
  const [mode, setMode] = useState<AuthMode | null>(null)
  const [page, setPage] = useState<Page>('home')

  const goTo = (next: Page) => {
    setPage(next)
    window.history.replaceState({}, '', next === 'home' ? '/' : `/#${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="public-site">
      <header className="public-header">
        <button className="brand brand-link" onClick={() => goTo('home')} aria-label="TeachWithJoy home">
          <div className="brand-icon">
            <GraduationCap size={20} />
          </div>
          <strong>TeachWithJoy</strong>
        </button>

        <nav aria-label="Primary navigation">
          {(['home', 'about', 'schedule', 'pricing', 'contact'] as Page[]).map((item) => (
            <button
              key={item}
              className={page === item ? 'nav-link active' : 'nav-link'}
              onClick={() => goTo(item)}
            >
              {item === 'home' ? 'Home' : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="btn secondary" onClick={() => setMode('login')}>
            Log In
          </button>
          <button className="btn primary" onClick={() => setMode('register')}>
            Get Started
          </button>
        </div>
      </header>

      <main>
        {page === 'home' ? (
          <Home onNavigate={goTo} onAuth={setMode} />
        ) : (
          <InteriorPage page={page} onNavigate={goTo} onAuth={setMode} />
        )}
      </main>

      <footer className="public-footer">
        <div className="footer-main">
          <div>
            <Brand />
            <p>Personalized learning, thoughtfully scheduled.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => goTo('about')}>About</button>
            <button onClick={() => goTo('schedule')}>Scheduling</button>
            <button onClick={() => goTo('pricing')}>Pricing</button>
            <button onClick={() => goTo('contact')}>Contact</button>
          </div>
        </div>
        <div className="footer-bottom">© 2026 TeachWithJoy. Learn with confidence.</div>
      </footer>

      {mode && <Auth mode={mode} close={() => setMode(null)} change={setMode} />}
    </div>
  )
}

function Home({ onNavigate, onAuth }: { onNavigate: (page: Page) => void; onAuth: (mode: AuthMode) => void }) {
  return (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
          <span className="eyebrow">PERSONALIZED ONLINE LESSONS</span>
          <h1>
            Learn smarter,
            <br />
            <span>achieve more.</span>
          </h1>
          <p>
            One-on-one lessons, flexible scheduling, and supportive teachers—all in one calm learning experience.
          </p>
          <div className="hero-actions">
            <button className="btn primary xl" onClick={() => onAuth('register')}>
              Book a Session <ArrowRight size={15} />
            </button>
            <button className="btn secondary xl" onClick={() => onNavigate('schedule')}>
              Explore Scheduling
            </button>
          </div>
          <div className="hero-trust">
            <span><ShieldCheck size={14} /> Secure account</span>
            <span><Clock3 size={14} /> Flexible times</span>
            <span><Users size={14} /> Personal guidance</span>
          </div>
        </div>
        <div className="hero-image">
          <img src={hero} alt="Teacher helping a student learn online" />
        </div>
      </section>

      <section className="feature-strip">
        <Feature icon={<Users />} title="1-on-1 Lessons" text="Personalized for you" />
        <Feature icon={<CalendarDays />} title="Flexible Schedule" text="Book around your day" />
        <Feature icon={<ShieldCheck />} title="Secure Access" text="Your account stays protected" />
        <Feature icon={<Sparkles />} title="Progress Focused" text="Learn with purpose" />
      </section>

      <section className="content-section two-column-section">
        <div>
          <span className="eyebrow">WHY TEACHWITHJOY</span>
          <h2>A calmer way to learn.</h2>
          <p>
            Skip the scattered messages and complicated booking flows. TeachWithJoy gives students a clear path from choosing a subject to attending the lesson.
          </p>
          <button className="text-link" onClick={() => onNavigate('about')}>
            Learn more about us <ArrowRight size={14} />
          </button>
        </div>
        <div className="info-card-grid">
          <InfoCard icon={<BookOpen />} title="Meaningful lessons" text="Build skills with focused, teacher-led sessions." />
          <InfoCard icon={<CalendarDays />} title="Real availability" text="See bookable teacher slots before you commit." />
          <InfoCard icon={<MessageCircle />} title="Human support" text="Ask questions and stay connected when it matters." />
          <InfoCard icon={<Sparkles />} title="A joyful rhythm" text="Make learning easier to return to week after week." />
        </div>
      </section>

      <section className="testimonial-section">
        <div className="quote-card featured-quote">
          <div className="quote-avatar">A</div>
          <div>
            <strong>“Joy is an amazing teacher.”</strong>
            <span>The lessons are easy to understand and very engaging. The whole experience feels organized and personal.</span>
            <small>— Anna, Student</small>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div>
          <span className="eyebrow">READY WHEN YOU ARE</span>
          <h2>Make your next lesson your best one.</h2>
          <p>Create your account and discover teachers, schedules, and pricing in one place.</p>
        </div>
        <button className="btn primary xl" onClick={() => onAuth('register')}>Create your account <ArrowRight size={15} /></button>
      </section>
    </>
  )
}

function InteriorPage({
  page,
  onNavigate,
  onAuth,
}: {
  page: Exclude<Page, 'home'>
  onNavigate: (page: Page) => void
  onAuth: (mode: AuthMode) => void
}) {
  const meta = pageContent[page]

  if (page === 'about') {
    return (
      <PageShell meta={meta}>
        <div className="split-panel">
          <div>
            <h2>Built around better teaching.</h2>
            <p>TeachWithJoy is designed to make learning feel less transactional and more human. Students get clarity, teachers get structure, and both sides spend less time managing logistics.</p>
          </div>
          <div className="stat-stack">
            <Stat label="Lesson style" value="1-on-1" />
            <Stat label="Booking" value="Self-service" />
            <Stat label="Focus" value="Progress" />
          </div>
        </div>
        <div className="card-grid three-up">
          <InfoCard icon={<GraduationCap />} title="Teacher first" text="Give teachers a clean workspace to manage availability, subjects, and upcoming sessions." />
          <InfoCard icon={<Users />} title="Student centered" text="Help students make confident choices about subjects, times, and lesson goals." />
          <InfoCard icon={<ShieldCheck />} title="Trusted experience" text="Keep sign-in and account access connected to secure Supabase authentication." />
        </div>
        <PageCta text="Ready to experience it?" action="Create an account" onClick={() => onAuth('register')} />
      </PageShell>
    )
  }

  if (page === 'schedule') {
    const slots = [
      ['Mon', '4:00 PM', 'English'],
      ['Tue', '6:30 PM', 'Writing'],
      ['Thu', '7:00 PM', 'Business'],
    ]
    return (
      <PageShell meta={meta}>
        <div className="schedule-demo">
          <div className="panel panel-soft">
            <div className="panel-head"><h3>Available this week</h3><CalendarDays size={18} /></div>
            <div className="slot-list large">
              {slots.map(([day, time, subject]) => (
                <button className="schedule-card" key={`${day}-${time}`} onClick={() => onAuth('register')}>
                  <div className="schedule-day">{day}</div>
                  <div className="schedule-copy"><strong>{subject}</strong><span>{time}</span></div>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <span className="eyebrow">HOW IT WORKS</span>
            <ol className="steps">
              <li><b>1</b><div><strong>Choose a subject</strong><span>Find the lesson that matches your goal.</span></div></li>
              <li><b>2</b><div><strong>Pick an open slot</strong><span>Book from teacher availability.</span></div></li>
              <li><b>3</b><div><strong>Attend and learn</strong><span>Keep everything together in your workspace.</span></div></li>
            </ol>
          </div>
        </div>
        <PageCta text="See available lessons after signing in." action="Get started" onClick={() => onAuth('register')} />
      </PageShell>
    )
  }

  if (page === 'pricing') {
    return (
      <PageShell meta={meta}>
        <div className="pricing-grid">
          <PriceCard name="Starter" price="$19" detail="per lesson" items={['1 focused lesson', 'Teacher availability', 'Secure account']} onClick={() => onAuth('register')} />
          <PriceCard featured name="Growth" price="$69" detail="per month" items={['4 lessons per month', 'Flexible scheduling', 'Priority booking', 'Progress-friendly routine']} onClick={() => onAuth('register')} />
          <PriceCard name="Flexible" price="$99" detail="custom" items={['Custom lesson bundle', 'Multiple subjects', 'Schedule around you', 'Best for changing needs']} onClick={() => onAuth('register')} />
        </div>
        <p className="pricing-note">Pricing shown here is a starter presentation layer. Final billing rules and payment processing can be connected without changing the public navigation.</p>
      </PageShell>
    )
  }

  return (
    <PageShell meta={meta}>
      <div className="contact-grid">
        <div className="panel panel-soft">
          <span className="eyebrow">LET'S TALK</span>
          <h2>Tell us what you need.</h2>
          <p>Use the form to send a message. For now, this creates a friendly front door for your team while the authenticated workspace remains focused on lessons and scheduling.</p>
          <div className="contact-detail"><Mail size={17} /><div><strong>Email</strong><span>hello@teachwithjoy.app</span></div></div>
          <div className="contact-detail"><Clock3 size={17} /><div><strong>Support hours</strong><span>Monday–Friday, 9:00 AM–6:00 PM</span></div></div>
          <div className="contact-detail"><MapPin size={17} /><div><strong>Online</strong><span>Serving learners wherever they are</span></div></div>
        </div>
        <ContactForm onAuth={onAuth} />
      </div>
      <PageCta text="Need an account instead?" action="Log in" onClick={() => onAuth('login')} />
    </PageShell>
  )
}

function PageShell({ meta, children }: { meta: { eyebrow: string; title: string; text: string }; children: React.ReactNode }) {
  return (
    <section className="interior-page">
      <div className="page-hero">
        <span className="eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.text}</p>
      </div>
      <div className="page-body">{children}</div>
    </section>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="feature">
      <div className="feature-icon">{icon}</div>
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  )
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="info-card">
      <div className="feature-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><small>{label}</small><strong>{value}</strong></div>
}

function PageCta({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="page-cta"><div><strong>{text}</strong><span>Take the next step in a few clicks.</span></div><button className="btn primary" onClick={onClick}>{action}<ArrowRight size={14} /></button></div>
}

function PriceCard({ name, price, detail, items, featured, onClick }: { name: string; price: string; detail: string; items: string[]; featured?: boolean; onClick: () => void }) {
  return (
    <div className={featured ? 'price-card featured' : 'price-card'}>
      {featured && <div className="price-badge">MOST POPULAR</div>}
      <span className="price-name">{name}</span>
      <div className="price-value">{price}<small>{detail}</small></div>
      <div className="price-items">{items.map((item) => <span key={item}><Check size={14} />{item}</span>)}</div>
      <button className="btn primary full" onClick={onClick}>Choose {name}</button>
    </div>
  )
}

function ContactForm({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  const [sent, setSent] = useState(false)
  return (
    <div className="panel">
      {sent ? (
        <div className="form-success"><div className="success-icon"><Check size={18} /></div><h3>Message ready to go.</h3><p>Your contact experience is in place. Connect this form to your preferred email or backend service when you are ready.</p><button className="btn secondary" onClick={() => setSent(false)}>Send another</button></div>
      ) : (
        <form className="contact-form" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
          <label>Name<input required placeholder="Your name" /></label>
          <label>Email<input required type="email" placeholder="you@example.com" /></label>
          <label>How can we help?<textarea required placeholder="Tell us what you need..." /></label>
          <button className="btn primary full" type="submit">Send message <ArrowRight size={14} /></button>
          <button className="text-link centered" type="button" onClick={() => onAuth('login')}>Already have an account? Log in</button>
        </form>
      )}
    </div>
  )
}

function Brand() {
  return <div className="brand"><div className="brand-icon"><GraduationCap size={20} /></div><strong>TeachWithJoy</strong></div>
}

function Auth({ mode, close, change }: AuthProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name, role } },
          })

      if (result.error) throw result.error

      if (mode === 'register' && !result.data.session) {
        setError('Account created. Check your email to confirm your address, then log in.')
        return
      }

      close()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-btn close" onClick={close} aria-label="Close authentication form"><X size={18} /></button>
        <Brand />
        <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'login' ? 'Log in to continue to your TeachWithJoy workspace.' : 'Choose a role and start learning or teaching.'}</p>

        <form className="stack" onSubmit={submit}>
          {mode === 'register' && <>
            <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Joy Teacher" autoComplete="name" /></label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value as 'student' | 'teacher')}><option value="student">Student</option><option value="teacher">Teacher</option></select></label>
          </>}
          <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}</button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? 'New to TeachWithJoy?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => change(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create one' : 'Log in'}</button>
        </div>
      </div>
    </div>
  )
}
