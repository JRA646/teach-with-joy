import { useEffect, useState } from 'react'
import { Command, Search, X } from 'lucide-react'
import { searchPlatform } from '../services/platform'

export default function GlobalSearch({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<any[]>([])
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(true)}if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[])
  useEffect(()=>{if(!open||!query.trim()){setResults([]);return};const timer=window.setTimeout(()=>void searchPlatform(query).then(setResults),180);return()=>window.clearTimeout(timer)},[open,query])
  if(!open)return <button className="global-search-trigger" onClick={()=>setOpen(true)}><Search size={15}/><span>Search</span><kbd>Ctrl K</kbd></button>
  return <div className="global-search-backdrop" onMouseDown={()=>setOpen(false)}><div className="global-search-dialog" onMouseDown={e=>e.stopPropagation()}><div className="global-search-input"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search students, programs, sessions…"/><button onClick={()=>setOpen(false)}><X size={17}/></button></div><div className="global-search-results">{results.length?results.map(r=><button key={`${r.entity_type}-${r.entity_id}`} onClick={()=>{setOpen(false);if(r.metadata?.path)onNavigate?.(r.metadata.path)}}><Command size={15}/><span><strong>{r.title}</strong><small>{r.subtitle||r.entity_type}</small></span></button>):query?<div className="global-search-empty">No results found.</div>:<div className="global-search-empty">Type to search the platform.</div>}</div></div></div>
}
