import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Eye, Plus, Save, Trash2 } from 'lucide-react'

type Props = {
  page: string
  value: Record<string, any>
  setContent: React.Dispatch<React.SetStateAction<Record<string, any>>>
  save: () => Promise<void> | void
}
type Field = { key: string; label: string; long?: boolean; hint?: string }

type Group = { title: string; description: string; keys: string[] }

const fieldMap: Record<string, Field[]> = {
  home: [
    { key: 'heroEyebrow', label: 'Hero eyebrow', hint: 'Small label above the main headline.' },
    { key: 'heroTitle', label: 'Hero title', long: true, hint: 'Your main homepage headline.' },
    { key: 'heroText', label: 'Hero description', long: true },
    { key: 'heroImage', label: 'Hero image URL', hint: 'Use a public image URL.' },
    { key: 'heroImageAlt', label: 'Hero image alt text' },
    { key: 'heroPrimary', label: 'Primary button' },
    { key: 'heroSecondary', label: 'Secondary button' },
    { key: 'trustOneTitle', label: 'Trust item 1 title' },
    { key: 'trustOneText', label: 'Trust item 1 text' },
    { key: 'trustTwoTitle', label: 'Trust item 2 title' },
    { key: 'trustTwoText', label: 'Trust item 2 text' },
    { key: 'trustThreeTitle', label: 'Trust item 3 title' },
    { key: 'trustThreeText', label: 'Trust item 3 text' },
    { key: 'whyEyebrow', label: 'Why section eyebrow' },
    { key: 'whyTitle', label: 'Why section title', long: true },
    { key: 'whyText', label: 'Why section description', long: true },
    { key: 'whyLinkText', label: 'Why section link text' },
    { key: 'testimonial', label: 'Testimonial quote', long: true },
    { key: 'testimonialText', label: 'Testimonial text', long: true },
    { key: 'testimonialAuthor', label: 'Testimonial author' },
    { key: 'ctaEyebrow', label: 'CTA eyebrow' },
    { key: 'ctaTitle', label: 'CTA title', long: true },
    { key: 'ctaText', label: 'CTA description', long: true },
    { key: 'ctaButton', label: 'CTA button' },
  ],
  about: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Page title', long: true },
    { key: 'text', label: 'Page description', long: true }, { key: 'bodyTitle', label: 'Body title', long: true },
    { key: 'bodyText', label: 'Body text', long: true }, { key: 'statOneLabel', label: 'Stat 1 label' },
    { key: 'statOneValue', label: 'Stat 1 value' }, { key: 'statTwoLabel', label: 'Stat 2 label' },
    { key: 'statTwoValue', label: 'Stat 2 value' }, { key: 'statThreeLabel', label: 'Stat 3 label' },
    { key: 'statThreeValue', label: 'Stat 3 value' },
  ],
  schedule: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Page title', long: true },
    { key: 'text', label: 'Page description', long: true }, { key: 'schedulePanelTitle', label: 'Schedule panel title' },
    { key: 'readyEyebrow', label: 'Booking CTA eyebrow' }, { key: 'readyTitle', label: 'Booking CTA title', long: true },
    { key: 'readyText', label: 'Booking CTA text', long: true }, { key: 'readyButton', label: 'Booking CTA button' },
  ],
  pricing: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Page title', long: true },
    { key: 'text', label: 'Page description', long: true }, { key: 'planButton', label: 'Plan button text' },
    { key: 'featuredBadge', label: 'Featured plan badge' },
  ],
  contact: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Page title', long: true },
    { key: 'text', label: 'Page description', long: true }, { key: 'contactEyebrow', label: 'Contact panel eyebrow' },
    { key: 'formTitle', label: 'Contact panel title', long: true }, { key: 'contactIntro', label: 'Contact panel introduction', long: true },
    { key: 'email', label: 'Contact email' }, { key: 'supportHours', label: 'Support hours' },
    { key: 'onlineText', label: 'Online description' }, { key: 'formNameLabel', label: 'Name field label' },
    { key: 'formEmailLabel', label: 'Email field label' }, { key: 'formMessageLabel', label: 'Message field label' },
    { key: 'formButton', label: 'Send button text' },
  ],
}

