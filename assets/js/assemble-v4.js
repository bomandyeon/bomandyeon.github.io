/* Bom & Yeon reading assembler v4. Pure function, no DOM. Works in the browser (window.BYAssembleV4) and in node.
 *
 *   assemble(R, V, opts) -> { chapters:[{id, kicker, title, text, panels:[{speaker,text,nar?}]}], words, panels, keys }
 *     R    = SajuEngine.analyze(birth[, their]) result (uses dayMaster, dayMasterEl, season, seasonKey, dmStrength,
 *            strongest, missing, counts, seasonInCommand, partner)
 *     V    = <slug>.v4.json
 *     opts = { answers: {qid: value}, pairs: <slug>.pairs.json object or null, name: "" }
 *
 * The chapter order comes from V.plan. Every text slot is chosen by ONE rule (see keysFor), and the same keys drive
 * the strength box, the balance chapter, the helper chapter and (glow-up) the palette, so they never disagree.
 * See SCHEMA.md.
 */
(function (root) {
  "use strict";
  var EL = ["Wood", "Fire", "Earth", "Metal", "Water"];
  var SLUGS = ["gap-wood", "eul-wood", "byeong-fire", "jeong-fire", "mu-earth", "gi-earth", "gyeong-metal", "sin-metal", "im-water", "gye-water"];
  var NAMES = ["Gap", "Eul", "Byeong", "Jeong", "Mu", "Gi", "Gyeong", "Sin", "Im", "Gye"];
  var HANJA = "甲乙丙丁戊己庚辛壬癸";
  var REL = ["peer", "output", "wealth", "power", "resource"];
  var BRANCH_OF = { spring: "辰", summer: "未", autumn: "戌", winter: "丑" };
  var SEASON_HZ = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  var BRANCH_HZ = "子丑寅卯辰巳午未申酉戌亥", ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
  var BRANCH_SLUG = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
  function mod(a, n) { return ((a % n) + n) % n; }
  function rel(dmEl, e) { return mod(e - dmEl, 5); }           // 0 peer, 1 output, 2 wealth, 3 power, 4 resource
  function byRel(dmEl, r) { return mod(dmEl + r, 5); }
  function supports(dmEl, e) { var r = rel(dmEl, e); return r === 0 || r === 4; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function wc(t) { var m = String(t || "").match(/[A-Za-z0-9'\u2019]+/g); return m ? m.length : 0; }

  /* ---------- keys: every choice the reading makes, in one place ---------- */
  function keysFor(R) {
    var dmEl = R.dayMasterEl, st = R.dmStrength, heavy = R.strongest, miss = (R.missing || [])[0];
    var k = { dm: SLUGS[R.dayMaster], dmEl: dmEl, dayBranch: R.pillars && R.pillars.day ? R.pillars.day.branch : null, strength: st, season: R.seasonKey || R.season, bridge: false,
      heavyEl: null, heavyKey: null, pressEl: null, pressKey: null, missEl: miss == null ? null : miss, missKey: null };
    if (st === "weak" && supports(dmEl, heavy)) {
      // same rule as reading-plan.js: no "too much of your own element" story on a weak chart
      k.bridge = true; k.heavyEl = heavy; k.heavyKey = "rooted_on_paper";
      if (miss == null) {
        var press = [1, 2, 3].map(function (r) { return byRel(dmEl, r); }).sort(function (a, b) { return R.counts[b] - R.counts[a] || a - b; })[0];
        if (R.counts[press] >= 1) { k.pressEl = press; k.pressKey = REL[rel(dmEl, press)] + "_weak"; }
      }
    } else { k.heavyEl = heavy; k.heavyKey = REL[rel(dmEl, heavy)] + "_" + st; }
    k.missKey = miss == null ? "none_" + st : REL[rel(dmEl, miss)] + "_" + st;
    // helper element (glow-up: lead palette element). Strong charts get a balancing element, weak charts get support.
    if (st === "strong") {
      var out = byRel(dmEl, 1);
      if (heavy === out) { k.helperRole = "wealth"; k.helperEl = byRel(dmEl, 2); k.secondEl = byRel(dmEl, 3); k.easyEl = out; }
      else { k.helperRole = "output"; k.helperEl = out; k.secondEl = (heavy === byRel(dmEl, 2) || heavy === byRel(dmEl, 3)) ? null : byRel(dmEl, 2); k.easyEl = byRel(dmEl, 4); }
    } else {
      var res = byRel(dmEl, 4);
      if (heavy === res) { k.helperRole = "peer"; k.helperEl = dmEl; k.secondEl = null; k.easyEl = byRel(dmEl, 3); }
      else { k.helperRole = "resource"; k.helperEl = res; k.secondEl = heavy === dmEl ? null : dmEl; k.easyEl = byRel(dmEl, 3); }
    }
    return k;
  }

  function fill(t, R, k) {
    var s = SLUGS[R.dayMaster];
    var map = { dm: NAMES[R.dayMaster] + " " + EL[R.dayMasterEl], dm_short: NAMES[R.dayMaster], dm_el: EL[R.dayMasterEl],
      heavy_el: k.heavyEl == null ? "" : EL[k.heavyEl], press_el: k.pressEl == null ? "" : EL[k.pressEl],
      miss_el: k.missEl == null ? "" : EL[k.missEl], helper_el: EL[k.helperEl], second_el: k.secondEl == null ? "" : EL[k.secondEl],
      easy_el: EL[k.easyEl], season: R.season, dm_hanja: HANJA.charAt(R.dayMaster), slug: s,
      day_animal: k.dayBranch == null ? "" : ANIMALS[k.dayBranch], day_branch: k.dayBranch == null ? "" : BRANCH_HZ.charAt(k.dayBranch) };
    return String(t || "").replace(/\{(\w+)\}/g, function (m, n) { return map.hasOwnProperty(n) ? map[n] : m; });
  }

  function seasonLabel(R) {
    if (R.seasonKey === "earth") return "Born in late " + R.season + ": Earth in command (" + BRANCH_OF[R.season] + " month, 土旺用事)";
    if (R.seasonEarth) return "Born in late " + R.season + ": " + R.seasonElName + " still in command (" + BRANCH_OF[R.season] + " month)";
    return "Born in " + R.season + ": " + R.seasonElName + " in command";
  }
  function seasonTitle(R, dmName) { return R.seasonKey === "earth" ? dmName + ", born in the Earth days of " + R.season : cap(R.season) + "-born " + dmName; }
  function seasonNar(R) { return R.seasonKey === "earth" ? "土 · Late " + R.season + ". Earth in command." : SEASON_HZ[R.season] + " · " + cap(R.season) + "-born. " + R.seasonElName + " in command."; }
  function bridgeText(R, heavy) {
    var where = R.seasonInCommand ? "your season does back you, but your day branch and the stems around you don't add enough" :
      "the places that count most, your season and your day branch, don't hold it";
    return EL[heavy] + " shows up often in your characters, so the bars above lean that way. The strength count still lands on weak, because " +
      where + ". So the usual \"too much " + EL[heavy] + "\" story doesn't fit you. Think of it as plenty of " + EL[heavy] + " in the room and not much of it in your hands.";
  }
  function strengthBridge(R) {
    var weak = R.dmStrength === "weak";
    if (weak && R.seasonInCommand) return "Your season is on your side, which is why you may not feel weak at all. The rest of your pillars don't add much, so the count stays under half.";
    if (!weak && !R.seasonInCommand) return "You were born out of season, so the season gave you nothing. Your roots and helpers carry you past the halfway mark anyway.";
    return "";
  }

  var CUR = null; // fill function for the reading being assembled
  function P(p, nar) { if (!p) return null; var o = { speaker: p.speaker, text: CUR ? CUR(p.text) : p.text }; if (nar) o.nar = nar; return o; }
  function join(parts) { return parts.filter(function (x) { return x && String(x).trim(); }).join("\n\n"); }

  function assemble(R, V, opts) {
    opts = opts || {};
    var answers = opts.answers || {}, k = keysFor(R), dm = k.dm, dmName = NAMES[R.dayMaster] + " " + EL[R.dayMasterEl];
    var F = function (t) { return fill(t, R, k); }; CUR = F;
    var base = V.base[dm], bp = V.base_panels[dm] || [], used = 0, out = [];
    function nextBase() { return used < bp.length ? P(bp[used++]) : null; }
    var them = R.partner ? SLUGS[R.partner.dayMaster] : null;

    V.plan.forEach(function (c) {
      var ch = { id: c.id, kicker: c.kicker || "", title: c.title || "", text: "", panels: [] };
      var take = c.base_panels || 0;
      for (var i = 0; i < take; i++) { var bpX = nextBase(); if (bpX) { if (used === 1) bpX.nar = HANJA.charAt(R.dayMaster) + " · " + dmName + "."; ch.panels.push(bpX); } }
      if (c.type === "season") {
        var s = V.season[dm][k.season];
        ch.kicker = seasonLabel(R); ch.title = seasonTitle(R, dmName);
        ch.panels.push(P(s.panel, seasonNar(R)));
        ch.text = F(s.intro);
      } else if (c.type === "base") {
        var e = (V.ext[c.id] || {})[k.strength], adds = (c.add || []).map(function (id) { return V.extra[dm][id]; });
        ch.text = join([base[c.id], e && F(e.text)].concat(adds.map(function (x) { return (x.heading ? "### " + F(x.heading) + "\n\n" : "") + F(x.text); })));
        if (e && e.panel) ch.panels.push(P(e.panel));
        if (c.branch && V.day_branch && k.dayBranch != null) {
          var db = V.day_branch[BRANCH_SLUG[k.dayBranch]];
          ch.text = join([ch.text, "### " + F(V.day_branch_heading || "Your spouse palace: the {day_animal} ({day_branch})"), F(db.text)]);
          if (db.panel) ch.panels.push(P(db.panel));
        }
        adds.forEach(function (x) { (x.panels || []).forEach(function (q) { ch.panels.push(P(q)); }); });
      } else if (c.type === "extra") {
        var x = V.extra[dm][c.id];
        ch.title = x.title || c.title; ch.text = F(x.text);
        (x.panels || []).forEach(function (p) { ch.panels.push(P(p)); });
      } else if (c.type === "situation") {
        var txt = [];
        c.questions.forEach(function (q) {
          var Q = V.intake.filter(function (z) { return z.id === q; })[0], a = answers[q] || Q.skip_value;
          var S = V.situation[q], b = S[a + "_" + k.strength] || S[a];
          if (!b) { a = Q.skip_value; b = S[a + "_" + k.strength] || S[a]; }
          txt.push(F(b.text)); if (b.panel) ch.panels.push(P(b.panel));
        });
        ch.text = join([c.lead_base ? base[c.lead_base] : "", txt.join("\n\n")]);
        if (c.with_ext) { var e2 = (V.ext[c.with_ext] || {})[k.strength]; if (e2) { ch.text = join([base[c.with_ext], F(e2.text), txt.join("\n\n")]); if (e2.panel) ch.panels.unshift(P(e2.panel)); } }
      } else if (c.type === "balance") {
        var blocks = [];
        if (k.bridge) {
          blocks.push({ h: "Plenty of " + EL[k.heavyEl] + " on paper, not much root", t: bridgeText(R, k.heavyEl) + "\n\n" + F(V.heavy.rooted_on_paper.text) });
          ch.panels.push(P(V.heavy.rooted_on_paper.panel, "Plenty of " + EL[k.heavyEl] + " on paper."));
          if (k.pressKey) { blocks.push({ h: "Where the rest of your weight sits: " + EL[k.pressEl], t: F(V.heavy[k.pressKey].text.replace(/\{heavy_el\}/g, "{press_el}")) }); ch.panels.push(P({ speaker: V.heavy[k.pressKey].panel.speaker, text: V.heavy[k.pressKey].panel.text.replace(/\{heavy_el\}/g, "{press_el}") })); }
        } else {
          var H = V.heavy[k.heavyKey];
          blocks.push({ h: "Heavy on " + EL[k.heavyEl] + (k.heavyEl === R.dayMasterEl ? ", your own element" : ""), t: F(H.text) });
          ch.panels.push(P(H.panel, "Heavy on " + EL[k.heavyEl] + "."));
        }
        var M = V.missing[k.missKey];
        blocks.push({ h: k.missEl == null ? "All five elements turn up" : "No " + EL[k.missEl] + " in the pillars we can see", t: F(M.text),
          note: k.missEl != null && !R.hasHour ? "Your birth hour would add two more characters, and " + EL[k.missEl] + " could be hiding there." : "" });
        ch.panels.push(P(M.panel, k.missEl == null ? "All five elements turn up." : "No " + EL[k.missEl] + " in the pillars we can see."));
        ch.kicker = "Your element balance"; ch.title = c.title || "What you have plenty of, and what you lack";
        ch.blocks = blocks; ch.text = blocks.map(function (b) { return "### " + b.h + "\n\n" + b.t + (b.note ? "\n\n" + b.note : ""); }).join("\n\n");
      } else if (c.type === "strength") {
        var hr = V.helper ? V.helper.roles[k.helperRole] : null, he = V.helper ? V.helper.elements[EL[k.helperEl].toLowerCase()] : null;
        ch.kicker = (R.dmStrength === "strong" ? "Strong chart" : "Weak chart") + " · " + R.strengthScore + " of " + R.strengthMax;
        ch.title = R.dmStrength === "strong" ? "A strong chart: your blind spot is pushing" : "A weak chart: your blind spot is giving too much";
        ch.text = join([strengthBridge(R), F(V.strength[dm][k.strength]), hr && "### " + F(hr.title), hr && F(hr.text), he && F(he.text)]);
        var sp = (V.strength_panels || {})[dm]; if (sp && sp[k.strength]) ch.panels.push(P(sp[k.strength]));
        if (hr) ch.panels.push(P(hr.panel)); if (he && he.panel) ch.panels.push(P(he.panel));
      } else if (c.type === "palette") { // glow-up only: the one place colors are named
        var pr = V.palette.roles[k.helperRole], L = V.palette.lead[EL[k.helperEl].toLowerCase()];
        var sec = k.secondEl == null ? "" : V.palette.second[EL[k.secondEl].toLowerCase()], easy = V.palette.easy[EL[k.easyEl].toLowerCase()];
        ch.kicker = "Your palette · lead element " + EL[k.helperEl]; ch.title = c.title;
        ch.text = join([F(base[c.lead_base_id] || ""), F(pr.text), F(L.text), F(sec), F(easy)]);
        ch.panels.push(P(pr.panel)); ch.panels.push(P(L.panel));
      } else if (c.type === "pair") {
        if (!them || !opts.pairs) return; // optional chapter: skipped without their birthday
        var a = Math.min(R.dayMaster, R.partner.dayMaster), b = Math.max(R.dayMaster, R.partner.dayMaster), pk = SLUGS[a] + "-and-" + SLUGS[b];
        var X = opts.pairs[pk], ov = (V.pair_overrides || {})[pk], side = R.dayMaster <= R.partner.dayMaster ? "you_are_a" : "you_are_b";
        var alt = (ov && ov.panels_alt) || X.panels_alt || {};
        ch.kicker = "You " + HANJA.charAt(R.dayMaster) + " " + dmName + " + them " + HANJA.charAt(R.partner.dayMaster) + " " + NAMES[R.partner.dayMaster] + " " + EL[R.partner.dayMaster >> 1];
        ch.title = X.title; ch.text = ov && ov[side] ? ov[side] : X[side];
        (ov && ov.panels ? ov.panels : X.panels).slice(0, 3).forEach(function (q, n) { var z = alt[String(n)] && alt[String(n)].reader === dm ? alt[String(n)] : q; ch.panels.push(P(z, n === 0 ? HANJA.charAt(R.dayMaster) + " + " + HANJA.charAt(R.partner.dayMaster) + " · you and them." : null)); });
      }
      ch.panels = ch.panels.filter(Boolean);
      out.push(ch);
    });
    CUR = null;
    var words = 0, panels = 0;
    out.forEach(function (c) { words += wc(c.text.replace(/^### .*$/gm, "")); c.panels.forEach(function (p) { words += wc(p.text); panels++; }); });
    return { chapters: out, words: words, panels: panels, keys: k };
  }

  var api = { assemble: assemble, keysFor: keysFor, fill: fill, wc: wc, REL: REL, SLUGS: SLUGS, EL: EL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BYAssembleV4 = api;
})(typeof window !== "undefined" ? window : null);
