import { createRequire } from 'module';
import assert from 'assert';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const R = require('../rates.js');
const Imp = require('../import-link.js');
const tool = require('./make-import-link.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'make-import-link.js');

function run(args, input) {
  return spawnSync(process.execPath, [cli].concat(args), {
    input: input,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { APS_JM_ORIGIN: 'https://charlaps.github.io/plumbing-sketch/jobmanager/' })
  });
}

const example = run(['--example']);
assert.equal(example.status, 0, example.stderr);
const url = example.stdout.trim();
assert.ok(url.startsWith('https://charlaps.github.io/plumbing-sketch/jobmanager/#import='));
const payload = url.split('#import=')[1];
const env = await Imp.decode(payload);
assert.equal(env.quote_id, '11111111-1111-4111-8111-111111111111');
assert.equal(env.import_id, '');
assert.equal(env.client, 'Derick');
assert.equal(env.no, 'APS-Q-DERICK');
assert.equal(env.items[0].generic, 'Replace kitchen mixer');
assert.equal(env.items[0].co, 'Yes');
assert.equal(env.not_included, Imp.NOT_INCL);
assert.ok(!Object.prototype.hasOwnProperty.call(env, 'vat'));
const t = R.totals(env);
assert.deepEqual([t.labour, t.co, t.cons, t.total, t.dep], [585, 585, 0, 1170, 936]);
assert.equal(R.money(t.total), 'R 1,170.00');
assert.equal(R.money(t.dep), 'R 936.00');

for (const flag of ['--gzip', '--deflate', '--raw']) {
  const res = run([flag, '--example']);
  assert.equal(res.status, 0, res.stderr);
  const again = await Imp.decode(res.stdout.trim().split('#import=')[1]);
  assert.equal(again.client, 'Derick');
  assert.equal(R.totals(again).total, 1170);
}

const big = {
  id: '22222222-2222-4222-8222-222222222222',
  client: 'Derick',
  description: 'x'.repeat(2000),
  items: [{ kind: 'labour', name: 'Hour', qty: 1, each: 585, co: 'No' }]
};
const auto = run(['--auto', '-'], JSON.stringify(big));
assert.equal(auto.status, 0, auto.stderr);
assert.match(auto.stderr, /^gzip /);
const bigEnv = await Imp.decode(auto.stdout.trim().split('#import=')[1]);
assert.equal(bigEnv.description.length, 2000);
assert.equal(R.totals(bigEnv).total, 585);

const missing = run(['-'], JSON.stringify({ client: 'Derick', items: [] }));
assert.notEqual(missing.status, 0);
assert.match(missing.stderr, /stable id/);

const aliased = Imp.normalize({
  id: 'tap-1',
  name: 'Derick',
  addr: '9 Test Road',
  area: 'Krugersdorp',
  desc: 'Replace the kitchen mixer.',
  items: [{ j: 'Replace kitchen mixer (standard deck)', l: 585, q: 1, co: 'Yes' }]
});
assert.equal(aliased.quote_id, '');
assert.equal(aliased.import_id, 'tap-1');
assert.equal(aliased.client, 'Derick');
assert.equal(aliased.address, '9 Test Road');
assert.equal(aliased.items[0].kind, 'labour');
assert.equal(aliased.items[0].generic, 'Replace kitchen mixer');
assert.equal(R.totals(aliased).total, 1170);

const mat = Imp.normalize({
  id: '33333333-3333-4333-8333-333333333333',
  client: 'Derick',
  totals: { total: 1 },
  vat: 15,
  items: [{ kind: 'material', name: 'COPPERMAN COPCAL ELBOW 22x90 CXC', qty: 2, cost: 100, cls: 'f' }]
});
assert.equal(mat.items[0].generic, '22mm elbow');
assert.equal(mat.items[0].each, R.sell(100, 'f', 'high'));
assert.ok(R.totals(mat).cons > 0);
assert.ok(!Object.prototype.hasOwnProperty.call(mat, 'vat'));
assert.ok(!Object.prototype.hasOwnProperty.call(mat, 'totals'));

assert.throws(() => Imp.normalize({ id: 'x', client: 'Derick', items: [] }), /no labour or materials/);
assert.equal(tool.EXAMPLE.client, 'Derick');

console.log('import link ok');
