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
type Snap={month:string;total_income:number;total_expenses:number}
type Msg={role:'user'|'assistant';text:string}

const $=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:0,maximumFractionDigits:0}).format(n)
const $$=(n:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n)
const pc=(a:number,b:number)=>b>0?Math.round((a/b)*100):0

/* Ring */
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

/* iOS Icon */
function Ico({bg,ch}:{bg:string;ch:string}){
  return<div className="row-icon" style={{background:bg}}>{ch}</div>
}

/* ═══ MAIN ═══ */
export default function App(){
  const[tab,setTab]=useState('home')
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
  const[chat,setCh]=useState<Msg[]>([{role:'assistant',text:"G'day! I'm Fella — your finance brain. Ask me anything about your money."}])
  const[chatIn,setCI]=useState('')
  const[sending,setSe]=useState(false)
  const[listening,setLi]=useState(false)
  const chatEnd=useRef<HTMLDivElement>(null)

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

  const dismiss=async(id:string)=>{
    await supabase.from('finance_alerts').update({is_dismissed:true}).eq('id',id)
    setAl(a=>a.filter(x=>x.id!==id))
  }

  const voice=()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang='en-AU';r.interimResults=false;r.onstart=()=>setLi(true);r.onresult=(e:any)=>{setCI(e.results[0][0].transcript);setLi(false)};r.onerror=()=>setLi(false);r.onend=()=>setLi(false);r.start()}

  const send=async()=>{
    if(!chatIn.trim()||sending)return;const msg=chatIn.trim();setCI('');setCh(p=>[...p,{role:'user',text:msg}]);setSe(true)
    try{
      const sys=`You are Fella — a sharp, warm Aussie family finance assistant for the Castelluccios (Melbourne). Named after Rockefeller. DATA: Accounts:${JSON.stringify(accounts.map(a=>({n:a.name,b:a.bank,bal:a.balance})))} | NW:${$$(nw)} | MonthlyInc:${$$(mInc)} | Spent:${$$(mSp)} | Recurring:${$$(mRec)} | Budgets:${JSON.stringify(byCat.map(c=>({n:c.name,b:c.monthly_limit,s:c.spent,p:c.pct+'%'})))} | Debts:${JSON.stringify(debts.map(d=>({n:d.name,bal:d.current_balance,r:d.interest_rate})))} | Goals:${JSON.stringify(goals.map(g=>({n:g.name,t:g.target_amount,s:g.current_amount,dl:g.deadline})))} Be direct, AUD, 2-4 sentences, casual Aussie.`
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,systemPrompt:sys})})
      const d=await res.json();setCh(p=>[...p,{role:'assistant',text:d.reply||'Had a hiccup.'}])
    }catch{setCh(p=>[...p,{role:'assistant',text:'Connection issue — try again.'}])}
    setSe(false)
  }

  const tabs=[{id:'home',icon:'📊',l:'Home'},{id:'budget',icon:'🎯',l:'Budget'},{id:'debts',icon:'💳',l:'Debts'},{id:'subs',icon:'🔄',l:'Subs'},{id:'goals',icon:'🏖️',l:'Goals'},{id:'bills',icon:'📬',l:'Bills'},{id:'fella',icon:'🤖',l:'Fella'}]

  if(loading)return<div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
    <div style={{fontSize:40}}>💰</div>
    <div style={{fontSize:22,fontWeight:700,color:'var(--orange)'}}>Finance Hub</div>
  </div>

  return<div style={{minHeight:'100dvh',paddingBottom:90,background:'#000'}}>
    {/* Header */}
    <div style={{padding:'16px 20px 24px'}}>
      <div style={{fontSize:13,color:'var(--t3)',marginBottom:4}}>Castelluccio Family</div>
      <h1 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7,lineHeight:1.05,color:'var(--t1)'}}>Finance Hub</h1>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}>
        <span className="mono" style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{$(nw)}</span>
        <span style={{fontSize:13,color:'var(--t3)'}}>net worth</span>
      </div>
    </div>

    {/* Alerts */}
    {alerts.length>0&&tab==='home'&&<div style={{padding:'0 20px 16px',display:'flex',flexDirection:'column',gap:8}}>
      {alerts.slice(0,3).map((a,i)=><div key={a.id} className={`fu s${i+1}`} style={{padding:'11px 14px',borderRadius:12,fontSize:14,lineHeight:1.45,display:'flex',gap:10,alignItems:'flex-start',background:a.severity==='danger'?'var(--red-s)':a.severity==='warning'?'var(--orange-s)':a.severity==='success'?'var(--green-s)':'var(--blue-s)'}}>
        <span style={{flex:1,color:'var(--t2)'}}>{a.message}</span>
        <button onClick={()=>dismiss(a.id)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:16,padding:0}}>✕</button>
      </div>)}
    </div>}

    {/* ═══ HOME ═══ */}
    {tab==='home'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
      {/* Accounts */}
      <div className="fu s1">
        <div className="sh">Accounts</div>
        <div className="gc">
          {accounts.map((a,i)=><div key={a.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)',marginLeft:0}:{}}>
            <Ico bg={a.account_type==='credit'?'var(--purple)':a.account_type==='loan'?'var(--red)':a.account_type==='savings'?'var(--green)':'var(--blue)'} ch={a.account_type==='credit'?'💳':a.account_type==='loan'?'🏦':a.account_type==='savings'?'🐷':'💰'}/>
            <div className="row-body">
              <div className="row-title">{a.name}</div>
              <div className="row-sub">{a.bank}</div>
            </div>
            <span className="mono row-right" style={{fontWeight:600,color:Number(a.balance)>=0?'var(--t1)':'var(--red)'}}>{$$(Number(a.balance))}</span>
          </div>)}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="fu s2" style={{display:'flex',gap:8}}>
        {[['Income',$(mInc),'var(--green)'],[`Spent`,$(mSp),'var(--orange)'],['Recurring',$(mRec),'var(--purple)']].map(([l,v,c],i)=>
          <div key={i} className="gc" style={{flex:1,padding:'14px 8px',textAlign:'center',overflow:'hidden'}}>
            <div style={{fontSize:11,color:'var(--t3)',fontWeight:500,marginBottom:6}}>{l}</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:c as string,whiteSpace:'nowrap'}}>{v}</div>
          </div>
        )}
      </div>

      {/* Cash Flow */}
      <div className="fu s3">
        <div className="sh">Cash Flow</div>
        <div className="gc" style={{padding:'16px 16px 12px'}}>
          <div style={{display:'flex',gap:16,fontSize:12,color:'var(--t3)',marginBottom:12}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:3,background:'var(--orange)'}}/>Income</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:3,background:'var(--purple)'}}/>Expenses</span>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
            {snaps.map((d,i)=>{const mx=Math.max(...snaps.flatMap(s=>[s.total_income,s.total_expenses]),1);return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
              <div style={{display:'flex',gap:2,alignItems:'flex-end',height:80,width:'100%'}}>
                <div style={{flex:1,borderRadius:4,height:`${(d.total_income/mx)*100}%`,background:'var(--orange)',opacity:0.85,transition:'height 0.8s'}}/>
                <div style={{flex:1,borderRadius:4,height:`${(d.total_expenses/mx)*100}%`,background:'var(--purple)',opacity:0.5,transition:'height 0.8s'}}/>
              </div>
              <span style={{fontSize:10,color:'var(--t3)'}}>{new Date(d.month+'T00:00').toLocaleDateString('en-AU',{month:'short'})}</span>
            </div>})}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="fu s4">
        <div className="sh">Recent Transactions</div>
        <div className="gc">
          {txs.slice(0,7).map((tx,i)=><div key={tx.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)',marginLeft:0}:{}}>
            <div className="row-body">
              <div className="row-title">{tx.description}</div>
              <div className="row-sub">{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
            </div>
            <span className="mono row-right" style={{fontWeight:600,color:Number(tx.amount)>=0?'var(--green)':'var(--t1)'}}>{Number(tx.amount)>=0?'+':''}{$$(Number(tx.amount))}</span>
          </div>)}
        </div>
      </div>

      {/* Savings Callout */}
      {flagged.length>0&&<div className="fu s5" style={{background:'var(--orange-s)',borderRadius:14,padding:16,display:'flex',alignItems:'center',gap:14}}>
        <Ico bg="var(--orange)" ch="💡"/>
        <div>
          <div style={{fontSize:17,fontWeight:600,color:'var(--orange)'}}>Save {$(flagged.reduce((s,r)=>s+Number(r.amount),0)*12)}/yr</div>
          <div style={{fontSize:13,color:'var(--t3)'}}>{flagged.length} flagged subscription{flagged.length>1?'s':''}</div>
        </div>
      </div>}
    </div>}

    {/* ═══ BUDGET ═══ */}
    {tab==='budget'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu">
        <h2 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7}}>Budgets</h2>
        <div style={{fontSize:15,color:'var(--t3)',marginTop:4}}>{$(mSp)} of {$(cats.reduce((s,c)=>s+Number(c.monthly_limit),0))} spent</div>
      </div>
      <div className="gc fu s1">
        {byCat.map((c,i)=><div key={c.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)',marginLeft:0}:{}}>
          <Ring value={c.spent} max={Number(c.monthly_limit)} size={40} sw={4} color={c.color}>
            <span style={{fontSize:14}}>{c.icon}</span>
          </Ring>
          <div className="row-body">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span className="row-title">{c.name}</span>
              <span className={`pill ${c.pct>=90?'pill-r':c.pct>=75?'pill-o':'pill-g'}`}>{c.pct}%</span>
            </div>
            <div className="pbar" style={{marginTop:6}}><div className="pfill" style={{width:`${Math.min(c.pct,100)}%`,background:c.pct>90?'var(--red)':c.pct>75?'var(--orange)':c.color}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:12,color:'var(--t3)'}}>
              <span>{$(c.spent)}</span><span>{$(Number(c.monthly_limit)-c.spent)} left</span>
            </div>
          </div>
        </div>)}
      </div>
    </div>}

    {/* ═══ DEBTS ═══ */}
    {tab==='debts'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu">
        <h2 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7}}>Debts</h2>
      </div>
      <div className="fu s1" style={{background:'var(--red-s)',borderRadius:14,padding:20,textAlign:'center'}}>
        <div style={{fontSize:13,color:'var(--t3)',marginBottom:4}}>Total Remaining</div>
        <div className="mono" style={{fontSize:34,fontWeight:800,color:'var(--red)'}}>{$(dbt)}</div>
        <div style={{fontSize:13,color:'var(--t3)',marginTop:6}}>{$(debts.reduce((s,d)=>s+Number(d.monthly_payment),0))}/mo repayments</div>
      </div>
      <div className="gc fu s2">
        {debts.map((d,i)=>{const paid=Number(d.original_amount)-Number(d.current_balance);const prog=pc(paid,Number(d.original_amount));return<div key={d.id} style={{padding:16,...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div><div style={{fontSize:17,fontWeight:500}}>{d.name}</div><div style={{fontSize:13,color:'var(--t3)',marginTop:1}}>{d.lender}{Number(d.interest_rate)>0?` · ${d.interest_rate}%`:''}</div></div>
            <span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span>
          </div>
          <div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:'var(--green)',borderRadius:3}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:13,color:'var(--t3)'}}>
            <span>Remaining <span className="mono" style={{color:'var(--red)',fontWeight:600}}>{$$(Number(d.current_balance))}</span></span>
            <span><span className="mono" style={{fontWeight:600}}>{$$(Number(d.monthly_payment))}</span>/mo</span>
          </div>
        </div>})}
      </div>
    </div>}

    {/* ═══ SUBS ═══ */}
    {tab==='subs'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu"><h2 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7}}>Subscriptions</h2></div>
      <div className="fu s1" style={{display:'flex',gap:10}}>
        <div className="gc" style={{flex:1,padding:16,textAlign:'center'}}>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>Monthly</div>
          <div className="mono" style={{fontSize:22,fontWeight:700}}>{$(mRec)}</div>
        </div>
        <div className="gc" style={{flex:1,padding:16,textAlign:'center'}}>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>Annual</div>
          <div className="mono" style={{fontSize:22,fontWeight:700,color:'var(--orange)'}}>{$(mRec*12)}</div>
        </div>
      </div>
      {flagged.length>0&&<>
        <div className="sh" style={{color:'var(--red)'}}>⚠ Review</div>
        <div className="gc fu s2">
          {flagged.map((s,i)=><div key={s.id} style={{padding:16,...(i>0?{borderTop:'0.33px solid var(--sep)'}:{})}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:17,fontWeight:500}}>{s.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="mono" style={{fontSize:15,fontWeight:600}}>{$$(Number(s.amount))}</span>
                <span className="pill pill-r">{s.status==='duplicate'?'Duplicate':'Review'}</span>
              </div>
            </div>
            {s.notes&&<div style={{fontSize:13,color:'var(--t3)',marginTop:6}}>{s.notes}</div>}
          </div>)}
        </div>
      </>}
      <div className="sh">Active</div>
      <div className="gc fu s3">
        {recs.filter(r=>r.status==='active').map((s,i,arr)=><div key={s.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)',marginLeft:0}:{}}>
          <div className="row-body">
            <div className="row-title">{s.name}</div>
            <div className="row-sub">{s.category} · {s.frequency}</div>
          </div>
          <span className="mono row-right" style={{fontWeight:600}}>{$$(Number(s.amount))}</span>
        </div>)}
      </div>
    </div>}

    {/* ═══ GOALS ═══ */}
    {tab==='goals'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu"><h2 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7}}>Goals</h2></div>
      {goals.map((g,i)=>{const prog=pc(Number(g.current_amount),Number(g.target_amount));const rem=Number(g.target_amount)-Number(g.current_amount);const dl=new Date(g.deadline);const ml=Math.max(1,(dl.getFullYear()-now.getFullYear())*12+dl.getMonth()-now.getMonth());const pm=rem/ml;const pw=pm/4.33
      return<div key={g.id} className={`gc fu s${i+1}`} style={{padding:20}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
          <Ring value={Number(g.current_amount)} max={Number(g.target_amount)} size={52} sw={5} color={g.color}>
            <span style={{fontSize:20}}>{g.icon}</span>
          </Ring>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:600}}>{g.name}</div>
            <div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{$(Number(g.target_amount))} by {dl.toLocaleDateString('en-AU',{month:'short',year:'numeric'})}</div>
          </div>
          <span className={`pill ${prog>70?'pill-g':prog>40?'pill-b':'pill-o'}`}>{prog}%</span>
        </div>
        <div className="pbar" style={{height:6,borderRadius:3}}><div className="pfill" style={{width:`${prog}%`,background:g.color,borderRadius:3}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:13,color:'var(--t3)'}}>
          <span>Saved <span className="mono" style={{color:'var(--green)',fontWeight:600}}>{$(Number(g.current_amount))}</span></span>
          <span>Left <span className="mono" style={{fontWeight:600}}>{$(rem)}</span></span>
        </div>
        <div style={{marginTop:12,background:'var(--orange-s)',borderRadius:10,padding:'10px 14px',fontSize:14}}>
          Save <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pw)}/wk</span> or <span className="mono" style={{fontWeight:700,color:'var(--orange)'}}>{$(pm)}/mo</span>
        </div>
      </div>})}
    </div>}

    {/* ═══ BILLS ═══ */}
    {tab==='bills'&&<div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div className="fu"><h2 style={{fontSize:34,fontWeight:800,letterSpacing:-0.7}}>Bills</h2></div>
      <div className="gc fu s1" style={{padding:20,textAlign:'center',cursor:'pointer'}}>
        <span style={{fontSize:28}}>📸</span>
        <div style={{fontSize:17,fontWeight:500,marginTop:8}}>Snap a Bill</div>
        <div style={{fontSize:13,color:'var(--t3)',marginTop:4}}>Fella reads it automatically</div>
      </div>
      <div className="sh">From Email</div>
      <div className="gc fu s2">
        {ebills.map((b,i)=><div key={b.id} className="row" style={i>0?{borderTop:'0.33px solid var(--sep)',marginLeft:0}:{}}>
          <Ico bg={b.status==='paid'?'var(--green)':b.status==='confirmed'?'var(--blue)':'var(--orange)'} ch={b.status==='paid'?'✓':b.status==='confirmed'?'📋':'🆕'}/>
          <div className="row-body">
            <div className="row-title">{b.vendor}</div>
            <div className="row-sub">Due {new Date(b.due_date).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
          </div>
          <span className="mono row-right" style={{fontWeight:600}}>{$$(Number(b.amount))}</span>
        </div>)}
      </div>
    </div>}

    {/* ═══ FELLA ═══ */}
    {tab==='fella'&&<div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 100px)',padding:'0 20px'}}>
      <div className="fu" style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
        <Ico bg="var(--orange)" ch="🤖"/>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>Fella</div>
          <div style={{fontSize:13,color:'var(--t3)'}}>Voice + Text · Your money brain</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingBottom:8}}>
        {chat.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
          <div className={m.role==='user'?'cb-u':'cb-a'}>{m.text}</div>
        </div>)}
        {sending&&<div style={{display:'flex'}}><div className="cb-a" style={{color:'var(--t3)'}}>Thinking...</div></div>}
        {/* Example prompts - only show when chat has just the welcome message */}
        {chat.length===1&&!sending&&<div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
          <div style={{fontSize:13,color:'var(--t3)',fontWeight:600,marginBottom:4}}>Try asking...</div>
          {[
            {icon:'🏖️',text:'Can we afford a week in Byron Bay for the wedding in October? What do we need to save each week?'},
            {icon:'💸',text:'Where are we wasting money? Find any subscriptions or spending we should cut'},
            {icon:'📊',text:'We just spent $350 on the kids\' school camp. How does that affect our budget this month?'},
          ].map((ex,i)=><button key={i} onClick={()=>{setCI(ex.text);setTimeout(()=>{const el=document.querySelector('input[placeholder="Ask Fella..."]') as HTMLInputElement;if(el){el.focus()}},100)}} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',background:'var(--card)',border:'1px solid var(--sep)',borderRadius:14,cursor:'pointer',textAlign:'left',transition:'background 0.15s'}}>
            <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{ex.icon}</span>
            <span style={{fontSize:15,color:'var(--t2)',lineHeight:1.4}}>{ex.text}</span>
          </button>)}
        </div>}
        <div ref={chatEnd}/>
      </div>
      <div style={{display:'flex',gap:8,padding:'12px 0'}}>
        <button onClick={voice} style={{width:44,height:44,borderRadius:22,border:'none',background:listening?'var(--red-s)':'var(--card)',color:listening?'var(--red)':'var(--t3)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{listening?'⏹':'🎙'}</button>
        <input value={chatIn} onChange={e=>setCI(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask Fella..." style={{flex:1,padding:'0 16px',height:44,borderRadius:22,border:'none',background:'var(--card)',color:'var(--t1)',fontSize:16,outline:'none',fontFamily:'inherit'}}/>
        <button onClick={send} disabled={sending} style={{width:44,height:44,borderRadius:22,border:'none',background:'var(--orange)',color:'#000',cursor:'pointer',fontSize:18,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>↑</button>
      </div>
    </div>}

    {/* Tab Bar */}
    <nav className="tbar">
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`tab ${tab===t.id?'tab-on':'tab-off'}`}>
        <span style={{fontSize:28,lineHeight:1}}>{t.icon}</span>
        <span style={{fontSize:10,fontWeight:600,marginTop:2,whiteSpace:'nowrap'}}>{t.l}</span>
      </button>)}
    </nav>
  </div>
}
