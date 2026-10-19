import { createRequire } from 'module';
import assert from 'assert';
const require = createRequire(import.meta.url);
const R = require('./rates.js');

const hourly = R.BYNAME['Repair / fault-finding labour (per hour)'];
assert.equal(hourly.l, 585);
assert.equal(hourly.co, 'Yes');
assert.equal(R.BYNAME['Crew day (plumber and assistant)'].l, 4320);
assert.equal(R.BYNAME['Crew part-day (per hour)'].l, 540);
assert.equal(R.BYNAME['Bathroom point (strip-out, first fix and second fix)'].l, 1800);
assert.equal(R.RATES.pointParts.strip + R.RATES.pointParts.first + R.RATES.pointParts.second, 1800);
assert.equal(R.BYNAME['Geyser plumbing CoC (add-on, if not included in geyser swap)'].l, 765);
assert.equal(R.BYNAME['After-hours emergency attendance (first hour, weekdays)'].l, 880);
R.QUICK.forEach(function (pair) { assert.ok(R.BYNAME[pair[1]], pair[1]); });

const call = R.totals({ items: [{ kind: 'labour', qty: 1, each: 585, co: 'Yes' }], cons: true });
assert.deepEqual([call.labour, call.co, call.ah, call.total, call.dep, call.bal], [585, 585, 0, 1170, 936, 234]);

const ahTick = R.totals({ items: [{ kind: 'labour', qty: 1, each: 585, co: 'Yes' }], ah: true, cons: true });
assert.equal(ahTick.ah, 292.5);
assert.equal(ahTick.co, 585);
assert.equal(ahTick.total, 1462.5);

const ahLine = R.totals({ items: [{ kind: 'labour', qty: 1, each: 880, co: 'Yes (after-hours)' }], cons: true });
assert.equal(ahLine.co, 1080);
assert.equal(ahLine.total, 1960);

const mat = R.totals({
  items: [
    { kind: 'labour', qty: 1, each: 585, co: 'Yes' },
    { kind: 'material', qty: 1, each: 1000, co: 'No' }
  ],
  cons: true
});
assert.equal(mat.cons, 50);
assert.equal(mat.mat, 1000);
assert.equal(mat.total, 585 + 585 + 1000 + 50);

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

const point = R.totals({ items: [{ kind: 'labour', qty: 2, each: 1800, co: 'No' }] });
assert.equal(point.co, 0);
assert.equal(point.total, 3600);
assert.equal(point.dep, 2880);

assert.equal(Object.prototype.hasOwnProperty.call(call, 'vat'), false);
assert.equal(R.labourGeneric('Replace washer / O-ring / cartridge (accessible)'), 'Replace washer / O-ring / cartridge');
const lines = R.scopeLines({ items: [{ kind: 'labour', qty: 1, name: 'Replace washer / O-ring / cartridge (accessible)' }, { kind: 'material', qty: 2, generic: '150 L geyser' }] });
assert.deepEqual(lines, ['1 × Replace washer / O-ring / cartridge', '2 × 150 L geyser']);
assert.equal(R.genericName('KWIKOT VACUUM BREAKER RELIEF VALVE 22mm CxC'), '22mm vacuum breaker');

console.log('quote rates ok', R.CATALOGUE.length, 'labour lines');
