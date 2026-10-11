(function () {
  const MQ = window.MQ;
  const memory = {
    wizard: null,
    quote: null,
    modal: null,
    sort: 'price',
    workTab: 'won',
    showCreate: false,
    create: null,
    bidDraft: {},
    confirmBid: null,
    threadFor: ''
  };
  let lastRoute = '';
  let dirty = false;

  const TIMING = { urgent: 'Urgent', week: 'This week', flexible: 'Flexible' };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatR(n) {
    return 'R' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  }

  function tokens(n) {
    n = Number(n) || 0;
    return n === 1 ? '1 token' : n + ' tokens';
  }

  function randTokens(n) {
    return tokens(n) + ' · ' + formatR(n * MQ.TOKEN_RAND);
  }

  function maskPhone(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (d.length < 7) return '••• ••• ••••';
    return d.slice(0, 3) + ' ••• ' + d.slice(-4);
  }

  function maskName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) return 'Client';
    if (parts.length < 2) return parts[0].slice(0, 1) + '•••';
    return parts[0] + ' ' + parts[parts.length - 1].slice(0, 1) + '.';
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('');
  }

  function stars(score) {
    const full = Math.round(score || 0);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(full);
  }

  function formatRemain(ends) {
    const ms = ends - Date.now();
    if (ms <= 0) return 'Ended';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    if (m > 0) return m + 'm ' + String(sec).padStart(2, '0') + 's';
    return sec + 's';
  }

  function countHtml(ends) {
    const hot = ends - Date.now() < 15 * 60 * 1000;
    return '<span class="count' + (hot ? ' hot' : '') + '" data-ends="' + ends + '">' + formatRemain(ends) + '</span>';
  }

  function isoDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function niceDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function route() {
    const parts = (location.hash || '#/').replace(/^#/, '').split('/').filter(Boolean);
    return parts;
  }

  function go(hash) {
    if (location.hash === hash) render(true);
    else location.hash = hash;
  }

  function toast(text) {
    if (!text) return;
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }

  function blankWizard() {
    const c = MQ.state.client;
    return {
      step: 1, trade: '', title: '', description: '', photos: [],
      suburb: '', timing: 'week', budget: '', name: c.name || '', phone: c.phone || '', error: ''
    };
  }

  function activeCo() {
    return MQ.contractor(MQ.state.session.contractorId);
  }

  function areaOf(parts) {
    if (!parts.length) return 'home';
    if (parts[0] === 'admin') return 'admin';
    return parts[0];
  }

  function currentRole(parts) {
    const area = areaOf(parts);
    if (area === 'contractor') return 'contractor';
    if (area === 'client') return 'client';
    return MQ.state.session.role || 'client';
  }

  function shell() {
    const parts = route();
    const role = currentRole(parts);
    document.getElementById('role-switch').innerHTML =
      '<a href="#/client/requests" class="' + (role === 'client' ? 'is-on' : '') + '" aria-pressed="' + (role === 'client') + '">Client</a>' +
      '<a href="#/contractor/leads" class="' + (role === 'contractor' ? 'is-on' : '') + '" aria-pressed="' + (role === 'contractor') + '">Contractor</a>';
    const bar = document.getElementById('viewing-as');
    if (bar) bar.innerHTML = 'You\'re viewing as: <strong>' + (role === 'contractor' ? 'Contractor' : 'Client') + '</strong>';

    const sub = document.getElementById('subnav');
    const bottom = document.getElementById('bottom-nav');
    const links = role === 'contractor'
      ? [['#/contractor/leads', 'Leads'], ['#/contractor/work', 'Work'], ['#/contractor/wallet', 'Wallet'], ['#/contractor/vip', 'VIP'], ['#/contractor/profile', 'Profile']]
      : [['#/client/new', 'New request'], ['#/client/requests', 'My requests'], ['#/pricing', 'Pricing']];
    const html = links.map(([href, label]) => navLink(href, label, parts)).join('');
    sub.innerHTML = html;
    bottom.innerHTML = html;
  }

  function navLink(href, label, parts) {
    const on = ('#' + '/' + parts.join('/')).indexOf(href) === 0 || location.hash === href;
    return '<a href="' + href + '"' + (on ? ' class="is-on"' : '') + '>' + label + '</a>';
  }

  function render(force) {
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (typing && !force && document.activeElement.closest('#view')) {
      dirty = true;
      return;
    }
    dirty = false;
    const key = location.hash;
    const preserve = key === lastRoute;
    const y = preserve ? window.scrollY : 0;
    lastRoute = key;
    shell();
    const parts = route();
    const view = document.getElementById('view');
    view.innerHTML = screen(parts);
    document.getElementById('modal-root').innerHTML = modalHtml();
    if (!preserve) window.scrollTo(0, 0);
    else window.scrollTo(0, y);
    paintCountdowns();
  }

  function screen(parts) {
    if (!parts.length) return landing();
    if (parts[0] === 'admin') return admin();
    if (parts[0] === 'pricing') return pricingPage();
    if (parts[0] === 'trust') return trustPage();
    if (parts[0] === 'contractor' && parts[1] === 'vip') return activeCo() ? vipPage() : signIn();
    if (parts[0] === 'client' && parts[1] === 'new') return wizard();
    if (parts[0] === 'client' && parts[1] === 'requests') return requests();
    if (parts[0] === 'client' && parts[1] === 'request') return requestDetail(parts[2]);
    if (parts[0] === 'contractor' && parts[1] === 'leads') return activeCo() ? leads() : signIn();
    if (parts[0] === 'contractor' && parts[1] === 'lead') return activeCo() ? leadDetail(parts[2]) : signIn();
    if (parts[0] === 'contractor' && parts[1] === 'quote') return activeCo() ? quoteForm(parts[2]) : signIn();
    if (parts[0] === 'contractor' && parts[1] === 'work') return activeCo() ? work() : signIn();
    if (parts[0] === 'contractor' && parts[1] === 'wallet') return activeCo() ? walletPage() : signIn();
    if (parts[0] === 'contractor' && parts[1] === 'profile') return activeCo() ? profile() : signIn();
    if (parts[0] === 'contractor') return activeCo() ? leads() : signIn();
    return landing();
  }

  function landing() {
    return '<section data-screen="landing"><div class="hero-grid"><div>' +
      '<div class="hero-mark"><img src="icon.svg" alt=""><div><strong>Multiquoters</strong><div class="tiny">Gauteng quote marketplace</div></div></div>' +
      '<h1>Post once. Get up to three quotes.</h1>' +
      '<p class="lede">Up to 3 vetted contractors will quote. Free for you. You choose; there\'s no obligation.</p>' +
      '<div class="stack">' +
      '<a class="btn btn-orange btn-block" href="#/client/new">I need a quote</a>' +
      '<a class="btn btn-teal btn-block" href="#/contractor/leads">I\'m a contractor</a>' +
      '</div></div>' +
      '<div class="card promise"><h2>Free for homeowners</h2><p>Your number stays hidden until a contractor wins a place. At most 3 contractors see it.</p></div></div>' +
      '<div class="how-grid" data-testid="how-it-works">' +
      '<section class="card"><h2>How it works if you need a quote</h2><div class="steps">' +
      step(1, 'Post the job', 'Trade, a photo, where and when. About a minute.') +
      step(2, 'Contractors bid', 'You see how many are bidding and when quotes are due.') +
      step(3, 'Compare and choose', 'Up to 3 quotes, side by side. Accept one, or none.') +
      '</div></section>' +
      '<section class="card"><h2>How it works if you are a contractor</h2><div class="steps">' +
      step(1, 'Buy tokens', 'R20 each. No subscription and no hidden fees.') +
      step(2, 'Bid for a place', 'Top 3 win. Held tokens come back if you are pushed out.') +
      step(3, 'Send one quote', 'You only pay the tokens if you keep a top-3 place.') +
      '</div><p class="tiny">Optional VIP: unlimited tokens for R X / year <span class="tbc">price TBC</span>. Fair-play caps still apply.</p></section></div>' +
      '<p class="tiny">Krugersdorp, Roodepoort, Randburg, Centurion, Pretoria and nearby.</p>' +
      '<p class="row"><a href="#/pricing">Pricing &amp; fees</a> · <a href="#/trust">Trust &amp; safety</a> · <a href="#/admin">Overview</a></p></section>';
  }

  function step(n, title, body) {
    return '<div class="step"><div class="num">' + n + '</div><div><strong>' + esc(title) + '</strong><div class="tiny">' + esc(body) + '</div></div></div>';
  }

  function tradeMark(trade) {
    return '<span class="trade-ico" aria-hidden="true">' + esc(String(trade || '?').slice(0, 1).toUpperCase()) + '</span>';
  }

  function promise() {
    return '<p class="promise-line">Up to 3 vetted contractors will quote. Free for you. You choose; there\'s no obligation.</p>';
  }

  function progress(step, label) {
    const pct = Math.round((step / 6) * 100);
    return '<div class="progress" role="progressbar" aria-valuenow="' + step + '" aria-valuemin="1" aria-valuemax="6" aria-label="Step ' + step + ' of 6, ' + esc(label) + '"><span style="width:' + pct + '%"></span></div>' +
      '<p class="tiny">Step ' + step + ' of 6 · ' + esc(label) + '</p>';
  }

  function wizardNav(back) {
    return '<div class="row">' +
      (back ? '<button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>' : '') +
      '<button type="button" class="btn btn-orange" data-action="wizard-next">Next</button></div>';
  }

  function wizard() {
    if (!memory.wizard) memory.wizard = blankWizard();
    const w = memory.wizard;
    const err = w.error ? '<p class="form-error" role="alert" data-testid="form-error">' + esc(w.error) + '</p>' : '';
    if (w.step === 1) {
      return '<section data-screen="trade-picker">' + progress(1, 'Trade') + '<h1>What do you need done?</h1>' +
        '<p class="lede">Pick one trade. You can post another job later.</p>' +
        '<div class="trade-grid">' + MQ.TRADES.map((t) =>
          '<button type="button" class="trade" data-action="pick-trade" data-trade="' + esc(t) + '">' + tradeMark(t) + ' ' + esc(t) + '</button>'
        ).join('') + '</div></section>';
    }
    if (w.step === 2) {
      return '<section data-screen="wizard">' + progress(2, 'Photos') + '<h1>Add a photo</h1>' + err +
        '<p>A picture helps contractors price the job. Camera or gallery. Optional.</p>' +
        '<label class="field"><span>Photo</span><input id="job-photos" data-testid="job-photos" type="file" accept="image/*" multiple></label>' +
        (w.photos.length ? '<span data-testid="photo-ready">' + w.photos.length + ' photo ready</span><div class="thumbs">' + w.photos.map((src) => '<img src="' + src + '" alt="Job photo">').join('') + '</div>' : '<p class="tiny">You can skip this and still post.</p>') +
        wizardNav(true) + '</section>';
    }
    if (w.step === 3) {
      return '<section data-screen="wizard">' + progress(3, 'Describe') + '<h1>Describe the job</h1>' + err +
        '<div class="stack">' +
        field('Short title', '<input id="job-title" data-field="wiz-title" type="text" maxlength="80" value="' + esc(w.title) + '" placeholder="Leaking outside tap">') +
        field('What is wrong?', '<textarea id="job-description" data-field="wiz-description" placeholder="What happened, and anything they should know.">' + esc(w.description) + '</textarea>') +
        wizardNav(true) + '</div></section>';
    }
    if (w.step === 4) {
      return '<section data-screen="wizard">' + progress(4, 'Where and when') + '<h1>Where and when?</h1>' + err +
        '<div class="stack">' +
        field('Suburb', '<select id="job-suburb" data-field="wiz-suburb"><option value="">Choose a suburb</option>' +
          MQ.AREAS.map((a) => '<option' + (w.suburb === a ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select>') +
        '<div class="field"><span>When do you need it?</span><div class="stack">' +
        ['urgent', 'week', 'flexible'].map((key) =>
          '<label class="choice"><input type="radio" name="timing" data-field="wiz-timing" value="' + key + '"' + (w.timing === key ? ' checked' : '') + '> ' + TIMING[key] + '</label>'
        ).join('') + '</div></div>' +
        field('Budget (optional)', '<select id="job-budget" data-field="wiz-budget"><option value="">Not sure yet</option>' +
          MQ.BUDGETS.map((b) => '<option' + (w.budget === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>') +
        wizardNav(true) + '</div></section>';
    }
    if (w.step === 5) {
      return '<section data-screen="wizard">' + progress(5, 'Contact') + '<h1>How can they reach you?</h1>' + err +
        '<p class="promise-line">Your number stays masked until a contractor wins a place in the top 3.</p>' +
        '<div class="stack">' +
        field('Your name', '<input id="job-name" data-field="wiz-name" type="text" autocomplete="name" value="' + esc(w.name) + '">') +
        field('Mobile number', '<input id="job-phone" data-field="wiz-phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(w.phone) + '" placeholder="082 000 0000">') +
        wizardNav(true) + '</div></section>';
    }
    return '<section data-screen="wizard" data-step="review">' + progress(6, 'Review') + '<h1>Check this, then post</h1>' + err +
      '<div class="card stack">' +
      '<p><strong>' + esc(w.trade) + '</strong> · ' + esc(w.title || 'No title') + '</p>' +
      '<p>' + esc(w.description) + '</p>' +
      '<p>' + esc(w.suburb) + ' · ' + esc(TIMING[w.timing] || '') + (w.budget ? ' · ' + esc(w.budget) : '') + '</p>' +
      '<p>' + esc(w.name) + ' · ' + esc(maskPhone(w.phone)) + '</p>' +
      '<p class="tiny">' + (w.photos.length ? w.photos.length + ' photo attached.' : 'No photo.') + '</p>' +
      '<p>Up to 3 vetted contractors will quote. Free for you. You choose; there\'s no obligation.</p>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>' +
      '<button type="button" class="btn btn-orange" data-action="post-job">Post job</button></div></section>';
  }

  function field(label, inner) {
    return '<label class="field"><span>' + label + '</span>' + inner + '</label>';
  }

  function requests() {
    const mine = MQ.state.leads.filter((l) => l.owner === 'demo');
    return '<section data-screen="requests"><h1>My requests</h1>' + promise() +
      (mine.length ? '<div class="stack">' + mine.map(requestCard).join('') + '</div>' :
        '<div class="card"><h2>No jobs yet</h2><p>Posting takes about a minute. Contractors in your suburb can then bid.</p><a class="btn btn-orange" href="#/client/new">I need a quote</a></div>') +
      (mine.length ? '<p><a class="btn btn-orange" href="#/client/new">Post another job</a></p>' : '') + '</section>';
  }

  function requestCard(item) {
    const quotes = MQ.quotesFor(item.id);
    let status = 'Auction live';
    if (item.status === 'accepted') status = 'Quote accepted';
    else if (item.status === 'matched' && quotes.length) status = quotes.length + ' quotes to compare';
    else if (item.status === 'matched') status = 'Matched · waiting for quotes';
    return '<a class="card" href="#/client/request/' + item.id + '" style="text-decoration:none;color:inherit">' +
      '<div class="between"><span class="pill">' + esc(item.trade) + '</span>' +
      (item.status === 'open' ? countHtml(item.auctionEndsAt) : '<span class="pill">' + status + '</span>') + '</div>' +
      '<h3>' + esc(item.title) + '</h3><p class="tiny">' + esc(item.suburb) + ' · ' + esc(TIMING[item.timing] || '') + '</p>' +
      '<p class="tiny">' + (item.status === 'open' ? rank(item).length + ' bids · top 3 send quotes' : status) + '</p></a>';
  }

  function rank(item) { return MQ.rank(item); }

  function requestDetail(id) {
    const item = MQ.lead(id);
    if (!item || item.owner !== 'demo') return '<p>That request is not on this demo client.</p>';
    const quotes = MQ.quotesFor(item.id);
    if (item.status === 'open' && !quotes.length) return clientAuction(item);
    if ((item.status === 'matched' || item.status === 'accepted' || quotes.length) && quotes.length) {
      MQ.markViewed(item.id);
      return compare(item);
    }
    if (item.status === 'open') return clientAuction(item);
    return clientAuction(item) + '<p class="tiny">Waiting for the top contractors to send quotes.</p>';
  }

  function clientAuction(item) {
    const n = rank(item).length;
    const people = new Set(item.bids.map((b) => b.contractorId)).size;
    return '<section data-screen="client-auction"><p class="tiny">' + esc(item.trade) + ' · ' + esc(item.suburb) + '</p>' +
      '<h1>' + esc(item.title) + '</h1>' + promise() + statusTimeline(item) +
      '<p>' + esc(item.description) + '</p>' +
      '<div class="card"><h2>Bidding now</h2><p>' + countHtml(item.auctionEndsAt) + '</p>' +
      '<p><strong>' + people + '</strong> ' + (people === 1 ? 'contractor is' : 'contractors are') + ' bidding (' + n + ' bids).</p>' +
      '<p>Quotes are expected when the auction ends. Up to 3 contractors will each send one quote.</p>' +
      '<p class="tiny">Shown to them as ' + esc(maskName(item.contactName)) + ' · ' + esc(maskPhone(item.contactPhone)) + '</p></div>' +
      thumbs(item.photos) + '</section>';
  }

  function statusTimeline(item) {
    const quotes = MQ.quotesFor(item.id);
    const steps = [
      ['Posted', true],
      ['Bidding', item.status !== 'open'],
      ['Contractors chosen', item.status === 'matched' || item.status === 'accepted'],
      ['Quotes in', item.status !== 'open' && quotes.length > 0],
      ['Accepted', item.status === 'accepted']
    ];
    let seen = false;
    return '<ol class="timeline">' + steps.map(([label, done]) => {
      const current = !seen && !done;
      if (!done) seen = true;
      const cls = done ? 'done' : (current ? 'current' : '');
      return '<li class="' + cls + '">' + label + '</li>';
    }).join('') + '</ol>';
  }

  function compare(item) {
    const quotes = MQ.quotesFor(item.id).slice().sort((a, b) => {
      if (memory.sort === 'rating') {
        return (MQ.ratingOf(MQ.contractor(b.contractorId)) || 0) - (MQ.ratingOf(MQ.contractor(a.contractorId)) || 0);
      }
      return a.total - b.total;
    });
    const cheap = Math.min(...quotes.map((q) => q.total));
    const best = Math.max(...quotes.map((q) => MQ.ratingOf(MQ.contractor(q.contractorId)) || 0));
    const accepted = quotes.find((q) => q.status === 'accepted');
    const due = quotes.length >= Math.min(3, (item.winners || []).length || 3)
      ? 'All quotes that are in can be compared now. You do not have to accept one.'
      : 'Quotes are expected shortly. ' + quotes.length + ' of up to 3 are in.';
    return '<section data-screen="compare" data-quote-count="' + quotes.length + '">' +
      '<p class="tiny">Your matched contractors</p><h1>' + esc(item.title) + '</h1>' +
      promise() + '<p>' + due + '</p>' + statusTimeline(item) +
      '<p class="muted">' + esc(item.suburb) + '</p>' +
      (accepted ? acceptedBanner(accepted) : '') +
      '<div class="row" style="margin:10px 0">' +
      '<button type="button" class="btn btn-small ' + (memory.sort === 'price' ? 'btn-teal' : 'btn-ghost') + '" data-action="sort" data-sort="price">Sort by price</button>' +
      '<button type="button" class="btn btn-small ' + (memory.sort === 'rating' ? 'btn-teal' : 'btn-ghost') + '" data-action="sort" data-sort="rating">Sort by rating</button>' +
      '</div>' +
      '<div class="quote-cards stack">' + quotes.map((q) => quoteCard(item, q, cheap, best)).join('') + '</div>' +
      '<div class="compare-table-wrap card table-wrap"><table class="compare-table"><thead><tr>' +
      '<th>Contractor</th><th>Rating</th><th>Price</th><th>VAT</th><th>Included</th><th>Excluded</th><th>Timeline</th><th>Verified</th><th></th>' +
      '</tr></thead><tbody>' + quotes.map((q) => quoteRow(item, q, cheap, best)).join('') + '</tbody></table></div>' +
      (item.status !== 'accepted' ? '<p><button type="button" class="btn btn-ghost btn-block" data-action="request-more" data-lead="' + item.id + '">Request more contractors</button></p>' +
        (memory.moreError ? '<p class="form-error" role="alert">' + esc(memory.moreError) + '</p>' : '') : '') +
      thread(item) + '</section>';
  }

  function flags(q, cheap, best) {
    const co = MQ.contractor(q.contractorId);
    const rating = MQ.ratingOf(co) || 0;
    return {
      co, rating,
      isCheap: q.total === cheap,
      isBest: rating === best && rating > 0
    };
  }

  function quoteCard(item, q, cheap, best) {
    const f = flags(q, cheap, best);
    const cls = 'card quote-card' + (f.isCheap ? ' is-cheap' : '') + (f.isBest ? ' is-best' : '') + (f.co.vip ? ' is-vip' : '');
    return '<article class="' + cls + '" data-quote="' + q.id + '"' + (f.co.vip ? ' data-vip-member="1"' : '') + '>' +
      badges(f) + proHead(f.co, f.rating) +
      quoteBody(q) + quoteActions(item, q) + '</article>';
  }

  function quoteRow(item, q, cheap, best) {
    const f = flags(q, cheap, best);
    const cls = (f.isCheap ? 'cheap' : '') + (f.isBest ? ' best' : '') + (f.co.vip ? ' vip' : '');
    return '<tr class="' + cls + '"' + (f.co.vip ? ' data-vip-member="1"' : '') + '><td>' + esc(f.co.business) + badges(f) + '<div class="tiny">' + f.co.reviews.length + ' reviews · ' + f.co.years + ' years</div></td>' +
      '<td>' + (f.rating == null ? 'New' : f.rating.toFixed(1)) + '</td>' +
      '<td><strong>' + formatR(q.total) + '</strong><div class="tiny">' + vatText(f.co) + '</div></td>' +
      '<td>' + (f.co.vatRegistered ? 'Registered' : 'Not registered') + '</td>' +
      '<td>' + esc(q.included) + '</td><td>' + esc(q.excluded || 'None stated') + '</td><td>' + esc(q.timeline) + '<div class="tiny">Valid ' + esc(niceDate(q.validUntil)) + '</div></td>' +
      '<td>' + (f.co.verified ? 'Verified' : 'Not verified') + '</td><td>' + quoteActions(item, q) + '</td></tr>';
  }

  function badges(f) {
    return '<div class="row">' +
      (f.isCheap ? '<span class="pill pill-good">Cheapest</span>' : '') +
      (f.isBest ? '<span class="pill pill-orange">Best rated</span>' : '') +
      vipBadge(f.co) +
      '</div>';
  }

  function vipBadge(co) {
    if (!co || !co.vip) return '';
    return '<span class="vip-badge">VIP member</span>';
  }

  function vipPriceLabel() {
    if (MQ.VIP_PRICE_YEARLY == null) return 'R X / year';
    return formatR(MQ.VIP_PRICE_YEARLY) + ' / year';
  }

  function vipRevenueLabel() {
    if (MQ.VIP_PRICE_YEARLY == null) return 'R X';
    return formatR((MQ.stats().vipMembers || 0) * MQ.VIP_PRICE_YEARLY);
  }

  function proHead(co, rating) {
    return '<div class="pro"><div class="avatar">' + esc(initials(co.business)) + '</div><div><h3>' + esc(co.business) + '</h3>' +
      '<div class="tiny">' + esc(co.name) + '</div>' +
      '<div class="stars" aria-label="' + (rating == null ? 'New contractor' : rating.toFixed(1) + ' stars') + '">' +
      (rating == null ? 'New' : stars(rating) + ' ' + rating.toFixed(1)) + '</div>' +
      '<div class="tiny">' + (rating == null ? 'No reviews yet' : co.reviews.length + ' reviews') + ' · ' + co.years + ' years</div>' +
      vipBadge(co) +
      (co.verified ? '<span class="pill">Verified</span><p class="tiny">Verified means we checked the business name and the areas they work in. Reviews come only from accepted jobs. Demo check.</p>' : '<p class="tiny">Not verified yet.</p>') +
      '</div></div>';
  }

  function vatText(co) {
    return co && co.vatRegistered ? 'Total includes VAT' : 'Total excludes VAT';
  }

  function quoteBody(q) {
    const co = MQ.contractor(q.contractorId);
    const rows = (q.lineItems || []).map((li) =>
      '<div class="between"><span>' + esc(li.description) + ' × ' + esc(li.qty) + '</span><strong>' + formatR(li.qty * li.price) + '</strong></div>'
    ).join('');
    return '<h3>Materials</h3>' + rows +
      '<div class="between"><span>Labour</span><strong>' + formatR(q.labour) + '</strong></div>' +
      '<div class="between"><span>Call-out</span><strong>' + formatR(q.callout) + '</strong></div>' +
      '<p class="price">' + formatR(q.total) + '</p><p><strong>' + vatText(co) + '.</strong> ' + (co && co.vatRegistered ? 'This contractor is VAT registered.' : 'This contractor is not VAT registered.') + '</p>' +
      '<p><strong>Included.</strong> ' + esc(q.included) + '</p>' +
      '<p><strong>Excluded.</strong> ' + esc(q.excluded || 'No exclusions stated.') + '</p>' +
      '<p><strong>Timeline.</strong> ' + esc(q.timeline) + '</p>' +
      '<p><strong>Valid until.</strong> ' + esc(niceDate(q.validUntil)) + '</p>' +
      (q.notes ? '<p class="tiny">' + esc(q.notes) + '</p>' : '');
  }

  function quoteActions(item, q) {
    if (q.status === 'accepted') return '<p class="pill pill-good">Accepted</p>';
    if (q.status === 'not_selected') return '<p class="pill">Not selected</p>';
    if (item.status === 'accepted') return '';
    const co = MQ.contractor(q.contractorId);
    return '<div class="stack">' +
      '<button type="button" class="btn btn-orange btn-block" data-action="accept" data-id="' + q.id + '" data-contractor="' + q.contractorId + '">Accept ' + esc(co.business) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-action="decline" data-id="' + q.id + '">Decline</button>' +
      '</div>';
  }

  function acceptedBanner(q) {
    const co = MQ.contractor(q.contractorId);
    return '<div class="card"><h2>You chose ' + esc(co.business) + '</h2>' +
      '<p>Call ' + esc(co.name) + ' on <a href="tel:' + esc(co.phone.replace(/\s/g, '')) + '"><strong>' + esc(co.phone) + '</strong></a></p>' +
      '<p class="tiny">The other quotes are marked not selected.</p></div>';
  }

  function thread(item) {
    const msgs = MQ.state.messages.filter((m) => m.leadId === item.id);
    return '<div class="card"><h2>Ask a question</h2>' +
      msgs.map((m) => '<div class="msg' + (m.author === 'client' ? ' mine' : '') + '"><strong>' +
        esc(m.author === 'client' ? 'You' : (MQ.contractor(m.author)?.business || 'Contractor')) +
        '</strong><div>' + esc(m.text) + '</div></div>').join('') +
      '<label class="field"><span>Message the contractors on this job</span>' +
      '<textarea data-field="thread" placeholder="Ask about timing, materials or access"></textarea></label>' +
      '<button type="button" class="btn btn-teal" data-action="send-message" data-lead="' + item.id + '" data-author="client">Send</button></div>';
  }

  function signIn() {
    const people = MQ.state.contractors.filter((c) => !c.bot);
    const c = memory.create || { name: '', business: '', phone: '', trades: [], areas: [], error: '' };
    return '<section data-screen="sign-in"><h1>Contractor demo sign-in</h1>' +
      '<p class="lede">Pick a sample business, or create one. No password — this is a pretend sign-in.</p>' +
      '<div class="stack">' + people.map((co) => {
        const w = MQ.wallet(co.id);
        return '<article class="card"><div class="pro">' + '<div class="avatar">' + esc(initials(co.business)) + '</div><div><h3>' + esc(co.business) + '</h3>' +
          '<div class="tiny">' + esc(co.name) + ' · ' + (MQ.ratingOf(co) || 0).toFixed(1) + ' · ' + co.years + ' years' + (co.verified ? ' · Verified' : '') + '</div>' +
          '<div class="tiny">' + esc(co.trades.join(', ')) + '</div>' +
          '<div class="tiny">' + w.available + ' available · ' + w.held + ' held</div></div></div>' +
          '<p><button type="button" class="btn btn-teal btn-block" data-action="sign-in" data-id="' + co.id + '">Continue as ' + esc(co.business) + '</button></p></article>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-block" data-action="toggle-create">' + (memory.showCreate ? 'Hide form' : 'Create a contractor profile') + '</button>' +
      (memory.showCreate ? createForm(c) : '') +
      '</div></section>';
  }

  function createForm(c) {
    return '<form class="card stack" data-action="create-contractor">' +
      (c.error ? '<p class="form-error">' + esc(c.error) + '</p>' : '') +
      field('Your name', '<input data-field="co-name" required value="' + esc(c.name) + '">') +
      field('Business name', '<input data-field="co-business" required value="' + esc(c.business) + '">') +
      field('Mobile', '<input data-field="co-phone" type="tel" required value="' + esc(c.phone) + '">') +
      '<div class="field"><span>Trades</span><div class="checks">' + MQ.TRADES.map((t) =>
        '<label><input type="checkbox" data-field="co-trade" value="' + esc(t) + '"' + (c.trades.includes(t) ? ' checked' : '') + '> ' + esc(t) + '</label>'
      ).join('') + '</div></div>' +
      '<div class="field"><span>Areas</span><div class="checks">' + MQ.AREAS.map((t) =>
        '<label><input type="checkbox" data-field="co-area" value="' + esc(t) + '"' + (c.areas.includes(t) ? ' checked' : '') + '> ' + esc(t) + '</label>'
      ).join('') + '</div></div>' +
      '<button class="btn btn-orange btn-block" type="submit">Create and continue</button></form>';
  }

  function leads() {
    const co = activeCo();
    const open = MQ.state.leads.filter((item) => item.status === 'open' && MQ.matches(item, co))
      .sort((a, b) => a.auctionEndsAt - b.auctionEndsAt);
    const won = MQ.state.leads.filter((item) => item.status !== 'open' && (item.winners || []).includes(co.id) && MQ.matches(item, co));
    const w = MQ.wallet(co.id);
    const notes = MQ.state.notices.filter((n) => n.contractorId === co.id && !n.read).slice(0, 2);
    const cards = won.map((item) => leadCard(item, co)).concat(open.map((item) => leadCard(item, co)));
    return '<section data-screen="leads"><div class="between"><h1>Leads</h1><a href="#/contractor/wallet">' + w.available + ' free</a></div>' +
      '<p class="fee-note">R20 per token. Live bids show as Contractor A, B or C. You only pay if you win a top-3 place. No subscription and no hidden fees. <a href="#/pricing">Pricing &amp; fees</a> · <a href="#/contractor/vip">VIP ' + vipPriceLabel() + '</a></p>' +
      notes.map((n) => '<div class="notice"><p>' + esc(n.text) + '</p><button type="button" class="btn btn-small btn-ghost" data-action="dismiss" data-id="' + n.id + '">Dismiss</button></div>').join('') +
      '<div class="lead-grid stack">' + (cards.length ? cards.join('') : '<div class="card"><h2>No leads in your area yet</h2><p>Jobs appear here when they match your trades and suburbs. You can add areas on your profile.</p><a class="btn btn-teal" href="#/contractor/profile">Check profile</a></div>') + '</div></section>';
  }

  function statusWord(place, won) {
    if (won) return 'Won';
    if (place === 'in' || place === 'kept') return 'In top 3';
    if (place === 'out') return 'Outbid';
    return 'Not bidding';
  }

  function ownBid(item, contractorId) {
    return MQ.rank(item).find((b) => b.contractorId === contractorId) || null;
  }

  function leadCard(item, co) {
    const won = (item.winners || []).includes(co.id) && item.status !== 'open';
    const place = won ? 'won' : MQ.standing(item, co.id);
    const min = item.status === 'open' ? MQ.minBid(item, co.id) : 0;
    const word = statusWord(place === 'won' ? 'won' : place, won);
    const standing = won ? 'won' : place;
    const mine = ownBid(item, co.id);
    const held = (MQ.wallet(co.id).holds || {})[item.id] || 0;
    const vipBid = co.vip && mine && item.status === 'open';
    return '<article class="card glance' + (co.vip ? ' is-vip' : '') + '" data-lead="' + item.id + '"' + (co.vip ? ' data-vip="yes"' : '') + '><a class="glance-main" href="#/contractor/lead/' + item.id + '">' +
      '<div class="between">' + tradeMark(item.trade) + '<span class="sr">' + esc(item.trade) + '</span>' + (co.vip ? vipBadge(co) : '') + countHtml(item.auctionEndsAt) + '</div>' +
      '<h3>' + esc(item.suburb) + '</h3>' +
      '<p class="tiny">' + esc(item.title) + '</p>' +
      (item.status === 'open' ? '<p class="getin">Get in at <strong>' + min + ' tokens' + (co.vip ? (min > MQ.VIP_MAX_BID ? ' · over the VIP cap' : ' · VIP pays R0') : ' · ' + formatR(min * MQ.TOKEN_RAND)) + '</strong></p>' : '') +
      (vipBid ? '<p class="tiny" data-testid="vip-bid">Your VIP bid: ' + mine.amount + ' tokens' + (held ? '' : ' · no tokens held') + '</p>' : '') +
      '<p class="standing ' + standing + '" data-standing="' + standing + '">' + word + '</p></a>' +
      (item.status === 'open' ? bidTaps(item, min) + confirmBox(item) : '<a class="btn btn-teal btn-block" href="#/contractor/lead/' + item.id + '">View and bid</a>') +
      '</article>';
  }

  function bidTaps(item, min) {
    const co = activeCo();
    const vip = !!(co && co.vip);
    if (vip && min > MQ.VIP_MAX_BID) {
      return '<p class="form-error" data-testid="vip-cap">Fair-play cap is ' + MQ.VIP_MAX_BID + ' tokens per lead. This lead needs ' + min + '. A non-VIP can outbid you.</p>';
    }
    return '<div class="bid-taps" aria-label="One-tap bid">' +
      [1, 2, 5].map((extra) => {
        const amount = min + extra - 1;
        if (vip && amount > MQ.VIP_MAX_BID) {
          return '<button type="button" class="btn btn-ghost" disabled>+' + extra + '<span class="tiny">Over VIP cap</span></button>';
        }
        const price = vip ? 'R0' : formatR(amount * MQ.TOKEN_RAND);
        return '<button type="button" class="btn btn-teal" data-action="pick-bid" data-lead="' + item.id + '" data-extra="' + extra + '">+' + extra + '<span class="tiny">' + amount + ' · ' + price + '</span></button>';
      }).join('') + '</div>';
  }

  function bidSentence(amount, vip) {
    const word = Number(amount) === 1 ? 'token' : 'tokens';
    if (vip) return 'Bid ' + amount + ' ' + word + '. VIP: no tokens held (fair-play cap ' + MQ.VIP_MAX_BID + ' per lead).';
    return 'Bid ' + amount + ' ' + word + ' = ' + formatR(amount * MQ.TOKEN_RAND) + ', held until the auction ends.';
  }

  function confirmBox(item) {
    const c = memory.confirmBid;
    if (!c || c.leadId !== item.id) return '';
    const vip = !!(activeCo() && activeCo().vip);
    return '<div class="confirm" data-testid="bid-confirm"><p><strong>' + bidSentence(c.amount, vip) + '</strong></p>' +
      (vip
        ? '<p>This bid costs nothing. You only take a place if you stay in the top 3. Cap: ' + MQ.VIP_MAX_BID + ' tokens per lead, and ' + MQ.VIP_MAX_ACTIVE + ' open top-3 places. Non-VIPs can outbid you.</p>'
        : '<p>Released if you are pushed out. You only pay if you win a top-3 place.</p>') +
      (memory.bidError ? '<p class="form-error" role="alert">' + esc(memory.bidError) + '</p>' : '') +
      '<button type="button" class="btn btn-orange btn-block" data-action="confirm-bid">Confirm bid</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-action="cancel-bid">Cancel</button></div>';
  }

  function topList(item) {
    const top = MQ.topBidders(item);
    const places = item.places || 3;
    let html = '<ol class="topbids">';
    for (let i = 0; i < places; i++) {
      const b = top[i];
      if (!b) {
        html += '<li class="open-slot">Place ' + (i + 1) + ' open · minimum 1 token</li>';
      } else {
        const co = MQ.contractor(b.contractorId);
        const you = b.contractorId === MQ.state.session.contractorId;
        const beat = i === places - 1 && top.length >= places;
        const who = MQ.contractor(b.contractorId);
        const vip = who && who.vip ? ' · VIP member' : '';
        const cost = who && who.vip ? b.amount + ' · R0' : b.amount + ' · ' + formatR(b.amount * MQ.TOKEN_RAND);
        html += '<li class="' + (beat ? 'beat' : '') + '"><span>' + (i + 1) + '. ' + esc(you ? 'You' : anonName(item, b.contractorId)) + vip +
          (beat ? ' · bid to beat' : '') + '</span><span class="token">' + cost + '</span></li>';
      }
    }
    return html + '</ol>';
  }

  function anonName(item, contractorId) {
    if (contractorId === MQ.state.session.contractorId) return 'You';
    const order = [];
    (item.bids || []).forEach((b) => {
      if (order.indexOf(b.contractorId) < 0) order.push(b.contractorId);
    });
    const others = order.filter((id) => id !== MQ.state.session.contractorId);
    const idx = others.indexOf(contractorId);
    const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(idx < 0 ? 0 : idx) || '?';
    return 'Contractor ' + letter;
  }

  function standingBlock(item, co, place, min) {
    const label = place === 'in' || place === 'kept' ? 'In top 3'
      : place === 'out' ? 'Outbid'
      : 'Not bidding';
    return '<div class="standing ' + place + '" data-standing="' + place + '">' + label + ' · minimum to get in ' + randTokens(min) + '</div>';
  }

  function thumbs(photos) {
    if (!photos || !photos.length) return '';
    return '<div class="thumbs">' + photos.slice(0, 3).map((src) => '<img src="' + src + '" alt="">').join('') + '</div>';
  }

  function leadDetail(id) {
    const item = MQ.lead(id);
    const co = activeCo();
    if (!item) return '<p>Lead not found.</p>';
    const won = (item.winners || []).includes(co.id) && item.status !== 'open';
    const place = MQ.standing(item, co.id);
    const min = item.status === 'open' ? MQ.minBid(item, co.id) : 0;
    let draft = memory.bidDraft[id];
    if (item.status === 'open' && (draft == null || Number(draft) < min)) {
      draft = min;
      memory.bidDraft[id] = String(min);
    }
    const mineQuote = MQ.quotesFor(item.id).find((q) => q.contractorId === co.id);
    return '<section data-screen="lead" data-lead="' + item.id + '"><p class="tiny">' + esc(item.trade) + '</p><h1>' + esc(item.title) + '</h1>' +
      '<p class="tiny">' + esc(item.suburb) + ' · ' + esc(TIMING[item.timing] || '') + (item.budget ? ' · ' + esc(item.budget) : '') + '</p>' +
      (item.status === 'open' ? '<p>' + countHtml(item.auctionEndsAt) + ' · ' + rank(item).length + ' bids</p>' : '') +
      '<p>' + esc(won ? item.description : item.description.slice(0, 220)) + '</p>' +
      (won ? '<div class="gallery">' + (item.photos || []).map((src) => '<img src="' + src + '" alt="Job photo">').join('') + '</div>' : thumbs(item.photos)) +
      (won ? contactBlock(item) : '<div class="card"><h2>Contact hidden</h2><p>' + esc(maskName(item.contactName)) + ' · ' + esc(maskPhone(item.contactPhone)) + '</p><p class="tiny">The top 3 see the full number and the street note when the auction ends.</p></div>') +
      (item.status === 'open' ? '<p class="fee-note">' + (co.vip ? 'You are a VIP member. Bids cost no tokens, up to ' + MQ.VIP_MAX_BID + ' per lead, and at most ' + MQ.VIP_MAX_ACTIVE + ' open top-3 places. Non-VIPs can bid higher.' : 'Minimum bid to get in is ' + randTokens(min) + '. Held tokens are released if you are pushed out. You only pay if you win a top-3 place.') + '</p>' + topList(item) + standingBlock(item, co, place, min) + bidTaps(item, min) + confirmBox(item) + '<p class="tiny">Demo only — skip the countdown.</p><button type="button" class="btn btn-ghost btn-block" data-action="end-auction" data-lead="' + item.id + '">End auction now</button>' : '') +
      (won ? '<div class="card"><h2>You won a place</h2><p>Your bid has been spent. Send the client a quote.</p>' +
        (mineQuote ? '<p class="pill">Quote ' + esc(statusLabel(mineQuote.status)) + ' · ' + formatR(mineQuote.total) + '</p>' : '<a class="btn btn-orange btn-block" data-testid="send-quote" href="#/contractor/quote/' + item.id + '">Send quote</a>') +
        '</div>' + contractorThread(item) : '') +
      '</section>';
  }

  function contactBlock(item) {
    return '<div class="card" data-testid="unlocked"><h2>Client contact</h2><p><strong>' + esc(item.contactName) + '</strong></p>' +
      '<p><a href="tel:' + esc(String(item.contactPhone).replace(/\s/g, '')) + '">' + esc(item.contactPhone) + '</a></p>' +
      '<p class="tiny">' + esc(item.privateNote || '') + '</p></div>';
  }

  function bidBox() { return ''; }

  function contractorThread(item) {
    const msgs = MQ.state.messages.filter((m) => m.leadId === item.id);
    if (!msgs.length && item.status === 'open') return '';
    return '<div class="card"><h2>Questions</h2>' +
      (msgs.length ? msgs.map((m) => '<div class="msg"><strong>' + esc(m.author === 'client' ? 'Client' : 'You') + '</strong><div>' + esc(m.text) + '</div></div>').join('') : '<p class="tiny">No messages yet.</p>') +
      '<label class="field"><span>Reply</span><textarea data-field="reply"></textarea></label>' +
      '<button type="button" class="btn btn-teal" data-action="send-message" data-lead="' + item.id + '" data-author="' + activeCo().id + '">Send</button></div>';
  }

  function quoteForm(id) {
    const item = MQ.lead(id);
    const co = activeCo();
    if (!item || !(item.winners || []).includes(co.id)) return '<p>Win a place on this lead before sending a quote.</p>';
    if (!memory.quote || memory.quote.leadId !== id) {
      memory.quote = {
        leadId: id,
        lineItems: [{ description: '', qty: 1, price: '' }],
        labour: '', callout: '', included: '', excluded: '', validUntil: isoDays(14), timeline: '', notes: '', error: ''
      };
    }
    const q = memory.quote;
    const total = previewTotal(q);
    return '<section data-screen="send-quote"><h1>Send quote</h1><p class="tiny">' + esc(item.title) + ' · ' + esc(item.suburb) + '</p>' +
      (q.error ? '<p class="form-error" role="alert">' + esc(q.error) + '</p>' : '') +
      '<div class="stack">' + q.lineItems.map((li, i) =>
        '<div class="card"><div class="line-row">' +
        '<input data-field="li-desc" data-index="' + i + '" placeholder="Description" value="' + esc(li.description) + '">' +
        '<input data-field="li-qty" data-index="' + i + '" type="number" min="1" value="' + esc(li.qty) + '">' +
        '<input data-field="li-price" data-index="' + i + '" type="number" min="0" placeholder="Price" value="' + esc(li.price) + '">' +
        '</div></div>'
      ).join('') +
      '<button type="button" class="btn btn-ghost" data-action="add-line">Add a line</button>' +
      '<div class="grid-2">' +
      field('Labour (R)', '<input id="q-labour" data-field="q-labour" type="number" min="0" value="' + esc(q.labour) + '">') +
      field('Call-out (R)', '<input id="q-callout" data-field="q-callout" type="number" min="0" value="' + esc(q.callout) + '">') +
      '</div>' +
      field('What’s included', '<textarea id="q-included" data-field="q-included">' + esc(q.included) + '</textarea>') +
      field('What’s excluded', '<textarea id="q-excluded" data-field="q-excluded" placeholder="Work you will not do">' + esc(q.excluded || '') + '</textarea>') +
      '<p class="tiny">' + vatText(co) + '. This follows your VAT registration.</p>' +
      field('Valid until', '<input id="q-valid" data-field="q-validUntil" type="date" value="' + esc(q.validUntil) + '">') +
      field('Timeline', '<input id="q-timeline" data-field="q-timeline" type="text" value="' + esc(q.timeline) + '" placeholder="Tomorrow morning">') +
      field('Notes', '<textarea id="q-notes" data-field="q-notes">' + esc(q.notes) + '</textarea>') +
      '<div class="card between"><span>Total</span><strong id="q-total" class="price">' + formatR(total) + '</strong></div>' +
      '<button type="button" class="btn btn-orange btn-block" data-action="submit-quote" data-lead="' + item.id + '">Send quote</button>' +
      '</div></section>';
  }

  function previewTotal(q) {
    const lines = q.lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.price) || 0), 0);
    return lines + (Number(q.labour) || 0) + (Number(q.callout) || 0);
  }

  function work() {
    const co = activeCo();
    const won = [];
    const lost = [];
    MQ.state.leads.forEach((item) => {
      const bid = item.bids.some((b) => b.contractorId === co.id) || (item.winningBids || []).some((b) => b.contractorId === co.id);
      const isWinner = (item.winners || []).includes(co.id);
      if (isWinner && item.status !== 'open') won.push(item);
      else if (item.status !== 'open' && bid && !isWinner) lost.push(item);
    });
    const quotes = MQ.state.quotes.filter((q) => q.contractorId === co.id);
    const tab = memory.workTab;
    return '<section data-screen="work"><h1>My work</h1><div class="row">' +
      workTab('won', 'Won') + workTab('lost', 'Lost') + workTab('quotes', 'Quotes') + '</div>' +
      (tab === 'won' ? stackCards(won, false) : tab === 'lost' ? stackCards(lost, true) : quoteList(quotes)) +
      '</section>';
  }

  function workTab(id, label) {
    return '<button type="button" class="btn btn-small ' + (memory.workTab === id ? 'btn-teal' : 'btn-ghost') + '" data-action="work-tab" data-tab="' + id + '">' + label + '</button>';
  }

  function stackCards(items, lost) {
    if (!items.length) {
      return lost
        ? '<div class="card"><h2>No lost leads</h2><p>If you are pushed out of the top 3, the lead shows here after the auction ends. Held tokens come back. VIP bids were never held.</p></div>'
        : '<div class="card"><h2>No won leads yet</h2><p>Bid on an open lead. If you finish in the top 3, send a quote from here.</p><a class="btn btn-teal" href="#/contractor/leads">See leads</a></div>';
    }
    return '<div class="stack">' + items.map((item) =>
      '<a class="card' + (lost ? ' lost' : '') + '" href="#/contractor/lead/' + item.id + '" style="text-decoration:none;color:inherit"><h3>' +
      esc(item.title) + '</h3><p class="tiny">' + esc(item.suburb) + ' · ' + (lost ? 'Lost' : 'Won') + '</p></a>'
    ).join('') + '</div>';
  }

  function statusLabel(s) {
    return { sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted', not_selected: 'Not selected' }[s] || s;
  }

  function quoteList(quotes) {
    if (!quotes.length) return '<div class="card"><h2>No quotes sent</h2><p>Win a top-3 place, then send one quote. The client compares up to three.</p></div>';
    return '<div class="stack">' + quotes.map((q) => {
      const item = MQ.lead(q.leadId);
      return '<article class="card"><h3>' + esc(item ? item.title : 'Quote') + '</h3><p class="price">' + formatR(q.total) + '</p>' +
        '<p class="pill">' + esc(statusLabel(q.status)) + '</p>' +
        (item ? statusTimeline(item) : '') + '</article>';
    }).join('') + '</div>';
  }

  function historyRand(h) {
    if (h.type === 'vip' && (h.rand === null || typeof h.rand === 'undefined')) return 'R X';
    if (h.rand != null) return formatR(h.rand);
    return formatR((Number(h.amount) || 0) * MQ.TOKEN_RAND);
  }

  function walletPage() {
    const co = activeCo();
    const w = MQ.wallet(co.id);
    return '<section data-screen="wallet"><h1>Token wallet</h1>' +
      (co.vip
        ? '<p class="vip-line" data-testid="vip-wallet">VIP: unlimited (fair-play cap ' + MQ.VIP_MAX_BID + ' per lead)</p><p class="tiny">New bids cost nothing, up to ' + MQ.VIP_MAX_BID + ' tokens a lead and ' + MQ.VIP_MAX_ACTIVE + ' open top-3 places. Tokens already held stay held until that auction ends. <a href="#/contractor/vip">Manage VIP</a></p>'
        : '<p class="tiny">1 token = R20. Bids are held until you are pushed out, then released. If you finish in the top 3, the held tokens are spent. <a href="#/contractor/vip">VIP is ' + vipPriceLabel() + ' (price TBC)</a></p>') +
      '<div class="wallet-hero"><div class="card"><span class="tiny">Available</span><strong>' + w.available + '</strong><span class="tiny">' + formatR(w.available * MQ.TOKEN_RAND) + '</span></div>' +
      '<div class="card"><span class="tiny">Held</span><strong>' + w.held + '</strong><span class="tiny">' + formatR(w.held * MQ.TOKEN_RAND) + '</span></div></div>' +
      '<h2>Buy tokens</h2><p class="tiny">DEMO checkout. Nothing is charged. Packs are for non-VIP bids, or if you cancel VIP.</p>' +
      '<div class="pack-grid stack">' + MQ.PACKS.map((p) =>
        '<article class="card pack"><span class="demo-tag">DEMO</span><h3>' + p.tokens + ' tokens</h3><p class="rand">' + formatR(p.rand) + '</p>' +
        '<p class="tiny">R20 a token</p><button type="button" class="btn btn-orange btn-block" data-action="open-buy" data-pack="' + p.id + '">Buy ' + p.tokens + ' tokens</button></article>'
      ).join('') + '</div>' +
      '<h2>History</h2><ul class="history" data-testid="wallet-history">' + w.history.slice(0, 30).map((h) =>
        '<li><div class="between"><strong>' + esc(h.note) + '</strong><span>' + historyRand(h) + '</span></div><div class="tiny">' + esc(h.type || 'entry') + (h.leadTitle ? ' · ' + esc(h.leadTitle) : '') + ' · ' + new Date(h.at).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) + '</div></li>'
      ).join('') + '</ul></section>';
  }

  function profile() {
    const co = activeCo();
    const rating = MQ.ratingOf(co);
    return '<section data-screen="profile"><div class="pro"><div class="avatar">' + esc(initials(co.business)) + '</div><div><h1>' + esc(co.business) + '</h1>' +
      '<p class="tiny">' + esc(co.name) + ' · ' + esc(co.phone) + '</p></div></div>' +
      '<p>' + vipBadge(co) + '</p>' +
      '<p class="stars">' + (rating == null ? 'New on Multiquoters' : stars(rating) + ' ' + rating.toFixed(1)) + '</p>' +
      '<p>' + (co.verified ? '<span class="pill">Verified</span> Verified means the business name and areas were checked. Reviews come only from accepted jobs. Demo check.' : 'Not verified yet.') + ' · ' + co.years + ' years in business</p>' +
      '<p><strong>VAT.</strong> ' + (co.vatRegistered ? 'Registered — quote totals include VAT.' : 'Not registered — quote totals exclude VAT.') + '</p>' +
      '<p>' + (co.vip ? 'You are a VIP member. <a href="#/contractor/vip">Manage VIP</a>' : '<a class="btn btn-teal" href="#/contractor/vip">Become VIP</a>') + '</p>' +
      '<p>' + esc(co.about) + '</p>' +
      '<p><strong>Trades.</strong> ' + esc(co.trades.join(', ')) + '</p>' +
      '<p><strong>Areas.</strong> ' + esc(co.areas.join(', ')) + '</p>' +
      '<h2>Reviews</h2>' + (co.reviews.length ? co.reviews.map((r) =>
        '<article class="card"><div class="stars">' + stars(r.score) + '</div><p>' + esc(r.text) + '</p><p class="tiny">' + esc(r.name) + ' · ' + esc(r.area) + '</p></article>'
      ).join('') : '<p>No reviews yet.</p>') + '</section>';
  }

  function admin() {
    const s = MQ.stats();
    const pct = Math.round(s.acceptanceRate * 100);
    return '<section data-screen="admin"><h1>Overview</h1><p class="lede">How the token auction makes money. All figures are pretend.</p>' +
      '<div class="stat-grid">' +
      stat('Tokens sold', formatR(s.tokensRand), s.tokensCount + ' tokens', 'tokens-rand', s.tokensRand) +
      stat('Average winning bid', s.avgWinningBid.toFixed(1) + ' tokens', formatR(s.avgWinningBid * MQ.TOKEN_RAND), 'avg-bid', s.avgWinningBid.toFixed(2)) +
      stat('Auctions completed', String(s.auctions), 'Top 3 each pay their bid', 'auctions', s.auctions) +
      stat('Quotes per lead', s.quotesPerLead.toFixed(1), s.quotes + ' quotes', 'quotes-per', s.quotesPerLead.toFixed(2)) +
      stat('Quotes accepted', String(s.accepted), 'of ' + s.quotes + ' sent', 'accepted', s.accepted) +
      stat('Acceptance rate', pct + '%', 'Accepted quotes ÷ quotes sent', 'rate', pct) +
      stat('VIP members', String(s.vipMembers), 'VIP revenue ' + vipRevenueLabel(), 'vip-members', s.vipMembers) +
      stat('VIP revenue', vipRevenueLabel(), 'Yearly price is TBC in this demo', 'vip-revenue', vipRevenueLabel()) +
      '</div>' +
      '<div class="card"><h2>The model</h2><p>A lead opens at 1 token. Contractors bid for 12 hours. The three highest each pay whatever they bid (R20 a token) and unlock the client. Everyone else is released. VIP bids cost no tokens, but a VIP can bid at most ' + MQ.VIP_MAX_BID + ' tokens per lead and hold a top-3 place on at most ' + MQ.VIP_MAX_ACTIVE + ' open leads. The client compares up to three quotes and accepts one.</p>' +
      '<p class="tiny">' + s.leads + ' leads in this demo, including open auctions.</p></div></section>';
  }

  function fairPlayCard() {
    return '<div class="card fair-play" data-testid="fair-play"><h2>Fair-play rule</h2>' +
      '<p>Unlimited tokens would let a VIP outbid everyone. A VIP’s bids cost no tokens, and:</p><ul>' +
      '<li>A VIP can bid at most ' + MQ.VIP_MAX_BID + ' tokens per lead.</li>' +
      '<li>Non-VIP contractors can bid more than ' + MQ.VIP_MAX_BID + ' and outbid a VIP.</li>' +
      '<li>A VIP can hold a top-3 place on at most ' + MQ.VIP_MAX_ACTIVE + ' open leads at a time.</li>' +
      '</ul><p class="tiny">These caps are config constants VIP_MAX_BID and VIP_MAX_ACTIVE.</p></div>';
  }

  function pricingPage() {
    return '<section data-screen="pricing"><span class="demo-tag">DEMO</span>' +
      '<p class="tiny">Demo / draft text. This page states the rules of the demo. It is not a live contract.</p>' +
      '<h1>Pricing &amp; fees</h1>' +
      '<div class="card"><h2>Homeowners</h2><p>Free for you. Up to 3 vetted contractors will quote. You choose; there is no obligation. Your number stays hidden until a contractor wins a top-3 place.</p></div>' +
      '<div class="card"><h2>Tokens</h2><p><strong>1 token = R20.</strong> Packs in this demo: 10 tokens for R200, 25 for R500, 50 for R1,000.</p>' +
      '<p>Every lead opens at 1 token. You see live bids as Contractor A, B or C, plus your own. The minimum bid is the 3rd-place bid plus 1 token, or 1 token while fewer than 3 people have bid.</p>' +
      '<p>Tokens are held when you bid and released if you are pushed out. You only pay if you win a top-3 place. There is no subscription and there are no hidden fees.</p></div>' +
      '<div class="card vip-offer"><span class="demo-tag">DEMO</span><h2>VIP: unlimited tokens for ' + vipPriceLabel() + '</h2>' +
      '<p class="price" data-testid="vip-price">' + vipPriceLabel() + '</p><p class="tiny">price TBC</p>' +
      '<p>Optional yearly membership. Checkout here is pretend.</p></div>' +
      fairPlayCard() +
      '<p><a class="btn btn-teal" href="#/contractor/vip">Become VIP</a> <a class="btn btn-ghost" href="#/trust">Trust &amp; safety</a></p></section>';
  }

  function trustPage() {
    return '<section data-screen="trust"><span class="demo-tag">DEMO</span>' +
      '<p class="tiny">Demo / draft text. Trust wording for this prototype, not a legal policy.</p>' +
      '<h1>Trust &amp; safety</h1>' +
      '<div class="card"><h2>Verification</h2><p>A verified badge means the business name and the areas they work in were checked. In this demo that check is pretend.</p></div>' +
      '<div class="card"><h2>Reviews</h2><p>Reviews come only from jobs the client accepted. A contractor cannot review their own lead.</p></div>' +
      '<div class="card"><h2>Who sees a lead</h2><p>At most 3 contractors win each lead. Everyone else is released. The client’s name, number and street note are shown only to those winners.</p></div>' +
      '<div class="card"><h2>Your information</h2><p>This demo stores everything in your browser. We do not send jobs to a server. In a live service we would collect only what is needed to match a job, share contact details only with the winning contractors, and handle personal information in line with POPIA: a clear purpose, limited sharing, and a way to ask for deletion.</p></div>' +
      '<p><a href="#/pricing">Pricing &amp; fees</a></p></section>';
  }

  function vipPage() {
    const co = activeCo();
    return '<section data-screen="vip" data-testid="vip-page"><span class="demo-tag">DEMO</span>' +
      '<h1>' + (co.vip ? 'Your VIP membership' : 'Become VIP') + '</h1>' +
      '<p class="lede">VIP: unlimited tokens for ' + vipPriceLabel() + '</p>' +
      '<p class="price" data-testid="vip-price">' + vipPriceLabel() + '</p>' +
      '<p class="tiny">price TBC</p>' +
      '<div class="card"><h2>What you get</h2><ul>' +
      '<li>Unlimited tokens within the fair-play rule. Bids cost no tokens.</li>' +
      '<li>A VIP badge on your profile and on lead cards. Clients see it as VIP member.</li>' +
      '<li>Priority alerts on new leads that match your trades and suburbs. Demo notice only.</li>' +
      '<li>A profile highlight in the client compare view, next to price and rating.</li>' +
      '</ul></div>' +
      fairPlayCard() +
      (co.vip
        ? '<p class="pill pill-good">You are a VIP member</p><button type="button" class="btn btn-ghost btn-block" data-action="cancel-vip">Cancel VIP</button>'
        : '<button type="button" class="btn btn-orange btn-block" data-action="become-vip"><span class="demo-tag">DEMO</span> Become VIP</button><p class="tiny">Pretend checkout. No card is charged.</p>') +
      '</section>';
  }

  function stat(label, value, note, id, raw) {
    return '<article class="card stat"><span class="tiny">' + label + '</span><strong data-stat="' + id + '" data-value="' + raw + '">' + value + '</strong><span class="tiny">' + note + '</span></article>';
  }

  function modalHtml() {
    if (!memory.modal || memory.modal.type !== 'buy') return '';
    const pack = MQ.PACKS.find((p) => p.id === memory.modal.pack);
    if (!pack) return '';
    return '<div class="modal-back"><div class="modal" role="dialog" aria-labelledby="buy-title"><span class="demo-tag">DEMO</span>' +
      '<h2 id="buy-title">Pretend checkout</h2><p>Add <strong>' + pack.tokens + ' tokens</strong> for <strong>' + formatR(pack.rand) + '</strong>. No card is charged.</p>' +
      '<div class="stack"><button type="button" class="btn btn-orange btn-block" data-action="confirm-buy" data-pack="' + pack.id + '">Add tokens</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-action="close-modal">Cancel</button></div></div></div>';
  }

  function paintCountdowns() {
    document.querySelectorAll('[data-ends]').forEach((el) => {
      const ends = Number(el.dataset.ends);
      el.textContent = formatRemain(ends);
      el.classList.toggle('hot', ends - Date.now() < 15 * 60 * 1000 && ends > Date.now());
    });
  }

  function readWizard() {
    const w = memory.wizard || blankWizard();
    return w;
  }

  async function onPhotos(files) {
    const w = memory.wizard;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (w.photos.length >= 4) break;
      try {
        w.photos.push(await downscale(file));
      } catch (err) {
        w.error = 'Could not read that photo.';
      }
    }
    render(true);
  }

  function downscale(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 960;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  function onClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'pick-trade') {
      memory.wizard = memory.wizard || blankWizard();
      memory.wizard.trade = t.dataset.trade;
      memory.wizard.step = 2;
      memory.wizard.error = '';
      render(true);
    } else if (action === 'wizard-next') {
      advanceWizard();
    } else if (action === 'wizard-back') {
      if (memory.wizard && memory.wizard.step > 1) memory.wizard.step -= 1;
      if (memory.wizard) memory.wizard.error = '';
      render(true);
    } else if (action === 'post-job') {
      postJob();
    } else if (action === 'sign-in') {
      MQ.signIn(t.dataset.id);
      go('#/contractor/leads');
    } else if (action === 'toggle-create') {
      memory.showCreate = !memory.showCreate;
      memory.create = memory.create || { name: '', business: '', phone: '', trades: [], areas: [], error: '' };
      render(true);
    } else if (action === 'pick-bid') {
      const item = MQ.lead(t.dataset.lead);
      const co = activeCo();
      const min = MQ.minBid(item, co.id);
      const amount = min + Number(t.dataset.extra) - 1;
      memory.bidError = '';
      if (co.vip && amount > MQ.VIP_MAX_BID) {
        memory.confirmBid = null;
        memory.bidError = 'VIP fair-play cap is ' + MQ.VIP_MAX_BID + ' tokens per lead. A non-VIP can bid higher and outbid you.';
        render(true);
        return;
      }
      memory.confirmBid = { leadId: item.id, amount: amount };
      render(true);
    } else if (action === 'confirm-bid') {
      const chosen = memory.confirmBid;
      if (!chosen) return;
      const co = activeCo();
      const res = MQ.placeBid(co.id, chosen.leadId, chosen.amount);
      if (!res.ok) {
        memory.bidError = res.error;
        render(true);
        return;
      }
      memory.confirmBid = null;
      memory.bidError = '';
      toast(co.vip
        ? 'VIP bid of ' + chosen.amount + ' tokens placed. No tokens held. Fair-play cap is ' + MQ.VIP_MAX_BID + ' per lead.'
        : bidSentence(chosen.amount, false) + ' Released if you are pushed out.');
      render(true);
    } else if (action === 'cancel-bid') {
      memory.confirmBid = null;
      memory.bidError = '';
      render(true);
    } else if (action === 'become-vip') {
      const res = MQ.becomeVip(activeCo().id);
      if (!res.ok) toast(res.error);
    } else if (action === 'cancel-vip') {
      const res = MQ.cancelVip(activeCo().id);
      if (!res.ok) toast(res.error);
    } else if (action === 'end-auction') {
      MQ.endAuction(t.dataset.lead);
    } else if (action === 'open-buy') {
      memory.modal = { type: 'buy', pack: t.dataset.pack };
      render(true);
    } else if (action === 'close-modal') {
      memory.modal = null;
      render(true);
    } else if (action === 'confirm-buy') {
      MQ.buyPack(activeCo().id, t.dataset.pack);
      memory.modal = null;
    } else if (action === 'add-line') {
      memory.quote.lineItems.push({ description: '', qty: 1, price: '' });
      render(true);
    } else if (action === 'submit-quote') {
      submitQuote();
    } else if (action === 'sort') {
      memory.sort = t.dataset.sort;
      render(true);
    } else if (action === 'accept') {
      MQ.acceptQuote(t.dataset.id);
    } else if (action === 'decline') {
      MQ.declineQuote(t.dataset.id);
    } else if (action === 'request-more') {
      const res = MQ.requestMore(t.dataset.lead);
      memory.moreError = res.ok ? '' : res.error;
      if (!res.ok) render(true);
    } else if (action === 'send-message') {
      const field = t.dataset.author === 'client' ? document.querySelector('[data-field="thread"]') : document.querySelector('[data-field="reply"]');
      const res = MQ.sendMessage(t.dataset.lead, t.dataset.author, field ? field.value : '');
      if (res.ok && field) field.value = '';
    } else if (action === 'dismiss') {
      MQ.dismissNotice(t.dataset.id);
    } else if (action === 'work-tab') {
      memory.workTab = t.dataset.tab;
      render(true);
    }
  }

  function postJob() {
    const w = memory.wizard;
    const phone = String(w.phone || '').replace(/\D/g, '');
    if (!w.title || w.title.trim().length < 4) return failW('Add a short job title.');
    if (!w.description || w.description.trim().length < 15) return failW('Describe the job in a sentence or two.');
    if (!w.suburb) return failW('Choose a suburb.');
    if (!w.timing) return failW('Choose when you need it.');
    if (!w.name || w.name.trim().length < 2) return failW('Add your name.');
    if (phone.length < 10) return failW('Add a mobile number.');
    const item = MQ.createLead({
      title: w.title, description: w.description, photos: w.photos, trade: w.trade,
      suburb: w.suburb, timing: w.timing, budget: w.budget, contactName: w.name, contactPhone: w.phone
    });
    memory.wizard = blankWizard();
    go('#/client/request/' + item.id);
  }

  function failW(msg) {
    memory.wizard.error = msg;
    render(true);
  }

  function advanceWizard() {
    const w = memory.wizard || blankWizard();
    memory.wizard = w;
    w.error = '';
    if (w.step === 3) {
      if (!w.title || w.title.trim().length < 4) return failW('Add a short job title.');
      if (!w.description || w.description.trim().length < 15) return failW('Describe the job in a sentence or two.');
    }
    if (w.step === 4) {
      if (!w.suburb) return failW('Choose a suburb.');
      if (!w.timing) w.timing = 'week';
    }
    if (w.step === 5) {
      const phone = String(w.phone || '').replace(/\D/g, '');
      if (!w.name || w.name.trim().length < 2) return failW('Add your name.');
      if (phone.length < 10) return failW('Add a mobile number so a winner can call you.');
    }
    if (w.step < 6) w.step += 1;
    render(true);
  }

  function submitQuote() {
    const q = memory.quote;
    const lines = q.lineItems.filter((li) => String(li.description || '').trim() && Number(li.price) >= 0 && Number(li.qty) > 0)
      .map((li) => ({ description: li.description.trim(), qty: Number(li.qty), price: Number(li.price) }));
    if (!lines.length) return failQ('Add at least one line with a description and price.');
    if (!q.included.trim()) return failQ('Say what is included.');
    if (!q.timeline.trim()) return failQ('Add a timeline.');
    if (!q.validUntil) return failQ('Choose a valid-until date.');
    const res = MQ.saveQuote({
      leadId: q.leadId,
      contractorId: activeCo().id,
      lineItems: lines,
      labour: q.labour,
      callout: q.callout,
      included: q.included.trim(),
      excluded: (q.excluded || '').trim(),
      validUntil: q.validUntil,
      timeline: q.timeline.trim(),
      notes: q.notes.trim()
    });
    if (!res.ok) return failQ(res.error);
    memory.quote = null;
    go('#/contractor/work');
  }

  function failQ(msg) {
    memory.quote.error = msg;
    render(true);
  }

  function onInput(e) {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    if (field.indexOf('wiz-') === 0) {
      memory.wizard[field.slice(4)] = el.value;
    } else if (field === 'bid') {
      memory.bidDraft[el.dataset.lead] = el.value;
      const hint = el.parentElement && el.parentElement.parentElement && el.parentElement.parentElement.querySelector('.tiny');
      if (hint && hint.textContent.indexOf('This holds') === 0) {
        hint.textContent = 'This holds ' + randTokens(el.value || 0) + '. Available updates when you bid.';
      }
    } else if (field.indexOf('q-') === 0 && memory.quote) {
      memory.quote[field.slice(2)] = el.value;
      const total = document.getElementById('q-total');
      if (total) total.textContent = formatR(previewTotal(memory.quote));
    } else if (field === 'li-desc' || field === 'li-qty' || field === 'li-price') {
      const li = memory.quote.lineItems[Number(el.dataset.index)];
      const key = field === 'li-desc' ? 'description' : field === 'li-qty' ? 'qty' : 'price';
      li[key] = el.value;
      const total = document.getElementById('q-total');
      if (total) total.textContent = formatR(previewTotal(memory.quote));
    } else if (field === 'co-name' || field === 'co-business' || field === 'co-phone') {
      memory.create[field.slice(3)] = el.value;
    }
    if (dirty && document.activeElement !== el) render(true);
  }

  function onChange(e) {
    const el = e.target;
    if (el.dataset.field === 'wiz-timing') memory.wizard.timing = el.value;
    if (el.dataset.field === 'wiz-suburb') memory.wizard.suburb = el.value;
    if (el.dataset.field === 'wiz-budget') memory.wizard.budget = el.value;
    if (el.id === 'job-photos') onPhotos(el.files);
    if (el.dataset.field === 'co-trade' || el.dataset.field === 'co-area') {
      const key = el.dataset.field === 'co-trade' ? 'trades' : 'areas';
      const set = new Set(memory.create[key]);
      if (el.checked) set.add(el.value); else set.delete(el.value);
      memory.create[key] = [...set];
    }
  }

  function onSubmit(e) {
    const form = e.target.closest('form[data-action="create-contractor"]');
    if (!form) return;
    e.preventDefault();
    const c = memory.create;
    if (!c.name.trim() || !c.business.trim() || c.phone.replace(/\D/g, '').length < 10) {
      c.error = 'Name, business and a mobile number are required.';
      render(true);
      return;
    }
    if (!c.trades.length || !c.areas.length) {
      c.error = 'Pick at least one trade and one area.';
      render(true);
      return;
    }
    MQ.createContractor(c);
    memory.showCreate = false;
    memory.create = null;
    go('#/contractor/leads');
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);
  document.getElementById('reset-demo').addEventListener('click', () => {
    memory.wizard = null;
    memory.quote = null;
    memory.modal = null;
    memory.bidDraft = {};
    memory.confirmBid = null;
    memory.bidError = '';
    memory.moreError = '';
    MQ.reset();
    if (location.hash && location.hash !== '#/') location.hash = '#/';
  });
  document.getElementById('view').addEventListener('focusout', () => {
    if (dirty) setTimeout(() => { if (dirty) render(true); }, 0);
  });
  window.addEventListener('hashchange', () => {
    const parts = route();
    if (parts[0] === 'contractor') MQ.setRole('contractor');
    else if (parts[0] === 'client') MQ.setRole('client');
    render(true);
  });

  MQ.init();
  MQ.subscribe((event) => {
    if (event && event.toast) toast(event.toast);
    if (event && event.reset) {
      memory.wizard = null;
      memory.quote = null;
    }
    render(false);
  });
  render(true);
  setInterval(() => {
    const changed = MQ.tick();
    if (!changed) paintCountdowns();
  }, 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
