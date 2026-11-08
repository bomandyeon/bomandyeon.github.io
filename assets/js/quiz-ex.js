/* /ex/start/ tap quiz (2026-11-08, A/B entry for /ex/). One tap per screen, then straight into the /ex/ comic.
 * Hands over exactly what the /ex/ form would store: by_birth, by_btime (cleared for a new birthday), by_name, the product's
 * intake answers (by_ans_will-your-ex-come-back, same ids/values as content/products/will-your-ex-come-back.v4.json "intake"),
 * by_wiz_<slug>, and the link id ?s=<id> (BY.urlState), so no readable birthday or answer ever sits in an address.
 * Raw answers also in localStorage "quiz_ex". Email: the same /save-link worker call and privacy line as the paywall box.
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
    what_you_want: ["bom", "Whatever you pick, the comic is about you. No predictions about them."]
  };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var TOTAL = 9, st = { ans: {}, m: 0, d: 0, dec: 0, y: 0, name: "" }, hist = [], cur = null, firstBday = true;
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
    var top = n ? '<div class="qz__top">' + (noBack ? "<span></span>" : '<button type="button" class="qz__back" data-back>\u2190 Back</button>') + '<span class="qz__step">' + n + " of " + TOTAL + '</span></div><div class="qz__bar"><i style="width:' + Math.round(n / TOTAL * 100) + '%"></i></div>' : "";
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
  function hook() {
    frame(0, '<img class="qz__cover" src="/assets/img/cover-ex.webp" srcset="/assets/img/cover-ex-360.webp 360w, /assets/img/cover-ex.webp 720w" sizes="300px" width="720" height="894" alt="Yeon holds a glowing red thread that leads to a figure walking away over a moonlit bridge" fetchpriority="high">' +
      '<h1 class="qz__h">Why can\u2019t you let them go?</h1>' +
      '<p class="qz__sub">Your Korean birthday chart, drawn as a comic by Bom and Yeon: why it really ended, what still pulls you back, and what to do if their name lights up your phone. First 2 chapters free.</p>' +
      '<button type="button" class="btn btn--block" data-start>Start my reading</button>' +
      '<p class="qz__note">A few taps \u00b7 no sign-up \u00b7 your birthday stays in your browser</p>');
    root.querySelector("[data-start]").addEventListener("click", function () { ev("start", "started"); show(function () { question(0); }); });
  }
  function question(i) {
    var q = INTAKE[i], s = SAYS[q.id];
    frame(i + 1, say(s[0], s[1]) + '<h1 class="qz__h">' + esc(q.question) + '</h1><div class="qz__opts">' + q.options.map(function (o) { return opt(o[0], o[1]); }).join("") + "</div>", i === 0);
    onPick(function (v) {
      st.ans[q.id] = v; ev("q" + (i + 1), q.id + " answered");
      show(i + 1 < INTAKE.length ? function () { question(i + 1); } : month);
    });
  }
  function bdayTouch() { if (firstBday) { firstBday = false; BY.trackOnce("form-started-" + SLUG, "Birthday picker first used: " + SLUG + " (quiz)"); } }
  function month() {
    frame(4, say("yeon", "Now the part that actually matters. Your birthday.") + '<h1 class="qz__h">What month were you born?</h1><div class="qz__grid">' +
      MONTHS.map(function (m, k) { return opt(k + 1, m.slice(0, 3), ' aria-label="' + m + '"'); }).join("") + "</div>");
    onPick(function (v) { bdayTouch(); st.m = +v; show(day); });
  }
  function dim(m, y) { return new Date(y || 2000, m, 0).getDate(); } // 2000 is a leap year: Feb shows 29 until the year is known
  function day() {
    var n = dim(st.m), h = "";
    for (var d = 1; d <= n; d++) h += opt(d, d);
    frame(5, say("bom", "Your birthday stays in your browser. We don\u2019t keep it.") + '<h1 class="qz__h">What day in ' + MONTHS[st.m - 1] + "?</h1>" + '<div class="qz__grid qz__grid--d">' + h + "</div>");
    onPick(function (v) { st.d = +v; show(decade); });
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
  function loader(b) {
    var s = null;
    try { var R = BY.analyze(b); s = window.BY_DATA.SOULS[R.dayMaster]; } catch (e) { s = null; }
    ev("loader", "loader shown");
    frame(0, '<div class="qz__load" role="status"><p class="k">Your birthday type</p>' +
      (s ? '<p class="dm">' + esc(s.nick) + '</p><p class="el">Korean saju calls it ' + esc(s.name) + ", your day master.</p>" : '<p class="dm">Reading your chart</p>') +
      '<div data-say></div></div>');
    var box = root.querySelector("[data-say]"), lines = [["bom", "Reading your chart\u2026"], ["yeon", "Oh. This explains a lot."]], i = 0, ms = BY.reduced ? 300 : 1200;
    (function tick() {
      if (i >= lines.length) { setTimeout(function () { cur = name; name(); }, BY.reduced ? 200 : 900); return; }
      box.innerHTML = say(lines[i][0], lines[i][1]); i++; setTimeout(tick, ms);
    })();
  }
  function name() {
    frame(8, say("bom", "So the comic can say your name. Optional.") + '<h1 class="qz__h">What\u2019s your first name?</h1>' +
      '<form data-f novalidate><label><span class="sr">First name</span><input class="input" name="n" autocomplete="given-name" autocapitalize="words" maxlength="24" placeholder="First name" enterkeyhint="next" value="' + esc(st.name) + '"></label>' +
      '<button class="btn btn--block qz__go" type="submit">Continue</button></form>', true);
    root.querySelector("[data-f]").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (this.n.value || "").replace(/[<>]/g, "").trim().slice(0, 24);
      st.name = v; BY.store("name", v || null);
      show(email);
    });
  }
  function email() {
    frame(9, say("yeon", "So you can find it again at 1am.") + '<h1 class="qz__h">Last question. Where should we send your reading?</h1>' +
      '<form data-f novalidate><label><span class="sr">Email address</span><input class="input" type="email" name="e" inputmode="email" autocomplete="email" spellcheck="false" maxlength="254" placeholder="Your email" enterkeyhint="go"></label>' +
      '<p class="qz__priv">Only for this link. No list, and we delete your address within 14 days. <a href="/privacy/#link-email">Privacy</a></p>' +
      '<p class="qz__err" role="alert"></p><button class="btn btn--block qz__go" type="submit">Show my reading</button></form>' +
      '<button type="button" class="qz__skip" data-skip>Skip, just show it</button>');
    var f = root.querySelector("[data-f]");
    root.querySelector("[data-skip]").addEventListener("click", function () { ev("skip-email", "email skipped"); done(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (f.e.value || "").trim(), err = f.querySelector(".qz__err"), btn = f.querySelector("button");
      if (!v) { ev("skip-email", "email skipped"); done(); return; }
      if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(v) || v.length > 254) { err.textContent = "That email doesn\u2019t look right."; f.e.focus(); return; }
      btn.disabled = true; btn.textContent = "Opening your comic\u2026";
      var link = "https://bomandyeon.com/readings/" + SLUG + "/" + BY.urlState.query(urlObj(), true) + "#preview", left = false;
      var go = function () { if (!left) { left = true; done(); } };
      setTimeout(go, 3000); // never hold the comic hostage to the mail worker
      try {
        fetch("https://bom-yeon-unlock.bomandyeon.workers.dev/save-link", { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ email: v, slug: SLUG, url: link, remind: false, t: "" }) })
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
  cur = hook; hook();
})();
