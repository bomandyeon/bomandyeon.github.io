/* Story image (1080x1920) of the reader's cover card, drawn on a canvas. BY.storyCard(info) opens a sheet with the
 * image, a download link and (where supported) the native share sheet. info comes from product.js coverInfo(). */
(function () {
  "use strict";
  var BY = window.BY = window.BY || {};
  var W = 1080, H = 1920, BG = "#0E0F1A", MOON = "#EDE6D6", GOLD = "#C9A45C", RED = "#C8443C";
  var COL = { Wood: "#6FA86B", Fire: "#C8564C", Earth: "#C9A45C", Metal: "#C3C7CE", Water: "#5E86B8" };
  var SERIF = "'Gowun Batang', Georgia, serif", SANS = "Inter, system-ui, sans-serif", HZ = "'Noto Serif KR', 'Gowun Batang', serif";

  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function center(ctx, t, y, font, color) { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(t, W / 2, y); }
  function fit(ctx, t, font, max) { // shrink font size until text fits
    var m = /(\d+)px/.exec(font), size = m ? +m[1] : 40;
    while (size > 18) { ctx.font = font.replace(/\d+px/, size + "px"); if (ctx.measureText(t).width <= max) break; size -= 2; }
    return ctx.font;
  }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  BY.drawStory = function (I) {
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    var F = document.fonts, txt = I.hanja + I.pillars.map(function (p) { return p.stem + p.branch; }).join("") + I.seasonHz + "봄연" + (I.them ? I.them.hanja : "");
    var ready = F && F.load ? Promise.all([F.load("700 96px 'Noto Serif KR'", txt), F.load("700 64px 'Gowun Batang'", "Bom & Yeon"), F.load("600 34px Inter", "A")])
      .catch(function () {}).then(function () { return F.ready; }) : Promise.resolve();
    return Promise.all([ready, img("/assets/img/hanji.webp"), img("/assets/img/av-bom.webp"), img("/assets/img/av-yeon.webp")]).then(function (r) {
      var hanji = r[1], bom = r[2], yeon = r[3];
      // background
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      if (hanji) { ctx.globalAlpha = 0.07; for (var y = 0; y < H; y += hanji.height || 512) for (var x = 0; x < W; x += hanji.width || 512) ctx.drawImage(hanji, x, y); ctx.globalAlpha = 1; }
      var g = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 900); g.addColorStop(0, "rgba(201,164,92,.20)"); g.addColorStop(1, "rgba(14,15,26,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // moon
      ctx.fillStyle = "rgba(237,230,214,.92)"; ctx.beginPath(); ctx.arc(W - 170, 200, 70, 0, 6.283); ctx.fill();
      ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(W - 140, 180, 62, 0, 6.283); ctx.fill();
      // seal + brand
      round(ctx, 90, 120, 96, 96, 14); ctx.fillStyle = RED; ctx.fill();
      ctx.font = "700 36px " + HZ; ctx.fillStyle = "#FFF4E8"; ctx.textAlign = "center"; ctx.fillText("봄연", 138, 182);
      ctx.textAlign = "left"; ctx.font = "700 44px " + SERIF; ctx.fillStyle = MOON; ctx.fillText("Bom & Yeon", 212, 182);
      // title + name
      center(ctx, I.title.toUpperCase(), 330, fit(ctx, I.title.toUpperCase(), "600 34px " + SANS, 900), GOLD);
      var nm = I.name ? I.name : "My reading";
      center(ctx, nm, 420, fit(ctx, nm, "700 64px " + SERIF, 900), MOON);
      // day master
      center(ctx, I.hanja, 700, "700 300px " + HZ, I.color);
      center(ctx, I.dmName, 800, "700 72px " + SERIF, MOON);
      center(ctx, I.nick + (I.them ? "  ·  with " + I.them.hanja + " " + I.them.name : ""), 862, fit(ctx, I.nick, "400 38px " + SERIF, 900), "rgba(237,230,214,.7)");
      // pillars
      var np = I.pillars.length, gap = np > 3 ? 236 : 260, bw = np > 3 ? 200 : 210;
      var px = I.pillars.map(function (_, i) { return W / 2 + (i - (np - 1) / 2) * gap; });
      I.pillars.forEach(function (p, i) {
        round(ctx, px[i] - bw / 2, 930, bw, 330, 22); ctx.fillStyle = "rgba(237,230,214,.06)"; ctx.fill(); ctx.strokeStyle = "rgba(201,164,92,.45)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = "600 28px " + SANS; ctx.fillStyle = GOLD; ctx.fillText(p.label.toUpperCase(), px[i], 980);
        ctx.font = "700 96px " + HZ; ctx.fillStyle = COL[p.stemEl] || MOON; ctx.fillText(p.stem, px[i], 1090);
        ctx.fillStyle = COL[p.branchEl] || MOON; ctx.fillText(p.branch, px[i], 1200);
        ctx.font = "400 24px " + SANS; ctx.fillStyle = "rgba(237,230,214,.65)"; ctx.fillText(p.stemEl + " · " + p.branchEl, px[i], 1240);
      });
      // tags
      var tags = [I.seasonHz + " " + I.season.charAt(0).toUpperCase() + I.season.slice(1) + "-born", (I.strength === "strong" ? "Strong" : "Weak") + " chart"];
      ctx.font = "600 34px " + SANS;
      var tw = tags.map(function (t) { return ctx.measureText(t).width + 56; }), tot = tw[0] + tw[1] + 24, tx = (W - tot) / 2;
      tags.forEach(function (t, i) {
        round(ctx, tx, 1300, tw[i], 66, 33); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = MOON; ctx.textAlign = "center"; ctx.fillText(t, tx + tw[i] / 2, 1345); tx += tw[i] + 24;
      });
      // element bars
      var names = ["Wood", "Fire", "Earth", "Metal", "Water"], max = Math.max.apply(null, I.counts.concat([1]));
      names.forEach(function (n, i) {
        var y = 1420 + i * 58;
        ctx.textAlign = "left"; ctx.font = "500 30px " + SANS; ctx.fillStyle = "rgba(237,230,214,.8)"; ctx.fillText(n, 170, y + 22);
        round(ctx, 330, y, 520, 22, 11); ctx.fillStyle = "rgba(237,230,214,.1)"; ctx.fill();
        if (I.counts[i] > 0) { var w = Math.max(22, 520 * I.counts[i] / max); round(ctx, 330, y, w, 22, 11); ctx.fillStyle = COL[n]; ctx.fill(); }
        ctx.textAlign = "right"; ctx.fillStyle = "rgba(237,230,214,.8)"; ctx.fillText(I.counts[i].toFixed(1), 930, y + 22);
      });
      // (no reading code on anything public)
      center(ctx, "What's your soul?", 1740, "italic 600 40px " + SERIF, GOLD);
      // avatars + url
      [[bom, 90], [yeon, W - 186]].forEach(function (a) {
        if (!a[0]) return;
        ctx.save(); ctx.beginPath(); ctx.arc(a[1] + 48, 1828, 48, 0, 6.283); ctx.clip(); ctx.drawImage(a[0], a[1], 1780, 96, 96); ctx.restore();
        ctx.beginPath(); ctx.arc(a[1] + 48, 1828, 48, 0, 6.283); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
      });
      center(ctx, "bomandyeon.com", 1842, "700 44px " + SERIF, MOON);
      center(ctx, "For entertainment and self-reflection.", 1886, "400 24px " + SANS, "rgba(237,230,214,.55)");
      return cv;
    });
  };

  BY.storyCard = function (I) {
    var sheet = document.createElement("div");
    sheet.className = "story-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Your story image");
    sheet.innerHTML = '<div class="story-box"><p class="center muted">Drawing your card…</p></div>';
    document.body.appendChild(sheet);
    function close() { sheet.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    sheet.addEventListener("click", function (e) { if (e.target === sheet || e.target.closest("[data-close]")) close(); });
    BY.drawStory(I).then(function (cv) {
      cv.toBlob(function (blob) {
        var url = URL.createObjectURL(blob), fname = "bom-and-yeon-" + String(I.dmName || "reading").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() + ".png";
        var file = null; try { file = new File([blob], fname, { type: "image/png" }); } catch (x) { file = null; }
        var canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
        var box = sheet.querySelector(".story-box");
        box.innerHTML = '<img src="' + url + '" alt="Your Bom and Yeon story card: ' + I.dmName + ", " + BY.esc(I.title || "") + '" width="1080" height="1920">' +
          '<p class="muted small center">1080 × 1920, sized for Instagram stories. On a phone you can also press and hold the image to save it.</p>' +
          '<div class="actions">' + (canShare ? '<button class="btn" type="button" data-sh>Share</button>' : "") +
          '<a class="btn' + (canShare ? " btn--ghost" : "") + '" href="' + url + '" download="' + fname + '">Download image</a><button class="btn btn--ghost" type="button" data-close>Close</button></div>';
        var dl = box.querySelector("a[download]");
        if (dl && BY.track) dl.addEventListener("click", function () { BY.track("story-download", "Story image downloaded"); });
        var sh = box.querySelector("[data-sh]");
        if (sh) sh.addEventListener("click", function () { navigator.share({ files: [file], title: "Bom & Yeon", text: "My Bom and Yeon reading: bomandyeon.com" }).catch(function () {}); });
      }, "image/png");
    });
  };
})();

