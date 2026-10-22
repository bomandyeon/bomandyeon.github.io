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
  var WK = "https://bom-yeon-unlock.bomandyeon.workers.dev", API = WK + "/status?token=";
  var BUNDLE = "all-readings";
  /* license verify product_id per Gumroad product (?key= restore only) */
  var PID = {
    "brutally-honest": "IBPRp0PtRUmjngswfhzl2g==", "glow-up-aura": "fA4YS5mz-Xx-3EWwb8UjlQ==", "what-kind-of-lover": "AIK3O5Z1QAMgno2ALXEIDQ==",
    "situationship": "z384UJ1a5uo0SKWoTXq0NA==", "will-your-ex-come-back": "S3HQgkOpj0zFweiQPtvYMg==", "k-pop-position": "Tu9IIvIG4r4tTupnWNEaAg==",
    "couple-reading": "uM7t1OZBZO7_86PxV1Ct8Q==", "your-2027": "zzdmRA-cpEp9eI_MD9Tqdw==", "work-style": "KV9UNaoBGBeBxlv8QwHvrw==", "all-readings": "v4LSCn29sif23xbXsHCPcA=="
  };
  var POLL_MS = 1500, POLL_MAX = 10 * 60 * 1000;
  /* reading inputs travel with the checkout (Gumroad forwards url params in its Ping): the worker keeps them with the
     license key, so the email button / a pasted key opens the exact reading on any device. r = base64url(JSON). */
  var stateFn = null;
  function encState(o) {
    if (!o) return "";
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { return ""; }
  }
  function decState(r) {
    if (!r || !/^[A-Za-z0-9_-]{8,700}$/.test(r)) return null;
    try { var o = JSON.parse(decodeURIComponent(escape(atob(r.replace(/-/g, "+").replace(/_/g, "/"))))); return o && typeof o === "object" ? o : null; } catch (e) { return null; }
  }
  function stateParam() { var r = encState(stateFn && stateFn()); return r && r.length <= 700 ? r : ""; }

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
  /* first-touch ad tags ride along at the END of the checkout link (Gumroad keeps extra url params; ?wanted, token, r, offer_code untouched) */
  function utmParams() {
    var a = BY.attrib ? BY.attrib() : {}, s = "";
    Object.keys(a).forEach(function (k) { s += "&" + k + "=" + encodeURIComponent(a[k]); });
    return s;
  }
  function checkoutUrl(slug) { var r = stateParam(); return SHOP + slug + "?wanted=true&token=" + token(slug) + (r ? "&r=" + r : "") + (OFFER ? "&offer_code=" + encodeURIComponent(OFFER) : "") + utmParams(); }
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
  /* conversion boost 2026-10-21: code box + restore + help folded into one small line under the buy button (same forms, same handlers) */
  /* unlock fix 2026-10-21: the license-key box is always visible (one line + input + button); discount code stays folded */
  function keyForm(label) {
    return '<form class="pay-restore-form pay-key-line"><label class="pay-key-l" for="pk' + (++kfN) + '">' + (label || "Already paid? Paste the license key from Gumroad or your email:") + '</label>' +
      '<span class="pay-key-row"><input id="pk' + kfN + '" name="k" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="License key"><button class="btn btn--sm" type="submit">Open</button></span>' +
      '<span class="pay-key-err small" role="alert" hidden></span></form>';
  }
  var kfN = 0;
  function fallback() {
    return keyForm() + '<details class="pay-more"' + (OFFER ? " open" : "") + '><summary>Have a discount code?</summary>' + codeBox() + "</details>" +
      '<p class="pay-help muted small">Paid and nothing opened after a minute? Email <a href="mailto:yeon@bomandyeon.com">yeon@bomandyeon.com</a>.</p>';
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
    e.preventDefault(); var v = (f.k.value || "").replace(/\s+/g, "").toUpperCase(), er = f.querySelector(".pay-key-err");
    if (!/^[A-Za-z0-9-]{16,80}$/.test(v)) { if (er) { er.textContent = "That doesn't look like a license key. It looks like XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX."; er.hidden = false; } f.k.focus(); return; }
    var b = f.querySelector("button"); if (b) { b.disabled = true; b.textContent = "Opening…"; }
    var u = new URL(location.href); u.searchParams.set("key", v); u.searchParams.delete("from"); location.href = u.pathname + u.search;
  });

  var polls = {}, handlers = {}, giveUp = {};
  function setPending(slug) { BY.store("pend_" + slug, { t: Date.now(), tok: token(slug) }); }
  function pendingFresh(slug) { var p = BY.load("pend_" + slug); return p && p.tok === BY.load("tok_" + slug) && Date.now() - p.t < POLL_MAX ? p : null; }
  /* pending checkout: the paywall turns into an "opening" card (no price, no buy button) until Gumroad confirms */
  function paintPending(slug, on) {
    [].forEach.call(document.querySelectorAll('[data-pw~="' + slug + '"]'), function (el) { el.classList.toggle("is-pending", !!on); });
  }
  function status(slug, msg) { [].forEach.call(document.querySelectorAll('[data-paystatus="' + slug + '"]'), function (el) { el.textContent = msg; el.hidden = !msg; }); }
  function paid(slug, key, realSlug) {
    var s = realSlug || slug;
    BY.store("lic_" + s, key || "worker"); BY.store("pend_" + slug, null); BY.store("tok_" + slug, null);
    BY.track("paid-" + s, "Paid and opened: " + s);
    purchased(s, key || ("tok:" + (BY.load("tok_" + slug) || slug)), true);
    status(slug, ""); paintPending(slug, false);
    var h = handlers[slug]; if (h) h(s);
  }
  /* checkout finished after the 10-minute poll window (captcha, slow card, came back later from Gumroad's "Open my comic"):
     one quiet check of this browser's last checkout token, up to 30 days old */
  function lateCheck(slug) {
    if (owns(slug) || polls[slug]) return;
    var p = BY.load("pend_" + slug), t = BY.load("tok_" + slug);
    if (!p || !t || p.tok !== t || Date.now() - p.t > 30 * 864e5) return;
    fetch(API + encodeURIComponent(t), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.paid) paid(slug, j.license_key, j.slug);
    }).catch(function () {});
  }
  function poll(slug) {
    if (polls[slug]) return;
    var p = pendingFresh(slug); if (!p) return;
    status(slug, "Finish paying in the Gumroad tab. Your comic opens here by itself the moment it goes through.");
    paintPending(slug, true);
    var tok = p.tok;
    polls[slug] = setInterval(function () {
      var q = pendingFresh(slug);
      if (!q) { clearInterval(polls[slug]); polls[slug] = null; status(slug, ""); paintPending(slug, false); var g = giveUp[slug]; if (g) g(); return; }
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
      return fetch("https://api.gumroad.com/v2/licenses/verify", { method: "POST", body: body }).then(function (r) {
        if (r.status >= 500) throw new Error("gumroad " + r.status);
        return r.json().catch(function () { return null; });
      }).then(function (j) {
        var pu = j && j.purchase;
        if (j && j.success && pu && (pu.refunded || pu.chargebacked || pu.disputed)) { refunded = true; return tryOne(i + 1); }
        if (j && j.success && pu) return ids[i];
        return tryOne(i + 1);
      });
    }
    var refunded = false;
    /* -> slug | {refunded:true} | null (not a key for this reading); rejects when Gumroad can't be reached */
    return tryOne(0).then(function (hit) { return hit || (refunded ? { refunded: true } : null); });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-pay]");
    if (a) { var s = a.getAttribute("data-pay"); a.href = checkoutUrl(s); setPending(s); BY.track("checkout-" + s, "Checkout opened: " + s); setTimeout(function () { poll(s); }, 800); return; }
    var c = e.target.closest && e.target.closest("[data-pay-cancel]");
    if (c) { e.preventDefault(); c.getAttribute("data-pay-cancel").split(" ").forEach(function (cs) { BY.store("pend_" + cs, null); if (polls[cs]) { clearInterval(polls[cs]); polls[cs] = null; } status(cs, ""); paintPending(cs, false); }); }
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

  /* key -> {paid, slug, r} via the worker (KV: instant, carries the reading inputs); worker unreachable -> Gumroad verify from
     the browser. definitive=false only when nothing could be reached (then the caller keeps the benefit of the doubt). */
  function lookup(slug, key) {
    return fetch(WK + "/lookup?key=" + encodeURIComponent(key) + "&slug=" + encodeURIComponent(slug), { cache: "no-store" }).then(function (r) {
      if (r.status === 400) return { paid: false, definitive: true };
      if (!r.ok) throw new Error("worker " + r.status);
      return r.json().then(function (j) {
        if (j && j.paid) return { paid: true, slug: j.slug, r: j.r || null, state: decState(j.r) };
        return { paid: false, refunded: !!(j && j.refunded), definitive: true };
      });
    }).catch(function () {
      return verifyKey(slug, key).then(function (hit) {
        if (typeof hit === "string") return { paid: true, slug: hit, r: null, state: null };
        return { paid: false, refunded: !!(hit && hit.refunded), definitive: true };
      }).catch(function () { return { paid: false, definitive: false }; });
    });
  }
  /* the buyer typed the birthdays once for a key that had none: keep them so other devices open straight away */
  function attach(key) {
    var r = stateParam(); if (!r || !key) return;
    try { fetch(WK + "/attach", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: key, r: r }), keepalive: true }).catch(function () {}); } catch (e) { /* ignore */ }
  }
  /* ?key=<license> restore: verify silently, store, drop the key from the address bar. Resolves true when it opened. */
  function keyParam() { try { var k = new URLSearchParams(location.search).get("key"); return k && /^[A-Za-z0-9-]{16,80}$/.test(k.trim()) ? k.trim() : ""; } catch (e) { return ""; } }
  function stripKey() {
    try { var u = new URL(location.href); u.searchParams.delete("key"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) { /* file:// */ }
  }
  function restore(slug) {
    var k = keyParam(); if (!k) return Promise.resolve(false);
    stripKey();
    return lookup(slug, k).then(function (res) {
      if (!res.paid) { if (res.refunded) forget(k); return false; }
      BY.store("lic_" + res.slug, k); BY.track("restore-" + res.slug, "Restored with key: " + res.slug);
      purchased(res.slug, k, pendingAny(slug)); return true;
    }).catch(function () { return false; });
  }

  /* ---------- purchase measurement (2026-10-22) ----------
     First confirmed licence per key in this browser: GoatCounter evt-unlock-<slug>; when it is a fresh checkout from this
     browser (the poll saw the sale, or a key/Gumroad return while this browser's checkout is pending) also evt-purchase-<slug>,
     which consent.js turns into Meta Purchase {value, currency USD, content_name} only with Meta consent. Opening an
     old purchase from the email on another device counts as an unlock, not a second purchase. Only a short hash of the key
     is kept for the dedupe; no email, key or birthday goes into any event. */
  function khash(k) { var h = 5381, t = String(k || ""); for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); }
  function purchased(slug, key, fresh) {
    var seen = BY.load("pur") || [], h = khash(key) + ":" + slug;
    if (seen.indexOf(h) >= 0) return false;
    seen.push(h); BY.store("pur", seen.slice(-50));
    BY.track("unlock-" + slug, "Licence confirmed: " + slug);
    if (fresh) BY.track("purchase-" + slug, "Purchase: " + slug);
    return true;
  }
  function pendingAny(slug) { return !!(BY.pay && (BY.pay.pending(slug, true) || BY.pay.pending(BUNDLE, true))) || /[?&]from=gumroad\b/.test(location.search); }
  /* a key that turned out refunded/disputed stops opening anything in this browser */
  function forget(key) {
    Object.keys(PID).forEach(function (s) { if (BY.load("lic_" + s) === key) BY.store("lic_" + s, null); });
  }
  /* stored licences are re-checked at most once a day: refunded, disputed or charged back -> closed.
     Resolves "ok" | "refunded" | "unknown" (no key to check, or the checker couldn't be reached: stays open). */
  function recheck(slug) {
    var s = BY.load("lic_" + slug) ? slug : (BY.load("lic_" + BUNDLE) ? BUNDLE : ""), k = s && BY.load("lic_" + s);
    if (!k || typeof k !== "string" || !/^[A-Za-z0-9-]{16,80}$/.test(k)) return Promise.resolve("unknown");
    var ck = BY.load("lchk") || {}, h = khash(k);
    if (ck[h] && Date.now() - ck[h] < 864e5) return Promise.resolve("ok");
    return lookup(s, k).then(function (res) {
      if (res.paid) { ck[h] = Date.now(); BY.store("lchk", ck); return "ok"; }
      if (res.definitive && res.refunded) { forget(k); BY.track("refunded-closed-" + slug, "Refunded licence closed: " + slug); return "refunded"; }
      return "unknown"; // not reachable, or an odd answer: never lock a buyer out on a guess
    }).catch(function () { return "unknown"; });
  }

  BY.pay = {
    on: !!BY.paytest, recheck: recheck, purchased: purchased, forget: forget, pendingAny: pendingAny,
    refundedMsg: "This purchase was refunded, so the reading is closed.", netMsg: "Couldn't check your purchase. Try again.", owns: owns, anchor: anchor, buyLink: buyLink, fallback: fallback, keyForm: keyForm, loadGumroad: loadGumroad, restore: restore, hasKey: function () { return !!keyParam(); },
    keyParam: keyParam, stripKey: stripKey, lookup: lookup, attach: attach, decState: decState,
    setState: function (fn) { stateFn = fn; },
    /* this browser started a checkout for slug: fresh = within the 10-minute poll window, any = within 30 days */
    pending: function (slug, any) { var p = BY.load("pend_" + slug), t = BY.load("tok_" + slug); return !!(p && t && p.tok === t && Date.now() - p.t < (any ? 30 * 864e5 : POLL_MAX)); },
    store: function (slug, key) { BY.store("lic_" + slug, key); },
    /* call once per page per slug: resumes a pending checkout and runs onPaid(slug) when it goes through, onGiveUp() when the
       10-minute window ends without a payment */
    watch: function (slug, onPaid, onGiveUp) { handlers[slug] = onPaid; if (onGiveUp) giveUp[slug] = onGiveUp; poll(slug); lateCheck(slug); },
    statusEl: function (slug) { return '<p class="muted small pay-status" data-paystatus="' + slug + '" role="status" aria-live="polite" hidden></p>'; },
    /* trust line + express-consent notice (2026-10-22): a notice, never a blocking checkbox. Every claim matches /refunds/,
       /terms/ and the checkout itself (Gumroad takes card, Apple Pay, PayPal; the reading opens when the sale goes through). */
    trust: '<p class="pw-trust">Secure checkout by Gumroad · card, Apple Pay or PayPal · opens right after payment · 30-day refund</p>',
    consent: '<p class="pw-consent">By buying you ask for the reading right away. Your 30-day refund still applies. <a href="/terms/#checkout">Terms</a> · <a href="/refunds/">Refunds</a></p>',
    guarantee: "Free redo or refund within 30 days.",
    methods: "Card, Apple Pay or PayPal."
  };

  /* bundle page: one checkout button (paytest only) */
  var bp = document.getElementById("bundlePay");
  if (bp && BY.pay.on) {
    var price = +bp.getAttribute("data-price") || 29.99, top = document.getElementById("buyTop"), gift = document.querySelector(".phero .gift");
    // no strike-through anchor here: the honest comparison ("9 readings, $X if bought one by one") already sits next to the price
    var paint = function () {
      if (owns(BUNDLE)) { bp.innerHTML = '<p class="small pw-promise">All Readings is yours on this browser. Pick any reading below and it opens in full.</p><a class="btn" href="#list">Pick a reading</a>'; return; }
      bp.innerHTML = buyLink(BUNDLE, "Get All Readings · $" + price) + BY.pay.trust + BY.pay.consent + BY.pay.statusEl(BUNDLE) + fallback();
    };
    if (top) top.hidden = true; if (gift) gift.hidden = true;
    bp.hidden = false; paint();
    restore(BUNDLE).then(function (ok) { if (ok) { paint(); BY.toast("Welcome back. Every reading is yours on this browser again."); } });
    BY.pay.watch(BUNDLE, function () { paint(); BY.toast("Thank you. Every reading is yours now. Bom says pick one, Yeon says pick two."); });
  }
})();
