<script lang="ts">
  import { onMount } from 'svelte';
  import { MAX_SYMBOLS, addSymbol, cleanSymbol, formatChange, formatPrice, formatTime, isUp, isValidSymbol, removeSymbol, type Quote } from './logic';
  import { fetchQuote, problemText, QuoteError } from './quotes';
  import { paletteFrom, type Palette } from './palette';
  import { onPrefsChange } from './prefs-live';

  type Settings = { apiKey: string; symbols: Array<string> };
  type Row = { symbol: string; quote?: Quote; error?: string };

  // Prices are kept for ten minutes, so opening the dashboard does not call the API every time.
  const CACHE_MS = 10 * 60 * 1000;

  // Nomie passes the colours and text size of the app. The defaults only show when the plugin is opened outside Nomie.
  let plugin: any;
  let view = $state<'modal' | 'widget'>('modal');
  let palette = $state<Palette>(paletteFrom(undefined));
  let scale = $state(1);
  let ready = $state(false);
  let settings = $state<Settings>({ apiKey: '', symbols: [] });
  let rows = $state<Array<Row>>([]);
  let loading = $state(false);
  let updated = $state(0);
  let keyDraft = $state('');
  let symbolDraft = $state('');
  let notice = $state('');

  // One row for each stock followed, in the order they were added, even before a price has arrived
  const shown = $derived(settings.symbols.map((symbol) => rows.find((row) => row.symbol === symbol) ?? { symbol }));

  const applyNomieValues = () => {
    if (!plugin?.prefs) return;
    palette = paletteFrom(plugin.prefs);
    scale = plugin.prefs.fontScale || 1;
  };

  const save = () => plugin?.storage.setItem('settings', $state.snapshot(settings));

  const load = async () => {
    await plugin.storage.init();
    const saved = plugin.storage.getItem('settings');
    settings = {
      apiKey: typeof saved?.apiKey === 'string' ? saved.apiKey : '',
      symbols: Array.isArray(saved?.symbols) ? saved.symbols.slice(0, MAX_SYMBOLS) : [],
    };
    keyDraft = settings.apiKey;
    ready = true;
  };

  // Fetches the prices of the stocks followed. Without a key or a stock there is nothing to fetch.
  const refresh = async (force = false) => {
    if (!settings.apiKey || settings.symbols.length === 0) {
      rows = [];
      return;
    }
    if (!force && rows.length > 0 && Date.now() - updated < CACHE_MS) return;
    loading = true;
    const apiKey = settings.apiKey;
    rows = await Promise.all(
      settings.symbols.map(async (symbol): Promise<Row> => {
        try {
          return { symbol, quote: await fetchQuote(symbol, apiKey) };
        } catch (e) {
          return { symbol, error: problemText(e instanceof QuoteError ? e.problem : 'network') };
        }
      })
    );
    updated = Date.now();
    loading = false;
  };

  const addStock = async () => {
    const symbol = cleanSymbol(symbolDraft);
    if (!isValidSymbol(symbol)) {
      notice = 'Use a ticker such as AAPL.';
      return;
    }
    if (settings.symbols.includes(symbol)) {
      notice = `You already follow ${symbol}.`;
      return;
    }
    if (settings.symbols.length >= MAX_SYMBOLS) {
      notice = `You can follow up to ${MAX_SYMBOLS} stocks. Remove one first.`;
      return;
    }
    settings.symbols = addSymbol(settings.symbols, symbol);
    symbolDraft = '';
    notice = '';
    save();
    await refresh(true);
  };

  const removeStock = async (symbol: string) => {
    settings.symbols = removeSymbol(settings.symbols, symbol);
    notice = '';
    save();
    await refresh(true);
  };

  const saveKey = async () => {
    settings.apiKey = keyDraft.trim();
    keyDraft = settings.apiKey;
    save();
    notice = settings.apiKey ? 'Key saved.' : 'Key removed.';
    await refresh(true);
  };

  onMount(() => {
    plugin = new NomiePlugin({
      name: 'Nomie Stocks',
      emoji: '📈',
      description: 'Follow one or two stocks on your dashboard. Prices come from Finnhub, with your own free API key.',
      uses: ['getStorageItem', 'setStorageItem'],
      version: '2.0',
      addToCaptureMenu: false,
      addToMoreMenu: true,
      addToWidgets: true,
    });
    onPrefsChange(plugin, () => applyNomieValues());
    plugin.onRegistered(async () => {
      applyNomieValues();
      await load();
    });
    plugin.onWidget(async () => {
      view = 'widget';
      applyNomieValues();
      if (!ready) await load();
      refresh();
    });
    plugin.onUIOpened(async () => {
      view = 'modal';
      applyNomieValues();
      if (!ready) await load();
      refresh();
    });
  });
</script>

