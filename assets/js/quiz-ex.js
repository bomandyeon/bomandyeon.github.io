/* /ex/start/ tap quiz (2026-11-08, A/B entry for /ex/). One tap per screen, then straight into the /ex/ comic.
 * Hands over exactly what the /ex/ form would store: by_birth, by_btime (cleared for a new birthday), by_name, the product's
 * intake answers (by_ans_will-your-ex-come-back, same ids/values as content/products/will-your-ex-come-back.v4.json "intake"),
 * by_wiz_<slug>, and the link id ?s=<id> (BY.urlState), so no readable birthday or answer ever sits in an address.
 * Raw answers also in localStorage "quiz_ex". Email (v5, 2026-11-09, Rok approved): optional on the last screen, same /save-link worker as the paywall box; reminders only with the box ticked.
 * Keep INTAKE in sync with the v4.json intake if that ever changes. */
(function () {
  "use strict";
  var BY = window.BY, SLUG = "will-your-ex-come-back", root = document.getElementById("qz");
  if (!BY || !root) return;
  var INTAKE = [
    { id: "who_ended", question: "Who ended it?", options: [["me", "I did"], ["them", "They did"], ["mutual", "We both did, more or less"], ["unclear", "It faded out, or it's complicated"]] },
    { id: "how_long", question: "How long ago did it end?", options: [["fresh", "Less than a month"], ["months", "One to six months"], ["half", "Six to twelve months"], ["long", "Over a year"]] },
    { id: "what_you_want", question: "What do you want right now, honestly?", options: [["back", "To get back together"], ["closure", "Closure, some kind of answer"], ["move", "To stop thinking about them"], ["unsure", "I don't know"]] }
  ];
  var SAYS = {
    who_ended: ["bom", "No wrong answer. It changes what we draw for you."],
    how_long: ["yeon", "Be honest. We can count."],
    what_you_want: ["yeon", "Be honest. It changes the comic."]
  };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var TOTAL = 4, OFF = 0, st = { ans: {}, m: 0, d: 0, dec: 0, y: 0, name: "", who: "me", b: null, t: null }, hist = [], cur = null, firstBday = true;
  var MAXY = new Date().getFullYear() - BY.MIN_AGE;

  /* ---------- tracking: plain event + via-<tag>-<event> (site.js only doubles its own funnel names) ---------- */
  function ev(n, title) {
    BY.trackOnce("quiz-ex-" + n, "Quiz ex: " + (title || n));
    var tag = BY.viaTag ? BY.viaTag() : "none";
    BY.trackOnce("via-" + tag + "-quiz-ex-" + n, "Quiz ex: " + (title || n) + " via " + tag);
    BY.trackOnce("qv5-" + DEV + "-" + n, "Quiz v5 (" + DEV + "): " + (title || n));
  }
  /* v5 measurement (2026-11-09 22:xx deploy): every quiz step also as qv5-<mob|desk>-<step>, so the new version and the device
   * are counted apart from everything before. Funnel steps after the quiz (result-rendered, ch1-view, ch2-end-reached,
   * paywall-view, checkout-click) keep their own names; split them by the deploy time. */
  var DEV = (function () { try { return window.matchMedia("(pointer: coarse)").matches ? "mob" : "desk"; } catch (e) { return "na"; } })();
  if (BY.sessionSrc) BY.trackOnce("land-" + BY.sessionSrc() + "-quiz-ex", "Landed (" + BY.sessionSrc() + "): quiz ex /ex/start/");
  BY.trackOnce("qv5-" + DEV + "-land", "Quiz v5 (" + DEV + "): landed");

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(who, text) {
    return '<div class="say say--' + who + '"><span class="av av--' + who + '"><img src="/assets/img/av-' + who + '.webp" alt="" width="44" height="44"></span><p class="bubble"><b>' + (who === "yeon" ? "Yeon" : "Bom") + "</b>" + esc(text) + "</p></div>";
  }
  function frame(n, inner, noBack) {
    if (typeof n === "number" && n > 0) n -= OFF;
    var top = n === "almost" ? '<div class="qz__top">' + (noBack ? "<span></span>" : '<button type="button" class="qz__back" data-back>\u2190 Back</button>') + '<span class="qz__step">Almost done</span></div>' : n ? '<div class="qz__top">' + (noBack ? "<span></span>" : '<button type="button" class="qz__back" data-back>\u2190 Back</button>') + '<span class="qz__step">' + n + " of " + TOTAL + '</span></div><div class="qz__bar"><i style="width:' + Math.round(n / TOTAL * 100) + '%"></i></div>' : "";
    root.innerHTML = top + inner;
    window.scrollTo(0, 0);
    var b = root.querySelector("[data-back]"); if (b) b.addEventListener("click", back);
  }
  function opt(v, label, attrs) { return '<button type="button" class="qz__opt" data-v="' + esc(v) + '"' + (attrs || "") + ">" + esc(label) + "</button>"; }
  function onPick(fn) {
    [].forEach.call(root.querySelectorAll(".qz__opt"), function (b) {
      b.addEventListener("click", function () { if (b.disabled) return; b.classList.add("is-on"); setTimeout(function () { fn(b.getAttribute("data-v")); }, 140); });
    });
  }
  function show(fn) { if (cur) hist.push(cur); cur = fn; fn(); }
  function back() { if (!hist.length) return; cur = hist.pop(); cur(); }

  /* ---------- screens ---------- */
  /* v4 (2026-11-09, Rok: everyone who taps the ad needs a reason to start): the first screen is the first question, "what's going on in your love life".
   * An ex runs the ex intake as before; every other answer skips straight to the birthday, then opens that reading (#go, or #preview where a second birthday is needed). */
  var PATHS = [
    ["ex", "An ex I can\u2019t stop thinking about", null, "ex"],
    ["situationship", "A crush or a situationship", "situationship", "situationship"],
    ["together", "I\u2019m in a relationship", "couple-reading", "couple"],
    ["single", "Single, and I keep picking the wrong people", "what-kind-of-lover", "lover"],
    ["me", "None of these. Just tell me about me", "brutally-honest", "brutal"]
  ], path = null;
  function hook() {
    frame(0, '<h1 class="qz__h">What\u2019s going on in your love life?</h1>' +
      say("yeon", "Tap one. I read your Korean birthday chart and show you the pattern behind it. Bom draws it as your comic. First 2 chapters free.") +
      '<div class="qz__opts">' + PATHS.map(function (x) { return '<button type="button" class="qz__opt qz__opt--cov" data-v="' + x[0] + '"><img src="/assets/img/cover-' + x[3] + '-360.webp" alt="" width="360" height="447"><span>' + esc(x[1]) + '</span></button>'; }).join("") + '</div>' +
      '<p class="qz__note">A few taps \u00b7 no sign-up \u00b7 your birthday stays in your browser</p>');
    onPick(function (v) {
      path = null; PATHS.forEach(function (x) { if (x[0] === v) path = x; });
      ev("start", "started"); ev("path-" + v, "path " + v);
      st.who = "me"; st.t = null;
      st.b = null; st.t = null;
      if (!path[2]) { TOTAL = 4; show(function () { question(0); }); }
      else { TOTAL = isPair() ? 2 : 1; BY.store("pick", { s: path[2], t: Date.now() }); show(function () { bday("me"); }); }
    });
  }
  function question(i) {
    var q = INTAKE[i], s = SAYS[q.id];
    frame(i + 1, (i === 0 && EXFIRST ? '<p class="qz__lead">A personal comic from your Korean birthday chart: the pattern that keeps pulling you back to them. Three questions and your birthday. First 2 chapters free, no sign-up.</p>' : "") + say(s[0], s[1]) + '<h1 class="qz__h">' + esc(q.question) + '</h1><div class="qz__opts">' + q.options.map(function (o) { return opt(o[0], o[1]); }).join("") + "</div>", !hist.length);
    onPick(function (v) {
      if (i === 0 && EXFIRST) { ev("start", "started"); ev("path-ex", "path ex"); }
      st.ans[q.id] = v; ev("q" + (i + 1), q.id + " answered");
      show(i + 1 < INTAKE.length ? function () { question(i + 1); } : function () { bday("me"); });
    });
  }
  function bdayTouch() { if (firstBday) { firstBday = false; BY.trackOnce("form-started-" + SLUG, "Birthday picker first used: " + SLUG + " (quiz)"); } }
  /* v5 (2026-11-09, Rok approved the package): the whole birthday on ONE screen, the site's own date input (month as a word,
   * day and year typed: BY.dateHTML / BY.readDate), no star sign, no decade. Pair readings ask theirs on a second, identical screen. */
  function isPair() { return !!(path && (path[2] === "situationship" || path[2] === "couple-reading")); }
  var meScreen = null, meAt = 0;
  function bday(who) {
    st.who = who;
    var th = who === "them", n = path && path[2] ? (th ? 2 : 1) : 4, step = path && path[2] && !isPair() ? "almost" : n;
    if (!th) { meAt = hist.length; meScreen = cur; }
    frame(step, (th ? say("yeon", "Now theirs. Their birthday is the other half of the chemistry.") : say("bom", "Your birthday stays in your browser. We don\u2019t keep it.")) +
      '<h1 class="qz__h">' + (th ? "When were they born?" : "When were you born?") + '</h1>' +
      '<form data-f novalidate>' + BY.dateHTML(th ? "t" : "b", th ? "Their birthday" : "Your birthday", !th) +
      '<p class="qz__err" role="alert"></p><button class="btn btn--block qz__go" type="submit">Continue</button></form>', !hist.length);
    var f = root.querySelector("[data-f]"), err = f.querySelector(".qz__err"), pre = th ? st.t : (st.b || BY.load("birth"));
    BY.fillSelects(f);
    if (pre) BY.setDate(f, th ? "t" : "b", pre);
    ["pointerdown", "keydown", "input"].forEach(function (t) { f.addEventListener(t, bdayTouch, { once: true, capture: true }); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = BY.readDate(f, th ? "t" : "b");
      if (r.error) { err.textContent = r.error; return; }
      if (BY.ageOn(r) < BY.MIN_AGE) { err.textContent = "Readings here are for 18 and over."; return; }
      err.textContent = "";
      st.y = r.year; st.m = r.month; st.d = r.day;
      if (th) { st.t = r; ev("bday-them", "their birthday given"); loader(st.b); return; }
      var old = BY.load("birth");
      if (!old || BY.iso(old) !== BY.iso(r)) BY.store("btime", null); // a different birthday: an old birth time doesn't belong to it
      BY.store("birth", r);
      ev("bday", "birthday given");
      BY.trackOnce("birthday-submit-" + SLUG, "Birthday submitted: " + SLUG + " (quiz)");
      st.b = r; st.t = null;
      if (isPair()) { show(function () { bday("them"); }); return; }
      loader(r);
    });
  }
  /* Loader (v2, MoonReading-style "Customizing your reading"): three short lines, one after another over ~3.5 s.
   * Every line is computed from the birthday by the saju engine (season of the birth month by solar terms, day master). No progress numbers. */
  var loadTok = 0;
  function loader(b) {
    var s = null, R = null;
    try { R = BY.analyze(b); s = window.BY_DATA.SOULS[R.dayMaster]; } catch (e) { s = null; }
    ev("loader", "loader shown");
    var lines = [];
    if (R && R.season) lines.push(["Your birth season", (R.seasonKey === "earth" ? "late " : "") + R.season]);
    if (s) lines.push(["Your day master", s.name + ", " + s.nick]);
    lines.push(["", "Drawing your comic\u2026"]);
    var tok = ++loadTok;
    frame(0, '<p class="qz__conf">You entered: ' + MONTHS[b.month - 1] + " " + b.day + ", " + b.year + (st.t ? " \u00b7 them: " + MONTHS[st.t.month - 1] + " " + st.t.day + ", " + st.t.year : "") + ' <button type="button" class="qz__change" data-change>Change</button></p>' +
      '<div class="qz__load" role="status"><p class="dm">' + (st.name ? esc(st.name) + ", we\u2019re reading your chart" : "Reading your chart") + '</p>' +
      '<ul class="qz__steps" data-steps></ul></div>');
    root.querySelector("[data-change]").addEventListener("click", function () { loadTok++; hist = hist.slice(0, meAt); st.t = null; cur = function () { bday("me"); }; cur(); });
    var box = root.querySelector("[data-steps]"), i = 0, ms = BY.reduced ? 300 : 1150;
    (function tick() {
      if (tok !== loadTok) return;
      if (i >= lines.length) { setTimeout(function () { if (tok === loadTok) { cur = fin; fin(); } }, BY.reduced ? 200 : 600); return; }
      var li = document.createElement("li"), L = lines[i];
      li.innerHTML = L[0] ? '<span class="k">' + esc(L[0]) + '</span><b>' + esc(L[1]) + "</b>" : "<b>" + esc(L[1]) + "</b>";
      box.appendChild(li); i++; setTimeout(tick, ms);
    })();
  }
  /* v5 final screen: name and email both optional, one button straight into the comic. Email only sends the link;
   * reminders only with the box ticked (same rule as the paywall mail box). Never waits on the mail worker for long. */
  function fin() {
    var ex = !(path && path[2]);
    frame("almost", say("bom", "Your comic is ready. Both boxes are optional.") + '<h1 class="qz__h">Read your comic</h1>' +
      '<form data-f novalidate><label><span class="field-label">First name, so the comic can say it (optional)</span><input class="input" name="n" autocomplete="given-name" autocapitalize="words" maxlength="24" placeholder="First name" enterkeyhint="' + (ex ? "next" : "go") + '" value="' + esc(st.name) + '"></label>' +
      (ex ? '<label style="display:block;margin-top:12px"><span class="field-label">Email, if you want the link for later (optional)</span><input class="input" type="email" name="e" inputmode="email" autocomplete="email" spellcheck="false" maxlength="254" placeholder="Your email" enterkeyhint="go"></label>' +
        '<label class="qz__priv" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="rem"> <span>Also remind me, at most twice in the next 3 days</span></label>' : "") +
      '<p class="qz__err" role="alert"></p><button class="btn btn--block qz__go" type="submit">Read my comic now</button>' +
      (ex ? '<p class="qz__priv">The email only gets the link (and the reminders if you tick the box). No list, and we delete your address within 14 days. <a href="/privacy/#link-email">Privacy</a></p>' : "") + '</form>', true);
    var f = root.querySelector("[data-f]");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var nm = (f.n.value || "").replace(/[<>]/g, "").trim().slice(0, 24), err = f.querySelector(".qz__err"), btn = f.querySelector("button[type=submit]");
      st.name = nm; BY.store("name", nm || null);
      if (!ex) { ev("fin", "final screen done"); toReading(); return; }
      var v = f.e ? (f.e.value || "").trim() : "";
      if (v && (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(v) || v.length > 254)) { err.textContent = "That email doesn\u2019t look right. Fix it, or clear the box to read now."; f.e.focus(); return; }
      ev("fin", "final screen done"); if (!v) ev("noemail", "read without email");
      btn.disabled = true; btn.textContent = "Opening your comic\u2026";
      if (!v) { done(); return; }
      var link = "https://bomandyeon.com/readings/" + SLUG + "/" + BY.urlState.query(urlObj(), true) + "#preview", left = false, rem = !!(f.rem && f.rem.checked);
      var go = function () { if (!left) { left = true; done(); } };
      setTimeout(go, 1500); // never hold the comic hostage to the mail worker
      try {
        fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/save-link", { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ email: v, slug: SLUG, url: link, remind: rem, t: "" }) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok) { BY.store("sl_" + SLUG, 1); BY.store("email_given", 1); ev("email", "email submitted"); if (rem) ev("remind", "reminders ticked"); BY.track("email-submit-" + SLUG, "Quiz email link: " + SLUG); }
            go();
          }).catch(go);
      } catch (x) { go(); }
    });
  }
  function ansStr() { return INTAKE.map(function (q) { return st.ans[q.id]; }).join("."); }
  function urlObj() { return { b: { year: st.y, month: st.m, day: st.d }, t: null, a: ansStr() }; }
  function done() {
    var a = {}; INTAKE.forEach(function (q) { a[q.id] = st.ans[q.id]; });
    BY.store("ans_" + SLUG, a); BY.store("wiz_" + SLUG, 1);
    try { localStorage.setItem("quiz_ex", JSON.stringify({ v: 1, ts: Date.now(), ans: a })); } catch (e) { /* private mode */ }
    ev("done", "handed to /ex/");
    var q = BY.urlState.query(urlObj(), false), keep = "";
    try {
      var p = new URLSearchParams(location.search);
      ["s", "x", "b", "t", "a", "r"].forEach(function (k) { p.delete(k); });
      keep = p.toString();
    } catch (e) { keep = ""; }
    location.href = "/ex/" + q + (keep ? (q ? "&" : "?") + keep : "");
  }
  function toReading() {
    var slug = path[2], pair = slug === "situationship" || slug === "couple-reading";
    ev("done-" + path[0], "handed to /readings/" + slug + "/");
    var keep = "";
    try { var p = new URLSearchParams(location.search); ["s", "x", "b", "t", "a", "r"].forEach(function (k) { p.delete(k); }); keep = p.toString(); } catch (e) { keep = ""; }
    if (pair && st.b && st.t) {
      var q = BY.urlState.query({ b: st.b, t: st.t }, false);
      location.href = "/readings/" + slug + "/" + q + (keep ? (q ? "&" : "?") + keep : "") + "#preview";
      return;
    }
    location.href = "/readings/" + slug + "/" + (keep ? "?" + keep : "") + (pair ? "#preview" : "#go");
  }
  /* v5: a visitor from a Meta ad (the ex ads) starts on the first ex question, no chooser screen in between (?p=ex does the same).
   * Everyone else gets the chooser. */
  var EXFIRST = (function () { try { return BY.sessionSrc() === "meta" || new URLSearchParams(location.search).get("p") === "ex"; } catch (e) { return false; } })();
  if (EXFIRST) { path = PATHS[0]; TOTAL = 4; cur = function () { question(0); }; cur(); }
  else { cur = hook; hook(); }
})();
