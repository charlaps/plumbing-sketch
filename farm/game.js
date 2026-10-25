/* Veld Farm — highveld tycoon. Prices, yields and wages are game values, not a quote. */
(function () {
  'use strict';

  var COLS = 6;
  var ROWS = 7;
  var SKY = 24;
  var SAVE_KEY = 'veld-farm-save';
  var START_CASH = 28000;
  var WAGE = 320;
  var DIESEL = 250;
  var FENCE_COST = 2000;
  var PASTURE_COST = 800;
  var POWER = 70;
  var LOAN_STEP = 20000;
  var LOAN_MAX = 240000;
  var YEAR_RATE = 0.14;
  var YEAR_DAYS = 112;
  var HOUSE_STORE = 2;

  var SEASONS = [
    { id: 'summer', name: 'Summer', months: 'Dec–Feb' },
    { id: 'autumn', name: 'Autumn', months: 'Mar–May' },
    { id: 'winter', name: 'Winter', months: 'Jun–Aug' },
    { id: 'spring', name: 'Spring', months: 'Sep–Nov' }
  ];

  var CROPS = {
    maize: { name: 'Maize', season: 'summer', days: 56, seed: 4000, fert: 4500, chem: 1200, yieldDry: 6, yieldIrr: 9.5 },
    soybean: { name: 'Soybean', season: 'summer', days: 52, seed: 2800, fert: 2200, chem: 1100, yieldDry: 2.2, yieldIrr: 3.4 },
    sunflower: { name: 'Sunflower', season: 'summer', days: 60, seed: 1600, fert: 1900, chem: 900, yieldDry: 1.7, yieldIrr: 2.5 },
    wheat: { name: 'Wheat', season: 'winter', days: 64, seed: 2200, fert: 3600, chem: 1000, yieldDry: 3.2, yieldIrr: 5.2 }
  };

  var BASE = {
    maize: 4000, wheat: 4200, soybean: 7500, sunflower: 8500,
    cattle: 14000, sheep: 2800, pig: 2600, eggs: 38, milk: 6.8
  };

  var SEASON_F = {
    maize: { summer: 1.04, autumn: 0.84, winter: 1.12, spring: 1.06 },
    wheat: { summer: 0.9, autumn: 1.02, winter: 1.08, spring: 1.14 },
    soybean: { summer: 1.05, autumn: 0.86, winter: 1.08, spring: 1.04 },
    sunflower: { summer: 1.06, autumn: 0.88, winter: 1.12, spring: 1.05 },
    cattle: { summer: 1.02, autumn: 0.96, winter: 1.08, spring: 1.04 },
    sheep: { summer: 1, autumn: 0.95, winter: 1.06, spring: 1.08 },
    pig: { summer: 1.02, autumn: 1, winter: 1.05, spring: 1 },
    eggs: { summer: 0.96, autumn: 1, winter: 1.08, spring: 1.02 },
    milk: { summer: 0.94, autumn: 1, winter: 1.1, spring: 1.04 }
  };

  var BUILDINGS = {
    silo: { name: 'Silo', cost: 36000, blurb: 'Stores 80 tons of grain, so you can wait for a better price.' },
    barn: { name: 'Barn', cost: 28000, blurb: 'Stores 15 tons and trims the feed bill.' },
    shed: { name: 'Shed', cost: 18000, blurb: 'Room for 8 pigs. Tools stay out of the weather.' },
    kraal: { name: 'Kraal', cost: 15000, blurb: 'Holds 6 cattle or 14 sheep. They also need fenced pasture.' },
    coop: { name: 'Chicken house', cost: 12000, blurb: 'Holds 20 chickens.' },
    borehole: { name: 'Borehole', cost: 55000, blurb: 'A windpump. Irrigate any day. Power is about R70 per hectare per day.' },
    dam: { name: 'Dam', cost: 26000, blurb: 'Catches rain. You can irrigate until the water runs low.' }
  };

  var MACHINES = {
    tractor: { name: 'Tractor', cost: 165000, blurb: 'An extra hand each day. With the right implement, a job finishes today. Diesel is R250 a job.' },
    plough: { name: 'Plough', cost: 22000, blurb: 'With a tractor, ploughing finishes the same day.' },
    planter: { name: 'Planter', cost: 46000, blurb: 'With a tractor, planting finishes the same day.' },
    sprayer: { name: 'Sprayer', cost: 27000, blurb: 'With a tractor, spraying finishes the same day.' },
    harvester: { name: 'Harvester', cost: 210000, blurb: 'Cuts a hectare the same day and saves a little grain.' },
    trailer: { name: 'Trailer', cost: 18000, blurb: 'Less grain spilled on the road to the silo.' }
  };

  var STOCK = {
    cattle: { name: 'Cattle', buy: 9800, blurb: 'Need a kraal and fenced pasture. Cows give milk.' },
    sheep: { name: 'Sheep', buy: 2200, blurb: 'Need a kraal and fenced pasture.' },
    pig: { name: 'Pig', buy: 1700, blurb: 'Needs space in a shed.' },
    chicken: { name: 'Chicken', buy: 85, blurb: 'Needs a chicken house. Hens lay eggs.' }
  };

  var IN_LABEL = { crops: 'Crop sales', stock: 'Livestock', dairy: 'Eggs and milk', salvage: 'Salvage' };
  var OUT_LABEL = {
    inputs: 'Seed, fertiliser, chemicals',
    feed: 'Feed',
    wages: 'Wages',
    diesel: 'Diesel and power',
    builds: 'Buildings and fences',
    land: 'Land',
    machines: 'Machines',
    animals: 'Livestock bought',
    interest: 'Loan interest'
  };

  var PAL = {
    '.': null,
    K: '#1c2418',
    w: '#f7f3ea',
    r: '#c4473a',
    R: '#8e2c24',
    y: '#f2d04a',
    Y: '#e0a020',
    g: '#3e9a46',
    G: '#246b32',
    d: '#c47a3a',
    D: '#8d4b28',
    s: '#e7c27a',
    b: '#7eb6e0',
    B: '#3a78c2',
    t: '#d5dee6',
    n: '#8ea0ae',
    p: '#f0c8a0',
    c: '#f4efe4',
    e: '#c9d48a',
    k: '#5c3a22',
    a: '#e7a0b0',
    W: '#f7f4ee',
    u: '#6b442c',
    l: '#9fd0f0',
    o: '#f0c14a',
    m: '#2f8f3a'
  };

  var cashEl = document.getElementById('cash');
  var whenEl = document.getElementById('when');
  var handsEl = document.getElementById('hands');
  var logEl = document.getElementById('log');
  var muteEl = document.getElementById('mute');
  var sheetEl = document.getElementById('sheet');
  var panelEl = document.getElementById('panel');
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var off = document.createElement('canvas');
  off.width = COLS * 16;
  off.height = SKY + ROWS * 16;
  var octx = off.getContext('2d', { willReadFrequently: true });
  var img = octx.createImageData(off.width, off.height);
  var pix = img.data;

  var state;
  var panel = null;
  var menu = 'root';
  var confirmReset = false;
  var view = { ox: 0, oy: 0, scale: 1, cssW: 1, cssH: 1 };
  var audioCtx = null;
  var acc = 0;
  var lastT = 0;
  var dirty = true;

  function fresh() {
    var plots = [];
    var y, x;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        var house = x === 2 && y === 2;
        var home = x === 2 && y === 3;
        plots.push({
          x: x, y: y,
          owned: house || home,
          kind: house ? 'build' : 'grass',
          structure: house ? 'house' : null,
          fence: false,
          crop: null,
          age: 0,
          fert: false,
          spray: false,
          water: false,
          moist: 58,
          moistSum: 0,
          moistN: 0,
          waterN: 0,
          hurt: 0,
          late: false,
          pestSaid: false,
          readySaid: false,
          overSaid: false,
          stormSaid: false,
          work: null
        });
      }
    }
    return {
      v: 1,
      day: 1,
      cash: START_CASH,
      loan: 0,
      speed: 1,
      sound: true,
      helpSeen: false,
      weather: 'sun',
      dam: 0,
      hands: 1,
      workers: 0,
      machines: { tractor: false, plough: false, planter: false, harvester: false, sprayer: false, trailer: false },
      herd: {
        cattle: { n: 0, cond: 1 },
        sheep: { n: 0, cond: 1 },
        pig: { n: 0, cond: 1 },
        chicken: { n: 0, cond: 1 }
      },
      grain: { maize: 0, wheat: 0, soybean: 0, sunflower: 0 },
      eggs: 0,
      milk: 0,
      prices: {
        maize: 4000, wheat: 4200, soybean: 7500, sunflower: 8500,
        cattle: 14000, sheep: 2800, pig: 2600, eggs: 38, milk: 6.8
      },
      supply: { maize: 2, wheat: 2, soybean: 2, sunflower: 2, cattle: 1, sheep: 1, pig: 1, eggs: 1, milk: 1 },
      inn: blankBooks(),
      out: blankBooks(),
      innLife: blankBooks(),
      outLife: blankBooks(),
      ledger: [],
      log: 'Tap the bright hectare under the house.',
      plots: plots,
      sel: null,
      tutorial: true
    };
  }

  function blankBooks() {
    return { crops: 0, stock: 0, dairy: 0, salvage: 0, inputs: 0, feed: 0, wages: 0, diesel: 0, builds: 0, land: 0, machines: 0, animals: 0, interest: 0 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var data = JSON.parse(raw);
      if (!data || data.v !== 1 || !data.plots || data.plots.length !== COLS * ROWS) return fresh();
      return data;
    } catch (e) {
      return fresh();
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function R(n) {
    var v = Math.round(n);
    var sign = v < 0 ? '-' : '';
    var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    return sign + 'R' + s;
  }

  function Rdec(n) {
    var v = Math.round(n * 100) / 100;
    return 'R' + v.toFixed(2);
  }

  function tons(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function seasonIndex(day) { return Math.floor((day - 1) / 28) % 4; }
  function seasonInfo(day) { return SEASONS[seasonIndex(day)]; }
  function seasonDay(day) { return ((day - 1) % 28) + 1; }
  function yearOf(day) { return Math.floor((day - 1) / 112) + 1; }

  function log(msg) { state.log = msg; }

  function tone(freq, dur, type, vol) {
    if (!state.sound) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol || 0.04, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function chime() {
    tone(523, 0.08, 'square', 0.04);
    setTimeout(function () { tone(659, 0.1, 'square', 0.04); }, 90);
  }

  function fail(msg) {
    log(msg);
    tone(140, 0.12, 'sawtooth', 0.03);
    dirty = true;
    return false;
  }

  function book(dir, bucket, amount, reason) {
    var side = dir === 'in' ? state.inn : state.out;
    var life = dir === 'in' ? state.innLife : state.outLife;
    side[bucket] = (side[bucket] || 0) + amount;
    life[bucket] = (life[bucket] || 0) + amount;
    state.ledger.unshift({ day: state.day, dir: dir, amount: Math.round(amount), reason: reason });
    if (state.ledger.length > 14) state.ledger.pop();
  }

  function pay(amount, reason, bucket) {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    if (state.cash < amount) return false;
    state.cash -= amount;
    book('out', bucket, amount, reason);
    return true;
  }

  function earn(amount, reason, bucket) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    state.cash += amount;
    book('in', bucket, amount, reason);
  }

  function selected() {
    if (state.sel == null) return null;
    return state.plots[state.sel] || null;
  }

  function countBuild(id) {
    var n = 0;
    state.plots.forEach(function (p) { if (p.structure === id) n++; });
    return n;
  }

  function storageCap() {
    return HOUSE_STORE + countBuild('silo') * 80 + countBuild('barn') * 15;
  }

  function storedTons() {
    var g = state.grain;
    return g.maize + g.wheat + g.soybean + g.sunflower;
  }

  function fencedHa(ignore) {
    var n = 0;
    state.plots.forEach(function (p, i) {
      if (i === ignore) return;
      if (p.owned && p.kind === 'pasture' && p.fence) n++;
    });
    return n;
  }

  function kraalCount(ignore) {
    var n = 0;
    state.plots.forEach(function (p, i) {
      if (i !== ignore && p.structure === 'kraal') n++;
    });
    return n;
  }

  function pastureFits(extraC, extraS, ignore) {
    var cattle = state.herd.cattle.n + extraC;
    var sheep = state.herd.sheep.n + extraS;
    if (!cattle && !sheep) return true;
    return cattle / 4 + sheep / 8 <= fencedHa(ignore) + 1e-6;
  }

  function herdFits(extraC, extraS, ignoreKraal) {
    var cattle = state.herd.cattle.n + extraC;
    var sheep = state.herd.sheep.n + extraS;
    if (!cattle && !sheep) return true;
    var k = kraalCount(ignoreKraal);
    if (!k) return false;
    return cattle / 6 + sheep / 14 <= k + 1e-6;
  }

  function pigCap(ignoreShed) {
    var n = 0;
    state.plots.forEach(function (p, i) {
      if (i !== ignoreShed && p.structure === 'shed') n++;
    });
    return n * 8;
  }

  function chickenCap(ignore) {
    var n = 0;
    state.plots.forEach(function (p, i) {
      if (i !== ignore && p.structure === 'coop') n++;
    });
    return n * 20;
  }

  function actionCap() {
    return 1 + state.workers + (state.machines.tractor ? 1 : 0);
  }

  function landPrice(p) {
    var dist = Math.abs(p.x - 2) + Math.abs(p.y - 2);
    return 18000 + dist * 3500;
  }

  function guideProfit(id, irrigated) {
    var c = CROPS[id];
    var yld = irrigated ? c.yieldIrr : c.yieldDry;
    var power = irrigated ? POWER * c.days : 0;
    return yld * state.prices[id] - c.seed - c.fert - c.chem - power;
  }

  function spendHand() {
    if (state.hands <= 0) return fail('No hands left today. A worker or a tractor gives you more.');
    state.hands--;
    return true;
  }

  function tractorReady(kind) {
    if (!state.machines.tractor || state.cash < DIESEL) return false;
    if (kind === 'plough') return !!state.machines.plough;
    if (kind === 'plant') return !!state.machines.planter;
    if (kind === 'spray') return !!state.machines.sprayer;
    if (kind === 'harvest') return !!state.machines.harvester;
    if (kind === 'pasture') return true;
    return false;
  }

  function burnDiesel() {
    pay(DIESEL, 'Diesel', 'diesel');
  }

  function startCrop(p, crop, late) {
    p.kind = 'crop';
    p.crop = crop;
    p.age = 0;
    p.moistSum = p.moist;
    p.moistN = 1;
    p.waterN = 0;
    p.hurt = 0;
    p.late = !!late;
    p.pestSaid = false;
    p.readySaid = false;
    p.overSaid = false;
    p.stormSaid = false;
  }

  function harvestTons(p) {
    var c = CROPS[p.crop];
    var avg = p.moistN ? p.moistSum / p.moistN : p.moist;
    var ratio = c.yieldIrr / c.yieldDry;
    var waterBonus = 1;
    var span = Math.max(1, p.age);
    if (p.waterN > span * 0.45) waterBonus = ratio;
    else if (p.waterN > span * 0.15) waterBonus = 1 + (ratio - 1) * 0.5;
    var f = avg >= 60 ? 1 : avg >= 45 ? 0.84 : avg >= 30 ? 0.62 : 0.4;
    if (waterBonus > 1.2) f = Math.max(f, 0.94);
    var t = c.yieldDry * waterBonus * f;
    t *= p.fert ? 1 : 0.72;
    t *= p.spray ? 1 : 0.86;
    t *= p.late ? 0.8 : 1;
    t *= Math.max(0.4, 1 - (p.hurt || 0));
    if (!state.machines.harvester) t *= 0.96;
    if (!state.machines.trailer) t *= 0.98;
    t *= 0.96 + Math.random() * 0.08;
    if (p.age > c.days + 8) {
      var over = p.age - (c.days + 8);
      t *= Math.max(0.2, 1 - over * 0.07);
    }
    return Math.max(0.1, Math.round(t * 10) / 10);
  }

  function storeHarvest(crop, amount, notes) {
    var room = Math.max(0, storageCap() - storedTons());
    var keep = Math.min(amount, room);
    keep = Math.round(keep * 10) / 10;
    var sell = Math.round((amount - keep) * 10) / 10;
    state.grain[crop] = Math.round((state.grain[crop] + keep) * 10) / 10;
    var name = CROPS[crop].name;
    if (sell > 0) {
      var money = Math.round(sell * state.prices[crop]);
      earn(money, name + ' off the trailer', 'crops');
      state.supply[crop] += sell;
      notes.push(tons(sell) + ' t ' + name.toLowerCase() + ' sold now for ' + R(money) + '.');
    }
    if (keep > 0) notes.push(tons(keep) + ' t ' + name.toLowerCase() + ' stored.');
    if (!countBuild('silo') && sell > 0) notes.push('A silo would let you keep more.');
  }

  function finishWork(p, notes) {
    var w = p.work;
    p.work = null;
    if (!w) return;
    if (w.type === 'plough') {
      p.kind = 'ploughed';
      p.crop = null;
      p.fert = false;
      p.spray = false;
      notes.push('The hectare is ploughed.');
    } else if (w.type === 'plant') {
      startCrop(p, w.crop, w.late);
      notes.push(CROPS[w.crop].name + ' is in the ground.');
    } else if (w.type === 'spray') {
      p.spray = true;
      notes.push('Spraying is done.');
    } else if (w.type === 'pasture') {
      p.kind = 'pasture';
      p.crop = null;
      notes.push('The camp is under grass.');
    } else if (w.type === 'harvest') {
      var crop = p.crop;
      var got = harvestTons(p);
      p.kind = 'ploughed';
      p.crop = null;
      p.age = 0;
      p.fert = false;
      p.spray = false;
      p.water = false;
      storeHarvest(crop, got, notes);
      chime();
    }
  }

  function tidy(key, value) {
    var base = BASE[key];
    var v = Math.min(base * 1.42, Math.max(base * 0.72, value));
    if (key === 'milk') return Math.round(v * 100) / 100;
    if (key === 'eggs') return Math.round(v);
    return Math.round(v / 10) * 10;
  }

  function tickPrices() {
    var s = seasonInfo(state.day).id;
    Object.keys(BASE).forEach(function (key) {
      state.supply[key] = (state.supply[key] || 0) * 0.965;
      var pressure = Math.min(0.18, state.supply[key] * 0.008);
      var target = BASE[key] * SEASON_F[key][s] * (1 - pressure);
      var next = state.prices[key] + (target - state.prices[key]) * 0.12;
      next += (Math.random() - 0.5) * BASE[key] * 0.018;
      state.prices[key] = tidy(key, next);
    });
  }

  function growCond(kind, d) {
    var h = state.herd[kind];
    if (!h.n) return;
    h.cond = Math.max(0.45, Math.min(1.12, h.cond + d));
  }

  function dawn() {
    var notes = [];
    var prev = seasonInfo(state.day).id;
    state.day++;
    var now = seasonInfo(state.day);
    if (now.id !== prev) {
      state.inn = blankBooks();
      state.out = blankBooks();
      notes.push(now.name + ' on the highveld (' + now.months + ').');
      if (now.id === 'autumn') {
        state.supply.maize += 16;
        state.supply.soybean += 12;
        state.supply.sunflower += 12;
        notes.push('Harvest is weighing on summer-crop prices.');
      }
      if (now.id === 'spring') {
        state.supply.wheat += 14;
        notes.push('New wheat is weighing on the price.');
      }
    }

    var oldWeather = state.weather;
    if (Math.random() > 0.38) state.weather = rollWeather();
    if (state.weather !== oldWeather && (state.weather === 'rain' || state.weather === 'storm' || state.weather === 'dry')) {
      notes.push(weatherLine());
    }

    var said = {};
    function once(key, msg) {
      if (said[key]) return;
      said[key] = true;
      notes.push(msg);
    }

    var powerPlots = [];
    state.plots.forEach(function (p) {
      if (p.kind === 'build') return;
      if (state.weather === 'rain') p.moist = Math.min(100, p.moist + 16);
      else if (state.weather === 'storm') p.moist = Math.min(100, p.moist + 22);
      else if (state.weather === 'cloud') p.moist = Math.max(0, p.moist - 2);
      else if (state.weather === 'dry') p.moist = Math.max(0, p.moist - 9);
      else p.moist = Math.max(0, p.moist - 5);
      p.gotWater = false;
      if (p.water && p.owned && (p.kind === 'crop' || p.kind === 'pasture' || p.kind === 'ploughed')) {
        powerPlots.push(p);
      }
    });
    if (state.weather === 'rain' || state.weather === 'storm') {
      if (countBuild('dam')) state.dam = Math.min(damCap(), state.dam + (state.weather === 'storm' ? 5 : 3));
    } else if (state.weather === 'dry') {
      state.dam = Math.max(0, state.dam - 1);
    }
    applyWater(powerPlots, once);

    state.plots.forEach(function (p) {
      if (p.kind !== 'crop' || !p.crop) return;
      var c = CROPS[p.crop];
      p.age++;
      p.moistSum += p.moist;
      p.moistN++;
      if (p.gotWater) p.waterN++;
      if (!p.spray && Math.random() < 0.05) {
        p.hurt += 0.04;
        if (!p.pestSaid) {
          p.pestSaid = true;
          notes.push('Pests in the ' + c.name.toLowerCase() + '. Spray if you can.');
        }
      }
      if (state.weather === 'storm' && p.age < 12) {
        p.hurt += 0.07;
        if (!p.stormSaid) {
          p.stormSaid = true;
          notes.push('Wind knocked the young ' + c.name.toLowerCase() + '.');
        }
      }
      if (p.age === c.days && !p.readySaid) {
        p.readySaid = true;
        notes.push(c.name + ' is ready to cut.');
      }
      if (p.age === c.days + 9 && !p.overSaid) {
        p.overSaid = true;
        notes.push(c.name + ' is standing too long.');
      }
    });

    tickAnimals(notes, once);
    if (state.workers > 0) {
      var bill = state.workers * WAGE;
      if (state.cash >= bill) pay(bill, 'Wages', 'wages');
      else {
        state.workers--;
        notes.push('Wages bounced. A worker left.');
      }
    }
    if (state.loan > 0) {
      var due = state.loan * YEAR_RATE / YEAR_DAYS;
      if (state.cash >= due) pay(due, 'Loan interest', 'interest');
      else {
        state.loan = Math.round(state.loan + due);
        state.out.interest += due;
        state.outLife.interest += due;
        notes.push('Interest was added to the loan.');
      }
    }

    state.plots.forEach(function (p) {
      if (!p.work) return;
      p.work.left--;
      if (p.work.left <= 0) finishWork(p, notes);
    });

    tickPrices();
    spoilPantry(notes);
    state.hands = actionCap();
    if (!notes.length) notes.push(weatherLine());
    log(notes.slice(0, 2).join(' '));
    save();
    dirty = true;
  }

  function damCap() { return 8 + countBuild('dam') * 14; }

  function applyWater(plots, once) {
    var i;
    if (countBuild('borehole')) {
      var afford = Math.floor(state.cash / POWER);
      for (i = 0; i < plots.length; i++) {
        if (i < afford) {
          plots[i].gotWater = true;
          plots[i].moist = Math.max(plots[i].moist, 74);
        }
      }
      var bill = Math.min(plots.length, afford) * POWER;
      if (bill > 0) pay(bill, 'Borehole power', 'diesel');
      if (afford < plots.length) once('power', 'Not enough cash to irrigate every hectare.');
      return;
    }
    if (countBuild('dam')) {
      for (i = 0; i < plots.length; i++) {
        if (state.dam < 1) {
          once('dam', 'The dam is empty.');
          break;
        }
        state.dam -= 1;
        plots[i].gotWater = true;
        plots[i].moist = Math.max(plots[i].moist, 68);
      }
      return;
    }
    if (plots.length) once('nowater', 'Irrigation is on, but there is no borehole or dam.');
  }

  function rollWeather() {
    var bag = {
      summer: [['sun', 42], ['cloud', 20], ['rain', 26], ['storm', 7], ['dry', 5]],
      autumn: [['sun', 40], ['cloud', 26], ['rain', 20], ['storm', 4], ['dry', 10]],
      winter: [['sun', 48], ['cloud', 24], ['rain', 8], ['storm', 2], ['dry', 18]],
      spring: [['sun', 36], ['cloud', 22], ['rain', 28], ['storm', 6], ['dry', 8]]
    }[seasonInfo(state.day).id];
    var roll = Math.random() * 100;
    var accn = 0;
    var i;
    for (i = 0; i < bag.length; i++) {
      accn += bag[i][1];
      if (roll <= accn) return bag[i][0];
    }
    return 'sun';
  }

  function weatherLine() {
    if (state.weather === 'rain') return 'Rain on the lands.';
    if (state.weather === 'storm') return 'A storm is crossing the farm.';
    if (state.weather === 'dry') return 'The veld is dry.';
    if (state.weather === 'cloud') return 'Cloud over the lands.';
    return 'A clear highveld day.';
  }

  function weatherWord() {
    if (state.weather === 'sun') return 'Sun';
    if (state.weather === 'cloud') return 'Cloud';
    if (state.weather === 'rain') return 'Rain';
    if (state.weather === 'storm') return 'Storm';
    return 'Dry';
  }

  function tickAnimals(notes, once) {
    var barn = countBuild('barn') > 0;
    var hens = state.herd.chicken.n;
    var room = chickenCap(-1);
    if (hens > room) {
      notes.push((hens - room) + ' chickens left. They need a house.');
      state.herd.chicken.n = room;
      hens = room;
    }
    if (hens > 0) {
      var cfeed = Math.round(hens * (barn ? 0.35 : 0.5));
      if (!pay(cfeed, 'Chicken feed', 'feed')) once('feed', 'Feed money is short.');
      state.eggs += hens * 0.85;
    }
    var pigs = state.herd.pig.n;
    var pcap = pigCap(-1);
    if (pigs > pcap) {
      notes.push((pigs - pcap) + ' pigs got out. They need a shed.');
      state.herd.pig.n = pcap;
      pigs = pcap;
    }
    if (pigs > 0) {
      var pfeed = Math.round(pigs * (barn ? 12 : 16));
      if (!pay(pfeed, 'Pig feed', 'feed')) once('feed', 'Feed money is short.');
      else growCond('pig', 0.006);
    }
    var cattle = state.herd.cattle.n;
    var sheep = state.herd.sheep.n;
    var grassOk = pastureFits(0, 0, -1);
    var housed = herdFits(0, 0, -1);
    if ((cattle || sheep) && !housed) once('kraal', 'Cattle and sheep need a kraal.');
    else if ((cattle || sheep) && !grassOk) once('grass', 'The pasture is short. Fence more camp.');
    if (cattle && !grassOk) {
      var cf = Math.round(cattle * (barn ? 18 : 28));
      if (!pay(cf, 'Cattle feed', 'feed')) once('feed', 'Feed money is short.');
    }
    if (sheep && !grassOk) {
      var sf = Math.round(sheep * (barn ? 6 : 9));
      if (!pay(sf, 'Sheep feed', 'feed')) once('feed', 'Feed money is short.');
    }
    if (cattle && grassOk && housed) {
      state.milk += cattle * 7;
      growCond('cattle', 0.004);
    } else growCond('cattle', cattle ? -0.008 : 0);
    if (sheep && grassOk && housed) growCond('sheep', 0.004);
    else growCond('sheep', sheep ? -0.008 : 0);
  }

  function spoilPantry(notes) {
    if (state.eggs > 48) {
      var lostE = Math.round(state.eggs * 0.12);
      state.eggs -= lostE;
      notes.push('Some eggs spoiled. Sell them sooner.');
    }
    if (state.milk > 100) {
      var lostM = Math.round(state.milk * 0.35);
      state.milk -= lostM;
      notes.push('Milk soured. Sell it sooner.');
    }
  }

  function moistWord(n) {
    if (n >= 70) return 'good moisture';
    if (n >= 48) return 'fair moisture';
    if (n >= 30) return 'dry soil';
    return 'drought';
  }

  function act(name, arg) {
    var p = selected();
    if (name === 'speed') {
      state.speed = Number(arg) || 0;
      log(state.speed === 0 ? 'Time is paused.' : state.speed === 3 ? 'Days are running fast.' : 'One day at a time.');
      save();
      dirty = true;
      tone(300, 0.04, 'square', 0.03);
      return;
    }
    if (name === 'tab') {
      panel = arg === 'farm' ? null : arg;
      confirmReset = false;
      if (panel) state.speedWas = state.speed;
      dirty = true;
      return;
    }
    if (name === 'help') {
      panel = 'help';
      dirty = true;
      return;
    }
    if (name === 'close-help') {
      state.helpSeen = true;
      panel = null;
      save();
      dirty = true;
      return;
    }
    if (name === 'mute') {
      state.sound = !state.sound;
      if (state.sound) tone(660, 0.07, 'square', 0.04);
      save();
      dirty = true;
      return;
    }
    if (name === 'menu') {
      menu = arg || 'root';
      dirty = true;
      return;
    }
    if (name === 'close-sheet') {
      state.sel = null;
      menu = 'root';
      dirty = true;
      return;
    }
    if (name === 'buy-land') {
      if (!p || p.owned) return;
      var price = landPrice(p);
      if (!pay(price, 'Hectare', 'land')) return fail('This hectare is ' + R(price) + '. The bank will lend.');
      p.owned = true;
      p.kind = 'grass';
      log('The hectare is yours.');
      chime();
      save();
      dirty = true;
      return;
    }
    if (name === 'plough') return doPlough(p);
    if (name === 'plant') return doPlant(p, arg);
    if (name === 'fert') return doFert(p);
    if (name === 'spray') return doSpray(p);
    if (name === 'water') return doWater(p);
    if (name === 'harvest') return doHarvest(p);
    if (name === 'pasture') return doPasture(p);
    if (name === 'fence') return doFence(p);
    if (name === 'build') return doBuild(p, arg);
    if (name === 'remove') return doRemove(p);
    if (name === 'buy-machine') return buyMachine(arg);
    if (name === 'buy-animal') return buyAnimal(arg, 1);
    if (name === 'buy-hens') return buyAnimal('chicken', 10);
    if (name === 'hire') return hire();
    if (name === 'fire') return fire();
    if (name === 'sell-grain') return sellGrain(arg, false);
    if (name === 'sell-all-grain') return sellGrain(arg, true);
    if (name === 'sell-animal') return sellAnimal(arg);
    if (name === 'sell-eggs') return sellEggs();
    if (name === 'sell-milk') return sellMilk();
    if (name === 'borrow') return borrow();
    if (name === 'repay') return repay(LOAN_STEP);
    if (name === 'repay-all') return repay(Math.min(state.loan, state.cash));
    if (name === 'reset-ask') { confirmReset = true; dirty = true; return; }
    if (name === 'reset-no') { confirmReset = false; dirty = true; return; }
    if (name === 'reset-yes') return resetFarm();
  }

  function needPlot(p) {
    if (!p || !p.owned) return fail('Tap one of your hectares first.');
    if (p.structure === 'house') return fail('That is the house.');
    if (p.work) return fail(workText(p));
    return true;
  }

  function doPlough(p) {
    if (!needPlot(p)) return;
    if (p.kind === 'crop') return fail('There is a crop standing. Harvest it first.');
    if (p.kind === 'build') return fail('There is a building here.');
    var idx = state.plots.indexOf(p);
    if (p.kind === 'pasture' && !pastureFits(0, 0, idx)) return fail('The animals still need this fenced camp.');
    if (!spendHand()) return;
    p.fert = false;
    p.spray = false;
    p.water = false;
    if (tractorReady('plough')) {
      burnDiesel();
      p.kind = 'ploughed';
      p.crop = null;
      log('Ploughed today with the tractor.');
      tone(180, 0.09, 'square', 0.04);
    } else {
      p.work = { type: 'plough', left: 1 };
      log('Ploughing by hand. It finishes overnight.');
    }
    state.tutorial = false;
    menu = 'root';
    save();
    dirty = true;
  }

  function doPlant(p, crop) {
    if (!needPlot(p)) return;
    var c = CROPS[crop];
    if (!c) return;
    if (seasonInfo(state.day).id !== c.season) return fail(c.name + ' goes in during ' + c.season + '.');
    if (p.kind !== 'ploughed') return fail('Plough the hectare first.');
    if (state.cash < c.seed) return fail('Seed is ' + R(c.seed) + ' for this hectare.');
    if (!spendHand()) return;
    pay(c.seed, c.name + ' seed', 'inputs');
    var late = seasonDay(state.day) > 16;
    if (tractorReady('plant')) {
      burnDiesel();
      startCrop(p, crop, late);
      log(c.name + ' planted today.' + (late ? ' Late planting cuts the yield.' : ''));
      tone(440, 0.07, 'square', 0.04);
    } else {
      p.work = { type: 'plant', left: 1, crop: crop, late: late };
      log('Planting ' + c.name + '. It finishes overnight.' + (late ? ' It is late in the season.' : ''));
    }
    state.tutorial = false;
    menu = 'root';
    save();
    dirty = true;
  }

  function doFert(p) {
    if (!needPlot(p)) return;
    if (p.kind !== 'crop' || !p.crop) return fail('Plant first, then fertilise the young crop.');
    if (p.fert) return fail('This crop is already fertilised.');
    if (p.age > 14) return fail('Too late. Fertiliser has to go on early.');
    var cost = CROPS[p.crop].fert;
    if (state.cash < cost) return fail('Fertiliser is ' + R(cost) + ' for this hectare.');
    if (!spendHand()) return;
    pay(cost, 'Fertiliser', 'inputs');
    p.fert = true;
    log('Fertiliser is on. The crop should thank you.');
    tone(360, 0.06, 'square', 0.04);
    save();
    dirty = true;
  }

  function doSpray(p) {
    if (!needPlot(p)) return;
    if (p.kind !== 'crop' || !p.crop) return fail('There is no crop to spray.');
    if (p.spray) return fail('Already sprayed.');
    var cost = CROPS[p.crop].chem;
    if (state.cash < cost) return fail('Chemicals are ' + R(cost) + ' for this hectare.');
    if (!spendHand()) return;
    pay(cost, 'Chemicals', 'inputs');
    if (tractorReady('spray')) {
      burnDiesel();
      p.spray = true;
      log('Sprayed today.');
    } else {
      p.work = { type: 'spray', left: 1 };
      log('Spraying with a knapsack. It finishes overnight.');
    }
    tone(340, 0.05, 'square', 0.03);
    save();
    dirty = true;
  }

  function doWater(p) {
    if (!p || !p.owned) return fail('Tap a hectare you own.');
    if (!countBuild('borehole') && !countBuild('dam')) return fail('Drill a borehole or build a dam first.');
    if (p.kind === 'build') return fail('That plot is a building.');
    p.water = !p.water;
    log(p.water ? 'Irrigation is on for this hectare.' : 'Irrigation is off.');
    tone(500, 0.05, 'square', 0.03);
    save();
    dirty = true;
  }

  function doHarvest(p) {
    if (!needPlot(p)) return;
    if (p.kind !== 'crop' || !p.crop) return fail('Nothing to cut.');
    if (p.age < CROPS[p.crop].days) return fail('Not ready. Day ' + p.age + ' of ' + CROPS[p.crop].days + '.');
    if (!spendHand()) return;
    if (tractorReady('harvest')) {
      burnDiesel();
      var notes = [];
      p.work = { type: 'harvest', left: 0 };
      finishWork(p, notes);
      log(notes.join(' ') || 'Harvested.');
    } else {
      p.work = { type: 'harvest', left: 2 };
      log('Cutting by hand. Give it two nights.');
    }
    tone(220, 0.08, 'square', 0.04);
    save();
    dirty = true;
  }

  function doPasture(p) {
    if (!needPlot(p)) return;
    if (p.kind === 'crop') return fail('Harvest the crop first.');
    if (p.kind === 'build') return fail('There is a building here.');
    if (p.kind === 'pasture') return fail('This hectare is already pasture.');
    if (state.cash < PASTURE_COST) return fail('Grass seed is ' + R(PASTURE_COST) + '.');
    if (!spendHand()) return;
    pay(PASTURE_COST, 'Grass seed', 'inputs');
    p.crop = null;
    p.fert = false;
    p.spray = false;
    if (tractorReady('pasture')) {
      burnDiesel();
      p.kind = 'pasture';
      log('Pasture is in, today.');
    } else {
      p.work = { type: 'pasture', left: 1 };
      log('Sowing pasture. It finishes overnight.');
    }
    save();
    dirty = true;
  }

  function doFence(p) {
    if (!needPlot(p)) return;
    if (p.kind === 'build') return fail('You cannot fence a building plot.');
    var idx = state.plots.indexOf(p);
    if (p.fence) {
      if (p.kind === 'pasture' && !pastureFits(0, 0, idx)) return fail('The animals still need this fence.');
      if (!spendHand()) return;
      p.fence = false;
      state.cash += 700;
      book('in', 'salvage', 700, 'Fence wire');
      log('Fence rolled up. R700 back.');
    } else {
      if (state.cash < FENCE_COST) return fail('Fencing this hectare is ' + R(FENCE_COST) + '.');
      if (!spendHand()) return;
      pay(FENCE_COST, 'Fence', 'builds');
      p.fence = true;
      log('The hectare is fenced.');
    }
    tone(260, 0.05, 'square', 0.03);
    save();
    dirty = true;
  }

  function doBuild(p, id) {
    if (!needPlot(p)) return;
    var b = BUILDINGS[id];
    if (!b) return;
    if (p.kind === 'crop' || p.kind === 'pasture' || p.kind === 'build') return fail('Build on open grass or a ploughed hectare.');
    if (state.cash < b.cost) return fail(b.name + ' costs ' + R(b.cost) + '.');
    if (!spendHand()) return;
    pay(b.cost, b.name, 'builds');
    p.kind = 'build';
    p.structure = id;
    p.crop = null;
    p.fence = false;
    p.water = false;
    p.work = null;
    if (id === 'dam') state.dam = Math.max(state.dam, 4);
    menu = 'root';
    log(b.name + ' is up.');
    chime();
    save();
    dirty = true;
  }

  function doRemove(p) {
    if (!p || p.structure === 'house') return fail('That stays.');
    if (p.kind !== 'build' || !BUILDINGS[p.structure]) return fail('Nothing to pull down.');
    var idx = state.plots.indexOf(p);
    var id = p.structure;
    if (id === 'kraal' && !herdFits(0, 0, idx)) return fail('Move the cattle and sheep first. The kraal is full without this one.');
    if (id === 'coop' && state.herd.chicken.n > chickenCap(idx)) return fail('Sell some chickens first.');
    if (id === 'shed' && state.herd.pig.n > pigCap(idx)) return fail('Sell some pigs first.');
    if (!spendHand()) return;
    var refund = Math.round(BUILDINGS[id].cost * 0.4);
    earn(refund, 'Salvage ' + BUILDINGS[id].name, 'salvage');
    p.kind = 'grass';
    p.structure = null;
    log('Pulled it down. Salvage ' + R(refund) + '.');
    save();
    dirty = true;
  }

  function buyMachine(id) {
    var m = MACHINES[id];
    if (!m) return;
    if (state.machines[id]) return fail('You already own a ' + m.name.toLowerCase() + '.');
    if (!pay(m.cost, m.name, 'machines')) return fail(m.name + ' is ' + R(m.cost) + '.');
    state.machines[id] = true;
    if (id === 'tractor') state.hands += 1;
    log(m.name + ' is in the yard.');
    chime();
    save();
    dirty = true;
  }

  function buyAnimal(kind, n) {
    var s = STOCK[kind];
    if (!s) return;
    var i;
    var bought = 0;
    for (i = 0; i < n; i++) {
      if (kind === 'chicken' && state.herd.chicken.n + 1 > chickenCap(-1)) {
        if (!bought) return fail('The chicken house is full.');
        break;
      }
      if (kind === 'pig' && state.herd.pig.n + 1 > pigCap(-1)) {
        if (!bought) return fail('The shed is full.');
        break;
      }
      if ((kind === 'cattle' || kind === 'sheep') && !herdFits(kind === 'cattle' ? 1 : 0, kind === 'sheep' ? 1 : 0, -1)) {
        if (!bought) return fail('You need more kraal space.');
        break;
      }
      if ((kind === 'cattle' || kind === 'sheep') && !pastureFits(kind === 'cattle' ? 1 : 0, kind === 'sheep' ? 1 : 0, -1)) {
        if (!bought) return fail('Fence more pasture first. One hectare carries about 4 cattle or 8 sheep.');
        break;
      }
      if (state.cash < s.buy) {
        if (!bought) return fail(s.name + ' costs ' + R(s.buy) + '.');
        break;
      }
      pay(s.buy, s.name, 'animals');
      var h = state.herd[kind];
      h.cond = (h.cond * h.n + 0.82) / (h.n + 1);
      h.n++;
      bought++;
    }
    if (bought) {
      log('Bought ' + bought + ' ' + s.name.toLowerCase() + (bought > 1 ? 's' : '') + '.');
      tone(480, 0.06, 'square', 0.04);
      save();
      dirty = true;
    }
  }

  function hire() {
    if (state.workers >= 5) return fail('Five workers is a full crew for now.');
    if (state.cash < WAGE * 3) return fail('Keep at least three days of wages (' + R(WAGE * 3) + ') before you hire.');
    state.workers++;
    state.hands++;
    log('Hired a worker. Wages are ' + R(WAGE) + ' a day, every day.');
    tone(400, 0.06, 'square', 0.04);
    save();
    dirty = true;
  }

  function fire() {
    if (state.workers <= 0) return fail('Nobody to send home.');
    state.workers--;
    state.hands = Math.max(0, state.hands - 1);
    log('A worker left the crew.');
    save();
    dirty = true;
  }

  function sellGrain(crop, all) {
    if (!CROPS[crop]) return;
    var have = state.grain[crop];
    if (have <= 0) return fail('No ' + CROPS[crop].name.toLowerCase() + ' in store.');
    var qty = all ? have : Math.min(1, have);
    qty = Math.round(qty * 10) / 10;
    state.grain[crop] = Math.round((have - qty) * 10) / 10;
    var money = Math.round(qty * state.prices[crop]);
    earn(money, CROPS[crop].name, 'crops');
    state.supply[crop] += qty;
    log('Sold ' + tons(qty) + ' t ' + CROPS[crop].name.toLowerCase() + ' for ' + R(money) + '.');
    chime();
    save();
    dirty = true;
  }

  function sellAnimal(kind) {
    var h = state.herd[kind];
    var s = STOCK[kind];
    if (!h || h.n <= 0) return fail('You have no ' + s.name.toLowerCase() + ' to sell.');
    var price = Math.round(state.prices[kind] * Math.max(0.45, Math.min(1.15, h.cond)));
    h.n--;
    if (!h.n) h.cond = 1;
    earn(price, s.name + ' sold', 'stock');
    state.supply[kind] = (state.supply[kind] || 0) + 1;
    log('Sold ' + s.name.toLowerCase() + ' for ' + R(price) + '.');
    chime();
    save();
    dirty = true;
  }

  function sellEggs() {
    var dozens = Math.floor(state.eggs / 12);
    if (dozens < 1) return fail('You need a dozen eggs to sell. You have ' + Math.floor(state.eggs) + '.');
    var money = dozens * state.prices.eggs;
    state.eggs -= dozens * 12;
    earn(money, 'Eggs', 'dairy');
    state.supply.eggs += dozens;
    log('Sold ' + dozens + ' dozen eggs for ' + R(money) + '.');
    chime();
    save();
    dirty = true;
  }

  function sellMilk() {
    if (state.milk < 1) return fail('The milk can is empty.');
    var litres = Math.round(state.milk);
    var money = Math.round(litres * state.prices.milk);
    state.milk = 0;
    earn(money, 'Milk', 'dairy');
    state.supply.milk += litres / 10;
    log('Sold ' + litres + ' L of milk for ' + R(money) + '.');
    chime();
    save();
    dirty = true;
  }

  function borrow() {
    if (state.loan + LOAN_STEP > LOAN_MAX) return fail('The bank stops at ' + R(LOAN_MAX) + '.');
    state.loan += LOAN_STEP;
    state.cash += LOAN_STEP;
    log('The bank lent you ' + R(LOAN_STEP) + '. Interest is 14% a year.');
    tone(240, 0.08, 'square', 0.04);
    save();
    dirty = true;
  }

  function repay(amount) {
    var n = Math.min(Math.round(amount), Math.round(state.loan), Math.round(state.cash));
    if (n <= 0) return fail('Nothing to repay.');
    state.loan -= n;
    state.cash -= n;
    log('Repaid ' + R(n) + '.');
    tone(360, 0.06, 'square', 0.04);
    save();
    dirty = true;
  }

  function resetFarm() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    state = fresh();
    panel = 'help';
    menu = 'root';
    confirmReset = false;
    log('A new farm. Same highveld.');
    dirty = true;
  }

  function workText(p) {
    if (!p.work) return '';
    var left = p.work.left;
    var what = {
      plough: 'Ploughing',
      plant: 'Planting',
      spray: 'Spraying',
      harvest: 'Cutting',
      pasture: 'Sowing pasture'
    }[p.work.type] || 'Working';
    return what + ' · ' + left + (left === 1 ? ' night' : ' nights') + ' left.';
  }

  function plotTitle(p) {
    if (!p.owned) return 'Hectare for sale';
    if (p.structure === 'house') return 'Tin-roof house';
    if (p.structure && BUILDINGS[p.structure]) return BUILDINGS[p.structure].name;
    if (p.kind === 'crop' && p.crop) return CROPS[p.crop].name;
    if (p.kind === 'pasture') return 'Pasture';
    if (p.kind === 'ploughed') return 'Ploughed land';
    return 'Open veld';
  }

  function plotStatus(p) {
    if (!p.owned) return 'One hectare beside the farm. Yours if you pay ' + R(landPrice(p)) + '.';
    if (p.structure === 'house') return 'Home. The house keeps ' + HOUSE_STORE + ' tons of grain dry. A silo holds much more.';
    if (p.work) return workText(p);
    if (p.structure && BUILDINGS[p.structure]) return BUILDINGS[p.structure].blurb;
    var bits = ['1 ha'];
    if (p.fence) bits.push('fenced');
    if (p.kind === 'crop' && p.crop) {
      var c = CROPS[p.crop];
      bits.push('day ' + p.age + ' of ' + c.days);
      if (p.age >= c.days + 8) bits.push('yield is slipping');
      else if (p.age >= c.days) bits.push('ready to cut');
      bits.push(moistWord(p.moist));
      if (p.fert) bits.push('fertilised');
      else bits.push('no fertiliser');
      if (p.spray) bits.push('sprayed');
      if (p.water) bits.push(p.gotWater ? 'irrigated' : 'irrigation on');
      if (p.late) bits.push('planted late');
    } else {
      bits.push(moistWord(p.moist));
      if (p.water) bits.push('irrigation on');
    }
    return bits.join(' · ');
  }

  function button(act, label, arg, disabled) {
    return '<button type="button" data-act="' + act + '"' +
      (arg != null ? ' data-arg="' + esc(arg) + '"' : '') +
      (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function renderSheet() {
    var p = selected();
    if (!p || panel) {
      sheetEl.className = '';
      sheetEl.innerHTML = '';
      return;
    }
    sheetEl.className = 'open';
    var html = '<h2>' + esc(plotTitle(p)) + '</h2><p class="status">' + esc(plotStatus(p)) + '</p><div class="actions">';
    if (!p.owned) {
      html += button('buy-land', 'Buy this hectare · ' + R(landPrice(p)), null, state.cash < landPrice(p));
      html += button('close-sheet', 'Not now');
    } else if (menu === 'plant') {
      html += '<p class="hint">Summer crops: maize, soybean, sunflower. Winter crop: wheat. Guides assume fertiliser, spray and a fair rain year.</p>';
      Object.keys(CROPS).forEach(function (id) {
        var c = CROPS[id];
        var inSeason = seasonInfo(state.day).id === c.season;
        var late = seasonDay(state.day) > 16;
        var label = c.name + ' · seed ' + R(c.seed) + ' · guide ' + R(guideProfit(id, false)) + '/ha';
        var why = !inSeason ? 'Plant in ' + c.season : (p.kind !== 'ploughed' ? 'Plough first' : (late ? 'Late in the season. Yield drops.' : ''));
        html += button('plant', label, id, !inSeason || p.kind !== 'ploughed' || !!p.work);
        if (why) html += '<p class="hint">' + esc(why) + '</p>';
      });
      html += button('menu', 'Back', 'root');
    } else if (menu === 'build') {
      Object.keys(BUILDINGS).forEach(function (id) {
        var b = BUILDINGS[id];
        html += button('build', b.name + ' · ' + R(b.cost), id, state.cash < b.cost || p.kind === 'crop' || p.kind === 'pasture' || p.kind === 'build');
        html += '<p class="hint">' + esc(b.blurb) + '</p>';
      });
      html += button('menu', 'Back', 'root');
    } else if (p.structure === 'house') {
      html += button('close-sheet', 'Close');
    } else if (p.kind === 'build') {
      html += button('remove', 'Pull it down · salvage 40%');
      html += button('close-sheet', 'Close');
    } else {
      var crop = p.kind === 'crop' && p.crop ? CROPS[p.crop] : null;
      var ready = crop && p.age >= crop.days && !p.work;
      if (ready) html += button('harvest', 'Harvest', null, false);
      if (!p.work && p.kind !== 'crop') html += button('plough', p.kind === 'ploughed' ? 'Plough again' : 'Plough', null, false);
      if (!p.work && p.kind === 'ploughed') html += button('menu', 'Plant a crop', 'plant');
      if (crop && !p.fert && p.age <= 14 && !p.work) html += button('fert', 'Fertilise · ' + R(crop.fert) + '/ha');
      if (crop && !p.spray && !p.work) html += button('spray', 'Spray · ' + R(crop.chem) + '/ha');
      if (countBuild('borehole') || countBuild('dam')) {
        html += button('water', p.water ? 'Turn irrigation off' : 'Irrigate this hectare');
      } else if (crop || p.kind === 'ploughed' || p.kind === 'pasture') {
        html += '<p class="hint">Irrigation needs a borehole or a dam from the Yard, built on a grass plot.</p>';
      }
      if (!p.work && p.kind !== 'crop' && p.kind !== 'pasture') html += button('pasture', 'Sow pasture · ' + R(PASTURE_COST), null, false);
      if (!p.work) html += button('fence', p.fence ? 'Take the fence down' : 'Put up a fence · ' + R(FENCE_COST));
      if (!p.work && (p.kind === 'grass' || p.kind === 'ploughed')) html += button('menu', 'Put up a building', 'build');
      html += button('close-sheet', 'Close');
    }
    html += '</div>';
    sheetEl.innerHTML = html;
  }

  function sumBook(book, keys) {
    var n = 0;
    keys.forEach(function (k) { n += book[k] || 0; });
    return n;
  }

  function rowsFor(book, labels) {
    var html = '';
    Object.keys(labels).forEach(function (k) {
      if (!book[k]) return;
      html += '<div class="split"><span>' + esc(labels[k]) + '</span><span>' + esc(R(book[k])) + '</span></div>';
    });
    return html || '<p class="hint">Nothing yet.</p>';
  }

  function renderPanel() {
    if (!panel) {
      panelEl.className = '';
      panelEl.innerHTML = '';
      return;
    }
    panelEl.className = 'open';
    if (panel === 'help') panelEl.innerHTML = helpHtml();
    else if (panel === 'market') panelEl.innerHTML = marketHtml();
    else if (panel === 'money') panelEl.innerHTML = moneyHtml();
    else if (panel === 'yard') panelEl.innerHTML = yardHtml();
  }

  function helpHtml() {
    var start = state.helpSeen
      ? button('close-help', 'Back to the farm')
      : button('close-help', 'Start farming');
    return '<div class="how"><div class="how-body"><h2>How to farm</h2><p class="tag">v1.1</p>' +
      '<p>You have one hectare on the highveld, a tin-roof house, and ' + R(START_CASH) + '.</p>' +
      '<p>Tap your land. Plough it, then plant. <b>Maize, soybean and sunflower</b> go in during summer. <b>Wheat</b> goes in during winter.</p>' +
      '<p>Fertilise and spray if you can. Rain helps the yield. A dry spell hurts, unless you irrigate from a borehole or a dam.</p>' +
      '<p>Harvest when the crop is ready. The house keeps 2 tons. A silo holds much more, so you can sell when the price is kinder.</p>' +
      '<p>Tap grey land to buy more hectares. The Yard sells cattle, sheep, chickens, pigs, fences, buildings and machines. Workers cost ' + R(WAGE) + ' a day.</p>' +
      '<p>Tractors and the matching implement finish a job the same day. Hands left today are shown at the top. Each job uses one.</p>' +
      '<p>Money is the bank. You can borrow. Interest ticks every day. The game saves itself on this phone.</p>' +
      '<p class="lede">Prices, yields and wages are game values, not a market quote. Time pauses while this page is open. Use Fast if you want the season to move.</p></div>' +
      '<div class="how-go">' + start + '</div></div>';
  }

  function marketHtml() {
    var html = '<h2>Market</h2><p class="lede">Game values. Prices move with the season and with how much is sold. Time is paused.</p>';
    html += '<div class="section">Crops per hectare</div>';
    Object.keys(CROPS).forEach(function (id) {
      var c = CROPS[id];
      var dry = guideProfit(id, false);
      var wet = guideProfit(id, true);
      html += '<article class="card"><h3>' + esc(c.name) + '<span>' + esc(c.season) + ' · ' + c.days + ' days</span></h3><dl>';
      html += row('Seed', R(c.seed) + '/ha');
      html += row('Fertiliser', R(c.fert) + '/ha');
      html += row('Chemicals', R(c.chem) + '/ha');
      html += row('Guide yield', c.yieldDry.toFixed(1) + ' t/ha dryland');
      html += row('If irrigated', c.yieldIrr.toFixed(1) + ' t/ha');
      html += row('Price now', R(state.prices[id]) + '/t');
      html += '</dl>';
      html += profitLine(dry, 'Dryland profit ' + R(dry) + '/ha');
      html += profitLine(wet, 'Irrigated profit ' + R(wet) + '/ha, borehole power included');
      html += '<p class="status">In store ' + tons(state.grain[id]) + ' t</p>';
      html += '<div class="rowbtns">' + button('sell-grain', 'Sell 1 t', id, state.grain[id] < 0.1) + button('sell-all-grain', 'Sell all', id, state.grain[id] <= 0) + '</div>';
      html += '</article>';
    });
    html += '<p class="hint">Guides assume you fertilise, spray, and get a fair rain year. They leave out diesel, wages and loan interest.</p>';
    html += '<div class="section">Livestock and the dairy</div>';
    html += animalCard('cattle', 'head');
    html += animalCard('sheep', 'head');
    html += animalCard('pig', 'head');
    html += '<article class="card"><h3>Eggs <span>per dozen</span></h3><dl>' + row('Price now', R(state.prices.eggs) + '/dozen') + row('In the pantry', Math.floor(state.eggs) + ' eggs') + '</dl>';
    html += '<div class="rowbtns">' + button('sell-eggs', 'Sell whole dozens', null, state.eggs < 12) + '</div></article>';
    html += '<article class="card"><h3>Milk <span>per litre</span></h3><dl>' + row('Price now', Rdec(state.prices.milk) + '/L') + row('In the can', Math.round(state.milk) + ' L') + '</dl>';
    html += '<p class="hint">Eggs and milk do not keep. Sell them before they spoil.</p>';
    html += '<div class="rowbtns">' + button('sell-milk', 'Sell all the milk', null, state.milk < 1) + '</div></article>';
    html += '<p class="hint">Buy animals in the Yard. Sell them here. A beast in good condition fetches the board price.</p>';
    return html;
  }

  function animalCard(kind, unit) {
    var h = state.herd[kind];
    var price = Math.round(state.prices[kind] * (h.n ? Math.max(0.45, Math.min(1.15, h.cond)) : 1));
    return '<article class="card"><h3>' + esc(STOCK[kind].name) + '<span>per ' + unit + '</span></h3><dl>' +
      row('Sell price now', R(h.n ? price : state.prices[kind]) + '/' + unit) +
      row('You have', String(h.n) + (h.n ? ' · condition ' + Math.round(h.cond * 100) + '%' : '')) +
      '</dl><div class="rowbtns">' + button('sell-animal', 'Sell 1', kind, h.n <= 0) + '</div></article>';
  }

  function row(k, v) {
    return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>';
  }

  function profitLine(n, text) {
    return '<p class="profit ' + (n >= 0 ? 'good' : 'bad') + '">' + esc(text) + '</p>';
  }

  function moneyHtml() {
    var inn = sumBook(state.inn, ['crops', 'stock', 'dairy', 'salvage']);
    var out = sumBook(state.out, Object.keys(OUT_LABEL));
    var due = state.loan * YEAR_RATE / YEAR_DAYS;
    var html = '<h2>Money</h2><p class="lede">Time is paused. The game saves on this phone.</p>';
    html += '<p class="cashbig">' + esc(R(state.cash)) + '</p>';
    html += '<p class="hint">Cash in the tin</p>';
    html += '<div class="section">This season</div><div class="card">';
    html += '<div class="split"><span>Income</span><span>' + esc(R(inn)) + '</span></div>';
    html += '<div class="split"><span>Expenses</span><span>' + esc(R(out)) + '</span></div>';
    html += '<div class="split"><span>Left over</span><span>' + esc(R(inn - out)) + '</span></div>';
    html += '</div>';
    html += '<div class="section">Income</div><div class="card">' + rowsFor(state.inn, IN_LABEL) + '</div>';
    html += '<div class="section">Expenses</div><div class="card">' + rowsFor(state.out, OUT_LABEL) + '</div>';
    html += '<div class="section">Bank</div><div class="card">';
    html += '<div class="split"><span>Loan</span><span>' + esc(R(state.loan)) + '</span></div>';
    html += '<p class="hint">14% a year, game value. About ' + esc(R(due)) + ' a day while you owe money. The ceiling is ' + esc(R(LOAN_MAX)) + '.</p>';
    html += button('borrow', 'Borrow ' + R(LOAN_STEP), null, state.loan + LOAN_STEP > LOAN_MAX);
    html += button('repay', 'Repay ' + R(LOAN_STEP), null, state.loan <= 0 || state.cash <= 0);
    html += button('repay-all', 'Repay all', null, state.loan <= 0 || state.cash <= 0);
    html += '</div>';
    html += '<div class="section">Recent</div><div class="card">';
    if (!state.ledger.length) html += '<p class="hint">No payments yet.</p>';
    state.ledger.forEach(function (line) {
      var sign = line.dir === 'in' ? '+' : '−';
      html += '<div class="split"><span>' + esc(line.reason) + '</span><span>' + sign + esc(R(line.amount)) + '</span></div>';
    });
    html += '</div>';
    html += '<div class="section">All time</div><div class="card">';
    html += '<div class="split"><span>Income</span><span>' + esc(R(sumBook(state.innLife, ['crops', 'stock', 'dairy', 'salvage']))) + '</span></div>';
    html += '<div class="split"><span>Expenses</span><span>' + esc(R(sumBook(state.outLife, Object.keys(OUT_LABEL)))) + '</span></div>';
    html += '</div>';
    if (!confirmReset) html += button('reset-ask', 'Sell up and start again');
    else {
      html += '<p class="hint">This wipes the farm on this phone.</p>';
      html += button('reset-yes', 'Yes, wipe this farm');
      html += button('reset-no', 'Keep farming');
    }
    return html;
  }

  function yardHtml() {
    var html = '<h2>Yard</h2><p class="lede">Buy machines, buildings and animals. Put buildings on a grass plot from the map. Time is paused. Game prices.</p>';
    html += '<div class="section">Crew</div><div class="card">';
    html += '<div class="split"><span>Workers</span><span>' + state.workers + '</span></div>';
    html += '<p class="hint">Each worker is one extra hand a day and costs ' + R(WAGE) + ' every morning, even when you are waiting on a crop. You also have your own hands' + (state.machines.tractor ? ', plus one for the tractor.' : '.') + '</p>';
    html += '<div class="rowbtns">' + button('hire', 'Hire · ' + R(WAGE) + '/day', null, state.workers >= 5) + button('fire', 'Send one home', null, state.workers <= 0) + '</div></div>';
    html += '<div class="section">Machines</div>';
    Object.keys(MACHINES).forEach(function (id) {
      var m = MACHINES[id];
      var owned = !!state.machines[id];
      html += '<article class="card"><h3>' + esc(m.name) + '<span>' + (owned ? 'owned' : esc(R(m.cost))) + '</span></h3>';
      html += '<p class="hint">' + esc(m.blurb) + '</p>';
      if (!owned) html += button('buy-machine', 'Buy the ' + m.name.toLowerCase(), id, state.cash < m.cost);
      html += '</article>';
    });
    html += '<div class="section">Animals</div>';
    Object.keys(STOCK).forEach(function (id) {
      var s = STOCK[id];
      html += '<article class="card"><h3>' + esc(s.name) + '<span>' + state.herd[id].n + ' on the farm</span></h3>';
      html += '<p class="hint">' + esc(s.blurb) + ' Buy price ' + esc(R(s.buy)) + '.</p>';
      html += '<div class="rowbtns">' + button('buy-animal', 'Buy 1 · ' + R(s.buy), id, state.cash < s.buy);
      if (id === 'chicken') html += button('buy-hens', 'Buy 10 · ' + R(s.buy * 10), null, state.cash < s.buy);
      html += '</div></article>';
    });
    html += '<div class="section">Land and buildings</div><div class="card">';
    html += '<p class="hint">Tap a grey plot on the map to buy that hectare. Tap grass you own, then Put up a building, for a silo, barn, shed, kraal, chicken house, borehole or dam. Storage now: ' + tons(storedTons()) + ' / ' + storageCap() + ' t. Dam water: ' + state.dam + '.</p>';
    html += '</div>';
    return html;
  }

  function renderHud() {
    var info = seasonInfo(state.day);
    document.body.className = 'season-' + info.id;
    cashEl.textContent = R(state.cash);
    whenEl.textContent = info.name + ' day ' + seasonDay(state.day) + ' · Year ' + yearOf(state.day) + ' · ' + weatherWord();
    handsEl.textContent = 'Hands ' + state.hands;
    logEl.textContent = state.log;
    muteEl.textContent = state.sound ? '♪' : '✕';
    muteEl.setAttribute('aria-label', state.sound ? 'Mute sound' : 'Turn sound on');
    var speeds = document.querySelectorAll('.speeds button');
    speeds.forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-arg')) === state.speed);
    });
    document.querySelectorAll('nav button').forEach(function (b) {
      var tab = b.getAttribute('data-arg');
      var on = tab === 'farm' ? !panel : panel === tab;
      b.classList.toggle('on', on);
    });
  }

  function put(x, y, hex) {
    if (x < 0 || y < 0 || x >= off.width || y >= off.height || !hex) return;
    var n = parseInt(hex.slice(1), 16);
    var i = (y * off.width + x) * 4;
    pix[i] = (n >> 16) & 255;
    pix[i + 1] = (n >> 8) & 255;
    pix[i + 2] = n & 255;
    pix[i + 3] = 255;
  }

  function hash(x, y) {
    var n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return (n ^ (n >> 16)) >>> 0;
  }

  function stamp(ox, oy, art) {
    var lines = art.split('\n');
    var j, i, ch;
    for (j = 0; j < lines.length; j++) {
      for (i = 0; i < lines[j].length; i++) {
        ch = lines[j].charAt(i);
        if (PAL[ch]) put(ox + i, oy + j, PAL[ch]);
      }
    }
  }

  function fillTile(ox, oy, a, b, salt) {
    var j, i, h;
    for (j = 0; j < 16; j += 2) {
      for (i = 0; i < 16; i += 2) {
        h = hash(ox + i, oy + j + salt);
        var col = h % 6 === 0 ? b : a;
        put(ox + i, oy + j, col);
        put(ox + i + 1, oy + j, col);
        put(ox + i, oy + j + 1, col);
        put(ox + i + 1, oy + j + 1, col);
      }
    }
  }

  function drawSky() {
    var x, y, shade;
    for (y = 0; y < SKY; y++) {
      shade = y < 10 ? '#8ecaf2' : '#b7e4f8';
      if (seasonInfo(state.day).id === 'winter') shade = y < 10 ? '#c5d6e6' : '#dde8f2';
      if (seasonInfo(state.day).id === 'autumn') shade = y < 10 ? '#f0c48a' : '#f6d7a8';
      for (x = 0; x < off.width; x++) put(x, y, shade);
    }
    stamp(off.width - 22, 2, [
      '..yyyy..',
      '.yyyyyy.',
      'yyyyyyyy',
      'yyyyyyyy',
      'yyyyyyyy',
      '.yyyyyy.',
      '..yyyy..',
      '...YY...'
    ].join('\n'));
    var drift = Math.floor(performance.now() / 180) % (off.width + 20);
    stamp((drift + 4) % (off.width + 8) - 8, 4, '..wwww..\n.wwwwww.\nwwwwwwww\n.wwwwww.');
    stamp((drift + 40) % (off.width + 10) - 6, 10, '.wwww.\nwwwwww\n.wwww.');
  }

  function grassPair() {
    var s = seasonInfo(state.day).id;
    if (s === 'winter') return ['#c6b15a', '#8f9840'];
    if (s === 'autumn') return ['#c4a24a', '#3e8a3c'];
    if (s === 'spring') return ['#7ec85a', '#3e9a46'];
    return ['#3e9a46', '#2c7a34'];
  }

  function drawStem(ox, oy, x, y0, y1, col) {
    var y;
    for (y = y0; y <= y1; y++) put(ox + x, oy + y, col);
  }

  function drawCrop(ox, oy, p) {
    fillTile(ox, oy, '#a86b3a', '#8d4e28', 3);
    var c = p.crop;
    var stage = !c ? 0 : p.age / CROPS[c].days;
    if (p.age > CROPS[c].days + 8) stage = 1.2;
    var k;
    if (c === 'sunflower') {
      for (k = 0; k < 3; k++) {
        var sx = 3 + k * 5;
        drawStem(ox, oy, sx, 8, 14, '#2f7a34');
        if (stage > 0.45) stamp(ox + sx - 2, oy + 3, stage > 1.05 ? '..YY..\n.YKYY.\nYYYYYY\n.YYYY.' : '..yy..\n.yyyy.\n.yyyy.\n..yy..');
      }
    } else if (c === 'wheat') {
      for (k = 0; k < 8; k++) {
        var col = stage > 0.65 ? '#e2c15a' : '#7aaa45';
        if (stage > 1.05) col = '#c4a05a';
        drawStem(ox, oy, 1 + k * 2, stage > 0.4 ? 6 : 10, 14, col);
        if (stage > 0.55) put(ox + 1 + k * 2, oy + 5, '#f4e2a0');
      }
    } else if (c === 'soybean') {
      for (k = 0; k < 4; k++) {
        stamp(ox + 1 + k * 4, oy + (stage > 0.5 ? 6 : 10), 'gg\ngg');
        if (stage > 0.7) put(ox + 2 + k * 4, oy + 8, '#d8e07a');
      }
    } else {
      for (k = 0; k < 4; k++) {
        var top = stage > 0.7 ? 2 : stage > 0.35 ? 6 : 10;
        drawStem(ox, oy, 2 + k * 4, top, 14, '#2f8f3a');
        drawStem(ox, oy, 3 + k * 4, top + 1, 14, '#246b32');
        if (stage > 0.72) {
          put(ox + 2 + k * 4, oy + top, '#e6c84a');
          put(ox + 3 + k * 4, oy + top, '#e6c84a');
        }
      }
    }
    if (stage >= 1 && stage < 1.15) {
      var e;
      for (e = 0; e < 16; e += 2) put(ox + e, oy, '#f0c14a');
    }
  }

  function drawAnimals(ox, oy, p) {
    if (p.kind !== 'pasture') return;
    var cattle = state.herd.cattle.n;
    var sheep = state.herd.sheep.n;
    var i = p.y * COLS + p.x;
    if (cattle && i % 2 === 0) {
      stamp(ox + 2, oy + 8, '..uu..\nuuwwu\n.uuuu.\n.k..k.');
    }
    if (sheep) {
      stamp(ox + 8, oy + 9, '.WWW.\nWWWWW\n.WWW.\nk...k');
    }
  }

  function drawStructure(ox, oy, id) {
    if (id === 'house') {
      stamp(ox, oy, [
        '................',
        '......rrrr......',
        '....rrRRRRrr....',
        '...rrRRRRRRrr...',
        '...rccccccccr...',
        '...rcbcccbc.r...',
        '...rcbcccbc.r...',
        '...rccccccccr...',
        '...rcccddcccr...',
        '...rcccddcccr...',
        '...rccccccccr...',
        '...rrrrrrrrrr...',
        '....gggggggg....',
        '...gggggggggg...',
        '..gggggggggggg..',
        '.gggggggggggggg.'
      ].join('\n'));
      return;
    }
    if (id === 'silo') {
      stamp(ox, oy, [
        '................',
        '......tttt......',
        '.....tnnnnt.....',
        '.....nttttn.....',
        '.....ntBBBn.....',
        '.....nttttn.....',
        '.....nttttn.....',
        '.....ntBBBn.....',
        '.....nttttn.....',
        '.....nttttn.....',
        '.....tttttt.....',
        '......dddd......',
        '.....dddddd.....',
        '....DDDDDDDD....',
        '...DDDDDDDDDD...',
        '..DDDDDDDDDDDD..'
      ].join('\n'));
      return;
    }
    if (id === 'barn') {
      stamp(ox, oy, [
        '................',
        '...rrrrrrrrrr...',
        '..rrRRRRRRRRrr..',
        '..rccccccccccr..',
        '..rcwwcccwwccr..',
        '..rcwwcccwwccr..',
        '..rccccccccccr..',
        '..rccccddccccr..',
        '..rccccddccccr..',
        '..rccccccccccr..',
        '..rrrrrrrrrrrr..',
        '...dddddddddd...',
        '..DDDDDDDDDDDD..',
        '.gggggggggggggg.',
        'gggggggggggggggg',
        'gggggggggggggggg'
      ].join('\n'));
      return;
    }
    if (id === 'shed') {
      stamp(ox, oy, [
        '................',
        '..nnnnnnnnnnnn..',
        '..nttttttttttn..',
        '..n..........n..',
        '..n..aa..aa..n..',
        '..n.aaaa.aaa.n..',
        '..n..aa..aa..n..',
        '..n..........n..',
        '..n...kk.......n',
        '..nnnnnnnnnnnn..',
        '...dddddddddd...',
        '..gggggggggggg..',
        '.gggggggggggggg.',
        'gggggggggggggggg',
        'gggggggggggggggg',
        'gggggggggggggggg'
      ].join('\n'));
      return;
    }
    if (id === 'kraal') {
      fillTile(ox, oy, '#c6a15a', '#a8843c', 9);
      stamp(ox, oy, [
        'k.k.k.k.k.k.k.k.',
        'k..............k',
        'k..uuww........k',
        'k..uuuu........k',
        'k...kk........k.',
        'k..............k',
        'k.........WWW..k',
        'k........WWWWW.k',
        'k.........WWW..k',
        'k..............k',
        'k..............k',
        'k.k.k.k.k.k.k.k.',
        '................',
        '................',
        '................',
        '................'
      ].join('\n'));
      return;
    }
    if (id === 'coop') {
      stamp(ox, oy, [
        '................',
        '....rrrrrrrr....',
        '...rRRRRRRRRr...',
        '...rccccccccr...',
        '...rcyyccyyc.r..',
        '...rccccccccr...',
        '...rcccddcccr...',
        '...rccccccccr...',
        '...rrrrrrrrrr...',
        '....yyyyyy......',
        '...yyyyyyyy.....',
        '..gggggggggggg..',
        '.gggggggggggggg.',
        'gggggggggggggggg',
        'gggggggggggggggg',
        'gggggggggggggggg'
      ].join('\n'));
      return;
    }
    if (id === 'borehole') {
      var frame = Math.floor(performance.now() / 180) % 2;
      fillTile(ox, oy, grassPair()[0], grassPair()[1], 2);
      stamp(ox, oy + 2, frame ? [
        '.......B........',
        '......BBB.......',
        '.yyyy..B..yyyy..',
        '......BBB.......',
        '.......k........',
        '.......k........',
        '......kkk.......',
        '.......k........',
        '......kkk.......',
        '.......k........',
        '.....kkkkk......',
        '....dddddddd....'
      ].join('\n') : [
        '.......B........',
        '......BBB.......',
        '..yyyy.B.yyyy...',
        '......BBB.......',
        '.......k........',
        '.......k........',
        '......kkk.......',
        '.......k........',
        '......kkk.......',
        '.......k........',
        '.....kkkkk......',
        '....dddddddd....'
      ].join('\n'));
      return;
    }
    if (id === 'dam') {
      fillTile(ox, oy, grassPair()[0], grassPair()[1], 4);
      stamp(ox + 2, oy + 4, [
        '..bbbbbbbbbb..',
        '.bBBBBBBBBBBb.',
        'bBBBllBBBBBBb',
        'bBBBBBBBBBBBb',
        'bBBBBBllBBBBb',
        '.bBBBBBBBBBBb.',
        '..bbbbbbbbbb..'
      ].join('\n'));
    }
  }

  function drawSign(ox, oy) {
    stamp(ox + 5, oy + 3, [
      '..yy..',
      '.yYYy.',
      'yYYYYY',
      'yYYYYY',
      '.yYYy.',
      '..yy..',
      '..kk..',
      '..kk..'
    ].join('\n'));
  }

  function drawFence(ox, oy) {
    var i;
    for (i = 0; i < 16; i += 4) {
      put(ox + i, oy + 1, '#f7f3ea');
      put(ox + i, oy + 2, '#6b4428');
      put(ox + i, oy + 14, '#f7f3ea');
      put(ox + i, oy + 13, '#6b4428');
      put(ox + 1, oy + i, '#f7f3ea');
      put(ox + 14, oy + i, '#f7f3ea');
    }
  }

  function drawPlot(p) {
    var ox = p.x * 16;
    var oy = SKY + p.y * 16;
    var g = grassPair();
    if (!p.owned) {
      fillTile(ox, oy, '#6d8f58', '#5c7a48', p.x + p.y);
      drawSign(ox, oy);
      return;
    }
    if (p.kind === 'build') {
      drawStructure(ox, oy, p.structure);
    } else if (p.kind === 'ploughed' || (p.work && p.work.type === 'plough')) {
      fillTile(ox, oy, '#c4844a', '#8d4b28', 5);
    } else if (p.kind === 'crop') {
      drawCrop(ox, oy, p);
    } else if (p.kind === 'pasture') {
      fillTile(ox, oy, '#8fce55', '#3e9a46', 7);
      drawAnimals(ox, oy, p);
    } else {
      fillTile(ox, oy, g[0], g[1], 1);
    }
    if (p.fence) drawFence(ox, oy);
    if (p.owned) {
      var edge;
      for (edge = 0; edge < 16; edge++) {
        put(ox + edge, oy, '#f7f3ea');
        put(ox + edge, oy + 15, '#f7f3ea');
        put(ox, oy + edge, '#f7f3ea');
        put(ox + 15, oy + edge, '#f7f3ea');
      }
    }
    if (p.work) {
      var i;
      for (i = 0; i < 16; i += 2) put(ox + i, oy + 15, '#f0c14a');
    }
    if (state.tutorial && p.x === 2 && p.y === 3) {
      var t;
      for (t = 0; t < 16; t++) {
        if ((Math.floor(performance.now() / 300) + t) % 4 < 2) {
          put(ox + t, oy, '#f0c14a');
          put(ox + t, oy + 15, '#f0c14a');
          put(ox, oy + t, '#f0c14a');
          put(ox + 15, oy + t, '#f0c14a');
        }
      }
    }
    if (p.water && p.gotWater) put(ox + 14, oy + 2, '#3a78c2');
  }

  function draw() {
    var cssW = canvas.clientWidth || 300;
    var cssH = canvas.clientHeight || 300;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var bw = Math.max(1, Math.floor(cssW * dpr));
    var bh = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    var scale = Math.max(1, Math.floor(Math.min(cssW / off.width, cssH / off.height)));
    view.scale = scale;
    view.cssW = cssW;
    view.cssH = cssH;
    view.ox = Math.floor((cssW - off.width * scale) / 2);
    view.oy = Math.floor((cssH - off.height * scale) / 2);

    drawSky();
    state.plots.forEach(drawPlot);
    if (state.weather === 'rain' || state.weather === 'storm') {
      var drops = state.weather === 'storm' ? 40 : 22;
      var n, rx, ry;
      for (n = 0; n < drops; n++) {
        rx = hash(n, Math.floor(performance.now() / 80)) % off.width;
        ry = (hash(n + 3, Math.floor(performance.now() / 80)) + Math.floor(performance.now() / 30)) % off.height;
        put(rx, ry, '#f7fbff');
        put(rx, ry + 1, '#d5e9f6');
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = seasonInfo(state.day).id === 'winter' ? '#d5e3ee' : '#8ecaf2';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(off, view.ox, view.oy, off.width * scale, off.height * scale);

    var sel = selected();
    if (sel) {
      ctx.strokeStyle = '#1c2614';
      ctx.lineWidth = 3;
      ctx.strokeRect(view.ox + sel.x * 16 * scale + 1, view.oy + (SKY + sel.y * 16) * scale + 1, 16 * scale - 2, 16 * scale - 2);
    }
  }

  function render() {
    renderHud();
    renderSheet();
    renderPanel();
    dirty = false;
  }

  function hitPlot(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) * (view.cssW / rect.width);
    var y = (clientY - rect.top) * (view.cssH / rect.height);
    var tx = Math.floor((x - view.ox) / (16 * view.scale));
    var ty = Math.floor((y - view.oy - SKY * view.scale) / (16 * view.scale));
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return -1;
    return ty * COLS + tx;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (panel) return;
    unlock();
    var idx = hitPlot(e.clientX, e.clientY);
    if (idx < 0) {
      state.sel = null;
    } else {
      state.sel = idx;
      menu = 'root';
      tone(480, 0.03, 'square', 0.02);
    }
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
    if (e.code === 'Space') {
      e.preventDefault();
      act('speed', state.speed === 0 ? '1' : '0');
    }
    if (e.code === 'Escape' && panel) act('tab', 'farm');
  });

  function unlock() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }

  function frame(now) {
    if (!lastT) lastT = now;
    var dt = now - lastT;
    lastT = now;
    if (dt > 80) dt = 80;
    var paused = !state.helpSeen || panel || document.hidden || state.speed === 0;
    if (!paused) {
      acc += dt * state.speed;
      var guard = 0;
      while (acc >= 800 && guard < 4) {
        acc -= 800;
        guard++;
        try { dawn(); } catch (err) {
          console.error(err);
          log('The day stumbled. ' + err.message);
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
  state.hands = Math.min(state.hands, actionCap());
  render();
  requestAnimationFrame(frame);
  window.addEventListener('resize', function () { dirty = true; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
  });

  window.Veld = {
    get state() { return state; },
    tick: function (n) {
      var i;
      for (i = 0; i < n; i++) dawn();
      render();
    },
    select: function (x, y) {
      state.sel = y * COLS + x;
      menu = 'root';
      dirty = true;
      render();
    },
    act: function (name, arg) { act(name, arg); render(); },
    view: function () { return view; },
    guide: guideProfit
  };
})();
