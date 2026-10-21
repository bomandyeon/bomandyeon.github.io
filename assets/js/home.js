/* Home: birthday -> paper-door reveal, spicy tabs, crush match, personalized shelf. */
(function () {
  "use strict";
  var BY = window.BY, D = window.BY_DATA, $ = BY.$, esc = BY.esc, reduced = BY.reduced;
  var SOULS = D.SOULS, EL_COLOR = D.EL_COLOR, LINES = window.BY_COMPAT_LINES || {}, PAIRS = window.BY_PAIRS || {};
  var state = { birth: null, R: null, crush: null, match: null }, form = $("birthForm");
  BY.fillSelects();
  var TAB_CARD = ["Red flag", "Do you ghost?", "Me, as an ex", "How I flirt", "Toxic trait"];

  /* ---------- compare-with-me links: /?vs=<dm-slug>&n=<first name>. Never a birth date. ---------- */
  BY.cleanName = function (n) { return String(n || "").replace(/[^\p{L}\p{M} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20); };
  var qs = new URLSearchParams(location.search), vsSlug = qs.get("vs"), vsIdx = D.SLUGS.indexOf(vsSlug), VS = null;
  if (vsIdx >= 0) VS = { idx: vsIdx, soul: SOULS[vsIdx], name: BY.cleanName(qs.get("n")) };
  if (VS) {
    BY.trackOnce("compare-visit", "Visit from a compare link");
    var vb = $("vsBanner"), who = VS.name ? esc(VS.name) : "Your friend";
    vb.innerHTML = "<b>" + who + '</b> is <span class="hz" style="color:' + EL_COLOR[VS.soul.el] + '">' + VS.soul.hanja + "</span> " + esc(VS.soul.nick) + ". What are you?";
    vb.hidden = false;
    var sb = form.querySelector("button[type=submit]"); if (sb) sb.textContent = "Reveal mine and our match";
    setTimeout(function () { var so = $("soul"); if (so) so.scrollIntoView({ block: "start" }); }, 250); // compare links land on the soul form
  }
  /* hero chooser + catalogue cards: which question people pick (event name only) */
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-choose],[data-card]"); if (!c) return;
    var k = c.getAttribute("data-choose"); BY.track(k ? "choose-" + k : "card-" + c.getAttribute("data-card"), k ? "Home chooser: " + k : "Catalogue card: " + c.getAttribute("data-card"));
  });
  BY.vsLink = function (idx, name) {
    var n = BY.cleanName(name);
    return "https://bomandyeon.com/?vs=" + D.SLUGS[idx] + (n ? "&n=" + encodeURIComponent(n) : "");
  };
  function myName() { var i = $("vsName"); return BY.cleanName((i && i.value) || BY.load("name") || ""); }
  function shareVs(btn) {
    if (!state.R) return;
    var s = SOULS[state.R.dayMaster], n = myName();
    if (n) BY.store("name", n);
    BY.track("compare-link", "Compare link created");
    BY.share("Compare souls with me", (n ? n + " is " : "I'm ") + s.nick + " (" + s.hanja + " " + s.name + "). What are you? Tap to see how we match.", BY.vsLink(state.R.dayMaster, n));
  }

  function pairSlug(a, b) { var x = Math.min(a, b), y = Math.max(a, b); return D.SLUGS[x] + "-and-" + D.SLUGS[y]; }
  function polarity(i) { return (i & 1 ? "Yin " : "Yang ") + D.EL_NAMES[i >> 1]; }

  /* ---------- reveal ---------- */
  var timers = [];
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
    var dp = (window.BY_PILLARS || {})[R.pillars.day.stemHanja + R.pillars.day.branchHanja], pl = $("rvPillar");
    if (dp && pl) { pl.href = "/day-pillars/" + dp[0] + "/"; pl.innerHTML = '<span class="hz">' + R.pillars.day.stemHanja + R.pillars.day.branchHanja + "</span> " + esc(dp[1]) + ", " + esc(dp[2]); $("rvPillarP").hidden = false; }
    var vn = $("vsName"); if (vn && !vn.value) vn.value = BY.load("name") || "";
  }
  function afterReveal(R, s) {
    BY.track("reveal-" + s.slug, "Reveal done: " + s.name);
    ["spicy", "crush"].forEach(function (id) { $(id).hidden = false; });
    if (VS) paintVs(R, s);
    var dh = document.querySelector("#daily h2"); if (dh) dh.textContent = "One line from Yeon for " + s.nick + ", every morning.";
    renderSpicy();
    personaliseShelf(s);
    paintNext(R, s);
    if (state.crush) runMatch(false);
    $("rvName").setAttribute("tabindex", "-1"); $("rvName").focus({ preventScroll: true });
    BY.watch();
  }
  BY.bioLine = function (s) { return s.hanja + " " + s.nick + " · " + s.name + " | bomandyeon.com"; };
  $("copyBio").addEventListener("click", function () {
    if (!state.R) return;
    var line = BY.bioLine(SOULS[state.R.dayMaster]);
    var done = function () { BY.toast("Copied: " + line); };
    BY.track("copy-bio", "Copied the bio line");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(line).then(done, function () { BY.toast(line); });
    else BY.toast(line);
  });
  $("shareSoul").addEventListener("click", function () { shareVs(); });
  function soulCard(R, kicker, line, file) {
    var s = SOULS[R.dayMaster];
    return { kind: "soul", kicker: kicker, line: line, who: "Yeon", hanja: s.hanja, name: s.name, nick: s.nick, color: EL_COLOR[s.el], file: file,
      alt: "Share card: " + s.nick + ", " + s.name + ". Yeon says: " + line, text: "I'm " + s.nick + " (" + s.hanja + "). What's yours? #MyKoreanSoul bomandyeon.com" };
  }
  $("cardSoul").addEventListener("click", function () {
    if (!state.R || !BY.shareCard) return;
    BY.track("share-soul", "Share image: soul");
    BY.shareCard(soulCard(state.R, "My Korean soul type", D.SPICY[state.R.dayMaster][4], "my-korean-soul-" + SOULS[state.R.dayMaster].slug));
  });

  /* ---------- you vs the friend who sent the link ---------- */
  function paintVs(R, s) {
    var o = VS.soul, pd = PAIRS[pairSlug(R.dayMaster, VS.idx)] || {}, who = VS.name || "your friend";
    $("vs").hidden = false;
    $("vsHead").textContent = "You and " + who;
    $("vsDuo").innerHTML = '<span style="color:' + EL_COLOR[s.el] + '">' + s.hanja + '</span><i>+</i><span style="color:' + EL_COLOR[o.el] + '">' + o.hanja + "</span>";
    $("vsScore").textContent = (pd.s != null ? pd.s : "") + "%";
    $("vsVerdict").textContent = pd.v || "";
    $("vsLine").textContent = "You are " + s.nick + " (" + s.name + "). " + (VS.name ? VS.name : "They") + " is " + o.nick + " (" + o.name + "). " + (pd.x || "");
    $("vsPair").href = "/compatibility/" + pairSlug(R.dayMaster, VS.idx) + "/";
    $("vsPair").textContent = "Read " + s.name + " + " + o.name;
    $("vsBack").textContent = VS.name ? "Send yours back to " + VS.name : "Send yours back";
  }
  $("vsBack").addEventListener("click", function () {
    var n = BY.cleanName($("vsMe").value); if (n) { BY.store("name", n); var vn = $("vsName"); if (vn) vn.value = n; }
    shareVs();
  });
  $("vsCard").addEventListener("click", function () {
    if (!state.R || !VS || !BY.shareCard) return;
    BY.track("share-vs-match", "Share image: compare match");
    var s = SOULS[state.R.dayMaster], o = VS.soul, pd = PAIRS[pairSlug(state.R.dayMaster, VS.idx)] || {};
    BY.shareCard({ kind: "match", kicker: "Our saju match", hanja: s.hanja, name: s.name, nick: s.nick, color: EL_COLOR[s.el],
      them: { hanja: o.hanja, name: o.name, nick: o.nick, color: EL_COLOR[o.el] }, score: pd.s, verdict: pd.v, file: "our-saju-match-" + s.slug + "-" + o.slug,
      alt: "Share card: " + s.nick + " and " + o.nick + ", " + pd.s + "% match", text: s.nick + " + " + o.nick + ": " + pd.s + "%. #MyKoreanSoul bomandyeon.com" });
  });

  /* ONE next step after the reveal: the reading that fits best, with the birthday carried over */
  var NEXT = {
    "will-your-ex-come-back": { title: "Will your ex come back?", cover: "ex", tab: 2 },
    "situationship": { title: "What is this, actually?", cover: "situationship", tab: 1 },
    "brutally-honest": { title: "Brutally honest, from Yeon", cover: "brutal", tab: 0 }
  };
  function nextSlug() {
    var src = String(BY.load("src") || "");
    if (/brutal/.test(src)) return "brutally-honest";
    if (/situation/.test(src) || state.crush || BY.load("their")) return "situationship";
    return "will-your-ex-come-back";
  }
  function paintNext(R, s) {
    var slug = nextSlug(), n = NEXT[slug], their = state.crush || BY.load("their");
    var q = "?b=" + BY.iso(state.birth) + (slug === "situationship" && their ? "&t=" + BY.iso(their) : "");
    $("nextCard").href = "/readings/" + slug + "/" + q;
    $("nextImg").src = "/assets/img/cover-" + n.cover + ".webp";
    $("nextTitle").textContent = n.title;
    $("nextLine").textContent = D.SPICY[R.dayMaster][n.tab];
    $("nextNote").textContent = slug === "situationship" && !their ? "Written for " + s.name + ". Add their birthday on the next page." : "Written for " + s.name + ". Your birthday is already in.";
    $("next").hidden = false;
    $("nextCard").onclick = function () { BY.track("next-" + slug, "Next step after reveal: " + slug); };
  }
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
    paintVotes();
  }
  /* "Too real / Not me": stays in this browser only */
  function votes() { return BY.load("votes") || {}; }
  function paintVotes() {
    var v = (votes()[SOULS[state.R.dayMaster].slug] || {})[spIdx];
    [].forEach.call(document.querySelectorAll("#spVote [data-v]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === v ? "true" : "false"); });
  }
  [].forEach.call(document.querySelectorAll("#spVote [data-v]"), function (b) {
    b.addEventListener("click", function () {
      if (!state.R) return;
      var all = votes(), k = SOULS[state.R.dayMaster].slug, val = b.getAttribute("data-v");
      all[k] = all[k] || {}; all[k][spIdx] = all[k][spIdx] === val ? null : val; BY.store("votes", all); paintVotes();
      if (all[k][spIdx]) BY.toast(val === "real" ? "Noted. Yeon is not surprised." : "Noted. Yeon wants a second opinion.");
    });
  });
  $("cardSpicy").addEventListener("click", function () {
    if (!state.R || !BY.shareCard) return;
    BY.track("share-spicy", "Share image: spicy tab");
    BY.shareCard(soulCard(state.R, TAB_CARD[spIdx], D.SPICY[state.R.dayMaster][spIdx], "my-korean-soul-" + SOULS[state.R.dayMaster].slug + "-" + (spIdx + 1)));
  });

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
    if (!state.R && BY.load("birth")) { state.birth = BY.load("birth"); state.R = BY.analyze(state.birth, null); }
    if (!state.R) { $("crushErr").textContent = "Reveal your own soul first, at the top of the page."; return; }
    var c = BY.readDate(cform, "c");
    if (c.error) { $("crushErr").textContent = c.error; return; }
    $("crushErr").textContent = "";
    state.crush = c; BY.store("their", c);
    BY.track("crush-match", "Crush match");
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
    BY.track("share-match-link", "Shared the match link");
    var me = SOULS[R.dayMaster], them = SOULS[R.partner.dayMaster];
    BY.share("Our saju match", me.name + " + " + them.name + ": " + R.compat.score + "%. " + (pairData(R).v || "") + ".", "https://bomandyeon.com" + $("mPair").getAttribute("href"));
  });
  $("cardMatch").addEventListener("click", function () {
    var R = state.match; if (!R || !BY.shareCard) return;
    BY.track("share-crush-match", "Share image: crush match");
    var me = SOULS[R.dayMaster], them = SOULS[R.partner.dayMaster];
    BY.shareCard({ kind: "match", kicker: "My crush check", hanja: me.hanja, name: me.name, nick: me.nick, color: EL_COLOR[me.el],
      them: { hanja: them.hanja, name: them.name, nick: them.nick, color: EL_COLOR[them.el] }, score: R.compat.score, verdict: pairData(R).v, file: "saju-match-" + me.slug + "-" + them.slug,
      alt: "Share card: " + me.nick + " and " + them.nick + ", " + R.compat.score + "% match", text: me.nick + " + " + them.nick + ": " + R.compat.score + "%. #MyKoreanSoul bomandyeon.com" });
  });

  /* ---------- returning visitor ---------- */
  var saved = BY.load("birth"), their = BY.load("their");
  if (saved) BY.setDate(form, "b", saved);
  if (their) { BY.setDate(cform, "c", their); state.crush = their; }
  if (/[?&]reveal=1/.test(location.search) && saved) { state.birth = saved; state.R = BY.analyze(saved); if (their) state.crush = their; playReveal(); }
})();
