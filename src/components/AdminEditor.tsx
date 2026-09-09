import { useEffect, useMemo, useState } from 'react'
import { Eye, Save } from 'lucide-react'

type Props = {
  page: string
  value: Record<string, any>
  setContent: React.Dispatch<React.SetStateAction<Record<string, any>>>
  save: () => void
}

const labels: Record<string, string> = {
  heroEyebrow: 'Hero eyebrow', heroTitle: 'Hero title', heroText: 'Hero description', heroImage: 'Hero image URL',
  heroPrimary: 'Primary button', heroSecondary: 'Secondary button', whyEyebrow: 'Section eyebrow', whyTitle: 'Section title', whyText: 'Section description',
  testimonial: 'Testimonial quote', testimonialText: 'Testimonial text', testimonialAuthor: 'Testimonial author',
  ctaEyebrow: 'CTA eyebrow', ctaTitle: 'CTA title', ctaText: 'CTA description', eyebrow: 'Eyebrow', title: 'Page title', text: 'Page description',
  bodyTitle: 'Body title', bodyText: 'Body text', email: 'Contact email', supportHours: 'Support hours', onlineText: 'Online description', formTitle: 'Form title', contactIntro: 'Contact introduction',
}

const titleFor = (key: string) => labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
const isLong = (key: string, value: string) => value.length > 90 || /text|description|body|quote|intro/i.test(key)

export default function AdminEditor({ page, value, setContent, save }: Props) {
  const [json, setJson] = useState('')
  const [jsonError, setJsonError] = useState('')

  useEffect(() => {
    setJson(JSON.stringify(value, null, 2))
    setJsonError('')
  }, [page])

  const entries = useMemo(() => Object.entries(value).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'), [value])
  const collections = useMemo(() => Object.entries(value).filter(([, v]) => Array.isArray(v) || (v && typeof v === 'object')), [value])

  const update = (key: string, next: any) => setContent((current) => ({ ...current, [page]: { ...(current[page] || {}), [key]: next } }))

  const updateJson = (raw: string) => {
    setJson(raw)
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Content must be a JSON object.')
      setJsonError('')
      setContent((current) => ({ ...current, [page]: parsed }))
    } catch (error: any) {
      setJsonError(error.message || 'Invalid JSON')
    }
  }

  return <section className="admin-panel">
    <div className="admin-panel-heading">
      <div><span className="admin-kicker">EDIT PAGE</span><h3>{titleFor(page)} content</h3><p>Changes are stored in Supabase and reflected on the public site automatically.</p></div>
      <div className="admin-heading-actions"><button className="admin-btn secondary" onClick={() => window.open(page === 'home' ? '/' : `/#${page}`, '_blank')}><Eye size={14}/> Preview</button><button className="admin-btn primary" onClick={save}><Save size={14}/> Save changes</button></div>
    </div>

    <div className="admin-form-grid">
      {entries.map(([key, raw]) => {
        const valueText = String(raw ?? '')
        return <label className="admin-field" key={key}><strong>{titleFor(key)}</strong>{isLong(key, valueText) ? <textarea rows={4} value={valueText} onChange={(e) => update(key, e.target.value)} /> : <input value={valueText} onChange={(e) => update(key, typeof raw === 'number' ? Number(e.target.value) : typeof raw === 'boolean' ? e.target.value === 'true' : e.target.value)} />}</label>
      })}
    </div>

    {collections.length > 0 && <div className="admin-collections"><div className="admin-subheading"><strong>Dynamic sections</strong><span>Cards, plans, features and other repeatable content can be edited as JSON.</span></div>{collections.map(([key, val]) => <details className="admin-advanced" key={key} open><summary>{titleFor(key)} <span>{Array.isArray(val) ? `${val.length} items` : 'object'}</span></summary><textarea className="admin-json" value={JSON.stringify(val, null, 2)} onChange={(e) => { try { update(key, JSON.parse(e.target.value)); } catch {} }} /></details>)}</div>}

    <details className="admin-advanced"><summary>Advanced: edit complete page JSON</summary><textarea className="admin-json" value={json} onChange={(e) => updateJson(e.target.value)} />{jsonError && <div className="admin-error">{jsonError}</div>}</details>
  </section>
}