/* Public share cards (P3): one big line + soul + #MyKoreanSoul + bomandyeon.com, in two sizes.
 * BY.shareCard(o) opens a sheet with a Story (1080x1920) / Post (1080x1350) switch, native share with the image file where
 * the browser supports it, and a download fallback. o = {kind:"soul"|"match", kicker, line, who, hanja, name, nick, color,
 * them:{hanja,name,nick,color}, score, verdict, file, text}. No birth dates and no product titles go on these cards. */
(function () {
  "use strict";
  var BY = window.BY = window.BY || {};
  var BG = "#0E0F1A", MOON = "#EDE6D6", GOLD = "#C9A45C", RED = "#C8443C";
  var SERIF = "'Gowun Batang', Georgia, serif", SANS = "Inter, system-ui, sans-serif", HZ = "'Noto Serif KR', 'Gowun Batang', serif";
  var SIZES = { story: [1080, 1920], post: [1080, 1350] };
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(ctx, text, max) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width <= max || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur); return lines;
  }
  function fitOne(ctx, t, weight, size, family, max) { while (size > 20) { ctx.font = weight + " " + size + "px " + family; if (ctx.measureText(t).width <= max) break; size -= 2; } return size; }
  BY.drawShareCard = function (o, fmt) {
    var W = SIZES[fmt][0], H = SIZES[fmt][1], story = fmt === "story";
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var ctx = cv.getContext("2d");
    var F = document.fonts, hz = (o.hanja || "") + (o.them ? o.them.hanja : "") + "봄연";
    var ready = F && F.load ? Promise.all([F.load("700 96px 'Noto Serif KR'", hz), F.load("700 64px 'Gowun Batang'", o.line || "Bom & Yeon"), F.load("600 34px Inter", "A#")])
      .catch(function () {}).then(function () { return F.ready; }) : Promise.resolve();
    return Promise.all([ready, img("/assets/img/hanji.webp"), img("/assets/img/av-yeon.webp")]).then(function (r) {
      var hanji = r[1], yeon = r[2], M = 90, TW = W - 2 * M;
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      if (hanji) { ctx.globalAlpha = 0.07; for (var y = 0; y < H; y += hanji.height || 512) for (var x = 0; x < W; x += hanji.width || 512) ctx.drawImage(hanji, x, y); ctx.globalAlpha = 1; }
      var g = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, H * 0.6); g.addColorStop(0, "rgba(201,164,92,.18)"); g.addColorStop(1, "rgba(14,15,26,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(201,164,92,.35)"; ctx.lineWidth = 2; round(ctx, 30, 30, W - 60, H - 60, 28); ctx.stroke();
      ctx.fillStyle = "rgba(237,230,214,.92)"; ctx.beginPath(); ctx.arc(W - 160, 150, 52, 0, 6.283); ctx.fill();
      ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(W - 137, 135, 46, 0, 6.283); ctx.fill();
      round(ctx, M, 100, 84, 84, 14); ctx.fillStyle = RED; ctx.fill();
      ctx.font = "700 32px " + HZ; ctx.fillStyle = "#FFF4E8"; ctx.textAlign = "center"; ctx.fillText("봄연", M + 42, 154);
      ctx.textAlign = "left"; ctx.font = "700 42px " + SERIF; ctx.fillStyle = MOON; ctx.fillText("Bom & Yeon", M + 106, 156);
      // bottom block
      ctx.textAlign = "center";
      ctx.font = "400 24px " + SANS; ctx.fillStyle = "rgba(237,230,214,.55)"; ctx.fillText("For entertainment and self-reflection.", W / 2, H - 70);
      ctx.font = "700 46px " + SERIF; ctx.fillStyle = MOON; ctx.fillText("What's yours? bomandyeon.com", W / 2, H - 130);
      ctx.font = "700 44px " + SANS; ctx.fillStyle = GOLD; ctx.fillText("#MyKoreanSoul", W / 2, H - 200);
      // middle stack, measured then centered in [top, bottom]
      var top = 250, bottom = H - 270, items = [];
      if (o.kind === "match") {
        var hs = story ? 210 : 160;
        items.push({ h: 40, draw: function (y) { ctx.font = "600 32px " + SANS; ctx.fillStyle = GOLD; ctx.fillText(String(o.kicker || "").toUpperCase(), W / 2, y + 32); } });
        items.push({ h: hs + 20, draw: function (y) {
          ctx.font = "700 " + hs + "px " + HZ; ctx.fillStyle = o.color; ctx.fillText(o.hanja, W / 2 - hs * 0.95, y + hs * 0.88);
          ctx.fillStyle = o.them.color; ctx.fillText(o.them.hanja, W / 2 + hs * 0.95, y + hs * 0.88);
          ctx.font = "700 " + Math.round(hs * 0.42) + "px " + SERIF; ctx.fillStyle = GOLD; ctx.fillText("+", W / 2, y + hs * 0.7); } });
        var ss = story ? 190 : 150;
        items.push({ h: ss, draw: function (y) { ctx.font = "700 " + ss + "px " + SERIF; ctx.fillStyle = MOON; ctx.fillText(o.score + "%", W / 2, y + ss * 0.86); } });
        if (o.verdict) items.push({ h: 70, draw: function (y) { var s = fitOne(ctx, o.verdict, "700", 52, SERIF, TW); ctx.fillStyle = GOLD; ctx.fillText(o.verdict, W / 2, y + s); } });
        items.push({ h: 64, draw: function (y) { var t = o.nick + " + " + o.them.nick; var s = fitOne(ctx, t, "400", 40, SERIF, TW); ctx.fillStyle = "rgba(237,230,214,.8)"; ctx.fillText(t, W / 2, y + s); } });
        items.push({ h: 44, draw: function (y) { var t = o.name + " + " + o.them.name; var s = fitOne(ctx, t, "500", 30, SANS, TW); ctx.fillStyle = "rgba(237,230,214,.6)"; ctx.fillText(t, W / 2, y + s); } });
      } else {
        var qs = story ? 78 : 64, lines, lh, avail = bottom - top - (story ? 520 : 400);
        ctx.font = "700 " + qs + "px " + SERIF;
        while (qs > 34) { ctx.font = "700 " + qs + "px " + SERIF; lines = wrap(ctx, "\u201C" + o.line + "\u201D", TW); lh = Math.round(qs * 1.28); if (lines.length * lh <= avail && lines.length <= (story ? 7 : 5)) break; qs -= 4; }
        ctx.font = "700 " + qs + "px " + SERIF; lines = wrap(ctx, "\u201C" + o.line + "\u201D", TW); lh = Math.round(qs * 1.28);
        items.push({ h: 64, draw: function (y) { ctx.font = "600 30px " + SANS; ctx.fillStyle = GOLD; ctx.fillText(String(o.kicker || "").toUpperCase(), W / 2, y + 30); } });
        items.push({ h: 80, draw: function (y) {
          var label = (o.who || "Yeon") + " says", lw; ctx.font = "600 30px " + SANS; lw = ctx.measureText(label).width; var x0 = W / 2 - (lw + 72) / 2;
          if (yeon) { ctx.save(); ctx.beginPath(); ctx.arc(x0 + 28, y + 36, 28, 0, 6.283); ctx.clip(); ctx.drawImage(yeon, x0, y + 8, 56, 56); ctx.restore(); }
          ctx.textAlign = "left"; ctx.fillStyle = "rgba(237,230,214,.75)"; ctx.fillText(label, x0 + 72, y + 46); ctx.textAlign = "center"; } });
        items.push({ h: lines.length * lh + 20, draw: function (y) { ctx.font = "700 " + qs + "px " + SERIF; ctx.fillStyle = MOON; lines.forEach(function (l, i) { ctx.fillText(l, W / 2, y + qs + i * lh); }); } });
        var hs2 = story ? 220 : 160;
        items.push({ h: 30, draw: function () {} });
        items.push({ h: hs2, draw: function (y) { ctx.font = "700 " + hs2 + "px " + HZ; ctx.fillStyle = o.color; ctx.fillText(o.hanja, W / 2, y + hs2 * 0.88); } });
        items.push({ h: 76, draw: function (y) { var s = fitOne(ctx, o.nick, "700", 60, SERIF, TW); ctx.fillStyle = MOON; ctx.fillText(o.nick, W / 2, y + s + 6); } });
        items.push({ h: 48, draw: function (y) { var t = o.name + " \u00B7 Korean saju soul"; var s = fitOne(ctx, t, "500", 30, SANS, TW); ctx.fillStyle = "rgba(237,230,214,.65)"; ctx.fillText(t, W / 2, y + s); } });
      }
      var tot = items.reduce(function (a, b) { return a + b.h + 18; }, -18), yy = top + Math.max(0, (bottom - top - tot) / 2);
      ctx.textAlign = "center";
      items.forEach(function (it) { ctx.textAlign = "center"; it.draw(yy); yy += it.h + 18; });
      return cv;
    });
  };
  BY.shareCard = function (o) {
    var sheet = document.createElement("div"), fmt = "story", urls = [];
    sheet.className = "story-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Your share image");
    sheet.innerHTML = '<div class="story-box"><div class="fmt" role="group" aria-label="Image size"><button type="button" class="tab" data-f="story" aria-pressed="true">Story 9:16</button><button type="button" class="tab" data-f="post" aria-pressed="false">Post 4:5</button></div><div class="sc-out"><p class="center muted">Drawing your card…</p></div></div>';
    document.body.appendChild(sheet);
    function close() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); sheet.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) { close(); return; }
      var f = e.target.closest("[data-f]"); if (f && f.getAttribute("data-f") !== fmt) { fmt = f.getAttribute("data-f"); paint(); }
    });
    function paint() {
      [].forEach.call(sheet.querySelectorAll("[data-f]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-f") === fmt ? "true" : "false"); });
      var out = sheet.querySelector(".sc-out"); out.innerHTML = '<p class="center muted">Drawing your card…</p>';
      BY.drawShareCard(o, fmt).then(function (cv) {
        cv.toBlob(function (blob) {
          var url = URL.createObjectURL(blob), fname = (o.file || "my-korean-soul") + "-" + fmt + ".png"; urls.push(url);
          var file = null; try { file = new File([blob], fname, { type: "image/png" }); } catch (x) { file = null; }
          var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
          var dims = SIZES[fmt];
          out.innerHTML = '<img src="' + url + '" alt="' + BY.esc(o.alt || "Your Bom and Yeon share card") + '" width="' + dims[0] + '" height="' + dims[1] + '">' +
            '<p class="muted small center">' + dims[0] + " \u00D7 " + dims[1] + (fmt === "story" ? ", sized for stories." : ", sized for feed posts.") + " On a phone you can also press and hold the image to save it.</p>" +
            '<div class="actions">' + (canShare ? '<button class="btn" type="button" data-sh>Share image</button>' : "") +
            '<a class="btn' + (canShare ? " btn--ghost" : "") + '" href="' + url + '" download="' + fname + '">Download image</a><button class="btn btn--ghost" type="button" data-close>Close</button></div>';
          var dl = out.querySelector("a[download]");
          if (dl && BY.track) dl.addEventListener("click", function () { BY.track("share-download-" + (o.kind || "card") + "-" + fmt, "Share image downloaded (" + fmt + ")"); });
          var sh = out.querySelector("[data-sh]");
          if (sh) sh.addEventListener("click", function () { navigator.share({ files: [file], text: o.text || "#MyKoreanSoul bomandyeon.com" }).catch(function () {}); });
        }, "image/png");
      });
    }
    paint();
  };
})();
