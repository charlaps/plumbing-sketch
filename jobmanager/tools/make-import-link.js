#!/usr/bin/env node
/* Build a Job Manager import link from a quote JSON file.
   node jobmanager/tools/make-import-link.js quote.json
   node jobmanager/tools/make-import-link.js --example
   node jobmanager/tools/make-import-link.js --gzip quote.json
   The URL is printed on its own line. */
'use strict';

var fs = require('fs');
var zlib = require('zlib');

var DEFAULT_ORIGIN = 'https://charlaps.github.io/plumbing-sketch/jobmanager/';

var EXAMPLE = {
  id: '11111111-1111-4111-8111-111111111111',
  no: 'APS-Q-DERICK',
  date: '2026-10-20',
  client: 'Derick',
  phone: '0820000000',
  email: '',
  address: '9 Test Road',
  suburb: 'Krugersdorp',
  title: 'Kitchen mixer',
  description: 'Replace the kitchen mixer.',
  items: [
    {
      kind: 'labour',
      name: 'Replace kitchen mixer (standard deck)',
      generic: 'Replace kitchen mixer',
      qty: 1,
      each: 650,
      co: 'Yes'
    }
  ]
};

function origin() {
  var base = process.env.APS_JM_ORIGIN || DEFAULT_ORIGIN;
  if (base.charAt(base.length - 1) !== '/') base += '/';
  return base;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function usage() {
  console.error([
    'Usage: node jobmanager/tools/make-import-link.js [--gzip|--deflate|--raw|--auto] [--example] [quote.json|-]',
    'Prints one URL: ' + DEFAULT_ORIGIN + '#import=<payload>',
    '--example   Derick kitchen mixer, total R 1,170.00, deposit R 936.00',
    '--gzip      gzip the JSON before encoding',
    '--deflate   zlib deflate before encoding',
    '--raw       raw deflate before encoding',
    '--auto      gzip when the plain URL is longer than 1500 characters',
    'APS_JM_ORIGIN overrides the site (default ' + DEFAULT_ORIGIN + ')'
  ].join('\n'));
}

function parseArgs(argv) {
  var mode = 'plain';
  var example = false;
  var file = '';
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--gzip') mode = 'gzip';
    else if (a === '--deflate') mode = 'deflate';
    else if (a === '--raw') mode = 'raw';
    else if (a === '--auto') mode = 'auto';
    else if (a === '--example') example = true;
    else if (a === '--help' || a === '-h') return { help: true };
    else if (a === '-') file = '-';
    else if (a.charAt(0) === '-') {
      console.error('Unknown option ' + a);
      usage();
      process.exit(1);
    } else file = a;
  }
  return { mode: mode, example: example, file: file };
}

function readJson(args) {
  if (args.example) return JSON.stringify(EXAMPLE);
  if (!args.file) {
    usage();
    process.exit(1);
  }
  if (args.file === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(args.file, 'utf8');
}

function encode(jsonText, mode) {
  var data;
  try { data = JSON.parse(jsonText); }
  catch (err) {
    console.error('Quote file is not JSON.');
    process.exit(1);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('Quote JSON must be an object.');
    process.exit(1);
  }
  var id = String(data.id || '').trim();
  if (!id) {
    console.error('Quote JSON needs a stable id. The same id updates the quote instead of adding a second job.');
    process.exit(1);
  }
  if (!String(data.client || data.name || '').trim()) console.error('Warning: no client name.');
  var hasLine = Array.isArray(data.items) && data.items.length;
  if (!hasLine && !(Number(data.mat_typed) > 0)) console.error('Warning: no line items and no mat_typed.');
  var plain = Buffer.from(JSON.stringify(data), 'utf8');
  var bytes = plain;
  var used = 'plain';
  if (mode === 'gzip') { bytes = zlib.gzipSync(plain); used = 'gzip'; }
  else if (mode === 'deflate') { bytes = zlib.deflateSync(plain); used = 'deflate'; }
  else if (mode === 'raw') { bytes = zlib.deflateRawSync(plain); used = 'deflate-raw'; }
  else if (mode === 'auto') {
    var plainUrl = origin() + '#import=' + b64url(plain);
    if (plainUrl.length > 1500) { bytes = zlib.gzipSync(plain); used = 'gzip'; }
  }
  var link = origin() + '#import=' + b64url(bytes);
  console.error(used + ' ' + plain.length + ' bytes, link ' + link.length + ' chars');
  return link;
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }
  process.stdout.write(encode(readJson(args), args.mode) + '\n');
}

if (require.main === module) main();

module.exports = { EXAMPLE: EXAMPLE, encode: encode, b64url: b64url, origin: origin };
