/* Branded PDF files for quotes, invoices and job cards. No external library, so it still works offline. */
(function (global) {
  'use strict';

  function pdfText(s) {
    return String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, function (ch) {
      if (ch === '\u2013' || ch === '\u2014' || ch === '\u2212') return '-';
      if (ch === '\u00a0') return ' ';
      return '';
    }).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrap(s, size, width) {
    var max = Math.max(8, Math.floor(width / (size * 0.52)));
    var words = String(s || '').split(/\s+/);
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      if (!w) return;
      var next = cur ? cur + ' ' + w : w;
      if (next.length > max && cur) { lines.push(cur); cur = w; }
      else cur = next;
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function Pdf() { this.objs = []; }
  Pdf.prototype.add = function (body) { this.objs.push(body); return this.objs.length; };
  Pdf.prototype.blob = function (rootId) {
    var enc = new TextEncoder();
    var chunks = [];
    var pos = 0;
    function add(bytes) { chunks.push(bytes); pos += bytes.length; }
    function addStr(s) { add(enc.encode(s)); }
    addStr('%PDF-1.4\n');
    var offsets = [0];
    this.objs.forEach(function (body, i) {
      offsets.push(pos);
      addStr((i + 1) + ' 0 obj\n');
      if (typeof body === 'string') addStr(body + '\nendobj\n');
      else { addStr(body.head); add(body.bytes); addStr('\nendstream\nendobj\n'); }
    });
    var xref = pos;
    addStr('xref\n0 ' + (this.objs.length + 1) + '\n0000000000 65535 f \n');
    for (var i = 1; i < offsets.length; i++) addStr(('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n');
    addStr('trailer\n<< /Size ' + (this.objs.length + 1) + ' /Root ' + rootId + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    var total = chunks.reduce(function (n, c) { return n + c.length; }, 0);
    var out = new Uint8Array(total);
    var o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return new Blob([out], { type: 'application/pdf' });
  };

  function jpegSize(bytes) {
    var i = 2;
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0xD8 || marker === 0xD9) { i += 2; continue; }
      var len = (bytes[i + 2] << 8) + bytes[i + 3];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        return { h: (bytes[i + 5] << 8) + bytes[i + 6], w: (bytes[i + 7] << 8) + bytes[i + 8] };
      }
      i += 2 + len;
    }
    return { w: 64, h: 64 };
  }

  function toJpeg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        var max = 640;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          if (!blob) { reject(new Error('logo')); return; }
          blob.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); }, reject);
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { reject(new Error('image')); };
      img.src = src;
    });
  }

  var logoP = null;
  function logo() {
    if (!logoP) logoP = toJpeg('icon-192.png').catch(function () { return null; });
    return logoP;
  }

  function Doc() {
    this.pages = [];
    this.images = [];
    this.logoName = '';
    this.fresh = true;
  }
  Doc.prototype.addImage = function (name, bytes) {
    var size = jpegSize(bytes);
    this.images.push({ name: name, bytes: bytes, w: size.w, h: size.h });
  };
  Doc.prototype.page = function () {
    var p = { ops: [], y: 800 };
    this.pages.push(p);
    this.cur = p;
    p.ops.push('0 0.290 0.678 rg 0 768 595 74 re f');
    if (this.logoName && this.pages.length === 1) p.ops.push('q 46 0 0 46 32 782 cm /' + this.logoName + ' Do Q');
    var x = this.logoName && this.pages.length === 1 ? 90 : 36;
    p.ops.push('BT /F1 15 Tf 1 1 1 rg ' + x + ' 812 Td (' + pdfText(this.title || 'APS') + ') Tj ET');
    p.ops.push('BT /F1 9 Tf 1 1 1 rg ' + x + ' 796 Td (' + pdfText('APS - Architectural Plumbing Services') + ') Tj ET');
    p.ops.push('BT /F1 8 Tf 0.86 0.91 1 rg ' + x + ' 782 Td (072 230 9222    charl@agasouthafrica.co.za    Not VAT-registered) Tj ET');
    p.y = 748;
    this.fresh = false;
    return p;
  };
  Doc.prototype.need = function (h) { if (!this.cur || this.cur.y - h < 56) this.page(); };
  Doc.prototype.text = function (str, size, color, x) {
    var lines = wrap(str, size || 11, 520);
    var self = this;
    lines.forEach(function (line) {
      self.need((size || 11) + 8);
      var y = self.cur.y - (size || 11);
      self.cur.ops.push('BT /F1 ' + (size || 11) + ' Tf ' + (color || '0.05 0.12 0.24') + ' rg ' + (x || 40) + ' ' + y + ' Td (' + pdfText(line) + ') Tj ET');
      self.cur.y = y - 5;
    });
  };
  Doc.prototype.gap = function (n) { this.cur.y -= n; };
  Doc.prototype.rule = function () {
    var y = this.cur.y;
    this.cur.ops.push('0.85 0.89 0.94 RG 0.6 w 40 ' + y + ' m 555 ' + y + ' l S');
    this.cur.y -= 8;
  };
  Doc.prototype.pair = function (label, value, strong) {
    this.need(18);
    var size = strong ? 12 : 10;
    var y = this.cur.y - size;
    var color = strong ? '0 0.290 0.678' : '0.05 0.12 0.24';
    this.cur.ops.push('BT /F1 ' + size + ' Tf ' + color + ' rg 40 ' + y + ' Td (' + pdfText(label) + ') Tj ET');
    this.cur.ops.push('BT /F1 ' + size + ' Tf ' + color + ' rg 430 ' + y + ' Td (' + pdfText(value) + ') Tj ET');
    this.cur.y = y - 8;
  };
  Doc.prototype.box = function (a, b) {
    this.need(56);
    var y = this.cur.y - 50;
    this.cur.ops.push('0.910 0.941 0.984 rg 40 ' + y + ' 515 50 re f');
    this.cur.ops.push('BT /F1 12 Tf 0 0.290 0.678 rg 52 ' + (y + 28) + ' Td (' + pdfText(a) + ') Tj ET');
    this.cur.ops.push('BT /F1 10 Tf 0.05 0.12 0.24 rg 52 ' + (y + 12) + ' Td (' + pdfText(b) + ') Tj ET');
    this.cur.y = y - 12;
  };
  Doc.prototype.footer = function (extra) {
    this.pages.forEach(function (p, i) {
      p.ops.push('BT /F1 8 Tf 0.35 0.42 0.52 rg 40 36 Td (' + pdfText(extra) + ') Tj ET');
      p.ops.push('BT /F1 8 Tf 0.35 0.42 0.52 rg 520 36 Td (' + (i + 1) + ' / ' + this.pages.length + ') Tj ET');
    }, this);
  };
  Doc.prototype.finish = function () {
    var pdf = new Pdf();
    var font = pdf.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    var xobj = '';
    this.images.forEach(function (im) {
      var id = pdf.add({
        head: '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n',
        bytes: im.bytes
      });
      xobj += '/' + im.name + ' ' + id + ' 0 R ';
    });
    var contentIds = this.pages.map(function (p) {
      var stream = p.ops.join('\n');
      return pdf.add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    });
    var pageIds = contentIds.map(function (cid) {
      return pdf.add('<< /Type /Page /Parent PAGES /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + font +
        ' 0 R >> /XObject << ' + xobj + ' >> >> /Contents ' + cid + ' 0 R >>');
    });
    var kids = pageIds.map(function (id) { return id + ' 0 R'; }).join(' ');
    var pagesId = pdf.add('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + kids + '] >>');
    this.pages.forEach(function (_, i) {
      pdf.objs[pageIds[i] - 1] = pdf.objs[pageIds[i] - 1].replace('Parent PAGES', 'Parent ' + pagesId + ' 0 R');
    });
    var root = pdf.add('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
    return pdf.blob(root);
  };

  function money(n) {
    return (global.APSRates && APSRates.money) ? APSRates.money(n) : ('R ' + Number(n || 0).toFixed(2));
  }

  function paper(doc, pub, heading) {
    doc.title = heading;
    doc.page();
    doc.text(pub.no || '', 10, '0.29 0.36 0.48');
    if (pub.date) doc.text('Date ' + pub.date + (pub.valid ? '   ' + pub.valid : ''), 10, '0.29 0.36 0.48');
    doc.gap(6);
    doc.text(pub.client || 'Client', 13, '0.05 0.12 0.24');
    if (pub.addr) doc.text(pub.addr, 10, '0.29 0.36 0.48');
    doc.gap(4);
    doc.text(pub.title || 'Plumbing work', 12);
    doc.gap(6);
    doc.text('SCOPE', 9, '0 0.290 0.678');
    (pub.scope && pub.scope.length ? pub.scope : ['Plumbing work as discussed']).forEach(function (line) {
      doc.text('- ' + line, 11);
    });
    doc.gap(8);
    if (pub.mat) doc.pair('Materials', money(pub.mat));
    if (pub.cons) doc.pair('Consumables (5% of materials)', money(pub.cons));
    doc.pair(pub.labour_label || 'Labour', money(pub.labour || 0));
    doc.rule();
    doc.pair('TOTAL', money(pub.total || 0), true);
    doc.gap(6);
    doc.box('80% deposit to book: ' + money(pub.dep || 0), 'Balance on completion: ' + money(pub.bal || 0));
    doc.gap(8);
    doc.text('APS is not VAT-registered. No VAT is charged. Bank details are not on this document.', 9, '0.29 0.36 0.48');
    if (heading === 'QUOTATION') {
      doc.gap(4);
      doc.text('NOT INCLUDED', 9, '0 0.290 0.678');
      doc.text(pub.not_included || 'Tiling, building, plaster, paint, electrical work, and any client-supplied items.', 10);
      doc.gap(4);
      doc.text('Quote valid 14 days. 80% deposit books the job and buys materials. Balance on completion.', 9, '0.29 0.36 0.48');
    } else if (heading === 'INVOICE') {
      doc.gap(4);
      doc.text('Balance is due on completion. Pay with the link if one was sent with this invoice.', 9, '0.29 0.36 0.48');
      if (pub.pay) doc.text(pub.pay, 10, '0 0.290 0.678');
    }
    doc.footer('APS - Architectural Plumbing Services  ·  072 230 9222');
    return doc.finish();
  }

  function build(pub, heading) {
    return logo().then(function (bytes) {
      var doc = new Doc();
      if (bytes) { doc.addImage('ImLogo', bytes); doc.logoName = 'ImLogo'; }
      return paper(doc, pub, heading);
    });
  }

  function cardPdf(model) {
    return Promise.all([logo(), model.signature ? toJpeg(model.signature).catch(function () { return null; }) : Promise.resolve(null)]).then(function (imgs) {
      var doc = new Doc();
      if (imgs[0]) { doc.addImage('ImLogo', imgs[0]); doc.logoName = 'ImLogo'; }
      if (imgs[1]) doc.addImage('ImSign', imgs[1]);
      doc.title = 'JOB CARD';
      doc.page();
      doc.text(model.no || '', 10, '0.29 0.36 0.48');
      doc.text(model.client || 'Client', 14);
      if (model.addr) doc.text(model.addr, 10, '0.29 0.36 0.48');
      doc.text(model.title || 'Plumbing work', 12);
      doc.gap(4);
      doc.pair('Stage', model.stage || '');
      doc.pair('When', model.when || 'Not booked');
      doc.pair('Plumber', model.plumber || '');
      doc.pair('Time on site', model.timer || '00:00:00');
      doc.gap(6);
      doc.text('SCOPE', 9, '0 0.290 0.678');
      (model.scope && model.scope.length ? model.scope : ['As discussed on site']).forEach(function (line) {
        doc.text('- ' + line, 11);
      });
      if (model.parts && model.parts.length) {
        doc.gap(6);
        doc.text('PARTS USED', 9, '0 0.290 0.678');
        model.parts.forEach(function (p) { doc.text('- ' + p.qty + ' x ' + p.name, 11); });
      }
      if (model.notes) { doc.gap(6); doc.text('NOTES', 9, '0 0.290 0.678'); doc.text(model.notes, 11); }
      if (model.signed_name || imgs[1]) {
        doc.gap(8);
        doc.text('Signed by ' + (model.signed_name || 'the client'), 11);
        if (imgs[1]) {
          doc.need(90);
          var y = doc.cur.y - 80;
          doc.cur.ops.push('q 160 0 0 70 40 ' + y + ' cm /ImSign Do Q');
          doc.cur.y = y - 8;
        }
      }
      if (model.total != null) {
        doc.gap(8);
        doc.pair('Quote total', money(model.total), true);
        doc.text('Totals only. No VAT. No bank details.', 9, '0.29 0.36 0.48');
      }
      doc.footer('Job card stays with APS. Client copy shows the work done.');
      return doc.finish();
    });
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  function share(blob, name, text) {
    var file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name, text: text || '' }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        download(blob, name);
      });
    }
    download(blob, name);
    return Promise.resolve('saved');
  }

  global.APSPdf = { build: build, card: cardPdf, download: download, share: share };
})(window);
