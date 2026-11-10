// Fetches the quotes. Kept apart from the logic, so the logic can be tested without the network.
import { parseQuote, quoteUrl, type Quote } from './logic';
import { t } from './i18n/index.svelte';

// The reasons a quote can fail, so the screen can say what to do.
export type QuoteProblem = 'key' | 'limit' | 'symbol' | 'network';

export class QuoteError extends Error {
  constructor(public problem: QuoteProblem) {
    super(problem);
  }
}

export const fetchQuote = async (symbol: string, apiKey: string): Promise<Quote> => {
  let response: Response;
  try {
    response = await fetch(quoteUrl(symbol, apiKey));
  } catch {
    throw new QuoteError('network');
  }
  if (response.status === 401 || response.status === 403) throw new QuoteError('key');
  if (response.status === 429) throw new QuoteError('limit');
  if (!response.ok) throw new QuoteError('network');
  const quote = parseQuote(symbol, await response.json());
  if (!quote) throw new QuoteError('symbol');
  return quote;
};

// The message for the user, in plain words.
export const problemText = (problem: QuoteProblem): string => {
  switch (problem) {
    case 'key':
      return t('problemKey');
    case 'limit':
      return t('problemLimit');
    case 'symbol':
      return t('problemSymbol');
    default:
      return t('problemNetwork');
  }
};
