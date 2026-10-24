/* Cookie consent + Meta Pixel (2026-10-22). Loaded on every page right after site.js.
 * The Pixel ID comes from window.BY_CFG.pixel (build.py META_PIXEL_ID). Empty ID: no banner, nothing from Meta loads.
 * With an ID: a small banner on the first visit, two equal buttons. Meta's script loads ONLY after "Accept"; the choice is kept
 * in localStorage (by_consent) and can be changed any time from "Cookie settings" in the footer. Decline after Accept revokes
 * the pixel and deletes its first-party cookies (_fbp, _fbc). GoatCounter (cookieless) is not affected.
 * Events ride on the existing BY.track names (no second set of hooks):
 *   every page            -> PageView
 *   teaser-<slug>         -> ViewContent {content_name: slug, content_ids, content_type, value, currency}
 *   teaser-ch2-<slug>     -> TeaserView (custom) when chapter 2 of the free comic is on screen
 *   checkout-<slug>       -> InitiateCheckout {value, currency: USD, ...} + CheckoutClick (custom, same data)
 *   kit-reading-copy / kit-signup-teaser (leave sheet email saved) -> Lead {content_name: slug}
 *   purchase-<slug>       -> custom SiteUnlock {value: real price (bundle 29.99), currency: USD, content_name: slug}; pay.js fires it once
 *                            per licence key in this browser, only for a fresh checkout (see pay.js "purchase measurement")
 * ?cookiebanner=1 shows the banner for a look even with no Pixel ID (the choice is saved, nothing loads). */
(function () {
  "use strict";
  var BY = window.BY; if (!BY) return;
  var CFG = window.BY_CFG || {}, ID = /^\d{6,20}$/.test(String(CFG.pixel || "")) ? String(CFG.pixel) : "", PRICES = CFG.prices || {};
  var GA = /^G-[A-Z0-9]{4,16}$/.test(String(CFG.ga4 || "")) ? String(CFG.ga4) : "", gaLoaded = false;
  if (!ID && GA) ID = "ga-only"; /* banner still shows when only GA4 is set */
  var KEY = "consent", doc = document, loaded = false;
  var preview = false; try { preview = new URLSearchParams(location.search).get("cookiebanner") === "1"; } catch (e) { /* old browser */ }

  function choice() { var c = BY.load(KEY); return c && (c.ads === "yes" || c.ads === "no") ? c.ads : ""; }
  function granted() { return !!ID && choice() === "yes"; }

  function loadGA() {
    if (!GA || gaLoaded || choice() !== "yes") return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    var t = doc.createElement("script"); t.async = true; t.src = "https://www.googletagmanager.com/gtag/js?id=" + GA; doc.head.appendChild(t);
    window.gtag("consent", "default", { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    window.gtag("js", new Date()); window.gtag("config", GA);
  }
  function loadPixel() {
    loadGA();
    if (ID === "ga-only") return;
    if (loaded || !granted()) return;
    loaded = true;
    /* Meta's standard base code */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, doc, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("consent", "grant");
    window.fbq("init", ID);
    window.fbq("track", "PageView");
  }
  function killCookies() {
    var host = location.hostname, parts = host.split("."), doms = ["", host];
    for (var i = 1; i < parts.length - 1; i++) doms.push("." + parts.slice(i).join("."));
    var names = ["_fbp", "_fbc", "_ga"]; doc.cookie.split(";").forEach(function (c) { var n = c.split("=")[0].trim(); if (/^_ga_/.test(n)) names.push(n); });
    names.forEach(function (n) {
      doms.forEach(function (d) { doc.cookie = n + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : ""); });
    });
  }
  function setChoice(v) {
    var was = choice();
    BY.store(KEY, { ads: v, t: Date.now(), v: 1 });
    BY.track("consent-" + v, "Cookie choice: " + v);
    if (v === "yes") loadPixel();
    else if (was === "yes") {
      try { if (window.fbq) window.fbq("consent", "revoke"); } catch (e) { /* ignore */ }
      try { if (window.gtag) window.gtag("consent", "update", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }); } catch (e) { /* ignore */ }
      killCookies(); loaded = false;
    }
  }

  /* ---------- the banner ---------- */
  var box = null;
  function hide() { if (box) { box.classList.remove("is-on"); var b = box; setTimeout(function () { if (b.parentNode && !b.classList.contains("is-on")) b.parentNode.removeChild(b); }, 300); box = null; } doc.body.classList.remove("has-cc"); }
  function show(fromSettings) {
    if (box) return;
    box = doc.createElement("div");
    box.className = "cc"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Cookie choice"); box.setAttribute("aria-live", "polite");
    var now = choice();
    box.innerHTML = '<p class="cc__t">We use cookies for analytics and ads, to see what people like and which ads work. The site works the same either way. <a href="/privacy/#cookies">Privacy</a></p>' +
      (fromSettings && now ? '<p class="cc__now">Right now: ' + (now === "yes" ? "accepted" : "declined") + ".</p>" : "") +
      '<div class="cc__b"><button type="button" class="cc__btn" data-cc="no">Reject all</button><button type="button" class="cc__btn" data-cc="yes">Accept all</button></div>';
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cc]"); if (!b) return;
      setChoice(b.getAttribute("data-cc")); hide();
      if (fromSettings) BY.toast && BY.toast(b.getAttribute("data-cc") === "yes" ? "Saved. Cookies on." : "Saved. No cookies.");
    });
    doc.body.appendChild(box); doc.body.classList.add("has-cc");
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add("is-on"); }); });
  }
  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-cookie-settings]");
    if (t) { e.preventDefault(); show(true); }
  });

  /* ---------- Meta events from the existing GoatCounter event names ---------- */
  function meta(name, params, custom) {
    if (!granted() || !window.fbq || ID === "ga-only") return;
    try { window.fbq(custom ? "trackCustom" : "track", name, params || {}); } catch (e) { /* ignore */ }
  }
  function prod(slug) {
    var o = { content_name: slug, content_ids: [slug], content_type: "product", currency: "USD" };
    if (PRICES[slug] != null) o.value = +PRICES[slug];
    return o;
  }
  var track = BY.track;
  BY.track = function (name) {
    track.apply(this, arguments);
    if (!granted()) return;
    var n = String(name || ""), m;
    if ((m = /^teaser-ch2-([a-z0-9-]+)$/.exec(n))) meta("TeaserView", prod(m[1]), true);
    else if ((m = /^teaser-([a-z0-9-]+)$/.exec(n))) meta("ViewContent", prod(m[1]));
    else if ((m = /^checkout-([a-z0-9-]+)$/.exec(n))) { var p = prod(m[1]); p.num_items = 1; meta("InitiateCheckout", p); meta("CheckoutClick", p, true); }
    else if ((m = /^purchase-([a-z0-9-]+)$/.exec(n))) { var v = { content_name: m[1], currency: "USD" }; if (PRICES[m[1]] != null) v.value = +PRICES[m[1]]; meta("SiteUnlock", v, true); /* Purchase counted by Gumroad pixel (Rok 2026-10-24), avoid double count */ }
    else if (n === "kit-reading-copy" || n === "kit-signup-teaser") { var s = (window.BY_PRODUCT && window.BY_PRODUCT.slug) || ""; meta("Lead", s ? { content_name: s } : {}); }
  };
  BY.consent = { choice: choice, show: show, granted: granted, pixel: !!ID };

  if (granted()) loadPixel();
  else if ((ID || preview) && (!choice() || preview)) {
    var go = function () { show(false); };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  }
})();
