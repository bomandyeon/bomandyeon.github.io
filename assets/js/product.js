/* Product page (preview) and reading page (full personalized webtoon). One file, mode from window.BY_PRODUCT.mode.
 * P4 (v4 content): both pages assemble the reading with BYAssembleV4 (assemble-v4.js, see work/content-v4/SCHEMA.md).
 * Product page loads /readings/<slug>/preview.json only (the first two plan chapters per Day Master).
 * Reading page loads one file per Day Master (/readings/<slug>/read/d/<dm>.<hash>.json): the v4 layers for that reader
 * plus the 10 pair texts that involve them. Ex + situationship ask up to 3 optional questions first (step by step, skippable);
 * the answers are kept with the birthdays (BY.urlState, site.js): the address only shows ?s=<id>, never a date or an answer. */
(function () {
  "use strict";
  /* Public site: every reading opens free. Paid flow (Gumroad overlay, pay.js) only in paytest mode (?paytest=1). */
  var BY = window.BY, D = window.BY_DATA, P = window.BY_PRODUCT, $ = BY.$, esc = BY.esc, PL = window.BYPlan, PAIRS = window.BY_PAIRS || {}, A4 = window.BYAssembleV4;
  if (!P) return;
  var PAY = BY.pay && BY.pay.on ? BY.pay : null; // null = free (public)
  if (P.mode !== "read") BY.store("pick", { s: P.slug, t: Date.now() }); // home's next step after the free Soul Type points back here
  var THANKS = { bom: "Thank you. Bom is putting the kettle on. Your whole comic is below.", yeon: "Paid and opened. Yeon says thanks, then gets straight to the point." };
  var EL_LOWER = ["wood", "fire", "earth", "metal", "water"];
  var SEASON_HZ = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  var ART = P.art || [1, 2, 3, 4, 11, 12];
  var EXTRA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(function (n) { return ART.indexOf(n) < 0; });
  var ARTS = ART.concat(EXTRA); // v4 readings have 21-28 panels: cycle through all 12 images, the product's own six first
  var PAIR = P.pair || (P.two ? "required" : "");
  var THEIR_KEY = PAIR === "optional" ? "their_" + P.slug : "their";
  // round 3 2026-11-07: couple-reading needs both birthdays again (needTheir); situationship stays "start with yours"
  var NEED_THEIR = PAIR === "required" && !!P.needTheir;
  var NEED_MSG = "Add their birthday too. This comic compares your two charts, so it needs both.";
  /* chapters that use the second birthday (partner keys in assemble-v4.js partKey): only those say "Written for you + them" */
  var THEM_KEYS = { partner_dm: 1, partner_strength: 1, partner_season: 1, partner_el: 1, tengod: 1, el_rel: 1, stem_rel: 1, branch_rel: 1, pair_strength: 1 };
  function usesThem(c) { return c.type === "pair" || (c.parts || []).some(function (x) { return THEM_KEYS[x.key]; }); }
  BY.fillSelects();

  /* inputs from the link: ?s=<id> (this browser), &x=<code> (emailed link), or an old ?b=&t=&a= link (rewritten below) */
  var US = BY.urlState ? BY.urlState.read() : null;
  var birth = (US && US.b) || BY.load("birth"), their = PAIR ? ((US && US.t) || BY.load(THEIR_KEY)) : null, name = BY.load("name") || "";

  /* optional intake answers (ex + situationship): {qid: value}; URL form a=v1.v2.v3 in intake order */
  var INTAKE = P.intake || [], ANS_KEY = "ans_" + P.slug, NO_WIZ_Q = { situationship: 1 };
  function cleanAns(o) {
    if (!o || typeof o !== "object") return null;
    var r = {}, n = 0;
    INTAKE.forEach(function (q) { var v = o[q.id]; if (v === q.skip_value || q.options.some(function (x) { return x.value === v; })) { r[q.id] = v; n++; } });
    return n === INTAKE.length ? r : null;
  }
  function qsAns() {
    if (!US || !US.a || !INTAKE.length) return null;
    var v = US.a.split("."), o = {}; INTAKE.forEach(function (q, i) { o[q.id] = v[i]; }); return cleanAns(o);
  }
  var answers = INTAKE.length ? (qsAns() || cleanAns(BY.load(ANS_KEY))) : {};
  var QS = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var PRINT = P.mode === "read" && QS.get("print") === "1", FROM_GR = QS.get("from") === "gumroad";
  /* reading inputs as one object (r= at checkout, in the purchase email and in the worker's record for the key) */
  function stateObj() {
    if (!birth) return null;
    var o = { v: 1, s: P.slug, b: BY.iso(birth) }, mine = BY.load("birth"), bt = mine && BY.iso(mine) === BY.iso(birth) ? BY.load("btime") : null;
    if (bt && bt.h != null) { o.h = bt.h; o.mi = bt.mi || 0; }
    o.z = BY.birthZone();
    if (PAIR && their) o.t = BY.iso(their);
    if (INTAKE.length && answers) o.a = INTAKE.map(function (q) { return answers[q.id]; }).join(".");
    if (name) o.n = String(name).slice(0, 24);
    return o;
  }
  /* apply inputs that came with a link or with the worker's record: stored like the form would store them */
  function applyState(o) {
    var b = o && BY.fromIso(o.b); if (!b) return false;
    birth = b; BY.store("birth", b);
    var h = o.h === "" || o.h == null ? null : +o.h;
    BY.store("btime", h != null && h >= 0 && h < 24 ? { h: h, mi: Math.max(0, Math.min(59, +o.mi || 0)) } : null);
    if (typeof o.z === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(o.z)) BY.store("bzone", o.z);
    var t = BY.fromIso(o.t); if (PAIR && t) { their = t; BY.store(THEIR_KEY, t); }
    if (INTAKE.length && typeof o.a === "string") {
      var v = o.a.split("."), m = {}; INTAKE.forEach(function (q, i) { m[q.id] = q.options.some(function (x) { return x.value === v[i]; }) ? v[i] : q.skip_value; });
      var c = cleanAns(m); if (c) { answers = c; BY.store(ANS_KEY, c); }
    }
    if (typeof o.n === "string" && o.n.trim()) { name = o.n.trim().slice(0, 24); BY.store("name", name); }
    return true;
  }
  (function () {
    var pay = BY.pay && BY.pay.on ? BY.pay : null; if (!pay) return;
    pay.setState(stateObj);
    var r = QS.get("r"); if (!r) return;
    applyState(pay.decState(r));
  })();
  /* the address never keeps a readable birthday: old ?b= links, emailed x= and r= become ?s=<id> right away */
  if (BY.urlState && (QS.get("r") || (US && US.via !== "s") || QS.get("b") || QS.get("t") || QS.get("a"))) BY.urlState.clean(birth ? urlObj() : null);
  function ansFor() { var o = Object.assign({}, answers || (function () { var z = {}; INTAKE.forEach(function (q) { z[q.id] = q.skip_value; }); return z; })()); try { var m = BY.load("mood_" + P.slug); if (m) o.mood = m; } catch (e) {} return o; }
  function ansStr() { return INTAKE.length && answers ? INTAKE.map(function (q) { return answers[q.id]; }).join(".") : ""; }
  function urlObj() { return { b: birth, t: PAIR && their ? their : null, a: ansStr() }; }
  // funnel fix 2026-11-07: a two-birthday reading can start (and open after paying) with your own birthday only
  function soloOk() { return PAIR === "required" && !NEED_THEIR && !!BY.load("solo_" + P.slug); }
  function ready() { return !!birth && (PAIR !== "required" || !!their || soloOk()); }
  /* owned reading: straight to the comic; the read page asks for birthdays itself when they are missing */
  function goRead(replace) { var u = ready() ? readUrl() : P.readUrl; if (replace) location.replace(u); else location.href = u; }
  /* portable = the link leaves this browser (email): it carries the scrambled inputs too */
  function readUrl(portable) { return P.readUrl + BY.urlState.query(urlObj(), portable); }
  function pairSlug(a, b) { var x = Math.min(a, b), y = Math.max(a, b); return D.SLUGS[x] + "-and-" + D.SLUGS[y]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function who(sp) { return sp === "yeon" ? "Yeon" : "Bom"; }
  function analyze() { return BY.analyze(birth, PAIR && their ? their : null); }

  /* read the optional "their birthday" selects: all empty -> null, partly filled -> error */
  function readTheir(form) {
    var any = false;
    ["tm", "td", "ty"].forEach(function (k) { var el = form.querySelector('[name="' + k + '"]'); if (el && String(el.value || "").trim()) any = true; });
    if (!any) { if (NEED_THEIR) return { error: NEED_MSG, missing: true }; if (PAIR === "required") BY.store("solo_" + P.slug, 1); return null; } // funnel fix 2026-11-07: theirs is optional (not for couple)
    return BY.readDate(form, "t");
  }
  function readForm(form, errEl) {
    var b = BY.readDate(form, "b");
    if (b.error) { errEl.textContent = "Your birthday: " + b.error; return false; }
    var t = PAIR ? readTheir(form) : null;
    if (t && t.error) { errEl.textContent = t.missing ? t.error : "Their birthday: " + t.error; return false; }
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
  /* copy rewrite 2026-10-21: a paragraph that starts "Bom: " or "Yeon: " is a speech bubble inside the chapter text */
  var SAY_RE = /^(Bom|Yeon):\s+([\s\S]+)$/;
  /* chapter text: paragraphs split on blank lines, "### X" lines are sub-headings */
  function textHTML(t) {
    return String(t || "").split(/\n\s*\n/).map(function (b) {
      b = b.trim(); if (!b) return "";
      var m = /^### (.+?)(?:\n([\s\S]*))?$/.exec(b);
      if (m) return "<h4>" + esc(m[1].trim()) + "</h4>" + (m[2] && m[2].trim() ? "<p>" + esc(m[2].trim()) + "</p>" : "");
      var sy = SAY_RE.exec(b); if (sy) return '<p class="tx-say tx-say--' + sy[1].toLowerCase() + '"><b>' + sy[1] + "</b> " + esc(sy[2]) + "</p>";
      return "<p>" + esc(b) + "</p>";
    }).join("");
  }
  function chapterHTML(title, text, kicker, pre) { return '<section class="rise chap">' + "<h3>" + esc(title) + "</h3>" + (kicker ? '<p class="hsub">' + esc(kicker) + "</p>" : "") + (pre || "") + textHTML(text) + "</section>"; }
  /* one assembled v4 chapter -> [webtoon, text] (art cycles through all panel images) */
  function v4Panels(ch, artAt) { return webtoon(ch.panels.map(function (p) { return panel(ARTS[artAt() % ARTS.length], p, p.nar || null); })); }
  /* ---------- comic chapters: the chapter's own scene stays pinned while the text scrolls over it in caption boxes ---------- */
  var SC = window.BY_SCENES || {};
  function sceneFor(chId, R) {
    var k = chId === "season" ? "season/" + R.season : chId === "strength" ? "soul/" + D.SOULS[R.dayMaster].slug : P.slug + "/" + chId;
    if (!SC[k] && chId === "pair") k = "soul/" + D.SOULS[(R.partner || R).dayMaster].slug;
    return SC[k] ? { src: "/assets/img/scenes/" + k + ".webp", w: SC[k][0], h: SC[k][1] } : null;
  }
  /* v6 2026-11-06 (art curation): on the free preview, chapter 1 (the season chapter, whose shared garden scene drew Yeon
     off-model and repeated on every page) and, where the reading's own chapter 2 scene was off-brief, chapter 2 show one of
     this reading's own on-model scenes instead. Only the free preview; the paid reading keeps every chapter's own scene. */
  var LANDER_ART = {
    "will-your-ex-come-back": ["the-pull", "your-story"], "situationship": ["either-way"], "what-kind-of-lover": ["attachment", "the-fight"],
    "brutally-honest": ["the-fix"], "couple-reading": ["the-home"], "glow-up-aura": ["vibe"], "k-pop-position": ["the-encore"],
    "work-style": ["your-desk"], "your-2027": ["the-plan"]
  };
  var ART_AVOID = { "will-your-ex-come-back/why-it-ended": 1, "what-kind-of-lover/how-you-fall": 1, "what-kind-of-lover/red-flag": 1, "what-kind-of-lover/what-you-need": 1 };
  function sceneKey(k) { return SC[k] ? { src: "/assets/img/scenes/" + k + ".webp", w: SC[k][0], h: SC[k][1] } : null; }
  function landerScene(ci) { var a = (LANDER_ART[P.slug] || [])[ci]; return a ? sceneKey(P.slug + "/" + a) : null; }
  /* text -> beats: paragraphs, long ones split at a sentence near the middle; "### X" becomes the beat's label */
  function beats(t) {
    var out = [];
    String(t || "").split(/\n\s*\n/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      var lab = null, m = /^### (.+?)(?:\n([\s\S]*))?$/.exec(b);
      if (m) { lab = m[1].trim(); b = (m[2] || "").trim(); if (!b) { out.push({ label: lab, text: "" }); return; } }
      var sy = SAY_RE.exec(b); if (sy) { if (lab) out.push({ label: lab, text: "" }); out.push({ say: sy[1].toLowerCase(), text: sy[2].trim() }); return; }
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
  /* v4 2026-11-06: the strip reads as a vertical webtoon, not a chat log.
     - each chapter's scene is cut differently (tall establishing shot, wide shot, close shot; same art, different crop)
     - the first one or two beats of a scene sit over the bottom of its panel (only the lower band: legs, torsos, never faces)
     - a second, wide detail cut of the same scene opens the narration
     - the face avatar shows once per speaker per chapter; after that the bubble style carries who is talking
     - bubbles size to their line; gutters are tight inside a quick exchange and wide between beats (CSS)
     Every line of text, its order and its speaker stay exactly as assembled. */
  var CROPS = ["tall", "wide", "close"];
  function subline(k, s) {
    // the chapter's old eyebrow: keep only what the page doesn't already say (the type name sits in the reveal above)
    k = String(k || "").replace(/^\s*[\u3400-\u9FFF]+\s*\u00B7\s*/, "");
    [s.nick, s.name].forEach(function (n) { if (!n) return; k = k.split(n + " \u00B7 ").join("").split(" \u00B7 " + n).join(""); if (k.replace(/[.\s]/g, "") === n.replace(/\s/g, "")) k = ""; });
    k = k.trim(); if (/^[\u3400-\u9FFF\s.\u00B7]*$/.test(k)) return "";
    return k.charAt(0).toUpperCase() + k.slice(1);
  }
  function comicChapter(ch, R, artAt, opts) {
    opts = opts || {};
    var sc = opts.scene || sceneFor(ch.id, R), s = D.SOULS[R.dayMaster], sec = document.createElement("section");
    var ci = artAt ? artAt() : 0, crop = CROPS[ci % CROPS.length];
    sec.className = "comic comic--" + crop + (sc ? "" : " comic--plain");
    var sub = subline(ch.kicker, s);
    var head = '<header class="comic__title"><h3>' + esc(ch.title || "") + "</h3>" + (sub ? '<p class="comic__sub">' + esc(sub) + "</p>" : "") + "</header>";
    var bg = sc ? 'style="background-image:url(' + sc.src + ')"' : "";
    var stage = sc ? '<div class="comic__stage comic__stage--' + crop + '" aria-hidden="true"><div class="comic__img" ' + bg + '></div></div>' : "";
    var items = [];
    (ch.panels || []).forEach(function (p) {
      // the assembler's type tag ("己 · The Garden Field.") repeats the reveal right above it: not shown. Written narration always is.
      if (p.nar && !(p.nar === s.hanja + " \u00B7 " + s.nick + "." || p.nar === s.hanja + " \u00B7 " + s.name + ".")) items.push({ k: "nar", text: p.nar });
      items.push({ k: "say", w: who(p.speaker).toLowerCase(), text: p.text });
    });
    if (opts.pre) items.push({ k: "note", html: opts.pre });
    var list = opts.blocks ? [] : beats(ch.text);
    if (opts.blocks) opts.blocks.forEach(function (b) { beats(b.t).forEach(function (x, i) { list.push({ label: i ? x.label : b.h, text: x.text }); }); if (b.note) list.push({ label: null, text: b.note, note: true }); });
    list.forEach(function (b) { items.push(b.say ? { k: "say", w: b.say, text: b.text } : { k: "cap", label: b.label, text: b.text, note: b.note }); });
    // v5 2026-11-06: one panel per image (no second "detail" cut of the same scene), bubbles after the panel, never over it.
    // Every bubble sits on the left like a webtoon column, offset by speaker (Bom a little in, Yeon further in); consecutive
    // lines of one speaker are one group (tail and face only on the group's first line). On /read/ (opts.silent) a silent
    // full-width panel of another scene from this reading comes in every ~5 beats. Every line, its order and speaker unchanged.
    var seen = {}, html2 = head + stage + '<div class="comic__beats">', prev = null, since = 0, n = 0;
    items.forEach(function (it) {
      if (opts.silent && sc && since >= 5 && !(it.k === "say" && prev === it.w)) {
        var a = opts.silent();
        if (a) { html2 += '<div class="comic__stage comic__stage--silent" aria-hidden="true"><div class="comic__img" style="background-image:url(' + a.src + ');background-position:' + a.pos + '"></div></div>'; since = 0; prev = null; }
      }
      if (it.k === "say") {
        var first = !seen[it.w], cont = prev === it.w; seen[it.w] = 1;
        html2 += '<div class="beat beat--say beat--' + it.w + (first ? " beat--av" : " beat--noav") + (cont ? " beat--cont" : " beat--head") + '">' +
          (first ? '<span class="av av--' + it.w + '"><img src="/assets/img/av-' + it.w + '.webp" alt="" width="44" height="44"></span>' : "") +
          '<p class="bubble"><b>' + who(it.w) + "</b>" + esc(it.text) + "</p></div>";
        prev = it.w; since++;
        return;
      }
      prev = null;
      if (it.k === "nar") {
        html2 += '<div class="beat beat--nar"><p>' + esc(it.text) + "</p></div>"; since++;
      } else if (it.k === "note") {
        html2 += '<div class="beat beat--cap beat--note"><p>' + it.html + "</p></div>";
      } else {
        html2 += '<div class="beat beat--cap' + (it.note ? " beat--note" : "") + '" data-i="' + (n++) + '">' + (it.label ? "<h4>" + esc(it.label) + "</h4>" : "") + (it.text ? "<p>" + esc(it.text) + "</p>" : "") + "</div>";
        if (it.text) since++;
      }
    });
    html2 += "</div>" + (opts.tail || "");
    sec.innerHTML = html2;
    [].forEach.call(sec.querySelectorAll(".beat, .comic__title"), function (b) { b.classList.add("rise"); });
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
  var TYPE_NAMES = { season: "You, in one page", strength: "Your blind spot (Yeon has notes)", pair: "You and them" };
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
      " " + esc(BY.zoneLabel(R.zone)) + " time. With no birth time we read noon, so your saju month is " + esc(T.month) + ". Born " + esc(alt) + "? You'd be " + esc(T.altMonth) +
      (T.yearChanges ? ", in a " + esc(T.altYear) + " " + esc(T.altAnimal) + " year" : "") + ". Add your birth time to the form to be exact.</div>";
  }
  function strengthWord(R) { return R.dmStrength === "strong" ? "Strong chart" : "Weak chart"; }
  // final 2026-11-07: plain tag, same wording as the strength chapter kicker (no "N of 8")
  function strengthTag(R) { var el = D.EL_NAMES[R.dayMasterEl]; return R.dmStrength === "strong" ? "Strong \u00B7 plenty backing your " + el : "Soft \u00B7 not much backing your " + el; }

  /* ======================= PRODUCT PAGE ======================= */
  /* SajuTight-style funnel (2026-10-21): one question per screen with a step counter.
     Situation taps (the reading's own intake questions, or one cover question) -> your birthday (pre-filled) -> their birthday
     (where the reading uses it) -> birth time ("I don't know" is fine) -> your four pillars -> a short Bom/Yeon moment ->
     teaser (no email step since 2026-10-21 teaser UX): comic cover + first two chapters + the rest of the chapter titles,
     personalised and locked -> paywall (this reading or the whole shelf). Everything entered is kept in this browser and
     pre-fills every other reading. */
  function productPage() {
    // a key (email button, pasted key, old receipt links) or Gumroad's "Open my comic" button: the read page opens the reading
    if (PAY && (PAY.hasKey() || FROM_GR)) { location.replace(P.readUrl + location.search); return; }
    var wiz = $("pvWizard"), out = $("pvOut"), form = $("pvForm"), dataP = null;
    var MOOD = P.mood || null, MOOD_KEY = "mood_" + P.slug, DONE_KEY = "wiz_" + P.slug;
    var CH = P.chapters || [], SHELF = P.shelf || null;
    var fromLink = !!(US && US.b);
    var solo = false; // situationship "Start with yours": their birthday comes before the paywall
    document.body.classList.add("is-flow");
    if (BY.sessionSrc) BY.trackOnce("land-" + BY.sessionSrc() + "-" + P.slug, "Landed (" + BY.sessionSrc() + "): " + P.slug + " " + location.pathname);
    function data() { if (!dataP) dataP = fetch(P.dataUrl).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); }); return dataP; }
    function smooth() { return BY.reduced ? "auto" : "smooth"; }
    function extras(show) { [].forEach.call(document.querySelectorAll(".pv-faq, .pv-more, .pv-article"), function (x) { x.hidden = !show; }); }

    /* ---------- one-page flow (2026-11-05): the hero form is the only step before the comic ----------
       birthday (their birthday too where the reading compares two charts) -> "Show my comic" -> type reveal, chapter 1,
       optional chips, chapter 2, paywall on this same page. No wizard, no reload. */
    function wireForm() {
      if (!form) return;
      BY.fillSelects(form);
      if (birth) BY.setDate(form, "b", birth);
      BY.knownBirth(form);
      if (PAIR === "required" && their) BY.setDate(form, "t", their);
      var err = form.querySelector(".err");
      if (PAIR === "required") pairStep();
      if (NEED_THEIR) { var tfc = form.querySelector(".tfield"); if (tfc) ["input", "change", "click"].forEach(function (ev) { tfc.addEventListener(ev, function () { setTimeout(function () { var t2 = BY.readDate(form, "t"); if (!t2.error) { tfc.classList.remove("is-missing"); if (err.textContent === NEED_MSG) err.textContent = ""; } }, 0); }); }); }
      // round 2: form-started-<slug> = first real interaction with the birthday picker (tap, key, pick), once per session.
      // Only the event name is sent, never a value.
      var started = function (e) {
        if (!e.isTrusted || !e.target || !e.target.closest || !e.target.closest(".selects, .mchip, .bfield, .tfield, .bknown, select, input")) return;
        ["pointerdown", "keydown", "change", "input"].forEach(function (t) { form.removeEventListener(t, started, true); });
        BY.trackOnce("form-started-" + P.slug, "Birthday picker first used: " + P.slug);
      };
      ["pointerdown", "keydown", "change", "input"].forEach(function (t) { form.addEventListener(t, started, true); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var known = form.querySelector(".bknown"), usingKnown = known && !known.hidden && birth;
        var b = usingKnown ? birth : BY.readDate(form, "b");
        if (b.error) { err.textContent = "Your birthday: " + b.error; return; }
        var t = null;
        if (NEED_THEIR) {
          // round 3 2026-11-07: couple needs both. A missing date opens their picker and says so right above the button.
          var tf = form.querySelector(".tfield");
          t = BY.readDate(form, "t");
          if (t.error) {
            var none = !["tm", "td", "ty"].some(function (k) { var el = form.querySelector('[name="' + k + '"]'); return el && String(el.value || "").trim(); });
            if (tf) { tf.classList.remove("is-wait"); tf.classList.add("is-missing"); }
            err.textContent = none ? NEED_MSG : "Their birthday: " + t.error;
            BY.trackOnce("their-missing-" + P.slug, "Tapped Show my comic without their birthday: " + P.slug);
            var fc = tf && (tf.querySelector('.mchip[aria-pressed="true"]') || tf.querySelector(".mchip, select, input"));
            if (fc) { try { fc.focus({ preventScroll: true }); } catch (x) { fc.focus(); } }
            if (tf && tf.scrollIntoView) tf.scrollIntoView({ behavior: smooth(), block: "center" });
            return;
          }
          if (tf) tf.classList.remove("is-missing");
        } else if (PAIR === "required" && !solo) {
          // funnel fix 2026-11-07: your own birthday is enough to start. Their birthday is optional (one chapter compares the two
          // charts); an untouched picker means "start with mine", a half-filled one still asks to finish it.
          var tAny = ["tm", "td", "ty"].some(function (k) { var el = form.querySelector('[name="' + k + '"]'); return el && String(el.value || "").trim(); });
          if (!tAny) { solo = true; BY.track("solo-start-" + P.slug, "Started with own birthday only: " + P.slug); }
          else {
            t = BY.readDate(form, "t");
            if (t.error) { err.textContent = "Their birthday: " + t.error + " Or leave it empty and start with yours."; return; }
          }
        }
        err.textContent = "";
        go(b, t);
      });
      var sb = form.querySelector("[data-solo]");
      if (sb) sb.addEventListener("click", function () {
        var known = form.querySelector(".bknown"), usingKnown = known && !known.hidden && birth;
        var b = usingKnown ? birth : BY.readDate(form, "b");
        if (b.error) { err.textContent = "Your birthday: " + b.error; return; }
        err.textContent = ""; solo = true; BY.track("solo-start-" + P.slug, "Started with own birthday only: " + P.slug);
        go(b, null);
      });
    }
    /* v4 2026-11-06 (two birthdays on one phone screen): your birthday folds to one line once it is complete, and their
       picker opens in its place. "change" opens yours again. A saved birthday starts folded (the .bknown line). */
    function pairStep() {
      var bf = form.querySelector(".bfield"), sum = form.querySelector(".bsum"), tf = form.querySelector(".tfield"), kn = form.querySelector(".bknown");
      if (!bf || !sum || !tf) return;
      var knownOn = function () { return kn && !kn.hidden; };
      var fold = function () {
        if (knownOn()) { tf.classList.remove("is-wait"); return; }
        var b = BY.readDate(form, "b"); if (b.error) return;
        sum.querySelector("[data-bsum]").textContent = BY.prettyDate(b);
        bf.hidden = true; sum.hidden = false; tf.classList.remove("is-wait");
        var er = form.querySelector(".err"); if (er && /^Your birthday/.test(er.textContent)) er.textContent = "";
      };
      if (knownOn()) tf.classList.remove("is-wait");
      bf.addEventListener("input", function (e) { var k = e.target.getAttribute && e.target.getAttribute("data-kind"); if (k === "y" && e.target.value.length === 4) fold(); });
      bf.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".mchip")) setTimeout(function () { var y = form.querySelector('[name="by"]'); if (y && y.value.length === 4) fold(); }, 0); });
      var ed = sum.querySelector("[data-bedit]");
      if (ed) ed.addEventListener("click", function () { sum.hidden = true; bf.hidden = false; var c = bf.querySelector('.mchip[aria-pressed="true"]') || bf.querySelector(".mchip"); if (c) c.focus(); });
      if (kn) { var ch = kn.querySelector("[data-bchange]"); if (ch) ch.addEventListener("click", function () { tf.classList.remove("is-wait"); }); }
    }
    function go(b, t) {
      if (!birth || BY.iso(birth) !== BY.iso(b)) BY.store("btime", null); // a different birthday: the old birth time doesn't belong to it
      birth = b; BY.store("birth", b);
      if (PAIR) { their = t || (PAIR === "optional" ? their : null); BY.store(THEIR_KEY, their); }
      if (PAIR === "required" && !NEED_THEIR) BY.store("solo_" + P.slug, their ? null : 1);
      BY.store(DONE_KEY, 1);
      BY.trackOnce("birthday-submit-" + P.slug, "Birthday submitted: " + P.slug); // funnel fix 2026-11-07: one per session
      try { if (BY.urlState) BY.urlState.clean(urlObj()); } catch (x) { /* ignore */ }
      wiz.hidden = false;
      wiz.scrollIntoView({ behavior: smooth(), block: "start" });
      loading(function () {
        // 2026-11-06: no jump. The comic is built while the loader still holds the spot, then swaps in at the same place.
        var done = function () { wiz.hidden = true; wiz.innerHTML = ""; var hd = document.querySelector(".top"), off = (hd ? hd.getBoundingClientRect().height : 56) + 8; window.scrollTo({ top: Math.max(0, out.getBoundingClientRect().top + window.scrollY - off), behavior: "instant" }); };
        var pr = renderPreview(false); if (pr && pr.then) pr.then(done, done); else done();
      });
    }

    /* a short honest beat: the chart is already worked out, Bom and Yeon just pick your chapters */
    var LINES = [["bom", "Drawing your comic\u2026"], ["yeon", "Writing the parts you won\u2019t like."]];
    function loading(done) {
      var i = 0, R = analyze(), s = D.SOULS[R.dayMaster];
      try { var pre = new Image(); pre.src = (document.querySelector(".phero__cover img") || {}).currentSrc || ""; } catch (x) { /* ignore */ }
      wiz.innerHTML = '<div class="wiz-load" role="status" aria-live="polite"><p class="wiz-load__k">Making your comic</p><p class="wiz-load__dm2">' + esc(s.nick) + '</p><div class="wiz-load__say"></div></div>';
      var box = wiz.querySelector(".wiz-load__say"), ms = BY.reduced ? 200 : 450;
      (function tick() {
        if (i >= LINES.length) { done(); return; }
        var l = LINES[i++], w = who(l[0]);
        box.innerHTML = '<div class="say say--' + l[0] + '"><span class="av av--' + l[0] + '"><img src="/assets/img/av-' + l[0] + '.webp" alt="" width="44" height="44"></span><p class="bubble"><b>' + w + "</b>" + esc(l[1]) + "</p></div>";
        setTimeout(tick, ms);
      })();
    }
    /* ---------- teaser ---------- */
    function moodLine(R, s) {
      var m = MOOD && BY.load(MOOD_KEY), o = m && MOOD.options.filter(function (x) { return x.value === m; })[0];
      if (o) return { who: o.who || "yeon", text: o.line };
      return { who: P.voice || "yeon", text: D.SPICY[R.dayMaster][P.spicy != null ? P.spicy : 4] };
    }
    function heavyLight(R) {
      var c = R.counts, mx = 0, mn = 0;
      c.forEach(function (v, i) { if (v > c[mx]) mx = i; if (v < c[mn]) mn = i; });
      return { heavy: D.EL_NAMES[mx], light: D.EL_NAMES[mn], none: c[mn] === 0 };
    }
    function ansLabels() {
      if (!INTAKE.length || !answers) return [];
      return INTAKE.map(function (q) { var o = q.options.filter(function (x) { return x.value === answers[q.id]; })[0]; return answers[q.id] === q.skip_value || !o ? null : o.label; }).filter(Boolean);
    }
    function lockTitle(c, R, s, them) {
      var t = planTitle(c), hl;
      if (c.type === "strength") return "Your blind spot (Yeon has notes)";
      if (c.type === "balance") return c.title || "Too much of one thing, none of another";
      if (c.type === "pair") return them ? "You (" + s.nick + ") and them (" + them.nick + ")" : "You and them (add their birthday for this one)";
      if (name && /^Your\s/.test(t)) t = name + "'s " + t.slice(5);
      return t;
    }
    function lockKicker(c, s, them) {
      if (c.type === "situation") { var a = ansLabels(); if (a.length) return "Because you said: " + a.join(" · "); }
      return "Written for " + s.nick + (them && c.type !== "pair" && PAIR && usesThem(c) ? " + " + them.nick : ""); // round 3: only chapters that read theirs
    }
    /* teaser UX 2026-10-21: the result opens with the COMIC. The reading's cover art as a webtoon panel with Bom + Yeon speech
       bubbles, then a plain-English headline ("You're Sin Metal. The Jewel.") and one human line. The hanja chart sits folded below. */
    var HOW = { "will-your-ex-come-back": "how you love", "situationship": "how you love", "what-kind-of-lover": "how you love", "couple-reading": "how you love",
      "work-style": "how you work", "k-pop-position": "how you shine in a group", "glow-up-aura": "how people see you", "brutally-honest": "who you are, minus the filter" };
    function coverImg() { var im = document.querySelector(".phero img"); return im ? { src: im.getAttribute("src"), set: im.getAttribute("srcset") || "", alt: im.getAttribute("alt") || "" } : null; }
    function chartHTML(R, s, them, cols) {
      return '<details class="tz-chart"><summary>See the chart</summary><div class="tz-chart__b">' +
        '<div class="pillars' + (cols.length > 3 ? " pillars--4" : "") + '">' + cols.map(function (c) {
          var p = c[1]; return '<div class="pillar' + (c[0] === "Day" ? " is-dm" : "") + '"><span class="pl-l">' + c[0] + '</span><span class="hz" style="color:' + D.EL_COLOR[p.stemEl] + '">' + p.stemHanja +
            '</span><span class="hz" style="color:' + D.EL_COLOR[p.branchEl] + '">' + p.branchHanja + '</span><span class="pl-e">' + p.stemEl + " · " + p.animal + "</span></div>";
        }).join("") + "</div>" +
        '<p class="small muted">Saju turns your birth date' + (R.pillars.hour ? " and time" : "") + ' into these columns: year, month, day' + (R.pillars.hour ? ", hour" : "") +
        '. The top of the Day column, <span class="hz" style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + "</span>, is your birthday type: " + esc(s.name) + ". Your comic is written from it." +
        (them ? " Theirs is " + esc(them.name) + ' (<span class="hz" style="color:' + D.EL_COLOR[them.el] + '">' + them.hanja + "</span>)." : "") + "</p></div></details>";
    }
    /* where each cover's two faces are, in % of the picture (tail tips land on the top of the head, never on the face) */
    var COVER_TIPS = { ex: { bom: [73, 15], yeon: [50, 24] }, situationship: { bom: [34, 17], yeon: [66, 26] }, lover: { bom: [44, 7], yeon: [66, 27] },
      brutal: { bom: [1, 8], yeon: [53, 10] }, couple: { bom: [35, 20], yeon: [72, 25] }, glowup: { bom: [78, 18], yeon: [59, 19] },
      kpop: { bom: [35, 15], yeon: [68, 25] }, work: { bom: [77, 21], yeon: [36, 32] }, y2027: { bom: [32, 46], yeon: [74, 47] }, bundle: { bom: [45, 27], yeon: [68, 29] } };
    function coverHTML(R, s, them, title) {
      var pl = R.pillars, ml = moodLine(R, s), cv = coverImg(), how = HOW[P.slug] || "the core of who you are";
      var cols = [["Year", pl.year], ["Month", pl.month], ["Day", pl.day]].concat(pl.hour ? [["Hour", pl.hour]] : []);
      // Bom says the soul's own line, Yeon the reading's spicy line; a mood answer replaces the line of whoever says it (never the same line twice)
      var spicy = D.SPICY[R.dayMaster][P.spicy != null ? P.spicy : 4], mood = ml.text !== spicy;
      var bomLine = mood && ml.who === "bom" ? ml.text : s.bom, yeonLine = mood && ml.who !== "bom" ? ml.text : spicy;
      // v4 2026-11-06: the two bubbles sit above the picture's head line, each tail drawn to its speaker's face (BY.tails):
      // Bom is the man in the dark coat, Yeon the woman in hanbok. Nothing covers the middle of the cover.
      var key = cv ? ((/cover-([a-z0-9]+)/.exec(cv.src) || [])[1] || "") : "", tip = COVER_TIPS[key] || COVER_TIPS.ex;
      var bomL = tip.bom[0] <= tip.yeon[0];
      var bub = function (w, line, t, left) { return '<p class="bub bub--' + w + (left ? " bub--l" : " bub--r") + '" data-tip="' + t.join(",") + '"><b class="sr">' + who(w) + ": </b>" + esc(line) + "</p>"; };
      return '<header class="tz-hero rise">' +
        '<figure class="tz-panel"' + (cv ? " data-tails" : ' data-noimg="1"') + ">" +
        (cv ? '<img src="' + esc(cv.src) + '"' + (cv.set ? ' srcset="' + esc(cv.set) + '" sizes="(min-width: 600px) 520px, 100vw"' : "") + ' alt="' + esc(cv.alt) + '" width="720" height="894" decoding="async">' : "") +
        bub("bom", bomLine, tip.bom, bomL) + bub("yeon", yeonLine, tip.yeon, !bomL) +
        '<figcaption class="sr">' + esc(title) + ", " + (name ? esc(name) + "\u2019s reading" : "your reading") + "</figcaption>" +
        "</figure>" +
        '<div class="tz-intro"><h2 class="tz-h">You\u2019re <em>' + esc(s.nick) + ".</em></h2>" +
        '<p class="tz-why">Korean birthday astrology calls your type ' + esc(s.name) + '. It shapes ' + esc(how) + ".</p>" +
        (them ? '<p class="tz-them">They\u2019re <b>' + esc(them.nick) + "</b> (" + esc(them.name) + ")" + (NEED_THEIR ? ". Chapters 3 and 4 read them and your chemistry, and a few more sections use both charts. The rest is mostly about you." : PAIR === "required" ? ". One chapter of your comic compares your two charts." : ". They\u2019re in your comic too.") + "</p>" : "") +
        '</div></header>';
    }
    /* real chapter count for this reader (2 free + the locked list): price per chapter rounded UP to the cent, never flattering */
    function perChapter(total) { return total > 2 ? (Math.ceil(P.price / total * 100) / 100).toFixed(2) : ""; }
    function paywallHTML(restCount, sample, hasThem) {
      if (!PAY) return "";
      if (PAY.owns(P.slug)) return '<div class="chapter-lock rise"><a class="btn" href="' + esc(readUrl()) + '">Open my full reading</a></div>';
      // 2026-11-06 (Rok: "ugly, unreadable"): one price, three short lines of what you get, one button, one fine-print line.
      // Bundle is a quiet text link; email link and license key fold away. Same checkout links, same consent notice.
      // v4: one chapter phrase everywhere (build.py ch_phrase). Before their birthday is in, an optional pair chapter is the "+1".
      // v5: one line "$19 · one time · all N chapters" (N = this reader's real count); the optional pair chapter is one muted note
      var plus = !!PAIR && !hasThem && HAS_PAIR, allN = plus ? restCount + 1 : restCount + 2;
      var pend = PAY.pending(P.slug) || (SHELF && PAY.pending("all-readings"));
      var both = P.slug + (SHELF ? " all-readings" : "");
      return '<div class="chapter-lock paywall pw3 rise' + (pend ? " is-pending" : "") + '" id="paywall" data-pw="' + both + '">' +
        '<div class="pw-pending" role="status"><p class="pw-pend-h"><span class="pw-dot" aria-hidden="true"></span>Opening your comic\u2026</p>' +
        '<p class="pw3-pend-s">Finish paying in the Gumroad tab. Your comic opens here by itself.</p>' +
        '<p class="pw3-pend-s"><a href="#" data-pay-cancel="' + both + '">Not paid yet? Back to the price</a></p></div>' +
        '<div class="pw3-buy">' +
        '<p class="pw3-amt">' + BY.moneyHTML(P.price) + '<em class="pw3-per"> \u00B7 one time \u00B7 all ' + allN + ' chapters</em></p>' +
        '<ul class="pw3-get">' + (sample && sample.answer ? '<li class="pw3-ans">' + esc(sample.answer) + "</li>" : "") +
        '<li>Opens right here after paying, plus an email link to open it on any phone</li><li>' + esc(PW_EXTRA[P.slug] || PW_EXTRA._) + '</li></ul>' +
        (plus ? (PAIR === "required" ? '<p class="pw3-plus pw3-plus--note">Add their birthday before you unlock if you want the chapter on the two of you. You can also add it later on your comic page.</p>'
          : '<p class="pw3-plus">+1 chapter if you add their birthday</p>') : "") +
        '<div class="pw-btn">' + PAY.buyLink(P.slug, "Read the rest", "btn--block pw3-cta") + "</div>" +
        '<p class="pw3-fine">Secure checkout by Gumroad \u00B7 30-day refund</p>' +
        "</div>" +
        PAY.statusEl(P.slug) + (SHELF ? PAY.statusEl("all-readings") : "") +
        '<div class="pw3-folds">' +
        '<details class="pw3-fold"><summary>Already paid? Open it with your license key</summary>' + PAY.fallback() + "</details>" +
        "</div></div>" +
        // v4: the shelf offer is a quiet line under the card, not a second offer inside it (same link, same price logic)
        (SHELF && SHELF.price > P.price ? '<p class="pw3-alt">' + PAY.buyLink("all-readings", "Or get all " + SHELF.count + " readings for " + BY.moneyHTML(SHELF.price), "pw-link") + "</p>" : "");
    }
    /* faza 2 (2026-11-05): optional "send me the link" under the buy button. Never blocks checkout; reminders only with the
       separate unticked box. The worker sends one mail (plus at most 2 reminders on opt-in) and deletes the address within 14 days. */
    var HAS_PAIR = false;
    /* round 2 2026-11-07: the third paywall line says what every buyer of this reading really gets on the read page (bonusBox +
       print view): a PDF, phone and desktop wallpapers of their type, and the per-type chart "You and every birthday type"
       (a love-match chart of their type with all 10 types; it needs no second birthday). */
    var PW_EXTRA = {
      _: "PDF to keep, plus phone and desktop wallpapers of your type and a bonus love chart: your type with all 10 types",
      "will-your-ex-come-back": "PDF to keep, plus phone and desktop wallpapers of your type and a chart of how your type matches all 10 types",
      "situationship": "PDF to keep, plus phone and desktop wallpapers of your type and a chart of how your type matches all 10 types",
      "what-kind-of-lover": "PDF to keep, plus phone and desktop wallpapers of your type and a chart of how your type matches all 10 types",
      "couple-reading": "PDF to keep, plus phone and desktop wallpapers of your type and a chart of how your type matches all 10 types"
    };
    var PW_ANSWER = {
      "will-your-ex-come-back": { id: "the-pull", line: "why you still check their profile, what it costs you, and how to stop" },
      "situationship": { id: "where-it-stands", line: "where this really is, not where you hope" },
      "what-kind-of-lover": { id: "flirting", line: "your flirting style, rated" },
      "couple-reading": { id: "who-they-are", line: "who they are, then what your two types make together", n2: true }
    };
    var mbN = 0;
    function mailBox() {
      if (BY.load("sl_" + P.slug)) return "";
      var i = "pwm" + (++mbN);
      return '<form class="pw-mail" novalidate><label class="pw-mail-l" for="' + i + '">Not now? We can email you the link to this comic.</label>' +
        '<span class="pay-key-row"><input id="' + i + '" type="email" name="e" autocomplete="email" inputmode="email" spellcheck="false" placeholder="Your email" maxlength="254"><button class="btn btn--ghost btn--sm" type="submit">Send me the link</button></span>' +
        '<label class="pw-mail-opt"><input type="checkbox" name="rem"> Also remind me, at most twice in the next 3 days</label>' +
        '<p class="pw-mail-priv">Only for this link (and the reminders if you tick the box). No list, and we delete your address within 14 days. <a href="/privacy/#link-email">Privacy</a></p>' +
        '<p class="pw-mail-msg" role="status" hidden></p></form>';
    }
    document.addEventListener("submit", function (e) {
      var f = e.target; if (!f || !f.classList || !f.classList.contains("pw-mail")) return;
      e.preventDefault();
      var v = (f.e.value || "").trim(), msg = f.querySelector(".pw-mail-msg"), b = f.querySelector("button");
      var say = function (t, bad) { msg.textContent = t; msg.hidden = false; msg.classList.toggle("err", !!bad); };
      if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(v) || v.length > 254) { say("That email doesn't look right.", true); f.e.focus(); return; }
      var rem = !!f.rem.checked;
      var link = "https://bomandyeon.com/readings/" + P.slug + "/" + BY.urlState.query(urlObj(), true) + "#preview";
      b.disabled = true; b.textContent = "Sending\u2026";
      fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/save-link", { method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ email: v, slug: P.slug, url: link, remind: rem, t: rem && PAY.token ? PAY.token(P.slug) : "" }) })
        .then(function (r) { return r.json().then(function (j) { return { st: r.status, j: j }; }); })
        .then(function (x) {
          if (x.j && x.j.ok) {
            BY.store("sl_" + P.slug, 1); BY.track("email-submit-" + P.slug, "Paywall email link: " + P.slug + (rem ? " (reminders)" : ""));
            [].forEach.call(document.querySelectorAll(".pw-mail"), function (g) { g.innerHTML = x.j.status === "queued" ? '<p class="pw-mail-ok">Saved. The link to your comic arrives in your inbox by tomorrow.</p>' : '<p class="pw-mail-ok">Sent. The link to your comic is in your inbox' + (x.j.status === "already" ? " (we sent it earlier)." : ".") + "</p>"; });
            return;
          }
          b.disabled = false; b.textContent = "Send me the link";
          say(x.st === 429 ? "We can't send more emails right now. Try again later." : "That didn't send. Try once more?", true);
        }).catch(function () { b.disabled = false; b.textContent = "Send me the link"; say("That didn't send. Try once more?", true); });
    });
    function wirePaywall() {}
    /* the free part ends mid-sentence: the first words of a locked chapter clear, the rest blurred */
    function cliffHTML(text, at) {
      // 2026-11-05: the chapter 3 teaser ends on a complete sentence (it used to fade out mid-sentence). A written cliff may start
      // "Yeon: " / "Bom: " (shown as the speaker) and mark its cut with " | ": we show up to the end of the sentence holding that cut.
      var sp = "", sy = SAY_RE.exec(String(text)); if (sy) { sp = sy[1]; text = sy[2]; }
      text = String(text); var cut = text.indexOf(" | "); var plain = text.replace(" | ", " ");
      var sents = plain.match(/[^.!?]+[.!?]+["'\u2019\u201D)\]]*/g) || [plain], outT = "", need = cut > 0 ? cut : Math.min(plain.length, 60);
      for (var k = 0; k < sents.length; k++) { outT += sents[k]; if (outT.length >= need) break; }
      outT = outT.trim(); if (!/[.!?]["'\u2019\u201D)\]]*$/.test(outT)) outT = outT.replace(/[,;:\s]+$/, "") + ".";
      return '<div class="cliff"><p class="cliff__h">Chapter ' + at.n + ": " + esc(at.title) + '</p><p class="cliff__t">' + (sp ? "<b>" + sp + "</b> " : "") + esc(outT) + "</p></div>";
    }
    /* funnel fix 2026-11-07 (lover): one open question right under the type card, answered in chapter 3. It is the start of the
       real chapter 3 cliff line (up to its " | " cut), so the free part promises nothing the comic doesn't say. */
    var OPEN_Q = { "what-kind-of-lover": 1 };
    function openQHTML(hk, J) {
      var t = String(hk.text), sp = "", sy = SAY_RE.exec(t); if (sy) { sp = sy[1]; t = sy[2]; }
      var cut = t.indexOf(" | "), head = (cut > 0 ? t.slice(0, cut) : t.split(/[.!?]/)[0]).replace(/[,;:\s]+$/, "");
      var n = 0, title = ""; J.plan.forEach(function (c, i) { if (c.id === hk.id) { n = i + 1; title = planTitle(c); } });
      return '<div class="cliff cliff--open rise"><p class="cliff__h">Still open \u00B7 answered in chapter ' + n + (title ? ": " + esc(title) : "") + '</p><p class="cliff__t">' + (sp ? "<b>" + sp + "</b> " : "") + esc(head) + "\u2026</p></div>";
    }
    /* funnel fix 2026-11-07 (situationship): when their birthday is in, one short honest beat from the two Day Master elements
       (the same five-element cycle the paid pair chapter uses), and a plain note that one chapter compares the two charts. */
    var ELN = ["Wood", "Fire", "Earth", "Metal", "Water"];
    function pairBeatHTML(R, s, them, J) {
      var a = R.dayMasterEl, b = R.partner.dayMaster >> 1, r = ((b - a) % 5 + 5) % 5, A = ELN[a], B = ELN[b], x;
      if ((((R.dayMaster - R.partner.dayMaster) % 10) + 10) % 10 === 5) x = "Your two day stems are one of saju\u2019s five classic stem pairs, which is read as a strong pull. A pull is not the same thing as clarity.";
      else x = [
        "You\u2019re both " + A + ". Same element, so you recognise each other fast, and you dig in the same way. Two of the same rarely makes the other move first.",
        "Your " + A + " feeds their " + B + ". In the five-element cycle that makes you the one who gives and them the one who grows. Easy to fall into, easy to stay lopsided in.",
        "Your " + A + " keeps their " + B + " in check. In the five-element cycle that puts you in the steering seat, even when you don\u2019t mean to drive.",
        "Their " + B + " keeps your " + A + " in check. In the five-element cycle that puts them in the steering seat, so you may be the one adjusting more.",
        "Their " + B + " feeds your " + A + ". In the five-element cycle they give and you grow, which feels good and can make it hard to ask for more."][r];
      var n = 0, nc = 0; J.plan.forEach(function (c, i) { if (c.type === "pair") n = i + 1; if (NEED_THEIR && c.id === "your-chemistry") nc = i + 1; });
      return '<div class="say say--yeon rise pv-pairbeat"><span class="av av--yeon"><img src="/assets/img/av-yeon.webp" alt="" width="44" height="44"></span><p class="bubble"><b>Yeon</b>' + esc(x) +
        (n ? " Chapter " + n + " reads the two of you in full." : nc ? " Chapter " + nc + " reads your chemistry in full." : "") + "</p></div>";
    }
    function skipAll() { var o = {}; INTAKE.forEach(function (q) { o[q.id] = q.skip_value; }); return o; }
    /* optional chips after chapter 1 (2026-11-05): the reading's own questions (or its one mood question). Never blocking:
       a tap stores the answer and redraws the free chapters with it; skipping changes nothing. */
    function chipsCard() {
      var qs = INTAKE.length ? INTAKE.slice(0, 3) : (MOOD ? [{ id: "__mood", question: MOOD.question, options: MOOD.options }] : []);
      if (!qs.length) return null;
      var cur = INTAKE.length ? Object.assign({}, answers || {}) : { __mood: BY.load(MOOD_KEY) };
      var box = document.createElement("section"); box.className = "pv-chips rise"; box.id = "pvChips";
      box.innerHTML = '<p class="pv-chips__h">Optional: makes the next chapters sharper</p>' + qs.map(function (q) {
        return '<div class="pv-q" data-q="' + esc(q.id) + '"><p class="pv-q__t">' + esc(q.question) + '</p><div class="pv-q__o" role="group" aria-label="' + esc(q.question) + '">' +
          q.options.filter(function (o) { return o.value !== q.skip_value; }).map(function (o) {
            return '<button type="button" class="chipbtn" data-v="' + esc(o.value) + '" aria-pressed="' + (cur[q.id] === o.value ? "true" : "false") + '">' + esc(o.label) + "</button>";
          }).join("") + "</div></div>";
      }).join("") + '<p class="small muted">Skip it if you like. Your chapters are already written for you.</p>';
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".chipbtn"); if (!b) return;
        var qid = b.closest(".pv-q").getAttribute("data-q"), v = b.getAttribute("data-v");
        if (qid === "__mood") { BY.store(MOOD_KEY, v); BY.track("mood-chip-" + P.slug, "Mood chip: " + P.slug); }
        else {
          var c = Object.assign(skipAll(), answers || {}); c[qid] = v; answers = cleanAns(c); BY.store(ANS_KEY, answers);
          BY.track("intake-chip-" + P.slug, "Optional question answered after chapter 1: " + P.slug);
        }
        rerender("#pvChips");
      });
      return box;
    }
    function addTheirCard() {
      var c = document.createElement("section"); c.className = "card pv-their rise"; c.id = "pvTheir";
      c.innerHTML = '<h3>Add theirs for the chapter on the two of you</h3>' +
        '<p class="muted small">Optional. One chapter compares your two charts: whose element feeds whose, and where you clash. The rest of the comic reads you. Just the date, they never find out. You can also add it right after paying.</p>' +
        '<form class="form-stack" novalidate>' + BY.dateHTML("t", "Their birthday") + '<p class="err" role="alert"></p><button class="btn btn--ghost btn--block" type="submit">Add their birthday</button></form>';
      BY.fillSelects(c);
      c.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target, t = BY.readDate(f, "t"); if (t.error) { f.querySelector(".err").textContent = t.error; return; }
        their = t; BY.store(THEIR_KEY, t); solo = false;
        if (form) BY.setDate(form, "t", t);
        BY.track("their-added-" + P.slug, "Their birthday added before the paywall: " + P.slug);
        try { if (BY.urlState) BY.urlState.clean(urlObj()); } catch (x) { /* ignore */ }
        rerender(".lock-list");
      });
      return c;
    }
    /* redraw the free part with new answers/birthdays, keeping the element the reader was looking at where it was */
    function rerender(sel) {
      var a = out.querySelector(sel), top = a ? a.getBoundingClientRect().top : null;
      renderPreview(false).then(function () {
        var b = out.querySelector(sel); if (b && top != null) window.scrollBy(0, b.getBoundingClientRect().top - top);
      });
    }
    function seenOnce(el, name, title) {
      if (!el) return;
      if (!("IntersectionObserver" in window)) { BY.trackOnce(name, title); return; }
      var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); BY.trackOnce(name, title); } }); }, { rootMargin: "0px 0px -35% 0px" });
      io.observe(el);
    }
    function shownOnce(el, name, title) {
      if (!el) return;
      if (!("IntersectionObserver" in window)) { BY.trackOnce(name, title); return; }
      var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting && el.getBoundingClientRect().height > 0) { io.disconnect(); BY.trackOnce(name, title); } }); }, { threshold: 0.01 });
      io.observe(el);
    }
    function dwellOnce(el, ms, name, title) {
      if (!el || !("IntersectionObserver" in window)) return;
      var tm = null, io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio >= 0.5) { if (!tm) tm = setTimeout(function () { io.disconnect(); BY.trackOnce(name, title); }, ms); }
          else if (tm) { clearTimeout(tm); tm = null; }
        });
      }, { threshold: [0, 0.5, 1] });
      io.observe(el);
    }
    function renderPreview(scroll) {
      var R = analyze(), s = D.SOULS[R.dayMaster], them = PAIR && R.partner ? D.SOULS[R.partner.dayMaster] : null;
      if (!out.firstChild) out.innerHTML = '<p class="center muted">Bom and Yeon are pulling your chapters\u2026</p>';
      return data().then(function (J) {
        var d = J.by_day_master[s.slug];
        if (!d || !A4) { out.innerHTML = '<p class="err">This reading isn\'t ready for ' + esc(s.name) + " yet. Try another one for now.</p>"; return; }
        out.innerHTML = coverHTML(R, s, them, J.title) + termBanner(R);
        var hk0 = (d.hook || {}).cliff;
        if (OPEN_Q[P.slug] && hk0 && hk0.text) out.insertAdjacentHTML("beforeend", openQHTML(hk0, J));
        if (PAIR === "required" && R.partner && them) out.insertAdjacentHTML("beforeend", pairBeatHTML(R, s, them, J));
        // the reading's real opening: the first two plan chapters, assembled exactly as on the reading page
        var V = { plan: J.plan2, intake: J.intake, ext: J.ext || {}, keyed: J.keyed || {}, day_branch: J.day_branch, day_branch_heading: J.day_branch_heading, heavy: {}, missing: {},
          base: {}, base_panels: {}, season: {}, extra: {} };
        V.base[s.slug] = d.base; V.base_panels[s.slug] = d.base_panels; V.season[s.slug] = d.season; V.extra[s.slug] = d.extra || {};
        if (d.open) { V.open = {}; V.open[s.slug] = d.open; } V.echo = J.echo || {};
        if (d.terms) { V.terms = {}; V.terms[s.slug] = d.terms; }
        var asm = A4.assemble(R, V, { answers: ansFor(), echoSkipped: false }), art = counter(), usedArt = []; // funnel fix 2026-11-07: no echo of unasked questions in the free part
        asm.chapters.forEach(function (ch, ci) {
          // funnel fix 2026-11-07 (Rok): the two free chapters show whole, never cut mid-thought. A chapter that is too long or ends
          // weakly is fixed in the copy, not here. The old ~110-word / 8-paragraph / 3-4-panel trim is gone.
          var paras = String(ch.text || "").split(/\n\s*\n/).filter(function (x) { return x.trim() && !/^(?:(?:Yeon|Bom):\s*)?You skipped\b/.test(x.trim()); });
          var t = Object.assign({}, ch, { panels: (ch.panels || []).filter(function (q) { return !/^You skipped\b/.test(q.text || ""); }), text: paras.join("\n\n") });
          var own1 = landerScene(ci) || sceneFor(ch.id, R); if (own1) usedArt.push(own1.src);
          var sec = comicChapter(t, R, art, { scene: own1 }); sec.classList.add("comic--teaser"); out.appendChild(sec);
          /* 2026-11-06 Rok: no optional questions in the free part (they come after purchase) */
        });
        if (PAIR === "required" && !R.partner) out.appendChild(addTheirCard());
        var rest = J.plan.slice(2).filter(function (c) { return !(c.type === "pair" && c.optional && !R.partner && PAIR !== "optional"); });
        var hook = d.hook || {}, numOf = function (id) { for (var i = 0; i < rest.length; i++) if (rest[i].id === id) return { n: i + 3, title: lockTitle(rest[i], R, s, them) }; return null; };
        var cl = hook.cliff && numOf(hook.cliff.id), sm = hook.sample && numOf(hook.sample.id);
        var lock = document.createElement("section"); lock.className = "lock-list rise";
        var optPair = !!PAIR && !R.partner; HAS_PAIR = rest.some(function (c) { return c.type === "pair"; });
        // v5: the optional pair chapter is the paywall's one "+1" note, so the locked list shows the chapters every buyer gets
        var shown = optPair ? rest.filter(function (c) { return c.type !== "pair"; }) : rest;
        if (optPair && shown.length !== rest.length - 1) shown = rest;
        var restLine = shown.length + " more chapters";
        // v6: a locked row never repeats a picture already shown in the free chapters; it borrows an unused scene of this reading
        var rowOwn = shown.slice(0, 3).map(function (c) { var x = sceneFor(c.id, R); return x ? x.src : ""; });
        var spare = Object.keys(SC).filter(function (k) { return k.indexOf(P.slug + "/") === 0 && !ART_AVOID[k]; }).map(function (k) { return "/assets/img/scenes/" + k + ".webp"; })
          .filter(function (x) { return usedArt.indexOf(x) < 0 && rowOwn.indexOf(x) < 0; }).reverse();
        var row = function (c, i) {
          var sc = sceneFor(c.id, R);
          if (sc && usedArt.indexOf(sc.src) >= 0 && spare.length) sc = { src: spare.shift() };
          var th = sc ? sc.src.replace("/img/scenes/", "/img/scenes-t/") : "";
          return '<li><span class="lk-th"' + (th ? ' style="background-image:url(' + th + ')"' : "") + '><i>' + (i + 3) + '</i></span><span class="lk-tx"><b>' + esc(lockTitle(c, R, s, them)) +
            '</b></span><svg class="lk-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></li>';
        };
        var SHOW = 3;
        /* funnel fix 2026-11-07: the paywall's first line names this reading's answer, from its own locked chapter list */
        function pwAnswer(rest, R, s, them) {
          var want = PW_ANSWER[P.slug], hit = null, i;
          for (i = 0; i < rest.length && !hit; i++) if (want && rest[i].id === want.id) hit = { c: rest[i], n: i + 3 };
          if (!hit) for (i = 0; i < rest.length && !hit; i++) if (rest[i].type !== "pair") hit = { c: rest[i], n: i + 3 };
          if (!hit) return "";
          return (want && want.n2 ? "Chapters " + hit.n + " and " + (hit.n + 1) : "Chapter " + hit.n) + ": " + (want && want.line ? want.line : lockTitle(hit.c, R, s, them));
        }
        lock.innerHTML = (cl ? cliffHTML(hook.cliff.text, cl) : "") +
          '<div class="lock-head"><h3 class="lock-h">The rest of your comic, ' + esc(name || s.nick) + '</h3><p class="lock-sub">' + esc(restLine) + ', locked</p></div>' +
          '<ol class="lock-ol lock-ol--v2">' + shown.slice(0, SHOW).map(row).join("") + "</ol>" +
          (shown.length > SHOW ? '<details class="lock-more"><summary>See the other ' + (shown.length - SHOW) + "</summary>" + '<ol class="lock-ol lock-ol--v2" start="' + (SHOW + 3) + '">' + shown.slice(SHOW).map(function (c, i) { return row(c, i + SHOW); }).join("") + "</ol></details>" : "") +
          paywallHTML(rest.length, Object.assign(sm ? { text: hook.sample.text, who: hook.sample.who, n: sm.n, title: sm.title } : {}, { answer: pwAnswer(rest, R, s, them) }), !!R.partner);
        out.appendChild(lock);
        document.body.classList.add("has-strip");
        BY.watch(out);
        if (BY.tails) BY.tails(out);
        extras(true);
        BY.trackOnce("teaser-" + P.slug, "Teaser shown: " + P.slug);
        var chs = out.querySelectorAll(".comic--teaser");
        // round 2: result-rendered-<slug> = the personalised free comic is in the page AND its first chapter is visible on screen
        shownOnce(chs[0], "result-rendered-" + P.slug, "Free comic rendered on screen: " + P.slug);
        // measurement 2026-11-05: chapter 1 read (end of it on screen) and the paywall seen; Meta ReadChapter1 / PaywallView via consent.js
        seenOnce(chs[0] && (chs[0].querySelector(".comic__beats > :last-child") || chs[0]), "ch1-view-" + P.slug, "Chapter 1 read: " + P.slug);
        seenOnce(chs[1], "teaser-ch2-" + P.slug, "Teaser chapter 2 reached: " + P.slug);
        seenOnce(out.querySelector(".paywall"), "paywall-view-" + P.slug, "Paywall seen: " + P.slug);
        // funnel fix 2026-11-07: chapter 2 read to its last beat, and the paywall on screen for 5 s or more (one per session each)
        // round 2: renamed ch2-end-reached-<slug> (the last beat of chapter 2 reached the reading zone of the screen)
        seenOnce(chs[1] && (chs[1].querySelector(".comic__beats > :last-child") || chs[1]), "ch2-end-reached-" + P.slug, "Chapter 2 end reached: " + P.slug);
        dwellOnce(out.querySelector(".paywall .pw3-buy") || out.querySelector(".paywall"), 5000, "paywall-dwell-" + P.slug, "Paywall on screen 5s+: " + P.slug);
        if (PAY) { stickyPaywall(); exitCapture(); }
        if (scroll) out.scrollIntoView({ behavior: smooth(), block: "start" });
      }).catch(function () { out.innerHTML = '<p class="err">The preview didn\'t load. Check your connection and tap the button again.</p>'; });
    }
    out.addEventListener("click", function (e) {
      if (e.target.closest("[data-redo]")) {
        e.preventDefault();
        var k = form && form.querySelector(".bknown [data-bchange]"); if (k && !k.closest(".bknown").hidden) k.click();
        $("preview").scrollIntoView({ behavior: smooth(), block: "start" });
      }
    });

    /* bonus 2026-10-25: free type card (story image) after the free check */
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-typecard]"); if (!b || !BY.imageShare) return;
      e.preventDefault(); var g = b.getAttribute("data-typecard");
      BY.imageShare({ src: "/assets/bonus/card/" + g + ".jpg", file: "my-korean-birthday-type-" + g, alt: "My Korean birthday type: " + b.getAttribute("data-nick"),
        text: "I'm " + b.getAttribute("data-nick") + ". What's your Korean birthday type? bomandyeon.com", track: "typecard-" + g });
    });
    /* any [data-buy] button: jump to the paywall once it is on the page, else to the birthday form */
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-buy]")) return;
      e.preventDefault();
      if (PAY && PAY.owns(P.slug)) { goRead(); return; }
      var pw = out.querySelector(".paywall");
      if (pw) { pw.scrollIntoView({ behavior: smooth(), block: "center" }); return; }
      $("preview").scrollIntoView({ behavior: smooth(), block: "start" });
    });
    if (PAY) {
      PAY.watch(P.slug, function () { BY.store("thanks_" + P.slug, 1); goRead(); });
      if (SHELF) PAY.watch("all-readings", function () { BY.store("thanks_" + P.slug, 1); goRead(); });
    }
    /* sticky price bar (2026-11-05): on from the type reveal, its button goes straight to checkout (one tap); hidden while the
       paywall's own button is on screen, so there are never two buy buttons at once */
    var stickyIO = null, stickyScroll = null;
    function stickyPaywall() {
      var pw = out.querySelector(".paywall"), sb = $("stickyBuy"); if (!sb || !pw) return;
      var act = sb.querySelector(".sb-act");
      if (act) act.innerHTML = PAY.owns(P.slug) ? '<a class="btn btn--sm" href="' + esc(readUrl()) + '">Open my reading</a>' : PAY.buyLink(P.slug, "Read the rest", "btn--sm");
      sb.classList.add("is-hidden", "is-on"); document.body.classList.add("has-sb");
      // 2026-11-06 redesign: hidden while ANY part of the paywall box is on screen, and over the footer (never two buy buttons)
      // v3 2026-11-06: never over the strip while reading. The bar waits until chapter 1 has been read, then shows only when the
      // reader scrolls back up (looking for the price) and slides away again on the next scroll down. The header does the same
      // while a comic is on the page (site.js chromeHide), so reading down the strip is full screen, like a webtoon app.
      var zones = [pw].concat([].slice.call(document.querySelectorAll(".foot"))), seen = [];
      var ch1 = out.querySelector(".comic--teaser"), gate = false, dir = 0, lastY = window.scrollY, down = 0, up = 0, tick = false;
      function apply() {
        sb.classList.toggle("is-hidden", !(gate && dir < 0 && !seen.length));
      }
      if ("IntersectionObserver" in window) {
        if (stickyIO) stickyIO.disconnect();
        stickyIO = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) { var i = seen.indexOf(en.target); if (en.isIntersecting && i < 0) seen.push(en.target); if (!en.isIntersecting && i > -1) seen.splice(i, 1); });
          apply();
        });
        zones.forEach(function (z) { stickyIO.observe(z); });
      }
      if (stickyScroll) window.removeEventListener("scroll", stickyScroll);
      window.addEventListener("scroll", stickyScroll = function () {
        if (tick) return; tick = true;
        requestAnimationFrame(function () {
          tick = false;
          var y = window.scrollY, dy = y - lastY; lastY = y;
          if (dy > 0) { down += dy; up = 0; if (down > 12) dir = 1; } else if (dy < 0) { up -= dy; down = 0; if (up > 40) dir = -1; }
          if (!gate && ch1 && ch1.getBoundingClientRect().bottom < window.innerHeight * 0.6) gate = true;
          if (y < 80) dir = 0;
          apply();
        });
      }, { passive: true });
    }
    /* leave capture (2026-10-21): a teaser viewer with no email given who scrolls back up fast, moves the mouse out of the top
       of the window (desktop) or taps Back after seeing the paywall gets ONE small sheet per session offering the first two
       chapters by email (same Kit form + fields as the wizard step; Daily Soul box unticked). Never for owners. */
    var exitWired = false;
    function exitEligible() {
      var ss = null; try { ss = sessionStorage.getItem("by_exit"); } catch (x) { ss = "1"; }
      return !ss && !BY.load("email_given") && !(PAY && PAY.owns(P.slug)) && !!out.querySelector(".paywall");
    }
    function exitCapture() {
      if (exitWired || !exitEligible()) return;
      exitWired = true;
      var armed = false, seenPw = false, lastY = window.scrollY, lastT = Date.now(), upPx = 0, upT = 0, pushed = false;
      var pw = out.querySelector(".paywall");
      if ("IntersectionObserver" in window && pw) {
        var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { seenPw = armed = true; io.disconnect(); } }); });
        io.observe(pw);
      }
      setTimeout(function () { armed = true; }, 12000);
      window.addEventListener("scroll", function () {
        var y = window.scrollY, t = Date.now(), dy = lastY - y, dt = Math.max(1, t - lastT);
        if (dy > 0) { if (t - upT > 400) upPx = 0; upPx += dy; upT = t; } else upPx = 0;
        lastY = y; lastT = t;
        // fast flick back up from inside the teaser: at least 500 px up within 400 ms, while still below the reading's start
        // audit 2026-11-03: no scroll trigger any more. Flicking back up is usually re-reading before buying, and the
        // sheet covered the buy button. Leave capture now only on Back after the paywall and (desktop) mouse leaving the top.
      }, { passive: true });
      if (window.matchMedia && matchMedia("(pointer: fine)").matches) {
        document.addEventListener("mouseout", function (e) { if (armed && !e.relatedTarget && e.clientY <= 0) showExit("mouse"); });
      }
      // Back after the paywall: one history entry, added on a real tap (browsers skip entries added without one)
      function addEntry() {
        if (pushed || !seenPw || !exitEligible()) return;
        pushed = true; try { history.pushState({ byExit: 1 }, "", location.href); } catch (x) { /* file:// */ }
      }
      document.addEventListener("pointerdown", addEntry, true);
      document.addEventListener("keydown", addEntry, true);
      window.addEventListener("popstate", function () {
        if (!pushed) return; pushed = false;
        if (exitEligible()) showExit("back"); else history.back();
      });
    }
    function showExit(via) {
      if (!exitEligible() || document.querySelector(".exit-sheet")) return;
      try { sessionStorage.setItem("by_exit", "1"); } catch (x) { /* private mode */ }
      BY.track("exit-shown-" + P.slug, "Leave sheet shown (" + via + "): " + P.slug);
      var sh = document.createElement("div"); sh.className = "exit-sheet no-print"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-labelledby", "exH");
      sh.innerHTML = '<div class="exit-sheet__in"><button type="button" class="exit-x" data-x aria-label="Close">\u00D7</button>' +
        '<div class="say say--bom"><span class="av av--bom"><img src="/assets/img/av-bom.webp" alt="" width="44" height="44"></span><p class="bubble" id="exH"><b>Bom</b>Not now? I\u2019ll email you the 2 chapters you just read, so you can finish later.</p></div>' +
        '<form class="form-stack" novalidate><label><span class="sr">Email address</span><input class="input" type="email" name="em" inputmode="email" autocomplete="email" placeholder="you@email.com"></label>' +
        '<label class="check"><input type="checkbox" name="ds"> <span>Also send me Yeon\'s Daily Soul, one line every morning. Free, 18+.</span></label>' +
        '<p class="err" role="alert"></p><button class="btn btn--block" type="submit">Email them to me</button>' +
        '<p class="note">Sent via Kit, our email provider. Unsubscribe in one tap. <a href="/privacy/">Privacy</a></p></form>' +
        '<p class="center"><button type="button" class="linkbtn small" data-x>No thanks</button></p></div>';
      document.body.appendChild(sh);
      requestAnimationFrame(function () { sh.classList.add("is-on"); });
      function close() { sh.classList.remove("is-on"); setTimeout(function () { if (sh.parentNode) sh.parentNode.removeChild(sh); }, 300); document.removeEventListener("keydown", esc1); }
      function esc1(e) { if (e.key === "Escape") close(); }
      document.addEventListener("keydown", esc1);
      sh.addEventListener("click", function (e) { if (e.target === sh || e.target.closest("[data-x]")) { BY.track("exit-close-" + P.slug, "Leave sheet closed: " + P.slug); close(); } });
      sh.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target, em = f.querySelector('[name="em"]'), v = em.value.trim(), ds = f.querySelector('[name="ds"]').checked, err = f.querySelector(".err");
        if (!BY.EMAIL_RE.test(v)) { err.textContent = "That email doesn't look right."; em.focus(); return; }
        if (ds && BY.ageOn(birth) < BY.MIN_AGE) ds = false;
        BY.store("email_given", 1);
        BY.track("email-exit-" + P.slug, "Leave sheet email given: " + P.slug + (ds ? " + Daily Soul" : ""));
        var btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving\u2026";
        var rUrl = "https://bomandyeon.com" + readUrl(true);
        BY.captureReading(v, P.slug, ds, rUrl, "exit").then(function (res) {
          // the sheet promises the first 2 chapters: the teaser mail goes out with or without the Daily Soul box (teaser UX 2026-10-21)
          if (res && res.ok && !res.check) BY.teaserMail(v, P.slug, rUrl);
          var box = sh.querySelector(".exit-sheet__in");
          if (res && res.ok && res.check) { f.innerHTML = '<p class="small">Our email provider wants one quick check that you\'re a person. <a href="' + esc(res.check) + '" target="_blank" rel="noopener">Do the check</a></p>'; return; }
          if (res && res.ok) {
            if (res.ok) BY.track(ds ? "kit-signup-teaser" : "kit-reading-copy", ds ? "Daily Soul signup from teaser" : "Reading copy email saved");
            box.querySelector(".bubble").innerHTML = "<b>Bom</b>Saved. Your chapters go to " + esc(v) + "." + (ds ? " Tap the confirm link in your inbox for the Daily Soul." : "");
            f.hidden = true; var nb = box.querySelector("p.center .linkbtn"); if (nb) nb.textContent = "Back to my reading";
            return;
          }
          BY.store("email_given", null); btn.disabled = false; btn.textContent = "Email them to me"; err.textContent = "That didn't save. Try once more?";
        });
      });
      setTimeout(function () { var i = sh.querySelector("input[type=email]"); if (i && window.matchMedia && matchMedia("(pointer: fine)").matches) i.focus({ preventScroll: true }); }, 350);
    }
    if (PAY && PAY.owns(P.slug)) { goRead(true); return; }
    wireForm();
    // v5: from the home form (birthday already saved there) a choice opens its comic straight away; two-birthday readings still ask for theirs
    if (location.hash === "#go" && birth && PAIR !== "required") { try { history.replaceState(null, "", location.pathname + location.search + "#preview"); } catch (x) { /* file:// */ } go(birth, null); return; }
    // birthday known (return visit, another reading, emailed link): the comic is drawn under the hero right away
    if (ready() && (BY.load(DONE_KEY) || fromLink || BY.load("birth"))) renderPreview(fromLink);
    else extras(true);
  }
  /* ======================= READING PAGE ======================= */
  function readPage() {
    var form = $("rdForm"), out = $("rdOut");
    if (!P.full) { // paid mode: full data is not on the site
      out.innerHTML = '<div class="card center"><h1 style="font-size:28px">This reading opens after checkout</h1><p class="muted">Get it from the reading page.</p><a class="btn" href="' + P.productUrl + '">Go to the reading</a></div>';
      return;
    }
    /* unlock fix 2026-10-21: a buyer never lands on the paywall. ?key= (email button, pasted key): the reading renders at once
       when the inputs are known (link r=, this browser), the key is checked in the background (worker KV, then Gumroad).
       ?from=gumroad (Gumroad's own button) or a checkout this browser started: render and confirm by polling.
       Only a definite "not paid" shows the key box; nothing known at all -> "paid, enter the birthdays once". */
    var banner = null, paidKey = "", refundClosed = false;
    function need() { return !birth || (PAIR === "required" && !their && !soloOk()); }
    function showBanner(msg) {
      if (!msg) { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); banner = null; return; }
      if (!banner) { banner = document.createElement("p"); banner.className = "rd-confirm no-print"; banner.setAttribute("role", "status"); out.parentNode.insertBefore(banner, out); }
      banner.innerHTML = '<span class="pw-dot" aria-hidden="true"></span>' + esc(msg);
    }
    function failCard(head, line) {
      showBanner(null); $("rdAsk").hidden = true; $("rdIntake").hidden = true; $("rdCross").hidden = true;
      out.innerHTML = '<div class="card center pay-fail"><h1 style="font-size:28px">' + esc(head) + '</h1><p class="muted">' + line + "</p>" +
        PAY.keyForm("Paste the license key from Gumroad or your purchase email:") +
        '<p class="small muted" style="margin-top:14px">Still stuck? Email <a href="mailto:yeon@bomandyeon.com">yeon@bomandyeon.com</a> and we open it for you.</p>' +
        '<p><a class="link-arrow" href="' + P.productUrl + '#preview">Back to the free preview</a></p></div>';
    }
    function confirmed(slug, key) {
      if (key) PAY.store(slug, key); showBanner(null);
      BY.toast("Paid and opened. It's yours on this browser now.");
    }
    var key = PAY ? PAY.keyParam() : "";
    if (PAY && PAY.owns(P.slug) && key && !need() || PRINT && key) { PAY.stripKey(); key = ""; }
    if (PAY && (!PAY.owns(P.slug) || key)) {
      if (key) {
        PAY.stripKey();
        var known = !need();
        BY.track("key-open-" + P.slug, "Opened with key: " + P.slug);
        showBanner("Opening your reading…");
        // fix 2026-11-05: nothing renders before the key is confirmed (a made-up ?key= used to open the full reading)
        PAY.lookup(P.slug, key).then(function (res) {
          if (res.paid) {
            var hadInputs = !need();
            if (res.state && !hadInputs) applyState(res.state);
            confirmed(res.slug, key);
            PAY.purchased(res.slug, key, PAY.pendingAny(P.slug));
            if (!PAY.owns(P.slug)) { failCard("This key opens another reading", "It's a valid purchase, just not for this reading. Open the link in your Gumroad email, or email <a href=\"mailto:yeon@bomandyeon.com\">yeon@bomandyeon.com</a>."); return; }
            if (!need()) BY.urlState.clean(urlObj());
            start();
            if (!res.r) { if (!need()) PAY.attach(key); else paidKey = key; }
            return;
          }
          if (res.definitive) {
            BY.track("key-fail-" + P.slug, "Key not accepted: " + P.slug);
            if (res.refunded) PAY.forget(key);
            failCard(res.refunded ? PAY.refundedMsg : "We couldn't match that key to this reading",
              res.refunded ? "Refunds and disputed payments close the reading. Questions? Email <a href=\"mailto:yeon@bomandyeon.com\">yeon@bomandyeon.com</a>." : "Check the key on your Gumroad receipt (it looks like XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX). A key for another reading opens that reading.");
            return;
          }
          // checker unreachable: nothing opens unconfirmed; the key box lets the buyer try again
          failCard(PAY.netMsg, "Your connection or Gumroad didn't answer, so we couldn't confirm the key yet. Nothing is wrong with your purchase.");
        });
        return;
      }
      if (FROM_GR || PAY.pending(P.slug) || PAY.pending("all-readings")) {
        var fresh = PAY.pending(P.slug) || PAY.pending("all-readings");
        var onPaid = function (s) { confirmed(s, ""); start(); };
        var giveUp = function () { if (!PAY.owns(P.slug)) failCard("We haven't seen your payment yet", "Gumroad hasn't confirmed a purchase from this browser. If you paid, paste the license key from the Gumroad page or your email."); };
        if (fresh) {
          // fix 2026-11-05: a started checkout is not a payment; the reading opens when Gumroad confirms (onPaid)
          showBanner("Confirming your payment with Gumroad. Usually under a minute.");
          PAY.watch(P.slug, onPaid, giveUp); PAY.watch("all-readings", onPaid, giveUp);
          return;
        }
        if (FROM_GR) {
          // paid on Gumroad in another browser / app: the key from the Gumroad page opens it here (late check of an old checkout too)
          failCard("Your reading is paid for", "Paste the license key shown on the Gumroad page, or tap the button in the email we just sent you. Either opens your reading on any phone.");
          PAY.watch(P.slug, function (s) { confirmed(s, ""); out.innerHTML = ""; start(); });
          return;
        }
      }
      location.replace(P.productUrl + location.search + "#preview"); return;
    }
    /* owned on this browser: the stored licence is re-checked once a day; refunded, disputed or charged back closes it */
    if (PAY && PAY.owns(P.slug)) PAY.recheck(P.slug).then(function (v) {
      if (v === "refunded") refundClosed = true;
      if (v === "refunded") failCard(PAY.refundedMsg, "Refunds and disputed payments close the reading. Questions? Email <a href=\"mailto:yeon@bomandyeon.com\">yeon@bomandyeon.com</a>.");
    });
    start();
    function start() {
    if (need()) {
      out.innerHTML = ""; $("rdAsk").hidden = false; fillForm(form);
      if (PAY && PAY.owns(P.slug)) { var an = $("rdAskNote"); if (an) { an.textContent = "Your reading is paid for. Enter the birthdays once to open it" + (NEED_THEIR ? " (yours and theirs: this one compares your two charts)." : PAIR === "required" ? " (yours, plus theirs if you know it: it adds the chapter on the two of you)." : "."); an.className = "pw-owned"; } }
      if (!form.getAttribute("data-wired")) { form.setAttribute("data-wired", "1"); form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!readForm(form, $("rdErr"))) return;
        $("rdAsk").hidden = true;
        if (paidKey) { PAY.attach(paidKey); paidKey = ""; }
        try { history.replaceState(null, "", readUrl()); } catch (x) { /* file:// */ }
        next();
      }); }
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

    /* faza 2 (2026-11-05): with P.gated the full data is not on the site; the unlock worker returns it for a license that covers
       this reading (this browser's key for the reading or the bundle). No usable key or a "no" from the worker -> the key box. */
    /* a string sentinel: readPage may call render() before this line runs, so no var-held object here */
    function licKey() {
      var re = /^[A-Za-z0-9-]{16,80}$/, a = BY.load("lic_" + P.slug), b = BY.load("lic_all-readings");
      return typeof a === "string" && re.test(a) ? a : typeof b === "string" && re.test(b) ? b : "";
    }
    function fullData(dm) {
      if (!P.gated) return fetch(P.files[dm]).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); });
      var k = licKey();
      if (!k) { failCard("Paste your license key once", "Your reading opens with the license key from Gumroad. Paste it from the Gumroad page or your purchase email."); return Promise.resolve("__locked__"); }
      return fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/full?slug=" + encodeURIComponent(P.slug) + "&dm=" + encodeURIComponent(dm) + "&h=" + encodeURIComponent(P.files[dm] || "") + "&key=" + encodeURIComponent(k))
        .then(function (r) {
          if (r.status === 403) return r.json().catch(function () { return {}; }).then(function (j) {
            if (j && j.refunded) { PAY.forget(k); failCard(PAY.refundedMsg, "Refunds and disputed payments close the reading. Questions? Email <a href=\"mailto:yeon@bomandyeon.com\">yeon@bomandyeon.com</a>."); }
            else failCard("We couldn't match your key to this reading", "Paste the license key from your Gumroad receipt for this reading (or All Readings).");
            return "__locked__";
          });
          if (!r.ok) throw new Error("data");
          return r.json();
        });
    }
    var opened = false;
    function render() {
      var R = analyze(), s = D.SOULS[R.dayMaster], them = R.partner ? D.SOULS[R.partner.dayMaster] : null;
      out.innerHTML = '<p class="center muted">Opening your reading…</p>';
      fullData(s.slug).then(function (J) {
        if (J === "__locked__") return;
        if (refundClosed) return;
        if (PAY && !PAY.owns(P.slug)) { out.innerHTML = ""; return; } // fix 2026-11-05: the full reading renders only with a licence on this browser
        if (PRINT && (!PAY || PAY.owns(P.slug))) { renderPrint(R, s, them, J); return; }
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
        if (PAY) out.appendChild(html('<p class="small muted center no-print rd-owned">Yours on this browser. To read it on another phone, tap the button in your \u201CYour comic is ready\u201D email, or open <a href="' + esc(P.readUrl) + '">this page</a> there and paste the license key from your Gumroad receipt.</p>'));
        out.appendChild(coverCard(info, R));
        if (R.termDay) out.appendChild(html(termBanner(R)));
        out.appendChild(actions());
        if (PAIR === "required" && them) out.appendChild(bondBox(R, s, them));

        var al = answersLine(); if (al) out.appendChild(al);
        var asm = A4.assemble(R, J, { answers: ansFor(), pairs: J.pairs || null, echoSkipped: INTAKE.length > 0 }), art = counter();
        var pi = -1; J.plan.forEach(function (c, i) { if (c.type === "pair") pi = i; });
        // round 2: a two-birthday reading opened with your birthday only (situationship) also gets the "add theirs" card
        var afterId = (PAIR === "optional" || PAIR === "required") && !them && pi > 0 ? J.plan[pi - 1].id : null;
        // v5 2026-11-06: silent panels between the beats use this reading's other scenes; never the chapter's own scene, never the
        // scene of the chapter right before or after, never the same picture twice in a row, top and bottom bands in turn.
        var own = asm.chapters.map(function (c) { var x = sceneFor(c.id, R); return x ? x.src : ""; });
        var pool = Object.keys(SC).filter(function (k) { return k.indexOf(P.slug + "/") === 0; }).map(function (k) { return "/assets/img/scenes/" + k + ".webp"; });
        own.forEach(function (x) { if (x && pool.indexOf(x) < 0) pool.push(x); });
        var useN = {}, lastS = "", band = 0;
        var silentFor = function (ci) {
          return function () {
            var no = [own[ci], own[ci - 1], own[ci + 1], lastS], c = pool.filter(function (x) { return no.indexOf(x) < 0; });
            if (!c.length) return null;
            c.sort(function (a, b) { return (useN[a] || 0) - (useN[b] || 0); });
            var src = c[0]; useN[src] = (useN[src] || 0) + 1; lastS = src;
            return { src: src, pos: (band++ % 2 ? "50% 96%" : "50% 6%") };
          };
        };
        asm.chapters.forEach(function (ch, ci) {
          if (ch.id === "balance" && ch.blocks) out.appendChild(comicChapter(ch, R, art, { blocks: ch.blocks, silent: silentFor(ci) }));
          else if (ch.id === "strength") out.appendChild(comicChapter(ch, R, art, { pre: esc(strengthHow(R)), silent: silentFor(ci) }));
          else out.appendChild(comicChapter(ch, R, art, { silent: silentFor(ci) }));
          if (afterId && ch.id === afterId) {
            out.appendChild(html('<div class="card rise no-print add-their"><p>Add their birthday and Bom and Yeon write a chapter on how your two patterns meet.</p>' +
              '<form id="addTheir" class="form-stack" novalidate>' + document.querySelector("#rdForm .selects[aria-label^='Their']").outerHTML + '<p class="err" id="atErr" role="alert"></p><button class="btn" type="submit">Add the chapter</button></form></div>'));
          }
        });
        out.appendChild(html('<div class="say say--yeon rise"><span class="av av--yeon"><img src="/assets/img/av-yeon.webp" alt="" width="56" height="56"><img src="/assets/img/av-yeon-blink.webp" alt="" width="56" height="56"></span><p class="bubble"><b>Yeon</b>' + esc(D.YEON_MSG[R.dayMasterEl]) + "</p></div>"));
        LEN = { words: asm.words, chapters: asm.chapters.length, panels: asm.panels };
        out.appendChild(html(aboutThis(R, LEN)));
        var lenTag = $("rdLen"); if (lenTag) lenTag.textContent = LEN.chapters + " illustrated chapters";
        if (PAY && PAY.owns(P.slug)) out.appendChild(bonusBox(s));
        out.appendChild(actions(true));
        if (!PAY || PAY.owns(P.slug)) attachPrint(R, s, them, J);

        requestAnimationFrame(function () { setTimeout(function () { [].forEach.call(out.querySelectorAll("[data-w]"), function (i) { i.style.width = i.getAttribute("data-w") + "%"; }); }, 200); });
        wireActions(info, J.title);
        var at = $("addTheir");
        if (at) {
          BY.clearDate(at, "t");
          at.addEventListener("submit", function (e) {
            e.preventDefault();
            var t = BY.readDate(at, "t"); if (t.error) { $("atErr").textContent = t.error; return; }
            their = t; BY.store(THEIR_KEY, t); if (PAIR === "required") BY.store("solo_" + P.slug, null);
            BY.track("their-added-read-" + P.slug, "Their birthday added on the read page: " + P.slug);
            try { history.replaceState(null, "", readUrl()); } catch (x) { /* ignore */ }
            render(); window.scrollTo(0, 0);
          });
        }
        $("rdCross").hidden = false;
        if (PAY && !BY.load("lic_all-readings")) upsell();
        BY.watch(out);
      }).catch(function () { out.innerHTML = '<p class="err center">The reading didn\'t load. Check your connection and refresh the page.</p>'; });
    }

    /* ---------- PDF: a dedicated print view (?print=1, owners only), redesigned 2026-10-22 as a dark premium comic book.
       Night pages (#0E0F1A), cream text, gold accents, Gowun Batang + Inter. Cover page, one "your chart" page, then every
       chapter on a fresh page: number + title + scene panel (capped height) + Bom/Yeon bubbles kept together, then the rest of
       the chapter as narration and bubbles, a seal at the end; a closing page. The same book is attached (hidden on screen)
       to the owned read page, so printing the read page from any browser menu gives the book too. ---------- */
    var HZN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四"];
    function ppSay(sp, text) {
      var lo = sp.toLowerCase();
      return '<div class="pp-say pp-say--' + lo + '"><img src="/assets/img/av-' + lo + '.webp" alt="" width="44" height="44"><p><b>' + sp + "</b>" + esc(text) + "</p></div>";
    }
    function ppText(t) {
      return String(t || "").split(/\n\s*\n/).map(function (b) {
        b = b.trim(); if (!b) return "";
        var m = /^### (.+?)(?:\n([\s\S]*))?$/.exec(b);
        if (m) return '<h4 class="pp-h4">' + esc(m[1].trim()) + "</h4>" + (m[2] && m[2].trim() ? '<p class="pp-p">' + esc(m[2].trim()) + "</p>" : "");
        var sy = SAY_RE.exec(b); if (sy) return ppSay(sy[1], sy[2]);
        return '<p class="pp-p">' + esc(b) + "</p>";
      }).join("");
    }
    function buildPrint(R, s, them, J) {
      var I = coverInfo(R, s, them, J.title), asm = A4.assemble(R, J, { answers: ansFor(), pairs: J.pairs || null, echoSkipped: INTAKE.length > 0 }), EC = D.EL_COLOR;
      var n = asm.chapters.length, two = function (i) { return (i < 9 ? "0" : "") + (i + 1); };
      var pill = function (p) {
        return '<div class="pp-pillar"><span class="pp-pl">' + p.label + '</span><span class="hz" style="color:' + EC[p.stemEl] + '">' + p.stem + '</span><span class="hz" style="color:' + EC[p.branchEl] + '">' + p.branch + '</span><span class="pp-pe">' + p.stemEl + " · " + p.branchEl + "<br>" + p.animal + "</span></div>";
      };
      var seal = '<span class="pp-seal" aria-hidden="true">봄연</span>';
      // cover
      var h = '<section class="pp-sheet pp-cover"><p class="pp-brand">BOM &amp; YEON <span>봄연</span></p>' +
        (P.cover ? '<div class="pp-cover-art"><img src="/assets/img/cover-' + P.cover + '.webp" alt="" width="720" height="894"></div>' : "") +
        '<p class="pp-title">' + esc(J.title) + '</p><h1 class="pp-name">' + (I.name ? esc(I.name) : "Your reading") + "</h1>" +
        '<p class="pp-dm"><span class="hz" style="color:' + I.color + '">' + I.hanja + "</span> " + esc(I.dmName) + " · " + esc(I.nick) +
        (I.them ? '<span class="pp-with">with <span class="hz" style="color:' + I.them.color + '">' + I.them.hanja + "</span> " + esc(I.them.name) + "</span>" : "") + "</p>" +
        '<div class="pp-cover-foot">' + seal + "<p>A personal saju comic, told by Bom and Yeon<br>" + n + " illustrated chapters · bomandyeon.com</p></div></section>";
      // chart page
      var max = Math.max.apply(null, I.counts.concat([1]));
      var bars = I.counts.map(function (c, i) {
        var el = D.EL_NAMES[i]; return '<div class="pp-bar-row"><span>' + el + '</span><span class="pp-tr"><i style="width:' + Math.max(2, Math.round(c / max * 100)) + "%;background:" + EC[el] + '"></i></span><span>' + c.toFixed(1) + "</span></div>";
      }).join("");
      h += '<section class="pp-sheet pp-chart"><p class="pp-kicker">Your chart</p><h2 class="pp-h2">' + esc(I.dmName) + ' <span class="hz" style="color:' + EC[I.el] + '">' + I.hanja + "</span></h2>" +
        '<p class="pp-lead">' + esc(I.nick) + ". " + esc(s.tag || "") + "</p>" +
        '<div class="pp-pillars">' + I.pillars.map(pill).join("") + "</div>" +
        '<div class="pp-facts"><p><b>Season</b>' + I.seasonHz + " " + esc(seasonLine(R)) + "</p><p><b>Strength</b>" + esc(strengthTag(R)) + "</p><p><b>Your book</b>" + n + " illustrated chapters</p></div>" +
        '<div class="pp-bars"><p class="pp-mini">Your five elements</p>' + bars + "</div>";
      if (PAIR === "required" && them && R.compat) {
        var pd = PAIRS[pairSlug(R.dayMaster, R.partner.dayMaster)] || {};
        h += '<div class="pp-bond"><p class="pp-mini">You and them</p><p class="pp-score"><span class="hz" style="color:' + EC[s.el] + '">' + s.hanja + '</span> + <span class="hz" style="color:' + EC[them.el] + '">' + them.hanja + "</span> · " + R.compat.score + "%</p>" + (pd.v ? "<p>" + esc(pd.v) + "</p>" : "") + "</div>";
      }
      h += '<div class="pp-toc"><p class="pp-mini">In this book</p><ol>' + asm.chapters.map(function (ch, i) { return "<li><span>" + two(i) + "</span>" + esc(ch.title || "") + "</li>"; }).join("") + "</ol></div>" +
        '<p class="pp-note">' + (R.hasHour ? "Four pillars from your birth date and time." : "Three pillars from your birth date (year, month, day).") + " Solar terms converted to " + esc(BY.zoneLabel(R.zone)) + " time.</p></section>";
      // chapters
      asm.chapters.forEach(function (ch, i) {
        var sc = sceneFor(ch.id, R), lines = "";
        (ch.panels || []).forEach(function (p) {
          if (p.nar) lines += '<p class="pp-nar">' + esc(p.nar) + "</p>";
          lines += ppSay(who(p.speaker), p.text);
        });
        var body = "";
        if (ch.id === "strength") body += '<p class="pp-aside">' + esc(strengthHow(R)) + "</p>";
        if (ch.id === "balance" && ch.blocks) ch.blocks.forEach(function (b) { body += '<h4 class="pp-h4">' + esc(b.h || "") + "</h4>" + ppText(b.t) + (b.note ? '<p class="pp-aside">' + esc(b.note) + "</p>" : ""); });
        else body += ppText(ch.text);
        h += '<section class="pp-sheet pp-ch"><div class="pp-open"><header class="pp-ch-h"><p class="pp-chno"><b>' + two(i) + '</b><span class="hz">' + (HZN[i] || "") + "</span></p>" +
          '<div><p class="pp-kicker">Chapter ' + (i + 1) + (ch.kicker ? " · " + esc(ch.kicker) : "") + '</p><h2 class="pp-h2">' + esc(ch.title || "") + "</h2></div></header>" +
          (sc ? '<figure class="pp-scene"><img src="' + sc.src + '" alt="" width="' + sc.w + '" height="' + sc.h + '"></figure>' : "") +
          '<div class="pp-lines">' + lines + "</div></div>" + '<div class="pp-text">' + body + '</div><p class="pp-ch-end">' + seal + "</p></section>";
      });
      // bonus page 2026-10-25: compatibility chart
      h += '<section class="pp-sheet pp-bonus"><p class="pp-kicker">Bonus</p><h2 class="pp-h2">You and every birthday type</h2>' +
        '<figure style="margin:6mm 0 0;text-align:center"><img src="/assets/bonus/k9/' + s.slug + '-chart.jpg" alt="" width="1080" height="1920" style="width:50%;height:auto;margin:0 auto;display:block;border-radius:10px;border:1px solid rgba(201,164,92,.4)"></figure>' +
        '<p class="pp-note">Your phone and desktop wallpapers are on your reading page, under the last chapter.</p></section>';
      // closing page
      h += '<section class="pp-sheet pp-end"><p class="pp-kicker">The end of your book</p><h2 class="pp-h2">Until the next chapter</h2>' +
        '<div class="pp-duo"><img src="/assets/img/av-bom.webp" alt="" width="88" height="88"><img src="/assets/img/av-yeon.webp" alt="" width="88" height="88"></div>' +
        '<div class="pp-lines">' + ppSay("Yeon", D.YEON_MSG[R.dayMasterEl]) + "</div>" +
        '<p class="pp-note">This reading uses ' + (R.hasHour ? "four pillars (birth year, month, day and hour)" : "three pillars (birth year, month and day)") + ". It doesn't include the 10-year luck cycles (대운). For entertainment and self-reflection.</p>" +
        '<div class="pp-sign">' + seal + "<p>Bom &amp; Yeon<br><small>bomandyeon.com</small></p></div></section>";
      return h;
    }
    function ppWhenReady(root, cb) {
      var imgs = [].slice.call(root.querySelectorAll("img"));
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      var all = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }).concat([fontsReady]));
      Promise.race([all, new Promise(function (r) { setTimeout(r, 8000); })]).then(cb);
    }
    function renderPrint(R, s, them, J) {
      document.body.classList.add("print-view"); document.documentElement.classList.add("pp-on");
      document.title = J.title + (name ? " · " + name : "") + " · Bom & Yeon";
      $("rdAsk").hidden = true; $("rdIntake").hidden = true; $("rdCross").hidden = true;
      var back = ready() ? readUrl() : P.readUrl;
      var bar = '<div class="pp-bar no-print"><a href="' + esc(back) + '">← Back to my reading</a><button type="button" class="btn btn--sm" data-pp-print>Save as PDF</button>' +
        '<p class="small">In the print window, pick <b>Save as PDF</b> (on iPhone: in the print preview tap the share icon, then Save to Files).</p></div>';
      out.innerHTML = bar + '<div class="pp">' + buildPrint(R, s, them, J) + "</div>";
      BY.track("pdf-view-" + P.slug, "PDF view: " + P.slug);
      var go = function () { if (QS.get("noauto") !== "1") window.print(); };
      out.querySelector("[data-pp-print]").addEventListener("click", function () { window.print(); });
      ppWhenReady(out, function () { document.body.setAttribute("data-pp-ready", "1"); setTimeout(go, 300); });
    }
    /* owned read page: the same book, hidden on screen, is what any browser "Print" prints */
    function attachPrint(R, s, them, J) {
      try {
        var old = document.getElementById("ppShadow"); if (old) old.parentNode.removeChild(old);
        var d = document.createElement("div"); d.id = "ppShadow"; d.className = "pp pp--shadow"; d.setAttribute("aria-hidden", "true");
        d.innerHTML = buildPrint(R, s, them, J); document.body.appendChild(d);
        document.documentElement.classList.add("pp-has");
      } catch (e) { /* printing falls back to the plain print styles */ }
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
      el.innerHTML = '<p class="cv-title">' + esc(I.title) + "</p>" +
        '<p class="cv-name">' + (I.name ? esc(I.name) : "Your reading") + "</p>" +
        '<p class="hz cv-dm" style="color:' + I.color + '">' + I.hanja + "</p>" +
        "<h1>" + esc(I.dmName) + '</h1><p class="muted">' + esc(I.nick) + (I.them ? ' · with <span class="hz" style="color:' + I.them.color + '">' + I.them.hanja + "</span> " + esc(I.them.name) : "") + "</p>" +
        '<div class="pillars' + (I.pillars.length > 3 ? " pillars--4" : "") + '" aria-label="Your pillars">' + pills + "</div>" +
        '<ul class="tags"><li>' + I.seasonHz + " " + esc(seasonLine(R)) + "</li><li>" + esc(strengthTag(R)) + "</li></ul>" +
        '<p class="muted small" id="rdLen">&nbsp;</p>' +
        '<div class="bars">' + bars + "</div>" +
        '<p class="muted small">' + (R.hasHour ? "Four pillars from your birth date and time." : "Three pillars from your birth date (year, month, day). Your birth hour would add a fourth.") +
        " Solar terms converted to " + esc(BY.zoneLabel(R.zone)) + " time.</p>";
      return el;
    }
    /* bonus 2026-10-25: owners get their type's wallpapers + compatibility chart (one card, after the last chapter) */
    function bonusBox(s) {
      var b = "/assets/bonus/k9/" + s.slug, d = document.createElement("section"); d.className = "card bonus-box no-print rise";
      d.innerHTML = '<h2 class="h3">' + esc(s.nick) + ', for your phone and your wall</h2>' +
        '<div class="bonus-grid"><a href="' + b + '-phone.jpg" download="' + s.slug + '-phone-wallpaper.jpg"><img src="' + b + '-phone.jpg" alt="Phone wallpaper: ' + esc(s.nick) + '" loading="lazy" width="1179" height="2556"><span>Phone wallpaper</span></a>' +
        '<a href="' + b + '-chart.jpg" download="' + s.slug + '-compatibility-chart.jpg"><img src="' + b + '-chart.jpg" alt="Compatibility chart: ' + esc(s.nick) + '" loading="lazy" width="1080" height="1920"><span>Compatibility chart</span></a></div>' +
        '<p class="small"><a class="link-arrow" href="' + b + '-desktop.jpg" download="' + s.slug + '-desktop-wallpaper.jpg">Desktop wallpaper</a> · On a phone, press and hold an image to save it.</p>';
      d.addEventListener("click", function (e) { var a = e.target.closest("a[download]"); if (a && BY.track) BY.track("bonus-dl-" + P.slug, "Bonus download"); });
      return d;
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
          if (a === "pdf") {
            if (PAY && !PAY.owns(P.slug)) { BY.toast("Your PDF unlocks the moment the purchase is confirmed."); return; }
            BY.track("pdf-" + P.slug, "Save as PDF: " + P.slug);
            location.href = (ready() ? readUrl() + "&" : P.readUrl + "?") + "print=1"; return;
          }
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
    /* after a paid reading: one card offering the rest of the shelf as All Readings. Honest math: the readings this browser
       does not own yet, at their real one-by-one prices, against the bundle price (no strike-through anchor here). */
    function upsell() {
      var box = $("rdCross"), shelf = box.querySelector(".shelf"), SH = P.shelf; if (!shelf || box.querySelector(".upsell") || !SH || !SH.items) return;
      var left = SH.items.filter(function (x) { return !BY.load("lic_" + x[0]); }), sum = 0;
      left.forEach(function (x) { sum += +x[1]; });
      var price = +SH.price, save = sum - price;
      if (left.length < 2 || save <= 0) return; // nothing honest to offer
      shelf.hidden = true;
      var c = document.createElement("div"); c.className = "card upsell center";
      c.innerHTML = '<h3>Add every other reading for ' + BY.moneyHTML(price) + "</h3>" +
        '<p class="muted">The other ' + left.length + " readings cost " + BY.moneyHTML(Math.round(sum * 100) / 100) + " one by one. All Readings is " + BY.moneyHTML(price) + ". Each one opens straight away, no forms.</p>" +
        PAY.buyLink("all-readings", "Add all " + left.length + " · " + BY.moneyHTML(price)) +
        PAY.trust + PAY.consent + PAY.statusEl("all-readings") + '<p class="small"><a href="/readings/all-readings/">See what\'s inside</a></p>';
      shelf.parentNode.insertBefore(c, shelf);
      BY.trackOnce("upsell-shown-" + P.slug, "Bundle card shown after purchase: " + P.slug);
      PAY.watch("all-readings", function () { c.innerHTML = '<h3>Done. Every reading is yours.</h3><p class="muted">Bom saved them all to this browser. Pick the next one.</p>'; shelf.hidden = false; });
    }
    function mins(w) { return Math.max(1, Math.round(w / 238)); }
    function aboutThis(R, L) {
      var words = L.words, min = mins(words);
      return '<section class="rise chap about-reading"><p class="kicker">About this reading</p><p class="muted small">This reading is ' + L.chapters + " illustrated chapters and " + L.panels + " panels. " +
        (R.hasHour ? "It uses four pillars: your birth year, month, day and hour. " : "It uses three pillars: your birth year, month and day. A birth hour would add a fourth. ") +
        "It doesn't include your 10-year luck cycles (대운), which traditional readers use for timing. If you were born between 11 pm and midnight, some saju schools count you as the next day's Day Master" +
        (NEED_THEIR ? ". The parts that use their birthday compare your Day Masters, both chart strengths and your day branches; a full Korean compatibility reading (궁합) compares both whole charts"
          : PAIR ? ". The chapter on the two of you compares your Day Masters (and notes your day branches); a full Korean compatibility reading (궁합) compares both whole charts" : "") +
        ". For entertainment and self-reflection.</p></section>";
    }
    /* the "what backs you up" line above the strength chapter (same count as the cover card; round 3 2026-11-07: plain words,
       no points, same parts and the same strong/soft result as R.dmStrength) */
    function strengthHow(R) {
      var el = D.EL_NAMES[R.dayMasterEl];
      var names = { season: R.seasonKey === "earth" ? "your birth season (the Earth days)" : "your birth season (" + R.seasonElName + " in command)", day_branch: "your birth day\u2019s animal",
        year_branch: "your birth year\u2019s animal", hour_branch: "your birth hour\u2019s animal", year_stem: "your birth year\u2019s element", month_stem: "your birth month\u2019s element", hour_stem: "your birth hour\u2019s element" };
      var yes = R.strengthParts.filter(function (p) { return p.ok; }).map(function (p) { return names[p.part]; });
      var list = yes.length > 1 ? yes.slice(0, -1).join(", ") + " and " + yes[yes.length - 1] : yes[0];
      return "Bom and Yeon look at what backs your " + el + " up: more " + el + ", or the element that feeds it. " +
        (yes.length ? "For you that\u2019s " + list + "." : "Nothing in your birth date does.") + " The season counts most, and overall your " + el +
        (R.dmStrength === "strong" ? " reads as strong." : " reads as soft.") + " A simplified reading of the birth date you gave.";
    }
  }

  if (P.mode === "read") readPage(); else productPage();
})();
