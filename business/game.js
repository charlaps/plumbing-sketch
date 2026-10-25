/* Corner & Co — a South African business sim. Figures are game values, not advice. */
(function () {
  'use strict';

  var SAVE_KEY = 'corner-co-save';
  var START_CASH = 20000;
  var WAGE = 850;
  var LOAN_STEP = 10000;
  var LOAN_MAX = 80000;
  var YEAR_RATE = 0.2;

  var TOWNS = [
    { id: 'pol', name: 'Polokwane', map: 'Polokwane', x: 32, y: 7, traffic: 92, rent: 0.9, blurb: 'A growing northern town. Rent is kinder than the cities.' },
    { id: 'pta', name: 'Pretoria', map: 'Pretoria', x: 37, y: 15, align: 'right', traffic: 140, rent: 1.55, blurb: 'Offices and schools. Steady weekday trade, real rent.' },
    { id: 'jhb', name: 'Johannesburg', map: 'Joburg', x: 28, y: 18, align: 'left', traffic: 176, rent: 2.05, blurb: 'The big pavement. Foot traffic and a landlord who knows it.' },
    { id: 'alex', name: 'Alexandra', map: 'Alex', x: 40, y: 21, align: 'right', traffic: 112, rent: 1, blurb: 'Busy streets, lower rent, everybody talks.' },
    { id: 'soweto', name: 'Soweto', map: 'Soweto', x: 24, y: 24, align: 'left', traffic: 154, rent: 1.35, blurb: 'Weekend traffic. A shop here is never really quiet.' },
    { id: 'dbn', name: 'Durban', map: 'Durban', x: 44, y: 31, align: 'right', traffic: 158, rent: 1.5, blurb: 'Harbour town. People eat, and the air is wet.' },
    { id: 'bfn', name: 'Bloemfontein', map: 'Bloem', x: 29, y: 34, traffic: 108, rent: 1.05, blurb: 'A central town. Loyal customers if you stay fair.' },
    { id: 'pe', name: 'Gqeberha', map: 'Gqeberha', x: 34, y: 45, traffic: 102, rent: 1, blurb: 'The windy bay. Word of mouth travels.' },
    { id: 'cpt', name: 'Cape Town', map: 'Cape Town', x: 15, y: 57, align: 'left', traffic: 168, rent: 2.25, blurb: 'Pricey pavement. Tourists and locals, both fussy.' }
  ];

  var TYPES = {
    spaza: {
      name: 'Spaza', kit: 'fridges', unit: 'sales',
      fair: 80, cost: { budget: 40, standard: 46, premium: 62 },
      elasticity: 1.85, spoil: 0.06, pull: 0.84, cap: 78, staffCap: 46,
      rent: 820, open: 7500, stocked: true, starter: 80,
      blurb: 'Bread, airtime, cool drinks. Regulars notice a bare shelf or a cheap batch.'
    },
    takeaway: {
      name: 'Takeaway', kit: 'fryers', unit: 'plates',
      fair: 70, cost: { budget: 30, standard: 34, premium: 48 },
      elasticity: 1.9, spoil: 0.48, pull: 0.55, cap: 90, staffCap: 40,
      rent: 840, open: 11000, stocked: true, starter: 80,
      blurb: 'Kota, chips, a cooldrink. Food that sits is money in the bin. Fresh costs more.'
    },
    trades: {
      name: 'Bakkie trades', kit: 'bakkie', unit: 'jobs',
      fair: 540, cost: { budget: 250, standard: 300, premium: 420 },
      elasticity: 1.15, spoil: 0, pull: 0.09, cap: 14, staffCap: 6,
      rent: 460, open: 12000, stocked: true, starter: 10,
      blurb: 'Small building and repair jobs. Bigger tickets, fewer customers. The bakkie has to start.'
    },
    transport: {
      name: 'Deliveries', kit: 'bakkie', unit: 'drops',
      fair: 210, cost: { budget: 118, standard: 132, premium: 170 },
      elasticity: 1.4, spoil: 0, pull: 0.2, cap: 46, staffCap: 16,
      rent: 400, open: 13000, stocked: false, starter: 0,
      blurb: 'Drops across town. The bakkie costs money every drop. Breakdowns sit you still.'
    },
    factory: {
      name: 'Workshop', kit: 'machines', unit: 'crates',
      fair: 180, cost: { budget: 88, standard: 102, premium: 130 },
      elasticity: 1.25, spoil: 0.08, pull: 0.42, cap: 48, staffCap: 22,
      rent: 1500, open: 26000, stocked: true, starter: 30,
      blurb: 'You make goods in batches. A small crew cannot cover a big town’s rent. Hands on the line raise output.'
    },
    rooms: {
      name: 'Rooms', kit: 'building', unit: 'rooms let',
      fair: 740, cost: { budget: 36, standard: 80, premium: 150 },
      elasticity: 1.45, spoil: 0, pull: 0.026, cap: 6, staffCap: 0,
      rent: 0, open: 36000, stocked: false, starter: 0, rooms: true,
      blurb: 'Six rooms to let. Empty rooms still need upkeep. A high price or a bad name leaves them vacant.'
    }
  };

  var STARTS = [
    { id: 'spaza', type: 'spaza', town: 'alex', line: 'A spaza in Alexandra. Low rent, regulars, thin margins.' },
    { id: 'takeaway', type: 'takeaway', town: 'soweto', line: 'A takeaway in Soweto. Busy, but food goes off.' },
    { id: 'trades', type: 'trades', town: 'pta', line: 'A repair bakkie in Pretoria. Fewer jobs, bigger cheques.' },
    { id: 'transport', type: 'transport', town: 'jhb', line: 'A delivery bakkie in Johannesburg. Fuel will bully you.' }
  ];

  var FIRST_NAMES = ['Thabo', 'Lerato', 'Ayesha', 'Pieter', 'Nomsa', 'Johan', 'Fatima', 'Sipho', 'Zanele', 'Ruan', 'Kagiso', 'Amina'];

  var cashEl = document.getElementById('cash');
  var whenEl = document.getElementById('when');
  var repEl = document.getElementById('repchip');
  var logEl = document.getElementById('log');
  var muteEl = document.getElementById('mute');
  var sheetEl = document.getElementById('sheet');
  var panelEl = document.getElementById('panel');
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');

  var GW = 52, GH = 64;
  var off = document.createElement('canvas');
  off.width = GW;
  off.height = GH;
  var octx = off.getContext('2d');
  var img = octx.createImageData(GW, GH);
  var pix = img.data;

  var state, panel = null, audioCtx = null, acc = 0, lastT = 0, dirty = true;
  var view = { ox: 0, oy: 0, scale: 1, cssW: 1, cssH: 1 };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function townBy(id) { return TOWNS.filter(function (t) { return t.id === id; })[0]; }
  function typeBy(id) { return TYPES[id]; }
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
  function priceWord(p) { return p === 'low' ? 'cheap' : p === 'high' ? 'steep' : 'fair'; }

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
      v: 1,
      week: 1,
      cash: START_CASH,
      loan: 0,
      speed: 0,
      sound: true,
      helpSeen: false,
      started: false,
      bankrupt: false,
      overdrawn: 0,
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
      log: 'Pick a corner to begin.'
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var data = JSON.parse(raw);
      if (!data || data.v !== 1 || !data.rivals) return fresh();
      (data.branches || []).forEach(function (b) { if (!b.hours) b.hours = 'normal'; });
      return data;
    } catch (e) { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function log(msg) { state.log = msg; }
  function pushNews(text, kind) {
    state.news.unshift({ week: state.week, text: text, kind: kind || 'note' });
    if (state.news.length > 50) state.news.pop();
  }

  function tone(freq, dur, type, vol) {
    if (!state.sound) return;
    try {
      if (!audioCtx || audioCtx.state !== 'running') return;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol || 0.04, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function chime() {
    tone(523, 0.08, 'square', 0.035);
    setTimeout(function () { tone(659, 0.09, 'square', 0.035); }, 80);
  }
  function fail(msg) { log(msg); tone(130, 0.12, 'sawtooth', 0.03); dirty = true; return false; }

  function branchBy(id) {
    for (var i = 0; i < state.branches.length; i++) if (state.branches[i].id === id) return state.branches[i];
    return null;
  }
  function focused() { return branchBy(state.focus); }

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
      maintenance: 78,
      compliance: 'ok',
      hours: 'normal',
      service: false,
      generator: false,
      guard: false,
      reputation: 52,
      morale: 74,
      steepWeeks: 0,
      cheapWeeks: 0,
      prevDemand: 0,
      lastDemand: 0,
      lastServed: 0,
      lastSurplus: 0,
      lastShare: 0,
      weeks: 0,
      contractLeft: 0
    };
    state.branches.push(b);
    state.focus = b.id;
    state.town = townId;
    return b;
  }

  function unitCost(b) { return TYPES[b.type].cost[b.supplier]; }
  function effectiveLevel(b) {
    var mul = priceMul(b.price);
    var i;
    for (i = 0; i < state.mods.length; i++) if (state.mods[i].priceMul) mul *= state.mods[i].priceMul;
    return mul;
  }
  function unitPrice(b) {
    return Math.max(1, Math.round(TYPES[b.type].fair * effectiveLevel(b)));
  }
  function skillAvg(b) {
    if (!b.staff.length) return 58;
    var s = 0;
    b.staff.forEach(function (p) { s += p.skill; });
    return s / b.staff.length;
  }
  function shockHits(b) {
    if (!state.shock) return false;
    if (state.shock.all) return true;
    return !!(b && state.shock.branchId === b.id);
  }
  function qualityOf(b) {
    var q = { budget: 0.28, standard: 0.66, premium: 0.9 }[b.supplier];
    q += (skillAvg(b) - 55) / 220;
    q -= (100 - b.maintenance) / 520;
    if (b.morale < 42) q -= 0.08;
    if (b.hours === 'push') q -= 0.05;
    if (b.batchWeeks > 0) q -= 0.22;
    if (shockHits(b) && state.shock.quality) q += state.shock.quality;
    return clamp(q, 0.12, 0.98);
  }
  function returnsOf(q) { return clamp(0.24 - q * 0.26, 0.03, 0.22); }
  function capacityOf(b) {
    var t = TYPES[b.type];
    var cap = t.cap;
    b.staff.forEach(function (p) { cap += t.staffCap * (0.65 + p.skill / 140); });
    if (b.hours === 'easy') cap *= 0.78;
    if (b.hours === 'push') cap *= 1.26;
    if (shockHits(b) && state.shock.capacity) cap += state.shock.capacity;
    return Math.max(1, cap);
  }
  function brandFactor(brand) { return 1 + 0.55 * (1 - Math.exp(-(brand || 0) / 3800)); }
  function repFactor(rep) { return 0.5 + (rep / 100) * 0.8; }
  function rivalsOf(town, type) {
    return (state.rivals[town] || []).filter(function (r) { return r.type === type; });
  }
  function rivalPressure(b) {
    var list = rivalsOf(b.town, b.type);
    if (!list.length) return { factor: 1, undercut: false, count: 0 };
    var mine = effectiveLevel(b);
    var hit = 0, under = false;
    list.forEach(function (r) {
      hit += 0.12;
      if (r.price + 0.06 < mine) { hit += 0.12; under = true; }
    });
    return { factor: clamp(1 - hit, 0.42, 1), undercut: under, count: list.length };
  }
  function rentOf(b) {
    return Math.round(TYPES[b.type].rent * townBy(b.town).rent);
  }

  function willingDemand(b) {
    var t = TYPES[b.type];
    var town = townBy(b.town);
    var q = qualityOf(b);
    var d = town.traffic * t.pull;
    d *= Math.pow(1 / effectiveLevel(b), t.elasticity);
    d *= repFactor(b.reputation);
    d *= brandFactor(b.brand);
    d *= (0.62 + q * 0.55);
    d *= rivalPressure(b).factor;
    d *= state.economy || 1;
    if (b.compliance === 'strict') d *= 1.04;
    if (b.compliance === 'cut') d *= 0.97;
    var i;
    for (i = 0; i < state.mods.length; i++) if (state.mods[i].demandMul) d *= state.mods[i].demandMul;
    if (shockHits(b) && state.shock.demandMul) d *= state.shock.demandMul;
    if (b.contractLeft > 0) d *= 1.4;
    return Math.max(0, d);
  }

  function tickMods() {
    var next = [];
    state.mods.forEach(function (m) {
      m.weeks -= 1;
      if (m.weeks > 0) next.push(m);
    });
    state.mods = next;
    if (state.economyWeeks > 0) {
      state.economyWeeks -= 1;
      if (state.economyWeeks <= 0) {
        state.economy = 1;
        state.economyLabel = 'steady';
        pushNews('The economy settles back to ordinary.', 'note');
      }
    }
  }

  function orderUnits(b) {
    var t = TYPES[b.type];
    if (!t.stocked) return 0;
    if (!b.pace) return 0;
    var target = b.pace;
    if (b.order === 'light') target *= 0.65;
    if (b.order === 'heavy') target *= 1.55;
    return Math.max(0, Math.round(target - b.stock));
  }

  function resolveWeek() {
    var startCash = state.cash;
    var lines = [];
    var shockNote = state.shock && state.shock.note;
    if (state.shock && state.shock.cash) {
      state.cash += state.shock.cash;
      if (state.shock.cash < 0) lines.push('You paid ' + R(-state.shock.cash) + ' up front. ' + (shockNote || ''));
    }

    var totalSurplus = 0;
    state.branches.forEach(function (b) {
      var result = simBranch(b, lines);
      totalSurplus += result.surplus;
    });

    var interest = 0;
    if (state.loan > 0) {
      interest = state.loan * YEAR_RATE / 52;
      state.cash -= interest;
      totalSurplus -= interest;
      lines.push('The loan took ' + R(interest) + ' in interest.');
    }

    if (state.cash < 0) {
      state.overdrawn += 1;
      lines.push('The till is short (' + R(state.cash) + '). Week ' + state.overdrawn + ' under water. The bank is watching.');
      if (state.overdrawn >= 6) {
        state.bankrupt = true;
        state.speed = 0;
        lines.push('Six weeks under water. The bank takes the business.');
      }
    } else state.overdrawn = 0;

    reactRivals(lines);
    tickMods();
    if (state.fuelTaxWeeks > 0) state.fuelTaxWeeks -= 1;
    state.branches.forEach(function (b) { if (b.contractLeft > 0) b.contractLeft -= 1; });

    var rep = companyRep();
    var morale = companyMorale();
    state.history.push({
      week: state.week,
      profit: Math.round(totalSurplus),
      cash: Math.round(state.cash),
      rep: Math.round(rep),
      morale: Math.round(morale)
    });
    if (state.history.length > 24) state.history.shift();

    var ni;
    for (ni = lines.length - 1; ni >= 0; ni--) {
      var text = lines[ni];
      var kind = 'note';
      if (/broke|fine|short|strike|left|bin|empty|under water|takes the|spoiled|turned/.test(text)) kind = 'bad';
      if (/Sales \+|opened a|settles|generator|contract is on/.test(text)) kind = 'good';
      pushNews(text, kind);
    }
    var headline = lines[0] || 'A quiet week.';
    log(headline);
    state.shock = null;
    state.week += 1;
    if (totalSurplus >= 0) chime(); else tone(180, 0.1, 'square', 0.04);
    save();
    dirty = true;
    if (state.bankrupt) panel = 'bust';
    return { surplus: totalSurplus, cashDelta: state.cash - startCash };
  }

  function simBranch(b, lines) {
    var t = TYPES[b.type];
    var name = t.name + ' in ' + townBy(b.town).name;
    b.weeks += 1;
    var q = qualityOf(b);
    var demand = willingDemand(b);
    var cap = capacityOf(b);
    var cost = unitCost(b);
    if (b.batchWeeks > 0) cost = Math.round(cost * 0.72);
    var price = unitPrice(b);
    var cashAt = state.cash;
    var stockAt = b.stock * cost;

    if (t.stocked && b.pace) {
      var want = orderUnits(b);
      var afford = cost > 0 ? Math.floor(Math.max(0, state.cash) / cost) : 0;
      var buy = Math.min(want, afford);
      if (want > 0 && buy < want) lines.push(name + ' could only afford ' + buy + ' of ' + want + ' units. Cash is tight.');
      state.cash -= buy * cost;
      b.stock += buy;
    }

    var struck = b.staff.length && b.morale < 30;
    var broke = false;
    if (!b.service) b.maintenance = Math.max(0, b.maintenance - 12);
    else {
      var bill = 380 + b.staff.length * 60;
      if (state.cash >= bill) {
        state.cash -= bill;
        b.maintenance = Math.min(100, b.maintenance + 28);
      } else lines.push('No cash to service the ' + t.kit + ' at ' + name + '.');
    }
    if (b.maintenance < 42 && Math.random() < (42 - b.maintenance) / 55) broke = true;

    var shelf = t.stocked ? b.stock : 1e9;
    var served = struck ? 0 : Math.min(demand, cap, shelf);
    if (broke) served *= 0.45;
    served = Math.floor(served);
    if (t.rooms) served = Math.min(t.cap, served);

    var ret = returnsOf(q);
    var net = served * (1 - ret);
    var revenue = net * price;
    state.cash += revenue;

    var spoiled = 0;
    if (t.stocked) {
      var left = Math.max(0, b.stock - served);
      spoiled = Math.floor(left * t.spoil);
      b.stock = Math.max(0, left - spoiled);
    }

    var wages = 0;
    b.staff.forEach(function (p) { wages += p.pay; });
    if (b.hours === 'push' && b.staff.length) wages = Math.round(wages * 1.18);
    if (b.hours === 'easy' && b.staff.length) wages = Math.round(wages * 0.9);
    if (b.guard) wages += 700;
    state.cash -= wages;
    var running = 0;
    if (!t.stocked && !t.rooms) {
      running = Math.round(served * cost);
      state.cash -= running;
    }
    var rent = rentOf(b);
    state.cash -= rent;
    var ads = b.marketing || 0;
    state.cash -= ads;
    b.brand = b.brand * 0.82 + ads;

    var compliance = b.compliance === 'strict' ? 360 : b.compliance === 'cut' ? -180 : 0;
    state.cash -= compliance;
    var fine = 0;
    if (b.compliance === 'cut' && Math.random() < 0.14) {
      fine = 1600 + Math.floor(Math.random() * 3800);
      state.cash -= fine;
      b.reputation = clamp(b.reputation - 6, 1, 99);
    }

    var upkeepRooms = t.rooms ? t.cap * cost : 0;
    if (t.rooms) state.cash -= upkeepRooms;
    var fuelExtra = 0;
    if (state.fuelTaxWeeks > 0) {
      var rate = (b.type === 'transport' || b.type === 'trades') ? 0.18 : 0.06;
      fuelExtra = Math.round(served * cost * rate);
      state.cash -= fuelExtra;
    }
    var cheapBatch = b.batchWeeks > 0;
    if (b.batchWeeks > 0) b.batchWeeks -= 1;
    var spoilCost = spoiled * cost;
    var surplus = (state.cash - cashAt) + (b.stock * cost - stockAt);

    var missedStock = 0;
    if (t.stocked && !struck && !broke) missedStock = Math.max(0, Math.floor(Math.min(demand, cap) - served));
    var turnedAway = !struck && !broke ? Math.max(0, Math.floor(demand - cap)) : 0;
    var shockNote = state.shock && state.shock.note;

    var causes = [];
    if (b.price === 'high' || effectiveLevel(b) > 1.12) causes.push('your price is high');
    if (b.price === 'low' || effectiveLevel(b) < 0.9) causes.push('your price is low');
    if (fuelExtra > 0) causes.push('fuel costs jumped');
    if (b._openedRival) causes.push('a rival opened nearby');
    else if (rivalPressure(b).undercut) causes.push('a rival is cheaper');
    if (missedStock > 4) causes.push('the shelves ran empty');
    if (b.supplier === 'budget' || cheapBatch) causes.push('cheap stock came back as returns');
    else if (ret > 0.11) causes.push('customers brought goods back');
    if (b.hours === 'push') causes.push('overtime caused mistakes');
    if (b.hours === 'easy' && turnedAway > 4) causes.push('shorter hours turned people away');
    if (ads >= 1500 && b.brand > 6000) causes.push('extra advertising is barely moving the needle');
    else if (ads > 0) causes.push('advertising brought people in');
    if (state.economy < 0.95) causes.push('the town has less money');
    if (state.economy > 1.06) causes.push('money is moving');
    if (shockHits(b) && shockNote) causes.push(shockNote);
    if (!broke && b.maintenance < 48) causes.push('skipped maintenance is showing');
    if (broke) causes.push('the ' + t.kit + ' broke down after skipped maintenance');
    if (struck) causes.push('the team downed tools');
    if (b.prevCap && cap + 1 < b.prevCap) causes.push('you have fewer hands than last week');
    if (b.reputation < 40) causes.push('your name is still dented');
    if (!causes.length) causes.push(b.price === 'fair' ? 'prices were fair and the town was steady' : 'trade was ordinary');
    causes = causes.slice(0, 3);

    var pct = null;
    if (b.lastServed > 5) pct = Math.round((served - b.lastServed) / b.lastServed * 100);
    var demandPct = null;
    if (b.prevDemand > 5) demandPct = Math.round((demand - b.prevDemand) / b.prevDemand * 100);
    var why = causes.join(' and ');
    if (pct != null && Math.abs(pct) >= 6) {
      lines.push('Sales ' + (pct > 0 ? '+' : '') + pct + '% at ' + name + ' because ' + why + '.');
    } else if (b.weeks === 1) {
      lines.push('First week at ' + name + ': ' + served + ' ' + t.unit + '. ' + capFirst(why) + '.');
    } else if (demandPct != null && Math.abs(demandPct) >= 8 && Math.abs(served - b.lastServed) <= 2) {
      lines.push('Demand ' + (demandPct > 0 ? '+' : '') + demandPct + '% at ' + name + ' because ' + why + '. Sales stayed at ' + served + ' because the counter was already full.');
    } else {
      lines.push(name + ': ' + served + ' ' + t.unit + '. ' + capFirst(why) + '.');
    }

    var drift = (q - 0.58) * 4;
    drift += b.price === 'high' ? -2.2 : b.price === 'low' ? 0.5 : 1.15;
    drift -= Math.max(0, ret - 0.07) * 16;
    if (b.compliance === 'strict') drift += 1;
    if (b.compliance === 'cut') drift -= 1.2;
    if (missedStock > 8) drift -= 1.6;
    if (struck) drift -= 3;
    drift = clamp(drift, -4, 4);
    b.reputation = clamp(b.reputation + drift, 1, 99);

    var moraleWhy = [];
    var morale = b.morale;
    if (b.staff.length) {
      var ratio = avgPayRatio(b);
      if (ratio < 0.9) { morale -= 8; moraleWhy.push('pay is under the going rate'); }
      else if (ratio > 1.12) morale += 3;
      else morale += 1;
    } else morale += 0.4;
    if (b.hours === 'push') { morale -= 8; moraleWhy.push('the week was overtime'); }
    if (b.hours === 'easy') morale += 5;
    if (demand > cap * 1.22 && b.hours !== 'easy') { morale -= 6; moraleWhy.push('the counter was overworked'); }
    else morale += 1;
    if (broke) { morale -= 4; moraleWhy.push('the breakdown made a mess'); }
    morale = clamp(morale, 0, 100);
    var moraleBefore = b.morale;
    b.morale = morale;

    if (struck) {
      lines.push('Staff at ' + name + ' struck because morale was on the floor. Nothing was sold. Morale was crushed by pay or hours.');
      b.morale = 46;
    } else if (b.staff.length && morale < 38 && Math.random() < 0.3) {
      var left = b.staff.pop();
      lines.push(left.name + ' resigned from ' + name + ' because morale fell to ' + Math.round(morale) + '.');
    }

    if (fine) lines.push('A ' + R(fine) + ' fine hit ' + name + ' because compliance was cut.');
    if (spoiled > 0) lines.push(spoiled + (spoiled === 1 ? ' unit spoiled at ' : ' units spoiled at ') + name + ' (' + R(spoilCost) + '). Overstock tied up cash, then it went off.');
    if (turnedAway > 18) lines.push('You turned ' + turnedAway + ' away at ' + name + ' because the counter was too small. Hire, open the hours, or lose them.');
    if (broke) lines.push('The ' + t.kit + ' at ' + name + ' failed. Maintenance had been skipped.');
    if (Math.abs(drift) >= 1.5) {
      lines.push('Reputation at ' + name + ' moved ' + (drift >= 0 ? '+' : '') + drift.toFixed(1) + ' to ' + Math.round(b.reputation) + '. A name lags behind what you did this week.');
    }
    if (b.staff.length && moraleBefore - b.morale >= 6) {
      lines.push('Morale at ' + name + ' fell to ' + Math.round(b.morale) + ' because ' + (moraleWhy[0] || 'the week was hard') + '.');
    }
    if (running > 0) {
      lines.push(name + ' spent ' + R(running) + ' keeping the ' + t.kit + ' on the road.');
    }

    var shareDenom = demand + rivalDemand(b);
    b.lastShare = shareDenom > 0 ? demand / shareDenom : 1;
    b.lastDemand = demand;
    b.prevDemand = demand;
    b.pace = (struck || broke) ? (b.pace || Math.min(demand, cap)) : Math.min(demand, cap);
    b.lastServed = served;
    b.lastSurplus = surplus;
    b._openedRival = false;
    b.prevCap = cap;

    if (b.price === 'high') b.steepWeeks += 1; else b.steepWeeks = 0;
    if (b.price === 'low') b.cheapWeeks += 1; else b.cheapWeeks = 0;

    if (b.contractLeft > 0 && q < 0.45) {
      b.contractLeft = 0;
      b.reputation = clamp(b.reputation - 8, 1, 99);
      lines.push('The big contract at ' + name + ' collapsed because quality was too poor.');
    }
    return { surplus: surplus };
  }

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function avgPayRatio(b) {
    if (!b.staff.length) return 1;
    var s = 0;
    b.staff.forEach(function (p) { s += p.pay / WAGE; });
    return s / b.staff.length;
  }
  function rivalDemand(b) {
    var t = TYPES[b.type];
    var town = townBy(b.town);
    var d = 0;
    rivalsOf(b.town, b.type).forEach(function (r) {
      d += town.traffic * t.pull * 0.62 * Math.pow(1 / r.price, t.elasticity);
    });
    return d;
  }

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
        rivalsOf(b.town, b.type).forEach(function (r) { r.price = Math.max(0.78, r.price - 0.08); });
        if (rivalsOf(b.town, b.type).length) {
          lines.push('A rival in ' + townBy(b.town).name + ' cut prices because you stayed cheap.');
        }
        b.cheapWeeks = 0;
      }
    });
  }

  function companyRep() {
    if (!state.branches.length) return 50;
    var s = 0;
    state.branches.forEach(function (b) { s += b.reputation; });
    return s / state.branches.length;
  }
  function companyMorale() {
    if (!state.branches.length) return 70;
    var s = 0;
    state.branches.forEach(function (b) { s += b.morale; });
    return s / state.branches.length;
  }
  function companyShare() {
    var yours = 0;
    var theirs = 0;
    state.branches.forEach(function (b) {
      yours += b.lastDemand || 0;
      theirs += rivalDemand(b);
    });
    if (yours + theirs <= 0) return 0;
    return yours / (yours + theirs);
  }

  function maybeEvent() {
    if (state.week < 3) return null;
    if (Math.random() > 0.46) return null;
    var options = ['power', 'fuel', 'theft', 'contract', 'inspector', 'economy', 'batch'];
    if (state.branches.some(function (b) { return b.staff.length; }) && Math.random() < 0.5) options.push('poach');
    var id = options[Math.floor(Math.random() * options.length)];
    return eventCard(id);
  }

  function eventCard(id) {
    var b = focused() || state.branches[0];
    var town = b ? townBy(b.town).name : 'town';
    if (id === 'power') {
      if (b && b.generator) return null;
      return {
        id: 'power',
        title: 'Load-shedding',
        body: 'The lights go in ' + town + '. Fridges warm up and the card machine dies. What do you do?',
        choices: [
          { id: 'gen', label: 'Buy a generator · R7 500', detail: 'This shop stays open after today. The till hurts now.' },
          { id: 'close', label: 'Close early', detail: 'You lose the evening trade. Regulars see you were honest.' },
          { id: 'dark', label: 'Trade in the dark', detail: 'Some sales, more waste and a worse name.' }
        ]
      };
    }
    if (id === 'fuel') {
      return {
        id: 'fuel',
        title: 'Fuel price hike',
        body: 'Diesel jumps. Deliveries and bakkie jobs feel it first. Everyone pays a bit more.',
        choices: [
          { id: 'swallow', label: 'Swallow it', detail: 'Costs up about 18% this week. Prices stay. Customers stay.' },
          { id: 'pass', label: 'Pass it on', detail: 'A temporary price bump. Some customers flinch.' },
          { id: 'cut', label: 'Cut the far jobs', detail: 'Fewer sales, you dodge the worst of the fuel.' }
        ]
      };
    }
    if (id === 'theft') {
      if (b && b.gated) return null;
      return {
        id: 'theft',
        title: 'A break-in',
        body: 'Someone tried the back door at ' + town + ' overnight.',
        choices: [
          { id: 'gate', label: 'Fit a gate · R3 200', detail: 'You lose nothing this time. The gate stays.' },
          { id: 'guard', label: 'Hire a night guard', detail: 'R700 a week from now. A small loss tonight.' },
          { id: 'hope', label: 'Replace the stock and hope', detail: 'About R1 400 gone. It can happen again.' }
        ]
      };
    }
    if (id === 'contract') {
      return {
        id: 'contract',
        title: 'A big contract',
        body: 'A school in ' + town + ' wants you for a month. It is more work than a normal week.',
        choices: [
          { id: 'take', label: 'Take it with the team you have', detail: 'Demand jumps. If quality or stock slips, they walk and your name suffers.' },
          { id: 'temps', label: 'Take it and pay temps · R1 800', detail: 'Extra hands this week. Safer, not free.' },
          { id: 'no', label: 'Let it pass', detail: 'No strain. No extra money.' }
        ]
      };
    }
    if (id === 'inspector') {
      return {
        id: 'inspector',
        title: 'An inspector',
        body: 'Someone official is in ' + town + ' with a clipboard and time to spare.',
        choices: [
          { id: 'fix', label: 'Pay the licence and fix it · R2 200', detail: 'It stings. Your name ticks up.' },
          { id: 'fine', label: 'Just pay the fine · R1 300', detail: 'Cheaper today. They will remember the shortcut.' },
          { id: 'argue', label: 'Argue', detail: 'Maybe they leave. Maybe the fine is ugly.' }
        ]
      };
    }
    if (id === 'economy') {
      var boom = Math.random() < 0.5;
      if (boom) {
        return {
          id: 'economy',
          title: 'A busy month',
          body: 'Pay packets landed and people are spending. It will not last forever.',
          choices: [
            { id: 'ads', label: 'Push advertising · R1 500', detail: 'You catch the wave. Posters wear out.' },
            { id: 'raise', label: 'Nudge prices up for a month', detail: 'Fatter margin while the town is flush. Regulars notice.' },
            { id: 'steady', label: 'Keep trading as you are', detail: 'You still feel a lift. No new promise to keep.' }
          ]
        };
      }
      return {
        id: 'economy',
        mode: 'bust',
        title: 'A quiet month',
        body: 'Work is thinner. Taxis are full of people counting coins.',
        choices: [
          { id: 'discount', label: 'Discount for a month', detail: 'More feet, less on each sale.' },
          { id: 'hold', label: 'Hold your prices', detail: 'You keep the margin and lose some volume.' },
          { id: 'wages', label: 'Trim wages 10%', detail: 'The till breathes. Morale will not.' }
        ]
      };
    }
    if (id === 'batch') {
      return {
        id: 'batch',
        title: 'A cheap batch',
        body: 'A supplier offers a truck of goods well under the normal price. They will not say why.',
        choices: [
          { id: 'buy', label: 'Take the cheap batch', detail: 'Costs drop for two weeks. Quality drops with them. Returns follow.' },
          { id: 'no', label: 'Stick with your supplier', detail: 'No saving. No nasty surprise in the packet.' }
        ]
      };
    }
    if (id === 'poach') {
      return {
        id: 'poach',
        title: 'A rival wants your best hand',
        body: 'Someone in ' + town + ' offered your strongest person more money.',
        choices: [
          { id: 'match', label: 'Match the pay', detail: 'They stay. Your wage bill steps up.' },
          { id: 'train', label: 'Train them and add a little', detail: 'R600 and a smaller raise. Skill goes up.' },
          { id: 'let', label: 'Let them go', detail: 'You save the wage and lose the skill.' }
        ]
      };
    }
    return null;
  }

  function applyChoice(card, choice) {
    var b = focused() || state.branches[0];
    var shock = { note: '', demandMul: 1, quality: 0, capacity: 0, cash: 0, all: false, branchId: b ? b.id : null };
    if (card.id === 'power' && choice === 'gen') {
      shock.cash = -7500;
      shock.demandMul = 0.88;
      shock.note = 'you were fitting a generator';
      if (b) b.generator = true;
    } else if (card.id === 'power' && choice === 'close') {
      shock.demandMul = 0.55;
      shock.note = 'you closed early in the dark';
      if (b) b.reputation = clamp(b.reputation + 1.5, 1, 99);
    } else if (card.id === 'power' && choice === 'dark') {
      shock.demandMul = 0.75;
      shock.quality = -0.12;
      shock.cash = -500;
      shock.note = 'you traded through load-shedding';
      if (b) b.reputation = clamp(b.reputation - 2, 1, 99);
    } else if (card.id === 'fuel' && choice === 'swallow') {
      shock.all = true;
      shock.note = 'fuel went up and you swallowed it';
      state.fuelTaxWeeks = 2;
    } else if (card.id === 'fuel' && choice === 'pass') {
      shock.all = true;
      shock.note = 'you passed the fuel hike on';
      state.mods.push({ weeks: 3, priceMul: 1.08 });
      state.fuelTaxWeeks = 2;
    } else if (card.id === 'fuel' && choice === 'cut') {
      shock.all = true;
      shock.demandMul = 0.78;
      shock.note = 'you cut the far jobs after the fuel hike';
    } else if (card.id === 'theft' && choice === 'gate') {
      shock.cash = -3200;
      shock.note = 'a new gate went on after a break-in';
      if (b) b.gated = true;
    } else if (card.id === 'theft' && choice === 'guard') {
      shock.cash = -400;
      if (b) b.guard = true;
      shock.note = 'a guard starts after a break-in';
    } else if (card.id === 'theft' && choice === 'hope') {
      shock.cash = -1400;
      shock.note = 'stock was stolen';
      if (b) b.reputation = clamp(b.reputation - 1, 1, 99);
    } else if (card.id === 'contract' && choice === 'take') {
      if (b) b.contractLeft = 4;
      shock.note = 'a school contract is on';
    } else if (card.id === 'contract' && choice === 'temps') {
      shock.cash = -1800;
      shock.capacity = 36;
      if (b) b.contractLeft = 4;
      shock.note = 'temps are covering a school contract';
    } else if (card.id === 'contract' && choice === 'no') {
      shock.note = 'you passed on a big contract';
    } else if (card.id === 'inspector' && choice === 'fix') {
      shock.cash = -2200;
      if (b) b.reputation = clamp(b.reputation + 3, 1, 99);
      shock.note = 'you fixed what the inspector found';
    } else if (card.id === 'inspector' && choice === 'fine') {
      shock.cash = -1300;
      if (b) b.reputation = clamp(b.reputation - 2, 1, 99);
      shock.note = 'you paid a fine and left the fault';
    } else if (card.id === 'inspector' && choice === 'argue') {
      if (Math.random() < 0.5) {
        shock.note = 'you argued and the inspector moved on';
      } else {
        shock.cash = -5200;
        if (b) b.reputation = clamp(b.reputation - 6, 1, 99);
        shock.note = 'arguing with the inspector backfired';
      }
    } else if (card.id === 'economy' && choice === 'ads') {
      shock.all = true;
      shock.cash = -1500;
      state.economy = 1.14;
      state.economyWeeks = 5;
      state.economyLabel = 'busy';
      if (b) b.brand += 1500;
      shock.note = 'you advertised into a busy month';
    } else if (card.id === 'economy' && choice === 'raise') {
      shock.all = true;
      state.economy = 1.12;
      state.economyWeeks = 5;
      state.economyLabel = 'busy';
      state.mods.push({ weeks: 4, priceMul: 1.1 });
      shock.note = 'prices are up while the town is flush';
    } else if (card.id === 'economy' && choice === 'steady') {
      shock.all = true;
      state.economy = 1.1;
      state.economyWeeks = 4;
      state.economyLabel = 'busy';
      shock.note = 'the town is spending';
    } else if (card.id === 'economy' && choice === 'discount') {
      shock.all = true;
      state.economy = 0.84;
      state.economyWeeks = 5;
      state.economyLabel = 'quiet';
      state.mods.push({ weeks: 4, priceMul: 0.9 });
      shock.note = 'you discounted into a quiet month';
    } else if (card.id === 'economy' && choice === 'hold') {
      shock.all = true;
      state.economy = 0.86;
      state.economyWeeks = 5;
      state.economyLabel = 'quiet';
      shock.note = 'you held prices in a quiet month';
    } else if (card.id === 'economy' && choice === 'wages') {
      shock.all = true;
      state.economy = 0.86;
      state.economyWeeks = 5;
      state.economyLabel = 'quiet';
      state.branches.forEach(function (br) {
        br.staff.forEach(function (p) { p.pay = Math.max(700, Math.round(p.pay * 0.9 / 10) * 10); });
        br.morale = clamp(br.morale - 10, 0, 100);
      });
      shock.note = 'wages were cut in a quiet month';
    } else if (card.id === 'batch' && choice === 'buy') {
      if (b) b.batchWeeks = 2;
      shock.note = 'a cheap batch is on the shelf';
    } else if (card.id === 'batch' && choice === 'no') {
      shock.note = 'you skipped a cheap batch';
    } else if (card.id === 'poach' && choice === 'match') {
      if (b && b.staff.length) {
        var best = b.staff.slice().sort(function (a, c) { return c.skill - a.skill; })[0];
        best.pay = Math.round(best.pay * 1.2 / 10) * 10;
        b.morale = clamp(b.morale + 4, 0, 100);
      }
      shock.note = 'you matched a rival wage';
    } else if (card.id === 'poach' && choice === 'train') {
      shock.cash = -600;
      if (b && b.staff.length) {
        var star = b.staff.slice().sort(function (a, c) { return c.skill - a.skill; })[0];
        star.skill = Math.min(96, star.skill + 10);
        star.pay = Math.round(star.pay * 1.08 / 10) * 10;
        b.morale = clamp(b.morale + 6, 0, 100);
      }
      shock.note = 'you trained the person a rival wanted';
    } else if (card.id === 'poach' && choice === 'let') {
      if (b && b.staff.length) b.staff.sort(function (a, c) { return c.skill - a.skill; }).shift();
      if (b) b.morale = clamp(b.morale - 6, 0, 100);
      shock.note = 'your best hand left for a rival';
    }
    state.shock = shock;
  }

  function runWeek() {
    if (state.bankrupt) return fail('The bank already closed the doors.');
    if (!state.started) return fail('Choose how you begin.');
    if (state.pending) return fail('Decide on the card first.');
    var card = maybeEvent();
    if (card) {
      state.pending = card;
      panel = 'card';
      log(card.title + '. Pick a way through it.');
      tone(330, 0.08, 'square', 0.04);
      save();
      dirty = true;
      return;
    }
    resolveWeek();
  }

  function choose(choice) {
    var card = state.pending;
    if (!card) return;
    state.pending = null;
    applyChoice(card, choice);
    if (panel === 'card') panel = null;
    resolveWeek();
  }

  function act(name, arg) {
    if (name === 'speed') {
      state.speed = Number(arg) || 0;
      log(state.speed === 0 ? 'Paused.' : state.speed === 3 ? 'Weeks are flying.' : 'A week at a time.');
      save(); dirty = true; tone(300, 0.04, 'square', 0.03); return;
    }
    if (name === 'run') return runWeek();
    if (name === 'tab') {
      panel = arg === 'map' ? null : arg;
      dirty = true; return;
    }
    if (name === 'help') { panel = 'help'; dirty = true; return; }
    if (name === 'close-help') {
      state.helpSeen = true;
      panel = state.started ? null : 'start';
      save(); dirty = true; return;
    }
    if (name === 'mute') {
      state.sound = !state.sound;
      if (state.sound) tone(660, 0.06, 'square', 0.04);
      save(); dirty = true; return;
    }
    if (name === 'start') return begin(arg);
    if (name === 'choose') return choose(arg);
    if (name === 'town') { state.town = arg; dirty = true; return; }
    if (name === 'focus') { state.focus = Number(arg); panel = 'desk'; dirty = true; return; }
    if (name === 'open') return openBranch(arg);
    if (name === 'price' || name === 'supplier' || name === 'order' || name === 'ads' || name === 'comply' || name === 'hours') return setBranch(name, arg);
    if (name === 'service') return toggleService();
    if (name === 'hire') return hire();
    if (name === 'fire') return fireOne(Number(arg));
    if (name === 'payup' || name === 'paydown' || name === 'train') return staffAct(name, Number(arg));
    if (name === 'borrow') return borrow();
    if (name === 'repay') return repay(5000);
    if (name === 'repay-all') return repay(Math.min(state.loan, state.cash));
    if (name === 'reset-yes') return resetGame();
  }

  function begin(id) {
    var spec = STARTS.filter(function (s) { return s.id === id; })[0];
    if (!spec || state.started) return;
    state.started = true;
    makeBranch(spec.type, spec.town);
    panel = null;
    log('You open in ' + townBy(spec.town).name + '. Run the week when the desk feels right.');
    tone(440, 0.08, 'square', 0.04);
    save(); dirty = true;
  }

  function openBranch(typeId) {
    var t = TYPES[typeId];
    var town = state.town;
    if (!t) return;
    if (state.branches.some(function (b) { return b.town === town && b.type === typeId; })) return fail('You already run that there.');
    if (state.cash < t.open) return fail(t.name + ' needs ' + R(t.open) + ' to open.');
    state.cash -= t.open;
    var b = makeBranch(typeId, town);
    b.stock = Math.round(t.starter * 0.7);
    b.reputation = 48;
    pushNews('You opened a ' + t.name.toLowerCase() + ' in ' + townBy(town).name + '. Rent is ' + R(rentOf(b)) + ' a week. The first weeks are hungry.', 'good');
    log('Opened in ' + townBy(town).name + '.');
    chime();
    panel = 'desk';
    save(); dirty = true;
  }

  function setBranch(key, arg) {
    var b = focused();
    if (!b) return fail('Open the desk on a shop first.');
    if (key === 'price') b.price = arg;
    if (key === 'supplier') b.supplier = arg;
    if (key === 'order') b.order = arg;
    if (key === 'ads') b.marketing = Number(arg) || 0;
    if (key === 'comply') b.compliance = arg;
    if (key === 'hours') b.hours = arg;
    var notes = {
      low: 'Cheap prices: more people, thinner margin. Rivals may answer.',
      fair: 'Fair prices. The safe middle.',
      high: 'Steep prices: fewer people, fatter margin. Stay there and a rival will smell it.',
      budget: 'Budget supplier: lower cost, more returns, reputation slips.',
      standard: 'Standard supplier. Ordinary quality.',
      premium: 'Premium supplier: higher cost, fewer complaints, a slow lift in your name.',
      light: 'Light stock: less cash tied up, more empty shelves.',
      fit: 'Order about what you sold. A sane default.',
      heavy: 'Heavy stock: you will not run out. Cash sits on the shelf, and food can spoil.',
      ok: 'Compliance in order.',
      cut: 'Cutting compliance saves a little every week and risks a fine.',
      strict: 'By the book costs more and slowly builds trust.',
      easy: 'Shorter hours: the crew recovers, and you serve fewer people.',
      normal: 'Ordinary hours.',
      push: 'Overtime: more capacity, higher wages, more mistakes, morale slides.'
    };
    if (key === 'ads') {
      log(arg === '0' ? 'No advertising this week.' : arg === '500' ? 'Posters. A small push, and it fades.' : 'Radio. Demand rises, then flattens if you keep paying.');
    } else log(notes[arg] || 'Updated.');
    tone(360, 0.04, 'square', 0.03);
    save(); dirty = true;
  }

  function toggleService() {
    var b = focused();
    if (!b) return;
    b.service = !b.service;
    log(b.service ? 'You will service the ' + TYPES[b.type].kit + ' this week.' : 'Maintenance skipped. Breakdowns get more likely.');
    save(); dirty = true;
  }

  function hire() {
    var b = focused();
    if (!b) return fail('Pick a shop first.');
    if (TYPES[b.type].rooms) return fail('Rooms do not need a counter hand.');
    if (b.staff.length >= 4) return fail('Four people is a full crew for this shop.');
    if (state.cash < WAGE * 3) return fail('Keep three weeks of wages in the till before you hire.');
    var person = {
      name: FIRST_NAMES[state.nameIx++ % FIRST_NAMES.length],
      skill: 46 + Math.floor(Math.random() * 22),
      pay: WAGE
    };
    b.staff.push(person);
    log(person.name + ' joins ' + TYPES[b.type].name + '. ' + R(WAGE) + ' a week. Capacity goes up, so does the wage bill.');
    tone(400, 0.05, 'square', 0.04);
    save(); dirty = true;
  }

  function fireOne(ix) {
    var b = focused();
    if (!b || !b.staff[ix]) return;
    var person = b.staff.splice(ix, 1)[0];
    b.morale = clamp(b.morale - 5, 0, 100);
    log(person.name + ' is off the crew. The others noticed.');
    save(); dirty = true;
  }

  function staffAct(kind, ix) {
    var b = focused();
    if (!b || !b.staff[ix]) return;
    var p = b.staff[ix];
    if (kind === 'payup') {
      p.pay = Math.round(p.pay * 1.1 / 10) * 10;
      log(p.name + ' now earns ' + R(p.pay) + '. Morale likes this. The till does not.');
    } else if (kind === 'paydown') {
      p.pay = Math.max(700, Math.round(p.pay * 0.9 / 10) * 10);
      log(p.name + ' now earns ' + R(p.pay) + '. You save cash. Underpaying drains morale, then people leave or strike.');
    } else if (kind === 'train') {
      if (state.cash < 600) return fail('Training is R600.');
      state.cash -= 600;
      p.skill = Math.min(96, p.skill + 8);
      b.morale = clamp(b.morale + 4, 0, 100);
      log(p.name + ' trained. Skill ' + p.skill + '. Mistakes should ease off.');
    }
    save(); dirty = true;
  }

  function borrow() {
    if (state.loan + LOAN_STEP > LOAN_MAX) return fail('The bank stops at ' + R(LOAN_MAX) + '.');
    state.loan += LOAN_STEP;
    state.cash += LOAN_STEP;
    log('Borrowed ' + R(LOAN_STEP) + '. Interest is 20% a year, every week, until it is gone.');
    tone(240, 0.07, 'square', 0.04);
    save(); dirty = true;
  }
  function repay(amount) {
    var n = Math.min(Math.round(amount), Math.round(state.loan), Math.round(state.cash));
    if (n <= 0) return fail('Nothing to repay.');
    state.loan -= n;
    state.cash -= n;
    log('Repaid ' + R(n) + '.');
    save(); dirty = true;
  }
  function resetGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    state = fresh();
    panel = 'help';
    log('A new till.');
    dirty = true;
  }

  function button(act, label, arg, on, dis) {
    return '<button type="button" data-act="' + act + '"' +
      (arg != null ? ' data-arg="' + esc(arg) + '"' : '') +
      (on ? ' class="on"' : '') +
      (dis ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function renderHud() {
    var b = focused();
    cashEl.textContent = R(state.cash);
    var place = b ? townBy(b.town).name : (state.town ? townBy(state.town).name : 'South Africa');
    whenEl.textContent = 'Week ' + state.week + ' · ' + place + ' · ' + state.economyLabel;
    repEl.textContent = 'Rep ' + Math.round(companyRep());
    logEl.textContent = state.log;
    muteEl.textContent = state.sound ? '♪' : '✕';
    document.querySelectorAll('.speeds button[data-act=speed]').forEach(function (btn) {
      btn.classList.toggle('on', Number(btn.getAttribute('data-arg')) === state.speed);
    });
    document.querySelectorAll('nav button').forEach(function (btn) {
      var tab = btn.getAttribute('data-arg');
      var on = tab === 'map' ? !panel : panel === tab;
      btn.classList.toggle('on', on);
    });
  }

  function helpHtml() {
    var label = state.helpSeen ? 'Back to the map' : 'Start';
    return '<div class="how"><div class="how-body"><h2>How to trade</h2>' +
      '<p>You have <b>' + R(START_CASH) + '</b> and one small business. A spaza, a takeaway, or a bakkie.</p>' +
      '<p>Each week, set the <b>price</b>, the <b>supplier</b>, the <b>stock</b>, and the <b>people</b>. Then tap <b>Run week</b>.</p>' +
      '<p>The news says why the numbers moved. A high price pays more per sale and drives people away. A cheap supplier saves cash and comes back as returns. Hire, and you can serve more, but wages never sleep. Overtime stretches the same crew, then morale, mistakes and resignations follow.</p>' +
      '<p>Reputation moves slowly. One good week will not make you famous, and one bad batch will not finish you. Skip maintenance and things break. Cut compliance and a fine finds you. Marketing helps, then flattens if you keep spending.</p>' +
      '<p>Open more shops on the map when the till can carry the rent. The bank will lend. If the till stays empty for six weeks, you are done.</p>' +
      '<p class="lede">All figures are game values, not a real quote. Time pauses while you read. Auto and Fast run the weeks for you, and stop on a decision.</p></div>' +
      '<div class="how-go">' + button('close-help', label) + '</div></div>';
  }

  function startHtml() {
    var html = '<h2>Where do you begin?</h2><p class="lede">One spot. ' + R(START_CASH) + ' in the tin. You can open other lines later.</p><div class="choice">';
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
    html += '</div>';
    return html;
  }

  function bustHtml() {
    return '<h2>The till is empty</h2><p>Six weeks under water. The bank has closed Corner &amp; Co.</p>' +
      '<p class="lede">A loan is cheap until it is the only thing moving. Next time, watch the till, not only the sales.</p>' +
      button('reset-yes', 'Start again');
  }

  function deskHtml() {
    var b = focused();
    if (!b) return '<h2>Desk</h2><p>Tap a town, then a shop.</p>';
    var t = TYPES[b.type];
    var html = '<h2>' + esc(t.name) + '</h2><p class="lede">' + esc(townBy(b.town).name) + ' · ' + esc(t.blurb) + '</p>';
    html += '<div class="card">';
    html += line('Price now', R(unitPrice(b)) + ' a unit');
    html += line('Last week', b.weeks ? (b.lastServed + ' ' + t.unit + ' · surplus ' + R(b.lastSurplus)) : 'Not run yet');
    html += line('Share of this trade', Math.round(b.lastShare * 100) + '%');
    html += line('Reputation', Math.round(b.reputation) + ' (moves a little each week)');
    html += line('Morale', Math.round(b.morale) + (b.morale < 40 ? ' · danger' : ''));
    html += line('Stock', t.stocked ? String(Math.round(b.stock)) : 'No shelf');
    html += line('Rent / upkeep', R(rentOf(b)) + ' / week');
    var rv = rivalsOf(b.town, b.type);
    html += line('Rivals here', rv.length ? rv.map(function (r) { return priceWord(r.price < 0.9 ? 'low' : r.price > 1.12 ? 'high' : 'fair'); }).join(', ') : 'None yet');
    html += '</div>';

    html += '<div class="section">Price</div><div class="grid3">' +
      button('price', 'Cheap', 'low', b.price === 'low') +
      button('price', 'Fair', 'fair', b.price === 'fair') +
      button('price', 'Steep', 'high', b.price === 'high') + '</div>';
    html += '<p class="hint">Cheap fills the shop and starves the margin. High does the opposite, and if you hold it, a rival opens nearby.</p>';

    html += '<div class="section">Supplier</div><div class="grid3">' +
      button('supplier', 'Budget', 'budget', b.supplier === 'budget') +
      button('supplier', 'Standard', 'standard', b.supplier === 'standard') +
      button('supplier', 'Premium', 'premium', b.supplier === 'premium') + '</div>';
    html += '<p class="hint">Budget cuts the cost and the quality. Returns and a slower reputation are the bill.</p>';

    if (t.stocked) {
      html += '<div class="section">Stock order</div><div class="grid3">' +
        button('order', 'Light', 'light', b.order === 'light') +
        button('order', 'Fit', 'fit', b.order === 'fit') +
        button('order', 'Heavy', 'heavy', b.order === 'heavy') + '</div>';
      html += '<p class="hint">You pay for stock before you sell it. Light risks a stockout. Heavy ties cash' + (t.spoil > 0.2 ? ' and food spoils.' : '.') + '</p>';
    }

    html += '<div class="section">Advertising</div><div class="grid3">' +
      button('ads', 'None', '0', b.marketing === 0) +
      button('ads', 'Posters R500', '500', b.marketing === 500) +
      button('ads', 'Radio R2 000', '2000', b.marketing === 2000) + '</div>';
    html += '<p class="hint">Spend lifts demand, then flattens. If the counter is already full, you pay for people you cannot serve. Last month’s posters fade in the background.</p>';

    html += '<div class="section">Hours</div><div class="grid3">' +
      button('hours', 'Shorter', 'easy', b.hours === 'easy') +
      button('hours', 'Normal', 'normal', b.hours === 'normal') +
      button('hours', 'Overtime', 'push', b.hours === 'push') + '</div>';
    html += '<p class="hint">Overtime serves more people and tires everyone out. Wages rise. Mistakes follow. A short week does the reverse.</p>';

    html += '<div class="section">People</div>';
    if (!b.staff.length) html += '<p class="hint">It is only you. About ' + Math.round(t.cap) + ' ' + t.unit + ' a week before the queue snaps.</p>';
    b.staff.forEach(function (p, i) {
      html += '<article class="card"><h3>' + esc(p.name) + ' <span>skill ' + p.skill + '</span></h3>';
      html += line('Pay', R(p.pay) + ' / week');
      html += '<div class="grid3">' + button('paydown', 'Pay less', String(i)) + button('payup', 'Pay more', String(i)) + button('train', 'Train R600', String(i)) + '</div>';
      html += '<div style="height:6px"></div>' + button('fire', 'Let ' + p.name + ' go', String(i));
      html += '</article>';
    });
    html += button('hire', 'Hire a hand · ' + R(WAGE) + '/week', null, false, b.staff.length >= 4);

    html += '<div class="section">Keeping the doors open</div>';
    html += button('service', b.service ? 'Servicing the ' + t.kit + ' this week' : 'Service the ' + t.kit + ' this week', null, b.service);
    html += '<p class="hint">Skipping maintenance is free until the ' + esc(t.kit) + ' dies and half the week goes with it.</p>';
    html += '<div class="grid3">' +
      button('comply', 'Cut corners', 'cut', b.compliance === 'cut') +
      button('comply', 'In order', 'ok', b.compliance === 'ok') +
      button('comply', 'By the book', 'strict', b.compliance === 'strict') + '</div>';
    html += '<p class="hint">Cutting corners saves a bit every week. Inspectors and fines are the other side.</p>';
    html += button('run', 'Run the week');
    return html;
  }

  function line(k, v) {
    return '<div class="split"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>';
  }

  function moneyHtml() {
    var last = state.history[state.history.length - 1];
    var month = 0, i;
    for (i = Math.max(0, state.history.length - 4); i < state.history.length; i++) month += state.history[i].profit;
    var html = '<h2>Money</h2><p class="lede">Surplus is the week’s profit, counting stock still on the shelf. Cash drops when you buy that stock and rises when it sells. Game values.</p>';
    html += '<p class="cashbig">' + esc(R(state.cash)) + '</p><p class="hint">Cash in the till</p>';
    html += '<div class="card">';
    html += line('Last week surplus', last ? R(last.profit) : '—');
    html += line('This month (4 weeks)', state.history.length ? R(month) : '—');
    html += line('Reputation', Math.round(companyRep()) + ' / 100');
    html += line('Staff morale', Math.round(companyMorale()) + ' / 100');
    html += line('Market share', state.history.length ? Math.round(companyShare() * 100) + '% of the trade you are in' : '—');
    html += line('Economy', state.economyLabel);
    html += '</div>';
    html += '<div class="section">Surplus, last weeks</div><div class="card"><div class="chart">';
    if (!state.history.length) html += '<p class="hint">Run a week and the bars will grow.</p>';
    var max = 500;
    state.history.slice(-12).forEach(function (h) { max = Math.max(max, Math.abs(h.profit)); });
    state.history.slice(-12).forEach(function (h) {
      var hgt = Math.max(6, Math.round(Math.abs(h.profit) / max * 64));
      html += '<div class="bar ' + (h.profit >= 0 ? 'up' : 'down') + '" style="height:' + hgt + 'px" title="' + esc(R(h.profit)) + '"></div>';
    });
    html += '</div></div>';
    html += '<div class="section">Bank</div><div class="card">';
    html += line('Loan', R(state.loan));
    html += '<p class="hint">20% a year. About ' + esc(R(state.loan * YEAR_RATE / 52)) + ' every week. Cap ' + esc(R(LOAN_MAX)) + '. Six weeks with an empty till and it is over.</p>';
    html += button('borrow', 'Borrow ' + R(LOAN_STEP), null, false, state.loan + LOAN_STEP > LOAN_MAX);
    html += button('repay', 'Repay R5 000', null, false, state.loan <= 0 || state.cash <= 0);
    html += button('repay-all', 'Repay all', null, false, state.loan <= 0 || state.cash <= 0);
    html += '</div>';
    html += '<div class="section">Shops</div>';
    if (!state.branches.length) html += '<p class="hint">None yet.</p>';
    state.branches.forEach(function (br) {
      html += '<div class="card">' + line(TYPES[br.type].name + ' · ' + townBy(br.town).name, br.weeks ? R(br.lastSurplus) : 'new') + '</div>';
    });
    html += button('reset-yes', 'Wipe this company');
    return html;
  }

  function newsHtml() {
    var html = '<h2>News</h2><p class="lede">Why the numbers moved. Newest first.</p>';
    if (!state.news.length) html += '<p>Run a week. The town will start talking.</p>';
    state.news.forEach(function (n) {
      html += '<article class="card news"><h3>Week ' + n.week + '</h3><p class="' + (n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : '') + '">' + esc(n.text) + '</p></article>';
    });
    return html;
  }

  function renderPanel() {
    var show = panel && panel !== 'map';
    if (!show) { panelEl.className = ''; panelEl.innerHTML = ''; return; }
    panelEl.className = 'open';
    var html = '';
    if (panel === 'help') html = helpHtml();
    else if (panel === 'start') html = startHtml();
    else if (panel === 'card') html = cardHtml();
    else if (panel === 'bust') html = bustHtml();
    else if (panel === 'desk') html = deskHtml();
    else if (panel === 'money') html = moneyHtml();
    else if (panel === 'news') html = newsHtml();
    panelEl.innerHTML = html;
  }

  function renderSheet() {
    if (panel || !state.started || state.bankrupt) { sheetEl.className = ''; sheetEl.innerHTML = ''; return; }
    var town = townBy(state.town) || TOWNS[0];
    var mine = state.branches.filter(function (b) { return b.town === town.id; });
    var html = '<h2>' + esc(town.name) + '</h2><p class="status">' + esc(town.blurb) + '</p><div class="actions">';
    if (!mine.length) html += '<p class="hint">You have no shop here yet.</p>';
    mine.forEach(function (b) {
      html += button('focus', TYPES[b.type].name + ' · surplus ' + (b.weeks ? R(b.lastSurplus) : 'new'), String(b.id), state.focus === b.id);
    });
    html += '<p class="hint">Open another line. The till pays the opening, then the rent every week.</p>';
    Object.keys(TYPES).forEach(function (id) {
      var t = TYPES[id];
      var have = mine.some(function (b) { return b.type === id; });
      html += button('open', t.name + ' · ' + R(t.open), id, false, have || state.cash < t.open);
    });
    html += '</div>';
    sheetEl.className = 'open';
    sheetEl.innerHTML = html;
  }

  function put(x, y, hex) {
    if (x < 0 || y < 0 || x >= GW || y >= GH) return;
    var n = parseInt(hex.slice(1), 16);
    var i = (y * GW + x) * 4;
    pix[i] = (n >> 16) & 255; pix[i + 1] = (n >> 8) & 255; pix[i + 2] = n & 255; pix[i + 3] = 255;
  }
  function nearLine(pts, x, y, rad) {
    var i, best = 1e9;
    for (i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      var steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      var s;
      for (s = 0; s <= steps; s++) {
        var px = ax + (bx - ax) * s / steps;
        var py = ay + (by - ay) * s / steps;
        var d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < best) best = d;
      }
    }
    return best <= rad * rad;
  }
  function onLand(x, y) {
    var spine = [[32, 3], [33, 12], [32, 20], [30, 30], [28, 40], [22, 50], [16, 58]];
    var east = [[33, 14], [40, 22], [45, 30], [40, 38], [34, 44]];
    var west = [[30, 24], [22, 30], [16, 38], [14, 48]];
    return nearLine(spine, x, y, 8) || nearLine(east, x, y, 5.5) || nearLine(west, x, y, 4.5);
  }

  function drawMap() {
    var x, y, land, shade;
    for (y = 0; y < GH; y++) {
      for (x = 0; x < GW; x++) {
        land = onLand(x, y);
        if (!land) shade = ((x + y) % 7 === 0) ? '#7ec4ea' : '#69b4e2';
        else if (y > 40) shade = ((x * 3 + y) % 5 === 0) ? '#d2b15a' : '#c4a24a';
        else shade = ((x + y * 2) % 6 === 0) ? '#2f7d38' : '#3e9a46';
        put(x, y, shade);
      }
    }
    TOWNS.forEach(function (t) {
      var mine = state.branches.some(function (b) { return b.town === t.id; });
      var col = mine ? '#f0c14a' : '#f7f3ea';
      var s;
      for (s = -1; s <= 1; s++) {
        put(t.x + s, t.y, '#1c2614');
        put(t.x, t.y + s, '#1c2614');
      }
      put(t.x, t.y, col);
      if (state.town === t.id) {
        put(t.x - 2, t.y, '#1c2614');
        put(t.x + 2, t.y, '#1c2614');
        put(t.x, t.y - 2, '#1c2614');
        put(t.x, t.y + 2, '#1c2614');
      }
    });
  }

  function draw() {
    var cssW = canvas.clientWidth || 300;
    var cssH = canvas.clientHeight || 240;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var bw = Math.max(1, Math.floor(cssW * dpr));
    var bh = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    var scale = Math.max(1, Math.floor(Math.min(cssW / GW, cssH / GH)));
    view.scale = scale; view.cssW = cssW; view.cssH = cssH;
    view.ox = Math.floor((cssW - GW * scale) / 2);
    view.oy = Math.floor((cssH - GH * scale) / 2);
    drawMap();
    octx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#69b4e2';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(off, view.ox, view.oy, GW * scale, GH * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.font = '700 13px system-ui, sans-serif';
    TOWNS.forEach(function (t) {
      var mine = state.branches.some(function (b) { return b.town === t.id; });
      var selected = state.town === t.id;
      if (!mine && !selected) return;
      var tx = view.ox + t.x * scale;
      var ty = view.oy + t.y * scale;
      var name = selected ? t.name : (t.map || t.name);
      ctx.textAlign = t.align || 'center';
      var lx = tx;
      var ly = ty - 10;
      if (t.align === 'left') { lx = tx + 6; ly = ty + 4; }
      if (t.align === 'right') { lx = tx - 6; ly = ty + 4; }
      ctx.fillStyle = '#1c2614';
      ctx.fillText(name, lx + 1, ly + 1);
      ctx.fillStyle = selected ? '#f0c14a' : '#fffaf0';
      ctx.fillText(name, lx, ly);
    });
    ctx.imageSmoothingEnabled = false;
  }

  function hitTown(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) * (view.cssW / rect.width);
    var y = (clientY - rect.top) * (view.cssH / rect.height);
    var best = null, bestD = 1e9, i;
    for (i = 0; i < TOWNS.length; i++) {
      var tx = view.ox + TOWNS[i].x * view.scale;
      var ty = view.oy + TOWNS[i].y * view.scale;
      var d = (tx - x) * (tx - x) + (ty - y) * (ty - y);
      if (d < bestD) { bestD = d; best = TOWNS[i]; }
    }
    if (!best || bestD > (22 * 22)) return null;
    return best;
  }

  function render() { renderHud(); renderSheet(); renderPanel(); dirty = false; }

  canvas.addEventListener('pointerdown', function (e) {
    if (panel && panel !== 'map') return;
    unlock();
    var town = hitTown(e.clientX, e.clientY);
    if (!town || !state.started) return;
    state.town = town.id;
    var mine = state.branches.filter(function (b) { return b.town === town.id; });
    if (mine.length === 1) state.focus = mine[0].id;
    tone(480, 0.03, 'square', 0.025);
    dirty = true;
  });

  document.body.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    unlock();
    act(b.getAttribute('data-act'), b.getAttribute('data-arg'));
  });

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.code === 'KeyM') act('mute');
    if (e.code === 'Space') { e.preventDefault(); act('run'); }
    if (e.code === 'Escape' && (panel === 'desk' || panel === 'money' || panel === 'news')) act('tab', 'map');
  });

  function unlock() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (err) {}
  }

  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min(80, now - lastT);
    lastT = now;
    var blocked = !state.started || state.bankrupt || state.pending || (panel && panel !== 'map') || document.hidden || state.speed === 0;
    if (!blocked) {
      acc += dt * (state.speed === 3 ? 2.8 : 1);
      var guard = 0;
      while (acc >= 1100 && guard < 2 && !state.pending) {
        acc -= 1100;
        guard++;
        try { runWeek(); } catch (err) {
          console.error(err);
          log('The week stumbled. ' + err.message);
          acc = 0;
          break;
        }
      }
    }
    if (dirty) render();
    draw();
    requestAnimationFrame(frame);
  }

  state = load();
  if (!state.helpSeen) panel = 'help';
  else if (!state.started) panel = 'start';
  else if (state.bankrupt) panel = 'bust';
  render();
  requestAnimationFrame(frame);
  window.addEventListener('resize', function () { dirty = true; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  window.Corner = {
    get state() { return state; },
    act: function (n, a) { act(n, a); render(); },
    resolve: function () { return resolveWeek(); },
    force: function (id) { state.pending = eventCard(id); panel = 'card'; dirty = true; render(); },
    demand: willingDemand,
    quality: qualityOf
  };
})();