<div class="card" class:widget={view === 'widget'} style="--page: {palette.page}; --card: {palette.card}; --text: {palette.text}; --muted: {palette.textSecondary}; --line: {palette.separator}; --tint: {palette.tint}; --on-tint: {palette.onTint}; --good: {palette.good}; --bad: {palette.bad}; --scale: {scale};">
  {#if view === 'widget'}
    {#if !settings.apiKey}
      <p class="muted">Add your Finnhub key in Nomie Stocks to see prices.</p>
    {:else if settings.symbols.length === 0}
      <p class="muted">Follow a stock in Nomie Stocks to see it here.</p>
    {:else}
      {#each shown as row (row.symbol)}
        <div class="line">
          <span class="symbol">{row.symbol}</span>
          {#if row.quote}
            <span class="grow">{formatPrice(row.quote.price)}</span>
            <span class="change" class:up={isUp(row.quote)} class:down={!isUp(row.quote)}>{formatChange(row.quote)}</span>
          {:else}
            <span class="grow muted">{row.error ?? 'Loading…'}</span>
          {/if}
        </div>
      {/each}
    {/if}
  {:else}
    <h1>Stocks</h1>
    <p class="muted">Up to {MAX_SYMBOLS} stocks, with prices from Finnhub.</p>

    <h2>Your stocks</h2>
    <section class="panel">
      {#each shown as row (row.symbol)}
        <div class="stock">
          <div class="stock-head">
            <span><strong>{row.symbol}</strong>{#if row.quote && row.quote.time}<span class="muted">&nbsp;&middot;&nbsp;{formatTime(row.quote.time)}</span>{/if}</span>
            <button class="link" onclick={() => removeStock(row.symbol)}>Remove</button>
          </div>
          {#if row.quote}
            <p class="big">{formatPrice(row.quote.price)} <span class="change" class:up={isUp(row.quote)} class:down={!isUp(row.quote)}>{formatChange(row.quote)}</span></p>
            <p class="muted">Today: {formatPrice(row.quote.low)} to {formatPrice(row.quote.high)}</p>
          {:else}
            <p class="muted">{row.error ?? (settings.apiKey ? 'Loading…' : 'Add your key below to see the price.')}</p>
          {/if}
        </div>
      {:else}
        <p class="muted">No stocks yet.</p>
      {/each}

      {#if settings.symbols.length < MAX_SYMBOLS}
        <form class="add" onsubmit={(e) => { e.preventDefault(); addStock(); }}>
          <input bind:value={symbolDraft} placeholder="Ticker, such as AAPL" maxlength="10" autocapitalize="characters" autocomplete="off" spellcheck="false" />
          <button class="primary" type="submit" disabled={!symbolDraft.trim()}>Follow stock</button>
        </form>
      {/if}

      {#if notice}<p class="notice">{notice}</p>{/if}

      <button class="secondary" onclick={() => refresh(true)} disabled={loading || !settings.apiKey || settings.symbols.length === 0}>
        {loading ? 'Loading…' : 'Refresh prices'}
      </button>
      {#if updated}<p class="muted small">Updated {formatTime(updated / 1000)}</p>{/if}
    </section>

    <h2>Finnhub key</h2>
    <section class="panel">
      <form onsubmit={(e) => { e.preventDefault(); saveKey(); }}>
        <input bind:value={keyDraft} placeholder="Paste your API key" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Finnhub API key" />
        <button class="primary" type="submit" disabled={keyDraft.trim() === settings.apiKey}>Save key</button>
      </form>
      <p class="muted">Get a free key at finnhub.io. It is saved in this plugin's data, and a Nomie backup includes it.</p>
    </section>
  {/if}
</div>

<style>
  .card { box-sizing: border-box; min-height: 100vh; padding: 16px; background: var(--page); color: var(--text); font-size: calc(17px * var(--scale)); line-height: 1.4; }
  .card.widget { min-height: 0; padding: 12px; font-size: calc(15px * var(--scale)); }
  h1 { margin: 0 0 4px; font-size: calc(28px * var(--scale)); font-weight: 700; }
  h2 { margin: 24px 0 8px; font-size: calc(13px * var(--scale)); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { margin: 0; color: var(--muted); }
  .small { font-size: calc(13px * var(--scale)); }
  .panel { margin-top: 16px; padding: 16px; border-radius: 16px; background: var(--card); }
  h2 + .panel { margin-top: 0; }
  .stock { padding: 12px 0; border-top: 1px solid var(--line); }
  .stock:first-of-type { border-top: 0; padding-top: 0; }
  .stock-head { display: flex; justify-content: space-between; align-items: center; }
  .big { margin: 8px 0 4px; font-size: calc(22px * var(--scale)); font-weight: 600; }
  .change { font-size: calc(15px * var(--scale)); font-weight: 600; }
  .change.up { color: var(--good); }
  .change.down { color: var(--bad); }
  .notice { margin: 12px 0 0; color: var(--muted); }
  input { box-sizing: border-box; width: 100%; margin: 12px 0; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: transparent; color: inherit; font: inherit; }
  .add input, form input { margin-top: 0; }
  .primary, .secondary { display: block; width: 100%; margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; }
  .primary { background: var(--tint); color: var(--on-tint); }
  .secondary { background: transparent; color: var(--tint); border: 1px solid var(--line); }
  button:disabled { opacity: 0.5; cursor: default; }
  .link { padding: 4px; border: 0; background: transparent; color: var(--tint); font: inherit; font-size: calc(15px * var(--scale)); cursor: pointer; }
  .line { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .symbol { font-weight: 700; min-width: 4em; }
  .grow { flex: 1; }
</style>
