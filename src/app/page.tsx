'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Acc={id:string;name:string;bank:string;account_type:string;balance:number}
type Tx={id:string;date:string;description:string;amount:number;category:string}
type Cat={id:string;name:string;icon:string;color:string;monthly_limit:number}
type Rec={id:string;name:string;amount:number;frequency:string;category:string;status:string;notes:string;next_due_date:string}
type Dbt={id:string;name:string;type:string;original_amount:number;current_balance:number;interest_rate:number;monthly_payment:number;lender:string}
type Goal={id:string;name:string;icon:string;color:string;target_amount:number;current_amount:number;deadline:string;notes:string}
type Inc={id:string;name:string;type:string;amount:number;frequency:string}
type Alrt={id:string;type:string;title:string;message:string;severity:string;created_at:string}
type EBill={id:string;vendor:string;amount:number;due_date:string;category:string;status:string;subject:string}
type Snap={month:string;total_income:number;total_expenses:number;net_cashflow:number}
type Msg={role:'user'|'assistant';text:string}
type CC={id:string;name:string;type:string;icon:string;color:string}
type CCI={id:string;cost_centre_id:string;date:string;description:string;amount:number;category:string}
type User={id:string;email?:string}

const $=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:0,maximumFractionDigits:0}).format(n)
const $$=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n)
const pc=(a:number,b:number)=>b>0?Math.round((a/b)*100):0

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

