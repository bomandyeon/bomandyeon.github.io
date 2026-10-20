/* Compatibility index: pick two souls, or two birthdays. */
(function () {
  "use strict";
  var BY = window.BY, D = window.BY_DATA, $ = BY.$;
  BY.fillSelects();
  function go(a, b) { var x = Math.min(a, b), y = Math.max(a, b); location.href = "/compatibility/" + D.SLUGS[x] + "-and-" + D.SLUGS[y] + "/"; }
  var pf = $("pickForm");
  if (pf) pf.addEventListener("submit", function (e) { e.preventDefault(); go(+$("pa").value, +$("pb").value); });
  var bf = $("bdForm");
  if (!bf) return;
  var me = BY.load("birth"), them = BY.load("their");
  BY.setDate(bf, "b", me); BY.setDate(bf, "t", them);
  bf.addEventListener("submit", function (e) {
    e.preventDefault();
    var b = BY.readDate(bf, "b"); if (b.error) { $("bdErr").textContent = "Your birthday: " + b.error; return; }
    var t = BY.readDate(bf, "t"); if (t.error) { $("bdErr").textContent = "Their birthday: " + t.error; return; }
    BY.store("birth", b); BY.store("their", t);
    var R = BY.analyze(b, t);
    go(R.dayMaster, R.partner.dayMaster);
  });
})();
