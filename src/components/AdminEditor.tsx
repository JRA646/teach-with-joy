import { Plus, Save, Trash2 } from 'lucide-react'

type Props={page:string;value:Record<string,any>;setContent:React.Dispatch<React.SetStateAction<Record<string,any>>>;save:()=>void}
type Field={key:string;label:string;long?:boolean}

const fieldMap:Record<string,Field[]>={
 home:[
  {key:'heroEyebrow',label:'Hero eyebrow'},{key:'heroTitle',label:'Hero title',long:true},{key:'heroText',label:'Hero description',long:true},{key:'heroImage',label:'Hero image URL'},{key:'heroPrimary',label:'Primary button'},{key:'heroSecondary',label:'Secondary button'},
  {key:'whyEyebrow',label:'Why section eyebrow'},{key:'whyTitle',label:'Why section title',long:true},{key:'whyText',label:'Why section description',long:true},
  {key:'testimonial',label:'Testimonial quote',long:true},{key:'testimonialText',label:'Testimonial text',long:true},{key:'testimonialAuthor',label:'Testimonial author'},
  {key:'ctaEyebrow',label:'CTA eyebrow'},{key:'ctaTitle',label:'CTA title',long:true},{key:'ctaText',label:'CTA description',long:true},
 ],
 about:[{key:'eyebrow',label:'Eyebrow'},{key:'title',label:'Page title',long:true},{key:'text',label:'Page description',long:true},{key:'bodyTitle',label:'Body title',long:true},{key:'bodyText',label:'Body text',long:true}],
 schedule:[{key:'eyebrow',label:'Eyebrow'},{key:'title',label:'Page title',long:true},{key:'text',label:'Page description',long:true}],
 pricing:[{key:'eyebrow',label:'Eyebrow'},{key:'title',label:'Page title',long:true},{key:'text',label:'Page description',long:true}],
 contact:[{key:'eyebrow',label:'Eyebrow'},{key:'title',label:'Page title',long:true},{key:'text',label:'Page description',long:true},{key:'email',label:'Contact email'},{key:'supportHours',label:'Support hours'},{key:'onlineText',label:'Online description'},{key:'formTitle',label:'Form title',long:true},{key:'contactIntro',label:'Form introduction',long:true}],
}
const collectionMap:Record<string,{key:string;title:string;fields:Field[]}>={
 features:{key:'features',title:'Home feature cards',fields:[{key:'title',label:'Title'},{key:'text',label:'Description',long:true}]},
 infoCards:{key:'infoCards',title:'Home information cards',fields:[{key:'title',label:'Title'},{key:'text',label:'Description',long:true}]},
 cards:{key:'cards',title:'About cards',fields:[{key:'title',label:'Title'},{key:'text',label:'Description',long:true}]},
 steps:{key:'steps',title:'Scheduling steps',fields:[{key:'title',label:'Step title'},{key:'text',label:'Step description',long:true}]},
 plans:{key:'plans',title:'Pricing plans',fields:[{key:'name',label:'Plan name'},{key:'price',label:'Price'},{key:'detail',label:'Price detail'}]},
}

const pageTitles:Record<string,string>={home:'Home',about:'About',schedule:'Scheduling',pricing:'Pricing',contact:'Contact'}
function titleFor(key:string){return key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}

export default function AdminEditor({page,value,setContent,save}:Props){
 const fields=fieldMap[page]||[]
 const update=(key:string,next:any)=>setContent(current=>({...current,[page]:{...(current[page]||{}),[key]:next}}))
 const addItem=(key:string)=>{const current=Array.isArray(value[key])?value[key]:[];const defaults=collectionMap[key]?.fields.reduce((a,f)=>({...a,[f.key]:''}),{})||{};update(key,[...current,defaults])}
 const updateItem=(key:string,index:number,field:string,next:any)=>{const nextItems=[...(value[key]||[])];nextItems[index]={...nextItems[index],[field]:next};update(key,nextItems)}
 const removeItem=(key:string,index:number)=>{const nextItems=[...(value[key]||[])];nextItems.splice(index,1);update(key,nextItems)}
 return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">EDIT PAGE</span><h3>{pageTitles[page]||page} content</h3><p>Edit each section directly. No JSON editing is required.</p></div><button className="admin-btn primary" onClick={save}><Save size={14}/> Save changes</button></div>
  <div className="admin-form-grid">{fields.map(field=><label className="admin-field" key={field.key}><strong>{field.label}</strong>{field.long?<textarea rows={4} value={value[field.key]??''} onChange={e=>update(field.key,e.target.value)}/>:<input value={value[field.key]??''} onChange={e=>update(field.key,e.target.value)}/>}</label>)}</div>
  {Object.keys(collectionMap).filter(k=>Array.isArray(value[k])).map(key=>{const cfg=collectionMap[key];return <div className="admin-collections" key={key}><div className="admin-subheading"><div><strong>{cfg.title}</strong><span>{(value[key]||[]).length} items</span></div><button className="admin-btn secondary" onClick={()=>addItem(key)}><Plus size={14}/> Add item</button></div><div className="admin-repeatable-list">{(value[key]||[]).map((item:any,index:number)=><article className="admin-repeatable" key={`${key}-${index}`}><div className="admin-repeatable-head"><strong>{cfg.title} {index+1}</strong><button className="admin-icon-danger" title="Delete" onClick={()=>removeItem(key,index)}><Trash2 size={15}/></button></div><div className="admin-form-grid">{cfg.fields.map(field=><label className="admin-field" key={field.key}><strong>{field.label}</strong>{field.long?<textarea rows={3} value={item[field.key]??''} onChange={e=>updateItem(key,index,field.key,e.target.value)}/>:<input value={item[field.key]??''} onChange={e=>updateItem(key,index,field.key,e.target.value)}/>}</label>)}</div>{key==='features'&&<label className="admin-field"><strong>Icon</strong><select value={item.icon||'sparkles'} onChange={e=>updateItem(key,index,'icon',e.target.value)}><option value="users">Users</option><option value="calendar">Calendar</option><option value="shield">Shield</option><option value="sparkles">Sparkles</option></select></label>}{key==='infoCards'||key==='cards'?<label className="admin-field"><strong>Icon</strong><select value={item.icon||'sparkles'} onChange={e=>updateItem(key,index,'icon',e.target.value)}><option value="book">Book</option><option value="calendar">Calendar</option><option value="message">Message</option><option value="users">Users</option><option value="graduation">Graduation</option><option value="shield">Shield</option><option value="sparkles">Sparkles</option></select></label>:null}{key==='plans'&&<><label className="admin-field"><strong>Features</strong><textarea rows={4} value={Array.isArray(item.items)?item.items.join('\n'):''} onChange={e=>updateItem(key,index,'items',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></label><label className="admin-check"><input type="checkbox" checked={!!item.featured} onChange={e=>updateItem(key,index,'featured',e.target.checked)}/> Featured plan</label></>}</article>)}</div></div>})}
 </section>
}
