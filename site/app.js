/* APS website – minimal JS: mobile menu, WhatsApp enquiry form, review mode. No tracking, no cookies. */
(function () {
  "use strict";
  var WA = "27722309222";

  // Mobile menu
  var btn = document.getElementById("menuBtn");
  var nav = document.getElementById("nav");
  if (btn && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  // Year
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // WhatsApp enquiry form: builds a message and opens WhatsApp. Nothing is sent to or stored by this site.
  var form = document.getElementById("waForm");
  var msg = document.getElementById("formMsg");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements, ok = true;
      ["name", "suburb"].forEach(function (k) {
        var bad = !f[k].value.trim();
        f[k].classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) { msg.textContent = "Please add your name and suburb."; return; }
      msg.textContent = "";
      var text = "Hi APS, my name is " + f.name.value.trim() +
        ".\nSuburb: " + f.suburb.value.trim() +
        "\nI need: " + f.service.value +
        (f.details.value.trim() ? "\nDetails: " + f.details.value.trim() : "");
      var waUrl = "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
      // Mobile (incl. Facebook/Instagram in-app browsers) blocks popups, so open WhatsApp in the same tab there.
      var mobile = window.matchMedia && window.matchMedia("(max-width:959px)").matches;
      if (mobile) { location.href = waUrl; }
      else { window.open(waUrl, "_blank", "noopener"); }
    });
  }

  // Review mode (?review=1): shows every [[MARKETING]] / [[LEADS]] / [[CHARL]] note on the page.
  if (/[?&]review=1\b/.test(location.search)) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    var notes = [], n;
    while ((n = walker.nextNode())) if (/\[\[(MARKETING|LEADS|CHARL)\]\]/.test(n.nodeValue)) notes.push(n);
    notes.forEach(function (c) {
      var d = document.createElement("span");
      d.className = "review-flag";
      d.textContent = "✎ " + c.nodeValue.trim();
      c.parentNode.insertBefore(d, c.nextSibling);
    });
  }
})();
