/* Multiquoters demo store. All data lives in localStorage. */
(function (root) {
  const KEY = 'mq-demo-v1';
  const TOKEN_RAND = 20;
  const AUCTION_MS = 12 * 60 * 60 * 1000;
  const PLACES_MAX = 3;
  const BOTS = ['co-kabelo', 'co-elize', 'co-sipho'];

  const TRADES = [
    'Plumbing', 'Electrical', 'Building', 'Painting', 'Roofing', 'Tiling',
    'Carpentry', 'Gardening/Landscaping', 'Pool', 'Handyman', 'Solar', 'Aircon'
  ];
  const AREAS = [
    'Krugersdorp', 'Roodepoort', 'Randburg', 'Centurion', 'Pretoria',
    'Midrand', 'Sandton', 'Fourways', 'Soweto', 'Honeydew'
  ];
  const PACKS = [
    { id: '10', tokens: 10, rand: 200 },
    { id: '25', tokens: 25, rand: 500 },
    { id: '50', tokens: 50, rand: 1000 }
  ];
  const BUDGETS = [
    'Under R1 000', 'R1 000 – R5 000', 'R5 000 – R15 000',
    'R15 000 – R50 000', 'R50 000+', 'Not sure yet'
  ];

  let state = null;
  const listeners = [];
  let tickHandle = null;
  let botHandle = null;
  const pushTimers = [];

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 8);
  }

  function emit(event) {
    listeners.forEach((fn) => fn(event || {}));
  }

  function contractor(id) {
    return state.contractors.find((c) => c.id === id) || null;
  }

  function lead(id) {
    return state.leads.find((l) => l.id === id) || null;
  }

  function wallet(id) {
    if (!state.wallets[id]) {
      state.wallets[id] = { available: 0, held: 0, holds: {}, history: [] };
    }
    return state.wallets[id];
  }

  function syncHeld(w) {
    w.held = Object.values(w.holds).reduce((sum, n) => sum + n, 0);
  }

  function rank(item) {
    const best = new Map();
    (item.bids || []).forEach((b) => {
      const prev = best.get(b.contractorId);
      if (!prev || b.amount > prev.amount) best.set(b.contractorId, b);
    });
    return [...best.values()].sort((a, b) => b.amount - a.amount || a.at - b.at);
  }

  function placesOf(item) {
    return item.places || PLACES_MAX;
  }

  function topBidders(item) {
    return rank(item).slice(0, placesOf(item));
  }

  function minBid(item, contractorId) {
    const ranked = rank(item);
    const places = placesOf(item);
    const pos = ranked.findIndex((b) => b.contractorId === contractorId);
    const mine = pos >= 0 ? ranked[pos] : null;
    if (ranked.length < places) return mine ? mine.amount + 1 : 1;
    if (pos > -1 && pos < places) return mine.amount + 1;
    return ranked[places - 1].amount + 1;
  }

  function standing(item, contractorId) {
    if (!contractorId) return 'none';
    if ((item.retained || []).includes(contractorId)) return 'kept';
    const ranked = rank(item);
    const pos = ranked.findIndex((b) => b.contractorId === contractorId);
    if (pos < 0) return 'none';
    return pos < placesOf(item) ? 'in' : 'out';
  }

  function quotesFor(leadId) {
    return state.quotes.filter((q) => q.leadId === leadId);
  }

  function quoteTotal(q) {
    const lines = (q.lineItems || []).reduce((sum, li) => sum + Number(li.qty || 0) * Number(li.price || 0), 0);
    return lines + Number(q.labour || 0) + Number(q.callout || 0);
  }

  function ratingOf(co) {
    if (!co || !co.reviews || !co.reviews.length) return null;
    const avg = co.reviews.reduce((sum, r) => sum + r.score, 0) / co.reviews.length;
    return Math.round(avg * 10) / 10;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      state.saveError = 'Storage is full. Remove a photo and try again.';
    }
  }

  function illustration(trade) {
    const accents = {
      Plumbing: '#0E7A72',
      Electrical: '#E39B14',
      Building: '#C46A3A',
      Painting: '#D4537E',
      Roofing: '#3D6B8A',
      Tiling: '#6B5B95',
      Carpentry: '#A56B3C',
      'Gardening/Landscaping': '#3E8B4F',
      Pool: '#2F7D9A',
      Handyman: '#C2410C',
      Solar: '#E09F1F',
      Aircon: '#3A7CA5'
    };
    const accent = accents[trade] || '#0E7A72';
    const label = trade === 'Gardening/Landscaping' ? 'Garden' : trade;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
      <rect width="640" height="400" fill="#E7F3F1"/>
      <circle cx="530" cy="84" r="36" fill="#F6D3B0"/>
      <rect y="292" width="640" height="108" fill="#D5EBE7"/>
      <path d="M150 292 L320 150 L490 292 Z" fill="${accent}"/>
      <rect x="196" y="292" width="248" height="92" fill="#F7F4EE"/>
      <rect x="220" y="312" width="64" height="46" rx="4" fill="#B7DDD7"/>
      <rect x="360" y="312" width="52" height="72" fill="#F26B1D"/>
      <circle cx="320" cy="214" r="28" fill="#fff"/>
      <text x="320" y="220" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#0B5F59">${label}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function history(id, entry) {
    wallet(id).history.unshift(Object.assign({ id: uid('h'), at: Date.now() }, entry));
  }

  function releaseHold(contractorId, item, reason) {
    const w = wallet(contractorId);
    const amt = w.holds[item.id] || 0;
    if (!amt) return false;
    delete w.holds[item.id];
    w.available += amt;
    syncHeld(w);
    history(contractorId, {
      type: 'release',
      amount: amt,
      leadId: item.id,
      leadTitle: item.title,
      note: reason === 'pushed'
        ? `Pushed out of the top ${PLACES_MAX} · ${amt} tokens released`
        : `Lost the lead · ${amt} tokens released`
    });
    if (reason === 'pushed' && !contractor(contractorId)?.bot) {
      const text = `You were pushed out of the top 3 on “${item.title}”. ${amt} tokens were released back to your wallet.`;
      notify(contractorId, text);
    }
    return true;
  }

  function notify(contractorId, text) {
    if (!contractorId || contractor(contractorId)?.bot) return;
    state.notices.unshift({ id: uid('n'), contractorId, text, at: Date.now(), read: false });
    if (state.session.contractorId === contractorId) {
      state.pendingToast = text;
    }
  }

  function syncTop(item) {
    const keep = new Set(topBidders(item).map((b) => b.contractorId));
    (item.retained || []).forEach((id) => keep.add(id));
    const ids = new Set(item.bids.map((b) => b.contractorId));
    ids.forEach((id) => {
      if (!keep.has(id)) releaseHold(id, item, 'pushed');
    });
  }

  function schedulePush(leadId, humanId, base) {
    BOTS.forEach((botId, i) => {
      const timer = setTimeout(() => {
        const item = lead(leadId);
        if (!item || item.status !== 'open') return;
        const events = item.bids.filter((b) => b.contractorId === humanId).length;
        if (events !== 1) return;
        placeBid(botId, leadId, base + i + 1, { bot: true });
      }, 550 * (i + 1));
      pushTimers.push(timer);
    });
  }

  function placeBid(contractorId, leadId, amount, opts) {
    opts = opts || {};
    const item = lead(leadId);
    if (!item) return { ok: false, error: 'Lead not found.' };
    if (item.status !== 'open') return { ok: false, error: 'This auction is closed.' };
    if (Date.now() >= item.auctionEndsAt) {
      settle(item, true);
      return { ok: false, error: 'This auction just ended.' };
    }
    if ((item.retained || []).includes(contractorId)) {
      return { ok: false, error: 'You already have a place on this lead.' };
    }
    amount = Math.round(Number(amount));
    if (!Number.isFinite(amount)) return { ok: false, error: 'Enter a whole number of tokens.' };
    const min = minBid(item, contractorId);
    if (amount < min) return { ok: false, error: `Bid at least ${min} ${min === 1 ? 'token' : 'tokens'}.` };
    const w = wallet(contractorId);
    const prev = w.holds[item.id] || 0;
    const extra = amount - prev;
    if (extra > w.available) {
      return { ok: false, error: `You need ${extra} tokens but only ${w.available} are available.` };
    }
    w.available -= extra;
    w.holds[item.id] = amount;
    syncHeld(w);
    history(contractorId, {
      type: prev ? 'raise' : 'hold',
      amount: extra,
      total: amount,
      leadId: item.id,
      leadTitle: item.title,
      note: prev ? `Raised bid to ${amount} tokens` : `Bid held · ${amount} tokens`
    });
    item.bids.push({ contractorId, amount, at: Date.now() });
    syncTop(item);
    save();
    const toast = state.pendingToast;
    state.pendingToast = '';
    if (!opts.bot && !item.botWatch) {
      const events = item.bids.filter((b) => b.contractorId === contractorId).length;
      if (events === 1) schedulePush(item.id, contractorId, amount);
    }
    emit({ toast: toast || (opts.bot ? botToast(contractorId, item, amount) : '') });
    return { ok: true };
  }

  function botToast(contractorId, item, amount) {
    if (state.session.role !== 'contractor') return '';
    const co = contractor(contractorId);
    return `${co ? co.business : 'A contractor'} bid ${amount} tokens on ${item.title}.`;
  }

  function spendHold(contractorId, item, amount) {
    const w = wallet(contractorId);
    const held = w.holds[item.id] || 0;
    if (held) {
      delete w.holds[item.id];
      syncHeld(w);
    } else if (w.available >= amount) {
      w.available -= amount;
    }
    history(contractorId, {
      type: 'win',
      amount: held || amount,
      leadId: item.id,
      leadTitle: item.title,
      note: `Won a place · ${held || amount} tokens spent`
    });
  }

  function settle(item, force) {
    if (!item || item.status !== 'open') return;
    if (!force && Date.now() < item.auctionEndsAt) return;
    const winnersNow = topBidders(item);
    if (!winnersNow.length && !(item.retained || []).length) {
      item.auctionEndsAt = Date.now() + AUCTION_MS;
      item.extensions = (item.extensions || 0) + 1;
      save();
      emit({ toast: `No bids yet on “${item.title}”. The auction was extended by 12 hours.` });
      return;
    }
    const fresh = winnersNow.map((b) => ({ contractorId: b.contractorId, amount: b.amount }));
    fresh.forEach((b) => spendHold(b.contractorId, item, b.amount));
    rank(item).forEach((b) => {
      if (!fresh.some((w) => w.contractorId === b.contractorId)) releaseHold(b.contractorId, item, 'lost');
    });
    const retained = (item.retained || []).map((id) => {
      const prev = (item.secured || []).find((s) => s.contractorId === id);
      return prev || { contractorId: id, amount: 0 };
    });
    const all = retained.concat(fresh);
    item.winners = all.map((w) => w.contractorId);
    item.winningBids = all;
    item.retained = [];
    item.places = PLACES_MAX;
    item.status = 'matched';
    item.wonAt = Date.now();
    state.auctions.push({
      leadId: item.id,
      title: item.title,
      at: Date.now(),
      winners: all.filter((w) => w.amount > 0)
    });
    fresh.forEach((b) => {
      if (contractor(b.contractorId)?.bot) autoQuote(item, b.contractorId, b.amount);
      else notify(b.contractorId, `You finished in the top 3 for “${item.title}”. ${b.amount} tokens were spent. The client’s contact is unlocked — send your quote.`);
    });
    save();
    const toast = state.pendingToast;
    state.pendingToast = '';
    emit({ toast, settled: item.id });
  }

  function autoQuote(item, contractorId, bid) {
    if (state.quotes.some((q) => q.leadId === item.id && q.contractorId === contractorId)) return;
    const labour = 700 + bid * 35;
    const callout = 350;
    const price = 900 + bid * 150;
    const co = contractor(contractorId);
    const quote = {
      id: uid('q'),
      leadId: item.id,
      contractorId,
      lineItems: [{ description: `${item.trade} work as described`, qty: 1, price }],
      labour,
      callout,
      included: 'Labour, standard materials for the job described, and a site clean-up. Excludes structural work that is not visible in the photos.',
      validUntil: isoDays(14),
      timeline: bid >= 4 ? 'Within 2 working days' : 'This week',
      notes: `${co ? co.business : 'We'} can start once you accept. Price assumes normal weekday access.`,
      status: 'sent',
      createdAt: Date.now(),
      auto: true
    };
    quote.total = quoteTotal(quote);
    state.quotes.push(quote);
  }

  function endAuction(leadId) {
    const item = lead(leadId);
    if (!item || item.status !== 'open') return { ok: false, error: 'This auction is not open.' };
    settle(item, true);
    return { ok: true };
  }

  function buyPack(contractorId, packId) {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) return { ok: false, error: 'Unknown pack.' };
    const w = wallet(contractorId);
    w.available += pack.tokens;
    history(contractorId, {
      type: 'purchase',
      amount: pack.tokens,
      rand: pack.rand,
      note: `Bought ${pack.tokens} tokens · DEMO checkout`
    });
    state.sales.push({
      id: uid('s'),
      contractorId,
      tokens: pack.tokens,
      rand: pack.rand,
      at: Date.now()
    });
    save();
    emit({ toast: `DEMO checkout: ${pack.tokens} tokens added. No card was charged.` });
    return { ok: true };
  }

  function saveQuote(input) {
    const item = lead(input.leadId);
    if (!item) return { ok: false, error: 'Lead not found.' };
    if (!(item.winners || []).includes(input.contractorId)) return { ok: false, error: 'Only a top-3 winner can quote.' };
    if (state.quotes.some((q) => q.leadId === item.id && q.contractorId === input.contractorId && q.status !== 'not_selected')) {
      return { ok: false, error: 'You already sent a quote on this lead.' };
    }
    const quote = {
      id: uid('q'),
      leadId: item.id,
      contractorId: input.contractorId,
      lineItems: input.lineItems,
      labour: Number(input.labour) || 0,
      callout: Number(input.callout) || 0,
      included: input.included,
      validUntil: input.validUntil,
      timeline: input.timeline,
      notes: input.notes || '',
      status: 'sent',
      createdAt: Date.now()
    };
    quote.total = quoteTotal(quote);
    state.quotes.push(quote);
    save();
    emit({ toast: 'Quote sent to the client.' });
    return { ok: true, id: quote.id };
  }

  function markViewed(leadId) {
    let changed = false;
    state.quotes.forEach((q) => {
      if (q.leadId === leadId && q.status === 'sent') {
        q.status = 'viewed';
        changed = true;
      }
    });
    if (changed) save();
  }

  function acceptQuote(quoteId) {
    const q = state.quotes.find((item) => item.id === quoteId);
    if (!q) return { ok: false, error: 'Quote not found.' };
    const item = lead(q.leadId);
    q.status = 'accepted';
    q.acceptedAt = Date.now();
    state.quotes.forEach((other) => {
      if (other.leadId === q.leadId && other.id !== q.id && other.status !== 'accepted') other.status = 'not_selected';
    });
    item.status = 'accepted';
    item.acceptedQuoteId = q.id;
    save();
    emit({ toast: 'Quote accepted.' });
    return { ok: true };
  }

  function declineQuote(quoteId) {
    const q = state.quotes.find((item) => item.id === quoteId);
    if (!q) return { ok: false, error: 'Quote not found.' };
    const item = lead(q.leadId);
    if (item.status === 'accepted') return { ok: false, error: 'You already accepted a quote.' };
    q.status = 'not_selected';
    item.winners = (item.winners || []).filter((id) => id !== q.contractorId);
    save();
    emit({});
    return { ok: true };
  }

  function requestMore(leadId) {
    const item = lead(leadId);
    if (!item) return { ok: false, error: 'Lead not found.' };
    if (item.status === 'accepted') return { ok: false, error: 'You already accepted a quote.' };
    const active = (item.winners || []).filter((id) => {
      const q = state.quotes.find((quote) => quote.leadId === item.id && quote.contractorId === id);
      return !q || (q.status !== 'not_selected');
    });
    const slots = PLACES_MAX - active.length;
    if (slots <= 0) return { ok: false, error: 'All 3 places are filled. Decline a quote to free a place.' };
    item.retained = active.slice();
    item.secured = (item.winningBids || []).filter((b) => active.includes(b.contractorId));
    item.winners = active.slice();
    item.places = slots;
    item.bids = [];
    item.status = 'open';
    item.auctionEndsAt = Date.now() + AUCTION_MS;
    item.botWatch = true;
    save();
    emit({ toast: `Auction reopened for ${slots} remaining ${slots === 1 ? 'place' : 'places'}.` });
    return { ok: true };
  }

  function sendMessage(leadId, author, text) {
    const body = String(text || '').trim();
    if (!body) return { ok: false, error: 'Write a message first.' };
    state.messages.push({ id: uid('m'), leadId, author, text: body, at: Date.now() });
    save();
    emit({});
    return { ok: true };
  }

  function createLead(input) {
    const item = {
      id: uid('lead'),
      title: input.title.trim(),
      description: input.description.trim(),
      photos: input.photos || [],
      trade: input.trade,
      suburb: input.suburb,
      timing: input.timing,
      budget: input.budget || '',
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone.trim(),
      privateNote: 'Street address and access notes are shared with the top 3 only.',
      owner: 'demo',
      status: 'open',
      places: PLACES_MAX,
      winners: [],
      retained: [],
      secured: [],
      winningBids: [],
      bids: [],
      auctionEndsAt: Date.now() + AUCTION_MS,
      createdAt: Date.now(),
      botWatch: false
    };
    state.leads.unshift(item);
    state.client.name = item.contactName;
    state.client.phone = item.contactPhone;
    save();
    emit({ toast: 'Your job is live for 12 hours. The top 3 bidders will quote.' });
    return item;
  }

  function signIn(id) {
    if (!contractor(id)) return { ok: false, error: 'Unknown contractor.' };
    state.session.contractorId = id;
    state.session.role = 'contractor';
    save();
    emit({});
    return { ok: true };
  }

  function setRole(role) {
    state.session.role = role;
    save();
  }

  function createContractor(input) {
    const item = {
      id: uid('co'),
      bot: false,
      name: input.name.trim(),
      business: input.business.trim(),
      phone: input.phone.trim(),
      trades: input.trades.slice(),
      areas: input.areas.slice(),
      years: 1,
      verified: false,
      about: 'New on Multiquoters. Buy tokens to bid for leads in your trades and areas.',
      reviews: []
    };
    state.contractors.push(item);
    wallet(item.id);
    history(item.id, { type: 'open', amount: 0, note: 'Account opened · demo profile' });
    state.session.contractorId = item.id;
    state.session.role = 'contractor';
    save();
    emit({ toast: 'Profile created. Buy tokens to start bidding. Checkout is pretend.' });
    return item;
  }

  function dismissNotice(id) {
    const notice = state.notices.find((n) => n.id === id);
    if (notice) notice.read = true;
    save();
    emit({});
  }

  function stats() {
    const winAmounts = state.auctions.flatMap((a) => a.winners.map((w) => w.amount).filter((n) => n > 0));
    const avg = winAmounts.length ? winAmounts.reduce((sum, n) => sum + n, 0) / winAmounts.length : 0;
    const quoteCount = state.quotes.length;
    const accepted = state.quotes.filter((q) => q.status === 'accepted').length;
    const auctions = state.auctions.length;
    return {
      leads: state.leads.length,
      tokensRand: state.sales.reduce((sum, s) => sum + s.rand, 0),
      tokensCount: state.sales.reduce((sum, s) => sum + s.tokens, 0),
      avgWinningBid: avg,
      auctions,
      quotes: quoteCount,
      quotesPerLead: auctions ? quoteCount / auctions : 0,
      accepted,
      acceptanceRate: quoteCount ? accepted / quoteCount : 0
    };
  }

  function matches(item, co) {
    if (!co) return false;
    return co.trades.includes(item.trade) && co.areas.includes(item.suburb);
  }

  function tick() {
    if (!state) return false;
    let changed = false;
    state.leads.forEach((item) => {
      if (item.status === 'open' && Date.now() >= item.auctionEndsAt) {
        settle(item, true);
        changed = true;
      }
    });
    return changed;
  }

  function startLoops() {
    if (tickHandle) clearInterval(tickHandle);
    if (botHandle) clearInterval(botHandle);
    tickHandle = setInterval(tick, 1000);
    botHandle = setInterval(botNudge, 20000);
  }

  function botNudge() {
    if (!state) return;
    const open = state.leads.filter((item) => item.botWatch && item.status === 'open' && Date.now() < item.auctionEndsAt);
    if (!open.length || Math.random() > 0.65) return;
    const item = open[Math.floor(Math.random() * open.length)];
    const botId = BOTS[Math.floor(Math.random() * BOTS.length)];
    const ranked = rank(item);
    const pos = ranked.findIndex((b) => b.contractorId === botId);
    const places = placesOf(item);
    if (pos > -1 && pos < places && Math.random() < 0.8) return;
    const amount = minBid(item, botId);
    if ((wallet(botId).available + (wallet(botId).holds[item.id] || 0)) < amount) return;
    placeBid(botId, item.id, amount, { bot: true });
  }

  function isoDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function seed() {
    const now = Date.now();
    const min = 60 * 1000;
    const hour = 60 * min;
    const contractors = [
      {
        id: 'co-molefe', bot: false, name: 'Thabo Molefe', business: 'Molefe Plumbing & Solar',
        phone: '083 415 2208', trades: ['Plumbing', 'Solar', 'Pool', 'Gardening/Landscaping'],
        areas: ['Krugersdorp', 'Roodepoort', 'Randburg'], years: 14, verified: true,
        about: 'West Rand plumber. Geysers, leaks, solar geysers and pool pumps.',
        reviews: [
          { name: 'Henk V.', area: 'Roodepoort', score: 5, text: 'Arrived when he said he would. The geyser has been perfect since.' },
          { name: 'Priya N.', area: 'Randburg', score: 5, text: 'Fair price and he explained the vacuum breakers without rushing.' },
          { name: 'Johan S.', area: 'Krugersdorp', score: 4, text: 'Came back the next day for a weeping union, at no charge.' }
        ]
      },
      {
        id: 'co-ayesha', bot: false, name: 'Ayesha Patel', business: 'BrightSpark Electrical',
        phone: '082 673 4410', trades: ['Electrical', 'Aircon', 'Solar'],
        areas: ['Centurion', 'Pretoria', 'Midrand', 'Randburg'], years: 9, verified: true,
        about: 'Certificate of compliance on every job. DB boards, inverter splits and rooftop solar.',
        reviews: [
          { name: 'Caroline M.', area: 'Centurion', score: 5, text: 'The oven no longer trips the house, and the DB is labelled.' },
          { name: 'Tebogo K.', area: 'Pretoria', score: 4, text: 'Neat trunking on the aircon. A little later than the window they gave.' },
          { name: 'Farhaan I.', area: 'Midrand', score: 5, text: 'Clearest solar paperwork I have been offered.' }
        ]
      },
      {
        id: 'co-johan', bot: false, name: 'Johan van der Merwe', business: 'Van der Merwe Building',
        phone: '072 558 9033', trades: ['Building', 'Painting', 'Roofing', 'Tiling', 'Carpentry', 'Handyman'],
        areas: ['Krugersdorp', 'Roodepoort', 'Randburg'], years: 21, verified: true,
        about: 'Family building firm. Roofs, paint, tiling and built-in cupboards.',
        reviews: [
          { name: 'Susan M.', area: 'Krugersdorp', score: 5, text: 'Roof team was done in a morning. No more drips.' },
          { name: 'Pieter B.', area: 'Randburg', score: 5, text: 'Interior paint looks even and the floors were protected.' },
          { name: 'Elize V.', area: 'Roodepoort', score: 5, text: 'Cupboards are solid. A small delay on the doors, then sorted.' },
          { name: 'Willem P.', area: 'Krugersdorp', score: 4, text: 'Bathroom floor is straight. Dust was cleaned up.' }
        ]
      },
      {
        id: 'co-kabelo', bot: true, name: 'Kabelo Mokoena', business: "Kabelo's Home Services",
        phone: '071 334 8821', trades: TRADES.slice(), areas: AREAS.slice(), years: 7, verified: true,
        about: 'General contractor covering Gauteng. Bids widely in this demo.',
        reviews: [
          { name: 'Nomsa D.', area: 'Roodepoort', score: 4, text: 'Cleared the yard as promised and took the green waste away.' },
          { name: 'Ruan J.', area: 'Roodepoort', score: 4, text: 'Leak was fixed the same afternoon.' },
          { name: 'Anke V.', area: 'Pretoria', score: 5, text: 'Easy to talk to and the price matched the quote.' }
        ]
      },
      {
        id: 'co-elize', bot: true, name: 'Elize Botha', business: 'West Rand Plumbing',
        phone: '082 990 1145', trades: ['Plumbing', 'Pool', 'Handyman', 'Gardening/Landscaping'],
        areas: ['Krugersdorp', 'Roodepoort', 'Randburg', 'Honeydew'], years: 16, verified: true,
        about: 'Owner-run plumbing firm. Geysers, drains and general water work.',
        reviews: [
          { name: 'Lerato K.', area: 'Krugersdorp', score: 5, text: 'Best geyser install we have had. Tidy and certified.' },
          { name: 'Marie P.', area: 'Randburg', score: 5, text: 'On time, clear quote, no surprises on the invoice.' },
          { name: 'Chris N.', area: 'Roodepoort', score: 5, text: 'Would use West Rand Plumbing again without shopping around.' }
        ]
      },
      {
        id: 'co-sipho', bot: true, name: 'Sipho Dlamini', business: 'Rapid Response Trades',
        phone: '073 220 6674', trades: TRADES.slice(), areas: AREAS.slice(), years: 11, verified: true,
        about: 'Fast call-outs across Johannesburg and Pretoria.',
        reviews: [
          { name: 'Naledi M.', area: 'Centurion', score: 5, text: 'DB fault found quickly.' },
          { name: 'Willem P.', area: 'Krugersdorp', score: 4, text: 'Tiles went down straight. A bit noisy, but done in a day.' }
        ]
      }
    ];

    function bid(contractorId, amount, ago) {
      return { contractorId, amount, at: now - ago };
    }

    const leads = [
      {
        id: 'lead-leak', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Plumbing', suburb: 'Roodepoort', timing: 'urgent', budget: 'Under R1 000',
        title: 'Kitchen sink leaking into the cupboard',
        description: 'The trap and the hot-water flexi under the kitchen sink drip whenever we run hot water. The chipboard base is swelling. Ground-floor flat in Horizon, Roodepoort. Please repair it properly.',
        contactName: 'Ruan Jacobs', contactPhone: '083 776 0192',
        privateNote: 'Horizon View flat 2B. Gate code shared with the top 3.',
        photos: [illustration('Plumbing')],
        auctionEndsAt: now + 11 * min, createdAt: now - 2 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-molefe', 2, 50 * min), bid('co-elize', 3, 40 * min), bid('co-kabelo', 4, 28 * min), bid('co-sipho', 5, 12 * min)]
      },
      {
        id: 'lead-power', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Electrical', suburb: 'Centurion', timing: 'urgent', budget: 'R1 000 – R5 000',
        title: 'DB board trips when the oven runs',
        description: 'The main breaker trips when the oven and kettle run together. 3-bed house in Amberfield, Centurion. Need the stove circuit and DB checked, with a certificate if any wiring changes.',
        contactName: 'Naledi Mahlangu', contactPhone: '071 482 3390',
        privateNote: 'Amberfield estate, stand 418. Guard will have the name of the winning contractors.',
        photos: [illustration('Electrical')],
        auctionEndsAt: now + 28 * min, createdAt: now - 3 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-kabelo', 2, 80 * min), bid('co-sipho', 3, 40 * min), bid('co-ayesha', 4, 15 * min)]
      },
      {
        id: 'lead-paint', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Painting', suburb: 'Randburg', timing: 'week', budget: 'R15 000 – R50 000',
        title: 'Repaint a three-bedroom interior',
        description: 'Walls are tired, especially the lounge and passage. About 140 square metres. We want a warm white. Ceilings can stay. Please include prep, cracks and two coats.',
        contactName: 'Pieter Botha', contactPhone: '082 667 1204',
        privateNote: 'Ferndale, Randburg. Driveway parking for one bakkie.',
        photos: [illustration('Painting')],
        auctionEndsAt: now + 2.5 * hour, createdAt: now - 5 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-elize', 3, 3 * hour), bid('co-kabelo', 4, 2 * hour), bid('co-johan', 6, 40 * min)]
      },
      {
        id: 'lead-roof', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Roofing', suburb: 'Krugersdorp', timing: 'week', budget: 'R5 000 – R15 000',
        title: 'Hail-damaged concrete roof tiles',
        description: 'Last week’s storm cracked tiles on the north face. About 18 broken tiles and a bent ridge cap. No active leak yet. Single storey, ladder access from the driveway in Noordheuwel.',
        contactName: 'Susan Meyer', contactPhone: '083 290 4418',
        privateNote: 'Noordheuwel. Dogs are in the back yard until the contractor arrives.',
        photos: [illustration('Roofing')],
        auctionEndsAt: now + 5 * hour, createdAt: now - 8 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-kabelo', 2, 4 * hour), bid('co-sipho', 3, 2 * hour), bid('co-johan', 5, 50 * min)]
      },
      {
        id: 'lead-solar', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Solar', suburb: 'Randburg', timing: 'flexible', budget: 'R50 000+',
        title: '5kW hybrid solar for a townhouse',
        description: 'Looking at a 5kW inverter, about 5kWh of battery and panels on a north-facing tile roof. The complex allows rooftop solar. Need a certificate of compliance and the municipal paperwork.',
        contactName: 'Farhaan Ismail', contactPhone: '084 512 7781',
        privateNote: 'Olivedale complex. Trustees have already approved rooftop panels.',
        photos: [illustration('Solar')],
        auctionEndsAt: now + 7.5 * hour, createdAt: now - 6 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-sipho', 3, 5 * hour), bid('co-kabelo', 4, 3 * hour), bid('co-molefe', 5, 70 * min)]
      },
      {
        id: 'lead-aircon', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Aircon', suburb: 'Pretoria', timing: 'flexible', budget: 'R5 000 – R15 000',
        title: 'Midwall split for the main bedroom',
        description: 'Bedroom is about 4m by 3.5m and west facing. Supply and install an inverter midwall split, with trunking to an outdoor unit on the patio. The power point is on the same wall.',
        contactName: 'Anke Venter', contactPhone: '072 338 9055',
        privateNote: 'Lyttelton, Pretoria. Outdoor unit can go on the patio slab.',
        photos: [illustration('Aircon')],
        auctionEndsAt: now + 9 * hour, createdAt: now - 4 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-ayesha', 2, 90 * min)]
      },
      {
        id: 'lead-tile', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Tiling', suburb: 'Krugersdorp', timing: 'urgent', budget: 'R5 000 – R15 000',
        title: 'Retile a small bathroom floor',
        description: 'Floor is about 6 square metres. Existing ceramic is cracked near the shower. Toilet and basin stay. Tiles are already chosen, 600 by 600 porcelain. Need removal, screed if required, and silicone at the bath.',
        contactName: 'Willem Pretorius', contactPhone: '082 441 2287',
        privateNote: 'Monument, Krugersdorp. Water can be isolated at the stop cock in the passage.',
        photos: [illustration('Tiling')],
        auctionEndsAt: now + 5 * min, createdAt: now - 70 * min,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-elize', 2, 40 * min), bid('co-johan', 4, 20 * min), bid('co-kabelo', 5, 10 * min), bid('co-sipho', 6, 4 * min)]
      },
      {
        id: 'lead-garden', owner: 'other', status: 'open', botWatch: true, places: 3,
        trade: 'Gardening/Landscaping', suburb: 'Roodepoort', timing: 'week', budget: 'R5 000 – R15 000',
        title: 'Clear the yard and lay instant lawn',
        description: 'Back yard is about 80 square metres, with knee-high grass and a dead lemon tree. Remove the stump, level the soil and lay instant lawn. Side access for a bakkie. Green waste must go.',
        contactName: 'Nomsa Dlamini', contactPhone: '071 220 8844',
        privateNote: 'Weltevreden Park. Tap is on the south wall.',
        photos: [illustration('Gardening/Landscaping')],
        auctionEndsAt: now + 11.5 * hour, createdAt: now - 9 * hour,
        winners: [], retained: [], secured: [], winningBids: [],
        bids: [bid('co-kabelo', 2, 2 * hour)]
      },
      {
        id: 'lead-geyser', owner: 'demo', status: 'matched', botWatch: false, places: 3,
        trade: 'Plumbing', suburb: 'Krugersdorp', timing: 'urgent', budget: 'R5 000 – R15 000',
        title: 'Burst geyser, no hot water',
        description: 'The 150 litre geyser in the ceiling burst overnight. The passage ceiling is damp and we have no hot water. Please replace the geyser, check the drip tray and vacuum breakers, and leave the ceiling for the insurer. House in Monument, Krugersdorp.',
        contactName: 'Lerato Nkosi', contactPhone: '082 555 0142',
        privateNote: '14 Vygie Street, Monument. DB is in the garage.',
        photos: [illustration('Plumbing')],
        auctionEndsAt: now - 2 * hour, createdAt: now - 6 * hour, wonAt: now - 2 * hour,
        winners: ['co-elize', 'co-molefe', 'co-kabelo'],
        retained: [], secured: [],
        winningBids: [
          { contractorId: 'co-elize', amount: 6 },
          { contractorId: 'co-molefe', amount: 5 },
          { contractorId: 'co-kabelo', amount: 4 }
        ],
        bids: [bid('co-kabelo', 4, 5 * hour), bid('co-molefe', 5, 4 * hour), bid('co-elize', 6, 3 * hour)]
      },
      {
        id: 'lead-cupboard', owner: 'other', status: 'accepted', botWatch: false, places: 3,
        trade: 'Carpentry', suburb: 'Randburg', timing: 'flexible', budget: 'R5 000 – R15 000',
        title: 'Built-in cupboard, main bedroom',
        description: 'Melamine built-in cupboard about 2.4 metres wide, white, with shelves and a hanging rail.',
        contactName: 'Andrea Venter', contactPhone: '083 600 2211',
        privateNote: 'Robin Hills. Complex visitors’ parking at unit 12.',
        photos: [illustration('Carpentry')],
        auctionEndsAt: now - 20 * 24 * hour, createdAt: now - 24 * 24 * hour, wonAt: now - 20 * 24 * hour,
        winners: ['co-johan'], retained: [], secured: [],
        winningBids: [{ contractorId: 'co-johan', amount: 4 }],
        bids: [bid('co-johan', 4, 21 * 24 * hour)],
        acceptedQuoteId: 'q-cupboard'
      }
    ];

    const day = 24 * hour;
    const geyserQuote = (id, contractorId, lines, labour, callout, timeline, notes) => {
      const quote = {
        id, leadId: 'lead-geyser', contractorId, lineItems: lines, labour, callout,
        included: 'Remove and dispose of the old geyser, install the new unit, reconnect water and electrics, and issue a certificate of compliance for the electrical connection. Ceiling repairs stay with the insurer.',
        validUntil: isoDays(7), timeline, notes, status: 'sent', createdAt: now - 90 * min
      };
      quote.total = quoteTotal(quote);
      return quote;
    };

    const quotes = [
      geyserQuote('q-elize', 'co-elize', [
        { description: '150L 400kPa geyser', qty: 1, price: 3620 },
        { description: 'Vacuum breakers, drip tray and flexis', qty: 1, price: 510 }
      ], 1100, 450, 'Tomorrow, first slot at 7:30', 'I carry the 150L units on the bakkie. Ceiling board will be made safe if it has dropped, not skimmed.'),
      geyserQuote('q-molefe', 'co-molefe', [
        { description: '150L 400kPa geyser (Kwikot or similar)', qty: 1, price: 3280 },
        { description: 'Vacuum breakers, drip tray valve and flexis', qty: 1, price: 420 }
      ], 980, 350, 'Tomorrow morning, about 3 hours on site', 'I can be there from 8:00. Please keep the passage clear and the DB accessible.'),
      geyserQuote('q-kabelo', 'co-kabelo', [
        { description: '150L geyser, standard 400kPa', qty: 1, price: 2890 },
        { description: 'Fittings and vacuum breakers', qty: 1, price: 360 }
      ], 860, 300, 'Tomorrow afternoon', 'Price is for a like-for-like replacement. A move to the outside wall would be extra.')
    ];
    const cupboard = {
      id: 'q-cupboard', leadId: 'lead-cupboard', contractorId: 'co-johan',
      lineItems: [{ description: 'Melamine built-in cupboard, 2.4m, white', qty: 1, price: 7800 }],
      labour: 2200, callout: 0,
      included: 'Measure, manufacture, deliver and fit. Handles included. Making good the wall is excluded.',
      validUntil: isoDays(-2), timeline: 'Manufacture 7 working days, fit in one day',
      notes: 'Doors were refit after a hinge adjustment.',
      status: 'accepted', createdAt: now - 18 * day, acceptedAt: now - 12 * day
    };
    cupboard.total = quoteTotal(cupboard);
    quotes.push(cupboard);

    const sales = [
      { id: 's1', contractorId: 'co-molefe', tokens: 25, rand: 500, at: now - 12 * day },
      { id: 's2', contractorId: 'co-molefe', tokens: 10, rand: 200, at: now - 3 * day },
      { id: 's3', contractorId: 'co-ayesha', tokens: 25, rand: 500, at: now - 9 * day },
      { id: 's4', contractorId: 'co-ayesha', tokens: 10, rand: 200, at: now - 2 * day },
      { id: 's5', contractorId: 'co-johan', tokens: 50, rand: 1000, at: now - 15 * day }
    ];

    const auctions = [
      {
        leadId: 'lead-geyser', title: 'Burst geyser, no hot water', at: now - 2 * hour,
        winners: [
          { contractorId: 'co-elize', amount: 6 },
          { contractorId: 'co-molefe', amount: 5 },
          { contractorId: 'co-kabelo', amount: 4 }
        ]
      },
      {
        leadId: 'lead-cupboard', title: 'Built-in cupboard, main bedroom', at: now - 20 * day,
        winners: [{ contractorId: 'co-johan', amount: 4 }]
      }
    ];

    state = {
      client: { name: 'Lerato Nkosi', phone: '082 555 0142' },
      session: { role: 'client', contractorId: null },
      contractors, leads, quotes, sales, auctions,
      messages: [
        { id: 'm1', leadId: 'lead-geyser', author: 'client', text: 'Will the old geyser be taken away?', at: now - 80 * min },
        { id: 'm2', leadId: 'lead-geyser', author: 'co-molefe', text: 'Yes. Removal is included in my quote. I can start from 8:00.', at: now - 70 * min }
      ],
      notices: [
        {
          id: 'n-leak', contractorId: 'co-molefe', read: false, at: now - 12 * min,
          text: 'You were pushed out of the top 3 on “Kitchen sink leaking into the cupboard”. 2 tokens were released back to your wallet.'
        }
      ],
      wallets: {},
      pendingToast: '',
      saveError: ''
    };

    const opening = {
      'co-molefe': 0, 'co-ayesha': 0, 'co-johan': 0,
      'co-kabelo': 160, 'co-elize': 120, 'co-sipho': 140
    };
    Object.keys(opening).forEach((id) => { wallet(id).available = opening[id]; });
    sales.forEach((sale) => {
      const w = wallet(sale.contractorId);
      w.available += sale.tokens;
      w.history.unshift({
        id: uid('h'), type: 'purchase', amount: sale.tokens, rand: sale.rand, at: sale.at,
        note: `Bought ${sale.tokens} tokens · DEMO checkout`
      });
    });
    leads.forEach((item) => {
      if (item.status === 'open') {
        topBidders(item).forEach((b) => {
          const w = wallet(b.contractorId);
          w.holds[item.id] = b.amount;
          w.available -= b.amount;
          syncHeld(w);
          w.history.unshift({
            id: uid('h'), type: 'hold', amount: b.amount, at: b.at, leadId: item.id, leadTitle: item.title,
            note: `Bid held · ${b.amount} tokens`
          });
        });
      } else {
        (item.winningBids || []).forEach((b) => {
          const w = wallet(b.contractorId);
          w.available -= b.amount;
          w.history.unshift({
            id: uid('h'), type: 'win', amount: b.amount, at: item.wonAt, leadId: item.id, leadTitle: item.title,
            note: `Won a place · ${b.amount} tokens spent`
          });
        });
      }
    });
    history('co-molefe', {
      type: 'release', amount: 2, leadId: 'lead-leak', leadTitle: 'Kitchen sink leaking into the cupboard',
      note: 'Pushed out of the top 3 · 2 tokens released', at: now - 12 * min
    });
    wallet('co-molefe').history[0].at = now - 12 * min;

    Object.values(state.wallets).forEach(syncHeld);
    save();
  }

  function init() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (err) {
      state = null;
    }
    if (!state || !state.leads || !state.wallets) seed();
    startLoops();
    return state;
  }

  function reset() {
    pushTimers.splice(0).forEach(clearTimeout);
    localStorage.removeItem(KEY);
    seed();
    emit({ toast: 'Demo data restored.', reset: true });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  root.MQ = {
    TOKEN_RAND, AUCTION_MS, PLACES_MAX, TRADES, AREAS, PACKS, BUDGETS, BOTS,
    init, reset, subscribe, save,
    get state() { return state; },
    contractor, lead, wallet, quotesFor, rank, topBidders, minBid, standing, matches,
    ratingOf, quoteTotal, illustration, stats,
    signIn, setRole, createContractor, createLead, placeBid, endAuction, buyPack,
    saveQuote, markViewed, acceptQuote, declineQuote, requestMore, sendMessage,
    dismissNotice, tick
  };
})(typeof window !== 'undefined' ? window : globalThis);
