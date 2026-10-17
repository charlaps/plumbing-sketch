(function () {
  'use strict';

  var TOKEN_RAND = 20;
  var STORE_KEY = 'mq-ai-demo-v1';
  var NOW = new Date();
  var YEAR = NOW.getFullYear();

  var HOME = {
    owner: 'Lerato Nkosi',
    first: 'Lerato',
    street: '14 Mimosa Crescent',
    area: 'Eastleigh',
    suburb: 'Edenvale',
    phone: '082 555 0142'
  };

  var STEPS = [
    {
      id: 'geyser',
      title: 'Geyser label',
      help: 'The metal plate on the side of the cylinder, or under the thermostat cover. A clear photo from the ceiling hatch is enough. Do not touch the wiring.',
      sample: 'samples/geyser-label.svg',
      sampleName: 'Sample Kwikot plate',
      sampleLabel: 'Use the sample Kwikot label',
      alt: 'Sample geyser plate. The manufacture date on the drawing reads 03/2014.'
    },
    {
      id: 'db',
      title: 'DB board',
      help: 'Open the distribution board door only if it is safe. Do not touch the breakers. A photo of the rows is enough.',
      sample: 'samples/db-board.svg',
      sampleName: 'Sample DB board',
      sampleLabel: 'Use a sample DB photo',
      alt: 'Sample distribution board with no surge arrestor drawn in.'
    },
    {
      id: 'roof',
      title: 'Roof',
      help: 'Stand on the ground and photograph the ridge and the valleys. There is no need to climb.',
      sample: 'samples/roof.svg',
      sampleName: 'Sample roof',
      sampleLabel: 'Use a sample roof photo',
      alt: 'Sample house roof. The north valley is marked watch.'
    },
    {
      id: 'drains',
      title: 'Drains',
      help: 'The kitchen gulley, or the outside drain, ideally while a tap is running.',
      sample: 'samples/drain.svg',
      sampleName: 'Sample gulley',
      sampleLabel: 'Use a sample drain photo',
      alt: 'Sample kitchen gulley with water sitting in it.'
    },
    {
      id: 'taps',
      title: 'Taps',
      help: 'The tap that drips, or the main bathroom mixer if everything seems fine.',
      sample: 'samples/tap.svg',
      sampleName: 'Sample mixer',
      sampleLabel: 'Use a sample tap photo',
      alt: 'Sample bathroom mixer with no drip.'
    }
  ];

  var INSURERS = [
    { id: 'santam', name: 'Santam', extra: 'The Santam building or contents claim form, and the assessor reference once they send one.' },
    { id: 'outsurance', name: 'OUTsurance', extra: 'The reference number from the OUTsurance app or the call, and the time you logged it.' },
    { id: 'discovery', name: 'Discovery Insure', extra: 'The Discovery Insure claim number from the app. Add a Vitality Home note only if you already have one.' },
    { id: 'hollard', name: 'Hollard', extra: 'The Hollard claim number, and a short list of damaged contents with rough values.' },
    { id: 'kingprice', name: 'King Price', extra: 'The King Price claim reference, and the photos in the same order as the app thread.' }
  ];

  var SUBURBS = [
    { id: 'krugersdorp', name: 'Krugersdorp', zone: 'kru', blurb: 'West Rand. Older electric geysers, and a storm cell earlier this week.', short: 'Geyser age and a storm cell' },
    { id: 'randburg', name: 'Randburg', zone: 'ran', blurb: 'North of the city. Load-shedding restarts and alteration plans.', short: 'Shedding restarts and new plans' },
    { id: 'edenvale', name: 'Edenvale', zone: 'ede', blurb: 'East Rand. Hail sits in the gulleys in Eastleigh and Dowerglen.', short: 'Hail sitting in the gulleys' },
    { id: 'pretoria-east', name: 'Pretoria East', zone: 'pta', blurb: 'Faerie Glen and Garsfontein. New owners and new plans.', short: 'New owners and new plans' }
  ];

  var SIGNALS = ['All signals', 'Building plans', 'New owners', 'Geyser age', 'Storm', 'Load-shedding'];

  function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function pretty(d) {
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function weekday(d) {
    return d.toLocaleDateString('en-ZA', { weekday: 'long' });
  }

  function monthName(d) {
    return d.toLocaleDateString('en-ZA', { month: 'long' });
  }

  var STORM = addDays(NOW, -5);
  var POWER = addDays(NOW, -2);
  var AWAY = addDays(NOW, -1);

  function leads() {
    return [
      {
        id: 'krg-geyser',
        suburb: 'krugersdorp',
        area: 'Monument',
        title: 'Geyser replacements likely this month',
        signal: 'Geyser age',
        confidence: 86,
        low: 4800,
        high: 7200,
        tokens: 12,
        trade: 'Plumbing · PIRB',
        why: 'Eighteen home-health scans in Monument over the last 30 days showed electric geysers made between 2012 and 2015. Most are 150 litre Kwikot or Heattech cylinders with no anode change on the notes. Owners who photograph the plate usually ask for quotes within three weeks.'
      },
      {
        id: 'krg-storm',
        suburb: 'krugersdorp',
        area: 'Noordheuwel',
        title: 'Storm follow-up on valleys and gulleys',
        signal: 'Storm',
        confidence: 79,
        low: 1600,
        high: 3400,
        tokens: 6,
        trade: 'Plumbing or roofing',
        why: 'A pretend storm cell on ' + pretty(STORM) + ' put about 38 mm on Noordheuwel. After a fall like that, gulleys block and valley flashings lift within ten days. Three roof photos this week were marked watch.'
      },
      {
        id: 'ran-burst',
        suburb: 'randburg',
        area: 'Bordeaux',
        title: 'Burst geysers after the power returned',
        signal: 'Load-shedding',
        confidence: 91,
        low: 6500,
        high: 9800,
        tokens: 18,
        trade: 'Plumbing · PIRB',
        why: 'Pretend municipal note: power came back in Bordeaux at 21:05 on ' + pretty(POWER) + ' after a long shed. Nine burst-geyser messages landed on neighbourhood channels before noon the next day. The first plumber to answer usually takes the job.'
      },
      {
        id: 'ran-plans',
        suburb: 'randburg',
        area: 'Blairgowrie',
        title: 'Alteration plans, bathrooms likely',
        signal: 'Building plans',
        confidence: 68,
        low: 9000,
        high: 16000,
        tokens: 8,
        trade: 'Plumbing · PIRB',
        why: 'A pretend City of Johannesburg summary lists 17 approved alteration plans in Blairgowrie this ' + monthName(NOW) + '. Plans that mention a bathroom or a flatlet usually need a new geyser point and a drain. Reaching the owner now beats waiting for a search.'
      },
      {
        id: 'ed-storm',
        suburb: 'edenvale',
        area: 'Eastleigh',
        title: 'Hail, then slow kitchen drains',
        signal: 'Storm',
        confidence: 77,
        low: 890,
        high: 2200,
        tokens: 5,
        trade: 'Plumbing',
        why: 'Hail was logged over Edenvale on ' + pretty(STORM) + '. Eastleigh kitchen gulleys silt up when leaves and grit wash in. The same pattern showed up four to twelve days later in earlier seasons of this pretend history.'
      },
      {
        id: 'pta-owners',
        suburb: 'pretoria-east',
        area: 'Faerie Glen',
        title: 'New owners, old geysers',
        signal: 'New owners',
        confidence: 74,
        low: 5500,
        high: 8400,
        tokens: 10,
        trade: 'Plumbing · PIRB',
        why: 'Pretend deeds feed: 23 transfers in Faerie Glen and Garsfontein in six weeks. Houses built from 1998 to 2008 often still have the original 150 litre cylinder. New owners redo the kitchen before they move in, and the geyser goes with that job.'
      },
      {
        id: 'pta-plans',
        suburb: 'pretoria-east',
        area: 'Garsfontein',
        title: 'New dwelling plans, first-fix plumbing',
        signal: 'Building plans',
        confidence: 71,
        low: 18000,
        high: 32000,
        tokens: 14,
        trade: 'Plumbing · PIRB',
        why: 'Pretend City of Tshwane register: 11 new dwelling plans approved along Garsfontein this ' + monthName(NOW) + '. First-fix plumbing is chosen before the slab is closed. There is time to introduce yourself while the owner is still picking fittings.'
      }
    ];
  }

  var LEADS = leads();

  var WHEN = [
    { id: 'morning', title: 'This morning, about 06:40', detail: weekday(NOW) + ', ' + pretty(NOW) + '. Water in the passage when you woke.' },
    { id: 'power', title: weekday(POWER) + ' night, when the power came back', detail: 'About 21:10 on ' + pretty(POWER) + '. A bang just after the lights returned.' },
    { id: 'away', title: 'While the house was empty', detail: weekday(AWAY) + ', ' + pretty(AWAY) + '. A neighbour noticed water at the gate.' }
  ];

  var WHAT = [
    { id: 'bang', title: 'A bang in the ceiling, then a stream', detail: 'Water came through the passage ceiling within a few minutes.' },
    { id: 'drip', title: 'A drip that became a stream', detail: 'It started at the bathroom ceiling rose and then spread.' },
    { id: 'collapse', title: 'The bathroom ceiling board gave way', detail: 'The board and some insulation came down onto the floor.' }
  ];

  var DOCS = [
    { id: 'policy', label: 'Policy number or a copy of the schedule' },
    { id: 'id', label: 'ID of the policyholder' },
    { id: 'photos', label: 'Photos of the damage before anything is repaired' },
    { id: 'label', label: 'Photo of the geyser label, if it can still be read' },
    { id: 'quote', label: 'Quote from a PIRB-registered plumber' },
    { id: 'coc', label: 'Certificate of compliance, if the insurer asks after the replacement' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rand(n) {
    var v = Math.round(Number(n) || 0);
    return 'R' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function randRange(low, high) {
    if (!low && !high) return 'No spend expected';
    if (low === high) return rand(low);
    return rand(low) + ' – ' + rand(high);
  }

  function findSuburb(id) {
    return SUBURBS.filter(function (s) { return s.id === id; })[0];
  }

  function findLead(id) {
    return LEADS.filter(function (l) { return l.id === id; })[0];
  }

  function findInsurer(id) {
    return INSURERS.filter(function (i) { return i.id === id; })[0];
  }

  function findWhen(id) {
    return WHEN.filter(function (i) { return i.id === id; })[0];
  }

  function findWhat(id) {
    return WHAT.filter(function (i) { return i.id === id; })[0];
  }

  function freshState() {
    return {
      role: 'homeowner',
      tokens: 40,
      claimed: [],
      radar: { phase: 'think', suburb: 'all', signal: 'all', confirm: null },
      health: { phase: 'intro', step: 0, shots: {}, result: null, quoteFor: null },
      claim: { phase: 'intro', step: 0, when: null, what: null, insurer: null, photos: [], checked: [], sent: false }
    };
  }

  function loadState() {
    var base = freshState();
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      base.role = saved.role === 'contractor' ? 'contractor' : 'homeowner';
      base.tokens = Number.isFinite(saved.tokens) ? saved.tokens : 40;
      base.claimed = Array.isArray(saved.claimed) ? saved.claimed : [];
      base.radar = Object.assign(base.radar, saved.radar || {}, { confirm: null });
      base.health = Object.assign(base.health, saved.health || {}, { quoteFor: null });
      base.health.shots = base.health.shots || {};
      base.claim = Object.assign(base.claim, saved.claim || {});
      base.claim.photos = Array.isArray(base.claim.photos) ? base.claim.photos : [];
      base.claim.checked = Array.isArray(base.claim.checked) ? base.claim.checked : [];
      STEPS.forEach(function (step) {
        var shot = base.health.shots[step.id];
        if (shot && shot.kind === 'sample') shot.src = step.sample;
        if (shot && shot.src && String(shot.src).indexOf('data:') === 0) shot.src = '';
      });
      base.claim.photos.forEach(function (p) {
        if (p.src && String(p.src).indexOf('data:') === 0) p.src = '';
      });
    } catch (e) {
      return freshState();
    }
    return base;
  }

  var state = loadState();
  var thinkGen = 0;
  var lastPath = '';
  var focusH1 = false;
  var seq = 1;

  function persist() {
    try {
      var copy = JSON.parse(JSON.stringify(state));
      Object.keys(copy.health.shots || {}).forEach(function (key) {
        var shot = copy.health.shots[key];
        if (shot && shot.src && String(shot.src).indexOf('data:') === 0) shot.src = '';
      });
      (copy.claim.photos || []).forEach(function (p) {
        if (p.src && String(p.src).indexOf('data:') === 0) p.src = '';
      });
      sessionStorage.setItem(STORE_KEY, JSON.stringify(copy));
    } catch (e) { /* private mode */ }
  }

  function currentPath() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/') return '/';
    return h.charAt(0) === '/' ? h : '/' + h;
  }

  function navKey(path) {
    if (path.indexOf('/radar') === 0) return 'radar';
    if (path.indexOf('/health') === 0) return 'health';
    if (path.indexOf('/claim') === 0) return 'claim';
    return 'home';
  }

  function reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function uid(prefix) {
    seq += 1;
    return prefix + seq;
  }

  function toast(msg) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    root.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4200);
  }

  function icon(name) {
    var paths = {
      home: '<path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.8z"/>',
      radar: '<circle cx="12" cy="12" r="7"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
      health: '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
      claim: '<path d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V7h3.2M8 11h8M8 15h6"/>'
    };
    return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' + (paths[name] || '') + '</svg>';
  }

  function navItems() {
    var home = { href: '#/', id: 'home', label: 'Home', icon: 'home' };
    var radar = { href: '#/radar', id: 'radar', label: 'Radar', icon: 'radar' };
    var health = { href: '#/health', id: 'health', label: 'Health', icon: 'health' };
    var claim = { href: '#/claim', id: 'claim', label: 'Claim', icon: 'claim' };
    if (state.role === 'contractor') return [home, radar, health, claim];
    return [home, health, claim, radar];
  }

  function renderNav() {
    var key = navKey(currentPath());
    return navItems().map(function (item) {
      var on = item.id === key;
      return '<a href="' + item.href + '" data-nav="' + item.id + '"' + (on ? ' class="is-on" aria-current="page"' : '') + '>' +
        icon(item.icon) + '<span>' + item.label + '</span></a>';
    }).join('');
  }

  function syncRole() {
    document.querySelectorAll('[data-role]').forEach(function (btn) {
      var on = btn.getAttribute('data-role') === state.role;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    });
  }

  function pageTitle(path) {
    var titles = {
      '/': 'AI that finds the work',
      '/radar': 'AI radar',
      '/health': 'Home health check',
      '/health/result': 'Home health result',
      '/claim': 'Insurance claim helper',
      '/claim/pack': 'Claim pack'
    };
    return (titles[path] || 'Multiquoters demo') + ' · Multiquoters demo';
  }

  function focusMain() {
    var h = document.querySelector('#view h1');
    if (!h) return;
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }

  function safeSrc(url) {
    if (!url) return '';
    var value = String(url);
    if (value.indexOf('samples/') === 0) return value;
    if (value.indexOf('data:image/') === 0) return value;
    return '';
  }

  function imgTag(url, alt) {
    var src = safeSrc(url);
    if (!src) return '';
    return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" decoding="async">';
  }

  function statusPill(status) {
    if (status === 'good') return '<span class="pill pill-good">Good</span>';
    if (status === 'watch') return '<span class="pill pill-watch">Watch</span>';
    if (status === 'due') return '<span class="pill pill-due">Due</span>';
    return '<span class="pill pill-plain">Not scanned</span>';
  }

  function ringClass(score) {
    if (score < 55) return 'ring hot';
    if (score < 75) return 'ring warn';
    return 'ring';
  }

  function scoreLabel(score) {
    if (score >= 85) return 'In good shape';
    if (score >= 70) return 'Mostly fine';
    if (score >= 55) return 'Needs a little care';
    if (score >= 40) return 'Worth booking soon';
    return 'Needs attention soon';
  }

  function ageInOctober(year, month) {
    var age = YEAR - year;
    if ((NOW.getMonth() + 1) < month) age -= 1;
    return Math.max(age, 0);
  }

  function geyserFromShot(shot) {
    if (!shot || shot.kind === 'skip') {
      return {
        id: 'geyser',
        title: 'Geyser',
        status: 'skip',
        reading: 'Not scanned. The score leaves this unknown rather than calling it healthy.',
        low: 0,
        high: 0,
        costNote: 'No age on file.',
        trade: 'Plumbing · PIRB',
        tokens: 10
      };
    }
    var sample = shot.kind === 'sample';
    var year = sample ? 2014 : (YEAR - 6 - ((shot.size || 1) % 9));
    var month = sample ? 3 : 6;
    var age = ageInOctober(year, month);
    var status = age >= 10 ? 'due' : age >= 7 ? 'watch' : 'good';
    var reading = sample
      ? 'From the sample plate: Kwikot 150 L, date of manufacture 03/2014. The cylinder is about ' + age + ' years old.'
      : 'Simulated reading of “' + shot.name + '”. A live model would read the plate. This demo uses a stand-in date of 0' + month + '/' + year + ', so the cylinder is about ' + age + ' years old.';
    var low = status === 'due' ? 6800 : status === 'watch' ? 1450 : 0;
    var high = status === 'due' ? 8900 : status === 'watch' ? 2200 : 0;
    var costNote = status === 'due'
      ? 'About ' + age + ' years old. A replacement is the usual fix. A service is about R1,450 if the cylinder is still sound.'
      : status === 'watch'
        ? 'About ' + age + ' years old. An anode and a pressure check are wise this year.'
        : 'About ' + age + ' years old. Nothing is due on age alone.';
    return {
      id: 'geyser',
      title: 'Geyser',
      status: status,
      reading: reading,
      low: low,
      high: high,
      costNote: costNote,
      trade: 'Plumbing · PIRB',
      tokens: 10,
      year: year,
      sample: sample
    };
  }

  function buildHealth() {
    var shots = state.health.shots || {};
    var geyser = geyserFromShot(shots.geyser);
    var db = !shots.db || shots.db.kind === 'skip'
      ? { id: 'db', title: 'DB board', status: 'skip', reading: 'Not scanned.', low: 0, high: 0, costNote: 'No photo of the board.', trade: 'Electrical · wireman’s licence', tokens: 8 }
      : {
          id: 'db',
          title: 'DB board',
          status: 'watch',
          reading: shots.db.kind === 'sample'
            ? 'Sample board: the stove isolator looks original and there is no surge arrestor in the row. Earth leakage is present.'
            : 'Simulated look at “' + shots.db.name + '”. Stand-in result: no surge protection obvious, earth leakage present. This is a watch, not a fault found.',
          low: 1800,
          high: 2600,
          costNote: 'A surge arrestor is often R1,800 to R2,600, fitted by an electrician with a wireman’s licence. Not a plumber’s job.',
          trade: 'Electrical · wireman’s licence',
          tokens: 8
        };
    var roof = !shots.roof || shots.roof.kind === 'skip'
      ? { id: 'roof', title: 'Roof', status: 'skip', reading: 'Not scanned.', low: 0, high: 0, costNote: 'No roof photo.', trade: 'Roofing', tokens: 6 }
      : {
          id: 'roof',
          title: 'Roof',
          status: 'watch',
          reading: shots.roof.kind === 'sample'
            ? 'Sample roof: the ridge looks even from the ground. The north valley is the one to watch before the next storm.'
            : 'Simulated look at “' + shots.roof.name + '”. Stand-in result: ridge even, one valley marked watch.',
          low: 2500,
          high: 4500,
          costNote: 'If a valley is lifted, a roofer’s repair is often R2,500 to R4,500. Leave it until someone has seen it from a ladder.',
          trade: 'Roofing',
          tokens: 6
        };
    var drains = !shots.drains || shots.drains.kind === 'skip'
      ? { id: 'drains', title: 'Drains', status: 'skip', reading: 'Not scanned.', low: 0, high: 0, costNote: 'No drain photo.', trade: 'Plumbing', tokens: 4 }
      : {
          id: 'drains',
          title: 'Drains',
          status: 'due',
          reading: shots.drains.kind === 'sample'
            ? 'Sample gulley: water is sitting in the kitchen drain and there is a grease line on the rim.'
            : 'Simulated look at “' + shots.drains.name + '”. Stand-in result: the gulley is holding water. A clear-out is the usual first job.',
          low: 890,
          high: 1600,
          costNote: 'A kitchen gulley clear-out is often R890 to R1,600.',
          trade: 'Plumbing',
          tokens: 4
        };
    var taps = !shots.taps || shots.taps.kind === 'skip'
      ? { id: 'taps', title: 'Taps', status: 'skip', reading: 'Not scanned.', low: 0, high: 0, costNote: 'No tap photo.', trade: 'Plumbing', tokens: 3 }
      : {
          id: 'taps',
          title: 'Taps',
          status: 'good',
          reading: shots.taps.kind === 'sample'
            ? 'Sample mixer: the spout is dry and the handles seat evenly. Nothing to book.'
            : 'Simulated look at “' + shots.taps.name + '”. Stand-in result: no active drip.',
          low: 0,
          high: 0,
          costNote: 'No spend expected. A cartridge later on is often R350 to R700.',
          trade: 'Plumbing',
          tokens: 3
        };
    var items = [geyser, db, roof, drains, taps];
    var score = 100;
    items.forEach(function (item) {
      if (item.status === 'due') score -= 14;
      else if (item.status === 'watch') score -= 6;
      else if (item.status === 'skip') score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    return {
      score: score,
      label: scoreLabel(score),
      items: items,
      timeline: buildTimeline(items),
      scanned: pretty(NOW)
    };
  }

  function buildTimeline(items) {
    var by = {};
    items.forEach(function (item) { by[item.id] = item; });
    var rows = [];
    if (by.drains && by.drains.status === 'due') {
      rows.push({ when: monthName(NOW) + ' ' + YEAR, title: 'Clear the kitchen gulley', text: 'Due now. ' + by.drains.costNote });
    }
    if (by.geyser && by.geyser.status === 'due') {
      rows.push({ when: monthName(NOW) + ' ' + YEAR, title: 'Get quotes to replace the geyser', text: by.geyser.costNote });
    } else if (by.geyser && by.geyser.status === 'watch') {
      rows.push({ when: 'Next month', title: 'Service the geyser', text: by.geyser.costNote });
    }
    if (by.db && by.db.status === 'watch') {
      rows.push({ when: 'January ' + (YEAR + (NOW.getMonth() > 0 ? 1 : 0)), title: 'Ask about surge protection', text: by.db.costNote });
    }
    if (by.roof && by.roof.status === 'watch') {
      rows.push({ when: 'March ' + (NOW.getMonth() > 2 ? YEAR + 1 : YEAR), title: 'Look at the roof valleys', text: 'Before the next storm season. ' + by.roof.costNote });
    }
    if (by.taps && by.taps.status === 'good') {
      rows.push({ when: 'July ' + (NOW.getMonth() > 6 ? YEAR + 1 : YEAR), title: 'Leave the taps alone', text: 'They looked fine. Open a tap up only if it starts to weep.' });
    }
    rows.push({ when: monthName(NOW) + ' ' + (YEAR + 1), title: 'Scan the house again', text: 'Twelve months on, take the same five photos and compare the score.' });
    return rows;
  }

  function quoteJob(item) {
    if (item.id === 'geyser') {
      return {
        title: 'Replace a 150 L electric geyser',
        suburb: HOME.area + ', ' + HOME.suburb,
        note: item.reading,
        tokens: item.tokens
      };
    }
    if (item.id === 'drains') {
      return {
        title: 'Clear a slow kitchen gulley',
        suburb: HOME.area + ', ' + HOME.suburb,
        note: item.reading,
        tokens: item.tokens
      };
    }
    return {
      title: item.title,
      suburb: HOME.area + ', ' + HOME.suburb,
      note: item.reading,
      tokens: item.tokens
    };
  }

  function visibleLeads() {
    return LEADS.filter(function (lead) {
      var suburbOk = state.radar.suburb === 'all' || lead.suburb === state.radar.suburb;
      var signalOk = state.radar.signal === 'all' || lead.signal === state.radar.signal;
      return suburbOk && signalOk;
    }).slice().sort(function (a, b) { return b.confidence - a.confidence; });
  }

  function roleNote(audience) {
    if (audience === 'contractor' && state.role !== 'contractor') {
      return '<p class="notice role-note"><strong>Contractor view.</strong> Homeowners do not buy leads. Switch the role at the top if you want this screen as a plumber.</p>';
    }
    if (audience === 'homeowner' && state.role !== 'homeowner') {
      return '<p class="notice role-note"><strong>Homeowner view.</strong> You are browsing as a contractor, so this is what a client would see. The lead at the end is the part that reaches you.</p>';
    }
    return '';
  }

  function viewHome() {
    var you = state.role === 'contractor' ? 'contractor' : 'homeowner';
    var cards = [
      {
        href: '#/radar',
        audience: 'Contractor',
        kind: 'contractor',
        title: 'Future leads',
        text: 'An AI radar for verified trades. It ranks suburbs where work is likely, before a client types a search.',
        go: 'Open the radar'
      },
      {
        href: '#/health',
        audience: 'Homeowner',
        kind: 'homeowner',
        title: 'Home health check',
        text: 'A guided photo scan of the geyser, DB board, roof, drains and taps. You get a score, a cost range, and a year of upkeep.',
        go: 'Start a health check'
      },
      {
        href: '#/claim',
        audience: 'Homeowner',
        kind: 'homeowner',
        title: 'Insurance claim helper',
        text: 'A burst geyser, walked through calmly. The demo builds a claim pack and can hand the note to verified PIRB plumbers.',
        go: 'Open the claim helper'
      }
    ];
    var ordered = you === 'contractor'
      ? [cards[0], cards[1], cards[2]]
      : [cards[1], cards[2], cards[0]];
    var intro = you === 'contractor'
      ? 'You are viewing as a contractor. The radar is the new screen. Health and claims are what a homeowner would send you, already shaped into a lead.'
      : 'You are viewing as a homeowner. Start with a health check or a claim pack. The radar is what a PIRB plumber would see on a Monday morning.';
    return (
      '<section class="hero-grid">' +
        '<div class="hero-copy">' +
          '<p class="kicker"><span class="demo-tag">Demo</span> Concept sketch</p>' +
          '<h1>AI that finds the work</h1>' +
          '<p class="lede">Most lead sites, Bark included, start when someone searches. These three sketches start earlier: an ageing geyser, a suburb after a storm, a claim that already has its photos in a row.</p>' +
          '<p>' + esc(intro) + '</p>' +
          '<p class="tiny">Pretend Gauteng signals. Prices in rands. <a href="../app/">Open the live app</a></p>' +
        '</div>' +
        '<aside class="hero-preview" aria-hidden="true">' +
          '<div class="radar-mini"><span></span><span></span><span></span></div>' +
          '<p class="kicker">AI radar · pretend</p>' +
          '<p class="preview-place">Edenvale · Eastleigh</p>' +
          '<p class="preview-title">Hail earlier this week, slow drains next</p>' +
          '<div class="between"><span class="preview-stat">77%</span><span>R890 – R2,200</span></div>' +
        '</aside>' +
      '</section>' +
      '<section aria-labelledby="concepts-title">' +
        '<h2 id="concepts-title">Three concepts</h2>' +
        '<div class="concept-grid">' +
          ordered.map(function (card) {
            var forYou = card.kind === you;
            return '<a class="concept' + (card.kind === 'contractor' ? ' for-contractor' : '') + '" href="' + card.href + '">' +
              '<span class="concept-top"><span class="pill">' + card.audience + '</span>' +
              (forYou ? '<span class="pill pill-orange">For you</span>' : '<span class="pill pill-plain">The other side</span>') +
              '</span>' +
              '<h3>' + card.title + '</h3>' +
              '<p>' + card.text + '</p>' +
              '<span class="go">' + card.go + '</span></a>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<section class="card" aria-labelledby="earn-title">' +
        '<h2 id="earn-title">How Multiquoters earns</h2>' +
        '<p>Multiquoters earns from <strong>lead fees only</strong>, plus an optional Pro plan. The household pays the contractor directly. The site does not hold the job money.</p>' +
        '<ol class="earn-steps">' +
          '<li><span class="num">1</span><div><strong>Homeowners post for free</strong><p>The job, the photos and the quotes cost the client nothing on the site.</p></div></li>' +
          '<li><span class="num">2</span><div><strong>Contractors buy the lead</strong><p>Up to three verified trades bid tokens. They pay only if they finish in the top three. In this sketch, 1 token is R20, the same shape as the live packs (10 tokens for R200).</p></div></li>' +
          '<li><span class="num">3</span><div><strong>The client pays the contractor</strong><p>Geyser, drains or a claim repair. That invoice never passes through Multiquoters.</p></div></li>' +
        '</ol>' +
        '<div class="pro-plan">' +
          '<span class="pill">Optional</span>' +
          '<h3>Pro plan</h3>' +
          '<p class="price">R399<span> / month</span></p>' +
          '<p>Earlier radar alerts, a saved home-health history, and claim-pack drafts. Pro is a tool subscription. It is not a cut of the plumbing bill.</p>' +
        '</div>' +
        '<p class="tiny">Demo prices. Nothing on this page can be bought.</p>' +
      '</section>' +
      '<footer class="foot">' +
        '<p><a href="../app/">Open the live Multiquoters app</a></p>' +
        '<p class="tiny">Static concept demo. No account, no backend, no payment.</p>' +
      '</footer>'
    );
  }

  function mapArt() {
    return (
      '<svg class="map-bg" viewBox="0 0 640 460" aria-hidden="true">' +
        '<rect width="640" height="460" fill="#f4efe6"/>' +
        '<path fill="#e5f3ec" stroke="#b7d4c8" stroke-width="3" d="M78 92c62-48 168-46 250-18 78-28 176-6 230 62 36 70 18 150-28 196-62 62-160 78-250 62-78 28-170-8-214-62-40-50-28-150 12-240z"/>' +
        '<path d="M96 292c90-28 180-6 280-20 70-8 140-36 196-28" fill="none" stroke="#e2d3bc" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M300 78c18 70 28 140 48 250" fill="none" stroke="#e2d3bc" stroke-width="7" stroke-linecap="round"/>' +
        '<text x="48" y="78" fill="#8a7968" font-family="Nunito, Arial, sans-serif" font-size="18">N</text>' +
        '<text x="48" y="110" fill="#8a7968" font-family="Nunito, Arial, sans-serif" font-size="14">Johannesburg side</text>' +
      '</svg>'
    );
  }

  function thinkBlock(title, lede, lines, next) {
    return (
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Simulated AI</p>' +
        '<h1>' + esc(title) + '</h1>' +
        '<p class="lede">' + esc(lede) + '</p>' +
        '<article class="card think" data-think data-next="' + esc(next) + '" aria-busy="true">' +
          '<div class="radar-anim" aria-hidden="true"><span></span><span></span><span></span><i></i></div>' +
          '<p data-think-status aria-live="polite">Starting…</p>' +
          '<ol class="think-steps">' +
            lines.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') +
          '</ol>' +
        '</article>' +
      '</section>'
    );
  }

  function viewRadar() {
    if (state.radar.phase !== 'ready') {
      return thinkBlock(
        'AI radar',
        'Looking across four pretend suburbs for work that has not been posted yet.',
        [
          'Reading pretend building-plan approvals',
          'Matching property transfers from the last six weeks',
          'Checking geyser ages on home-health scans',
          'Overlaying storm and load-shedding notes by suburb',
          'Scoring confidence for each opportunity'
        ],
        'radar'
      );
    }
    var list = visibleLeads();
    var suburbButtons = SUBURBS.map(function (suburb) {
      var count = LEADS.filter(function (l) { return l.suburb === suburb.id; }).length;
      var on = state.radar.suburb === suburb.id;
      return '<button type="button" class="zone zone-' + suburb.zone + (on ? ' is-on' : '') + '" data-action="suburb" data-id="' + suburb.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<strong>' + esc(suburb.name) + '</strong>' +
        '<span class="tiny">' + count + (count === 1 ? ' opportunity' : ' opportunities') + ' · ' + esc(suburb.short) + '</span></button>';
    }).join('');
    var chips = SIGNALS.map(function (signal) {
      var id = signal === 'All signals' ? 'all' : signal;
      var on = state.radar.signal === id;
      return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" data-action="signal" data-id="' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(signal) + '</button>';
    }).join('');
    var activeSuburb = findSuburb(state.radar.suburb);
    var cards = list.length ? list.map(leadCard).join('') : '<article class="card"><h2>Nothing in this filter</h2><p>Try another suburb or signal. The pretend feed is still there.</p></article>';
    var active = activeSuburb
      ? '<p class="note-teal"><strong>Showing ' + esc(activeSuburb.name) + '.</strong> ' + esc(activeSuburb.blurb) + ' <button type="button" class="btn btn-ghost btn-small" data-action="suburb" data-id="all">Show all suburbs</button></p>'
      : '';
    return (
      roleNote('contractor') +
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Contractor · future leads</p>' +
        '<h1>AI radar</h1>' +
        '<p class="lede">Work predicted before a client searches. Each card is an opportunity, not a posted job.</p>' +
        '<div class="card who">' +
          '<span class="avatar" aria-hidden="true">EB</span>' +
          '<div><strong>Elize Botha</strong><p class="tiny">West Rand Plumbing · PIRB verified · pretend profile</p>' +
          '<p class="wallet">Demo wallet · ' + state.tokens + ' tokens · ' + rand(state.tokens * TOKEN_RAND) + '</p></div>' +
        '</div>' +
        '<p class="notice"><strong>Permission and POPIA.</strong> A live radar would need a lawful basis for municipal plans, deeds, weather and home scans, and permission where the source requires it. These suburbs and signals are invented.</p>' +
        '<div class="map-stage">' + mapArt() + '<div class="map-zones">' + suburbButtons + '</div></div>' +
        '<p class="tiny map-caption">A sketch, not a street map. Pretoria East sits in the north-east corner and Krugersdorp in the south-west.</p>' +
        '<h2>Predicted leads</h2>' +
        '<div class="chips" role="group" aria-label="Filter by signal">' + chips + '</div>' +
        '<p class="row">' + active + '<button type="button" class="btn btn-ghost btn-small" data-action="replay-radar">Scan the suburbs again</button></p>' +
        '<div class="lead-grid stack">' + cards + '</div>' +
      '</section>'
    );
  }

  function leadCard(lead) {
    var suburb = findSuburb(lead.suburb);
    var claimed = state.claimed.indexOf(lead.id) !== -1;
    var confirming = state.radar.confirm === lead.id;
    var hot = lead.confidence >= 85 ? ' hot' : '';
    var action = '';
    if (claimed) {
      action = '<p class="note-teal"><strong>Claimed in this demo.</strong> ' + lead.tokens + ' pretend tokens are on hold. Nothing was charged.</p>' +
        '<button type="button" class="btn btn-ghost btn-block" data-action="release" data-id="' + lead.id + '">Release ' + lead.tokens + ' tokens</button>';
    } else if (confirming) {
      var short = state.tokens < lead.tokens;
      action = '<div class="confirm"><p><strong>Hold ' + lead.tokens + ' pretend tokens?</strong> About ' + rand(lead.tokens * TOKEN_RAND) + '. They return if you release the opportunity. Nothing is charged.</p>' +
        (short ? '<p>Your demo wallet has ' + state.tokens + ' tokens. On the live app you would buy a pack first. Nothing is for sale here.</p>' : '') +
        '<div class="row"><button type="button" class="btn btn-orange" data-action="confirm-claim" data-id="' + lead.id + '"' + (short ? ' disabled' : '') + '>Confirm hold</button>' +
        '<button type="button" class="btn btn-ghost" data-action="cancel-claim">Cancel</button></div></div>';
    } else {
      action = '<button type="button" class="btn btn-orange btn-block" data-action="ask-claim" data-id="' + lead.id + '" data-testid="claim-' + lead.id + '">Claim this opportunity · ' + lead.tokens + ' tokens</button>' +
        '<p class="tiny">Pretend price · about ' + rand(lead.tokens * TOKEN_RAND) + ' · 1 token = R20</p>';
    }
    return (
      '<article class="card lead' + (claimed ? ' is-claimed' : '') + '">' +
        '<div class="between">' +
          '<div><p class="kicker">' + esc(suburb.name) + ' · ' + esc(lead.area) + '</p><h3>' + esc(lead.title) + '</h3></div>' +
          '<div class="ring' + hot + '" style="--p:' + lead.confidence + '" role="img" aria-label="' + lead.confidence + ' percent confidence"><span>' + lead.confidence + '%</span></div>' +
        '</div>' +
        '<p class="value">' + randRange(lead.low, lead.high) + '<small>Estimated job value</small></p>' +
        '<p class="why"><strong>Why the AI thinks so. </strong>' + esc(lead.why) + '</p>' +
        '<p class="row"><span class="pill">' + esc(lead.signal) + '</span><span class="pill">' + esc(lead.trade) + '</span>' +
          (lead.confidence >= 85 ? '<span class="pill pill-hot">Hot</span>' : '') + '</p>' +
        action +
      '</article>'
    );
  }

  function viewHealth() {
    if (state.health.phase === 'scan') return viewScan();
    if (state.health.phase === 'think') {
      var geyserShot = state.health.shots.geyser;
      var first = geyserShot && geyserShot.kind === 'sample'
        ? 'Reading the sample Kwikot plate · 03/2014'
        : 'Looking at the geyser photo';
      return thinkBlock(
        'Reading the house',
        'The photos stay in this browser tab. The remarks you will see are simulated.',
        [first, 'Checking the DB board', 'Noting the roof and valleys', 'Looking at the drain and the taps', 'Building a 12-month timeline'],
        'health'
      );
    }
    var ready = state.health.result
      ? '<article class="card"><h2>Your latest sample score is ready</h2><p>Score ' + state.health.result.score + ' · ' + esc(state.health.result.label) + '.</p><a class="btn btn-teal" href="#/health/result">Open the result</a></article>'
      : '';
    return (
      roleNote('homeowner') +
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Homeowner</p>' +
        '<h1>Home health check</h1>' +
        '<p class="lede">Five photos, then a friendly score for ' + esc(HOME.street) + ', ' + esc(HOME.area) + '. You can use your own camera or the sample pictures.</p>' +
        '<ol class="earn-steps">' +
          STEPS.map(function (step, i) {
            return '<li><span class="num">' + (i + 1) + '</span><div><strong>' + esc(step.title) + '</strong><p>' + esc(step.help) + '</p></div></li>';
          }).join('') +
        '</ol>' +
        '<p class="notice"><strong>Photos stay on this phone.</strong> Nothing is uploaded. The “reading” is a simulation, including the sample plate dated March 2014.</p>' +
        '<div class="stack">' +
          ready +
          '<button type="button" class="btn btn-teal btn-block" data-action="health-start">Start the guided scan</button>' +
          '<button type="button" class="btn btn-ghost btn-block" data-action="health-sample">See the sample result</button>' +
        '</div>' +
      '</section>'
    );
  }

  function viewScan() {
    var index = state.health.step || 0;
    if (index < 0) index = 0;
    if (index > STEPS.length - 1) index = STEPS.length - 1;
    var step = STEPS[index];
    var shot = state.health.shots[step.id];
    var preview = '';
    if (shot && safeSrc(shot.src)) {
      preview = '<figure class="sample-preview">' + imgTag(shot.src, shot.kind === 'sample' ? step.alt : 'Photo you added of the ' + step.title) +
        '<figcaption>' + esc(shot.name) + (shot.kind === 'sample' ? ' · sample' : ' · your photo, kept in this tab') + '</figcaption></figure>';
    } else if (shot && shot.kind === 'upload') {
      preview = '<p class="notice">“' + esc(shot.name) + '” is added. This browser can’t show a preview (or the tab was refreshed). The simulated reading still runs.</p>';
    } else if (shot && shot.kind === 'skip') {
      preview = '<p class="notice">Skipped. This one stays off the score as “not scanned”.</p>';
    } else if (step.id === 'geyser') {
      preview = '<figure class="sample-preview">' + imgTag(step.sample, step.alt) +
        '<figcaption>Drawn for this demo. The plate says date of manufacture 03/2014, March 2014. A live scan would read a real plate the same way.</figcaption></figure>';
    }
    var taken = shot && shot.kind !== 'skip';
    return (
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Step ' + (index + 1) + ' of ' + STEPS.length + '</p>' +
        '<h1>' + esc(step.title) + '</h1>' +
        '<p id="step-label" class="lede">' + esc(step.help) + '</p>' +
        '<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (index + 1) + '" aria-labelledby="step-label"><span style="width:' + Math.round(((index + 1) / STEPS.length) * 100) + '%"></span></div>' +
        preview +
        '<div class="stack">' +
          '<button type="button" class="btn btn-teal btn-block" data-action="use-sample" data-slot="' + step.id + '">' + esc(step.sampleLabel) + '</button>' +
          '<label class="btn btn-ghost btn-block file-btn">Upload or take a photo<input type="file" accept="image/*" data-action="shot" data-slot="' + step.id + '" aria-label="Upload or take a photo of the ' + esc(step.title) + '"></label>' +
          (shot && shot.kind !== 'skip' ? '<button type="button" class="btn btn-ghost btn-block" data-action="clear-shot" data-slot="' + step.id + '">Remove this photo</button>' : '') +
          '<button type="button" class="btn btn-ghost btn-block" data-action="skip-shot" data-slot="' + step.id + '">I can’t reach this one</button>' +
          '<button type="button" class="btn btn-teal btn-block" data-action="scan-next"' + (shot ? '' : ' disabled') + '>' + (index === STEPS.length - 1 ? 'Analyse the house' : 'Next') + '</button>' +
          (index > 0 ? '<button type="button" class="btn btn-ghost btn-block" data-action="scan-back">Back</button>' : '<a class="btn btn-ghost btn-block" href="#/health">Back to the intro</a>') +
          (taken ? '' : '<p class="tiny">Add a photo, use the sample, or skip. Skipping is honest: that item is not scored as healthy.</p>') +
        '</div>' +
      '</section>'
    );
  }

  function viewHealthResult() {
    var result = state.health.result;
    if (!result) {
      return (
        '<section><p class="kicker"><span class="demo-tag">Demo</span></p><h1>No scan yet</h1>' +
        '<p class="lede">Run the five photos, or load the sample house in Edenvale.</p>' +
        '<div class="stack"><a class="btn btn-teal" href="#/health">Start a health check</a>' +
        '<button type="button" class="btn btn-ghost" data-action="health-sample">Load the sample home</button></div></section>'
      );
    }
    var due = result.items.filter(function (item) { return item.status === 'due'; });
    var dueNames = due.map(function (item) { return item.title.toLowerCase(); });
    var duePhrase = dueNames.length === 1
      ? 'the ' + dueNames[0] + ' is the part to book'
      : 'the ' + dueNames.slice(0, -1).join(', the ') + ' and the ' + dueNames[dueNames.length - 1] + ' are the parts to book';
    var friendly = due.length
      ? 'The house is fine to live in. ' + duePhrase.charAt(0).toUpperCase() + duePhrase.slice(1) + '.'
      : 'Nothing on this scan is marked due. The watch items can wait for a planned month.';
    var items = result.items.map(function (item) {
      var shot = state.health.shots[item.id];
      var thumb = shot && safeSrc(shot.src) ? '<div class="thumb">' + imgTag(shot.src, item.title) + '</div>' : '';
      var button = item.status === 'due'
        ? '<button type="button" class="btn btn-orange btn-block" data-action="quote" data-id="' + item.id + '">Get 3 verified quotes</button>'
        : '';
      return '<article class="card">' +
        '<div class="item-head"><h3>' + esc(item.title) + '</h3>' + statusPill(item.status) + '</div>' +
        thumb +
        '<p>' + esc(item.reading) + '</p>' +
        '<p class="value">' + randRange(item.low, item.high) + '<small>Estimated cost of the fix</small></p>' +
        '<p class="tiny">' + esc(item.costNote) + '</p>' +
        button +
      '</article>';
    }).join('');
    var quote = '';
    if (state.health.quoteFor) {
      var picked = result.items.filter(function (item) { return item.id === state.health.quoteFor; })[0];
      if (picked) quote = quotePanel(picked);
    }
    var timeline = result.timeline.map(function (row) {
      return '<li><span class="when">' + esc(row.when) + '</span><strong>' + esc(row.title) + '</strong><p>' + esc(row.text) + '</p></li>';
    }).join('');
    return (
      roleNote('homeowner') +
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Pretend household</p>' +
        '<h1>Home health</h1>' +
        '<p class="tiny">' + esc(HOME.owner) + ' · ' + esc(HOME.street) + ', ' + esc(HOME.area) + ', ' + esc(HOME.suburb) + ' · scanned ' + esc(result.scanned) + '</p>' +
        '<article class="card score-hero">' +
          '<div class="' + ringClass(result.score) + ' lg" style="--p:' + result.score + '" role="img" aria-label="Home health score ' + result.score + ' out of 100"><span>' + result.score + '</span></div>' +
          '<div><p class="kicker">Out of 100</p><h2>' + esc(result.label) + '</h2><p>' + esc(friendly) + '</p>' +
          '<p class="legend"><span class="pill pill-good">Good · leave it</span><span class="pill pill-watch">Watch · plan it</span><span class="pill pill-due">Due · book it</span></p></div>' +
        '</article>' +
        '<div class="health-grid">' +
          '<div class="stack">' + items + quote + '</div>' +
          '<article class="card"><h2>12-month timeline</h2><ol class="year">' + timeline + '</ol>' +
          '<p class="tiny">Ranges include typical labour and VAT. They are not quotes. A contractor prices the real job after they win the lead.</p></article>' +
        '</div>' +
        '<p class="row"><button type="button" class="btn btn-ghost" data-action="health-restart">Scan again</button><a class="btn btn-ghost" href="#/">Back home</a></p>' +
      '</section>'
    );
  }

  function quotePanel(item) {
    var job = quoteJob(item);
    var shot = state.health.shots[item.id];
    var photos = shot && shot.kind !== 'skip' ? '1 photo · ' + (shot.kind === 'sample' ? 'sample ' : '') + item.title.toLowerCase() : 'No photo';
    return (
      '<article class="card quote-panel" id="quote-panel">' +
        '<p class="pill">Pre-filled lead · demo only</p>' +
        '<h2>What a contractor would receive</h2>' +
        '<p>Three verified trades can bid tokens for this. It has not been posted.</p>' +
        '<ul class="split-list">' +
          '<li><strong>Job</strong>' + esc(job.title) + '</li>' +
          '<li><strong>Trade</strong>' + esc(item.trade) + '</li>' +
          '<li><strong>Shown before they pay</strong>' + esc(job.suburb) + ' · ' + esc(photos) + ' · ' + esc(job.note) + '</li>' +
          '<li><strong>Suggested opening bid</strong>' + job.tokens + ' tokens · about ' + rand(job.tokens * TOKEN_RAND) + '</li>' +
          '<li><strong>Unlocked only if they win a place</strong>' + esc(HOME.owner) + ' · ' + esc(HOME.phone) + ' · ' + esc(HOME.street) + '</li>' +
        '</ul>' +
        '<p class="notice"><strong>Demo only.</strong> No lead was posted and no contractor was notified. On the live app the top three each pay their own bid, then quote you directly.</p>' +
        '<button type="button" class="btn btn-ghost" data-action="close-quote">Close this preview</button>' +
      '</article>'
    );
  }

  function viewClaim() {
    if (state.claim.phase === 'ask') return viewClaimAsk();
    if (state.claim.phase === 'think') {
      var insurer = findInsurer(state.claim.insurer);
      var name = insurer ? insurer.name : 'the insurer';
      return thinkBlock(
        'Building the claim pack',
        'Notes and photos stay in this tab. This is not a claim lodged with ' + name + '.',
        [
          'Reading when it happened',
          'Matching a typical burst-geyser pattern',
          'Listing damage a ' + name + ' assessor usually asks about',
          'Drafting the document checklist',
          'Preparing a note for PIRB plumbers in ' + HOME.suburb
        ],
        'claim'
      );
    }
    var packLink = state.claim.phase === 'pack'
      ? '<a class="btn btn-teal btn-block" href="#/claim/pack">Open the claim pack</a>'
      : '';
    return (
      roleNote('homeowner') +
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Burst geyser</p>' +
        '<h1>Insurance claim helper</h1>' +
        '<p class="lede">A pretend ' + esc(weekday(NOW).toLowerCase()) + ' at ' + esc(HOME.street) + ', ' + esc(HOME.suburb) + '. The geyser has burst. Answer a few questions and the demo drafts a pack.</p>' +
        '<p class="notice"><strong>Not insurance advice.</strong> Insurers decide claims. Multiquoters does not. This helper only lines up notes, photos and a plumber.</p>' +
        '<div class="stack">' +
          packLink +
          '<button type="button" class="btn btn-teal btn-block" data-action="claim-start">Answer the questions</button>' +
          '<button type="button" class="btn btn-ghost btn-block" data-action="claim-sample">Use the sample burst story</button>' +
        '</div>' +
      '</section>'
    );
  }

  function viewClaimAsk() {
    var step = state.claim.step || 0;
    if (step < 0) step = 0;
    if (step > 3) step = 3;
    var body = '';
    var title = '';
    var lede = '';
    var ready = false;
    if (step === 0) {
      title = 'When did it happen?';
      lede = 'Pick the closest story. You can go back and change it.';
      ready = !!state.claim.when;
      body = WHEN.map(function (option) {
        var on = state.claim.when === option.id;
        return '<button type="button" class="choice-btn' + (on ? ' is-on' : '') + '" data-action="pick-when" data-id="' + option.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"><strong>' + esc(option.title) + '</strong><span>' + esc(option.detail) + '</span></button>';
      }).join('');
    } else if (step === 1) {
      title = 'What happened?';
      lede = 'This sets the damage list in the pack. It is still a demo story.';
      ready = !!state.claim.what;
      body = WHAT.map(function (option) {
        var on = state.claim.what === option.id;
        return '<button type="button" class="choice-btn' + (on ? ' is-on' : '') + '" data-action="pick-what" data-id="' + option.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"><strong>' + esc(option.title) + '</strong><span>' + esc(option.detail) + '</span></button>';
      }).join('');
    } else if (step === 2) {
      title = 'Who is the insurer?';
      lede = 'The checklist changes a little for each one. The decision stays with them.';
      ready = !!state.claim.insurer;
      body = INSURERS.map(function (option) {
        var on = state.claim.insurer === option.id;
        return '<button type="button" class="choice-btn' + (on ? ' is-on' : '') + '" data-action="pick-insurer" data-id="' + option.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"><strong>' + esc(option.name) + '</strong><span>' + esc(option.extra) + '</span></button>';
      }).join('');
    } else {
      title = 'Photos of the damage';
      lede = 'Add your own, or use the sample drawings. You can build the pack with none, and the checklist will still ask for them.';
      ready = true;
      var thumbs = state.claim.photos.map(function (photo) {
        var image = safeSrc(photo.src) ? imgTag(photo.src, photo.name) : '<p class="tiny">Preview cleared</p>';
        return '<div class="thumb">' + image + '<p class="tiny">' + esc(photo.name) + '</p>' +
          '<button type="button" class="btn btn-ghost btn-small" data-action="remove-photo" data-id="' + esc(photo.id) + '">Remove</button></div>';
      }).join('');
      body = '<div class="thumbs">' + thumbs + '</div>' +
        '<label class="btn btn-ghost btn-block file-btn">Upload or take photos<input type="file" accept="image/*" multiple data-action="claim-photos" aria-label="Upload or take photos of the damage"></label>' +
        '<button type="button" class="btn btn-teal btn-block" data-action="sample-damage">Use sample damage photos</button>';
    }
    return (
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Question ' + (step + 1) + ' of 4</p>' +
        '<h1>' + esc(title) + '</h1>' +
        '<p class="lede">' + esc(lede) + '</p>' +
        '<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="' + (step + 1) + '" aria-label="Question ' + (step + 1) + ' of 4"><span style="width:' + ((step + 1) * 25) + '%"></span></div>' +
        '<div class="stack">' + body +
          '<button type="button" class="btn btn-teal btn-block" data-action="claim-next"' + (ready ? '' : ' disabled') + '>' + (step === 3 ? 'Build the claim pack' : 'Continue') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-block" data-action="claim-back">' + (step === 0 ? 'Back to the intro' : 'Back') + '</button>' +
          (ready ? '' : '<p class="tiny">Choose one to continue.</p>') +
        '</div>' +
      '</section>'
    );
  }

  function damageLines() {
    if (state.claim.what === 'drip') {
      return [
        'Bathroom ceiling rose and a small ring of board',
        'One cupboard shelf under the rose',
        'Possible stain on the bathroom floor'
      ];
    }
    if (state.claim.what === 'collapse') {
      return [
        'Bathroom ceiling board, about 3 m², on the floor',
        'Insulation that came down with the board',
        'Extractor fan and one light fitting',
        'Splash on the bath edge and the floor'
      ];
    }
    return [
      'Passage ceiling board, about 4 m², stained and soft',
      'Gypsum cornice along that passage',
      'Laminate flooring in the passage, still wet',
      'Linen stored in the airing cupboard',
      'One passage light fitting'
    ];
  }

  function incidentSummary() {
    var when = findWhen(state.claim.when) || WHEN[1];
    var what = findWhat(state.claim.what) || WHAT[0];
    return 'At ' + HOME.street + ', ' + HOME.area + ', ' + HOME.suburb + ': ' + when.detail + ' ' + what.detail + ' The household is ' + HOME.owner + ', in this demo.';
  }

  function likelyCause() {
    var geyser = state.health.result && state.health.result.items
      ? state.health.result.items.filter(function (item) { return item.id === 'geyser'; })[0]
      : null;
    var ageBit = geyser && geyser.year
      ? ' The home-health scan on this demo house read a cylinder from ' + (geyser.sample ? '03/2014' : geyser.year) + ', about ' + ageInOctober(geyser.year, geyser.sample ? 3 : 6) + ' years old.'
      : ' A label photo would give the insurer the cylinder’s age. Many burst units are past ten years.';
    var powerBit = state.claim.when === 'power'
      ? ' It was reported just after the power returned, which is a familiar moment for a stuck thermostat or element: the water overheats, pressure rises, and a seam or fitting lets go.'
      : ' A stuck thermostat or element can overheat the water until a seam or fitting lets go. Load-shedding restarts make that pattern more common.';
    return 'Likely pattern, not a finding.' + powerBit + ageBit + ' The insurer does not have to accept this note.';
  }

  function viewClaimPack() {
    if (state.claim.phase !== 'pack' || !state.claim.when || !state.claim.what || !state.claim.insurer) {
      return '<section><p class="kicker"><span class="demo-tag">Demo</span></p><h1>No claim pack yet</h1><p class="lede">Answer the four questions first.</p><a class="btn btn-teal" href="#/claim">Open the claim helper</a></section>';
    }
    var insurer = findInsurer(state.claim.insurer);
    var checks = DOCS.map(function (doc) {
      var on = state.claim.checked.indexOf(doc.id) !== -1;
      return '<label class="check"><input type="checkbox" data-action="check-doc" data-doc="' + doc.id + '"' + (on ? ' checked' : '') + '> <span>' + esc(doc.label) + '</span></label>';
    }).join('');
    var photos = state.claim.photos.length
      ? '<div class="thumbs">' + state.claim.photos.map(function (photo) {
          return '<div class="thumb">' + (safeSrc(photo.src) ? imgTag(photo.src, photo.name) : '') + '<p class="tiny">' + esc(photo.name) + (photo.sample ? ' · sample' : '') + '</p></div>';
        }).join('') + '</div>'
      : '<p>No photos yet. The checklist still asks for them before repair.</p>';
    var photoNote = state.claim.photos.some(function (p) { return !p.sample; })
      ? 'Photos you added are described from your answers, not from a real reading of the pictures.'
      : 'The pictures in this pack are sample drawings.';
    var sent = state.claim.sent
      ? '<article class="card note-teal"><h2>Ready for verified PIRB plumbers</h2><p><strong>Demo only. Nobody was notified.</strong></p><ul class="split-list">' +
          '<li><strong>What they would see before paying</strong>Burst geyser · ' + esc(HOME.suburb) + ' · ' + state.claim.photos.length + ' photos · insurer ' + esc(insurer.name) + ' so they know a pack is coming.</li>' +
          '<li><strong>Token guide</strong>Emergency leads like this open around 12–18 tokens (about R240–R360).</li>' +
          '<li><strong>Still hidden</strong>' + esc(HOME.owner) + ', ' + esc(HOME.phone) + ', and the street number, until they finish in the top three.</li>' +
        '</ul></article>'
      : '<button type="button" class="btn btn-orange btn-block" data-action="send-plumbers" data-testid="send-plumbers">Send to verified PIRB plumbers</button>';
    var steps = [
      { title: 'Pack drafted', text: 'Just now, in this demo.', done: true },
      { title: 'PIRB plumbers', text: state.claim.sent ? 'Marked as sent. No message left this browser.' : 'You choose when to send the note.', done: state.claim.sent },
      { title: 'Quote attached', text: 'Within 48 hours a real quote would replace the placeholder.', done: false },
      { title: 'You submit to ' + insurer.name, text: 'Multiquoters does not lodge the claim.', done: false },
      { title: insurer.name + ' decides', text: 'Accept, query, or decline. That is their call.', done: false }
    ];
    return (
      roleNote('homeowner') +
      '<section>' +
        '<p class="kicker"><span class="demo-tag">Demo</span> Pretend claim</p>' +
        '<h1>Claim pack</h1>' +
        '<p class="notice"><strong>Not insurance advice.</strong> This is a tidy bundle of notes for ' + esc(insurer.name) + '. They decide the claim. Multiquoters does not approve, reject, or pay it.</p>' +
        '<div class="pack-grid">' +
          '<div class="stack">' +
            '<article class="card"><h2>Incident summary</h2><p>' + esc(incidentSummary()) + '</p><p class="tiny">' + esc(photoNote) + '</p>' + photos + '</article>' +
            '<article class="card"><h2>Likely cause</h2><p>' + esc(likelyCause()) + '</p></article>' +
            '<article class="card"><h2>Damage list</h2><ul>' + damageLines().map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul>' +
            '<p class="tiny">A placeholder list from the story you picked. An assessor confirms it on site.</p></article>' +
          '</div>' +
          '<div class="stack">' +
            '<article class="card"><p class="pill pill-orange">Placeholder</p><h2>Approved-contractor quote</h2>' +
            '<p>Supply and fit a 150 L electric geyser to SANS 10254, with a new vacuum breaker, drip tray and two connectors. Ceiling and flooring are excluded. Those are a builder’s job.</p>' +
            '<p class="value">R7,400 – R9,800<small>Allowance, including VAT. Not a quote.</small></p>' +
            '<p class="tiny">No PIRB plumber has priced this. The range holds a place in the pack until a verified contractor sends a real one.</p></article>' +
            '<article class="card"><h2>Documents ' + esc(insurer.name) + ' usually wants</h2>' +
            '<p class="tiny">Tick them as you collect them. The ticks stay in this browser only.</p>' +
            checks +
            '<p><strong>Also for ' + esc(insurer.name) + '.</strong> ' + esc(insurer.extra) + '</p></article>' +
          '</div>' +
        '</div>' +
        '<article class="card"><h2>Timeline</h2><ol class="year">' +
          steps.map(function (step) {
            return '<li><span class="when">' + (step.done ? 'Done' : 'Next') + '</span><strong>' + esc(step.title) + '</strong><p>' + esc(step.text) + '</p></li>';
          }).join('') +
        '</ol></article>' +
        sent +
        '<p class="notice"><strong>Again, not insurance advice.</strong> A claim pack does not create cover. ' + esc(insurer.name) + ' assesses the policy, the excess and the cause. If you are unsure, phone them before anyone repairs.</p>' +
        '<p class="row"><button type="button" class="btn btn-ghost" data-action="claim-edit">Change answers</button><button type="button" class="btn btn-ghost" data-action="claim-restart">Start over</button></p>' +
      '</section>'
    );
  }

  function renderView(path) {
    if (path === '/') return viewHome();
    if (path === '/radar') return viewRadar();
    if (path === '/health') return viewHealth();
    if (path === '/health/result') return viewHealthResult();
    if (path === '/claim') return viewClaim();
    if (path === '/claim/pack') return viewClaimPack();
    return '<section><h1>That page is not in the demo</h1><p><a href="#/">Back to the start</a></p></section>';
  }

  function mountThink() {
    var node = document.querySelector('[data-think]');
    if (!node || node.getAttribute('data-started') === '1') return;
    node.setAttribute('data-started', '1');
    var gen = ++thinkGen;
    var items = Array.prototype.slice.call(node.querySelectorAll('li'));
    var next = node.getAttribute('data-next');
    var status = node.querySelector('[data-think-status]');
    var i = 0;
    var delay = reduced() ? 40 : 680;
    function tick() {
      if (gen !== thinkGen) return;
      if (i >= items.length) {
        completeThink(next);
        return;
      }
      items.forEach(function (li, n) {
        li.classList.toggle('done', n < i);
        li.classList.toggle('on', n === i);
      });
      if (status && items[i]) status.textContent = items[i].textContent;
      i += 1;
      window.setTimeout(tick, delay);
    }
    window.setTimeout(tick, reduced() ? 20 : 280);
  }

  function completeThink(next) {
    if (next === 'radar') {
      state.radar.phase = 'ready';
      commit();
      return;
    }
    if (next === 'health') {
      state.health.result = buildHealth();
      state.health.phase = 'result';
      state.health.quoteFor = null;
      persist();
      if (currentPath() !== '/health/result') location.hash = '#/health/result';
      else render();
      return;
    }
    if (next === 'claim') {
      state.claim.phase = 'pack';
      state.claim.sent = false;
      persist();
      if (currentPath() !== '/claim/pack') location.hash = '#/claim/pack';
      else render();
    }
  }

  function render() {
    var path = currentPath();
    var pathChanged = path !== lastPath;
    lastPath = path;
    if (pathChanged) thinkGen += 1;
    var view = document.getElementById('view');
    var html = renderView(path);
    view.innerHTML = html;
    document.getElementById('subnav').innerHTML = renderNav();
    document.getElementById('bottom-nav').innerHTML = renderNav();
    syncRole();
    document.title = pageTitle(path);
    if (pathChanged) window.scrollTo(0, 0);
    if (pathChanged || focusH1) {
      focusH1 = false;
      focusMain();
    }
    if (state.scrollTo) {
      var target = document.getElementById(state.scrollTo);
      state.scrollTo = null;
      if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
    mountThink();
  }

  function commit(opts) {
    if (opts && opts.focus) focusH1 = true;
    persist();
    render();
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('type'));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('size'));
        return;
      }
      var ok = (file.type && file.type.indexOf('image/') === 0) || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
      if (!ok) {
        reject(new Error('type'));
        return;
      }
      if (/heic|heif/i.test(file.type || '') || /\.heic$|\.heif$/i.test(file.name || '')) {
        resolve('');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('read')); };
      reader.readAsDataURL(file);
    });
  }

  function useSample(slot) {
    var step = STEPS.filter(function (s) { return s.id === slot; })[0];
    if (!step) return;
    state.health.shots[slot] = { kind: 'sample', name: step.sampleName, src: step.sample, size: 0 };
    commit();
  }

  function addSampleDamage() {
    var samples = [
      { name: 'Sample ceiling stain', src: 'samples/ceiling.svg' },
      { name: 'Sample wet floor', src: 'samples/floor.svg' }
    ];
    samples.forEach(function (sample) {
      if (state.claim.photos.some(function (p) { return p.src === sample.src; })) return;
      if (state.claim.photos.length >= 6) return;
      state.claim.photos.push({ id: uid('p'), name: sample.name, src: sample.src, sample: true });
    });
    commit();
  }

  function startSampleHealth() {
    STEPS.forEach(function (step) {
      state.health.shots[step.id] = { kind: 'sample', name: step.sampleName, src: step.sample, size: 0 };
    });
    state.health.phase = 'think';
    state.health.step = STEPS.length - 1;
    state.health.quoteFor = null;
    if (currentPath() !== '/health') go('#/health');
    else commit();
  }

  function startSampleClaim() {
    state.claim.when = 'power';
    state.claim.what = 'bang';
    state.claim.insurer = 'santam';
    state.claim.photos = [
      { id: uid('p'), name: 'Sample ceiling stain', src: 'samples/ceiling.svg', sample: true },
      { id: uid('p'), name: 'Sample wet floor', src: 'samples/floor.svg', sample: true }
    ];
    state.claim.checked = [];
    state.claim.sent = false;
    state.claim.phase = 'think';
    state.claim.step = 3;
    if (currentPath() !== '/claim') go('#/claim');
    else commit();
  }

  function onClick(event) {
    var btn = event.target.closest('[data-action]');
    if (!btn || btn.tagName === 'INPUT') return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'role') {
      state.role = btn.getAttribute('data-role') === 'contractor' ? 'contractor' : 'homeowner';
      commit();
      return;
    }
    if (action === 'replay-radar') {
      state.radar.phase = 'think';
      commit();
      return;
    }
    if (action === 'suburb') {
      state.radar.suburb = id === 'all' || state.radar.suburb === id ? 'all' : id;
      commit();
      return;
    }
    if (action === 'signal') {
      state.radar.signal = state.radar.signal === id ? 'all' : id;
      commit();
      return;
    }
    if (action === 'ask-claim') {
      state.radar.confirm = id;
      commit();
      return;
    }
    if (action === 'cancel-claim') {
      state.radar.confirm = null;
      commit();
      return;
    }
    if (action === 'confirm-claim') {
      var lead = findLead(id);
      if (!lead || state.claimed.indexOf(id) !== -1) return;
      if (state.tokens < lead.tokens) {
        toast('Not enough pretend tokens in the demo wallet.');
        return;
      }
      state.tokens -= lead.tokens;
      state.claimed.push(id);
      state.radar.confirm = null;
      toast('Pretend hold placed. Nothing was charged.');
      commit();
      return;
    }
    if (action === 'release') {
      var held = findLead(id);
      if (!held || state.claimed.indexOf(id) === -1) return;
      state.claimed = state.claimed.filter(function (item) { return item !== id; });
      state.tokens += held.tokens;
      toast('Pretend tokens returned to the demo wallet.');
      commit();
      return;
    }
    if (action === 'health-start') {
      state.health.phase = 'scan';
      state.health.step = 0;
      commit({ focus: true });
      return;
    }
    if (action === 'health-sample') {
      startSampleHealth();
      return;
    }
    if (action === 'health-restart') {
      state.health = { phase: 'intro', step: 0, shots: {}, result: null, quoteFor: null };
      go('#/health');
      persist();
      return;
    }
    if (action === 'use-sample') {
      useSample(btn.getAttribute('data-slot'));
      return;
    }
    if (action === 'clear-shot') {
      delete state.health.shots[btn.getAttribute('data-slot')];
      commit();
      return;
    }
    if (action === 'skip-shot') {
      state.health.shots[btn.getAttribute('data-slot')] = { kind: 'skip', name: 'Skipped', src: '', size: 0 };
      commit();
      return;
    }
    if (action === 'scan-next') {
      var slot = STEPS[state.health.step];
      if (!slot || !state.health.shots[slot.id]) return;
      if (state.health.step >= STEPS.length - 1) {
        state.health.phase = 'think';
        commit();
        return;
      }
      state.health.step += 1;
      commit({ focus: true });
      return;
    }
    if (action === 'scan-back') {
      if (state.health.step === 0) {
        state.health.phase = 'intro';
        commit({ focus: true });
        return;
      }
      state.health.step -= 1;
      commit({ focus: true });
      return;
    }
    if (action === 'quote') {
      state.health.quoteFor = id;
      state.scrollTo = 'quote-panel';
      commit();
      return;
    }
    if (action === 'close-quote') {
      state.health.quoteFor = null;
      commit();
      return;
    }
    if (action === 'claim-start') {
      state.claim.phase = 'ask';
      state.claim.step = 0;
      commit({ focus: true });
      return;
    }
    if (action === 'claim-sample') {
      startSampleClaim();
      return;
    }
    if (action === 'pick-when') {
      state.claim.when = id;
      commit();
      return;
    }
    if (action === 'pick-what') {
      state.claim.what = id;
      commit();
      return;
    }
    if (action === 'pick-insurer') {
      state.claim.insurer = id;
      commit();
      return;
    }
    if (action === 'claim-next') {
      if (state.claim.step === 0 && !state.claim.when) return;
      if (state.claim.step === 1 && !state.claim.what) return;
      if (state.claim.step === 2 && !state.claim.insurer) return;
      if (state.claim.step >= 3) {
        state.claim.phase = 'think';
        state.claim.sent = false;
        commit();
        return;
      }
      state.claim.step += 1;
      commit({ focus: true });
      return;
    }
    if (action === 'claim-back') {
      if (state.claim.step === 0) {
        state.claim.phase = 'intro';
        commit({ focus: true });
        return;
      }
      state.claim.step -= 1;
      commit({ focus: true });
      return;
    }
    if (action === 'sample-damage') {
      addSampleDamage();
      return;
    }
    if (action === 'remove-photo') {
      state.claim.photos = state.claim.photos.filter(function (photo) { return photo.id !== id; });
      commit();
      return;
    }
    if (action === 'send-plumbers') {
      state.claim.sent = true;
      toast('Demo only. No plumber was notified.');
      commit();
      return;
    }
    if (action === 'claim-edit') {
      state.claim.phase = 'ask';
      state.claim.step = 0;
      go('#/claim');
      persist();
      return;
    }
    if (action === 'claim-restart') {
      state.claim = { phase: 'intro', step: 0, when: null, what: null, insurer: null, photos: [], checked: [], sent: false };
      go('#/claim');
      persist();
    }
  }

  function onChange(event) {
    var input = event.target;
    if (!input || !input.getAttribute) return;
    var action = input.getAttribute('data-action');
    if (action === 'shot') {
      var file = input.files && input.files[0];
      var slot = input.getAttribute('data-slot');
      readPhoto(file).then(function (src) {
        state.health.shots[slot] = { kind: 'upload', name: file.name || 'Photo', src: src, size: file.size || 1 };
        toast(src ? 'Photo added. Analysis will be simulated.' : 'Photo added. This browser may not preview it. Analysis is still simulated.');
        commit();
      }).catch(function (err) {
        toast(err.message === 'size' ? 'Please choose a photo under 8 MB.' : err.message === 'type' ? 'Please choose a photo.' : 'That photo could not be read.');
      });
      return;
    }
    if (action === 'claim-photos') {
      var files = Array.prototype.slice.call(input.files || []);
      var room = 6 - state.claim.photos.length;
      if (room <= 0) {
        toast('Six photos is enough for this demo pack.');
        return;
      }
      Promise.all(files.slice(0, room).map(function (file) {
        return readPhoto(file).then(function (src) {
          return { id: uid('p'), name: file.name || 'Photo', src: src, sample: false, size: file.size || 1 };
        });
      })).then(function (photos) {
        state.claim.photos = state.claim.photos.concat(photos);
        toast('Photos added. The damage list still comes from your answers.');
        commit();
      }).catch(function (err) {
        toast(err.message === 'size' ? 'Please choose photos under 8 MB each.' : 'Please choose photo files.');
      });
      return;
    }
    if (action === 'check-doc') {
      var doc = input.getAttribute('data-doc');
      var set = state.claim.checked.filter(function (item) { return item !== doc; });
      if (input.checked) set.push(doc);
      state.claim.checked = set;
      persist();
    }
  }

  function resetAll() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    state = freshState();
    thinkGen += 1;
    toast('Demo reset. Pretend wallet is full again.');
    if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/';
    else render();
  }

  document.body.addEventListener('click', onClick);
  document.body.addEventListener('change', onChange);
  document.getElementById('reset-demo').addEventListener('click', resetAll);
  window.addEventListener('hashchange', render);
  render();
})();
