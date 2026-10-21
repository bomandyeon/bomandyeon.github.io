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
  var NICKS = ["The Tall Pine", "The Climbing Flower", "The Sun", "The Candle", "The Mountain", "The Garden Field", "The Sword", "The Jewel", "The Ocean", "The Rain"];
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
      easy_el: EL[k.easyEl], season: R.season, nick: NICKS[R.dayMaster], nick_word: NICKS[R.dayMaster].split(" ").slice(-1)[0], dm_hanja: HANJA.charAt(R.dayMaster), slug: s,
      day_animal: k.dayBranch == null ? "" : ANIMALS[k.dayBranch], day_branch: k.dayBranch == null ? "" : BRANCH_HZ.charAt(k.dayBranch) };
    if (R.partner && R.partner.dayMaster != null) { map.them = NAMES[R.partner.dayMaster] + " " + EL[R.partner.dayMaster >> 1]; map.them_short = NAMES[R.partner.dayMaster]; map.them_el = EL[R.partner.dayMaster >> 1]; }
    var T = TERMS && TERMS[s]; if (T) for (var tk in T) if (T.hasOwnProperty(tk)) map[tk] = T[tk];
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
  var TERMS = null; // V.terms: per-Day-Master placeholder words ({pos} etc.), set during assemble()
  /* keys for "mix" chapter parts (new products, 2026-10-20): partner / pair keys need R.partner (a full chart when available) */
  var BR_SIX = [1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  function branchRel(a, b) {
    if (a == null || b == null) return "neutral";
    if (a === b) return "same";
    if (mod(a - b, 12) === 6) return "clash";
    if (BR_SIX[a] === b) return "harmony";
    if (mod(a - b, 4) === 0) return "trio";
    return "neutral";
  }
  function stemRel(x, y) {
    if (mod(x - y, 10) === 5) return "combo";
    if (x === y) return "same_stem";
    var ex = x >> 1, ey = y >> 1;
    if (ex === ey) return "same_element";
    var r = rel(ex, ey);
    if (r === 1 || r === 4) return "generating";
    if ((x & 1) === (y & 1) && Math.abs(x - y) === 6 && Math.min(x, y) <= 3) return "clash";
    return "controlling";
  }
  function partKey(key, R, k) {
    var P = R.partner, dm = R.dayMaster;
    switch (key) {
      case "partner_dm": return P ? SLUGS[P.dayMaster] : null;
      case "tengod": return P ? String(rel(dm >> 1, P.dayMaster >> 1) * 2 + ((dm & 1) === (P.dayMaster & 1) ? 0 : 1)) : null;
      case "el_rel": return P ? REL[rel(dm >> 1, P.dayMaster >> 1)] : null;
      case "stem_rel": return P ? stemRel(dm, P.dayMaster) : null;
      case "branch_rel": return P ? branchRel(k.dayBranch, P.pillars && P.pillars.day ? P.pillars.day.branch : null) : null;
      case "pair_strength": return P ? R.dmStrength + "_" + (P.dmStrength || "unknown") : null;
      case "day_branch": return k.dayBranch == null ? null : BRANCH_SLUG[k.dayBranch];
      case "strength": return R.dmStrength;
      case "dm_el": return EL[dm >> 1].toLowerCase();
      case "yinyang": return dm & 1 ? "yin" : "yang";
      case "season": return k.season;
      case "heavy_rel": return k.heavyEl == null ? null : REL[rel(dm >> 1, k.heavyEl)];
      case "miss_rel": return k.missEl == null ? "none" : REL[rel(dm >> 1, k.missEl)];
      case "helper_el": return EL[k.helperEl].toLowerCase();
      case "dm": return SLUGS[dm];
      case "partner_strength": return P && P.dmStrength ? P.dmStrength : null;
      case "partner_season": return P && P.seasonKey ? P.seasonKey : null;
      case "partner_el": return P ? EL[P.dayMaster >> 1].toLowerCase() : null;
    }
    return null;
  }
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function P(p, nar) { if (!p) return null; var o = { speaker: p.speaker, text: CUR ? CUR(p.text) : p.text }; if (nar) o.nar = nar; return o; }
  // copy rewrite 2026-10-21: comic rhythm. Reorder a chapter's panels so Bom and Yeon alternate whenever the mix allows (stable otherwise).
  function alternate(list) {
    var rest = list.slice(), out = [];
    while (rest.length) {
      var last = out.length ? out[out.length - 1].speaker : null, i = 0;
      while (i < rest.length && rest[i].speaker === last) i++;
      out.push(rest.splice(i < rest.length ? i : 0, 1)[0]);
    }
    return out;
  }
  function join(parts) { return parts.filter(function (x) { return x && String(x).trim(); }).join("\n\n"); }

  function assemble(R, V, opts) {
    opts = opts || {};
    var answers = opts.answers || {}, k = keysFor(R), dm = k.dm, dmName = NAMES[R.dayMaster] + " " + EL[R.dayMasterEl];
    TERMS = V.terms || null;
    var F = function (t) { return fill(t, R, k); }; CUR = F;
    var base = V.base[dm], bp = V.base_panels[dm] || [], used = 0, out = [];
    function nextBase() { return used < bp.length ? P(bp[used++]) : null; }
    // answer echo (copy rewrite 2026-10-21): plan c.echo = [qid] -> V.echo[qid][answer] panel ("You said ..."); "mood" = the wizard mood answer
    function echoPanels(c, ch) {
      (c.echo || []).forEach(function (q) {
        var E = (V.echo || {})[q]; if (!E) return;
        var Q = (V.intake || []).filter(function (z) { return z.id === q; })[0], a = answers[q] || (Q ? Q.skip_value : "unsaid");
        var x = E[a] || E[Q ? Q.skip_value : "unsaid"] || E.unsaid; if (x) ch.panels.push(P(x));
      });
    }
    var them = R.partner ? SLUGS[R.partner.dayMaster] : null;

    V.plan.forEach(function (c) {
      var ch = { id: c.id, kicker: c.kicker || "", title: c.title || "", text: "", panels: [] };
      var take = c.base_panels || 0;
      for (var i = 0; i < take; i++) { var bpX = nextBase(); if (bpX) { if (used === 1) bpX.nar = HANJA.charAt(R.dayMaster) + " · " + dmName + "."; ch.panels.push(bpX); } }
      if (c.type === "season" && V.open && V.open[dm]) { // copy rewrite 2026-10-21: plain-English opener, hook title, answer echo
        var s = V.season[dm][k.season], O = V.open[dm];
        if (ch.panels[0]) ch.panels[0].nar = HANJA.charAt(R.dayMaster) + " \u00B7 " + NICKS[R.dayMaster] + ".";
        ch.kicker = NICKS[R.dayMaster] + " \u00B7 born in " + (R.seasonKey === "earth" || R.seasonEarth ? "late " : "") + R.season;
        ch.title = F(O.title);
        var ep = { panels: [] }; echoPanels(c, ep);
        var lastSp = ch.panels.length ? ch.panels[ch.panels.length - 1].speaker : null, inl = [];
        ep.panels.forEach(function (x) { if (x.speaker === lastSp) inl.push((x.speaker === "bom" ? "Bom: " : "Yeon: ") + x.text); else ch.panels.push(x); });
        var oParas = F(O.text).split(/\n\s*\n/), oText = join([oParas[0]].concat(inl, oParas.slice(1)));
        // the season line is a labelled caption + one bubble inside the text, so the chapter reads as alternating beats
        var sLab = "### " + SEASON_HZ[R.season] + " \u00B7 Born in " + (R.seasonKey === "earth" || R.seasonEarth ? "late " : "") + R.season + "\n";
        ch.text = join([oText, sLab + F(s.intro), (s.panel.speaker === "bom" ? "Bom: " : "Yeon: ") + F(s.panel.text), F(O.end)]);
      } else if (c.type === "season") {
        var s = V.season[dm][k.season];
        ch.kicker = seasonLabel(R); ch.title = seasonTitle(R, dmName);
        ch.panels.push(P(s.panel, seasonNar(R)));
        ch.text = F(s.intro);
      } else if (c.type === "base") {
        var e = (V.ext[c.id] || {})[k.strength], adds = (c.add || []).map(function (id) { return V.extra[dm][id]; });
        ch.text = join([F(base[c.id]), e && F(e.text)].concat(adds.map(function (x) { return (x.heading ? "### " + F(x.heading) + "\n\n" : "") + F(x.text); })));
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
        ch.text = join([c.lead_base ? F(base[c.lead_base]) : "", txt.join("\n\n")]);
        if (c.with_ext) { var e2 = (V.ext[c.with_ext] || {})[k.strength]; if (e2) { ch.text = join([F(base[c.with_ext]), F(e2.text), txt.join("\n\n")]); if (e2.panel) ch.panels.unshift(P(e2.panel)); } }
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
        ch.kicker = "Too much of one thing, none of another"; ch.title = c.title || "What you have plenty of, and what you lack";
        ch.blocks = blocks; ch.text = blocks.map(function (b) { return "### " + b.h + "\n\n" + b.t + (b.note ? "\n\n" + b.note : ""); }).join("\n\n");
      } else if (c.type === "strength") {
        var hr = V.helper ? V.helper.roles[k.helperRole] : null, he = V.helper ? V.helper.elements[EL[k.helperEl].toLowerCase()] : null;
        ch.kicker = (R.dmStrength === "strong" ? "Built strong" : "Built soft") + " \u00B7 " + R.strengthScore + " of " + R.strengthMax + " on your chart";
        ch.title = (V.strength_titles || {})[R.dmStrength] || (R.dmStrength === "strong" ? "Your blind spot: you push" : "Your blind spot: you give too much");
        ch.text = join([strengthBridge(R), F(V.strength[dm][k.strength]), hr && "### " + F(hr.title), hr && F(hr.text), he && F(he.text)]);
        var sp = (V.strength_panels || {})[dm]; if (sp && sp[k.strength]) ch.panels.push(P(sp[k.strength]));
        if (hr) ch.panels.push(P(hr.panel)); if (he && he.panel) ch.panels.push(P(he.panel));
      } else if (c.type === "palette") { // glow-up only: the one place colors are named
        var pr = V.palette.roles[k.helperRole], L = V.palette.lead[EL[k.helperEl].toLowerCase()];
        var sec = k.secondEl == null ? "" : V.palette.second[EL[k.secondEl].toLowerCase()], easy = V.palette.easy[EL[k.easyEl].toLowerCase()];
        ch.kicker = "Your palette · lead element " + EL[k.helperEl]; ch.title = c.title;
        ch.text = join([F(base[c.lead_base_id] || ""), F(pr.text), F(L.text), F(sec), F(easy)]);
        ch.panels.push(P(pr.panel)); ch.panels.push(P(L.panel));
      } else if (c.type === "mix") { // new products: optional lead base chapter (+ext) then keyed parts
        var mt = [];
        if (c.lead) { var le = (V.ext[c.lead] || {})[k.strength]; mt.push(F(base[c.lead])); if (le) { mt.push(F(le.text)); if (le.panel) ch.panels.push(P(le.panel)); } }
        ch.text = join(mt);
      } else if (c.type === "months") { // 2027: saju months of the Fire Goat year (R.months2027 from the engine)
        var MS = R.months2027 || [], MV = V.months, mt2 = [], combos = 0, best = 0, hard = 0;
        MS.forEach(function (m) { if (m.n < c.months[0]) { if (m.dayBranch === "combo") combos++; if (m.mark === "best") best++; if (m.mark === "hard") hard++; } });
        c.months.forEach(function (n) {
          var m = MS[n]; if (!m) return;
          var st = m.starts, nx = MS[n + 1] && MS[n + 1].starts, mname = st ? MONTH_NAMES[st.m - 1] + " " + st.y : "";
          var rng = st ? MON3[st.m - 1] + " " + st.d + (nx ? " to " + MON3[nx.m - 1] + " " + (nx.d - 1) : "") : "";
          var mood = MV.mood[n], g = (n >= 10 ? MV.god_b : MV.god_a)[m.stemGodIndex];
          var parts = ["### " + mname + " · " + m.pillar.stemHanja + m.pillar.branchHanja + (rng ? " (" + rng + ")" : ""), F(mood.text), F(g.text)];
          if (m.dayBranch === "clash" && MV.clash) parts.push(F(MV.clash.text));
          if (m.dayBranch === "combo" && MV.combo) parts.push(F(MV.combo[Math.min(combos++, MV.combo.length - 1)].text));
          if (m.mark === "best" && MV.best) parts.push(F(MV.best[Math.min(best++, MV.best.length - 1)]));
          if (m.mark === "hard" && MV.hard) parts.push(F(MV.hard[Math.min(hard++, MV.hard.length - 1)]));
          mt2.push(join(parts));
          if (g.panel) ch.panels.push(P(g.panel, n === c.months[0] ? m.pillar.stemHanja + m.pillar.branchHanja + " · " + mname + "." : null));
        });
        ch.kicker = c.kicker || "Month by month"; ch.text = mt2.join("\n\n");
      } else if (c.type === "pair") {
        if (!them || !opts.pairs) return; // optional chapter: skipped without their birthday
        var a = Math.min(R.dayMaster, R.partner.dayMaster), b = Math.max(R.dayMaster, R.partner.dayMaster), pk = SLUGS[a] + "-and-" + SLUGS[b];
        var X = opts.pairs[pk], ov = (V.pair_overrides || {})[pk], side = R.dayMaster <= R.partner.dayMaster ? "you_are_a" : "you_are_b";
        var alt = (ov && ov.panels_alt) || X.panels_alt || {};
        ch.kicker = "You " + HANJA.charAt(R.dayMaster) + " " + dmName + " + them " + HANJA.charAt(R.partner.dayMaster) + " " + NAMES[R.partner.dayMaster] + " " + EL[R.partner.dayMaster >> 1];
        ch.title = X.title; ch.text = ov && ov[side] ? ov[side] : X[side];
        (ov && ov.panels ? ov.panels : X.panels).slice(0, 3).forEach(function (q, n) { var z = alt[String(n)] && alt[String(n)].reader === dm ? alt[String(n)] : q; ch.panels.push(P(z, n === 0 ? HANJA.charAt(R.dayMaster) + " + " + HANJA.charAt(R.partner.dayMaster) + " · you and them." : null)); });
      }
      if (c.parts && c.type !== "pair") { // keyed parts, any chapter type (new products)
        var mp = [ch.text];
        c.parts.forEach(function (pt) {
          var kv = partKey(pt.key, R, k), X = kv == null ? null : ((V.keyed || {})[pt.src] || {})[kv];
          if (!X) return;
          var hd = X.heading || pt.heading;
          mp.push((hd ? "### " + F(hd) + "\n\n" : "") + F(X.text));
          if (X.panel) ch.panels.push(P(X.panel));
        });
        ch.text = join(mp);
      }
      if (c.type !== "season" && c.echo) { var tmp = { panels: [] }; echoPanels(c, tmp); ch.panels.splice.apply(ch.panels, [Math.min(1, ch.panels.length), 0].concat(tmp.panels)); }
      var ci = out.length; // copy rewrite 2026-10-21: the paywall cliffhanger is the real opening line of the first locked chapter
      if (V.cliff && V.cliff[dm] && ci === 2) ch.text = join([F(V.cliff[dm]).replace(" | ", " "), ch.text]);
      if (V.sample && V.sample[dm] && V.sample[dm].id === c.id) ch.panels.unshift(P(V.sample[dm]));
      ch.panels = alternate(ch.panels.filter(Boolean));
      out.push(ch);
    });
    CUR = null; TERMS = null;
    var words = 0, panels = 0;
    out.forEach(function (c) { words += wc(c.text.replace(/^### .*$/gm, "")); c.panels.forEach(function (p) { words += wc(p.text); panels++; }); });
    return { chapters: out, words: words, panels: panels, keys: k };
  }

  var api = { assemble: assemble, keysFor: keysFor, fill: fill, wc: wc, REL: REL, SLUGS: SLUGS, EL: EL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BYAssembleV4 = api;
})(typeof window !== "undefined" ? window : null);
