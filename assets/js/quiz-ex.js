/* /ex/start/ tap quiz (2026-11-08, A/B entry for /ex/). One tap per screen, then straight into the /ex/ comic.
 * Hands over exactly what the /ex/ form would store: by_birth, by_btime (cleared for a new birthday), by_name, the product's
 * intake answers (by_ans_will-your-ex-come-back, same ids/values as content/products/will-your-ex-come-back.v4.json "intake"),
 * by_wiz_<slug>, and the link id ?s=<id> (BY.urlState), so no readable birthday or answer ever sits in an address.
 * Raw answers also in localStorage "quiz_ex". Email (v2, 2026-11-08): required, MoonReading-style; same /save-link worker as the paywall box, with remind: true (link + at most 2 reminders).
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
  var TOTAL = 7, OFF = 0, st = { ans: {}, m: 0, d: 0, dec: 0, y: 0, name: "" }, hist = [], cur = null, firstBday = true;
  var MAXY = new Date().getFullYear() - BY.MIN_AGE;

  /* ---------- tracking: plain event + via-<tag>-<event> (site.js only doubles its own funnel names) ---------- */
  function ev(n, title) {
    BY.trackOnce("quiz-ex-" + n, "Quiz ex: " + (title || n));
    var tag = BY.viaTag ? BY.viaTag() : "none";
    BY.trackOnce("via-" + tag + "-quiz-ex-" + n, "Quiz ex: " + (title || n) + " via " + tag);
  }
  if (BY.sessionSrc) BY.trackOnce("land-" + BY.sessionSrc() + "-quiz-ex", "Landed (" + BY.sessionSrc() + "): quiz ex /ex/start/");

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
    ["ex", "An ex I can\u2019t stop thinking about", null],
    ["situationship", "A crush or a situationship", "situationship"],
    ["together", "I\u2019m in a relationship", "couple-reading"],
    ["single", "Single, and I keep picking the wrong people", "what-kind-of-lover"],
    ["me", "None of these. Just tell me about me", "brutally-honest"]
  ], path = null;
  function hook() {
    frame(0, '<h1 class="qz__h">What\u2019s going on in your love life?</h1>' +
      '<p class="qz__sub">Bom and Yeon read your Korean birthday chart and draw it as a comic about you. First 2 chapters free.</p>' +
      '<div class="qz__opts">' + PATHS.map(function (x) { return opt(x[0], x[1]); }).join("") + '</div>' +
      '<p class="qz__note">A few taps \u00b7 no sign-up \u00b7 your birthday stays in your browser</p>');
    onPick(function (v) {
      path = null; PATHS.forEach(function (x) { if (x[0] === v) path = x; });
      ev("start", "started"); ev("path-" + v, "path " + v);
      if (!path[2]) { OFF = 0; TOTAL = 7; show(function () { question(0); }); }
      else { OFF = 3; TOTAL = 4; BY.store("pick", { s: path[2], t: Date.now() }); show(sign); }
    });
  }
  function question(i) {
    var q = INTAKE[i], s = SAYS[q.id];
    frame(i + 1, say(s[0], s[1]) + '<h1 class="qz__h">' + esc(q.question) + '</h1><div class="qz__opts">' + q.options.map(function (o) { return opt(o[0], o[1]); }).join("") + "</div>");
    onPick(function (v) {
      st.ans[q.id] = v; ev("q" + (i + 1), q.id + " answered");
      show(i + 1 < INTAKE.length ? function () { question(i + 1); } : sign);
    });
  }
  function bdayTouch() { if (firstBday) { firstBday = false; BY.trackOnce("form-started-" + SLUG, "Birthday picker first used: " + SLUG + " (quiz)"); } }
  /* v3 (2026-11-08): star sign first, then only that sign's days grouped by month (MoonReading / SoulmateStory). One tap fixes month+day.
   * Tropical ranges, end dates inclusive. Feb shows 29 until the year is known; the year step then disables non-leap years (BY.validDate). */
  var ZOD = [["Aries", "\u2648", 3, 21, 4, 19], ["Taurus", "\u2649", 4, 20, 5, 20], ["Gemini", "\u264A", 5, 21, 6, 20], ["Cancer", "\u264B", 6, 21, 7, 22],
    ["Leo", "\u264C", 7, 23, 8, 22], ["Virgo", "\u264D", 8, 23, 9, 22], ["Libra", "\u264E", 9, 23, 10, 22], ["Scorpio", "\u264F", 10, 23, 11, 21],
    ["Sagittarius", "\u2650", 11, 22, 12, 21], ["Capricorn", "\u2651", 12, 22, 1, 19], ["Aquarius", "\u2652", 1, 20, 2, 18], ["Pisces", "\u2653", 2, 19, 3, 20]];
  var signAt = 0, zi = -1;
  function md(m, d) { return MONTHS[m - 1].slice(0, 3) + " " + d; }
  function sign() {
    signAt = hist.length;
    frame(4, say("yeon", "Now the part that actually matters. Your birthday.") + '<h1 class="qz__h">What\u2019s your star sign?</h1><div class="qz__grid qz__grid--z">' +
      ZOD.map(function (z, k) { return '<button type="button" class="qz__opt" data-v="' + k + '" aria-label="' + z[0] + ", " + md(z[2], z[3]) + " to " + md(z[4], z[5]) + '"><span class="g" aria-hidden="true">' + z[1] + '\uFE0E</span><b>' + z[0] + '</b><span class="r">' + md(z[2], z[3]) + " to " + md(z[4], z[5]) + "</span></button>"; }).join("") + "</div>");
    onPick(function (v) { bdayTouch(); zi = +v; show(day); });
  }
  function dim(m, y) { return new Date(y || 2000, m, 0).getDate(); } // 2000 is a leap year: Feb shows 29 until the year is known
  function day() {
    var z = ZOD[zi], h = "", grp = function (m, a, b) {
      var g = '<p class="qz__mlabel">' + MONTHS[m - 1] + '</p><div class="qz__grid qz__grid--d">';
      for (var d = a; d <= b; d++) g += opt(m + "-" + d, d, ' aria-label="' + MONTHS[m - 1] + " " + d + '"');
      return g + "</div>";
    };
    h = grp(z[2], z[3], dim(z[2])) + grp(z[4], 1, z[5]);
    frame(5, say("bom", "Your birthday stays in your browser. We don\u2019t keep it.") + '<h1 class="qz__h">What day were you born?</h1>' + h +
      '<p class="qz__note">Day not here? Go back and pick the sign next to yours.</p>');
    onPick(function (v) { var x = v.split("-"); st.m = +x[0]; st.d = +x[1]; show(decade); });
  }
  function decade() {
    var h = "";
    [1960, 1970, 1980, 1990, 2000].forEach(function (x) { h += opt(x, x + "s"); });
    frame(6, say("yeon", "Nobody\u2019s judging. Yet.") + '<h1 class="qz__h">What decade?</h1><div class="qz__opts">' + h + "</div>");
    onPick(function (v) { st.dec = +v; show(year); });
  }
  function okYear(y) { return BY.validDate(y, st.m, st.d) && BY.ageOn({ year: y, month: st.m, day: st.d }) >= BY.MIN_AGE; }
  function year() {
    var h = "", any = false;
    for (var y = st.dec; y < st.dec + 10 && y <= MAXY; y++) { var ok = okYear(y); any = any || ok; h += opt(y, y, ok ? "" : " disabled"); }
    frame(7, say("bom", "Last bit of the date.") + '<h1 class="qz__h">What year?</h1><div class="qz__grid qz__grid--y">' + h + "</div>" +
      (any ? "" : '<p class="qz__err">Readings here are for 18 and over.</p>'));
    onPick(function (v) {
      st.y = +v;
      var b = { year: st.y, month: st.m, day: st.d }, old = BY.load("birth");
      if (!old || BY.iso(old) !== BY.iso(b)) BY.store("btime", null); // a different birthday: an old birth time doesn't belong to it
      BY.store("birth", b);
      ev("bday", "birthday given");
      BY.trackOnce("birthday-submit-" + SLUG, "Birthday submitted: " + SLUG + " (quiz)");
      loader(b);
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
    frame(0, '<p class="qz__conf">You entered: ' + MONTHS[st.m - 1] + " " + st.d + ", " + st.y + ' <button type="button" class="qz__change" data-change>Change</button></p>' +
      '<div class="qz__load" role="status"><p class="dm">' + (st.name ? esc(st.name) + ", we\u2019re reading your chart" : "Reading your chart") + '</p>' +
      '<ul class="qz__steps" data-steps></ul></div>');
    root.querySelector("[data-change]").addEventListener("click", function () { loadTok++; hist = hist.slice(0, signAt); cur = sign; sign(); });
    var box = root.querySelector("[data-steps]"), i = 0, ms = BY.reduced ? 300 : 1150;
    (function tick() {
      if (tok !== loadTok) return;
      if (i >= lines.length) { setTimeout(function () { if (tok === loadTok) { cur = name; name(); } }, BY.reduced ? 200 : 600); return; }
      var li = document.createElement("li"), L = lines[i];
      li.innerHTML = L[0] ? '<span class="k">' + esc(L[0]) + '</span><b>' + esc(L[1]) + "</b>" : "<b>" + esc(L[1]) + "</b>";
      box.appendChild(li); i++; setTimeout(tick, ms);
    })();
  }
  function name() {
    frame("almost", say("bom", "So the comic can say your name. Optional.") + '<h1 class="qz__h">What\u2019s your first name?</h1>' +
      '<form data-f novalidate><label><span class="sr">First name</span><input class="input" name="n" autocomplete="given-name" autocapitalize="words" maxlength="24" placeholder="First name" enterkeyhint="next" value="' + esc(st.name) + '"></label>' +
      '<button class="btn btn--block qz__go" type="submit">Continue</button></form>', true);
    root.querySelector("[data-f]").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (this.n.value || "").replace(/[<>]/g, "").trim().slice(0, 24);
      st.name = v; BY.store("name", v || null);
      if (path && path[2]) { toReading(); return; }
      show(email);
    });
  }
  function email() {
    frame("almost", say("yeon", "So you can find it again at 1am.") + '<h1 class="qz__h">' + (st.name ? esc(st.name) + ", last question." : "Last question.") + ' Where should we send your reading?</h1>' +
      '<p class="qz__sub">Your comic link, plus at most 2 reminders. Unsubscribe in one tap.</p>' +
      '<form data-f novalidate><label><span class="sr">Email address</span><input class="input" type="email" name="e" inputmode="email" autocomplete="email" spellcheck="false" maxlength="254" placeholder="Your email" enterkeyhint="go" required></label>' +
      '<p class="qz__err" role="alert"></p><button class="btn btn--block qz__go" type="submit">Send my reading</button>' +
      '<p class="qz__priv">We send the link and at most 2 reminders, nothing else. No list, and we delete your address within 14 days. <a href="/privacy/#link-email">Privacy</a></p></form>');
    var f = root.querySelector("[data-f]");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (f.e.value || "").trim(), err = f.querySelector(".qz__err"), btn = f.querySelector("button");
      if (!v) { err.textContent = "Add your email so we can send your reading."; f.e.focus(); return; }
      if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(v) || v.length > 254) { err.textContent = "That email doesn\u2019t look right."; f.e.focus(); return; }
      btn.disabled = true; btn.textContent = "Opening your comic\u2026";
      var link = "https://bomandyeon.com/readings/" + SLUG + "/" + BY.urlState.query(urlObj(), true) + "#preview", left = false;
      var go = function () { if (!left) { left = true; done(); } };
      setTimeout(go, 3000); // never hold the comic hostage to the mail worker
      try {
        fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/save-link", { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ email: v, slug: SLUG, url: link, remind: true, t: "" }) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok) { BY.store("sl_" + SLUG, 1); BY.store("email_given", 1); ev("email", "email submitted"); BY.track("email-submit-" + SLUG, "Quiz email link: " + SLUG); }
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
    location.href = "/readings/" + slug + "/" + (keep ? "?" + keep : "") + (pair ? "#preview" : "#go");
  }
  cur = hook; hook();
})();
