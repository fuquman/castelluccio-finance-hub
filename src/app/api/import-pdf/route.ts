import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

type ClaudeContentBlock = {
  type: string
  text?: string
}

type ExtractedTransaction = {
  date: string
  description: string
  amount: number
}

type ImportedTransaction = ExtractedTransaction & {
  category: string
  logged_by: 'pdf_import'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const bankName = String(formData.get('bankName') || 'Unknown')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 })
    }

    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Uploaded file must be a PDF' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const parsedPdf = await parser.getText()
    await parser.destroy()
    const extractedText = parsedPdf.text.trim()

    if (!extractedText) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 })
    }

    const prompt = `Extract all bank transactions from this ${bankName} bank statement. Return ONLY a JSON array, no other text. Each item: {"date":"YYYY-MM-DD","description":"string","amount":number}. Negative amounts for debits/expenses, positive for credits/deposits. Bank statement text:\n\n${extractedText}`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errorText = await anthropicRes.text()
      return NextResponse.json({ error: `Claude API error: ${errorText}` }, { status: 502 })
    }

    const anthropicData = await anthropicRes.json()
    const contentText = ((anthropicData.content || []) as ClaudeContentBlock[])
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text)
      .join('\n')
      .trim()

    const extractedTransactions = parseClaudeTransactions(contentText)
    const transactions: ImportedTransaction[] = extractedTransactions.map(t => ({
      ...t,
      description: t.description.trim(),
      category: guessCategory(t.description),
      logged_by: 'pdf_import',
    }))

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Could not parse any transactions from PDF' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: existing } = await supabase.from('transactions').select('date,description,amount')
    const existingSet = new Set((existing || []).map(t => `${t.date}|${t.description}|${t.amount}`))
    const newTx = transactions.filter(t => !existingSet.has(`${t.date}|${t.description}|${t.amount}`))
    const skipped = transactions.length - newTx.length

    if (newTx.length > 0) {
      const { error } = await supabase.from('transactions').insert(newTx)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      imported: newTx.length,
      skipped,
      transactions: newTx,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to process PDF' }, { status: 500 })
  }
}

function parseClaudeTransactions(contentText: string): ExtractedTransaction[] {
  if (!contentText) throw new Error('Claude returned an empty response')

  const jsonText = extractJsonArray(contentText)
  const parsed = JSON.parse(jsonText) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Claude response was not a JSON array')
  }

  return parsed
    .map(item => normalizeTransaction(item))
    .filter((item): item is ExtractedTransaction => Boolean(item))
}

function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = (fenced?.[1] || text).trim()
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')

  if (start === -1 || end === -1 || end < start) {
    throw new Error('Claude response did not contain a JSON array')
  }

  return raw.slice(start, end + 1)
}

function normalizeTransaction(item: unknown): ExtractedTransaction | null {
  if (!item || typeof item !== 'object') return null

  const tx = item as Record<string, unknown>
  const date = typeof tx.date === 'string' ? tx.date.trim() : ''
  const description = typeof tx.description === 'string' ? tx.description.trim() : ''
  const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || !Number.isFinite(amount)) {
    return null
  }

  return { date, description, amount }
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
