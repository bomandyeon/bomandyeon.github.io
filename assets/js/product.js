/* Product page (preview) and reading page (full personalized webtoon). One file, mode from window.BY_PRODUCT.mode.
 * Product page loads /readings/<slug>/preview.json only (2 chapters + 3 panels per Day Master).
 * Reading page loads one file per Day Master (/readings/<slug>/read/d/<dm>.<hash>.json) with chapters, season,
 * strength, balance and pair layers (see SPEC-V2-PERSONALIZATION.md). */
(function () {
  "use strict";
  /* Drop Stripe Payment Links in here when checkout is ready, e.g. {"situationship": "https://buy.stripe.com/..."}.
     While a slug has no link, the buy button opens the full reading free as a founding reader gift.
     (Server side of the switch: FULL_DATA_PUBLIC in src/build.py.) */
  var STRIPE_LINKS = {};

  var BY = window.BY, D = window.BY_DATA, P = window.BY_PRODUCT, $ = BY.$, esc = BY.esc, PL = window.BYPlan, PAIRS = window.BY_PAIRS || {};
  if (!P) return;
  var EL_LOWER = ["wood", "fire", "earth", "metal", "water"];
  var SEASON_HZ = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  var ART = P.art || [1, 2, 3, 4, 11, 12];
  var EXTRA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(function (n) { return ART.indexOf(n) < 0; }); // season, balance x2, pair x3
  var PAIR = P.pair || (P.two ? "required" : "");
  var THEIR_KEY = PAIR === "optional" ? "their_" + P.slug : "their";
  BY.fillSelects();

  function qsDate(k) { var m = new RegExp("[?&]" + k + "=([0-9-]{10})").exec(location.search); return m ? BY.fromIso(m[1]) : null; }
  var birth = qsDate("b") || BY.load("birth"), their = PAIR ? (qsDate("t") || BY.load(THEIR_KEY)) : null, name = BY.load("name") || "";

  function readUrl() { return P.readUrl + "?b=" + BY.iso(birth) + (PAIR && their ? "&t=" + BY.iso(their) : ""); }
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
    var nm = form.querySelector('[name="nm"]'); if (nm && name) nm.value = name;
    BY.fillExtras(form);
  }

  function panel(art, p, nar) {
    var b = [{ who: who(p.speaker), text: p.text }];
    if (nar) b.unshift({ text: nar });
    return BY.panel(art, b, who(p.speaker) + " speaks in a comic panel");
  }
  function webtoon(list) { var wt = document.createElement("div"); wt.className = "webtoon"; list.forEach(function (f) { if (f) wt.appendChild(f); }); return wt; }
  function chapterHTML(title, text, kicker) { return '<section class="rise chap">' + (kicker ? '<p class="kicker">' + esc(kicker) + "</p>" : "") + "<h3>" + esc(title) + "</h3>" + BY.paras(text) + "</section>"; }
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
      if (readForm(form, $("pvErr"))) renderPreview(true);
    });
    function renderPreview(scroll) {
      var R = analyze(), s = D.SOULS[R.dayMaster];
      var code = $("pvCode"), note = $("pvCodeNote");
      if (code) { code.textContent = R.readingCode;  note.textContent = "This is yours: " + s.name + ", born in " + PL.seasonShort(R) + ", " + (R.dmStrength === "strong" ? "strong (S)" : "weak (W)") + ". Same code, same reading. Ask a friend for theirs."; code.parentNode.classList.add("is-yours"); }
      out.innerHTML = '<p class="center muted">Bom and Yeon are pulling your chapters…</p>';
      data().then(function (J) {
        var d = J.by_day_master[s.slug];
        if (!d) { out.innerHTML = '<p class="err">This reading is still being written for ' + esc(s.name) + ". Try another one for now.</p>"; return; }
        out.innerHTML = "";
        var head = document.createElement("div");
        head.className = "center rise";
        head.innerHTML = '<p class="kicker">' + (name ? esc(name) + "'s preview" : "Your preview") + '</p><h2><span class="hz" style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + "</span> " + esc(s.name) + "</h2>" +
          '<ul class="tags"><li>' + seasonHz(R) + " " + esc(seasonLine(R)) + "</li><li>" + esc(strengthWord(R)) + "</li>" +
          (PAIR && R.partner ? "<li>You + " + esc(D.SOULS[R.partner.dayMaster].name) + "</li>" : "") + "</ul>" +
          '<p class="code code--sm">' + esc(R.readingCode) + "</p>" + termBanner(R);
        out.appendChild(head);
        var arts = ART;
        out.appendChild(webtoon((d.panels || []).slice(0, 3).map(function (p, i) { return panel(arts[i % arts.length], p, i === 0 ? s.hanja + " · " + s.name + ", " + s.nick.toLowerCase() + "." : null); })));
        var extra = ["your " + PL.seasonShort(R) + " chapter", "your " + (R.dmStrength === "strong" ? "strong" : "weak") + "-chart section", "your element balance"];
        if (PAIR && R.partner) extra.push("the chapter on you and " + D.SOULS[R.partner.dayMaster].name);
        var tx = html(J.chapters.slice(0, 2).map(function (ch) { return chapterHTML(ch.title, d.chapters[ch.id] || ""); }).join("") +
          '<div class="chapter-lock rise"><p class="kicker">' + (J.chapters.length - 2) + ' more chapters</p><p class="muted small">Plus ' + esc(extra.join(", ")) + '.</p><ul class="chips">' +
          J.chapters.slice(2).map(function (ch) { return "<li>" + esc(ch.title) + "</li>"; }).join("") + "</ul>" +
          '<button class="btn" type="button" data-buy>' + buyLabel() + "</button>" + giftNote() + "</div>");
        out.appendChild(tx);
        BY.watch(out);
        if (scroll) out.scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth", block: "start" });
      }).catch(function () { out.innerHTML = '<p class="err">The preview didn\'t load. Check your connection and press the button again.</p>'; });
    }
    function buyLabel() { return STRIPE_LINKS[P.slug] ? "Get the full reading · $" + P.price : "Open the full reading"; }
    function giftNote() { return STRIPE_LINKS[P.slug] ? "" : '<p class="gift"><b>Founding reader gift</b>This reading is $' + P.price + ". Our first readers get it free. No card, no charge.</p>"; }
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-buy]")) return;
      e.preventDefault();
      if (!birth || (PAIR === "required" && !their)) {
        $("pvErr").textContent = PAIR === "required" ? "Add both birthdays first, so the reading is written for the two of you." : "Add your birthday first, so the reading is written for you.";
        $("preview").scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth" }); form.querySelector("select").focus({ preventScroll: true }); return;
      }
      var link = STRIPE_LINKS[P.slug];
      location.href = link ? link + (link.indexOf("?") < 0 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(P.slug + "_" + Math.random().toString(36).slice(2, 10)) : readUrl();
    });
    if (birth && (PAIR !== "required" || their)) renderPreview(false);
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
    function need() { return !birth || (PAIR === "required" && !their); }
    if (need()) {
      $("rdAsk").hidden = false; fillForm(form);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!readForm(form, $("rdErr"))) return;
        $("rdAsk").hidden = true;
        try { history.replaceState(null, "", readUrl()); } catch (x) { /* file:// */ }
        render();
      });
    } else render();

    function render() {
      var R = analyze(), s = D.SOULS[R.dayMaster], them = R.partner ? D.SOULS[R.partner.dayMaster] : null;
      out.innerHTML = '<p class="center muted">Opening your reading…</p>';
      fetch(P.files[s.slug]).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); }).then(function (J) {
        out.innerHTML = "";
        var info = coverInfo(R, s, them, J.title);
        out.appendChild(coverCard(info, R));
        if (R.termDay) out.appendChild(html(termBanner(R)));
        out.appendChild(actions());
        if (PAIR === "required" && them) out.appendChild(bondBox(R, s, them));

        var base = (J.panels || []).slice(0, 6), PLN = PL.plan(R, J), bp = PLN.balance, pr = them && J.pairs ? J.pairs[them.slug] : null;
        var ch = J.chapters, T = J.text || {};
        function chs(a, b) { return ch.slice(a, b).map(function (c) { return c.id === "colors" ? chapterHTML(c.title, (T[c.id] || "") + "\n\n" + colorNote(R)) : chapterHTML(c.title, T[c.id] || ""); }).join(""); }
        function bp0(i) { return base[i] ? panel(ART[i % ART.length], base[i], i === 0 ? s.hanja + " · " + s.name + ", " + s.nick.toLowerCase() + "." : null) : null; }

        // 1. opening panels + season panel, season chapter
        out.appendChild(webtoon([bp0(0), bp0(1), PLN.seasonPanel ? panel(EXTRA[0], PLN.seasonPanel, PLN.seasonNarration) : null]));
        out.appendChild(html(chapterHTML(PL.seasonTitle(R, s.name), PLN.seasonIntro, seasonLine(R))));
        // 2. first Day Master chapters
        out.appendChild(webtoon([bp0(2)]));
        out.appendChild(html(chs(0, 2)));
        // 3. balance panels + balance section
        out.appendChild(webtoon([bp0(3), bp.panels[0] ? panel(EXTRA[1], bp.panels[0], bp.nar) : null, bp.panels[1] ? panel(EXTRA[2], bp.panels[1]) : null]));
        out.appendChild(html(balanceHTML(R, bp)));
        out.appendChild(html(chs(2, 4)));
        // 4. strength section
        out.appendChild(webtoon([bp0(4)]));
        out.appendChild(html(strengthHTML(R, PLN)));
        // 5. pair chapter (ex with their birthday, situationship)
        if (pr) {
          var pk = "You " + s.hanja + " " + s.name + " + them " + them.hanja + " " + them.name;
          out.appendChild(webtoon(pr.panels.slice(0, 3).map(function (p, i) { return panel(EXTRA[3 + i], p, i === 0 ? s.hanja + " + " + them.hanja + " · you and them." : null); })));
          out.appendChild(html(chapterHTML(pr.title, pr.text, pk)));
        } else if (PAIR === "optional") {
          out.appendChild(html('<div class="card rise no-print add-their"><p class="kicker">One more chapter</p><p>Add their birthday and Bom and Yeon write a chapter on how your two patterns meet.</p>' +
            '<form id="addTheir" class="form-stack" novalidate>' + document.querySelector("#rdForm .selects[aria-label^='Their']").outerHTML + '<p class="err" id="atErr" role="alert"></p><button class="btn" type="submit">Add the chapter</button></form></div>'));
        }
        // 6. last panel, remaining chapters, closing
        out.appendChild(webtoon([bp0(5)]));
        out.appendChild(html(chs(4, ch.length) +
          '<div class="say say--yeon rise"><span class="av av--yeon"><img src="/assets/img/av-yeon.webp" alt="" width="56" height="56"><img src="/assets/img/av-yeon-blink.webp" alt="" width="56" height="56"></span><p class="bubble"><b>Yeon</b>' + esc(D.YEON_MSG[R.dayMasterEl]) + "</p></div>"));
        out.appendChild(html(aboutThis(R, out)));
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
        '<div class="bars">' + bars + "</div>" +
        '<p class="code">' + esc(I.code) + '</p><p class="muted small">Your reading code. Same code, same reading.</p>' +
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
          if (a === "pdf") window.print();
          // the ex reading's title never goes on anything public: share text and story card use a neutral title
          var pub = /ex-come-back/.test(P.slug) ? "My saju reading" : title;
          if (a === "share") BY.share(pub, "Bom and Yeon read my chart: " + pub + " (" + info.code + ")", "https://bomandyeon.com/readings/" + P.slug + "/");
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
    function balanceHTML(R, bp) {
      var txt = bp.blocks.map(function (b) { return "<h4>" + esc(b.h) + "</h4>" + BY.paras(b.t) + (b.note ? '<p class="muted small">' + esc(b.note) + "</p>" : ""); }).join("");
      return '<section class="rise chap"><p class="kicker">Your element balance</p><h3>What you have plenty of, and what you lack</h3>' + txt + "</section>";
    }
    /* Glow-up: color advice keyed on the chart's strength (balancing element for strong charts, support for weak ones) */
    function colorNote(R) {
      var C = ["deep green, sage or olive", "coral, rust or a warm red", "camel, sand or ochre", "crisp white, silver or soft gray", "navy, ink or deep blue"];
      var e = R.dayMasterEl, m = function (r) { return (e + r) % 5; };
      if (R.dmStrength === "strong") return "Your chart is strong, so it already carries plenty of your home palette. Treat those colors as your base and let balancing colors do the lifting: " +
        C[m(1)] + ", or " + C[m(2)] + ". A touch of " + C[m(3)].split(", ").pop().replace("or ", "") + " works as an accent.";
      return "Your chart is weak, so your home palette is your boost, not your excess. Wear it generously and back it with your support colors, " + C[m(4)] + ". Keep " + C[m(3)].split(", ")[0] + " to small accents.";
    }
    function aboutThis(R, root) {
      var words = [].reduce.call(root.querySelectorAll(".chap, .bubble"), function (n, el) { return n + (el.textContent || "").split(/\s+/).filter(Boolean).length; }, 0), min = Math.max(1, Math.round(words / 238));
      return '<section class="rise chap about-reading"><p class="kicker">About this reading</p><p class="muted small">This reading is about ' + words.toLocaleString("en-US") + " words, roughly " + min + " minute" + (min > 1 ? "s" : "") + " of reading. " +
        (R.hasHour ? "It uses four pillars: your birth year, month, day and hour. " : "It uses three pillars: your birth year, month and day. A birth hour would add a fourth. ") +
        "It doesn't include your 10-year luck cycles (대운), which traditional readers use for timing. If you were born between 11 pm and midnight, some saju schools count you as the next day's Day Master" +
        (PAIR ? ". The chapter on the two of you compares your Day Masters (and notes your day branches); a full Korean compatibility reading (궁합) compares both whole charts" : "") +
        ". For entertainment and self-reflection.</p></section>";
    }
    function strengthHTML(R, PLN) {
      var names = { season: R.seasonKey === "earth" ? "your season (the Earth days)" : "your season (" + R.seasonElName + " in command)", day_branch: "your day branch", year_branch: "your year branch", hour_branch: "your hour branch",
        year_stem: "your year stem", month_stem: "your month stem", hour_stem: "your hour stem" };
      var yes = R.strengthParts.filter(function (p) { return p.ok; }).map(function (p) { return names[p.part]; });
      var how = "Bom and Yeon count what backs your " + D.EL_NAMES[R.dayMasterEl] + " up: your own element or the one that feeds it. " +
        (yes.length ? "Support comes from " + yes.join(", ") + "." : "None of your pillars carries it.") + " That is " + R.strengthScore + " of " + R.strengthMax + " points, with the season worth the most. A simplified count from the pillars we have.";
      return '<section class="rise chap"><p class="kicker">' + esc(strengthWord(R)) + " · " + R.strengthScore + " of " + R.strengthMax + "</p><h3>" +
        (R.dmStrength === "strong" ? "A strong chart: your blind spot is pushing" : "A weak chart: your blind spot is giving too much") + "</h3>" +
        '<p class="muted small">' + esc(how) + "</p>" + (PLN.strengthBridge ? "<p>" + esc(PLN.strengthBridge) + "</p>" : "") + BY.paras(PLN.strengthText) + "</section>";
    }
  }

  if (P.mode === "read") readPage(); else productPage();
})();
