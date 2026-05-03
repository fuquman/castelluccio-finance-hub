import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import heicConvert from 'heic-convert'

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
  logged_by: 'screenshot_import'
}

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const bankName = String(formData.get('bankName') || 'Unknown')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file uploaded' }, { status: 400 })
    }

    const originalType = getImageType(file)
    if (!SUPPORTED_IMAGE_TYPES.has(originalType)) {
      return NextResponse.json({ error: 'Uploaded file must be a JPG, PNG, WEBP, or HEIC image' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }

    const { buffer, mediaType } = await prepareImage(file, originalType)
    const base64Image = buffer.toString('base64')
    const todayDate = new Date().toISOString().split('T')[0]
    const prompt = `Extract all bank transactions visible in this screenshot/photo. Return ONLY a JSON array, no other text. Each item: {"date":"YYYY-MM-DD","description":"string","amount":number}. Negative amounts for debits/expenses, positive for credits/deposits. If date is not visible use today as ${todayDate}. Bank: ${bankName}`

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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
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
      logged_by: 'screenshot_import',
    }))

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Could not parse any transactions from image' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: existing } = await supabase.from('transactions').select('date,description,amount')
    const existingSet = new Set((existing || []).map(t => `${t.date}|${t.description}|${t.amount}`))
    const newTx = transactions.filter(t => {
      const key = `${t.date}|${t.description}|${t.amount}`
      if (existingSet.has(key)) return false
      existingSet.add(key)
      return true
    })
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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to process image' }, { status: 500 })
  }
}

function getImageType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const fileType = file.type.toLowerCase()
  if (fileType === 'image/jpg') return 'image/jpeg'
  if (fileType) return fileType
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return ''
}

async function prepareImage(file: File, imageType: string): Promise<{ buffer: Buffer; mediaType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (imageType === 'image/heic' || imageType === 'image/heif') {
    const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 })
    return { buffer: Buffer.from(converted), mediaType: 'image/jpeg' }
  }

  return { buffer, mediaType: imageType }
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
