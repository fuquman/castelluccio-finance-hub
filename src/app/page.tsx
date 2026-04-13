'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──
type Acc={id:string;name:string;bank:string;account_type:string;balance:number}
type Tx={id:string;date:string;description:string;amount:number;category:string;tags?:string[]}
type Cat={id:string;name:string;icon:string;color:string;monthly_limit:number}
type Rec={id:string;name:string;amount:number;frequency:string;category:string;status:string;notes:string;next_due_date:string;owner:string;previous_amount:number|null;price_changed_at:string|null;tags?:string[]}
type Dbt={id:string;name:string;type:string;original_amount:number;current_balance:number;interest_rate:number;monthly_payment:number;lender:string}
type Goal={id:string;name:string;icon:string;color:string;target_amount:number;current_amount:number;deadline:string;notes:string}
type Inc={id:string;name:string;type:string;amount:number;frequency:string}
type Alrt={id:string;type:string;message:string;severity:string}
type EBill={id:string;vendor:string;amount:number;due_date:string;category:string;status:string;subject:string}
type Snap={month:string;total_income:number;total_expenses:number}
type Msg={role:'user'|'assistant';text:string}
type CC={id:string;name:string;icon:string;color:string}
type CCI={id:string;cost_centre_id:string;date:string;description:string;amount:number;category:string}

// ── Helpers ──
const $=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:0,maximumFractionDigits:0}).format(n)
const $$=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n)
const pc=(a:number,b:number)=>b>0?Math.round((a/b)*100):0

// ── Components ──
function Ring({value,max,size=44,sw=4,color='var(--orange)',children}:{value:number;max:number;size?:number;sw?:number;color?:string;children?:React.ReactNode}){
  const p=Math.min(pc(value,max),100),r=(size-sw)/2,c=2*Math.PI*r,off=c-(p/100)*c
  const col=p>90?'var(--red)':p>75?'var(--orange)':color
  return<div style={{position:'relative',width:size,height:size}}>
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{transition:'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)'}}/>
    </svg>
    {children&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{children}</div>}
  </div>
}

function Ico({bg,ch,size=50}:{bg:string;ch:string;size?:number}){
  return<div className="ri" style={{background:bg,width:size,height:size,fontSize:Math.round(size*0.52)}}>{ch}</div>
}

function Input({...props}:React.InputHTMLAttributes<HTMLInputElement>){
  return<input {...props} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit',...(props.style||{})}}/>
}

