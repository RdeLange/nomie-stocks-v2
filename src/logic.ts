// Rules for the stocks plugin, as plain functions, so they can be tested without the app and without the network.

// The plugin follows one or two stocks, so the dashboard card stays small.
export const MAX_SYMBOLS = 2;

// A ticker such as AAPL, BRK.B or 7203.T: letters, digits, a dot or a dash, up to ten characters.
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,10}$/;

export type Quote = { symbol: string; price: number; change: number; changePercent: number; high: number; low: number; time: number };

export const cleanSymbol = (text: string): string => text.trim().toUpperCase();

export const isValidSymbol = (symbol: string): boolean => SYMBOL_PATTERN.test(symbol);

// Adds a symbol, unless it is already there or the list is full. Returns the list unchanged in those cases.
export const addSymbol = (symbols: Array<string>, symbol: string): Array<string> =>
  symbols.includes(symbol) || symbols.length >= MAX_SYMBOLS ? symbols : [...symbols, symbol];

export const removeSymbol = (symbols: Array<string>, symbol: string): Array<string> =>
  symbols.filter((s) => s !== symbol);

// The address of one quote. Finnhub allows browser requests, so the plugin calls it directly.
export const quoteUrl = (symbol: string, apiKey: string): string =>
  `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;

// Finnhub answers with c (current price), d (change), dp (change in percent), h, l and t (time).
// An unknown symbol comes back with a price of 0, so that is treated as no quote.
export const parseQuote = (symbol: string, data: any): Quote | undefined => {
  if (!data || typeof data.c !== 'number' || data.c <= 0) return undefined;
  return {
    symbol,
    price: data.c,
    change: typeof data.d === 'number' ? data.d : 0,
    changePercent: typeof data.dp === 'number' ? data.dp : 0,
    high: typeof data.h === 'number' ? data.h : data.c,
    low: typeof data.l === 'number' ? data.l : data.c,
    time: typeof data.t === 'number' ? data.t : 0,
  };
};

export const isUp = (quote: Quote): boolean => quote.change >= 0;

export const formatPrice = (value: number): string => value.toFixed(2);

// For example "+1.25 (+0.60%)" or "-3.10 (-1.20%)".
export const formatChange = (quote: Quote): string => {
  const sign = (n: number) => (n >= 0 ? '+' : '');
  return `${sign(quote.change)}${quote.change.toFixed(2)} (${sign(quote.changePercent)}${quote.changePercent.toFixed(2)}%)`;
};

// A quote time in local time, shown under the price. A quote without a time shows no time.
export const formatTime = (seconds: number, locale?: string): string =>
  seconds > 0 ? new Date(seconds * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
