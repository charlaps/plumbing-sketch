(function () {
  const CFG = window.MQ_CONFIG || {};
  const PAY = window.MQPayments;
  const TRADES = ['Plumbing', 'Electrical', 'Painting', 'Geyser', 'Solar', 'Handyman', 'Building', 'Roofing'];
  const AREAS = ['Johannesburg North', 'Johannesburg South', 'West Rand', 'East Rand', 'Pretoria', 'Durban', 'Cape Town'];

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
  const wizard = blankWizard();

  function blankWizard() {
    return {
      step: 1, trade: '', files: [], title: '', description: '',
      area: AREAS[0], suburb: '', when: '', contact_name: '', phone: '', note: ''
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
    return 'R' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
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
    return '<p class="bank-pending" data-testid="bank-pending"><strong>Bank details coming soon.</strong> The account is not published yet, so this page does not show a placeholder number.</p>';
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

  function left(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 'Ended';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h + 'h ' + m + 'm left';
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
    const word = amount === 1 ? 'token' : 'tokens';
    if (pay.vip && pay.due === 0) return 'Bid ' + amount + ' ' + word + ' = R0 (VIP). Nothing is held.';
    if (pay.vip) {
      return 'Bid ' + amount + ' tokens. VIP covers ' + pay.covered + '. You pay ' + pay.due + ' tokens = ' + formatR(pay.due * pay.rand) + ', held until the auction ends.';
    }
    return 'Bid ' + amount + ' ' + word + ' = ' + formatR(amount * pay.rand) + ', held until the auction ends.';
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
    topActions.innerHTML = '<a href="../">Try the demo</a>' +
      (logged ? '<a href="#/" data-action="sign-out">Sign out</a>' : '');
    if (logged) {
      viewing.hidden = false;
      roleName.textContent = roleLabel(role);
    } else {
      viewing.hidden = true;
    }
    const links = [];
    if (!logged) {
      links.push(['#/', 'Home'], ['#/pricing', 'Pricing'], ['#/trust', 'Trust & safety']);
      if (configured()) links.push(['#/signin', 'Sign in']);
    } else if (role === 'contractor') {
      links.push(['#/contractor/leads', 'Leads'], ['#/contractor/wallet', 'Wallet'], ['#/contractor/vip', 'VIP'], ['#/contractor/profile', 'Profile'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')]);
    } else if (role === 'admin') {
      links.push(['#/admin', 'Admin'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')], ['#/pricing', 'Pricing']);
    } else {
      links.push(['#/client/requests', 'Requests'], ['#/client/new', 'New job'], ['#/notifications', 'Alerts' + (unread ? ' (' + unread + ')' : '')], ['#/pricing', 'Pricing']);
    }
    const html = links.map(function (pair) {
      const on = pair[0] === '#/' + (b[0] ? b.join('/') : '') || (pair[0] === '#/' && !b.length) || (pair[0] !== '#/' && here.indexOf(pair[0].slice(1)) === 0 && pair[0] !== '#/pricing' && pair[0] !== '#/trust');
      const exact = pair[0] === '#/' ? !b.length : here === pair[0].slice(1) || here.indexOf(pair[0].slice(1) + '/') === 0;
      return '<a href="' + pair[0] + '"' + (exact ? ' class="is-on"' : '') + '>' + esc(pair[1]) + '</a>';
    }).join('');
    subnav.innerHTML = html;
    const primary = links.filter(function (pair) {
      return pair[0].indexOf('#/pricing') !== 0 && pair[0].indexOf('#/trust') !== 0 && pair[0] !== '#/';
    });
    bottom.innerHTML = (logged ? primary : links.filter(function (pair) { return pair[0] !== '#/'; })).slice(0, 4).map(function (pair) {
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
    return '<div class="how-grid">' +
      '<article class="card"><h2>For clients</h2><ol>' +
      '<li>Post the job once: trade, photos, where and when.</li>' +
      '<li>Contractors bid tokens for ' + auctionHours() + ' hours. The top ' + winnerPlaces() + ' win a place.</li>' +
      '<li>Compare up to ' + winnerPlaces() + ' quotes and accept one. The others are not selected.</li>' +
      '<li>Message the winners here, or open WhatsApp. Your number stays hidden until then.</li>' +
      '</ol></article>' +
      '<article class="card"><h2>For contractors</h2><ol>' +
      '<li>Sign up, add your trades and areas, and upload your ID and trade certificate.</li>' +
      '<li>An admin checks them. You can browse leads before that, and bid after you are verified.</li>' +
      '<li>Bid from 1 token. Tokens are held, and returned if you finish outside the top ' + winnerPlaces() + '.</li>' +
      '<li>Win a place, send one itemised quote, and you get the client’s number.</li>' +
      '</ol></article></div>' +
      '<p class="promise-line">You pay tokens only if you win a place. VIP covers bids up to 5 tokens on a lead. VIP can’t buy unlimited bids.</p>';
  }

  function pagePricing() {
    const price = vipPrice();
    return '<h1>Pricing & fees</h1>' +
      '<p class="lede">1 token = ' + formatR(tokenRand()) + '. A lead opens at 1 token. The top ' + winnerPlaces() + ' bidders each pay their own bid. Everyone else is released.</p>' +
      '<div class="pack-grid">' +
      PAY.packs.map(function (pack) {
        return '<article class="card pack"><p class="rand">' + formatR(pack.rand) + '</p><p>' + pack.tokens + ' tokens</p></article>';
      }).join('') +
      '</div>' +
      '<article class="card"><h2>How a bid works</h2><ul>' +
      '<li>While fewer than ' + winnerPlaces() + ' contractors have bid, the minimum is 1 token.</li>' +
      '<li>After that, the minimum is the lowest winning bid plus 1. That is the bid to beat.</li>' +
      '<li>If you are already in the top ' + winnerPlaces() + ', your next bid is your own bid plus 1.</li>' +
      '<li>If two bids are equal, the earlier one stays ahead.</li>' +
      '<li>The auction runs for ' + auctionHours() + ' hours. If nobody bids, it extends twice, then closes.</li>' +
      '<li>If fewer than ' + winnerPlaces() + ' bid, everyone who bid wins a place.</li>' +
      '</ul></article>' +
      '<article class="card vip-offer"><h2>VIP membership</h2>' +
      '<p class="price">' + formatR(price.yearly) + ' a year <span class="muted">or ' + formatR(price.monthly) + ' a month</span></p>' +
      '<ul>' +
      '<li>VIP bids cost no tokens up to 5 tokens on that lead.</li>' +
      '<li>Above 5, you pay the difference. A bid of 7 charges 2 tokens.</li>' +
      '<li>The covered part shows in your wallet as R0 (VIP).</li>' +
      '<li>VIP alerts go out 15 minutes earlier. The lead is not hidden from anyone.</li>' +
      '<li>VIP can’t buy unlimited bids. That keeps the auction fair.</li>' +
      '</ul></article>' +
      '<article class="card"><h2>Paying</h2>' +
      '<p class="eft">Pay by EFT — tokens credited within ' + hours() + ' hours. Your reference is your user code, like MQ-1A2B3C4D. Card payments are not switched on. Nothing is taken from your bank by this website.</p>' +
      bankDetailsBlock() + '</article>';
  }

  function pageTrust() {
    return '<h1>Trust & safety</h1><p><span class="draft-flag">Draft</span></p>' +
      '<article class="card"><h2>What “verified” means</h2>' +
      '<p>Verified means an admin has looked at the contractor’s ID and trade certificate. It is a manual check, not a guarantee of the work, the price, or insurance.</p></article>' +
      '<article class="card"><h2>Who sees your details</h2><ul>' +
      '<li>Clients see a lead’s suburb and description. The phone number is stored separately.</li>' +
      '<li>Contractors see anonymised bids (Contractor A, B, C) until the auction ends.</li>' +
      '<li>Only the top ' + winnerPlaces() + ' see the client’s number and the full photos.</li>' +
      '<li>ID and certificates sit in a private folder. Other contractors cannot open them.</li>' +
      '<li>Reviews can be left only after a quote is accepted.</li>' +
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
      '<h2>Why</h2><p>To run the auction, to show a client up to three quotes, to let winners contact each other, and to keep a record of token holds and releases. The legal bases to describe in the final notice are consent (the photos and ID you upload) and the contract (running the lead you asked for).</p>' +
      '<h2>Who we share it with</h2><ul>' +
      '<li>Winning contractors receive the client’s name and phone after the auction.</li>' +
      '<li>The client receives the winning contractors’ business name and phone.</li>' +
      '<li>Admins can see verification files, leads and token grants.</li>' +
      '<li>The database is hosted by Supabase. Photos are stored there in private buckets.</li>' +
      '<li>WhatsApp opens only if you tap a WhatsApp link. We do not run a WhatsApp bot.</li>' +
      '</ul>' +
      '<h2>How long</h2><p>Keep job records while the quote is being decided and for a reasonable period afterwards so there is a record of who won the lead. Say the exact period in the final notice. You can ask for a copy, a correction, or deletion, subject to records we must keep.</p>' +
      '<h2>Your rights</h2><p>Under POPIA you can ask what we hold, ask for a correction, object, or complain to the Information Regulator. Contact details for the operator go here.</p></article>';
  }

  function pageTerms() {
    return '<h1>Terms of use</h1><p data-testid="draft-banner"><span class="draft-flag">DRAFT</span> These terms have not been reviewed by a lawyer. Do not treat them as the final contract.</p>' +
      '<article class="card"><ul>' +
      '<li>Multiquoters introduces a client and up to three contractors. The building work, if any, is a contract between them. Multiquoters is not the contractor.</li>' +
      '<li>1 token is ' + formatR(tokenRand()) + '. Tokens are held when you bid and spent only if you finish in the top ' + winnerPlaces() + '. Other holds are released.</li>' +
      '<li>VIP is ' + formatR(vipPrice().yearly) + ' a year or ' + formatR(vipPrice().monthly) + ' a month. It covers up to 5 tokens on a lead. It does not buy unlimited bids.</li>' +
      '<li>Paying is by EFT for now. Tokens or VIP are credited by an admin after the payment arrives, aimed within ' + hours() + ' hours. Use your user code as the reference. The site does not take card payments yet.</li>' +
      '<li>A quote you accept is between you and that contractor. Check the price, what is included, VAT, and the timeline yourself.</li>' +
      '<li>Do not post a lead that is not a real job. Admins may remove it.</li>' +
      '<li>Do not upload someone else’s ID. Verification files are for the admin check only.</li>' +
      '</ul></article>';
  }

  function pageHome() {
    if (!configured()) return offlineCard() + '<h2>How it works</h2>' + howBlocks();
    return '<section class="hero-grid"><div><div class="hero-mark"><img src="icon.svg" alt=""><h1>Post a job once. Compare up to three quotes.</h1></div>' +
      '<p class="lede">Contractors in your area bid tokens for the lead. The top ' + winnerPlaces() + ' pay their own bids and send quotes. Your phone number stays hidden until then.</p>' +
      '<div class="row">' +
      (profile ? '' : '<a class="btn btn-teal" href="#/signup">Create an account</a>') +
      '<a class="btn btn-orange" href="' + (profile && profile.role === 'contractor' ? '#/contractor/leads' : '#/client/new') + '">' +
      (profile && profile.role === 'contractor' ? 'See leads' : 'Post a job') + '</a></div>' +
      '<p class="tiny">Prefer to click around with pretend money first? <a href="../">Try the demo</a>.</p></div>' +
      '<article class="card" data-testid="settings-glance"><h2>At a glance</h2>' +
      '<p data-testid="token-price">1 token = ' + formatR(tokenRand()) + '.</p>' +
      '<p data-testid="auction-hours">Auction: ' + auctionHours() + ' hours.</p>' +
      '<p data-testid="winners">Winners: top ' + winnerPlaces() + ', each pays their own bid.</p>' +
      '<p data-testid="vip-price">VIP: ' + formatR(vipPrice().yearly) + ' a year or ' + formatR(vipPrice().monthly) + ' a month.</p></article></section>' +
      '<h2>How it works</h2>' + howBlocks();
  }

  function authForm(mode) {
    if (!configured()) return offlineCard();
    const signup = mode === 'signup';
    return '<h1>' + (signup ? 'Create an account' : 'Sign in') + '</h1>' +
      '<form class="card stack" data-form="' + (signup ? 'signup' : 'signin') + '">' +
      (signup ? '<label class="field">Your name<input name="full_name" required autocomplete="name"></label>' +
        '<fieldset class="stack"><legend class="field-label">I am a</legend>' +
        '<label class="choice"><input type="radio" name="role" value="client" checked> Client — I need a quote</label>' +
        '<label class="choice"><input type="radio" name="role" value="contractor"> Contractor — I want leads</label></fieldset>' : '') +
      '<label class="field">Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label class="field">Password<input name="password" type="password" ' + (signup ? 'required minlength="6" autocomplete="new-password"' : 'autocomplete="current-password"') + '></label>' +
      '<button class="btn btn-teal" type="submit">' + (signup ? 'Create account' : 'Sign in') + '</button>' +
      (signup ? '' : '<button class="btn btn-ghost" type="button" data-action="magic">Email me a sign-in link</button>') +
      '<p class="tiny">' + (signup ? 'Already registered? <a href="#/signin">Sign in</a>' : 'New here? <a href="#/signup">Create an account</a>') + '</p>' +
      '<p class="form-error" data-error></p></form>' +
      '<p class="tiny">The free email service is rate-limited. If a message does not arrive, wait and try again, or use email and password.</p>';
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
    const titles = ['', 'What needs doing?', 'Add photos', 'Describe the job', 'Where and when', 'How can winners reach you?', 'Check and post'];
    let body = '';
    if (step === 1) {
      body = '<div class="trade-grid">' + TRADES.map(function (t) {
        return '<button type="button" class="trade' + (wizard.trade === t ? ' is-on' : '') + '" data-action="pick-trade" data-trade="' + esc(t) + '"><strong>' + esc(t) + '</strong></button>';
      }).join('') + '</div>';
    } else if (step === 2) {
      body = '<label class="field">Photos<input name="photos" type="file" accept="image/*" multiple></label>' +
        '<p class="tiny" data-photo-hint>' + (wizard.files.length ? wizard.files.length + ' photo(s) selected. They are reduced to about 200KB before upload.' : 'Optional. A photo helps contractors judge the job. We shrink each one to about 200KB.') + '</p>';
    } else if (step === 3) {
      body = '<label class="field">Short title<input name="title" value="' + esc(wizard.title) + '" required></label>' +
        '<label class="field">What happened?<textarea name="description" rows="4">' + esc(wizard.description) + '</textarea></label>';
    } else if (step === 4) {
      body = '<label class="field">Area<select name="area">' + AREAS.map(function (a) {
        return '<option' + (a === wizard.area ? ' selected' : '') + '>' + esc(a) + '</option>';
      }).join('') + '</select></label>' +
        '<label class="field">Suburb<input name="suburb" value="' + esc(wizard.suburb) + '" required></label>' +
        '<label class="field">When do you need it?<input name="when" value="' + esc(wizard.when) + '" placeholder="This week"></label>';
    } else if (step === 5) {
      body = '<p class="notice">Winners see this only after the auction. It is not on the public lead.</p>' +
        '<label class="field">Contact name<input name="contact_name" value="' + esc(wizard.contact_name || (profile && profile.full_name) || '') + '" required></label>' +
        '<label class="field">Phone<input name="phone" value="' + esc(wizard.phone || '') + '" required inputmode="tel"></label>' +
        '<label class="field">Private note<textarea name="note" rows="3">' + esc(wizard.note) + '</textarea></label>';
    } else {
      body = '<ul><li>' + esc(wizard.trade) + ' — ' + esc(wizard.title) + '</li>' +
        '<li>' + esc(wizard.suburb) + ', ' + esc(wizard.area) + '</li>' +
        '<li>' + esc(wizard.contact_name) + ' · ' + esc(wizard.phone) + '</li>' +
        '<li>' + wizard.files.length + ' photo(s)</li></ul>' +
        '<p class="tiny">Auction length: ' + auctionHours() + ' hours. Up to ' + winnerPlaces() + ' contractors win a place.</p>';
    }
    return '<h1>Post a job</h1><p class="tiny">Step ' + step + ' of 6</p>' +
      '<div class="progress" aria-hidden="true"><span style="width:' + (step / 6 * 100) + '%"></span></div>' +
      '<h2>' + titles[step] + '</h2><div class="card stack" id="wizard">' + body +
      '<div class="row">' +
      (step > 1 ? '<button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>' : '') +
      '<button type="button" class="btn btn-teal" data-action="wizard-next">' + (step === 6 ? 'Post job' : 'Next') + '</button></div>' +
      '<p class="form-error" data-error></p></div>';
  }

  function timeline(status) {
    const steps = [
      ['posted', 'Posted', true],
      ['bidding', 'Bidding', status === 'open'],
      ['matched', 'Contractors chosen', status === 'matched' || status === 'quoting' || status === 'accepted'],
      ['quoting', 'Quotes in', status === 'quoting' || status === 'accepted'],
      ['accepted', 'Accepted', status === 'accepted']
    ];
    const current = status === 'open' ? 'bidding' : status === 'matched' ? 'matched' : status === 'quoting' ? 'quoting' : status === 'accepted' ? 'accepted' : 'posted';
    return '<ol class="timeline">' + steps.map(function (s) {
      const cls = s[0] === current ? 'current' : (s[2] && s[0] !== current ? 'done' : '');
      return '<li class="' + cls + '">' + s[1] + '</li>';
    }).join('') + '</ol>';
  }

  function earlyTag(job) {
    const age = Date.now() - new Date(job.created_at).getTime();
    if (age >= 0 && age < 15 * 60 * 1000) return '<p class="early" data-testid="vip-early"><span class="pill pill-orange">VIP early access</span></p>';
    return '';
  }

  function boardHtml(rows) {
    const list = rows || [];
    if (!list.length) return '<li class="open-slot">No bids yet. Opens at 1 token.</li>';
    return list.map(function (row) {
      const beat = row.place === 3 ? ' beat' : '';
      return '<li class="' + beat + '"><span>' + esc(row.label) + (row.vip ? ' <span class="vip-badge">VIP member</span>' : '') + '</span><strong>' + row.amount + '</strong></li>';
    }).join('');
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

  async function pageRequests() {
    const res = await sb.from('job_requests').select('*').order('created_at', { ascending: false });
    if (res.error) return '<p class="form-error">' + esc(res.error.message) + '</p>';
    const jobs = res.data || [];
    if (!jobs.length) return '<h1>Your requests</h1><article class="card"><p>No jobs yet.</p><a class="btn btn-teal" href="#/client/new">Post a job</a></article>';
    return '<div class="between"><h1>Your requests</h1><a class="btn btn-teal btn-small" href="#/client/new">New</a></div>' +
      '<div class="stack">' + jobs.map(function (job) {
        return '<a class="card glance-main" href="#/client/request/' + job.id + '"><strong>' + esc(job.title) + '</strong>' +
          '<p class="tiny">' + esc(job.suburb) + ' · ' + esc(job.status) + ' · ' + left(job.auction_ends_at) + '</p></a>';
      }).join('') + '</div>';
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
    const quotes = quotesRes.data || [];
    const ids = quotes.map(function (q) { return q.contractor_id; });
    let cards = [];
    let reviews = [];
    if (ids.length) {
      const c = await sb.from('contractor_cards').select('*').in('id', ids);
      const r = await sb.from('reviews').select('contractor_id, rating').in('contractor_id', ids);
      cards = c.data || [];
      reviews = r.data || [];
    }
    const photos = await signedPhotos(photosRes.data || []);
    const contacts = contactsRes.data || [];
    function cardFor(cid) { return cards.filter(function (c) { return c.id === cid; })[0] || {}; }
    function ratingFor(cid) {
      const rows = reviews.filter(function (r) { return r.contractor_id === cid; });
      if (!rows.length) return null;
      return rows.reduce(function (s, r) { return s + r.rating; }, 0) / rows.length;
    }
    const priced = quotes.map(function (q) {
      const total = q.materials_rand + q.labour_rand + q.callout_rand;
      return { q: q, total: total, rating: ratingFor(q.contractor_id), card: cardFor(q.contractor_id) };
    });
    const cheapest = priced.reduce(function (min, row) { return row.total < min ? row.total : min; }, priced.length ? priced[0].total : 0);
    const best = priced.reduce(function (max, row) { return (row.rating || 0) > max ? (row.rating || 0) : max; }, 0);
    const quoteCards = priced.map(function (row) {
      const cheap = row.total === cheapest;
      const isBest = row.rating != null && row.rating === best && best > 0;
      const vip = row.card.vip ? ' is-vip' : '';
      return '<article class="card quote-card' + (cheap ? ' is-cheap' : '') + (isBest ? ' is-best' : '') + vip + '" data-vip-member="' + (row.card.vip ? '1' : '0') + '">' +
        '<div class="between"><strong>' + esc(row.card.business_name || row.card.full_name || 'Contractor') + '</strong>' +
        (row.card.vip ? '<span class="vip-badge">VIP member</span>' : '') + '</div>' +
        '<p class="price">' + formatR(row.total) + '</p>' +
        '<p class="tiny">' + (row.rating ? stars(row.rating) + ' ' + row.rating.toFixed(1) : 'No reviews yet') +
        (cheap ? ' · Cheapest' : '') + (isBest ? ' · Best rated' : '') + '</p>' +
        '<ul><li>Materials ' + formatR(row.q.materials_rand) + '</li><li>Labour ' + formatR(row.q.labour_rand) + '</li><li>Call-out ' + formatR(row.q.callout_rand) + '</li></ul>' +
        '<p>' + (row.q.vat_registered ? 'VAT included' : 'No VAT') + '</p>' +
        '<p class="tiny">Included: ' + esc(row.q.included || '—') + '</p>' +
        '<p class="tiny">Excluded: ' + esc(row.q.excluded || '—') + '</p>' +
        '<p class="tiny">Timeline: ' + esc(row.q.timeline || '—') + '. Valid until ' + esc(row.q.valid_until || '—') + '.</p>' +
        (row.q.status === 'accepted' ? '<p class="pill pill-good">Accepted</p>' : row.q.status === 'not_selected' ? '<p class="pill">Not selected</p>' :
          '<button class="btn btn-teal" type="button" data-action="accept-quote" data-id="' + row.q.id + '">Accept this quote</button>') +
        '</article>';
    }).join('');
    const table = '<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Contractor</th><th>Total</th><th>VAT</th><th></th></tr></thead><tbody>' +
      priced.map(function (row) {
        return '<tr class="' + (row.card.vip ? 'vip' : '') + '" data-vip-member="' + (row.card.vip ? '1' : '0') + '"><td>' + esc(row.card.business_name || 'Contractor') +
          (row.card.vip ? ' <span class="vip-badge">VIP member</span>' : '') + '</td><td>' + formatR(row.total) + '</td><td>' + (row.q.vat_registered ? 'Yes' : 'No') + '</td><td>' +
          (row.q.status === 'submitted' ? '<button class="btn btn-teal btn-small" type="button" data-action="accept-quote" data-id="' + row.q.id + '">Accept</button>' : esc(row.q.status)) +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
    const chats = contacts.filter(function (c) { return c.who === 'contractor' && c.phone; }).map(function (c) {
      return '<a class="btn btn-ghost" href="' + esc(waChat(c.phone, 'Hi, this is about my Multiquoters job: ' + job.title)) + '" target="_blank" rel="noopener">WhatsApp ' + esc(c.business_name || c.name || 'contractor') + '</a>';
    }).join('');
    const msgs = (msgRes.data || []).map(function (m) {
      return '<div class="msg' + (m.sender_id === profile.id ? ' mine' : '') + '"><strong>' + (m.sender_id === profile.id ? 'You' : 'Them') + '</strong><p>' + esc(m.body) + '</p></div>';
    }).join('');
    const photoHtml = photos.length ? '<div class="thumbs">' + photos.map(function (src) { return '<img src="' + esc(src) + '" alt="Job photo">'; }).join('') + '</div>' : '<p class="tiny">No photos yet.</p>';
    const canMessage = ['matched', 'quoting', 'accepted'].indexOf(job.status) >= 0;
    return '<h1>' + esc(job.title) + '</h1>' + timeline(job.status) + earlyTag(job) +
      '<article class="card"><p>' + esc(job.description) + '</p><p class="tiny">' + esc(job.suburb) + ', ' + esc(job.area) + ' · ' + esc(job.trade) + ' · ' + left(job.auction_ends_at) + '</p>' + photoHtml +
      (job.status === 'open' ? '<form data-form="add-photos" data-id="' + job.id + '"><label class="field">Add photos<input type="file" name="photos" accept="image/*" multiple></label><button class="btn btn-ghost btn-small" type="submit">Upload</button><p class="form-error" data-error></p></form>' : '') +
      '</article>' +
      '<h2>Bids</h2><ul class="topbids">' + boardHtml(boardRes.data) + '</ul>' +
      (quotes.length ? '<h2>Quotes</h2><div class="quote-cards stack">' + quoteCards + '</div>' + table : '<p class="tiny">Quotes appear here after contractors are chosen and they send prices.</p>') +
      (chats ? '<h2>Contact</h2><div class="stack">' + chats + '</div>' : '') +
      (canMessage ? '<h2>Messages</h2>' + msgs + '<form class="stack" data-form="message" data-id="' + job.id + '"><label class="field">Message<textarea name="body" required></textarea></label><button class="btn btn-teal" type="submit">Send</button></form>' : '') +
      (job.status === 'accepted' ? reviewForm(job, contacts) : '');
  }

  function reviewForm(job, contacts) {
    const winner = contacts.filter(function (c) { return c.who === 'contractor'; })[0];
    if (!winner) return '';
    return '<h2>Review</h2><form class="card stack" data-form="review" data-id="' + job.id + '" data-contractor="' + winner.person_id + '">' +
      '<label class="field">Rating (1–5)<input name="rating" type="number" min="1" max="5" value="5" required></label>' +
      '<label class="field">Comment<textarea name="body"></textarea></label>' +
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
      cards.push('<a class="card glance-main" href="#/contractor/lead/' + job.id + '">' + earlyTag(job) +
        '<div class="between"><strong>' + esc(job.title) + '</strong><span class="pill">' + left(job.auction_ends_at) + '</span></div>' +
        '<p class="tiny">' + esc(job.trade) + ' · ' + esc(job.suburb) + ', ' + esc(job.area) + '</p>' +
        '<ul class="topbids">' + boardHtml((board.data || []).filter(function (row) { return row.place <= winnerPlaces(); })) + '</ul></a>');
    }
    return '<h1>Leads</h1>' + note + '<div class="lead-grid stack">' + cards.join('') + '</div>';
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
    const board = boardRes.data || [];
    const mine = board.filter(function (row) { return row.is_you; })[0];
    const preview = previewRes.data || { min: 1 };
    const won = !!(resultRes.data);
    const photos = won ? await signedPhotos(photosRes.data || []) : [];
    const clientContact = (contactsRes.data || []).filter(function (c) { return c.who === 'client'; })[0];
    let standing = 'You have not bid';
    let standingClass = 'none';
    if (won) { standing = 'You won a place'; standingClass = 'in'; }
    else if (mine && mine.place <= winnerPlaces() && job.status === 'open') { standing = 'In the top ' + winnerPlaces(); standingClass = 'in'; }
    else if (mine) { standing = 'Outbid'; standingClass = 'out'; }
    const min = num(preview.min) || 1;
    const taps = job.status === 'open' && profile.verified ? '<div class="bid-taps">' + [1, 2, 5].map(function (extra) {
      const amount = min + extra - 1;
      return '<button type="button" class="btn btn-teal" data-action="bid-tap" data-amount="' + amount + '">+' + extra + '<span class="tiny">' + amount + ' tokens</span></button>';
    }).join('') + '</div>' +
      (wizard.confirmJob === id ? '<div class="confirm"><p>' + esc(bidSentence(wizard.confirmAmount)) + '</p>' +
        '<button type="button" class="btn btn-orange" data-action="confirm-bid" data-id="' + id + '" data-amount="' + wizard.confirmAmount + '">Confirm bid</button>' +
        '<button type="button" class="btn btn-ghost" data-action="cancel-bid">Cancel</button></div>' : '') : '';
    const photoBlock = won && photos.length
      ? '<div class="thumbs">' + photos.map(function (src) { return '<img src="' + esc(src) + '" alt="Job photo">'; }).join('') + '</div>'
      : '<p class="tiny">' + (won ? 'No photos on this lead.' : 'Photos and the client’s number unlock if you win a place.') + '</p>';
    const quoteLink = won && job.status !== 'accepted' && !(quoteRes.data)
      ? '<a class="btn btn-teal" href="#/contractor/quote/' + id + '">Send a quote</a>' : '';
    const wa = clientContact && clientContact.phone
      ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(waChat(clientContact.phone, 'Hi, I won a place on your Multiquoters job: ' + job.title)) + '">WhatsApp the client</a>' : '';
    const msgs = (msgRes.data || []).map(function (m) {
      return '<div class="msg' + (m.sender_id === profile.id ? ' mine' : '') + '"><p>' + esc(m.body) + '</p></div>';
    }).join('');
    const canMessage = won && ['matched', 'quoting', 'accepted'].indexOf(job.status) >= 0;
    return '<h1>' + esc(job.title) + '</h1>' + earlyTag(job) +
      '<article class="card"><div class="between"><span class="pill">' + esc(job.trade) + '</span><span>' + left(job.auction_ends_at) + '</span></div>' +
      '<p>' + esc(job.description) + '</p><p class="tiny">' + esc(job.suburb) + ', ' + esc(job.area) + (job.when_needed ? ' · ' + esc(job.when_needed) : '') + '</p>' +
      photoBlock +
      '<p class="standing ' + standingClass + '">' + standing + '</p>' +
      '<ul class="topbids">' + boardHtml(board.filter(function (row) { return row.place <= winnerPlaces() || row.is_you; })) + '</ul>' +
      taps + '<p class="form-error" data-error></p>' + quoteLink + '</article>' +
      (clientContact ? '<article class="card"><h2>Client</h2><p>' + esc(clientContact.name) + '</p><p>' + esc(clientContact.phone) + '</p>' + wa + '</article>' : '') +
      (canMessage ? '<h2>Messages</h2>' + msgs + '<form class="stack" data-form="message" data-id="' + id + '"><label class="field">Message<textarea name="body" required></textarea></label><button class="btn btn-teal" type="submit">Send</button></form>' : '');
  }

  function pageQuote(id) {
    return '<h1>Send a quote</h1><form class="card stack" data-form="quote" data-id="' + esc(id) + '">' +
      '<label class="field">Materials (R)<input name="materials" type="number" min="0" value="0" required></label>' +
      '<label class="field">Labour (R)<input name="labour" type="number" min="0" value="0" required></label>' +
      '<label class="field">Call-out (R)<input name="callout" type="number" min="0" value="0" required></label>' +
      '<label class="field">Included<textarea name="included" required></textarea></label>' +
      '<label class="field">Excluded<textarea name="excluded" required></textarea></label>' +
      '<label class="field">Timeline<input name="timeline" placeholder="2 days" required></label>' +
      '<label class="field">Valid for (days)<input name="days" type="number" min="1" value="14" required></label>' +
      '<p class="tiny">VAT is recorded from your profile: ' + (profile.vat_registered ? 'VAT registered, so show prices as VAT included.' : 'not VAT registered.') + '</p>' +
      '<button class="btn btn-teal" type="submit">Send quote</button><p class="form-error" data-error></p></form>';
  }

  function historyRand(row) {
    if (row.entry_type === 'vip_cover' || row.note === 'R0 (VIP)') return 'R0 (VIP)';
    return formatR(row.rand);
  }

  async function pageWallet() {
    const rows = await sb.from('token_ledger').select('*').order('created_at', { ascending: false }).limit(40);
    const price = vipPrice();
    const vip = isVip(profile);
    const list = (rows.data || []).map(function (row) {
      return '<li><div class="between"><strong>' + esc(row.entry_type.replace('_', ' ')) + '</strong><span>' + historyRand(row) + '</span></div>' +
        '<p class="tiny">' + esc(row.note || '') + ' · ' + row.tokens + ' tokens · ' + fmtDate(row.created_at) + '</p></li>';
    }).join('');
    return '<h1>Wallet</h1><div class="wallet-hero"><article class="card"><span class="tiny">Available</span><strong>' + profile.token_available + '</strong></article>' +
      '<article class="card"><span class="tiny">Held</span><strong>' + profile.token_held + '</strong></article></div>' +
      '<article class="card vip-offer" data-testid="go-vip"><h2>Go VIP</h2>' +
      '<p>' + formatR(price.yearly) + '/year or ' + formatR(price.monthly) + '/month. Free bids up to 5 tokens per lead. A bid of 7 charges 2 tokens. VIP can’t buy unlimited bids.</p>' +
      (vip ? '<p data-testid="vip-status">VIP member until <span data-testid="vip-renewal">' + fmtDate(profile.vip_until) + '</span></p>' : '<a class="btn btn-orange" href="#/contractor/vip">Go VIP</a>') +
      '</article>' +
      '<h2>Buy tokens</h2><p class="tiny">Pay by EFT — tokens credited within ' + hours() + ' hours. Reference: <strong>' + esc(profile.user_code) + '</strong></p>' +
      '<div class="pack-grid">' + PAY.packs.map(function (pack) {
        return '<button type="button" class="card pack" data-action="buy-pack" data-tokens="' + pack.tokens + '" data-rand="' + pack.rand + '"><p class="rand">' + formatR(pack.rand) + '</p><p>' + pack.tokens + ' tokens</p></button>';
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
      '<ul><li>Bids up to 5 tokens on a lead cost R0 (VIP).</li><li>A bid of 7 charges 2 tokens.</li><li>Alerts go out 15 minutes earlier.</li><li>VIP can’t buy unlimited bids.</li></ul>' +
      (isVip(profile) ? '<p data-testid="vip-status">VIP member until <span data-testid="vip-renewal">' + fmtDate(profile.vip_until) + '</span></p>' : '') +
      '<button type="button" class="btn btn-orange" data-action="vip-eft" data-plan="' + plan + '" data-rand="' + amount + '">Pay by EFT</button></article>' + eftHtml();
  }

  async function pageProfile() {
    const reviews = await sb.from('reviews').select('rating').eq('contractor_id', profile.id);
    const rows = reviews.data || [];
    const avg = rows.length ? rows.reduce(function (s, r) { return s + r.rating; }, 0) / rows.length : null;
    return '<h1>Profile</h1><article class="card stack"><p class="tiny">You\'re viewing as</p><p><strong>' + roleLabel(profile.role) + '</strong></p>' +
      '<p>' + esc(profile.business_name || profile.full_name) + '</p>' +
      '<p class="tiny">User code <strong>' + esc(profile.user_code) + '</strong> — use this as your EFT reference.</p>' +
      '<p>' + (profile.verified ? '<span class="pill pill-good">Verified</span>' : '<span class="pill pill-orange">Waiting for verification</span>') +
      (isVip(profile) ? ' <span class="vip-badge">VIP member</span>' : '') + '</p>' +
      (isVip(profile) ? '<p data-testid="vip-renewal">Renews ' + fmtDate(profile.vip_until) + '</p>' : '') +
      '<p class="tiny">' + (profile.trades || []).map(esc).join(', ') + '</p>' +
      '<p class="tiny">' + (profile.areas || []).map(esc).join(', ') + '</p>' +
      '<p>' + (profile.vat_registered ? 'VAT registered' : 'Not VAT registered') + '</p>' +
      '<p>' + (avg ? stars(avg) + ' ' + avg.toFixed(1) : 'No reviews yet') + '</p>' +
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

  async function pageNotifications() {
    const res = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
    await sb.rpc('mark_notifications_read');
    unread = 0;
    const rows = res.data || [];
    if (!rows.length) return '<h1>Alerts</h1><article class="card"><p>Nothing yet. Bid updates and auction results show up here.</p></article>';
    return '<h1>Alerts</h1><div class="stack">' + rows.map(function (n) {
      const inner = '<strong>' + esc(n.title) + '</strong><p>' + esc(n.body) + '</p><p class="tiny">' + fmtDate(n.created_at) + '</p>';
      return n.href ? '<a class="card" href="' + esc(n.href) + '">' + inner + '</a>' : '<article class="card">' + inner + '</article>';
    }).join('') + '</div>';
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
          '<p class="tiny">' + (c.trades || []).map(esc).join(', ') + ' · ' + docs + ' document(s) · ' + c.token_available + ' available</p>' +
          '<div class="row"><button type="button" class="btn btn-teal btn-small" data-action="verify" data-id="' + c.id + '" data-verified="' + (c.verified ? 'false' : 'true') + '">' + (c.verified ? 'Remove verification' : 'Verify') + '</button></div>' +
          '<form class="row" data-form="grant" data-id="' + c.id + '"><input name="tokens" type="number" min="1" value="10" aria-label="Tokens"><button class="btn btn-ghost btn-small" type="submit">Credit tokens</button></form>' +
          '<div class="row"><button type="button" class="btn btn-ghost btn-small" data-action="mark-vip" data-id="' + c.id + '" data-plan="monthly">VIP month</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-action="mark-vip" data-id="' + c.id + '" data-plan="yearly">VIP year</button></div></article>';
      }).join('') + '</div>' +
      '<h2>Leads</h2><div class="stack">' + jobs.map(function (j) {
        return '<article class="card"><div class="between"><strong>' + esc(j.title) + '</strong><span class="pill">' + esc(j.status) + '</span></div>' +
          '<p class="tiny">' + esc(j.suburb) + ' · ' + j.bidders + ' bidders · ' + j.quotes + ' quotes</p>' +
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
    if (head === 'signin') return authForm('signin');
    if (head === 'signup') return authForm('signup');
    if (!session || !profile) return pageHome();
    if (profile.role === 'contractor' && (!(profile.trades || []).length || !(profile.areas || []).length) && head !== 'onboarding' && head !== 'pricing') {
      location.hash = '#/onboarding';
      return '<p>Taking you to setup…</p>';
    }
    if (head === 'onboarding') return pageOnboarding();
    if (head === 'notifications') return pageNotifications();
    if (head === 'admin') return profile.role === 'admin' ? pageAdmin() : '<p>Admins only.</p>';
    if (head === 'client' && b[1] === 'new') return pageWizard();
    if (head === 'client' && b[1] === 'requests') return pageRequests();
    if (head === 'client' && b[1] === 'request') return pageRequest(b[2]);
    if (head === 'contractor' && b[1] === 'leads') return pageLeads();
    if (head === 'contractor' && b[1] === 'lead') return pageLead(b[2]);
    if (head === 'contractor' && b[1] === 'quote') return pageQuote(b[2]);
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
    if (!keepEft) eft = null;
    keepEft = false;
    paintChrome();
    const quiet = opts && opts.quiet;
    if (!quiet) view.innerHTML = '<p class="tiny">Loading…</p>';
    let html = '';
    try {
      html = await render();
    } catch (err) {
      html = '<p class="form-error">' + esc(err.message || err) + '</p>';
    }
    if (my !== seq) return;
    view.innerHTML = html;
    paintChrome();
    armPoll();
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
        const redirect = location.origin + location.pathname;
        if (kind === 'signup') {
          const role = (form.querySelector('input[name="role"]:checked') || {}).value || 'client';
          const res = await sb.auth.signUp({
            email: email,
            password: password,
            options: { emailRedirectTo: redirect, data: { role: role, full_name: form.full_name.value.trim() } }
          });
          if (res.error) return fail(res.error.message);
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
        if (res.error) return fail(res.error.message);
        session = res.data.session;
        await loadProfile();
        location.hash = profile && profile.role === 'contractor' ? '#/contractor/leads' : profile && profile.role === 'admin' ? '#/admin' : '#/client/requests';
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
        const res = await sb.rpc('save_quote', {
          p_job: form.getAttribute('data-id'),
          p_materials: num(form.materials.value),
          p_labour: num(form.labour.value),
          p_callout: num(form.callout.value),
          p_included: form.included.value,
          p_excluded: form.excluded.value,
          p_timeline: form.timeline.value,
          p_valid_days: num(form.days.value) || 14
        });
        const err = rpcFail(res);
        if (err) return fail(err);
        location.hash = '#/contractor/lead/' + form.getAttribute('data-id');
        return;
      }
      if (kind === 'message') {
        const res = await sb.rpc('send_message', { p_job: form.getAttribute('data-id'), p_body: form.body.value });
        const err = rpcFail(res);
        if (err) return fail(err);
        go();
        return;
      }
      if (kind === 'review') {
        const res = await sb.rpc('submit_review', {
          p_job: form.getAttribute('data-id'),
          p_contractor: form.getAttribute('data-contractor'),
          p_rating: num(form.rating.value),
          p_body: form.body.value
        });
        const err = rpcFail(res);
        if (err) return fail(err);
        toast('Review saved');
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
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'sign-out') {
      e.preventDefault();
      if (sb) await sb.auth.signOut();
      session = null;
      profile = null;
      location.hash = '#/';
      return;
    }
    if (action === 'magic') {
      e.preventDefault();
      const form = el.closest('form');
      const email = form.email.value.trim();
      if (!email) return toast('Enter your email first');
      const res = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (res.error) return toast(res.error.message);
      toast('Sign-in link sent, if the email limit allows it.');
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
      if (wizard.step === 1 && !wizard.trade) { if (errorEl) errorEl.textContent = 'Choose a trade'; return; }
      if (wizard.step === 3 && !wizard.title) { if (errorEl) errorEl.textContent = 'Add a title'; return; }
      if (wizard.step === 4 && !wizard.suburb) { if (errorEl) errorEl.textContent = 'Add a suburb'; return; }
      if (wizard.step === 5 && (!wizard.contact_name || wizard.phone.replace(/\D/g, '').length < 10)) {
        if (errorEl) errorEl.textContent = 'Add a name and a phone number';
        return;
      }
      if (wizard.step < 6) { wizard.step += 1; go(); return; }
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
        location.hash = '#/client/request/' + id;
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || String(err);
        el.disabled = false;
      }
      return;
    }
    if (action === 'bid-tap') {
      wizard.confirmJob = bits()[2];
      wizard.confirmAmount = num(el.getAttribute('data-amount'));
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
      if (err) toast(err);
      else toast('Bid placed');
      await loadProfile();
      go();
      return;
    }
    if (action === 'accept-quote') {
      const res = await sb.rpc('accept_quote', { p_quote: el.getAttribute('data-id') });
      const err = rpcFail(res);
      if (err) toast(err);
      else toast('Quote accepted');
      go();
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

  document.body.addEventListener('click', function (e) {
    if (e.target.closest('[data-action]')) onClick(e);
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
      if (hint) hint.textContent = wizard.files.length + ' photo(s) selected. They are reduced to about 200KB before upload.';
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
      sb.auth.onAuthStateChange(function (_event, next) {
        session = next;
        loadProfile().then(go);
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
