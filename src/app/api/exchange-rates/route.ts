import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/backend/helpers/get-admin-caller'

// GET /api/exchange-rates?codes=USD,EUR,SGD
// Returns IDR rates fetched from Yahoo Finance (e.g. USDIDR=X)
export async function GET(req: NextRequest) {
  // Endpoint ini memanggil API eksternal atas nama server — jangan biarkan terbuka
  // untuk publik meski datanya sendiri tidak sensitif.
  const caller = await requireAuth()
  if (caller instanceof NextResponse) return caller

  const codes = req.nextUrl.searchParams.get('codes')
  if (!codes) {
    return NextResponse.json({ error: 'codes param required' }, { status: 400 })
  }

  const symbols = codes
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((c) => `${c}IDR=X`)
    .join(',')

  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,shortName`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }, // cache for 5 minutes
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Yahoo Finance' }, { status: 502 })
    }

    const json = await res.json()
    const quotes: { symbol: string; regularMarketPrice: number }[] =
      json?.quoteResponse?.result ?? []

    const rates: Record<string, number> = {}
    for (const q of quotes) {
      // symbol is like "USDIDR=X" → extract currency code
      const code = q.symbol.replace('IDR=X', '')
      rates[code] = q.regularMarketPrice
    }

    return NextResponse.json({ data: rates })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 502 })
  }
}
