/* Bom & Yeon reading plan (v3): decides WHICH layer texts a reading shows for a chart, so the season chapter, the
 * strength box and the balance section never contradict each other. Pure function, no DOM.
 * Used by product.js in the browser (window.BYPlan) and by tests/reading-consistency.test.js in node.
 * Rules:
 *  - Season text is chosen by R.seasonKey (spring|summer|autumn|winter|earth). The engine uses the same command
 *    element for the 得令 strength test, so "your season backs you" and the strength box always agree.
 *  - "Heavy on <own element or resource>" is never shown on a weak chart: a weak chart gets a short bridge instead
 *    and the balance text moves to what actually weighs on it (a missing element, or its heaviest non-support element).
 *  - "Missing" means absent from visible AND hidden stems of the pillars we have (engine R.missing).
 */
(function (root) {
  "use strict";
  var EL = ["Wood", "Fire", "Earth", "Metal", "Water"], EL_LOWER = ["wood", "fire", "earth", "metal", "water"];
  var SEASON_NAME = { spring: "spring", summer: "summer", autumn: "autumn", winter: "winter" };
  var BRANCH_OF = { spring: "辰", summer: "未", autumn: "戌", winter: "丑" };
  function mod(a, n) { return ((a % n) + n) % n; }
  function rel(a, b) { return mod(b - a, 5); } // 0 same, 1 output, 2 wealth, 3 power, 4 resource
  function supports(dmEl, e) { var r = rel(dmEl, e); return r === 0 || r === 4; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function seasonLabel(R) {
    if (R.seasonKey === "earth") return "Born in late " + R.season + ": Earth in command (" + BRANCH_OF[R.season] + " month, 土旺用事)";
    if (R.seasonEarth) return "Born in late " + R.season + ": " + R.seasonElName + " still in command (" + BRANCH_OF[R.season] + " month)";
    return "Born in " + R.season + ": " + R.seasonElName + " in command";
  }
  function seasonShort(R) { return R.seasonKey === "earth" ? "late " + R.season + " (Earth days)" : (R.seasonEarth ? "late " + R.season : R.season); }
  function seasonTitle(R, dmName) {
    if (R.seasonKey === "earth") return dmName + ", born in the Earth days of " + R.season;
    return cap(R.season) + "-born " + dmName;
  }
  function seasonNarration(R) {
    if (R.seasonKey === "earth") return "土 · Late " + R.season + ". Earth in command.";
    return { spring: "春", summer: "夏", autumn: "秋", winter: "冬" }[R.season] + " · " + cap(R.season) + "-born. " + R.seasonElName + " in command.";
  }

  function balance(R, J) {
    var dmEl = R.dayMasterEl, weak = R.dmStrength === "weak", texts = J.balance_text || {}, panels = J.balance_panels || {};
    var heavy = R.strongest, miss = (R.missing || [])[0];
    var out = { blocks: [], panelKey: null, nar: "", heavyShown: null, bridge: false };
    var heavyIsSupport = supports(dmEl, heavy);
    if (weak && heavyIsSupport) {
      // conditional variant: no "too much of your own element" story on a weak chart
      out.bridge = true;
      out.blocks.push({ h: "Plenty of " + EL[heavy] + " on paper, not much root", t: bridgeText(R, heavy) });
      if (miss == null) {
        var press = [1, 2, 3].map(function (r) { return mod(dmEl + r, 5); }).sort(function (a, b) { return R.counts[b] - R.counts[a] || a - b; })[0];
        if (R.counts[press] >= 1 && texts["too_much_" + EL_LOWER[press]]) {
          out.blocks.push({ h: "Where the rest of your weight sits: " + EL[press], t: texts["too_much_" + EL_LOWER[press]], key: "too_much_" + EL_LOWER[press] });
          out.panelKey = "too_much_" + EL_LOWER[press]; out.nar = "Most of the weight: " + EL[press] + ".";
          out.heavyShown = press;
        }
      }
    } else if (texts["too_much_" + EL_LOWER[heavy]]) {
      out.blocks.push({ h: "Heavy on " + EL[heavy] + (heavy === dmEl ? ", your own element" : ""), t: texts["too_much_" + EL_LOWER[heavy]], key: "too_much_" + EL_LOWER[heavy] });
      out.panelKey = "too_much_" + EL_LOWER[heavy]; out.nar = "Heavy on " + EL[heavy] + ".";
      out.heavyShown = heavy;
    }
    if (miss != null && texts["missing_" + EL_LOWER[miss]]) {
      out.blocks.push({ h: "No " + EL[miss] + " in the pillars we can see", t: texts["missing_" + EL_LOWER[miss]], key: "missing_" + EL_LOWER[miss],
        note: R.hasHour ? "" : "Your birth hour would add two more characters, and " + EL[miss] + " could be hiding there." });
      out.panelKey = "missing_" + EL_LOWER[miss]; out.nar = "No " + EL[miss] + " in the pillars we can see.";
    }
    if (!out.panelKey) { out.panelKey = "too_much_" + EL_LOWER[heavy]; out.nar = "Your five elements."; }
    out.panels = (panels[out.panelKey] || []).slice(0, 2);
    if (out.bridge && out.panelKey === "too_much_" + EL_LOWER[heavy]) out.panels = []; // never show "too much X" panels on the bridge
    return out;
  }
  function bridgeText(R, heavy) {
    var where = R.seasonInCommand ? "your season does back you, but your day branch and the stems around you don't add enough" :
      "the places that count most, your season and your day branch, don't hold it";
    return EL[heavy] + " shows up often in your characters, so the bars above lean that way. The strength count still lands on weak, because " +
      where + ". So the usual \"too much " + EL[heavy] + "\" story doesn't fit you. Think of it as plenty of " + EL[heavy] +
      " in the room and not much of it in your hands. The strength section below explains what that does.";
  }

  function strengthBridge(R) {
    var weak = R.dmStrength === "weak";
    if (weak && R.seasonInCommand) return "Your season is on your side, which is why you may not feel weak at all. The rest of your pillars don't add much, so the count stays under half.";
    if (!weak && !R.seasonInCommand) return "You were born out of season, so the season gave you nothing. Your roots and helpers carry you past the halfway mark anyway.";
    return "";
  }

  function plan(R, J) {
    var key = R.seasonKey || R.season, sea = (J.season || {})[key] || {};
    return {
      seasonKey: key, seasonIntro: sea.intro || "", seasonPanel: sea.panel || null,
      seasonLabel: seasonLabel(R), seasonNarration: seasonNarration(R), seasonShort: seasonShort(R),
      balance: balance(R, J), strengthText: (J.strength || {})[R.dmStrength] || "", strengthBridge: strengthBridge(R)
    };
  }

  var api = { plan: plan, seasonLabel: seasonLabel, seasonTitle: seasonTitle, seasonShort: seasonShort, supports: supports, EL: EL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BYPlan = api;
})(typeof window !== "undefined" ? window : null);
