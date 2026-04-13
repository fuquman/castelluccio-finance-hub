'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──
type Acc={id:string;name:string;bank:string;account_type:string;balance:number}
type Tx={id:string;date:string;description:string;amount:number;category:string;tags?:string[];cost_centre_id?:string}
type Cat={id:string;name:string;icon:string;color:string;monthly_limit:number}
type Rec={id:string;name:string;amount:number;frequency:string;category:string;status:string;notes:string;next_due_date:string;owner:string;previous_amount:number|null;price_changed_at:string|null;tags?:string[]}
type Dbt={id:string;name:string;type:string;original_amount:number;current_balance:number;interest_rate:number;monthly_payment:number;lender:string}
type Goal={id:string;name:string;icon:string;color:string;target_amount:number;current_amount:number;deadline:string;notes:string}
type Inc={id:string;name:string;type:string;amount:number;frequency:string}
type Alrt={id:string;type:string;message:string;severity:string}
type EBill={id:string;vendor:string;amount:number;due_date:string;category:string;status:string;subject:string}
type Snap={month:string;total_income:number;total_expenses:number}
type Msg={role:'user'|'assistant';text:string}
type CC={id:string;name:string;icon:string;color:string;type:string}
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
  return<input {...props} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid transparent',background:'var(--card2)',color:'var(--t1)',fontSize:18,marginBottom:10,outline:'none',fontFamily:'inherit',transition:'border-color 0.2s ease,box-shadow 0.2s ease',...(props.style||{})}} onFocus={e=>{e.currentTarget.style.borderColor='var(--orange)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(255,159,10,0.15)'}} onBlur={e=>{e.currentTarget.style.borderColor='transparent';e.currentTarget.style.boxShadow='none'}}/>
}

