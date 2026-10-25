/* Corner & Co — a South African business sim with a living town.
   Figures are game values, not advice. */
(function () {
  'use strict';

  var SAVE_KEY = 'corner-co-save';
  var COLS = 40;
  var ROWS = 30;
  var TILE = 16;
  var WORLD_W = COLS * TILE;
  var WORLD_H = ROWS * TILE;
  var ZOOMS = [2, 3, 4];

  var DIFFS = {
    easy: { name: 'Easy', cash: 40000, rent: 0.55, demand: 1.15, wage: 700, bust: 10, bail: 8000, events: 0.22, rate: 0.12 },
    normal: { name: 'Normal', cash: 28000, rent: 1, demand: 1, wage: 850, bust: 6, bail: 4000, events: 0.36, rate: 0.2 },
    hard: { name: 'Hard', cash: 18000, rent: 1.28, demand: 0.9, wage: 980, bust: 4, bail: 0, events: 0.5, rate: 0.28 }
  };
  var GATES = {
    easy: { stock: 2, supplier: 3, hours: 4, staff: 5, upkeep: 6, bank: 7, travel: 8 },
    normal: { stock: 1, supplier: 2, hours: 3, staff: 4, upkeep: 5, bank: 5, travel: 6 },
    hard: { stock: 1, supplier: 1, hours: 1, staff: 1, upkeep: 1, bank: 1, travel: 1 }
  };
  var NEXT_TIP = {
    stock: 'Next week you choose the shelf. Too little and you miss sales. Too much food spoils.',
    supplier: 'Suppliers open soon. Cheap stock saves cash, then people bring it back.',
    hours: 'Hours open soon. Overtime serves more people and tires them out.',
    staff: 'Hiring opens soon. Do it when a queue forms. Wages are paid every week.',
    upkeep: 'Maintenance opens soon. Skip it and the fridges or the bakkie will fail.',
    bank: 'The bank opens soon. A loan is easy money until the interest stacks.',
    travel: 'Other towns open soon. Look around on the country map. Opening costs cash.'
  };

  var TOWNS = [
    { id: 'pol', name: 'Polokwane', map: 'Polokwane', mx: 86, my: 22, traffic: 92, rent: 0.9, blurb: 'A growing northern town. Rent is kinder than the cities.' },
    { id: 'pta', name: 'Pretoria', map: 'Pretoria', mx: 112, my: 52, traffic: 140, rent: 1.35, blurb: 'Offices and schools. Steady weekday trade.' },
    { id: 'jhb', name: 'Johannesburg', map: 'Joburg', mx: 78, my: 64, traffic: 176, rent: 1.7, blurb: 'The big pavement. Foot traffic and a landlord who knows it.' },
    { id: 'alex', name: 'Alexandra', map: 'Alexandra', mx: 128, my: 74, traffic: 112, rent: 0.85, blurb: 'Busy streets and kinder rent. A good place to start.' },
    { id: 'soweto', name: 'Soweto', map: 'Soweto', mx: 62, my: 86, traffic: 154, rent: 1.15, blurb: 'Weekend traffic. A shop here is rarely quiet.' },
    { id: 'dbn', name: 'Durban', map: 'Durban', mx: 138, my: 112, traffic: 158, rent: 1.35, blurb: 'Harbour town. People eat, and the air is wet.' },
    { id: 'bfn', name: 'Bloemfontein', map: 'Bloem', mx: 90, my: 124, traffic: 108, rent: 0.95, blurb: 'A central town. Loyal customers if you stay fair.' },
    { id: 'pe', name: 'Gqeberha', map: 'Gqeberha', mx: 108, my: 156, traffic: 102, rent: 0.9, blurb: 'The windy bay. Word of mouth travels.' },
    { id: 'cpt', name: 'Cape Town', map: 'Cape Town', mx: 42, my: 186, traffic: 168, rent: 1.85, blurb: 'Pricey pavement. Tourists and locals, both fussy.' }
  ];

  var TYPES = {
    spaza: {
      name: 'Spaza', kit: 'fridges', unit: 'sales',
      fair: 80, cost: { budget: 40, standard: 46, premium: 62 },
      elasticity: 1.7, spoil: 0.04, pull: 0.88, cap: 140, staffCap: 50,
      rent: 640, open: 5500, stocked: true, starter: 160,
      blurb: 'Bread, airtime and cool drinks. Regulars notice a bare shelf.'
    },
    takeaway: {
      name: 'Takeaway', kit: 'fryers', unit: 'plates',
      fair: 70, cost: { budget: 30, standard: 34, premium: 48 },
      elasticity: 1.85, spoil: 0.4, pull: 0.55, cap: 110, staffCap: 40,
      rent: 780, open: 8000, stocked: true, starter: 100,
      blurb: 'Kota and chips. Food that sits goes in the bin.'
    },
    trades: {
      name: 'Bakkie trades', kit: 'bakkie', unit: 'jobs',
      fair: 540, cost: { budget: 250, standard: 300, premium: 420 },
      elasticity: 1.1, spoil: 0, pull: 0.09, cap: 16, staffCap: 6,
      rent: 420, open: 9000, stocked: true, starter: 14,
      blurb: 'Small repair jobs. Bigger tickets, fewer customers.'
    },
    transport: {
      name: 'Deliveries', kit: 'bakkie', unit: 'drops',
      fair: 210, cost: { budget: 118, standard: 132, premium: 170 },
      elasticity: 1.35, spoil: 0, pull: 0.2, cap: 48, staffCap: 16,
      rent: 380, open: 9500, stocked: false, starter: 0,
      blurb: 'Drops across town. The bakkie costs money every trip.'
    },
    factory: {
      name: 'Workshop', kit: 'machines', unit: 'crates',
      fair: 180, cost: { budget: 88, standard: 102, premium: 130 },
      elasticity: 1.2, spoil: 0.06, pull: 0.42, cap: 52, staffCap: 22,
      rent: 1400, open: 22000, stocked: true, starter: 40,
      blurb: 'You make goods in batches. Rent is heavy until the crew grows.'
    },
    rooms: {
      name: 'Rooms', kit: 'building', unit: 'rooms let',
      fair: 740, cost: { budget: 50, standard: 80, premium: 140 },
      elasticity: 1.4, spoil: 0, pull: 0.026, cap: 6, staffCap: 0,
      rent: 0, open: 30000, stocked: false, starter: 0, rooms: true,
      blurb: 'Six rooms to let. Empty rooms still need upkeep.'
    }
  };

  var STARTS = [
    { id: 'spaza', type: 'spaza', town: 'alex', line: 'A spaza in Alexandra. Kinder rent, regulars, a fair profit if you change nothing.' },
    { id: 'takeaway', type: 'takeaway', town: 'soweto', line: 'A takeaway in Soweto. Busy, but food goes off if you overstock.' },
    { id: 'trades', type: 'trades', town: 'pta', line: 'A repair bakkie in Pretoria. Fewer jobs, bigger cheques.' },
    { id: 'transport', type: 'transport', town: 'jhb', line: 'Deliveries in Johannesburg. The bakkie drinks money every drop.' }
  ];

  var NAMES = ['Thabo', 'Lerato', 'Ayesha', 'Pieter', 'Nomsa', 'Johan', 'Fatima', 'Sipho', 'Zanele', 'Ruan'];
  var SHIRTS = ['#2f6b3a', '#3a78c2', '#c4473a', '#e0a020', '#6b4c9a', '#1c2614'];

  var cashEl = document.getElementById('cash');
  var whenEl = document.getElementById('when');
  var repEl = document.getElementById('repchip');
  var skyEl = document.getElementById('skyname');
  var logEl = document.getElementById('log');
  var hintEl = document.getElementById('hint');
  var muteEl = document.getElementById('mute');
  var mapBtn = document.getElementById('mapbtn');
  var sheetEl = document.getElementById('sheet');
  var panelEl = document.getElementById('panel');
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');

  var cityCanvas = document.createElement('canvas');
  cityCanvas.width = WORLD_W;
  cityCanvas.height = WORLD_H;
  var cityCtx = cityCanvas.getContext('2d');
  var countryCanvas = document.createElement('canvas');
  countryCanvas.width = 180;
  countryCanvas.height = 210;
  var countryCtx = countryCanvas.getContext('2d');

  var state, city, audioCtx = null;
  var viewMode = 'city';
  var sheet = null;
  var panel = null;
  var placeId = 'alex';
  var zoom = 2;
  var cam = { x: WORLD_W / 2, y: WORLD_H / 2 };
  var travel = null;
  var popups = [];
  var particles = [];
  var smokeUntil = 0;
  var uiDirty = true;
  var lastSheet = '';
  var lastPanel = '';
  var domWrites = 0;
  var fps = 0;
  var frames = 0;
  var fpsStamp = 0;
  var acc = 0;
  var lastT = 0;
  var view = { cssW: 1, cssH: 1, dpr: 1, sized: false };
  var drops = [];
  var di;
  for (di = 0; di < 40; di++) drops.push({ x: Math.random(), y: Math.random(), v: 0.35 + Math.random() * 0.5 });

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function diff() { return DIFFS[state.difficulty] || DIFFS.easy; }
  function townBy(id) {
    for (var i = 0; i < TOWNS.length; i++) if (TOWNS[i].id === id) return TOWNS[i];
    return TOWNS[0];
  }
  function R(n) {
    var v = Math.round(n);
    var sign = v < 0 ? '-' : '';
    return sign + 'R' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function priceMul(p) { return p === 'low' ? 0.88 : p === 'high' ? 1.18 : 1; }
  function unlocked(key) {
    var g = GATES[state.difficulty] || GATES.easy;
    return state.week >= (g[key] || 1);
  }
  function nextLock() {
    var order = ['stock', 'supplier', 'hours', 'staff', 'upkeep', 'bank', 'travel'];
    for (var i = 0; i < order.length; i++) if (!unlocked(order[i])) return order[i];
    return null;
  }

  function fresh() {
    var rivals = {};
    var seeded = {
      jhb: ['spaza', 'takeaway', 'transport'],
      cpt: ['spaza', 'takeaway', 'rooms'],
      dbn: ['takeaway', 'spaza'],
      pta: ['trades'],
      soweto: ['takeaway'],
      bfn: ['spaza'],
      pe: ['spaza']
    };
    TOWNS.forEach(function (t) {
      rivals[t.id] = (seeded[t.id] || []).map(function (type) {
        return { type: type, price: 1, weeks: 0 };
      });
    });
    return {
      v: 2,
      week: 1,
      cash: DIFFS.easy.cash,
      loan: 0,
      difficulty: 'easy',
      speed: 0,
      sound: true,
      helpSeen: false,
      started: false,
      bankrupt: false,
      overdrawn: 0,
      bailed: false,
      nameIx: 0,
      nextId: 1,
      economy: 1,
      economyWeeks: 0,
      economyLabel: 'steady',
      branches: [],
      rivals: rivals,
      news: [],
      history: [],
      pending: null,
      shock: null,
      mods: [],
      focus: null,
      town: 'alex',
      triedPrice: false,
      triedSupplier: false,
      fuelTaxWeeks: 0,
      log: 'Drag the town. Tap your shop.'
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var data = JSON.parse(raw);
      if (!data || data.v !== 2 || !data.rivals) return fresh();
      return data;
    } catch (e) { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function log(msg) { state.log = msg; uiDirty = true; }
  function pushNews(text, kind) {
    state.news.unshift({ week: state.week, text: text, kind: kind || 'note' });
    if (state.news.length > 40) state.news.pop();
  }

  function tone(freq, dur, vol) {
    if (!state.sound || !audioCtx || audioCtx.state !== 'running') return;
    try {
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol || 0.03, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function unlock() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

  function branchBy(id) {
    for (var i = 0; i < state.branches.length; i++) if (state.branches[i].id === id) return state.branches[i];
    return null;
  }
  function focused() { return branchBy(state.focus); }
  function branchHere(town) {
    town = town || state.town;
    var pick = null;
    for (var i = 0; i < state.branches.length; i++) {
      if (state.branches[i].town === town) {
        if (state.branches[i].id === state.focus) return state.branches[i];
        if (!pick) pick = state.branches[i];
      }
    }
    return pick;
  }
  function makeBranch(typeId, townId) {
    var t = TYPES[typeId];
    var b = {
      id: state.nextId++,
      type: typeId,
      town: townId,
      price: 'fair',
      supplier: 'standard',
      order: 'fit',
      marketing: 0,
      brand: 0,
      stock: t.starter,
      staff: [],
      maintenance: 86,
      compliance: 'ok',
      service: true,
      hours: 'normal',
      reputation: 58,
      morale: 78,
      steepWeeks: 0,
      cheapWeeks: 0,
      pace: 0,
      prevDemand: 0,
      lastDemand: 0,
      lastServed: 0,
      lastShare: 1,
      lastSurplus: 0,
      prevCap: 0,
      weeks: 0,
      contractLeft: 0,
      batchWeeks: 0,
      generator: false,
      guard: false,
      gated: false,
      justBroke: false
    };
    state.branches.push(b);
    state.focus = b.id;
    state.town = townId;
    return b;
  }

  function shockHits(b) {
    if (!state.shock) return false;
    if (state.shock.all) return true;
    return !!(b && state.shock.branchId === b.id);
  }
  function skillAvg(b) {
    if (!b.staff.length) return 58;
    var s = 0;
    b.staff.forEach(function (p) { s += p.skill; });
    return s / b.staff.length;
  }
  function qualityOf(b) {
    var q = { budget: 0.3, standard: 0.68, premium: 0.9 }[b.supplier];
    q += (skillAvg(b) - 55) / 220;
    if (unlocked('upkeep')) q -= (100 - b.maintenance) / 520;
    if (b.morale < 40) q -= 0.08;
    if (b.hours === 'push') q -= 0.05;
    if (b.batchWeeks > 0) q -= 0.2;
    if (shockHits(b) && state.shock.quality) q += state.shock.quality;
    return clamp(q, 0.15, 0.98);
  }
  function returnsOf(q) { return clamp(0.22 - q * 0.24, 0.03, 0.2); }
  function capacityOf(b) {
    var t = TYPES[b.type];
    var cap = t.cap;
    b.staff.forEach(function (p) { cap += t.staffCap * (0.7 + p.skill / 150); });
    if (b.hours === 'easy') cap *= 0.8;
    if (b.hours === 'push') cap *= 1.24;
    if (shockHits(b) && state.shock.capacity) cap += state.shock.capacity;
    return Math.max(1, cap);
  }
  function brandFactor(brand) { return 1 + 0.5 * (1 - Math.exp(-(brand || 0) / 3800)); }
  function repFactor(rep) { return 0.55 + (rep / 100) * 0.7; }
  function rivalsOf(town, type) {
    return (state.rivals[town] || []).filter(function (r) { return r.type === type; });
  }
  function rivalPressure(b) {
    var list = rivalsOf(b.town, b.type);
    if (!list.length) return { factor: 1, undercut: false, count: 0 };
    var mine = priceMul(b.price);
    var hit = 0, under = false;
    list.forEach(function (r) {
      hit += 0.1;
      if (r.price + 0.06 < mine) { hit += 0.1; under = true; }
    });
    return { factor: clamp(1 - hit, 0.55, 1), undercut: under, count: list.length };
  }
  function rentOf(b) {
    return Math.round(TYPES[b.type].rent * townBy(b.town).rent * diff().rent);
  }
  function weatherNow() {
    if (state.week < 4) return 'clear';
    return ['clear', 'clear', 'cloud', 'clear', 'rain', 'clear'][state.week % 6];
  }
  function willingDemand(b) {
    var t = TYPES[b.type];
    var town = townBy(b.town);
    var q = qualityOf(b);
    var level = priceMul(b.price);
    var i;
    for (i = 0; i < state.mods.length; i++) if (state.mods[i].priceMul) level *= state.mods[i].priceMul;
    var d = town.traffic * t.pull;
    d *= Math.pow(1 / Math.max(0.7, level), t.elasticity);
    d *= repFactor(b.reputation);
    d *= brandFactor(b.brand);
    d *= (0.62 + q * 0.55);
    d *= rivalPressure(b).factor;
    d *= state.economy || 1;
    d *= diff().demand;
    if (weatherNow() === 'rain') d *= 0.9;
    if (b.compliance === 'strict') d *= 1.03;
    for (i = 0; i < state.mods.length; i++) if (state.mods[i].demandMul) d *= state.mods[i].demandMul;
    if (shockHits(b) && state.shock.demandMul) d *= state.shock.demandMul;
    if (b.contractLeft > 0) d *= 1.35;
    return Math.max(0, d);
  }
  function unitPrice(b) {
    var level = priceMul(b.price);
    var i;
    for (i = 0; i < state.mods.length; i++) if (state.mods[i].priceMul) level *= state.mods[i].priceMul;
    return Math.max(1, Math.round(TYPES[b.type].fair * level));
  }
  function companyRep() {
    if (!state.branches.length) return 58;
    var s = 0;
    state.branches.forEach(function (b) { s += b.reputation; });
    return s / state.branches.length;
  }
  function companyMorale() {
    if (!state.branches.length) return 78;
    var s = 0;
    state.branches.forEach(function (b) { s += b.morale; });
    return s / state.branches.length;
  }
  function companyShare() {
    var yours = 0, theirs = 0;
    state.branches.forEach(function (b) {
      yours += b.lastDemand || 0;
      theirs += rivalDemand(b);
    });
    if (yours + theirs <= 0) return 1;
    return yours / (yours + theirs);
  }
  function rivalDemand(b) {
    var t = TYPES[b.type];
    var town = townBy(b.town);
    var d = 0;
    rivalsOf(b.town, b.type).forEach(function (r) {
      d += town.traffic * t.pull * 0.7 * Math.pow(1 / r.price, t.elasticity);
    });
    return d;
  }

  function resolveWeek() {
    var lines = [];
    var d = diff();
    if (state.shock && state.shock.cash) state.cash += state.shock.cash;
    var total = 0;
    state.branches.forEach(function (b) { total += simBranch(b, lines); });
    if (state.loan > 0) {
      var interest = state.loan * d.rate / 52;
      state.cash -= interest;
      total -= interest;
      lines.push('The loan took ' + R(interest) + ' in interest.');
    }
    if (state.cash < 0) {
      if (!state.bailed && d.bail) {
        state.cash += d.bail;
        state.bailed = true;
        state.overdrawn = 0;
        lines.push('The till went empty. Your uncle puts ' + R(d.bail) + ' in. He will not do that twice.');
      } else {
        state.overdrawn += 1;
        lines.push('The till is short (' + R(state.cash) + '). Week ' + state.overdrawn + ' under water.');
        if (state.overdrawn >= d.bust) {
          state.bankrupt = true;
          state.speed = 0;
          lines.push('The bank closes the doors.');
        }
      }
    } else state.overdrawn = 0;

    reactRivals(lines);
    var mods = [];
    state.mods.forEach(function (m) { m.weeks -= 1; if (m.weeks > 0) mods.push(m); });
    state.mods = mods;
    if (state.economyWeeks > 0) {
      state.economyWeeks -= 1;
      if (state.economyWeeks <= 0) {
        state.economy = 1;
        state.economyLabel = 'steady';
        lines.push('The town settles back to an ordinary week.');
      }
    }
    if (state.fuelTaxWeeks > 0) state.fuelTaxWeeks -= 1;
    state.branches.forEach(function (b) { if (b.contractLeft > 0) b.contractLeft -= 1; });

    state.history.push({
      week: state.week,
      profit: Math.round(total),
      cash: Math.round(state.cash),
      rep: Math.round(companyRep())
    });
    if (state.history.length > 16) state.history.shift();

    var i;
    for (i = lines.length - 1; i >= 0; i--) {
      var text = lines[i];
      var kind = 'note';
      if (/broke|fine|short|strike|left|empty|under water|closes|spoiled|uncle/.test(text)) kind = 'bad';
      if (/Sales \+|opened|profit|uncle puts|settles/.test(text)) kind = 'good';
      pushNews(text, kind);
    }
    var headline = lines[0] || 'A quiet week.';
    for (i = 0; i < lines.length; i++) {
      if (/uncle|closes the doors|under water/.test(lines[i])) headline = lines[i];
    }
    log(headline);
    var shown = branchHere() || state.branches[0];
    if (shown) spawnPopup((shown.lastSurplus >= 0 ? '+' : '') + R(shown.lastSurplus), true);
    if (shown && shown.justBroke) smokeUntil = nowMs() + 6000;
    state.shock = null;
    state.week += 1;
    if (total >= 0) tone(520, 0.08, 0.03);
    else tone(180, 0.1, 0.03);
    save();
    uiDirty = true;
    if (state.bankrupt) panel = 'bust';
    ensureCity(false);
    return total;
  }

  function simBranch(b, lines) {
    var t = TYPES[b.type];
    var name = t.name + ' in ' + townBy(b.town).name;
    b.weeks += 1;
    b.justBroke = false;
    var q = qualityOf(b);
    var demand = willingDemand(b);
    var cap = capacityOf(b);
    var cost = t.cost[b.supplier];
    if (b.batchWeeks > 0) cost = Math.round(cost * 0.72);
    var price = unitPrice(b);
    var cashAt = state.cash;
    var stockAt = b.stock * cost;

    if (t.stocked && b.pace && unlocked('stock')) {
      var target = b.pace;
      if (b.order === 'light') target *= 0.7;
      if (b.order === 'heavy') target *= 1.45;
      var want = Math.max(0, Math.round(target - b.stock));
      var afford = cost > 0 ? Math.floor(Math.max(0, state.cash) / cost) : 0;
      var buy = Math.min(want, afford);
      if (want > 0 && buy < want) lines.push(name + ' could only afford part of the order.');
      state.cash -= buy * cost;
      b.stock += buy;
    }

    var broke = false;
    if (unlocked('upkeep')) {
      if (b.service) {
        var bill = Math.round(280 * diff().rent);
        if (state.cash >= bill) {
          state.cash -= bill;
          b.maintenance = Math.min(100, b.maintenance + 24);
          if (state.week === (GATES[state.difficulty] || GATES.easy).upkeep) {
            lines.push('Servicing the ' + t.kit + ' at ' + name + ' cost ' + R(bill) + '. Skip it and things break.');
          }
        }
      } else b.maintenance = Math.max(0, b.maintenance - 14);
      if (b.maintenance < 40 && Math.random() < (40 - b.maintenance) / 70) broke = true;
    } else b.maintenance = Math.max(b.maintenance, 80);

    var struck = b.staff.length && b.morale < 28;
    var shelf = t.stocked ? b.stock : 1e9;
    var served = struck ? 0 : Math.min(demand, cap, shelf);
    if (broke) served *= 0.5;
    served = Math.floor(served);
    var ret = returnsOf(q);
    var revenue = served * (1 - ret) * price;
    state.cash += revenue;

    var spoiled = 0;
    if (t.stocked) {
      var left = Math.max(0, b.stock - served);
      spoiled = Math.floor(left * t.spoil);
      b.stock = Math.max(0, left - spoiled);
    }

    var wages = 0;
    b.staff.forEach(function (p) { wages += p.pay; });
    if (b.hours === 'push' && b.staff.length) wages = Math.round(wages * 1.15);
    if (b.hours === 'easy' && b.staff.length) wages = Math.round(wages * 0.9);
    if (b.guard) wages += 650;
    state.cash -= wages;
    var running = 0;
    if (!t.stocked && !t.rooms) {
      running = Math.round(served * cost);
      state.cash -= running;
    }
    var rent = rentOf(b);
    state.cash -= rent;
    state.cash -= b.marketing || 0;
    b.brand = b.brand * 0.84 + (b.marketing || 0);
    if (unlocked('upkeep')) {
      var comp = b.compliance === 'strict' ? 280 : b.compliance === 'cut' ? -120 : 0;
      state.cash -= comp;
    }
    var fine = 0;
    if (unlocked('upkeep') && b.compliance === 'cut' && Math.random() < 0.12) {
      fine = 1200 + Math.floor(Math.random() * 2200);
      state.cash -= fine;
      b.reputation = clamp(b.reputation - 5, 1, 99);
    }
    if (t.rooms) state.cash -= t.cap * cost;
    var fuelExtra = 0;
    if (state.fuelTaxWeeks > 0) {
      var rate = (b.type === 'transport' || b.type === 'trades') ? 0.16 : 0.05;
      fuelExtra = Math.round(served * cost * rate);
      state.cash -= fuelExtra;
    }
    var cheapBatch = b.batchWeeks > 0;
    if (b.batchWeeks > 0) b.batchWeeks -= 1;
    var surplus = (state.cash - cashAt) + (b.stock * cost - stockAt);

    var missed = 0;
    if (t.stocked && !struck && !broke) missed = Math.max(0, Math.floor(Math.min(demand, cap) - served));
    if (missed > 0 && missed < 8) missed = 0;
    var turned = !struck && !broke ? Math.max(0, Math.floor(demand - cap)) : 0;
    var causes = [];
    if (b.price === 'high' || priceMul(b.price) > 1.1) causes.push('your price is high');
    if (b.price === 'low') causes.push('your price is low');
    if (b._openedRival) causes.push('a rival opened nearby');
    else if (rivalPressure(b).undercut) causes.push('a rival is cheaper');
    if (missed > 4) causes.push('the shelf ran empty');
    if (b.supplier === 'budget' || cheapBatch) causes.push('cheap stock came back');
    if (broke) causes.push('something broke');
    if (struck) causes.push('the team downed tools');
    if (weatherNow() === 'rain') causes.push('rain kept people home');
    if (fuelExtra > 0) causes.push('fuel got dearer');
    if (b.hours === 'push') causes.push('overtime caused mistakes');
    if (shockHits(b) && state.shock.note) causes.push(state.shock.note);
    if (b.prevCap && cap + 1 < b.prevCap) causes.push('you have fewer hands');
    if (!causes.length) causes.push(b.price === 'fair' ? 'prices were fair' : 'trade was steady');
    causes = causes.slice(0, 3);

    var pct = null;
    if (b.lastServed > 5) pct = Math.round((served - b.lastServed) / b.lastServed * 100);
    var why = causes.join(' and ');
    if (pct != null && Math.abs(pct) >= 6) lines.push('Sales ' + (pct > 0 ? '+' : '') + pct + '% at ' + name + ' because ' + why + '.');
    else if (b.weeks === 1) lines.push('First week at ' + name + ': ' + served + ' ' + t.unit + '. You made ' + R(surplus) + '. ' + capFirst(why) + '.');
    else lines.push(name + ': ' + served + ' ' + t.unit + ', ' + R(surplus) + '. ' + capFirst(why) + '.');

    var drift = (q - 0.6) * 3.2;
    drift += b.price === 'high' ? -1.6 : b.price === 'low' ? 0.4 : 0.9;
    drift -= Math.max(0, ret - 0.08) * 12;
    if (missed > 8) drift -= 1.2;
    if (struck || broke) drift -= 2;
    drift = clamp(drift, -3, 3);
    b.reputation = clamp(b.reputation + drift, 1, 99);

    var morale = b.morale;
    var moraleWhy = '';
    if (b.staff.length) {
      var ratio = 0;
      b.staff.forEach(function (p) { ratio += p.pay / diff().wage; });
      ratio /= b.staff.length;
      if (ratio < 0.9) { morale -= 7; moraleWhy = 'pay is under the going rate'; }
      else if (ratio > 1.12) morale += 2;
      else morale += 1;
    } else morale += 0.4;
    if (b.hours === 'push') { morale -= 6; moraleWhy = moraleWhy || 'the week was overtime'; }
    if (b.hours === 'easy') morale += 4;
    if (demand > cap * 1.25 && b.hours !== 'easy') { morale -= 5; moraleWhy = moraleWhy || 'the counter was slammed'; }
    else morale += 0.6;
    if (broke) { morale -= 4; moraleWhy = moraleWhy || 'the breakdown made a mess'; }
    morale = clamp(morale, 0, 100);
    var beforeM = b.morale;
    b.morale = morale;

    if (struck) {
      lines.push('Staff at ' + name + ' struck. Nothing was sold. Pay or hours pushed morale too low.');
      b.morale = 48;
    } else if (b.staff.length && morale < 36 && Math.random() < 0.25) {
      var left = b.staff.pop();
      lines.push(left.name + ' resigned from ' + name + ' because morale fell to ' + Math.round(morale) + '.');
    }
    if (fine) lines.push('A ' + R(fine) + ' fine hit ' + name + ' because compliance was cut.');
    if (spoiled > 2) lines.push(spoiled + ' units spoiled at ' + name + '. Too much stock sat too long.');
    if (turned > 20 && unlocked('staff')) lines.push('A queue formed at ' + name + '. Hire, or some of those sales walk away.');
    if (broke) {
      b.justBroke = true;
      lines.push('The ' + t.kit + ' at ' + name + ' failed because maintenance was skipped.');
    }
    if (Math.abs(drift) >= 1.4) lines.push('Reputation at ' + name + ' moved ' + (drift >= 0 ? '+' : '') + drift.toFixed(1) + ' to ' + Math.round(b.reputation) + '. A name moves slowly.');
    if (b.staff.length && beforeM - b.morale >= 6 && moraleWhy) lines.push('Morale at ' + name + ' fell to ' + Math.round(b.morale) + ' because ' + moraleWhy + '.');

    b.lastShare = (demand + rivalDemand(b)) > 0 ? demand / (demand + rivalDemand(b)) : 1;
    b.lastDemand = demand;
    b.prevDemand = demand;
    var seen = Math.min(cap, weatherNow() === 'rain' ? demand / 0.9 : demand);
    if (struck || broke) seen = b.pace || Math.min(demand, cap);
    b.pace = b.pace ? Math.max(seen, b.pace * 0.9) : seen;
    b.lastServed = served;
    b.lastSurplus = surplus;
    b._openedRival = false;
    b.prevCap = cap;
    if (b.price === 'high') b.steepWeeks += 1; else b.steepWeeks = 0;
    if (b.price === 'low') b.cheapWeeks += 1; else b.cheapWeeks = 0;
    return surplus;
  }

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function reactRivals(lines) {
    state.branches.forEach(function (b) {
      var list = state.rivals[b.town];
      if (b.steepWeeks >= 3 && rivalsOf(b.town, b.type).length < 2) {
        list.push({ type: b.type, price: 1, weeks: 0 });
        b.steepWeeks = 0;
        b._openedRival = true;
        lines.push('A rival ' + TYPES[b.type].name.toLowerCase() + ' opened in ' + townBy(b.town).name + ' because your prices stayed high.');
      }
      if (b.cheapWeeks >= 3) {
        rivalsOf(b.town, b.type).forEach(function (r) { r.price = Math.max(0.82, +(r.price - 0.06).toFixed(2)); });
        if (rivalsOf(b.town, b.type).length) lines.push('A rival in ' + townBy(b.town).name + ' cut prices because you stayed cheap.');
        b.cheapWeeks = 0;
      }
    });
  }

  function maybeEvent() {
    if (state.week < 4) return null;
    if (Math.random() > diff().events) return null;
    var ids = ['power', 'fuel', 'theft', 'batch', 'economy'];
    return eventCard(ids[(Math.random() * ids.length) | 0]);
  }
  function eventCard(id) {
    var b = focused() || state.branches[0];
    var town = b ? townBy(b.town).name : 'town';
    if (id === 'power' && b && b.generator) return null;
    if (id === 'theft' && b && b.gated) return null;
    if (id === 'power') return {
      id: 'power', title: 'Load-shedding',
      body: 'The lights go in ' + town + '. What do you do?',
      choices: [
        { id: 'gen', label: 'Buy a generator · R4 500', detail: 'The shop stays open after today. The till hurts now.' },
        { id: 'close', label: 'Close early', detail: 'You lose the evening trade. People see you were honest.' },
        { id: 'dark', label: 'Trade in the dark', detail: 'Some sales, more waste, a worse name.' }
      ]
    };
    if (id === 'fuel') return {
      id: 'fuel', title: 'Fuel price hike',
      body: 'Diesel jumps. Deliveries feel it first.',
      choices: [
        { id: 'swallow', label: 'Swallow it', detail: 'Costs rise a little. Your price stays. Customers stay.' },
        { id: 'pass', label: 'Pass it on', detail: 'A short price bump. Some people flinch.' },
        { id: 'cut', label: 'Cut the far trips', detail: 'Fewer sales, you dodge the worst of the fuel.' }
      ]
    };
    if (id === 'theft') return {
      id: 'theft', title: 'A break-in',
      body: 'Someone tried the back door in ' + town + '.',
      choices: [
        { id: 'gate', label: 'Fit a gate · R2 200', detail: 'You lose nothing this time. The gate stays.' },
        { id: 'guard', label: 'Hire a night guard', detail: 'R650 a week from now. A small loss tonight.' },
        { id: 'hope', label: 'Replace the stock', detail: 'About R900 gone. It can happen again.' }
      ]
    };
    if (id === 'batch') return {
      id: 'batch', title: 'A cheap batch',
      body: 'A supplier offers goods well under the normal price. They will not say why.',
      choices: [
        { id: 'buy', label: 'Take the cheap batch', detail: 'Costs drop for two weeks. Quality drops. Returns follow.' },
        { id: 'no', label: 'Stick with your supplier', detail: 'No saving. No nasty surprise.' }
      ]
    };
    if (id === 'economy') {
      if (Math.random() < 0.5) return {
        id: 'economy', title: 'A busy week',
        body: 'Pay packets landed. People are spending.',
        choices: [
          { id: 'steady', label: 'Trade as you are', detail: 'You still feel a lift.' },
          { id: 'raise', label: 'Nudge prices up', detail: 'Fatter margin while the town is flush. Regulars notice.' },
          { id: 'ads', label: 'Push a poster · R800', detail: 'You catch more of the rush.' }
        ]
      };
      return {
        id: 'economy', title: 'A quiet week',
        body: 'Work is thinner. People are counting coins.',
        choices: [
          { id: 'hold', label: 'Hold your prices', detail: 'You keep the margin and lose some people.' },
          { id: 'discount', label: 'Discount for a bit', detail: 'More feet, less on each sale.' },
          { id: 'wages', label: 'Trim wages 10%', detail: 'The till breathes. Morale will not.' }
        ]
      };
    }
    return null;
  }

  function applyChoice(card, choice) {
    var b = focused() || state.branches[0];
    var shock = { note: '', demandMul: 1, quality: 0, capacity: 0, cash: 0, all: false, branchId: b ? b.id : null };
    if (card.id === 'power' && choice === 'gen') {
      shock.cash = -4500; shock.demandMul = 0.9; shock.note = 'you were fitting a generator'; if (b) b.generator = true;
    } else if (card.id === 'power' && choice === 'close') {
      shock.demandMul = 0.6; shock.note = 'you closed early in the dark'; if (b) b.reputation = clamp(b.reputation + 1, 1, 99);
    } else if (card.id === 'power' && choice === 'dark') {
      shock.demandMul = 0.78; shock.quality = -0.1; shock.note = 'you traded through load-shedding';
    } else if (card.id === 'fuel' && choice === 'swallow') {
      shock.all = true; state.fuelTaxWeeks = 2; shock.note = 'fuel went up and you swallowed it';
    } else if (card.id === 'fuel' && choice === 'pass') {
      shock.all = true; state.fuelTaxWeeks = 2; state.mods.push({ weeks: 3, priceMul: 1.06 }); shock.note = 'you passed the fuel hike on';
    } else if (card.id === 'fuel' && choice === 'cut') {
      shock.all = true; shock.demandMul = 0.8; shock.note = 'you cut the far trips after the fuel hike';
    } else if (card.id === 'theft' && choice === 'gate') {
      shock.cash = -2200; if (b) b.gated = true; shock.note = 'a new gate went on';
    } else if (card.id === 'theft' && choice === 'guard') {
      shock.cash = -300; if (b) b.guard = true; shock.note = 'a guard starts after a break-in';
    } else if (card.id === 'theft' && choice === 'hope') {
      shock.cash = -900; shock.note = 'stock was stolen';
    } else if (card.id === 'batch' && choice === 'buy') {
      if (b) b.batchWeeks = 2; shock.note = 'a cheap batch is on the shelf';
    } else if (card.id === 'batch' && choice === 'no') {
      shock.note = 'you skipped a cheap batch';
    } else if (card.id === 'economy' && choice === 'steady') {
      shock.all = true; state.economy = 1.08; state.economyWeeks = 3; state.economyLabel = 'busy'; shock.note = 'the town is spending';
    } else if (card.id === 'economy' && choice === 'raise') {
      shock.all = true; state.economy = 1.08; state.economyWeeks = 3; state.economyLabel = 'busy';
      state.mods.push({ weeks: 3, priceMul: 1.08 }); shock.note = 'prices are up while the town is flush';
    } else if (card.id === 'economy' && choice === 'ads') {
      shock.all = true; shock.cash = -800; state.economy = 1.1; state.economyWeeks = 3; state.economyLabel = 'busy';
      if (b) b.brand += 900; shock.note = 'you advertised into a busy week';
    } else if (card.id === 'economy' && choice === 'hold') {
      shock.all = true; state.economy = 0.88; state.economyWeeks = 3; state.economyLabel = 'quiet'; shock.note = 'you held prices in a quiet week';
    } else if (card.id === 'economy' && choice === 'discount') {
      shock.all = true; state.economy = 0.88; state.economyWeeks = 3; state.economyLabel = 'quiet';
      state.mods.push({ weeks: 3, priceMul: 0.92 }); shock.note = 'you discounted into a quiet week';
    } else if (card.id === 'economy' && choice === 'wages') {
      shock.all = true; state.economy = 0.88; state.economyWeeks = 3; state.economyLabel = 'quiet';
      state.branches.forEach(function (br) {
        br.staff.forEach(function (p) { p.pay = Math.max(500, Math.round(p.pay * 0.9 / 10) * 10); });
        br.morale = clamp(br.morale - 8, 0, 100);
      });
      shock.note = 'wages were cut in a quiet week';
    }
    state.shock = shock;
  }

  function runWeek() {
    if (state.bankrupt) return fail('The bank already closed the doors.');
    if (!state.started) return fail('Choose how you begin.');
    if (state.pending) return fail('Pick a way through the card first.');
    if (travel) return fail('Let the bakkie arrive first.');
    var card = maybeEvent();
    if (card) {
      state.pending = card;
      panel = 'card';
      log(card.title + '. Pick a way through it.');
      tone(330, 0.07, 0.03);
      save();
      uiDirty = true;
      return;
    }
    resolveWeek();
  }
  function fail(msg) { log(msg); tone(140, 0.08, 0.03); uiDirty = true; return false; }

  function choose(choice) {
    var card = state.pending;
    if (!card) return;
    state.pending = null;
    applyChoice(card, choice);
    if (panel === 'card') panel = null;
    resolveWeek();
  }

  function begin(id) {
    var spec = null;
    STARTS.forEach(function (s) { if (s.id === id) spec = s; });
    if (!spec || state.started) return;
    state.started = true;
    state.cash = diff().cash;
    makeBranch(spec.type, spec.town);
    placeId = spec.town;
    panel = null;
    viewMode = 'city';
    log('You open in ' + townBy(spec.town).name + '. Tap Run week.');
    tone(440, 0.08, 0.03);
    save();
    ensureCity(true);
    centerCam();
    uiDirty = true;
  }

  function openBranch(typeId) {
    var t = TYPES[typeId];
    var town = viewMode === 'country' ? (placeId || state.town) : state.town;
    var from = state.town;
    if (!t) return;
    if (!unlocked('travel') && town !== from) return fail('New towns open in week ' + (GATES[state.difficulty] || GATES.easy).travel + '.');
    if (!unlocked('travel') && state.branches.length) return fail('New shops open in week ' + (GATES[state.difficulty] || GATES.easy).travel + '.');
    if (state.branches.some(function (b) { return b.town === town && b.type === typeId; })) return fail('You already run that there.');
    var cost = openCost(t);
    if (state.cash < cost) return fail(t.name + ' needs ' + R(cost) + ' to open.');
    state.cash -= cost;
    var b = makeBranch(typeId, town);
    b.stock = Math.round(t.starter * 0.8);
    b.reputation = 52;
    pushNews('You opened a ' + t.name.toLowerCase() + ' in ' + townBy(town).name + '. Rent is ' + R(rentOf(b)) + ' a week.', 'good');
    log('Opened in ' + townBy(town).name + '.');
    tone(520, 0.08, 0.03);
    sheet = 'desk';
    save();
    if (from !== town) startTravel(town);
    else { ensureCity(true); centerCam(); }
    uiDirty = true;
  }
  function openCost(t) { return Math.round(t.open * (state.difficulty === 'easy' ? 0.75 : 1)); }

  function startTravel(id) {
    if (!townBy(id)) return;
    var a = townBy(state.town);
    var b = townBy(id);
    if (a.id === b.id && viewMode === 'city') { centerCam(); return; }
    travel = { x0: a.mx, y0: a.my, x1: b.mx, y1: b.my, t: 0, to: id };
    viewMode = 'country';
    sheet = null;
    uiDirty = true;
  }

  function act(name, arg) {
    if (name === 'speed') {
      state.speed = Number(arg) || 0;
      log(state.speed === 0 ? 'Paused. The town keeps moving.' : state.speed === 3 ? 'Weeks are moving fast.' : 'A week at a time.');
      save(); uiDirty = true; tone(300, 0.04, 0.02); buzz(); return;
    }
    if (name === 'run') { buzz(); return runWeek(); }
    if (name === 'view') {
      viewMode = arg === 'country' ? 'country' : 'city';
      if (viewMode === 'city') sheet = null;
      uiDirty = true; return;
    }
    if (name === 'sheet') {
      sheet = arg;
      if (arg === 'desk' && viewMode === 'country') viewMode = 'city';
      uiDirty = true; return;
    }
    if (name === 'close') { sheet = null; uiDirty = true; return; }
    if (name === 'help') { panel = 'help'; uiDirty = true; return; }
    if (name === 'close-help') {
      state.helpSeen = true;
      panel = state.started ? null : 'start';
      save(); uiDirty = true; return;
    }
    if (name === 'mute') {
      state.sound = !state.sound;
      if (state.sound) { unlock(); tone(660, 0.06, 0.03); }
      save(); uiDirty = true; return;
    }
    if (name === 'diff') { if (!state.started) { state.difficulty = arg; uiDirty = true; } return; }
    if (name === 'start') return begin(arg);
    if (name === 'choose') return choose(arg);
    if (name === 'travel') return startTravel(arg);
    if (name === 'place') { placeId = arg; sheet = 'place'; uiDirty = true; return; }
    if (name === 'focus') {
      state.focus = Number(arg);
      var br = branchBy(state.focus);
      if (br) state.town = br.town;
      sheet = 'desk';
      viewMode = 'city';
      ensureCity(true);
      centerCam();
      uiDirty = true;
      return;
    }
    if (name === 'open') return openBranch(arg);
    if (name === 'zoom') { zoomBy(Number(arg) || 1); return; }
    if (name === 'price' || name === 'supplier' || name === 'order' || name === 'ads' || name === 'comply' || name === 'hours') return setBranch(name, arg);
    if (name === 'service') return toggleService();
    if (name === 'hire') return hire();
    if (name === 'fire') return fireOne(Number(arg));
    if (name === 'payup' || name === 'paydown' || name === 'train') return staffAct(name, Number(arg));
    if (name === 'borrow') return borrow();
    if (name === 'repay') return repay(4000);
    if (name === 'reset-yes') return resetGame();
  }

  function setBranch(key, arg) {
    var b = focused();
    if (!b) return fail('Tap your shop first.');
    if (key === 'price' && !unlocked('price')) return;
    if (key === 'supplier' && !unlocked('supplier')) return fail('Suppliers are not open yet.');
    if (key === 'order' && !unlocked('stock')) return fail('Shelf orders open next week.');
    if (key === 'hours' && !unlocked('hours')) return fail('Hours open in a later week.');
    if ((key === 'ads' || key === 'comply') && !unlocked('upkeep')) return fail('That opens a bit later.');
    if (key === 'price') { b.price = arg; state.triedPrice = true; }
    if (key === 'supplier') { b.supplier = arg; state.triedSupplier = true; }
    if (key === 'order') b.order = arg;
    if (key === 'ads') b.marketing = Number(arg) || 0;
    if (key === 'comply') b.compliance = arg;
    if (key === 'hours') b.hours = arg;
    var notes = {
      low: 'Low prices bring more people and a thinner margin.',
      fair: 'Fair prices. The safe middle.',
      high: 'Higher prices: fewer people, more on each sale. Hold it and a rival opens.',
      budget: 'Cheap supplier. Lower cost, more returns.',
      standard: 'Ordinary supplier.',
      premium: 'Better goods. Higher cost, fewer complaints.',
      light: 'Light stock. Less cash tied up, more empty shelves.',
      fit: 'Order about what you can sell.',
      heavy: 'Heavy stock. You will not run out. Food can spoil.',
      easy: 'Shorter hours. The crew recovers. You serve fewer people.',
      normal: 'Ordinary hours.',
      push: 'Overtime. More sales, tired people, more mistakes.',
      cut: 'Cutting corners saves a little and risks a fine.',
      ok: 'Rules in order.',
      strict: 'By the book costs more and slowly builds trust.'
    };
    if (key === 'ads') log(arg === '0' ? 'No posters this week.' : 'Posters bring people in, then flatten if you keep paying.');
    else log(notes[arg] || 'Updated.');
    tone(360, 0.04, 0.02);
    save(); uiDirty = true;
  }
  function toggleService() {
    var b = focused();
    if (!b) return;
    if (!unlocked('upkeep')) return fail('Maintenance opens later. Until then the basics are covered.');
    b.service = !b.service;
    log(b.service ? 'You will service the ' + TYPES[b.type].kit + '.' : 'Maintenance skipped. Breakdowns get more likely.');
    save(); uiDirty = true;
  }
  function hire() {
    var b = focused();
    if (!b) return fail('Tap your shop first.');
    if (!unlocked('staff')) return fail('Hiring opens in week ' + (GATES[state.difficulty] || GATES.easy).staff + '.');
    if (TYPES[b.type].rooms) return fail('Rooms do not need a counter hand.');
    if (b.staff.length >= 4) return fail('Four people is a full crew here.');
    var wage = diff().wage;
    if (state.cash < wage * 3) return fail('Keep three weeks of wages in the till before you hire.');
    var person = { name: NAMES[state.nameIx++ % NAMES.length], skill: 48 + ((Math.random() * 18) | 0), pay: wage };
    b.staff.push(person);
    log(person.name + ' joins. ' + R(wage) + ' a week. You can serve more, and the wage never sleeps.');
    tone(400, 0.05, 0.03);
    save(); uiDirty = true;
  }
  function fireOne(ix) {
    var b = focused();
    if (!b || !b.staff[ix]) return;
    var person = b.staff.splice(ix, 1)[0];
    b.morale = clamp(b.morale - 4, 0, 100);
    log(person.name + ' is off the crew. The others noticed.');
    save(); uiDirty = true;
  }
  function staffAct(kind, ix) {
    var b = focused();
    if (!b || !b.staff[ix]) return;
    var p = b.staff[ix];
    if (kind === 'payup') {
      p.pay = Math.round(p.pay * 1.1 / 10) * 10;
      log(p.name + ' now earns ' + R(p.pay) + '. Morale likes it. The till does not.');
    } else if (kind === 'paydown') {
      p.pay = Math.max(500, Math.round(p.pay * 0.9 / 10) * 10);
      log(p.name + ' now earns ' + R(p.pay) + '. Underpaying drains morale, then people leave.');
    } else if (kind === 'train') {
      if (state.cash < 400) return fail('Training is R400.');
      state.cash -= 400;
      p.skill = Math.min(96, p.skill + 8);
      b.morale = clamp(b.morale + 3, 0, 100);
      log(p.name + ' trained. Skill ' + p.skill + '. Mistakes should ease.');
    }
    save(); uiDirty = true;
  }
  function borrow() {
    if (!unlocked('bank')) return fail('The bank opens in week ' + (GATES[state.difficulty] || GATES.easy).bank + '.');
    if (state.loan + 8000 > 60000) return fail('The bank stops at R60 000.');
    state.loan += 8000;
    state.cash += 8000;
    log('Borrowed R8 000. Interest is ' + Math.round(diff().rate * 100) + '% a year, every week, until it is gone.');
    tone(240, 0.07, 0.03);
    save(); uiDirty = true;
  }
  function repay(amount) {
    var n = Math.min(Math.round(amount), Math.round(state.loan), Math.round(state.cash));
    if (n <= 0) return fail('Nothing to repay.');
    state.loan -= n;
    state.cash -= n;
    log('Repaid ' + R(n) + '.');
    save(); uiDirty = true;
  }
  function resetGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    state = fresh();
    panel = 'help';
    sheet = null;
    viewMode = 'city';
    travel = null;
    popups = [];
    particles = [];
    log('A new till.');
    ensureCity(true);
    centerCam();
    uiDirty = true;
  }
  function zoomBy(dir) {
    var i = ZOOMS.indexOf(zoom);
    if (i < 0) i = 0;
    i = clamp(i + dir, 0, ZOOMS.length - 1);
    zoom = ZOOMS[i];
    clampCam();
    buzz();
  }

  function button(actName, label, arg, on, dis) {
    return '<button type="button" data-act="' + actName + '"' +
      (arg != null ? ' data-arg="' + esc(arg) + '"' : '') +
      (on ? ' class="on"' : '') +
      (dis ? ' disabled' : '') + '>' + label + '</button>';
  }
  function line(k, v) {
    return '<div class="split"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>';
  }

  function hintText() {
    if (!state.started) return 'Easy is the gentle start. Fair prices should make a profit if you just run the weeks.';
    if (state.pending) return 'A card is waiting. Your choice changes what happens next.';
    if (state.week <= 1) return 'Tap Run week. With fair prices this shop should make a profit.';
    if (state.week < 4 && !state.triedPrice) return 'Try raising the price a little. Fewer people come in, and each sale pays more.';
    var n = nextLock();
    if (n && state.week < 9) return NEXT_TIP[n];
    var b = branchHere();
    if (b && b.lastDemand > capacityOf(b) + 10) return 'A queue is forming. Hiring serves them. Wages are paid every week.';
    return '';
  }

  function helpHtml() {
    var label = state.helpSeen ? 'Back' : 'Start';
    return '<div class="how"><h2>How to play</h2>' +
      '<p>You start with money and one small shop. <b>Easy</b> is the gentle start. Fair prices should already make a profit.</p>' +
      '<p><b>Drag</b> the town. <b>Pinch</b> or use + and − to zoom. <b>Tap your shop</b> to run it. The country map sends a bakkie to other towns.</p>' +
      '<p>Tap <b>Run week</b>. The news says why sales moved, in one sentence. People walking in are your customers. A queue means you cannot serve them all.</p>' +
      '<p>Tools open over the first weeks: shelves, suppliers, staff, the bank, then other towns. On Easy, family helps once if the till runs dry.</p>' +
      '<p class="lede">Figures are game values. The speaker button mutes the beeps.</p>' +
      '<div class="how-go">' + button('close-help', label) + '</div></div>';
  }
  function startHtml() {
    var html = '<h2>How hard?</h2><p class="lede">Easy is selected for you. You can still change it.</p><div class="grid3">';
    ['easy', 'normal', 'hard'].forEach(function (id) {
      var d = DIFFS[id];
      html += button('diff', d.name + (id === 'easy' ? ' · best' : ''), id, state.difficulty === id);
    });
    html += '</div><p class="hint">Start cash ' + esc(R(diff().cash)) + '. ' +
      (state.difficulty === 'easy' ? 'Lower rent, a family bailout once, tools open slowly.' : state.difficulty === 'hard' ? 'Tighter cash, no bailout, every tool is open.' : 'A middle path.') +
      '</p><h2>Where do you begin?</h2><div class="choice">';
    STARTS.forEach(function (s) {
      html += '<article class="card"><h3>' + esc(TYPES[s.type].name) + '</h3><p class="hint">' + esc(s.line) + '</p>' +
        button('start', 'Start here', s.id) + '</article>';
    });
    html += '</div>';
    return html;
  }
  function cardHtml() {
    var c = state.pending;
    if (!c) return '';
    var html = '<h2>' + esc(c.title) + '</h2><p>' + esc(c.body) + '</p><div class="choice">';
    c.choices.forEach(function (ch) {
      html += '<article class="card"><h3>' + esc(ch.label) + '</h3><p class="hint">' + esc(ch.detail) + '</p>' +
        button('choose', 'Choose this', ch.id) + '</article>';
    });
    return html + '</div>';
  }
  function bustHtml() {
    return '<h2>The till is empty</h2><p>The bank has closed Corner &amp; Co.</p>' +
      '<p class="lede">On Easy, family helps once. After that, watch the cash, not only the queue.</p>' +
      button('reset-yes', 'Start again');
  }
  function deskHtml() {
    var b = focused();
    if (!b) return '<h2>Shop</h2><p>Tap your shop on the map.</p>' + button('close', 'Close');
    var t = TYPES[b.type];
    var html = '<h2>' + esc(t.name) + '</h2><p class="lede">' + esc(townBy(b.town).name) + ' · ' + esc(t.blurb) + '</p><div class="card">';
    html += line('Price', R(unitPrice(b)));
    html += line('Last week', b.weeks ? (b.lastServed + ' ' + t.unit + ' · ' + R(b.lastSurplus)) : 'Not run yet');
    html += line('People vs you can serve', b.weeks ? (Math.round(b.lastDemand) + ' / ' + Math.round(capacityOf(b))) : 'Run a week to see');
    html += line('Reputation', Math.round(b.reputation) + ' (moves slowly)');
    html += line('Morale', Math.round(b.morale) + (b.morale < 40 ? ' · low' : ''));
    if (t.stocked) html += line('Stock', String(Math.round(b.stock)));
    html += line('Rent', R(rentOf(b)) + ' / week');
    var rv = rivalsOf(b.town, b.type);
    html += line('Rivals on this street', rv.length ? String(rv.length) : 'None yet');
    html += '</div>';
    html += '<div class="section">Price</div><div class="grid3">' +
      button('price', 'Low', 'low', b.price === 'low') +
      button('price', 'Fair', 'fair', b.price === 'fair') +
      button('price', 'High', 'high', b.price === 'high') + '</div>';
    html += '<p class="hint">High price: fewer people at the door, more rand on each sale.</p>';
    if (unlocked('supplier')) {
      html += '<div class="section">Supplier</div><div class="grid3">' +
        button('supplier', 'Cheap', 'budget', b.supplier === 'budget') +
        button('supplier', 'Fair', 'standard', b.supplier === 'standard') +
        button('supplier', 'Better', 'premium', b.supplier === 'premium') + '</div>';
      html += '<p class="hint">Cheap stock saves cash and comes back as returns.</p>';
    }
    if (t.stocked && unlocked('stock')) {
      html += '<div class="section">Shelf</div><div class="grid3">' +
        button('order', 'Light', 'light', b.order === 'light') +
        button('order', 'Fit', 'fit', b.order === 'fit') +
        button('order', 'Heavy', 'heavy', b.order === 'heavy') + '</div>';
      html += '<p class="hint">' + (t.spoil > 0.2 ? 'Heavy stock ties up cash, then the food spoils.' : 'Light stock risks an empty shelf.') + '</p>';
    }
    if (unlocked('hours')) {
      html += '<div class="section">Hours</div><div class="grid3">' +
        button('hours', 'Short', 'easy', b.hours === 'easy') +
        button('hours', 'Normal', 'normal', b.hours === 'normal') +
        button('hours', 'Overtime', 'push', b.hours === 'push') + '</div>';
    }
    if (unlocked('staff') && !t.rooms) {
      html += '<div class="section">People</div>';
      if (!b.staff.length) html += '<p class="hint">It is only you. Hire when a queue forms outside.</p>';
      b.staff.forEach(function (p, i) {
        html += '<article class="card"><h3>' + esc(p.name) + ' <span>skill ' + p.skill + '</span></h3>';
        html += line('Pay', R(p.pay) + ' / week');
        html += '<div class="grid3">' + button('paydown', 'Pay less', String(i)) + button('payup', 'Pay more', String(i)) + button('train', 'Train', String(i)) + '</div>';
        html += button('fire', 'Let ' + esc(p.name) + ' go', String(i));
        html += '</article>';
      });
      html += button('hire', 'Hire · ' + R(diff().wage) + '/week', null, false, b.staff.length >= 4);
    }
    if (unlocked('upkeep')) {
      html += '<div class="section">Keep the doors open</div>';
      html += button('service', b.service ? 'Servicing the ' + t.kit : 'Service the ' + t.kit, null, b.service);
      html += '<div class="grid3">' +
        button('comply', 'Cut corners', 'cut', b.compliance === 'cut') +
        button('comply', 'In order', 'ok', b.compliance === 'ok') +
        button('comply', 'By the book', 'strict', b.compliance === 'strict') + '</div>';
      html += '<div class="section">Posters</div><div class="grid3">' +
        button('ads', 'None', '0', b.marketing === 0) +
        button('ads', 'R400', '400', b.marketing === 400) +
        button('ads', 'R1 200', '1200', b.marketing === 1200) + '</div>';
      html += '<p class="hint">Posters bring people, then flatten. Useless if a queue is already at the door.</p>';
    }
    var lock = nextLock();
    if (lock) html += '<p class="hint">' + esc(NEXT_TIP[lock]) + '</p>';
    html += button('run', 'Run the week');
    html += button('close', 'Close');
    return html;
  }
  function moneyHtml() {
    var last = state.history[state.history.length - 1];
    var month = 0, i;
    for (i = Math.max(0, state.history.length - 4); i < state.history.length; i++) month += state.history[i].profit;
    var html = '<h2>Books</h2><p class="lede">Profit counts stock still on the shelf. Cash drops when you buy that stock. Game values.</p>';
    html += '<p class="cashbig">' + esc(R(state.cash)) + '</p><p class="hint">Cash in the till</p><div class="card">';
    html += line('Last week', last ? R(last.profit) : '—');
    html += line('Last 4 weeks', state.history.length ? R(month) : '—');
    html += line('Reputation', Math.round(companyRep()) + ' / 100');
    html += line('Morale', Math.round(companyMorale()) + ' / 100');
    html += line('Market share', state.history.length ? Math.round(companyShare() * 100) + '%' : '—');
    html += line('Weather', weatherNow());
    html += '</div><div class="section">Profit, last weeks</div><div class="card"><div class="chart">';
    if (!state.history.length) html += '<p class="hint">Run a week and the bars appear.</p>';
    var max = 400;
    state.history.slice(-12).forEach(function (h) { max = Math.max(max, Math.abs(h.profit)); });
    state.history.slice(-12).forEach(function (h) {
      var hgt = Math.max(6, Math.round(Math.abs(h.profit) / max * 56));
      html += '<div class="bar ' + (h.profit >= 0 ? '' : 'down') + '" style="height:' + hgt + 'px"></div>';
    });
    html += '</div></div>';
    if (unlocked('bank')) {
      html += '<div class="section">Bank</div><div class="card">';
      html += line('Loan', R(state.loan));
      html += '<p class="hint">' + Math.round(diff().rate * 100) + '% a year, about ' + esc(R(state.loan * diff().rate / 52)) + ' a week. ' +
        (diff().bail && !state.bailed ? 'Family can help once if you go under.' : 'If the till stays empty too long, it is over.') + '</p>';
      html += button('borrow', 'Borrow R8 000', null, false, state.loan + 8000 > 60000);
      html += button('repay', 'Repay R4 000', null, false, state.loan <= 0 || state.cash <= 0);
      html += '</div>';
    } else html += '<p class="hint">The bank opens in week ' + (GATES[state.difficulty] || GATES.easy).bank + '.</p>';
    html += button('sheet', 'Read the news', 'news');
    html += button('reset-yes', 'Wipe this company');
    html += button('close', 'Close');
    return html;
  }
  function newsHtml() {
    var html = '<h2>News</h2><p class="lede">Why the numbers moved. Newest first.</p>';
    if (!state.news.length) html += '<p>Run a week. The town will start talking.</p>';
    state.news.forEach(function (n) {
      html += '<article class="card news"><h3>Week ' + n.week + '</h3><p class="' + (n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : '') + '">' + esc(n.text) + '</p></article>';
    });
    html += button('close', 'Close');
    return html;
  }
  function placeHtml() {
    var town = townBy(placeId || state.town);
    var mine = state.branches.filter(function (b) { return b.town === town.id; });
    var html = '<h2>' + esc(town.name) + '</h2><p class="status">' + esc(town.blurb) + '</p>';
    if (town.id !== state.town || viewMode === 'country') html += button('travel', 'Travel there', town.id);
    mine.forEach(function (b) {
      html += button('focus', TYPES[b.type].name + ' · yours', String(b.id));
    });
    if (!mine.length) html += '<p class="hint">You have no shop here yet.</p>';
    if (unlocked('travel')) {
      html += '<p class="hint">Open another line. You pay once, then rent every week.</p>';
      Object.keys(TYPES).forEach(function (id) {
        var t = TYPES[id];
        var have = mine.some(function (b) { return b.type === id; });
        html += button('open', t.name + ' · ' + R(openCost(t)), id, false, have || state.cash < openCost(t));
      });
    } else html += '<p class="hint">You can look. Opening a new shop waits until week ' + (GATES[state.difficulty] || GATES.easy).travel + '.</p>';
    html += button('close', 'Close');
    return html;
  }
  function rivalHtml() {
    var town = townBy(state.town);
    var list = state.rivals[town.id] || [];
    var html = '<h2>Rival shop</h2><p>Someone else is trading on this street in ' + esc(town.name) + '.</p>';
    if (!list.length) html += '<p class="hint">The shutter is down.</p>';
    list.forEach(function (r) {
      var word = r.price < 0.9 ? 'cheap' : r.price > 1.08 ? 'high' : 'fair';
      html += '<article class="card"><h3>' + esc(TYPES[r.type] ? TYPES[r.type].name : 'Shop') + '</h3><p class="hint">Their prices look ' + word + '. They take some of the people who walk this street.</p></article>';
    });
    html += '<p class="hint">Stay expensive and another one can open. Stay very cheap and they cut prices back.</p>';
    html += button('close', 'Close');
    return html;
  }

  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

  function flushUI() {
    var startedCash = state.started ? state.cash : diff().cash;
    setText(cashEl, R(startedCash));
    setText(whenEl, 'Week ' + state.week + ' · ' + townBy(state.town).name);
    setText(repEl, 'Rep ' + Math.round(companyRep()));
    setText(logEl, state.log || '');
    setText(muteEl, state.sound ? '♪' : '✕');
    setText(mapBtn, viewMode === 'country' ? 'Town' : 'SA');
    if (mapBtn) mapBtn.setAttribute('data-arg', viewMode === 'country' ? 'city' : 'country');
    var hint = hintText();
    if (!hint) hintEl.setAttribute('hidden', '');
    else { hintEl.removeAttribute('hidden'); setText(hintEl, hint); }
    var speeds = document.querySelectorAll('.speeds button[data-act=speed]');
    for (var s = 0; s < speeds.length; s++) speeds[s].classList.toggle('on', Number(speeds[s].getAttribute('data-arg')) === state.speed);
    var navs = document.querySelectorAll('nav button');
    for (var n = 0; n < navs.length; n++) {
      var arg = navs[n].getAttribute('data-arg');
      var on = (arg === 'city' && viewMode === 'city' && !sheet) || (arg === 'country' && viewMode === 'country') ||
        (arg === 'desk' && sheet === 'desk') || (arg === 'money' && (sheet === 'money' || sheet === 'news'));
      navs[n].classList.toggle('on', on);
    }
    var pHtml = '';
    if (panel === 'help') pHtml = helpHtml();
    else if (panel === 'start') pHtml = startHtml();
    else if (panel === 'card') pHtml = cardHtml();
    else if (panel === 'bust') pHtml = bustHtml();
    if (panel) {
      panelEl.classList.add('open');
      if (pHtml !== lastPanel) { panelEl.innerHTML = pHtml; lastPanel = pHtml; domWrites++; }
    } else {
      panelEl.classList.remove('open');
      lastPanel = '';
    }
    var sHtml = '';
    if (sheet === 'desk') sHtml = deskHtml();
    else if (sheet === 'money') sHtml = moneyHtml();
    else if (sheet === 'news') sHtml = newsHtml();
    else if (sheet === 'place') sHtml = placeHtml();
    else if (sheet === 'rival') sHtml = rivalHtml();
    if (sheet) {
      sheetEl.classList.add('open');
      if (sHtml !== lastSheet) { sheetEl.innerHTML = sHtml; lastSheet = sHtml; domWrites++; }
    } else {
      sheetEl.classList.remove('open');
    }
  }

  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function ensureCity(force) {
    var here = state.branches.filter(function (b) { return b.town === state.town; });
    var rivals = (state.rivals[state.town] || []).length;
    var key = state.town + ':' + here.map(function (b) { return b.id; }).join(',') + ':' + rivals;
    if (!force && city && city.key === key) return;
    city = buildCity(state.town);
    city.key = key;
    paintCity(city);
  }

  function buildCity(townId) {
    var tiles = new Uint8Array(COLS * ROWS);
    var lights = [];
    var buildings = [];
    var roads = [];
    var x, y, i;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        var road = (x % 8 === 0) || (y % 6 === 0);
        tiles[y * COLS + x] = road ? 1 : 0;
      }
    }
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (tiles[y * COLS + x] !== 0) continue;
        var near = (x > 0 && tiles[y * COLS + x - 1] === 1) || (x + 1 < COLS && tiles[y * COLS + x + 1] === 1) ||
          (y > 0 && tiles[(y - 1) * COLS + x] === 1) || (y + 1 < ROWS && tiles[(y + 1) * COLS + x] === 1);
        if (near) tiles[y * COLS + x] = 2;
      }
    }
    function stamp(tx, ty, tw, th, kind, meta) {
      for (var yy = ty; yy < ty + th; yy++) {
        for (var xx = tx; xx < tx + tw; xx++) {
          if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS && tiles[yy * COLS + xx] !== 1) tiles[yy * COLS + xx] = kind === 'tree' ? 4 : 3;
        }
      }
      var rec = { x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE, kind: kind, tx: tx, ty: ty, tw: tw, th: th };
      if (meta) for (var k in meta) rec[k] = meta[k];
      buildings.push(rec);
      if (kind === 'house' || kind === 'player' || kind === 'rival') {
        lights.push({ x: tx * TILE + 6, y: ty * TILE + 10 });
        if (tw > 2) lights.push({ x: tx * TILE + tw * TILE - 10, y: ty * TILE + 10 });
      }
      return rec;
    }
    var mine = state.branches.filter(function (b) { return b.town === townId; });
    var mineSlots = [{ x: 18, y: 10 }, { x: 18, y: 16 }, { x: 10, y: 10 }];
    mine.forEach(function (b, idx) {
      var s = mineSlots[idx] || mineSlots[0];
      stamp(s.x, s.y, 3, 2, 'player', { branchId: b.id, type: b.type });
    });
    var rivalSlots = [{ x: 26, y: 10 }, { x: 26, y: 16 }, { x: 10, y: 16 }];
    (state.rivals[townId] || []).forEach(function (r, idx) {
      if (idx > 2) return;
      var s = rivalSlots[idx];
      stamp(s.x, s.y, 3, 2, 'rival', { type: r.type });
    });
    for (y = 1; y < ROWS - 2; y++) {
      for (x = 1; x < COLS - 2; x++) {
        if (x < 8 && y < 6) continue;
        var ok = true, yy, xx;
        for (yy = 0; yy < 2 && ok; yy++) for (xx = 0; xx < 2; xx++) if (tiles[(y + yy) * COLS + x + xx] !== 0) ok = false;
        var south = y + 2 < ROWS ? tiles[(y + 2) * COLS + x] : 0;
        if (!ok || (south !== 1 && south !== 2)) continue;
        if (((x * 5 + y * 3) % 7) === 0) continue;
        stamp(x, y, 2, 2, 'house', { roof: (x + y) % 4 });
        x += 1;
      }
    }
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (tiles[y * COLS + x] === 0 && ((x * 3 + y) % 4 === 0)) tiles[y * COLS + x] = 4;
        if (tiles[y * COLS + x] === 1 || tiles[y * COLS + x] === 2) roads.push(y * COLS + x);
      }
    }
    var door = null;
    buildings.forEach(function (b) {
      if (b.kind === 'player' && (!door || b.branchId === state.focus)) door = { x: b.tx + 1, y: b.ty + b.th };
    });
    if (!door) door = { x: 16, y: 12 };
    door.x = clamp(door.x, 0, COLS - 1);
    door.y = clamp(door.y, 0, ROWS - 1);
    var dist = new Int16Array(COLS * ROWS);
    dist.fill(-1);
    var qx = [door.x], qy = [door.y];
    dist[door.y * COLS + door.x] = 0;
    var qi = 0;
    while (qi < qx.length) {
      var cx = qx[qi], cy = qy[qi];
      qi++;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        var tile = tiles[ny * COLS + nx];
        if (tile !== 1 && tile !== 2) continue;
        if (dist[ny * COLS + nx] >= 0) continue;
        dist[ny * COLS + nx] = dist[cy * COLS + cx] + 1;
        qx.push(nx); qy.push(ny);
      }
    }
    var made = { key: townId, tiles: tiles, lights: lights, buildings: buildings, roads: roads, dist: dist, door: door, walkers: [] };
    seedWalkers(made);
    return made;
  }

  function paintCity(c) {
    var x, y, tile, px, py;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        tile = c.tiles[y * COLS + x];
        px = x * TILE; py = y * TILE;
        if (tile === 1) {
          cityCtx.fillStyle = '#6d6a62';
          cityCtx.fillRect(px, py, TILE, TILE);
          cityCtx.fillStyle = '#e6d48a';
          if (y % 6 === 0) cityCtx.fillRect(px + (x % 2 ? 2 : 8), py + 7, 4, 2);
          else cityCtx.fillRect(px + 7, py + (y % 2 ? 2 : 8), 2, 4);
        } else if (tile === 2) {
          cityCtx.fillStyle = '#d9d0bc';
          cityCtx.fillRect(px, py, TILE, TILE);
        } else if (tile === 4) {
          cityCtx.fillStyle = ((x + y) % 2) ? '#3e9a46' : '#348a3e';
          cityCtx.fillRect(px, py, TILE, TILE);
          cityCtx.fillStyle = '#246b32';
          cityCtx.fillRect(px + 5, py + 8, 6, 6);
          cityCtx.fillStyle = '#2f7d38';
          cityCtx.fillRect(px + 3, py + 2, 10, 8);
        } else {
          cityCtx.fillStyle = ((x + y) % 2) ? '#3e9a46' : '#348a3e';
          cityCtx.fillRect(px, py, TILE, TILE);
        }
      }
    }
    c.buildings.forEach(function (b) { paintBuilding(b); });
    c.tiles = c.tiles;
  }
  function paintBuilding(b) {
    var x = b.x, y = b.y, w = b.w, h = b.h;
    cityCtx.fillStyle = '#1c2614';
    cityCtx.fillRect(x, y, w, h);
    var wall = b.kind === 'house' ? ['#f0e2c4', '#e7d3b0', '#f7e7cf', '#e8d2b8'][b.roof || 0] : '#fff9ea';
    cityCtx.fillStyle = wall;
    cityCtx.fillRect(x + 1, y + 1, w - 2, h - 2);
    var roofs = ['#8d4b28', '#a85b32', '#6b442c', '#c47a3a'];
    cityCtx.fillStyle = b.kind === 'player' ? '#f0c14a' : b.kind === 'rival' ? '#c4473a' : roofs[b.roof || 0];
    cityCtx.fillRect(x + 1, y + 1, w - 2, b.kind === 'house' ? 8 : 6);
    if (b.kind !== 'house') {
      cityCtx.fillStyle = b.kind === 'player' ? '#217333' : '#fff9ea';
      var sx;
      for (sx = x + 2; sx < x + w - 3; sx += 4) cityCtx.fillRect(sx, y + 1, 2, 6);
    }
    cityCtx.fillStyle = '#7eb6e0';
    cityCtx.fillRect(x + 4, y + 10, 5, 5);
    if (w > 28) cityCtx.fillRect(x + w - 12, y + 10, 5, 5);
    cityCtx.fillStyle = '#5c3a22';
    cityCtx.fillRect(x + ((w / 2) | 0) - 3, y + h - 9, 6, 8);
  }

  function seedWalkers(c) {
    var want = crowdTarget();
    var guard = 0;
    while (c.walkers.length < want && guard++ < 40) spawnWalker(c, true);
  }
  function crowdTarget() {
    var b = branchHere();
    var d = b && b.lastDemand ? b.lastDemand : 90;
    return clamp(Math.round(d / 8), 6, 16);
  }
  function spawnWalker(c, anywhere) {
    if (!c.roads.length) return;
    var guard = 0, cell = 0, tx, ty;
    while (guard++ < 24) {
      cell = c.roads[(Math.random() * c.roads.length) | 0];
      if (anywhere || c.dist[cell] > 6) break;
    }
    tx = cell % COLS;
    ty = (cell / COLS) | 0;
    c.walkers.push({
      x: tx * TILE + 4,
      y: ty * TILE + 4,
      tx: tx,
      ty: ty,
      shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
      wait: 0,
      home: false
    });
  }
  function stepDist(c, x, y, home) {
    var best = null;
    var cur = c.dist[y * COLS + x];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var nx = x + dirs[i][0], ny = y + dirs[i][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      var nd = c.dist[ny * COLS + nx];
      if (nd < 0) continue;
      if (!home && (best === null || nd < c.dist[best.y * COLS + best.x])) best = { x: nx, y: ny };
      if (home && nd > cur && (best === null || nd > c.dist[best.y * COLS + best.x])) best = { x: nx, y: ny };
    }
    return best;
  }

  function paintCountry() {
    var w = countryCanvas.width, h = countryCanvas.height, x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var land = onLand(x, y);
        countryCtx.fillStyle = land ? (y > 120 ? '#c4a24a' : ((x + y) % 5 === 0 ? '#2f7d38' : '#3e9a46')) : ((x + y) % 6 === 0 ? '#7ec4ea' : '#69b4e2');
        countryCtx.fillRect(x, y, 1, 1);
      }
    }
    function link(a, b) {
      countryCtx.strokeStyle = '#e6d48a';
      countryCtx.lineWidth = 2;
      countryCtx.beginPath();
      countryCtx.moveTo(a.mx, a.my);
      countryCtx.lineTo(b.mx, b.my);
      countryCtx.stroke();
    }
    var byId = {};
    TOWNS.forEach(function (t) { byId[t.id] = t; });
    link(byId.jhb, byId.pta);
    link(byId.jhb, byId.soweto);
    link(byId.jhb, byId.bfn);
    link(byId.bfn, byId.cpt);
    link(byId.jhb, byId.dbn);
    link(byId.bfn, byId.pe);
    link(byId.pta, byId.pol);
    TOWNS.forEach(function (t) {
      countryCtx.fillStyle = '#1c2614';
      countryCtx.fillRect(t.mx - 3, t.my - 3, 7, 7);
      countryCtx.fillStyle = '#fff9ea';
      countryCtx.fillRect(t.mx - 2, t.my - 2, 5, 5);
    });
  }
  function onLand(x, y) {
    var nx = x / 180 * 52, ny = y / 210 * 64;
    var spine = [[32, 4], [33, 14], [32, 24], [30, 36], [26, 48], [20, 58]];
    var east = [[33, 16], [42, 28], [46, 40], [40, 50], [34, 56]];
    var west = [[30, 28], [22, 36], [16, 46], [14, 56]];
    return nearLine(spine, nx, ny, 9) || nearLine(east, nx, ny, 6) || nearLine(west, nx, ny, 5);
  }
  function nearLine(pts, x, y, rad) {
    var i, s, best = 1e9;
    for (i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      var steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      for (s = 0; s <= steps; s++) {
        var px = ax + (bx - ax) * s / steps;
        var py = ay + (by - ay) * s / steps;
        var d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < best) best = d;
      }
    }
    return best <= rad * rad;
  }

  function centerCam() {
    var b = playerBuilding();
    if (b) { cam.x = b.x + b.w / 2; cam.y = b.y + b.h / 2; }
    else { cam.x = 18 * TILE; cam.y = 12 * TILE; }
    clampCam();
  }
  function playerBuilding() {
    if (!city) return null;
    var found = null;
    city.buildings.forEach(function (b) {
      if (b.kind === 'player' && (!found || b.branchId === state.focus)) found = b;
    });
    return found;
  }
  function clampCam() {
    var m = 40;
    cam.x = clamp(cam.x, m, WORLD_W - m);
    cam.y = clamp(cam.y, m, WORLD_H - m);
  }
  function queueCount() {
    var b = branchHere();
    if (!b || !b.weeks) return 0;
    var extra = b.lastDemand - capacityOf(b);
    if (extra < 12) return 0;
    return clamp(Math.round(extra / 12), 1, 6);
  }
  function spawnPopup(text, big) {
    var b = playerBuilding();
    popups.push({
      text: text,
      x: b ? b.x + b.w / 2 : cam.x,
      y: b ? b.y : cam.y,
      life: big ? 1.5 : 0.9,
      max: big ? 1.5 : 0.9,
      big: !!big
    });
    if (popups.length > 8) popups.shift();
  }
  function burstSmoke() {
    var b = playerBuilding();
    var i;
    for (i = 0; i < 8; i++) {
      particles.push({
        x: (b ? b.x + b.w / 2 : cam.x) + (Math.random() * 10 - 5),
        y: b ? b.y : cam.y,
        vy: -18 - Math.random() * 16,
        life: 0.8 + Math.random() * 0.6
      });
    }
  }

  function updateWorld(dt, now) {
    if (travel) {
      travel.t += dt / 0.9;
      if (travel.t >= 1) {
        state.town = travel.to;
        placeId = travel.to;
        travel = null;
        viewMode = 'city';
        ensureCity(true);
        centerCam();
        save();
        uiDirty = true;
      }
    }
    if (!city) return;
    var want = crowdTarget();
    if (city.walkers.length < want) spawnWalker(city, false);
    if (city.walkers.length > want + 2) city.walkers.pop();
    var speed = 34;
    city.walkers.forEach(function (w) {
      if (w.wait > 0) { w.wait -= dt; return; }
      var gx = w.tx * TILE + 6, gy = w.ty * TILE + 6;
      var dx = gx - w.x, dy = gy - w.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        var atDoor = w.tx === city.door.x && w.ty === city.door.y;
        if (!w.home && atDoor) {
          w.home = true;
          w.wait = 0.25;
          if (popups.length < 5 && Math.random() < 0.45) spawnPopup('+R', false);
          return;
        }
        var next = stepDist(city, w.tx, w.ty, w.home);
        if (!next || (w.home && city.dist[w.ty * COLS + w.tx] > 8)) w.dead = true;
        else { w.tx = next.x; w.ty = next.y; }
      } else {
        var step = Math.min(dist, speed * dt);
        w.x += dx / dist * step;
        w.y += dy / dist * step;
      }
    });
    var live = [];
    city.walkers.forEach(function (w) { if (!w.dead) live.push(w); });
    city.walkers = live;
    var pi;
    for (pi = particles.length - 1; pi >= 0; pi--) {
      particles[pi].life -= dt;
      particles[pi].y += particles[pi].vy * dt;
      particles[pi].vy *= 0.98;
      if (particles[pi].life <= 0) particles.splice(pi, 1);
    }
    for (pi = popups.length - 1; pi >= 0; pi--) {
      popups[pi].life -= dt;
      if (popups[pi].life <= 0) popups.splice(pi, 1);
    }
    if (smokeUntil > now && particles.length < 20 && Math.random() < 0.5) {
      var shop = playerBuilding();
      particles.push({
        x: (shop ? shop.x + shop.w * 0.7 : cam.x) + Math.random() * 6,
        y: shop ? shop.y + 2 : cam.y,
        vy: -22,
        life: 1
      });
    }
    for (di = 0; di < drops.length; di++) {
      drops[di].y += drops[di].v * dt;
      if (drops[di].y > 1) drops[di].y = 0;
    }
  }

  function dayPhase(now) { return (now / 12000) % 1; }
  function nightAlpha(p) {
    if (p < 0.55) return 0;
    if (p < 0.7) return (p - 0.55) / 0.15 * 0.48;
    if (p < 0.88) return 0.48;
    return 0.48 * (1 - (p - 0.88) / 0.12);
  }
  function skyWord(now) {
    var w = weatherNow();
    if (w === 'rain') return 'Rain';
    if (w === 'cloud') return 'Cloud';
    var p = dayPhase(now);
    if (nightAlpha(p) > 0.35) return 'Night';
    if (p >= 0.55 && p < 0.72) return 'Dusk';
    if (p >= 0.88) return 'Dawn';
    return 'Day';
  }

  function measure() {
    var w = canvas.clientWidth | 0;
    var h = canvas.clientHeight | 0;
    if (w < 2 || h < 2) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (view.sized && view.cssW === w && view.cssH === h && view.dpr === dpr) return;
    view.cssW = w;
    view.cssH = h;
    view.dpr = dpr;
    view.sized = true;
    var bw = Math.floor(w * dpr);
    var bh = Math.floor(h * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  }

  function draw(now) {
    if (!view.sized) return;
    var cssW = view.cssW, cssH = view.cssH, dpr = view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var weather = weatherNow();
    var phase = dayPhase(now);
    var sky = weather === 'rain' ? '#7e8b98' : weather === 'cloud' ? '#a9b7c4' : '#8ecaf2';
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);
    if (viewMode === 'country' || travel) drawCountry(cssW, cssH, now);
    else drawTown(cssW, cssH, now, phase, weather);
  }

  function drawTown(cssW, cssH, now, phase, weather) {
    var z = zoom;
    var ox = Math.round(cssW / 2 - cam.x * z);
    var oy = Math.round(cssH / 2 - cam.y * z);
    ctx.drawImage(cityCanvas, ox, oy, WORLD_W * z, WORLD_H * z);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(z, z);
    var shop = playerBuilding();
    if (shop) {
      ctx.globalAlpha = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(now / 280));
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(shop.x + 1, shop.y + 1, shop.w - 2, 3);
      ctx.globalAlpha = 1;
      var crew = 1;
      var br = branchBy(shop.branchId);
      if (br) crew += br.staff.length;
      var c;
      for (c = 0; c < crew; c++) {
        var bob = ((now / 180 + c) | 0) % 2;
        drawPerson(shop.x + 6 + (c % 3) * 12, shop.y + 12 + ((c / 3) | 0) * 8, SHIRTS[c % SHIRTS.length], bob);
      }
    }
    var qn = queueCount();
    var door = city.door;
    var q;
    for (q = 0; q < qn; q++) {
      drawPerson(door.x * TILE + 2, door.y * TILE + 2 + q * 9, '#c4473a', 0);
    }
    city.walkers.forEach(function (w) {
      drawPerson(w.x, w.y, w.shirt, ((now / 160 + w.x) | 0) % 2);
    });
    drawVehicles(now);
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#c5c8cc';
      ctx.fillRect(p.x | 0, p.y | 0, 4, 4);
      ctx.globalAlpha = 1;
    });
    if (nightAlpha(phase) > 0.15) {
      city.lights.forEach(function (L) {
        ctx.fillStyle = '#f0c14a';
        ctx.fillRect(L.x, L.y, 3, 3);
      });
    }
    ctx.restore();
    popups.forEach(function (p) {
      var sx = ox + p.x * z;
      var sy = oy + p.y * z - (1 - p.life / p.max) * 28;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = '#1c2614';
      ctx.font = (p.big ? '800 16px ' : '700 12px ') + 'system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, sx + 1, sy + 1);
      ctx.fillStyle = p.text.charAt(0) === '-' ? '#a33b32' : '#f0c14a';
      ctx.fillText(p.text, sx, sy);
      ctx.globalAlpha = 1;
    });
    var na = nightAlpha(phase);
    if (na > 0.02) {
      ctx.fillStyle = 'rgba(12, 22, 48, ' + na.toFixed(3) + ')';
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (weather === 'cloud' || weather === 'rain') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      var drift = (now / 40) % (cssW + 80);
      ctx.fillRect(drift - 80, 8, 70, 16);
      ctx.fillRect((drift * 0.6) % (cssW + 60) - 40, 28, 50, 12);
    }
    if (weather === 'rain') {
      ctx.fillStyle = 'rgba(230,240,255,0.75)';
      for (di = 0; di < drops.length; di++) {
        var rx = drops[di].x * cssW;
        var ry = drops[di].y * cssH;
        ctx.fillRect(rx | 0, ry | 0, 2, 7);
      }
    }
    drawSun(now, phase, weather);
  }

  function drawPerson(x, y, shirt, bob) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect((x + 1) | 0, (y + 11) | 0, 6, 2);
    ctx.fillStyle = '#f0c8a0';
    ctx.fillRect((x + 2) | 0, y | 0, 4, 4);
    ctx.fillStyle = shirt;
    ctx.fillRect((x + 1) | 0, (y + 4) | 0, 6, 5);
    ctx.fillStyle = '#243044';
    ctx.fillRect((x + 1) | 0, (y + 9) | 0, 2, 3 + bob);
    ctx.fillRect((x + 5) | 0, (y + 9) | 0, 2, 3 + (1 - bob));
  }
  function drawVehicles(now) {
    var loops = [
      { y: 6 * TILE + 3, speed: 46, phase: 40, color: '#2f6b3a', you: false },
      { y: 12 * TILE + 3, speed: -38, phase: 220, color: '#c4473a', you: false },
      { y: 18 * TILE + 3, speed: 32, phase: 120, color: '#3a78c2', you: false }
    ];
    var mine = branchHere();
    if (mine && mine.type === 'transport') loops[0].you = true;
    if (mine && mine.type === 'trades') loops[0].color = '#f0c14a';
    loops.forEach(function (v) {
      var span = WORLD_W + 30;
      var px = ((now * 0.001 * v.speed) + v.phase) % span;
      if (px < 0) px += span;
      px -= 15;
      var dir = v.speed < 0 ? -1 : 1;
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(px | 0, v.y | 0, 20, 10);
      ctx.fillStyle = v.you ? '#f0c14a' : v.color;
      ctx.fillRect((px + 1) | 0, (v.y + 1) | 0, 18, 8);
      ctx.fillStyle = '#d7eefe';
      var cab = dir > 0 ? px + 12 : px + 2;
      ctx.fillRect(cab | 0, (v.y + 2) | 0, 5, 4);
      ctx.fillStyle = '#1c2614';
      ctx.fillRect((px + 2) | 0, (v.y + 8) | 0, 3, 3);
      ctx.fillRect((px + 14) | 0, (v.y + 8) | 0, 3, 3);
    });
  }
  function drawSun(now, phase, weather) {
    var x = 18, y = 18;
    if (weather === 'rain') { ctx.fillStyle = '#d7e0e8'; ctx.fillRect(x, y, 10, 10); return; }
    var night = nightAlpha(phase) > 0.3;
    ctx.fillStyle = night ? '#f4efe4' : '#f0c14a';
    ctx.fillRect(x, y, night ? 8 : 12, night ? 8 : 12);
    if (!night) {
      ctx.fillRect(x - 3, y + 4, 3, 3);
      ctx.fillRect(x + 12, y + 4, 3, 3);
      ctx.fillRect(x + 4, y - 3, 3, 3);
    }
  }

  function drawCountry(cssW, cssH) {
    var scale = Math.max(1, Math.floor(Math.min(cssW / 180, cssH / 210)));
    var ox = Math.floor((cssW - 180 * scale) / 2);
    var oy = Math.floor((cssH - 210 * scale) / 2);
    ctx.drawImage(countryCanvas, ox, oy, 180 * scale, 210 * scale);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    TOWNS.forEach(function (t) {
      var mine = state.branches.some(function (b) { return b.town === t.id; });
      var sx = ox + t.mx * scale;
      var sy = oy + t.my * scale;
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(sx - 3, sy - 3, 7, 7);
      ctx.fillStyle = mine ? '#f0c14a' : (t.id === state.town ? '#fff' : '#fff9ea');
      ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.fillStyle = '#1c2614';
      ctx.fillText(t.map, sx + 1, sy - 7);
      ctx.fillStyle = '#fffaf0';
      ctx.fillText(t.map, sx, sy - 8);
    });
    if (travel) {
      var p = travel.t < 0.5 ? 2 * travel.t * travel.t : 1 - Math.pow(-2 * travel.t + 2, 2) / 2;
      var tx = ox + (travel.x0 + (travel.x1 - travel.x0) * p) * scale;
      var ty = oy + (travel.y0 + (travel.y1 - travel.y0) * p) * scale;
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(tx - 7, ty - 5, 16, 10);
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(tx - 6, ty - 4, 14, 8);
    }
  }

  function screenToWorld(cx, cy) {
    var rect = canvas.getBoundingClientRect();
    var x = (cx - rect.left) * (view.cssW / rect.width);
    var y = (cy - rect.top) * (view.cssH / rect.height);
    return {
      x: cam.x + (x - view.cssW / 2) / zoom,
      y: cam.y + (y - view.cssH / 2) / zoom
    };
  }
  function onTap(cx, cy) {
    unlock();
    buzz();
    if (viewMode === 'country' || travel) {
      var rect = canvas.getBoundingClientRect();
      var scale = Math.max(1, Math.floor(Math.min(view.cssW / 180, view.cssH / 210)));
      var ox = Math.floor((view.cssW - 180 * scale) / 2);
      var oy = Math.floor((view.cssH - 210 * scale) / 2);
      var x = (cx - rect.left) * (view.cssW / rect.width);
      var y = (cy - rect.top) * (view.cssH / rect.height);
      var best = null, bestD = 1e9;
      TOWNS.forEach(function (t) {
        var dx = ox + t.mx * scale - x, dy = oy + t.my * scale - y;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = t; }
      });
      if (best && bestD < 36 * 36) {
        placeId = best.id;
        sheet = 'place';
        tone(480, 0.03, 0.02);
        uiDirty = true;
      }
      return;
    }
    var w = screenToWorld(cx, cy);
    var hit = null;
    if (city) city.buildings.forEach(function (b) {
      if (b.kind !== 'player' && b.kind !== 'rival') return;
      if (w.x >= b.x && w.y >= b.y && w.x <= b.x + b.w && w.y <= b.y + b.h) hit = b;
    });
    if (!hit) return;
    if (hit.kind === 'player') {
      state.focus = hit.branchId;
      sheet = 'desk';
      tone(480, 0.03, 0.02);
    } else {
      sheet = 'rival';
      tone(300, 0.04, 0.02);
    }
    uiDirty = true;
  }

  var pts = {};
  var ptN = 0;
  var moved = 0;
  var pinchDist = 0;
  function onDown(e) {
    if (!view.sized || panel) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    ptN++;
    if (ptN === 1) { moved = 0; pinchDist = 0; }
    unlock();
  }
  function pairDist() {
    var ks = Object.keys(pts);
    if (ks.length < 2) return 0;
    var a = pts[ks[0]], b = pts[ks[1]];
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function onMove(e) {
    var p = pts[e.pointerId];
    if (!p || viewMode === 'country') { if (p) { p.x = e.clientX; p.y = e.clientY; } return; }
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptN >= 2) {
      var d = pairDist();
      if (!pinchDist) pinchDist = d;
      else if (d > pinchDist * 1.28) { zoomBy(1); pinchDist = d; }
      else if (d < pinchDist * 0.78) { zoomBy(-1); pinchDist = d; }
      moved = 30;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    cam.x -= dx / zoom;
    cam.y -= dy / zoom;
    clampCam();
  }
  function onUp(e) {
    var tap = moved < 8 && ptN === 1 && pts[e.pointerId];
    if (pts[e.pointerId]) { delete pts[e.pointerId]; ptN = Math.max(0, ptN - 1); }
    if (tap) onTap(e.clientX, e.clientY);
    if (ptN === 0) { moved = 0; pinchDist = 0; }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  document.body.addEventListener('pointerup', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.disabled) return;
    if (b === canvas) return;
    unlock();
    buzz();
    act(b.getAttribute('data-act'), b.getAttribute('data-arg'));
  });
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var step = 40;
    if (e.code === 'ArrowLeft') cam.x -= step;
    else if (e.code === 'ArrowRight') cam.x += step;
    else if (e.code === 'ArrowUp') cam.y -= step;
    else if (e.code === 'ArrowDown') cam.y += step;
    else if (e.code === 'KeyM') act('mute');
    else if (e.code === 'Space') { e.preventDefault(); act('run'); }
    else if (e.code === 'Escape') act('close');
    else return;
    clampCam();
  });
  window.addEventListener('resize', function () { view.sized = false; });

  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    frames++;
    if (now - fpsStamp > 1000) { fps = frames; frames = 0; fpsStamp = now; }
    if (!view.sized) measure();
    if (!document.hidden && state.started && !state.bankrupt && !state.pending && !panel && !travel && state.speed) {
      acc += dt * (state.speed === 3 ? 2.4 : 1);
      var gap = state.speed === 3 ? 0.45 : 2.1;
      if (acc >= gap) { acc = 0; runWeek(); }
    } else if (!state.speed) acc = 0;
    updateWorld(dt, now);
    draw(now);
    setText(skyEl, skyWord(now));
    if (uiDirty) { uiDirty = false; flushUI(); }
    requestAnimationFrame(frame);
  }

  paintCountry();
  state = load();
  if (!state.helpSeen) panel = 'help';
  else if (!state.started) panel = 'start';
  else if (state.bankrupt) panel = 'bust';
  ensureCity(true);
  centerCam();
  uiDirty = true;
  requestAnimationFrame(frame);

  window.Corner = {
    get state() { return state; },
    get fps() { return fps; },
    get domWrites() { return domWrites; },
    get zoom() { return zoom; },
    entities: function () {
      return {
        walkers: city ? city.walkers.length : 0,
        buildings: city ? city.buildings.length : 0,
        rivals: city ? city.buildings.filter(function (b) { return b.kind === 'rival'; }).length : 0,
        popups: popups.length,
        queue: queueCount(),
        cam: { x: Math.round(cam.x), y: Math.round(cam.y) },
        view: viewMode,
        spot: city && city.walkers[0] ? Math.round(city.walkers[0].x) + ',' + Math.round(city.walkers[0].y) : ''
      };
    },
    act: function (n, a) { act(n, a); if (uiDirty) { uiDirty = false; flushUI(); } },
    sim: function () { return resolveWeek(); },
    smokeFor: function (ms) { smokeUntil = nowMs() + (ms || 4000); burstSmoke(); }
  };
})();
