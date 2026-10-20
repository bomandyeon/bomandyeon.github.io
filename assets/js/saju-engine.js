/* Bom & Yeon SajuEngine v1 - plain JS, no deps. Attaches window.SajuEngine (also module.exports for node tests).
 * Conventions (see INTEGRATION.md):
 *  - Clock time = KST (UTC+9) fixed; no local-mean-time (-32 min) or historical DST correction.
 *  - Year starts at the exact Ipchun moment, month at exact jie moment (solar_terms.json, minute precision).
 *  - Ja-si: 23:00-23:59 belongs to the NEXT day (day pillar and hour stem both use next day) = classic "jeongjasi" rule.
 *  - Unknown hour: chart has 3 pillars; the birth moment for term comparisons is taken as 12:00.
 *  - Luck direction: yang year stem + male or yin year stem + female = forward. gender 'other'/missing -> treated as female (UI asks neutrally).
 *  - Luck start age = days to next jie (forward) / previous jie (backward) / 3, rounded, clamped 1..10.
 *  - Season (v2): from the MONTH BRANCH, which already follows the solar terms (jie), not the calendar month:
 *      寅卯辰 spring, 巳午未 summer, 申酉戌 autumn, 亥子丑 winter. Element in command: spring Wood, summer Fire,
 *      autumn Metal, winter Water. 辰未戌丑 (last month of each season) carry Earth as their main qi (seasonEarth=true).
 *  - Day Master strength (v2, binary strong/weak, field dmStrength). Classical three tests, main hidden stems only:
 *      得令 season:  month branch main qi is the DM's own element or its resource element   -> 3 points
 *      得地 roots:   day branch main qi same/resource -> 2; year branch -> 1; hour branch (if known) -> 1
 *      得勢 helpers: year stem, month stem, hour stem (if known) same/resource -> 1 each (the DM stem itself is not counted)
 *    max = 8 with three pillars (10 with hour). strong if score > max/2, weak if score < max/2.
 *    Exact tie (4 of 8): decided by the full hidden-stem weighted support ratio (supportRatio, month counted double) >= 0.45.
 *    The older 3-way field `strength` (strong/balanced/weak) is kept unchanged for yongsin and the home page.
 */
