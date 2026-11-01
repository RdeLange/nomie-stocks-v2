// Fetches the quotes. Kept apart from the logic, so the logic can be tested without the network.
import { parseQuote, quoteUrl, type Quote } from './logic';

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
      return 'The key was not accepted. Check it in Settings.';
    case 'limit':
      return 'Too many requests for a moment. Try again later.';
    case 'symbol':
      return 'No price found for this symbol.';
    default:
      return 'Could not load the price. Check the connection.';
  }
};