const collectionMap: Record<string, { key: string; title: string; fields: Field[] }> = {
  features: { key: 'features', title: 'Home feature cards', fields: [{ key: 'title', label: 'Title' }, { key: 'text', label: 'Description', long: true }] },
  infoCards: { key: 'infoCards', title: 'Home information cards', fields: [{ key: 'title', label: 'Title' }, { key: 'text', label: 'Description', long: true }] },
  cards: { key: 'cards', title: 'About cards', fields: [{ key: 'title', label: 'Title' }, { key: 'text', label: 'Description', long: true }] },
  steps: { key: 'steps', title: 'Scheduling steps', fields: [{ key: 'title', label: 'Step title' }, { key: 'text', label: 'Step description', long: true }] },
  plans: { key: 'plans', title: 'Pricing plans', fields: [{ key: 'name', label: 'Plan name' }, { key: 'price', label: 'Price' }, { key: 'detail', label: 'Price detail' }] },
}

const pageTitles: Record<string, string> = { home: 'Home', about: 'About', schedule: 'Scheduling', pricing: 'Pricing', contact: 'Contact' }

function groupsFor(page: string, fields: Field[]): Group[] {
  if (page === 'home') {
    return [
      { title: 'Hero section', description: 'Control the first thing visitors see.', keys: ['heroEyebrow', 'heroTitle', 'heroText', 'heroImage', 'heroImageAlt', 'heroPrimary', 'heroSecondary'] },
      { title: 'Trust highlights', description: 'Short benefits shown below the hero.', keys: ['trustOneTitle', 'trustOneText', 'trustTwoTitle', 'trustTwoText', 'trustThreeTitle', 'trustThreeText'] },
      { title: 'Why TeachWithJoy', description: 'Explain the value of your learning experience.', keys: ['whyEyebrow', 'whyTitle', 'whyText', 'whyLinkText'] },
      { title: 'Testimonial', description: 'Build trust with a student or parent quote.', keys: ['testimonial', 'testimonialText', 'testimonialAuthor'] },
      { title: 'Final call to action', description: 'Close the homepage with a clear next step.', keys: ['ctaEyebrow', 'ctaTitle', 'ctaText', 'ctaButton'] },
    ]
  }
  if (page === 'about') return [{ title: 'Page introduction', description: 'Your main About page content.', keys: fields.map(f => f.key) }]
  if (page === 'schedule') return [{ title: 'Scheduling page', description: 'Explain how students can schedule lessons.', keys: fields.map(f => f.key) }]
  if (page === 'pricing') return [{ title: 'Pricing page', description: 'Control the pricing introduction and labels.', keys: fields.map(f => f.key) }]
  return [{ title: 'Contact page', description: 'Control contact information and form labels.', keys: fields.map(f => f.key) }]
}