function Select({children,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{children:React.ReactNode}){
  return<select {...props} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit',...(props.style||{})}}>{children}</select>
}

function Btn({children,variant='primary',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'danger';children:React.ReactNode}){
  const styles={primary:{background:'var(--orange)',color:'#000'},secondary:{background:'var(--card2)',color:'var(--t3)'},danger:{background:'var(--red-s)',color:'var(--red)'}}
  return<button {...props} style={{padding:'14px 20px',borderRadius:12,border:'none',fontSize:16,fontWeight:600,cursor:'pointer',...styles[variant],...(props.style||{})}}>{children}</button>
}

// ══════════════════════════════════════
// ══  MAIN APP
// ══════════════════════════════════════
export default function App(){
  // ── State ──
  const[tab,setTab]=useState('home')
  const[more,setMore]=useState(false)
  const[accounts,setA]=useState<Acc[]>([])
  const[txs,setT]=useState<Tx[]>([])
  const[cats,setC]=useState<Cat[]>([])
  const[recs,setR]=useState<Rec[]>([])
  const[debts,setD]=useState<Dbt[]>([])
  const[goals,setG]=useState<Goal[]>([])
  const[incs,setI]=useState<Inc[]>([])
  const[alerts,setAl]=useState<Alrt[]>([])
  const[ebills,setE]=useState<EBill[]>([])
  const[snaps,setS]=useState<Snap[]>([])
  const[ccs,setCC]=useState<CC[]>([])
  const[ccis,setCCI]=useState<CCI[]>([])
  const[loading,setL]=useState(true)
  // Chat
  const[chat,setCh]=useState<Msg[]>([{role:'assistant',text:"G'day! I'm Fella — your finance brain. Ask me anything about your money."}])
  const[chatIn,setCI]=useState('')
  const[sending,setSe]=useState(false)
  const[listening,setLi]=useState(false)
  const chatEnd=useRef<HTMLDivElement>(null)
  // Forms
  const[showForm,setShowForm]=useState<string|null>(null)
  const[editItem,setEditItem]=useState<any>(null)
  const[fd,setFd]=useState<any>({})
  const[saving,setSaving]=useState(false)
  const[billMenu,setBillMenu]=useState<string|null>(null)
  const[selectedKid,setSelectedKid]=useState<string|null>(null)
  const[settingsSection,setSettingsSection]=useState('connections')
  const[reportFrom,setReportFrom]=useState(new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0])
  const[reportTo,setReportTo]=useState(new Date().toISOString().split('T')[0])
  const[reportTab,setReportTab]=useState('summary')
  const fileRef=useRef<HTMLInputElement>(null)
  const[dateFrom,setDateFrom]=useState('')
  const[dateTo,setDateTo]=useState('')

  // ── Data Loading ──
  const load=async()=>{
    try{
      const[a,t,c,r,d,g,i,al,eb,sn,cc,cci]=await Promise.all([
        supabase.from('bank_accounts').select('*').order('bank'),
        supabase.from('transactions').select('*').order('date',{ascending:false}).limit(50),
        supabase.from('budget_categories').select('*').order('name'),
        supabase.from('recurring_payments').select('*').order('name'),
        supabase.from('debts').select('*').eq('is_active',true).order('current_balance',{ascending:false}),
        supabase.from('savings_goals').select('*').eq('is_active',true).order('priority'),
        supabase.from('income_sources').select('*').eq('is_active',true),
        supabase.from('finance_alerts').select('*').eq('is_dismissed',false).order('created_at',{ascending:false}),
        supabase.from('email_bills').select('*').order('due_date'),
        supabase.from('monthly_snapshots').select('*').order('month'),
        supabase.from('cost_centres').select('*').eq('is_active',true).order('name'),
        supabase.from('cost_centre_items').select('*').order('date',{ascending:false}),
      ])
      setA(a.data||[]);setT(t.data||[]);setC(c.data||[]);setR(r.data||[]);setD(d.data||[])
      setG(g.data||[]);setI(i.data||[]);setAl(al.data||[]);setE(eb.data||[]);setS(sn.data||[])
      setCC(cc.data||[]);setCCI(cci.data||[])
    }catch(e){console.error('Load error:',e)}
    setL(false)
  }

  useEffect(()=>{
    if(typeof window!=='undefined'&&window.location.hash)window.history.replaceState(null,'',window.location.pathname)
    load()
  },[])
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth'})},[chat])

  // ── Computed ──
  const bal=accounts.reduce((s,a)=>s+Number(a.balance),0)
  const dbt=debts.reduce((s,d)=>s+Number(d.current_balance),0)
  const nw=bal-dbt
  const mInc=incs.reduce((s,i)=>{const a=Number(i.amount);return s+(i.frequency==='weekly'?a*4.33:i.frequency==='fortnightly'?a*2.17:a)},0)
  const now=new Date()
  const mTx=txs.filter(t=>{const d=new Date(t.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()})
  const mSp=mTx.filter(t=>Number(t.amount)<0).reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
  const byCat=cats.map(c=>{const sp=mTx.filter(t=>t.category===c.name&&Number(t.amount)<0).reduce((s,t)=>s+Math.abs(Number(t.amount)),0);return{...c,spent:sp,pct:pc(sp,Number(c.monthly_limit))}}).sort((a,b)=>b.pct-a.pct)
  const mRec=recs.filter(r=>r.status!=='cancelled').reduce((s,r)=>{const a=Number(r.amount);return s+(r.frequency==='weekly'?a*4.33:r.frequency==='fortnightly'?a*2.17:r.frequency==='quarterly'?a/3:r.frequency==='yearly'?a/12:a)},0)
  const flagged=recs.filter(r=>r.status==='duplicate'||r.status==='flagged')
  const savingsRate=snaps.length?Math.round(((Number(snaps[snaps.length-1]?.total_income||0)-Number(snaps[snaps.length-1]?.total_expenses||0))/Math.max(Number(snaps[snaps.length-1]?.total_income||1),1))*100):0

  // ── CRUD ──
  const save=async(table:string,data:any,id?:string)=>{
    // Convert tags string to array if present
    if(typeof data.tags==='string'){data.tags=data.tags.split(',').map((t:string)=>t.trim()).filter(Boolean)}
    setSaving(true)
    try{if(id){await supabase.from(table).update(data).eq('id',id)}else{await supabase.from(table).insert(data)}
      await load();setShowForm(null);setEditItem(null);setFd({})}catch(e){console.error(e)}
    setSaving(false)
  }
  const del=async(table:string,id:string)=>{
    if(!confirm('Delete this item?'))return
    await supabase.from(table).delete().eq('id',id);await load()
  }
  const dismiss=async(id:string)=>{
    await supabase.from('finance_alerts').update({is_dismissed:true}).eq('id',id);setAl(a=>a.filter(x=>x.id!==id))
  }
  const resetData=async()=>{
    if(!confirm('Delete ALL data including demo data?'))return
    if(!confirm('Last chance — this cannot be undone!'))return
    setSaving(true)
    for(const t of['transactions','finance_alerts','fella_chat','bill_uploads','email_bills','monthly_snapshots','cost_centre_items','recurring_payments','debts','savings_goals','income_sources','budget_categories','bank_accounts','data_connections','cost_centres']){
      await supabase.from(t).delete().neq('id','00000000-0000-0000-0000-000000000000')}
    await load();setSaving(false)
  }

  // ── Export CSV ──
  const exportCSV=()=>{
    const filtered=dateFrom||dateTo?txs.filter(t=>{const d=t.date;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo)}):txs
    const header='Date,Description,Amount,Category\n'
    const rows=filtered.map(t=>`${t.date},"${t.description}",${t.amount},"${t.category||''}"`).join('\n')
    const blob=new Blob([header+rows],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download=`caster-transactions-${new Date().toISOString().split('T')[0]}.csv`;a.click()
    URL.revokeObjectURL(url)
  }

  // ── Chat ──
  const voice=()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang='en-AU';r.interimResults=false;r.onstart=()=>setLi(true);r.onresult=(e:any)=>{setCI(e.results[0][0].transcript);setLi(false)};r.onerror=()=>setLi(false);r.onend=()=>setLi(false);r.start()}
  const sendChat=async()=>{
    if(!chatIn.trim()||sending)return;const msg=chatIn.trim();setCI('');setCh(p=>[...p,{role:'user',text:msg}]);setSe(true)
    try{
      const sys=`You are Fella — a sharp, warm Aussie family finance assistant for the Castelluccios (Melbourne). Named after Rockefeller. DATA: Accounts:${JSON.stringify(accounts.map(a=>({n:a.name,b:a.bank,bal:a.balance})))} Net:${$$(nw)} MonthlyInc:${$$(mInc)} Spent:${$$(mSp)} Rec:${$$(mRec)} Budgets:${JSON.stringify(byCat.slice(0,6).map(c=>({n:c.name,b:c.monthly_limit,s:c.spent})))} Debts:${JSON.stringify(debts.map(d=>({n:d.name,bal:d.current_balance,pay:d.monthly_payment})))} Goals:${JSON.stringify(goals.map(g=>({n:g.name,t:g.target_amount,s:g.current_amount,dl:g.deadline})))} Be direct, use AUD, reference real data. 2-4 sentences. Casual Aussie tone.`
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,systemPrompt:sys})})
      const d=await res.json();setCh(p=>[...p,{role:'assistant',text:d.reply||'Had a hiccup — try again.'}])
    }catch{setCh(p=>[...p,{role:'assistant',text:'Connection issue — give it another go.'}])}
    setSe(false)
  }

  // ── Photo Upload ──
  const handlePhoto=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return
    setCh(p=>[...p,{role:'user',text:`📷 Uploaded: ${file.name}`},{role:'assistant',text:`Got it! In the full version I'll OCR this and extract the vendor, amount, and due date. For now, tell me the details and I'll log it.`}])
    setTab('fella')
  }

  // ── Edit helpers ──
  const editRow=(table:string,item:any,fields:any)=>{setFd(fields);setEditItem({...item,_table:table});setShowForm(table)}
  const newRow=(table:string,fields:any)=>{setFd(fields);setEditItem(null);setShowForm(table)}

  // ── Form renderer ──
  const EditForm=({table,fields,children}:{table:string;fields:{key:string;label:string;type?:string;options?:{v:string;l:string}[]}[];children?:React.ReactNode})=>(
    <div className="gc" style={{padding:20,marginBottom:12}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit':'Add New'}</div>
      {fields.map(f=>f.options?
        <Select key={f.key} value={fd[f.key]||''} onChange={e=>setFd({...fd,[f.key]:e.target.value})}>
          {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </Select>:
        <Input key={f.key} placeholder={f.label} type={f.type||'text'} value={fd[f.key]??''} onChange={e=>setFd({...fd,[f.key]:f.type==='number'?parseFloat(e.target.value)||0:e.target.value})}/>
      )}
      {children}
      <div style={{display:'flex',gap:10,marginTop:6}}>
        <Btn onClick={()=>save(table,fd,editItem?.id)} disabled={saving} style={{flex:1}}>{saving?'Saving...':'Save'}</Btn>
        <Btn variant="secondary" onClick={()=>{setShowForm(null);setEditItem(null)}}>Cancel</Btn>
        {editItem&&<Btn variant="danger" onClick={()=>{del(table,editItem.id);setShowForm(null);setEditItem(null)}}>Delete</Btn>}
      </div>
    </div>
  )

  // ── Loading ──
  if(loading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:24}}><div style={{fontSize:120}}>💰</div><div style={{fontSize:52,fontWeight:800,color:'var(--orange)',letterSpacing:-1}}>Ca$ter</div><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Loading your finances...</div></div>

  return<div style={{minHeight:'100dvh',paddingBottom:120,background:'#000'}}>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handlePhoto}/>

    {/* ── Header ── */}
    <div style={{padding:'16px 20px 24px'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Castelluccio Family</div><h1 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7,lineHeight:1.05}}>Ca$ter</h1><div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}><span className="mono" style={{fontSize:34,fontWeight:700,color:nw>=0?'var(--orange)':'var(--red)'}}>{$(nw)}</span><span style={{fontSize:13,color:'var(--t3)'}}>net worth</span></div></div>

    {/* ── Alerts ── */}
    {alerts.length>0&&tab==='home'&&<div style={{padding:'0 20px 16px',display:'flex',flexDirection:'column',gap:8}}>{alerts.slice(0,3).map((a,i)=><div key={a.id} className={`fu s${i+1}`} style={{padding:'12px 16px',borderRadius:12,fontSize:14,lineHeight:1.45,display:'flex',gap:10,alignItems:'flex-start',background:a.severity==='danger'?'var(--red-s)':a.severity==='warning'?'var(--orange-s)':a.severity==='success'?'var(--green-s)':'var(--blue-s)'}}><span style={{flex:1,color:'var(--t2)'}}>{a.message}</span><button onClick={()=>dismiss(a.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:16,padding:0}}>✕</button></div>)}</div>}

    {/* ═══════ HOME ═══════ */}
    {tab==='home'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      {/* Accounts */}
      <div className="fu s1"><div className="sh">Accounts</div><div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg={a.account_type==='credit'?'var(--purple)':a.account_type==='loan'?'var(--red)':a.account_type==='savings'?'var(--green)':'var(--blue)'} ch={a.account_type==='credit'?'💳':a.account_type==='loan'?'🏦':a.account_type==='savings'?'🐷':'💰'}/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--t1)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div></div>

      {/* Stats */}
      <div className="fu s2" style={{display:'flex',gap:10}}>{[['Income',$(mInc),'var(--green)'],['Spent',$(mSp),'var(--orange)'],['Recurring',$(mRec),'var(--purple)']].map(([l,v,c],i)=><div key={i} className="gc" style={{flex:1,padding:'14px 10px',textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>{l as string}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:c as string}}>{v as string}</div></div>)}</div>

      {/* Cash Flow */}
      <div className="fu s3"><div className="sh">Cash Flow · {savingsRate}% saved</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span></div><div style={{display:'flex',alignItems:'flex-end',gap:8,height:110}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.flatMap(s=>[s.total_income,s.total_expenses]),1);return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}><div style={{display:'flex',gap:3,alignItems:'flex-end',height:88,width:'100%'}}><div style={{flex:1,borderRadius:5,height:`${(Number(d.total_income)/mx)*100}%`,background:'var(--orange)',opacity:0.85,transition:'height 0.8s'}}/><div style={{flex:1,borderRadius:5,height:`${(Number(d.total_expenses)/mx)*100}%`,background:'var(--purple)',opacity:0.5,transition:'height 0.8s'}}/></div><span style={{fontSize:11,color:'var(--t3)'}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span></div>})}</div></div></div>

      {/* Recent Transactions + Add */}
      <div className="fu s4"><div className="sh" style={{margin:0}}>Transactions</div>
        <div style={{display:'flex',gap:8,marginTop:8,marginBottom:8}}>
          <button onClick={exportCSV} style={{padding:'10px 16px',borderRadius:12,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:14,fontWeight:600,cursor:'pointer',flex:1}}>📥 Export CSV</button>
          <button onClick={()=>setShowForm(showForm==='tx'?null:'tx')} style={{padding:'10px 16px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer',flex:1}}>{showForm==='tx'?'Cancel':'+ Add'}</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} placeholder="From" style={{flex:1,padding:'12px 14px',borderRadius:12,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:14,outline:'none',fontFamily:'inherit'}}/>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} placeholder="To" style={{flex:1,padding:'12px 14px',borderRadius:12,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:14,outline:'none',fontFamily:'inherit'}}/>
          {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom('');setDateTo('')}} style={{padding:'12px 14px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:14,fontWeight:600,cursor:'pointer'}}>✕</button>}
        </div>
        {showForm==='tx'&&<div className="gc" style={{padding:18,marginTop:10,marginBottom:4}}>
          <Input placeholder="What was it?" value={fd.description||''} onChange={e=>setFd({...fd,description:e.target.value})}/>
          <div style={{display:'flex',gap:8}}><Input placeholder="Amount (-ve for expense)" type="number" value={fd.amount??''} onChange={e=>setFd({...fd,amount:e.target.value})} style={{flex:1,marginBottom:8}}/><Input type="date" value={fd.date||new Date().toISOString().split('T')[0]} onChange={e=>setFd({...fd,date:e.target.value})} style={{width:140,marginBottom:8}}/></div>
          <Select value={fd.category||''} onChange={e=>setFd({...fd,category:e.target.value})}><option value="">Category...</option>{cats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}<option value="Income">Income</option></Select>
          <Input placeholder="Tags (comma separated, e.g. essential, kids)" value={fd.tags||''} onChange={e=>setFd({...fd,tags:e.target.value})}/>
          <Btn onClick={()=>save('transactions',{description:fd.description,amount:parseFloat(fd.amount)||0,category:fd.category||'Uncategorised',date:fd.date||new Date().toISOString().split('T')[0],logged_by:'manual',tags:fd.tags?fd.tags.split(',').map((t:string)=>t.trim()).filter(Boolean):[]})} disabled={saving} style={{width:'100%'}}>{saving?'Saving...':'Add'}</Btn>
        </div>}
        <div className="gc">{(dateFrom||dateTo?txs.filter(t=>(!dateFrom||t.date>=dateFrom)&&(!dateTo||t.date<=dateTo)):txs).slice(0,20).map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{tx.description}</div><div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}{tx.tags&&tx.tags.length>0&&<> · {tx.tags.map((tag:string,ti:number)=><span key={ti} style={{background:'var(--blue-s)',color:'var(--blue)',padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:600,marginLeft:4}}>{tag}</span>)}</>}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span></div>)}</div>
      </div>

      {/* Savings callout */}
      {flagged.length>0&&<div className="fu s5" style={{background:'var(--orange-s)',borderRadius:14,padding:18,display:'flex',alignItems:'center',gap:14}}><span style={{fontSize:28}}>💡</span><div><div style={{fontSize:15,fontWeight:700,color:'var(--orange)'}}>Save {$(flagged.reduce((s,r)=>s+Number(r.amount),0)*12)}/year</div><div style={{fontSize:13,color:'var(--t3)'}}>    {flagged.length} flagged subs</div></div></div>}
    </div>}

    {/* ═══════ BUDGET ═══════ */}
    {tab==='budget'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><div><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Budgets</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>{$(mSp)} of {$(cats.reduce((s,c)=>s+Number(c.monthly_limit),0))} spent</div></div><button onClick={()=>newRow('budget_categories',{name:'',icon:'📁',color:'#ff9f0a',monthly_limit:0})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      {showForm==='budget_categories'&&<EditForm table="budget_categories" fields={[{key:'name',label:'Category name'},{key:'icon',label:'Icon emoji'},{key:'monthly_limit',label:'Monthly limit',type:'number'}]}/>}
      <div className="gc fu s1">{byCat.map((c,i)=><div key={c.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),gap:14,cursor:'pointer'}} onClick={()=>editRow('budget_categories',c,{name:c.name,icon:c.icon,color:c.color,monthly_limit:Number(c.monthly_limit)})}>
        <Ring value={c.spent} max={Number(c.monthly_limit)} size={52} sw={5} color={c.color}><span style={{fontSize:16}}>{c.icon}</span></Ring>
        <div className="rb"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span className="rt">{c.name}</span><span className={`pill ${c.pct>=90?'pill-r':c.pct>=75?'pill-o':'pill-g'}`}>{c.pct}%</span></div><div className="pbar"><div className="pfill" style={{width:`${Math.min(c.pct,100)}%`,background:c.pct>90?'var(--red)':c.pct>75?'var(--orange)':c.color}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:12,color:'var(--t3)'}}><span>{$(c.spent)}</span><span>{$(Number(c.monthly_limit)-c.spent)} left</span></div></div>
      </div>)}</div>
    </div>}

    {/* ═══════ DEBTS ═══════ */}
    {tab==='debts'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Debts</h2><button onClick={()=>newRow('debts',{name:'',type:'other',original_amount:0,current_balance:0,interest_rate:0,monthly_payment:0,lender:''})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      <div className="fu s1" style={{background:'var(--red-s)',borderRadius:14,padding:20,textAlign:'center'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Total Remaining</div><div className="mono" style={{fontSize:42,fontWeight:800,color:'var(--red)'}}>{$(dbt)}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:6}}>{$(debts.reduce((s,d)=>s+Number(d.monthly_payment),0))}/mo repayments</div></div>
      {showForm==='debts'&&<EditForm table="debts" fields={[{key:'name',label:'Name'},{key:'type',label:'Type',options:[{v:'credit_card',l:'Credit Card'},{v:'personal_loan',l:'Personal Loan'},{v:'car_loan',l:'Car Loan'},{v:'mortgage',l:'Mortgage'},{v:'bnpl',l:'BNPL'},{v:'fine',l:'Fine'},{v:'other',l:'Other'}]},{key:'original_amount',label:'Original amount',type:'number'},{key:'current_balance',label:'Current balance',type:'number'},{key:'interest_rate',label:'Interest rate %',type:'number'},{key:'monthly_payment',label:'Monthly payment',type:'number'},{key:'lender',label:'Lender'}]}/>}
      <div className="gc fu s2">{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('debts',d,{name:d.name,type:d.type,original_amount:Number(d.original_amount),current_balance:Number(d.current_balance),interest_rate:Number(d.interest_rate),monthly_payment:Number(d.monthly_payment),lender:d.lender})}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div><div style={{fontSize:17,fontWeight:500}}>{d.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{d.lender}{Number(d.interest_rate)>0?` · ${d.interest_rate}%`:''}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:13,color:'var(--t3)'}}><span>Left <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span><span className="mono" style={{fontWeight:600}}>{$$(Number(d.monthly_payment))}</span>/mo</span></div></div>})}</div>
    </div>}

    {/* ═══════ FELLA ═══════ */}
    {tab==='fella'&&<div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 110px)',padding:'0 20px'}}>
      <div className="fu" style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><Ico bg="var(--orange)" ch="🤖" size={56}/><div><div style={{fontSize:28,fontWeight:800}}>Fella</div><div style={{fontSize:13,color:'var(--t3)'}}>Voice + Text · Your money brain</div></div></div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingBottom:8}}>
        {chat.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}><div className={m.role==='user'?'cb-u':'cb-a'}>{m.text}</div></div>)}
        {sending&&<div style={{display:'flex'}}><div className="cb-a" style={{color:'var(--t3)'}}>Thinking...</div></div>}
        {chat.length===1&&!sending&&<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:16}}>
          <div style={{fontSize:13,color:'var(--t3)',fontWeight:600}}>Try asking...</div>
          {[{i:'🏖️',q:"Can we afford Byron Bay in October? What do we need to save each week?"},{i:'💸',q:"Where are we wasting money? Find subscriptions we should cut"},{i:'📸',q:"I just took a photo of a bill — can you help me log it?"}].map((ex,j)=><button key={j} onClick={()=>setCI(ex.q)} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'16px 18px',background:'var(--card)',border:'none',borderRadius:14,cursor:'pointer',textAlign:'left'}}><span style={{fontSize:32,flexShrink:0}}>{ex.i}</span><span style={{fontSize:17,color:'var(--t2)',lineHeight:1.45}}>{ex.q}</span></button>)}
        </div>}
        <div ref={chatEnd}/>
      </div>
      <div style={{display:'flex',gap:10,padding:'12px 0'}}>
        <button onClick={()=>fileRef.current?.click()} style={{width:54,height:54,borderRadius:27,border:'none',background:'var(--card)',color:'var(--t3)',cursor:'pointer',fontSize:26,display:'flex',alignItems:'center',justifyContent:'center'}}>📷</button>
        <button onClick={voice} style={{width:54,height:54,borderRadius:27,border:'none',background:listening?'var(--red-s)':'var(--card)',color:listening?'var(--red)':'var(--t3)',cursor:'pointer',fontSize:26,display:'flex',alignItems:'center',justifyContent:'center'}}>{listening?'⏹':'🎙'}</button>
        <input value={chatIn} onChange={e=>setCI(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Ask Fella..." style={{flex:1,padding:'0 18px',height:54,borderRadius:27,border:'none',background:'var(--card)',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/>
        <button onClick={sendChat} disabled={sending} style={{width:54,height:54,borderRadius:27,border:'none',background:'var(--orange)',color:'#000',cursor:'pointer',fontSize:24,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>↑</button>
      </div>
    </div>}

    {/* ═══════ SUBS & BILLS (combined) ═══════ */}
    {tab==='subs'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Subs & Bills</h2></div>
      <div className="fu s1" style={{display:'flex',gap:10}}><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Monthly</div><div className="mono" style={{fontSize:28,fontWeight:700}}>{$(mRec)}</div></div><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Annual</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(mRec*12)}</div></div></div>

      {/* Price Changes */}
      {recs.filter(r=>r.previous_amount&&r.previous_amount!==Number(r.amount)).length>0&&<>
        <div className="sh" style={{color:'var(--blue)'}}>💰 Price Changes</div>
        <div className="gc fu s2">{recs.filter(r=>r.previous_amount&&r.previous_amount!==Number(r.amount)).map((r,i)=>{
          const diff=Number(r.amount)-Number(r.previous_amount);const up=diff>0
          return<div key={r.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:17,fontWeight:500}}>{r.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{r.price_changed_at?new Date(r.price_changed_at).toLocaleDateString('en-AU',{month:'short',year:'numeric'}):''}</div></div>
              <div style={{textAlign:'right'}}><div style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{fontSize:13,color:'var(--t3)',textDecoration:'line-through'}}>{$$(Number(r.previous_amount))}</span><span style={{fontSize:16}}>→</span><span className="mono" style={{fontSize:15,fontWeight:600}}>{$$(Number(r.amount))}</span></div>
                <span className={`pill ${up?'pill-r':'pill-g'}`}>{up?'↑':'↓'} {$$(Math.abs(diff))}/mo</span>
              </div>
            </div>
          </div>
        })}</div>
      </>}

      {flagged.length>0&&<><div className="sh" style={{color:'var(--red)'}}>⚠ Review</div><div className="gc fu s2">{flagged.map((s,i)=><div key={s.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:17,fontWeight:500}}>{s.name}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono" style={{fontSize:15,fontWeight:600}}>{$$(Number(s.amount))}</span><span className="pill pill-r">{s.status==='duplicate'?'Duplicate':'Review'}</span></div></div>{s.notes&&<div style={{fontSize:13,color:'var(--t3)',marginTop:8}}>{s.notes}</div>}<div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{s.owner==='ben'?'👨 Ben':s.owner==='sarah'?'👩 Sarah':'👨‍👩‍👧‍👦 Family'}</div></div>)}</div></>}

      <div className="sh">Active Subscriptions</div>
      <div className="gc fu s3">{recs.filter(r=>r.status==='active').map((s,i)=><div key={s.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{flex:1}}><div style={{fontSize:17,fontWeight:500}}>{s.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{s.category} · {s.frequency} · <span style={{color:s.owner==='ben'?'var(--blue)':s.owner==='sarah'?'var(--pink, #ff375f)':'var(--green)'}}>{s.owner==='ben'?'👨 Ben':s.owner==='sarah'?'👩 Sarah':'👨‍👩‍👧‍👦 Family'}</span>{s.tags&&s.tags.length>0&&s.tags.map((tag:string,ti:number)=><span key={ti} style={{background:'var(--orange-s)',color:'var(--orange)',padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:600,marginLeft:4}}>{tag}</span>)}</div></div><span className="mono" style={{fontSize:15,fontWeight:600,marginRight:8}}>{$$(Number(s.amount))}</span>
        <button onClick={async()=>{await supabase.from('recurring_payments').update({status:'flagged'}).eq('id',s.id);await load()}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--orange-s)',color:'var(--orange)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Flag</button>
        <button onClick={async()=>{if(confirm('Cancel '+s.name+'?')){await supabase.from('recurring_payments').update({status:'cancelled'}).eq('id',s.id);await load()}}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer',marginLeft:4}}>Cancel</button>
      </div></div>)}</div>

      {/* Bills from email */}
      <div className="sh">📬 Bills from Email</div>
      <div className="gc fu s4" style={{padding:24,textAlign:'center',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}><span style={{fontSize:50}}>📸</span><div style={{fontSize:17,fontWeight:500,marginTop:10}}>Snap a Bill</div><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Fella reads it automatically</div></div>
      <div className="gc fu s5">{ebills.map((b,i)=><div key={b.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{b.vendor}</div><div className="rs">Due {new Date(b.due_date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono rr" style={{fontWeight:600}}>{$$(Number(b.amount))}</span>
        {b.status!=='paid'&&<button onClick={async()=>{await supabase.from('email_bills').update({status:'paid'}).eq('id',b.id);await load()}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--green-s)',color:'var(--green)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Paid</button>}
        {b.status==='paid'&&<span className="pill pill-g">Paid</span>}
      </div></div>)}</div>
    </div>}

    {/* ═══════ GOALS ═══════ */}
    {tab==='goals'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Goals</h2><button onClick={()=>newRow('savings_goals',{name:'',icon:'🎯',color:'#30d158',target_amount:0,current_amount:0,deadline:'',notes:''})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      {showForm==='savings_goals'&&<EditForm table="savings_goals" fields={[{key:'name',label:'Goal name'},{key:'icon',label:'Icon emoji'},{key:'target_amount',label:'Target amount',type:'number'},{key:'current_amount',label:'Saved so far',type:'number'},{key:'deadline',label:'Deadline (YYYY-MM-DD)'},{key:'notes',label:'Notes'}]}/>}
      {goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));const rem=Number(g.target_amount)-Number(g.current_amount);const dl=new Date(g.deadline);const ml=Math.max(1,(dl.getFullYear()-now.getFullYear())*12+dl.getMonth()-now.getMonth());const pm=rem/ml;const pw=pm/4.33;return<div key={g.id} className={`gc fu s${i+1}`} style={{padding:20,cursor:'pointer'}} onClick={()=>editRow('savings_goals',g,{name:g.name,icon:g.icon,color:g.color,target_amount:Number(g.target_amount),current_amount:Number(g.current_amount),deadline:g.deadline,notes:g.notes})}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}><Ring value={Number(g.current_amount)} max={Number(g.target_amount)} size={64} sw={6} color={g.color}><span style={{fontSize:26}}>{g.icon}</span></Ring><div style={{flex:1}}><div style={{fontSize:17,fontWeight:600}}>{g.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{$(Number(g.target_amount))} by {dl.toLocaleDateString('en-AU',{month:'short',year:'numeric'})}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span></div>
        <div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:g.color,borderRadius:3}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:13,color:'var(--t3)'}}><span>Saved <span className="mono" style={{color:'var(--green)',fontWeight:600}}>{$(Number(g.current_amount))}</span></span><span>Left <span className="mono" style={{fontWeight:600}}>{$(rem)}</span></span></div>
        <div style={{marginTop:12,background:'var(--orange-s)',borderRadius:10,padding:'10px 14px',fontSize:14}}>Save <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pw)}/wk</span> or <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pm)}/mo</span></div>
      </div>})}
    </div>}

    {/* ═══════ KIDS ═══════ */}
    {tab==='kids'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Cost Centres</h2><button onClick={()=>newRow('cost_centres',{name:'',icon:'👤',color:'#ff9f0a',type:'child'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>

      {showForm==='cost_centres'&&<EditForm table="cost_centres" fields={[{key:'name',label:'Name (e.g. child name)'},{key:'icon',label:'Icon emoji'},{key:'type',label:'Type',options:[{v:'child',l:'Child'},{v:'household',l:'Household'},{v:'custom',l:'Custom'}]}]}/>}

      {/* Cost Centre selector */}
      <div className="fu s1" style={{display:'flex',gap:10,overflowX:'auto',flexWrap:'wrap'}}>{ccs.map(cc=><button key={cc.id} onClick={()=>setSelectedKid(selectedKid===cc.id?null:cc.id)} style={{padding:'12px 20px',borderRadius:12,border:'none',background:selectedKid===cc.id?'var(--orange)':'var(--card)',color:selectedKid===cc.id?'#000':'var(--t2)',fontSize:16,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{cc.icon} {cc.name}</button>)}
      </div>

      {/* Edit/Delete selected cost centre */}
      {selectedKid&&<div style={{display:'flex',gap:8}}>
        <button onClick={()=>{const cc=ccs.find(c=>c.id===selectedKid);if(cc)editRow('cost_centres',cc,{name:cc.name,icon:cc.icon,color:cc.color,type:'child'})}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:13,fontWeight:600,cursor:'pointer'}}>✏️ Edit</button>
        <button onClick={async()=>{if(confirm('Delete this cost centre and all its items?')){await supabase.from('cost_centre_items').delete().eq('cost_centre_id',selectedKid);await del('cost_centres',selectedKid);setSelectedKid(null)}}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:13,fontWeight:600,cursor:'pointer'}}>🗑 Delete</button>
      </div>}

      {/* Add expense to cost centre */}
      {selectedKid&&<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="sh" style={{margin:0}}>Expenses</div><button onClick={()=>setShowForm(showForm==='cci'?null:'cci')} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>{showForm==='cci'?'Cancel':'+ Add'}</button></div>
        {showForm==='cci'&&<div className="gc" style={{padding:18}}>
          <Input placeholder="What was it?" value={fd.description||''} onChange={e=>setFd({...fd,description:e.target.value})}/>
          <Input placeholder="Amount" type="number" value={fd.cci_amount??''} onChange={e=>setFd({...fd,cci_amount:e.target.value})}/>
          <Input type="date" value={fd.cci_date||new Date().toISOString().split('T')[0]} onChange={e=>setFd({...fd,cci_date:e.target.value})}/>
          <Select value={fd.cci_category||'Other'} onChange={e=>setFd({...fd,cci_category:e.target.value})}><option value="School Fees">School Fees</option><option value="Sports">Sports</option><option value="Clothing">Clothing</option><option value="Medical">Medical</option><option value="Activities">Activities</option><option value="Food">Food</option><option value="Other">Other</option></Select>
          <Btn onClick={async()=>{if(!fd.description||!fd.cci_amount)return;setSaving(true);await supabase.from('cost_centre_items').insert({cost_centre_id:selectedKid,description:fd.description,amount:parseFloat(fd.cci_amount)||0,date:fd.cci_date||new Date().toISOString().split('T')[0],category:fd.cci_category||'Other'});await load();setFd({});setShowForm(null);setSaving(false)}} disabled={saving} style={{width:'100%'}}>{saving?'Saving...':'Add Expense'}</Btn>
        </div>}

        {/* Items list */}
        <div className="gc fu s2">{ccis.filter(i=>i.cost_centre_id===selectedKid).slice(0,20).map((item,i)=><div key={item.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{item.description}</div><div className="rs">{item.category} · {new Date(item.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono rr" style={{fontWeight:600}}>{$$(Number(item.amount))}</span><button onClick={()=>del('cost_centre_items',item.id)} style={{padding:'4px 8px',borderRadius:6,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:11,cursor:'pointer'}}>✕</button></div></div>)}</div>

        {/* Total */}
        <div className="gc fu s3" style={{padding:20,textAlign:'center'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Total for {ccs.find(c=>c.id===selectedKid)?.name}</div><div className="mono" style={{fontSize:32,fontWeight:700,color:'var(--orange)'}}>{$(ccis.filter(i=>i.cost_centre_id===selectedKid).reduce((s,i)=>s+Number(i.amount),0))}</div></div>
      </>}
    </div>}


    {/* ═══════ REPORTS & EXPORT ═══════ */}
    {tab==='reports'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Reports</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>View & export your financial data</div></div>

      {/* Date Range Picker */}
      <div className="gc fu s1" style={{padding:18}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Date Range</div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{flex:1}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>From</div><Input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)} style={{marginBottom:0}}/></div>
          <div style={{flex:1}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>To</div><Input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)} style={{marginBottom:0}}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
          {[{l:'This Month',f:()=>{const s=new Date(now.getFullYear(),now.getMonth(),1);setReportFrom(s.toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'Last Month',f:()=>{const s=new Date(now.getFullYear(),now.getMonth()-1,1);const e=new Date(now.getFullYear(),now.getMonth(),0);setReportFrom(s.toISOString().split('T')[0]);setReportTo(e.toISOString().split('T')[0])}},
            {l:'This Quarter',f:()=>{const q=Math.floor(now.getMonth()/3)*3;const s=new Date(now.getFullYear(),q,1);setReportFrom(s.toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'YTD',f:()=>{setReportFrom(new Date(now.getFullYear(),0,1).toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'All Time',f:()=>{setReportFrom('2020-01-01');setReportTo(now.toISOString().split('T')[0])}}
          ].map(p=><button key={p.l} onClick={p.f} style={{padding:'8px 14px',borderRadius:10,border:'none',background:'var(--card2)',color:'var(--t2)',fontSize:13,fontWeight:600,cursor:'pointer'}}>{p.l}</button>)}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="fu s2" style={{display:'flex',gap:6,overflowX:'auto'}}>
        {[{id:'summary',l:'Summary'},{id:'spending',l:'Spending'},{id:'income_r',l:'Income'},{id:'debts_r',l:'Debts'},{id:'txlist',l:'Transactions'}].map(t=>
          <button key={t.id} onClick={()=>setReportTab(t.id)} style={{padding:'10px 16px',borderRadius:12,border:'none',background:reportTab===t.id?'var(--orange)':'var(--card)',color:reportTab===t.id?'#000':'var(--t2)',fontSize:15,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{t.l}</button>
        )}
      </div>

      {(()=>{
        const rTx=txs.filter(t=>{const d=t.date;return d>=reportFrom&&d<=reportTo})
        const rIncome=rTx.filter(t=>Number(t.amount)>0).reduce((s,t)=>s+Number(t.amount),0)
        const rExpense=rTx.filter(t=>Number(t.amount)<0).reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
        const rNet=rIncome-rExpense
        const rByCat=cats.map(c=>{const sp=rTx.filter(t=>t.category===c.name&&Number(t.amount)<0).reduce((s,t)=>s+Math.abs(Number(t.amount)),0);return{...c,spent:sp}}).filter(c=>c.spent>0).sort((a,b)=>b.spent-a.spent)

        return<>
          {/* SUMMARY */}
          {reportTab==='summary'&&<div className="fu s3" style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:4}}>Income</div><div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--green)'}}>{$(rIncome)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:4}}>Expenses</div><div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>{$(rExpense)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:4}}>Net</div><div className="mono" style={{fontSize:24,fontWeight:700,color:rNet>=0?'var(--green)':'var(--red)'}}>{$(rNet)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:4}}>Transactions</div><div className="mono" style={{fontSize:24,fontWeight:700}}>{rTx.length}</div></div>
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Top Categories</div>
              {rByCat.slice(0,6).map((c,i)=><div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:15}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:15,fontWeight:600}}>{$(c.spent)}</span></div>)}
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Debts Snapshot</div>
              {debts.map((d,i)=>{const prog=pc(Number(d.original_amount)-Number(d.current_balance),Number(d.original_amount));return<div key={d.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:15}}>{d.name}</span><span className="mono" style={{fontSize:15}}><span style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span> <span style={{color:'var(--green)',fontSize:12}}>{prog}%</span></span></div>})}
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Goals Progress</div>
              {goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));return<div key={g.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:15}}>{g.icon} {g.name}</span><span className="mono" style={{fontSize:15}}>{$(Number(g.current_amount))} <span style={{color:'var(--t3)',fontSize:12}}>/ {$(Number(g.target_amount))}</span></span></div>})}
            </div>
          </div>}

          {/* SPENDING */}
          {reportTab==='spending'&&<div className="fu s3"><div className="gc">{rByCat.map((c,i)=>{const maxSp=Math.max(...rByCat.map(x=>x.spent),1);return<div key={c.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:15,fontWeight:500}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:14,fontWeight:600}}>{$(c.spent)}</span></div><div className="pbar" style={{height:8,borderRadius:4}}><div className="pfill" style={{width:`${(c.spent/maxSp)*100}%`,background:c.color,borderRadius:4}}/></div></div>})}</div></div>}

          {/* INCOME */}
          {reportTab==='income_r'&&<div className="fu s3"><div className="gc">{incs.map((inc,i)=><div key={inc.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg="var(--green)" ch="💰"/><div className="rb"><div className="rt">{inc.name}</div><div className="rs">{inc.type.replace('_',' ')} · {inc.frequency}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--green)'}}>{$$(Number(inc.amount))}</span></div>)}</div>
            <div className="gc" style={{padding:18,textAlign:'center',marginTop:12}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:4}}>Period Income</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--green)'}}>{$(rIncome)}</div></div>
          </div>}

          {/* DEBTS */}
          {reportTab==='debts_r'&&<div className="fu s3"><div className="gc">{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div><div style={{fontSize:17,fontWeight:500}}>{d.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{d.lender}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}% paid</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:13,color:'var(--t3)'}}><span>Remaining: <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span>{$$(Number(d.monthly_payment))}/mo</span></div></div>})}</div></div>}

          {/* TRANSACTION LIST */}
          {reportTab==='txlist'&&<div className="fu s3"><div className="gc">{rTx.length===0?<div style={{padding:20,textAlign:'center',color:'var(--t3)'}}>No transactions in this period</div>:rTx.map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{tx.description}</div><div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span></div>)}</div></div>}

          {/* PRINT / EXPORT */}
          <div className="fu s4" style={{display:'flex',gap:10}}>
            <button onClick={()=>window.print()} style={{flex:1,padding:'16px',borderRadius:14,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:700,cursor:'pointer'}}>🖨️ Print / Save as PDF</button>
          </div>
          <div style={{fontSize:13,color:'var(--t3)',textAlign:'center'}}>Use your browser's print dialog to save as PDF. On iPhone: Share → Print → pinch-to-zoom the preview → Share → Save to Files</div>
        </>
      })()}
    </div>}
    {/* ═══════ SETTINGS ═══════ */}
    {tab==='settings'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Settings</h2></div>

      <div className="fu s1" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>{[
        {id:'connections',l:'Connections',i:'🔗'},{id:'accounts',l:'Accounts',i:'🏦'},{id:'income',l:'Income',i:'💰'},{id:'recurring',l:'Recurring',i:'🔄'}
      ].map(st=><button key={st.id} onClick={()=>{setSettingsSection(st.id);setShowForm(null);setEditItem(null)}} style={{padding:'10px 16px',borderRadius:12,border:'none',background:settingsSection===st.id?'var(--orange)':'var(--card)',color:settingsSection===st.id?'#000':'var(--t2)',fontSize:15,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{st.i} {st.l}</button>)}</div>

      {/* Connections */}
      {settingsSection==='connections'&&<div className="fu s2">
        <div className="sh">Data Sources</div>
        <div className="gc">{[{n:'Basiq (Bank Feeds)',s:'Not connected',c:'var(--red)',i:'🏦',d:'ME Bank, ING, Amex live feeds'},{n:'Gmail (Bills)',s:'Not connected',c:'var(--red)',i:'📬',d:'Auto-scan email for bills'},{n:'Photo OCR',s:'Ready',c:'var(--green)',i:'📸',d:'Snap bills → Fella reads them'},{n:'Fella AI',s:'Needs API key',c:'var(--orange)',i:'🤖',d:'Add ANTHROPIC_API_KEY in Vercel'},{n:'Manual Entry',s:'Active',c:'var(--green)',i:'✏️',d:'Add via Settings or Home tab'}].map((ds,i)=><div key={i} style={{padding:'16px 20px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',alignItems:'center',gap:14}}><Ico bg={ds.c} ch={ds.i}/><div style={{flex:1}}><div style={{fontSize:17,fontWeight:500}}>{ds.n}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{ds.d}</div></div><span style={{fontSize:13,color:ds.c,fontWeight:600,flexShrink:0}}>{ds.s}</span></div></div>)}</div>

        <div className="sh" style={{marginTop:20}}>Notifications</div>
        <div className="gc"><div style={{padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:17,fontWeight:500}}>Bill Reminders</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>Get alerts before bills are due</div></div><button onClick={async()=>{if('Notification' in window){const p=await Notification.requestPermission();alert(p==='granted'?'Notifications enabled!':'Blocked — enable in browser settings')}else{alert('Not supported in this browser')}}} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>Enable</button></div></div>

        <div className="sh" style={{marginTop:20,color:'var(--red)'}}>Danger Zone</div>
        <div className="gc"><div style={{padding:'16px 20px'}}><div style={{fontSize:17,fontWeight:500,marginBottom:4}}>Reset All Data</div><div style={{fontSize:13,color:'var(--t3)',marginBottom:12}}>Delete everything and start fresh. Cannot be undone.</div><button onClick={resetData} disabled={saving} style={{padding:'12px 20px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:15,fontWeight:600,cursor:'pointer'}}>{saving?'Deleting...':'🗑️ Clear All Data'}</button></div></div>
      </div>}

      {/* Accounts */}
      {settingsSection==='accounts'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Bank Accounts</div><button onClick={()=>newRow('bank_accounts',{name:'',bank:'',account_type:'transaction',balance:0})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='bank_accounts'&&<EditForm table="bank_accounts" fields={[{key:'name',label:'Account name'},{key:'bank',label:'Bank'},{key:'account_type',label:'Type',options:[{v:'transaction',l:'Transaction'},{v:'savings',l:'Savings'},{v:'credit',l:'Credit Card'},{v:'loan',l:'Loan'},{v:'mortgage',l:'Mortgage'}]},{key:'balance',label:'Balance',type:'number'}]}/>}
        <div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('bank_accounts',a,{name:a.name,bank:a.bank,account_type:a.account_type,balance:Number(a.balance)})}><Ico bg="var(--blue)" ch="🏦"/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank} · {a.account_type}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--green)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div>
      </div>}

      {/* Income */}
      {settingsSection==='income'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Income Sources</div><button onClick={()=>newRow('income_sources',{name:'',type:'salary',amount:0,frequency:'monthly'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='income_sources'&&<EditForm table="income_sources" fields={[{key:'name',label:'Name'},{key:'type',label:'Type',options:[{v:'salary',l:'Salary'},{v:'side_hustle',l:'Side Hustle'},{v:'freelance',l:'Freelance'},{v:'investment',l:'Investment'},{v:'government',l:'Government'},{v:'other',l:'Other'}]},{key:'amount',label:'Amount',type:'number'},{key:'frequency',label:'Frequency',options:[{v:'weekly',l:'Weekly'},{v:'fortnightly',l:'Fortnightly'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'},{v:'yearly',l:'Yearly'},{v:'irregular',l:'Irregular'}]}]}/>}
        <div className="gc">{incs.map((inc,i)=><div key={inc.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('income_sources',inc,{name:inc.name,type:inc.type,amount:Number(inc.amount),frequency:inc.frequency})}><Ico bg="var(--green)" ch="💰"/><div className="rb"><div className="rt">{inc.name}</div><div className="rs">{inc.type.replace('_',' ')} · {inc.frequency}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--green)'}}>{$$(Number(inc.amount))}</span></div>)}</div>
      </div>}

      {/* Recurring */}
      {settingsSection==='recurring'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Recurring Payments</div><button onClick={()=>newRow('recurring_payments',{name:'',amount:0,frequency:'monthly',category:'',status:'active',owner:'family'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='recurring_payments'&&<EditForm table="recurring_payments" fields={[{key:'name',label:'Name'},{key:'amount',label:'Amount',type:'number'},{key:'frequency',label:'Frequency',options:[{v:'weekly',l:'Weekly'},{v:'fortnightly',l:'Fortnightly'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'},{v:'yearly',l:'Yearly'}]},{key:'category',label:'Category'},{key:'status',label:'Status',options:[{v:'active',l:'Active'},{v:'flagged',l:'Flagged'},{v:'duplicate',l:'Duplicate'},{v:'cancelled',l:'Cancelled'},{v:'paused',l:'Paused'}]},{key:'owner',label:'Who',options:[{v:'family',l:'👨‍👩‍👧‍👦 Family'},{v:'ben',l:'👨 Ben'},{v:'sarah',l:'👩 Sarah'}]}]}>
          <Input placeholder="Tags (comma separated)" value={Array.isArray(fd.tags)?fd.tags.join(', '):fd.tags||''} onChange={e=>setFd({...fd,tags:e.target.value})} style={{marginBottom:0}}/>
        </EditForm>}
        <div className="gc">{recs.map((r,i)=><div key={r.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('recurring_payments',r,{name:r.name,amount:Number(r.amount),frequency:r.frequency,category:r.category,status:r.status,owner:r.owner||'family',tags:r.tags?r.tags.join(', '):''})}><Ico bg={r.status==='active'?'var(--green)':r.status==='flagged'||r.status==='duplicate'?'var(--red)':'var(--t3)'} ch="🔄"/><div className="rb"><div className="rt">{r.name}</div><div className="rs">{r.category} · {r.frequency} · {r.status} · {r.owner==='ben'?'👨':'👩‍👧‍👦'}</div></div><span className="mono rr" style={{fontWeight:600}}>{$$(Number(r.amount))}</span></div>)}</div>
      </div>}
    </div>}


    {/* ═══════ USER GUIDE ═══════ */}
    {tab==='guide'&&<div style={{padding:'0 20px 40px',display:'flex',flexDirection:'column',gap:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>User Guide</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Everything Ca$ter can do</div></div>

      {/* Quick Jump */}
      <div className="gc fu s1" style={{padding:16}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Quick Jump</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {[{l:'📊 Home',t:'home'},{l:'🎯 Budget',t:'budget'},{l:'💳 Debts',t:'debts'},{l:'🤖 Fella',t:'fella'},{l:'🔄 Subs',t:'subs'},{l:'🏖️ Goals',t:'goals'},{l:'👶 Kids',t:'kids'},{l:'📊 Reports',t:'reports'},{l:'⚙️ Settings',t:'settings'}].map(q=>
            <button key={q.t} onClick={()=>setTab(q.t)} style={{padding:'10px 16px',borderRadius:12,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:14,fontWeight:600,cursor:'pointer'}}>{q.l}</button>
          )}
        </div>
      </div>

      {/* HOME */}
      <div className="gc fu s1" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>📊 Home</div><button onClick={()=>setTab('home')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Home →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Your financial dashboard at a glance.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Net Worth',d:'Total across all accounts minus all debts. Updates automatically when you edit accounts or debts.'},
            {t:'Account Cards',d:'Shows each bank account with its current balance. Tap any account in Settings → Accounts to edit.'},
            {t:'Income / Spent / Recurring',d:'Monthly summary cards. Income calculated from your income sources. Spent totals this month\'s transactions. Recurring totals all active subscriptions.'},
            {t:'Cash Flow Chart',d:'6-month bar chart showing income vs expenses. Savings rate percentage shown in the header.'},
            {t:'+ Add Transaction',d:'Quick-add form for manual transactions. Enter description, amount (negative for expenses), date, category, and optional tags.'},
            {t:'Date Filter',d:'Use the From/To date pickers to filter transactions to any range. Shows up to 20 results when filtered.'},
            {t:'📥 CSV Export',d:'Downloads all transactions (or filtered range) as a CSV file for your accountant or spreadsheet.'},
            {t:'Tags',d:'Add comma-separated tags to transactions like "essential, tax-deductible, kids". Tags appear as blue pills on each row.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* BUDGET */}
      <div className="gc fu s2" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>🎯 Budget</div><button onClick={()=>setTab('budget')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Budget →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Track spending against monthly limits by category.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Ring Charts',d:'Each category shows a donut ring — green when under budget, orange at 75%, red at 90%+.'},
            {t:'+ Add Category',d:'Create new budget categories with a name, emoji icon, and monthly limit.'},
            {t:'Tap to Edit',d:'Tap any category to change its name, icon, or monthly limit. Delete categories you don\'t need.'},
            {t:'Spending Calculation',d:'Spending is calculated from this month\'s transactions that match the category name. Make sure your transaction categories match your budget categories.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* DEBTS */}
      <div className="gc fu s3" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>💳 Debts</div><button onClick={()=>setTab('debts')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Debts →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Track and pay down everything you owe.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Total Remaining',d:'Big red number showing total debt across credit cards, loans, BNPL, fines, etc.'},
            {t:'Progress Bars',d:'Each debt shows how much you\'ve paid off as a percentage of the original amount.'},
            {t:'+ Add Debt',d:'Add any debt — credit card, car loan, mortgage, BNPL, fine, or other. Set the original amount, current balance, interest rate, and monthly payment.'},
            {t:'Tap to Edit',d:'Tap any debt to update the balance, increase payments, or delete when paid off.'},
            {t:'Types',d:'Credit Card, Personal Loan, Car Loan, Mortgage, BNPL (Buy Now Pay Later), Fine, Other.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* FELLA */}
      <div className="gc fu s4" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>🤖 Fella</div><button onClick={()=>setTab('fella')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Fella →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Your AI finance assistant. Named after Rockefeller.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Text Chat',d:'Type questions like "Can we afford Byron Bay in October?" or "Where are we wasting money?" Fella sees all your financial data and gives personalised answers.'},
            {t:'Voice Input',d:'Tap the 🎙 button and speak. Uses your phone\'s speech recognition (works best in Chrome/Safari). Say things like "We spent $200 on dinner last night."'},
            {t:'Photo Upload',d:'Tap the 📷 button to snap a photo of a bill or receipt. In the full version, Fella will OCR it and extract the amount, vendor, and due date.'},
            {t:'Suggested Questions',d:'When the chat is empty, tap any suggested question to get started.'},
            {t:'⚠️ Requires API Key',d:'Fella needs an ANTHROPIC_API_KEY set in Vercel environment variables. Without it, chat will error. Get a key from console.anthropic.com.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* SUBS & BILLS */}
      <div className="gc fu s5" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>🔄 Subs & Bills</div><button onClick={()=>setTab('subs')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Subs & Bills →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>All recurring costs and incoming bills in one place.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Monthly & Annual Totals',d:'See what all your subscriptions cost per month and per year combined.'},
            {t:'💰 Price Changes',d:'When a subscription changes price, Ca$ter shows the old vs new amount and how much more (or less) you\'re paying. Shows ↑ or ↓ with the difference.'},
            {t:'⚠️ Flagged / Duplicates',d:'Subscriptions marked as duplicates or flagged for review appear in a red section at the top.'},
            {t:'Ownership Labels',d:'Each subscription shows who it belongs to — 👨 Ben, 👩 Sarah, or 👨‍👩‍👧‍👦 Family. Change this in Settings → Recurring.'},
            {t:'Tags',d:'Tags appear as orange pills next to subscriptions (e.g. "entertainment", "essential"). Edit in Settings → Recurring.'},
            {t:'Quick Actions',d:'Flag or Cancel any active subscription with one tap — no need to go to Settings.'},
            {t:'Mark as Paid',d:'Bills from email have a "Paid" button to mark them as paid.'},
            {t:'📸 Snap a Bill',d:'Tap the photo card to take a picture of a paper bill. Sends to Fella for processing.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* GOALS */}
      <div className="gc fu s6" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>🏖️ Goals</div><button onClick={()=>setTab('goals')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Goals →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Set savings targets and track progress.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Ring Progress',d:'Each goal shows a donut ring with percentage complete, plus the emoji icon you chose.'},
            {t:'Save Per Week/Month',d:'Ca$ter calculates exactly how much you need to save per week or per month to hit your target by the deadline.'},
            {t:'+ Add Goal',d:'Create goals with a name, emoji, target amount, amount saved so far, deadline date, and optional notes.'},
            {t:'Tap to Edit',d:'Tap any goal to update the saved amount, change the target, or delete it.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* KIDS / COST CENTRES */}
      <div className="gc fu s7" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>👶 Cost Centres</div><button onClick={()=>setTab('kids')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Cost Centres →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Track spending per child, household area, or custom category.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'+ Add Cost Centre',d:'Create centres for each child, pet, household area, or anything you want to track separately. Set a name, emoji icon, and type (Child, Household, Custom).'},
            {t:'Select & View',d:'Tap a cost centre button to see all expenses logged against it, with a running total.'},
            {t:'+ Add Expense',d:'Add expenses to a cost centre with description, amount, date, and category (School Fees, Sports, Clothing, Medical, Activities, Food, Other).'},
            {t:'Edit & Delete',d:'Edit or delete cost centres and individual expense items. Deleting a cost centre removes all its expenses too.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* REPORTS */}
      <div className="gc fu s8" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>📊 Reports & Export</div><button onClick={()=>setTab('reports')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Reports →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Generate reports and export your data.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'Date Range',d:'Set From and To dates to filter all report data to a specific period.'},
            {t:'Quick Presets',d:'One-tap buttons for This Month, Last Month, Last 3 Months, This Year, Last FY.'},
            {t:'Report Views',d:'Switch between Summary, Spending, Income, Debts, and Transactions views.'},
            {t:'🖨 Print / PDF',d:'Tap the Print button to generate a printer-friendly version or save as PDF.'},
            {t:'📥 CSV Export',d:'Also available on the Home tab — downloads filtered transactions as a CSV file.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* SETTINGS */}
      <div className="gc fu s9" style={{padding:0}}>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:20,fontWeight:700}}>⚙️ Settings</div><button onClick={()=>setTab('settings')} style={{marginTop:8,padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer'}}>Go to Settings →</button><div style={{fontSize:14,color:'var(--t3)',marginTop:4,lineHeight:1.6}}>Manage your data and connections.</div></div>
        <div style={{padding:'12px 20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            {t:'🔗 Connections',d:'See the status of all data sources — Basiq bank feeds, Gmail bill scanner, Photo OCR, Fella AI, and Manual Entry. Enable bill notification reminders here.'},
            {t:'🏦 Accounts',d:'Add, edit, and delete bank accounts. Set the bank name, account type, and balance.'},
            {t:'💰 Income',d:'Manage income sources — salary, side hustles, freelance, etc. Set the amount and pay frequency (weekly, fortnightly, monthly, etc).'},
            {t:'🔄 Recurring',d:'Add, edit, and delete recurring payments. Set the name, amount, frequency, category, status, owner (Ben/Sarah/Family), and tags.'},
            {t:'🗑️ Clear All Data',d:'Nuclear option — deletes all demo data so you can start fresh with real numbers. Double confirmation required. Cannot be undone.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--orange)',marginLeft:4}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* COMING SOON */}
      <div className="gc fu s10" style={{padding:20}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:12}}>🚀 Coming Soon</div>
        {[
          {t:'Get Anthropic API Key',d:'Sign up at console.anthropic.com to get your key for Fella AI chat'},{t:'Basiq Bank Feeds',d:'Live transaction feed from ME Bank, ING, and Amex — auto-detects subscriptions and categorises spending.'},
          {t:'Gmail Bill Scanner',d:'Auto-reads bills from your email and logs them with amount, due date, and vendor.'},
          {t:'Photo OCR',d:'Snap a paper bill and Fella extracts the details automatically.'},
          {t:'Push Notifications',d:'Get alerted on your phone when bills are due or budgets are nearly spent.'},
          {t:'Supabase Auth',d:'Proper login for you and Sarah with magic link email. Row-level security locks data to your household.'},
          {t:'Auto Subscription Detection',d:'Fella scans bank transactions and automatically finds recurring charges you might have forgotten about.'},
        ].map((item,i)=><div key={i} style={{paddingLeft:16,borderLeft:'3px solid var(--teal, #64d2ff)',marginLeft:4,marginBottom:12}}><div style={{fontSize:15,fontWeight:600}}>{item.t}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2,lineHeight:1.5}}>{item.d}</div></div>)}
      </div>

      {/* Add to Home Screen */}
      <div className="gc fu" style={{padding:20,background:'var(--orange-s)'}}>
        <div style={{fontSize:18,fontWeight:700,color:'var(--orange)',marginBottom:8}}>📱 Add to Home Screen</div>
        <div style={{fontSize:14,color:'var(--t2)',lineHeight:1.6}}>For the best experience, add Ca$ter to your home screen:</div>
        <div style={{fontSize:14,color:'var(--t2)',lineHeight:1.8,marginTop:8}}>
          <strong>iPhone (Safari):</strong> Tap Share ↗ → Add to Home Screen<br/>
          <strong>Android (Chrome):</strong> Tap ⋮ menu → Add to Home Screen<br/>
          <strong>Desktop:</strong> Bookmark the URL or use Chrome's "Install App" option
        </div>
      </div>
    </div>}

    {/* ── More Menu ── */}
    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="more-menu" onClick={e=>e.stopPropagation()}><div className="more-handle"/>{[
      {icon:'🔄',label:'Subs & Bills',color:'var(--purple)',id:'subs'},
      {icon:'🏖️',label:'Goals',color:'var(--green)',id:'goals'},
      {icon:'👶',label:'Kids',color:'var(--pink, #ff375f)',id:'kids'},
      {icon:'📊',label:'Reports & Export',color:'var(--blue)',id:'reports'},{icon:'⚙️',label:'Settings',color:'var(--gray2, #555)',id:'settings'},{icon:'📖',label:'User Guide',color:'var(--teal, #64d2ff)',id:'guide'},
    ].map(item=><div key={item.id} className="more-item" onClick={()=>{setTab(item.id);setMore(false)}}><Ico bg={item.color} ch={item.icon} size={56}/><span style={{fontSize:22,fontWeight:500}}>{item.label}</span></div>)}
    <div className="more-item" onClick={()=>setMore(false)} style={{justifyContent:'center',padding:'20px 24px'}}><span style={{fontSize:20,color:'var(--t3)'}}>Cancel</span></div></div></div>}

    {/* ── Tab Bar ── */}
    <nav className="tbar">{[
      {id:'home',icon:'🏠',l:'Home'},
      {id:'budget',icon:'📈',l:'Budget'},
      {id:'debts',icon:'🏦',l:'Debts'},
      {id:'fella',icon:'💬',l:'Fella'},
      {id:'more',icon:'☰',l:'More'}
    ].map(t=><button key={t.id} onClick={()=>t.id==='more'?setMore(true):setTab(t.id)} className={`tab ${(tab===t.id||(t.id==='more'&&['subs','goals','kids','reports','settings','guide'].includes(tab)))?'tab-on':'tab-off'}`} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',padding:'4px 0',minWidth:56}}>
      <div className="tab-bg"><span className="tab-icon">{t.icon}</span></div>
      <span className="tab-label">{t.l}</span>
    </button>)}</nav>
  </div>
}
