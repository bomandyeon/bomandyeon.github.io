/* Home: birthday -> paper-door reveal, spicy tabs, crush match, personalized shelf. */
(function () {
  "use strict";
  var BY = window.BY, D = window.BY_DATA, $ = BY.$, esc = BY.esc, reduced = BY.reduced;
  var SOULS = D.SOULS, EL_COLOR = D.EL_COLOR, LINES = window.BY_COMPAT_LINES || {}, PAIRS = window.BY_PAIRS || {};
  var state = { birth: null, R: null, crush: null, match: null };
  BY.fillSelects();

  function pairSlug(a, b) { var x = Math.min(a, b), y = Math.max(a, b); return D.SLUGS[x] + "-and-" + D.SLUGS[y]; }
  function polarity(i) { return (i & 1 ? "Yin " : "Yang ") + D.EL_NAMES[i >> 1]; }

  /* ---------- reveal ---------- */
  var form = $("birthForm"), timers = [];
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var b = BY.readDate(form, "b");
    if (b.error) { $("birthErr").textContent = b.error; return; }
    $("birthErr").textContent = "";
    state.birth = b; BY.store("birth", b);
    state.R = BY.analyze(b, null);
    playReveal();
  });

  function playReveal() {
    var R = state.R, s = SOULS[R.dayMaster], stage = $("stage");
    timers.forEach(clearTimeout); timers = [];
    paintCard(R, s);
    $("reveal").hidden = false;
    stage.classList.remove("is-open", "is-reading");
    $("dsL").textContent = R.pillars.day.stemHanja; $("dsR").textContent = R.pillars.day.branchHanja;
    $("stStatus").textContent = "Yeon is reading your four pillars…";
    void stage.offsetWidth;
    $("reveal").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    timers.push(setTimeout(function () { stage.classList.add("is-reading"); }, reduced ? 0 : 450));
    timers.push(setTimeout(function () {
      stage.classList.add("is-open");
      afterReveal(R, s);
    }, reduced ? 50 : 2300));
  }
  function paintCard(R, s) {
    var card = $("soulCard");
    card.style.setProperty("--el", EL_COLOR[s.el]);
    $("rvEl").textContent = polarity(R.dayMaster) + " · Day Master";
    $("rvHanja").textContent = s.hanja;
    $("rvName").textContent = s.name;
    $("rvNick").textContent = s.nick;
    $("rvTag").textContent = s.tag;
    $("rvChips").innerHTML = s.traits.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    $("rvBom").textContent = s.bom;
    $("rvYeon").textContent = D.SPICY[R.dayMaster][4];
    $("rvMore").href = "/souls/" + s.slug + "/";
    $("rvMore").textContent = "Everything about " + s.name;
    $("rvBio").textContent = BY.bioLine(s);
  }
  function afterReveal(R, s) {
    ["spicy", "crush"].forEach(function (id) { $(id).hidden = false; });
    renderSpicy();
    personaliseShelf(s);
    if (state.crush) runMatch(false);
    $("rvName").setAttribute("tabindex", "-1"); $("rvName").focus({ preventScroll: true });
    BY.watch();
  }
  BY.bioLine = function (s) { return s.hanja + " " + s.nick + " · " + s.name + " | bomandyeon.com"; };
  $("copyBio").addEventListener("click", function () {
    if (!state.R) return;
    var line = BY.bioLine(SOULS[state.R.dayMaster]);
    var done = function () { BY.toast("Copied: " + line); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(line).then(done, function () { BY.toast(line); });
    else BY.toast(line);
  });
  $("shareSoul").addEventListener("click", function () {
    if (!state.R) return;
    var s = SOULS[state.R.dayMaster];
    BY.share("My Korean soul type", "I'm " + s.name + " " + s.hanja + ", " + s.nick.toLowerCase() + ". What's yours?", "https://bomandyeon.com/souls/" + s.slug + "/");
  });

  function personaliseShelf(s) {
    [].forEach.call(document.querySelectorAll(".pcard"), function (a) {
      var f = a.querySelector(".for"); if (f) f.textContent = "Written for " + s.name;
    });
    var h = $("shelfH"); if (h) h.textContent = "Readings for " + s.name;
  }

  /* ---------- spicy tabs ---------- */
  var spIdx = 0;
  function renderSpicy() {
    var t = $("spTabs");
    if (!t.children.length) {
      D.SP_TABS.forEach(function (lab, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "tab"; b.setAttribute("role", "tab"); b.textContent = lab;
        b.addEventListener("click", function () { spIdx = i; paintSpicy(); });
        t.appendChild(b);
      });
    }
    paintSpicy();
  }
  function paintSpicy() {
    var R = state.R, s = SOULS[R.dayMaster], card = $("spCard");
    [].forEach.call($("spTabs").children, function (b, i) { b.setAttribute("aria-selected", i === spIdx ? "true" : "false"); });
    $("spTitle").textContent = D.SP_TABS[spIdx].replace(/^\S+\s/, "");
    $("spText").textContent = D.SPICY[R.dayMaster][spIdx];
    $("spWho").textContent = s.name + " · " + s.nick + " · for entertainment and self-reflection";
    card.classList.remove("is-pop"); void card.offsetWidth; card.classList.add("is-pop");
  }

  /* ---------- crush match ---------- */
  var FLAG_ORDER = ["stem_combo", "branch_harmony", "branch_clash", "element_complement", "same_element"];
  function pairData(R) { return PAIRS[pairSlug(R.dayMaster, R.partner.dayMaster)] || {}; }
  function matchLine(R) {
    var f = FLAG_ORDER.filter(function (x) { return R.compat.flags.indexOf(x) >= 0; })[0];
    return (f && LINES[f]) || pairData(R).x || "";
  }
  var cform = $("crushForm");
  cform.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.R) { $("crushErr").textContent = "Reveal your own soul first, at the top of the page."; return; }
    var c = BY.readDate(cform, "c");
    if (c.error) { $("crushErr").textContent = c.error; return; }
    $("crushErr").textContent = "";
    state.crush = c; BY.store("their", c);
    runMatch(true);
  });
  function runMatch(animate) {
    var R = BY.analyze(state.birth, state.crush), me = SOULS[R.dayMaster], them = SOULS[R.partner.dayMaster], box = $("match");
    state.match = R; box.hidden = false;
    $("mYou").textContent = me.hanja; $("mThem").textContent = them.hanja;
    $("mVerdict").textContent = pairData(R).v || "";
    $("mThemLine").innerHTML = 'Their Day Master: <span class="hz">' + them.hanja + "</span> " + esc(them.name) + ", " + esc(them.nick.toLowerCase());
    $("mLine").textContent = matchLine(R);
    $("mTwin").hidden = R.compat.flags.indexOf("stem_combo") < 0;
    $("mPair").href = "/compatibility/" + pairSlug(R.dayMaster, R.partner.dayMaster) + "/";
    $("mPair").textContent = "Read " + me.name + " + " + them.name;
    var path = $("mThread"), len = path.getTotalLength ? path.getTotalLength() : 140, target = R.compat.score;
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    box.classList.remove("is-go", "is-done");
    if (!animate || reduced) { path.style.strokeDashoffset = 0; box.classList.add("is-done"); $("mScore").textContent = target + "%"; return; }
    void box.offsetWidth; box.classList.add("is-go");
    requestAnimationFrame(function () { path.style.strokeDashoffset = 0; });
    var t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, (t - t0) / 1300);
      $("mScore").textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + "%";
      if (k < 1) requestAnimationFrame(tick); else box.classList.add("is-done");
    })(t0);
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  $("shareMatch").addEventListener("click", function () {
    var R = state.match; if (!R) return;
    var me = SOULS[R.dayMaster], them = SOULS[R.partner.dayMaster];
    BY.share("Our saju match", me.name + " + " + them.name + ": " + R.compat.score + "%. " + (pairData(R).v || "") + ".", "https://bomandyeon.com" + $("mPair").getAttribute("href"));
  });

  /* ---------- returning visitor ---------- */
  var saved = BY.load("birth"), their = BY.load("their");
  if (saved) BY.setDate(form, "b", saved);
  if (their) { BY.setDate(cform, "c", their); state.crush = their; }
  if (/[?&]reveal=1/.test(location.search) && saved) { state.birth = saved; state.R = BY.analyze(saved); if (their) state.crush = their; playReveal(); }
})();
