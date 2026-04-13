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
  const[user,setUser]=useState<User|null>(null)
  const[authLoading,setAuthLoading]=useState(true)
  const[authEmail,setAuthEmail]=useState('')
  const[authSent,setAuthSent]=useState(false)
  const[authError,setAuthError]=useState('')
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
  const chatEnd=useRef<HTMLDivElement>(null)

  // Auth: check session and listen for changes
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user ? {id:session.user.id,email:session.user.email} : null)
      setAuthLoading(false)
    })
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user ? {id:session.user.id,email:session.user.email} : null)
      setAuthLoading(false)
    })
    return()=>subscription.unsubscribe()
  },[])

  // Sign in with magic link
  const signIn=async()=>{
    setAuthError('')
    const{error}=await supabase.auth.signInWithOtp({email:authEmail,options:{emailRedirectTo:window.location.origin}})
    if(error){setAuthError(error.message)}else{setAuthSent(true)}
  }

  // Sign out
  const signOut=async()=>{await supabase.auth.signOut();setUser(null)}

  // Auth loading screen
  if(authLoading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'#000',color:'#fff'}}><div style={{fontSize:48}}>💰</div><div style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>Finance Hub</div></div>

  // Login screen
  if(!user)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#000',color:'#fff',padding:20}}>
    <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
      <div style={{fontSize:64,marginBottom:16}}>💰</div>
      <h1 style={{fontSize:34,fontWeight:800,marginBottom:8}}>Finance Hub</h1>
      <div style={{fontSize:15,color:'var(--t3)',marginBottom:40}}>Castelluccio Family</div>
      {authSent?<div style={{padding:24}}>
        <div style={{fontSize:48,marginBottom:16}}>📬</div>
        <div style={{fontSize:20,fontWeight:600,marginBottom:8}}>Check your email</div>
        <div style={{fontSize:15,color:'var(--t3)',lineHeight:1.5,marginBottom:20}}>We sent a magic link to <span style={{color:'var(--orange)',fontWeight:600}}>{authEmail}</span></div>
        <button onClick={()=>setAuthSent(false)} style={{background:'none',border:'none',color:'var(--orange)',fontSize:15,fontWeight:600,cursor:'pointer',padding:8}}>Try a different email</button>
      </div>:<div>
        <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&signIn()} placeholder="your@email.com" type="email" style={{width:'100%',padding:'16px 20px',borderRadius:14,border:'none',background:'var(--card, #1c1c1e)',color:'#fff',fontSize:18,outline:'none',fontFamily:'inherit',marginBottom:12,textAlign:'center'}}/>
        <button onClick={signIn} style={{width:'100%',padding:'16px 20px',borderRadius:14,border:'none',background:'var(--orange, #ff9f0a)',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Send Magic Link</button>
        {authError&&<div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:'var(--red-s, rgba(255,69,58,0.15))',color:'var(--red, #ff453a)',fontSize:14}}>{authError}</div>}
        <div style={{marginTop:24,fontSize:13,color:'var(--t3, rgba(255,255,255,0.35))'}}>Only authorised Castelluccio emails can sign in</div>
      </div>}
    </div>
  </div>

  useEffect(()=>{(async()=>{
    const[a,t,c,r,d,g,i,al,eb,sn]=await Promise.all([
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
    ])
    setA(a.data||[]);setT(t.data||[]);setC(c.data||[]);setR(r.data||[])
    setD(d.data||[]);setG(g.data||[]);setI(i.data||[]);setAl(al.data||[])
    setE(eb.data||[]);setS(sn.data||[]);setL(false)
  })()},[])

  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth'})},[chat])

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

  if(loading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}><div style={{fontSize:48}}>💰</div><div style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>Finance Hub</div></div>

  return<div style={{minHeight:'100dvh',paddingBottom:100,background:'#000'}}>
    <div style={{padding:'16px 20px 24px'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Castelluccio Family</div><h1 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7,lineHeight:1.05}}>Finance Hub</h1><div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}><span className="mono" style={{fontSize:34,fontWeight:700,color:nw>=0?'var(--orange)':'var(--red)'}}>{$(nw)}</span><span style={{fontSize:13,color:'var(--t3)'}}>net worth</span></div></div>

    {alerts.length>0&&tab==='home'&&<div style={{padding:'0 20px 16px',display:'flex',flexDirection:'column',gap:8}}>{alerts.slice(0,3).map((a,i)=><div key={a.id} className={`fu s${i+1}`} style={{padding:'12px 16px',borderRadius:12,fontSize:14,lineHeight:1.45,display:'flex',gap:10,alignItems:'flex-start',background:a.severity==='danger'?'var(--red-s)':a.severity==='warning'?'var(--orange-s)':a.severity==='success'?'var(--green-s)':'var(--blue-s)'}}><span style={{flex:1,color:'var(--t2)'}}>{a.message}</span><button onClick={()=>dismiss(a.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:16,padding:0}}>✕</button></div>)}</div>}

    {tab==='home'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      <div className="fu s1"><div className="sh">Accounts</div><div className="gc">{accounts.map((a,i)=><div key={a.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><Ico bg={a.account_type==='credit'?'var(--purple)':a.account_type==='loan'?'var(--red)':a.account_type==='savings'?'var(--green)':'var(--blue)'} ch={a.account_type==='credit'?'💳':a.account_type==='loan'?'🏦':a.account_type==='savings'?'🐷':'💰'}/><div className="rb"><div className="rt">{a.name}</div><div className="rs">{a.bank}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--t1)':'var(--red)'}}>{$$(Number(a.balance))}</span></div>)}</div></div>
      <div className="fu s2" style={{display:'flex',gap:10}}>{[['Income',$(mInc),'var(--green)'],['Spent',$(mSp),'var(--orange)'],['Recurring',$(mRec),'var(--purple)']].map(([l,v,c],i)=><div key={i} className="gc" style={{flex:1,padding:'14px 10px',textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:c as string}}>{v}</div></div>)}</div>
      <div className="fu s3"><div className="sh">Cash Flow</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span></div><div style={{display:'flex',alignItems:'flex-end',gap:8,height:110}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.flatMap(s=>[s.total_income,s.total_expenses]),1);return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}><div style={{display:'flex',gap:3,alignItems:'flex-end',height:88,width:'100%'}}><div style={{flex:1,borderRadius:5,height:`${(d.total_income/mx)*100}%`,background:'var(--orange)',opacity:0.85,transition:'height 0.8s'}}/><div style={{flex:1,borderRadius:5,height:`${(d.total_expenses/mx)*100}%`,background:'var(--purple)',opacity:0.5,transition:'height 0.8s'}}/></div><span style={{fontSize:11,color:'var(--t3)'}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span></div>})}</div></div></div>
      <div className="fu s4"><div className="sh">Recent Transactions</div><div className="gc">{txs.slice(0,7).map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{tx.description}</div><div className="rs">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div></div><span className="mono rr" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span></div>)}</div></div>
      {flagged.length>0&&<div className="fu s5" style={{background:'var(--orange-s)',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}><Ico bg="var(--orange)" ch="💡"/><div><div style={{fontSize:17,fontWeight:600,color:'var(--orange)'}}>Save {$(flagged.reduce((s,r)=>s+Number(r.amount),0)*12)}/yr</div><div style={{fontSize:13,color:'var(--t3)'}}>{flagged.length} flagged subscription{flagged.length>1?'s':''}</div></div></div>}
    </div>}

    {tab==='budget'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Budgets</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>{$(mSp)} of {$(cats.reduce((s,c)=>s+Number(c.monthly_limit),0))} spent</div></div><div className="gc fu s1">{byCat.map((c,i)=><div key={c.id} className="row" style={{...(i>0?{borderTop:'0.33px solid var(--sep)'}:{}),gap:14}}><Ring value={c.spent} max={Number(c.monthly_limit)} size={52} sw={5} color={c.color}><span style={{fontSize:16}}>{c.icon}</span></Ring><div className="rb"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span className="rt">{c.name}</span><span className={`pill ${c.pct>=90?'pill-r':c.pct>=75?'pill-o':'pill-g'}`}>{c.pct}%</span></div><div className="pbar"><div className="pfill" style={{width:`${Math.min(c.pct,100)}%`,background:c.pct>90?'var(--red)':c.pct>75?'var(--orange)':c.color}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:12,color:'var(--t3)'}}><span>{$(c.spent)}</span><span>{$(Number(c.monthly_limit)-c.spent)} left</span></div></div></div>)}</div></div>}

    {tab==='debts'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Debts</h2></div><div className="fu s1" style={{background:'var(--red-s)',borderRadius:14,padding:20,textAlign:'center'}}><div style={{fontSize:15,color:'var(--t3)',marginBottom:4}}>Total Remaining</div><div className="mono" style={{fontSize:42,fontWeight:800,color:'var(--red)'}}>{$(dbt)}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:6}}>{$(debts.reduce((s,d)=>s+Number(d.monthly_payment),0))}/mo repayments</div></div><div className="gc fu s2">{debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div><div style={{fontSize:17,fontWeight:500}}>{d.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{d.lender}{Number(d.interest_rate)>0?` · ${d.interest_rate}%`:''}</div></div><span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span></div><div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:13,color:'var(--t3)'}}><span>Left <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span><span><span className="mono" style={{fontWeight:600}}>{$$(Number(d.monthly_payment))}</span>/mo</span></div></div>})}</div></div>}

    {tab==='trends'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Trends</h2><div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>6-month financial overview</div></div>
      <div className="fu s1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>Savings Rate</div><div className="mono" style={{fontSize:28,fontWeight:800,color:savingsRate>0?'var(--green)':'var(--red)'}}>{savingsRate}%</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>of income saved</div></div><div className="gc" style={{padding:18,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',fontWeight:500,marginBottom:6}}>Avg Monthly Spend</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(avgExp)}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>over 6 months</div></div></div>
      <div className="fu s2"><div className="sh">Month over Month</div><div className="gc"><div className="row"><Ico bg={spendChange<=0?'var(--green)':'var(--red)'} ch={spendChange<=0?'📉':'📈'}/><div className="rb"><div className="rt">Spending</div><div className="rs">vs last month</div></div><span className="mono rr" style={{fontWeight:600,color:spendChange<=0?'var(--green)':'var(--red)'}}>{spendChange<=0?'':'+'}${Math.abs(spendChange).toLocaleString()}</span></div><div className="row" style={{borderTop:'0.33px solid var(--sep)'}}><Ico bg={incChange>=0?'var(--green)':'var(--red)'} ch={incChange>=0?'📈':'📉'}/><div className="rb"><div className="rt">Income</div><div className="rs">vs last month</div></div><span className="mono rr" style={{fontWeight:600,color:incChange>=0?'var(--green)':'var(--red)'}}>{incChange>=0?'+':''}${Math.abs(incChange).toLocaleString()}</span></div><div className="row" style={{borderTop:'0.33px solid var(--sep)'}}><Ico bg="var(--blue)" ch="💵"/><div className="rb"><div className="rt">Avg Income</div><div className="rs">6 month average</div></div><span className="mono rr" style={{fontWeight:600}}>{$(avgInc)}</span></div></div></div>
      <div className="fu s3"><div className="sh">Income vs Expenses</div><div className="gc" style={{padding:'16px 18px 14px'}}><div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:14}}><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--orange)'}}/>Income</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--purple)'}}/>Expenses</span><span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:4,background:'var(--green)'}}/>Saved</span></div><div style={{display:'flex',flexDirection:'column',gap:8}}>{snaps.map((d,i)=>{const mx=Math.max(...snaps.map(s=>Number(s.total_income)),1);const saved=Number(d.total_income)-Number(d.total_expenses);return<div key={i} style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:12,color:'var(--t3)',width:32,textAlign:'right',flexShrink:0}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span><div style={{flex:1,display:'flex',flexDirection:'column',gap:3}}><div style={{height:16,borderRadius:4,width:`${(Number(d.total_income)/mx)*100}%`,background:'var(--orange)',opacity:0.8}}/><div style={{display:'flex',gap:2}}><div style={{height:16,borderRadius:4,width:`${(Number(d.total_expenses)/mx)*100}%`,background:'var(--purple)',opacity:0.5}}/>{saved>0&&<div style={{height:16,borderRadius:4,width:`${(saved/mx)*100}%`,background:'var(--green)',opacity:0.6}}/>}</div></div><span className="mono" style={{fontSize:11,color:saved>=0?'var(--green)':'var(--red)',width:55,textAlign:'right',flexShrink:0,fontWeight:600}}>{saved>=0?'+':''}{$(saved)}</span></div>})}</div></div></div>
      <div className="fu s4"><div className="sh">Top Spending This Month</div><div className="gc">{byCat.filter(c=>c.spent>0).slice(0,5).map((c,i,arr)=>{const maxSp=Math.max(...arr.map(x=>x.spent),1);return<div key={c.id} style={{padding:'14px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:15,fontWeight:500}}>{c.icon} {c.name}</span><span className="mono" style={{fontSize:14,fontWeight:600}}>{$(c.spent)}</span></div><div className="pbar" style={{height:8,borderRadius:4}}><div className="pfill" style={{width:`${(c.spent/maxSp)*100}%`,background:c.color,borderRadius:4}}/></div></div>})}</div></div>
      <div className="fu s5"><div className="sh">Net Cash Flow</div><div className="gc">{snaps.map((d,i)=>{const net=Number(d.total_income)-Number(d.total_expenses);return<div key={i} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'long',year:'numeric'})}</div></div><span className="mono rr" style={{fontWeight:600,color:net>=0?'var(--green)':'var(--red)'}}>{net>=0?'+':''}{$(net)}</span></div>})}</div></div>
    </div>}

    {tab==='subs'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}><div className="fu"><h2 style={{fontSize:42,fontWeight:800,letterSpacing:-0.7}}>Subscriptions</h2></div><div className="fu s1" style={{display:'flex',gap:10}}><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Monthly</div><div className="mono" style={{fontSize:28,fontWeight:700}}>{$(mRec)}</div></div><div className="gc" style={{flex:1,padding:16,textAlign:'center'}}><div style={{fontSize:14,color:'var(--t3)',marginBottom:6}}>Annual</div><div className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(mRec*12)}</div></div></div>{flagged.length>0&&<><div className="sh" style={{color:'var(--red)'}}>{'\u26A0'} Review</div><div className="gc fu s2">{flagged.map((s,i)=><div key={s.id} style={{padding:'16px 18px',...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:17,fontWeight:500}}>{s.name}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span className="mono" style={{fontSize:15,fontWeight:600}}>{$$(Number(s.amount))}</span><span className="pill pill-r">{s.status==='duplicate'?'Duplicate':'Review'}</span></div></div>{s.notes&&<div style={{fontSize:13,color:'var(--t3)',marginTop:8,lineHeight:1.5}}>{s.notes}</div>}</div>)}</div></>}<div className="sh">Active</div><div className="gc fu s3">{recs.filter(r=>r.status==='active').map((s,i)=><div key={s.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)'}:{}}><div className="rb"><div className="rt">{s.name}</div><div className="rs">{s.category} · {s.frequency}</div></div><span className="mono rr" style={{fontWeight:600}}>{$$(Number(s.amount))}</span></div>)}</div></div>}

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

    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="more-menu" onClick={e=>e.stopPropagation()}><div className="more-handle"/>{[{icon:'📈',label:'Trends',color:'var(--orange)',id:'trends'},{icon:'🔄',label:'Subscriptions',color:'var(--purple)',id:'subs'},{icon:'🏖️',label:'Savings Goals',color:'var(--green)',id:'goals'},{icon:'📬',label:'Bills & Invoices',color:'var(--blue)',id:'bills'},{icon:'⚙️',label:'Setup Guide',color:'var(--gray2)',id:'setup'}].map(item=><div key={item.id} className="more-item" onClick={()=>{setTab(item.id);setMore(false)}}><Ico bg={item.color} ch={item.icon} size={56}/><span style={{fontSize:22,fontWeight:500}}>{item.label}</span></div>)}<div className="more-item" onClick={()=>setMore(false)} style={{justifyContent:'center',padding:'20px 24px'}}><span style={{fontSize:20,color:'var(--t3)'}}>Cancel</span></div></div></div>}

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

    <nav className="tbar">{[{id:'home',icon:'📊',l:'Home'},{id:'budget',icon:'🎯',l:'Budget'},{id:'debts',icon:'💳',l:'Debts'},{id:'fella',icon:'🤖',l:'Fella'},{id:'more',icon:'⚙️',l:'More'}].map(t=><button key={t.id} onClick={()=>t.id==='more'?setMore(true):setTab(t.id)} className={`tab ${(tab===t.id||(t.id==='more'&&['subs','goals','bills','trends','setup'].includes(tab)))?'tab-on':'tab-off'}`}><span className="tab-icon">{t.icon}</span><span className="tab-label">{t.l}</span></button>)}</nav>
  </div>
}
