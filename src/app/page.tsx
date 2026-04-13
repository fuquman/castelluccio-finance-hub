'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

function ProgressBar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const p = pct(value, max)
  const barColor = p > 90 ? 'var(--danger)' : p > 75 ? 'var(--warning)' : color
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', borderRadius: height, background: barColor, transition: 'width 0.8s ease' }} />
    </div>
  )
}

function Card({ children, className = '', style = {}, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`card-hover ${className}`} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, border: '1px solid var(--border)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  )
}

function Badge({ text, color }: { text: string; color: 'danger' | 'warning' | 'accent' | 'info' | 'purple' }) {
  const colors = {
    danger: { bg: 'var(--danger-glow)', fg: 'var(--danger)' },
    warning: { bg: 'var(--warning-glow)', fg: 'var(--warning)' },
    accent: { bg: 'var(--accent-glow)', fg: 'var(--accent)' },
    info: { bg: 'var(--info-glow)', fg: 'var(--info)' },
    purple: { bg: 'var(--purple-glow)', fg: 'var(--purple)' },
  }
  const c = colors[color]
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.fg }}>{text}</span>
}

// ─── MINI BAR CHART ───
function BarChart({ data }: { data: MonthlySnapshot[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.total_income, d.total_expenses]))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 130, width: '100%' }}>
            <div style={{ flex: 1, borderRadius: '6px 6px 2px 2px', height: `${(d.total_income / maxVal) * 100}%`, background: 'linear-gradient(180deg, var(--accent), var(--accent-dark))', transition: 'height 0.8s ease' }} />
            <div style={{ flex: 1, borderRadius: '6px 6px 2px 2px', height: `${(d.total_expenses / maxVal) * 100}%`, background: 'linear-gradient(180deg, rgba(245,158,11,0.8), rgba(245,158,11,0.4))', transition: 'height 0.8s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>{new Date(d.month).toLocaleDateString('en-AU', { month: 'short' })}</span>
        </div>
      ))}
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

  // Fella Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: "G'day! I'm Fella, your family finance assistant. Ask me anything — like \"Can we afford Byron Bay in October?\" or \"Where are we wasting money?\" You can type or use voice." }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load all data
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
      setAccounts(a.data || [])
      setTransactions(t.data || [])
      setCategories(c.data || [])
      setRecurring(r.data || [])
      setDebts(d.data || [])
      setGoals(g.data || [])
      setIncome(i.data || [])
      setAlerts(al.data || [])
      setEmailBills(eb.data || [])
      setSnapshots(sn.data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // Computed
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance), 0)
  const netWorth = totalBalance - totalDebt
  const totalMonthlyIncome = income.reduce((s, i) => {
    const amt = Number(i.amount)
    if (i.frequency === 'weekly') return s + amt * 4.33
    if (i.frequency === 'fortnightly') return s + amt * 2.17
    if (i.frequency === 'monthly') return s + amt
    return s + amt
  }, 0)

  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const totalMonthlySpending = currentMonthTransactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const spendingByCategory = categories.map(cat => {
    const spent = currentMonthTransactions.filter(t => t.category === cat.name && Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    return { ...cat, spent, percentage: pct(spent, Number(cat.monthly_limit)) }
  }).sort((a, b) => b.percentage - a.percentage)

  const totalMonthlyRecurring = recurring.filter(r => r.status !== 'cancelled').reduce((s, r) => {
    const amt = Number(r.amount)
    if (r.frequency === 'weekly') return s + amt * 4.33
    if (r.frequency === 'fortnightly') return s + amt * 2.17
    if (r.frequency === 'quarterly') return s + amt / 3
    if (r.frequency === 'yearly') return s + amt / 12
    return s + amt
  }, 0)

  const flaggedSubs = recurring.filter(r => r.status === 'duplicate' || r.status === 'flagged')
  const potentialSavingsAmt = flaggedSubs.reduce((s, r) => s + Number(r.amount), 0) * 12

  const dismissAlert = async (id: string) => {
    await supabase.from('finance_alerts').update({ is_dismissed: true }).eq('id', id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  // Voice input
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome or Safari.')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-AU'
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setChatInput(transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  // Fella chat
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatLoading(true)

    try {
      const systemPrompt = `You are Fella — a warm, smart Australian family finance assistant for the Castelluccio family (Melbourne). Named after Rockefeller. You're direct, practical, and sharp with money.

THEIR FINANCIAL DATA:
- Bank Accounts: ${JSON.stringify(accounts.map(a => ({ name: a.name, bank: a.bank, balance: a.balance, type: a.account_type })))}
- Total Balance: ${fmtFull(totalBalance)}
- Total Debt: ${fmtFull(totalDebt)}
- Net Worth: ${fmtFull(netWorth)}
- Monthly Income (est): ${fmtFull(totalMonthlyIncome)}
- Monthly Spending (this month so far): ${fmtFull(totalMonthlySpending)}
- Monthly Recurring Costs: ${fmtFull(totalMonthlyRecurring)}
- Budget Categories & Spending: ${JSON.stringify(spendingByCategory.map(c => ({ name: c.name, budget: c.monthly_limit, spent: c.spent, pct: c.percentage + '%' })))}
- Debts: ${JSON.stringify(debts.map(d => ({ name: d.name, type: d.type, balance: d.current_balance, rate: d.interest_rate, payment: d.monthly_payment })))}
- Savings Goals: ${JSON.stringify(goals.map(g => ({ name: g.name, target: g.target_amount, saved: g.current_amount, deadline: g.deadline })))}
- Flagged Subscriptions: ${JSON.stringify(flaggedSubs.map(f => ({ name: f.name, amount: f.amount, reason: f.notes })))}
- Upcoming Bills from Email: ${JSON.stringify(emailBills.filter(e => e.status === 'unreviewed').map(e => ({ vendor: e.vendor, amount: e.amount, due: e.due_date })))}
- Income Sources: ${JSON.stringify(income.map(i => ({ name: i.name, amount: i.amount, freq: i.frequency })))}

RULES:
- Be warm and direct — like a smart mate who's great with money
- Use AUD
- Reference their ACTUAL data
- If they mention spending (e.g. "we spent $200 on dinner"), acknowledge it and explain how it affects their budget
- If they ask about a trip/purchase, calculate savings needed per week/month
- Flag waste and duplicates proactively
- Keep answers concise (2-4 sentences usually)
- Use casual Australian-friendly language`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, systemPrompt }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply || "Sorry, had a bit of trouble there. Give it another go." }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: "Connection hiccup — try again in a sec." }])
    }
    setChatLoading(false)
  }

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // For now, show in chat that the feature exists
    setChatMessages(prev => [...prev,
      { role: 'user', text: `📷 Uploaded bill photo: ${file.name}` },
      { role: 'assistant', text: `Got it — I've received the photo of that bill. In the full version, I'll OCR this and extract the vendor, amount, and due date automatically. For now, you can tell me the details and I'll log it for you.` }
    ])
  }

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '📊' },
    { id: 'budgets', label: 'Budgets', icon: '🎯' },
    { id: 'debts', label: 'Debts', icon: '💳' },
    { id: 'subs', label: 'Subs', icon: '🔄' },
    { id: 'goals', label: 'Goals', icon: '🏖️' },
    { id: 'bills', label: 'Bills', icon: '📬' },
    { id: 'chat', label: 'Fella', icon: '🤖' },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>💰</div>
        <div style={{ fontSize: 18, fontWeight: 600 }} className="gradient-text">Loading Finance Hub...</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Connecting to your data</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* HEADER */}
      <header style={{ padding: '16px 20px 12px', background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Castelluccio Family</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }} className="gradient-text">Finance Hub</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>Net Worth</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: netWorth >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmt(netWorth)}</div>
          </div>
        </div>
      </header>

      {/* ALERTS BAR */}
      {alerts.filter(a => !a.is_read).length > 0 && tab === 'dashboard' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {alerts.filter(a => !a.is_read).slice(0, 3).map(alert => (
            <div key={alert.id} className="animate-fade-in" style={{
              padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontSize: 13, lineHeight: 1.5,
              background: alert.severity === 'danger' ? 'var(--danger-glow)' : alert.severity === 'warning' ? 'var(--warning-glow)' : alert.severity === 'success' ? 'var(--accent-glow)' : 'var(--info-glow)',
              border: `1px solid ${alert.severity === 'danger' ? 'rgba(239,68,68,0.2)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.2)' : alert.severity === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}`,
            }}>
              <span style={{ flex: 1 }}>{alert.message}</span>
              <button onClick={() => dismissAlert(alert.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* CONTENT */}
      <main style={{ padding: '0 20px' }}>
        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Account Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {accounts.map(acc => (
                <Card key={acc.id} style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{acc.bank}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>{acc.name}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: Number(acc.balance) >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                    {fmtFull(Number(acc.balance))}
                  </div>
                </Card>
              ))}
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Card style={{ padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Income/mo</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalMonthlyIncome)}</div>
              </Card>
              <Card style={{ padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Spent/mo</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>{fmt(totalMonthlySpending)}</div>
              </Card>
              <Card style={{ padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Recurring</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--purple)' }}>{fmt(totalMonthlyRecurring)}</div>
              </Card>
            </div>

            {/* Cash Flow Chart */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Cash Flow</h3>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Income</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning)', display: 'inline-block' }} /> Expenses</span>
                </div>
              </div>
              <BarChart data={snapshots} />
            </Card>

            {/* Recent Transactions */}
            <Card>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Recent Transactions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {transactions.slice(0, 8).map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{tx.category} · {new Date(tx.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: Number(tx.amount) >= 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {Number(tx.amount) >= 0 ? '+' : ''}{fmtFull(Number(tx.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Potential Savings Callout */}
            {flaggedSubs.length > 0 && (
              <Card style={{ background: 'var(--warning-glow)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>💡</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--warning)' }}>Potential Savings Found</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {flaggedSubs.length} subscription{flaggedSubs.length > 1 ? 's' : ''} flagged — could save <span className="mono" style={{ fontWeight: 700, color: 'var(--warning)' }}>{fmt(potentialSavingsAmt)}/year</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── BUDGETS ── */}
        {tab === 'budgets' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Monthly Budgets</h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>April 2026 — {fmt(totalMonthlySpending)} of {fmt(categories.reduce((s, c) => s + Number(c.monthly_limit), 0))} budget used</p>
            {spendingByCategory.map(cat => (
              <Card key={cat.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmt(cat.spent)} of {fmt(Number(cat.monthly_limit))}</div>
                    </div>
                  </div>
                  <div>
                    {cat.percentage >= 90 ? <Badge text={`${cat.percentage}%`} color="danger" /> :
                     cat.percentage >= 75 ? <Badge text={`${cat.percentage}%`} color="warning" /> :
                     <Badge text={`${cat.percentage}%`} color="accent" />}
                  </div>
                </div>
                <ProgressBar value={cat.spent} max={Number(cat.monthly_limit)} color={cat.color} />
              </Card>
            ))}
          </div>
        )}

        {/* ── DEBTS ── */}
        {tab === 'debts' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Debt Tracker</h2>
            <Card style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)', padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}>Total Debt Remaining</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>{fmt(totalDebt)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Monthly repayments: {fmt(debts.reduce((s, d) => s + Number(d.monthly_payment), 0))}</div>
            </Card>
            {debts.map(debt => {
              const paid = Number(debt.original_amount) - Number(debt.current_balance)
              const progress = pct(paid, Number(debt.original_amount))
              return (
                <Card key={debt.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{debt.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{debt.lender} · {debt.type.replace('_', ' ')}{Number(debt.interest_rate) > 0 ? ` · ${debt.interest_rate}% p.a.` : ''}</div>
                    </div>
                    <Badge text={`${progress}% paid`} color={progress > 70 ? 'accent' : progress > 40 ? 'info' : 'warning'} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-dim)' }}>Remaining</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmtFull(Number(debt.current_balance))}</span>
                  </div>
                  <ProgressBar value={paid} max={Number(debt.original_amount)} color="var(--accent)" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                    <span>Originally {fmt(Number(debt.original_amount))}</span>
                    <span>Paying {fmtFull(Number(debt.monthly_payment))}/mo</span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── SUBSCRIPTIONS ── */}
        {tab === 'subs' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Subscriptions & Recurring</h2>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Total Monthly Cost</div>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{fmt(totalMonthlyRecurring)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Annual Cost</div>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{fmt(totalMonthlyRecurring * 12)}</div>
                </div>
              </div>
            </Card>

            {flaggedSubs.length > 0 && (
              <>
                <h3 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>⚠️ Flagged — Review These</h3>
                {flaggedSubs.map(sub => (
                  <Card key={sub.id} style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'var(--danger-glow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{sub.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmtFull(Number(sub.amount))}/{sub.frequency === 'monthly' ? 'mo' : sub.frequency}</span>
                        <Badge text={sub.status === 'duplicate' ? 'DUPLICATE' : 'REVIEW'} color="danger" />
                      </div>
                    </div>
                    {sub.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub.notes}</div>}
                  </Card>
                ))}
              </>
            )}

            <h3 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Active Subscriptions</h3>
            {recurring.filter(r => r.status === 'active').map(sub => (
              <Card key={sub.id} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub.category} · {sub.frequency}{sub.next_due_date ? ` · Due ${new Date(sub.next_due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmtFull(Number(sub.amount))}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── GOALS ── */}
        {tab === 'goals' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Savings Goals</h2>
            {goals.map(goal => {
              const progress = pct(Number(goal.current_amount), Number(goal.target_amount))
              const remaining = Number(goal.target_amount) - Number(goal.current_amount)
              const deadline = new Date(goal.deadline)
              const now = new Date()
              const monthsLeft = Math.max(1, (deadline.getFullYear() - now.getFullYear()) * 12 + deadline.getMonth() - now.getMonth())
              const perMonth = remaining / monthsLeft
              const perWeek = perMonth / 4.33
              return (
                <Card key={goal.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 32 }}>{goal.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{goal.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Target: {fmt(Number(goal.target_amount))} by {new Date(goal.deadline).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</div>
                    </div>
                    <Badge text={`${progress}%`} color={progress > 70 ? 'accent' : progress > 40 ? 'info' : 'warning'} />
                  </div>
                  <ProgressBar value={Number(goal.current_amount)} max={Number(goal.target_amount)} color={goal.color} height={10} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                    <span>Saved: <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(Number(goal.current_amount))}</span></span>
                    <span>Remaining: <span className="mono" style={{ fontWeight: 600 }}>{fmt(remaining)}</span></span>
                  </div>
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--accent-glow)', fontSize: 13 }}>
                    💡 Save <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(perWeek)}/week</span> or <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(perMonth)}/month</span> to reach this goal
                  </div>
                  {goal.notes && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>{goal.notes}</div>}
                </Card>
              )
            })}
          </div>
        )}

        {/* ── BILLS (Email + Upload) ── */}
        {tab === 'bills' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Bills & Invoices</h2>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-dim)' }}>Auto-scanned from Gmail + manual uploads</p>

            {/* Upload Button */}
            <Card style={{ padding: 16, cursor: 'pointer', textAlign: 'center', border: '1px dashed var(--border-light)' }} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoUpload} />
              <span style={{ fontSize: 32 }}>📸</span>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>Snap a Bill</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Take a photo or upload — Fella will read it</div>
            </Card>

            {/* Email Bills */}
            <h3 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>📬 From Your Email</h3>
            {emailBills.map(bill => (
              <Card key={bill.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{bill.vendor}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{bill.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                      Due: <span style={{ fontWeight: 600, color: new Date(bill.due_date) < new Date() ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {new Date(bill.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{fmtFull(Number(bill.amount))}</div>
                    <Badge text={bill.status === 'confirmed' ? 'CONFIRMED' : bill.status === 'paid' ? 'PAID' : 'NEW'} color={bill.status === 'paid' ? 'accent' : bill.status === 'confirmed' ? 'info' : 'warning'} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── FELLA CHAT ── */}
        {tab === 'chat' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 36 }}>🤖</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Fella</h2>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Your family finance assistant · Voice + Text</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
                    fontSize: 14, lineHeight: 1.6, fontWeight: msg.role === 'user' ? 500 : 400,
                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-dim)' }}>
                    Fella is thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>📷</button>
              <button onClick={startListening} style={{
                width: 44, height: 44, borderRadius: 12, border: `1px solid ${isListening ? 'var(--danger)' : 'var(--border)'}`,
                background: isListening ? 'var(--danger-glow)' : 'var(--bg-card)',
                color: isListening ? 'var(--danger)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isListening ? 'pulse-glow 1.5s infinite' : 'none',
              }}>{isListening ? '⏹️' : '🎙️'}</button>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask Fella anything..."
                style={{
                  flex: 1, padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={sendChat} disabled={chatLoading} style={{
                width: 44, height: 44, borderRadius: 12, border: 'none', background: 'var(--accent)',
                color: '#000', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>↑</button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 72,
        background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 8px', paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
            color: tab === t.id ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'color 0.2s',
          }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
