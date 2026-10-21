/* Paid flow (Gumroad overlay + automatic opening). Only active in paytest mode (?paytest=1, kept for the tab in sessionStorage);
 * the public site stays free until launch. Flow: a random token per reading is saved in localStorage and sent to Gumroad in the
 * checkout URL (?token=). Gumroad pings the worker after the sale; the page polls /status?token= every 3 s for up to 10 minutes
 * (and resumes on page load while a checkout is pending). On {paid:true} the license is stored as lic_<slug>
 * (lic_all-readings opens every reading). Restore without typing: the reading URL with ?key=<license from the receipt>
 * is verified with Gumroad (product, then bundle) and opens silently.
 * Gumroad's gumroad.js is NOT loaded: its current version leaves direct-checkout links (wanted=true) as plain links
 * (no overlay) and appends its own logo span to every gumroad.com link. Our own gold button opens checkout in a new tab;
 * polling keeps running and checks again the moment the reader comes back to this tab. */
(function () {
  "use strict";
  var BY = window.BY; if (!BY) return;
  var SHOP = "https://bomandyeon.gumroad.com/l/";
  var API = "https://bom-yeon-unlock.bomandyeon.workers.dev/status?token=";
  var BUNDLE = "all-readings";
  /* license verify product_id per Gumroad product (?key= restore only) */
  var PID = {
    "brutally-honest": "IBPRp0PtRUmjngswfhzl2g==", "glow-up-aura": "fA4YS5mz-Xx-3EWwb8UjlQ==", "what-kind-of-lover": "AIK3O5Z1QAMgno2ALXEIDQ==",
    "situationship": "z384UJ1a5uo0SKWoTXq0NA==", "will-your-ex-come-back": "S3HQgkOpj0zFweiQPtvYMg==", "k-pop-position": "Tu9IIvIG4r4tTupnWNEaAg==",
    "couple-reading": "uM7t1OZBZO7_86PxV1Ct8Q==", "your-2027": "zzdmRA-cpEp9eI_MD9Tqdw==", "work-style": "KV9UNaoBGBeBxlv8QwHvrw==", "all-readings": "v4LSCn29sif23xbXsHCPcA=="
  };
  var POLL_MS = 3000, POLL_MAX = 10 * 60 * 1000;

  function token(slug, fresh) {
    var k = "tok_" + slug, t = !fresh && BY.load(k);
    if (t && /^[A-Za-z0-9]{32}$/.test(t)) return t;
    var abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", a = new Uint8Array(32), s = "";
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 32; i++) s += abc.charAt(a[i] % 62);
    BY.store(k, s); return s;
  }
  function owns(slug) { return !!(BY.load("lic_" + slug) || BY.load("lic_" + BUNDLE)); }
  function anchor(price) { return (Math.round(price * 1.54) - 0.01).toFixed(2); }
  // ?code=XYZ on any page carries a Gumroad discount code into checkout (Gumroad's checkout has no code field)
  var OFFER = (function () { try { var c = new URLSearchParams(location.search).get("code"); if (c && /^[A-Za-z0-9_-]{2,40}$/.test(c)) sessionStorage.setItem("by_offer", c); return sessionStorage.getItem("by_offer") || ""; } catch (e) { return ""; } })();
  function checkoutUrl(slug) { return SHOP + slug + "?wanted=true&token=" + token(slug) + (OFFER ? "&offer_code=" + encodeURIComponent(OFFER) : ""); }
  function loadGumroad() { /* kept as a no-op for callers; see header */ }
  /* our own gold button, no Gumroad styling: checkout opens in a new tab, this tab keeps polling */
  function buyLink(slug, label, cls) {
    return '<a class="btn pay-btn ' + (cls || "") + '" href="' + BY.esc(checkoutUrl(slug)) + '" target="_blank" rel="noopener" data-pay="' + slug + '">' + label + "</a>";
  }
  function codeBox() {
    return '<details class="pay-code"' + (OFFER ? " open" : "") + '><summary>Have a code?</summary>' +
      '<form class="pay-code-form"><input name="c" autocomplete="off" spellcheck="false" placeholder="Discount code" aria-label="Discount code" value="' + BY.esc(OFFER) + '"><button class="btn btn--ghost btn--sm" type="submit">Apply</button></form>' +
      '<p class="small muted pay-code-msg"' + (OFFER ? "" : " hidden") + '>' + (OFFER ? "Code " + BY.esc(OFFER) + " goes to checkout with you." : "") + '</p></details>';
  }
  function fallback() {
    return codeBox() + '<p class="pay-help muted">Paid? Your comic opens here by itself. Nothing after a minute? Email <a href="mailto:yeon@bomandyeon.com">yeon@bomandyeon.com</a>.</p>' +
      '<details class="pay-restore"><summary>Bought on another phone or straight on Gumroad?</summary>' +
      '<form class="pay-restore-form"><input name="k" autocomplete="off" spellcheck="false" placeholder="License key from your receipt" aria-label="License key from your receipt"><button class="btn btn--ghost btn--sm" type="submit">Open</button></form></details>';
  }
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f || !f.classList || !f.classList.contains("pay-code-form")) return;
    e.preventDefault(); var c = (f.c.value || "").trim();
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(c)) { f.c.focus(); return; }
    OFFER = c; try { sessionStorage.setItem("by_offer", c); } catch (x) {}
    [].forEach.call(document.querySelectorAll("a[data-pay]"), function (el) { el.href = checkoutUrl(el.getAttribute("data-pay")); });
    var m = f.parentNode.querySelector(".pay-code-msg"); if (m) { m.textContent = "Code " + c + " goes to checkout with you."; m.hidden = false; }
    BY.track("code-applied", "Discount code applied");
  });
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f || !f.classList || !f.classList.contains("pay-restore-form")) return;
    e.preventDefault(); var v = (f.k.value || "").replace(/\s+/g, ""); if (!/^[A-Za-z0-9-]{16,80}$/.test(v)) { f.k.focus(); return; }
    var u = new URL(location.href); u.searchParams.set("key", v); location.href = u.pathname + u.search;
  });

  var polls = {}, handlers = {};
  function setPending(slug) { BY.store("pend_" + slug, { t: Date.now(), tok: token(slug) }); }
  function pendingFresh(slug) { var p = BY.load("pend_" + slug); return p && p.tok === BY.load("tok_" + slug) && Date.now() - p.t < POLL_MAX ? p : null; }
  function status(slug, msg) { [].forEach.call(document.querySelectorAll('[data-paystatus="' + slug + '"]'), function (el) { el.textContent = msg; el.hidden = !msg; }); }
  function paid(slug, key, realSlug) {
    var s = realSlug || slug;
    BY.store("lic_" + s, key || "worker"); BY.store("pend_" + slug, null); BY.store("tok_" + slug, null);
    BY.track("paid-" + s, "Paid and opened: " + s);
    status(slug, "");
    var h = handlers[slug]; if (h) h(s);
  }
  function poll(slug) {
    if (polls[slug]) return;
    var p = pendingFresh(slug); if (!p) return;
    status(slug, "Waiting for your payment to go through. This page opens your comic by itself.");
    var tok = p.tok;
    polls[slug] = setInterval(function () {
      var q = pendingFresh(slug);
      if (!q) { clearInterval(polls[slug]); polls[slug] = null; status(slug, ""); return; }
      fetch(API + encodeURIComponent(tok), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.paid) { clearInterval(polls[slug]); polls[slug] = null; paid(slug, j.license_key, j.slug); }
      }).catch(function () { /* network blip: keep polling */ });
    }, POLL_MS);
  }
  function verifyKey(slug, key) {
    var ids = slug === BUNDLE ? [BUNDLE] : [slug, BUNDLE];
    function tryOne(i) {
      if (i >= ids.length) return Promise.resolve(null);
      var body = new URLSearchParams(); body.set("product_id", PID[ids[i]]); body.set("license_key", key); body.set("increment_uses_count", "false");
      return fetch("https://api.gumroad.com/v2/licenses/verify", { method: "POST", body: body }).then(function (r) { return r.json(); }).then(function (j) {
        var pu = j && j.purchase;
        if (j && j.success && pu && !pu.refunded && !pu.chargebacked && !pu.disputed) return ids[i];
        return tryOne(i + 1);
      });
    }
    return tryOne(0);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-pay]");
    if (a) { var s = a.getAttribute("data-pay"); setPending(s); BY.track("checkout-" + s, "Checkout opened: " + s); setTimeout(function () { poll(s); }, 1500); return; }
  }, true);
  /* back on this tab after checkout: check right away instead of waiting for the next tick */
  function checkNow() {
    Object.keys(polls).forEach(function (slug) {
      var q = pendingFresh(slug); if (!polls[slug] || !q) return;
      fetch(API + encodeURIComponent(q.tok), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.paid && polls[slug]) { clearInterval(polls[slug]); polls[slug] = null; paid(slug, j.license_key, j.slug); }
      }).catch(function () {});
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) checkNow(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) checkNow(); });
  window.addEventListener("focus", checkNow);

  /* ?key=<license> restore: verify silently, store, drop the key from the address bar. Resolves true when it opened. */
  function keyParam() { try { var k = new URLSearchParams(location.search).get("key"); return k && /^[A-Za-z0-9-]{16,80}$/.test(k.trim()) ? k.trim() : ""; } catch (e) { return ""; } }
  function stripKey() {
    try { var u = new URL(location.href); u.searchParams.delete("key"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) { /* file:// */ }
  }
  function restore(slug) {
    var k = keyParam(); if (!k) return Promise.resolve(false);
    stripKey();
    return verifyKey(slug, k).then(function (hit) {
      if (!hit) return false;
      BY.store("lic_" + hit, k); BY.track("restore-" + hit, "Restored with key: " + hit); return true;
    }).catch(function () { return false; });
  }

  BY.pay = {
    on: !!BY.paytest, owns: owns, anchor: anchor, buyLink: buyLink, fallback: fallback, loadGumroad: loadGumroad, restore: restore, hasKey: function () { return !!keyParam(); },
    /* call once per page per slug: resumes a pending checkout and runs onPaid(slug) when it goes through */
    watch: function (slug, onPaid) { handlers[slug] = onPaid; poll(slug); },
    statusEl: function (slug) { return '<p class="muted small pay-status" data-paystatus="' + slug + '" role="status" aria-live="polite" hidden></p>'; },
    guarantee: "Free redo or refund within 30 days.",
    methods: "Card, Apple Pay or PayPal."
  };

  /* bundle page: one checkout button (paytest only) */
  var bp = document.getElementById("bundlePay");
  if (bp && BY.pay.on) {
    var price = +bp.getAttribute("data-price") || 29.99, top = document.getElementById("buyTop"), gift = document.querySelector(".phero .gift");
    var pr = document.querySelector(".phero .price-row strong"); if (pr) pr.innerHTML = '<s class="muted">$' + anchor(price) + "</s> $" + price;
    var paint = function () {
      if (owns(BUNDLE)) { bp.innerHTML = '<p class="small pw-promise">All Readings is yours on this browser. Pick any reading below and it opens in full.</p><a class="btn" href="#list">Pick a reading</a>'; return; }
      bp.innerHTML = buyLink(BUNDLE, "Get All Readings · $" + price) + '<p class="small pw-promise">' + BY.pay.guarantee + " " + BY.pay.methods + " Every reading has a free 2-chapter preview too.</p>" + BY.pay.statusEl(BUNDLE) + fallback();
    };
    if (top) top.hidden = true; if (gift) gift.hidden = true;
    bp.hidden = false; paint();
    restore(BUNDLE).then(function (ok) { if (ok) { paint(); BY.toast("Welcome back. Every reading is yours on this browser again."); } });
    BY.pay.watch(BUNDLE, function () { paint(); BY.toast("Thank you. Every reading is yours now. Bom says pick one, Yeon says pick two."); });
  }
})();
