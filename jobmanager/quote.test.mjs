import { createRequire } from 'module';
import assert from 'assert';
const require = createRequire(import.meta.url);
const R = require('./rates.js');

const hourly = R.BYNAME['Repair / fault-finding labour (per hour)'];
assert.equal(R.RATES.book, '2026-10-27');
assert.equal(R.RATES.hourly, 650);
assert.equal(R.RATES.callout, 650);
assert.equal(R.RATES.ahHourly, 975);
assert.equal(R.RATES.ahMin, 1200);
assert.equal(R.RATES.crewDay, 4800);
assert.equal(R.RATES.crewHour, 600);
assert.equal(hourly.l, 650);
assert.equal(hourly.co, 'Yes');
assert.equal(R.BYNAME['Crew day (3-man crew)'].l, 4800);
assert.equal(R.BYNAME['Crew part-day (per hour)'].l, 600);
assert.equal(R.BYNAME['Bathroom point (strip-out, first fix and second fix)'].l, 2000);
assert.equal(R.RATES.pointParts.strip + R.RATES.pointParts.first + R.RATES.pointParts.second, 2000);
assert.equal(R.BYNAME['Geyser plumbing CoC (add-on, if not included in geyser swap)'].l, 850);
assert.equal(R.BYNAME['After-hours emergency attendance (first hour, weekdays)'].l, 975);
assert.equal(R.BYNAME['Full geyser replacement 50–100L (labour only)'].l, 2850);
assert.equal(R.BYNAME['Full geyser replacement 100–150L (labour only)'].l, 3250);
assert.equal(R.BYNAME['Tank + pump backup water system install'].l, 11000);
assert.equal(R.BYNAME['Tank + pump backup — basic install (tank, pump, single tie-in)'].l, 9000);
assert.equal(R.BYNAME['Fit wall-hung toilet with concealed cistern frame'].l, 3200);
assert.equal(R.BYNAME['Replace close-coupled toilet suite (pan + cistern)'].l, 1500);
assert.equal(R.BYNAME['Replace toilet suite + basin (existing points, new angle valves & flexis)'].l, 2850);
assert.equal(R.BYNAME['Install drop-in / vanity basin with mixer, waste & trap (new)'].l, 1950);
assert.equal(R.BYNAME['Install kitchen sink (new) with mixer & waste'].l, 1950);
assert.equal(R.BYNAME['Replace basin mixer'].l, 750);
assert.equal(R.BYNAME['Re-pipe house in PEX (per point / run)'].l, 1000);
assert.equal(R.BYNAME['Bathroom plumbing first fix (per point)'].l, 1000);
assert.equal(R.BYNAME['Each extra after-hours hour'].l, 975);
R.QUICK.forEach(function (pair) { assert.ok(R.BYNAME[pair[1]], pair[1]); });

const call = R.totals({ items: [{ kind: 'labour', qty: 1, each: 650, co: 'Yes' }], cons: true });
assert.deepEqual([call.labour, call.co, call.ah, call.total, call.dep, call.bal], [650, 650, 0, 1300, 1040, 260]);

const ahTick = R.totals({ items: [{ kind: 'labour', qty: 1, each: 650, co: 'Yes' }], ah: true, cons: true });
assert.equal(ahTick.ah, 325);
assert.equal(ahTick.co, 650);
assert.equal(ahTick.total, 1625);

const ahLine = R.totals({ items: [{ kind: 'labour', qty: 1, each: 975, co: 'Yes (after-hours)' }], cons: true });
assert.equal(ahLine.co, 1200);
assert.equal(ahLine.total, 2175);

const mat = R.totals({
  items: [
    { kind: 'labour', qty: 1, each: 650, co: 'Yes' },
    { kind: 'material', qty: 1, each: 1000, co: 'No' }
  ],
  cons: true
});
assert.equal(mat.cons, 50);
assert.equal(mat.mat, 1000);
assert.equal(mat.total, 650 + 650 + 1000 + 50);

const pricey = R.sell(1000, 'e', 'high');
assert.equal(pricey, 1250);
const onlyMat = R.totals({ items: [{ kind: 'material', qty: 1, each: pricey }], cons: true });
assert.equal(onlyMat.cons, 62.5);
assert.equal(onlyMat.co, 0);
assert.equal(onlyMat.total, 1312.5);
assert.equal(onlyMat.dep, 1050);

