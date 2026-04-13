'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/* ── Types ── */
type Acc = { id: string; name: string; bank: string; account_type: string; balance: number }
type Tx = { id: string; date: string; description: string; amount: number; category: string; logged_by: string }
type Cat = { id: string; name: string; icon: string; color: string; monthly_limit: number; alert_threshold: number }
type Rec = { id: string; name: string; amount: number; frequency: string; category: string; status: string; notes: string; next_due_date: string }
type Dbt = { id: string; name: string; type: string; original_amount: number; current_balance: number; interest_rate: number; monthly_payment: number; lender: string }
type Goal = { id: string; name: string; icon: string; color: string; target_amount: number; current_amount: number; deadline: string; notes: string }
type Inc = { id: string; name: string; type: string; amount: number; frequency: string }
type Alrt = { id: string; type: string; title: string; message: string; severity: string; is_read: boolean; created_at: string }
type EBill = { id: string; vendor: string; amount: number; due_date: string; category: string; status: string; subject: string }
type Snap = { month: string; total_income: number; total_expenses: number; net_cashflow: number }
type Msg = { role: 'user' | 'assistant'; text: string }

/* ── Helpers ── */
const $ = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
const $$ = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
const pc = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

/* ── Ring Chart (Apple Activity Style) ── */
function Ring({ value, max, size = 52, stroke = 5, color = 'var(--green)', children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode
}) {
  const p = Math.min(pc(value, max), 100)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (p / 100) * c
  const col = p > 90 ? 'var(--red)' : p > 75 ? 'var(--orange)' : color
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1), stroke 0.3s' }} />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>}
    </div>
  )
}

/* ── Bar Chart (minimal) ── */
function Bars({ data }: { data: Snap[] }) {
  const mx = Math.max(...data.flatMap(d => [d.total_income, d.total_expenses]), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 96, width: '100%' }}>
            <div style={{ flex: 1, borderRadius: 4, height: `${(d.total_income / mx) * 100}%`, background: 'var(--green)', opacity: 0.85, transition: 'height 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
            <div style={{ flex: 1, borderRadius: 4, height: `${(d.total_expenses / mx) * 100}%`, background: 'var(--orange)', opacity: 0.6, transition: 'height 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)' }}>{new Date(d.month + 'T00:00').toLocaleDateString('en-AU', { month: 'short' })}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Row Component ── */
function Row({ left, right, sub, icon, last }: { left: string; right: string; sub?: string; icon?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: last ? 'none' : '0.5px solid var(--bdr)', gap: 12 }}>
      {icon && <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)' }}>{left}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', flexShrink: 0 }}>{right}</div>
    </div>
  )
}

/* ══════════════════════════════════════ */
/* ══  MAIN APP                       ══ */
/* ══════════════════════════════════════ */

