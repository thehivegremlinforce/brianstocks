/** Vercel serverless proxy — Yahoo blocks some browser origins; server-side fetch is reliable */
export default async function handler(req, res) {
  const { symbol, period1, period2 } = req.query
  if (!symbol || !period1 || !period2) {
    return res.status(400).json({ error: 'symbol, period1, period2 required' })
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&indicators=quote&includeTimestamps=true`

  try {
    const yahooRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrianStocks/1.0)' },
    })
    const body = await yahooRes.text()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    res.status(yahooRes.status).send(body)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}