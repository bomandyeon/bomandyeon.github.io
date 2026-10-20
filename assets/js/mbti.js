/* MBTI x Day Master picker. Data: window.BY_MBTI = {cells:[{mbti, dm_slug, line}]} */
(function () {
  "use strict";
  var BY = window.BY, D = window.BY_DATA, M = window.BY_MBTI, $ = BY.$;
  if (!M) return;
  var sel = { mbti: "INFP", dm: "gap-wood" }, saved = BY.load("birth");
  if (saved && window.SajuEngine) sel.dm = D.SLUGS[BY.analyze(saved).dayMaster];
  function paint() {
    [].forEach.call(document.querySelectorAll("[data-mbti]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mbti") === sel.mbti ? "true" : "false"); });
    [].forEach.call(document.querySelectorAll("[data-dm]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-dm") === sel.dm ? "true" : "false"); });
    var c = M.cells.filter(function (x) { return x.mbti === sel.mbti && x.dm_slug === sel.dm; })[0];
    var s = D.SOULS[D.SLUGS.indexOf(sel.dm)], out = $("mbtiLine");
    out.innerHTML = '<span class="kicker">' + sel.mbti + " × " + BY.esc(s.name) + " " + s.hanja + "</span><br>" + BY.esc(c ? c.line : "");
    out.classList.remove("is-pop"); void out.offsetWidth; out.classList.add("is-pop");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-mbti],[data-dm]"); if (!b) return;
    if (b.hasAttribute("data-mbti")) sel.mbti = b.getAttribute("data-mbti"); else sel.dm = b.getAttribute("data-dm");
    paint();
  });
  paint();
})();
