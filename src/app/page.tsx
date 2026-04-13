'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── TYPES ───
type Account = { id: string; name: string; bank: string; account_type: string; balance: number }
type Transaction = { id: string; date: string; description: string; amount: number; category: string; logged_by: string }
type BudgetCategory = { id: string; name: string; icon: string; color: string; monthly_limit: number; alert_threshold: number }
type RecurringPayment = { id: string; name: string; amount: number; frequency: string; category: string; status: string; notes: string; next_due_date: string }
type Debt = { id: string; name: string; type: string; original_amount: number; current_balance: number; interest_rate: number; monthly_payment: number; lender: string }
type SavingsGoal = { id: string; name: string; icon: string; color: string; target_amount: number; current_amount: number; deadline: string; notes: string }
type IncomeSource = { id: string; name: string; type: string; amount: number; frequency: string }
type Alert = { id: string; type: string; title: string; message: string; severity: string; is_read: boolean; created_at: string }
type EmailBill = { id: string; vendor: string; amount: number; due_date: string; category: string; status: string; subject: string; from_address: string }
type MonthlySnapshot = { month: string; total_income: number; total_expenses: number; net_cashflow: number }
type ChatMsg = { role: 'user' | 'assistant'; text: string }

// ─── HELPERS ───
const fmt = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
const fmtFull = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

// ─── iOS-STYLE COMPONENTS ───

function GlassCard({ children, className = '', style = {}, onClick, glow }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void; glow?: string
}) {
  return (
    <div onClick={onClick} className={`glass press ${glow || ''} ${className}`} style={{
      padding: 20, cursor: onClick ? 'pointer' : undefined, ...style
    }}>
      {children}
    </div>
  )
}

function Ring({ value, max, size = 56, stroke = 5, color = 'var(--green)' }: {
  value: number; max: number; size?: number; stroke?: number; color?: string
}) {
  const p = Math.min(pct(value, max), 100)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (p / 100) * circ
  const ringColor = p > 90 ? 'var(--red)' : p > 75 ? 'var(--orange)' : color
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringColor} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  )
}

function ProgressBar({ value, max, color = 'var(--green)', h = 6 }: {
  value: number; max: number; color?: string; h?: number
}) {
  const p = pct(value, max)
  const c = p > 90 ? 'var(--red)' : p > 75 ? 'var(--orange)' : color
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', borderRadius: h, background: c,
        transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: `0 0 12px ${c}40`
      }} />
    </div>
  )
}

function Pill({ text, color = 'green' }: { text: string; color?: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    green: { bg: 'var(--green-dim)', fg: 'var(--green)' },
    red: { bg: 'var(--red-dim)', fg: 'var(--red)' },
    orange: { bg: 'var(--orange-dim)', fg: 'var(--orange)' },
    blue: { bg: 'var(--blue-dim)', fg: 'var(--blue)' },
    purple: { bg: 'var(--purple-dim)', fg: 'var(--purple)' },
    teal: { bg: 'var(--teal-dim)', fg: 'var(--teal)' },
  }
  const c = colors[color] || colors.green
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: c.bg, color: c.fg, letterSpacing: 0.4 }}>
      {text}
    </span>
  )
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, paddingTop: 8 }}>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4, fontWeight: 400 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

