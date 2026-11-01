import { describe, expect, it } from 'vitest';
import {
  MAX_SYMBOLS,
  addSymbol,
  cleanSymbol,
  formatChange,
  isValidSymbol,
  parseQuote,
  quoteUrl,
  removeSymbol,
} from '../logic';

describe('the symbols', () => {
  it('cleans the text to an upper case ticker', () => {
    expect(cleanSymbol('  aapl ')).toBe('AAPL');
  });

  it('accepts tickers with a dot or a dash, and rejects the rest', () => {
    expect(isValidSymbol('AAPL')).toBe(true);
    expect(isValidSymbol('BRK.B')).toBe(true);
    expect(isValidSymbol('RDS-A')).toBe(true);
    expect(isValidSymbol('')).toBe(false);
    expect(isValidSymbol('APPLE INC')).toBe(false);
    expect(isValidSymbol('AAPL&token=x')).toBe(false);
    expect(isValidSymbol('ABCDEFGHIJK')).toBe(false);
  });

  it('follows at most two stocks', () => {
    const one = addSymbol([], 'AAPL');
    const two = addSymbol(one, 'MSFT');
    expect(MAX_SYMBOLS).toBe(2);
    expect(two).toEqual(['AAPL', 'MSFT']);
    expect(addSymbol(two, 'NVDA')).toEqual(['AAPL', 'MSFT']);
  });

  it('does not add the same stock twice', () => {
    expect(addSymbol(['AAPL'], 'AAPL')).toEqual(['AAPL']);
  });

  it('removes a stock', () => {
    expect(removeSymbol(['AAPL', 'MSFT'], 'AAPL')).toEqual(['MSFT']);
  });
});

describe('the quote address', () => {
  it('encodes the symbol and the key', () => {
    expect(quoteUrl('BRK.B', 'a&b')).toBe('https://finnhub.io/api/v1/quote?symbol=BRK.B&token=a%26b');
  });
});

describe('a quote', () => {
  it('reads the price, the change and the day range', () => {
    const quote = parseQuote('AAPL', { c: 190.5, d: 1.25, dp: 0.66, h: 191, l: 188.2, t: 1700000000 });
    expect(quote).toEqual({ symbol: 'AAPL', price: 190.5, change: 1.25, changePercent: 0.66, high: 191, low: 188.2, time: 1700000000 });
  });

  it('is missing when the price is 0, as Finnhub sends for an unknown symbol', () => {
    expect(parseQuote('NOPE', { c: 0, d: null, dp: null, h: 0, l: 0, t: 0 })).toBeUndefined();
    expect(parseQuote('NOPE', {})).toBeUndefined();
    expect(parseQuote('NOPE', undefined)).toBeUndefined();
  });

  it('fills in missing change figures with 0', () => {
    expect(parseQuote('AAPL', { c: 10 })).toMatchObject({ change: 0, changePercent: 0, high: 10, low: 10 });
  });

  it('shows the change with a sign', () => {
    const up = parseQuote('AAPL', { c: 10, d: 1.25, dp: 0.6 })!;
    const down = parseQuote('AAPL', { c: 10, d: -3.1, dp: -1.2 })!;
    expect(formatChange(up)).toBe('+1.25 (+0.60%)');
    expect(formatChange(down)).toBe('-3.10 (-1.20%)');
  });
});
