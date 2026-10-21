/* Topic landings (/ex/, /situationship/, /brutally-honest/): one birthday form straight to that reading's free preview.
 * The birthday is saved (entered once, prefilled everywhere) and carried in the URL; ?src stays in localStorage (site.js). */
(function () {
  "use strict";
  var BY = window.BY; if (!BY) return;
  BY.fillSelects();
  [].forEach.call(document.querySelectorAll("form.topic-form"), function (f) {
    var slug = f.getAttribute("data-reading"), pair = f.getAttribute("data-pair") === "required", err = f.querySelector(".err");
    BY.knownBirth(f);
    if (pair) BY.setDate(f, "t", BY.load("their"));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = BY.readDate(f, "b"); if (b.error) { err.textContent = "Your birthday: " + b.error; return; }
      var t = null; if (pair) { t = BY.readDate(f, "t"); if (t.error) { err.textContent = "Their birthday: " + t.error; return; } }
      err.textContent = ""; BY.store("birth", b); if (t) BY.store("their", t);
      BY.track("topic-" + slug, "Topic landing to preview: " + slug);
      location.href = "/readings/" + slug + "/?b=" + BY.iso(b) + (t ? "&t=" + BY.iso(t) : "") + "#preview";
    });
  });
})();
