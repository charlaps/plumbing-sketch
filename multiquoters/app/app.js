(function () {
  const CFG = window.MQ_CONFIG || {};
  const PAY = window.MQPayments;
  const TRADES = ['Plumbing', 'Electrical', 'Painting', 'Geyser', 'Solar', 'Handyman', 'Building', 'Roofing'];
  const TRADE_HINTS = {
    Plumbing: 'Pipes, leaks, taps and toilets.',
    Electrical: 'Lights, plugs and distribution boards.',
    Painting: 'Interior and exterior paint.',
    Geyser: 'Hot-water cylinders. A plumber usually does this too.',
    Solar: 'Solar geysers and panels.',
    Handyman: 'Smaller repairs around the house.',
    Building: 'Brickwork and alterations.',
    Roofing: 'Leaks, tiles and roof sheets.'
  };
  const AREAS = ['Johannesburg North', 'Johannesburg South', 'West Rand', 'East Rand', 'Pretoria', 'Durban', 'Cape Town'];
  const WHEN_OPTIONS = ['Urgent / today', 'This week', 'This month', 'Flexible'];

  const view = document.getElementById('view');
  const subnav = document.getElementById('subnav');
  const bottom = document.getElementById('bottom-nav');
  const topActions = document.getElementById('top-actions');
  const viewing = document.getElementById('viewing-as');
  const roleName = document.getElementById('role-name');

  let sb = null;
  let session = null;
  let profile = null;
  let settings = {};
  let unread = 0;
  let seq = 0;
  let poll = null;
  let eft = null;
  let keepEft = false;
  let ready = false;
  let liveChannel = null;
  let signingOut = false;
  let recovery = false;
  let pendingAccept = null;
  let quoteDraft = null;
  const wizard = blankWizard();

  function blankWizard() {
    return {
      step: 1, trade: '', files: [], title: '', description: '',
      area: '', suburb: '', when: '', contact_name: '', phone: '', note: '',
      bidAmount: null
    };
  }

  function configured() {
    const url = String(CFG.SUPABASE_URL || '').trim();
    const key = String(CFG.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return false;
    if (/YOUR_|placeholder|example\.supabase/i.test(url + ' ' + key)) return false;
    return url.indexOf('https://') === 0;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatR(n) {
    const v = Math.round(Number(n) || 0);
    const sign = v < 0 ? '-' : '';
    return sign + 'R' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function plural(n, word) {
    const v = Math.abs(Number(n) || 0);
    return v + ' ' + word + (v === 1 ? '' : 's');
  }

  function ordinal(n) {
    const v = Math.abs(Number(n) || 0);
    const teen = v % 100;
    const suffix = (teen >= 11 && teen <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
    return v + suffix;
  }

  function jobRef(id) {
    const raw = String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
    return raw ? 'MQ-' + raw : '';
  }

  function jobStatusLabel(status, reviewed) {
    if (status === 'open') return 'Bidding';
    if (status === 'matched') return 'Quotes due';
    if (status === 'quoting') return 'Quotes in';
    if (status === 'accepted') return reviewed ? 'Completed' : 'Accepted';
    if (status === 'closed') return 'Closed';
    if (status === 'flagged') return 'Removed';
    if (status === 'cancelled') return 'Cancelled';
    return 'Updated';
  }

  function quoteStatusLabel(status) {
    if (status === 'accepted') return 'Accepted';
    if (status === 'not_selected') return 'Not accepted';
    if (status === 'submitted') return 'Quote in';
    return 'Updated';
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function tokenRand() { return num(settings.token_rand) || 20; }
  function vipFree() { return num(settings.vip_free_tokens) || 5; }
  function vipPrice() {
    const p = settings.vip_price || {};
    return { yearly: num(p.yearly) || 9999, monthly: num(p.monthly) || 999 };
  }
  function hours() { return num(CFG.EFT_CREDIT_HOURS) || 24; }
  function auctionHours() { return num(settings.auction_hours) || 12; }
  function winnerPlaces() { return num(settings.places) || 3; }

  function looksLikePlaceholder(value) {
    const raw = String(value || '').trim();
    if (!raw) return true;
    if (/^(your|placeholder|tbc|todo|coming soon)\b/i.test(raw)) return true;
    if (/^0+$/.test(raw.replace(/\s+/g, ''))) return true;
    return false;
  }

  function bankDetailsReady() {
    return !looksLikePlaceholder(CFG.EFT_ACCOUNT_NAME)
      && !looksLikePlaceholder(CFG.EFT_BANK)
      && !looksLikePlaceholder(CFG.EFT_ACCOUNT_NO)
      && !looksLikePlaceholder(CFG.EFT_BRANCH);
  }

  function bankDetailsBlock() {
    if (bankDetailsReady()) {
      return '<p>Account name: ' + esc(CFG.EFT_ACCOUNT_NAME) + '</p>' +
        '<p>Bank: ' + esc(CFG.EFT_BANK) + '</p>' +
        '<p>Account: ' + esc(CFG.EFT_ACCOUNT_NO) + '</p>' +
        '<p>Branch: ' + esc(CFG.EFT_BRANCH) + '</p>';
    }
    return '<div class="bank-pending" data-testid="bank-pending">' +
      '<p><strong>Bank details coming soon.</strong></p>' +
      '<p>We are still opening the account, so there is no account number to pay into yet. Your payment reference is ready and will not change. As soon as the account is published, it will show here: the account name, the bank, and the account number.</p>' +
      '<p>Nothing is taken from your bank by this website. You will pay by EFT yourself.</p></div>';
  }

  function isVip(p) {
    return !!(p && p.vip_until && new Date(p.vip_until).getTime() > Date.now());
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function left(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    const when = fmtWhen(iso);
    if (!Number.isFinite(ms) || ms <= 0) return 'Bidding closed ' + when;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h + 'h ' + m + 'm left · closes ' + when;
  }

  function roleLabel(role) {
    if (role === 'contractor') return 'Contractor';
    if (role === 'admin') return 'Admin';
    if (role === 'client') return 'Client';
    return 'Guest';
  }

  function bits() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    return raw.split('?')[0].split('/').filter(Boolean);
  }

  function toast(text) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    try {
      let maxEdge = 1280;
      let quality = 0.72;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', quality); });
        if (blob && blob.size <= 200 * 1024) return blob;
        quality = Math.max(0.45, quality - 0.08);
        maxEdge = Math.round(maxEdge * 0.85);
      }
    } finally {
      if (bitmap.close) bitmap.close();
    }
    throw new Error('Photo is still too large after compression. Try a smaller picture.');
  }

  window.MQApp = { compressImage: compressImage, configured: configured };

  function payFor(amount) {
    const vip = isVip(profile);
    const free = vipFree();
    const due = vip ? Math.max(0, amount - free) : amount;
    const covered = vip ? Math.min(amount, free) : 0;
    return { due: due, covered: covered, vip: vip, rand: tokenRand() };
  }

  function bidSentence(amount) {
    const pay = payFor(amount);
    let cost;
    if (pay.vip && pay.due === 0) cost = 'VIP cover, no charge.';
    else if (pay.vip) {
      cost = 'VIP covers ' + plural(pay.covered, 'token') + '. You pay ' + plural(pay.due, 'token') + ' (' + formatR(pay.due * pay.rand) + ').';
    } else cost = 'That is ' + formatR(amount * pay.rand) + '.';
    return 'Bid ' + plural(amount, 'token') + '. ' + cost +
      ' You only pay if you finish in the top ' + winnerPlaces() + '. If you leave the top ' + winnerPlaces() + ', the held tokens are released.';
  }

  function bidLimits(preview) {
    const min = Math.max(1, num(preview && preview.min) || 1);
    const due = num(preview && preview.due);
    const extra = num(preview && preview.extra);
    const available = num(profile && profile.token_available);
    const free = preview && preview.vip ? vipFree() : 0;
    const max = due + available - extra + free;
    return { min: min, max: max, can: extra <= available && max >= min, available: available };
  }

  function waDigits(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('0')) d = '27' + d.slice(1);
    if (d && d.indexOf('27') !== 0) d = '27' + d;
    return d;
  }

  function waChat(phone, text) {
    const d = waDigits(phone);
    if (!d) return '';
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function shareUrl(code) {
    return location.origin + location.pathname + '#/p/' + encodeURIComponent(code || '');
  }

  function waShare(p) {
    const text = (p.business_name || p.full_name || 'A contractor') + ' on Multiquoters: ' + shareUrl(p.user_code);
    return 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function friendlyAuthError(message) {
    const text = String(message || '');
    if (/email/i.test(text) && /invalid|unable to validate/i.test(text)) {
      return 'Enter a valid email address, such as name@example.com.';
    }
    return text || 'Something went wrong. Try again.';
  }

  function rpcFail(res) {
    if (!res) return 'Something went wrong';
    if (res.error) return res.error.message || 'Something went wrong';
    if (res.data && res.data.ok === false) return res.data.error || 'Something went wrong';
    return '';
  }

  function paintChrome() {
    const b = bits();
    const here = '/' + b.join('/');
    const logged = !!(session && profile);
    const role = profile && profile.role;
    viewing.hidden = true;
    topActions.innerHTML =
      (logged ? '<span class="role-chip" data-testid="role-chip">' + esc(roleLabel(role)) + '</span>' : '<a href="../">Try the demo</a>') +
      (logged ? '<button type="button" class="linkish" data-action="sign-out">Sign out</button>' : '');
    const links = [];
    if (!logged) {
      links.push(['#/', 'Home'], ['#/pricing', 'Pricing'], ['#/trust', 'Trust & safety']);
      if (configured()) links.push(['#/signin', 'Sign in']);
    } else if (role === 'contractor') {
      links.push(['#/contractor/leads', 'Leads'], ['#/contractor/wallet', 'Wallet'], ['#/contractor/vip', 'VIP'], ['#/contractor/profile', 'Profile'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')]);
    } else if (role === 'admin') {
      links.push(['#/admin', 'Admin'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')], ['#/pricing', 'Pricing']);
    } else {
      links.push(['#/client/requests', 'Requests'], ['#/client/new', 'Post a job'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')], ['#/pricing', 'Pricing']);
    }
    const html = links.map(function (pair) {
      const on = pair[0] === '#/' + (b[0] ? b.join('/') : '') || (pair[0] === '#/' && !b.length) || (pair[0] !== '#/' && here.indexOf(pair[0].slice(1)) === 0 && pair[0] !== '#/pricing' && pair[0] !== '#/trust');
      const exact = pair[0] === '#/' ? !b.length : here === pair[0].slice(1) || here.indexOf(pair[0].slice(1) + '/') === 0;
      return '<a href="' + pair[0] + '"' + (exact ? ' class="is-on"' : '') + '>' + esc(pair[1]) + '</a>';
    }).join('');
    subnav.innerHTML = html;
    const bottomLinks = links.filter(function (pair) {
      if (!logged) return true;
      if (pair[0].indexOf('#/trust') === 0) return false;
      if (role !== 'client' && pair[0].indexOf('#/pricing') === 0) return false;
      return true;
    });
    bottom.innerHTML = bottomLinks.map(function (pair) {
      const exact = here === pair[0].slice(1) || here.indexOf(pair[0].slice(1) + '/') === 0;
      return '<a href="' + pair[0] + '"' + (exact ? ' class="is-on"' : '') + '>' + esc(pair[1].replace(/ \(.*\)/, '')) + '</a>';
    }).join('');
  }

  function offlineCard() {
    return '<section class="card stack offline" data-screen="offline">' +
      '<p><span class="draft-flag">Not connected</span></p>' +
      '<h1>Backend not connected yet</h1>' +
      '<p class="lede">This is the real Multiquoters app. Accounts, photos, bids and tokens live in a free Supabase project. Those keys are not in config.js yet, so nothing on this page can be saved.</p>' +
      '<p>You can still read how pricing, privacy and the rules work. The clickable sample, with pretend tokens, is the demo.</p>' +
      '<a class="btn btn-teal" data-testid="try-demo" href="../">Try the demo</a>' +
      '<div class="row"><a class="btn btn-ghost" href="#/pricing">Pricing & fees</a><a class="btn btn-ghost" href="#/trust">Trust & safety</a></div>' +
      '<div class="row"><a href="#/privacy">Privacy (draft)</a><a href="#/terms">Terms (draft)</a></div>' +
      '</section>';
  }

  function howBlocks() {
    const hours = auctionHours();
    const places = winnerPlaces();
    return '<div class="how-grid">' +
      '<article class="card"><h2>For clients</h2><ol>' +
      '<li>Post the job once: trade, photos, where and when.</li>' +
      '<li>Contractors bid tokens for ' + plural(hours, 'hour') + '. The top ' + places + ' each pay their own bid and can send a quote.</li>' +
      '<li>Compare up to ' + places + ' quotes side by side, then accept one. The others are closed.</li>' +
      '<li>Message the contractor you accept here, or on WhatsApp. Your number stays hidden until bidding ends.</li>' +
      '</ol></article>' +
      '<article class="card"><h2>For contractors</h2><ol>' +
      '<li>Sign up, add your trades and areas, and upload your ID and trade certificate.</li>' +
      '<li>An admin checks them. You can browse leads before that, and bid after you are verified.</li>' +
      '<li>The minimum bid is 1 token. Tokens are held, and released if you finish outside the top ' + places + '.</li>' +
      '<li>If you finish in the top ' + places + ', send one quote with line items. You then get the client’s number.</li>' +
      '</ol></article></div>' +
      '<p class="promise-line">You pay tokens only if you finish in the top ' + places + '. VIP covers bids up to 5 tokens on a lead. VIP can’t buy unlimited bids.</p>';
  }

  function pagePricing() {
    const price = vipPrice();
    const places = winnerPlaces();
    const auction = auctionHours();
    return '<h1>Pricing & fees</h1>' +
      '<p class="lede">1 token = ' + formatR(tokenRand()) + '. A lead opens at a minimum bid of 1 token. The top ' + places + ' each pay their own bid. Everyone else gets their tokens back.</p>' +
      '<div class="pack-grid">' +
      PAY.packs.map(function (pack) {
        return '<article class="card pack"><p class="rand">' + formatR(pack.rand) + '</p><p>' + plural(pack.tokens, 'token') + '</p></article>';
      }).join('') +
      '</div>' +
      '<article class="card"><h2>How a bid works</h2><ul>' +
      '<li>While fewer than ' + places + ' contractors have bid, the minimum bid is 1 token.</li>' +
      '<li>Once ' + places + ' have bid, the minimum bid is the lowest of those bids plus 1 token. That is the bid to beat.</li>' +
      '<li>If you are already in the top ' + places + ', your next bid is your own bid plus 1 token.</li>' +
      '<li>If two bids are equal, the earlier one stays ahead.</li>' +
      '<li>Bidding runs for ' + plural(auction, 'hour') + '. The lead page shows the clock and the exact closing time.</li>' +
      '<li>If nobody bids, bidding is extended by another ' + plural(auction, 'hour') + '. That can happen twice, then the job closes.</li>' +
      '<li>If fewer than ' + places + ' contractors bid, everyone who bid finishes in the top ' + places + ' and can send a quote.</li>' +
      '</ul>' +
      '<h3>Example</h3>' +
      '<p>The lead opens at 1 token. Thandi bids 1, Sipho bids 1, and Lerato bids 2. If bidding ends there, all three are in the top ' + places + ' and each pays their own bid: Lerato 2 tokens (' + formatR(2 * tokenRand()) + '), Thandi 1 token (' + formatR(tokenRand()) + '), Sipho 1 token (' + formatR(tokenRand()) + '). A fourth contractor has to bid at least 2 tokens to take Sipho’s place, because Sipho bid later than Thandi. Sipho’s token is released.</p>' +
      '<p>You only pay if you are still in the top ' + places + ' when bidding ends. A higher bid releases your tokens.</p></article>' +
      '<article class="card vip-offer"><h2>VIP membership</h2>' +
      '<p class="price">' + formatR(price.yearly) + ' a year <span class="muted">or ' + formatR(price.monthly) + ' a month</span></p>' +
      '<ul>' +
      '<li>VIP covers up to 5 tokens on a lead. That part is no charge.</li>' +
      '<li>Above 5, you pay the difference. A bid of 7 tokens charges 2 tokens.</li>' +
      '<li>Your wallet shows the covered part as VIP cover, no charge.</li>' +
      '<li>VIP alerts go out 15 minutes earlier. The lead is not hidden from anyone else.</li>' +
      '<li>VIP can’t buy unlimited bids. That keeps bidding fair.</li>' +
      '</ul></article>' +
      '<article class="card"><h2>Paying</h2>' +
      '<p class="eft">Pay by EFT. Tokens are added within ' + plural(hours(), 'hour') + ' of the payment showing in our account. Use your user code as the reference, for example MQ-1A2B3C4D. Card payments are not switched on. Nothing is taken from your bank by this website.</p>' +
      bankDetailsBlock() + '</article>';
  }

  function pageTrust() {
    return '<h1>Trust & safety</h1>' +
      '<article class="card"><h2>What “verified” means</h2>' +
      '<p>Verified means an admin has looked at the contractor’s ID and trade certificate. It is a manual check, not a guarantee of the work, the price, or insurance.</p></article>' +
      '<article class="card"><h2>Who sees your details</h2><ul>' +
      '<li>Clients see a lead’s suburb and description. The phone number is stored separately.</li>' +
      '<li>During bidding, contractors see stable anonymous labels (Contractor A, B, C). The same person keeps the same letter.</li>' +
      '<li>Only the top ' + winnerPlaces() + ' see the client’s number and the full photos, and only so they can quote.</li>' +
      '<li>After you accept a quote, the other contractors no longer see your number.</li>' +
      '<li>ID and certificates sit in a private folder. Other contractors cannot open them.</li>' +
      '<li>You can leave one review, and only after you accept a quote.</li>' +
      '</ul></article>' +
      '<article class="card"><h2>Fake leads</h2>' +
      '<p>An admin can flag a lead that is not a real job. It leaves the feed and any held tokens are released.</p></article>';
  }

  function pagePrivacy() {
    return '<h1>Privacy notice</h1><p data-testid="draft-banner"><span class="draft-flag">DRAFT</span> This notice has not been reviewed by a lawyer. It is here so the owner can see the shape of a POPIA notice before publishing a final one.</p>' +
      '<article class="card stack"><h2>Who we are</h2><p>Multiquoters helps a client ask for a quote and helps contractors bid for the chance to quote. The operator is the person who owns this site. Put the legal name and email address here before you rely on this text.</p>' +
      '<h2>What we collect</h2><ul>' +
      '<li>Account: email address, the role you choose, your name, and (for contractors) business name, phone, trades and areas.</li>' +
      '<li>A job: description, suburb, photos, and the client’s name and phone. The phone is not shown on the public lead.</li>' +
      '<li>Verification: a photo of an ID and a trade certificate, for contractors. An admin reviews them.</li>' +
      '<li>Bids, token balances, quotes, messages and reviews.</li>' +
      '</ul>' +
      '<h2>Why</h2><p>To run the auction, to show a client up to three quotes, to let the top 3 contact the client, and to keep a record of token holds and releases. The legal bases to describe in the final notice are consent (the photos and ID you upload) and the contract (running the lead you asked for).</p>' +
      '<h2>Who we share it with</h2><ul>' +
      '<li>Contractors in the top ' + winnerPlaces() + ' receive the client’s name and phone so they can quote. After one quote is accepted, the others no longer see that number.</li>' +
      '<li>The client receives the name and phone of the contractors in the top ' + winnerPlaces() + '. After one quote is accepted, only that contractor’s number stays available.</li>' +
      '<li>Admins can see verification files, leads and token grants.</li>' +
      '<li>The database is hosted by Supabase. Photos are stored there in private buckets.</li>' +
      '<li>WhatsApp opens only if you tap a WhatsApp link. We do not run a WhatsApp bot.</li>' +
      '</ul>' +
      '<h2>How long</h2><p>Keep job records while the quote is being decided and for a reasonable period afterwards so there is a record of who was in the top 3 and which quote was accepted. Say the exact period in the final notice. You can ask for a copy, a correction, or deletion, subject to records we must keep.</p>' +
      '<h2>Your rights</h2><p>Under POPIA you can ask what we hold, ask for a correction, object, or complain to the Information Regulator. Contact details for the operator go here.</p></article>';
  }

  function pageTerms() {
    return '<h1>Terms of use</h1><p data-testid="draft-banner"><span class="draft-flag">DRAFT</span> These terms have not been reviewed by a lawyer. Do not treat them as the final contract.</p>' +
      '<article class="card"><ul>' +
      '<li>Multiquoters introduces a client and up to three contractors. The building work, if any, is a contract between them. Multiquoters is not the contractor.</li>' +
      '<li>1 token is ' + formatR(tokenRand()) + '. Tokens are held when you bid and spent only if you finish in the top ' + winnerPlaces() + '. If you are outbid, the hold is released.</li>' +
      '<li>VIP is ' + formatR(vipPrice().yearly) + ' a year or ' + formatR(vipPrice().monthly) + ' a month. It covers up to 5 tokens on a lead. It does not buy unlimited bids.</li>' +
      '<li>Paying is by EFT for now. Tokens or VIP are credited by an admin after the payment arrives, aimed within ' + hours() + ' hours. Use your user code as the reference. The site does not take card payments yet.</li>' +
      '<li>A quote you accept is between you and that contractor. Check the price, what is included, VAT, and the timeline yourself.</li>' +
      '<li>Do not post a lead that is not a real job. Admins may remove it.</li>' +
      '<li>Do not upload someone else’s ID. Verification files are for the admin check only.</li>' +
      '</ul></article>';
  }

  function pageHome() {
    if (!configured()) return offlineCard() + '<h2>How it works</h2>' + howBlocks();
    const postHref = profile && profile.role === 'contractor' ? '#/contractor/leads' : '#/client/new';
    const postLabel = profile && profile.role === 'contractor' ? 'See leads' : 'Post a job';
    return '<section class="hero-grid"><div><h1>Post a job once. Compare up to three quotes.</h1>' +
      '<p class="lede">Contractors in your area bid tokens for the lead. The top ' + winnerPlaces() + ' pay their own bids and send quotes. Your phone number stays hidden until then.</p>' +
      '<div class="row">' +
      (profile ? '' : '<a class="btn btn-teal" href="#/signup">Create an account</a>') +
      '<a class="btn btn-orange" href="' + postHref + '">' + postLabel + '</a></div>' +
      (profile ? '' : '<p class="tiny">Prefer to click around with pretend money first? <a href="../">Try the demo</a>.</p>') +
      '</div>' +
      '<article class="card" data-testid="settings-glance"><h2>At a glance</h2>' +
      '<p data-testid="token-price">1 token = ' + formatR(tokenRand()) + '.</p>' +
      '<p data-testid="auction-hours">Bidding lasts ' + plural(auctionHours(), 'hour') + '.</p>' +
      '<p data-testid="winners">Top ' + winnerPlaces() + ', each pays their own bid.</p>' +
      '<p data-testid="vip-price">VIP: ' + formatR(vipPrice().yearly) + ' a year or ' + formatR(vipPrice().monthly) + ' a month.</p></article></section>' +
      '<h2>How it works</h2>' + howBlocks();
  }

  function authForm(mode) {
    if (!configured()) return offlineCard();
    const signup = mode === 'signup';
    return '<h1>' + (signup ? 'Create an account' : 'Sign in') + '</h1>' +
      (signup ? '' : '<p class="lede">Use the email and password on your account.</p>') +
      '<form class="card stack" novalidate data-form="' + (signup ? 'signup' : 'signin') + '">' +
      (signup ? '<label class="field">Your name<input name="full_name" required autocomplete="name"></label>' +
        '<fieldset class="stack"><legend class="field-label">I am a</legend>' +
        '<label class="choice"><input type="radio" name="role" value="client" checked> Client — I need a quote</label>' +
        '<label class="choice"><input type="radio" name="role" value="contractor"> Contractor — I want leads</label></fieldset>' : '') +
      '<label class="field">Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label class="field">Password' +
      '<input name="password" type="password" required minlength="6" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" aria-describedby="password-rule">' +
      '<span class="tiny" id="password-rule">At least 6 characters.</span></label>' +
      (signup ? '<div class="choice consent-row"><input id="terms-consent" type="checkbox" name="terms" required data-testid="terms-consent">' +
        '<label for="terms-consent">I agree to the terms and the privacy notice.</label></div>' +
        '<p class="tiny"><a href="#/terms">Read the terms</a> · <a href="#/privacy">Read the privacy notice</a></p>' : '') +
      '<button class="btn btn-teal" type="submit">' + (signup ? 'Create account' : 'Sign in') + '</button>' +
      (signup ? '' : '<button class="btn btn-ghost" type="button" data-action="magic">Email me a sign-in link</button>') +
      '<p class="tiny">' + (signup
        ? 'Already registered? <a href="#/signin">Sign in</a>'
        : 'New here? <a href="#/signup">Create an account</a> · <a href="#/forgot" data-testid="forgot-password">Forgot password</a>') +
      '</p>' +
      '<p class="form-error" data-error></p></form>';
  }

  function pageForgot() {
    if (!configured()) return offlineCard();
    return '<h1>Reset your password</h1>' +
      '<p class="lede">We will email you a link. It opens this same app, where you can choose a new password.</p>' +
      '<form class="card stack" novalidate data-form="forgot">' +
      '<label class="field">Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<button class="btn btn-teal" type="submit">Send reset link</button>' +
      '<p class="tiny"><a href="#/signin">Back to sign in</a></p>' +
      '<p class="form-error" data-error></p></form>';
  }

  function pageNewPassword() {
    if (!configured()) return offlineCard();
    if (!session) {
      return '<h1>Choose a new password</h1><article class="card stack">' +
        '<p>Open the link in your reset email, then choose a new password here.</p>' +
        '<a class="btn btn-teal" href="#/forgot">Send a new link</a></article>';
    }
    return '<h1>Choose a new password</h1>' +
      '<form class="card stack" data-form="new-password">' +
      '<label class="field">New password<input name="password" type="password" required minlength="6" autocomplete="new-password">' +
      '<span class="tiny">At least 6 characters.</span></label>' +
      '<button class="btn btn-teal" type="submit">Save password</button>' +
      '<p class="form-error" data-error></p></form>';
  }

  function pagePostGate() {
    return '<h1>Post a job</h1>' +
      '<article class="card stack" data-testid="post-gate">' +
      '<p>Sign up or sign in to post your job. It takes a minute, and your phone number stays hidden until bidding ends.</p>' +
      '<div class="row"><a class="btn btn-teal" href="#/signup">Create an account</a>' +
      '<a class="btn btn-ghost" href="#/signin">Sign in</a></div></article>';
  }

  function pageOnboarding() {
    return '<h1>Set up your business</h1><p class="lede">Choose the work you do and where you travel. Then upload an ID and a trade certificate. An admin checks them before you can bid.</p>' +
      '<form class="card stack" data-form="onboarding">' +
      '<label class="field">Business name<input name="business_name" value="' + esc(profile.business_name || '') + '" required></label>' +
      '<label class="field">Your name<input name="full_name" value="' + esc(profile.full_name || '') + '" required></label>' +
      '<label class="field">Phone<input name="phone" value="' + esc(profile.phone || '') + '" required inputmode="tel"></label>' +
      '<p class="field-label">Trades</p><div class="checks">' +
      TRADES.map(function (t) {
        const on = (profile.trades || []).indexOf(t) >= 0;
        return '<label class="choice"><input type="checkbox" name="trade" value="' + esc(t) + '"' + (on ? ' checked' : '') + '> ' + esc(t) + '</label>';
      }).join('') + '</div>' +
      '<p class="field-label">Areas</p><div class="checks">' +
      AREAS.map(function (t) {
        const on = (profile.areas || []).indexOf(t) >= 0;
        return '<label class="choice"><input type="checkbox" name="area" value="' + esc(t) + '"' + (on ? ' checked' : '') + '> ' + esc(t) + '</label>';
      }).join('') + '</div>' +
      '<label class="choice"><input type="checkbox" name="vat"' + (profile.vat_registered ? ' checked' : '') + '> VAT registered</label>' +
      '<label class="field">ID document<input name="id_doc" type="file" accept="image/*"></label>' +
      '<label class="field">Trade certificate<input name="cert_doc" type="file" accept="image/*"></label>' +
      '<button class="btn btn-teal" type="submit">Save</button><p class="form-error" data-error></p></form>';
  }

  function pageWizard() {
    const step = wizard.step;
    const total = 4;
    const titles = ['', 'What needs doing?', 'Add photos', 'Describe the job', 'Check and post'];
    let body = '';
    if (step === 1) {
      body = '<div class="trade-grid" data-field="trade">' + TRADES.map(function (t) {
        return '<button type="button" class="trade' + (wizard.trade === t ? ' is-on' : '') + '" data-action="pick-trade" data-trade="' + esc(t) + '"><strong>' + esc(t) + '</strong><small>' + esc(TRADE_HINTS[t] || '') + '</small></button>';
      }).join('') + '</div><p class="field-error" data-field-error="trade"></p>';
    } else if (step === 2) {
      const count = wizard.files.length;
      body = '<label class="field">Photos<input name="photos" type="file" accept="image/*" multiple></label>' +
        '<p class="tiny" data-photo-hint>' + (count
          ? plural(count, 'photo') + ' selected. Each one is reduced to about 200KB before upload.'
          : 'Optional. A photo helps contractors judge the job. We shrink each one to about 200KB.') + '</p>';
    } else if (step === 3) {
      body = '<p class="notice">Your name, phone and private note are shown only to contractors in the top ' + winnerPlaces() + ', after bidding ends.</p>' +
        '<label class="field">Short title<input name="title" value="' + esc(wizard.title) + '" required></label>' +
        '<label class="field">What happened?<textarea name="description" rows="4">' + esc(wizard.description) + '</textarea></label>' +
        '<label class="field">Area<select name="area"><option value="">Choose area</option>' + AREAS.map(function (a) {
          return '<option value="' + esc(a) + '"' + (a === wizard.area ? ' selected' : '') + '>' + esc(a) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field">Suburb<input name="suburb" value="' + esc(wizard.suburb) + '" required></label>' +
        '<label class="field">When do you need it?<select name="when"><option value="">Choose when</option>' + WHEN_OPTIONS.map(function (w) {
          return '<option value="' + esc(w) + '"' + (w === wizard.when ? ' selected' : '') + '>' + esc(w) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field">Contact name<input name="contact_name" value="' + esc(wizard.contact_name || (profile && profile.full_name) || '') + '" required></label>' +
        '<label class="field">Phone<input name="phone" value="' + esc(wizard.phone || '') + '" required inputmode="tel" autocomplete="tel"></label>' +
        '<label class="field">Private note<textarea name="note" rows="3" placeholder="Gate code, pets, anything the contractor should know">' + esc(wizard.note) + '</textarea></label>';
    } else {
      body = '<dl class="review-list">' +
        '<div><dt>Trade</dt><dd>' + esc(wizard.trade) + '</dd></div>' +
        '<div><dt>Title</dt><dd>' + esc(wizard.title) + '</dd></div>' +
        '<div><dt>Description</dt><dd>' + esc(wizard.description || '—') + '</dd></div>' +
        '<div><dt>Where</dt><dd>' + esc(wizard.suburb) + ', ' + esc(wizard.area) + '</dd></div>' +
        '<div><dt>When</dt><dd>' + esc(wizard.when || '—') + '</dd></div>' +
        '<div><dt>Contact</dt><dd>' + esc(wizard.contact_name) + ' · ' + esc(wizard.phone) + '</dd></div>' +
        '<div><dt>Private note</dt><dd>' + esc(wizard.note || 'None') + '</dd></div>' +
        '<div><dt>Photos</dt><dd>' + (wizard.files.length ? plural(wizard.files.length, 'photo') : 'None') + '</dd></div></dl>' +
        '<p class="tiny">Bidding lasts ' + plural(auctionHours(), 'hour') + '. Up to ' + winnerPlaces() + ' contractors can send a quote. Your phone stays hidden until then.</p>';
    }
    return '<h1>Post a job</h1><p class="tiny">Step ' + step + ' of ' + total + '</p>' +
      '<div class="progress" aria-hidden="true"><span style="width:' + (step / total * 100) + '%"></span></div>' +
      '<h2>' + titles[step] + '</h2><div class="card stack" id="wizard">' + body +
      '<div class="row">' +
      (step > 1 ? '<button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>' : '') +
      '<button type="button" class="btn btn-teal" data-action="wizard-next">' + (step === total ? 'Post a job' : 'Next') + '</button></div>' +
      '<p class="form-error" data-error></p></div>';
  }

  function timeline(status, reviewed) {
    const steps = [
      ['posted', 'Posted'],
      ['bidding', 'Bidding'],
      ['due', 'Quotes due'],
      ['in', 'Quotes in'],
      ['accepted', reviewed ? 'Completed' : 'Accepted']
    ];
    const current = status === 'open' ? 'bidding'
      : status === 'matched' ? 'due'
      : status === 'quoting' ? 'in'
      : (status === 'accepted' ? 'accepted' : 'posted');
    const idx = { posted: 0, bidding: 1, due: 2, in: 3, accepted: 4 }[current];
    return '<ol class="timeline" data-testid="status-tracker">' + steps.map(function (s, i) {
      const cls = i < idx ? 'done' : (i === idx ? 'current' : '');
      return '<li class="' + cls + '"><span>' + (i + 1) + '</span>' + s[1] + '</li>';
    }).join('') + '</ol>';
  }

  function earlyNote(job) {
    if (!profile || profile.role !== 'contractor' || !isVip(profile)) return '';
    const age = Date.now() - new Date(job.created_at).getTime();
    if (!(age >= 0 && age < 15 * 60 * 1000)) return '';
    return '<p class="early" data-testid="vip-early">You were told about this lead when it was posted. Every matching contractor can bid.</p>';
  }

  function boardHtml(rows) {
    const list = rows || [];
    const places = winnerPlaces();
    const inPlay = list.filter(function (row) { return row.place <= places; });
    const showBeat = inPlay.length >= places;
    if (!list.length) return '<li class="open-slot">No bids yet.</li>';
    const rowsHtml = list.map(function (row) {
      const beat = showBeat && row.place === places;
      const name = row.anon || row.label;
      return '<li class="' + (beat ? 'beat' : '') + (row.is_you ? ' is-you' : '') + '"><span>' +
        esc(name) + (row.is_you ? ' <span class="you-tag">You</span>' : '') +
        (row.vip ? ' <span class="vip-badge">VIP member</span>' : '') +
        '</span><strong>' + plural(row.amount, 'token') + '</strong></li>';
    }).join('');
    const legend = showBeat
      ? '<li class="bid-legend">Orange outline: the lowest bid in the top ' + places + '. A new bid has to be higher than this one.</li>'
      : '';
    return rowsHtml + legend;
  }

  function standingText(job, mine, board, won, myQuote) {
    const places = winnerPlaces();
    const inPlay = (board || []).filter(function (row) { return row.place <= places; }).length;
    if (job.status === 'accepted') {
      if (myQuote && myQuote.status === 'accepted') return { text: 'Quote accepted', cls: 'in' };
      if (won) return { text: 'Another quote was accepted', cls: 'out' };
    }
    if (won) return { text: 'You’re in the top ' + places + '. Send your quote.', cls: 'in' };
    if (job.status !== 'open' && mine) return { text: 'You didn’t make the top ' + places + '.', cls: 'out' };
    if (job.status !== 'open') return { text: jobStatusLabel(job.status), cls: 'none' };
    if (!mine) return { text: 'You have not bid yet.', cls: 'none' };
    if (mine.place <= places && inPlay < places) {
      return { text: 'You’re ' + ordinal(mine.place) + ' of ' + inPlay + '.', cls: 'in' };
    }
    if (mine.place <= places) return { text: 'You’re ' + ordinal(mine.place) + ' of ' + places + '.', cls: 'in' };
    return { text: 'You’re ' + ordinal(mine.place) + '. You’re outside the top ' + places + '.', cls: 'out' };
  }

  async function signedPhotos(rows) {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const path = rows[i].storage_path;
      const signed = await sb.storage.from('job-photos').createSignedUrl(path, 60 * 30);
      if (signed.data && signed.data.signedUrl) out.push(signed.data.signedUrl);
    }
    return out;
  }

  function photoHtml(urls) {
    if (!urls.length) return '<p class="tiny">No photos yet.</p>';
    return '<div class="thumbs">' + urls.map(function (src) {
      return '<button type="button" class="thumb" data-action="zoom-photo" data-src="' + esc(src) + '" aria-label="Enlarge photo">' +
        '<span class="thumb-loading" aria-hidden="true"></span>' +
        '<img src="' + esc(src) + '" alt="Job photo">' +
        '</button>';
    }).join('') + '</div>';
  }

  function quoteItemsFor(all, quoteId) {
    return (all || []).filter(function (item) { return item.quote_id === quoteId; })
      .sort(function (a, b) { return (num(a.position) - num(b.position)) || String(a.label).localeCompare(String(b.label)); });
  }

  function quoteTotal(q, items) {
    if (items && items.length) return items.reduce(function (sum, item) { return sum + num(item.rand); }, 0);
    return num(q.materials_rand) + num(q.labour_rand) + num(q.callout_rand) + num(q.other_rand);
  }

  function lineText(item) {
    const qty = Number(item.qty);
    const unit = num(item.unit_rand);
    const total = formatR(item.rand);
    if (unit > 0 && qty) return esc(item.label) + ' · ' + qty + ' × ' + formatR(unit) + ' = ' + total;
    return esc(item.label) + ' · ' + total;
  }

  function lineList(items) {
    if (!items.length) return '<p class="tiny">No line items.</p>';
    return '<ul class="line-list">' + items.map(function (item) { return '<li>' + lineText(item) + '</li>'; }).join('') + '</ul>';
  }

  async function pageRequests() {
    const res = await sb.from('job_requests').select('*').order('created_at', { ascending: false });
    if (res.error) return '<p class="form-error">' + esc(res.error.message) + '</p>';
    const jobs = res.data || [];
    const reviewed = {};
    const rev = await sb.from('reviews').select('job_id').eq('client_id', profile.id);
    (rev.data || []).forEach(function (row) { reviewed[row.job_id] = true; });
    if (!jobs.length) return '<h1>Your requests</h1><article class="card"><p>No jobs yet.</p><a class="btn btn-teal" href="#/client/new">Post a job</a></article>';
    return '<div class="between"><h1>Your requests</h1><a class="btn btn-teal btn-small" href="#/client/new">Post a job</a></div>' +
      '<div class="stack">' + jobs.map(function (job) {
        return '<a class="card glance-main" href="#/client/request/' + job.id + '"><strong>' + esc(job.title) + '</strong>' +
          '<p class="tiny">' + esc(jobRef(job.id)) + ' · ' + esc(job.suburb) + ' · ' + esc(jobStatusLabel(job.status, reviewed[job.id])) + '</p>' +
          '<p class="tiny">' + esc(left(job.auction_ends_at)) + '</p></a>';
      }).join('') + '</div>';
  }

  function threadPeople(contacts, quotes, cards) {
    const people = [];
    const seen = {};
    (contacts || []).forEach(function (c) {
      if (c.who !== 'contractor' || !c.person_id || seen[c.person_id]) return;
      seen[c.person_id] = true;
      people.push({ id: c.person_id, name: c.business_name || c.name || 'Contractor' });
    });
    (quotes || []).forEach(function (q) {
      if (!q.contractor_id || seen[q.contractor_id]) return;
      seen[q.contractor_id] = true;
      const card = (cards || []).filter(function (c) { return c.id === q.contractor_id; })[0] || {};
      people.push({ id: q.contractor_id, name: card.business_name || card.full_name || 'Contractor' });
    });
    return people;
  }

  function messageBubble(m, mine, name) {
    return '<div class="msg' + (mine ? ' mine' : ' theirs') + '" data-id="' + esc(m.id || '') + '">' +
      '<p class="msg-who">' + (mine ? 'You' : esc(name)) + '</p>' +
      '<p class="msg-body">' + esc(m.body) + '</p>' +
      '<p class="msg-time">' + esc(m.pending ? 'Sending…' : fmtWhen(m.created_at)) + '</p></div>';
  }

  function messageThreads(job, people, messages, acceptedId) {
    const openJob = job.status === 'matched' || job.status === 'quoting';
    if (!people.length) return '';
    return '<h2>Messages</h2>' + people.map(function (person) {
      const rows = (messages || []).filter(function (m) { return m.contractor_id === person.id; });
      const canPost = openJob || (job.status === 'accepted' && person.id === acceptedId);
      const body = rows.map(function (m) {
        const mine = m.sender_id === profile.id;
        return messageBubble(m, mine, person.name);
      }).join('');
      return '<article class="card thread"><h3>' + esc(person.name) + '</h3>' +
        (body || '<p class="tiny">No messages yet.</p>') +
        (canPost
          ? '<form class="stack" data-form="message" data-id="' + job.id + '" data-contractor="' + person.id + '"><label class="field">Message<textarea name="body" required></textarea></label><button class="btn btn-teal" type="submit">Send</button><p class="form-error" data-error></p></form>'
          : '<p class="tiny">This conversation is closed.</p>') +
        '</article>';
    }).join('');
  }

  function comparisonTable(priced) {
    if (!priced.length) return '';
    priced = priced.slice().sort(function (a, b) {
      return a.total - b.total || String(a.q.id).localeCompare(String(b.q.id));
    });
    const head = '<tr><th class="row-label"></th>' + priced.map(function (row) {
      const name = row.card.business_name || row.card.full_name || 'Contractor';
      return '<th>' + esc(name) +
        (row.card.verified ? ' <span class="pill pill-good">Verified</span>' : '') +
        (row.card.vip ? ' <span class="vip-badge">VIP member</span>' : '') +
        '</th>';
    }).join('') + '</tr>';
    function cells(fn) {
      return priced.map(function (row) { return '<td>' + fn(row) + '</td>'; }).join('');
    }
    const rows = [
      ['Rating', function (row) {
        if (!row.ratingCount) return 'No reviews yet';
        return '<span class="stars">' + stars(row.rating) + '</span> ' + row.rating.toFixed(1) +
          ' · ' + plural(row.ratingCount, 'review') +
          (row.reviewSnippet ? '<br><span class="tiny">' + esc(row.reviewSnippet) + '</span>' : '');
      }],
      ['Line items', function (row) { return lineList(row.items); }],
      ['Included', function (row) { return esc(row.q.included || '—'); }],
      ['Excluded', function (row) { return esc(row.q.excluded || '—'); }],
      ['Timeline', function (row) { return esc(row.q.timeline || '—'); }],
      ['Valid until', function (row) { return esc(fmtDate(row.q.valid_until) || row.q.valid_until || '—'); }],
      ['VAT', function (row) { return row.q.vat_registered ? 'VAT included' : 'No VAT'; }],
      ['Total', function (row) {
        return '<strong class="price">' + formatR(row.total) + '</strong>' +
          (row.cheap ? '<br><span class="pill pill-good">Cheapest</span>' : '') +
          (row.best ? '<br><span class="pill">Best rated</span>' : '');
      }],
      ['', function (row) {
        if (row.q.status === 'accepted') return '<span class="pill pill-good">Accepted</span>';
        if (row.q.status === 'not_selected') return '<span class="pill">Not accepted</span>';
        const name = row.card.business_name || row.card.full_name || 'this contractor';
        return '<button class="btn btn-teal btn-small" type="button" data-action="accept-quote" data-id="' + row.q.id + '" data-name="' + esc(name) + '" data-total="' + row.total + '">Accept this quote</button>';
      }]
    ];
    const hint = priced.length > 1
      ? '<p class="compare-hint">Cheapest first. <span class="compare-swipe">Swipe sideways to see every quote.</span></p>'
      : '';
    return hint + '<div class="compare-scroll" data-testid="compare-quotes"><table class="compare-table"><thead>' + head + '</thead><tbody>' +
      rows.map(function (pair) {
        return '<tr><th class="row-label">' + pair[0] + '</th>' + cells(pair[1]) + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="tiny">Prices are what the contractor typed. Check what is included before you accept.</p>';
  }

  function acceptDialog() {
    if (!pendingAccept) return '';
    const others = pendingAccept.others;
    const tail = others === 1
      ? ' The other quote will be closed.'
      : (others > 1 ? ' The other ' + others + ' quotes will be closed.' : ' You will not be able to accept a different quote after this.');
    return '<div class="modal-back" data-screen="accept-confirm"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="accept-title">' +
      '<h2 id="accept-title">Accept this quote?</h2>' +
      '<p>Accept ' + esc(pendingAccept.name) + '’s quote of ' + formatR(pendingAccept.total) + '?' + tail + '</p>' +
      '<div class="row"><button type="button" class="btn btn-teal" data-action="confirm-accept" data-id="' + esc(pendingAccept.id) + '">Accept quote</button>' +
      '<button type="button" class="btn btn-ghost" data-action="cancel-accept">Cancel</button></div></div></div>';
  }

  async function pageRequest(id) {
    const jobRes = await sb.from('job_requests').select('*').eq('id', id).maybeSingle();
    if (jobRes.error || !jobRes.data) return '<p class="form-error">That request is not available.</p>';
    const job = jobRes.data;
    const quotesRes = await sb.from('quotes').select('*').eq('job_id', id);
    const itemsRes = await sb.from('quote_items').select('*');
    const boardRes = await sb.rpc('bid_board', { p_job: id });
    const contactsRes = await sb.rpc('unlocked_contacts', { p_job: id });
    const photosRes = await sb.from('request_photos').select('*').eq('job_id', id);
    const msgRes = await sb.from('messages').select('*').eq('job_id', id).order('created_at');
    const reviewRes = await sb.from('reviews').select('*').eq('job_id', id).eq('client_id', profile.id).maybeSingle();
    const quotes = quotesRes.data || [];
    const ids = quotes.map(function (q) { return q.contractor_id; });
    let cards = [];
    let reviews = [];
    if (ids.length) {
      const c = await sb.from('contractor_cards').select('*').in('id', ids);
      const r = await sb.from('reviews').select('contractor_id, rating, body, created_at').in('contractor_id', ids);
      cards = c.data || [];
      reviews = r.data || [];
    }
    const photos = await signedPhotos(photosRes.data || []);
    const contacts = contactsRes.data || [];
    const allItems = itemsRes.error ? [] : (itemsRes.data || []);
    function cardFor(cid) { return cards.filter(function (c) { return c.id === cid; })[0] || {}; }
    function reviewsFor(cid) { return reviews.filter(function (r) { return r.contractor_id === cid; }); }
    const priced = quotes.map(function (q) {
      const items = quoteItemsFor(allItems, q.id);
      const mine = reviewsFor(q.contractor_id);
      const rating = mine.length ? mine.reduce(function (s, r) { return s + r.rating; }, 0) / mine.length : null;
      const latest = mine.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })[0];
      return {
        q: q, items: items, total: quoteTotal(q, items), rating: rating, ratingCount: mine.length,
        reviewSnippet: latest && latest.body ? String(latest.body).slice(0, 140) : '',
        card: cardFor(q.contractor_id)
      };
    });
    const cheapest = priced.reduce(function (min, row) { return row.total < min ? row.total : min; }, priced.length ? priced[0].total : 0);
    const best = priced.reduce(function (max, row) { return (row.rating || 0) > max ? (row.rating || 0) : max; }, 0);
    priced.forEach(function (row) {
      row.cheap = priced.length > 1 && row.total === cheapest;
      row.best = row.rating != null && row.rating === best && best > 0;
    });
    const acceptedQuote = quotes.filter(function (q) { return q.status === 'accepted'; })[0];
    const acceptedId = acceptedQuote ? acceptedQuote.contractor_id : '';
    const chats = contacts.filter(function (c) {
      if (c.who !== 'contractor' || !c.phone) return false;
      if (job.status === 'accepted') return c.person_id === acceptedId;
      const quote = quotes.filter(function (q) { return q.contractor_id === c.person_id; })[0];
      return !quote || quote.status !== 'not_selected';
    }).map(function (c) {
      const href = waChat(c.phone, 'Hi, this is about my Multiquoters job: ' + job.title);
      return '<a class="btn btn-ghost" data-phone="' + esc(c.phone) + '" href="' + esc(href) + '" target="_blank" rel="noopener">WhatsApp ' + esc(c.business_name || c.name || 'contractor') + '</a>';
    }).join('');
    const justPosted = (function () {
      try { return sessionStorage.getItem('mq-just-posted') === id; } catch (err) { return false; }
    })();
    if (justPosted) { try { sessionStorage.removeItem('mq-just-posted'); } catch (err) {} }
    const banner = justPosted
      ? '<p class="notice" data-testid="job-posted">Job posted. Your reference is <strong>' + esc(jobRef(id)) + '</strong>. Contractors in your area can bid for the next ' + plural(auctionHours(), 'hour') + '.</p>'
      : '';
    const bidLine = job.status === 'open'
      ? ((boardRes.data || []).length
        ? '<p>Contractors are bidding. Their names stay hidden until bidding ends.</p>'
        : '<p>No bids yet.</p>')
      : '';
    const canMessage = ['matched', 'quoting', 'accepted'].indexOf(job.status) >= 0;
    const reviewed = !!(reviewRes && reviewRes.data);
    return banner + '<p class="tiny" data-testid="job-ref">Reference <strong>' + esc(jobRef(id)) + '</strong> · ' + esc(jobStatusLabel(job.status, reviewed)) + '</p>' +
      '<h1>' + esc(job.title) + '</h1>' + timeline(job.status, reviewed) +
      '<article class="card"><p>' + esc(job.description) + '</p><p class="tiny">' + esc(job.suburb) + ', ' + esc(job.area) + ' · ' + esc(job.trade) +
      (job.when_needed ? ' · ' + esc(job.when_needed) : '') + '</p><p class="tiny">' + esc(left(job.auction_ends_at)) + '</p>' +
      photoHtml(photos) +
      (job.status === 'open' ? '<form data-form="add-photos" data-id="' + job.id + '"><label class="field">Add another photo<input type="file" name="photos" accept="image/*" multiple></label><button class="btn btn-ghost btn-small" type="submit">Upload</button><p class="form-error" data-error></p></form>' : '') +
      '</article>' +
      bidLine +
      (quotes.length ? '<h2>Compare quotes</h2>' + comparisonTable(priced) : (job.status === 'open' ? '' : '<p class="tiny">Quotes show up here once the top ' + winnerPlaces() + ' send them.</p>')) +
      (chats ? '<h2>Contact</h2><div class="stack">' + chats + '</div>' : '') +
      (canMessage ? messageThreads(job, threadPeople(contacts, quotes, cards), msgRes.data, acceptedId) : '') +
      (job.status === 'accepted' ? reviewBlock(job, quotes, cards, reviewRes && reviewRes.data) : '') +
      acceptDialog();
  }

  function starPicker(value) {
    let html = '<div class="star-input" role="radiogroup" aria-label="Star rating">';
    for (let i = 1; i <= 5; i++) {
      html += '<button type="button" class="star-btn' + (i <= value ? ' is-on' : '') + '" data-action="set-star" data-value="' + i + '" aria-label="' + i + ' star' + (i === 1 ? '' : 's') + '">★</button>';
    }
    return html + '</div><input type="hidden" name="rating" value="' + (value || '') + '">';
  }

  function reviewBlock(job, quotes, cards, existing) {
    const accepted = (quotes || []).filter(function (q) { return q.status === 'accepted'; })[0];
    if (!accepted) return '';
    const card = (cards || []).filter(function (c) { return c.id === accepted.contractor_id; })[0] || {};
    const name = card.business_name || card.full_name || 'the contractor';
    if (existing) {
      return '<h2>Review</h2><article class="card stack" data-testid="review-saved">' +
        '<p>You reviewed ' + esc(name) + '.</p>' +
        '<p class="stars" aria-label="' + existing.rating + ' out of 5">' + stars(existing.rating) + '</p>' +
        (existing.body ? '<p>' + esc(existing.body) + '</p>' : '') +
        '<p class="tiny">Saved ' + esc(fmtDate(existing.created_at)) + '. One review per job.</p></article>';
    }
    return '<h2>Review</h2><form class="card stack" data-form="review" data-id="' + job.id + '" data-contractor="' + accepted.contractor_id + '">' +
      '<p>How was ' + esc(name) + '?</p>' +
      starPicker(0) +
      '<label class="field">Comment<textarea name="body" placeholder="Optional"></textarea></label>' +
      '<button class="btn btn-teal" type="submit">Send review</button><p class="form-error" data-error></p></form>';
  }

  function stars(n) {
    const r = Math.max(0, Math.min(5, Math.round(n)));
    return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
  }

  async function pageLeads() {
    const res = await sb.from('job_requests').select('*').eq('status', 'open').order('created_at', { ascending: false });
    if (res.error) return '<p class="form-error">' + esc(res.error.message) + '</p>';
    const jobs = res.data || [];
    const note = profile.verified ? '' : '<p class="notice">You can browse leads. An admin must verify your ID before you can bid.</p>';
    if (!jobs.length) return '<h1>Leads</h1>' + note + '<article class="card"><p>No open leads in your trades and areas.</p></article>';
    const cards = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const board = await sb.rpc('bid_board', { p_job: job.id });
      cards.push('<a class="card glance-main" href="#/contractor/lead/' + job.id + '">' + earlyNote(job) +
        '<div class="between"><strong>' + esc(job.title) + '</strong><span class="pill">' + esc(jobStatusLabel(job.status)) + '</span></div>' +
        '<p class="tiny">' + esc(job.trade) + ' · ' + esc(job.suburb) + ', ' + esc(job.area) + '</p>' +
        '<p class="tiny">' + esc(left(job.auction_ends_at)) + '</p>' +
        '<ul class="topbids">' + boardHtml((board.data || []).filter(function (row) { return row.place <= winnerPlaces(); })) + '</ul></a>');
    }
    return '<h1>Leads</h1>' + note + '<div class="lead-grid stack">' + cards.join('') + '</div>';
  }

  function bidControls(id, preview) {
    const limits = bidLimits(preview);
    if (!limits.can) {
      return '<p class="notice">You need more tokens for the minimum bid of ' + plural(limits.min, 'token') + '. You have ' + plural(limits.available, 'token') + ' available. <a href="#/contractor/wallet">Buy tokens</a>.</p>';
    }
    const amount = Math.min(limits.max, Math.max(limits.min, wizard.bidAmount || limits.min));
    const held = preview && preview.held != null
      ? num(preview.held)
      : num(preview && preview.due) - num(preview && preview.extra);
    let wallet = 'You have ' + plural(limits.available, 'token') + ' available';
    if (held > 0) {
      wallet += '. ' + plural(held, 'token') + ' already held on this lead count towards this bid, so you can bid up to ' + plural(limits.max, 'token');
    }
    if (preview.vip) wallet += '. VIP covers up to ' + plural(vipFree(), 'token') + ' on this lead';
    wallet += '.';
    let rule;
    if (preview && preview.in_top) {
      rule = 'Your next bid must be at least ' + plural(limits.min, 'token') + ', one more than your current bid.';
    } else if (preview && preview.third) {
      rule = 'Bid at least ' + plural(limits.min, 'token') + ' to move into the top ' + winnerPlaces() + '.';
    } else {
      rule = 'Minimum bid: ' + plural(limits.min, 'token') + '.';
    }
    return '<p data-testid="min-bid">' + rule + '</p>' +
      '<div class="stepper" data-min="' + limits.min + '" data-max="' + limits.max + '">' +
      '<button type="button" class="btn btn-ghost" data-action="bid-step" data-dir="-1" aria-label="Lower bid">−</button>' +
      '<label class="field"><span class="sr">Tokens to bid</span>' +
      '<input name="bid-amount" data-testid="bid-amount" inputmode="numeric" type="number" min="' + limits.min + '" max="' + limits.max + '" step="1" value="' + amount + '"></label>' +
      '<button type="button" class="btn btn-ghost" data-action="bid-step" data-dir="1" aria-label="Raise bid">+</button></div>' +
      '<p class="tiny" data-testid="token-available">' + wallet + '</p>' +
      '<button type="button" class="btn btn-teal" data-action="bid-review">Bid ' + plural(amount, 'token') + '</button>' +
      (wizard.confirmJob === id ? '<div class="confirm" data-testid="bid-confirm"><p>' + esc(bidSentence(wizard.confirmAmount)) + '</p>' +
        '<button type="button" class="btn btn-orange" data-action="confirm-bid" data-id="' + id + '" data-amount="' + wizard.confirmAmount + '">Confirm bid of ' + plural(wizard.confirmAmount, 'token') + '</button>' +
        '<button type="button" class="btn btn-ghost" data-action="cancel-bid">Cancel</button></div>' : '');
  }

  async function pageLead(id) {
    const jobRes = await sb.from('job_requests').select('*').eq('id', id).maybeSingle();
    if (!jobRes.error && !jobRes.data) return '<p class="form-error">That lead is not available.</p>';
    if (jobRes.error) return '<p class="form-error">' + esc(jobRes.error.message) + '</p>';
    const job = jobRes.data;
    const boardRes = await sb.rpc('bid_board', { p_job: id });
    const previewRes = await sb.rpc('preview_bid', { p_job: id, p_amount: null });
    const contactsRes = await sb.rpc('unlocked_contacts', { p_job: id });
    const photosRes = await sb.from('request_photos').select('*').eq('job_id', id);
    const resultRes = await sb.from('auction_results').select('*').eq('job_id', id).maybeSingle();
    const quoteRes = await sb.from('quotes').select('*').eq('job_id', id).maybeSingle();
    const msgRes = await sb.from('messages').select('*').eq('job_id', id).order('created_at');
    const reviewedRes = await sb.from('reviews').select('id').eq('job_id', id).limit(1);
    const reviewed = !!(reviewedRes.data && reviewedRes.data.length);
    const board = boardRes.data || [];
    const mine = board.filter(function (row) { return row.is_you; })[0];
    const preview = previewRes.data || { min: 1 };
    const won = !!(resultRes.data);
    const myQuote = quoteRes.data || null;
    let myItems = [];
    if (myQuote) {
      const itemRes = await sb.from('quote_items').select('*').eq('quote_id', myQuote.id);
      myItems = itemRes.data || [];
    }
    const photos = won ? await signedPhotos(photosRes.data || []) : [];
    const clientContact = (contactsRes.data || []).filter(function (c) { return c.who === 'client'; })[0];
    const stand = standingText(job, mine, board, won, myQuote);
    const lost = job.status === 'accepted' && won && !(myQuote && myQuote.status === 'accepted');
    const chosen = job.status === 'accepted' && myQuote && myQuote.status === 'accepted';
    const quotingOpen = job.status === 'matched' || job.status === 'quoting';
    const showContact = clientContact && !lost && (won || chosen);
    const photoBlock = won && photos.length
      ? photoHtml(photos)
      : '<p class="tiny">' + (won ? 'No photos on this lead.' : 'Photos and the client’s number unlock if you finish in the top ' + winnerPlaces() + '.') + '</p>';
    const taps = job.status === 'open' && profile.verified ? bidControls(id, preview) : (job.status === 'open' ? '<p class="notice">An admin must verify your ID before you can bid.</p>' : '');
    const canEdit = myQuote && quotingOpen && myQuote.status === 'submitted';
    const quoteBlock = myQuote
      ? '<article class="card" data-testid="quote-sent"><h2>Your quote</h2><p><span class="pill' + (myQuote.status === 'accepted' ? ' pill-good' : '') + '">' + esc(quoteStatusLabel(myQuote.status)) + '</span></p>' +
        lineList(quoteItemsFor(myItems, myQuote.id)) +
        '<p class="price">' + formatR(quoteTotal(myQuote, myItems)) + '</p>' +
        '<p><strong>Included.</strong> ' + esc(myQuote.included || '—') + '</p>' +
        '<p><strong>Excluded.</strong> ' + esc(myQuote.excluded || '—') + '</p>' +
        '<p><strong>Timeline.</strong> ' + esc(myQuote.timeline || '—') + '. Valid until ' + esc(fmtDate(myQuote.valid_until) || '—') + '.</p>' +
        '<p>' + (myQuote.vat_registered ? 'VAT included.' : 'No VAT.') + '</p>' +
        (canEdit ? '<a class="btn btn-ghost" href="#/contractor/quote/' + id + '/edit">Edit quote</a>' : '<p class="tiny">This quote can no longer be changed.</p>') +
        '</article>'
      : '';
    const quoteLink = won && quotingOpen && !myQuote
      ? '<a class="btn btn-teal" href="#/contractor/quote/' + id + '">Send your quote</a>' : '';
    const next = chosen
      ? '<article class="card"><h2>Quote accepted</h2><p>The client accepted your quote. Contact them to arrange the work. You can message them here, or open WhatsApp.</p></article>'
      : (lost ? '<article class="card"><h2>Another quote was accepted</h2><p>The client accepted a different quote. Their name, phone and WhatsApp are no longer shown.</p></article>' : '');
    const wa = showContact && clientContact.phone
      ? '<a class="btn btn-ghost" data-phone="' + esc(clientContact.phone) + '" target="_blank" rel="noopener" href="' + esc(waChat(clientContact.phone, 'Hi, this is about your Multiquoters job: ' + job.title)) + '">WhatsApp the client</a>' : '';
    const showMessages = won && (quotingOpen || job.status === 'accepted');
    const canPost = won && (quotingOpen || chosen);
    const clientName = (showContact && clientContact && clientContact.name) || 'Client';
    const msgs = (msgRes.data || []).filter(function (m) { return m.contractor_id === profile.id; }).map(function (m) {
      return messageBubble(m, m.sender_id === profile.id, clientName);
    }).join('');
    const auctionOpen = job.status === 'open';
    return '<p class="tiny">' + esc(jobStatusLabel(job.status, reviewed)) + '</p><h1>' + esc(job.title) + '</h1>' + (auctionOpen ? earlyNote(job) : '') +
      next +
      '<article class="card"><div class="between"><span class="pill">' + esc(job.trade) + '</span><span>' + esc(left(job.auction_ends_at)) + '</span></div>' +
      '<p>' + esc(job.description) + '</p><p class="tiny">' + esc(job.suburb) + ', ' + esc(job.area) + (job.when_needed ? ' · ' + esc(job.when_needed) : '') + '</p>' +
      photoBlock +
      '<p class="standing ' + stand.cls + '" data-testid="bid-standing">' + esc(stand.text) + '</p>' +
      (auctionOpen ? '<ul class="topbids">' + boardHtml(board.filter(function (row) { return row.place <= winnerPlaces() || row.is_you; })) + '</ul>' : '') +
      taps + '<p class="form-error" data-error></p>' + quoteLink + '</article>' +
      quoteBlock +
      (showContact ? '<article class="card"><h2>Client</h2><p><span class="field-label">Name</span> ' + esc(clientContact.name) + '</p><p><span class="field-label">Phone</span> ' + esc(clientContact.phone) + '</p>' + wa + '</article>' : '') +
      (showMessages ? '<h2>Messages</h2><article class="card thread"><h3>' + esc(clientName) + '</h3>' +
        (msgs || '<p class="tiny">No messages yet.</p>') +
        (canPost
          ? '<form class="stack" data-form="message" data-id="' + id + '" data-contractor="' + profile.id + '"><label class="field">Message<textarea name="body" required></textarea></label><button class="btn btn-teal" type="submit">Send</button><p class="form-error" data-error></p></form>'
          : '<p class="tiny">This conversation is closed.</p>') +
        '</article>' : '');
  }

  function blankLine() {
    return { description: '', qty: 1, unit: 0, kind: 'material' };
  }

  function seedQuote(jobId, quote, items) {
    const lines = quoteItemsFor(items || [], quote && quote.id).map(function (item) {
      const unit = num(item.unit_rand);
      const qty = Number(item.qty) || 1;
      return {
        description: item.label || '',
        qty: qty,
        unit: unit > 0 ? unit : num(item.rand),
        kind: item.kind || 'other'
      };
    });
    return {
      jobId: jobId,
      lines: lines.length ? lines : [blankLine()],
      included: (quote && quote.included) || '',
      excluded: (quote && quote.excluded) || '',
      timeline: (quote && quote.timeline) || '',
      days: 14,
      preview: false
    };
  }

  function quoteLinesTotal(lines) {
    return (lines || []).reduce(function (sum, line) {
      return sum + Math.round((Number(line.qty) || 0) * (num(line.unit)));
    }, 0);
  }

  function kindOptions(selected) {
    return [['material', 'Material'], ['labour', 'Labour'], ['callout', 'Call-out'], ['other', 'Other']].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (pair[0] === selected ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');
  }

  function quoteFormHtml(id, draft) {
    const lines = draft.lines.map(function (line, i) {
      return '<div class="line-edit" data-line="' + i + '">' +
        '<label class="field">Description<input name="line-description" value="' + esc(line.description) + '" required></label>' +
        '<label class="field">Qty<input name="line-qty" type="number" min="0.01" step="0.01" value="' + esc(line.qty) + '" required></label>' +
        '<label class="field">Unit price (R)<input name="line-unit" type="number" min="0" step="1" value="' + esc(line.unit) + '" required></label>' +
        '<label class="field">Type<select name="line-kind">' + kindOptions(line.kind) + '</select></label>' +
        (draft.lines.length > 1 ? '<button type="button" class="btn btn-ghost btn-small" data-action="remove-line" data-index="' + i + '">Remove</button>' : '') +
        '</div>';
    }).join('');
    return '<h1>' + (draft.editing ? 'Edit your quote' : 'Send a quote') + '</h1>' +
      '<form class="card stack" data-form="quote" data-id="' + esc(id) + '" data-preview="0">' +
      '<div class="line-edits" data-testid="quote-lines">' + lines + '</div>' +
      '<button type="button" class="btn btn-ghost" data-action="add-line">Add a line</button>' +
      '<p class="price" data-quote-total>Total ' + formatR(quoteLinesTotal(draft.lines)) + '</p>' +
      '<label class="field">Included<textarea name="included" required>' + esc(draft.included) + '</textarea></label>' +
      '<label class="field">Excluded<textarea name="excluded" required>' + esc(draft.excluded) + '</textarea></label>' +
      '<label class="field">Timeline<input name="timeline" value="' + esc(draft.timeline) + '" placeholder="2 days" required></label>' +
      '<label class="field">Valid for (days)<input name="days" type="number" min="1" max="365" value="' + esc(draft.days || 14) + '" required></label>' +
      '<p class="tiny">' + (profile.vat_registered
        ? 'You are VAT registered. Treat this total as VAT included.'
        : 'You are not VAT registered. Do not add VAT.') + '</p>' +
      '<button class="btn btn-teal" type="submit">Preview quote</button><p class="form-error" data-error></p></form>';
  }

  function quotePreviewHtml(id, draft) {
    const rows = draft.lines.map(function (line) {
      const lineTotal = Math.round((Number(line.qty) || 0) * num(line.unit));
      return '<li>' + esc(line.description) + ' · ' + line.qty + ' × ' + formatR(line.unit) + ' = ' + formatR(lineTotal) + '</li>';
    }).join('');
    const until = new Date();
    until.setDate(until.getDate() + (num(draft.days) || 14));
    return '<h1>Check your quote</h1><article class="card stack" data-testid="quote-preview">' +
      '<ul class="line-list">' + rows + '</ul>' +
      '<p class="price">Total ' + formatR(quoteLinesTotal(draft.lines)) + '</p>' +
      '<p><strong>Included.</strong> ' + esc(draft.included) + '</p>' +
      '<p><strong>Excluded.</strong> ' + esc(draft.excluded) + '</p>' +
      '<p><strong>Timeline.</strong> ' + esc(draft.timeline) + '. Valid until ' + esc(fmtDate(until.toISOString())) + '.</p>' +
      '<p>' + (profile.vat_registered ? 'VAT included.' : 'No VAT.') + '</p>' +
      '<form data-form="quote" data-id="' + esc(id) + '" data-preview="1" class="stack">' +
      '<button class="btn btn-teal" type="submit">Send quote</button>' +
      '<button class="btn btn-ghost" type="button" data-action="quote-back">Back to edit</button>' +
      '<p class="form-error" data-error></p></form></article>';
  }

  async function pageQuote(id, editing) {
    const jobRes = await sb.from('job_requests').select('*').eq('id', id).maybeSingle();
    if (jobRes.error || !jobRes.data) return '<p class="form-error">That lead is not available.</p>';
    const job = jobRes.data;
    const quoteRes = await sb.from('quotes').select('*').eq('job_id', id).maybeSingle();
    const quote = quoteRes.data || null;
    let items = [];
    if (quote) {
      const itemRes = await sb.from('quote_items').select('*').eq('quote_id', quote.id);
      items = itemRes.data || [];
    }
    const open = job.status === 'matched' || job.status === 'quoting';
    const canEdit = !!(quote && open && quote.status === 'submitted');
    if (quote && !editing) {
      return '<h1>Your quote</h1><p class="notice" data-testid="quote-sent">Quote sent. ' + esc(quoteStatusLabel(quote.status)) + '.</p>' +
        '<article class="card stack">' + lineList(quoteItemsFor(items, quote.id)) +
        '<p class="price">' + formatR(quoteTotal(quote, items)) + '</p>' +
        '<p><strong>Included.</strong> ' + esc(quote.included || '—') + '</p>' +
        '<p><strong>Excluded.</strong> ' + esc(quote.excluded || '—') + '</p>' +
        '<p><strong>Timeline.</strong> ' + esc(quote.timeline || '—') + '. Valid until ' + esc(fmtDate(quote.valid_until) || '—') + '.</p>' +
        '<p>' + (quote.vat_registered ? 'VAT included.' : 'No VAT.') + '</p>' +
        (canEdit ? '<a class="btn btn-teal" href="#/contractor/quote/' + id + '/edit">Edit quote</a>' : '<p class="tiny">This quote can no longer be changed.</p>') +
        '<a class="btn btn-ghost" href="#/contractor/lead/' + id + '">Back to the lead</a></article>';
    }
    if (quote && !canEdit) {
      return '<h1>Your quote</h1><p class="notice">This quote can no longer be changed.</p>' +
        '<a class="btn btn-ghost" href="#/contractor/quote/' + id + '">View quote</a>';
    }
    if (!quoteDraft || quoteDraft.jobId !== id) quoteDraft = seedQuote(id, quote, items);
    quoteDraft.editing = !!quote;
    if (quoteDraft.preview) return quotePreviewHtml(id, quoteDraft);
    return quoteFormHtml(id, quoteDraft);
  }

  function ledgerTitle(type) {
    return {
      hold: 'Held for a bid',
      release: 'Hold released',
      spend: 'Paid for a place in the top 3',
      vip_cover: 'VIP cover',
      grant: 'Tokens added',
      purchase: 'Tokens bought'
    }[type] || 'Wallet update';
  }

  function ledgerNote(note) {
    const map = {
      'R0 (VIP)': '',
      'Held for bid': '',
      'Won a place': 'You finished in the top 3',
      'Pushed out of the top 3': 'A higher bid took your place',
      'Did not win a place': 'You finished outside the top 3',
      'Hold reduced': 'Your bid used fewer tokens',
      'EFT credit': 'Added after your payment'
    };
    if (Object.prototype.hasOwnProperty.call(map, note)) return map[note];
    return note || '';
  }

  async function pageWallet() {
    const rows = await sb.from('token_ledger').select('*').order('created_at', { ascending: false }).limit(40);
    const price = vipPrice();
    const vip = isVip(profile);
    const list = (rows.data || []).map(function (row) {
      const note = ledgerNote(row.note || '');
      const amount = row.entry_type === 'vip_cover'
        ? plural(row.tokens, 'token') + ' · no charge'
        : plural(row.tokens, 'token');
      return '<li><div class="between"><strong>' + esc(ledgerTitle(row.entry_type)) + '</strong><span>' + esc(amount) + '</span></div>' +
        '<p class="tiny">' + (note ? esc(note) + ' · ' : '') + esc(fmtDate(row.created_at)) + '</p></li>';
    }).join('');
    return '<h1>Wallet</h1><div class="wallet-hero"><article class="card"><span class="tiny">Available</span><strong>' + plural(profile.token_available, 'token') + '</strong></article>' +
      '<article class="card"><span class="tiny">Held</span><strong>' + plural(profile.token_held, 'token') + '</strong></article></div>' +
      '<article class="card vip-offer" data-testid="go-vip"><h2>Go VIP</h2>' +
      '<p>' + formatR(price.yearly) + ' a year or ' + formatR(price.monthly) + ' a month. VIP covers up to 5 tokens on a lead. A bid of 7 tokens charges 2 tokens. VIP can’t buy unlimited bids.</p>' +
      (vip ? '<p data-testid="vip-status">VIP member until <span data-testid="vip-renewal">' + fmtDate(profile.vip_until) + '</span></p>' : '<a class="btn btn-orange" href="#/contractor/vip">Go VIP</a>') +
      '</article>' +
      '<h2>Buy tokens</h2><p class="tiny">Pay by EFT. Tokens are added within ' + plural(hours(), 'hour') + '. Your reference: <strong>' + esc(profile.user_code) + '</strong></p>' +
      '<div class="pack-grid">' + PAY.packs.map(function (pack) {
        return '<button type="button" class="card pack" data-action="buy-pack" data-tokens="' + pack.tokens + '" data-rand="' + pack.rand + '"><p class="rand">' + formatR(pack.rand) + '</p><p>' + plural(pack.tokens, 'token') + '</p></button>';
      }).join('') + '</div>' + eftHtml() +
      '<h2>History</h2><ul class="history">' + (list || '<li>No token movements yet.</li>') + '</ul>';
  }

  function eftHtml() {
    if (!eft) return '';
    return '<article class="card eft"><h2>' + esc(eft.message) + '</h2>' +
      '<p>Pay <strong>' + formatR(eft.amountRand) + '</strong> for ' + esc(eft.label) + '.</p>' +
      bankDetailsBlock() +
      '<p>Reference: <strong>' + esc(eft.reference) + '</strong></p>' +
      '<p class="tiny">Use that reference so the admin can match your payment. ' + (eft.kind === 'vip' ? 'VIP is marked' : 'Tokens are credited') + ' by an admin within ' + eft.hours + ' hours. This page does not grant them by itself.</p></article>';
  }

  function pageVip() {
    const price = vipPrice();
    const plan = wizard.vipPlan || 'yearly';
    const amount = plan === 'monthly' ? price.monthly : price.yearly;
    return '<h1>VIP membership</h1><article class="card vip-offer">' +
      '<div class="plan-toggle row">' +
      '<button type="button" class="btn ' + (plan === 'monthly' ? 'btn-teal' : 'btn-ghost') + '" data-action="vip-plan" data-plan="monthly">Monthly</button>' +
      '<button type="button" class="btn ' + (plan === 'yearly' ? 'btn-teal' : 'btn-ghost') + '" data-action="vip-plan" data-plan="yearly">Yearly</button></div>' +
      '<p class="price" data-testid="vip-plan-price">' + formatR(amount) + '</p>' +
      '<ul><li>Bids up to 5 tokens on a lead are VIP cover, no charge.</li><li>A bid of 7 tokens charges 2 tokens.</li><li>Alerts go out 15 minutes earlier.</li><li>VIP can’t buy unlimited bids.</li></ul>' +
      (isVip(profile) ? '<p data-testid="vip-status">VIP member until <span data-testid="vip-renewal">' + fmtDate(profile.vip_until) + '</span></p>' : '') +
      '<button type="button" class="btn btn-orange" data-action="vip-eft" data-plan="' + plan + '" data-rand="' + amount + '">Pay by EFT</button></article>' + eftHtml();
  }

  async function pageProfile() {
    const reviews = await sb.from('reviews').select('rating').eq('contractor_id', profile.id);
    const rows = reviews.data || [];
    const avg = rows.length ? rows.reduce(function (s, r) { return s + r.rating; }, 0) / rows.length : null;
    return '<h1>Profile</h1><article class="card stack"><dl class="profile-facts">' +
      '<div><dt>Role</dt><dd>' + esc(roleLabel(profile.role)) + '</dd></div>' +
      '<div><dt>Name</dt><dd>' + esc(profile.full_name || '—') + '</dd></div>' +
      (profile.role === 'contractor' ? '<div><dt>Business</dt><dd>' + esc(profile.business_name || '—') + '</dd></div>' : '') +
      '<div><dt>Phone</dt><dd>' + esc(profile.phone || '—') + '</dd></div>' +
      '<div><dt>EFT reference</dt><dd><strong>' + esc(profile.user_code) + '</strong></dd></div>' +
      '<div><dt>Trades</dt><dd>' + esc((profile.trades || []).join(', ') || '—') + '</dd></div>' +
      '<div><dt>Areas</dt><dd>' + esc((profile.areas || []).join(', ') || '—') + '</dd></div>' +
      '<div><dt>VAT</dt><dd>' + (profile.vat_registered ? 'VAT registered' : 'Not VAT registered') + '</dd></div>' +
      '<div><dt>Reviews</dt><dd>' + (avg ? '<span class="stars">' + stars(avg) + '</span> ' + avg.toFixed(1) + ' from ' + plural(rows.length, 'review') : 'No reviews yet') + '</dd></div>' +
      '</dl>' +
      '<p>' + (profile.verified ? '<span class="pill pill-good">Verified</span>' : '<span class="pill pill-orange">Waiting for verification</span>') +
      (isVip(profile) ? ' <span class="vip-badge">VIP member</span>' : '') + '</p>' +
      (isVip(profile) ? '<p data-testid="vip-renewal">Renews ' + fmtDate(profile.vip_until) + '</p>' : '') +
      '<a class="btn btn-teal" target="_blank" rel="noopener" href="' + esc(waShare(profile)) + '">Share to WhatsApp</a>' +
      '<a class="btn btn-ghost" href="#/onboarding">Edit trades and documents</a></article>';
  }

  async function pagePublic(code) {
    if (!sb) return offlineCard();
    const res = await sb.rpc('public_contractor', { p_code: code });
    const p = res.data;
    if (!p) return '<h1>Contractor</h1><p>No public profile for that code.</p>';
    return '<h1>' + esc(p.business_name || p.full_name) + '</h1><article class="card">' +
      (p.vip ? '<span class="vip-badge">VIP member</span>' : '') +
      '<p>' + (p.verified ? 'Verified' : 'Not verified yet') + '</p>' +
      '<p>' + (p.trades || []).map(esc).join(', ') + '</p>' +
      '<p class="tiny">' + (p.areas || []).map(esc).join(', ') + '</p>' +
      '<p>' + (p.vat_registered ? 'VAT registered' : 'Not VAT registered') + '</p>' +
      '<p class="tiny">Phone numbers are not on this public page.</p></article>';
  }

  function presentAlert(n) {
    let body = String(n.body || '').replace(/\s*Bids stay anonymous until the auction ends\.?/g, '').trim();
    let href = n.href || '';
    let title = n.title || '';
    const renamed = {
      'You won a place': 'You are in the top 3',
      'You were outbid': 'You dropped out of the top 3',
      'Another quote was chosen': 'Another quote was accepted',
      'Contractors chosen': 'Quotes due'
    };
    if (renamed[title]) title = renamed[title];
    if (title === 'You are in the top 3') {
      if (href.indexOf('#/contractor/lead/') === 0) href = href.replace('#/contractor/lead/', '#/contractor/quote/');
      if (body.indexOf('Send your quote') === -1) body = (body ? body + ' ' : '') + 'Next step: send your quote.';
    }
    if (title === 'Another quote was accepted' && /chose a different/i.test(body)) {
      body = 'The client accepted a different quote. Their contact details are no longer shown here.';
    }
    return { title: title, body: body, href: href, created_at: n.created_at };
  }

  function alertJobId(href) {
    const match = String(href || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match ? match[0] : '';
  }

  function alertCard(n) {
    const headline = n.body || n.title;
    const kicker = n.body && n.title && n.body !== n.title ? n.title : '';
    const inner = (kicker ? '<p class="tiny">' + esc(kicker) + '</p>' : '') +
      '<strong>' + esc(headline) + '</strong><p class="tiny">' + esc(fmtWhen(n.created_at)) + '</p>';
    return n.href ? '<a class="card" href="' + esc(n.href) + '">' + inner + '</a>' : '<article class="card">' + inner + '</article>';
  }

  async function pageNotifications() {
    const res = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
    await sb.rpc('mark_notifications_read');
    unread = 0;
    const rows = res.data || [];
    if (!rows.length) return '<h1>Alerts</h1><article class="card"><p>Nothing yet. Bid updates and quotes show up here.</p></article>';
    const jobIds = [];
    rows.forEach(function (n) {
      const id = alertJobId(n.href);
      if (id && jobIds.indexOf(id) < 0) jobIds.push(id);
    });
    const quotesByJob = {};
    const bidsByJob = {};
    if (profile.role === 'client' && jobIds.length) {
      let quoteRes = await sb.from('quotes').select('id, job_id, contractor_id, materials_rand, labour_rand, callout_rand, other_rand').in('job_id', jobIds);
      if (quoteRes.error) {
        quoteRes = await sb.from('quotes').select('id, job_id, contractor_id, materials_rand, labour_rand, callout_rand').in('job_id', jobIds);
      }
      const quotes = quoteRes.data || [];
      const quoteIds = quotes.map(function (q) { return q.id; });
      const contractorIds = quotes.map(function (q) { return q.contractor_id; });
      let items = [];
      let cards = [];
      if (quoteIds.length) {
        const itemRes = await sb.from('quote_items').select('quote_id, rand').in('quote_id', quoteIds);
        items = itemRes.data || [];
        const cardRes = await sb.from('contractor_cards').select('id, business_name, full_name').in('id', contractorIds);
        cards = cardRes.data || [];
      }
      const feedRes = await sb.from('bid_feed').select('job_id, amount, created_at').in('job_id', jobIds).order('created_at');
      (feedRes.data || []).forEach(function (row) {
        if (!bidsByJob[row.job_id]) bidsByJob[row.job_id] = [];
        bidsByJob[row.job_id].push(row.amount);
      });
      const linesByJob = {};
      quotes.forEach(function (q) {
        const card = cards.filter(function (c) { return c.id === q.contractor_id; })[0] || {};
        const name = card.business_name || card.full_name || 'A contractor';
        const total = quoteTotal(q, quoteItemsFor(items, q.id));
        if (!linesByJob[q.job_id]) linesByJob[q.job_id] = [];
        linesByJob[q.job_id].push({ total: total, text: name + ' quoted ' + formatR(total) + '.' });
      });
      Object.keys(linesByJob).forEach(function (jobId) {
        quotesByJob[jobId] = linesByJob[jobId]
          .sort(function (a, b) { return a.total - b.total; })
          .map(function (line) { return line.text; })
          .join(' ');
      });
    }
    const grouped = [];
    const seenBids = {};
    const seenQuotes = {};
    rows.forEach(function (n) {
      const item = presentAlert(n);
      const jobId = alertJobId(item.href);
      if (item.title === 'New bid') {
        const key = item.href || jobId || 'bids';
        if (seenBids[key]) return;
        seenBids[key] = true;
        const amounts = bidsByJob[jobId] || [];
        const count = rows.filter(function (row) { return row.title === 'New bid' && row.href === n.href; }).length;
        item.title = count === 1 ? 'New bid' : plural(count, 'bid');
        if (amounts.length) {
          item.body = 'Bids of ' + amounts.map(function (amount) { return plural(amount, 'token'); }).join(', ') + '. Names stay hidden until bidding ends.';
        } else if (!/token/.test(item.body)) {
          item.body = plural(count, 'bid') + ' on this job. Names stay hidden until bidding ends.';
        }
        grouped.push(item);
        return;
      }
      if (item.title === 'Quote received' || item.title === 'Quote updated') {
        const key = jobId || item.href || item.title;
        if (seenQuotes[key]) return;
        seenQuotes[key] = true;
        if (quotesByJob[jobId]) item.body = quotesByJob[jobId];
        const count = rows.filter(function (row) {
          return (row.title === 'Quote received' || row.title === 'Quote updated') && alertJobId(row.href) === jobId;
        }).length;
        if (count > 1) item.title = plural(count, 'quote');
        grouped.push(item);
        return;
      }
      const prev = grouped[grouped.length - 1];
      if (prev && prev.title === item.title && prev.body === item.body) return;
      grouped.push(item);
    });
    return '<h1>Alerts</h1><div class="stack">' + grouped.map(alertCard).join('') + '</div>';
  }

  async function pageAdmin() {
    const res = await sb.rpc('admin_snapshot');
    const err = rpcFail(res);
    if (err) return '<p class="form-error">' + esc(err) + '</p>';
    const snap = res.data || {};
    const contractors = snap.contractors || [];
    const jobs = snap.jobs || [];
    return '<h1>Admin</h1><div class="stat-grid">' +
      '<article class="card stat"><span class="tiny">Token grants</span><strong>' + formatR(snap.tokens_rand || 0) + '</strong></article>' +
      '<article class="card stat"><span class="tiny">VIP members</span><strong>' + esc(snap.vip_members || 0) + '</strong></article>' +
      '<article class="card stat"><span class="tiny">VIP recorded</span><strong>' + formatR(snap.vip_revenue || 0) + '</strong></article></div>' +
      '<h2>Contractors</h2><div class="stack">' + contractors.map(function (c) {
        const docs = Array.isArray(c.verification_docs) ? c.verification_docs.length : 0;
        return '<article class="card stack"><div class="between"><strong>' + esc(c.business_name || c.full_name) + '</strong>' +
          (c.verified ? '<span class="pill pill-good">Verified</span>' : '<span class="pill pill-orange">Unverified</span>') + '</div>' +
          '<p class="tiny">' + esc(c.email || '') + ' · ' + esc(c.user_code) + ' · ' + esc(c.phone || 'no phone') + '</p>' +
          '<p class="tiny">' + (c.trades || []).map(esc).join(', ') + ' · ' + plural(docs, 'document') + ' · ' + plural(c.token_available, 'token') + ' available</p>' +
          '<div class="row"><button type="button" class="btn btn-teal btn-small" data-action="verify" data-id="' + c.id + '" data-verified="' + (c.verified ? 'false' : 'true') + '">' + (c.verified ? 'Remove verification' : 'Verify') + '</button></div>' +
          '<form class="row" data-form="grant" data-id="' + c.id + '"><input name="tokens" type="number" min="1" value="10" aria-label="Tokens"><button class="btn btn-ghost btn-small" type="submit">Credit tokens</button></form>' +
          '<div class="row"><button type="button" class="btn btn-ghost btn-small" data-action="mark-vip" data-id="' + c.id + '" data-plan="monthly">VIP month</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-action="mark-vip" data-id="' + c.id + '" data-plan="yearly">VIP year</button></div></article>';
      }).join('') + '</div>' +
      '<h2>Leads</h2><div class="stack">' + jobs.map(function (j) {
          return '<article class="card"><div class="between"><strong>' + esc(j.title) + '</strong><span class="pill">' + esc(jobStatusLabel(j.status)) + '</span></div>' +
          '<p class="tiny">' + esc(j.suburb) + ' · ' + plural(j.bidders, 'bidder') + ' · ' + plural(j.quotes, 'quote') + '</p>' +
          (j.flagged ? '<p>Flagged' + (j.flag_reason ? ': ' + esc(j.flag_reason) : '') + '</p>' :
            '<form data-form="flag" data-id="' + j.id + '"><label class="field">Reason<input name="reason" placeholder="Not a real job"></label><button class="btn btn-ghost btn-small" type="submit">Flag fake lead</button></form>') +
          '</article>';
      }).join('') + '</div>';
  }

  async function render() {
    const b = bits();
    const head = b[0] || '';
    if (head === 'pricing') return pagePricing();
    if (head === 'trust') return pageTrust();
    if (head === 'privacy') return pagePrivacy();
    if (head === 'terms') return pageTerms();
    if (head === 'p') return pagePublic(decodeURIComponent(b[1] || ''));
    if (!configured()) return pageHome();
    if (head === 'new-password') return pageNewPassword();
    if (!session || !profile) {
      if (head === 'signin') return authForm('signin');
      if (head === 'signup') return authForm('signup');
      if (head === 'forgot') return pageForgot();
      if (head === 'client' && b[1] === 'new') return pagePostGate();
      return pageHome();
    }
    if (head === 'signin' || head === 'signup' || head === 'forgot') {
      return '<h1>You are signed in</h1><article class="card stack" data-testid="already-signed-in"><p>You are signed in as a ' + esc(roleLabel(profile.role).toLowerCase()) + '.</p><button class="btn btn-teal" type="button" data-action="sign-out">Sign out</button></article>';
    }
    if (profile.role === 'contractor' && (!(profile.trades || []).length || !(profile.areas || []).length) && head !== 'onboarding' && head !== 'pricing' && head !== 'trust' && head !== 'terms' && head !== 'privacy') {
      location.hash = '#/onboarding';
      return '<p>Taking you to setup…</p>';
    }
    if (head === 'onboarding') return profile.role === 'contractor' ? pageOnboarding() : '<p>This page is for contractors.</p>';
    if (head === 'notifications') return pageNotifications();
    if (head === 'admin') return profile.role === 'admin' ? pageAdmin() : '<p>Admins only.</p>';
    if (head === 'client' && profile.role !== 'client') {
      const back = profile.role === 'admin' ? '#/admin' : '#/contractor/leads';
      const backLabel = profile.role === 'admin' ? 'Back to admin' : 'Back to leads';
      return '<article class="card stack" data-testid="role-guard"><h1>This page is for clients</h1><p>You are signed in as a ' + esc(roleLabel(profile.role).toLowerCase()) + '. Posting a job is for clients, and the server refuses it for other roles.</p><a class="btn btn-teal" href="' + back + '">' + backLabel + '</a></article>';
    }
    if (head === 'contractor' && profile.role !== 'contractor') {
      return '<article class="card stack" data-testid="role-guard"><h1>This page is for contractors</h1><p>Your account is a client account.</p><a class="btn btn-teal" href="#/client/requests">Back to your requests</a></article>';
    }
    if (head === 'client' && b[1] === 'new') return pageWizard();
    if (head === 'client' && b[1] === 'requests') return pageRequests();
    if (head === 'client' && b[1] === 'request') return pageRequest(b[2]);
    if (head === 'contractor' && b[1] === 'leads') return pageLeads();
    if (head === 'contractor' && b[1] === 'lead') return pageLead(b[2]);
    if (head === 'contractor' && b[1] === 'quote') return pageQuote(b[2], b[3] === 'edit');
    if (head === 'contractor' && b[1] === 'wallet') return pageWallet();
    if (head === 'contractor' && b[1] === 'vip') return pageVip();
    if (head === 'contractor' && b[1] === 'profile') return pageProfile();
    return pageHome();
  }

  function armPoll() {
    clearInterval(poll);
    const b = bits();
    const live = (b[0] === 'contractor' && b[1] === 'lead') || (b[0] === 'client' && b[1] === 'request') || (b[0] === 'contractor' && b[1] === 'leads');
    if (!live || !sb) return;
    poll = setInterval(function () {
      const active = document.activeElement;
      if (active && active.closest && active.closest('#view input, #view textarea, #view select')) return;
      if (wizard.confirmJob) return;
      go({ quiet: true });
    }, 20000);
  }

  async function go(opts) {
    if (!ready) return;
    const my = ++seq;
    if (bits()[2] !== wizard.confirmJob) wizard.confirmJob = null;
    if (bits()[1] !== 'request') pendingAccept = null;
    if (!keepEft) eft = null;
    keepEft = false;
    paintChrome();
    const quiet = opts && opts.quiet;
    if (!quiet) view.innerHTML = '<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Loading</span></div>';
    let html = '';
    try {
      html = await render();
    } catch (err) {
      html = '<p class="form-error">' + esc(err.message || err) + '</p>';
    }
    if (my !== seq) return;
    view.innerHTML = html;
    view.querySelectorAll('.thumb img').forEach(function (img) {
      function done() {
        img.classList.add('is-ready');
        const spin = img.previousElementSibling;
        if (spin && spin.classList.contains('thumb-loading')) spin.remove();
      }
      if (img.complete && img.naturalWidth) done();
      else img.addEventListener('load', done);
    });
    paintChrome();
    armPoll();
  }

  function markInvalid(name, msg) {
    const el = view.querySelector('[name="' + name + '"]');
    const field = el && el.closest('.field');
    if (!field) return;
    field.classList.add('is-invalid');
    let note = field.querySelector('.field-error');
    if (!note) {
      note = document.createElement('p');
      note.className = 'field-error';
      field.appendChild(note);
    }
    note.textContent = msg;
  }

  function readQuoteFields() {
    const form = view.querySelector('[data-form="quote"]');
    if (!form || form.getAttribute('data-preview') === '1') return quoteDraft;
    const lines = [];
    form.querySelectorAll('[data-line]').forEach(function (row) {
      lines.push({
        description: ((row.querySelector('[name="line-description"]') || {}).value || '').trim(),
        qty: Number((row.querySelector('[name="line-qty"]') || {}).value),
        unit: Math.round(num((row.querySelector('[name="line-unit"]') || {}).value)),
        kind: (row.querySelector('[name="line-kind"]') || {}).value || 'other'
      });
    });
    quoteDraft = quoteDraft || { jobId: form.getAttribute('data-id') };
    quoteDraft.jobId = form.getAttribute('data-id');
    quoteDraft.lines = lines.length ? lines : [blankLine()];
    if (form.included) quoteDraft.included = form.included.value.trim();
    if (form.excluded) quoteDraft.excluded = form.excluded.value.trim();
    if (form.timeline) quoteDraft.timeline = form.timeline.value.trim();
    if (form.days) quoteDraft.days = num(form.days.value) || 14;
    return quoteDraft;
  }

  function missingFn(res) {
    if (!res || !res.error) return false;
    const msg = String(res.error.message || '');
    return res.error.code === 'PGRST202' || /could not find the function|schema cache/i.test(msg);
  }

  async function sendQuote(jobId, draft) {
    const items = draft.lines.map(function (line) {
      return {
        description: String(line.description || '').trim(),
        qty: Number(line.qty),
        unit_rand: Math.round(num(line.unit)),
        kind: line.kind || 'other'
      };
    });
    const res = await sb.rpc('save_quote_lines', {
      p_job: jobId,
      p_items: items,
      p_included: draft.included,
      p_excluded: draft.excluded,
      p_timeline: draft.timeline,
      p_valid_days: draft.days || 14
    });
    if (!missingFn(res)) return res;
    const breakdown = draft.lines.map(function (line) {
      return String(line.description || '').trim() + ' × ' + line.qty + ' @ ' + formatR(line.unit);
    }).join('; ');
    return sb.rpc('save_quote', {
      p_job: jobId,
      p_materials: quoteLinesTotal(draft.lines),
      p_labour: 0,
      p_callout: 0,
      p_included: draft.included + (breakdown ? '\n' + breakdown : ''),
      p_excluded: draft.excluded,
      p_timeline: draft.timeline,
      p_valid_days: draft.days || 14
    });
  }

  function readWizardFields() {
    const root = view;
    function val(name) {
      const el = root.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : null;
    }
    if (val('title') != null && root.querySelector('[name="title"]')) wizard.title = val('title');
    if (root.querySelector('[name="description"]')) wizard.description = val('description');
    if (root.querySelector('[name="area"]')) wizard.area = val('area');
    if (root.querySelector('[name="suburb"]')) wizard.suburb = val('suburb');
    if (root.querySelector('[name="when"]')) wizard.when = val('when');
    if (root.querySelector('[name="contact_name"]')) wizard.contact_name = val('contact_name');
    if (root.querySelector('[name="phone"]')) wizard.phone = val('phone');
    if (root.querySelector('[name="note"]')) wizard.note = val('note');
    const files = root.querySelector('[name="photos"]');
    if (files && files.files && files.files.length) wizard.files = Array.prototype.slice.call(files.files);
  }

  async function uploadJobPhotos(jobId, files) {
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i]);
      const path = jobId + '/' + crypto.randomUUID() + '.jpg';
      const up = await sb.storage.from('job-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);
      const ins = await sb.from('request_photos').insert({ job_id: jobId, storage_path: path });
      if (ins.error) throw new Error(ins.error.message);
    }
  }

  async function handleSubmit(form) {
    const kind = form.getAttribute('data-form');
    const errorEl = form.querySelector('[data-error]');
    function fail(msg) { if (errorEl) errorEl.textContent = msg; else toast(msg); }
    try {
      if (kind === 'signup' || kind === 'signin') {
        const email = form.email.value.trim();
        const password = form.password.value;
        if (!emailOk(email)) {
          markInvalid('email', 'Enter a valid email address, such as name@example.com.');
          return fail('Enter a valid email address, such as name@example.com.');
        }
        const redirect = location.origin + location.pathname;
        if (kind === 'signup') {
          if (!form.terms.checked) {
            const row = form.querySelector('.consent-row');
            if (row) row.classList.add('is-invalid');
            return fail('Tick the box to agree to the terms and the privacy notice.');
          }
          if (password.length < 6) {
            markInvalid('password', 'Use at least 6 characters.');
            return fail('Use at least 6 characters.');
          }
          const role = (form.querySelector('input[name="role"]:checked') || {}).value || 'client';
          const res = await sb.auth.signUp({
            email: email,
            password: password,
            options: {
              emailRedirectTo: redirect,
              data: {
                role: role,
                full_name: form.full_name.value.trim(),
                terms_accepted_at: new Date().toISOString()
              }
            }
          });
          if (res.error) return fail(friendlyAuthError(res.error.message));
          if (res.data.session) {
            session = res.data.session;
            await loadProfile();
            location.hash = role === 'contractor' ? '#/onboarding' : '#/client/requests';
          } else {
            toast('Check your email to confirm the account, then sign in.');
          }
          return;
        }
        if (!password) return fail('Enter a password, or use the email link.');
        const res = await sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) return fail(friendlyAuthError(res.error.message));
        session = res.data.session;
        await loadProfile();
        location.hash = profile && profile.role === 'contractor' ? '#/contractor/leads' : profile && profile.role === 'admin' ? '#/admin' : '#/client/requests';
        return;
      }
      if (kind === 'forgot') {
        const email = form.email.value.trim();
        if (!emailOk(email)) {
          markInvalid('email', 'Enter a valid email address, such as name@example.com.');
          return fail('Enter a valid email address, such as name@example.com.');
        }
        const redirect = location.origin + location.pathname;
        const res = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (res.error) return fail(friendlyAuthError(res.error.message));
        toast('Reset link sent. It opens this same app.');
        return;
      }
      if (kind === 'new-password') {
        if (form.password.value.length < 6) {
          markInvalid('password', 'Use at least 6 characters.');
          return fail('Use at least 6 characters.');
        }
        const res = await sb.auth.updateUser({ password: form.password.value });
        if (res.error) return fail(res.error.message);
        recovery = false;
        toast('Password saved. You are signed in.');
        await loadProfile();
        location.hash = profile && profile.role === 'contractor' ? '#/contractor/leads' : '#/client/requests';
        return;
      }
      if (kind === 'onboarding') {
        const trades = Array.prototype.map.call(form.querySelectorAll('input[name="trade"]:checked'), function (el) { return el.value; });
        const areas = Array.prototype.map.call(form.querySelectorAll('input[name="area"]:checked'), function (el) { return el.value; });
        if (!trades.length || !areas.length) return fail('Choose at least one trade and one area.');
        const updated = await sb.rpc('update_profile', { p: {
          full_name: form.full_name.value.trim(),
          business_name: form.business_name.value.trim(),
          phone: form.phone.value.trim(),
          trades: trades,
          areas: areas,
          vat_registered: form.vat.checked
        } });
        if (updated.error) return fail(updated.error.message);
        profile = updated.data;
        if (form.id_doc.files[0]) await uploadDoc(form.id_doc.files[0], 'id');
        if (form.cert_doc.files[0]) await uploadDoc(form.cert_doc.files[0], 'trade_cert');
        toast('Saved. You can bid after an admin verifies you.');
        location.hash = '#/contractor/leads';
        return;
      }
      if (kind === 'quote') {
        const draft = readQuoteFields();
        const jobId = form.getAttribute('data-id');
        if (form.getAttribute('data-preview') !== '1') {
          let bad = false;
          (draft.lines || []).forEach(function (line, i) {
            const row = form.querySelector('[data-line="' + i + '"]');
            if (!line.description) { bad = true; if (row) row.classList.add('is-invalid'); }
            if (!(line.qty > 0)) bad = true;
            if (line.unit < 0) bad = true;
          });
          if (!draft.included) { markInvalid('included', 'Say what is included.'); bad = true; }
          if (!draft.excluded) { markInvalid('excluded', 'Say what is excluded.'); bad = true; }
          if (!draft.timeline) { markInvalid('timeline', 'Add a timeline.'); bad = true; }
          if (quoteLinesTotal(draft.lines) <= 0) bad = true;
          if (bad) return fail('Add a description and a price on each line, plus what is included, excluded, and the timeline.');
          draft.preview = true;
          quoteDraft = draft;
          go();
          return;
        }
        const res = await sendQuote(jobId, draft);
        let err = rpcFail(res);
        if (err === 'you already sent a quote') err = 'This quote was already sent. Open it from the lead to edit it, once the latest database update is applied.';
        if (err) return fail(err);
        quoteDraft = null;
        toast(res.data && res.data.updated ? 'Quote updated' : 'Quote sent');
        location.hash = '#/contractor/quote/' + jobId;
        return;
      }
      if (kind === 'message') {
        const body = form.body.value.trim();
        if (!body) return fail('Write a message first.');
        form.body.value = '';
        const pending = document.createElement('div');
        pending.className = 'msg mine sending';
        pending.innerHTML = '<p class="msg-who">You</p><p class="msg-body">' + esc(body) + '</p><p class="msg-time">Sending…</p>';
        form.parentNode.insertBefore(pending, form);
        const res = await sb.rpc('send_message', {
          p_job: form.getAttribute('data-id'),
          p_body: body,
          p_contractor: form.getAttribute('data-contractor')
        });
        const err = rpcFail(res);
        if (err) {
          pending.remove();
          form.body.value = body;
          return fail(err);
        }
        go();
        return;
      }
      if (kind === 'review') {
        const rating = num(form.rating.value);
        if (rating < 1 || rating > 5) return fail('Choose a star rating.');
        const res = await sb.rpc('submit_review', {
          p_job: form.getAttribute('data-id'),
          p_contractor: form.getAttribute('data-contractor'),
          p_rating: rating,
          p_body: form.body.value
        });
        const err = rpcFail(res);
        if (err === 'already reviewed') return fail('You have already reviewed this job.');
        if (err) return fail(err);
        toast('Review saved. Thank you.');
        go();
        return;
      }
      if (kind === 'add-photos') {
        const files = form.photos.files;
        if (!files.length) return fail('Choose a photo first.');
        await uploadJobPhotos(form.getAttribute('data-id'), Array.prototype.slice.call(files));
        toast('Photos added');
        go();
        return;
      }
      if (kind === 'grant') {
        const res = await sb.rpc('grant_tokens', {
          p_profile: form.getAttribute('data-id'),
          p_tokens: num(form.tokens.value),
          p_note: 'EFT credit'
        });
        const err = rpcFail(res);
        if (err) return fail(err);
        toast('Tokens credited');
        go();
        return;
      }
      if (kind === 'flag') {
        const res = await sb.rpc('flag_job', { p_job: form.getAttribute('data-id'), p_reason: form.reason.value });
        const err = rpcFail(res);
        if (err) return fail(err);
        toast('Lead flagged');
        go();
      }
    } catch (err) {
      fail(err.message || String(err));
    }
  }

  async function uploadDoc(file, kind) {
    const blob = await compressImage(file);
    const path = profile.id + '/' + kind + '-' + crypto.randomUUID() + '.jpg';
    const up = await sb.storage.from('verification').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw new Error(up.error.message);
    const res = await sb.rpc('add_verification_doc', { p_path: path, p_kind: kind });
    const err = rpcFail(res);
    if (err) throw new Error(err);
  }

  async function onClick(e) {
    const start = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement);
    const el = start && start.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'sign-out') {
      e.preventDefault();
      e.stopPropagation();
      if (signingOut) return;
      signingOut = true;
      session = null;
      profile = null;
      unread = 0;
      recovery = false;
      quoteDraft = null;
      pendingAccept = null;
      if (liveChannel && sb) {
        try { sb.removeChannel(liveChannel); } catch (err) { /* already gone */ }
        liveChannel = null;
      }
      if ((location.hash || '#/') !== '#/') location.hash = '#/';
      else go();
      function finish() { signingOut = false; }
      if (sb) sb.auth.signOut({ scope: 'local' }).then(finish, finish);
      else finish();
      return;
    }
    if (action === 'magic') {
      e.preventDefault();
      const form = el.closest('form');
      const email = form.email.value.trim();
      if (!emailOk(email)) return toast('Enter a valid email address, such as name@example.com.');
      const res = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (res.error) return toast(friendlyAuthError(res.error.message));
      toast('Sign-in link sent. Check your email.');
      return;
    }
    if (action === 'pick-trade') {
      wizard.trade = el.getAttribute('data-trade');
      go();
      return;
    }
    if (action === 'wizard-back') {
      readWizardFields();
      wizard.step = Math.max(1, wizard.step - 1);
      go();
      return;
    }
    if (action === 'wizard-next') {
      readWizardFields();
      const errorEl = view.querySelector('[data-error]');
      view.querySelectorAll('.is-invalid').forEach(function (node) { node.classList.remove('is-invalid'); });
      if (wizard.step === 1 && !wizard.trade) {
        const grid = view.querySelector('[data-field="trade"]');
        if (grid) grid.classList.add('is-invalid');
        const note = view.querySelector('[data-field-error="trade"]');
        if (note) note.textContent = 'Choose a trade.';
        return;
      }
      if (wizard.step === 3) {
        let bad = false;
        if (!wizard.title) { markInvalid('title', 'Add a short title.'); bad = true; }
        if (!wizard.area) { markInvalid('area', 'Choose an area.'); bad = true; }
        if (!wizard.suburb) { markInvalid('suburb', 'Add a suburb.'); bad = true; }
        if (!wizard.when) { markInvalid('when', 'Choose when you need it.'); bad = true; }
        if (!wizard.contact_name) { markInvalid('contact_name', 'Add a contact name.'); bad = true; }
        if (wizard.phone.replace(/\D/g, '').length < 10) { markInvalid('phone', 'Add a phone number with at least 10 digits.'); bad = true; }
        if (bad) return;
      }
      if (wizard.step < 4) { wizard.step += 1; go(); return; }
      el.disabled = true;
      try {
        const created = await sb.rpc('create_job', {
          p_trade: wizard.trade,
          p_title: wizard.title,
          p_description: wizard.description,
          p_suburb: wizard.suburb,
          p_area: wizard.area,
          p_when: wizard.when,
          p_contact_name: wizard.contact_name,
          p_phone: wizard.phone,
          p_note: wizard.note
        });
        const err = rpcFail(created);
        if (err) { if (errorEl) errorEl.textContent = err; el.disabled = false; return; }
        const id = created.data.id;
        if (wizard.files.length) await uploadJobPhotos(id, wizard.files);
        Object.assign(wizard, blankWizard());
        try { sessionStorage.setItem('mq-just-posted', id); } catch (err) { /* private mode */ }
        toast('Job posted. Reference ' + jobRef(id) + '.');
        location.hash = '#/client/request/' + id;
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || String(err);
        el.disabled = false;
      }
      return;
    }
    if (action === 'bid-step') {
      const input = view.querySelector('[name="bid-amount"]');
      if (!input) return;
      const min = num(input.min);
      const max = num(input.max);
      let next = Math.round(num(input.value)) + num(el.getAttribute('data-dir'));
      if (next < min) next = min;
      if (max && next > max) next = max;
      wizard.bidAmount = next;
      wizard.confirmJob = null;
      go();
      return;
    }
    if (action === 'bid-review') {
      const input = view.querySelector('[name="bid-amount"]');
      if (!input) return;
      const min = num(input.min);
      const max = num(input.max);
      const amount = Math.round(num(input.value));
      if (!amount || amount < min || (max && amount > max)) {
        markInvalid('bid-amount', 'Enter a whole number from ' + plural(min, 'token') + ' to ' + plural(max, 'token') + '.');
        return;
      }
      wizard.bidAmount = amount;
      wizard.confirmJob = bits()[2];
      wizard.confirmAmount = amount;
      go();
      return;
    }
    if (action === 'cancel-bid') {
      wizard.confirmJob = null;
      go();
      return;
    }
    if (action === 'confirm-bid') {
      el.disabled = true;
      const res = await sb.rpc('place_bid', { p_job: el.getAttribute('data-id'), p_amount: num(el.getAttribute('data-amount')) });
      const err = rpcFail(res);
      wizard.confirmJob = null;
      wizard.bidAmount = null;
      if (err) toast(err);
      else toast('Bid placed. ' + bidSentence(num(el.getAttribute('data-amount'))));
      await loadProfile();
      go();
      return;
    }
    if (action === 'accept-quote') {
      pendingAccept = {
        id: el.getAttribute('data-id'),
        name: el.getAttribute('data-name') || 'this contractor',
        total: num(el.getAttribute('data-total')),
        others: Math.max(0, view.querySelectorAll('[data-action="accept-quote"]').length - 1)
      };
      go();
      return;
    }
    if (action === 'cancel-accept') {
      pendingAccept = null;
      go();
      return;
    }
    if (action === 'confirm-accept') {
      el.disabled = true;
      const res = await sb.rpc('accept_quote', { p_quote: el.getAttribute('data-id') });
      const err = rpcFail(res);
      pendingAccept = null;
      if (err) toast(err);
      else toast('Quote accepted. The other quotes are closed.');
      go();
      return;
    }
    if (action === 'add-line') {
      readQuoteFields();
      quoteDraft.preview = false;
      quoteDraft.lines.push(blankLine());
      go();
      return;
    }
    if (action === 'remove-line') {
      readQuoteFields();
      const index = num(el.getAttribute('data-index'));
      quoteDraft.lines.splice(index, 1);
      if (!quoteDraft.lines.length) quoteDraft.lines.push(blankLine());
      quoteDraft.preview = false;
      go();
      return;
    }
    if (action === 'quote-back') {
      if (quoteDraft) quoteDraft.preview = false;
      go();
      return;
    }
    if (action === 'set-star') {
      const form = el.closest('form');
      const value = num(el.getAttribute('data-value'));
      if (form && form.rating) form.rating.value = String(value);
      if (form) form.querySelectorAll('.star-btn').forEach(function (btn) {
        btn.classList.toggle('is-on', num(btn.getAttribute('data-value')) <= value);
      });
      return;
    }
    if (action === 'zoom-photo') {
      openLightbox(el.getAttribute('data-src'));
      return;
    }
    if (action === 'close-zoom') {
      const box = document.getElementById('lightbox');
      if (box) box.hidden = true;
      return;
    }
    if (action === 'buy-pack') {
      const pack = PAY.packs.filter(function (p) { return p.tokens === num(el.getAttribute('data-tokens')); })[0];
      eft = PAY.beginTokenPurchase(profile, pack);
      keepEft = true;
      go();
      return;
    }
    if (action === 'vip-plan') {
      wizard.vipPlan = el.getAttribute('data-plan');
      go();
      return;
    }
    if (action === 'vip-eft') {
      eft = PAY.beginVip(profile, el.getAttribute('data-plan'), num(el.getAttribute('data-rand')));
      keepEft = true;
      go();
      return;
    }
    if (action === 'verify') {
      const res = await sb.rpc('verify_contractor', {
        p_profile: el.getAttribute('data-id'),
        p_verified: el.getAttribute('data-verified') === 'true'
      });
      const err = rpcFail(res);
      if (err) toast(err);
      go();
      return;
    }
    if (action === 'mark-vip') {
      const res = await sb.rpc('mark_vip', { p_profile: el.getAttribute('data-id'), p_plan: el.getAttribute('data-plan') });
      const err = rpcFail(res);
      if (err) toast(err);
      else toast('VIP updated');
      go();
    }
  }

  function openLightbox(src) {
    if (!src) return;
    let box = document.getElementById('lightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lightbox';
      box.className = 'lightbox';
      box.innerHTML = '<button type="button" class="btn btn-ghost lightbox-close" data-action="close-zoom">Close</button><img alt="Enlarged job photo">';
      document.body.appendChild(box);
    }
    box.querySelector('img').src = src;
    box.hidden = false;
  }

  document.body.addEventListener('click', function (e) {
    const start = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement);
    if (start && start.closest('[data-action]')) onClick(e);
    if (e.target && e.target.id === 'lightbox') e.target.hidden = true;
  });
  document.body.addEventListener('submit', function (e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.getAttribute('data-form')) return;
    e.preventDefault();
    handleSubmit(form);
  });
  document.body.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'photos' && e.target.files) {
      wizard.files = Array.prototype.slice.call(e.target.files);
      const hint = view.querySelector('[data-photo-hint]');
      if (hint) hint.textContent = plural(wizard.files.length, 'photo') + ' selected. Each one is reduced to about 200KB before upload.';
    }
  });
  document.body.addEventListener('input', function (e) {
    const t = e.target;
    if (!t || !t.name) return;
    if (t.name === 'bid-amount') {
      wizard.bidAmount = Math.round(num(t.value));
      const btn = view.querySelector('[data-action="bid-review"]');
      if (btn) btn.textContent = 'Bid ' + plural(wizard.bidAmount || 0, 'token');
    }
    if (t.closest && t.closest('[data-form="quote"]') && t.closest('[data-form="quote"]').getAttribute('data-preview') !== '1') {
      readQuoteFields();
      const total = view.querySelector('[data-quote-total]');
      if (total && quoteDraft) total.textContent = 'Total ' + formatR(quoteLinesTotal(quoteDraft.lines));
    }
  });

  async function loadProfile() {
    if (!session) {
      profile = null;
      unread = 0;
      if (liveChannel && sb) { sb.removeChannel(liveChannel); liveChannel = null; }
      return;
    }
    const res = await sb.rpc('my_profile');
    profile = res.data;
    const count = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    unread = count.count || 0;
    subscribe();
  }

  async function loadSettings() {
    const res = await sb.rpc('public_settings');
    if (!res || res.error) throw new Error((res && res.error && res.error.message) || 'Could not load settings');
    settings = res.data || {};
  }

  function subscribe() {
    if (!sb || !session || !profile) return;
    if (liveChannel) sb.removeChannel(liveChannel);
    liveChannel = sb.channel('mq-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'profile_id=eq.' + profile.id }, function () { go(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bid_feed' }, function () {
        const b = bits();
        if ((b[1] === 'lead' || b[1] === 'request' || b[1] === 'leads')) go();
      })
      .subscribe();
  }

  async function boot() {
    if (!configured()) { go(); return; }
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      sb = mod.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
      });
      const existing = await sb.auth.getSession();
      session = existing.data.session;
      await loadSettings();
      await loadProfile();
      sb.auth.onAuthStateChange(function (event, next) {
        if (event === 'PASSWORD_RECOVERY') {
          recovery = true;
          session = next;
          signingOut = false;
          if (location.hash !== '#/new-password') location.hash = '#/new-password';
          else go();
          return;
        }
        if (signingOut) return;
        if (event === 'SIGNED_OUT' || !next) {
          session = null;
          profile = null;
          go();
          return;
        }
        session = next;
        setTimeout(function () {
          if (signingOut) return;
          loadProfile().then(function () { if (!signingOut) go(); });
        }, 0);
      });
      ready = true;
      go();
    } catch (err) {
      ready = true;
      view.innerHTML = '<section class="card stack" data-screen="offline"><h1>Backend not connected yet</h1><p>' + esc(err && err.message ? err.message : 'The database library did not load. Check the connection, then reload.') + '</p><a class="btn btn-teal" data-testid="try-demo" href="../">Try the demo</a></section>';
    }
  }

  window.addEventListener('hashchange', function () { if (ready) go(); });
  if (!configured()) ready = true;
  boot();
})();
