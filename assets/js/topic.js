/* Topic landings (/ex/, /situationship/, /brutally-honest/): one birthday form straight to that reading's free preview.
 * The birthday is saved (entered once, prefilled everywhere); the link carries only an id (?s=, BY.urlState), never the date; ?src stays in localStorage (site.js). */
(function () {
  "use strict";
  var BY = window.BY; if (!BY) return;
  BY.fillSelects();
  [].forEach.call(document.querySelectorAll("form.topic-form"), function (f) {
    var slug = f.getAttribute("data-reading");
    BY.store("pick", { s: slug, t: Date.now() }); // the home page's next step after the free Soul Type points back here
    var pair = f.getAttribute("data-pair") === "required", err = f.querySelector(".err");
    BY.knownBirth(f);
    if (pair) BY.setDate(f, "t", BY.load("their"));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = BY.readDate(f, "b"); if (b.error) { err.textContent = "Your birthday: " + b.error; return; }
      var t = null; if (pair) { t = BY.readDate(f, "t"); if (t.error) { err.textContent = "Their birthday: " + t.error; return; } }
      err.textContent = ""; BY.store("birth", b); if (t) BY.store("their", t);
      BY.track("topic-" + slug, "Topic landing to preview: " + slug);
      location.href = "/readings/" + slug + "/" + BY.urlState.query({ b: b, t: t }) + "#preview";
    });
  });
})();