export default function AdminEditor({ page, value, setContent, save }: Props) {
  const fields = fieldMap[page] || []
  const groups = useMemo(() => groupsFor(page, fields), [page, fields])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g, i) => [g.title, i === 0])))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOpenGroups(Object.fromEntries(groups.map((g, i) => [g.title, i === 0])))
    setDirty(false)
  }, [page])

  const update = (key: string, next: any) => {
    setDirty(true)
    setContent(current => ({ ...current, [page]: { ...(current[page] || {}), [key]: next } }))
  }
  const addItem = (key: string) => {
    setDirty(true)
    const current = Array.isArray(value[key]) ? value[key] : []
    const defaults = collectionMap[key]?.fields.reduce((a, f) => ({ ...a, [f.key]: '' }), {}) || {}
    update(key, [...current, defaults])
  }
  const updateItem = (key: string, index: number, field: string, next: any) => {
    const nextItems = [...(value[key] || [])]
    nextItems[index] = { ...nextItems[index], [field]: next }
    update(key, nextItems)
  }
  const removeItem = (key: string, index: number) => {
    const nextItems = [...(value[key] || [])]
    nextItems.splice(index, 1)
    update(key, nextItems)
  }
  const handleSave = async () => {
    setSaving(true)
    try { await save(); setDirty(false) } finally { setSaving(false) }
  }

  const renderField = (field: Field, current: Record<string, any> = value, itemKey?: string, itemIndex?: number) => {
    const val = current[field.key] ?? ''
    const onChange = (next: any) => itemKey !== undefined && itemIndex !== undefined
      ? updateItem(itemKey, itemIndex, field.key, next)
      : update(field.key, next)
    return <label className="admin-field" key={field.key}>
      <span className="admin-field-label"><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      {field.long ? <textarea rows={5} value={val} onChange={e => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}…`} /> : <input value={val} onChange={e => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}…`} />}
    </label>
  }

  return <section className="admin-panel admin-editor-panel">
    <div className="admin-editor-toolbar">
      <div className="admin-panel-heading editor-heading">
        <div><span className="admin-kicker">EDIT PAGE</span><h3>{pageTitles[page] || page}</h3><p>Update your public page using simple fields. Your changes are saved to the CMS when you click Save.</p></div>
      </div>
      <div className="admin-editor-actions">
        <span className={dirty ? 'admin-save-state dirty' : 'admin-save-state'}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button className="admin-btn secondary" onClick={() => window.open(`/?page=${page}`, '_blank')}><Eye size={14} /> Preview</button>
        <button className="admin-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : <><Save size={14} /> Save changes</>}</button>
      </div>
    </div>

    <div className="admin-editor-groups">
      {groups.map(group => <div className="admin-editor-section" key={group.title}>
        <button className="admin-section-toggle" onClick={() => setOpenGroups(x => ({ ...x, [group.title]: !x[group.title] }))}>
          <span><strong>{group.title}</strong><small>{group.description}</small></span><ChevronDown size={17} className={openGroups[group.title] ? 'open' : ''} />
        </button>
        {openGroups[group.title] && <div className="admin-form-grid">{group.keys.map(key => { const field = fields.find(f => f.key === key); return field ? renderField(field) : null })}</div>}
      </div>)}
    </div>

    {Object.keys(collectionMap).filter(k => Array.isArray(value[k])).map(key => {
      const cfg = collectionMap[key]
      return <div className="admin-collections" key={key}>
        <div className="admin-subheading"><div><strong>{cfg.title}</strong><span>{(value[key] || []).length} items</span></div><button className="admin-btn secondary" onClick={() => addItem(key)}><Plus size={14} /> Add {key === 'plans' ? 'plan' : 'item'}</button></div>
        <div className="admin-repeatable-list">{(value[key] || []).map((item: any, index: number) => <article className="admin-repeatable" key={`${key}-${index}`}>
          <div className="admin-repeatable-head"><div><strong>{item.title || item.name || `${cfg.title} ${index + 1}`}</strong><small>Item {index + 1}</small></div><button className="admin-icon-danger" title="Delete item" onClick={() => removeItem(key, index)}><Trash2 size={15} /></button></div>
          <div className="admin-form-grid">{cfg.fields.map(field => renderField(field, item, key, index))}</div>
          {key === 'features' && <label className="admin-field"><span className="admin-field-label"><strong>Icon</strong><small>Choose a simple visual icon.</small></span><select value={item.icon || 'sparkles'} onChange={e => updateItem(key, index, 'icon', e.target.value)}><option value="users">Users</option><option value="calendar">Calendar</option><option value="shield">Shield</option><option value="sparkles">Sparkles</option></select></label>}
          {(key === 'infoCards' || key === 'cards') && <label className="admin-field"><span className="admin-field-label"><strong>Icon</strong><small>Choose a simple visual icon.</small></span><select value={item.icon || 'sparkles'} onChange={e => updateItem(key, index, 'icon', e.target.value)}><option value="book">Book</option><option value="calendar">Calendar</option><option value="message">Message</option><option value="users">Users</option><option value="graduation">Graduation</option><option value="shield">Shield</option><option value="sparkles">Sparkles</option></select></label>}
          {key === 'steps' && <p className="admin-field-note">Step numbers are generated automatically on the public page.</p>}
          {key === 'plans' && <><label className="admin-field"><span className="admin-field-label"><strong>Features</strong><small>One feature per line.</small></span><textarea rows={5} value={Array.isArray(item.items) ? item.items.join('\n') : ''} onChange={e => updateItem(key, index, 'items', e.target.value.split('\n').map(x => x.trim()).filter(Boolean))} placeholder="Flexible scheduling\nPersonal guidance\nProgress tracking" /></label><label className="admin-check"><input type="checkbox" checked={!!item.featured} onChange={e => updateItem(key, index, 'featured', e.target.checked)} /> Featured plan</label></>}
        </article>)}</div>
      </div>
    })}
  </section>
}
