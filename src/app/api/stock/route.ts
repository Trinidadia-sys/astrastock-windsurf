import { NextResponse } from 'next/server';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Map frontend timeRange labels to Yahoo Finance API params
const TIME_RANGE_MAP: Record<string, { interval: string; range: string }> = {
  '1D': { interval: '5m',  range: '1d'  },
  '1W': { interval: '1h',  range: '5d'  },
  '1M': { interval: '1d',  range: '1mo' },
  '1Y': { interval: '1wk',  range: '1y'  },
  '5Y': { interval: '1mo',  range: '5y'  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol    = searchParams.get('symbol')?.toUpperCase();
  const timeRange = searchParams.get('timeRange') ?? '1D';

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const { interval, range } = TIME_RANGE_MAP[timeRange] ?? TIME_RANGE_MAP['1D'];

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    };

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const yahooResponse = await fetch(url, { headers, cache: 'no-store' });

    // If Yahoo blocks us, return a real error — never fake data
    if (!yahooResponse.ok) {
      console.error(`Yahoo API error: ${yahooResponse.status} for ${symbol}`);
      return NextResponse.json(
        { success: false, error: `Yahoo Finance error: ${yahooResponse.status}` },
        { status: 502 }
      );
    }

    const responseText = await yahooResponse.text();
    
    // If Yahoo returned an HTML error page, return a real error
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error(`Yahoo returned HTML for ${symbol} — likely rate limited`);
      return NextResponse.json(
        { success: false, error: 'Yahoo Finance is rate limiting this server. Try again in a moment.' },
        { status: 429 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`Failed to parse Yahoo response for ${symbol}`);
      return NextResponse.json(
        { success: false, error: 'Invalid response from Yahoo Finance' },
        { status: 502 }
      );
    }

    if (!data.chart?.result?.length) {
      return NextResponse.json(
        { success: false, error: `No data found for symbol: ${symbol}` },
        { status: 404 }
      );
    }

    const result                   = data.chart.result[0];
    const meta                     = result.meta;
    const timestamps: number[]     = result.timestamp || [];
    const quotes                   = result.indicators.quote[0];
    const closePrices: number[]    = quotes.close || [];

    const currentPrice: number = meta.regularMarketPrice;
 
    // Try every known field Yahoo uses for previous close
    const previousClose: number =
      meta.chartPreviousClose ??
      meta.previousClose ??
      meta.regularMarketPreviousClose ??
      closePrices.filter(Boolean).slice(-2)[0] ??
       currentPrice;
 
    const change        = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
 
    // Format date label based on time range
    const formatDate = (ts: number): string => {
      const d = new Date(ts * 1000);
      if (timeRange === '1D') {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const historicalData = timestamps
      .map((t, i) => ({
        date:   formatDate(t),
        price:  closePrices[i] ?? null,
        volume: quotes.volume?.[i] || 0,
        high:   quotes.high?.[i]  ?? null,
        low:    quotes.low?.[i]   ?? null,
      }))
      .filter(d => d.price != null);

    const marketCapRaw = meta.marketCap ?? null;
    const marketCap    = marketCapRaw
      ? `$${(marketCapRaw / 1_000_000_000).toFixed(1)}B`
      : 'N/A';

    const stockData = {
      symbol,
      name:          meta.longName || meta.shortName || symbol,
      price:         currentPrice,
      change,
      changePercent,
      previousClose,
      volume:        meta.regularMarketVolume?.toLocaleString() || 'N/A',
      marketCap,
      dayHigh:       meta.regularMarketDayHigh ?? null,
      dayLow:        meta.regularMarketDayLow  ?? null,
      historicalData,
      lastUpdated:   new Date().toISOString(),
    };

    console.log(`[${symbol}/${timeRange}] price=${currentPrice}, prevClose=${previousClose}, change=${change.toFixed(2)}, pct=${changePercent.toFixed(2)}%`);

    return NextResponse.json({ success: true, data: stockData });

  } catch (error) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
