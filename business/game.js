/* Corner & Co — hands-on shop sim. Figures are game values, not advice. */
(function () {
  'use strict';

  var SAVE_KEY = 'corner-co-save';
  var COLS = 46;
  var ROWS = 36;
  var TILE = 16;
  var WORLD_W = COLS * TILE;
  var WORLD_H = ROWS * TILE;

  var DIFFS = {
    easy: { name: 'Easy', cash: 8000, rent: 80, patience: 24, spawn: 4.4, wage: 140, hire: 900, shop2: 3500, wall: 2200, bail: 1500, debt: 5 },
    normal: { name: 'Normal', cash: 5000, rent: 150, patience: 14, spawn: 5.4, wage: 220, hire: 1200, shop2: 5200, wall: 2800, bail: 0, debt: 3 },
    hard: { name: 'Hard', cash: 3200, rent: 230, patience: 9, spawn: 6.2, wage: 300, hire: 1600, shop2: 7000, wall: 3400, bail: 0, debt: 2 }
  };

  var PRODUCTS = {
    bread: { name: 'Bread', cost: 8, fair: 18, cold: false, shop: 1, color: '#e6c36a' },
    drink: { name: 'Cool drink', cost: 6, fair: 14, cold: true, shop: 1, color: '#3a78c2' },
    airtime: { name: 'Airtime', cost: 9, fair: 15, cold: false, shop: 1, license: 1200, color: '#f0c14a' },
    chips: { name: 'Chips', cost: 7, fair: 16, cold: false, shop: 1, license: 1800, color: '#e07a3d' },
    maize: { name: 'Maize meal', cost: 14, fair: 32, cold: false, shop: 1, license: 2500, color: '#f4efe4' },
    kota: { name: 'Kota', cost: 18, fair: 42, cold: false, shop: 2, color: '#c4473a' }
  };

  var QUEST = [
    { kind: 'serve', text: 'Serve 4 customers', need: 4, xp: 25, cash: 120 },
    { kind: 'stock', text: 'Carry a box onto a shelf', need: 1, xp: 20, cash: 80 },
    { kind: 'price', text: 'Write a price on a tag', need: 1, xp: 20, cash: 60 },
    { kind: 'order', text: 'Order stock on the computer', need: 1, xp: 20, cash: 50 },
    { kind: 'drive', text: 'Drive a drop to the taxi rank', need: 1, xp: 30, cash: 100 },
    { kind: 'hire', text: 'Hire someone to help', need: 1, xp: 30, cash: 80 },
    { kind: 'shop2', text: 'Buy the takeaway down the road', need: 1, xp: 40, cash: 150 }
  ];
  var LEVELS = [0, 40, 110, 200, 320];

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var mapCanvas = document.createElement('canvas');
  mapCanvas.width = WORLD_W;
  mapCanvas.height = WORLD_H;
  var mapCtx = mapCanvas.getContext('2d');

  var tiles = new Uint8Array(COLS * ROWS);
  var block = new Uint8Array(COLS * ROWS);
  var area = new Uint8Array(COLS * ROWS);

  var state, fixtures, staff;
  var customers = [];
  var boxes = [];
  var trucks = [];
  var messes = [];
  var particles = [];
  var popups = [];
  var confetti = [];
  var cars = [];
  var ambient = [];
  var toasts = [];
  var job = null;

  var mode = null;
  var pcTab = 'stock';
  var priceTarget = null;
  var priceValue = 18;
  var checkout = null;
  var haggle = null;
  var summary = null;
  var buildTool = null;
  var drag = null;

  var player = { x: 19 * TILE + 8, y: 12 * TILE + 8, vx: 0, vy: 0, facing: 1, carry: null, path: null, bob: 0, driving: false };
  var keys = {};
  var ptrs = {};
  var joy = { on: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
  var holding = false;
  var holdT = 0;
  var holdNeed = 0.75;

  var cam = { x: player.x, y: player.y };
  var zoom = 3;
  var shake = 0;
  var view = { cssW: 390, cssH: 700, dpr: 1, ox: 0, oy: 0, sized: false };
  var hits = [];
  var clockAcc = 0;
  var spawnAcc = 0;
  var saveAcc = 0;
  var eventAcc = 10;
  var rivalAcc = 20;
  var musicAcc = 0;
  var musicStep = 0;
  var fps = 0;
  var frames = 0;
  var fpsStamp = 0;
  var lastT = 0;
  var audioCtx = null;
  var prevLevel = 1;
  var worldBuilt = false;

  var MELODY = [262, 294, 330, 294, 349, 330, 294, 262];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function R(n) {
    var v = Math.round(n);
    var sign = v < 0 ? '-' : '';
    return sign + 'R' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
  function diff() { return DIFFS[state.difficulty] || DIFFS.easy; }
  function level() {
    var L = 1;
    for (var i = 0; i < LEVELS.length; i++) if (state.xp >= LEVELS[i]) L = i + 1;
    return L;
  }
  function shopRect(id) {
    if (id === 2) return { id: 2, x: 12, y: 22, w: 14, h: 10, doorX: 18, doorY: 22, front: -1 };
    return { id: 1, x: 12, y: 3, w: state.shopW || 16, h: 14, doorX: 19, doorY: 16, front: 1 };
  }
  function idx(tx, ty) { return ty * COLS + tx; }
  function tileAt(px, py) { return { x: clamp(px / TILE | 0, 0, COLS - 1), y: clamp(py / TILE | 0, 0, ROWS - 1) }; }

  function fresh() {
    return {
      v: 3,
      difficulty: 'easy',
      cash: DIFFS.easy.cash,
      day: 1,
      minute: 8 * 60,
      xp: 0,
      rep: 62,
      sound: true,
      music: true,
      paused: false,
      started: false,
      helpSeen: false,
      debtDays: 0,
      bailed: false,
      promo: false,
      generatorOn: false,
      shopW: 16,
      shop2: false,
      licenses: { bread: 1, drink: 1, airtime: 0, chips: 0, maize: 0, kota: 0 },
      fixtures: [
        { id: 'shelf1', shop: 1, kind: 'shelf', x: 14, y: 6, w: 3, h: 1, product: 'bread', price: 18, stock: 20, max: 24, broken: 0 },
        { id: 'fridge1', shop: 1, kind: 'fridge', x: 23, y: 6, w: 2, h: 2, product: 'drink', price: 14, stock: 16, max: 20, broken: 0 },
        { id: 'counter1', shop: 1, kind: 'counter', x: 17, y: 13, w: 4, h: 1 },
        { id: 'pc1', shop: 1, kind: 'pc', x: 14, y: 14, w: 1, h: 1 },
        { id: 'gen1', shop: 1, kind: 'gen', x: 25, y: 14, w: 1, h: 1 },
        { id: 'sign1', shop: 1, kind: 'sign', x: 22, y: 17, w: 1, h: 1 }
      ],
      staff: [],
      bakkie: { x: 23 * TILE + 8, y: 19 * TILE + 8 },
      nextId: 1,
      missionI: 0,
      missionN: 0,
      daily: null,
      achievements: [],
      sawSale: false,
      giftTruck: false,
      stats: blankStats(),
      event: null,
      eventT: 0,
      rivalPromo: 0
    };
  }
  function blankStats() {
    return { revenue: 0, tips: 0, supply: 0, served: 0, lost: 0, wages: 0, rent: 0 };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var data = JSON.parse(raw);
      if (!data || data.v !== 3 || !data.fixtures) return fresh();
      return data;
    } catch (e) { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function bind() {
    fixtures = state.fixtures;
    staff = state.staff;
  }

  function toast(text, kind) {
    toasts.unshift({ text: text, life: 4.4, kind: kind || 'info' });
    if (toasts.length > 3) toasts.pop();
  }
  function popup(x, y, text, bad) {
    popups.push({ x: x, y: y, text: text, life: 1.3, max: 1.3, bad: !!bad });
    if (popups.length > 8) popups.shift();
  }
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 30,
        life: 0.5 + Math.random() * 0.4,
        color: color
      });
    }
  }
  function confettiBurst() {
    var cols = ['#f0c14a', '#217333', '#c4473a', '#3a78c2', '#fff9ea'];
    for (var i = 0; i < 36; i++) {
      confetti.push({
        x: view.cssW * (0.2 + Math.random() * 0.6),
        y: 40 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 90,
        vy: 40 + Math.random() * 80,
        life: 1.1 + Math.random() * 0.5,
        color: cols[i % cols.length]
      });
    }
    shake = Math.min(7, shake + 4);
  }
  function achieve(id, name) {
    if (state.achievements.indexOf(id) >= 0) return;
    state.achievements.push(id);
    state.xp += 8;
    toast('Achievement: ' + name, 'good');
    confettiBurst();
    checkLevel();
  }
  function checkLevel() {
    var L = level();
    if (L > prevLevel) {
      prevLevel = L;
      var msg = L === 2 ? 'Level 2. The regulars are learning your name.' : 'Level ' + L + '. The shop is yours to grow.';
      toast(msg, 'good');
      confettiBurst();
    }
  }
  function progress(kind, n) {
    var m = QUEST[state.missionI];
    if (m && m.kind === kind) {
      state.missionN += n || 1;
      if (state.missionN >= m.need) {
        state.cash += m.cash;
        state.xp += m.xp;
        toast('Done: ' + m.text + '  +' + R(m.cash), 'good');
        popup(player.x, player.y - 10, '+' + R(m.cash));
        confettiBurst();
        state.missionI++;
        state.missionN = 0;
        checkLevel();
      }
    }
    if (state.daily && state.daily.kind === kind && !state.daily.done) {
      state.daily.have += n || 1;
      if (state.daily.have >= state.daily.need) {
        state.daily.done = true;
        state.cash += state.daily.cash;
        state.xp += state.daily.xp;
        toast('Today\'s job done. +' + R(state.daily.cash), 'good');
        confettiBurst();
        checkLevel();
      }
    }
  }

  function tone(freq, dur, vol, type, music) {
    if (music) { if (!state.music) return; }
    else if (!state.sound) return;
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'square';
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

  function setTile(tx, ty, tile, own) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    var i = idx(tx, ty);
    tiles[i] = tile;
    if (own != null) area[i] = own;
  }
  function carveBuilding(rect, own, floorTile) {
    var x, y;
    for (y = rect.y; y < rect.y + rect.h; y++) {
      for (x = rect.x; x < rect.x + rect.w; x++) {
        var edge = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
        var door = (x === rect.doorX || x === rect.doorX + 1) && y === rect.doorY;
        if (edge && !door) setTile(x, y, 1, own);
        else if (door) setTile(x, y, 2, own);
        else setTile(x, y, floorTile, own);
      }
    }
  }
  function rebuildTiles() {
    var x, y, i;
    for (i = 0; i < tiles.length; i++) { tiles[i] = 5; area[i] = 0; }
    for (y = 17; y <= 21; y++) {
      for (x = 2; x < COLS - 2; x++) setTile(x, y, y === 17 || y === 21 ? 4 : 3, 0);
    }
    for (x = 6; x <= 8; x++) {
      for (y = 2; y < ROWS - 2; y++) if (tiles[idx(x, y)] === 5) setTile(x, y, 3, 0);
    }
    carveBuilding(shopRect(1), 1, 0);
    carveBuilding({ x: 33, y: 3, w: 10, h: 14, doorX: 37, doorY: 16 }, 9, 7);
    if (state.shop2) carveBuilding(shopRect(2), 2, 0);
    else carveBuilding(shopRect(2), 8, 7);
    var houses = [[1, 24, 8, 8], [34, 24, 10, 8], [2, 4, 8, 7]];
    for (i = 0; i < houses.length; i++) {
      var h = houses[i];
      carveBuilding({ x: h[0], y: h[1], w: h[2], h: h[3], doorX: h[0] + 3, doorY: h[1] + h[3] - 1 }, 0, 7);
    }
    rebuildBlocks();
    paintMap();
  }
  function rebuildBlocks() {
    block = new Uint8Array(COLS * ROWS);
    var i, f, x, y;
    for (i = 0; i < fixtures.length; i++) {
      f = fixtures[i];
      if (f.kind === 'sign' || f.kind === 'plant') continue;
      for (y = f.y; y < f.y + f.h; y++) {
        for (x = f.x; x < f.x + f.w; x++) {
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS) block[idx(x, y)] = 1;
        }
      }
    }
  }
  function walkable(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    var i = idx(tx, ty);
    if (block[i]) return false;
    var t = tiles[i];
    return t === 0 || t === 2 || t === 3 || t === 4 || t === 5;
  }
  function driveable(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    if (block[idx(tx, ty)]) return false;
    var t = tiles[idx(tx, ty)];
    return t === 2 || t === 3 || t === 4 || t === 5;
  }
  function solidAt(px, py, driving) {
    var r = 5;
    var pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    for (var i = 0; i < 4; i++) {
      var tx = pts[i][0] / TILE | 0;
      var ty = pts[i][1] / TILE | 0;
      if (driving ? !driveable(tx, ty) : !walkable(tx, ty)) return true;
    }
    return false;
  }
  function paintMap() {
    var x, y, t, px, py, alt;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        t = tiles[idx(x, y)];
        px = x * TILE; py = y * TILE;
        alt = (x + y) % 2;
        if (t === 1) {
          mapCtx.fillStyle = '#6b442c';
          mapCtx.fillRect(px, py, TILE, TILE);
          mapCtx.fillStyle = '#8d5a34';
          mapCtx.fillRect(px, py, TILE, 4);
        } else if (t === 3) {
          mapCtx.fillStyle = '#6d6a62';
          mapCtx.fillRect(px, py, TILE, TILE);
          mapCtx.fillStyle = '#e6d48a';
          if (y % 2 === 0) mapCtx.fillRect(px + (x % 2 ? 2 : 9), py + 7, 5, 2);
        } else if (t === 4) {
          mapCtx.fillStyle = alt ? '#d9d0bc' : '#cfc6b0';
          mapCtx.fillRect(px, py, TILE, TILE);
        } else if (t === 0) {
          mapCtx.fillStyle = alt ? '#c4a574' : '#b8956a';
          mapCtx.fillRect(px, py, TILE, TILE);
        } else if (t === 2) {
          mapCtx.fillStyle = '#f0c14a';
          mapCtx.fillRect(px, py, TILE, TILE);
          mapCtx.fillStyle = '#6b442c';
          mapCtx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        } else if (t === 7) {
          mapCtx.fillStyle = '#e7d3b0';
          mapCtx.fillRect(px, py, TILE, TILE);
          mapCtx.fillStyle = '#c4473a';
          mapCtx.fillRect(px, py, TILE, 5);
        } else {
          mapCtx.fillStyle = alt ? '#3e9a46' : '#348a3e';
          mapCtx.fillRect(px, py, TILE, TILE);
          if ((x * 3 + y) % 7 === 0) {
            mapCtx.fillStyle = '#246b32';
            mapCtx.fillRect(px + 5, py + 8, 6, 5);
            mapCtx.fillStyle = '#2f7d38';
            mapCtx.fillRect(px + 3, py + 3, 10, 6);
          }
        }
      }
    }
  }

  function pathBetween(sx, sy, gx, gy) {
    if (!walkable(gx, gy)) {
      var found = null;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = gx + dirs[d][0], ny = gy + dirs[d][1];
        if (walkable(nx, ny)) { found = { x: nx, y: ny }; break; }
      }
      if (!found) return null;
      gx = found.x; gy = found.y;
    }
    var distA = new Int16Array(COLS * ROWS);
    for (var i = 0; i < distA.length; i++) distA[i] = -1;
    var qx = [sx], qy = [sy], qi = 0;
    if (!walkable(sx, sy)) return null;
    distA[idx(sx, sy)] = 0;
    var dirs2 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (qi < qx.length) {
      var cx = qx[qi], cy = qy[qi];
      qi++;
      if (cx === gx && cy === gy) break;
      for (var k = 0; k < 4; k++) {
        var xx = cx + dirs2[k][0], yy = cy + dirs2[k][1];
        if (!walkable(xx, yy)) continue;
        var ii = idx(xx, yy);
        if (distA[ii] >= 0) continue;
        distA[ii] = distA[idx(cx, cy)] + 1;
        qx.push(xx); qy.push(yy);
      }
    }
    if (distA[idx(gx, gy)] < 0) return null;
    var path = [{ x: gx, y: gy }];
    var px = gx, py = gy, guard = 0;
    while ((px !== sx || py !== sy) && guard++ < 400) {
      var best = null, bd = distA[idx(px, py)];
      for (var n = 0; n < 4; n++) {
        var ax = px + dirs2[n][0], ay = py + dirs2[n][1];
        if (ax < 0 || ay < 0 || ax >= COLS || ay >= ROWS) continue;
        var dd = distA[idx(ax, ay)];
        if (dd >= 0 && dd < bd) { bd = dd; best = { x: ax, y: ay }; }
      }
      if (!best) break;
      px = best.x; py = best.y;
      path.push(best);
    }
    path.reverse();
    return path;
  }
  function follow(ent, speed, dt) {
    if (!ent.path || !ent.path.length) return true;
    var step = ent.path[0];
    var tx = step.x * TILE + 8, ty = step.y * TILE + 8;
    var dx = tx - ent.x, dy = ty - ent.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (d < 3) { ent.path.shift(); return !ent.path.length; }
    var stepPx = Math.min(d, speed * dt);
    ent.x += dx / d * stepPx;
    ent.y += dy / d * stepPx;
    ent.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    return false;
  }

  function fixtureById(id) {
    for (var i = 0; i < fixtures.length; i++) if (fixtures[i].id === id) return fixtures[i];
    return null;
  }
  function counterOf(shopId) {
    for (var i = 0; i < fixtures.length; i++) if (fixtures[i].kind === 'counter' && fixtures[i].shop === shopId) return fixtures[i];
    return null;
  }
  function approachOf(f) {
    var spots = [
      { x: f.x + (f.w / 2 | 0), y: f.y + f.h },
      { x: f.x + (f.w / 2 | 0), y: f.y - 1 },
      { x: f.x - 1, y: f.y },
      { x: f.x + f.w, y: f.y }
    ];
    for (var i = 0; i < spots.length; i++) if (walkable(spots[i].x, spots[i].y)) return spots[i];
    return spots[0];
  }
  function queueSlots(shopId) {
    var c = counterOf(shopId);
    if (!c) return [];
    var rect = shopRect(shopId);
    var y = rect.front > 0 ? c.y + c.h : c.y - 1;
    var slots = [];
    for (var i = 0; i < c.w; i++) slots.push({ x: c.x + i, y: y });
    return slots;
  }
  function slotFree(slot) {
    for (var i = 0; i < customers.length; i++) {
      var c = customers[i];
      if (c.slot && c.slot.x === slot.x && c.slot.y === slot.y && (c.state === 'queue' || c.state === 'wait')) return false;
    }
    return walkable(slot.x, slot.y);
  }
  function bestFixture(shopId, productId) {
    var fallback = null;
    for (var i = 0; i < fixtures.length; i++) {
      var f = fixtures[i];
      if (f.shop !== shopId || f.product !== productId) continue;
      if (f.stock > 0 && f.price && !f.broken) return f;
      if (!fallback) fallback = f;
    }
    return fallback;
  }
  function pickWant(shopId) {
    var list = [];
    for (var id in PRODUCTS) {
      if (!state.licenses[id]) continue;
      if (PRODUCTS[id].shop !== shopId) continue;
      if (bestFixture(shopId, id) || id === 'bread' || id === 'kota') list.push(id);
    }
    if (!list.length) return shopId === 2 ? 'kota' : 'bread';
    if (state.event === 'payday' && list.length > 1 && Math.random() < 0.5) return list[(Math.random() * list.length) | 0];
    return list[(Math.random() * list.length) | 0];
  }
  function say(c, text) { c.bubble = text; c.bubbleT = 2.4; }

  function makeCustomer(shopId, opts) {
    var rect = shopRect(shopId);
    var outsideY = rect.doorY + (rect.front > 0 ? 1 : -1);
    var c = {
      shop: shopId,
      x: rect.doorX * TILE + 8,
      y: outsideY * TILE + 8,
      facing: 0,
      state: 'go',
      want: pickWant(shopId),
      basket: [],
      path: null,
      slot: null,
      patience: diff().patience,
      maxPat: diff().patience,
      bubble: '',
      bubbleT: 0,
      steal: false,
      second: false,
      speed: 34,
      shirt: ['#3a78c2', '#c4473a', '#e0a020', '#6b4c9a', '#2f6b3a'][(Math.random() * 5) | 0],
      dead: false
    };
    if (opts) for (var k in opts) c[k] = opts[k];
    return c;
  }
  function spawnCustomer(shopId) {
    if (!state.started) return;
    var waiting = 0, i;
    for (i = 0; i < customers.length; i++) if (!customers[i].dead) waiting++;
    if (waiting >= 7) return;
    var slots = queueSlots(shopId);
    var queued = 0;
    for (i = 0; i < customers.length; i++) if (customers[i].shop === shopId && (customers[i].state === 'wait' || customers[i].state === 'queue')) queued++;
    if (queued >= slots.length && slots.length) {
      toast('The queue is out the door at ' + (shopId === 2 ? 'the takeaway' : 'the spaza') + '.');
      state.stats.lost++;
      return;
    }
    var c = makeCustomer(shopId);
    var f = bestFixture(shopId, c.want);
    if (f) c.path = pathBetween(tileAt(c.x, c.y).x, tileAt(c.x, c.y).y, approachOf(f).x, approachOf(f).y);
    customers.push(c);
  }
  function spawnFirstCustomer() {
    var c = makeCustomer(1, {
      state: 'wait',
      want: 'bread',
      patience: 99,
      maxPat: 99,
      x: 19 * TILE + 8,
      y: 14 * TILE + 8,
      slot: { x: 19, y: 14 },
      basket: [{ id: 'bread', price: 18, cost: 8 }]
    });
    var shelf = fixtureById('shelf1');
    if (shelf && shelf.stock > 0) shelf.stock--;
    say(c, 'Bread');
    customers.push(c);
  }

  function tryTake(c, f) {
    var p = PRODUCTS[f.product];
    if (!p) { c.state = 'leave'; return; }
    if (f.broken) {
      say(c, 'Broken');
      c.state = 'leave';
      toast('They walked. The ' + (f.kind === 'fridge' ? 'fridge' : 'shelf') + ' is broken.');
      return;
    }
    if (!f.stock) {
      say(c, 'Empty');
      c.state = 'leave';
      state.stats.lost++;
      state.rep = clamp(state.rep - 1, 1, 99);
      toast(p.name + ' is finished. They left without buying.');
      return;
    }
    if (!f.price) {
      say(c, 'No price');
      c.state = 'leave';
      toast('No price on ' + p.name + '. Write a tag.');
      return;
    }
    var ratio = f.price / p.fair;
    if (state.promo) ratio *= 0.9;
    var bail = ratio > 1.5 ? 0.9 : ratio > 1.22 ? 0.55 : 0;
    if (state.rivalPromo > 0 && ratio > 1.05 && !state.promo) bail = Math.max(bail, 0.4);
    if (bail && Math.random() < bail) {
      say(c, 'Too much');
      c.state = 'leave';
      state.stats.lost++;
      state.rep = clamp(state.rep - 1, 1, 99);
      toast(p.name + ' is ' + R(f.price) + '. People expect about ' + R(p.fair) + ', so they walked.');
      return;
    }
    if (Math.random() < 0.06 && !c.steal && state.day > 1) {
      f.stock--;
      c.basket.push({ id: f.product, price: f.price, cost: p.cost });
      c.steal = true;
      c.state = 'steal';
      c.speed = 78;
      c.path = null;
      say(c, '...');
      toast('Someone is walking out without paying. Catch them.');
      return;
    }
    f.stock--;
    var price = f.price;
    if (state.promo) price = Math.max(1, Math.round(f.price * 0.9));
    c.basket.push({ id: f.product, price: price, cost: p.cost });
    say(c, ratio < 0.88 ? 'Deal' : p.name);
  }
  function returnBasket(c) {
    if (c.steal) return;
    for (var i = 0; i < c.basket.length; i++) {
      var f = bestFixture(c.shop, c.basket[i].id);
      if (f) f.stock = Math.min(f.max || 24, f.stock + 1);
    }
    c.basket = [];
  }
  function basketTotal(c) {
    var t = 0;
    for (var i = 0; i < c.basket.length; i++) t += c.basket[i].price;
    return t;
  }
  function sendToQueue(c) {
    var slots = queueSlots(c.shop);
    var slot = null;
    for (var i = 0; i < slots.length; i++) if (slotFree(slots[i])) { slot = slots[i]; break; }
    if (!slot) slot = slots[0];
    c.slot = slot;
    c.state = 'queue';
    var at = tileAt(c.x, c.y);
    c.path = pathBetween(at.x, at.y, slot.x, slot.y);
  }
  function updateCustomer(c, dt) {
    if (c.bubbleT > 0) c.bubbleT -= dt;
    if (c.state === 'go') {
      var f = bestFixture(c.shop, c.want);
      if (!f) { say(c, 'Nothing'); c.state = 'leave'; return; }
      if (!c.path) {
        var at0 = tileAt(c.x, c.y);
        var ap = approachOf(f);
        c.path = pathBetween(at0.x, at0.y, ap.x, ap.y);
        if (!c.path) { c.state = 'leave'; return; }
      }
      if (follow(c, c.speed, dt)) {
        tryTake(c, f);
        if (c.state !== 'go') return;
        var more = state.event === 'payday' ? 0.7 : 0.34;
        if (!c.second && c.basket.length && Math.random() < more) {
          c.second = true;
          c.want = pickWant(c.shop);
          c.path = null;
        } else if (c.basket.length) sendToQueue(c);
      }
    } else if (c.state === 'queue') {
      if (follow(c, c.speed, dt)) c.state = 'wait';
    } else if (c.state === 'wait') {
      if (checkout && checkout.customer === c) return;
      c.patience -= dt;
      if (c.patience <= 0) {
        say(c, 'Too long');
        state.stats.lost++;
        state.rep = clamp(state.rep - 2, 1, 99);
        toast('Too slow at the till. They left' + (c.basket[0] ? ' the ' + PRODUCTS[c.basket[0].id].name.toLowerCase() : '') + '.');
        returnBasket(c);
        c.state = 'leave';
        c.path = null;
      }
    } else if (c.state === 'leave' || c.state === 'steal') {
      if (!c.path) {
        var rect = shopRect(c.shop);
        var at1 = tileAt(c.x, c.y);
        var oy = rect.doorY + (rect.front > 0 ? 1 : -1);
        c.path = pathBetween(at1.x, at1.y, rect.doorX, oy);
      }
      if (c.steal && dist(player.x, player.y, c.x, c.y) < 20 && !player.driving) {
        caughtThief(c);
        return;
      }
      if (follow(c, c.steal ? 78 : 40, dt)) {
        if (c.steal) {
          toast('They got away with ' + (c.basket[0] ? PRODUCTS[c.basket[0].id].name.toLowerCase() : 'stock') + '. The shelf is short.');
          state.rep = clamp(state.rep - 3, 1, 99);
        }
        c.dead = true;
      }
    }
  }
  function caughtThief(c) {
    for (var i = 0; i < c.basket.length; i++) {
      var f = bestFixture(c.shop, c.basket[i].id);
      if (f) f.stock = Math.min(f.max || 24, f.stock + 1);
    }
    c.dead = true;
    state.cash += 40;
    state.xp += 12;
    state.rep = clamp(state.rep + 2, 1, 99);
    toast('You caught them. Stock is back. +R40', 'good');
    popup(c.x, c.y, '+R40');
    burst(c.x, c.y, '#f0c14a', 10);
    shake = 4;
    tone(520, 0.08, 0.04);
    confettiBurst();
    achieve('thief', 'Floor walker');
    progress('clean', 1);
    checkLevel();
  }

  function completeSale(c, tip) {
    var total = basketTotal(c);
    state.cash += total + (tip || 0);
    state.stats.revenue += total;
    state.stats.tips += tip || 0;
    state.stats.served++;
    state.xp += 4;
    state.rep = clamp(state.rep + 1, 1, 99);
    var label = '+' + R(total + (tip || 0));
    popup(c.x, c.y - 8, label);
    burst(c.x, c.y, '#f0c14a', 8);
    shake = Math.min(6, shake + 2.5);
    tone(740, 0.07, 0.04);
    tone(980, 0.05, 0.03);
    if (tip) toast('Quick hands. Tip ' + R(tip) + ' on a ' + R(total) + ' basket.', 'good');
    else toast('Sale ' + R(total) + '.', 'good');
    c.basket = [];
    c.dead = true;
    progress('serve', 1);
    achieve('sale', 'First sale');
    if (!state.giftTruck) {
      state.giftTruck = true;
      trucks.push({ product: 'bread', qty: 8, shop: 1, x: 4 * TILE, y: 19 * TILE + 8, free: true });
      toast('A free box of bread is on the truck. Carry it to the shelf.');
    }
    checkLevel();
    if (!state.sawSale) state.sawSale = true;
  }

  function startCheckout(c) {
    var total = basketTotal(c);
    var note = 20;
    if (total > 20) note = 50;
    if (total > 50) note = 100;
    if (total > 100) note = 200;
    if (!state.sawSale) note = total <= 20 ? 20 : note;
    checkout = {
      customer: c,
      phase: 'scan',
      scanned: [],
      note: note,
      given: 0,
      t0: performance.now(),
      wrong: 0
    };
    mode = 'checkout';
    tone(440, 0.04, 0.03);
  }
  function scanItem(i) {
    if (!checkout || checkout.phase !== 'scan') return;
    if (checkout.scanned.indexOf(i) >= 0) return;
    checkout.scanned.push(i);
    tone(660, 0.04, 0.035);
    shake = Math.min(4, shake + 1);
    if (checkout.scanned.length >= checkout.customer.basket.length) {
      checkout.phase = 'change';
      tone(520, 0.05, 0.03);
    }
  }
  function addCoin(v) {
    if (!checkout || checkout.phase !== 'change') return;
    var due = checkout.note - basketTotal(checkout.customer);
    checkout.given += v;
    tone(300 + v * 8, 0.04, 0.03);
    if (checkout.given === due) {
      var fast = (performance.now() - checkout.t0) < 7000 && checkout.wrong === 0;
      var tip = fast ? Math.max(2, Math.round(basketTotal(checkout.customer) * 0.12)) : 0;
      var cust = checkout.customer;
      checkout = null;
      mode = null;
      completeSale(cust, tip);
      if (fast) achieve('tip', 'Exact and quick');
    } else if (checkout.given > due) {
      checkout.given = 0;
      checkout.wrong++;
      checkout.customer.patience = Math.max(1, checkout.customer.patience - 4);
      toast('Too much change. Count it again.');
      tone(140, 0.08, 0.04);
      shake = 3;
    }
  }

  function placeOrder(productId, discount) {
    var p = PRODUCTS[productId];
    if (!state.licenses[productId]) { toast('You need the ' + p.name.toLowerCase() + ' licence first.'); return; }
    var cost = Math.round(p.cost * 8 * (1 - (discount || 0)));
    if (state.cash < cost) { toast('That order is ' + R(cost) + '. The till is short.'); tone(140, 0.07, 0.04); return; }
    state.cash -= cost;
    state.stats.supply += cost;
    var rect = shopRect(p.shop);
    trucks.push({ product: productId, qty: 8, shop: p.shop, x: 3 * TILE, y: 19 * TILE + 8 });
    toast('Truck is coming with ' + p.name.toLowerCase() + '. You paid ' + R(cost) + '.');
    tone(360, 0.06, 0.03);
    progress('order', 1);
    mode = null;
    haggle = null;
  }
  function startHaggle(productId) {
    if (!state.licenses[productId]) { toast('Licence first.'); return; }
    haggle = { product: productId, t: 0 };
    mode = 'haggle';
  }
  function finishHaggle() {
    if (!haggle) return;
    var u = (Math.sin(haggle.t * 3.4) + 1) / 2;
    var hit = u > 0.58 && u < 0.8;
    var id = haggle.product;
    haggle = null;
    if (hit) {
      toast('You caught the price. 15% off this box.', 'good');
      tone(720, 0.06, 0.04);
    } else toast('Full price this time.');
    placeOrder(id, hit ? 0.15 : 0);
  }

  function stockCarry(f) {
    if (!player.carry) return;
    var box = player.carry;
    var p = PRODUCTS[box.product];
    if (f.kind === 'fridge' && !p.cold) { toast('The fridge is for cold drinks.'); return; }
    if (f.kind === 'shelf' && p.cold) { toast('Cool drinks belong in the fridge.'); return; }
    if (f.kind !== 'shelf' && f.kind !== 'fridge') return;
    if (f.shop !== box.shop && !(box.shop === 1 && f.shop === 1)) {
      if (f.shop !== box.shop) { toast('That box belongs in the other shop.'); return; }
    }
    if (f.product && f.product !== box.product && f.stock > 0) { toast('That shelf is already ' + PRODUCTS[f.product].name.toLowerCase() + '.'); return; }
    var room = (f.max || 24) - (f.product === box.product ? f.stock : 0);
    if (f.product !== box.product) f.stock = 0;
    f.product = box.product;
    var put = Math.min(room, box.qty);
    if (put <= 0) { toast('That shelf is full.'); return; }
    f.stock += put;
    box.qty -= put;
    burst(f.x * TILE + 8, f.y * TILE, p.color, 6);
    tone(480, 0.05, 0.03);
    toast('You shelved ' + put + ' ' + p.name.toLowerCase() + '.');
    progress('stock', 1);
    if (box.qty <= 0) player.carry = null;
    if (!f.price) {
      priceTarget = f;
      priceValue = p.fair;
      mode = 'price';
      toast('Write what it sells for.');
    }
  }
  function grabBox(box) {
    if (player.carry) { toast('Your hands are full.'); return; }
    player.carry = box;
    boxes.splice(boxes.indexOf(box), 1);
    tone(300, 0.05, 0.03);
    toast('Carrying ' + PRODUCTS[box.product].name.toLowerCase() + ' × ' + box.qty + '. Walk it to the shelf.');
  }

  function hire(role, shopId) {
    for (var i = 0; i < staff.length; i++) if (staff[i].role === role && staff[i].shop === shopId) return;
    var fee = diff().hire;
    if (state.cash < fee) { toast('Hiring takes ' + R(fee) + ' up front.'); return; }
    state.cash -= fee;
    var rect = shopRect(shopId);
    var names = { cashier: 'Lerato', stocker: 'Thabo', cashier2: 'Ayesha' };
    staff.push({
      role: role,
      shop: shopId,
      name: names[role] || 'Sam',
      x: rect.doorX * TILE + 8,
      y: (rect.doorY + (rect.front > 0 ? 1 : -1)) * TILE + 8,
      path: null,
      carry: null,
      serveT: 0
    });
    toast(names[role] + ' is on the floor. ' + R(diff().wage) + ' comes off each night.', 'good');
    tone(520, 0.07, 0.04);
    progress('hire', 1);
    achieve('hire', 'Not alone');
    confettiBurst();
  }
  function updateStaff(s, dt) {
    if (s.role === 'cashier' || s.role === 'cashier2') {
      var waiting = null;
      for (var i = 0; i < customers.length; i++) {
        var c = customers[i];
        if (c.dead || c.shop !== s.shop || c.state !== 'wait') continue;
        if (checkout && checkout.customer === c) continue;
        waiting = c; break;
      }
      var counter = counterOf(s.shop);
      if (!counter) return;
      var front = shopRect(s.shop).front;
      var spot = front > 0 ? { x: counter.x + 1, y: counter.y - 1 } : { x: counter.x + 1, y: counter.y + 1 };
      if (!walkable(spot.x, spot.y)) spot = approachOf(counter);
      if (dist(s.x, s.y, spot.x * TILE + 8, spot.y * TILE + 8) > 10) {
        if (!s.path) s.path = pathBetween(tileAt(s.x, s.y).x, tileAt(s.x, s.y).y, spot.x, spot.y);
        follow(s, 40, dt);
        s.serveT = 0;
      } else if (waiting) {
        s.serveT += dt;
        s.bubble = 'Scan';
        s.bubbleT = 0.4;
        if (s.serveT > 2.7) {
          s.serveT = 0;
          completeSale(waiting, 0);
          toast(s.name + ' ran the till.', 'good');
        }
      }
      return;
    }
    if (s.role === 'stocker') {
      if (!s.carry) {
        var box = null;
        for (var b = 0; b < boxes.length; b++) if (boxes[b].shop === s.shop) { box = boxes[b]; break; }
        if (!box) { s.bubble = ''; return; }
        if (dist(s.x, s.y, box.x, box.y) < 16) {
          s.carry = box;
          boxes.splice(boxes.indexOf(box), 1);
          s.path = null;
        } else {
          if (!s.path) s.path = pathBetween(tileAt(s.x, s.y).x, tileAt(s.x, s.y).y, tileAt(box.x, box.y).x, tileAt(box.x, box.y).y);
          follow(s, 40, dt);
        }
      } else {
        var dest = null;
        for (var fi = 0; fi < fixtures.length; fi++) {
          var f = fixtures[fi];
          if (f.shop !== s.shop) continue;
          if (PRODUCTS[s.carry.product].cold && f.kind !== 'fridge') continue;
          if (!PRODUCTS[s.carry.product].cold && f.kind !== 'shelf') continue;
          if (f.product && f.product !== s.carry.product && f.stock > 0) continue;
          if ((f.stock || 0) >= (f.max || 24) && f.product === s.carry.product) continue;
          dest = f; break;
        }
        if (!dest) { s.bubble = 'Full'; return; }
        var ap = approachOf(dest);
        if (dist(s.x, s.y, ap.x * TILE + 8, ap.y * TILE + 8) < 12) {
          if (!dest.product || dest.stock <= 0) { dest.product = s.carry.product; if (!dest.price) dest.price = PRODUCTS[dest.product].fair; dest.stock = 0; }
          var room = (dest.max || 24) - dest.stock;
          var put = Math.min(room, s.carry.qty);
          dest.stock += put;
          s.carry = null;
          s.path = null;
          toast(s.name + ' stocked ' + PRODUCTS[dest.product].name.toLowerCase() + '.', 'good');
          progress('stock', 1);
        } else {
          if (!s.path) s.path = pathBetween(tileAt(s.x, s.y).x, tileAt(s.x, s.y).y, ap.x, ap.y);
          follow(s, 40, dt);
        }
      }
    }
  }
  function offerJob() {
    if (job) return;
    job = { phase: 'offer', x: 40 * TILE + 8, y: 19 * TILE + 8, pay: 160, t: 0, limit: 36 };
    toast('Taxi rank wants a drop. Get in the bakkie. Faster pays more.');
  }
  function enterBakkie() {
    player.driving = true;
    player.path = null;
    player.x = state.bakkie.x;
    player.y = state.bakkie.y;
    if (job && job.phase === 'offer') {
      job.phase = 'run';
      job.t = 0;
      toast('Clock is running. Drive to the gold ring.');
    } else toast('You are driving. Park with the button.');
    tone(220, 0.08, 0.04);
  }
  function exitBakkie() {
    player.driving = false;
    state.bakkie.x = player.x;
    state.bakkie.y = player.y;
    toast('Parked.');
  }
  function completeJob() {
    var bonus = Math.max(40, Math.round(job.pay * clamp(1 - job.t / job.limit, 0.25, 1)));
    state.cash += bonus;
    state.xp += 10;
    popup(player.x, player.y, '+' + R(bonus));
    burst(player.x, player.y, '#f0c14a', 12);
    confettiBurst();
    toast(job.t < job.limit ? 'Delivered on time. +' + R(bonus) : 'Late drop. They still paid ' + R(bonus) + '.', 'good');
    tone(640, 0.08, 0.04);
    progress('drive', 1);
    achieve('drive', 'On the road');
    job = null;
    checkLevel();
  }

  function buyLicense(id) {
    var p = PRODUCTS[id];
    if (!p || !p.license || state.licenses[id]) return;
    if (state.cash < p.license) { toast(p.name + ' licence is ' + R(p.license) + '.'); return; }
    state.cash -= p.license;
    state.licenses[id] = 1;
    toast(p.name + ' is on the books. Order it and give it a shelf.', 'good');
    confettiBurst();
    achieve('licence', 'New aisle');
  }
  function knockWall() {
    var cost = diff().wall;
    if (state.shopW >= 20) { toast('The east wall is already out.'); return; }
    if (state.cash < cost) { toast('Knocking the wall costs ' + R(cost) + '.'); return; }
    state.cash -= cost;
    state.shopW += 4;
    if (state.shopW > 20) state.shopW = 20;
    rebuildTiles();
    toast('More floor. Put a shelf on the new boards.', 'good');
    burst(player.x, player.y, '#d9d0bc', 14);
    shake = 5;
    tone(180, 0.1, 0.04);
    achieve('wall', 'More floor');
  }
  function buyShop2() {
    if (state.shop2) return;
    if (level() < 2) { toast('Learn the first shop. Level 2 opens the takeaway.'); return; }
    var cost = diff().shop2;
    if (state.cash < cost) { toast('The takeaway is ' + R(cost) + '.'); return; }
    state.cash -= cost;
    state.shop2 = true;
    state.licenses.kota = 1;
    fixtures.push(
      { id: 'counter2', shop: 2, kind: 'counter', x: 16, y: 24, w: 4, h: 1 },
      { id: 'shelf2', shop: 2, kind: 'shelf', x: 14, y: 27, w: 3, h: 1, product: 'kota', price: 42, stock: 8, max: 16, broken: 0 },
      { id: 'pc2', shop: 2, kind: 'pc', x: 22, y: 28, w: 1, h: 1 }
    );
    rebuildTiles();
    toast('The takeaway is yours. Drive down the road. Kota is already priced.', 'good');
    confettiBurst();
    progress('shop2', 1);
    achieve('shop2', 'Two shops');
    mode = null;
  }
  function tryPlace(kind, tx, ty) {
    var costs = { shelf: 400, fridge: 900, plant: 80, sign: 200 };
    var cost = costs[kind];
    if (cost == null) return;
    if (state.cash < cost) { toast(kind + ' costs ' + R(cost) + '.'); return; }
    var w = kind === 'fridge' ? 2 : kind === 'shelf' ? 2 : 1;
    var h = kind === 'fridge' ? 2 : 1;
    var x, y;
    for (y = ty; y < ty + h; y++) {
      for (x = tx; x < tx + w; x++) {
        if (!walkable(x, y) || tiles[idx(x, y)] !== 0) { toast('Put it on open shop floor.'); return; }
        if (area[idx(x, y)] !== 1 && area[idx(x, y)] !== 2) { toast('That is outside your shop.'); return; }
      }
    }
    state.cash -= cost;
    fixtures.push({
      id: kind + state.nextId++,
      shop: area[idx(tx, ty)],
      kind: kind,
      x: tx, y: ty, w: w, h: h,
      product: null, price: 0, stock: 0,
      max: kind === 'fridge' ? 20 : 24,
      broken: 0
    });
    rebuildBlocks();
    toast('Placed. Layout changes who can reach the till.', 'good');
    tone(400, 0.05, 0.03);
    buildTool = null;
  }

  function nearestInteract() {
    var best = null, bestD = 34;
    function consider(d, item) { if (d < bestD) { bestD = d; best = item; } }
    if (player.driving) return { kind: 'park' };
    var i, f, c, b, m;
    for (i = 0; i < customers.length; i++) {
      c = customers[i];
      if (c.dead || c.state !== 'wait') continue;
      if (checkout && checkout.customer === c) continue;
      consider(dist(player.x, player.y, c.x, c.y), { kind: 'customer', customer: c });
    }
    if (!player.carry) {
      for (i = 0; i < boxes.length; i++) {
        b = boxes[i];
        consider(dist(player.x, player.y, b.x, b.y), { kind: 'box', box: b });
      }
    }
    for (i = 0; i < fixtures.length; i++) {
      f = fixtures[i];
      var cx = (f.x + f.w / 2) * TILE, cy = (f.y + f.h / 2) * TILE;
      var d = dist(player.x, player.y, cx, cy);
      if (f.kind === 'shelf' || f.kind === 'fridge') {
        if (f.broken && d < 40) consider(d, { kind: 'fix', fixture: f });
        else if (player.carry && d < 40) consider(d, { kind: 'stock', fixture: f });
        else if (d < 36) consider(d, { kind: 'price', fixture: f });
      } else if (f.kind === 'pc' && d < 36) consider(d, { kind: 'pc', fixture: f });
      else if (f.kind === 'gen' && state.event === 'dark' && d < 40) consider(d, { kind: 'gen', fixture: f });
      else if (f.kind === 'sign' && d < 36) consider(d, { kind: 'sign', fixture: f });
    }
    for (i = 0; i < messes.length; i++) {
      m = messes[i];
      consider(dist(player.x, player.y, m.x, m.y), { kind: 'mop', mess: m });
    }
    if (!player.carry) consider(dist(player.x, player.y, state.bakkie.x, state.bakkie.y), { kind: 'bakkie' });
    if (player.carry) consider(18, { kind: 'drop' });
    return best;
  }
  function verb() {
    var n = nearestInteract();
    if (!n) return { label: 'Look', hold: false, kind: 'look' };
    if (n.kind === 'customer') return { label: 'Serve', hold: false, kind: 'customer' };
    if (n.kind === 'box') return { label: 'Open box', hold: false, kind: 'box' };
    if (n.kind === 'stock') return { label: 'Shelve', hold: false, kind: 'stock' };
    if (n.kind === 'price') return { label: 'Price tag', hold: false, kind: 'price' };
    if (n.kind === 'pc') return { label: 'Computer', hold: false, kind: 'pc' };
    if (n.kind === 'fix') return { label: 'Hold fix', hold: true, kind: 'fix' };
    if (n.kind === 'gen') return { label: 'Hold start', hold: true, kind: 'gen' };
    if (n.kind === 'mop') return { label: 'Hold mop', hold: true, kind: 'mop' };
    if (n.kind === 'sign') return { label: state.promo ? 'End special' : 'Put special', hold: false, kind: 'sign' };
    if (n.kind === 'bakkie') return { label: 'Drive', hold: false, kind: 'bakkie' };
    if (n.kind === 'park') return { label: 'Park', hold: false, kind: 'park' };
    if (n.kind === 'drop') return { label: 'Put down', hold: false, kind: 'drop' };
    return { label: 'Look', hold: false, kind: 'look' };
  }
  function doAction() {
    unlock();
    var n = nearestInteract();
    if (!n || n.kind === 'look') { toast('Walk up to a customer, a box, the till, or the computer.'); return; }
    if (n.kind === 'customer') {
      var counter = counterOf(n.customer.shop);
      if (counter && dist(player.x, player.y, (counter.x + 1) * TILE, counter.y * TILE) > 52 && dist(player.x, player.y, n.customer.x, n.customer.y) > 36) {
        toast('Step behind the counter.');
        return;
      }
      startCheckout(n.customer);
      return;
    }
    if (n.kind === 'box') { grabBox(n.box); return; }
    if (n.kind === 'stock') { stockCarry(n.fixture); return; }
    if (n.kind === 'price') {
      priceTarget = n.fixture;
      priceValue = n.fixture.price || (n.fixture.product ? PRODUCTS[n.fixture.product].fair : 10);
      mode = 'price';
      return;
    }
    if (n.kind === 'pc') { mode = 'computer'; pcTab = 'stock'; return; }
    if (n.kind === 'sign') {
      state.promo = !state.promo;
      toast(state.promo ? 'Your sign is on special. Prices ring up 10% less, and people stay.' : 'Special ended. Tags are back to full.');
      return;
    }
    if (n.kind === 'bakkie') { enterBakkie(); return; }
    if (n.kind === 'park') { exitBakkie(); return; }
    if (n.kind === 'drop' && player.carry) {
      boxes.push(player.carry);
      player.carry.x = player.x;
      player.carry.y = player.y + 10;
      player.carry = null;
      toast('Box on the floor.');
    }
  }
  function finishHold() {
    var n = nearestInteract();
    holding = false;
    holdT = 0;
    if (!n) return;
    if (n.kind === 'fix' && n.fixture.broken) {
      n.fixture.broken = 0;
      toast('Fixed. It will hold if you keep an eye on it.', 'good');
      burst(n.fixture.x * TILE, n.fixture.y * TILE, '#d7eefe', 8);
      tone(600, 0.06, 0.04);
      progress('clean', 1);
    } else if (n.kind === 'gen') {
      state.generatorOn = true;
      toast('Generator is on. The fridge stays cold.', 'good');
      tone(200, 0.1, 0.04);
      burst(player.x, player.y, '#f0c14a', 8);
    } else if (n.kind === 'mop') {
      messes.splice(messes.indexOf(n.mess), 1);
      state.rep = clamp(state.rep + 1, 1, 99);
      toast('Floor is clean. People notice.', 'good');
      progress('clean', 1);
      tone(480, 0.05, 0.03);
    }
  }

  function stickPrice() {
    if (!priceTarget) { mode = null; return; }
    priceTarget.price = Math.max(1, Math.round(priceValue));
    var p = priceTarget.product ? PRODUCTS[priceTarget.product] : null;
    if (p && priceTarget.price > p.fair * 1.22) toast(p.name + ' at ' + R(priceTarget.price) + ' is steep. Some people will walk.');
    else if (p && priceTarget.price < p.fair * 0.85) toast(p.name + ' is a bargain. Busy, thinner margin.');
    else toast('Tag on. ' + (p ? p.name + ' ' : '') + R(priceTarget.price) + '.');
    progress('price', 1);
    tone(700, 0.04, 0.03);
    mode = null;
    priceTarget = null;
  }

  function closeDay() {
    if (mode === 'summary') return;
    var d = diff();
    var rent = state.day === 1 ? 0 : d.rent;
    var wages = staff.length * d.wage;
    var before = state.cash;
    state.cash -= rent + wages;
    state.stats.rent += rent;
    state.stats.wages += wages;
    var bail = 0;
    if (state.cash < 0) {
      if (!state.bailed && d.bail) {
        bail = d.bail;
        state.cash += bail;
        state.bailed = true;
      } else state.debtDays++;
    } else state.debtDays = 0;
    summary = {
      revenue: state.stats.revenue,
      tips: state.stats.tips,
      supply: state.stats.supply,
      rent: rent,
      wages: wages,
      served: state.stats.served,
      lost: state.stats.lost,
      bail: bail,
      kept: state.cash - before,
      bust: state.debtDays >= d.debt && state.cash < 0
    };
    mode = 'summary';
    customers = [];
    checkout = null;
    state.minute = 21 * 60;
    save();
  }
  function nextMorning() {
    if (summary && summary.bust) { resetGame(); return; }
    state.day++;
    state.minute = 8 * 60;
    state.event = null;
    state.generatorOn = false;
    state.stats = blankStats();
    state.promo = false;
    summary = null;
    mode = null;
    if (state.day >= 2) {
      state.daily = { kind: 'serve', text: 'Serve 6 people today', need: 6, have: 0, cash: 150, xp: 16, done: false };
    }
    var low = false;
    for (var i = 0; i < fixtures.length; i++) if (fixtures[i].product && fixtures[i].stock < 4) low = true;
    toast(low ? 'Morning. A shelf is nearly bare. Order before the rush.' : 'Morning. Doors open.');
    save();
  }
  function resetGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    state = fresh();
    bind();
    customers = [];
    boxes = [];
    trucks = [];
    messes = [];
    player.driving = false;
    player.carry = null;
    player.x = 19 * TILE + 8;
    player.y = 12 * TILE + 8;
    mode = 'help';
    summary = null;
    checkout = null;
    prevLevel = 1;
    rebuildTiles();
    save();
  }
  function startGame(diffId) {
    state.difficulty = DIFFS[diffId] ? diffId : 'easy';
    state.cash = diff().cash;
    state.started = true;
    state.helpSeen = true;
    mode = null;
    prevLevel = level();
    spawnFirstCustomer();
    toast('A customer is waiting with bread. Walk to the till and tap Serve.');
    save();
  }

  function startEvent(name) {
    if (name === 'break') {
      var fridge = null;
      for (var i = 0; i < fixtures.length; i++) if (fixtures[i].kind === 'fridge' && !fixtures[i].broken) fridge = fixtures[i];
      if (!fridge) return;
      fridge.broken = 1;
      toast('The fridge died. Hold on it to fix it before drinks spoil.');
      state.event = 'break';
      state.eventT = 16;
      return;
    }
    if (name === 'spill') {
      messes.push({ x: 18 * TILE + 8, y: 11 * TILE + 4, shop: 1 });
      toast('Something spilled. Hold to mop, or a few people will turn around.');
      state.event = 'spill';
      state.eventT = 18;
      return;
    }
    if (name === 'thief') {
      var f = bestFixture(1, 'bread') || bestFixture(1, 'drink');
      if (!f || f.stock < 1) return;
      f.stock--;
      var c = makeCustomer(1, { steal: true, state: 'steal', speed: 70, basket: [{ id: f.product, price: f.price || 10, cost: PRODUCTS[f.product].cost }] });
      c.x = f.x * TILE + 8;
      c.y = f.y * TILE + 16;
      c.path = null;
      customers.push(c);
      toast('Shoplifter. Catch them before the door.');
      state.event = 'thief';
      state.eventT = 12;
      return;
    }
    state.event = name;
    state.eventT = name === 'dark' ? 22 : 16;
    state.generatorOn = false;
    if (name === 'rush') toast('Rush hour. The door is busy.');
    if (name === 'dark') toast('Load-shedding. Hold the generator or the fridge warms up.');
    if (name === 'payday') toast('Payday. Baskets are full and notes are bigger.');
    if (name === 'taxi') { offerJob(); toast('Taxi rank is packed. Delivery pays, and the shop is full.'); }
  }
  function endEvent() {
    if (state.event === 'dark' && !state.generatorOn) {
      for (var i = 0; i < fixtures.length; i++) {
        var f = fixtures[i];
        if (f.kind === 'fridge' && f.stock > 0) {
          var lost = Math.max(1, f.stock / 2 | 0);
          f.stock -= lost;
          toast(lost + ' cold drinks spoiled. The generator never started.');
          state.rep = clamp(state.rep - 2, 1, 99);
        }
      }
    }
    state.event = null;
    state.generatorOn = false;
  }

  function rushFactor() {
    var h = state.minute / 60;
    var f = 1;
    if (h >= 8 && h < 9) f = 1.25;
    if (h >= 12 && h < 13.4) f = 1.7;
    if (h >= 16.5 && h < 18.4) f = 1.45;
    if (state.event === 'rush' || state.event === 'payday' || state.event === 'taxi') f *= 1.65;
    if (state.rivalPromo > 0 && !state.promo && !hasUndercut()) f *= 0.62;
    f *= 0.82 + state.rep / 220;
    if (messes.length) f *= 0.85;
    return f;
  }
  function hasUndercut() {
    for (var i = 0; i < fixtures.length; i++) {
      var f = fixtures[i];
      if (!f.product || !f.price || !PRODUCTS[f.product]) continue;
      if (f.price <= PRODUCTS[f.product].fair * 0.9) return true;
    }
    return false;
  }

  function simMoving() {
    return state.started && !state.paused && mode !== 'help' && mode !== 'summary' && mode !== 'build';
  }
  function update(dt) {
    if (!simMoving()) return;
    var sp = player.driving ? 118 : 64;
    var ix = 0, iy = 0;
    if (keys.a || keys.arrowleft) ix -= 1;
    if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iy -= 1;
    if (keys.s || keys.arrowdown) iy += 1;
    if (joy.on) { ix = joy.x; iy = joy.y; }
    var lock = mode === 'checkout' || mode === 'price' || mode === 'computer' || mode === 'haggle';
    if (!lock && (ix || iy)) {
      player.path = null;
      var len = Math.sqrt(ix * ix + iy * iy) || 1;
      ix /= len; iy /= len;
      if (player.driving) {
        var under = tileAt(player.x, player.y);
        var road = tiles[idx(under.x, under.y)] === 3;
        if (!road) sp *= 0.48;
      }
      var nx = player.x + ix * sp * dt;
      var ny = player.y + iy * sp * dt;
      if (!solidAt(nx, player.y, player.driving)) player.x = nx;
      if (!solidAt(player.x, ny, player.driving)) player.y = ny;
      player.facing = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 1 : 3) : (iy > 0 ? 2 : 0);
      player.bob += dt * 8;
    } else if (!lock && player.path && player.path.length) {
      follow(player, 66, dt);
      player.bob += dt * 8;
    }
    player.x = clamp(player.x, 8, WORLD_W - 8);
    player.y = clamp(player.y, 8, WORLD_H - 8);

    if (player.driving && job && job.phase === 'run') {
      job.t += dt;
      if (dist(player.x, player.y, job.x, job.y) < 26) completeJob();
    }
    if (player.driving) { state.bakkie.x = player.x; state.bakkie.y = player.y; }

    for (var i = customers.length - 1; i >= 0; i--) updateCustomer(customers[i], dt);
    var live = [];
    for (i = 0; i < customers.length; i++) if (!customers[i].dead) live.push(customers[i]);
    customers = live;

    for (i = 0; i < staff.length; i++) updateStaff(staff[i], dt);

    for (i = trucks.length - 1; i >= 0; i--) {
      var tr = trucks[i];
      var rect = shopRect(tr.shop);
      var tx = rect.doorX * TILE + 8;
      var ty = 19 * TILE + 8;
      var dx = tx - tr.x, dy = ty - tr.y;
      var dd = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dd < 10) {
        var spotY = tr.shop === 2 ? 26 * TILE : 14 * TILE + 8;
        boxes.push({ product: tr.product, qty: tr.qty, shop: tr.shop, x: (tr.shop === 2 ? 15 : 15) * TILE + 8, y: spotY });
        toast('Truck dropped ' + PRODUCTS[tr.product].name.toLowerCase() + '. Open the box.');
        trucks.splice(i, 1);
        tone(240, 0.08, 0.035);
      } else {
        tr.x += dx / dd * 78 * dt;
        tr.y += dy / dd * 78 * dt;
      }
    }

    for (i = 0; i < cars.length; i++) {
      cars[i].x += cars[i].vx * dt;
      if (cars[i].x > WORLD_W + 20) cars[i].x = -20;
      if (cars[i].x < -20) cars[i].x = WORLD_W + 20;
    }
    for (i = 0; i < ambient.length; i++) {
      var a = ambient[i];
      a.x += a.dir * 22 * dt;
      if (a.x > 42 * TILE) a.dir = -1;
      if (a.x < 4 * TILE) a.dir = 1;
    }

    if (state.event === 'dark' && !state.generatorOn) {
      for (i = 0; i < fixtures.length; i++) {
        var fr = fixtures[i];
        if (fr.kind === 'fridge' && fr.stock > 0) {
          fr.warm = (fr.warm || 0) + dt;
          if (fr.warm > 10) {
            fr.warm = 0;
            fr.stock--;
            toast('A drink warmed in the dark. Start the generator.');
          }
        }
      }
    }
    for (i = 0; i < fixtures.length; i++) {
      if (fixtures[i].broken && fixtures[i].stock > 0) {
        fixtures[i].warm = (fixtures[i].warm || 0) + dt;
        if (fixtures[i].warm > 7) {
          fixtures[i].warm = 0;
          fixtures[i].stock--;
          toast('Stock spoiled. The fridge is still broken.');
        }
      }
    }

    spawnAcc += dt * rushFactor();
    if (spawnAcc > diff().spawn) {
      spawnAcc = 0;
      spawnCustomer(1);
      if (state.shop2 && Math.random() < 0.55) spawnCustomer(2);
    }

    state.minute += dt * (13 * 60) / 100;
    if (state.minute >= 21 * 60) closeDay();

    if (state.event) {
      state.eventT -= dt;
      if (state.eventT <= 0) endEvent();
    } else {
      eventAcc += dt;
      var gap = state.difficulty === 'easy' ? 48 : 32;
      if (eventAcc > gap && state.day >= 1 && state.sawSale) {
        eventAcc = 0;
        var names = ['rush', 'spill', 'taxi', 'dark', 'payday', 'thief', 'break'];
        startEvent(names[(Math.random() * names.length) | 0]);
      }
    }
    if (state.rivalPromo > 0) state.rivalPromo -= dt;
    else {
      rivalAcc += dt;
      if (rivalAcc > 70) {
        rivalAcc = 0;
        state.rivalPromo = 28;
        toast('Bra Zee\'s across the road put up a special. Drop a price or switch your sign on.');
      }
    }

    if (holding) {
      var v = verb();
      if (!v.hold) { holding = false; holdT = 0; }
      else {
        holdT += dt;
        if (holdT >= holdNeed) finishHold();
      }
    }

    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    for (i = confetti.length - 1; i >= 0; i--) {
      confetti[i].life -= dt;
      confetti[i].x += confetti[i].vx * dt;
      confetti[i].y += confetti[i].vy * dt;
      if (confetti[i].life <= 0) confetti.splice(i, 1);
    }
    for (i = toasts.length - 1; i >= 0; i--) {
      toasts[i].life -= dt;
      if (toasts[i].life <= 0) toasts.splice(i, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 10);

    musicAcc += dt;
    if (musicAcc > 0.46) {
      musicAcc = 0;
      tone(MELODY[musicStep % MELODY.length], 0.13, 0.018, 'triangle', true);
      musicStep++;
    }
    saveAcc += dt;
    if (saveAcc > 3) { saveAcc = 0; save(); }
  }

  function drawPerson(x, y, shirt, bob, apron) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect((x - 5) | 0, (y + 8) | 0, 10, 3);
    ctx.fillStyle = '#f0c8a0';
    ctx.fillRect((x - 3) | 0, (y - 14) | 0, 6, 6);
    ctx.fillStyle = shirt;
    ctx.fillRect((x - 5) | 0, (y - 8) | 0, 10, 8);
    if (apron) {
      ctx.fillStyle = '#217333';
      ctx.fillRect((x - 3) | 0, (y - 6) | 0, 6, 6);
    }
    ctx.fillStyle = '#243044';
    ctx.fillRect((x - 4) | 0, (y) | 0, 3, 6 + (bob ? 1 : 0));
    ctx.fillRect((x + 1) | 0, (y) | 0, 3, 6 + (bob ? 0 : 1));
  }
  function drawFixture(f) {
    var x = f.x * TILE, y = f.y * TILE, w = f.w * TILE, h = f.h * TILE;
    if (f.kind === 'shelf') {
      ctx.fillStyle = '#6b442c';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#a67c52';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      if (f.product && f.stock > 0) {
        ctx.fillStyle = PRODUCTS[f.product].color;
        var n = Math.min(4, f.stock);
        for (var i = 0; i < n; i++) ctx.fillRect(x + 3 + i * 6, y + 4, 4, 6);
      }
    } else if (f.kind === 'fridge') {
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = f.broken ? '#8a93a0' : '#d7eefe';
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = '#3a78c2';
      ctx.fillRect(x + 3, y + 4, 3, h - 8);
      if (f.stock > 0 && f.product) {
        ctx.fillStyle = PRODUCTS[f.product].color;
        ctx.fillRect(x + 10, y + 6, 6, 8);
      }
    } else if (f.kind === 'counter') {
      ctx.fillStyle = '#5c3a22';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#c4a574';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(x + 4, y + 4, 8, 4);
    } else if (f.kind === 'pc') {
      ctx.fillStyle = '#243044';
      ctx.fillRect(x + 2, y + 2, 12, 10);
      ctx.fillStyle = '#8ecaf2';
      ctx.fillRect(x + 4, y + 4, 8, 5);
    } else if (f.kind === 'gen') {
      ctx.fillStyle = '#3a3f36';
      ctx.fillRect(x + 2, y + 4, 12, 10);
      ctx.fillStyle = state.generatorOn ? '#7dce6a' : '#c4473a';
      ctx.fillRect(x + 6, y + 6, 4, 4);
    } else if (f.kind === 'sign') {
      ctx.fillStyle = '#6b442c';
      ctx.fillRect(x + 6, y + 6, 3, 10);
      ctx.fillStyle = state.promo ? '#c4473a' : '#f0c14a';
      ctx.fillRect(x, y, 16, 8);
    } else if (f.kind === 'plant') {
      ctx.fillStyle = '#5c3a22';
      ctx.fillRect(x + 5, y + 8, 6, 6);
      ctx.fillStyle = '#217333';
      ctx.fillRect(x + 3, y + 2, 10, 8);
    }
    if ((f.kind === 'shelf' || f.kind === 'fridge') && f.price && f.product) {
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(x + 1, y + h - 7, 18, 7);
      ctx.fillStyle = '#1c2614';
      ctx.font = '7px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(R(state.promo ? Math.round(f.price * 0.9) : f.price), x + 2, y + h - 1);
    }
  }
  function drawBubble(x, y, text) {
    if (!text) return;
    ctx.font = '8px system-ui, sans-serif';
    var w = Math.max(24, ctx.measureText(text).width + 6);
    ctx.fillStyle = '#fff9ea';
    ctx.fillRect(x - w / 2, y - 28, w, 11);
    ctx.fillStyle = '#1c2614';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 19);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function button(id, x, y, w, h, label, on) {
    hits.push({ id: id, x: x, y: y, w: w, h: h });
    ctx.fillStyle = on ? '#217333' : '#fff9ea';
    roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c2614';
    ctx.stroke();
    ctx.fillStyle = on ? '#fff' : '#1c2614';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }
  function hitAt(x, y) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h) return h;
    }
    return null;
  }

  function drawWorld() {
    var z = zoom;
    var playTop = 78;
    var playBot = mode === 'checkout' || mode === 'computer' || mode === 'price' ? view.cssH * 0.46 : 150;
    var cy = playTop + (view.cssH - playTop - playBot) / 2;
    view.ox = Math.round(view.cssW / 2 - cam.x * z);
    view.oy = Math.round(cy - cam.y * z);
    var sx = (Math.random() - 0.5) * shake * 2;
    var sy = (Math.random() - 0.5) * shake * 2;
    ctx.save();
    ctx.translate(view.ox + sx, view.oy + sy);
    ctx.scale(z, z);
    ctx.drawImage(mapCanvas, 0, 0);
    var i;
    for (i = 0; i < fixtures.length; i++) drawFixture(fixtures[i]);
    if (mode === 'build') {
      ctx.strokeStyle = 'rgba(240,193,74,0.7)';
      ctx.lineWidth = 1;
      var rect = shopRect(1);
      for (var ty = rect.y + 1; ty < rect.y + rect.h - 1; ty++) {
        for (var tx = rect.x + 1; tx < rect.x + rect.w - 1; tx++) {
          if (tiles[idx(tx, ty)] === 0) ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
        }
      }
    }
    for (i = 0; i < messes.length; i++) {
      ctx.fillStyle = '#6a5428';
      ctx.fillRect(messes[i].x - 6, messes[i].y - 3, 14, 7);
    }
    for (i = 0; i < boxes.length; i++) {
      ctx.fillStyle = '#c47a3a';
      ctx.fillRect(boxes[i].x - 7, boxes[i].y - 6, 14, 12);
      ctx.fillStyle = '#1c2614';
      ctx.font = '7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(PRODUCTS[boxes[i].product].name.slice(0, 5), boxes[i].x, boxes[i].y + 2);
    }
    if (!player.driving) {
      ctx.fillStyle = '#2f6b3a';
      ctx.fillRect(state.bakkie.x - 12, state.bakkie.y - 6, 24, 14);
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(state.bakkie.x - 10, state.bakkie.y - 4, 16, 8);
      ctx.fillStyle = '#d7eefe';
      ctx.fillRect(state.bakkie.x + 4, state.bakkie.y - 2, 5, 4);
      if (job && job.phase === 'offer') drawBubble(state.bakkie.x, state.bakkie.y - 8, 'Job');
    }
    for (i = 0; i < cars.length; i++) {
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(cars[i].x - 11, cars[i].y - 5, 22, 12);
      ctx.fillStyle = cars[i].color;
      ctx.fillRect(cars[i].x - 9, cars[i].y - 3, 18, 8);
    }
    for (i = 0; i < trucks.length; i++) {
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(trucks[i].x - 14, trucks[i].y - 8, 30, 16);
      ctx.fillStyle = '#e07a3d';
      ctx.fillRect(trucks[i].x - 12, trucks[i].y - 6, 22, 12);
      ctx.fillStyle = '#d7eefe';
      ctx.fillRect(trucks[i].x + 8, trucks[i].y - 4, 6, 5);
    }
    if (job && job.phase === 'run') {
      ctx.strokeStyle = '#f0c14a';
      ctx.lineWidth = 2;
      ctx.strokeRect(job.x - 12, job.y - 12, 24, 24);
      drawBubble(job.x, job.y - 6, 'Drop');
    }
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff9ea';
    ctx.fillText('Zee', 37 * TILE + 8, 7 * TILE);
    if (state.rivalPromo > 0) drawBubble(37 * TILE + 8, 8 * TILE, 'SALE');
    for (i = 0; i < ambient.length; i++) drawPerson(ambient[i].x, ambient[i].y, ambient[i].shirt, (ambient[i].x / 8 | 0) % 2, false);
    for (i = 0; i < customers.length; i++) {
      var c = customers[i];
      drawPerson(c.x, c.y, c.steal ? '#1c2614' : c.shirt, (c.x / 6 | 0) % 2, false);
      if (c.bubble && c.bubbleT > 0) drawBubble(c.x, c.y, c.bubble);
      else if (c.basket.length && c.state === 'wait') drawBubble(c.x, c.y, PRODUCTS[c.basket[0].id].name);
      if (c.state === 'wait') {
        var pw = 16, ph = c.patience / c.maxPat;
        ctx.fillStyle = '#1c2614';
        ctx.fillRect(c.x - 8, c.y - 20, pw, 3);
        ctx.fillStyle = ph < 0.35 ? '#c4473a' : '#7dce6a';
        ctx.fillRect(c.x - 8, c.y - 20, pw * clamp(ph, 0, 1), 3);
      }
    }
    for (i = 0; i < staff.length; i++) {
      drawPerson(staff[i].x, staff[i].y, staff[i].role === 'stocker' ? '#e07a3d' : '#3a78c2', (staff[i].x / 6 | 0) % 2, true);
      drawBubble(staff[i].x, staff[i].y, staff[i].name.split(' ')[0]);
    }
    if (!player.driving) {
      drawPerson(player.x, player.y, '#f0c14a', (player.bob | 0) % 2, true);
      if (player.carry) {
        ctx.fillStyle = '#c47a3a';
        ctx.fillRect(player.x + 6, player.y - 8, 12, 10);
      }
    } else {
      ctx.fillStyle = '#1c2614';
      ctx.fillRect(player.x - 14, player.y - 8, 28, 16);
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(player.x - 12, player.y - 6, 24, 12);
      ctx.fillStyle = '#d7eefe';
      ctx.fillRect(player.x + 4, player.y - 4, 7, 5);
    }
    for (i = 0; i < particles.length; i++) {
      ctx.globalAlpha = Math.max(0, particles[i].life * 2);
      ctx.fillStyle = particles[i].color;
      ctx.fillRect(particles[i].x | 0, particles[i].y | 0, 3, 3);
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < popups.length; i++) {
      var pop = popups[i];
      ctx.globalAlpha = Math.max(0, pop.life / pop.max);
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1c2614';
      ctx.fillText(pop.text, pop.x + 1, pop.y - (1 - pop.life / pop.max) * 16 + 1);
      ctx.fillStyle = pop.bad ? '#c4473a' : '#f0c14a';
      ctx.fillText(pop.text, pop.x, pop.y - (1 - pop.life / pop.max) * 16);
      ctx.globalAlpha = 1;
    }
    if (!state.sawSale && state.started && mode !== 'help') {
      var bob = Math.sin(performance.now() / 180) * 3;
      ctx.fillStyle = '#f0c14a';
      ctx.fillRect(19 * TILE + 4, 12 * TILE - 18 + bob, 8, 8);
    }
    ctx.restore();

    var dark = 0;
    var hour = state.minute / 60;
    if (hour >= 18.5) dark = clamp((hour - 18.5) / 2.5, 0, 0.45) * 0.55;
    if (state.event === 'dark' && !state.generatorOn) dark = 0.72;
    else if (state.event === 'dark') dark = Math.max(dark, 0.28);
    if (dark > 0.02) {
      ctx.fillStyle = 'rgba(8,12,28,' + dark.toFixed(3) + ')';
      ctx.fillRect(0, 0, view.cssW, view.cssH);
      if (state.event === 'dark') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.arc(view.ox + player.x * zoom + sx, view.oy + player.y * zoom + sy, state.generatorOn ? 180 : 70, 0, 7);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function hudText(text, x, y, color, size, align) {
    ctx.font = '800 ' + (size || 16) + 'px system-ui, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.fillStyle = '#1c2614';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color || '#fff9ea';
    ctx.fillText(text, x, y);
  }
  function drawHud() {
    hits = [];
    ctx.fillStyle = '#f6efd8';
    ctx.fillRect(0, 0, view.cssW, 72);
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(0, 70, view.cssW, 3);
    hudText('Corner & Co', 10, 22, '#217333', 14);
    hudText(R(state.cash), view.cssW - 10, 22, '#1c2614', 18, 'right');
    var hh = (state.minute / 60) | 0;
    var mm = (state.minute % 60) | 0;
    hudText('Day ' + state.day + '  ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm, 10, 44, '#1c2614', 14);
    hudText('Regulars ' + Math.round(state.rep), 10, 62, '#4d5a40', 13);
    var L = level();
    var prev = LEVELS[Math.min(L - 1, LEVELS.length - 1)];
    var next = LEVELS[Math.min(L, LEVELS.length - 1)];
    var span = Math.max(1, next - prev);
    var xpT = L >= LEVELS.length ? 1 : clamp((state.xp - prev) / span, 0, 1);
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(150, 50, 90, 10);
    ctx.fillStyle = '#f0c14a';
    ctx.fillRect(152, 52, 86 * xpT, 6);
    hudText('Lv ' + L, 246, 60, '#1c2614', 13);

    var mission = QUEST[state.missionI];
    var mText = mission ? mission.text + '  ' + Math.min(state.missionN, mission.need) + '/' + mission.need : (state.daily && !state.daily.done ? state.daily.text + '  ' + state.daily.have + '/' + state.daily.need : 'Keep the shelves full.');
    ctx.fillStyle = '#217333';
    ctx.fillRect(0, 73, view.cssW, 26);
    hudText(mText, 10, 91, '#fff', 13);

    button('pause', view.cssW - 108, 32, 32, 32, state.paused ? '>' : 'II', state.paused);
    button('sound', view.cssW - 72, 32, 32, 32, state.sound ? 'S' : 'x', !state.sound);
    button('music', view.cssW - 36, 32, 32, 32, state.music ? 'M' : 'm', state.music);
    button('build', view.cssW - 44, 108, 36, 36, 'B', mode === 'build');

    if (job && job.phase === 'run') hudText('Drop ' + Math.max(0, Math.ceil(job.limit - job.t)) + 's', view.cssW / 2, 120, '#f0c14a', 16, 'center');
    if (state.event === 'dark') hudText('Lights out', view.cssW / 2, 140, '#f0c14a', 16, 'center');
    if (state.rivalPromo > 0) hudText('Bra Zee is on special', view.cssW / 2, 160, '#c4473a', 14, 'center');

    var ty = 112;
    for (var t = 0; t < toasts.length && t < 3; t++) {
      ctx.globalAlpha = clamp(toasts[t].life, 0, 1);
      ctx.fillStyle = toasts[t].kind === 'good' ? '#217333' : '#1c2614';
      var tw = Math.min(view.cssW - 24, 340);
      roundRect(12, ty, tw, 36, 8);
      ctx.fill();
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      wrapText(toasts[t].text, 20, ty + 15, tw - 16, 14);
      ctx.globalAlpha = 1;
      ty += 40;
    }

    if (mode !== 'checkout' && mode !== 'computer' && mode !== 'price' && mode !== 'help' && mode !== 'summary' && mode !== 'haggle') {
      drawJoy();
      drawAction();
    }
    if (mode === 'build') drawBuild();
    if (mode === 'checkout') drawCheckout();
    if (mode === 'computer') drawComputer();
    if (mode === 'price') drawPrice();
    if (mode === 'haggle') drawHaggle();
    if (mode === 'summary') drawSummary();
    if (mode === 'help' || !state.started) drawHelp();
    if (state.paused && state.started && mode !== 'help') {
      ctx.fillStyle = 'rgba(12,18,28,0.45)';
      ctx.fillRect(0, 100, view.cssW, view.cssH);
      hudText('Paused', view.cssW / 2, view.cssH / 2, '#fff', 28, 'center');
    }
    for (var c = 0; c < confetti.length; c++) {
      ctx.globalAlpha = clamp(confetti[c].life, 0, 1);
      ctx.fillStyle = confetti[c].color;
      ctx.fillRect(confetti[c].x, confetti[c].y, 4, 6);
      ctx.globalAlpha = 1;
    }
  }
  function wrapText(text, x, y, maxW, lineH) {
    var words = String(text).split(' ');
    var line = '';
    var lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = words[i];
        y += lineH;
        lines++;
        if (lines === 1) break;
      } else line = test;
    }
    ctx.fillText(line, x, y);
  }
  function drawJoy() {
    var cx = 74, cy = view.cssH - 86;
    hits.push({ id: 'joy', x: cx - 58, y: cy - 58, w: 116, h: 116 });
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, 7);
    ctx.fillStyle = 'rgba(255,249,234,0.85)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c2614';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + joy.x * 26, cy + joy.y * 26, 18, 0, 7);
    ctx.fillStyle = '#217333';
    ctx.fill();
  }
  function drawAction() {
    var v = verb();
    var cx = view.cssW - 74, cy = view.cssH - 86;
    hits.push({ id: 'act', x: cx - 40, y: cy - 40, w: 80, h: 80 });
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, 7);
    ctx.fillStyle = v.kind === 'look' ? '#d9d0bc' : '#f0c14a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c2614';
    ctx.stroke();
    if (holding && v.hold) {
      ctx.beginPath();
      ctx.strokeStyle = '#217333';
      ctx.lineWidth = 4;
      ctx.arc(cx, cy, 30, -1.57, -1.57 + holdT / holdNeed * 6.28);
      ctx.stroke();
    }
    ctx.fillStyle = '#1c2614';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.label, cx, cy + 4);
  }
  function drawBuild() {
    var tools = [['shelf', 'Shelf', 400], ['fridge', 'Fridge', 900], ['plant', 'Plant', 80], ['sign', 'Sign', 200]];
    var x = 8;
    for (var i = 0; i < tools.length; i++) {
      button('tool-' + tools[i][0], x, view.cssH - 168, 78, 44, tools[i][1], buildTool === tools[i][0]);
      x += 84;
    }
    button('wall', 8, view.cssH - 214, 150, 40, 'Knock wall ' + R(diff().wall), false);
    hudText('Drag a piece onto the floor. Time is paused.', 12, view.cssH - 228, '#fff', 12);
  }
  function drawCheckout() {
    if (!checkout) return;
    var c = checkout.customer;
    var y0 = view.cssH * 0.40;
    ctx.fillStyle = '#f6efd8';
    ctx.fillRect(0, y0, view.cssW, view.cssH - y0);
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(0, y0, view.cssW, 3);
    hudText('Till', 16, y0 + 28, '#1c2614', 20);
    var duePat = c.patience / c.maxPat;
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(90, y0 + 14, 140, 12);
    ctx.fillStyle = duePat < 0.35 ? '#c4473a' : '#217333';
    ctx.fillRect(92, y0 + 16, 136 * clamp(duePat, 0, 1), 8);
    button('cancel', view.cssW - 96, y0 + 10, 80, 36, 'Close', false);
    if (checkout.phase === 'scan') {
      hudText('Tap each thing they put down.', 16, y0 + 58, '#4d5a40', 14);
      for (var i = 0; i < c.basket.length; i++) {
        var done = checkout.scanned.indexOf(i) >= 0;
        button('scan-' + i, 16 + (i % 3) * 118, y0 + 78 + ((i / 3) | 0) * 64, 110, 56, (done ? 'OK ' : '') + PRODUCTS[c.basket[i].id].name, done);
      }
    } else {
      var total = basketTotal(c);
      var due = checkout.note - total;
      hudText('They paid ' + R(checkout.note) + '. Give ' + R(due) + '.', 16, y0 + 58, '#1c2614', 16);
      hudText('In your hand ' + R(checkout.given), 16, y0 + 80, '#217333', 16);
      var coins = [20, 10, 5, 2, 1];
      if (due === 0) button('coin-0', 16, y0 + 100, 200, 52, 'Exact amount', true);
      else for (var k = 0; k < coins.length; k++) {
        button('coin-' + coins[k], 12 + k * 74, y0 + 100, 68, 52, R(coins[k]), false);
      }
      button('clear-coin', 16, y0 + 164, 120, 44, 'Start again', false);
    }
  }
  function drawComputer() {
    var y0 = 110;
    ctx.fillStyle = 'rgba(12,18,28,0.35)';
    ctx.fillRect(0, 100, view.cssW, view.cssH);
    ctx.fillStyle = '#f6efd8';
    roundRect(10, y0, view.cssW - 20, view.cssH - y0 - 12, 12);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c2614';
    ctx.stroke();
    hudText('Shop computer', 24, y0 + 28, '#1c2614', 18);
    button('tab-stock', 24, y0 + 40, 100, 36, 'Orders', pcTab === 'stock');
    button('tab-grow', 132, y0 + 40, 100, 36, 'Grow', pcTab === 'grow');
    button('cancel', view.cssW - 110, y0 + 40, 80, 36, 'Close', false);
    var y = y0 + 96;
    if (pcTab === 'stock') {
      hudText('A box is 8. The truck drives in.', 24, y, '#4d5a40', 13);
      y += 16;
      for (var id in PRODUCTS) {
        if (PRODUCTS[id].shop === 2 && !state.shop2) continue;
        if (!state.licenses[id]) continue;
        var stock = 0;
        for (var i = 0; i < fixtures.length; i++) if (fixtures[i].product === id) stock += fixtures[i].stock || 0;
        button('order-' + id, 24, y, view.cssW - 68, 46, PRODUCTS[id].name + ' · shelf ' + stock + ' · ' + R(PRODUCTS[id].cost * 8), false);
        y += 52;
        if (y > view.cssH - 80) break;
      }
    } else {
      button('hire-cashier', 24, y, view.cssW - 68, 46, staffHas('cashier', 1) ? 'Lerato is on the till' : 'Hire till help · ' + R(diff().hire), staffHas('cashier', 1));
      y += 52;
      button('hire-stocker', 24, y, view.cssW - 68, 46, staffHas('stocker', 1) ? 'Thabo stocks shelves' : 'Hire shelf help · ' + R(diff().hire), staffHas('stocker', 1));
      y += 52;
      if (state.shop2) {
        button('hire-cashier2', 24, y, view.cssW - 68, 46, staffHas('cashier2', 2) ? 'Ayesha has the takeaway' : 'Hire takeaway till · ' + R(diff().hire), staffHas('cashier2', 2));
        y += 52;
      }
      var lic = ['airtime', 'chips', 'maize'];
      for (var L = 0; L < lic.length; L++) {
        var id2 = lic[L];
        var owned = !!state.licenses[id2];
        button('lic-' + id2, 24, y, view.cssW - 68, 46, owned ? PRODUCTS[id2].name + ' licensed' : PRODUCTS[id2].name + ' licence · ' + R(PRODUCTS[id2].license), owned);
        y += 52;
      }
      button('buy2', 24, y, view.cssW - 68, 46, state.shop2 ? 'Takeaway is yours' : 'Buy takeaway · ' + R(diff().shop2), state.shop2);
    }
  }
  function staffHas(role, shopId) {
    for (var i = 0; i < staff.length; i++) if (staff[i].role === role && staff[i].shop === shopId) return true;
    return false;
  }
  function drawPrice() {
    var y0 = view.cssH * 0.42;
    ctx.fillStyle = '#f6efd8';
    ctx.fillRect(0, y0, view.cssW, view.cssH - y0);
    var p = priceTarget && priceTarget.product ? PRODUCTS[priceTarget.product] : null;
    hudText(p ? p.name + ' tag' : 'Price tag', 16, y0 + 32, '#1c2614', 20);
    hudText(R(priceValue), view.cssW / 2, y0 + 78, '#217333', 36, 'center');
    if (p) hudText('Regulars look for about ' + R(p.fair), 16, y0 + 104, '#4d5a40', 14);
    var trackX = 24, trackW = view.cssW - 48;
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(trackX, y0 + 124, trackW, 8);
    var minP = 2, maxP = p ? p.fair * 2 : 40;
    var u = clamp((priceValue - minP) / (maxP - minP), 0, 1);
    if (p) {
      var fu = clamp((p.fair - minP) / (maxP - minP), 0, 1);
      ctx.fillStyle = '#217333';
      ctx.fillRect(trackX + fu * trackW - 2, y0 + 118, 4, 20);
    }
    ctx.fillStyle = '#f0c14a';
    ctx.fillRect(trackX + u * trackW - 8, y0 + 114, 16, 28);
    hits.push({ id: 'slider', x: trackX, y: y0 + 110, w: trackW, h: 40, minP: minP, maxP: maxP });
    button('price-down', 24, y0 + 156, 70, 48, '−', false);
    button('price-up', view.cssW - 94, y0 + 156, 70, 48, '+', false);
    button('price-ok', 110, y0 + 156, view.cssW - 220, 48, 'Stick the tag', true);
    button('cancel', 24, y0 + 214, 120, 40, 'Back', false);
  }
  function drawHaggle() {
    ctx.fillStyle = 'rgba(12,18,28,0.45)';
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    var y0 = view.cssH * 0.36;
    ctx.fillStyle = '#f6efd8';
    roundRect(16, y0, view.cssW - 32, 180, 12);
    ctx.fill();
    ctx.strokeStyle = '#1c2614';
    ctx.lineWidth = 3;
    ctx.stroke();
    hudText('Tap in the green for a cheaper box', view.cssW / 2, y0 + 36, '#1c2614', 16, 'center');
    var x = 36, w = view.cssW - 72;
    ctx.fillStyle = '#1c2614';
    ctx.fillRect(x, y0 + 70, w, 16);
    ctx.fillStyle = '#217333';
    ctx.fillRect(x + w * 0.58, y0 + 70, w * 0.22, 16);
    var u = (Math.sin(haggle.t * 3.4) + 1) / 2;
    ctx.fillStyle = '#f0c14a';
    ctx.fillRect(x + u * w - 3, y0 + 64, 6, 28);
    button('haggle-tap', 36, y0 + 110, view.cssW - 72, 48, 'Tap', true);
  }
  function drawSummary() {
    ctx.fillStyle = '#f6efd8';
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    hudText(summary.bust ? 'The till stayed empty' : 'Doors shut', 16, 48, '#1c2614', 26);
    hudText('Day ' + state.day + ' · game values', 16, 74, '#4d5a40', 14);
    var rows = [
      ['Sales', summary.revenue],
      ['Tips', summary.tips],
      ['Stock bought', -summary.supply],
      ['Rent', -summary.rent],
      ['Wages', -summary.wages]
    ];
    if (summary.bail) rows.push(['Family helped', summary.bail]);
    var y = 110;
    for (var i = 0; i < rows.length; i++) {
      hudText(rows[i][0], 20, y, '#1c2614', 16);
      hudText(R(rows[i][1]), view.cssW - 20, y, rows[i][1] < 0 ? '#a33b32' : '#217333', 16, 'right');
      y += 28;
    }
    hudText('Till now ' + R(state.cash), 20, y + 10, '#1c2614', 20);
    var line = 'Served ' + summary.served + '. Walked away ' + summary.lost + '.';
    if (summary.lost > summary.served) line += ' Empty shelves or a slow till did that.';
    if (!summary.rent) line += ' First night, no rent.';
    hudText(line, 20, y + 48, '#4d5a40', 14);
    if (summary.bust) button('reset', 20, view.cssH - 90, view.cssW - 40, 52, 'Start again', true);
    else button('morning', 20, view.cssH - 90, view.cssW - 40, 52, 'Open tomorrow', true);
  }
  function drawHelp() {
    ctx.fillStyle = '#f6efd8';
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    hudText('Corner & Co', 16, 42, '#217333', 26);
    hudText('You work the floor yourself.', 16, 70, '#1c2614', 16);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#1c2614';
    ctx.textAlign = 'left';
    var lines = [
      'Stick, WASD, or tap the ground to walk.',
      'The gold button does the job in front of you.',
      'Scan what they bought, then count the change.',
      'Carry boxes from the truck onto the shelf.',
      'Write each price on the tag. Too high and they leave.',
      'Hire help when you want the till covered.',
      'Figures are game money.'
    ];
    var y = 100;
    for (var i = 0; i < lines.length; i++) { ctx.fillText(lines[i], 16, y); y += 26; }
    var ids = ['easy', 'normal', 'hard'];
    for (var d = 0; d < 3; d++) {
      button('diff-' + ids[d], 16 + d * 122, y + 10, 114, 48, DIFFS[ids[d]].name, state.difficulty === ids[d]);
    }
    hudText('Start cash ' + R(diff().cash) + (state.difficulty === 'easy' ? ' · gentle prices and a family loan once' : ''), 16, y + 84, '#4d5a40', 13);
    button('start', 16, view.cssH - 84, view.cssW - 32, 56, 'Open the shop', true);
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
    var bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  }
  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    frames++;
    if (now - fpsStamp > 1000) { fps = frames; frames = 0; fpsStamp = now; }
    if (!view.sized) measure();
    if (haggle && mode === 'haggle') haggle.t += dt;
    update(dt);
    var focusX = player.x, focusY = player.y;
    cam.x += (focusX - cam.x) * 0.18;
    cam.y += (focusY - cam.y) * 0.18;
    zoom = player.driving ? 2 : 3;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#8ecaf2';
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    if (worldBuilt) drawWorld();
    drawHud();
    requestAnimationFrame(frame);
  }

  function pointerPos(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (view.cssW / Math.max(1, r.width)),
      y: (e.clientY - r.top) * (view.cssH / Math.max(1, r.height))
    };
  }
  function onDown(e) {
    unlock();
    var p = pointerPos(e);
    ptrs[e.pointerId] = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: 0 };
    var h = hitAt(p.x, p.y);
    if (h && h.id === 'joy') {
      joy.on = true; joy.id = e.pointerId; joy.ox = h.x + h.w / 2; joy.oy = h.y + h.h / 2;
      joy.x = 0; joy.y = 0;
      return;
    }
    if (h && h.id === 'act') {
      var v = verb();
      if (v.hold) { holding = true; holdT = 0; }
      else doAction();
      return;
    }
    if (h && h.id.indexOf('tool-') === 0) {
      buildTool = h.id.slice(5);
      drag = { kind: buildTool, id: e.pointerId };
      return;
    }
    if (h) { uiPress(h, p); return; }
  }
  function onMove(e) {
    var rec = ptrs[e.pointerId];
    if (!rec) return;
    var p = pointerPos(e);
    rec.moved += Math.abs(p.x - rec.x) + Math.abs(p.y - rec.y);
    rec.x = p.x; rec.y = p.y;
    if (joy.on && joy.id === e.pointerId) {
      joy.x = clamp((p.x - joy.ox) / 36, -1, 1);
      joy.y = clamp((p.y - joy.oy) / 36, -1, 1);
      if (Math.abs(joy.x) < 0.18) joy.x = 0;
      if (Math.abs(joy.y) < 0.18) joy.y = 0;
    }
    if (drag && drag.id === e.pointerId) { drag.x = p.x; drag.y = p.y; }
    var h = hitAt(p.x, p.y);
    if (h && h.id === 'slider' && (ptrs[e.pointerId].slider || true) && mode === 'price') {
      var u = clamp((p.x - h.x) / h.w, 0, 1);
      priceValue = Math.round(h.minP + u * (h.maxP - h.minP));
    }
  }
  function onUp(e) {
    var rec = ptrs[e.pointerId];
    var p = pointerPos(e);
    if (joy.id === e.pointerId) { joy.on = false; joy.x = 0; joy.y = 0; joy.id = null; }
    if (e.pointerId === joy.id) joy.on = false;
    holding = false;
    if (drag && drag.id === e.pointerId) {
      var wpt = screenToWorld(p.x, p.y);
      tryPlace(drag.kind, wpt.x / TILE | 0, wpt.y / TILE | 0);
      drag = null;
    } else if (rec && rec.moved < 12) {
      var h = hitAt(p.x, p.y);
      if (!h && mode === 'build' && buildTool) {
        var wpt2 = screenToWorld(p.x, p.y);
        tryPlace(buildTool, wpt2.x / TILE | 0, wpt2.y / TILE | 0);
      } else if (!h && !lockPanels() && state.started && !player.driving) {
        var wpt3 = screenToWorld(p.x, p.y);
        var goal = tileAt(wpt3.x, wpt3.y);
        var at = tileAt(player.x, player.y);
        player.path = pathBetween(at.x, at.y, goal.x, goal.y);
      }
    }
    delete ptrs[e.pointerId];
  }
  function lockPanels() {
    return mode === 'checkout' || mode === 'computer' || mode === 'price' || mode === 'haggle' || mode === 'help' || mode === 'summary' || !state.started;
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - view.ox) / zoom, y: (sy - view.oy) / zoom };
  }
  function uiPress(h) {
    unlock();
    if (h.id === 'pause') { state.paused = !state.paused; save(); return; }
    if (h.id === 'sound') { state.sound = !state.sound; if (state.sound) tone(660, 0.05, 0.04); save(); return; }
    if (h.id === 'music') { state.music = !state.music; save(); return; }
    if (h.id === 'build') {
      if (!state.started) return;
      mode = mode === 'build' ? null : 'build';
      if (mode === 'build') toast('Time is paused. Drag a shelf onto the floor.');
      return;
    }
    if (h.id === 'cancel') { mode = null; checkout = null; haggle = null; priceTarget = null; return; }
    if (h.id === 'start') { startGame(state.difficulty); return; }
    if (h.id.indexOf('diff-') === 0 && !state.started) { state.difficulty = h.id.slice(5); return; }
    if (h.id === 'morning') { nextMorning(); return; }
    if (h.id === 'reset') { resetGame(); return; }
    if (h.id === 'wall') { knockWall(); return; }
    if (h.id.indexOf('scan-') === 0) { scanItem(Number(h.id.slice(5))); return; }
    if (h.id.indexOf('coin-') === 0) { addCoin(Number(h.id.slice(5))); return; }
    if (h.id === 'clear-coin' && checkout) { checkout.given = 0; return; }
    if (h.id === 'tab-stock') { pcTab = 'stock'; return; }
    if (h.id === 'tab-grow') { pcTab = 'grow'; return; }
    if (h.id.indexOf('order-') === 0) { startHaggle(h.id.slice(6)); return; }
    if (h.id === 'haggle-tap') { finishHaggle(); return; }
    if (h.id === 'hire-cashier') { hire('cashier', 1); return; }
    if (h.id === 'hire-stocker') { hire('stocker', 1); return; }
    if (h.id === 'hire-cashier2') { hire('cashier2', 2); return; }
    if (h.id.indexOf('lic-') === 0) { buyLicense(h.id.slice(4)); return; }
    if (h.id === 'buy2') { buyShop2(); return; }
    if (h.id === 'price-down') { priceValue = Math.max(1, priceValue - 1); return; }
    if (h.id === 'price-up') { priceValue += 1; return; }
    if (h.id === 'price-ok') { stickPrice(); return; }
    if (h.id === 'slider') return;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); doAction(); }
    if (e.key === 'p' || e.key === 'P') state.paused = !state.paused;
    if (e.key === 'Escape') { mode = null; checkout = null; }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', function () { view.sized = false; });

  function boot() {
    bind();
    customers = [];
    boxes = [];
    trucks = [];
    messes = [];
    player.carry = null;
    player.driving = false;
    player.x = 19 * TILE + 8;
    player.y = 12 * TILE + 8;
    player.path = null;
    cam.x = player.x;
    cam.y = player.y;
    cars = [
      { x: 8 * TILE, y: 18 * TILE + 6, vx: 26, color: '#c4473a' },
      { x: 30 * TILE, y: 20 * TILE + 4, vx: -20, color: '#3a78c2' }
    ];
    ambient = [];
    for (var i = 0; i < 4; i++) ambient.push({ x: (8 + i * 8) * TILE, y: 17 * TILE + 8, dir: i % 2 ? 1 : -1, shirt: ['#3a78c2', '#c4473a', '#e0a020', '#6b4c9a'][i] });
    rebuildTiles();
    worldBuilt = true;
    prevLevel = level();
    mode = state.started ? null : 'help';
    if (state.started) spawnFirstCustomer();
  }

  state = load();
  boot();
  requestAnimationFrame(frame);

  window.Corner = {
    get state() { return state; },
    get fps() { return fps; },
    get mode() { return mode; },
    keys: keys,
    player: function () { return { x: Math.round(player.x), y: Math.round(player.y), driving: player.driving, carry: player.carry && player.carry.product }; },
    entities: function () {
      return { customers: customers.length, boxes: boxes.length, staff: staff.length, trucks: trucks.length, waiting: customers.filter(function (c) { return c.state === 'wait'; }).length };
    },
    press: function () { doAction(); },
    place: function (kind, tx, ty) { tryPlace(kind, tx, ty); },
    teleport: function (x, y) { player.x = x; player.y = y; player.path = null; cam.x = x; cam.y = y; },
    uiPress: function (id) { uiPress({ id: id }); },
    start: function (d) { startGame(d || 'easy'); },
    force: function (name) { startEvent(name); }
  };
})();
