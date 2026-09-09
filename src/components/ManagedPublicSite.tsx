import { useEffect, useRef, useState } from 'react'
import PublicSite from './PublicSite'
import { supabase } from '../lib/supabase'

export default function ManagedPublicSite() {
  const [data, setData] = useState<Record<string, any>>({})
  const [theme, setTheme] = useState<any>({})
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const [contentResult, themeResult] = await Promise.all([
        supabase.from('site_content').select('page,content'),
        supabase.from('site_theme').select('*').eq('id', 1).maybeSingle(),
      ])

      if (!mounted) return

      const next: Record<string, any> = {}
      ;(contentResult.data || []).forEach((row: any) => {
        next[row.page] = row.content
      })
      setData(next)
      if (themeResult.data) setTheme(themeResult.data)
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const html = document.documentElement
    Object.entries(theme).forEach(([key, value]) => {
      if (key.endsWith('_color')) {
        html.style.setProperty(`--twj-${key.replace('_color', '').replace('_', '-')}`, String(value))
      }
    })
  }, [theme])

  useEffect(() => {
    const container = root.current
    if (!container) return

    const getPage = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && data[hash]) return hash

      const active = container.querySelector('.nav-link.active')?.textContent?.trim().toLowerCase()
      if (active === 'about') return 'about'
      if (active === 'scheduling') return 'schedule'
      if (active === 'pricing') return 'pricing'
      if (active === 'contact') return 'contact'
      return 'home'
    }

    const setText = (selector: string, value: any) => {
      const element = container.querySelector(selector) as HTMLElement | null
      if (element && value !== undefined && value !== null && String(value).trim() !== '') {
        element.textContent = String(value)
      }
    }

    const apply = () => {
      const currentPage = getPage()
      const current = data[currentPage]
      if (!current) return

      if (currentPage === 'home') {
        setText('.hero .eyebrow', current.heroEyebrow)
        setText('.hero h1', current.heroTitle)
        setText('.hero-copy > p', current.heroText)
        setText('.content-section .eyebrow', current.whyEyebrow)
        setText('.content-section h2', current.whyTitle)
        setText('.content-section p', current.whyText)
        setText('.testimonial-section strong', current.testimonial)
        setText('.testimonial-section span', current.testimonialText)
        setText('.testimonial-section small', current.testimonialAuthor)
        setText('.cta-section .eyebrow', current.ctaEyebrow)
        setText('.cta-section h2', current.ctaTitle)
        setText('.cta-section p', current.ctaText)

        const image = container.querySelector('.hero-image img') as HTMLImageElement | null
        if (image && current.heroImage) image.src = String(current.heroImage)
      } else {
        setText('.page-hero .eyebrow', current.eyebrow)
        setText('.page-hero h1', current.title)
        setText('.page-hero p', current.text)

        if (currentPage === 'about') {
          setText('.page-body h2', current.bodyTitle)
          setText('.page-body p', current.bodyText)
        }
      }

      if (currentPage === 'contact') {
        const contact = data.contact || {}
        const spans = container.querySelectorAll('.contact-detail span')
        if (spans[0] && contact.email) spans[0].textContent = String(contact.email)
        if (spans[1] && contact.supportHours) spans[1].textContent = String(contact.supportHours)
        if (spans[2] && contact.onlineText) spans[2].textContent = String(contact.onlineText)
      }
    }

    const handleNavigation = () => window.setTimeout(apply, 0)
    container.addEventListener('click', handleNavigation)
    window.addEventListener('hashchange', handleNavigation)

    const observer = new MutationObserver(() => {
      observer.disconnect()
      apply()
      observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    })

    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    apply()

    return () => {
      container.removeEventListener('click', handleNavigation)
      window.removeEventListener('hashchange', handleNavigation)
      observer.disconnect()
    }
  }, [data])

  return <div ref={root}><PublicSite /></div>
}