export default function App() {
  const [tab, setTab] = useState('home')
  const [accounts, setAccounts] = useState<Acc[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [recs, setRecs] = useState<Rec[]>([])
  const [debts, setDebts] = useState<Dbt[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [incs, setIncs] = useState<Inc[]>([])
  const [alerts, setAlerts] = useState<Alrt[]>([])
  const [ebills, setEbills] = useState<EBill[]>([])
  const [snaps, setSnaps] = useState<Snap[]>([])
  const [loading, setLoading] = useState(true)
  const [chat, setChat] = useState<Msg[]>([{ role: 'assistant', text: "G'day! I'm Fella — your family finance brain. Ask me anything about your money, like \"Can we afford Byron Bay?\" or \"Where are we bleeding cash?\"" }])
  const [chatIn, setChatIn] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      const [a, t, c, r, d, g, i, al, eb, sn] = await Promise.all([
        supabase.from('bank_accounts').select('*').order('bank'),
        supabase.from('transactions').select('*').order('date', { ascending: false }).limit(50),
        supabase.from('budget_categories').select('*').order('name'),
        supabase.from('recurring_payments').select('*').order('name'),
        supabase.from('debts').select('*').eq('is_active', true).order('current_balance', { ascending: false }),
        supabase.from('savings_goals').select('*').eq('is_active', true).order('priority'),
        supabase.from('income_sources').select('*').eq('is_active', true),
        supabase.from('finance_alerts').select('*').eq('is_dismissed', false).order('created_at', { ascending: false }),
        supabase.from('email_bills').select('*').order('due_date'),
        supabase.from('monthly_snapshots').select('*').order('month'),
      ])
      setAccounts(a.data || []); setTxs(t.data || []); setCats(c.data || [])
      setRecs(r.data || []); setDebts(d.data || []); setGoals(g.data || [])
      setIncs(i.data || []); setAlerts(al.data || []); setEbills(eb.data || [])
      setSnaps(sn.data || []); setLoading(false)
    })()
  }, [])

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  // ── Computed ──
  const bal = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const dbt = debts.reduce((s, d) => s + Number(d.current_balance), 0)
  const nw = bal - dbt
  const mInc = incs.reduce((s, i) => { const a = Number(i.amount); return s + (i.frequency === 'weekly' ? a * 4.33 : i.frequency === 'fortnightly' ? a * 2.17 : a) }, 0)
  const now = new Date()
  const mTxs = txs.filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const mSpend = mTxs.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const byCat = cats.map(c => {
    const sp = mTxs.filter(t => t.category === c.name && Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    return { ...c, spent: sp, pct: pc(sp, Number(c.monthly_limit)) }
  }).sort((a, b) => b.pct - a.pct)
  const mRec = recs.filter(r => r.status !== 'cancelled').reduce((s, r) => {
    const a = Number(r.amount)
    return s + (r.frequency === 'weekly' ? a * 4.33 : r.frequency === 'fortnightly' ? a * 2.17 : r.frequency === 'quarterly' ? a / 3 : r.frequency === 'yearly' ? a / 12 : a)
  }, 0)
  const flagged = recs.filter(r => r.status === 'duplicate' || r.status === 'flagged')
  const savPA = flagged.reduce((s, r) => s + Number(r.amount), 0) * 12

  const dismiss = async (id: string) => {
    await supabase.from('finance_alerts').update({ is_dismissed: true }).eq('id', id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  // ── Voice ──
  const voice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR(); r.lang = 'en-AU'; r.interimResults = false
    r.onstart = () => setListening(true)
    r.onresult = (e: any) => { setChatIn(e.results[0][0].transcript); setListening(false) }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    r.start()
  }

  // ── Chat ──
  const send = async () => {
    if (!chatIn.trim() || sending) return
    const msg = chatIn.trim(); setChatIn(''); setChat(p => [...p, { role: 'user', text: msg }]); setSending(true)
    try {
      const sys = `You are Fella — a sharp, warm Australian family finance assistant for the Castelluccio family (Melbourne). Named after Rockefeller.

DATA: Accounts: ${JSON.stringify(accounts.map(a => ({ n: a.name, b: a.bank, bal: a.balance })))} | Net Worth: ${$$(nw)} | Monthly Income: ${$$(mInc)} | Spent this month: ${$$(mSpend)} | Recurring: ${$$(mRec)} | Budgets: ${JSON.stringify(byCat.map(c => ({ n: c.name, bud: c.monthly_limit, sp: c.spent, p: c.pct + '%' })))} | Debts: ${JSON.stringify(debts.map(d => ({ n: d.name, bal: d.current_balance, r: d.interest_rate, pay: d.monthly_payment })))} | Goals: ${JSON.stringify(goals.map(g => ({ n: g.name, tgt: g.target_amount, sav: g.current_amount, dl: g.deadline })))} | Flagged: ${JSON.stringify(flagged.map(f => ({ n: f.name, amt: f.amount, note: f.notes })))}

Be direct, use AUD, reference real data. 2-4 sentences. Casual Aussie tone.`
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, systemPrompt: sys }) })
      const d = await res.json()
      setChat(p => [...p, { role: 'assistant', text: d.reply || 'Had a hiccup — try again.' }])
    } catch { setChat(p => [...p, { role: 'assistant', text: 'Connection issue — give it another go.' }]) }
    setSending(false)
  }

  const tabs = [
    { id: 'home', icon: '📊', label: 'Home' },
    { id: 'budget', icon: '🎯', label: 'Budget' },
    { id: 'debts', icon: '💳', label: 'Debts' },
    { id: 'subs', icon: '🔄', label: 'Subs' },
    { id: 'goals', icon: '🏖️', label: 'Goals' },
    { id: 'bills', icon: '📬', label: 'Bills' },
    { id: 'fella', icon: '🤖', label: 'Fella' },
  ]

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--green-s)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28 }}>💰</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }} className="grad-g">Finance Hub</div>
      <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--green)', opacity: 0.5, animation: 'sh 1.5s infinite linear', backgroundImage: 'linear-gradient(90deg, var(--green) 0%, var(--teal) 50%, var(--green) 100%)', backgroundSize: '200% 100%' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 90, background: '#000' }}>
      {/* ── Header ── */}
      <header style={{ padding: '16px 20px 20px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 4 }}>Castelluccio</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }} className="grad-g">Finance Hub</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', marginBottom: 2 }}>Net Worth</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: nw >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>{$(nw)}</div>
          </div>
        </div>
      </header>

      {/* ── Alerts ── */}
      {alerts.length > 0 && tab === 'home' && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.slice(0, 3).map((a, i) => (
            <div key={a.id} className={`fu s${i + 1}`} style={{
              padding: '12px 16px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, display: 'flex', gap: 10, alignItems: 'flex-start',
              background: a.severity === 'danger' ? 'var(--red-s)' : a.severity === 'warning' ? 'var(--orange-s)' : a.severity === 'success' ? 'var(--green-s)' : 'var(--blue-s)',
              border: `1px solid ${a.severity === 'danger' ? 'rgba(255,69,58,0.15)' : a.severity === 'warning' ? 'rgba(255,159,10,0.15)' : a.severity === 'success' ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.15)'}`,
            }}>
              <span style={{ flex: 1, color: 'var(--t2)' }}>{a.message}</span>
              <button onClick={() => dismiss(a.id)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ HOME ══════════════════════ */}
      {tab === 'home' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Accounts */}
          <div className="fu s1">
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 12 }}>Accounts</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {accounts.map((a, i) => (
                <div key={a.id} className={`card fu s${i + 2}`} style={{ padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)' }}>{a.bank}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)', marginTop: 2, marginBottom: 10 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: Number(a.balance) >= 0 ? 'var(--t1)' : 'var(--red)' }}>{$$(Number(a.balance))}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="fu s3" style={{ display: 'flex', gap: 10 }}>
            {[['Income', $(mInc), 'var(--green)'], ['Spent', $(mSpend), 'var(--orange)'], ['Recurring', $(mRec), 'var(--indigo)']].map(([l, v, c], i) => (
              <div key={i} className="card" style={{ flex: 1, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 6 }}>{l}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: c as string }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Cash Flow */}
          <div className="card fu s4" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>Cash Flow</span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600, color: 'var(--t3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} />In</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--orange)', display: 'inline-block' }} />Out</span>
              </div>
            </div>
            <Bars data={snaps} />
          </div>

          {/* Transactions */}
          <div className="card fu s5" style={{ padding: '4px 20px' }}>
            <div style={{ padding: '16px 0 8px', fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>Recent</div>
            {txs.slice(0, 7).map((tx, i) => (
              <Row key={tx.id} left={tx.description}
                sub={`${tx.category} · ${new Date(tx.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                right={`${Number(tx.amount) >= 0 ? '+' : ''}${$$(Number(tx.amount))}`}
                last={i === 6} />
            ))}
          </div>

          {/* Savings callout */}
          {flagged.length > 0 && (
            <div className="card-warn fu s6" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 28 }}>💡</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)' }}>Save {$(savPA)}/year</div>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>{flagged.length} flagged subscription{flagged.length > 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ BUDGETS ══════════════════════ */}
      {tab === 'budget' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fu">
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Budgets</div>
            <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
              {$(mSpend)} of {$(cats.reduce((s, c) => s + Number(c.monthly_limit), 0))} spent in April
            </div>
          </div>
          {byCat.map((c, i) => (
            <div key={c.id} className={`card fu s${Math.min(i + 1, 8)}`} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Ring value={c.spent} max={Number(c.monthly_limit)} size={48} stroke={5} color={c.color}>
                <span style={{ fontSize: 16 }}>{c.icon}</span>
              </Ring>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                  <span className={`pill ${c.pct >= 90 ? 'pill-r' : c.pct >= 75 ? 'pill-o' : 'pill-g'}`}>{c.pct}%</span>
                </div>
                <div className="pbar"><div className="pfill" style={{ width: `${Math.min(c.pct, 100)}%`, background: c.pct > 90 ? 'var(--red)' : c.pct > 75 ? 'var(--orange)' : c.color }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--t3)' }}>
                  <span>{$(c.spent)} spent</span><span>{$(Number(c.monthly_limit) - c.spent)} left</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ DEBTS ══════════════════════ */}
      {tab === 'debts' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fu">
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Debts</div>
          </div>
          <div className="card-danger fu s1" style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Total Remaining</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{$(dbt)}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>{$(debts.reduce((s, d) => s + Number(d.monthly_payment), 0))}/mo in repayments</div>
          </div>
          {debts.map((d, i) => {
            const paid = Number(d.original_amount) - Number(d.current_balance)
            const prog = pc(paid, Number(d.original_amount))
            return (
              <div key={d.id} className={`card fu s${i + 2}`} style={{ padding: '18px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{d.lender}{Number(d.interest_rate) > 0 ? ` · ${d.interest_rate}%` : ''}</div>
                  </div>
                  <span className={`pill ${prog > 70 ? 'pill-g' : prog > 40 ? 'pill-b' : 'pill-o'}`}>{prog}% paid</span>
                </div>
                <div className="pbar" style={{ height: 8, borderRadius: 4, marginBottom: 10 }}>
                  <div className="pfill" style={{ width: `${prog}%`, background: 'var(--green)', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--t3)' }}>Remaining <span className="mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{$$(Number(d.current_balance))}</span></span>
                  <span style={{ color: 'var(--t3)' }}><span className="mono" style={{ fontWeight: 600 }}>{$$(Number(d.monthly_payment))}</span>/mo</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════ SUBS ══════════════════════ */}
      {tab === 'subs' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fu">
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Subscriptions</div>
          </div>
          <div className="fu s1" style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 6 }}>Monthly</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{$(mRec)}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 6 }}>Annual</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>{$(mRec * 12)}</div>
            </div>
          </div>

          {flagged.length > 0 && <>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--red)', marginTop: 8 }}>Review These</div>
            {flagged.map((s, i) => (
              <div key={s.id} className={`card-danger fu s${i + 2}`} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.notes ? 8 : 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{$$(Number(s.amount))}</span>
                    <span className="pill pill-r">{s.status === 'duplicate' ? 'Duplicate' : 'Review'}</span>
                  </div>
                </div>
                {s.notes && <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{s.notes}</div>}
              </div>
            ))}
          </>}

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginTop: 8 }}>Active</div>
          <div className="card fu s4" style={{ padding: '4px 18px' }}>
            {recs.filter(r => r.status === 'active').map((s, i, arr) => (
              <Row key={s.id} left={s.name} sub={`${s.category} · ${s.frequency}`} right={$$(Number(s.amount))} last={i === arr.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════ GOALS ══════════════════════ */}
      {tab === 'goals' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="fu"><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Goals</div></div>
          {goals.map((g, i) => {
            const prog = pc(Number(g.current_amount), Number(g.target_amount))
            const rem = Number(g.target_amount) - Number(g.current_amount)
            const dl = new Date(g.deadline); const ml = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth())
            const pm = rem / ml; const pw = pm / 4.33
            return (
              <div key={g.id} className={`card fu s${i + 1}`} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <Ring value={Number(g.current_amount)} max={Number(g.target_amount)} size={56} stroke={5} color={g.color}>
                    <span style={{ fontSize: 22 }}>{g.icon}</span>
                  </Ring>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{$(Number(g.target_amount))} by {dl.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className={`pill ${prog > 70 ? 'pill-g' : prog > 40 ? 'pill-b' : 'pill-o'}`}>{prog}%</span>
                </div>
                <div className="pbar" style={{ height: 8, borderRadius: 4, marginBottom: 12 }}>
                  <div className="pfill" style={{ width: `${prog}%`, background: g.color, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>
                  <span>Saved <span className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{$(Number(g.current_amount))}</span></span>
                  <span>Left <span className="mono" style={{ fontWeight: 600 }}>{$(rem)}</span></span>
                </div>
                <div className="card-accent" style={{ padding: '10px 14px', fontSize: 13, borderRadius: 12 }}>
                  Save <span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{$(pw)}/wk</span> or <span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{$(pm)}/mo</span> to reach this
                </div>
                {g.notes && <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 10 }}>{g.notes}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════ BILLS ══════════════════════ */}
      {tab === 'bills' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fu">
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Bills</div>
            <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Gmail + photo uploads</div>
          </div>
          <div className="card fu s1" onClick={() => fileRef.current?.click()} style={{ padding: 20, textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed' }}>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={() => {}} />
            <span style={{ fontSize: 28 }}>📸</span>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>Snap a Bill</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Photo → Fella reads it automatically</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--t4)', marginTop: 8 }}>From Email</div>
          {ebills.map((b, i) => (
            <div key={b.id} className={`card fu s${i + 2}`} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{b.vendor}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Due {new Date(b.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{$$(Number(b.amount))}</div>
                  <span className={`pill ${b.status === 'paid' ? 'pill-g' : b.status === 'confirmed' ? 'pill-b' : 'pill-o'}`} style={{ marginTop: 4 }}>{b.status === 'confirmed' ? 'Confirmed' : b.status === 'paid' ? 'Paid' : 'New'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ FELLA ══════════════════════ */}
      {tab === 'fella' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 100px)', padding: '0 20px' }}>
          <div className="fu" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--green-s)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>🤖</span>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Fella</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>Voice + Text · Your money brain</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={m.role === 'user' ? 'cb-u' : 'cb-a'}>{m.text}</div>
              </div>
            ))}
            {sending && <div style={{ display: 'flex' }}><div className="cb-a" style={{ color: 'var(--t3)' }}>Thinking...</div></div>}
            <div ref={chatEnd} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
            <button onClick={voice} style={{ width: 44, height: 44, borderRadius: 14, border: `1px solid ${listening ? 'var(--red)' : 'var(--bdr)'}`, background: listening ? 'var(--red-s)' : 'var(--s1)', color: listening ? 'var(--red)' : 'var(--t3)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {listening ? '⏹' : '🎙'}
            </button>
            <input value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Fella..." style={{ flex: 1, padding: '0 16px', height: 44, borderRadius: 14, border: '1px solid var(--bdr)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={sending} style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: 'var(--green)', color: '#000', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
          </div>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <nav className="tbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', minWidth: 44, color: tab === t.id ? 'var(--green)' : 'var(--t4)', transition: 'color 0.15s' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.1 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
