/* APS Slips — folders of receipt photos, stored on this phone. */
(function () {
  "use strict";
  var dbp = null;
  var urls = {};

  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open("aps-slips", 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
        if (!db.objectStoreNames.contains("slips")) {
          var store = db.createObjectStore("slips", { keyPath: "id" });
          store.createIndex("folder", "folderId");
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }
  function tx(store, mode) {
    return openDb().then(function (db) { return db.transaction(store, mode).objectStore(store); });
  }
  function reqToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  function all(store) {
    return tx(store, "readonly").then(function (s) { return reqToPromise(s.getAll()); });
  }
  function get(store, id) {
    return tx(store, "readonly").then(function (s) { return reqToPromise(s.get(id)); });
  }
  function put(store, row) {
    return tx(store, "readwrite").then(function (s) { return reqToPromise(s.put(row)); });
  }
  function del(store, id) {
    return tx(store, "readwrite").then(function (s) { return reqToPromise(s.delete(id)); });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    return "R " + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }
  function toast(m) {
    var t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#12263a;color:#fff;padding:12px 16px;border-radius:14px;z-index:80;font-weight:700;max-width:88%";
      document.body.appendChild(t);
    }
    t.textContent = m;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.remove(); }, 1600);
  }
  function blobUrl(slip) {
    if (!slip || !slip.blob) return "";
    if (urls[slip.id]) return urls[slip.id];
    urls[slip.id] = URL.createObjectURL(slip.blob);
    return urls[slip.id];
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);
    if (parts[0] === "f" && parts[1]) return { name: "folder", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "s" && parts[1]) return { name: "slip", id: decodeURIComponent(parts[1]) };
    return { name: "home" };
  }
  function go(hash) { location.hash = hash; }

  function compress(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) reject(new Error("Could not save that photo"));
          else resolve(blob);
        }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read that photo")); };
      img.src = url;
    });
  }

  function addPhotos(folderId, files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return Promise.resolve(0);
    var chain = Promise.resolve(0);
    list.forEach(function (file, index) {
      chain = chain.then(function (n) {
        return compress(file).then(function (blob) {
          return put("slips", {
            id: uid(),
            folderId: folderId,
            created: new Date(Date.now() + index).toISOString(),
            blob: blob,
            amount: "",
            supplier: "",
            note: ""
          }).then(function () { return n + 1; });
        });
      });
    });
    return chain;
  }

  function slipsIn(folderId) {
    return all("slips").then(function (rows) {
      return rows.filter(function (s) { return s.folderId === folderId; })
        .sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
    });
  }

  function renderHome(q) {
    return Promise.all([all("folders"), all("slips")]).then(function (pair) {
      var folders = pair[0].sort(function (a, b) { return a.name.localeCompare(b.name); });
      var slips = pair[1];
      var query = (q || "").trim().toLowerCase();
      if (query) folders = folders.filter(function (f) { return f.name.toLowerCase().indexOf(query) >= 0; });
      var html = '<input class="search" id="q" placeholder="Search folders" value="' + esc(q || "") + '">'
        + '<button class="big" type="button" id="newFolder">+ New folder</button>';
      if (!folders.length) html += '<div class="empty">' + (query ? "No folders match." : "No folders yet. Add one for a client or a job.") + "</div>";
      folders.forEach(function (f) {
        var mine = slips.filter(function (s) { return s.folderId === f.id; });
        var total = 0, any = false;
        mine.forEach(function (s) { if (s.amount !== "" && s.amount != null && !isNaN(Number(s.amount))) { any = true; total += Number(s.amount); } });
        html += '<button class="folder" type="button" data-folder="' + esc(f.id) + '"><span class="grow"><b>' + esc(f.name) + "</b><span>"
          + mine.length + (mine.length === 1 ? " slip" : " slips")
          + (any ? " · " + money(total) : "") + "</span></span></button>";
      });
      html += '<p class="note">Photos stay on this phone. Use Backup if you change phones.</p>'
        + '<div class="actions" style="margin-top:12px"><button type="button" id="backup">Backup</button><button type="button" id="restoreBtn">Restore</button></div>'
        + '<input id="restore" type="file" accept="application/json,.json" class="hidden">';
      document.getElementById("title").textContent = "Slips";
      document.getElementById("back").classList.add("hidden");
      document.getElementById("app").innerHTML = html;
      var box = document.getElementById("q");
      box.addEventListener("input", function (e) { renderHome(e.target.value); });
      if (q) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      document.getElementById("newFolder").onclick = function () { askName("New folder", "", function (name) { createFolder(name); }); };
      document.getElementById("backup").onclick = exportBackup;
      document.getElementById("restoreBtn").onclick = function () { document.getElementById("restore").click(); };
      document.getElementById("restore").onchange = function (e) { importBackup(e.target.files && e.target.files[0]); e.target.value = ""; };
      document.querySelectorAll("[data-folder]").forEach(function (b) {
        b.onclick = function () { go("#/f/" + encodeURIComponent(b.dataset.folder)); };
      });
    });
  }

  function createFolder(name) {
    var row = { id: uid(), name: name, created: new Date().toISOString() };
    return put("folders", row).then(function () { go("#/f/" + encodeURIComponent(row.id)); });
  }

  function renderFolder(id) {
    return Promise.all([get("folders", id), slipsIn(id)]).then(function (pair) {
      var folder = pair[0], slips = pair[1];
      if (!folder) { go("#/"); return; }
      document.getElementById("title").textContent = folder.name;
      document.getElementById("back").classList.remove("hidden");
      var html = '<button class="big" type="button" id="take">Take photo</button>'
        + '<input id="cam" class="hidden" type="file" accept="image/*" capture="environment">'
        + '<button class="big light" type="button" id="pick">Choose from gallery</button>'
        + '<input id="gal" class="hidden" type="file" accept="image/*" multiple>'
        + '<button class="big light" type="button" id="more">Folder options</button>';
      if (!slips.length) html += '<div class="empty">No slips in this folder yet.</div>';
      else {
        html += '<div class="grid">';
        slips.forEach(function (s) {
          html += '<button class="slip" type="button" data-slip="' + esc(s.id) + '"><img src="' + blobUrl(s) + '" alt=""><span>' + esc(when(s.created)) + (s.amount !== "" && s.amount != null ? " · " + money(s.amount) : "") + "</span></button>";
        });
        html += "</div>";
      }
      document.getElementById("app").innerHTML = html;
      document.getElementById("take").onclick = function () { document.getElementById("cam").click(); };
      document.getElementById("pick").onclick = function () { document.getElementById("gal").click(); };
      function onFiles(input) {
        input.onchange = function () {
          var files = input.files;
          addPhotos(id, files).then(function (n) {
            input.value = "";
            toast(n === 1 ? "Photo added" : n + " photos added");
            renderFolder(id);
          }).catch(function (err) { toast(err.message || "Could not add that photo"); });
        };
      }
      onFiles(document.getElementById("cam"));
      onFiles(document.getElementById("gal"));
      var shareFiles = [];
      slips.forEach(function (s) {
        if (!s.blob) return;
        shareFiles.push(jpegFile(s, shareFiles.length + 1));
      });
      document.getElementById("more").onclick = function () { folderMenu(folder, slips, shareFiles); };
      document.querySelectorAll("[data-slip]").forEach(function (b) {
        b.onclick = function () { go("#/s/" + encodeURIComponent(b.dataset.slip)); };
      });
    });
  }

  function renderSlip(id) {
    return get("slips", id).then(function (slip) {
      if (!slip) { go("#/"); return; }
      return get("folders", slip.folderId).then(function (folder) {
        document.getElementById("title").textContent = folder ? folder.name : "Slip";
        document.getElementById("back").classList.remove("hidden");
        document.getElementById("app").innerHTML = '<div class="viewer"><div class="bar"><button class="back" type="button" id="closeSlip" aria-label="Back">‹</button><span class="ver">v2</span></div>'
          + '<img src="' + blobUrl(slip) + '" alt="">'
          + '<div class="panel">'
          + '<div class="row"><label class="f">Amount (R)<input id="amt" inputmode="decimal" value="' + esc(slip.amount) + '"></label>'
          + '<label class="f">Supplier<input id="sup" value="' + esc(slip.supplier) + '" placeholder="e.g. Plumblink"></label></div>'
          + '<label class="f">Note<input id="note" value="' + esc(slip.note) + '"></label>'
          + '<div class="actions"><button type="button" id="share">Share</button><button type="button" id="move">Move</button><button type="button" class="bad" id="del">Delete</button></div>'
          + '<p class="note">' + esc(when(slip.created)) + "</p></div></div>";
        function saveFields() {
          slip.amount = document.getElementById("amt").value.trim();
          slip.supplier = document.getElementById("sup").value.trim();
          slip.note = document.getElementById("note").value.trim();
          return put("slips", slip);
        }
        ["amt", "sup", "note"].forEach(function (k) {
          document.getElementById(k).addEventListener("change", function () { saveFields(); });
        });
        document.getElementById("closeSlip").onclick = function () { go("#/f/" + encodeURIComponent(slip.folderId)); };
        var shareFile = slip.blob ? jpegFile(slip, 1) : null;
        document.getElementById("share").onclick = function () {
          slip.amount = document.getElementById("amt").value.trim();
          slip.supplier = document.getElementById("sup").value.trim();
          slip.note = document.getElementById("note").value.trim();
          shareFile = slip.blob ? jpegFile(slip, 1) : null;
          var text = [slip.supplier, slip.amount !== "" && slip.amount != null ? money(slip.amount) : "", slip.note].filter(Boolean).join(" · ");
          if (shareFile && canShareFiles([shareFile])) {
            navigator.share({ files: [shareFile], title: folder ? folder.name : "Slip", text: text }).catch(function () {});
          } else if (shareFile) {
            downloadBlob(shareFile, shareFile.name);
            toast("Saved the photo. Share it from your downloads.");
          }
          put("slips", slip);
        };
        document.getElementById("move").onclick = function () { moveSlip(slip); };
        document.getElementById("del").onclick = function () {
          confirmBox("Delete this slip?", "This removes the photo from this phone.", "Delete", function () {
            del("slips", slip.id).then(function () { go("#/f/" + encodeURIComponent(slip.folderId)); });
          });
        };
      });
    });
  }

  function jpegFile(slip, n) {
    var name = (n == null ? "" : String(n).padStart(2, "0") + "-") + fileName(slip);
    return new File([slip.blob], name, { type: "image/jpeg" });
  }
  function canShareFiles(files) {
    try {
      return !!(files.length && navigator.share && navigator.canShare && navigator.canShare({ files: files }));
    } catch (e) {
      return false;
    }
  }
  function folderLine(folder, slips) {
    var total = 0, any = false;
    slips.forEach(function (s) {
      if (s.amount !== "" && s.amount != null && !isNaN(Number(s.amount))) { any = true; total += Number(s.amount); }
    });
    var n = slips.length;
    return folder.name + " · " + n + (n === 1 ? " slip" : " slips") + (any ? " · " + money(total) : "");
  }
  function downloadFiles(files) {
    files.forEach(function (f, i) {
      if (i === 0) downloadBlob(f, f.name);
      else setTimeout(function () { downloadBlob(f, f.name); }, i * 300);
    });
    toast(files.length === 1 ? "Saved the photo. Share it from your downloads." : "Saved the photos. Share them from your downloads.");
  }

  function fileName(slip) {
    var day = String(slip.created || "").slice(0, 10) || "slip";
    var who = (slip.supplier || "slip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return day + "-" + (who || "slip") + ".jpg";
  }

  function moveSlip(slip) {
    all("folders").then(function (folders) {
      var others = folders.filter(function (f) { return f.id !== slip.folderId; });
      if (!others.length) { toast("Make another folder first"); return; }
      var html = '<div class="sheet"><div class="card"><h2>Move to</h2><div class="menu">';
      others.forEach(function (f) { html += '<button type="button" data-to="' + esc(f.id) + '">' + esc(f.name) + "</button>"; });
      html += '<button type="button" id="cancelMove">Cancel</button></div></div></div>';
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      wrap.querySelector("#cancelMove").onclick = function () { wrap.remove(); };
      wrap.querySelectorAll("[data-to]").forEach(function (b) {
        b.onclick = function () {
          slip.folderId = b.dataset.to;
          put("slips", slip).then(function () { wrap.remove(); go("#/f/" + encodeURIComponent(slip.folderId)); });
        };
      });
    });
  }

  function folderMenu(folder, slips, shareFiles) {
    var line = folderLine(folder, slips);
    var wrap = document.createElement("div");
    wrap.innerHTML = '<div class="sheet"><div class="card"><h2>' + esc(folder.name) + '</h2><div class="menu">'
      + '<button type="button" id="ren">Rename</button>'
      + '<button type="button" id="shareAll">Share all</button>'
      + '<button type="button" class="bad" id="delFolder">Delete folder</button>'
      + '<button type="button" id="cancel">Cancel</button></div></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector("#cancel").onclick = function () { wrap.remove(); };
    wrap.querySelector("#ren").onclick = function () {
      wrap.remove();
      askName("Rename folder", folder.name, function (name) {
        folder.name = name;
        put("folders", folder).then(function () { renderFolder(folder.id); });
      });
    };
    wrap.querySelector("#shareAll").onclick = function () {
      if (!shareFiles.length) { toast("No slips to share"); return; }
      var batch = shareFiles.length > 10 ? shareFiles.slice(0, 10) : shareFiles;
      if (canShareFiles(batch)) {
        var pending = navigator.share({ files: batch, title: folder.name, text: line });
        wrap.remove();
        pending.then(function () {
          if (shareFiles.length > 10) offerNext(shareFiles, 10, folder.name, line);
        }).catch(function () {});
        return;
      }
      wrap.remove();
      downloadFiles(shareFiles);
    };
    wrap.querySelector("#delFolder").onclick = function () {
      wrap.remove();
      confirmBox("Delete " + folder.name + "?", "This removes the folder and every slip in it.", "Delete", function () {
        slipsIn(folder.id).then(function (rows) {
          return Promise.all(rows.map(function (s) { return del("slips", s.id); }));
        }).then(function () { return del("folders", folder.id); }).then(function () { go("#/"); });
      });
    };
  }

  function offerNext(files, offset, title, text) {
    var left = files.length - offset;
    if (left <= 0) return;
    var n = Math.min(10, left);
    var old = document.getElementById("shareNext");
    if (old) old.remove();
    var wrap = document.createElement("div");
    wrap.id = "shareNext";
    wrap.innerHTML = '<div class="sheet"><div class="card"><h2>Share the rest</h2><p>'
      + n + " more photo" + (n === 1 ? "" : "s") + " to send.</p>"
      + '<button class="big" type="button" id="nextShare">' + (n === 10 ? "Share next 10" : "Share next " + n) + "</button>"
      + '<button class="big light" type="button" id="nextNo">Done</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector("#nextNo").onclick = function () { wrap.remove(); };
    wrap.querySelector("#nextShare").onclick = function () {
      var batch = files.slice(offset, offset + n);
      if (canShareFiles(batch)) {
        var pending = navigator.share({ files: batch, title: title, text: text });
        wrap.remove();
        pending.then(function () { offerNext(files, offset + n, title, text); }).catch(function () {});
        return;
      }
      wrap.remove();
      downloadFiles(batch);
    };
  }

  function askName(title, value, done) {
    var wrap = document.createElement("div");
    wrap.innerHTML = '<div class="sheet"><div class="card"><h2>' + esc(title) + '</h2>'
      + '<label class="f">Name<input id="nm" value="' + esc(value) + '" placeholder="e.g. House Derick"></label>'
      + '<button class="big" type="button" id="ok">Save</button>'
      + '<button class="big light" type="button" id="no">Cancel</button></div></div>';
    document.body.appendChild(wrap);
    var input = wrap.querySelector("#nm");
    input.focus();
    wrap.querySelector("#no").onclick = function () { wrap.remove(); };
    wrap.querySelector("#ok").onclick = function () {
      var name = input.value.trim();
      if (!name) { toast("Type a name"); return; }
      wrap.remove();
      done(name);
    };
  }

  function confirmBox(title, body, okLabel, done) {
    var wrap = document.createElement("div");
    wrap.innerHTML = '<div class="sheet"><div class="card"><h2>' + esc(title) + "</h2><p>" + esc(body) + "</p>"
      + '<button class="big" type="button" id="ok" style="background:#b42318">' + esc(okLabel) + "</button>"
      + '<button class="big light" type="button" id="no">Cancel</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector("#no").onclick = function () { wrap.remove(); };
    wrap.querySelector("#ok").onclick = function () { wrap.remove(); done(); };
  }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function blobToData(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function exportBackup() {
    Promise.all([all("folders"), all("slips")]).then(function (pair) {
      var slips = pair[1];
      return Promise.all(slips.map(function (s) {
        return blobToData(s.blob).then(function (data) {
          return { id: s.id, folderId: s.folderId, created: s.created, amount: s.amount, supplier: s.supplier, note: s.note, jpeg: data };
        });
      })).then(function (packed) {
        var file = { app: "aps-slips", v: 1, exported: new Date().toISOString(), folders: pair[0], slips: packed };
        downloadBlob(new Blob([JSON.stringify(file)], { type: "application/json" }), "aps-slips-backup.json");
        toast("Backup file saved");
      });
    }).catch(function () { toast("Could not make a backup"); });
  }
  function importBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { toast("That is not a slips backup"); return; }
      if (!data || data.app !== "aps-slips" || !Array.isArray(data.folders) || !Array.isArray(data.slips)) {
        toast("That is not a slips backup");
        return;
      }
      var chain = Promise.resolve();
      data.folders.forEach(function (f) {
        chain = chain.then(function () { return put("folders", { id: f.id, name: f.name, created: f.created }); });
      });
      data.slips.forEach(function (s) {
        chain = chain.then(function () {
          return fetch(s.jpeg).then(function (r) { return r.blob(); }).then(function (blob) {
            return put("slips", { id: s.id, folderId: s.folderId, created: s.created, amount: s.amount || "", supplier: s.supplier || "", note: s.note || "", blob: blob });
          });
        });
      });
      chain.then(function () { toast("Backup restored"); draw(); }).catch(function () { toast("Could not restore that file"); });
    };
    reader.readAsText(file);
  }

  function draw() {
    var r = route();
    if (r.name === "folder") return renderFolder(r.id);
    if (r.name === "slip") return renderSlip(r.id);
    return renderHome(document.getElementById("q") ? document.getElementById("q").value : "");
  }

  document.getElementById("back").onclick = function () {
    var r = route();
    if (r.name === "slip") {
      get("slips", r.id).then(function (s) { go(s ? "#/f/" + encodeURIComponent(s.folderId) : "#/"); });
      return;
    }
    go("#/");
  };
  window.addEventListener("hashchange", draw);
  draw().catch(function () {
    document.getElementById("app").textContent = "Could not open the slip store on this phone.";
  });
})();