// ─── MAIN APP ───
export default function FinanceHub() {
  const [tab, setTab] = useState('dashboard')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [recurring, setRecurring] = useState<RecurringPayment[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [emailBills, setEmailBills] = useState<EmailBill[]>([])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: "G'day! I'm Fella — your family finance brain. Ask me anything. Try \"Can we afford Byron Bay in October?\" or \"Where are we bleeding money?\"" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
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
      setAccounts(a.data || []); setTransactions(t.data || []); setCategories(c.data || [])
      setRecurring(r.data || []); setDebts(d.data || []); setGoals(g.data || [])
      setIncome(i.data || []); setAlerts(al.data || []); setEmailBills(eb.data || [])
      setSnapshots(sn.data || []); setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── Computed ──
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance), 0)
  const netWorth = totalBalance - totalDebt
  const monthlyIncome = income.reduce((s, i) => {
    const a = Number(i.amount)
    return s + (i.frequency === 'weekly' ? a * 4.33 : i.frequency === 'fortnightly' ? a * 2.17 : a)
  }, 0)
  const now = new Date()
  const curTx = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const monthSpend = curTx.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const spendByCat = categories.map(cat => {
    const spent = curTx.filter(t => t.category === cat.name && Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    return { ...cat, spent, percentage: pct(spent, Number(cat.monthly_limit)) }
  }).sort((a, b) => b.percentage - a.percentage)
  const monthlyRec = recurring.filter(r => r.status !== 'cancelled').reduce((s, r) => {
    const a = Number(r.amount)
    return s + (r.frequency === 'weekly' ? a * 4.33 : r.frequency === 'fortnightly' ? a * 2.17 : r.frequency === 'quarterly' ? a / 3 : r.frequency === 'yearly' ? a / 12 : a)
  }, 0)
  const flagged = recurring.filter(r => r.status === 'duplicate' || r.status === 'flagged')
  const potentialSavings = flagged.reduce((s, r) => s + Number(r.amount), 0) * 12

  const dismissAlert = async (id: string) => {
    await supabase.from('finance_alerts').update({ is_dismissed: true }).eq('id', id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  // Voice
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-AU'; rec.interimResults = false
    rec.onstart = () => setIsListening(true)
    rec.onresult = (e: any) => { setChatInput(e.results[0][0].transcript); setIsListening(false) }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start()
  }

  // Chat
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim(); setChatInput('')
    setChatMessages(p => [...p, { role: 'user', text: msg }]); setChatLoading(true)
    try {
      const sys = `You are Fella — a warm, razor-sharp Australian family finance assistant for the Castelluccio family in Melbourne. Named after Rockefeller. You're the mate who's brilliant with money.

DATA:
Accounts: ${JSON.stringify(accounts.map(a => ({ name: a.name, bank: a.bank, balance: a.balance })))}
Net Worth: ${fmtFull(netWorth)} | Monthly Income: ${fmtFull(monthlyIncome)} | Month Spend: ${fmtFull(monthSpend)} | Recurring: ${fmtFull(monthlyRec)}
Budgets: ${JSON.stringify(spendByCat.map(c => ({ name: c.name, budget: c.monthly_limit, spent: c.spent, pct: c.percentage + '%' })))}
Debts: ${JSON.stringify(debts.map(d => ({ name: d.name, balance: d.current_balance, rate: d.interest_rate, payment: d.monthly_payment })))}
Goals: ${JSON.stringify(goals.map(g => ({ name: g.name, target: g.target_amount, saved: g.current_amount, deadline: g.deadline })))}
Flagged: ${JSON.stringify(flagged.map(f => ({ name: f.name, amount: f.amount, reason: f.notes })))}
Bills: ${JSON.stringify(emailBills.filter(e => e.status === 'unreviewed').map(e => ({ vendor: e.vendor, amount: e.amount, due: e.due_date })))}

RULES: AUD. Reference actual data. Be concise (2-4 sentences). Warm but sharp. If they mention spending, log it mentally and explain budget impact. Calculate savings needed for goals.`
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, systemPrompt: sys }) })
      const data = await res.json()
      setChatMessages(p => [...p, { role: 'assistant', text: data.reply || "Bit of a hiccup — try again." }])
    } catch { setChatMessages(p => [...p, { role: 'assistant', text: "Connection issue — give it another go." }]) }
    setChatLoading(false)
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setChatMessages(p => [...p,
      { role: 'user', text: `📷 Uploaded: ${file.name}` },
      { role: 'assistant', text: `Got that bill photo. In the full version I'll OCR it automatically. For now, tell me the details and I'll log it.` }
    ])
  }

  const tabs = [
    { id: 'dashboard', icon: '◉', label: 'Home' },
    { id: 'budgets', icon: '◎', label: 'Budget' },
    { id: 'debts', icon: '◈', label: 'Debts' },
    { id: 'subs', icon: '◇', label: 'Subs' },
    { id: 'goals', icon: '△', label: 'Goals' },
    { id: 'bills', icon: '▢', label: 'Bills' },
    { id: 'chat', icon: '⬡', label: 'Fella' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28 }}>💰</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }} className="grad-green">Finance Hub</div>
      <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--green)', opacity: 0.5, animation: 'shimmer 1.5s infinite linear',
        backgroundImage: 'linear-gradient(90deg, var(--green) 0%, var(--teal) 50%, var(--green) 100%)', backgroundSize: '200% 100%' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 96, position: 'relative' }}>
      {/* Ambient background glow */}
      <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(48,209,88,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── HEADER ── */}
        <header style={{ padding: '56px 24px 20px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="fade-up">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                Castelluccio
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }} className="grad-green">
                Finance Hub
              </h1>
            </div>
            <div className="fade-up stagger-2" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Net Worth</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: netWorth >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: -0.5 }}>
                {fmt(netWorth)}
              </div>
            </div>
          </div>
        </header>

        {/* ── ALERTS ── */}
        {alerts.length > 0 && tab === 'dashboard' && (
          <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.slice(0, 3).map((a, i) => (
              <div key={a.id} className={`glass-sm fade-up stagger-${i + 3}`} style={{
                padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, lineHeight: 1.5,
                borderColor: a.severity === 'danger' ? 'rgba(255,69,58,0.15)' : a.severity === 'warning' ? 'rgba(255,159,10,0.15)' : a.severity === 'success' ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.15)',
              }}>
                <span style={{ flex: 1, color: 'var(--text-2)' }}>{a.message}</span>
                <button onClick={() => dismissAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ── CONTENT ── */}
        <main style={{ padding: '0 24px' }}>

          {/* ═══ DASHBOARD ═══ */}
          {tab === 'dashboard' && <>
            {/* Account Cards - horizontal scroll */}
            <div style={{ margin: '0 -24px', padding: '0 24px', overflowX: 'auto', display: 'flex', gap: 12, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
              {accounts.map((acc, i) => (
                <div key={acc.id} className={`glass fade-up stagger-${i + 1}`} style={{
                  minWidth: 200, padding: '18px 20px', scrollSnapAlign: 'start', flex: '0 0 auto',
                  background: acc.account_type === 'credit' || acc.account_type === 'loan'
                    ? 'linear-gradient(135deg, rgba(255,69,58,0.08), rgba(255,69,58,0.02))'
                    : acc.account_type === 'savings'
                    ? 'linear-gradient(135deg, rgba(48,209,88,0.08), rgba(48,209,88,0.02))'
                    : 'var(--glass)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', letterSpacing: 1.5, textTransform: 'uppercase' }}>{acc.bank}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginTop: 2, marginBottom: 12 }}>{acc.name}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: Number(acc.balance) >= 0 ? 'var(--text)' : 'var(--red)' }}>
                    {fmtFull(Number(acc.balance))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
              {([
                ['Income', fmt(monthlyIncome), 'var(--green)'],
                ['Spent', fmt(monthSpend), 'var(--orange)'],
                ['Recurring', fmt(monthlyRec), 'var(--purple)'],
              ] as const).map(([label, val, color], i) => (
                <div key={label} className={`glass fade-up stagger-${i + 3}`} style={{ padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Cash Flow Chart */}
            <GlassCard className="fade-up stagger-5" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Cash Flow</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--green)', display: 'inline-block' }} />In
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--orange)', display: 'inline-block' }} />Out
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
                {snapshots.map((d, i) => {
                  const mx = Math.max(...snapshots.flatMap(s => [s.total_income, s.total_expenses]))
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 110, width: '100%' }}>
                        <div style={{ flex: 1, borderRadius: 6, height: `${(d.total_income / mx) * 100}%`,
                          background: 'linear-gradient(180deg, var(--green), rgba(48,209,88,0.3))', transition: 'height 1s cubic-bezier(0.16,1,0.3,1)' }} />
                        <div style={{ flex: 1, borderRadius: 6, height: `${(d.total_expenses / mx) * 100}%`,
                          background: 'linear-gradient(180deg, var(--orange), rgba(255,159,10,0.3))', transition: 'height 1s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>{new Date(d.month).toLocaleDateString('en-AU', { month: 'short' })}</span>
                    </div>
                  )
                })}
              </div>
            </GlassCard>

            {/* Recent Transactions */}
            <GlassCard className="fade-up stagger-6" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, marginBottom: 16 }}>Recent</div>
              {transactions.slice(0, 7).map((tx, i) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0',
                  borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{tx.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: Number(tx.amount) >= 0 ? 'var(--green)' : 'var(--text-2)' }}>
                    {Number(tx.amount) >= 0 ? '+' : ''}{fmtFull(Number(tx.amount))}
                  </div>
                </div>
              ))}
            </GlassCard>

            {/* Savings callout */}
            {flagged.length > 0 && (
              <div className="fade-up stagger-7" style={{ marginTop: 16, padding: '18px 20px', borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, rgba(255,159,10,0.1), rgba(255,214,10,0.05))',
                border: '1px solid rgba(255,159,10,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💡</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)' }}>Save {fmt(potentialSavings)}/year</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{flagged.length} subscription{flagged.length > 1 ? 's' : ''} flagged for review</div>
                  </div>
                </div>
              </div>
            )}
          </>}

          {/* ═══ BUDGETS ═══ */}
          {tab === 'budgets' && <>
            <SectionHeader title="Budgets" subtitle={`April · ${fmt(monthSpend)} of ${fmt(categories.reduce((s, c) => s + Number(c.monthly_limit), 0))}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {spendByCat.map((cat, i) => (
                <GlassCard key={cat.id} className={`fade-up stagger-${Math.min(i + 1, 8)}`} style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{cat.icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>{fmt(cat.spent)} of {fmt(Number(cat.monthly_limit))}</div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Ring value={cat.spent} max={Number(cat.monthly_limit)} size={46} stroke={4} color={cat.color} />
                      <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: cat.percentage >= 90 ? 'var(--red)' : cat.percentage >= 75 ? 'var(--orange)' : 'var(--text-2)' }}>
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={cat.spent} max={Number(cat.monthly_limit)} color={cat.color} />
                </GlassCard>
              ))}
            </div>
          </>}

          {/* ═══ DEBTS ═══ */}
          {tab === 'debts' && <>
            <SectionHeader title="Debts" />
            <div className="fade-up" style={{ padding: '24px 20px', borderRadius: 'var(--radius)', marginBottom: 16,
              background: 'linear-gradient(135deg, rgba(255,69,58,0.1), rgba(255,69,58,0.03))',
              border: '1px solid rgba(255,69,58,0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Total Outstanding</div>
              <div className="mono" style={{ fontSize: 36, fontWeight: 800, color: 'var(--red)', letterSpacing: -1 }}>{fmt(totalDebt)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>Repaying {fmt(debts.reduce((s, d) => s + Number(d.monthly_payment), 0))}/month</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {debts.map((debt, i) => {
                const paid = Number(debt.original_amount) - Number(debt.current_balance)
                const prog = pct(paid, Number(debt.original_amount))
                return (
                  <GlassCard key={debt.id} className={`fade-up stagger-${i + 1}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{debt.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>
                          {debt.lender}{Number(debt.interest_rate) > 0 ? ` · ${debt.interest_rate}%` : ''}
                        </div>
                      </div>
                      <Pill text={`${prog}% paid`} color={prog > 70 ? 'green' : prog > 40 ? 'blue' : 'orange'} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-4)' }}>Remaining</span>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--red)' }}>{fmtFull(Number(debt.current_balance))}</span>
                    </div>
                    <ProgressBar value={paid} max={Number(debt.original_amount)} color="var(--green)" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-4)' }}>
                      <span>{fmt(Number(debt.original_amount))} original</span>
                      <span>{fmtFull(Number(debt.monthly_payment))}/mo</span>
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          </>}

          {/* ═══ SUBSCRIPTIONS ═══ */}
          {tab === 'subs' && <>
            <SectionHeader title="Subscriptions" subtitle={`${recurring.filter(r => r.status !== 'cancelled').length} active`} />
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="glass" style={{ padding: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Monthly</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(monthlyRec)}</div>
              </div>
              <div className="glass" style={{ padding: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Annual</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>{fmt(monthlyRec * 12)}</div>
              </div>
            </div>

            {flagged.length > 0 && <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--red)', display: 'inline-block', animation: 'breathe 2s infinite' }} />
                Needs Attention
              </div>
              {flagged.map((sub, i) => (
                <div key={sub.id} className={`glass-sm fade-up stagger-${i + 1}`} style={{
                  padding: 16, marginBottom: 8, borderColor: 'rgba(255,69,58,0.15)',
                  background: 'linear-gradient(135deg, rgba(255,69,58,0.06), transparent)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{sub.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmtFull(Number(sub.amount))}</span>
                      <Pill text={sub.status === 'duplicate' ? 'DUPE' : 'REVIEW'} color="red" />
                    </div>
                  </div>
                  {sub.notes && <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{sub.notes}</div>}
                </div>
              ))}
            </>}

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', margin: '16px 0 10px' }}>Active</div>
            {recurring.filter(r => r.status === 'active').map((sub, i) => (
              <GlassCard key={sub.id} className={`fade-up stagger-${Math.min(i + 1, 8)}`} style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                      {sub.category} · {sub.frequency}
                      {sub.next_due_date ? ` · ${new Date(sub.next_due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmtFull(Number(sub.amount))}</span>
                </div>
              </GlassCard>
            ))}
          </>}

          {/* ═══ GOALS ═══ */}
          {tab === 'goals' && <>
            <SectionHeader title="Goals" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {goals.map((goal, i) => {
                const prog = pct(Number(goal.current_amount), Number(goal.target_amount))
                const rem = Number(goal.target_amount) - Number(goal.current_amount)
                const dl = new Date(goal.deadline)
                const ml = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth())
                const pm = rem / ml; const pw = pm / 4.33
                return (
                  <GlassCard key={goal.id} className={`fade-up stagger-${i + 1}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 18, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{goal.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>{goal.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>
                          {fmt(Number(goal.target_amount))} · {new Date(goal.deadline).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Ring value={Number(goal.current_amount)} max={Number(goal.target_amount)} size={52} stroke={4} color={goal.color} />
                        <span style={{ position: 'absolute', fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{prog}%</span>
                      </div>
                    </div>
                    <ProgressBar value={Number(goal.current_amount)} max={Number(goal.target_amount)} color={goal.color} h={8} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>Saved <span className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(Number(goal.current_amount))}</span></span>
                      <span style={{ color: 'var(--text-4)' }}>{fmt(rem)} to go</span>
                    </div>
                    <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 'var(--radius-xs)',
                      background: 'linear-gradient(135deg, rgba(48,209,88,0.08), rgba(100,210,255,0.04))',
                      border: '1px solid rgba(48,209,88,0.08)', fontSize: 13, color: 'var(--text-2)' }}>
                      Save <span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(pw)}/wk</span> or <span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(pm)}/mo</span>
                    </div>
                    {goal.notes && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>{goal.notes}</div>}
                  </GlassCard>
                )
              })}
            </div>
          </>}

          {/* ═══ BILLS ═══ */}
          {tab === 'bills' && <>
            <SectionHeader title="Bills" subtitle="From Gmail + uploads" />
            <GlassCard className="fade-up" onClick={() => fileInputRef.current?.click()} style={{ textAlign: 'center', marginBottom: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Snap a Bill</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>Photo or upload — Fella reads it</div>
            </GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {emailBills.map((bill, i) => (
                <GlassCard key={bill.id} className={`fade-up stagger-${i + 1}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{bill.vendor}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>{bill.subject}</div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        <span style={{ color: 'var(--text-4)' }}>Due </span>
                        <span style={{ fontWeight: 600, color: new Date(bill.due_date) < now ? 'var(--red)' : 'var(--text-2)' }}>
                          {new Date(bill.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{fmtFull(Number(bill.amount))}</div>
                      <div style={{ marginTop: 6 }}>
                        <Pill text={bill.status === 'confirmed' ? 'CONFIRMED' : bill.status === 'paid' ? 'PAID' : 'NEW'} color={bill.status === 'paid' ? 'green' : bill.status === 'confirmed' ? 'blue' : 'orange'} />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>}

          {/* ═══ FELLA CHAT ═══ */}
          {tab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
              <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, var(--green-dim), var(--teal-dim))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🤖</div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Fella</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Voice + Text · Your finance brain</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
                {chatMessages.map((m, i) => (
                  <div key={i} className="fade-up" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '82%', padding: '14px 18px',
                      borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                      background: m.role === 'user'
                        ? 'linear-gradient(135deg, var(--green), #28b44c)'
                        : 'var(--glass)',
                      color: m.role === 'user' ? '#000' : 'var(--text)',
                      fontSize: 14, lineHeight: 1.6, fontWeight: m.role === 'user' ? 500 : 400,
                      border: m.role === 'assistant' ? '1px solid var(--glass-border)' : 'none',
                      backdropFilter: m.role === 'assistant' ? 'blur(40px)' : 'none',
                    }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex' }}>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '20px 20px 20px 6px', fontSize: 14, color: 'var(--text-4)' }}>
                      <span style={{ animation: 'breathe 1.5s infinite' }}>Fella is thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 12, paddingBottom: 8 }}>
                <button onClick={() => fileInputRef.current?.click()} className="glass press" style={{
                  width: 44, height: 44, borderRadius: 14, border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>📷</button>
                <button onClick={startListening} className="press" style={{
                  width: 44, height: 44, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isListening ? 'var(--red-dim)' : 'var(--glass)', color: isListening ? 'var(--red)' : 'var(--text-3)',
                  backdropFilter: 'blur(40px)',
                }}>{isListening ? '⏹' : '🎙'}</button>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Ask Fella..."
                  style={{ flex: 1, padding: '0 18px', height: 44, borderRadius: 14, border: '1px solid var(--glass-border)',
                    background: 'var(--glass)', backdropFilter: 'blur(40px)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={sendChat} disabled={chatLoading} className="press" style={{
                  width: 44, height: 44, borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, var(--green), #28b44c)',
                  color: '#000', cursor: 'pointer', fontSize: 18, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>↑</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '8px 4px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        zIndex: 100,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="press" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', minWidth: 44,
            color: tab === t.id ? 'var(--green)' : 'var(--text-4)', transition: 'color 0.2s',
          }}>
            <span style={{ fontSize: 18, fontWeight: 300, lineHeight: 1,
              textShadow: tab === t.id ? '0 0 12px rgba(48,209,88,0.5)' : 'none' }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
