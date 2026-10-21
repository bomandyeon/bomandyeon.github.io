/* Product page (preview) and reading page (full personalized webtoon). One file, mode from window.BY_PRODUCT.mode.
 * P4 (v4 content): both pages assemble the reading with BYAssembleV4 (assemble-v4.js, see work/content-v4/SCHEMA.md).
 * Product page loads /readings/<slug>/preview.json only (the first two plan chapters per Day Master).
 * Reading page loads one file per Day Master (/readings/<slug>/read/d/<dm>.<hash>.json): the v4 layers for that reader
 * plus the 10 pair texts that involve them. Ex + situationship ask up to 3 optional questions first (step by step, skippable);
 * the answers go in the reading URL (&a=them.months.closure) so a shared link reproduces the same reading. */
(function () {
  "use strict";
  /* Public site: every reading opens free. Paid flow (Gumroad overlay, pay.js) only in paytest mode (?paytest=1). */
  var BY = window.BY, D = window.BY_DATA, P = window.BY_PRODUCT, $ = BY.$, esc = BY.esc, PL = window.BYPlan, PAIRS = window.BY_PAIRS || {}, A4 = window.BYAssembleV4;
  if (!P) return;
  var PAY = BY.pay && BY.pay.on ? BY.pay : null; // null = free (public)
  var THANKS = { bom: "Thank you. Bom is putting the kettle on. Your whole comic is below.", yeon: "Paid and opened. Yeon says thanks, then gets straight to the point." };
  var EL_LOWER = ["wood", "fire", "earth", "metal", "water"];
  var SEASON_HZ = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  var ART = P.art || [1, 2, 3, 4, 11, 12];
  var EXTRA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(function (n) { return ART.indexOf(n) < 0; });
  var ARTS = ART.concat(EXTRA); // v4 readings have 21-28 panels: cycle through all 12 images, the product's own six first
  var PAIR = P.pair || (P.two ? "required" : "");
  var THEIR_KEY = PAIR === "optional" ? "their_" + P.slug : "their";
  BY.fillSelects();

  function qsDate(k) { var m = new RegExp("[?&]" + k + "=([0-9-]{10})").exec(location.search); return m ? BY.fromIso(m[1]) : null; }
  var birth = qsDate("b") || BY.load("birth"), their = PAIR ? (qsDate("t") || BY.load(THEIR_KEY)) : null, name = BY.load("name") || "";

  /* optional intake answers (ex + situationship): {qid: value}; URL form a=v1.v2.v3 in intake order */
  var INTAKE = P.intake || [], ANS_KEY = "ans_" + P.slug;
  function cleanAns(o) {
    if (!o || typeof o !== "object") return null;
    var r = {}, n = 0;
    INTAKE.forEach(function (q) { var v = o[q.id]; if (v === q.skip_value || q.options.some(function (x) { return x.value === v; })) { r[q.id] = v; n++; } });
    return n === INTAKE.length ? r : null;
  }
  function qsAns() {
    var m = /[?&]a=([a-z.]+)/.exec(location.search); if (!m || !INTAKE.length) return null;
    var v = m[1].split("."), o = {}; INTAKE.forEach(function (q, i) { o[q.id] = v[i]; }); return cleanAns(o);
  }
  var answers = INTAKE.length ? (qsAns() || cleanAns(BY.load(ANS_KEY))) : {};
  function ansParam() { return INTAKE.length && answers ? "&a=" + INTAKE.map(function (q) { return answers[q.id]; }).join(".") : ""; }
  function ready() { return !!birth && (PAIR !== "required" || !!their); }
  /* owned reading: straight to the comic; the read page asks for birthdays itself when they are missing */
  function goRead(replace) { var u = ready() ? readUrl() : P.readUrl; if (replace) location.replace(u); else location.href = u; }
  function readUrl() { return P.readUrl + "?b=" + BY.iso(birth) + (PAIR && their ? "&t=" + BY.iso(their) : "") + ansParam(); }
  function pairSlug(a, b) { var x = Math.min(a, b), y = Math.max(a, b); return D.SLUGS[x] + "-and-" + D.SLUGS[y]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function who(sp) { return sp === "yeon" ? "Yeon" : "Bom"; }
  function analyze() { return BY.analyze(birth, PAIR && their ? their : null); }

  /* read the optional "their birthday" selects: all empty -> null, partly filled -> error */
  function readTheir(form) {
    var sels = form.querySelectorAll('select[name^="t"]'), any = false;
    [].forEach.call(sels, function (s) { if (s.value) any = true; });
    if (!any) return PAIR === "required" ? { error: "Pick the month, day and year." } : null;
    return BY.readDate(form, "t");
  }
  function readForm(form, errEl) {
    var b = BY.readDate(form, "b");
    if (b.error) { errEl.textContent = "Your birthday: " + b.error; return false; }
    var t = PAIR ? readTheir(form) : null;
    if (t && t.error) { errEl.textContent = "Their birthday: " + t.error; return false; }
    errEl.textContent = "";
    var nm = form.querySelector('[name="nm"]'), n = nm ? nm.value.replace(/[<>]/g, "").trim().slice(0, 24) : "";
    birth = b; BY.store("birth", b); their = t; BY.store(THEIR_KEY, t); name = n; BY.store("name", n || null);
    BY.readExtras(form);
    return true;
  }
  function fillForm(form) {
    BY.setDate(form, "b", birth); if (PAIR) BY.setDate(form, "t", their);
    if (birth) { BY.store("birth", birth); BY.knownBirth(form); }
    var nm = form.querySelector('[name="nm"]'); if (nm && name) nm.value = name;
    BY.fillExtras(form);
  }

  function panel(art, p, nar) {
    var b = [{ who: who(p.speaker), text: p.text }];
    if (nar) b.unshift({ text: nar });
    return BY.panel(art, b, who(p.speaker) + " speaks in a comic panel");
  }
  function webtoon(list) { var wt = document.createElement("div"); wt.className = "webtoon"; list.forEach(function (f) { if (f) wt.appendChild(f); }); return wt; }
  /* chapter text: paragraphs split on blank lines, "### X" lines are sub-headings */
  function textHTML(t) {
    return String(t || "").split(/\n\s*\n/).map(function (b) {
      b = b.trim(); if (!b) return "";
      var m = /^### (.+?)(?:\n([\s\S]*))?$/.exec(b);
      if (m) return "<h4>" + esc(m[1].trim()) + "</h4>" + (m[2] && m[2].trim() ? "<p>" + esc(m[2].trim()) + "</p>" : "");
      return "<p>" + esc(b) + "</p>";
    }).join("");
  }
  function chapterHTML(title, text, kicker, pre) { return '<section class="rise chap">' + (kicker ? '<p class="kicker">' + esc(kicker) + "</p>" : "") + "<h3>" + esc(title) + "</h3>" + (pre || "") + textHTML(text) + "</section>"; }
  /* one assembled v4 chapter -> [webtoon, text] (art cycles through all panel images) */
  function v4Panels(ch, artAt) { return webtoon(ch.panels.map(function (p) { return panel(ARTS[artAt() % ARTS.length], p, p.nar || null); })); }
  /* ---------- comic chapters: the chapter's own scene stays pinned while the text scrolls over it in caption boxes ---------- */
  var SC = window.BY_SCENES || {};
  function sceneFor(chId, R) {
    var k = chId === "season" ? "season/" + R.season : chId === "strength" ? "soul/" + D.SOULS[R.dayMaster].slug : P.slug + "/" + chId;
    if (!SC[k] && chId === "pair") k = "soul/" + D.SOULS[(R.partner || R).dayMaster].slug;
    return SC[k] ? { src: "/assets/img/scenes/" + k + ".webp", w: SC[k][0], h: SC[k][1] } : null;
  }
  /* text -> beats: paragraphs, long ones split at a sentence near the middle; "### X" becomes the beat's label */
  function beats(t) {
    var out = [];
    String(t || "").split(/\n\s*\n/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      var lab = null, m = /^### (.+?)(?:\n([\s\S]*))?$/.exec(b);
      if (m) { lab = m[1].trim(); b = (m[2] || "").trim(); if (!b) { out.push({ label: lab, text: "" }); return; } }
      var w = b.split(/\s+/).length;
      if (w > 75) {
        var sents = b.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [b], half = w / 2, acc = 0, a = [], c = [];
        sents.forEach(function (x) { (acc < half ? a : c).push(x); acc += x.split(/\s+/).length; });
        if (a.length && c.length) { out.push({ label: lab, text: a.join("").trim() }); out.push({ label: null, text: c.join("").trim() }); return; }
      }
      out.push({ label: lab, text: b });
    });
    return out;
  }
  var EL_TINT = { Wood: "#3E8E5A", Fire: "#C8443C", Earth: "#B08A4A", Metal: "#B9BCC8", Water: "#3B6FB0" };
  function comicChapter(ch, R, artAt, opts) {
    opts = opts || {};
    var sc = sceneFor(ch.id, R), s = D.SOULS[R.dayMaster], sec = document.createElement("section");
    sec.className = "comic" + (sc ? "" : " comic--plain");
    sec.style.setProperty("--tint", EL_TINT[s.el] || "#C9A45C");
    var head = '<header class="comic__title"><p class="kicker">' + esc(ch.kicker || "") + "</p><h3>" + esc(ch.title || "") + "</h3></header>";
    var stage = sc ? '<div class="comic__stage" aria-hidden="true"><div class="comic__img" style="background-image:url(' + sc.src + ')"></div><span class="comic__tint"></span><span class="comic__seal hz">' + s.hanja + "</span></div>" : "";
    var html2 = head + stage + '<div class="comic__beats">';
    (ch.panels || []).forEach(function (p) {
      if (p.nar) html2 += '<div class="beat beat--nar"><p>' + esc(p.nar) + "</p></div>";
      var sp = who(p.speaker);
      html2 += '<div class="beat beat--say beat--' + sp.toLowerCase() + '"><span class="av av--' + sp.toLowerCase() + '"><img src="/assets/img/av-' + sp.toLowerCase() + '.webp" alt="" width="44" height="44"></span><p class="bubble"><b>' + sp + "</b>" + esc(p.text) + "</p></div>";
    });
    if (opts.pre) html2 += '<div class="beat beat--cap beat--note"><p>' + opts.pre + "</p></div>";
    var list = opts.blocks ? [] : beats(ch.text);
    if (opts.blocks) opts.blocks.forEach(function (b) { beats(b.t).forEach(function (x, i) { list.push({ label: i ? x.label : b.h, text: x.text }); }); if (b.note) list.push({ label: null, text: b.note, note: true }); });
    list.forEach(function (b, i) {
      html2 += '<div class="beat beat--cap' + (b.note ? " beat--note" : "") + '" data-i="' + i + '">' + (b.label ? '<h4>' + esc(b.label) + "</h4>" : "") + (b.text ? "<p>" + esc(b.text) + "</p>" : "") + "</div>";
    });
    html2 += "</div>" + (opts.tail || "");
    sec.innerHTML = html2;
    [].forEach.call(sec.querySelectorAll(".beat, .comic__title"), function (b) { b.classList.add("rise"); });
    if (sc) panBeats(sec);
    return sec;
  }
  /* slow camera move: each caption that reaches the middle of the screen moves the pinned scene a step */
  var POS = ["50% 20%", "30% 45%", "70% 55%", "50% 80%", "40% 30%", "60% 65%"];
  function panBeats(sec) {
    if (!("IntersectionObserver" in window) || BY.reduced) return;
    var img = sec.querySelector(".comic__img");
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { var i = +(en.target.getAttribute("data-i") || 0); img.style.backgroundPosition = POS[i % POS.length]; img.style.transform = "scale(" + (1.08 + (i % 3) * 0.06) + ")"; } });
    }, { rootMargin: "-45% 0px -45% 0px" });
    [].forEach.call(sec.querySelectorAll(".beat--cap"), function (b) { io.observe(b); });
  }
  function counter() { var i = 0; return function () { return i++; }; }
  var TYPE_NAMES = { season: "Your season", strength: "Your strength, and what steadies you", pair: "You and them" };
  function planTitle(c) { return c.title || TYPE_NAMES[c.type] || c.id; }
  function html(h) { var d = document.createElement("div"); d.className = "chapter-text"; d.innerHTML = h; return d; }

  function seasonLine(R) { return PL.seasonLabel(R); }
  function seasonHz(R) { return R.seasonKey === "earth" ? "土" : SEASON_HZ[R.season]; }
  /* born on a solar-term day with no birth time: say so, honestly */
  function termBanner(R) {
    var T = R.termDay; if (!T) return "";
    var yr = T.yearChanges ? " and year" : "";
    var alt = T.readAsAfter ? "before " + T.time : "after " + T.time;
    return '<div class="term-banner rise" role="note"><b>You were born on ' + esc(T.term) + ", a solar-term day.</b> The saju month" + yr + " turned over that day at " + esc(T.time) +
      " " + esc(BY.zoneLabel(R.zone)) + " time. With no birth time we read noon, so your month pillar is " + esc(T.month) + ". Born " + esc(alt) + "? You'd be " + esc(T.altMonth) +
      (T.yearChanges ? ", in a " + esc(T.altYear) + " " + esc(T.altAnimal) + " year" : "") + ". Add your birth time to the form to be exact.</div>";
  }
  function strengthWord(R) { return R.dmStrength === "strong" ? "Strong chart" : "Weak chart"; }

  /* ======================= PRODUCT PAGE ======================= */
  function productPage() {
    var form = $("pvForm"), out = $("pvOut"), dataP = null;
    function data() { if (!dataP) dataP = fetch(P.dataUrl).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); }); return dataP; }
    fillForm(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!readForm(form, $("pvErr"))) return;
      if (PAY && PAY.owns(P.slug)) { goRead(); return; }
      renderPreview(true);
    });
    function renderPreview(scroll) {
      var R = analyze(), s = D.SOULS[R.dayMaster];
      out.innerHTML = '<p class="center muted">Bom and Yeon are pulling your chapters…</p>';
      data().then(function (J) {
        var d = J.by_day_master[s.slug];
        if (!d || !A4) { out.innerHTML = '<p class="err">This reading is still being written for ' + esc(s.name) + ". Try another one for now.</p>"; return; }
        out.innerHTML = "";
        var head = document.createElement("div");
        head.className = "center rise";
        head.innerHTML = '<p class="kicker">' + (name ? esc(name) + "'s preview" : "Your preview") + '</p><h2><span class="hz" style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + "</span> " + esc(s.name) + "</h2>" +
          '<ul class="tags"><li>' + seasonHz(R) + " " + esc(seasonLine(R)) + "</li><li>" + esc(strengthWord(R)) + "</li>" +
          (PAIR && R.partner ? "<li>You + " + esc(D.SOULS[R.partner.dayMaster].name) + "</li>" : "") + "</ul>" +
          termBanner(R);
        out.appendChild(head);
        // the reading's real opening: the first two plan chapters, assembled exactly as on the reading page
        var V = { plan: J.plan2, intake: J.intake, ext: J.ext || {}, day_branch: J.day_branch, day_branch_heading: J.day_branch_heading, heavy: {}, missing: {},
          base: {}, base_panels: {}, season: {}, extra: {} };
        V.base[s.slug] = d.base; V.base_panels[s.slug] = d.base_panels; V.season[s.slug] = d.season; V.extra[s.slug] = d.extra || {};
        var asm = A4.assemble(R, V, {}), art = counter(), lockHTML = "";
        var rest = J.plan.slice(2).filter(function (c) { return !(c.type === "pair" && c.optional && !R.partner); });
        var extra = ["your " + (R.dmStrength === "strong" ? "strong" : "weak") + "-chart chapter", "your element balance"];
        if (PAIR && R.partner) extra.push("the chapter on you and " + D.SOULS[R.partner.dayMaster].name);
        else if (PAIR === "optional") extra.push("a chapter on the two of you if you add their birthday");
        if (INTAKE.length) extra.push("the sections your answers pick (" + INTAKE.length + " optional questions, one tap each)");
        var chips = '<ul class="chips">' + rest.map(function (c) { return "<li>" + esc(planTitle(c)) + "</li>"; }).join("") + "</ul>";
        if (PAY && !PAY.owns(P.slug)) {
          lockHTML = '<div class="chapter-lock paywall rise"><p class="kicker">To be continued</p><h3>Continue your comic</h3>' +
            '<p class="pw-price"><s>$' + PAY.anchor(P.price) + '</s> <strong>$' + P.price + "</strong></p>" +
            '<p class="muted small">' + rest.length + " more chapters, written for your chart. Including " + esc(extra.join(", ")) + ".</p>" + chips +
            PAY.buyLink(P.slug, "Continue my comic · $" + P.price, "btn--block") +
            '<p class="small pw-promise">' + PAY.guarantee + " " + PAY.methods + "</p>" + PAY.statusEl(P.slug) + PAY.fallback() + "</div>";
        } else {
          lockHTML = '<div class="chapter-lock rise"><p class="kicker">' + rest.length + ' more chapters</p><p class="muted small">Including ' + esc(extra.join(", ")) + ".</p>" + chips +
            '<button class="btn" type="button" data-buy>' + buyLabel() + "</button>" + giftNote() + "</div>";
        }
        asm.chapters.forEach(function (ch, i) {
          out.appendChild(comicChapter(ch, R, art, i === asm.chapters.length - 1 ? { tail: lockHTML } : null));
        });
        BY.watch(out);
        if (PAY) stickyPaywall();
        if (scroll) out.scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth", block: "start" });
      }).catch(function () { out.innerHTML = '<p class="err">The preview didn\'t load. Check your connection and press the button again.</p>'; });
    }
    function buyLabel() { return PAY ? "Open my full reading" : "Open my full reading · free"; }
    function giftNote() { return PAY ? "" : '<p class="gift"><b>Founding reader gift</b>This reading is $' + P.price + ". Our first readers get it free. No checkout, no card, no email.</p>"; }
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-buy]")) return;
      e.preventDefault();
      if (!birth || (PAIR === "required" && !their)) {
        $("pvErr").textContent = PAIR === "required" ? "Add both birthdays first, so the reading is written for the two of you." : "Add your birthday first, so the reading is written for you.";
        $("preview").scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth" }); form.querySelector("select").focus({ preventScroll: true }); return;
      }
      if (PAY && !PAY.owns(P.slug)) {
        var pw = out.querySelector(".paywall"), pb = pw && pw.querySelector("[data-pay]");
        // sticky bar once the reader has reached the paywall: open checkout straight away
        if (pb && e.target.closest("#stickyBuy") && pw.getBoundingClientRect().top < window.innerHeight) { pb.click(); return; } (pw || $("preview")).scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth", block: pw ? "center" : "start" }); if (!pw) renderPreview(true); return; }
      location.href = readUrl();
    });
    if (PAY) {
      // hero + sticky bar: price with anchor, a free-preview button instead of "free" copy
      var gift = document.querySelector(".phero .gift"); if (gift) { gift.className = "small pw-promise"; gift.textContent = "First two chapters free, written for your birthday. " + PAY.guarantee; }
      var pr = document.querySelector(".phero .price-row strong"); if (pr) pr.innerHTML = '<s class="muted">$' + PAY.anchor(P.price) + "</s> $" + P.price;
      [].forEach.call(document.querySelectorAll("[data-buy]"), function (b) { b.textContent = PAY.owns(P.slug) ? "Open my full reading" : "Read 2 chapters free"; });
      var sp = document.querySelector("#stickyBuy p"); if (sp) sp.innerHTML = "<strong>" + esc(document.querySelector(".phero h1").textContent) + "</strong>$" + P.price + " · first 2 chapters free";
      PAY.watch(P.slug, function () { BY.store("thanks_" + P.slug, 1); goRead(); });
      // ?key=<license> on the product page: restore quietly, then open the reading (or show it as owned)
      if (PAY.hasKey()) PAY.restore(P.slug).then(function (ok) {
        if (!ok) return;
        [].forEach.call(document.querySelectorAll("[data-buy]"), function (b) { b.textContent = "Open my full reading"; });
        goRead(true);
      });
    }
    /* paytest: when the paywall card is on the page, the sticky bar sells instead of offering the free preview again */
    function stickyPaywall() {
      var pw = out.querySelector(".paywall"), sb = $("stickyBuy"); if (!sb) return;
      var btn = sb.querySelector("[data-buy]"), sp = sb.querySelector("p");
      if (!pw) return;
      if (btn) btn.textContent = "Continue · $" + P.price;
      if (sp) sp.innerHTML = "<strong>" + esc(document.querySelector(".phero h1").textContent) + "</strong><s>$" + PAY.anchor(P.price) + "</s> $" + P.price + " · 30-day refund";
      // hide the bar while the paywall's own button is on screen, so there are never two buy buttons at once
      var pb = pw.querySelector("[data-pay]");
      if (pb && "IntersectionObserver" in window) new IntersectionObserver(function (ents) { ents.forEach(function (en) { sb.classList.toggle("is-hidden", en.isIntersecting); }); }).observe(pb);
    }
    var fromLink = !!qsDate("b");
    if (PAY && PAY.owns(P.slug) && !PAY.hasKey()) { goRead(true); return; }
    if (birth && (PAIR !== "required" || their)) renderPreview(fromLink);
    var sb = $("stickyBuy");
    if (sb && "IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) { ents.forEach(function (en) { sb.classList.toggle("is-on", !en.isIntersecting && window.scrollY > 300); }); }).observe($("buyTop"));
    }
  }

  /* ======================= READING PAGE ======================= */
  function readPage() {
    var form = $("rdForm"), out = $("rdOut");
    if (!P.full) { // paid mode: full data is not on the site
      out.innerHTML = '<div class="card center"><h1 style="font-size:28px">This reading opens after checkout</h1><p class="muted">Get it from the reading page.</p><a class="btn" href="' + P.productUrl + '">Go to the reading</a></div>';
      return;
    }
    if (PAY && !PAY.owns(P.slug)) {
      // ?key=<license from the receipt> restores a purchase on a new browser, without typing anything
      if (PAY.hasKey()) {
        out.innerHTML = '<p class="center muted">Opening your reading…</p>';
        PAY.restore(P.slug).then(function (ok) {
          if (ok) { start(); return; }
          location.replace(P.productUrl + location.search + "#preview");
        });
        return;
      }
      location.replace(P.productUrl + location.search + "#preview"); return;
    }
    start();
    function start() {
    function need() { return !birth || (PAIR === "required" && !their); }
    if (need()) {
      out.innerHTML = ""; $("rdAsk").hidden = false; fillForm(form);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!readForm(form, $("rdErr"))) return;
        $("rdAsk").hidden = true;
        try { history.replaceState(null, "", readUrl()); } catch (x) { /* file:// */ }
        next();
      });
    } else next();
    }
    function next() { if (INTAKE.length && !answers) intake(); else render(); }

    /* step-by-step optional questions, each with a visible skip; answers stored like the other form fields */
    function intake(prev) {
      var box = $("rdIntake"), cur = prev ? Object.assign({}, prev) : {}, i = 0;
      out.innerHTML = ""; box.hidden = false; box.classList.add("no-print");
      function step() {
        var q = INTAKE[i];
        box.innerHTML = '<p class="kicker">Question ' + (i + 1) + " of " + INTAKE.length + ' · optional</p><h2 class="intake__q">' + esc(q.question) + "</h2>" +
          '<p class="muted small">Your answer changes one section of the reading. Skip it and that section is written for not knowing.</p>' +
          '<div class="intake__opts" role="group" aria-label="' + esc(q.question) + '">' + q.options.filter(function (o) { return o.value !== q.skip_value; }).map(function (o) {
            return '<button type="button" class="btn btn--ghost btn--block intake__opt" data-v="' + esc(o.value) + '"' + (cur[q.id] === o.value ? ' aria-pressed="true"' : "") + ">" + esc(o.label) + "</button>";
          }).join("") + "</div>" +
          '<div class="intake__nav">' + (i > 0 ? '<button type="button" class="linkbtn" data-nav="back">Back</button>' : "<span></span>") +
          '<button type="button" class="linkbtn" data-v="' + esc(q.skip_value) + '">Skip this question</button></div>' +
          (i === 0 ? '<p class="center"><button type="button" class="linkbtn small" data-nav="all">Skip all and open my reading</button></p>' : "");
        var f = box.querySelector(".intake__opt"); if (f && i > 0) f.focus({ preventScroll: true });
      }
      box.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        var nav = b.getAttribute("data-nav");
        if (nav === "back") { i = Math.max(0, i - 1); step(); return; }
        if (nav === "all") { INTAKE.forEach(function (q) { if (!cur[q.id]) cur[q.id] = q.skip_value; }); i = INTAKE.length; }
        else { cur[INTAKE[i].id] = b.getAttribute("data-v"); i++; }
        if (i < INTAKE.length) { step(); return; }
        answers = cleanAns(cur); BY.store(ANS_KEY, answers);
        var nAns = INTAKE.filter(function (q) { return answers && answers[q.id] !== q.skip_value; }).length;
        BY.track((nAns ? "intake-answered-" : "intake-skipped-") + P.slug, (nAns ? "Intake answered (" + nAns + " of " + INTAKE.length + "): " : "Intake skipped: ") + P.slug);
        box.hidden = true; box.innerHTML = ""; box.onclick = null;
        try { history.replaceState(null, "", readUrl()); } catch (x) { /* file:// */ }
        render(); window.scrollTo(0, 0);
      };
      step();
      box.scrollIntoView({ block: "start" });
    }
    function answersLine() {
      if (!INTAKE.length || !answers) return null;
      var given = INTAKE.map(function (q) { var o = q.options.filter(function (x) { return x.value === answers[q.id]; })[0]; return answers[q.id] === q.skip_value || !o ? null : o.label; }).filter(Boolean);
      var d = document.createElement("div"); d.className = "answers-line no-print rise";
      d.innerHTML = '<p class="muted small">' + (given.length ? "Your answers: " + esc(given.join(" · ")) + "." : "You skipped the questions, so those sections are written for not knowing.") +
        ' <button type="button" class="linkbtn small" data-act="answers">' + (given.length ? "Change answers" : "Answer them") + "</button></p>";
      return d;
    }

    var opened = false;
    function render() {
      var R = analyze(), s = D.SOULS[R.dayMaster], them = R.partner ? D.SOULS[R.partner.dayMaster] : null;
      out.innerHTML = '<p class="center muted">Opening your reading…</p>';
      fetch(P.files[s.slug]).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); }).then(function (J) {
        out.innerHTML = "";
        if (!opened) { opened = true; BY.track("read-" + P.slug, "Opened reading: " + P.slug); }
        var LEN = null, info = coverInfo(R, s, them, J.title);
        if (PAY) {
          var g0 = document.querySelector("#rdOut") && document.querySelector("p.gift.center"); if (g0) g0.hidden = true;
          if (BY.load("thanks_" + P.slug)) {
            BY.store("thanks_" + P.slug, null);
            var tv = P.slug === "brutally-honest" ? "yeon" : "bom";
            out.appendChild(html('<div class="say say--' + tv + ' rise thanks"><span class="av av--' + tv + '"><img src="/assets/img/av-' + tv + '.webp" alt="" width="56" height="56"></span><p class="bubble"><b>' + who(tv) + "</b>" + esc(THANKS[tv]) + "</p></div>"));
          }
        }
        out.appendChild(coverCard(info, R));
        if (R.termDay) out.appendChild(html(termBanner(R)));
        out.appendChild(actions());
        if (PAIR === "required" && them) out.appendChild(bondBox(R, s, them));

        var al = answersLine(); if (al) out.appendChild(al);
        var asm = A4.assemble(R, J, { answers: answers || {}, pairs: J.pairs || null }), art = counter();
        var pi = -1; J.plan.forEach(function (c, i) { if (c.type === "pair") pi = i; });
        var afterId = PAIR === "optional" && !them && pi > 0 ? J.plan[pi - 1].id : null;
        asm.chapters.forEach(function (ch) {
          if (ch.id === "balance" && ch.blocks) out.appendChild(comicChapter(ch, R, art, { blocks: ch.blocks }));
          else if (ch.id === "strength") out.appendChild(comicChapter(ch, R, art, { pre: esc(strengthHow(R)) }));
          else out.appendChild(comicChapter(ch, R, art));
          if (afterId && ch.id === afterId) {
            out.appendChild(html('<div class="card rise no-print add-their"><p class="kicker">One more chapter</p><p>Add their birthday and Bom and Yeon write a chapter on how your two patterns meet.</p>' +
              '<form id="addTheir" class="form-stack" novalidate>' + document.querySelector("#rdForm .selects[aria-label^='Their']").outerHTML + '<p class="err" id="atErr" role="alert"></p><button class="btn" type="submit">Add the chapter</button></form></div>'));
          }
        });
        out.appendChild(html('<div class="say say--yeon rise"><span class="av av--yeon"><img src="/assets/img/av-yeon.webp" alt="" width="56" height="56"><img src="/assets/img/av-yeon-blink.webp" alt="" width="56" height="56"></span><p class="bubble"><b>Yeon</b>' + esc(D.YEON_MSG[R.dayMasterEl]) + "</p></div>"));
        LEN = { words: asm.words, chapters: asm.chapters.length, panels: asm.panels };
        out.appendChild(html(aboutThis(R, LEN)));
        var lenTag = $("rdLen"); if (lenTag) lenTag.textContent = LEN.chapters + " chapters · " + LEN.words.toLocaleString("en-US") + " words · a " + mins(LEN.words) + "-minute read";
        out.appendChild(actions(true));

        requestAnimationFrame(function () { setTimeout(function () { [].forEach.call(out.querySelectorAll("[data-w]"), function (i) { i.style.width = i.getAttribute("data-w") + "%"; }); }, 200); });
        wireActions(info, J.title);
        var at = $("addTheir");
        if (at) {
          [].forEach.call(at.querySelectorAll("select"), function (x) { x.value = ""; });
          at.addEventListener("submit", function (e) {
            e.preventDefault();
            var t = BY.readDate(at, "t"); if (t.error) { $("atErr").textContent = t.error; return; }
            their = t; BY.store(THEIR_KEY, t); try { history.replaceState(null, "", readUrl()); } catch (x) { /* ignore */ }
            render(); window.scrollTo(0, 0);
          });
        }
        $("rdCross").hidden = false;
        if (PAY && !BY.load("lic_all-readings")) upsell();
        BY.watch(out);
      }).catch(function () { out.innerHTML = '<p class="err center">The reading didn\'t load. Check your connection and refresh the page.</p>'; });
    }

    function coverInfo(R, s, them, title) {
      var pl = R.pillars;
      return { name: name, title: title, hanja: s.hanja, dmName: s.name, nick: s.nick, el: s.el, color: D.EL_COLOR[s.el],
        pillars: [["Year", pl.year], ["Month", pl.month], ["Day", pl.day]].concat(pl.hour ? [["Hour", pl.hour]] : []).map(function (x) {
          return { label: x[0], stem: x[1].stemHanja, branch: x[1].branchHanja, stemEl: x[1].stemEl, branchEl: x[1].branchEl, animal: x[1].animal };
        }),
        counts: R.counts, season: R.seasonKey === "earth" ? "late " + R.season : R.season, seasonHz: seasonHz(R), seasonEl: R.seasonElName, strength: R.dmStrength,
        score: R.strengthScore, max: R.strengthMax, code: R.readingCode,
        them: them ? { hanja: them.hanja, name: them.name, color: D.EL_COLOR[them.el] } : null };
    }
    function coverCard(I, R) {
      var max = Math.max.apply(null, I.counts.concat([1]));
      var bars = I.counts.map(function (c, i) {
        return '<div class="bar"><span>' + D.EL_NAMES[i] + '</span><span class="tr"><i style="--c:' + D.EL_COLOR[D.EL_NAMES[i]] + '" data-w="' + Math.round(c / max * 100) + '"></i></span><span>' + c.toFixed(1) + "</span></div>";
      }).join("");
      var pills = I.pillars.map(function (p) {
        return '<div class="pillar"><span class="pl-l">' + p.label + '</span><span class="hz" style="color:' + D.EL_COLOR[p.stemEl] + '">' + p.stem + '</span><span class="hz" style="color:' + D.EL_COLOR[p.branchEl] + '">' + p.branch +
          '</span><span class="pl-e">' + p.stemEl + "<br>" + p.branchEl + " · " + p.animal + "</span></div>";
      }).join("");
      var el = document.createElement("header");
      el.className = "cover-card rise";
      el.innerHTML = '<p class="kicker">' + esc(I.title) + "</p>" +
        '<p class="cv-name">' + (I.name ? esc(I.name) : "Your reading") + "</p>" +
        '<p class="hz cv-dm" style="color:' + I.color + '">' + I.hanja + "</p>" +
        "<h1>" + esc(I.dmName) + '</h1><p class="muted">' + esc(I.nick) + (I.them ? ' · with <span class="hz" style="color:' + I.them.color + '">' + I.them.hanja + "</span> " + esc(I.them.name) : "") + "</p>" +
        '<div class="pillars' + (I.pillars.length > 3 ? " pillars--4" : "") + '" aria-label="Your pillars">' + pills + "</div>" +
        '<ul class="tags"><li>' + I.seasonHz + " " + esc(seasonLine(R)) + "</li><li>" + esc(strengthWord(R)) + " · " + I.score + " of " + I.max + "</li></ul>" +
        '<p class="muted small" id="rdLen">&nbsp;</p>' +
        '<div class="bars">' + bars + "</div>" +
        '<p class="muted small">' + (R.hasHour ? "Four pillars from your birth date and time." : "Three pillars from your birth date (year, month, day). Your birth hour would add a fourth.") +
        " Solar terms converted to " + esc(BY.zoneLabel(R.zone)) + " time.</p>";
      return el;
    }
    function actions(end) {
      var d = document.createElement("div"); d.className = "actions rd-actions no-print rise";
      d.innerHTML = '<button class="btn" type="button" data-act="story">Save story image</button><button class="btn btn--ghost" type="button" data-act="pdf">Save as PDF</button>' +
        (end ? '<button class="btn btn--ghost" type="button" data-act="share">Share this reading</button>' : "");
      return d;
    }
    function wireActions(info, title) {
      [].forEach.call(out.querySelectorAll("[data-act]"), function (b) {
        b.addEventListener("click", function () {
          var a = b.getAttribute("data-act");
          if (a === "pdf") { BY.track("pdf-" + P.slug, "Save as PDF: " + P.slug); window.print(); }
          if (a === "answers") { intake(answers); return; }
          // the ex reading's title never goes on anything public: share text and story card use a neutral title
          var pub = /ex-come-back/.test(P.slug) ? "My saju reading" : title;
          if (a === "share") BY.track("share-reading-" + P.slug, "Shared the reading link: " + P.slug);
          if (a === "story") BY.track("share-story-" + P.slug, "Share image: story card (" + P.slug + ")");
          if (a === "share") BY.share(pub, "Bom and Yeon read my chart: " + pub, "https://bomandyeon.com/readings/" + P.slug + "/");
          if (a === "story" && BY.storyCard) BY.storyCard(pub === title ? info : Object.assign({}, info, { title: pub }));
        });
      });
    }
    function bondBox(R, s, them) {
      var box = document.createElement("div"), slug = pairSlug(R.dayMaster, R.partner.dayMaster), pd = PAIRS[slug] || {};
      var BR = { combo: "Your day branches, the 'spouse palace' in saju, are in harmony: an extra plus the type score doesn't count.",
        clash: "Your day branches, the 'spouse palace' in saju, clash: expect more friction day to day than the type score shows.",
        neutral: "Your day branches, the 'spouse palace' in saju, are neutral with each other." };
      box.className = "card center rise";
      box.innerHTML = '<p class="kicker">You and them</p><div class="duo"><span style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + '</span><i>+</i><span style="color:' + D.EL_COLOR[them.el] + '">' + them.hanja + "</span></div>" +
        '<p class="score">' + R.compat.score + '%</p><p class="verdict">' + esc(pd.v || "") + "</p>" +
        '<p class="muted">' + esc(pd.x || "") + '</p><p class="muted small">' + esc(BR[R.compat.branch] || "") + " Same score as the pair page: it compares your two Day Masters.</p>" +
        '<a class="link-arrow" href="/compatibility/' + slug + '/">' + esc(s.name + " + " + them.name) + " in full</a>";
      return box;
    }
    /* after a paid reading: one card offering All Readings instead of the whole shelf */
    function upsell() {
      var box = $("rdCross"), shelf = box.querySelector(".shelf"); if (!shelf || box.querySelector(".upsell")) return;
      shelf.hidden = true;
      var c = document.createElement("div"); c.className = "card upsell center rise";
      c.innerHTML = '<p class="kicker">All Readings</p><h3>Every Bom and Yeon reading, one birthday</h3><p class="muted">Love, exes, situationships, your 2027, work style and the rest. Your birthday is already saved, so each one opens straight away.</p>' +
        '<p class="pw-price"><s>$' + PAY.anchor(29.99) + '</s> <strong>$29.99</strong></p>' + PAY.buyLink("all-readings", "Get All Readings · $29.99") +
        '<p class="small pw-promise">' + PAY.guarantee + " " + PAY.methods + "</p>" + PAY.statusEl("all-readings") + '<p class="small"><a href="/readings/all-readings/">See what\'s inside</a></p>';
      shelf.parentNode.insertBefore(c, shelf);
      PAY.watch("all-readings", function () { c.innerHTML = '<p class="kicker">All Readings</p><h3>Done. Every reading is yours.</h3><p class="muted">Bom saved them all to this browser. Pick the next one.</p>'; shelf.hidden = false; });
    }
    function mins(w) { return Math.max(1, Math.round(w / 238)); }
    function aboutThis(R, L) {
      var words = L.words, min = mins(words);
      return '<section class="rise chap about-reading"><p class="kicker">About this reading</p><p class="muted small">This reading is ' + words.toLocaleString("en-US") + " words in " + L.chapters + " chapters and " + L.panels + " panels, roughly " + min + " minute" + (min > 1 ? "s" : "") + " of reading. " +
        (R.hasHour ? "It uses four pillars: your birth year, month, day and hour. " : "It uses three pillars: your birth year, month and day. A birth hour would add a fourth. ") +
        "It doesn't include your 10-year luck cycles (대운), which traditional readers use for timing. If you were born between 11 pm and midnight, some saju schools count you as the next day's Day Master" +
        (PAIR ? ". The chapter on the two of you compares your Day Masters (and notes your day branches); a full Korean compatibility reading (궁합) compares both whole charts" : "") +
        ". For entertainment and self-reflection.</p></section>";
    }
    /* the "what backs you up" line above the strength chapter (same count as the cover card) */
    function strengthHow(R) {
      var names = { season: R.seasonKey === "earth" ? "your season (the Earth days)" : "your season (" + R.seasonElName + " in command)", day_branch: "your day branch", year_branch: "your year branch", hour_branch: "your hour branch",
        year_stem: "your year stem", month_stem: "your month stem", hour_stem: "your hour stem" };
      var yes = R.strengthParts.filter(function (p) { return p.ok; }).map(function (p) { return names[p.part]; });
      return "Bom and Yeon count what backs your " + D.EL_NAMES[R.dayMasterEl] + " up: your own element or the one that feeds it. " +
        (yes.length ? "Support comes from " + yes.join(", ") + "." : "None of your pillars carries it.") + " That is " + R.strengthScore + " of " + R.strengthMax + " points, with the season worth the most. A simplified count from the pillars we have.";
    }
  }

  if (P.mode === "read") readPage(); else productPage();
})();