(function (root) {
  var STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var STEM_KO = ['Gap','Eul','Byeong','Jeong','Mu','Gi','Gyeong','Sin','Im','Gye'];
  var BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var BRANCH_KO = ['Ja','Chuk','In','Myo','Jin','Sa','O','Mi','Sin','Yu','Sul','Hae'];
  var ANIMALS = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
  var ELEMENTS = ['Wood','Fire','Earth','Metal','Water'];
  var BRANCH_EL = [4,2,0,0,2,1,1,2,3,3,2,4];
  // hidden stems, main qi first
  var HIDDEN = [[9],[5,9,7],[0,2,4],[1],[4,1,9],[2,6,4],[3,5],[5,3,1],[6,8,4],[7],[4,7,3],[8,0]];
  var HW = {1:[1],2:[0.7,0.3],3:[0.6,0.3,0.1]};
  var TEN_GODS = [
    {ko:'Bigyeon',hanja:'比肩',en:'Friend'},{ko:'Geopjae',hanja:'劫財',en:'Rob Wealth'},
    {ko:'Siksin',hanja:'食神',en:'Eating God'},{ko:'Sanggwan',hanja:'傷官',en:'Hurting Officer'},
    {ko:'Pyeonjae',hanja:'偏財',en:'Indirect Wealth'},{ko:'Jeongjae',hanja:'正財',en:'Direct Wealth'},
    {ko:'Pyeongwan',hanja:'偏官',en:'Seven Killings'},{ko:'Jeonggwan',hanja:'正官',en:'Direct Officer'},
    {ko:'Pyeonin',hanja:'偏印',en:'Indirect Resource'},{ko:'Jeongin',hanja:'正印',en:'Direct Resource'}];
  var REL = ['same','output','wealth','power','resource'];
  var TERM_KO = ['Sohan','Ipchun','Gyeongchip','Cheongmyeong','Ipha','Mangjong','Soseo','Ipchu','Baengno','Hallo','Ipdong','Daeseol'];

  function mod(a, n) { return ((a % n) + n) % n; }
  function stemEl(s) { return s >> 1; }
  function jdn(y, m, d) { // Gregorian -> Julian Day Number
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function jdnToDate(j) {
    var a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    var d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
  }
  // minutes since epoch (KST wall clock treated as linear time)
  function mins(y, m, d, h, mi) { return (jdn(y, m, d) * 24 + h) * 60 + mi; }
  // relation of element b to day-master element a: 0 same,1 output(a feeds b),2 wealth(a controls b),3 power(b controls a),4 resource(b feeds a)
  function rel(a, b) { return mod(b - a, 5) === 0 ? 0 : mod(b - a, 5) === 1 ? 1 : mod(b - a, 5) === 2 ? 2 : mod(b - a, 5) === 3 ? 3 : 4; }
  function tenGod(dm, s) { return rel(stemEl(dm), stemEl(s)) * 2 + ((dm & 1) === (s & 1) ? 0 : 1); }

  var TERMS = null;
  function setTerms(t) { TERMS = t; }
  // all jie moments (minutes) for year y, index 0 = Sohan
  function jieList(y) {
    var a = TERMS && TERMS[String(y)];
    if (!a) { // fallback approx dates outside 1919-2028
      var ap = ['01060000','02040000','03060000','04050000','05060000','06060000','07070000','08080000','09080000','10080000','11070000','12070000'];
      a = ap;
    }
    return a.map(function (s) { return mins(y, +s.slice(0, 2), +s.slice(2, 4), +s.slice(4, 6), +s.slice(6, 8)); });
  }
  function jieAround(t, y) { // returns {prev:{t,idx,year}, next:{...}}
    var list = [];
    [y - 1, y, y + 1].forEach(function (yy) { jieList(yy).forEach(function (m, i) { list.push({ t: m, idx: i, year: yy }); }); });
    for (var i = 0; i < list.length - 1; i++) if (list[i].t <= t && t < list[i + 1].t) return { prev: list[i], next: list[i + 1] };
    return null;
  }
  function pillar(s, b) {
    return { stem: s, branch: b, stemHanja: STEMS[s], branchHanja: BRANCHES[b], stemKo: STEM_KO[s], branchKo: BRANCH_KO[b],
      stemEl: ELEMENTS[stemEl(s)], branchEl: ELEMENTS[BRANCH_EL[b]], animal: ANIMALS[b], label: STEMS[s] + BRANCHES[b],
      yin: (s & 1) === 1 };
  }
  function sexagenary(i) { i = mod(i, 60); return pillar(i % 10, i % 12); }
  function idx60(s, b) { for (var i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return -1; }
  function yearPillar(sy) { return pillar(mod(sy - 4, 10), mod(sy - 4, 12)); }
  function monthStem(yearStem, branch) { return mod((yearStem % 5) * 2 + 2 + mod(branch - 2, 12), 10); }

  // Year+month pillar for a moment t (minutes) in calendar year y
  function yearMonth(t, y) {
    var j = jieAround(t, y), mb = mod(j.prev.idx + 1, 12); // Sohan(idx0)=丑(1), Ipchun(idx1)=寅(2)
    var ipchun = jieList(y)[1], sy = t >= ipchun ? y : y - 1;
    var yp = yearPillar(sy);
    return { year: yp, month: pillar(monthStem(yp.stem, mb), mb), sajuYear: sy, jie: j };
  }

  function weightsFor(p, isStem) { // [{stem, w}]
    if (isStem) return [{ stem: p.stem, w: 1 }];
    var h = HIDDEN[p.branch], ws = HW[h.length];
    return h.map(function (s, i) { return { stem: s, w: ws[i] }; });
  }

  function chart(o) {
    // o: {year, month, day, hour (0-23 or null), minute, gender:'female'|'male'|'other'}
    var y = o.year, m = o.month, d = o.day, hasHour = o.hour !== null && o.hour !== undefined && o.hour !== '';
    var h = hasHour ? +o.hour : 12, mi = hasHour ? (+o.minute || 0) : 0;
    var t = mins(y, m, d, h, mi);
    var ym = yearMonth(t, y);
    var dj = jdn(y, m, d) + (hasHour && h >= 23 ? 1 : 0); // jeongjasi: 23:00 starts next day
    var day = pillar(mod(dj + 9, 10), mod(dj + 1, 12));
    var hourP = null;
    if (hasHour) { var hb = Math.floor((h + 1) / 2) % 12; hourP = pillar(mod((day.stem % 5) * 2 + hb, 10), hb); }
    var dm = day.stem;
    var pillars = { hour: hourP, day: day, month: ym.month, year: ym.year };
    // ten gods + hidden stems
    ['hour', 'day', 'month', 'year'].forEach(function (k) {
      var p = pillars[k]; if (!p) return;
      p.stemGod = k === 'day' ? null : TEN_GODS[tenGod(dm, p.stem)]; p.stemGodIndex = k === 'day' ? null : tenGod(dm, p.stem);
      p.hidden = weightsFor(p, false).map(function (x) {
        return { stem: x.stem, hanja: STEMS[x.stem], el: ELEMENTS[stemEl(x.stem)], w: x.w, god: TEN_GODS[tenGod(dm, x.stem)] };
      });
      p.branchGod = TEN_GODS[tenGod(dm, HIDDEN[p.branch][0])];
    });
    // element counts: visible stems 1 each, each branch 1 split over hidden stems
    var counts = [0, 0, 0, 0, 0], plain = [0, 0, 0, 0, 0], godW = [0,0,0,0,0,0,0,0,0,0];
    var support = 0, total = 0, sup = function (e) { var r = rel(stemEl(dm), e); return r === 0 || r === 4; };
    ['hour', 'day', 'month', 'year'].forEach(function (k) {
      var p = pillars[k]; if (!p) return;
      plain[stemEl(p.stem)]++; plain[BRANCH_EL[p.branch]]++;
      counts[stemEl(p.stem)] += 1;
      if (k !== 'day') { godW[tenGod(dm, p.stem)] += 1; total += 1; if (sup(stemEl(p.stem))) support += 1; }
      var bw = k === 'month' ? 2 : 1; // month branch (season) counts double for strength
      p.hidden.forEach(function (x) {
        var e = stemEl(x.stem); counts[e] += x.w; godW[tenGod(dm, x.stem)] += x.w;
        total += x.w * bw; if (sup(e)) support += x.w * bw;
      });
    });
    counts = counts.map(function (c) { return Math.round(c * 10) / 10; });
    var ratio = support / total;
    var strength = ratio >= 0.5 ? 'strong' : ratio < 0.33 ? 'weak' : 'balanced';
    // v2: season + binary strength
    var mbr = ym.month.branch, SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    var season = SEASONS[mbr], seasonEl = { spring: 0, summer: 1, autumn: 3, winter: 4 }[season];
    var parts = [], sScore = 0, sMax = 0;
    function test(label, w, s) { var ok = sup(stemEl(s)); sMax += w; if (ok) sScore += w; parts.push({ part: label, w: w, ok: ok, el: ELEMENTS[stemEl(s)] }); }
    test('season', 3, HIDDEN[mbr][0]);
    test('day_branch', 2, HIDDEN[pillars.day.branch][0]);
    test('year_branch', 1, HIDDEN[pillars.year.branch][0]);
    if (hourP) test('hour_branch', 1, HIDDEN[hourP.branch][0]);
    test('year_stem', 1, pillars.year.stem); test('month_stem', 1, pillars.month.stem);
    if (hourP) test('hour_stem', 1, hourP.stem);
    var dmStrength = sScore * 2 > sMax ? 'strong' : sScore * 2 < sMax ? 'weak' : (ratio >= 0.45 ? 'strong' : 'weak');
    var dmEl = stemEl(dm);
    var byRel = function (r) { return mod(dmEl + [0, 1, 2, -2, -1][r], 5); };
    // useful element (yongsin), simple rule
    var ys, ysWhy;
    var mb = ym.month.branch;
    if ([5, 6, 7].indexOf(mb) >= 0 && counts[4] < 0.5 && dmEl !== 4) { ys = 4; ysWhy = 'climate: summer birth with almost no Water'; }
    else if ([11, 0, 1].indexOf(mb) >= 0 && counts[1] < 0.5 && dmEl !== 1) { ys = 1; ysWhy = 'climate: winter birth with almost no Fire'; }
    else if (strength === 'strong') {
      ys = [1, 2, 3].map(byRel).sort(function (a, b) { return counts[a] - counts[b]; })[0]; ysWhy = 'strong day master: weakest of output/wealth/power';
    } else if (strength === 'weak') {
      ys = counts[byRel(4)] <= counts[byRel(0)] ? byRel(4) : byRel(0); ysWhy = 'weak day master: weaker of resource/same';
    } else {
      ys = [0, 1, 2, 3, 4].sort(function (a, b) { return counts[a] - counts[b] || a - b; })[0]; ysWhy = 'balanced: weakest element overall';
    }
    var maxGod = 0; godW.forEach(function (w, i) { if (w > godW[maxGod]) maxGod = i; });
    var strongestEl = 0, weakestEl = 0;
    counts.forEach(function (c, i) { if (c > counts[strongestEl]) strongestEl = i; if (c < counts[weakestEl]) weakestEl = i; });
    var missing = []; plain.forEach(function (c, i) { if (!c) missing.push(i); });

    var res = {
      input: o, hasHour: hasHour, pillars: pillars, dayMaster: dm, dayMasterEl: dmEl,
      dayMasterName: STEM_KO[dm] + ' ' + STEMS[dm] + ' (' + (dm & 1 ? 'Yin ' : 'Yang ') + ELEMENTS[dmEl] + ')',
      counts: counts, plainCounts: plain, strongest: strongestEl, weakest: weakestEl, missing: missing,
      strength: strength, strengthIndex: { strong: 0, balanced: 1, weak: 2 }[strength], supportRatio: Math.round(ratio * 100) / 100,
      yongsin: ys, yongsinEl: ELEMENTS[ys], yongsinWhy: ysWhy,
      godWeights: godW.map(function (w) { return Math.round(w * 10) / 10; }), dominantGod: maxGod, dominantGodName: TEN_GODS[maxGod],
      zodiac: ANIMALS[ym.year.branch], sajuYear: ym.sajuYear,
      season: season, seasonEl: seasonEl, seasonElName: ELEMENTS[seasonEl], seasonEarth: [1, 4, 7, 10].indexOf(mbr) >= 0,
      seasonInCommand: parts[0].ok, dmStrength: dmStrength, strengthScore: sScore, strengthMax: sMax, strengthParts: parts,
      readingCode: readingCode(pillars, dm, season, dmStrength)
    };
    res.daeun = luck(res, ym, t, o.gender);
    return res;
  }

  // "Your reading code": BY-<DM hanja>-<season hanja>-<S|W>-<4 chars>. The tail is a hash of the three pillars
  // (year/month/day), so two people with the same chart share a code; it does not spell out the birth date.
  function readingCode(p, dm, season, str) {
    var key = p.year.label + p.month.label + p.day.label, h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var A = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', tail = '';
    for (var k = 0; k < 4; k++) { tail += A.charAt(h % A.length); h = Math.floor(h / A.length); }
    return 'BY-' + STEMS[dm] + '-' + { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[season] + '-' + (str === 'strong' ? 'S' : 'W') + '-' + tail;
  }

  function luck(c, ym, t, gender) {
    var yang = (ym.year.stem & 1) === 0, male = gender === 'male';
    var forward = (yang && male) || (!yang && !male);
    var days = forward ? (ym.jie.next.t - t) / 1440 : (t - ym.jie.prev.t) / 1440;
    var start = Math.min(10, Math.max(1, Math.round(days / 3)));
    var mi = idx60(ym.month.stem, ym.month.branch), by = c.input.year, nowY = new Date().getFullYear();
    var cycles = [];
    for (var i = 1; i <= 8; i++) {
      var p = sexagenary(mi + (forward ? i : -i)), age = start + (i - 1) * 10;
      var r = rel(c.dayMasterEl, stemEl(p.stem));
      cycles.push({ n: i, pillar: p, ageFrom: age, ageTo: age + 9, yearFrom: by + age, yearTo: by + age + 9,
        stemGod: TEN_GODS[tenGod(c.dayMaster, p.stem)], stemGodIndex: tenGod(c.dayMaster, p.stem), branchGod: TEN_GODS[tenGod(c.dayMaster, HIDDEN[p.branch][0])],
        relation: REL[r], relationIndex: r, yin: (p.stem & 1) === 1 });
    }
    var cur = -1; cycles.forEach(function (cy, i) { if (nowY >= cy.yearFrom && nowY <= cy.yearTo) cur = i; });
    return { forward: forward, startAge: start, daysToTerm: Math.round(days * 10) / 10, cycles: cycles, current: cur,
      beforeFirst: nowY < cycles[0].yearFrom };
  }

  function branchInteraction(a, b) { // a,b branch indices
    if (mod(a - b, 12) === 6) return 'clash';
    if (mod(a + b, 12) === 1) return 'combo';           // six harmony
    if (a !== b && mod(a - b, 4) === 0) return 'combo';  // three harmony group
    return 'neutral';
  }

  function annual(c, sy) {
    var p = yearPillar(sy);
    return { year: sy, pillar: p, stemGod: TEN_GODS[tenGod(c.dayMaster, p.stem)], stemGodIndex: tenGod(c.dayMaster, p.stem), branchGod: TEN_GODS[tenGod(c.dayMaster, HIDDEN[p.branch][0])],
      dayBranch: branchInteraction(c.pillars.day.branch, p.branch) };
  }

  function months(c, sy) { // 12 saju months of saju year sy (寅 month ~Feb sy .. 丑 month ~Jan sy+1)
    var yp = yearPillar(sy), out = [], dmEl = c.dayMasterEl, ys = c.yongsin, anti = mod(ys - 2, 5) /* element controlling yongsin */;
    for (var n = 0; n < 12; n++) {
      var b = mod(n + 2, 12), s = monthStem(yp.stem, b);
      var jy = n === 11 ? sy + 1 : sy, ji = n === 11 ? 0 : n + 1, js = (TERMS && TERMS[String(jy)]) ? TERMS[String(jy)][ji] : null;
      var se = stemEl(s), be = BRANCH_EL[b], inter = branchInteraction(c.pillars.day.branch, b);
      var score = (se === ys ? 2 : 0) + (be === ys ? 1 : 0) - (se === anti ? 1 : 0) - (be === anti ? 0.5 : 0) + (inter === 'clash' ? -2 : inter === 'combo' ? 1 : 0);
      out.push({ n: n, pillar: pillar(s, b), stemGod: TEN_GODS[tenGod(c.dayMaster, s)], stemGodIndex: tenGod(c.dayMaster, s),
        branchGod: TEN_GODS[tenGod(c.dayMaster, HIDDEN[b][0])], dayBranch: inter, score: score,
        starts: js ? { y: jy, m: +js.slice(0, 2), d: +js.slice(2, 4), term: TERM_KO[ji] } : null, mark: null });
    }
    var ord = out.slice().sort(function (a, b) { return b.score - a.score || a.n - b.n; });
    ord.slice(0, 2).forEach(function (x) { x.mark = 'best'; });
    ord.slice(-2).forEach(function (x) { if (x.score < ord[1].score) x.mark = 'hard'; });
    return out;
  }

  function compat(a, b) { // two charts
    var ds = a.dayMaster, os = b.dayMaster, flags = [];
    if (mod(ds - os, 10) === 5) flags.push('stem_combo');
    var bi = branchInteraction(a.pillars.day.branch, b.pillars.day.branch);
    if (bi === 'combo') flags.push('branch_harmony'); if (bi === 'clash') flags.push('branch_clash');
    if (b.strongest === a.yongsin || a.strongest === b.yongsin) flags.push('element_complement');
    if (a.dayMasterEl === b.dayMasterEl) flags.push('same_element');
    var r = rel(a.dayMasterEl, b.dayMasterEl); // their element relative to mine
    var verdict = ['same', 'you_feed', 'you_control', 'they_control', 'they_feed'][r];
    var score = 60 + (flags.indexOf('stem_combo') >= 0 ? 15 : 0) + (bi === 'combo' ? 12 : bi === 'clash' ? -15 : 0)
      + (flags.indexOf('element_complement') >= 0 ? 10 : 0) + (r === 4 ? 6 : r === 1 ? 3 : r === 3 ? -6 : 0);
    return { flags: flags, verdict: verdict, score: Math.max(15, Math.min(98, score)) };
  }

  function analyze(o, partner) {
    var c = chart(o);
    c.y2026 = annual(c, 2026); c.y2027 = annual(c, 2027); c.months2027 = months(c, 2027);
    if (partner && partner.year) { var p = chart({ year: partner.year, month: partner.month, day: partner.day, hour: null, gender: 'female' }); c.partner = p; c.compat = compat(c, p); }
    return c;
  }

  var api = { setTerms: setTerms, chart: chart, analyze: analyze, annual: annual, months: months, compat: compat,
    branchInteraction: branchInteraction, tenGod: tenGod, jdn: jdn, jdnToDate: jdnToDate,
    STEMS: STEMS, STEM_KO: STEM_KO, BRANCHES: BRANCHES, BRANCH_KO: BRANCH_KO, ANIMALS: ANIMALS, ELEMENTS: ELEMENTS,
    TEN_GODS: TEN_GODS, HIDDEN: HIDDEN, REL: REL, readingCode: readingCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SajuEngine = api;
})(typeof window !== 'undefined' ? window : null);
