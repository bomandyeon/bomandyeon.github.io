/* Product page (preview) and reading page (full webtoon). One file, mode from window.BY_PRODUCT.mode. */
(function () {
  "use strict";
  /* Drop Stripe Payment Links in here when checkout is ready, e.g. {"situationship": "https://buy.stripe.com/..."}.
     While a slug has no link, the buy button opens the full reading free as a founding reader gift. */
  var STRIPE_LINKS = {};

  var BY = window.BY, D = window.BY_DATA, P = window.BY_PRODUCT, $ = BY.$, esc = BY.esc;
  if (!P) return;
  var EL_LOWER = ["wood", "fire", "earth", "metal", "water"];
  var ART = P.art || [1, 2, 3, 4, 11, 12];
  BY.fillSelects();
  var dataP = null;
  function data() { if (!dataP) dataP = fetch(P.dataUrl).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); }); return dataP; }

  function qsDate(k) { var m = new RegExp("[?&]" + k + "=([0-9-]{10})").exec(location.search); return m ? BY.fromIso(m[1]) : null; }
  var birth = qsDate("b") || BY.load("birth"), their = qsDate("t") || BY.load("their");

  function readUrl() { return P.readUrl + "?b=" + BY.iso(birth) + (P.two && their ? "&t=" + BY.iso(their) : ""); }
  function pairSlug(a, b) { var x = Math.min(a, b), y = Math.max(a, b); return D.SLUGS[x] + "-and-" + D.SLUGS[y]; }

  function panelsFor(R, d, n) {
    var s = D.SOULS[R.dayMaster], list = (d.panels || []).slice(0, n || 6);
    return list.map(function (p, i) {
      var b = [{ who: p.speaker === "yeon" ? "Yeon" : "Bom", text: p.text }];
      if (i === 0) b.unshift({ text: s.hanja + " · " + s.name + ", " + s.nick.toLowerCase() + "." });
      return BY.panel(ART[i % ART.length], b, (p.speaker === "yeon" ? "Yeon" : "Bom") + " speaks in a comic panel");
    });
  }
  function chapterHTML(ch, text) { return '<section class="rise"><h3>' + esc(ch.title) + "</h3>" + BY.paras(text) + "</section>"; }

  /* ======================= PRODUCT PAGE ======================= */
  function productPage() {
    var form = $("pvForm"), out = $("pvOut");
    BY.setDate(form, "b", birth); if (P.two) BY.setDate(form, "t", their);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = BY.readDate(form, "b");
      if (b.error) { $("pvErr").textContent = "Your birthday: " + b.error; return; }
      var t = null;
      if (P.two) { t = BY.readDate(form, "t"); if (t.error) { $("pvErr").textContent = "Their birthday: " + t.error; return; } }
      $("pvErr").textContent = "";
      birth = b; BY.store("birth", b); if (t) { their = t; BY.store("their", t); }
      renderPreview();
    });
    function renderPreview() {
      var R = BY.analyze(birth, P.two ? their : null), s = D.SOULS[R.dayMaster];
      out.innerHTML = '<p class="center muted">Bom and Yeon are pulling your chapters…</p>';
      data().then(function (J) {
        var d = J.by_day_master[s.slug];
        if (!d) { out.innerHTML = '<p class="err">This reading is still being written for ' + esc(s.name) + ". Try another one for now.</p>"; return; }
        out.innerHTML = "";
        var head = document.createElement("div");
        head.className = "center rise";
        head.innerHTML = '<p class="kicker">Your preview</p><h2><span class="hz" style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + "</span> " + esc(s.name) + "</h2>" +
          (P.two && R.partner ? '<p class="muted">You + ' + esc(D.SOULS[R.partner.dayMaster].name) + ": bond score " + R.compat.score + "%</p>" : "");
        out.appendChild(head);
        var wt = document.createElement("div"); wt.className = "webtoon";
        panelsFor(R, d, 3).forEach(function (f) { wt.appendChild(f); });
        out.appendChild(wt);
        var tx = document.createElement("div"); tx.className = "chapter-text";
        tx.innerHTML = J.chapters.slice(0, 2).map(function (ch) { return chapterHTML(ch, d.chapters[ch.id] || ""); }).join("") +
          '<div class="chapter-lock rise"><p class="kicker">' + (J.chapters.length - 2) + " more chapters</p><ul class=\"chips\">" +
          J.chapters.slice(2).map(function (ch) { return "<li>" + esc(ch.title) + "</li>"; }).join("") + "</ul>" +
          '<button class="btn" type="button" data-buy>' + buyLabel() + "</button>" + giftNote() + "</div>";
        out.appendChild(tx);
        BY.watch(out);
        out.scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth", block: "start" });
      }).catch(function () { out.innerHTML = '<p class="err">The preview didn\'t load. Check your connection and press the button again.</p>'; });
    }
    function buyLabel() { return STRIPE_LINKS[P.slug] ? "Get the full reading · $" + P.price : "Open the full reading"; }
    function giftNote() { return STRIPE_LINKS[P.slug] ? "" : '<p class="gift"><b>Founding reader gift</b>This reading is $' + P.price + ". Our first readers get it free. No card, no charge.</p>"; }
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-buy]")) return;
      e.preventDefault();
      if (!birth || (P.two && !their)) {
        $("pvErr").textContent = P.two ? "Add both birthdays first, so the reading is written for the two of you." : "Add your birthday first, so the reading is written for you.";
        $("preview").scrollIntoView({ behavior: BY.reduced ? "auto" : "smooth" }); form.querySelector("select").focus({ preventScroll: true }); return;
      }
      var link = STRIPE_LINKS[P.slug];
      location.href = link ? link + (link.indexOf("?") < 0 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(P.slug + "_" + BY.iso(birth)) : readUrl();
    });
    if (birth && (!P.two || their)) renderPreview();
    var sb = $("stickyBuy");
    if (sb && "IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) { ents.forEach(function (en) { sb.classList.toggle("is-on", !en.isIntersecting && window.scrollY > 300); }); }).observe($("buyTop"));
    }
  }

  /* ======================= READING PAGE ======================= */
  function readPage() {
    var form = $("rdForm"), out = $("rdOut");
    function need() { return !birth || (P.two && !their); }
    if (need()) {
      $("rdAsk").hidden = false;
      BY.setDate(form, "b", birth); if (P.two) BY.setDate(form, "t", their);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var b = BY.readDate(form, "b"); if (b.error) { $("rdErr").textContent = b.error; return; }
        var t = null; if (P.two) { t = BY.readDate(form, "t"); if (t.error) { $("rdErr").textContent = "Their birthday: " + t.error; return; } }
        birth = b; BY.store("birth", b); if (t) { their = t; BY.store("their", t); }
        $("rdAsk").hidden = true; render();
      });
    } else render();

    function render() {
      var R = BY.analyze(birth, P.two ? their : null), s = D.SOULS[R.dayMaster];
      out.innerHTML = '<p class="center muted">Opening your reading…</p>';
      data().then(function (J) {
        var d = J.by_day_master[s.slug] || { chapters: {}, panels: [] };
        var h = '<header class="rd-head rise"><p class="kicker">' + esc(J.title) + '</p><p class="hz" style="font-size:84px;line-height:1;color:' + D.EL_COLOR[s.el] + '">' + s.hanja + "</p><h1>" + esc(s.name) + '</h1><p class="muted">' + esc(s.nick) + " · born " + BY.iso(birth) + "</p></header>";
        out.innerHTML = h;
        if (P.two && R.partner) {
          var them = D.SOULS[R.partner.dayMaster], box = document.createElement("div");
          box.className = "card center rise";
          box.innerHTML = '<p class="kicker">You and them</p><div class="duo"><span style="color:' + D.EL_COLOR[s.el] + '">' + s.hanja + '</span><i>+</i><span style="color:' + D.EL_COLOR[them.el] + '">' + them.hanja + "</span></div>" +
            '<p class="score">' + R.compat.score + '%</p><p class="verdict">' + esc(D.MATCH_TITLE[R.compat.verdict]) + "</p>" +
            '<p class="muted">' + esc(D.VERDICTS[R.compat.verdict].p) + '</p><a class="link-arrow" href="/compatibility/' + pairSlug(R.dayMaster, R.partner.dayMaster) + '/">' + esc(s.name + " + " + them.name) + " in full</a>";
          out.appendChild(box);
        }
        var wt = document.createElement("div"); wt.className = "webtoon"; wt.style.marginTop = "24px";
        panelsFor(R, d, 6).forEach(function (f) { wt.appendChild(f); });
        out.appendChild(wt);
        var tx = document.createElement("div"); tx.className = "chapter-text";
        var parts = J.chapters.map(function (ch) { return chapterHTML(ch, d.chapters[ch.id] || ""); });
        parts.splice(Math.min(2, parts.length), 0, elementsHTML(R, J));
        tx.innerHTML = parts.join("") +
          '<div class="say say--yeon rise"><span class="av av--yeon"><img src="/assets/img/av-yeon.webp" alt="" width="56" height="56"><img src="/assets/img/av-yeon-blink.webp" alt="" width="56" height="56"></span><p class="bubble"><b>Yeon</b>' + esc(D.YEON_MSG[R.dayMasterEl]) + "</p></div>" +
          '<div class="actions rise"><button class="btn btn--ghost" type="button" id="rdShare">Share this reading</button></div>';
        out.appendChild(tx);
        requestAnimationFrame(function () { setTimeout(function () { [].forEach.call(out.querySelectorAll("[data-w]"), function (i) { i.style.width = i.getAttribute("data-w") + "%"; }); }, 200); });
        $("rdShare").addEventListener("click", function () { BY.share(J.title, "Bom and Yeon read my chart: " + J.title, "https://bomandyeon.com/readings/" + P.slug + "/"); });
        $("rdCross").hidden = false;
        BY.watch(out);
      }).catch(function () { out.innerHTML = '<p class="err center">The reading didn\'t load. Check your connection and refresh the page.</p>'; });
    }
    function elementsHTML(R, J) {
      var max = Math.max.apply(null, R.counts.concat([1])), E = J.by_element_balance || {};
      var bars = R.counts.map(function (c, i) {
        return '<div class="bar"><span>' + D.EL_NAMES[i] + '</span><span class="tr"><i style="--c:' + D.EL_COLOR[D.EL_NAMES[i]] + '" data-w="' + Math.round(c / max * 100) + '"></i></span><span>' + c.toFixed(1) + "</span></div>";
      }).join("");
      var txt = "", strong = EL_LOWER[R.strongest], miss = (R.missing || [])[0];
      if (E["too_much_" + strong]) txt += "<h4>Heavy on " + D.EL_NAMES[R.strongest] + "</h4>" + BY.paras(E["too_much_" + strong]);
      if (miss != null && E["missing_" + EL_LOWER[miss]]) txt += "<h4>Low on " + D.EL_NAMES[miss] + "</h4>" + BY.paras(E["missing_" + EL_LOWER[miss]]);
      return '<section class="card rise" style="margin:30px 0"><p class="kicker">Your five elements</p><div class="bars">' + bars + "</div>" + txt + "</section>";
    }
  }

  if (P.mode === "read") readPage(); else productPage();
})();