export default function App(){
  const[user,setUser]=useState<User|null>({id:'ben',email:'ben@castelluccio.com.au'})
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
  const[loading,setL]=useState(true)
  const[chat,setCh]=useState<Msg[]>([{role:'assistant',text:"G'day! I'm Fella \u2014 your finance brain. Ask me anything about your money."}])
  const[chatIn,setCI]=useState('')
  const[sending,setSe]=useState(false)
  const[listening,setLi]=useState(false)
  const[billMenu,setBillMenu]=useState<string|null>(null)
  const[costCentres,setCC]=useState<CC[]>([])
  const[ccItems,setCCI]=useState<CCI[]>([])
  const[selectedKid,setSelectedKid]=useState<string|null>(null)
  const[settingsTab,setSettingsTab]=useState('accounts')
  const[editItem,setEditItem]=useState<any>(null)
  const[showForm,setShowForm]=useState(false)
  const[formData,setFormData]=useState<any>({})
  const[saving,setSaving]=useState(false)
  const chatEnd=useRef<HTMLDivElement>(null)
  const[showAddTx,setShowAddTx]=useState(false)
  const[txForm,setTxForm]=useState({description:'',amount:'',category:'',date:new Date().toISOString().split('T')[0]})
  const[showReport,setShowReport]=useState(false)

  // Load all data from Supabase
  useEffect(()=>{
    // Clear any error hashes from URL
    if(window.location.hash) window.history.replaceState(null,'',window.location.pathname)
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
        setA(a.data||[]);setT(t.data||[]);setC(c.data||[])
        setR(r.data||[]);setD(d.data||[]);setG(g.data||[])
        setI(i.data||[]);setAl(al.data||[]);setE(eb.data||[])
        setS(sn.data||[])
      }catch(e){console.error('Data load error:',e)}
      setL(false)
    }
    load()
  },[])

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
  const dismiss=async(id:string)=>{await supabase.from('finance_alerts').update({is_dismissed:true}).eq('id',id);setAl(a=>a.filter(x=>x.id!==id))}
  const markPaid=async(id:string)=>{await supabase.from('email_bills').update({status:'paid'}).eq('id',id);setE(bills=>bills.map(b=>b.id===id?{...b,status:'paid'}:b));setBillMenu(null)}
  const setBillReminder=async(b:EBill)=>{if('Notification' in window){const perm=await Notification.requestPermission();if(perm==='granted'){const due=new Date(b.due_date);const now=new Date();const diff=due.getTime()-now.getTime();if(diff>0){setTimeout(()=>{new Notification('💰 Bill Due',{body:`${b.vendor} - ${$$(Number(b.amount))} is due today`,icon:'/icon-192.png'})},Math.min(diff,2147483647))}new Notification('🔔 Reminder Set',{body:`You'll be reminded about ${b.vendor} - ${$$(Number(b.amount))} on ${due.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`,icon:'/icon-192.png'})}}setBillMenu(null)}
  const voice=()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang='en-AU';r.interimResults=false;r.onstart=()=>setLi(true);r.onresult=(e:any)=>{setCI(e.results[0][0].transcript);setLi(false)};r.onerror=()=>setLi(false);r.onend=()=>setLi(false);r.start()}
  const send=async()=>{
    if(!chatIn.trim()||sending)return;const msg=chatIn.trim();setCI('');setCh(p=>[...p,{role:'user',text:msg}]);setSe(true)
    try{const sys=`You are Fella \u2014 a sharp, warm Aussie family finance assistant for the Castelluccios (Melbourne). Named after Rockefeller. DATA: Accounts:${JSON.stringify(accounts.map(a=>({n:a.name,b:a.bank,bal:a.balance})))} | NW:${$$(nw)} | MonthlyInc:${$$(mInc)} | Spent:${$$(mSp)} | Recurring:${$$(mRec)} | Budgets:${JSON.stringify(byCat.map(c=>({n:c.name,b:c.monthly_limit,s:c.spent,p:c.pct+'%'})))} | Debts:${JSON.stringify(debts.map(d=>({n:d.name,bal:d.current_balance,r:d.interest_rate})))} | Goals:${JSON.stringify(goals.map(g=>({n:g.name,t:g.target_amount,s:g.current_amount,dl:g.deadline})))} | Snapshots:${JSON.stringify(snaps)} Be direct, AUD, 2-4 sentences, casual Aussie.`;const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,systemPrompt:sys})});const d=await res.json();setCh(p=>[...p,{role:'assistant',text:d.reply||'Had a hiccup.'}])}catch{setCh(p=>[...p,{role:'assistant',text:'Connection issue \u2014 try again.'}])}
    setSe(false)
  }
  const avgInc=snaps.length?snaps.reduce((s,d)=>s+Number(d.total_income),0)/snaps.length:0
  const avgExp=snaps.length?snaps.reduce((s,d)=>s+Number(d.total_expenses),0)/snaps.length:0
  const lastSnap=snaps.length?snaps[snaps.length-1]:null
  const prevSnap=snaps.length>1?snaps[snaps.length-2]:null
  const spendChange=lastSnap&&prevSnap?Number(lastSnap.total_expenses)-Number(prevSnap.total_expenses):0
  const incChange=lastSnap&&prevSnap?Number(lastSnap.total_income)-Number(prevSnap.total_income):0
  const savingsRate=lastSnap?Math.round(((Number(lastSnap.total_income)-Number(lastSnap.total_expenses))/Number(lastSnap.total_income))*100):0


  // CRUD helpers
  const reload=async()=>{
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
  }
  const saveItem=async(table:string,data:any,id?:string)=>{
    setSaving(true)
    try{
      if(id){await supabase.from(table).update(data).eq('id',id)}
      else{await supabase.from(table).insert(data)}
      await reload()
      setShowForm(false);setEditItem(null);setFormData({})
    }catch(e){console.error(e)}
    setSaving(false)
  }
  const addTransaction=async()=>{
    if(!txForm.description||!txForm.amount)return
    setSaving(true)
    try{
      await supabase.from('transactions').insert({
        description:txForm.description,
        amount:parseFloat(txForm.amount),
        category:txForm.category||'Uncategorised',
        date:txForm.date,
        logged_by:'manual'
      })
      await reload()
      setTxForm({description:'',amount:'',category:'',date:new Date().toISOString().split('T')[0]})
      setShowAddTx(false)
    }catch(e){console.error(e)}
    setSaving(false)
  }
  const resetDemoData=async()=>{
    if(!confirm('This will delete ALL data including demo data. Are you sure?'))return
    if(!confirm('Last chance — this cannot be undone. Delete everything?'))return
    setSaving(true)
    for(const table of ['transactions','finance_alerts','fella_chat','bill_uploads','email_bills','monthly_snapshots','recurring_payments','debts','savings_goals','income_sources','budget_categories','bank_accounts','data_connections']){
      await supabase.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000')
    }
    await reload()
    setSaving(false)
  }
  const requestNotifPermission=async()=>{
    if('Notification' in window){
      const perm=await Notification.requestPermission()
      if(perm==='granted'){alert('Notifications enabled! You\'ll get alerts for upcoming bills.')}
      else{alert('Notifications blocked. Enable in your browser settings.')}
    }else{alert('Notifications not supported in this browser.')}
  }
  const deleteItem=async(table:string,id:string)=>{
    if(!confirm('Delete this item?'))return
    await supabase.from(table).delete().eq('id',id)
    await reload()
  }

  if(loading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}><div style={{fontSize:48}}>💰</div><div style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>Finance Hub</div></div>

  return<div style={{minHeight:'100dvh',paddingBottom:100,background:'#000'}}>
    <div style={{padding:'16px 20px 24px'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Castelluccio Family</div><h1 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7,lineHeight:1.05}}>Finance Hub</h1><div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}><span className="mono" style={{fontSize:34,fontWeight:700,color:nw>=0?'var(--orange)':'var(--red)'}}>{$(nw)}</span><span style={{fontSize:13,color:'var(--t3)'}}>net worth</span></div></div>

    {alerts.length>0&&tab==='home'&&<div style={{padding:'0 20px 16px',display:'flex',flexDirection:'column',gap:8}}>{alerts.slice(0,3).map((a,i)=><div key={a.id} className={`fu s${i+1}`} style={{padding:'12px 16px',borderRadius:12,fontSize:14,lineHeight:1.45,display:'flex',gap:10,alignItems:'flex-start',background:a.severity==='danger'?'var(--red-s)':a.severity==='warning'?'var(--orange-s)':a.severity==='success'?'var(--green-s)':'var(--blue-s)'}}><span style={{flex:1,color:'var(--t2)'}}>{a.message}</span><button onClick={()=>dismiss(a.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:16,padding:0}}>✕</button></div>)}</div>}

    {tab==='home'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      <div className="fu s1"><div className="sh">Accounts</div><div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg={a.account_type==='credit'?'var(--purple)':a.account_type==='loan'?'var(--red)':a.account_type==='savings'?'var(--green)':'var(--blue)'} ch={a.account_type==='credit'?'💳':a.account_type==='loan'?'🏦':a.account_type==='savings'?'🐷':'💰'}/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--t1)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div></div>
      <div className="fu s2" style={{display:'flex',gap:10}}>{[['Income',$(mInc),'var(--green)'],['Spent',$(mSp),'var(--orange)'],['Recurring',$(mRec),'var(--purple)']].map(([l,v,c],i)=><div key={i} className="gc" style={{flex:1,padding:'14px 10px',textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:c as string}}>{v}</div></div>)}</div>
      <div className="fu s3"><div className="sh">Cash Flow</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span></div><div style={{display:'flex',alignItems:'flex-end',gap:8,height:110}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.flatMap(s=>[s.total_income,s.total_expenses]),1);return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}><div style={{display:'flex',gap:3,alignItems:'flex-end',height:88,width:'100%'}}><div style={{flex:1,borderRadius:5,height:`${(d.total_income/mx)*100}%`,background:'var(--orange)',opacity:0.85,transition:'height 0.8s'}}/><div style={{flex:1,borderRadius:5,height:`${(d.total_expenses/mx)*100}%`,background:'var(--purple)',opacity:0.5,transition:'height 0.8s'}}/></div><span style={{fontSize:11,color:'var(--t3)'}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span></div>})}</div></div></div>
      <div className="fu s4"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="sh" style={{margin:0}}>Recent Transactions</div><button onClick={()=>setShowAddTx(!showAddTx)} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>{showAddTx?'Cancel':'+ Add'}</button></div>
      {showAddTx&&<div className="gc" style={{padding:18,marginTop:10,marginBottom:4}}>
        <input placeholder="What was it? (e.g. Woolworths)" value={txForm.description} onChange={e=>setTxForm({...txForm,description:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:8,outline:'none',fontFamily:'inherit'}}/>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <input placeholder="Amount (neg for expense)" type="number" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} style={{flex:1,padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,outline:'none',fontFamily:'inherit'}}/>
          <input type="date" value={txForm.date} onChange={e=>setTxForm({...txForm,date:e.target.value})} style={{padding:'14px 12px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:14,outline:'none',fontFamily:'inherit'}}/>
        </div>
        <select value={txForm.category} onChange={e=>setTxForm({...txForm,category:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:12,outline:'none',fontFamily:'inherit'}}>
          <option value="">Select category...</option>
          {cats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          <option value="Income">Income</option>
        </select>
        <button onClick={addTransaction} disabled={saving} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Add Transaction'}</button>
      </div>}
      <div className="gc">{txs.slice(0,7).map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{tx.description}</div><div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span></div>)}</div></div>
      {flagged.length>0&&<div className="fu s5" style={{background:'var(--orange-s)',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}><Ico bg="var(--orange)" ch="💡"/><div><div style={{fontSize:17,fontWeight:600,color:'var(--orange)'}}>Save {$(flagged.reduce((s,r)=>s+Number(r.amount),0)*12)}/yr</div><div style={{fontSize:13,color:'var(--t3)'}}>{flagged.length} flagged subscription{flagged.length>1?'s':''}</div></div></div>}
    </div>}

    {tab==='budget'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Budgets</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>{$(mSp)} of {$(cats.reduce((s,c)=>s+Number(c.monthly_limit),0))} spent</div></div><div className="gc fu s1">{byCat.map((c,i)=><div key={c.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),gap:14}}><Ring value={c.spent} max={Number(c.monthly_limit)} size={52} sw={5} color={c.color}><span style={{fontSize:16}}>{c.icon}</span></Ring><div className="rb"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span className="rt">{c.name}</span><span className={`pill ${c.pct>=90?'pill-r':c.pct>=75?'pill-o':'pill-g'}`}>{c.pct}%</span></div><div className="pbar"><div className="pfill" style={{width:`${Math.min(c.pct,100)}%`,background:c.pct>90?'var(--red)':c.pct>75?'var(--orange)':c.color}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:12,color:'var(--t3)'}}><span>{$(c.spent)}</span><span>{$(Number(c.monthly_limit)-c.spent)} left</span></div></div></div>)}</div></div>}

    {tab==='debts'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Debts</h2></div><div className="fu s1" style={{background:'var(--red-s)',borderRadius:14,padding:20,textAlign:'center'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Total Remaining</div><div className="mono" style={{fontSize:42,fontWeight:800,color:'var(--red)'}}>{$(dbt)}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:6}}>{$(debts.reduce((s,d)=>s+Number(d.monthly_payment),0))}/mo repayments</div></div><div className="gc fu s2">{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div><div style={{fontSize:17,fontWeight:500}}>{d.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{d.lender}{Number(d.interest_rate)>0?` · ${d.interest_rate}%`:''}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:13,color:'var(--t3)'}}><span>Left <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span><span className="mono" style={{fontWeight:600}}>{$$(Number(d.monthly_payment))}</span>/mo</span></div></div>})}</div></div>}

    {tab==='trends'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Trends</h2><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}><span style={{fontSize:15,color:'var(--t3)'}}>6-month financial overview</span><button onClick={()=>setShowReport(!showReport)} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>{showReport?'Hide Report':'📊 Report'}</button></div></div>
      {showReport&&<div className="gc fu" style={{padding:24}}>
        <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>Monthly Report</div>
        <div style={{fontSize:13,color:'var(--t3)',marginBottom:20}}>{new Date().toLocaleDateString('en-AU',{month:'long',year:'numeric'})}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
          <div style={{background:'var(--card2)',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>Income</div><div className="mono" style={{fontSize:20,fontWeight:700,color:'var(--green)'}}>{$(mInc)}</div></div>
          <div style={{background:'var(--card2)',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>Spent</div><div className="mono" style={{fontSize:20,fontWeight:700,color:'var(--orange)'}}>{$(mSp)}</div></div>
          <div style={{background:'var(--card2)',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>Net</div><div className="mono" style={{fontSize:20,fontWeight:700,color:mInc-mSp>=0?'var(--green)':'var(--red)'}}>{$(mInc-mSp)}</div></div>
          <div style={{background:'var(--card2)',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)',marginBottom:4}}>Savings Rate</div><div className="mono" style={{fontSize:20,fontWeight:700,color:savingsRate>0?'var(--green)':'var(--red)'}}>{savingsRate}%</div></div>
        </div>
        <div style={{fontSize:16,fontWeight:600,marginBottom:10}}>Top Spending</div>
        {byCat.filter(c=>c.spent>0).slice(0,5).map((c,i)=><div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<4?'0.33px solid var(--sep)':'none'}}><span style={{fontSize:15}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:15,fontWeight:600}}>{$(c.spent)}<span style={{color:'var(--t3)',fontWeight:400}}> / {$(Number(c.monthly_limit))}</span></span></div>)}
        <div style={{fontSize:16,fontWeight:600,marginTop:16,marginBottom:10}}>Debts Progress</div>
        {debts.map((d,i)=>{const prog=pc(Number(d.original_amount)-Number(d.current_balance),Number(d.original_amount));return<div key={d.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<debts.length-1?'0.33px solid var(--sep)':'none'}}><span style={{fontSize:15}}>{d.name}</span><span className="mono" style={{fontSize:15,fontWeight:600,color:'var(--red)'}}>{$$(Number(d.current_balance))}<span style={{color:'var(--green)',marginLeft:8}}>{prog}%</span></span></div>})}
        <div style={{fontSize:16,fontWeight:600,marginTop:16,marginBottom:10}}>Goals</div>
        {goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));return<div key={g.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<goals.length-1?'0.33px solid var(--sep)':'none'}}><span style={{fontSize:15}}>{g.icon} {g.name}</span><span className="mono" style={{fontSize:15,fontWeight:600}}>{$(Number(g.current_amount))}<span style={{color:'var(--t3)',marginLeft:4}}>/ {$(Number(g.target_amount))}</span></span></div>})}
      </div>}
      <div className="fu s1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>Savings Rate</div><div className="mono" style={{fontSize:28,fontWeight:800,color:savingsRate>0?'var(--green)':'var(--red)'}}>{savingsRate}%</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>of income saved</div></div><div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>Avg Monthly Spend</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(avgExp)}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>over 6 months</div></div></div>
      <div className="fu s2"><div className="sh">Month over Month</div><div className="gc"><div className="row"><Ico bg={spendChange<=0?'var(--green)':'var(--red)'} ch={spendChange<=0?'📉':'📈'}/><div className="rb"><div className="rt">Spending</div><div className="rs">vs last month</div></div><span className="mono rr" style={{fontWeight:600,color:spendChange<=0?'var(--green)':'var(--red)'}}>{spendChange<=0?'':'+'}${Math.abs(spendChange).toLocaleString()}</span></div><div className="row" style={{borderTop:'0.33px solid var(--sep)'}}><Ico bg={incChange>=0?'var(--green)':'var(--red)'} ch={incChange>=0?'📈':'📉'}/><div className="rb"><div className="rt">Income</div><div className="rs">vs last month</div></div><span className="mono rr" style={{fontWeight:600,color:incChange>=0?'var(--green)':'var(--red)'}}>{incChange>=0?'+':''}${Math.abs(incChange).toLocaleString()}</span></div><div className="row" style={{borderTop:'0.33px solid var(--sep)'}}><Ico bg="var(--blue)" ch="💵"/><div className="rb"><div className="rt">Avg Income</div><div className="rs">6 month average</div></div><span className="mono rr" style={{fontWeight:600}}>{$(avgInc)}</span></div></div></div>
      <div className="fu s3"><div className="sh">Income vs Expenses</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--green)'}}/>Saved</span></div><div style={{display:'flex',flexDirection:'column',gap:8}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.map(s=>Number(s.total_income)),1);const saved=Number(d.total_income)-Number(d.total_expenses);return<div key={i} style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:12,color:'var(--t3)',width:32,textAlign:'right',flexShrink:0}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span><div style={{flex:1,display:'flex',flexDirection:'column',gap:3}}><div style={{height:16,borderRadius:4,width:`${(Number(d.total_income)/mx)*100}%`,background:'var(--orange)',opacity:0.8}}/><div style={{display:'flex',gap:2}}><div style={{height:16,borderRadius:4,width:`${(Number(d.total_expenses)/mx)*100}%`,background:'var(--purple)',opacity:0.5}}/>{saved>0&&<div style={{height:16,borderRadius:4,width:`${(saved/mx)*100}%`,background:'var(--green)',opacity:0.6}}/>}</div></div><span className="mono" style={{fontSize:11,color:saved>=0?'var(--green)':'var(--red)',width:55,textAlign:'right',flexShrink:0,fontWeight:600}}>{saved>=0?'+':''}{$(saved)}</span></div>})}</div></div></div>
      <div className="fu s4"><div className="sh">Top Spending This Month</div><div className="gc">{byCat.filter(c=>c.spent>0).slice(0,5).map((c,i,arr)=>{const maxSp=Math.max(...arr.map(x=>x.spent),1);return<div key={c.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:15,fontWeight:500}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:14,fontWeight:600}}>{$(c.spent)}</span></div><div className="pbar" style={{height:8,borderRadius:4}}><div className="pfill" style={{width:`${(c.spent/maxSp)*100}%`,background:c.color,borderRadius:4}}/></div></div>})}</div></div>
      <div className="fu s5"><div className="sh">Net Cash Flow</div><div className="gc">{snaps.map((d,i)=>{const net=Number(d.total_income)-Number(d.total_expenses);return<div key={i} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'long',year:'numeric'})}</div></div><span className="mono rr" style={{fontWeight:600,color:net>=0?'var(--green)':'var(--red)'}}>{net>=0?'+':''}{$(net)}</span></div>})}</div></div>
    </div>}

    {tab==='subs'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Subscriptions</h2></div><div className="fu s1" style={{display:'flex',gap:10}}><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Monthly</div><div className="mono" style={{fontSize:28,fontWeight:700}}>{$(mRec)}</div></div><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Annual</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(mRec*12)}</div></div></div>{flagged.length>0&&<><div className="sh" style={{color:'var(--red)'}}>{'\u26A0'} Review</div><div className="gc fu s2">{flagged.map((s,i)=><div key={s.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:17,fontWeight:500}}>{s.name}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono" style={{fontSize:15,fontWeight:600}}>{$$(Number(s.amount))}</span><span className="pill pill-r">{s.status==='duplicate'?'Duplicate':'Review'}</span></div></div>{s.notes&&<div style={{fontSize:13,color:'var(--t3)',marginTop:8,lineHeight:1.5}}>{s.notes}</div>}</div>)}</div></>}<div className="sh">Active</div><div className="gc fu s3">{recs.filter(r=>r.status==='active').map((s,i)=><div key={s.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{flex:1}}><div style={{fontSize:17,fontWeight:500}}>{s.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{s.category} · {s.frequency}</div></div><span className="mono" style={{fontSize:15,fontWeight:600,marginRight:8}}>{$$(Number(s.amount))}</span><button onClick={async(e)=>{e.stopPropagation();await supabase.from('recurring_payments').update({status:'flagged'}).eq('id',s.id);await reload()}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--orange-s)',color:'var(--orange)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Flag</button><button onClick={async(e)=>{e.stopPropagation();if(confirm('Cancel '+s.name+'?')){await supabase.from('recurring_payments').update({status:'cancelled'}).eq('id',s.id);await reload()}}} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer',marginLeft:4}}>Cancel</button></div></div>)}</div></div>}

    {tab==='goals'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Goals</h2></div>{goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));const rem=Number(g.target_amount)-Number(g.current_amount);const dl=new Date(g.deadline);const ml=Math.max(1,(dl.getFullYear()-now.getFullYear())*12+dl.getMonth()-now.getMonth());const pm=rem/ml;const pw=pm/4.33;return<div key={g.id} className={`gc fu s${i+1}`} style={{padding:20}}><div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}><Ring value={Number(g.current_amount)} max={Number(g.target_amount)} size={64} sw={6} color={g.color}><span style={{fontSize:26}}>{g.icon}</span></Ring><div style={{flex:1}}><div style={{fontSize:17,fontWeight:600}}>{g.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{$(Number(g.target_amount))} by {dl.toLocaleDateString('en-AU',{month:'short',year:'numeric'})}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:g.color,borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:13,color:'var(--t3)'}}><span>Saved <span className="mono" style={{color:'var(--green)',fontWeight:600}}>{$(Number(g.current_amount))}</span></span><span>Left <span className="mono" style={{fontWeight:600}}>{$(rem)}</span></span></div><div style={{marginTop:12,background:'var(--orange-s)',borderRadius:10,padding:'10px 14px',fontSize:14}}>Save <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pw)}/wk</span> or <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pm)}/mo</span></div></div>})}</div>}

    {tab==='bills'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Bills</h2></div><div className="gc fu s1" style={{padding:24,textAlign:'center',cursor:'pointer'}}><span style={{fontSize:50}}>📸</span><div style={{fontSize:17,fontWeight:500,marginTop:10}}>Snap a Bill</div><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Fella reads it automatically</div></div><div className="sh">From Email</div><div className="gc fu s2">{ebills.map((b,i)=><div key={b.id} style={{position:'relative',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
      <div className="row" onClick={()=>setBillMenu(billMenu===b.id?null:b.id)} style={{cursor:'pointer'}}>
        <Ico bg={b.status==='paid'?'var(--green)':b.status==='confirmed'?'var(--blue)':'var(--orange)'} ch={b.status==='paid'?'✓':b.status==='confirmed'?'📋':'🆕'}/>
        <div className="rb"><div className="rt">{b.vendor}</div><div className="rs">{b.status==='paid'?'Paid ✓':`Due ${new Date(b.due_date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`}</div></div>
        <span className="mono rr" style={{fontWeight:600,color:b.status==='paid'?'var(--t3)':'var(--t1)',textDecoration:b.status==='paid'?'line-through':'none'}}>{$$(Number(b.amount))}</span>
        <span style={{color:'var(--t3)',fontSize:16,marginLeft:4}}>{billMenu===b.id?'▲':'▼'}</span>
      </div>
      {billMenu===b.id&&<div style={{padding:'0 16px 12px',display:'flex',gap:8,marginLeft:42}}>
        {b.status!=='paid'&&<button onClick={()=>markPaid(b.id)} style={{flex:1,padding:'12px 0',borderRadius:10,border:'none',background:'var(--green-s)',color:'var(--green)',fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>✓ Mark Paid</button>}
        {b.status==='paid'&&<button onClick={async()=>{await supabase.from('email_bills').update({status:'unreviewed'}).eq('id',b.id);setE(bills=>bills.map(x=>x.id===b.id?{...x,status:'unreviewed'}:x));setBillMenu(null)}} style={{flex:1,padding:'12px 0',borderRadius:10,border:'none',background:'var(--orange-s)',color:'var(--orange)',fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>↩ Mark Unpaid</button>}
        <button onClick={()=>setBillReminder(b)} style={{flex:1,padding:'12px 0',borderRadius:10,border:'none',background:'var(--blue-s)',color:'var(--blue)',fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>🔔 Remind Me</button>
      </div>}
    </div>)}</div></div>}

    {tab==='fella'&&<div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 110px)',padding:'0 20px'}}><div className="fu" style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><Ico bg="var(--orange)" ch="🤖" size={56}/><div><div style={{fontSize:28,fontWeight:800}}>Fella</div><div style={{fontSize:13,color:'var(--t3)'}}>Voice + Text · Your money brain</div></div></div><div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingBottom:8}}>{chat.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}><div className={m.role==='user'?'cb-u':'cb-a'}>{m.text}</div></div>)}{sending&&<div style={{display:'flex'}}><div className="cb-a" style={{color:'var(--t3)'}}>Thinking...</div></div>}{chat.length===1&&!sending&&<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:16}}><div style={{fontSize:13,color:'var(--t3)',fontWeight:600,marginBottom:2}}>Try asking...</div>{[{icon:'🏖️',q:"Can we afford a week in Byron Bay for the wedding in October? What do we need to save each week?"},{icon:'💸',q:"Where are we wasting money? Find any subscriptions or spending we should cut"},{icon:'📊',q:"We just spent $350 on the kids' school camp. How does that affect our budget this month?"}].map((ex,i)=><button key={i} onClick={()=>setCI(ex.q)} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'16px 18px',background:'var(--card)',border:'none',borderRadius:14,cursor:'pointer',textAlign:'left'}}><span style={{fontSize:32,flexShrink:0,marginTop:1}}>{ex.icon}</span><span style={{fontSize:17,color:'var(--t2)',lineHeight:1.45}}>{ex.q}</span></button>)}</div>}<div ref={chatEnd}/></div><div style={{display:'flex',gap:10,padding:'12px 0'}}><button onClick={voice} style={{width:54,height:54,borderRadius:27,border:'none',background:listening?'var(--red-s)':'var(--card)',color:listening?'var(--red)':'var(--t3)',cursor:'pointer',fontSize:26,display:'flex',alignItems:'center',justifyContent:'center'}}>{listening?'⏹':'🎙'}</button><input value={chatIn} onChange={e=>setCI(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask Fella..." style={{flex:1,padding:'0 18px',height:54,borderRadius:27,border:'none',background:'var(--card)',color:'var(--t1)',fontSize:18,outline:'none',fontFamily:'inherit'}}/><button onClick={send} disabled={sending} style={{width:54,height:54,borderRadius:27,border:'none',background:'var(--orange)',color:'#000',cursor:'pointer',fontSize:24,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>↑</button></div></div>}

    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="more-menu" onClick={e=>e.stopPropagation()}><div className="more-handle"/>{[{icon:'📈',label:'Trends',color:'var(--orange)',id:'trends'},{icon:'🔄',label:'Subscriptions',color:'var(--purple)',id:'subs'},{icon:'🏖️',label:'Savings Goals',color:'var(--green)',id:'goals'},{icon:'📬',label:'Bills & Invoices',color:'var(--blue)',id:'bills'},{icon:'👶',label:'Kids',color:'var(--pink)',id:'kids'},{icon:'⚙️',label:'Settings',color:'var(--gray2)',id:'settings'},{icon:'📖',label:'Setup Guide',color:'var(--teal)',id:'setup'}].map(item=><div key={item.id} className="more-item" onClick={()=>{setTab(item.id);setMore(false)}}><Ico bg={item.color} ch={item.icon} size={56}/><span style={{fontSize:22,fontWeight:500}}>{item.label}</span></div>)}<div className="more-item" onClick={()=>setMore(false)} style={{justifyContent:'center',padding:'20px 24px'}}><span style={{fontSize:20,color:'var(--t3)'}}>Cancel</span></div></div></div>}

    {tab==='setup'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Setup Guide</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Get the most out of your Finance Hub</div></div>

      <div className="gc fu s1" style={{padding:'20px 20px'}}><div style={{fontSize:24,fontWeight:700,marginBottom:16}}>How It Works</div><div style={{fontSize:15,color:'var(--t2)',lineHeight:1.65,marginBottom:20}}>Finance Hub is your family command center for money. It connects to your bank accounts, reads your bills from email, and uses AI (Fella) to help you understand and control your finances.</div>
        {[{icon:'🏦',t:'Bank Feeds',d:'Basiq connects to ME Bank, ING, and Amex to pull in every transaction automatically — including Apple Pay purchases.'},{icon:'📬',t:'Email Bills',d:"Connect your Gmail and Fella scans for bills, invoices, and payment notices. He extracts the amount, due date, and vendor automatically."},{icon:'📸',t:'Photo Upload',d:"Got a paper bill? Snap a photo and Fella reads it using OCR — pulls out the amount, who it's from, and when it's due."},{icon:'🤖',t:'Ask Fella',d:'Talk or type to Fella like a mate. Ask "Can we afford Byron Bay?" or say "We spent $200 on dinner last night" and he\'ll log it and tell you how it affects your budget.'},{icon:'🔔',t:'Smart Alerts',d:"Get warned when you're near a budget limit, when a bill is due, when Fella spots a duplicate subscription, or when a new recurring charge appears."},{icon:'🎯',t:'Goals & Debts',d:'Set savings goals (like Byron Bay trip) and track debt payoff. Fella calculates exactly how much you need to save per week to hit your targets.'}].map((item,i)=><div key={i} style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:16}}><Ico bg="var(--card2)" ch={item.icon} size={40}/><div><div style={{fontSize:16,fontWeight:600,marginBottom:3}}>{item.t}</div><div style={{fontSize:14,color:'var(--t3)',lineHeight:1.55}}>{item.d}</div></div></div>)}
      </div>

      <div className="fu s2"><div className="sh">Setup Checklist</div><div className="gc" style={{padding:'4px 20px'}}>
        {[{done:true,l:'Create Supabase database'},{done:true,l:'Deploy app to Vercel'},{done:true,l:'Load demo data to preview'},{done:false,l:'Add Anthropic API key (enables Fella chat)'},{done:false,l:'Connect Basiq for live bank feeds'},{done:false,l:'Connect Gmail API for bill scanning'},{done:false,l:'Replace demo data with real accounts'},{done:false,l:'Set up Supabase Auth (secure login)'},{done:false,l:'Enable push notifications'},{done:false,l:'Add to Home Screen on both phones'},{done:false,l:'Delete GitHub deploy token'}].map((item,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:16,padding:'16px 0',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{width:36,height:36,borderRadius:18,border:item.done?'none':'2px solid var(--gray2)',background:item.done?'var(--green)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{item.done&&<span style={{color:'#000',fontSize:20,fontWeight:700}}>✓</span>}</div><span style={{fontSize:20,color:item.done?'var(--t3)':'var(--t1)',textDecoration:item.done?'line-through':'none'}}>{item.l}</span></div>)}
      </div></div>

      <div className="fu s3"><div className="sh">Next Steps — How To</div><div className="gc" style={{padding:0}}>
        {[{t:'Add Anthropic API Key',d:'Go to Vercel → castelluccio-finance-hub → Settings → Environment Variables. Add key: ANTHROPIC_API_KEY with your API key from console.anthropic.com. Save and redeploy.',s:'Required for Fella'},{t:'Connect Basiq',d:"Sign up at basiq.io (free tier). Create an app, get your API key. We'll add the integration to connect ME Bank, ING, and Amex in our next session.",s:'Next session'},{t:'Connect Gmail',d:"We'll set up Google Cloud project, enable Gmail API, create OAuth credentials. Bills from your email get auto-scanned for amounts and due dates.",s:'Next session'},{t:'Replace Demo Data',d:"Once Basiq is connected, real transactions flow automatically. Update budgets, debts, goals, and income with your actual numbers.",s:'After Basiq'},{t:'Set Up Auth',d:"We'll add Supabase Auth with magic link login. Both you and Sarah get accounts. Row Level Security locks all data to your household.",s:'Next session'},{t:'Add to Home Screen',d:"On iPhone: Open the URL in Safari → tap Share → Add to Home Screen. Do this on both phones. It'll look and feel like a native app.",s:'Do this now!'}].map((item,i)=><div key={i} style={{padding:'16px 20px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{fontSize:18,fontWeight:600,marginBottom:6}}>{item.t}</div><div style={{fontSize:16,color:'var(--t2)',lineHeight:1.55,marginBottom:8}}>{item.d}</div><span className="pill pill-o">{item.s}</span></div>)}
      </div></div>

      <div className="fu s4"><div className="sh">Data Sources</div><div className="gc">
        {[{n:'Basiq (Bank Feeds)',s:'Not connected',c:'var(--red)',i:'🏦'},{n:'Gmail (Bill Scanner)',s:'Not connected',c:'var(--red)',i:'📬'},{n:'Photo Upload (OCR)',s:'Ready',c:'var(--green)',i:'📸'},{n:'Voice / Text (Fella)',s:'Needs API key',c:'var(--orange)',i:'🎙️'},{n:'Manual Entry',s:'Active',c:'var(--green)',i:'✏️'}].map((ds,i)=><div key={i} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg={ds.c} ch={ds.i}/><div className="rb"><div className="rt">{ds.n}</div></div><span style={{fontSize:13,color:ds.c,fontWeight:500,flexShrink:0,paddingLeft:8}}>{ds.s}</span></div>)}
      </div></div>

      <div className="fu s5"><div className="sh">Account</div><div className="gc">
        <div className="row"><Ico bg="var(--green)" ch="👤"/><div className="rb"><div className="rt">ben@castelluccio.com.au</div></div></div>
      </div></div>
    </div>}

    {tab==='kids'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Kids</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Cost centres per child — {new Date().getFullYear()} spending</div></div>

      {/* Kid selector */}
      {!selectedKid&&<div className="fu s1" style={{display:'flex',flexDirection:'column',gap:10}}>
        {costCentres.filter(c=>c.type==='child').map((kid,i)=>{
          const items=ccItems.filter(x=>x.cost_centre_id===kid.id)
          const yearItems=items.filter(x=>new Date(x.date).getFullYear()===new Date().getFullYear())
          const total=yearItems.reduce((s,x)=>s+Number(x.amount),0)
          const cats=[...new Set(yearItems.map(x=>x.category))]
          return<div key={kid.id} className={`gc fu s${i+1}`} style={{padding:'18px 20px',cursor:'pointer'}} onClick={()=>setSelectedKid(kid.id)}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:56,height:56,borderRadius:28,background:kid.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{kid.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:22,fontWeight:700}}>{kid.name}</div>
                <div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{cats.length} categories · {yearItems.length} items</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:22,fontWeight:700,color:'var(--orange)'}}>{$(total)}</div>
                <div style={{fontSize:12,color:'var(--t3)'}}>this year</div>
              </div>
            </div>
          </div>})}
        <div className="fu s6" style={{background:'var(--orange-s)',borderRadius:14,padding:18}}>
          <div style={{fontSize:15,fontWeight:600,color:'var(--orange)',marginBottom:4}}>Total Kids Spend {new Date().getFullYear()}</div>
          <div className="mono" style={{fontSize:28,fontWeight:800,color:'var(--orange)'}}>{$(ccItems.filter(x=>new Date(x.date).getFullYear()===new Date().getFullYear()).reduce((s,x)=>s+Number(x.amount),0))}</div>
        </div>
      </div>}

      {/* Individual kid view */}
      {selectedKid&&(()=>{
        const kid=costCentres.find(c=>c.id===selectedKid)
        if(!kid)return null
        const items=ccItems.filter(x=>x.cost_centre_id===kid.id)
        const yearItems=items.filter(x=>new Date(x.date).getFullYear()===new Date().getFullYear())
        const total=yearItems.reduce((s,x)=>s+Number(x.amount),0)
        const byCat:{[k:string]:number}={}
        yearItems.forEach(x=>{byCat[x.category]=(byCat[x.category]||0)+Number(x.amount)})
        const catList=Object.entries(byCat).sort((a,b)=>b[1]-a[1])
        const maxCat=catList.length?catList[0][1]:1
        const catIcons:{[k:string]:string}={School:'🎓',Sport:'⚽',Clothes:'👕',Birthday:'🎂',Medical:'🏥',Essentials:'🍼',Other:'📦',Childcare:'👶'}
        return<div>
          <button onClick={()=>setSelectedKid(null)} style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',color:'var(--orange)',fontSize:17,fontWeight:600,cursor:'pointer',padding:'8px 0',marginBottom:12}}>← All Kids</button>
          <div className="fu" style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
            <div style={{width:64,height:64,borderRadius:32,background:kid.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>{kid.icon}</div>
            <div><div style={{fontSize:28,fontWeight:800}}>{kid.name}</div><div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--orange)',marginTop:4}}>{$(total)} <span style={{fontSize:14,fontWeight:500,color:'var(--t3)'}}>this year</span></div></div>
          </div>

          {/* Category breakdown */}
          <div className="sh">Spending by Category</div>
          <div className="gc" style={{marginBottom:16}}>{catList.map(([cat,amt],i)=><div key={cat} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:16,fontWeight:500}}>{catIcons[cat]||'📦'} {cat}</span>
              <span className="mono" style={{fontSize:15,fontWeight:600}}>{$(amt)}</span>
            </div>
            <div className="pbar" style={{height:8,borderRadius:4}}><div className="pfill" style={{width:`${(amt/maxCat)*100}%`,background:kid.color,borderRadius:4}}/></div>
          </div>)}</div>

          {/* Recent items */}
          <div className="sh">Recent Items</div>
          <div className="gc">{yearItems.slice(0,10).map((item,i)=><div key={item.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}>
            <div className="rb"><div className="rt">{item.description}</div><div className="rs">{item.category} · {new Date(item.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div>
            <span className="mono rr" style={{fontWeight:600}}>{$$(Number(item.amount))}</span>
          </div>)}</div>

          {/* Add expense button */}
          <button onClick={()=>{setFormData({cost_centre_id:kid.id,description:'',amount:0,category:'School',date:new Date().toISOString().split('T')[0]});setEditItem(null);setShowForm(true);setTab('settings');setSettingsTab('kids_s')}} style={{width:'100%',marginTop:16,padding:'16px',borderRadius:14,border:'none',background:'var(--orange)',color:'#000',fontSize:17,fontWeight:600,cursor:'pointer'}}>+ Add Expense for {kid.name}</button>
        </div>
      })()}
    </div>}

    {tab==='settings'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>
      <div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Settings</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>Manage your accounts, budgets & connections</div></div>

      {/* Settings sub-tabs */}
      <div className="fu s1" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
        {[{id:'txn_s',l:'Transactions',i:'📝'},{id:'accounts',l:'Accounts',i:'🏦'},{id:'budgets',l:'Budgets',i:'🎯'},{id:'debts_s',l:'Debts',i:'💳'},{id:'goals_s',l:'Goals',i:'🏖️'},{id:'income_s',l:'Income',i:'💰'},{id:'recurring_s',l:'Recurring',i:'🔄'},{id:'kids_s',l:'Kids',i:'👶'},{id:'connections',l:'Connections',i:'🔗'}].map(st=>
          <button key={st.id} onClick={()=>{setSettingsTab(st.id);setShowForm(false);setEditItem(null)}} style={{padding:'10px 16px',borderRadius:12,border:'none',background:settingsTab===st.id?'var(--orange)':'var(--card)',color:settingsTab===st.id?'#000':'var(--t2)',fontSize:15,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{st.i} {st.l}</button>
        )}
      </div>

      {/* TRANSACTIONS */}
      {settingsTab==='txn_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Add Transaction</div></div>
        <div className="gc" style={{padding:20}}>
          <input placeholder="Description (e.g. Woolworths)" value={txForm.description} onChange={e=>setTxForm({...txForm,description:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Amount (negative for expense)" type="number" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input type="date" value={txForm.date} onChange={e=>setTxForm({...txForm,date:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={txForm.category} onChange={e=>setTxForm({...txForm,category:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}>
            <option value="">Select category...</option>
            {cats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
            <option value="Income">Income</option>
          </select>
          <button onClick={addTransaction} disabled={saving} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Add Transaction'}</button>
        </div>
        <div className="sh" style={{marginTop:20}}>Recent (last 10)</div>
        <div className="gc">{txs.slice(0,10).map((tx,i)=><div key={tx.id} style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{flex:1}}><div style={{fontSize:15,fontWeight:500}}>{tx.description}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><div style={{display:'flex',alignItems:'center',gap:10}}><span className="mono" style={{fontSize:15,fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span><button onClick={(e)=>{e.stopPropagation();deleteItem('transactions',tx.id)}} style={{padding:'4px 10px',borderRadius:6,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:11,fontWeight:600,cursor:'pointer'}}>✕</button></div></div>)}</div>
      </div>}

      {/* ACCOUNTS */}
      {settingsTab==='accounts'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Bank Accounts</div><button onClick={()=>{setFormData({name:'',bank:'',account_type:'transaction',balance:0});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Account':'New Account'}</div>
          <input placeholder="Account name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Bank (e.g. ME Bank)" value={formData.bank||''} onChange={e=>setFormData({...formData,bank:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.account_type||'transaction'} onChange={e=>setFormData({...formData,account_type:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}>
            <option value="transaction">Transaction</option><option value="savings">Savings</option><option value="credit">Credit Card</option><option value="loan">Loan</option><option value="mortgage">Mortgage</option>
          </select>
          <input placeholder="Balance" type="number" value={formData.balance||''} onChange={e=>setFormData({...formData,balance:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('bank_accounts',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>}
        <div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:a.name,bank:a.bank,account_type:a.account_type,balance:Number(a.balance)});setEditItem(a);setShowForm(true)}}><Ico bg="var(--blue)" ch="🏦"/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank} · {a.account_type}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--green)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div>
      </div>}

      {/* BUDGETS */}
      {settingsTab==='budgets'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Budget Categories</div><button onClick={()=>{setFormData({name:'',icon:'📁',color:'#ff9f0a',monthly_limit:0});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Budget':'New Budget'}</div>
          <input placeholder="Category name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Icon emoji" value={formData.icon||''} onChange={e=>setFormData({...formData,icon:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Monthly limit" type="number" value={formData.monthly_limit||''} onChange={e=>setFormData({...formData,monthly_limit:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('budget_categories',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('budget_categories',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        <div className="gc">{cats.map((c,i)=><div key={c.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:c.name,icon:c.icon,color:c.color,monthly_limit:Number(c.monthly_limit)});setEditItem(c);setShowForm(true)}}><Ico bg={c.color} ch={c.icon}/><div className="rb"><div className="rt">{c.name}</div><div className="rs">{$(Number(c.monthly_limit))}/mo</div></div></div>)}</div>
      </div>}

      {/* DEBTS */}
      {settingsTab==='debts_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Debts</div><button onClick={()=>{setFormData({name:'',type:'other',original_amount:0,current_balance:0,interest_rate:0,monthly_payment:0,lender:''});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Debt':'New Debt'}</div>
          <input placeholder="Name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.type||'other'} onChange={e=>setFormData({...formData,type:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}>
            <option value="credit_card">Credit Card</option><option value="personal_loan">Personal Loan</option><option value="car_loan">Car Loan</option><option value="mortgage">Mortgage</option><option value="bnpl">Buy Now Pay Later</option><option value="fine">Fine</option><option value="other">Other</option>
          </select>
          <input placeholder="Original amount" type="number" value={formData.original_amount||''} onChange={e=>setFormData({...formData,original_amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Current balance" type="number" value={formData.current_balance||''} onChange={e=>setFormData({...formData,current_balance:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Interest rate %" type="number" value={formData.interest_rate||''} onChange={e=>setFormData({...formData,interest_rate:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Monthly payment" type="number" value={formData.monthly_payment||''} onChange={e=>setFormData({...formData,monthly_payment:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Lender" value={formData.lender||''} onChange={e=>setFormData({...formData,lender:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('debts',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('debts',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        <div className="gc">{debts.map((d,i)=><div key={d.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:d.name,type:d.type,original_amount:Number(d.original_amount),current_balance:Number(d.current_balance),interest_rate:Number(d.interest_rate),monthly_payment:Number(d.monthly_payment),lender:d.lender});setEditItem(d);setShowForm(true)}}><Ico bg="var(--red)" ch="💳"/><div className="rb"><div className="rt">{d.name}</div><div className="rs">{d.lender} · {d.type.replace('_',' ')}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--red)'}}>{$$(Number(d.current_balance))}</span></div>)}</div>
      </div>}

      {/* GOALS */}
      {settingsTab==='goals_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Savings Goals</div><button onClick={()=>{setFormData({name:'',icon:'🎯',color:'#30d158',target_amount:0,current_amount:0,deadline:'',notes:''});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Goal':'New Goal'}</div>
          <input placeholder="Goal name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Icon emoji" value={formData.icon||''} onChange={e=>setFormData({...formData,icon:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Target amount" type="number" value={formData.target_amount||''} onChange={e=>setFormData({...formData,target_amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Saved so far" type="number" value={formData.current_amount||''} onChange={e=>setFormData({...formData,current_amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Deadline (YYYY-MM-DD)" value={formData.deadline||''} onChange={e=>setFormData({...formData,deadline:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Notes (optional)" value={formData.notes||''} onChange={e=>setFormData({...formData,notes:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('savings_goals',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('savings_goals',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        <div className="gc">{goals.map((g,i)=><div key={g.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:g.name,icon:g.icon,color:g.color,target_amount:Number(g.target_amount),current_amount:Number(g.current_amount),deadline:g.deadline,notes:g.notes});setEditItem(g);setShowForm(true)}}><Ico bg={g.color} ch={g.icon}/><div className="rb"><div className="rt">{g.name}</div><div className="rs">{$(Number(g.current_amount))} of {$(Number(g.target_amount))}</div></div></div>)}</div>
      </div>}

      {/* INCOME */}
      {settingsTab==='income_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Income Sources</div><button onClick={()=>{setFormData({name:'',type:'salary',amount:0,frequency:'monthly'});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Income':'New Income Source'}</div>
          <input placeholder="Name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.type||'salary'} onChange={e=>setFormData({...formData,type:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}>
            <option value="salary">Salary</option><option value="side_hustle">Side Hustle</option><option value="freelance">Freelance</option><option value="investment">Investment</option><option value="government">Government</option><option value="other">Other</option>
          </select>
          <input placeholder="Amount" type="number" value={formData.amount||''} onChange={e=>setFormData({...formData,amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.frequency||'monthly'} onChange={e=>setFormData({...formData,frequency:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}>
            <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="irregular">Irregular</option>
          </select>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('income_sources',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('income_sources',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        <div className="gc">{incs.map((inc,i)=><div key={inc.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:inc.name,type:inc.type,amount:Number(inc.amount),frequency:inc.frequency});setEditItem(inc);setShowForm(true)}}><Ico bg="var(--green)" ch="💰"/><div className="rb"><div className="rt">{inc.name}</div><div className="rs">{inc.type.replace('_',' ')} · {inc.frequency}</div></div><span className="mono rr" style={{fontWeight:600,color:'var(--green)'}}>{$$(Number(inc.amount))}</span></div>)}</div>
      </div>}

      {/* RECURRING */}
      {settingsTab==='recurring_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Recurring Payments</div><button onClick={()=>{setFormData({name:'',amount:0,frequency:'monthly',category:'',status:'active'});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add</button></div>
        {showForm&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Recurring':'New Recurring Payment'}</div>
          <input placeholder="Name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Amount" type="number" value={formData.amount||''} onChange={e=>setFormData({...formData,amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.frequency||'monthly'} onChange={e=>setFormData({...formData,frequency:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}>
            <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </select>
          <input placeholder="Category" value={formData.category||''} onChange={e=>setFormData({...formData,category:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.status||'active'} onChange={e=>setFormData({...formData,status:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}>
            <option value="active">Active</option><option value="flagged">Flagged</option><option value="duplicate">Duplicate</option><option value="cancelled">Cancelled</option><option value="paused">Paused</option>
          </select>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('recurring_payments',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('recurring_payments',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        <div className="gc">{recs.map((r,i)=><div key={r.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:r.name,amount:Number(r.amount),frequency:r.frequency,category:r.category,status:r.status});setEditItem(r);setShowForm(true)}}><Ico bg={r.status==='active'?'var(--green)':r.status==='flagged'||r.status==='duplicate'?'var(--red)':'var(--t3)'} ch="🔄"/><div className="rb"><div className="rt">{r.name}</div><div className="rs">{r.category} · {r.frequency}</div></div><span className="mono rr" style={{fontWeight:600}}>{$$(Number(r.amount))}</span></div>)}</div>
      </div>}

      {/* KIDS / COST CENTRES */}
      {settingsTab==='kids_s'&&<div className="fu s2">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div className="sh" style={{margin:0}}>Children & Cost Centres</div><button onClick={()=>{setFormData({name:'',type:'child',icon:'👤',color:'#ff9f0a'});setEditItem(null);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'var(--orange)',color:'#000',fontSize:14,fontWeight:600,cursor:'pointer'}}>+ Add Child</button></div>
        {showForm&&!formData.cost_centre_id&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editItem?'Edit Child':'New Child'}</div>
          <input placeholder="Name" value={formData.name||''} onChange={e=>setFormData({...formData,name:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Icon emoji" value={formData.icon||''} onChange={e=>setFormData({...formData,icon:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('cost_centres',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
            {editItem&&<button onClick={()=>deleteItem('cost_centres',editItem.id)} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:16,cursor:'pointer'}}>Delete</button>}
          </div>
        </div>}
        {showForm&&formData.cost_centre_id&&<div className="gc" style={{padding:20,marginBottom:12}}>
          <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>Add Expense for {costCentres.find(c=>c.id===formData.cost_centre_id)?.name}</div>
          <input placeholder="Description" value={formData.description||''} onChange={e=>setFormData({...formData,description:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <input placeholder="Amount" type="number" value={formData.amount||''} onChange={e=>setFormData({...formData,amount:parseFloat(e.target.value)||0})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}/>
          <select value={formData.category||'School'} onChange={e=>setFormData({...formData,category:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:10,outline:'none',fontFamily:'inherit'}}>
            <option value="School">School</option><option value="Sport">Sport</option><option value="Clothes">Clothes</option><option value="Birthday">Birthday</option><option value="Medical">Medical</option><option value="Essentials">Essentials</option><option value="Childcare">Childcare</option><option value="Entertainment">Entertainment</option><option value="Other">Other</option>
          </select>
          <input placeholder="Date" type="date" value={formData.date||''} onChange={e=>setFormData({...formData,date:e.target.value})} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t1)',fontSize:16,marginBottom:16,outline:'none',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>saveItem('cost_centre_items',formData,editItem?.id)} disabled={saving} style={{flex:1,padding:'14px',borderRadius:12,border:'none',background:'var(--orange)',color:'#000',fontSize:16,fontWeight:600,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null);setFormData({})}} style={{padding:'14px 20px',borderRadius:12,border:'none',background:'var(--card2)',color:'var(--t3)',fontSize:16,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>}
        <div className="gc">{costCentres.map((kid,i)=>{
          const total=ccItems.filter(x=>x.cost_centre_id===kid.id&&new Date(x.date).getFullYear()===new Date().getFullYear()).reduce((s,x)=>s+Number(x.amount),0)
          return<div key={kid.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),cursor:'pointer'}} onClick={()=>{setFormData({name:kid.name,type:kid.type,icon:kid.icon,color:kid.color});setEditItem(kid);setShowForm(true)}}>
            <div style={{width:44,height:44,borderRadius:22,background:kid.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{kid.icon}</div>
            <div className="rb"><div className="rt">{kid.name}</div><div className="rs">{kid.type}</div></div>
            <span className="mono rr" style={{fontWeight:600,color:'var(--orange)'}}>{$(total)}</span>
          </div>})}</div>
        <button onClick={()=>{setFormData({cost_centre_id:costCentres[0]?.id||'',description:'',amount:0,category:'School',date:new Date().toISOString().split('T')[0]});setEditItem(null);setShowForm(true)}} style={{width:'100%',marginTop:12,padding:'14px',borderRadius:12,border:'1px dashed var(--sep)',background:'transparent',color:'var(--orange)',fontSize:15,fontWeight:600,cursor:'pointer'}}>+ Add Expense to a Child</button>
      </div>}

      {/* CONNECTIONS */}
      {settingsTab==='connections'&&<div className="fu s2">
        <div className="sh">Data Connections</div>
        <div className="gc">
          {[{n:'Basiq (Bank Feeds)',s:'Not connected',c:'var(--red)',i:'🏦',d:'Connects to ME Bank, ING, Amex for live transactions'},{n:'Gmail (Bill Scanner)',s:'Not connected',c:'var(--red)',i:'📬',d:'Scans email for bills, invoices & payment notices'},{n:'Photo Upload (OCR)',s:'Ready',c:'var(--green)',i:'📸',d:'Snap a bill photo and Fella reads it'},{n:'Fella AI Chat',s:typeof window!=='undefined'&&window.location.hostname==='localhost'?'Needs API key':'Check Vercel env',c:'var(--orange)',i:'🤖',d:'Voice + text AI assistant. Needs ANTHROPIC_API_KEY in Vercel'},{n:'Manual Entry',s:'Active',c:'var(--green)',i:'✏️',d:'Add transactions, debts, goals manually via Settings'}].map((ds,i)=><div key={i} style={{padding:'16px 20px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',alignItems:'center',gap:14}}><Ico bg={ds.c} ch={ds.i}/><div style={{flex:1}}><div style={{fontSize:17,fontWeight:500}}>{ds.n}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{ds.d}</div></div><span style={{fontSize:13,color:ds.c,fontWeight:600,flexShrink:0}}>{ds.s}</span></div></div>)}
        </div>
        <div style={{marginTop:16,padding:20,background:'var(--orange-s)',borderRadius:14}}>
          <div style={{fontSize:17,fontWeight:600,color:'var(--orange)',marginBottom:8}}>Need help connecting?</div>
          <div style={{fontSize:15,color:'var(--t2)',lineHeight:1.55}}>Ask me in our next Claude chat session and I'll set up Basiq bank feeds, Gmail bill scanning, and your Anthropic API key for Fella.</div>
        </div>
        <div className="sh" style={{marginTop:24}}>Notifications</div>
        <div className="gc">
          <div style={{padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:17,fontWeight:500}}>Bill Reminders</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>Get notified before bills are due</div></div>
            <button onClick={requestNotifPermission} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>Enable</button>
          </div>
        </div>
        <div className="sh" style={{marginTop:24,color:'var(--red)'}}>Danger Zone</div>
        <div className="gc">
          <div style={{padding:'16px 20px'}}>
            <div style={{fontSize:17,fontWeight:500,marginBottom:4}}>Reset All Data</div>
            <div style={{fontSize:13,color:'var(--t3)',marginBottom:12}}>Delete all demo data and start fresh with your real numbers. This cannot be undone.</div>
            <button onClick={resetDemoData} disabled={saving} style={{padding:'12px 20px',borderRadius:10,border:'none',background:'var(--red-s)',color:'var(--red)',fontSize:15,fontWeight:600,cursor:'pointer'}}>{saving?'Deleting...':'🗑️ Clear All Data'}</button>
          </div>
        </div>
      </div>}
    </div>}

    <nav className="tbar">{[{id:'home',icon:'📊',l:'Home'},{id:'budget',icon:'🎯',l:'Budget'},{id:'debts',icon:'💳',l:'Debts'},{id:'fella',icon:'🤖',l:'Fella'},{id:'more',icon:'⚙️',l:'More'}].map(t=><button key={t.id} onClick={()=>t.id==='more'?setMore(true):setTab(t.id)} className={`tab ${(tab===t.id||(t.id==='more'&&['subs','goals','bills','trends','setup','settings','kids'].includes(tab)))?'tab-on':'tab-off'}`}><span className="tab-icon">{t.icon}</span><span className="tab-label">{t.l}</span></button>)}</nav>
  </div>
}