function Select({children,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{children:React.ReactNode}){
  return<select {...props} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid transparent',background:'var(--card2)',color:'var(--t1)',fontSize:18,marginBottom:10,outline:'none',fontFamily:'inherit',transition:'border-color 0.2s ease,box-shadow 0.2s ease',...(props.style||{})}} onFocus={e=>{e.currentTarget.style.borderColor='var(--orange)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(255,159,10,0.15)'}} onBlur={e=>{e.currentTarget.style.borderColor='transparent';e.currentTarget.style.boxShadow='none'}}>{children}</select>
}

function Btn({children,variant='primary',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'danger';children:React.ReactNode}){
  const styles={primary:{background:'var(--orange)',color:'#000'},secondary:{background:'var(--card2)',color:'var(--t3)'},danger:{background:'var(--red-s)',color:'var(--red)'}}
  return<button {...props} style={{padding:'14px 20px',borderRadius:12,border:'none',fontSize:18,fontWeight:600,cursor:'pointer',...styles[variant],...(props.style||{})}}>{children}</button>
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
  const[showWelcome,setShowWelcome]=useState(false)
  const[guideSearch,setGuideSearch]=useState('')
  const[importResult,setImportResult]=useState<any>(null)
  const[importing,setImporting]=useState(false)
  const csvRef=useRef<HTMLInputElement>(null)
  const[editItem,setEditItem]=useState<any>(null)
  const[fd,setFd]=useState<any>({})
  const[saving,setSaving]=useState(false)
  const[billMenu,setBillMenu]=useState<string|null>(null)
  const[txMenu,setTxMenu]=useState<string|null>(null)
  const[insightIdx,setInsightIdx]=useState(0)
  const carouselRef=useRef<HTMLDivElement>(null)
  const[toast,setToast]=useState<{msg:string;type:'success'|'error'|'info'}|null>(null)
  const showToast=(msg:string,type:'success'|'error'|'info'='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),2500)}
  const[refreshing,setRefreshing]=useState(false)
  const[scrolled,setScrolled]=useState(false)
  const pullRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);showToast('Refreshed!','success')}
  const[selectedKid,setSelectedKid]=useState<string|null>(null)
  const[selectedCC,setSelectedCC]=useState<string|null>(null)
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
      if((a.data||[]).length===0&&(t.data||[]).length===0)setShowWelcome(true)
    }catch(e){console.error('Load error:',e)}
    setL(false)
  }

  useEffect(()=>{
    if(typeof window!=='undefined'&&window.location.hash)window.history.replaceState(null,'',window.location.pathname)
    load()
    const onScroll=()=>setScrolled(window.scrollY>60)
    window.addEventListener('scroll',onScroll,{passive:true})
    return()=>window.removeEventListener('scroll',onScroll)
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
      await load();setShowForm(null);setEditItem(null);setFd({});showToast(id?'Updated!':'Added!','success')}catch(e){console.error(e);showToast('Something went wrong','error')}
    setSaving(false)
  }
  const del=async(table:string,id:string)=>{
    if(!confirm('Delete this item?'))return
    await supabase.from(table).delete().eq('id',id);await load();showToast('Deleted','info')
  }
  const dismiss=async(id:string)=>{
    await supabase.from('finance_alerts').update({is_dismissed:true}).eq('id',id);setAl(a=>a.filter(x=>x.id!==id));showToast('Dismissed','info')
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

  const handleCSVImport=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return
    setImporting(true);setImportResult(null)
    try{
      const text=await file.text()
      const bankName=file.name.replace(/\.csv$/i,'')
      const res=await fetch('/api/import-csv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csvText:text,bankName})})
      const data=await res.json()
      if(res.ok){
        setImportResult(data)
        await load()
        showToast(data.imported+' transactions imported!','success')
      }else{
        setImportResult({error:data.error})
        showToast(data.error||'Import failed','error')
      }
    }catch(err){showToast('Failed to read file','error')}
    setImporting(false)
    if(csvRef.current)csvRef.current.value=''
  }

  const assignCostCentre=async(txId:string,ccId:string)=>{
    await supabase.from('transactions').update({cost_centre_id:ccId}).eq('id',txId)
    // Also add to cost_centre_items for tracking
    const tx=txs.find(t=>t.id===txId)
    if(tx){
      await supabase.from('cost_centre_items').insert({
        cost_centre_id:ccId,
        description:tx.description,
        amount:Math.abs(Number(tx.amount)),
        date:tx.date,
        category:tx.category||'Other'
      })
    }
    setTxMenu(null)
    await load()
    showToast('Cost centre assigned!','success')
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
      <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>{editItem?'Edit':'Add New'}</div>
      {fields.map(f=>f.options?
        <Select key={f.key} value={fd[f.key]||''} onChange={e=>setFd({...fd,[f.key]:e.target.value})}>
          {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </Select>:
        <Input key={f.key} placeholder={f.label} type={f.type||'text'} value={fd[f.key]??''} onChange={e=>setFd({...fd,[f.key]:f.type==='number'?parseFloat(e.target.value)||0:e.target.value})}/>
      )}
      {children}
      <div style={{display:'flex',gap:10,marginTop:6}}>
        <Btn onClick={()=>save(table,fd,editItem?.id)} disabled={saving} style={{flex:1}}>{saving?'⏳ Saving...':'Save'}</Btn>
        <Btn variant="secondary" onClick={()=>{setShowForm(null);setEditItem(null)}}>Cancel</Btn>
        {editItem&&<Btn variant="danger" onClick={()=>{del(table,editItem.id);setShowForm(null);setEditItem(null)}}>Delete</Btn>}
      </div>
    </div>
  )

  // ── Loading ──
  if(loading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:24,background:'#000',margin:'0 auto'}}>
    <div style={{fontSize:100}}>💰</div>
    <div style={{fontSize:48,fontWeight:800,color:'var(--orange)',letterSpacing:-1}}>Ca$ter</div>
    <div className="brand-bar"/>
    <div style={{fontSize:18,color:'var(--t3)'}}>Loading your finances...</div>
    <div style={{display:'flex',gap:8,marginTop:8}}>
      <div className="skeleton" style={{width:60,height:8}}/>
      <div className="skeleton" style={{width:40,height:8}}/>
      <div className="skeleton" style={{width:50,height:8}}/>
    </div>
  </div>

  return<div style={{minHeight:'100dvh',paddingBottom:120,background:'#000',margin:'0 auto'}}>
    {/* Welcome / Onboarding */}
    {showWelcome&&<div className="overlay" style={{zIndex:200}} onClick={()=>setShowWelcome(false)}>
      <div style={{background:'var(--card)',borderRadius:24,margin:'10vh 20px',padding:32,maxWidth:400,marginLeft:'auto',marginRight:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:48,textAlign:'center',marginBottom:16}}>💰</div>
        <h2 style={{fontSize:28,fontWeight:800,textAlign:'center',marginBottom:8}}>Welcome to Ca$ter!</h2>
        <div style={{fontSize:18,color:'var(--t3)',textAlign:'center',lineHeight:1.6,marginBottom:24}}>Your family finance command centre. Let's get you set up.</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <button onClick={()=>{setShowWelcome(false);setTab('settings');setSettingsSection('accounts')}} style={{padding:'16px',borderRadius:14,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer'}} className="btn-press">🏦 Add Your Bank Accounts</button>
          <button onClick={()=>{setShowWelcome(false);setTab('settings');setSettingsSection('income')}} style={{padding:'16px',borderRadius:14,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:18,fontWeight:600,cursor:'pointer'}} className="btn-press">💰 Set Up Income Sources</button>
          <button onClick={()=>{setShowWelcome(false);setTab('guide')}} style={{padding:'16px',borderRadius:14,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:18,fontWeight:600,cursor:'pointer'}} className="btn-press">📖 Read the User Guide</button>
          <button onClick={()=>setShowWelcome(false)} style={{padding:'14px',borderRadius:14,border:'none',background:'transparent',color:'var(--t3)',fontSize:18,cursor:'pointer'}}>Skip — explore with demo data</button>
        </div>
      </div>
    </div>}

    {/* Pull to refresh */}
    <div style={{textAlign:'center',padding:refreshing?'12px 0':'0',height:refreshing?'auto':'0',overflow:'hidden',transition:'all 0.3s ease'}}>{refreshing&&<div style={{fontSize:18,color:'var(--t3)',fontWeight:600}}>↻ Refreshing...</div>}</div>

    {/* Toast */}
    <div className={`toast ${toast?'toast-show':''} ${toast?.type==='success'?'toast-success':toast?.type==='error'?'toast-error':'toast-info'}`}>{toast?.msg}</div>

    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handlePhoto}/>
    <input ref={csvRef} type="file" accept=".csv,.CSV" style={{display:'none'}} onChange={handleCSVImport}/>

    {/* ── Header ── */}
    <div style={{padding:scrolled?'10px 20px 12px':'16px 20px 24px',cursor:'pointer',transition:'padding 0.3s ease'}} onDoubleClick={pullRefresh}>{!scrolled&&<div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Castelluccio Family</div>}<h1 style={{fontSize:scrolled?28:42,fontWeight:800,letterSpacing:-0.7,lineHeight:1.05,transition:'font-size 0.3s ease'}}>Ca$ter</h1><div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}><span className="mono" style={{fontSize:scrolled?22:34,fontWeight:700,color:nw>=0?'var(--orange)':'var(--red)',transition:'font-size 0.3s ease'}}>{$(nw)}</span><span style={{fontSize:18,color:'var(--t3)'}}>net worth</span></div>{!scrolled&&<div className="brand-bar"/>}</div>

    {/* ── Alerts ── */}
    {alerts.length>0&&tab==='home'&&<div style={{padding:'0 20px 16px'}}>
        <div ref={carouselRef} style={{display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',msOverflowStyle:'none',paddingBottom:8}} onScroll={(e)=>{const el=e.currentTarget;const cardW=el.offsetWidth;const idx=Math.round(el.scrollLeft/cardW);setInsightIdx(idx)}}>
          {alerts.map((a,i)=><div key={a.id} style={{width:'100%',minWidth:'100%',flexShrink:0,scrollSnapAlign:'start',padding:'16px 20px',borderRadius:16,fontSize:18,lineHeight:1.55,display:'flex',gap:12,alignItems:'flex-start',background:a.severity==='danger'?'var(--red-s)':a.severity==='warning'?'var(--orange-s)':a.severity==='success'?'var(--green-s)':'var(--blue-s)',border:`1px solid ${a.severity==='danger'?'rgba(255,69,58,0.15)':a.severity==='warning'?'rgba(255,159,10,0.15)':a.severity==='success'?'rgba(48,209,88,0.15)':'rgba(10,132,255,0.15)'}`}}>
            <span style={{flex:1,color:'var(--t1)',fontWeight:500}}>{a.message}</span>
            <button onClick={()=>dismiss(a.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:18,padding:'0 2px',lineHeight:1,flexShrink:0}}>✕</button>
          </div>)}
        </div>
        {alerts.length>1&&<div style={{display:'flex',justifyContent:'center',gap:6,marginTop:10}}>{alerts.map((_,i)=><div key={i} style={{width:insightIdx===i?20:6,height:6,borderRadius:3,background:insightIdx===i?'var(--orange)':'rgba(255,255,255,0.15)',transition:'all 0.3s ease'}}/>)}</div>}
      </div>}

    {/* ═══════ HOME ═══════ */}
    {tab==='home'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      {/* Accounts */}
      <div className="fu s1"><div className="sh">Accounts</div><div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg={a.account_type==='credit'?'var(--purple)':a.account_type==='loan'?'var(--red)':a.account_type==='savings'?'var(--green)':'var(--blue)'} ch={a.account_type==='credit'?'💳':a.account_type==='loan'?'🏦':a.account_type==='savings'?'🐷':'💰'}/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--t1)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div></div>

      {/* Stats */}
      <div className="fu s2" style={{display:'flex',gap:10}}>{[['Income',$(mInc),'var(--green)'],['Spent',$(mSp),'var(--orange)'],['Recurring',$(mRec),'var(--purple)']].map(([l,v,c],i)=><div key={i} className="gc" style={{flex:1,padding:'14px 10px',textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',fontWeight:500,marginBottom:6}}>{l as string}</div><div className="mono" style={{fontSize:22,fontWeight:700,color:c as string}}>{v as string}</div></div>)}</div>

      {/* Cash Flow */}
      <div className="fu s3"><div className="sh">Cash Flow · {savingsRate}% saved</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span></div><div style={{display:'flex',alignItems:'flex-end',gap:8,height:110}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.flatMap(s=>[s.total_income,s.total_expenses]),1);return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}><div style={{display:'flex',gap:3,alignItems:'flex-end',height:88,width:'100%'}}><div style={{flex:1,borderRadius:5,height:`${(Number(d.total_income)/mx)*100}%`,background:'var(--orange)',opacity:0.85,transition:'height 0.8s'}}/><div style={{flex:1,borderRadius:5,height:`${(Number(d.total_expenses)/mx)*100}%`,background:'var(--purple)',opacity:0.5,transition:'height 0.8s'}}/></div><span style={{fontSize:11,color:'var(--t3)'}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span></div>})}</div></div></div>

      {/* Recent Transactions + Add */}
      <div className="fu s4"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div className="sh" style={{margin:0}}>Transactions</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={exportCSV} style={{padding:'10px 14px',borderRadius:12,border:'none',background:'var(--card)',color:'var(--t2)',fontSize:18,fontWeight:600,cursor:'pointer'}}>📥 CSV</button>
            <button onClick={()=>setShowForm(showForm==='tx'?null:'tx')} style={{padding:'10px 14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}} className="btn-press">{showForm==='tx'?'Cancel':'+ Add'}</button>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          <div style={{flex:1,background:'var(--card)',borderRadius:14,padding:'12px 16px',border:'1px solid var(--sep, rgba(255,255,255,0.08))'}}>
            <div style={{fontSize:12,color:'var(--t3)',fontWeight:600,marginBottom:6}}>From</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:'100%',padding:'8px 0',borderRadius:0,border:'none',background:'transparent',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/>
          </div>
          <div style={{flex:1,background:'var(--card)',borderRadius:14,padding:'12px 16px',border:'1px solid var(--sep, rgba(255,255,255,0.08))'}}>
            <div style={{fontSize:12,color:'var(--t3)',fontWeight:600,marginBottom:6}}>To</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:'100%',padding:'8px 0',borderRadius:0,border:'none',background:'transparent',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/>
          </div>
          {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom('');setDateTo('')}} style={{padding:'12px 16px',borderRadius:14,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:18,fontWeight:700,cursor:'pointer',alignSelf:'stretch',display:'flex',alignItems:'center'}}>✕</button>}
        </div>
        {showForm==='tx'&&<div className="gc" style={{padding:18,marginTop:10,marginBottom:4}}>
          <Input placeholder="What was it?" value={fd.description||''} onChange={e=>setFd({...fd,description:e.target.value})}/>
          <div style={{display:'flex',gap:8}}><Input placeholder="Amount (-ve for expense)" type="number" value={fd.amount??''} onChange={e=>setFd({...fd,amount:e.target.value})} style={{flex:1,marginBottom:8}}/><Input type="date" value={fd.date||new Date().toISOString().split('T')[0]} onChange={e=>setFd({...fd,date:e.target.value})} style={{width:140,marginBottom:8}}/></div>
          <Select value={fd.category||''} onChange={e=>setFd({...fd,category:e.target.value})}><option value="">Category...</option>{cats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}<option value="Income">Income</option></Select>
          <Input placeholder="Tags (comma separated, e.g. essential, kids)" value={fd.tags||''} onChange={e=>setFd({...fd,tags:e.target.value})}/>
          <Btn onClick={()=>save('transactions',{description:fd.description,amount:parseFloat(fd.amount)||0,category:fd.category||'Uncategorised',date:fd.date||new Date().toISOString().split('T')[0],logged_by:'manual',tags:fd.tags?fd.tags.split(',').map((t:string)=>t.trim()).filter(Boolean):[]})} disabled={saving} style={{width:'100%'}}>{saving?'⏳ Adding...':'Add'}</Btn>
        </div>}
        <div className="gc">{(dateFrom||dateTo?txs.filter(t=>(!dateFrom||t.date>=dateFrom)&&(!dateTo||t.date<=dateTo)):txs).slice(0,20).map((tx,i)=><div key={tx.id} style={{position:'relative'}}>
          <div className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>setTxMenu(txMenu===tx.id?null:tx.id)}>
            <div className="rb">
              <div className="rt">{tx.description}</div>
              <div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}
                {tx.cost_centre_id&&ccs.find(c=>c.id===tx.cost_centre_id)&&<span style={{background:'var(--purple-s, rgba(139,92,246,0.15))',color:'var(--purple, #8b5cf6)',padding:'2px 8px',borderRadius:6,fontSize:14,fontWeight:600,marginLeft:6}}>{ccs.find(c=>c.id===tx.cost_centre_id)?.icon} {ccs.find(c=>c.id===tx.cost_centre_id)?.name}</span>}
                {tx.tags&&tx.tags.length>0&&tx.tags.map((tag:string,ti:number)=><span key={ti} style={{background:'var(--blue-s)',color:'var(--blue)',padding:'2px 8px',borderRadius:5,fontSize:14,fontWeight:600,marginLeft:4}}>{tag}</span>)}
              </div>
            </div>
            <span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span>
          </div>
          {txMenu===tx.id&&<div style={{padding:'12px 18px',background:'var(--card2)',borderTop:'0.33px solid var(--sep)'}}>
            <div style={{fontSize:18,fontWeight:600,color:'var(--t3)',marginBottom:10}}>Assign Cost Centre</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {ccs.map(cc=><button key={cc.id} onClick={()=>assignCostCentre(tx.id,cc.id)} style={{padding:'8px 14px',borderRadius:10,border:tx.cost_centre_id===cc.id?'2px solid var(--orange)':'none',background:tx.cost_centre_id===cc.id?'var(--orange-s)':'var(--card)',color:'var(--t1)',fontSize:18,fontWeight:500,cursor:'pointer'}}>{cc.icon} {cc.name}</button>)}
              {tx.cost_centre_id&&<button onClick={async()=>{await supabase.from('transactions').update({cost_centre_id:null}).eq('id',tx.id);setTxMenu(null);await load()}} style={{padding:'8px 14px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:18,fontWeight:500,cursor:'pointer'}}>✕ Remove</button>}
            </div>
          </div>}
        </div>)}</div>
      </div>

      {/* Savings callout */}
      {flagged.length>0&&<div className="fu s5" style={{background:'var(--orange-s)',borderRadius:14,padding:18,display:'flex',alignItems:'center',gap:14}}><span style={{fontSize:28}}>💡</span><div><div style={{fontSize:18,fontWeight:700,color:'var(--orange)'}}>Save {$(flagged.reduce((s,r)=>s+Number(r.amount),0)*12)}/year</div><div style={{fontSize:18,color:'var(--t3)'}}>    {flagged.length} flagged subs</div></div></div>}
    </div>}

    {/* ═══════ BUDGET ═══════ */}
    {tab==='budget'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><div><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Budgets</h2><div style={{fontSize:18,color:'var(--t3)',marginTop:4}}>{$(mSp)} of {$(cats.reduce((s,c)=>s+Number(c.monthly_limit),0))} spent</div></div><button onClick={()=>newRow('budget_categories',{name:'',icon:'📁',color:'#ff9f0a',monthly_limit:0})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      {showForm==='budget_categories'&&<EditForm table="budget_categories" fields={[{key:'name',label:'Category name'},{key:'icon',label:'Icon emoji'},{key:'monthly_limit',label:'Monthly limit',type:'number'}]}/>}
      <div className="gc fu s1">{byCat.map((c,i)=><div key={c.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),gap:14,cursor:'pointer'}} onClick={()=>editRow('budget_categories',c,{name:c.name,icon:c.icon,color:c.color,monthly_limit:Number(c.monthly_limit)})}>
        <Ring value={c.spent} max={Number(c.monthly_limit)} size={52} sw={5} color={c.color}><span style={{fontSize:18}}>{c.icon}</span></Ring>
        <div className="rb"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span className="rt">{c.name}</span><span className={`pill ${c.pct>=90?'pill-r':c.pct>=75?'pill-o':'pill-g'}`} style={{fontSize:16,padding:'4px 12px',borderRadius:8}}>{c.pct}%</span></div><div className="pbar"><div className="pfill" style={{width:`${Math.min(c.pct,100)}%`,background:c.pct>90?'var(--red)':c.pct>75?'var(--orange)':c.color}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:18,color:'var(--t3)'}}><span>{$(c.spent)}</span><span>{$(Number(c.monthly_limit)-c.spent)} left</span></div></div>
      </div>)}</div>
    </div>}

    {/* ═══════ DEBTS ═══════ */}
    {tab==='debts'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Debts</h2><button onClick={()=>newRow('debts',{name:'',type:'other',original_amount:0,current_balance:0,interest_rate:0,monthly_payment:0,lender:''})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      <div className="fu s1" style={{background:'var(--red-s)',borderRadius:14,padding:20,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Total Remaining</div><div className="mono" style={{fontSize:42,fontWeight:800,color:'var(--red)'}}>{$(dbt)}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:6}}>{$(debts.reduce((s,d)=>s+Number(d.monthly_payment),0))}/mo repayments</div></div>
      {showForm==='debts'&&<EditForm table="debts" fields={[{key:'name',label:'Name'},{key:'type',label:'Type',options:[{v:'credit_card',l:'Credit Card'},{v:'personal_loan',l:'Personal Loan'},{v:'car_loan',l:'Car Loan'},{v:'mortgage',l:'Mortgage'},{v:'bnpl',l:'BNPL'},{v:'fine',l:'Fine'},{v:'other',l:'Other'}]},{key:'original_amount',label:'Original amount',type:'number'},{key:'current_balance',label:'Current balance',type:'number'},{key:'interest_rate',label:'Interest rate %',type:'number'},{key:'monthly_payment',label:'Monthly payment',type:'number'},{key:'lender',label:'Lender'}]}/>}
      <div className="gc fu s2">{debts.length===0?<div className="empty-state"><div className="empty-icon">🎉</div><div className="empty-title">No debts!</div><div className="empty-desc">You're debt-free. Nice one!</div></div>:null}{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('debts',d,{name:d.name,type:d.type,original_amount:Number(d.original_amount),current_balance:Number(d.current_balance),interest_rate:Number(d.interest_rate),monthly_payment:Number(d.monthly_payment),lender:d.lender})}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div><div style={{fontSize:20,fontWeight:700}}>{d.name}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{d.lender}{Number(d.interest_rate)>0?` · ${d.interest_rate}%`:''}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`} style={{fontSize:18,padding:'6px 14px',borderRadius:10}}>{prog}%</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:18,color:'var(--t3)'}}><span>Left <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span><span className="mono" style={{fontWeight:600}}>{$$(Number(d.monthly_payment))}</span>/mo</span></div></div>})}</div>
    </div>}

    {/* ═══════ FELLA ═══════ */}
    {tab==='fella'&&<div className="tab-content" style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 110px)',padding:'0 20px'}}>
      <div className="fu" style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><Ico bg="var(--orange)" ch="🤖" size={56}/><div><div style={{fontSize:28,fontWeight:800}}>Fella</div><div style={{fontSize:18,color:'var(--t3)'}}>Voice + Text · Your money brain</div></div></div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingBottom:8}}>
        {chat.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}><div className={m.role==='user'?'cb-u':'cb-a'}>{m.text}</div></div>)}
        {sending&&<div style={{display:'flex'}}><div className="cb-a" style={{color:'var(--t3)'}}>Thinking...</div></div>}
        {chat.length===1&&!sending&&<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:16}}>
          <div style={{fontSize:18,color:'var(--t3)',fontWeight:600}}>Try asking...</div>
          {[{i:'🏖️',q:"Can we afford Byron Bay in October? What do we need to save each week?"},{i:'💸',q:"Where are we wasting money? Find subscriptions we should cut"},{i:'📸',q:"I just took a photo of a bill — can you help me log it?"}].map((ex,j)=><button key={j} onClick={()=>setCI(ex.q)} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'16px 18px',background:'var(--card)',border:'none',borderRadius:14,cursor:'pointer',textAlign:'left'}}><span style={{fontSize:32,flexShrink:0}}>{ex.i}</span><span style={{fontSize:18,color:'var(--t2)',lineHeight:1.45}}>{ex.q}</span></button>)}
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
    {tab==='subs'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Subs & Bills</h2></div>
      <div className="fu s1" style={{display:'flex',gap:10}}><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:6}}>Monthly</div><div className="mono" style={{fontSize:28,fontWeight:700}}>{$(mRec)}</div></div><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:6}}>Annual</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(mRec*12)}</div></div></div>

      {/* Price Changes */}
      {recs.filter(r=>r.previous_amount&&r.previous_amount!==Number(r.amount)).length>0&&<>
        <div className="sh" style={{color:'var(--blue)'}}>💰 Price Changes</div>
        <div className="gc fu s2">{recs.filter(r=>r.previous_amount&&r.previous_amount!==Number(r.amount)).map((r,i)=>{
          const diff=Number(r.amount)-Number(r.previous_amount);const up=diff>0
          return<div key={r.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:18,fontWeight:500}}>{r.name}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{r.price_changed_at?new Date(r.price_changed_at).toLocaleDateString('en-AU',{month:'short',year:'numeric'}):''}</div></div>
              <div style={{textAlign:'right'}}><div style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{fontSize:18,color:'var(--t3)',textDecoration:'line-through'}}>{$$(Number(r.previous_amount))}</span><span style={{fontSize:18}}>→</span><span className="mono" style={{fontSize:18,fontWeight:600}}>{$$(Number(r.amount))}</span></div>
                <span className={`pill ${up?'pill-r':'pill-g'}`}>{up?'↑':'↓'} {$$(Math.abs(diff))}/mo</span>
              </div>
            </div>
          </div>
        })}</div>
      </>}

      {flagged.length>0&&<><div className="sh" style={{color:'var(--red)'}}>⚠ Review</div><div className="gc fu s2">{flagged.map((s,i)=><div key={s.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:18,fontWeight:600}}>{s.name}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono" style={{fontSize:18,fontWeight:600}}>{$$(Number(s.amount))}</span><span className="pill pill-r">{s.status==='duplicate'?'Duplicate':'Review'}</span></div></div>{s.notes&&<div style={{fontSize:18,color:'var(--t3)',marginTop:8}}>{s.notes}</div>}<div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{s.owner==='ben'?'👨 Ben':s.owner==='sarah'?'👩 Sarah':'👨‍👩‍👧‍👦 Family'}</div></div>)}</div></>}

      <div className="sh">Active Subscriptions</div>
      {recs.filter(r=>r.status==='active').length===0&&<div className="gc"><div className="empty-state"><div className="empty-icon">🔄</div><div className="empty-title">No active subscriptions</div><div className="empty-desc">Add recurring payments in Settings</div></div></div>}
      <div className="gc fu s3">{recs.filter(r=>r.status==='active').map((s,i)=><div key={s.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div style={{flex:1,minWidth:0,paddingRight:12}}>
            <div style={{fontSize:18,fontWeight:700}}>{s.name}</div>
            <div style={{fontSize:16,color:'var(--t3)',marginTop:4}}>{s.category} · {s.frequency}</div>
          </div>
          <span className="mono" style={{fontSize:20,fontWeight:700,flexShrink:0}}>{$$(Number(s.amount))}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{color:s.owner==='ben'?'var(--blue)':s.owner==='sarah'?'var(--pink, #ff375f)':'var(--green)',fontSize:16,fontWeight:600}}>{s.owner==='ben'?'👨 Ben':s.owner==='sarah'?'👩 Sarah':'👨‍👩‍👧‍👦 Family'}</span>
            {s.tags&&s.tags.length>0&&s.tags.map((tag:string,ti:number)=><span key={ti} style={{background:'var(--orange-s)',color:'var(--orange)',padding:'2px 8px',borderRadius:5,fontSize:13,fontWeight:600}}>{tag}</span>)}
          </div>
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <button onClick={async()=>{await supabase.from('recurring_payments').update({status:'flagged'}).eq('id',s.id);await load();showToast('Flagged','info')}} className="btn-press" style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange-s)',color:'var(--orange)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Flag</button>
            <button onClick={async()=>{if(confirm('Cancel '+s.name+'?')){await supabase.from('recurring_payments').update({status:'cancelled'}).eq('id',s.id);await load();showToast('Cancelled','info')}}} className="btn-press" style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>)}</div>

      {/* Bills from email */}
      <div className="sh">📬 Bills from Email</div>
      <div className="gc fu s4" style={{padding:24,textAlign:'center',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}><span style={{fontSize:50}}>📸</span><div style={{fontSize:18,fontWeight:500,marginTop:10}}>Snap a Bill</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4}}>Fella reads it automatically</div></div>
      <div className="gc fu s5">{ebills.map((b,i)=><div key={b.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{b.vendor}</div><div className="rs">Due {new Date(b.due_date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono rr" style={{fontWeight:600}}>{$$(Number(b.amount))}</span>
        {b.status!=='paid'&&<button onClick={async()=>{await supabase.from('email_bills').update({status:'paid'}).eq('id',b.id);await load()}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--green-s)',color:'var(--green)',fontSize:18,fontWeight:600,cursor:'pointer'}}>Paid</button>}
        {b.status==='paid'&&<span className="pill pill-g">Paid</span>}
      </div></div>)}</div>
    </div>}

    {/* ═══════ GOALS ═══════ */}
    {tab==='goals'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Goals</h2><button onClick={()=>newRow('savings_goals',{name:'',icon:'🎯',color:'#30d158',target_amount:0,current_amount:0,deadline:'',notes:''})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
      {showForm==='savings_goals'&&<EditForm table="savings_goals" fields={[{key:'name',label:'Goal name'},{key:'icon',label:'Icon emoji'},{key:'target_amount',label:'Target amount',type:'number'},{key:'current_amount',label:'Saved so far',type:'number'},{key:'deadline',label:'Deadline (YYYY-MM-DD)'},{key:'notes',label:'Notes'}]}/>}
      {goals.length===0&&<div className="gc" style={{padding:0}}><div className="empty-state"><div className="empty-icon">🏖️</div><div className="empty-title">No goals yet</div><div className="empty-desc">Tap + Add to set your first savings target</div></div></div>}{goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));const rem=Number(g.target_amount)-Number(g.current_amount);const dl=new Date(g.deadline);const ml=Math.max(1,(dl.getFullYear()-now.getFullYear())*12+dl.getMonth()-now.getMonth());const pm=rem/ml;const pw=pm/4.33;return<div key={g.id} className={`gc fu s${i+1}`} style={{padding:20,cursor:'pointer'}} onClick={()=>editRow('savings_goals',g,{name:g.name,icon:g.icon,color:g.color,target_amount:Number(g.target_amount),current_amount:Number(g.current_amount),deadline:g.deadline,notes:g.notes})}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}><Ring value={Number(g.current_amount)} max={Number(g.target_amount)} size={64} sw={6} color={g.color}><span style={{fontSize:26}}>{g.icon}</span></Ring><div style={{flex:1}}><div style={{fontSize:18,fontWeight:600}}>{g.name}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{$(Number(g.target_amount))} by {dl.toLocaleDateString('en-AU',{month:'short',year:'numeric'})}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`} style={{fontSize:18,padding:'6px 14px',borderRadius:10}}>{prog}%</span></div>
        <div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:g.color,borderRadius:3}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:18,color:'var(--t3)'}}><span>Saved <span className="mono" style={{color:'var(--green)',fontWeight:600}}>{$(Number(g.current_amount))}</span></span><span>Left <span className="mono" style={{fontWeight:600}}>{$(rem)}</span></span></div>
        <div style={{marginTop:12,background:'var(--orange-s)',borderRadius:10,padding:'12px 16px',fontSize:18}}>Save <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pw)}/wk</span> or <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pm)}/mo</span></div>
      </div>})}
    </div>}

    {/* ═══════ KIDS ═══════ */}
    {tab==='kids'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Breakdowns</h2></div>

      {/* Kid profile cards */}
      {ccs.filter(c=>c.type==='child').map((cc,i)=>{
        const total=ccis.filter(item=>item.cost_centre_id===cc.id).reduce((s,item)=>s+Number(item.amount),0)
        const items=ccis.filter(item=>item.cost_centre_id===cc.id)
        const isOpen=selectedKid===cc.id
        return<div key={cc.id} className={`gc fu s${i+1}`} style={{overflow:'hidden'}}>
          <div style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:16,cursor:'pointer'}} onClick={()=>setSelectedKid(isOpen?null:cc.id)}>
            <div style={{fontSize:40}}>{cc.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:700}}>{cc.name}</div>
              <div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{items.length} expense{items.length!==1?'s':''}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="mono" style={{fontSize:22,fontWeight:700,color:total>0?'var(--orange)':'var(--t3)'}}>{total>0?$(total):'$0'}</div>
            </div>
            <div style={{fontSize:18,color:'var(--t3)',marginLeft:4,transition:'transform 0.3s',transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>›</div>
          </div>

          {isOpen&&<div style={{borderTop:'0.33px solid var(--sep)'}}>
            {/* Add expense */}
            <div style={{padding:'12px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:18,color:'var(--t3)',fontWeight:600}}>Expenses</span>
              <button onClick={e=>{e.stopPropagation();setShowForm(showForm==='cci'?null:'cci')}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}} className="btn-press">{showForm==='cci'?'Cancel':'+ Add'}</button>
            </div>

            {showForm==='cci'&&<div style={{padding:'0 20px 16px'}}>
              <Input placeholder="What was it?" value={fd.description||''} onChange={e=>setFd({...fd,description:e.target.value})}/>
              <Input placeholder="Amount" type="number" value={fd.cci_amount??''} onChange={e=>setFd({...fd,cci_amount:e.target.value})}/>
              <Input type="date" value={fd.cci_date||new Date().toISOString().split('T')[0]} onChange={e=>setFd({...fd,cci_date:e.target.value})}/>
              <Select value={fd.cci_category||'Other'} onChange={e=>setFd({...fd,cci_category:e.target.value})}><option value="School Fees">School Fees</option><option value="Sports">Sports</option><option value="Clothing">Clothing</option><option value="Medical">Medical</option><option value="Activities">Activities</option><option value="Food">Food</option><option value="Other">Other</option></Select>
              <Btn onClick={async()=>{if(!fd.description||!fd.cci_amount)return;setSaving(true);await supabase.from('cost_centre_items').insert({cost_centre_id:cc.id,description:fd.description,amount:parseFloat(fd.cci_amount)||0,date:fd.cci_date||new Date().toISOString().split('T')[0],category:fd.cci_category||'Other'});await load();setFd({});setShowForm(null);setSaving(false);showToast('Expense added!','success')}} disabled={saving} style={{width:'100%'}}>{saving?'Adding...':'Add Expense'}</Btn>
            </div>}

            {/* Expense list */}
            {items.length>0?items.slice(0,10).map((item,j)=><div key={item.id} style={{padding:'14px 20px',display:'flex',alignItems:'center',...(j>0||showForm==='cci'?{borderTop:'0.33px solid var(--sep)'}:{})}}>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:500}}>{item.description}</div>
                <div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{item.category} · {new Date(item.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
              </div>
              <span className="mono" style={{fontSize:18,fontWeight:600}}>{$$(Number(item.amount))}</span>
            </div>):<div style={{padding:'24px 20px',textAlign:'center',color:'var(--t3)',fontSize:18}}>No expenses yet</div>}
          </div>}
        </div>
      })}

      {ccs.filter(c=>c.type==='child').length===0&&<div className="gc"><div className="empty-state"><div className="empty-icon">👶</div><div className="empty-title">No kids added yet</div><div className="empty-desc" style={{fontSize:18}}>Add children in Settings → Cost Centres</div></div></div>}

      {/* ── Spending Breakdown ── */}
      <div className="sh" style={{marginTop:8}}>Spending Breakdown</div>

      {ccs.filter(c=>c.type!=='child').map((cc,i)=>{
        const ccTotal=ccis.filter(item=>item.cost_centre_id===cc.id).reduce((s,item)=>s+Number(item.amount),0)
        const txTotal=txs.filter(t=>t.cost_centre_id===cc.id).reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
        const total=ccTotal+txTotal
        const allItems=[...ccis.filter(item=>item.cost_centre_id===cc.id),...txs.filter(t=>t.cost_centre_id===cc.id).map(t=>({id:t.id,cost_centre_id:t.cost_centre_id||'',date:t.date,description:t.description,amount:Math.abs(Number(t.amount)),category:t.category||'Other'}))]
        const isOpen=selectedCC===cc.id
        return<div key={cc.id} className={`gc fu s${i+10}`} style={{overflow:'hidden',marginBottom:8}}>
          <div style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:18,cursor:'pointer'}} onClick={()=>setSelectedCC(isOpen?null:cc.id)}>
            <span style={{fontSize:32}}>{cc.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:700}}>{cc.name}</div>
              <div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{allItems.length} item{allItems.length!==1?'s':''}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="mono" style={{fontSize:22,fontWeight:700,color:total>0?'var(--orange)':'var(--t3)'}}>{total>0?$(total):'$0'}</div>
            </div>
            <div style={{fontSize:18,color:'var(--t3)',marginLeft:4,transition:'transform 0.3s',transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>&rsaquo;</div>
          </div>

          {isOpen&&<div style={{borderTop:'0.33px solid var(--sep)'}}>
            {allItems.length>0?allItems.slice(0,10).map((item,j)=><div key={item.id} style={{padding:'18px 20px',display:'flex',alignItems:'center',...(j>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:500}}>{item.description}</div>
                <div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{item.category} &middot; {new Date(item.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
              </div>
              <span className="mono" style={{fontSize:18,fontWeight:600}}>{$$(Number(item.amount))}</span>
            </div>):<div style={{padding:'24px 20px',textAlign:'center',color:'var(--t3)',fontSize:18}}>No expenses yet &mdash; assign transactions from Home</div>}
          </div>}
        </div>
      })}

    </div>}

    {/* ═══════ REPORTS & EXPORT ═══════ */}
    {tab==='reports'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Reports</h2><div style={{fontSize:18,color:'var(--t3)',marginTop:4}}>View & export your financial data</div></div>

      {/* Date Range Picker */}
      <div className="fu s1">
        <div style={{display:'flex',gap:10,marginBottom:10}}>
          <div style={{flex:1,background:'var(--card)',borderRadius:14,padding:'12px 16px',border:'1px solid var(--sep, rgba(255,255,255,0.08))'}}>
            <div style={{fontSize:12,color:'var(--t3)',fontWeight:600,marginBottom:6}}>From</div>
            <input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)} style={{width:'100%',padding:'8px 0',border:'none',background:'transparent',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/>
          </div>
          <div style={{flex:1,background:'var(--card)',borderRadius:14,padding:'12px 16px',border:'1px solid var(--sep, rgba(255,255,255,0.08))'}}>
            <div style={{fontSize:12,color:'var(--t3)',fontWeight:600,marginBottom:6}}>To</div>
            <input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)} style={{width:'100%',padding:'8px 0',border:'none',background:'transparent',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
          {[{l:'This Month',f:()=>{const s=new Date(now.getFullYear(),now.getMonth(),1);setReportFrom(s.toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'Last Month',f:()=>{const s=new Date(now.getFullYear(),now.getMonth()-1,1);const e=new Date(now.getFullYear(),now.getMonth(),0);setReportFrom(s.toISOString().split('T')[0]);setReportTo(e.toISOString().split('T')[0])}},
            {l:'This Quarter',f:()=>{const q=Math.floor(now.getMonth()/3)*3;const s=new Date(now.getFullYear(),q,1);setReportFrom(s.toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'YTD',f:()=>{setReportFrom(new Date(now.getFullYear(),0,1).toISOString().split('T')[0]);setReportTo(now.toISOString().split('T')[0])}},
            {l:'All Time',f:()=>{setReportFrom('2020-01-01');setReportTo(now.toISOString().split('T')[0])}}
          ].map(p=><button key={p.l} onClick={p.f} style={{padding:'8px 14px',borderRadius:10,border:'none',background:'var(--card2)',color:'var(--t2)',fontSize:18,fontWeight:600,cursor:'pointer'}}>{p.l}</button>)}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="fu s2" style={{display:'flex',gap:6,overflowX:'auto'}}>
        {[{id:'summary',l:'Summary'},{id:'spending',l:'Spending'},{id:'income_r',l:'Income'},{id:'debts_r',l:'Debts'},{id:'txlist',l:'Transactions'}].map(t=>
          <button key={t.id} onClick={()=>setReportTab(t.id)} style={{padding:'10px 16px',borderRadius:12,border:'none',background:reportTab===t.id?'var(--orange)':'var(--card)',color:reportTab===t.id?'#000':'var(--t2)',fontSize:18,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{t.l}</button>
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
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Income</div><div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--green)'}}>{$(rIncome)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Expenses</div><div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>{$(rExpense)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Net</div><div className="mono" style={{fontSize:24,fontWeight:700,color:rNet>=0?'var(--green)':'var(--red)'}}>{$(rNet)}</div></div>
              <div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Transactions</div><div className="mono" style={{fontSize:24,fontWeight:700}}>{rTx.length}</div></div>
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Top Categories</div>
              {rByCat.slice(0,6).map((c,i)=><div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:18,fontWeight:500}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:18,fontWeight:600}}>{$(c.spent)}</span></div>)}
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Debts Snapshot</div>
              {debts.map((d,i)=>{const prog=pc(Number(d.original_amount)-Number(d.current_balance),Number(d.original_amount));return<div key={d.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:18,fontWeight:500}}>{d.name}</span><span className="mono" style={{fontSize:18}}><span style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span> <span style={{color:'var(--green)',fontSize:12}}>{prog}%</span></span></div>})}
            </div>
            <div className="gc" style={{padding:18}}>
              <div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Goals Progress</div>
              {goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));return<div key={g.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><span style={{fontSize:18,fontWeight:500}}>{g.icon} {g.name}</span><span className="mono" style={{fontSize:18}}>{$(Number(g.current_amount))} <span style={{color:'var(--t3)',fontSize:12}}>/ {$(Number(g.target_amount))}</span></span></div>})}
            </div>
          </div>}

          {/* SPENDING */}
          {reportTab==='spending'&&<div className="fu s3"><div className="gc">{rByCat.map((c,i)=>{const maxSp=Math.max(...rByCat.map(x=>x.spent),1);return<div key={c.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:18,fontWeight:500}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:18,fontWeight:600}}>{$(c.spent)}</span></div><div className="pbar" style={{height:8,borderRadius:4}}><div className="pfill" style={{width:`${(c.spent/maxSp)*100}%`,background:c.color,borderRadius:4}}/></div></div>})}</div></div>}

          {/* INCOME */}
          {reportTab==='income_r'&&<div className="fu s3"><div className="gc">{incs.map((inc,i)=><div key={inc.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg="var(--green)" ch="💰"/><div className="rb"><div className="rt">{inc.name}</div><div className="rs">{inc.type.replace('_',' ')} · {inc.frequency}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--green)'}}>{$$(Number(inc.amount))}</span></div>)}</div>
            <div className="gc" style={{padding:18,textAlign:'center',marginTop:12}}><div style={{fontSize:18,color:'var(--t3)',marginBottom:4}}>Period Income</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--green)'}}>{$(rIncome)}</div></div>
          </div>}

          {/* DEBTS */}
          {reportTab==='debts_r'&&<div className="fu s3"><div className="gc">{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div><div style={{fontSize:20,fontWeight:700}}>{d.name}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{d.lender}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}% paid</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:18,color:'var(--t3)'}}><span>Remaining: <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span>{$$(Number(d.monthly_payment))}/mo</span></div></div>})}</div></div>}

          {/* TRANSACTION LIST */}
          {reportTab==='txlist'&&<div className="fu s3"><div className="gc">{rTx.length===0?<div style={{padding:20,textAlign:'center',color:'var(--t3)'}}>No transactions in this period</div>:rTx.map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{tx.description}</div><div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span></div>)}</div></div>}

          {/* PRINT / EXPORT */}
          <div className="fu s4" style={{display:'flex',gap:10}}>
            <button onClick={()=>{const filtered=txs.filter(t=>t.date>=reportFrom&&t.date<=reportTo);const csv='Date,Description,Amount,Category\n'+filtered.map(t=>t.date+',"'+t.description+'",'+t.amount+',"'+(t.category||'')+'"').join('\n');const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='caster-report-'+reportFrom+'-to-'+reportTo+'.csv';a.click();URL.revokeObjectURL(url);showToast('CSV downloaded!','success')}} style={{flex:1,padding:'16px',borderRadius:14,border:'none',background:'var(--card)',color:'var(--t1)',fontSize:18,fontWeight:700,cursor:'pointer'}} className="btn-press">📥 Export CSV</button>
            <button onClick={()=>window.print()} style={{flex:1,padding:'16px',borderRadius:14,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer'}} className="btn-press">🖨️ Print / PDF</button>
          </div>
          <div style={{fontSize:18,color:'var(--t3)',textAlign:'center',lineHeight:1.5}}>CSV exports filtered transactions. Print saves the current view as PDF.</div>
        </>
      })()}
    </div>}
    {/* ═══════ SETTINGS ═══════ */}
    {tab==='settings'&&<div className="tab-content" style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Settings</h2></div>

      <div className="fu s1" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>{[
        {id:'connections',l:'Connections',i:'🔗'},{id:'accounts',l:'Accounts',i:'🏦'},{id:'income',l:'Income',i:'💰'},{id:'recurring',l:'Recurring',i:'🔄'},{id:'costcentres',l:'Cost Centres',i:'📁'}
      ].map(st=><button key={st.id} onClick={()=>{setSettingsSection(st.id);setShowForm(null);setEditItem(null)}} style={{padding:'10px 16px',borderRadius:12,border:'none',background:settingsSection===st.id?'var(--orange)':'var(--card)',color:settingsSection===st.id?'#000':'var(--t2)',fontSize:18,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{st.i} {st.l}</button>)}</div>

      {/* Connections */}
      {settingsSection==='connections'&&<div className="fu s2">
        <div className="sh">Import Bank Data</div>
        <div className="gc" style={{padding:20,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
            <span style={{fontSize:40}}>📥</span>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:700}}>Import CSV</div>
              <div style={{fontSize:16,color:'var(--t3)',marginTop:4}}>Upload a bank statement CSV from ME Bank, ING, or Amex</div>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>csvRef.current?.click()} disabled={importing} style={{flex:1,padding:'16px',borderRadius:14,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer'}} className="btn-press">{importing?'Importing...':'Choose CSV File'}</button>
          </div>
          {importResult&&<div style={{marginTop:16,padding:16,borderRadius:12,background:importResult.error?'var(--red-s)':'var(--green-s)'}}>
            {importResult.error?<div style={{fontSize:16,color:'var(--red)'}}>{importResult.error}</div>:
            <div>
              <div style={{fontSize:18,fontWeight:700,color:'var(--green)',marginBottom:4}}>Import Complete!</div>
              <div style={{fontSize:16,color:'var(--t2)'}}>
                {importResult.imported} new transactions imported<br/>
                {importResult.duplicates>0&&<>{importResult.duplicates} duplicates skipped<br/></>}
                Total in file: {importResult.total}
              </div>
            </div>}
          </div>}
          <div style={{marginTop:12,fontSize:14,color:'var(--t3)',lineHeight:1.6}}>
            How to export:<br/>
            <strong>ME Bank:</strong> Transactions → Export → CSV<br/>
            <strong>ING:</strong> Activity → Download → CSV<br/>
            <strong>Amex:</strong> Statements → Download → CSV
          </div>
        </div>
        <div className="sh">Data Sources</div>
        <div className="gc">{[{n:'Basiq (Bank Feeds)',s:'Not connected',c:'var(--red)',i:'🏦',d:'ME Bank, ING, Amex live feeds'},{n:'Gmail (Bills)',s:'Not connected',c:'var(--red)',i:'📬',d:'Auto-scan email for bills'},{n:'Photo OCR',s:'Ready',c:'var(--green)',i:'📸',d:'Snap bills → Fella reads them'},{n:'Fella AI',s:'Needs API key',c:'var(--orange)',i:'🤖',d:'Add ANTHROPIC_API_KEY in Vercel'},{n:'Manual Entry',s:'Active',c:'var(--green)',i:'✏️',d:'Add manually or import CSV from bank'}].map((ds,i)=><div key={i} style={{padding:'16px 20px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',alignItems:'center',gap:14}}><Ico bg={ds.c} ch={ds.i}/><div style={{flex:1}}><div style={{fontSize:18,fontWeight:600}}>{ds.n}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>{ds.d}</div></div><span style={{fontSize:18,color:ds.c,fontWeight:600,flexShrink:0}}>{ds.s}</span></div></div>)}</div>

        <div className="sh" style={{marginTop:20}}>Notifications</div>
        <div className="gc"><div style={{padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:18,fontWeight:600}}>Bill Reminders</div><div style={{fontSize:18,color:'var(--t3)',marginTop:2}}>Get alerts before bills are due</div></div><button onClick={async()=>{if('Notification' in window){const p=await Notification.requestPermission();alert(p==='granted'?'Notifications enabled!':'Blocked — enable in browser settings')}else{alert('Not supported in this browser')}}} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:18,fontWeight:600,cursor:'pointer'}}>Enable</button></div></div>

        <div className="sh" style={{marginTop:20,color:'var(--red)'}}>Danger Zone</div>
        <div className="gc"><div style={{padding:'16px 20px'}}><div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Reset All Data</div><div style={{fontSize:18,color:'var(--t3)',marginBottom:12}}>Delete everything and start fresh. Cannot be undone.</div><button onClick={resetData} disabled={saving} style={{padding:'12px 20px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:18,fontWeight:600,cursor:'pointer'}}>{saving?'⏳ Clearing...':'🗑️ Clear All Data'}</button></div></div>
      </div>}

      {/* Accounts */}
      {settingsSection==='accounts'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Bank Accounts</div><button onClick={()=>newRow('bank_accounts',{name:'',bank:'',account_type:'transaction',balance:0})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='bank_accounts'&&<EditForm table="bank_accounts" fields={[{key:'name',label:'Account name'},{key:'bank',label:'Bank'},{key:'account_type',label:'Type',options:[{v:'transaction',l:'Transaction'},{v:'savings',l:'Savings'},{v:'credit',l:'Credit Card'},{v:'loan',l:'Loan'},{v:'mortgage',l:'Mortgage'}]},{key:'balance',label:'Balance',type:'number'}]}/>}
        <div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('bank_accounts',a,{name:a.name,bank:a.bank,account_type:a.account_type,balance:Number(a.balance)})}><Ico bg="var(--blue)" ch="🏦"/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank} · {a.account_type}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--green)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div>
      </div>}

      {/* Income */}
      {settingsSection==='income'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Income Sources</div><button onClick={()=>newRow('income_sources',{name:'',type:'salary',amount:0,frequency:'monthly'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='income_sources'&&<EditForm table="income_sources" fields={[{key:'name',label:'Name'},{key:'type',label:'Type',options:[{v:'salary',l:'Salary'},{v:'side_hustle',l:'Side Hustle'},{v:'freelance',l:'Freelance'},{v:'investment',l:'Investment'},{v:'government',l:'Government'},{v:'other',l:'Other'}]},{key:'amount',label:'Amount',type:'number'},{key:'frequency',label:'Frequency',options:[{v:'weekly',l:'Weekly'},{v:'fortnightly',l:'Fortnightly'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'},{v:'yearly',l:'Yearly'},{v:'irregular',l:'Irregular'}]}]}/>}
        <div className="gc">{incs.map((inc,i)=><div key={inc.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('income_sources',inc,{name:inc.name,type:inc.type,amount:Number(inc.amount),frequency:inc.frequency})}><Ico bg="var(--green)" ch="💰"/><div className="rb"><div className="rt">{inc.name}</div><div className="rs">{inc.type.replace('_',' ')} · {inc.frequency}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--green)'}}>{$$(Number(inc.amount))}</span></div>)}</div>
      </div>}

      {/* Recurring */}
      {settingsSection==='recurring'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Recurring Payments</div><button onClick={()=>newRow('recurring_payments',{name:'',amount:0,frequency:'monthly',category:'',status:'active',owner:'family'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='recurring_payments'&&<EditForm table="recurring_payments" fields={[{key:'name',label:'Name'},{key:'amount',label:'Amount',type:'number'},{key:'frequency',label:'Frequency',options:[{v:'weekly',l:'Weekly'},{v:'fortnightly',l:'Fortnightly'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'},{v:'yearly',l:'Yearly'}]},{key:'category',label:'Category'},{key:'status',label:'Status',options:[{v:'active',l:'Active'},{v:'flagged',l:'Flagged'},{v:'duplicate',l:'Duplicate'},{v:'cancelled',l:'Cancelled'},{v:'paused',l:'Paused'}]},{key:'owner',label:'Who',options:[{v:'family',l:'👨‍👩‍👧‍👦 Family'},{v:'ben',l:'👨 Ben'},{v:'sarah',l:'👩 Sarah'}]}]}>
          <Input placeholder="Tags (comma separated)" value={Array.isArray(fd.tags)?fd.tags.join(', '):fd.tags||''} onChange={e=>setFd({...fd,tags:e.target.value})} style={{marginBottom:0}}/>
        </EditForm>}
        <div className="gc">{recs.map((r,i)=><div key={r.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('recurring_payments',r,{name:r.name,amount:Number(r.amount),frequency:r.frequency,category:r.category,status:r.status,owner:r.owner||'family',tags:r.tags?r.tags.join(', '):''})}><Ico bg={r.status==='active'?'var(--green)':r.status==='flagged'||r.status==='duplicate'?'var(--red)':'var(--t3)'} ch="🔄"/><div className="rb"><div className="rt">{r.name}</div><div className="rs">{r.category} · {r.frequency} · {r.status} · {r.owner==='ben'?'👨':'👩‍👧‍👦'}</div></div><span className="mono rr" style={{fontWeight:600}}>{$$(Number(r.amount))}</span></div>)}</div>
      </div>}
    </div>}


        {/* ═══════ USER GUIDE ═══════ */}
    {tab==='guide'&&<div className="tab-content" style={{padding:'0 20px 40px',display:'flex',flexDirection:'column',gap:24}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>User Guide</h2><div style={{fontSize:18,color:'var(--t3)',marginTop:4}}>Everything Ca$ter can do</div></div>

      {/* Search */}
      <div style={{position:'relative'}}>
        <input value={guideSearch} onChange={e=>setGuideSearch(e.target.value)} placeholder="Search features..." style={{width:'100%',padding:'14px 16px 14px 44px',borderRadius:14,border:'1px solid var(--sep, rgba(255,255,255,0.08))',background:'var(--card)',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}} onFocus={e=>{e.currentTarget.style.borderColor='var(--orange)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(255,159,10,0.15)'}} onBlur={e=>{e.currentTarget.style.borderColor='var(--sep, rgba(255,255,255,0.08))';e.currentTarget.style.boxShadow='none'}}/>
        <span style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',fontSize:18,opacity:0.4}}>🔍</span>
        {guideSearch&&<button onClick={()=>setGuideSearch('')} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'var(--card2)',border:'none',color:'var(--t3)',width:24,height:24,borderRadius:12,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>}
      </div>


      {/* Search Results */}
      {guideSearch&&<div className="gc" style={{padding:20}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>Results for "{guideSearch}"</div>
        {(()=>{
          const q=guideSearch.toLowerCase()
          const allItems=[
            {s:'🏠 Home',t:'home',items:[{t:'Net Worth',d:'Total across all accounts minus all debts.'},{t:'Account Cards',d:'Each bank account with current balance.'},{t:'Income / Spent / Recurring',d:'Monthly summary cards.'},{t:'Cash Flow Chart',d:'6-month income vs expenses bar chart.'},{t:'+ Add Transaction',d:'Quick-add form for manual transactions.'},{t:'Date Filter',d:'From/To date pickers to filter transactions.'},{t:'CSV Export',d:'Downloads filtered transactions as CSV.'},{t:'Tags',d:'Comma-separated tags on transactions.'}]},
            {s:'📈 Budget',t:'budget',items:[{t:'Ring Charts',d:'Donut rings for each category showing spend vs limit.'},{t:'+ Add Category',d:'Create budget categories with name, icon, limit.'},{t:'Tap to Edit',d:'Tap any category to change name, icon, or limit.'}]},
            {s:'🏦 Debts',t:'debts',items:[{t:'Total Remaining',d:'Total debt across credit cards, loans, BNPL, fines.'},{t:'Progress Bars',d:'Percentage paid off vs original amount.'},{t:'+ Add Debt',d:'Credit card, car loan, mortgage, BNPL, fine.'}]},
            {s:'💬 Fella',t:'fella',items:[{t:'Text Chat',d:'Ask about budgets, savings, spending patterns.'},{t:'Voice Input',d:'Tap mic and speak to Fella.'},{t:'Photo Upload',d:'Snap a bill photo for OCR processing.'},{t:'API Key Required',d:'Needs ANTHROPIC_API_KEY in Vercel env vars.'}]},
            {s:'🔄 Subs & Bills',t:'subs',items:[{t:'Monthly & Annual Totals',d:'Combined subscription costs.'},{t:'Price Changes',d:'Detects when a subscription changes price.'},{t:'Ownership Labels',d:'Ben, Sarah, or Family tags.'},{t:'Quick Actions',d:'Flag or cancel subscriptions with one tap.'},{t:'Mark as Paid',d:'Email bills have a paid button.'}]},
            {s:'🏖️ Goals',t:'goals',items:[{t:'Ring Progress',d:'Donut ring with percentage complete.'},{t:'Save Per Week/Month',d:'Calculates how much to save to hit target.'},{t:'+ Add Goal',d:'Name, emoji, target, saved, deadline.'}]},
            {s:'👶 Cost Centres',t:'kids',items:[{t:'+ Add Cost Centre',d:'Create centres for kids, household, custom.'},{t:'+ Add Expense',d:'Log expenses against a cost centre.'},{t:'Tap Transaction to Assign',d:'Tap any transaction on Home to assign a cost centre.'}]},
            {s:'📊 Reports',t:'reports',items:[{t:'Date Range',d:'Filter reports by date period.'},{t:'Quick Presets',d:'This Month, Last Month, Quarter, YTD, All Time.'},{t:'CSV Export',d:'Download filtered transactions as CSV.'},{t:'Print / PDF',d:'Save reports as PDF via print dialog.'}]},
            {s:'⚙️ Settings',t:'settings',items:[{t:'Connections',d:'Basiq bank feeds, Gmail, Photo OCR, Fella AI status.'},{t:'Accounts',d:'Add edit delete bank accounts.'},{t:'Income',d:'Salary, side hustles, freelance sources.'},{t:'Recurring',d:'Manage subscription payments, owner, tags.'},{t:'Clear All Data',d:'Reset and start fresh.'}]},
          ]
          const results=allItems.flatMap(section=>
            section.items.filter(item=>item.t.toLowerCase().includes(q)||item.d.toLowerCase().includes(q)||section.s.toLowerCase().includes(q))
              .map(item=>({...item,section:section.s,tab:section.t}))
          )
          return results.length===0?
            <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-title">No results</div><div className="empty-desc">Try a different search term</div></div>:
            results.map((r,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)',marginBottom:16,cursor:'pointer'}} onClick={()=>{setGuideSearch('');setTab(r.tab)}}>
              <div style={{fontSize:18,color:'var(--orange)',fontWeight:600,marginBottom:4}}>{r.section}</div>
              <div style={{fontSize:18,fontWeight:700}}>{r.t}</div>
              <div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{r.d}</div>
            </div>)
        })()}
  
      {/* Cost Centres */}
      {settingsSection==='costcentres'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Spending Cost Centres</div><button onClick={()=>newRow('cost_centres',{name:'',icon:'📁',color:'#ff9f0a',type:'spending'})} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm==='cost_centres'&&settingsSection==='costcentres'&&<EditForm table="cost_centres" fields={[{key:'name',label:'Name (e.g. Clothes, Sports)'},{key:'icon',label:'Icon emoji'},{key:'type',label:'Type',options:[{v:'spending',l:'💰 Spending'},{v:'household',l:'🏠 Household'},{v:'custom',l:'📁 Custom'},{v:'child',l:'👶 Child'}]}]}/>}
        <div className="gc">{ccs.filter(c=>c.type!=='child').map((cc,i)=><div key={cc.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>editRow('cost_centres',cc,{name:cc.name,icon:cc.icon,color:cc.color,type:cc.type||'spending'})}><Ico bg={cc.color||'var(--purple)'} ch={cc.icon}/><div className="rb"><div className="rt">{cc.name}</div><div className="rs" style={{fontSize:18}}>{cc.type}</div></div></div>)}</div>
        {ccs.filter(c=>c.type!=='child').length===0&&<div className="gc"><div className="empty-state"><div className="empty-icon">📁</div><div className="empty-title">No cost centres yet</div><div className="empty-desc">Add categories like Clothes, Sports, School to track spending</div></div></div>}
      </div>}
    </div>}

      {/* Quick Jump */}
      {!guideSearch&&<div className="gc fu s1" style={{padding:20}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>Quick Jump</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          {[{l:'🏠 Home',id:'guide-home'},{l:'📈 Budget',id:'guide-budget'},{l:'🏦 Debts',id:'guide-debts'},{l:'💬 Fella',id:'guide-fella'},{l:'🔄 Subs & Bills',id:'guide-subs'},{l:'🏖️ Goals',id:'guide-goals'},{l:'👶 Kids',id:'guide-kids'},{l:'📊 Reports',id:'guide-reports'},{l:'⚙️ Settings',id:'guide-settings'},{l:'🚀 Coming Soon',id:'guide-soon'}].map(q=>
            <button key={q.id} onClick={()=>document.getElementById(q.id)?.scrollIntoView({behavior:'smooth',block:'start'})} style={{padding:'14px 20px',borderRadius:14,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:18,fontWeight:600,cursor:'pointer'}}>{q.l}</button>
          )}
        </div>
      </div>}

      {!guideSearch&&<>{/* HOME */}
      <div id="guide-home" className="gc fu s2" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>🏠 Home</div><button onClick={()=>setTab('home')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Your financial dashboard at a glance.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Net Worth',d:'Total across all accounts minus all debts. Updates automatically.'},
            {t:'Account Cards',d:'Each bank account with current balance. Edit in Settings → Accounts.'},
            {t:'Income / Spent / Recurring',d:'Monthly summary cards calculated from your data sources.'},
            {t:'Cash Flow Chart',d:'6-month income vs expenses bar chart with savings rate.'},
            {t:'+ Add Transaction',d:'Quick-add form — description, amount (negative for expenses), date, category, and tags.'},
            {t:'Date Filter',d:'From/To date pickers to filter transactions to any range. Shows up to 20 results.'},
            {t:'📥 CSV Export',d:'Downloads filtered transactions as a CSV for your accountant.'},
            {t:'Tags',d:'Comma-separated tags like "essential, tax-deductible". Appear as blue pills.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* BUDGET */}
      <div id="guide-budget" className="gc fu s3" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>📈 Budget</div><button onClick={()=>setTab('budget')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Track spending against monthly limits by category.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Ring Charts',d:'Donut rings for each category — green under budget, orange at 75%, red at 90%+.'},
            {t:'+ Add Category',d:'Create budget categories with a name, emoji icon, and monthly limit.'},
            {t:'Tap to Edit',d:'Tap any category to change its name, icon, or limit. Delete ones you don\'t need.'},
            {t:'Auto Calculation',d:'Spending calculated from transactions matching the category name.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* DEBTS */}
      <div id="guide-debts" className="gc fu s4" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>🏦 Debts</div><button onClick={()=>setTab('debts')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Track and pay down everything you owe.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Total Remaining',d:'Big red number showing total debt across all types.'},
            {t:'Progress Bars',d:'Each debt shows percentage paid off vs original amount.'},
            {t:'+ Add Debt',d:'Credit card, car loan, mortgage, BNPL, fine — set balance, rate, and monthly payment.'},
            {t:'Tap to Edit',d:'Update balance, change payments, or delete when paid off.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* FELLA */}
      <div id="guide-fella" className="gc fu s5" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>💬 Fella</div><button onClick={()=>setTab('fella')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Your AI finance assistant. Named after Rockefeller.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Text Chat',d:'Ask "Can we afford Byron Bay?" or "Where are we wasting money?" — Fella sees all your data.'},
            {t:'Voice Input',d:'Tap 🎙 and speak. "We spent $200 on dinner last night."'},
            {t:'Photo Upload',d:'Tap 📷 to snap a bill. Fella will extract the details.'},
            {t:'⚠️ Needs API Key',d:'Add ANTHROPIC_API_KEY in Vercel environment variables. Get it from console.anthropic.com.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* SUBS & BILLS */}
      <div id="guide-subs" className="gc fu s6" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>🔄 Subs & Bills</div><button onClick={()=>setTab('subs')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>All recurring costs and incoming bills in one place.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Monthly & Annual Totals',d:'What all your subscriptions cost combined.'},
            {t:'💰 Price Changes',d:'Detects when a sub changes price. Shows old → new amount with ↑/↓ difference.'},
            {t:'⚠️ Flagged / Duplicates',d:'Subscriptions flagged for review appear in red at the top.'},
            {t:'Ownership Labels',d:'👨 Ben, 👩 Sarah, or 👨‍👩‍👧‍👦 Family. Change in Settings → Recurring.'},
            {t:'Tags',d:'Orange pills like "entertainment", "essential". Edit in Settings → Recurring.'},
            {t:'Quick Actions',d:'Flag or Cancel any subscription with one tap.'},
            {t:'Mark as Paid',d:'Email bills have a "Paid" button.'},
            {t:'📸 Snap a Bill',d:'Photo card to take a picture of a paper bill.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* GOALS */}
      <div id="guide-goals" className="gc fu s7" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>🏖️ Goals</div><button onClick={()=>setTab('goals')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Set savings targets and track progress.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Ring Progress',d:'Donut ring with percentage and your chosen emoji icon.'},
            {t:'Save Per Week/Month',d:'Calculates exactly how much to save to hit your target by the deadline.'},
            {t:'+ Add Goal',d:'Name, emoji, target, saved so far, deadline, and notes.'},
            {t:'Tap to Edit',d:'Update saved amount, change target, or delete.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* KIDS / COST CENTRES */}
      <div id="guide-kids" className="gc fu s8" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>👶 Cost Centres</div><button onClick={()=>setTab('kids')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Track spending per child, pet, or custom category.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'+ Add Cost Centre',d:'Create centres for each child, pet, or area. Name, emoji, and type.'},
            {t:'View Expenses',d:'Tap a centre to see all expenses with running total.'},
            {t:'+ Add Expense',d:'Description, amount, date, category (School Fees, Sports, Clothing, etc).'},
            {t:'Edit & Delete',d:'Edit or delete centres and individual expense items.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* REPORTS */}
      <div id="guide-reports" className="gc fu s9" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>📊 Reports</div><button onClick={()=>setTab('reports')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Generate reports and export your data.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'Date Range',d:'Set From and To dates to filter all report data.'},
            {t:'Quick Presets',d:'This Month, Last Month, Last 3 Months, This Year, Last FY.'},
            {t:'Report Views',d:'Summary, Spending, Income, Debts, and Transactions.'},
            {t:'🖨 Print / PDF',d:'Printer-friendly version or save as PDF.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* SETTINGS */}
      <div id="guide-settings" className="gc fu s10" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 24px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3}}>⚙️ Settings</div><button onClick={()=>setTab('settings')} style={{padding:'10px 20px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:18,fontWeight:600,cursor:'pointer'}}>Open →</button></div>
        <div style={{padding:'0 24px 8px',fontSize:18,color:'var(--t3)',lineHeight:1.6}}>Manage your data and connections.</div>
        <div style={{padding:'8px 24px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {[{t:'🔗 Connections',d:'Status of Basiq, Gmail, Photo OCR, Fella AI, and Manual Entry. Enable bill notifications.'},
            {t:'🏦 Accounts',d:'Add, edit, delete bank accounts. Bank name, type, and balance.'},
            {t:'💰 Income',d:'Salary, side hustles, freelance. Amount and pay frequency.'},
            {t:'🔄 Recurring',d:'Name, amount, frequency, category, status, owner, and tags.'},
            {t:'🗑️ Clear All Data',d:'Delete everything and start fresh. Double confirmation. Cannot be undone.'},
          ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--orange)'}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
        </div>
      </div>

      {/* COMING SOON */}
      <div id="guide-soon" className="gc fu" style={{padding:24}}>
        <div style={{fontSize:28,fontWeight:800,letterSpacing:-0.3,marginBottom:16}}>🚀 Coming Soon</div>
        {[{t:'Basiq Bank Feeds',d:'Live transactions from ME Bank, ING, and Amex. Auto-detects subscriptions.'},
          {t:'Gmail Bill Scanner',d:'Auto-reads bills from email with amount, due date, and vendor.'},
          {t:'Photo OCR',d:'Snap a bill and Fella extracts the details automatically.'},
          {t:'Push Notifications',d:'Phone alerts when bills are due or budgets nearly spent.'},
          {t:'Login for Sarah',d:'Magic link login. Row-level security locks data to your household.'},
          {t:'Auto Subscription Detection',d:'Fella finds recurring charges you\'ve forgotten about.'},
        ].map((item,i)=><div key={i} style={{paddingLeft:20,borderLeft:'3px solid var(--teal, #64d2ff)',marginBottom:16}}><div style={{fontSize:18,fontWeight:700}}>{item.t}</div><div style={{fontSize:18,color:'var(--t3)',marginTop:4,lineHeight:1.55}}>{item.d}</div></div>)}
      </div>

      {/* Add to Home Screen */}
      <div className="gc fu" style={{padding:24,background:'var(--orange-s)'}}>
        <div style={{fontSize:24,fontWeight:800,color:'var(--orange)',marginBottom:12}}>📱 Add to Home Screen</div>
        <div style={{fontSize:18,color:'var(--t2)',lineHeight:1.7}}>
          <strong>iPhone:</strong> Open in Safari → Share ↗ → Add to Home Screen<br/>
          <strong>Android:</strong> Chrome → ⋮ menu → Add to Home Screen<br/>
          <strong>Desktop:</strong> Bookmark or Chrome → Install App
        </div>
      </div>
    </>}
    </div>}

{/* ── More Menu ── */}
    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="more-menu" onClick={e=>e.stopPropagation()}><div className="more-handle"/>{[
      {icon:'🔄',label:'Subs & Bills',color:'var(--purple)',id:'subs'},
      {icon:'🏖️',label:'Goals',color:'var(--green)',id:'goals'},
      {icon:'📊',label:'Breakdowns',color:'var(--purple, #8b5cf6)',id:'kids'},
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
