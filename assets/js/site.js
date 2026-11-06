/* Bom & Yeon shared behavior: nav, ambient sky, scroll reveals, buttons, birthday storage, Daily Soul + Kit signup, webtoon panels. */
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

  /* ---------- prices (2026-11-05): one number per visitor, tax already in where Gumroad adds it at checkout ----------
     Gumroad is the merchant of record and adds VAT/GST on top of the product price at checkout (gumroad.com/help/article/10,
     github.com/antiwork/gumroad docs/taxes.md). UK, EU and AU visitors see the price WITH that tax, as one number, so the page
     matches the checkout total; US/CA and everyone else see the base USD price. Country: the unlock worker's /geo
     (Cloudflare's request.cf.country), cached a week; until it answers, a guess from the time zone. Never a tax line. */
  var VAT = { GB: 20, AU: 10, AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 24, FI: 25.5, FR: 20, DE: 19, GR: 24, HU: 27, IE: 23, IT: 22,
    LV: 21, LT: 21, LU: 17, MT: 18, NL: 21, PL: 23, PT: 23, RO: 21, SK: 23, SI: 22, ES: 21, SE: 25 };
  var TZC = { London: "GB", Belfast: "GB", Jersey: "GB", Guernsey: "GB", Isle_of_Man: "GB", Dublin: "IE", Berlin: "DE", Busingen: "DE", Paris: "FR", Madrid: "ES", Rome: "IT",
    Amsterdam: "NL", Brussels: "BE", Luxembourg: "LU", Vienna: "AT", Zurich: "CH", Lisbon: "PT", Athens: "GR", Warsaw: "PL", Prague: "CZ", Bratislava: "SK",
    Budapest: "HU", Ljubljana: "SI", Zagreb: "HR", Bucharest: "RO", Sofia: "BG", Copenhagen: "DK", Stockholm: "SE", Helsinki: "FI", Mariehamn: "FI", Tallinn: "EE",
    Riga: "LV", Vilnius: "LT", Malta: "MT", Nicosia: "CY", Famagusta: "CY", Canary: "ES", Ceuta: "ES", Madeira: "PT", Azores: "PT", Auckland: "NZ", Chatham: "NZ" };
  BY.country = function () {
    var g = BY.load("geo"); if (g && g.c && g.t > Date.now() - 7 * 864e5) return g.c;
    var tz = BY.deviceZone(), m = /^(Europe|Atlantic|Africa|Asia|Pacific|Australia)\/(.+)$/.exec(tz);
    if (!m) return "";
    if (m[1] === "Australia") return "AU";
    return TZC[m[2]] || "";
  };
  BY.taxRate = function () { var r = VAT[BY.country()]; return r ? r / 100 : 0; };
  /* base USD -> what this visitor pays at checkout: "$19", "$12.99", "$22.80" */
  BY.money = function (usd, rate) {
    var c = Math.round(+usd * 100), r = rate == null ? BY.taxRate() : rate;
    if (r) c = c + Math.round(c * r);
    return "$" + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  };
  BY.moneyHTML = function (usd) { return '<span class="usd" data-usd="' + (+usd) + '">' + BY.money(usd) + "</span>"; };
  BY.paintPrices = function (scope) {
    [].forEach.call((scope || doc).querySelectorAll("[data-usd]"), function (el) { var t = BY.money(el.getAttribute("data-usd")); if (el.textContent !== t) el.textContent = t; });
  };
  function geo() {
    var g = BY.load("geo"); if (g && g.c && g.t > Date.now() - 7 * 864e5) return;
    if (!window.fetch || /^(localhost|127\.)/.test(location.hostname) && !/[?&]geo=1/.test(location.search)) return;
    var done = false, t = setTimeout(function () { done = true; }, 4000);
    fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/geo", { cache: "default" }).then(function (r) { return r.json(); }).then(function (j) {
      clearTimeout(t);
      if (!j || !/^[A-Z]{2}$/.test(j.country || "")) return;
      var before = BY.country(); BY.store("geo", { c: j.country, t: Date.now() });
      if (BY.country() !== before) { BY.paintPrices(); try { doc.dispatchEvent(new CustomEvent("by:geo")); } catch (e) { /* old browser */ } }
    }).catch(function () { clearTimeout(t); });
  }

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
  /* date input (2026-11-05): month as a word (12 chips; a visually hidden select keeps bday-month autofill), day and year typed
     as numbers. No default year. build.py date_selects() writes the same markup for the static forms. */
  var MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  BY.dateHTML = function (prefix, label, own) {
    var ac = own ? ["bday-month", "bday-day", "bday-year"] : ["off", "off", "off"];
    var chips = MSHORT.map(function (m, i) { return '<button type="button" class="mchip" data-m="' + (i + 1) + '" aria-pressed="false" aria-label="' + MONTHS[i] + '">' + m + "</button>"; }).join("");
    return '<div class="selects bdate" role="group" aria-label="' + BY.esc(label) + '" data-prefix="' + prefix + '">' +
      '<span class="field-label bdate__l">Month</span><div class="mchips">' + chips + "</div>" +
      '<label class="sr"><span>' + BY.esc(label) + ' month</span><select name="' + prefix + 'm" data-kind="m" autocomplete="' + ac[0] + '" tabindex="-1"><option value="">Month</option></select></label>' +
      '<div class="bdate__dy"><label><span class="field-label">Day</span><input class="input" name="' + prefix + 'd" data-kind="d" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="' + ac[1] + '" placeholder="DD" enterkeyhint="next"></label>' +
      '<label><span class="field-label">Year</span><input class="input" name="' + prefix + 'y" data-kind="y" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="' + ac[2] + '" placeholder="YYYY" enterkeyhint="go"></label></div></div>';
  };
  function syncChips(sel) {
    var g = sel.closest(".bdate"); if (!g) return;
    [].forEach.call(g.querySelectorAll(".mchip"), function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-m") === sel.value ? "true" : "false"); });
  }
  doc.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(".mchip"); if (!c) return;
    e.preventDefault();
    var g = c.closest(".bdate"), sel = g && g.querySelector('select[data-kind="m"]'); if (!sel) return;
    sel.value = c.getAttribute("data-m"); syncChips(sel);
    var err = g.closest("form") && g.closest("form").querySelector(".err"); if (err && /month/i.test(err.textContent)) err.textContent = "";
    var d = g.querySelector('input[data-kind="d"]'); if (d && !d.value) d.focus();
  });
  doc.addEventListener("input", function (e) {
    var t = e.target; if (!t || !t.getAttribute || !/^[dy]$/.test(t.getAttribute("data-kind") || "") || t.tagName !== "INPUT") return;
    var v = t.value.replace(/\D+/g, ""); if (v !== t.value) t.value = v;
    // a full day (2 digits, or 4-9) moves on to the year by itself
    if (t.getAttribute("data-kind") === "d" && (v.length === 2 || /^[4-9]$/.test(v))) { var g = t.closest(".bdate"), y = g && g.querySelector('input[data-kind="y"]'); if (y && !y.value) y.focus(); }
  });
  BY.fillSelects = function (scope) {
    [].forEach.call((scope || doc).querySelectorAll("select[data-kind]"), function (sel) {
      if (sel.options.length > 1) return;
      var kind = sel.getAttribute("data-kind"), out = [], i;
      if (kind === "m") for (i = 1; i <= 12; i++) out.push('<option value="' + i + '">' + MONTHS[i - 1] + "</option>");
      if (kind === "d") for (i = 1; i <= 31; i++) out.push('<option value="' + i + '">' + i + "</option>");
      if (kind === "y") for (i = BY.MAX_YEAR; i >= 1925; i--) out.push('<option value="' + i + '">' + i + "</option>");
      sel.insertAdjacentHTML("beforeend", out.join("")); // 2026-11-05: no default year (it silently gave people born in other years the wrong type)
    });
  };
  /* day list follows the chosen month and year, so 30 February can't be picked (Rok 2026-10-24) */
  BY.syncDays = function (sel) {
    var name = sel.name || "", prefix = name.slice(0, -1), root = sel.form || doc;
    var g = function (k) { return root.querySelector('select[name="' + prefix + k + '"]'); };
    var ms = g("m"), ds = g("d"), ys = g("y");
    if (!ms || !ds) return;
    var m = +ms.value, y = ys ? +ys.value : 0;
    var max = !m ? 31 : new Date(y || 2000, m, 0).getDate();
    var cur = +ds.value, have = 0;
    [].slice.call(ds.options).forEach(function (o) { var v = +o.value; if (v > max) ds.removeChild(o); else if (v) have = Math.max(have, v); });
    for (var i = have + 1; i <= max; i++) ds.insertAdjacentHTML("beforeend", '<option value="' + i + '">' + i + "</option>");
    if (cur > max) ds.value = String(max);
  };
  doc.addEventListener("change", function (e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute("data-kind");
    if (k === "m" && t.closest && t.closest(".bdate")) { syncChips(t); return; }
    if ((k === "m" || k === "y") && t.tagName === "SELECT") BY.syncDays(t);
  });
  BY.MIN_YEAR = 1925;
  BY.readDate = function (form, prefix) {
    var el = function (k) { return form.querySelector('[name="' + prefix + k + '"]'); };
    var raw = function (k) { var x = el(k); return x ? String(x.value || "").trim() : ""; };
    var focus = function (k) { var x = el(k); if (x && x.tagName === "INPUT") try { x.focus({ preventScroll: true }); } catch (e) { /* old browser */ } };
    var m = +raw("m"), ds = raw("d"), ys = raw("y"), d = +ds, y = +ys;
    if (!m && !ds && !ys) return { error: "Pick the month, then type the day and year." };
    if (!m) return { error: "Pick the month." };
    if (!ds || !(d >= 1 && d <= 31)) { focus("d"); return { error: "Type the day as a number, 1 to 31." }; }
    if (!/^\d{4}$/.test(ys)) { focus("y"); return { error: "Type the year with 4 digits, like 1996." }; }
    if (y < BY.MIN_YEAR || y > BY.MAX_YEAR) { focus("y"); return { error: y > BY.MAX_YEAR ? "The readings are for people 18 and over (born " + BY.MAX_YEAR + " or earlier)." : "Check the year: it should be " + BY.MIN_YEAR + " or later." }; }
    if (!BY.validDate(y, m, d)) { focus("d"); return { error: MONTHS[m - 1] + " doesn't have " + d + " days" + (m === 2 && d === 29 ? " in " + y : "") + ". Check the day." }; }
    return { year: y, month: m, day: d };
  };
  BY.setDate = function (form, prefix, b) {
    if (!b) return;
    ["m", "d", "y"].forEach(function (k) { var el = form.querySelector('[name="' + prefix + k + '"]'); if (el) { el.value = { m: b.month, d: b.day, y: b.year }[k]; if (k === "m") syncChips(el); } });
  };
  BY.clearDate = function (form, prefix) {
    ["m", "d", "y"].forEach(function (k) { var el = form.querySelector('[name="' + prefix + k + '"]'); if (el) { el.value = ""; if (k === "m") syncChips(el); } });
  };
  BY.store = function (key, val) { try { if (val == null) localStorage.removeItem("by_" + key); else localStorage.setItem("by_" + key, JSON.stringify(val)); } catch (e) { /* private mode */ } };
  BY.load = function (key) { try { return JSON.parse(localStorage.getItem("by_" + key) || "null"); } catch (e) { return null; } };
  BY.iso = function (b) { return b ? b.year + "-" + ("0" + b.month).slice(-2) + "-" + ("0" + b.day).slice(-2) : ""; };
  BY.fromIso = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return null; var b = { year: +m[1], month: +m[2], day: +m[3] }; return BY.validDate(b.year, b.month, b.day) ? b : null; };

  /* ---------- reading state in links (2026-10-22): no birthday or answer is ever readable in an address ----------
     ?s=<id>   random id; the inputs stay in this browser (localStorage by_st_<id>), so the address bar shows only the id.
     &x=<code> only on links that leave this browser (the "email me my chapters" link): a packed, scrambled copy of the
               inputs so the link opens on another phone. Not encryption, just not human-readable.
     Old links (?b= &t= &a=, and the purchase email's r=) still open; product.js rewrites the address to ?s= at once. */
  var ST_SEED = [66, 111, 109, 38, 89, 101, 111, 110, 45, 115, 101, 111, 117, 108, 33, 55];
  var ST_D0 = Date.UTC(1800, 0, 1);
  function stDays(b) { return b ? Math.round((Date.UTC(b.year, b.month - 1, b.day) - ST_D0) / 864e5) : -1; }
  function stDate(n) { if (!(n >= 0)) return null; var d = new Date(ST_D0 + n * 864e5); return BY.fromIso(d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2)); }
  function stXor(bytes, salt) { var out = [], k = salt; for (var i = 0; i < bytes.length; i++) { k = (k * 31 + ST_SEED[i % 16] + i) & 255; out.push(bytes[i] ^ k); } return out; }
  function stB64(bytes) { var s = ""; bytes.forEach(function (c) { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function stUnB64(t) { var s = atob(t.replace(/-/g, "+").replace(/_/g, "/")), a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i)); return a; }
  function stClean(o) {
    if (!o) return null;
    var b = o.b && o.b.year ? o.b : BY.fromIso(o.b), t = o.t && o.t.year ? o.t : BY.fromIso(o.t), a = typeof o.a === "string" && /^[a-z0-9_.-]{1,80}$/.test(o.a) ? o.a : "";
    return b ? { b: b, t: t || null, a: a } : null;
  }
  function stSig(o) { return BY.iso(o.b) + "|" + BY.iso(o.t) + "|" + o.a; }
  BY.urlState = {
    pack: function (o) {
      o = stClean(o); if (!o) return "";
      var plain = "1." + stDays(o.b).toString(36) + "." + (o.t ? stDays(o.t).toString(36) : "") + "." + o.a, bytes = [];
      for (var i = 0; i < plain.length; i++) bytes.push(plain.charCodeAt(i) & 255);
      var salt = 0; try { var r = new Uint8Array(1); (window.crypto || window.msCrypto).getRandomValues(r); salt = r[0]; } catch (e) { salt = Math.floor(Math.random() * 256); }
      return stB64([salt].concat(stXor(bytes, salt)));
    },
    unpack: function (code) {
      if (!code || !/^[A-Za-z0-9_-]{6,200}$/.test(code)) return null;
      try {
        var a = stUnB64(code), salt = a[0], bytes = stXor(a.slice(1), salt), s = "";
        bytes.forEach(function (c) { s += String.fromCharCode(c); });
        var m = /^1\.([0-9a-z]+)\.([0-9a-z]*)\.([a-z0-9_.-]*)$/.exec(s); if (!m) return null;
        return stClean({ b: stDate(parseInt(m[1], 36)), t: m[2] ? stDate(parseInt(m[2], 36)) : null, a: m[3] });
      } catch (e) { return null; }
    },
    /* the id for these inputs in this browser (same inputs, same id) */
    id: function (o) {
      o = stClean(o); if (!o) return "";
      var map = BY.load("stids") || {}, sig = stSig(o), id = map[sig];
      if (!id || !BY.load("st_" + id)) {
        var abc = "abcdefghijkmnpqrstuvwxyz23456789", r = new Uint8Array(10); id = "";
        try { (window.crypto || window.msCrypto).getRandomValues(r); } catch (e) { for (var j = 0; j < 10; j++) r[j] = Math.floor(Math.random() * 256); }
        for (var i = 0; i < 10; i++) id += abc.charAt(r[i] % abc.length);
        var keys = Object.keys(map);
        if (keys.length >= 40) keys.slice(0, keys.length - 39).forEach(function (k) { BY.store("st_" + map[k], null); delete map[k]; });
        map[sig] = id; BY.store("stids", map);
      }
      BY.store("st_" + id, { b: BY.iso(o.b), t: BY.iso(o.t), a: o.a });
      return id;
    },
    /* "?s=<id>" (+ "&x=<code>" when the link leaves this browser); "" when there is no birthday yet */
    query: function (o, portable) { var id = BY.urlState.id(o); return id ? "?s=" + id + (portable ? "&x=" + BY.urlState.pack(o) : "") : ""; },
    /* inputs from the current address: {b, t, a, via: "x" | "s" | "legacy"} or null */
    read: function () {
      var q; try { q = new URLSearchParams(location.search); } catch (e) { return null; }
      var x = BY.urlState.unpack(q.get("x")); if (x) { x.via = "x"; return x; }
      var s = q.get("s"), st = s && /^[a-z0-9]{6,20}$/.test(s) ? stClean(BY.load("st_" + s)) : null; if (st) { st.via = "s"; return st; }
      var b = BY.fromIso(q.get("b")); if (!b) return null;
      var a = q.get("a"); return { b: b, t: BY.fromIso(q.get("t")), a: a && /^[a-z0-9_.-]{1,80}$/.test(a) ? a : "", via: "legacy" };
    },
    /* rewrite the address bar: drop b, t, a, x, r; s=<id> for these inputs (other params and the hash kept) */
    clean: function (o) {
      try {
        var u = new URL(location.href), had = false;
        ["b", "t", "a", "x", "r"].forEach(function (k) { if (u.searchParams.has(k)) { had = true; u.searchParams.delete(k); } });
        var id = o ? BY.urlState.id(o) : "";
        if (id && u.searchParams.get("s") !== id) { u.searchParams.delete("s"); u.search = "?s=" + id + (u.search ? "&" + u.search.slice(1) : ""); had = true; }
        if (had) history.replaceState(history.state, "", u.pathname + u.search + u.hash);
      } catch (e) { /* file:// */ }
    }
  };

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
      ch.addEventListener("click", function () { known.hidden = true; field.hidden = false; var s = field.querySelector(".mchip, select"); if (s) s.focus(); if (onChange) onChange(); });
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
  /* ---------- first-touch attribution (Meta ads, 2026-10-22) ----------
     The first visit that carried ?src= or utm_* tags is kept in localStorage (by_ft, 90 days) and BY.attrib() hands
     utm_source/utm_medium/utm_campaign/utm_content to the Gumroad checkout link (pay.js), so a sale can be traced to its ad.
     Campaign tags only: never a birthday, a name or an answer. */
  (function () {
    try {
      var q = new URLSearchParams(location.search), o = {}, any = false;
      ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        var v = (q.get(k) || "").trim();
        if (/^[A-Za-z0-9_.+-]{1,80}$/.test(v)) { o[k] = v; any = true; }
      });
      var ft = BY.load("ft");
      if (ft && !(ft.t > Date.now() - 90 * 864e5)) { BY.store("ft", null); ft = null; }
      if (any && !ft) { o.t = Date.now(); BY.store("ft", o); }
    } catch (e) { /* old browser */ }
  })();
  BY.attrib = function () {
    var ft = BY.load("ft") || {}, r = {}, src = ft.src || BY.load("src") || "";
    if (ft.utm_source || src) r.utm_source = ft.utm_source || src;
    ["utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { if (ft[k]) r[k] = ft[k]; });
    var last = BY.load("src"); if (last && last !== r.utm_source && !r.utm_content) r.utm_content = last; /* last ?src (e.g. soul-sin-metal) when first touch was something else */
    return r;
  };
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
  /* ---------- per-ad funnel tag (2026-11-06, Rok): funnel steps are counted twice, once as before and once as
     "via-<campaign>-<step>" so GoatCounter shows which ad or channel brought the step. Campaign = this visit's
     utm_campaign (+utm_content) or ?src, else the first-touch tag. Campaign tags only, never personal data. ---------- */
  (function () {
    var tag = "";
    try {
      var q = new URLSearchParams(location.search), c = (q.get("utm_campaign") || "").trim(), u = (q.get("utm_content") || "").trim(), s = (q.get("src") || "").trim();
      var now = c ? c + (u ? "-" + u : "") : s;
      if (now && /^[A-Za-z0-9_.+-]{1,60}$/.test(now)) sessionStorage.setItem("by_via", now);
      tag = sessionStorage.getItem("by_via") || "";
      if (!tag) { var ft = BY.load("ft") || {}; tag = ft.utm_campaign ? ft.utm_campaign + (ft.utm_content ? "-" + ft.utm_content : "") : (ft.src || ""); }
    } catch (e) { /* private mode */ }
    tag = String(tag).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "none";
    var base = BY.track, FUNNEL = /^(birthday-submit|ch1-view|paywall-view|checkout-click|checkout|purchase)-/;
    BY.track = function (name, title) {
      base(name, title);
      var n = String(name || "").toLowerCase();
      if (FUNNEL.test(n)) base("via-" + tag + "-" + n, (title || n) + " via " + tag);
    };
    BY.viaTag = function () { return tag; };
  })();
  BY.trackOnce = function (name, title) {
    try { var k = "by_gc_" + name; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch (e) { /* private mode: send anyway */ }
    BY.track(name, title);
  };
  /* GoatCounter counts pageviews on the canonical URL (no query string, so birthdays in reading URLs never leave the browser).
     ?src survives as one event per session instead. */
  (function () { var src = ""; try { src = (new URLSearchParams(location.search).get("src") || "").toLowerCase(); } catch (e) { return; }
    if (/^[a-z0-9_-]{1,40}$/.test(src)) BY.trackOnce("src-" + src, "Arrived with ?src=" + src); })();
  /* Daily Soul readers (?src=daily from the mail, kept per session) already have the mail: hide the signup box, the paid block stays */
  (function () {
    try {
      var src = (new URLSearchParams(location.search).get("src") || "").toLowerCase();
      if (/^daily/.test(src)) sessionStorage.setItem("by_from_daily", "1");
      if (sessionStorage.getItem("by_from_daily")) doc.documentElement.classList.add("from-daily");
    } catch (e) { /* private mode */ }
  })();
  /* paid block on SEO pages: one GoatCounter event per click (Meta InitiateCheckout fires at the real checkout on the reading page) */
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-sell]"); if (a) BY.track("sell-" + a.getAttribute("data-sell"), "Paid block click: " + a.getAttribute("data-sell"));
  });
  BY.sourceTag = function (base) {
    var src = BY.load("src"), vs = BY.load("vs");
    return (base || "daily_soul") + (src ? ";src=" + src : "") + (vs ? ";vs=" + vs : "");
  };

  /* ---------- Daily Soul (own list, worker bom-yeon-daily-soul, since 2026-11-02) + "send my reading" (Kit form 10077528) ----------
     Daily Soul signups go to our own worker: double opt-in confirm mail, then one email every morning (sent via Resend).
     The reading-copy form stays on Kit: no confirmation email, and its subscribers never get the Daily Soul. */
  var KIT_FORMS = { reading: 10077528 };
  var DAILY_URL = "https://bom-yeon-daily-soul.bomandyeon.workers.dev/subscribe";
  BY.EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // resolves {ok:true} | {ok:true, check:url} (Kit's bot guard wants one click) | {ok:false}. Never opens a popup.
  function formParams(email, fields) {
    var b = BY.load("birth"), dm = "";
    try { if (b && window.SajuEngine) dm = window.BY_DATA.SOULS[BY.analyze(b).dayMaster].name; } catch (e) { dm = ""; }
    var params = new URLSearchParams();
    params.append("email_address", email);
    params.append("fields[day_master]", dm);
    params.append("fields[birth_date]", BY.iso(b));
    Object.keys(fields || {}).forEach(function (k) { if (fields[k] != null) params.append("fields[" + k + "]", String(fields[k]).slice(0, 500)); });
    return params;
  }
  // Kit (reading copy only). resolves {ok:true} | {ok:true, check:url} (Kit's bot guard wants one click) | {ok:false}. Never opens a popup.
  BY.kitPost = function (formId, email, fields) {
    return fetch("https://app.kit.com/forms/" + formId + "/subscriptions", { method: "POST", headers: { Accept: "application/json" }, body: formParams(email, fields) })
      .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        var j = x.j || {};
        if (j.status === "success") return { ok: true };
        if (j.status === "quarantined" && j.url && /^https:\/\/app\.kit\.com\//.test(j.url)) return { ok: true, check: j.url };
        return { ok: false };
      }).catch(function () { return { ok: false }; });
  };
  // Daily Soul (own worker): resolves {ok:true} (confirm mail sent, or already subscribed) | {ok:false}
  BY.dailyPost = function (email, fields) {
    return fetch(DAILY_URL, { method: "POST", headers: { Accept: "application/json" }, body: formParams(email, fields) })
      .then(function (r) { return r.json(); })
      .then(function (j) { return { ok: !!(j && j.ok), already: !!(j && j.status === "already") }; })
      .catch(function () { return { ok: false }; });
  };
  BY.subscribe = function (email, source) { return BY.dailyPost(email, { source: BY.sourceTag(source) }); };
  /* teaser email step: source "teaser-<slug>;product=<slug>;daily=yes|no" (+ ;src= ;vs=), plus product and the reading link.
     Daily Soul box ticked -> the Daily Soul worker (its own confirm email); not ticked -> the Kit reading-copy form only. */
  BY.captureReading = function (email, slug, daily, url, via) {
    var src = BY.sourceTag("teaser-" + slug) + ";product=" + slug + ";daily=" + (daily ? "yes" : "no") + (via ? ";via=" + via : "");
    var f = { source: src, product: slug, reading_url: url || "" };
    return daily ? BY.dailyPost(email, f) : BY.kitPost(KIT_FORMS.reading, email, f);
  };
  /* "You left mid-sentence" (2026-10-21): after a successful reading-copy signup WITHOUT Daily Soul, ask the unlock Worker to
     send ONE email with the reading link (Kit free has no automations). Fire and forget: never blocks, failures stay silent. */
  BY.teaserMail = function (email, slug, url) {
    try {
      fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/teaser-mail", { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ email: email, slug: slug, reading_url: url }) }).catch(function () {});
    } catch (e) { /* old browser */ }
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
      // v4 2026-11-06: the form starts as email + button; the birthday opens once she starts typing her email (or presses send)
      if (box && !BY.load("birth")) {
        BY.fillSelects(box);
        var openB = function () { box.hidden = false; };
        var em = f.querySelector('input[type="email"]'); if (em) { em.addEventListener("focus", openB, { once: true }); em.addEventListener("input", openB, { once: true }); }
      }
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var inp = f.querySelector('input[type="email"]'), err = f.querySelector(".err"), v = inp.value.trim();
        if (!BY.EMAIL_RE.test(v)) { err.textContent = "Please enter a valid email."; inp.focus(); return; }
        var b = BY.load("birth");
        if (box && box.hidden && !b) { box.hidden = false; err.textContent = "Add your birthday, so the email is about you."; return; }
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
          if (res.ok) BY.track("kit-signup", "Daily Soul signup");
          if (res.ok && res.already) { f.innerHTML = '<p class="ok" role="status">You\'re already in. Your Daily Soul arrives every morning.</p>'; return; }
          if (res.ok && !res.check) { f.innerHTML = '<p class="ok" role="status">Almost done. Check your inbox and tap the confirm link from Yeon. No confirm, no Daily Soul.</p>'; return; }
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
  /* 2026-11-06 redesign: content is never hidden waiting for a scroll reveal (no empty areas while scrolling in the IG
     browser). .rise is now visible at once; the observer below is kept off. */
  var io = false ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }) : null;
  /* v3 2026-11-06: typographic quotes and apostrophes in text rendered by script (the strip, the read page); static pages get the
     same pass at build time. Text nodes only, never attributes or code. */
  BY.typo = function (root) {
    if (!root || !doc.createTreeWalker) return;
    var w = doc.createTreeWalker(root, 4, null), n, t;
    while ((n = w.nextNode())) {
      if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.parentNode.nodeName)) continue;
      t = n.nodeValue; if (t.indexOf("'") < 0 && t.indexOf('"') < 0) continue;
      n.nodeValue = t.replace(/([A-Za-z0-9])'([A-Za-z])/g, "$1\u2019$2").replace(/(^|[\s(\[-])'/g, "$1\u2018").replace(/'/g, "\u2019")
        .replace(/(^|[\s(\[-])"/g, "$1\u201C").replace(/"/g, "\u201D");
    }
  };
  BY.watch = function (scope) {
    if (scope) BY.typo(scope);
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
    var set = function (on) { root.classList.toggle("menu-open", on); btn.setAttribute("aria-expanded", on ? "true" : "false"); };
    btn.addEventListener("click", function () { set(!root.classList.contains("menu-open")); });
    // v4: the menu is a full-screen sheet; a tap on any of its links (same-page #readings too) or Escape closes it
    var dr = doc.getElementById("drawer");
    if (dr) dr.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) set(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("menu-open")) { set(false); btn.focus(); } });
  }

  /* ---------- v3 2026-11-06: while a comic is on the page (teaser strip or the paid read page) the header slides away on
     the way down and comes back on the way up, so the strip reads full screen like a webtoon app ---------- */
  function chromeHide() {
    var last = window.scrollY, down = 0, up = 0, tick = false;
    window.addEventListener("scroll", function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        var y = window.scrollY, dy = y - last; last = y;
        var on = doc.body.classList.contains("has-strip") || !!doc.getElementById("rdOut");
        if (dy > 0) { down += dy; up = 0; } else if (dy < 0) { up -= dy; down = 0; }
        if (!on || y < 160 || up > 40 || root.classList.contains("menu-open")) doc.body.classList.remove("rd-down");
        else if (down > 12) doc.body.classList.add("rd-down");
      });
    }, { passive: true });
  }

  /* ---------- gumiho page transition ---------- */
  function wireFox() {
    if (reduced) return;
    var fox = doc.createElement("img");
    fox.alt = ""; fox.className = "fox-run"; fox.setAttribute("aria-hidden", "true"); fox.decoding = "async";
    // speed 2026-10-22: 280 px copy (shown at 140 px), fetched after the page has loaded so it never competes with the hero
    var foxLoad = function () { fox.src = "/assets/img/fox-280.webp"; doc.body.appendChild(fox); };
    if (doc.readyState === "complete") setTimeout(foxLoad, 200); else window.addEventListener("load", function () { setTimeout(foxLoad, 200); });
    doc.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) !== "/" || href.indexOf("#") >= 0 && href.split("#")[0] === location.pathname) return;
      if (a.hasAttribute("download")) return;
      // 2026-11-05: links into a reading (and anything on a reading page) go at once, no 300 ms fox run
      if (/^\/(readings|ex|situationship|brutally-honest)\//.test(href) || /^\/(readings|ex|situationship|brutally-honest)\//.test(location.pathname) || doc.body.classList.contains("is-flow")) return;
      e.preventDefault();
      fox.classList.remove("go"); void fox.offsetWidth; fox.classList.add("go");
      setTimeout(function () { location.href = href; }, 300);
    });
    window.addEventListener("pageshow", function () { fox.classList.remove("go"); });
  }

  /* ---------- ambient sky: plum petals + fireflies (light canvas) ---------- */
  function sky() {
    // speed 2026-11-05: phones get the still night sky (no canvas loop); elsewhere the petals drift for ~3 s, then stop
    if (reduced || (window.matchMedia && matchMedia("(pointer: coarse)").matches)) return;
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
    setTimeout(function () { running = false; }, 3000);
    requestAnimationFrame(draw);
  }

  /* ---------- v4 2026-11-06: speech bubbles over art (home hero, the comic cover) ----------
     Each .bub carries data-tip="x,y", in % of the picture: the top of the speaker's head (Bom is the man in the dark coat,
     Yeon the woman in hanbok). The figure gets just enough room above the picture for the bubbles, which overlap the
     picture's top edge a little, and a tail is drawn from each bubble's bottom edge to its tip. Faces are never covered. */
  var SVGNS = "http://www.w3.org/2000/svg", OVER = 22;
  BY.tails = function (scope) {
    [].forEach.call((scope || doc).querySelectorAll("figure[data-tails]"), function (fig) {
      var img = fig.querySelector("img"); if (!img) return;
      var draw = function () {
        var bubs = [].slice.call(fig.querySelectorAll(".bub[data-tip]")); if (!bubs.length || !img.offsetWidth) return;
        var mh = 0; bubs.forEach(function (b) { mh = Math.max(mh, b.offsetHeight + b.offsetTop); });
        fig.style.paddingTop = Math.max(0, mh - OVER) + "px";
        var fr = fig.getBoundingClientRect(), ir = img.getBoundingClientRect();
        var svg = fig.querySelector("svg.tails");
        if (!svg) { svg = doc.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "tails"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); fig.appendChild(svg); }
        svg.setAttribute("viewBox", "0 0 " + fr.width + " " + fr.height);
        var out = "";
        bubs.forEach(function (b) {
          var t = b.getAttribute("data-tip").split(","), br = b.getBoundingClientRect(), cs = getComputedStyle(b);
          var tx = ir.left - fr.left + ir.width * (+t[0]) / 100, ty = ir.top - fr.top + ir.height * (+t[1]) / 100;
          var by = br.bottom - fr.top - 2, l = br.left - fr.left, r = br.right - fr.left;
          var cx = Math.min(Math.max(tx, l + 26), r - 26), w = 9;
          if (ty < by + 8) ty = by + 8;
          var pts = (cx - w).toFixed(1) + "," + by.toFixed(1) + " " + tx.toFixed(1) + "," + ty.toFixed(1) + " " + (cx + w).toFixed(1) + "," + by.toFixed(1);
          var edge = cs.borderTopWidth && parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : "";
          out += '<polygon points="' + pts + '" fill="' + cs.backgroundColor + '"/>';
          if (edge) out += '<polyline points="' + pts + '" fill="none" stroke="' + edge + '" stroke-width="' + cs.borderTopWidth + '" stroke-linejoin="round"/>';
        });
        svg.innerHTML = out;
      };
      fig._tails = draw; draw();
      if (!img.complete) img.addEventListener("load", draw, { once: true });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(draw);
    });
  };
  var tailT = 0;
  window.addEventListener("resize", function () { clearTimeout(tailT); tailT = setTimeout(function () { [].forEach.call(doc.querySelectorAll("figure[data-tails]"), function (f) { if (f._tails) f._tails(); }); }, 120); });

  function start() {
    BY.fillSelects(); BY.paintPrices(); geo();
    // v3 2026-11-06: no gumiho run on link clicks and no drifting petals/fireflies (motion without a reason); wireFox and sky stay defined, unused
    wireMenu(); wireDaily(); chromeHide(); BY.watch(); BY.tails();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
