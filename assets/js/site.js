/* Bom & Yeon shared behavior: nav, ambient sky, scroll reveals, buttons, birthday storage, Kit signup, webtoon panels. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var BY = window.BY = window.BY || {};
  BY.reduced = reduced;
  BY.$ = function (id) { return doc.getElementById(id); };
  BY.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  BY.paras = function (s) { return String(s || "").split(/\n\s*\n/).map(function (p) { return "<p>" + BY.esc(p.trim()) + "</p>"; }).join(""); };

  /* ---------- engine ---------- */
  if (window.SajuEngine && window.SAJU_TERMS) window.SajuEngine.setTerms(window.SAJU_TERMS);
  if (window.SajuEngine && window.BY_PAIR_MATRIX) window.SajuEngine.setPairScores(window.BY_PAIR_MATRIX);

  /* ---------- birth time zone + optional birth time ---------- */
  BY.deviceZone = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } };
  // minutes east of UTC in `zone` at local wall time y-m-d h:mi (historical DST included, via the browser's tz data)
  BY.tzOffset = function (zone, y, m, d, h, mi) {
    if (!zone || !window.Intl) return null;
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
      var off = function (ts) {
        var p = {}; f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
        var dt = new Date(0); dt.setUTCFullYear(+p.year, +p.month - 1, +p.day); dt.setUTCHours((+p.hour) % 24, +p.minute, 0, 0); var u = dt.getTime();
        return Math.round((u - ts) / 60000);
      };
      var g = new Date(0); g.setUTCFullYear(y, m - 1, d); g.setUTCHours(h, mi, 0, 0);
      var o1 = off(g.getTime()); return off(g.getTime() - o1 * 60000);
    } catch (e) { return null; }
  };
  BY.birthZone = function () { return BY.load("bzone") || BY.deviceZone(); };
  BY.zoneLabel = function (z) { return (z || "").replace(/_/g, " ").split("/").pop() || "your time zone"; };
  BY.analyze = function (b, partner, opts) {
    opts = opts || {};
    var mine = BY.load("birth"), same = mine && b && BY.iso(mine) === BY.iso(b), bt = same ? BY.load("btime") : null;
    var hour = opts.hour != null ? opts.hour : (bt && bt.h != null ? bt.h : null), minute = opts.minute != null ? opts.minute : (bt && bt.mi != null ? bt.mi : 0);
    var zone = opts.zone || BY.birthZone(); // b is always the reader's own birthday; their birthplace zone applies
    var off = BY.tzOffset(zone, b.year, b.month, b.day, hour == null ? 12 : hour, hour == null ? 0 : minute);
    var p = null;
    if (partner) { var dz = BY.deviceZone(); p = { year: partner.year, month: partner.month, day: partner.day, utcOffset: BY.tzOffset(dz, partner.year, partner.month, partner.day, 12, 0) }; }
    var R = window.SajuEngine.analyze({ year: b.year, month: b.month, day: b.day, hour: hour, minute: minute, gender: opts.flow || "female", utcOffset: off }, p);
    R.zone = zone; return R;
  };
  /* optional birth-time fields inside a form: bh (hour, "" = I don't know), bmi (minute), bz (zone, "" = this device) */
  BY.readExtras = function (form) {
    var h = form.querySelector('[name="bh"]'), mi = form.querySelector('[name="bmi"]'), z = form.querySelector('[name="bz"]');
    if (!h) return;
    BY.store("btime", h.value === "" ? null : { h: +h.value, mi: mi && mi.value !== "" ? +mi.value : 0 });
    if (z) {
      var q = form.querySelector('[name="bzq"]');
      if (q) { var hit = BY.zoneFromText(q.value); z.value = hit ? hit[1] : ""; BY.store("bzlabel", hit ? hit[0] : null); }
      BY.store("bzone", z.value || null);
    }
  };
  /* birthplace picker: a text field with a datalist of every country (regions for multi-zone countries) and big cities,
     window.BY_ZONES = [[label, IANA zone]] from js/zones.js. The hidden name="bz" keeps the zone. Empty = where I am now. */
  BY.zoneFromText = function (t) {
    var Z = window.BY_ZONES || [], s = String(t || "").trim().toLowerCase(), i;
    if (!s || /^where i am now/.test(s)) return null;
    for (i = 0; i < Z.length; i++) if (Z[i][0].toLowerCase() === s) return Z[i];
    for (i = 0; i < Z.length; i++) if (Z[i][1].toLowerCase().replace(/_/g, " ") === s.replace(/_/g, " ")) return [Z[i][1].replace(/_/g, " "), Z[i][1]];
    for (i = 0; i < Z.length; i++) if (Z[i][0].toLowerCase().indexOf(s) === 0) return Z[i];
    for (i = 0; i < Z.length; i++) if (Z[i][0].toLowerCase().indexOf(s) >= 0) return Z[i];
    return null;
  };
  BY.wireZone = function (form) {
    var q = form.querySelector('[name="bzq"]'), z = form.querySelector('[name="bz"]'); if (!q || !z || q.getAttribute("data-wired")) return;
    q.setAttribute("data-wired", "1");
    var dl = document.getElementById(q.getAttribute("list")), hint = form.querySelector("[data-bzhint]");
    if (dl && !dl.options.length && window.BY_ZONES) {
      var dz = BY.deviceZone(), h = ['<option value="Where I am now (' + BY.esc(BY.zoneLabel(dz)) + ')"></option>'];
      window.BY_ZONES.forEach(function (x) { h.push('<option value="' + BY.esc(x[0]) + '"></option>'); });
      dl.innerHTML = h.join("");
    }
    function sync(final) {
      var hit = BY.zoneFromText(q.value), empty = !q.value.trim() || /^where i am now/i.test(q.value.trim());
      z.value = hit ? hit[1] : "";
      if (hint) hint.textContent = empty ? "" : hit ? "Time zone: " + hit[1].replace(/_/g, " ") : (final ? "We couldn't find that place. Pick a country or region from the list, or leave it empty for where you are now." : "");
    }
    q.addEventListener("input", function () { sync(false); });
    q.addEventListener("change", function () { sync(true); });
    q.addEventListener("blur", function () { sync(true); });
  };
  BY.fillExtras = function (form) {
    var h = form.querySelector('[name="bh"]'); if (!h) return;
    var mi = form.querySelector('[name="bmi"]'), z = form.querySelector('[name="bz"]'), bt = BY.load("btime"), bz = BY.load("bzone");
    if (h.options.length < 3) {
      var o = []; for (var i = 0; i < 24; i++) o.push('<option value="' + i + '">' + ("0" + i).slice(-2) + ":00 to " + ("0" + i).slice(-2) + ":59</option>");
      h.insertAdjacentHTML("beforeend", o.join(""));
    }
    if (mi && mi.options.length < 3) { var q = []; for (var k = 5; k < 60; k += 5) q.push('<option value="' + k + '">:' + ("0" + k).slice(-2) + "</option>"); mi.insertAdjacentHTML("beforeend", q.join("")); }
    if (z && z.tagName === "SELECT") { var dz = BY.deviceZone(), first = z.querySelector('option[value=""]'); if (first) first.textContent = "Where I am now (" + BY.zoneLabel(dz) + ")"; z.value = bz || ""; }
    else if (z) {
      var q = form.querySelector('[name="bzq"]'); BY.wireZone(form); z.value = bz || "";
      if (q) {
        q.placeholder = "Where I am now (" + BY.zoneLabel(BY.deviceZone()) + ")";
        var lab = BY.load("bzlabel"), Z = window.BY_ZONES || [], m = null;
        if (bz) { Z.forEach(function (x) { if (!m && x[0] === lab && x[1] === bz) m = x; }); Z.forEach(function (x) { if (!m && x[1] === bz) m = x; }); }
        q.value = m ? m[0] : (bz ? bz.replace(/_/g, " ") : "");
      }
    }
    if (bt) { h.value = bt.h; if (mi) mi.value = Math.round((bt.mi || 0) / 5) * 5 % 60; }
    if (bt || bz) { var det = form.querySelector("details.extras"); if (det) det.open = true; }
  };

  /* ---------- birthdays ---------- */
  BY.MAX_YEAR = 2008; // 18+ (site terms)
  BY.validDate = function (y, m, d) {
    if (!y || !m || !d) return false;
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  };
  BY.fillSelects = function (scope) {
    [].forEach.call((scope || doc).querySelectorAll("select[data-kind]"), function (sel) {
      if (sel.options.length > 1) return;
      var kind = sel.getAttribute("data-kind"), out = [], i;
      if (kind === "m") for (i = 1; i <= 12; i++) out.push('<option value="' + i + '">' + MONTHS[i - 1] + "</option>");
      if (kind === "d") for (i = 1; i <= 31; i++) out.push('<option value="' + i + '">' + i + "</option>");
      if (kind === "y") for (i = BY.MAX_YEAR; i >= 1925; i--) out.push('<option value="' + i + '">' + i + "</option>");
      sel.insertAdjacentHTML("beforeend", out.join(""));
      if (kind === "y" && sel.name === "by" && !sel.value) sel.value = "2000"; // most visitors are born around 2000: the wheel opens there
    });
  };
  BY.readDate = function (form, prefix) {
    var g = function (k) { var el = form.querySelector('[name="' + prefix + k + '"]'); return el ? +el.value : 0; };
    var m = g("m"), d = g("d"), y = g("y");
    if (!m || !d || !y) return { error: "Pick the month, day and year." };
    if (!BY.validDate(y, m, d)) return { error: "That date doesn't exist. Check the day." };
    return { year: y, month: m, day: d };
  };
  BY.setDate = function (form, prefix, b) {
    if (!b) return;
    ["m", "d", "y"].forEach(function (k) { var el = form.querySelector('[name="' + prefix + k + '"]'); if (el) el.value = { m: b.month, d: b.day, y: b.year }[k]; });
  };
  BY.store = function (key, val) { try { if (val == null) localStorage.removeItem("by_" + key); else localStorage.setItem("by_" + key, JSON.stringify(val)); } catch (e) { /* private mode */ } };
  BY.load = function (key) { try { return JSON.parse(localStorage.getItem("by_" + key) || "null"); } catch (e) { return null; } };
  BY.iso = function (b) { return b ? b.year + "-" + ("0" + b.month).slice(-2) + "-" + ("0" + b.day).slice(-2) : ""; };
  BY.fromIso = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return null; var b = { year: +m[1], month: +m[2], day: +m[3] }; return BY.validDate(b.year, b.month, b.day) ? b : null; };

  BY.prettyDate = function (b) { return b ? MONTHS[b.month - 1] + " " + b.day + ", " + b.year : ""; };
  /* paid-flow test mode: ?paytest=1 turns it on for this tab (sessionStorage), ?paytest=0 turns it off.
     Normal visitors never see it: the public site stays free. */
  BY.paytest = (function () {
    try {
      var v = new URLSearchParams(location.search).get("paytest");
      if (v === "1") sessionStorage.setItem("by_paytest", "1");
      if (v === "0") sessionStorage.removeItem("by_paytest");
      return true; // paid launch 2026-10-21: paid flow for everyone (?paytest kept harmless)
    } catch (e) { return true; }
  })();
  /* birthday entered once: a form with .bknown + .bfield shows "Reading for <date> · change" instead of the date selects */
  BY.knownBirth = function (form, onChange) {
    var known = form.querySelector(".bknown"), field = form.querySelector(".bfield"), b = BY.load("birth");
    if (!known || !field) return false;
    BY.setDate(form, "b", b);
    if (!b) { known.hidden = true; field.hidden = false; return false; }
    known.querySelector("[data-bdate]").textContent = BY.prettyDate(b);
    known.hidden = false; field.hidden = true;
    var ch = known.querySelector("[data-bchange]");
    if (ch && !ch.getAttribute("data-wired")) {
      ch.setAttribute("data-wired", "1");
      ch.addEventListener("click", function () { known.hidden = true; field.hidden = false; var s = field.querySelector("select"); if (s) s.focus(); if (onChange) onChange(); });
    }
    return true;
  };

  /* ---------- attribution: ?src (TikTok bio, landing pages) and ?vs (compare links) ride into Kit's source field ---------- */
  (function () {
    try {
      var q = new URLSearchParams(location.search), src = (q.get("src") || "").toLowerCase(), vs = (q.get("vs") || "").toLowerCase();
      if (/^[a-z0-9_-]{1,40}$/.test(src)) BY.store("src", src);
      if (/^(gap-wood|eul-wood|byeong-fire|jeong-fire|mu-earth|gi-earth|gyeong-metal|sin-metal|im-water|gye-water)$/.test(vs)) BY.store("vs", vs);
    } catch (e) { /* old browser */ }
  })();
  /* ---------- GoatCounter events (cookieless). Event names only: never a birthday, a name or an answer. Skips localhost. ---------- */
  var GC_LOCAL = /^(localhost|127\.|0\.0\.0\.0$|\[::1\]$)|\.local$/.test(location.hostname) || location.protocol === "file:";
  var gcQueue = [], gcTries = 0, gcTimer = null;
  function gcFlush() {
    var gc = window.goatcounter;
    if (gc && typeof gc.count === "function") {
      clearInterval(gcTimer); gcTimer = null;
      while (gcQueue.length) { try { gc.count(gcQueue.shift()); } catch (e) { /* ignore */ } }
    } else if (++gcTries > 40) { clearInterval(gcTimer); gcTimer = null; gcQueue = []; } // script blocked: drop quietly
  }
  BY.track = function (name, title) {
    if (GC_LOCAL) return;
    var n = String(name || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!n) return;
    gcQueue.push({ path: "evt-" + n, title: title || n, event: true });
    gcFlush();
    if (gcQueue.length && !gcTimer) gcTimer = setInterval(gcFlush, 500);
  };
  BY.trackOnce = function (name, title) {
    try { var k = "by_gc_" + name; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch (e) { /* private mode: send anyway */ }
    BY.track(name, title);
  };
  /* GoatCounter counts pageviews on the canonical URL (no query string, so birthdays in reading URLs never leave the browser).
     ?src survives as one event per session instead. */
  (function () { var src = ""; try { src = (new URLSearchParams(location.search).get("src") || "").toLowerCase(); } catch (e) { return; }
    if (/^[a-z0-9_-]{1,40}$/.test(src)) BY.trackOnce("src-" + src, "Arrived with ?src=" + src); })();
  BY.sourceTag = function (base) {
    var src = BY.load("src"), vs = BY.load("vs");
    return (base || "daily_soul") + (src ? ";src=" + src : "") + (vs ? ";vs=" + vs : "");
  };

  /* ---------- Kit: Daily Soul (form 10071361) + "send my reading" (form 10077528) ----------
     Two forms on purpose: Daily Soul subscribers confirm by email (double opt-in) and get the daily broadcast; the reading-copy
     form has no confirmation email and its subscribers never get the Daily Soul (the daily broadcasts only go to the Kit tag
     "daily-soul", which the Daily Soul worker gives to confirmed Daily Soul form subscribers). */
  var KIT_FORMS = { daily: 10071361, reading: 10077528 };
  BY.EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // resolves {ok:true} | {ok:true, check:url} (Kit's bot guard wants one click) | {ok:false}. Never opens a popup.
  BY.kitPost = function (formId, email, fields) {
    var b = BY.load("birth"), dm = "";
    try { if (b && window.SajuEngine) dm = window.BY_DATA.SOULS[BY.analyze(b).dayMaster].name; } catch (e) { dm = ""; }
    var params = new URLSearchParams();
    params.append("email_address", email);
    params.append("fields[day_master]", dm);
    params.append("fields[birth_date]", BY.iso(b));
    Object.keys(fields || {}).forEach(function (k) { if (fields[k] != null) params.append("fields[" + k + "]", String(fields[k]).slice(0, 500)); });
    return fetch("https://app.kit.com/forms/" + formId + "/subscriptions", { method: "POST", headers: { Accept: "application/json" }, body: params })
      .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        var j = x.j || {};
        if (j.status === "success") return { ok: true };
        if (j.status === "quarantined" && j.url && /^https:\/\/app\.kit\.com\//.test(j.url)) return { ok: true, check: j.url };
        return { ok: false };
      }).catch(function () { return { ok: false }; });
  };
  BY.subscribe = function (email, source) { return BY.kitPost(KIT_FORMS.daily, email, { source: BY.sourceTag(source) }); };
  /* teaser email step: source "teaser-<slug>;product=<slug>;daily=yes|no" (+ ;src= ;vs=), plus product and the reading link.
     Daily Soul box ticked -> the Daily Soul form (its own confirm email); not ticked -> the reading-copy form only. */
  BY.captureReading = function (email, slug, daily, url, via) {
    var src = BY.sourceTag("teaser-" + slug) + ";product=" + slug + ";daily=" + (daily ? "yes" : "no") + (via ? ";via=" + via : "");
    return BY.kitPost(daily ? KIT_FORMS.daily : KIT_FORMS.reading, email, { source: src, product: slug, reading_url: url || "" });
  };
  BY.MIN_AGE = 18; // site terms (18+); this also covers the GDPR Art. 8 under-16 limit
  BY.ageOn = function (b, now) {
    now = now || new Date();
    var age = now.getFullYear() - b.year, m = now.getMonth() + 1;
    if (m < b.month || (m === b.month && now.getDate() < b.day)) age--;
    return age;
  };
  function wireDaily() {
    [].forEach.call(doc.querySelectorAll("form[data-daily]"), function (f) {
      var box = f.querySelector(".daily-bday");
      // no saved birthday: ask for it here (Day Master for the email + age check)
      if (box && !BY.load("birth")) { BY.fillSelects(box); box.hidden = false; }
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var inp = f.querySelector('input[type="email"]'), err = f.querySelector(".err"), v = inp.value.trim();
        if (!BY.EMAIL_RE.test(v)) { err.textContent = "Please enter a valid email."; inp.focus(); return; }
        var b = BY.load("birth");
        if (box && !box.hidden) {
          var r = BY.readDate(f, "ds");
          if (r.error) { err.textContent = r.error; return; }
          b = r;
        }
        if (!b) { err.textContent = "Pick your birthday first, so the email is about you."; return; }
        if (BY.ageOn(b) < BY.MIN_AGE) { err.textContent = "Sorry, the Daily Soul is only for readers 18 and over."; return; }
        if (box && !box.hidden) BY.store("birth", b);
        err.textContent = "";
        var btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Sending…";
        BY.subscribe(v, f.getAttribute("data-daily") || "daily_soul").then(function (res) {
          if (res.ok) BY.track(res.check ? "kit-signup-check" : "kit-signup", res.check ? "Daily Soul signup (Kit check step)" : "Daily Soul signup");
          if (res.ok && !res.check) { f.innerHTML = '<p class="ok" role="status">Almost done. Check your inbox and tap the confirm link from Kit. No confirm, no Daily Soul.</p>'; return; }
          if (res.ok && res.check) {
            // Kit's bot guard: a normal link the reader taps (a user gesture), never window.open after the fetch
            f.innerHTML = '<p class="ok" role="status">Almost there. Our email provider wants one quick check that you\'re a person.</p><p><a class="btn btn--ghost" href="' + BY.esc(res.check) + '" target="_blank" rel="noopener">Do the quick check</a></p>';
            return;
          }
          btn.disabled = false; btn.textContent = "Try again";
          err.textContent = "That didn't go through, so you're not signed up yet. Check your connection and try again.";
        });
      });
    });
  }

  /* ---------- toast + share ---------- */
  BY.toast = function (msg) {
    var t = doc.querySelector(".toast");
    if (!t) { t = doc.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); doc.body.appendChild(t); }
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("is-on"); }, 2200);
  };
  BY.share = function (title, text, url) {
    url = url || location.href;
    if (navigator.share) { navigator.share({ title: title, text: text, url: url }).catch(function () {}); return; }
    var s = text + " " + url;
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { BY.toast("Copied. Paste it anywhere."); });
    else BY.toast(s);
  };

  /* ---------- webtoon panels ---------- */
  BY.panel = function (art, bubbles, alt) {
    var fig = doc.createElement("figure");
    fig.className = "panel rise";
    fig.innerHTML = '<img src="/assets/img/panel-' + art + '.webp" alt="' + BY.esc(alt || "Comic panel") + '" loading="lazy" decoding="async" width="720" height="' + (BY.PANEL_H[art] || 1290) + '">' +
      '<div class="bubbles">' + bubbles.map(function (b) {
        var cls = "bubble" + (b.who ? "" : " bubble--nar") + (b.who === "Yeon" ? " bubble--r" : "");
        return '<p class="' + cls + '">' + (b.who ? "<b>" + b.who + "</b>" : "") + BY.esc(b.text) + "</p>";
      }).join("") + "</div>" +
      '<figcaption class="sr">' + BY.esc(bubbles.map(function (b) { return (b.who ? b.who + ": " : "") + b.text; }).join(" ")) + "</figcaption>";
    return fig;
  };
  BY.PANEL_H = { 1: 1290, 2: 1290, 3: 1290, 4: 1290, 5: 1290, 6: 1290, 7: 1290, 8: 736, 9: 749, 10: 1290, 11: 1005, 12: 1096 };

  /* ---------- scroll reveal ---------- */
  var io = ("IntersectionObserver" in window && !reduced) ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }) : null;
  BY.watch = function (scope) {
    [].forEach.call((scope || doc).querySelectorAll(".rise:not(.is-in)"), function (el, i) {
      if (el.classList.contains("panel") && !el.classList.contains("from-l") && !el.classList.contains("from-r")) el.classList.add(i % 2 ? "from-r" : "from-l");
      if (io) io.observe(el); else el.classList.add("is-in");
    });
  };

  /* ---------- buttons: ripple ---------- */
  doc.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(".btn");
    if (!b || reduced) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = doc.createElement("span");
    sp.className = "ripple"; sp.style.width = sp.style.height = s + "px";
    sp.style.left = (e.clientX - r.left - s / 2) + "px"; sp.style.top = (e.clientY - r.top - s / 2) + "px";
    b.appendChild(sp); setTimeout(function () { sp.remove(); }, 650);
  });

  /* ---------- menu ---------- */
  function wireMenu() {
    var btn = doc.querySelector(".menu-btn"); if (!btn) return;
    btn.addEventListener("click", function () {
      var on = !root.classList.contains("menu-open");
      root.classList.toggle("menu-open", on); btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  /* ---------- gumiho page transition ---------- */
  function wireFox() {
    if (reduced) return;
    var fox = doc.createElement("img");
    fox.src = "/assets/img/fox.webp"; fox.alt = ""; fox.className = "fox-run"; fox.setAttribute("aria-hidden", "true");
    doc.body.appendChild(fox);
    doc.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) !== "/" || href.indexOf("#") >= 0 && href.split("#")[0] === location.pathname) return;
      if (a.hasAttribute("download")) return;
      e.preventDefault();
      fox.classList.remove("go"); void fox.offsetWidth; fox.classList.add("go");
      setTimeout(function () { location.href = href; }, 300);
    });
    window.addEventListener("pageshow", function () { fox.classList.remove("go"); });
  }

  /* ---------- ambient sky: plum petals + fireflies (light canvas) ---------- */
  function sky() {
    if (reduced) return;
    var cv = doc.getElementById("sky"); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d"), W, H, dpr = Math.min(window.devicePixelRatio || 1, 2), items = [], running = true;
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener("resize", size, { passive: true });
    var nPetals = W < 600 ? 10 : 18, nFlies = W < 600 ? 8 : 14, i;
    function petal(top) { return { k: "p", x: Math.random() * W, y: top ? -20 : Math.random() * H, r: 4 + Math.random() * 5, vx: -.2 + Math.random() * .5, vy: .35 + Math.random() * .55, a: Math.random() * 6.28, va: -.02 + Math.random() * .04, sw: Math.random() * 6.28 }; }
    for (i = 0; i < nPetals; i++) items.push(petal(false));
    for (i = 0; i < nFlies; i++) items.push({ k: "f", x: Math.random() * W, y: H * .3 + Math.random() * H * .7, t: Math.random() * 6.28, s: .4 + Math.random() * .6 });
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      items.forEach(function (p, idx) {
        if (p.k === "p") {
          p.sw += .015; p.x += p.vx + Math.sin(p.sw) * .35; p.y += p.vy; p.a += p.va;
          if (p.y > H + 20) items[idx] = petal(true);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
          ctx.fillStyle = "rgba(244,183,196,.55)"; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .6, 0, 0, 6.28); ctx.fill();
          ctx.fillStyle = "rgba(255,226,232,.35)"; ctx.beginPath(); ctx.ellipse(-p.r * .25, -p.r * .1, p.r * .45, p.r * .25, 0, 0, 6.28); ctx.fill();
          ctx.restore();
        } else {
          p.t += .012 * p.s; p.x += Math.cos(p.t * 1.3) * .25; p.y += Math.sin(p.t) * .2;
          var al = .25 + .55 * Math.abs(Math.sin(p.t * 2));
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7);
          g.addColorStop(0, "rgba(255,226,140," + al + ")"); g.addColorStop(1, "rgba(255,226,140,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.28); ctx.fill();
        }
      });
      requestAnimationFrame(draw);
    }
    doc.addEventListener("visibilitychange", function () { var was = running; running = !doc.hidden; if (running && !was) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  function start() {
    BY.fillSelects();
    wireMenu(); wireDaily(); wireFox(); sky(); BY.watch();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
