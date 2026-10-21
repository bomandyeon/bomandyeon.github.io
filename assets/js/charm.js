/* /charm/: peach blossom (도화살 dohwasal) check. One birthday -> yes/no -> one reading.
 * Rule (from the year branch and from the day branch): 申子辰 -> 酉, 寅午戌 -> 卯, 巳酉丑 -> 午, 亥卯未 -> 子.
 * The mark is present when that branch sits in ANOTHER pillar (year, month, day, and hour when the saved birth time belongs
 * to this birthday). Branch index: 0 Rat 1 Ox 2 Tiger 3 Rabbit 4 Dragon 5 Snake 6 Horse 7 Goat 8 Monkey 9 Rooster 10 Dog 11 Pig. */
(function () {
  "use strict";
  var BY = window.BY, D = window.BY_DATA, $ = BY.$, esc = BY.esc, CH = window.BY_CHARM || { products: {} };
  var PEACH = { 8: 9, 0: 9, 4: 9, 2: 3, 6: 3, 10: 3, 5: 6, 9: 6, 1: 6, 11: 0, 3: 0, 7: 0 };
  var form = $("charmForm"); if (!form) return;
  BY.fillSelects(form);
  var saved = BY.load("birth"); if (saved) BY.setDate(form, "b", saved);

  BY.peach = function (R) {
    var P = R.pillars, list = [["Year", P.year], ["Month", P.month], ["Day", P.day]].concat(P.hour ? [["Hour", P.hour]] : []);
    function from(baseName) {
      var base = list.filter(function (x) { return x[0] === baseName; })[0][1], target = PEACH[base.branch];
      var hits = list.filter(function (x) { return x[0] !== baseName && x[1].branch === target; }).map(function (x) { return x[0]; });
      return { target: target, hits: hits };
    }
    var y = from("Year"), d = from("Day");
    return { year: y, day: d, yes: y.hits.length > 0 || d.hits.length > 0, list: list, hasHour: !!P.hour };
  };

  var TXT = {
    both: { k: "Yes, twice", line: "You have it from both sides. Strangers look twice, and the ones who get close stay curious.", who: "yeon", say: "Two peach blossoms. Please use this power responsibly. You won't." },
    year: { k: "Yes: the social kind", line: "Your peach blossom sits on the year side: groups, first meetings, the room. People notice you before you speak.", who: "bom", say: "You walk in and the room tilts a little. I've seen it." },
    day: { k: "Yes: the close-up kind", line: "Your peach blossom sits on the day side, the close-up side of the chart. One-on-one, you're hard to forget.", who: "yeon", say: "Quiet in a crowd, dangerous across a small table." },
    none: { k: "No mark. Slow burn.", line: "No peach blossom in your pillars. Your charm isn't the look-twice kind. It's the kind people only notice once they're already attached.", who: "yeon", say: "No instant sparkle. Annoyingly, people stay longer for that." }
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var b = BY.readDate(form, "b");
    if (b.error) { $("charmErr").textContent = b.error; return; }
    $("charmErr").textContent = "";
    BY.store("birth", b);
    var R = BY.analyze(b, null), pk = BY.peach(R);
    var key = pk.year.hits.length && pk.day.hits.length ? "both" : pk.year.hits.length ? "year" : pk.day.hits.length ? "day" : "none", t = TXT[key];
    var targets = [pk.year.target, pk.day.target];
    var cells = pk.list.map(function (x) {
      var p = x[1], on = pk.yes && targets.indexOf(p.branch) >= 0 && (pk.year.hits.indexOf(x[0]) >= 0 || pk.day.hits.indexOf(x[0]) >= 0);
      return '<div class="pillar' + (on ? " is-peach" : "") + '"><span class="pl-l">' + x[0] + '</span><span class="hz" style="color:' + D.EL_COLOR[p.stemEl] + '">' + p.stemHanja +
        '</span><span class="hz" style="color:' + (on ? "#F4B7C4" : D.EL_COLOR[p.branchEl]) + '">' + p.branchHanja + '</span><span class="pl-e">' + p.animal + "</span></div>";
    }).join("");
    var lp = CH.products["what-kind-of-lover"] || { title: "What Kind of Lover Are You?", price: 9.99 };
    var res = $("charmRes");
    res.innerHTML = '<div class="card center charm-res rise">' +
      '<p class="kicker">Peach blossom check</p><p class="hz charm-res__hz" style="color:' + (pk.yes ? "#F4B7C4" : "var(--mute)") + '">桃花</p>' +
      "<h2>" + esc(t.k) + "</h2>" +
      '<div class="pillars' + (pk.list.length > 3 ? " pillars--4" : "") + '">' + cells + "</div>" +
      "<p>" + esc(t.line) + "</p>" +
      '<div class="say say--' + t.who + '"><span class="av av--' + t.who + '"><img src="/assets/img/av-' + t.who + '.webp" alt="" width="44" height="44"></span><p class="bubble"><b>' + (t.who === "yeon" ? "Yeon" : "Bom") + "</b>" + esc(t.say) + "</p></div>" +
      '<a class="btn btn--block" href="/readings/what-kind-of-lover/?b=' + BY.iso(b) + '#preview" data-charm-cta>See how you love</a><p class="small muted center" style="margin:8px 0 0">No sign-up.</p>' +
      '<p class="small muted" style="margin-top:12px"><button type="button" class="linkbtn small" id="charmShare">Save as image</button>' +
      (pk.hasHour ? "" : " · No birth time, so three pillars checked.") + "</p></div>";
    $("charmOut").hidden = false;
    if (BY.watch) BY.watch(res);
    BY.track("charm-" + key, "Peach blossom check: " + key);
    res.querySelector("[data-charm-cta]").addEventListener("click", function () { BY.track("charm-cta-lover", "Charm check to lover reading"); });
    $("charmShare").addEventListener("click", function () {
      if (!BY.shareCard) return;
      BY.track("share-charm", "Share image: charm check");
      BY.shareCard({ kind: "soul", kicker: "Peach blossom check", line: t.line, who: "Yeon", hanja: "桃花", name: "Dohwasal", sub: "Korean saju charm check", nick: t.k,
        color: pk.yes ? "#F4B7C4" : "#C9A45C", file: "peach-blossom-check", alt: "Share card: peach blossom check, " + t.k,
        text: "Do you have the peach blossom mark? Mine: " + t.k + ". bomandyeon.com/charm/ #MyKoreanSoul" });
    });
    res.scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth", block: "start" });
  });
})();
