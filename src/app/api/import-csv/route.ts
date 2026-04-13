import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { csvText, bankName } = await req.json()
    
    if (!csvText) {
      return NextResponse.json({ error: 'No CSV data' }, { status: 400 })
    }

    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header and at least one row' }, { status: 400 })
    }

    // Parse header to detect format
    const header = lines[0].toLowerCase()
    let transactions: any[] = []

    // Common Australian bank CSV formats
    if (header.includes('date') && header.includes('description') && header.includes('amount')) {
      // Standard format: Date, Description, Amount (ME Bank, generic)
      const cols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''))
      const dateIdx = cols.findIndex(c => c.includes('date'))
      const descIdx = cols.findIndex(c => c.includes('description') || c.includes('narrative') || c.includes('details'))
      const amtIdx = cols.findIndex(c => c.includes('amount') || c.includes('value'))
      const catIdx = cols.findIndex(c => c.includes('category') || c.includes('type'))
      
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i])
        if (row.length < 2) continue
        
        const rawDate = row[dateIdx] || ''
        const date = parseDate(rawDate)
        const description = (row[descIdx] || '').trim()
        const amount = parseFloat((row[amtIdx] || '0').replace(/[^\d.-]/g, ''))
        const category = catIdx >= 0 ? (row[catIdx] || '').trim() : guessCategory(description)
        
        if (description && !isNaN(amount) && date) {
          transactions.push({ date, description, amount, category, logged_by: 'csv_import' })
        }
      }
    } else if (header.includes('debit') && header.includes('credit')) {
      // ING/Amex format: Date, Description, Debit, Credit
      const cols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''))
      const dateIdx = cols.findIndex(c => c.includes('date'))
      const descIdx = cols.findIndex(c => c.includes('description') || c.includes('narrative') || c.includes('details'))
      const debitIdx = cols.findIndex(c => c.includes('debit'))
      const creditIdx = cols.findIndex(c => c.includes('credit'))
      
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i])
        if (row.length < 2) continue
        
        const rawDate = row[dateIdx] || ''
        const date = parseDate(rawDate)
        const description = (row[descIdx] || '').trim()
        const debit = parseFloat((row[debitIdx] || '0').replace(/[^\d.-]/g, '')) || 0
        const credit = parseFloat((row[creditIdx] || '0').replace(/[^\d.-]/g, '')) || 0
        const amount = credit > 0 ? credit : -debit
        
        if (description && date && (debit > 0 || credit > 0)) {
          transactions.push({ date, description, amount, category: guessCategory(description), logged_by: 'csv_import' })
        }
      }
    } else {
      // Fallback: try to parse any CSV with at least date-like and number columns
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i])
        if (row.length < 2) continue
        
        // Find a date-like field and a number field
        let date = '', description = '', amount = 0
        for (const cell of row) {
          const trimmed = cell.trim()
          if (!date && parseDate(trimmed)) date = parseDate(trimmed)!
          else if (!amount && /^-?\$?[\d,.]+$/.test(trimmed.replace(/[^\d.,-]/g, ''))) amount = parseFloat(trimmed.replace(/[^\d.-]/g, ''))
          else if (!description && trimmed.length > 2 && !/^\d+$/.test(trimmed)) description = trimmed
        }
        
        if (date && description && amount !== 0) {
          transactions.push({ date, description, amount, category: guessCategory(description), logged_by: 'csv_import' })
        }
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Could not parse any transactions from CSV' }, { status: 400 })
    }

    // Check for duplicates (same date + description + amount)
    const { data: existing } = await supabase.from('transactions').select('date,description,amount')
    const existingSet = new Set((existing || []).map(t => `${t.date}|${t.description}|${t.amount}`))
    const newTx = transactions.filter(t => !existingSet.has(`${t.date}|${t.description}|${t.amount}`))
    const dupes = transactions.length - newTx.length

    if (newTx.length > 0) {
      const { error } = await supabase.from('transactions').insert(newTx)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      imported: newTx.length, 
      duplicates: dupes, 
      total: transactions.length,
      bankName: bankName || 'Unknown'
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to process CSV' }, { status: 500 })
  }
}

function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += char }
  }
  result.push(current.trim())
  return result
}

function parseDate(str: string): string | null {
  if (!str) return null
  str = str.replace(/"/g, '').trim()
  
  // DD/MM/YYYY (Australian format)
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  
  // YYYY-MM-DD (ISO)
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  
  // DD MMM YYYY
  const months: Record<string,string> = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
  m = str.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/)
  if (m && months[m[2]]) return `${m[3]}-${months[m[2]]}-${m[1].padStart(2,'0')}`
  
  return null
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (/woolworths|coles|aldi|iga|costco/.test(d)) return 'Groceries'
  if (/uber eats|menulog|doordash|deliveroo|mcdonald|kfc|pizza|nandos|hungry/.test(d)) return 'Takeaway & Dining'
  if (/netflix|spotify|disney|stan|youtube|apple\.com|google\s*(play|storage)|amazon prime/.test(d)) return 'Subscriptions'
  if (/bp |shell|caltex|ampol|7-eleven|united petrol|petrol/.test(d)) return 'Transport & Fuel'
  if (/agl|origin|energy|telstra|optus|vodafone|tpg|internet|electricity|gas bill/.test(d)) return 'Utilities'
  if (/kmart|target|big w|bunnings|officeworks|jb hi|harvey norman/.test(d)) return 'Shopping'
  if (/chemist|pharmacy|doctor|medical|dental|health|hospital/.test(d)) return 'Health & Medical'
  if (/school|education|childcare|kindy/.test(d)) return 'Kids & School'
  if (/insurance|racv|nrma|allianz|suncorp/.test(d)) return 'Insurance'
  if (/salary|wages|pay|xero|employment/.test(d)) return 'Income'
  if (/transfer|tfr/.test(d)) return 'Transfer'
  if (/atm|cash/.test(d)) return 'Cash'
  if (/afterpay|zip pay|humm|latitude/.test(d)) return 'BNPL'
  if (/pet|vet|pet circle|petbarn/.test(d)) return 'Pets'
  if (/sport|gym|fitness|swimming/.test(d)) return 'Sports & Activities'
  return 'Other'
}