const off = R.totals({ items: [{ kind: 'material', qty: 2, each: 100 }], cons: false });
assert.equal(off.cons, 0);
assert.equal(off.total, 200);

const point = R.totals({ items: [{ kind: 'labour', qty: 2, each: 2000, co: 'No' }] });
assert.equal(point.co, 0);
assert.equal(point.total, 4000);
assert.equal(point.dep, 3200);

assert.equal(Object.prototype.hasOwnProperty.call(call, 'vat'), false);
assert.equal(R.labourGeneric('Replace washer / O-ring / cartridge (accessible)'), 'Replace washer / O-ring / cartridge');
const lines = R.scopeLines({ items: [{ kind: 'labour', qty: 1, name: 'Replace washer / O-ring / cartridge (accessible)' }, { kind: 'material', qty: 2, generic: '150 L geyser' }] });
assert.deepEqual(lines, ['1 × Replace washer / O-ring / cartridge', '2 × 150 L geyser']);
assert.equal(call.disc, 0);
assert.equal(call.labourAll, 1300);
const legacy = R.totals({ items: [{ kind: 'labour', qty: 1, each: 585, co: 'Yes' }], callout_lock: 550, cons: true });
assert.equal(legacy.co, 550);
assert.equal(legacy.total, 1135);
assert.equal(legacy.dep, 908);
const discounted = R.totals({ items: [{ kind: 'labour', qty: 1, each: 1000, co: 'No' }], disc: 10, cons: true });
assert.equal(discounted.disc, -100);
assert.equal(discounted.labourAll, 900);
assert.equal(discounted.total, 900);
assert.equal(discounted.dep, 720);

assert.deepEqual(R.fittingAttrs('COPPERMAN COPCAL ELBOW 22x90 CXC', 'COPPER PIPE & FITTINGS > COPPER CAPILLARY FITTINGS > COPPERMAN 22MM'), { type: 'elbow', material: 'copper', joint: 'capillary/solder', size: '22mm' });
assert.deepEqual(R.fittingAttrs('BRASSMAN COMPRESSION ELBOW 22mm CXC', 'COPPER COMPRESSION FITTINGS > BRASSMAN COMPRESSION 22MM'), { type: 'elbow', material: 'brass', joint: 'compression', size: '22mm' });
assert.deepEqual(R.fittingAttrs('MENDMASTER REPAIR COUPLING 22mm', 'COPPER PIPE & FITTINGS > COPPER FITTINGS > COPPER COMPRESSION FITTINGS > MENDMASTER 22MM'), { type: 'coupling', material: 'copper', joint: 'compression', size: '22mm' });
assert.equal(R.fittingAttrs('GALVANISED ELBOW FXF 90 DEGREE 100mm', 'GALV FIT 100').material, 'galvanised');
assert.equal(R.fittingAttrs('GALVANISED ELBOW FXF 90 DEGREE 100mm', 'GALV FIT 100').joint, 'threaded');
assert.equal(R.fittingAttrs('GALVANISED ELBOW FXF 90 DEGREE 100mm', 'GALV FIT 100').size, '100mm');
assert.equal(R.fittingAttrs('SPEEDFIT EQUAL ELBOW 22mm PEM0322W', 'PEX SPEEDFIT FITTINGS').material, 'PEX');
assert.equal(R.fittingAttrs('SPEEDFIT EQUAL ELBOW 22mm PEM0322W', 'PEX SPEEDFIT FITTINGS').joint, 'push-fit');
assert.equal(R.fittingAttrs('PVC SV BEND 50x87 PLAIN', 'PVC SV FITTINGS 50').material, 'PVC');
assert.equal(R.fittingAttrs('PVC SV BEND 50x87 PLAIN', 'PVC SV FITTINGS 50').type, 'bend');
assert.equal(R.fittingAttrs('VALSIR PEXAL MLP PIPE 16x100m PEX-AL-PEX', 'MLP VALSIR PIPE').material, 'multilayer');
assert.ok(R.sizeWords('22 x 15mm').indexOf('22mm') >= 0);
assert.ok(R.sizeWords('22 x 15mm').indexOf('15mm') >= 0);
assert.equal(R.sizeWords('150 L'), '');
assert.equal(R.genericName('KWIKOT VACUUM BREAKER RELIEF VALVE 22mm CxC'), '22mm vacuum breaker');

console.log('quote rates ok', R.CATALOGUE.length, 'labour lines');
