/* Bom & Yeon shared behaviour: nav, ambient sky, scroll reveals, buttons, birthday storage, Kit signup, webtoon panels. */
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
  BY.analyze = function (b, partner, opts) {
    opts = opts || {};
    return window.SajuEngine.analyze({ year: b.year, month: b.month, day: b.day, hour: opts.hour == null ? null : opts.hour, minute: 0, gender: opts.flow || "female" }, partner || null);
  };

  /* ---------- birthdays ---------- */
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
      if (kind === "y") for (i = 2026; i >= 1925; i--) out.push('<option value="' + i + '">' + i + "</option>");
      sel.insertAdjacentHTML("beforeend", out.join(""));
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

  /* ---------- Kit: Daily Soul (form 10071361) ---------- */
  var KIT_URL = "https://app.kit.com/forms/10071361/subscriptions";
  BY.EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  BY.subscribe = function (email, source) {
    var b = BY.load("birth"), dm = "";
    try { if (b && window.SajuEngine) dm = window.BY_DATA.SOULS[BY.analyze(b).dayMaster].name; } catch (e) { dm = ""; }
    var params = new URLSearchParams();
    params.append("email_address", email);
    params.append("fields[day_master]", dm);
    params.append("fields[birth_date]", BY.iso(b));
    params.append("fields[source]", source || "daily_soul");
    return fetch(KIT_URL, { method: "POST", headers: { Accept: "application/json" }, body: params })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.status === "quarantined" && j.url) { var w = window.open(j.url, "_blank", "noopener"); if (!w) location.href = j.url; }
        return true;
      }).catch(function () { return false; });
  };
  function wireDaily() {
    [].forEach.call(doc.querySelectorAll("form[data-daily]"), function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var inp = f.querySelector('input[type="email"]'), err = f.querySelector(".err"), v = inp.value.trim();
        if (!BY.EMAIL_RE.test(v)) { err.textContent = "Please enter a valid email."; inp.focus(); return; }
        err.textContent = "";
        var btn = f.querySelector("button"); btn.disabled = true;
        BY.subscribe(v, f.getAttribute("data-daily") || "daily_soul").then(function () {
          f.innerHTML = '<p class="ok" role="status">You\'re in. Your first Daily Soul is on its way.</p>';
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
