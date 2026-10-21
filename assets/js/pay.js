/* Paid flow (Gumroad overlay + automatic opening). Only active in paytest mode (?paytest=1, kept for the tab in sessionStorage);
 * the public site stays free until launch. Flow: a random token per reading is saved in localStorage and sent to Gumroad in the
 * checkout URL (?token=). Gumroad pings the worker after the sale; the page polls /status?token= every 3 s for up to 10 minutes
 * (and resumes on page load while a checkout is pending). On {paid:true} the license is stored as lic_<slug>
 * (lic_all-readings opens every reading). A license key typed by hand is a small hidden fallback. */
(function () {
  "use strict";
  var BY = window.BY; if (!BY) return;
  var SHOP = "https://rok8678.gumroad.com/l/";
  var API = "https://bom-yeon-unlock.bomandyeon.workers.dev/status?token=";
  var BUNDLE = "all-readings";
  /* license verify product_id per Gumroad product (fallback key entry only) */
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
  function checkoutUrl(slug) { return SHOP + slug + "?wanted=true&token=" + token(slug); }
  var gumLoaded = false;
  function loadGumroad() {
    if (gumLoaded) return; gumLoaded = true;
    var s = document.createElement("script"); s.src = "https://gumroad.com/js/gumroad.js"; s.async = true; document.head.appendChild(s);
  }
  /* the buy link: Gumroad's overlay picks it up (class + data attribute); if the overlay script is blocked it opens Gumroad in a new tab */
  function buyLink(slug, label, cls) {
    return '<a class="btn gumroad-button ' + (cls || "") + '" href="' + BY.esc(checkoutUrl(slug)) + '" data-gumroad-overlay-checkout="true" data-gumroad-single-product="true" target="_blank" rel="noopener" data-pay="' + slug + '">' + label + "</a>";
  }
  function fallback(slug) {
    return '<p class="pay-fallback small"><button type="button" class="linkbtn small" data-payhelp="' + slug + '">Paid but nothing opened?</button></p>' +
      '<form class="pay-key form-stack" data-paykey="' + slug + '" hidden novalidate><p class="muted small">Paste the license key from your Gumroad receipt email.</p>' +
      '<input class="input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX">' +
      '<p class="err" role="alert"></p><button class="btn btn--ghost btn--sm" type="submit">Open my reading</button></form>';
  }

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
    status(slug, "Waiting for Gumroad to say yes. This page opens your reading by itself.");
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
    var h = e.target.closest && e.target.closest("[data-payhelp]");
    if (h) { var f = document.querySelector('[data-paykey="' + h.getAttribute("data-payhelp") + '"]'); if (f) { f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); } }
  }, true);
  document.addEventListener("submit", function (e) {
    var f = e.target.closest && e.target.closest("[data-paykey]"); if (!f) return;
    e.preventDefault();
    var slug = f.getAttribute("data-paykey"), inp = f.querySelector("input"), err = f.querySelector(".err"), btn = f.querySelector("button"), k = inp.value.trim();
    if (!/^[A-Za-z0-9-]{16,}$/.test(k)) { err.textContent = "That doesn't look like a license key. It's four blocks of letters and numbers."; return; }
    err.textContent = ""; btn.disabled = true; btn.textContent = "Checking…";
    verifyKey(slug, k).then(function (hit) {
      btn.disabled = false; btn.textContent = "Open my reading";
      if (hit) paid(slug, k, hit); else err.textContent = "That key doesn't match this reading. Check you copied all of it, or write to yeon@bomandyeon.com.";
    }).catch(function () { btn.disabled = false; btn.textContent = "Open my reading"; err.textContent = "We couldn't reach Gumroad. Check your connection and try again."; });
  });

  BY.pay = {
    on: !!BY.paytest, owns: owns, anchor: anchor, buyLink: buyLink, fallback: fallback, loadGumroad: loadGumroad,
    /* call once per page per slug: resumes a pending checkout and runs onPaid(slug) when it goes through */
    watch: function (slug, onPaid) { handlers[slug] = onPaid; poll(slug); },
    statusEl: function (slug) { return '<p class="muted small pay-status" data-paystatus="' + slug + '" role="status" aria-live="polite" hidden></p>'; },
    guarantee: "Free redo or refund within 14 days."
  };

  /* bundle page: one checkout button (paytest only) */
  var bp = document.getElementById("bundlePay");
  if (bp && BY.pay.on) {
    var price = +bp.getAttribute("data-price") || 29.99, top = document.getElementById("buyTop"), gift = document.querySelector(".phero .gift");
    var pr = document.querySelector(".phero .price-row strong"); if (pr) pr.innerHTML = '<s class="muted">$' + anchor(price) + "</s> $" + price;
    var paint = function () {
      if (owns(BUNDLE)) { bp.innerHTML = '<p class="small pw-promise">All Readings is yours on this browser. Pick any reading below and it opens in full.</p><a class="btn" href="#list">Pick a reading</a>'; return; }
      bp.innerHTML = buyLink(BUNDLE, "Get All Readings · $" + price) + '<p class="small pw-promise">' + BY.pay.guarantee + " Every reading has a free 2-chapter preview too.</p>" + BY.pay.statusEl(BUNDLE) + fallback(BUNDLE);
    };
    if (top) top.hidden = true; if (gift) gift.hidden = true;
    bp.hidden = false; paint(); loadGumroad();
    BY.pay.watch(BUNDLE, function () { paint(); BY.toast("Thank you. Every reading is yours now. Bom says pick one, Yeon says pick two."); });
  }
})();
