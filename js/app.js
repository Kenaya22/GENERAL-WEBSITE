/* ==========================================================================
   HARI NG KALSADA — app logic
   Renders content from js/content.js, handles theme, filters, saving,
   search, sheets, toasts, reveal motion, and PWA install / offline.
   ========================================================================== */
(function () {
  "use strict";

  var SITE = window.SITE;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var slot = function (name) { return $$('[data-slot="' + name + '"]'); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Safe storage (works in private mode too) ---------------------- */
  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(id, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function stars(n, total) {
    var out = "";
    for (var i = 1; i <= (total || 5); i++) out += '<svg class="' + (i <= Math.round(n) ? "" : "off") + '" aria-hidden="true"><use href="#i-star"/></svg>';
    return out;
  }
  function byId(id) { for (var i = 0; i < SITE.items.length; i++) if (SITE.items[i].id === id) return SITE.items[i]; return null; }

  /* ==========================================================================
     ART GENERATOR — atmospheric night-road illustrations drawn as SVG.
     ========================================================================== */
  var artCount = 0;
  function rng(seed) {
    var a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hsl(h, s, l, a) { h = ((h % 360) + 360) % 360; return a == null ? "hsl(" + h + " " + s + "% " + l + "%)" : "hsl(" + h + " " + s + "% " + l + "% / " + a + ")"; }
  function f(n) { return Math.round(n * 10) / 10; }

  function art(opts) {
    opts = opts || {};
    if (opts.image) return '<img src="' + esc(opts.image) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">';
    var scene = opts.scene || "road";
    var h = opts.hue == null ? 350 : opts.hue;
    var R = rng(opts.seed || 1);
    var W = 400, H = 300;
    var id = "g" + ++artCount;
    // horizon glow: amber for warm palettes, a lifted tint for cool ones
    var warm = (h >= 300 || h <= 60) ? 26 + ((opts.seed || 1) % 5) * 3 : h + 18;
    var s = [];
    var hy = scene === "coast" ? 168 : scene === "city" ? 205 : scene === "mountain" ? 190 : 172;

    s.push(
      '<defs>',
      '<linearGradient id="' + id + 's" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0" stop-color="' + hsl(h, 45, 5) + '"/>',
      '<stop offset=".55" stop-color="' + hsl(h, 48, 13) + '"/>',
      '<stop offset="1" stop-color="' + hsl(warm, 62, 34) + '"/>',
      '</linearGradient>',
      '<radialGradient id="' + id + 'g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + hsl(warm + 6, 90, 70, 0.75) + '"/><stop offset="1" stop-color="' + hsl(warm, 90, 60, 0) + '"/></radialGradient>',
      '<radialGradient id="' + id + 'l" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="hsl(42 100% 82% / .95)"/><stop offset=".25" stop-color="hsl(40 95% 65% / .5)"/><stop offset="1" stop-color="hsl(38 90% 60% / 0)"/></radialGradient>',
      '<radialGradient id="' + id + 'r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="hsl(0 100% 65% / .95)"/><stop offset="1" stop-color="hsl(0 100% 50% / 0)"/></radialGradient>',
      '<linearGradient id="' + id + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(40 95% 65% / .55)"/><stop offset="1" stop-color="hsl(40 95% 65% / 0)"/></linearGradient>',
      '</defs>',
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 's)"/>'
    );

    // stars
    var starN = scene === "city" ? 18 : 46;
    for (var i = 0; i < starN; i++) {
      s.push('<circle cx="' + f(R() * W) + '" cy="' + f(R() * hy * 0.62) + '" r="' + f(0.3 + R() * 0.9) + '" fill="#fbf7f0" opacity="' + f(0.25 + R() * 0.65) + '"/>');
    }
    // horizon glow
    s.push('<ellipse cx="' + f(120 + R() * 160) + '" cy="' + hy + '" rx="260" ry="62" fill="url(#' + id + 'g)"/>');

    if (scene === "road") drawRoad();
    else if (scene === "mountain") drawMountain();
    else if (scene === "city") drawCity();
    else if (scene === "coast") drawCoast();
    else drawDial();

    // film vignette
    s.push('<rect width="' + W + '" height="' + H + '" fill="none" stroke="' + hsl(h, 40, 3, 0.55) + '" stroke-width="70" style="filter:blur(0)" opacity=".5"/>');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="presentation">' + s.join("") + "</svg>";

    function bokehRow(y, n, spread) {
      for (var i = 0; i < n; i++) {
        var r = 0.6 + R() * 2.2;
        s.push('<circle cx="' + f(R() * W) + '" cy="' + f(y - R() * spread) + '" r="' + f(r) + '" fill="' + (R() > 0.82 ? "hsl(0 90% 65%)" : "hsl(" + (36 + R() * 14) + " 95% " + (62 + R() * 20) + "%)") + '" opacity="' + f(0.45 + R() * 0.5) + '"/>');
      }
    }
    function drawRoad() {
      var vx = 186 + R() * 28;
      bokehRow(hy - 1, 38, 10);
      // distant hills
      var d = "M0 " + hy;
      for (var x = 0; x <= W; x += 25) d += " L" + x + " " + f(hy - 6 - R() * 16);
      s.push('<path d="' + d + " L" + W + " " + hy + ' Z" fill="' + hsl(h, 35, 8) + '"/>');
      s.push('<rect y="' + hy + '" width="' + W + '" height="' + (H - hy) + '" fill="' + hsl(h, 38, 5) + '"/>');
      // road surface
      s.push('<path d="M' + (vx - 3) + " " + hy + " L" + (vx + 3) + " " + hy + " L" + (W + 40) + " " + H + " L-40 " + H + ' Z" fill="' + hsl(h, 18, 9) + '"/>');
      s.push('<path d="M' + (vx - 3) + " " + hy + " L-40 " + H + "M" + (vx + 3) + " " + hy + " L" + (W + 40) + " " + H + '" stroke="#fbf7f0" stroke-opacity=".28" stroke-width="1.2"/>');
      // wet reflection
      s.push('<path d="M' + (vx - 2) + " " + hy + " L" + (vx + 2) + " " + hy + " L" + (vx + 60) + " " + H + " L" + (vx - 60) + " " + H + ' Z" fill="url(#' + id + 'w)" opacity=".35"/>');
      // centre dashes in perspective
      for (var k = 0; k < 14; k++) {
        var p1 = Math.pow(k / 14, 2.2), p2 = Math.pow((k + 0.45) / 14, 2.2);
        var y1 = hy + (H - hy) * p1, y2 = hy + (H - hy) * p2;
        var w1 = 0.4 + 5 * p1, w2 = 0.4 + 5 * p2;
        s.push('<path d="M' + f(vx - w1 / 2) + " " + f(y1) + " L" + f(vx + w1 / 2) + " " + f(y1) + " L" + f(vx + w2 / 2) + " " + f(y2) + " L" + f(vx - w2 / 2) + " " + f(y2) + ' Z" fill="hsl(42 95% 70%)" opacity=".85"/>');
      }
      // streetlights
      for (var j = 1; j <= 6; j++) {
        var p = Math.pow(j / 6, 1.8);
        var y = hy + (H - hy) * p;
        var sides = [-1, 1];
        for (var q = 0; q < 2; q++) {
          var side = sides[q];
          if (R() > 0.85) continue;
          var x0 = vx + side * (12 + 250 * p);
          var ph = 8 + 120 * p;
          s.push('<path d="M' + f(x0) + " " + f(y) + " L" + f(x0) + " " + f(y - ph) + " L" + f(x0 - side * ph * 0.18) + " " + f(y - ph) + '" stroke="' + hsl(h, 30, 3) + '" stroke-width="' + f(0.6 + 3 * p) + '" fill="none"/>');
          s.push('<circle cx="' + f(x0 - side * ph * 0.18) + '" cy="' + f(y - ph + 2) + '" r="' + f(4 + 28 * p) + '" fill="url(#' + id + 'l)"/>');
        }
      }
      // tail lights
      var tp = 0.12 + R() * 0.2, ty = hy + (H - hy) * tp, tx = vx - 8 - 60 * tp;
      s.push('<circle cx="' + f(tx - 3) + '" cy="' + f(ty) + '" r="3.5" fill="url(#' + id + 'r)"/><circle cx="' + f(tx + 3) + '" cy="' + f(ty) + '" r="3.5" fill="url(#' + id + 'r)"/>');
    }
    function drawMountain() {
      // moon
      var mx = 80 + R() * 240, my = 50 + R() * 40;
      s.push('<circle cx="' + f(mx) + '" cy="' + f(my) + '" r="40" fill="url(#' + id + 'g)" opacity=".7"/><circle cx="' + f(mx) + '" cy="' + f(my) + '" r="13" fill="#fbf2e1"/>');
      var layers = [[hy - 70, 26, 22], [hy - 30, 15, 13], [hy + 10, 8, 7]];
      for (var L = 0; L < layers.length; L++) {
        var base = layers[L][0], light = layers[L][1];
        var d = "M0 " + H + " L0 " + f(base + R() * 30);
        for (var x = 0; x <= W; x += 20) d += " L" + x + " " + f(base + Math.sin(x / (40 + L * 15) + R()) * (22 - L * 4) - R() * (30 - L * 6) + L * 8);
        s.push('<path d="' + d + " L" + W + " " + H + ' Z" fill="' + hsl(h, 32, light * 0.5) + '"/>');
        if (L === 0) bokehRow(base + 20, 6, 8);
      }
      // sea of clouds
      s.push('<ellipse cx="200" cy="' + f(hy - 18) + '" rx="260" ry="10" fill="#fbf7f0" opacity=".08"/>');
      // winding road with headlights
      var rd = "M" + f(40 + R() * 60) + " " + H + " C 150 " + (H - 40) + ", 330 " + (H - 30) + ", 260 " + (hy + 40) + " S 170 " + (hy + 22) + ", 220 " + (hy + 12);
      s.push('<path d="' + rd + '" stroke="' + hsl(h, 20, 3) + '" stroke-width="9" fill="none" stroke-linecap="round"/>');
      s.push('<path d="' + rd + '" stroke="hsl(42 95% 70%)" stroke-width="1.4" stroke-dasharray="5 7" fill="none" opacity=".8"/>');
      s.push('<circle cx="262" cy="' + (hy + 40) + '" r="10" fill="url(#' + id + 'l)"/>');
      // pines
      for (var t = 0; t < 14; t++) {
        var px = R() * W, py = H - R() * 40, ps = 10 + R() * 24;
        s.push('<path d="M' + f(px) + " " + f(py - ps) + " L" + f(px + ps * 0.3) + " " + f(py) + " L" + f(px - ps * 0.3) + " " + f(py) + ' Z" fill="' + hsl(h, 30, 3) + '"/>');
      }
    }
    function drawCity() {
      // skyline
      var x = -10;
      var lit = [];
      while (x < W) {
        var bw = 16 + R() * 30, bh = 40 + R() * 120;
        var top = hy - bh;
        s.push('<rect x="' + f(x) + '" y="' + f(top) + '" width="' + f(bw) + '" height="' + f(bh) + '" fill="' + hsl(h, 34, 4 + R() * 5) + '"/>');
        for (var wy = top + 6; wy < hy - 6; wy += 8) {
          for (var wx = x + 3; wx < x + bw - 4; wx += 6) {
            if (R() < 0.28) {
              s.push('<rect x="' + f(wx) + '" y="' + f(wy) + '" width="2.6" height="3.6" fill="hsl(' + (36 + R() * 12) + ' 95% ' + (60 + R() * 25) + '%)" opacity="' + f(0.55 + R() * 0.45) + '"/>');
              if (R() < 0.12) lit.push(wx);
            }
          }
        }
        x += bw + 1 + R() * 3;
      }
      // wet street
      s.push('<rect y="' + hy + '" width="' + W + '" height="' + (H - hy) + '" fill="' + hsl(h, 36, 5) + '"/>');
      for (var i = 0; i < lit.length; i++) {
        s.push('<rect x="' + f(lit[i] - 1) + '" y="' + hy + '" width="' + f(2 + R() * 3) + '" height="' + f(30 + R() * 60) + '" fill="url(#' + id + 'w)" opacity="' + f(0.4 + R() * 0.5) + '"/>');
      }
      s.push('<rect y="' + hy + '" width="' + W + '" height="1.2" fill="hsl(40 95% 70%)" opacity=".35"/>');
      // street lamps along kerb
      for (var j = 0; j < 5; j++) {
        var lx = 20 + j * 92 + R() * 20;
        s.push('<path d="M' + f(lx) + " " + hy + " L" + f(lx) + " " + (hy - 46) + '" stroke="' + hsl(h, 30, 3) + '" stroke-width="2"/>');
        s.push('<circle cx="' + f(lx) + '" cy="' + (hy - 47) + '" r="16" fill="url(#' + id + 'l)"/>');
      }
      // foreground bokeh
      for (var b = 0; b < 9; b++) {
        s.push('<circle cx="' + f(R() * W) + '" cy="' + f(hy + 20 + R() * 70) + '" r="' + f(8 + R() * 22) + '" fill="url(#' + id + (R() > 0.75 ? "r" : "l") + ')" opacity="' + f(0.25 + R() * 0.35) + '"/>');
      }
    }
    function drawCoast() {
      var mx = 230 + R() * 100, my = 60 + R() * 30;
      s.push('<circle cx="' + f(mx) + '" cy="' + f(my) + '" r="48" fill="url(#' + id + 'g)" opacity=".7"/><circle cx="' + f(mx) + '" cy="' + f(my) + '" r="16" fill="#fbf2e1"/>');
      // islands
      s.push('<path d="M20 ' + hy + " Q 70 " + (hy - 26) + " 130 " + hy + ' Z" fill="' + hsl(h, 30, 7) + '"/>');
      s.push('<path d="M150 ' + hy + " Q 180 " + (hy - 12) + " 215 " + hy + ' Z" fill="' + hsl(h, 30, 9) + '"/>');
      // sea
      s.push('<rect y="' + hy + '" width="' + W + '" height="' + (H - hy) + '" fill="' + hsl(h, 40, 7) + '"/>');
      for (var i = 0; i < 26; i++) {
        var yy = hy + 4 + Math.pow(i / 26, 1.4) * (H - hy - 10);
        var ww = 6 + i * 2.2 + R() * 10;
        s.push('<rect x="' + f(mx - ww / 2 + (R() - 0.5) * 10) + '" y="' + f(yy) + '" width="' + f(ww) + '" height="1.4" rx=".7" fill="#fbf2e1" opacity="' + f(0.7 - i * 0.022) + '"/>');
      }
      // cliff + coastal road (viaduct)
      s.push('<path d="M0 ' + (hy + 20) + " C 60 " + (hy + 10) + ", 110 " + (hy + 40) + ", 150 " + H + " L0 " + H + ' Z" fill="' + hsl(h, 28, 3) + '"/>');
      var road = "M-10 " + (hy + 62) + " C 120 " + (hy + 40) + ", 260 " + (hy + 70) + ", 410 " + (hy + 56);
      s.push('<path d="' + road + '" stroke="' + hsl(h, 20, 3) + '" stroke-width="6" fill="none"/>');
      for (var k = 0; k < 9; k++) {
        var px = 30 + k * 46;
        s.push('<path d="M' + px + " " + (hy + 60) + " L" + px + " " + H + '" stroke="' + hsl(h, 20, 3) + '" stroke-width="3"/>');
        s.push('<circle cx="' + px + '" cy="' + (hy + 48) + '" r="9" fill="url(#' + id + 'l)" opacity=".9"/>');
      }
    }
    function drawDial() {
      s.push('<rect width="' + W + '" height="' + H + '" fill="' + hsl(h, 40, 6) + '" opacity=".72"/>');
      var cx = 200, cy = 170, r = 108;
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 30) + '" fill="url(#' + id + 'g)" opacity=".55"/>');
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 6) + '" fill="' + hsl(h, 35, 4) + '" stroke="' + hsl(warm, 60, 55, 0.35) + '" stroke-width="1.5"/>');
      var start = 135, sweep = 270, ticks = 40;
      for (var i = 0; i <= ticks; i++) {
        var a = ((start + (sweep * i) / ticks) * Math.PI) / 180;
        var big = i % 5 === 0;
        var r1 = r - (big ? 16 : 8), r2 = r - 2;
        var red = i > ticks * 0.8;
        s.push('<line x1="' + f(cx + Math.cos(a) * r1) + '" y1="' + f(cy + Math.sin(a) * r1) + '" x2="' + f(cx + Math.cos(a) * r2) + '" y2="' + f(cy + Math.sin(a) * r2) + '" stroke="' + (red ? "hsl(6 85% 62%)" : "#fbf2e1") + '" stroke-width="' + (big ? 2.4 : 1.1) + '" opacity="' + (big ? 0.95 : 0.6) + '"/>');
        if (big) {
          var rt = r - 30;
          s.push('<text x="' + f(cx + Math.cos(a) * rt) + '" y="' + f(cy + Math.sin(a) * rt + 4) + '" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#fbf2e1" opacity=".7" text-anchor="middle">' + i / 5 + "</text>");
        }
      }
      var val = 0.35 + R() * 0.45;
      var na = ((start + sweep * val) * Math.PI) / 180;
      // glow arc
      var ga0 = (start * Math.PI) / 180;
      var large = sweep * val > 180 ? 1 : 0;
      s.push('<path d="M' + f(cx + Math.cos(ga0) * (r + 14)) + " " + f(cy + Math.sin(ga0) * (r + 14)) + " A " + (r + 14) + " " + (r + 14) + " 0 " + large + " 1 " + f(cx + Math.cos(na) * (r + 14)) + " " + f(cy + Math.sin(na) * (r + 14)) + '" stroke="hsl(40 95% 62%)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>');
      s.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + f(cx + Math.cos(na) * (r - 12)) + '" y2="' + f(cy + Math.sin(na) * (r - 12)) + '" stroke="hsl(6 90% 62%)" stroke-width="3" stroke-linecap="round"/>');
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + hsl(h, 30, 14) + '" stroke="#fbf2e1" stroke-opacity=".4"/>');
      s.push('<text x="' + cx + '" y="' + (cy + 50) + '" font-family="Inter,sans-serif" font-size="9" letter-spacing="3" font-weight="600" fill="#fbf2e1" opacity=".55" text-anchor="middle">RPM × 1000</text>');
    }
  }

  /* ==========================================================================
     RENDER
     ========================================================================== */
  var saved = store.get("hnk.saved", []);
  if (!Array.isArray(saved)) saved = [];
  var activeCat = "All";

  function setText(name, value, html) { slot(name).forEach(function (el) { if (html) el.innerHTML = value; else el.textContent = value; }); }

  function renderStatic() {
    var b = SITE.brand;
    setText("brand-name", b.name);
    setText("brand-tag", b.tagline);
    setText("brand-est", b.est);
    setText("year", String(new Date().getFullYear()));
    setText("address", b.address);

    slot("nav").forEach(function (el) {
      el.innerHTML = SITE.nav.map(function (n) { return '<a href="' + esc(n.href) + '">' + esc(n.label) + "</a>"; }).join("");
    });

    // hero
    var hero = SITE.hero;
    setText("hero-eyebrow", hero.eyebrow);
    setText("hero-title", hero.title, true);
    setText("hero-lead", hero.lead);
    slot("hero-actions")[0].innerHTML =
      '<a class="btn btn--primary" href="' + esc(hero.primary.href) + '"><span>' + esc(hero.primary.label) + "</span>" + icon("arrow") + "</a>" +
      '<button class="btn btn--outline install-btn" type="button" data-action="install">' + icon("download") + "<span>" + esc(hero.secondary.label) + "</span></button>";
    slot("hero-art")[0].innerHTML = art({ scene: "road", hue: 350, seed: 2026 });
    var bokeh = $(".hero__bokeh");
    var R = rng(99), bk = "";
    for (var i = 0; i < 14; i++) {
      var size = 20 + R() * 90;
      bk += '<i style="left:' + f(R() * 100) + "%;top:" + f(20 + R() * 60) + "%;width:" + f(size) + "px;height:" + f(size) + "px;--d:" + f(10 + R() * 14) + "s;--o:" + f(0.15 + R() * 0.35) + ";--x:" + f((R() - 0.5) * 80) + "px;--y:" + f(-20 - R() * 50) + 'px"></i>';
    }
    bokeh.innerHTML = bk;

    var feat = byId(hero.featured.itemId) || SITE.items[0];
    var fEl = slot("hero-featured")[0];
    fEl.setAttribute("role", "button");
    fEl.setAttribute("tabindex", "0");
    fEl.dataset.open = feat.id;
    fEl.innerHTML =
      '<div class="featured__art">' + art(feat.art) + "</div>" +
      "<div><p class=\"featured__label\">" + esc(hero.featured.label) + '</p><p class="featured__title">' + esc(feat.title) + "</p>" +
      '<p class="featured__meta">' + icon("pin") + esc(feat.meta.join(" · ")) + "</p>" +
      '<span class="featured__go">View route ' + icon("arrow") + "</span></div>";

    // intro
    setText("intro-eyebrow", SITE.intro.eyebrow);
    setText("intro-title", SITE.intro.title, true);
    setText("intro-caption", SITE.intro.caption);
    slot("intro-art")[0].innerHTML = art(SITE.intro.art);

    // story
    setText("story-eyebrow", SITE.story.eyebrow);
    setText("story-text", SITE.story.text, true);
    slot("story-art")[0].innerHTML = art(SITE.story.art);

    // proof
    var p = SITE.proof;
    setText("proof-eyebrow", p.eyebrow);
    setText("proof-label", p.metric.label);
    var num = slot("proof-number")[0];
    num.dataset.count = p.metric.value;
    num.textContent = reduceMotion ? p.metric.value.toLocaleString() : "0";
    slot("proof-stars")[0].innerHTML = stars(5);
    slot("proof-stats")[0].innerHTML = p.stats.map(function (st) {
      return '<div><dt><span data-count="' + st.value + '">' + (reduceMotion ? st.value : 0) + "</span>" + esc(st.suffix) + "</dt><dd>" + esc(st.label) + "</dd></div>";
    }).join("");

    // reserve
    var r = SITE.reserve;
    setText("reserve-eyebrow", r.eyebrow);
    setText("reserve-title", r.title);
    setText("reserve-lead", r.lead);
    setText("reserve-primary", r.primary);
    var ph = slot("reserve-phone")[0];
    ph.href = "tel:" + b.phone.replace(/\s/g, "");
    ph.querySelector("span").textContent = b.phone;
    slot("faq")[0].innerHTML = r.faqs.map(function (q) {
      return "<details><summary>" + esc(q.q) + icon("plus") + '</summary><p class="faq__a">' + esc(q.a) + "</p></details>";
    }).join("");

    // closing
    setText("closing-title", SITE.closing.title, true);
    setText("closing-cta", SITE.closing.cta);
    slot("closing-art")[0].innerHTML = art(SITE.closing.art);

    // footer
    setText("footer-blurb", SITE.footer.blurb);
    var cols = SITE.footer.columns.map(function (c) {
      return '<div class="footer__col"><h3>' + esc(c.title) + "</h3><ul>" + c.links.map(function (l) {
        return '<li><a href="' + esc(l[1]) + '"' + (l[2] ? ' data-filter="' + esc(l[2]) + '"' : "") + ">" + esc(l[0]) + "</a></li>";
      }).join("") + "</ul></div>";
    });
    cols.push('<div class="footer__col"><h3>Contact</h3><ul>' +
      '<li><a href="tel:' + esc(b.phone.replace(/\s/g, "")) + '">' + icon("phone") + esc(b.phone) + "</a></li>" +
      '<li><a href="mailto:' + esc(b.email) + '">' + icon("mail") + esc(b.email) + "</a></li>" +
      '<li><a href="#reserve">' + icon("chat") + "Send a request</a></li></ul></div>");
    slot("footer-cols")[0].innerHTML = cols.join("");
  }

  /* ---------- Hub ----------------------------------------------------------- */
  function renderFilters() {
    var el = slot("filters")[0];
    el.innerHTML = SITE.categories.map(function (c) {
      var n = c === "All" ? SITE.items.length : SITE.items.filter(function (it) { return it.category === c; }).length;
      return '<button class="chip" role="tab" type="button" data-cat="' + esc(c) + '" aria-selected="' + (c === activeCat) + '">' + esc(c) + ' <span class="chip__n">' + n + "</span></button>";
    }).join("");
  }
  function cardHTML(it, i) {
    var isSaved = saved.indexOf(it.id) > -1;
    return '<article class="card" style="--i:' + i + '" data-id="' + esc(it.id) + '">' +
      '<div class="card__art">' + art(it.art) +
      '<span class="card__cat">' + esc(it.category) + "</span>" +
      '<button class="save-btn" type="button" data-save="' + esc(it.id) + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? "Remove from saved" : "Save") + ": " + esc(it.title) + '">' + icon(isSaved ? "heart-fill" : "heart") + "</button>" +
      "</div>" +
      '<div class="card__body"><h3 class="card__title">' + esc(it.title) + '</h3><p class="card__sub">' + esc(it.subtitle) + "</p>" +
      '<p class="card__meta"><span>' + it.meta.map(esc).join("</span><span>") + '</span><span class="rating">' + icon("star") + it.rating.toFixed(1) + "</span></p></div>" +
      '<button class="card__open" type="button" data-open="' + esc(it.id) + '" aria-label="View details: ' + esc(it.title) + '"></button>' +
      "</article>";
  }
  function renderGrid() {
    var list = SITE.items.filter(function (it) { return activeCat === "All" || it.category === activeCat; });
    var el = slot("grid")[0];
    el.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : '<div class="empty">' + icon("compass") + "<strong>Nothing here yet</strong>Try another category.</div>";
  }
  function setCategory(cat, scroll) {
    if (SITE.categories.indexOf(cat) < 0) cat = "All";
    activeCat = cat;
    $$(".chip", slot("filters")[0]).forEach(function (c) { c.setAttribute("aria-selected", String(c.dataset.cat === cat)); });
    renderGrid();
    if (scroll) $("#explore").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ---------- Showcase ------------------------------------------------------ */
  var showTab = 0, showItem = 0;
  function renderShowcase() {
    var sc = SITE.showcase;
    setText("showcase-eyebrow", sc.eyebrow);
    setText("showcase-title", sc.title);
    setText("showcase-aside", sc.aside);
    slot("showcase-tabs")[0].innerHTML = sc.tabs.map(function (t, i) {
      return '<button class="tab" role="tab" type="button" data-tab-i="' + i + '" aria-selected="' + (i === showTab) + '">' + esc(t.label) + "</button>";
    }).join("");
    renderShowList();
  }
  function renderShowList() {
    var tab = SITE.showcase.tabs[showTab];
    setText("showcase-note", tab.note);
    slot("showcase-list")[0].innerHTML = tab.items.map(function (r, i) {
      return '<li><button class="route' + (i === showItem ? " is-active" : "") + '" type="button" style="--i:' + i + '" data-route="' + i + '">' +
        '<span class="route__dot"></span><span><span class="route__name">' + esc(r.name) + '</span><span class="route__detail">' + esc(r.detail) + "</span></span>" +
        '<span class="route__aside">' + esc(r.aside) + "</span></button></li>";
    }).join("");
    setShowMedia();
  }
  function setShowMedia() {
    var media = slot("showcase-media")[0];
    var r = SITE.showcase.tabs[showTab].items[showItem];
    var layer = document.createElement("div");
    layer.className = "layer";
    layer.innerHTML = art(r.art) + '<span class="showcase__media-label">' + esc(r.name) + "</span>";
    media.appendChild(layer);
    requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add("is-on"); }); });
    var old = $$(".layer", media).slice(0, -1);
    setTimeout(function () { old.forEach(function (o) { o.remove(); }); }, 900);
  }

  /* ---------- Review deck --------------------------------------------------- */
  var deckOrder = [];
  function renderDeck() {
    var reviews = SITE.proof.reviews;
    deckOrder = reviews.map(function (_, i) { return i; });
    slot("deck")[0].innerHTML = reviews.map(function (rv, i) {
      return '<figure class="review" data-review="' + i + '" aria-roledescription="slide">' +
        '<div class="review__stars" aria-label="' + rv.rating + ' out of 5">' + stars(rv.rating) + "</div>" +
        '<blockquote class="review__quote">“' + esc(rv.quote) + "”</blockquote>" +
        '<figcaption class="review__who"><span class="review__avatar">' + esc(rv.name.charAt(0)) + "</span><span><span class=\"review__name\">" + esc(rv.name) + '</span><br><span class="review__role">' + esc(rv.role) + "</span></span></figcaption></figure>";
    }).join("");
    layoutDeck();
  }
  var deckPos = [
    "translate3d(0,0,0) rotate(0deg)",
    "translate3d(26px,10px,0) rotate(5deg)",
    "translate3d(-24px,14px,0) rotate(-6deg)",
    "translate3d(38px,22px,0) rotate(9deg)",
    "translate3d(-36px,26px,0) rotate(-10deg)",
  ];
  function layoutDeck(dragX) {
    var cards = $$(".review", slot("deck")[0]);
    deckOrder.forEach(function (idx, pos) {
      var c = cards[idx];
      c.style.zIndex = String(50 - pos);
      c.setAttribute("aria-hidden", pos === 0 ? "false" : "true");
      var t = deckPos[Math.min(pos, deckPos.length - 1)];
      if (pos === 0 && dragX) t = "translate3d(" + dragX + "px,0,0) rotate(" + dragX / 18 + "deg)";
      c.style.transform = t;
      c.style.opacity = pos > 3 ? "0" : "1";
    });
    setText("deck-count", "0" + (deckOrder[0] + 1) + " / 0" + deckOrder.length);
  }
  function nextReview() { deckOrder.push(deckOrder.shift()); layoutDeck(); }
  function bindDeck() {
    var deck = slot("deck")[0];
    var startX = null, dx = 0, moved = false;
    deck.addEventListener("pointerdown", function (e) {
      var top = e.target.closest(".review");
      if (!top || Number(top.dataset.review) !== deckOrder[0]) return;
      startX = e.clientX; dx = 0; moved = false;
      top.style.transition = "none";
      deck.setPointerCapture && deck.setPointerCapture(e.pointerId);
    });
    deck.addEventListener("pointermove", function (e) {
      if (startX == null) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      layoutDeck(dx);
    });
    function end() {
      if (startX == null) return;
      var top = $$(".review", deck)[deckOrder[0]];
      top.style.transition = "";
      startX = null;
      if (Math.abs(dx) > 70 || !moved) nextReview(); else layoutDeck();
    }
    deck.addEventListener("pointerup", end);
    deck.addEventListener("pointercancel", end);
  }

  /* ==========================================================================
     SAVED ITEMS
     ========================================================================== */
  function updateSavedBadge(bump) {
    slot("saved-count").forEach(function (b) {
      b.textContent = String(saved.length);
      b.hidden = saved.length === 0;
      if (bump) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    });
  }
  function toggleSave(id, btn) {
    var it = byId(id);
    if (!it) return;
    var i = saved.indexOf(id);
    var nowSaved = i < 0;
    if (nowSaved) saved.push(id); else saved.splice(i, 1);
    store.set("hnk.saved", saved);
    $$('[data-save="' + id + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", String(nowSaved));
      b.setAttribute("aria-label", (nowSaved ? "Remove from saved" : "Save") + ": " + it.title);
      b.innerHTML = icon(nowSaved ? "heart-fill" : "heart");
      b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    });
    updateSavedBadge(true);
    toast(nowSaved ? "Saved" : "Removed", nowSaved ? it.title + " is in your list — available offline." : it.title + " was removed.", nowSaved ? "heart-fill" : "heart");
    if (sheetMode === "saved") openSaved(true);
  }

  /* ==========================================================================
     SHEET (modal / slide-over)
     ========================================================================== */
  var sheet = $("#sheet");
  var panel = $(".sheet__panel", sheet);
  var sheetBody = slot("sheet-body")[0];
  var sheetMode = null;
  var lastFocus = null;

  function openSheet(title, html, mode) {
    sheetMode = mode;
    $("#sheet-title").textContent = title;
    sheetBody.innerHTML = html;
    sheetBody.scrollTop = 0;
    if (sheet.hidden) {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      document.body.classList.add("is-locked");
      requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add("is-open"); }); });
    }
    setTimeout(function () {
      var target = $("[autofocus]", sheetBody) || panel;
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }, 60);
    setBottomTab(mode === "saved" ? "saved" : mode === "install" ? "app" : null);
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove("is-open");
    sheet.style.removeProperty("--drag");
    sheetMode = null;
    document.body.classList.remove("is-locked");
    setTimeout(function () { if (!sheet.classList.contains("is-open")) { sheet.hidden = true; sheetBody.innerHTML = ""; } }, 420);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    if (location.search.indexOf("item=") > -1) history.replaceState(null, "", location.pathname + location.hash);
    setBottomTab(currentSection);
  }
  // focus trap + Esc
  document.addEventListener("keydown", function (e) {
    if (sheet.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key === "Tab") {
      var f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', panel).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // drag handle to close (mobile)
  (function () {
    var handle = $(".sheet__handle", sheet), y0 = null, dy = 0;
    handle.addEventListener("pointerdown", function (e) { y0 = e.clientY; dy = 0; sheet.classList.add("is-dragging"); handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove", function (e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.setProperty("--drag", dy + "px"); });
    function up() { if (y0 == null) return; y0 = null; sheet.classList.remove("is-dragging"); if (dy > 110) closeSheet(); else sheet.style.removeProperty("--drag"); }
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  })();

  function openItem(id) {
    var it = byId(id);
    if (!it) return;
    var isSaved = saved.indexOf(id) > -1;
    var html =
      '<div class="detail__art">' + art(it.art) + "</div>" +
      '<div class="detail__meta"><span class="pill pill--accent">' + esc(it.category) + '</span><span class="pill">' + icon("star") + it.rating.toFixed(1) + "</span>" +
      it.meta.map(function (m) { return '<span class="pill">' + esc(m) + "</span>"; }).join("") + "</div>" +
      '<p class="detail__sub">' + esc(it.subtitle) + "</p>" +
      '<p class="detail__desc">' + esc(it.description) + "</p>" +
      '<ul class="detail__list">' + it.highlights.map(function (h) { return "<li>" + icon("check") + "<span>" + esc(h) + "</span></li>"; }).join("") + "</ul>" +
      '<div class="detail__actions">' +
      '<button class="btn btn--primary" type="button" data-action="inquire" data-item="' + esc(id) + '"><span>Inquire</span>' + icon("arrow") + "</button>" +
      '<button class="icon-btn" type="button" data-save="' + esc(id) + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? "Remove from saved" : "Save") + '">' + icon(isSaved ? "heart-fill" : "heart") + "</button>" +
      '<button class="icon-btn" type="button" data-share="' + esc(id) + '" aria-label="Share">' + icon("share") + "</button>" +
      "</div>";
    openSheet(it.title, html, "item");
    history.replaceState(null, "", "?item=" + encodeURIComponent(id) + location.hash);
  }

  function miniHTML(it, i, q, removable) {
    var title = esc(it.title);
    if (q) title = title.replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    return '<div class="mini" style="--i:' + i + '">' +
      '<div class="mini__art">' + art(it.art) + "</div>" +
      '<button type="button" data-open="' + esc(it.id) + '" style="text-align:left"><span class="mini__title">' + title + '</span><span class="mini__meta">' + esc(it.category) + " · " + esc(it.meta[0]) + "</span></button>" +
      (removable
        ? '<button class="icon-btn" type="button" data-save="' + esc(it.id) + '" aria-pressed="true" aria-label="Remove ' + esc(it.title) + '">' + icon("close") + "</button>"
        : '<button class="icon-btn" type="button" data-open="' + esc(it.id) + '" aria-label="Open ' + esc(it.title) + '">' + icon("arrow") + "</button>") +
      "</div>";
  }

  function openSaved(refresh) {
    var items = saved.map(byId).filter(Boolean);
    var html = items.length
      ? '<p class="section-lead" style="font-size:.95rem;margin-bottom:16px">' + items.length + " saved · stored on this device and available offline.</p>" +
        '<div class="mini-list">' + items.map(function (it, i) { return miniHTML(it, i, "", true); }).join("") + "</div>"
      : '<div class="sheet-empty">' + icon("heart") + "<strong>No saved items yet</strong>Tap the heart on any card to keep it here — even when you're offline." +
        '<div><a class="btn btn--primary" href="#explore" data-action="close-sheet"><span>Explore the hub</span>' + icon("arrow") + "</a></div></div>";
    if (refresh && !sheet.hidden) { sheetBody.innerHTML = html; return; }
    openSheet("Saved", html, "saved");
  }

  function openSearch() {
    var html =
      '<div class="search-field">' + icon("search") + '<input class="input" type="search" id="search-input" placeholder="Search rides, routes, gear…" autocomplete="off" autofocus aria-label="Search"></div>' +
      '<div class="search-hints">' + SITE.categories.filter(function (c) { return c !== "All"; }).map(function (c) {
        return '<button class="chip" type="button" data-hint="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("") + "</div>" +
      '<div class="mini-list" id="search-results"></div>';
    openSheet("Search", html, "search");
    var input = $("#search-input");
    var run = function () { renderResults(input.value.trim()); };
    input.addEventListener("input", run);
    run();
  }
  function renderResults(q) {
    var out = $("#search-results");
    if (!out) return;
    var ql = q.toLowerCase();
    var hits = SITE.items.filter(function (it) {
      if (!ql) return true;
      return [it.title, it.subtitle, it.category, it.description, it.meta.join(" ")].join(" ").toLowerCase().indexOf(ql) > -1;
    });
    out.innerHTML = hits.length
      ? hits.map(function (it, i) { return miniHTML(it, i, q, false); }).join("")
      : '<div class="sheet-empty">' + icon("search") + "<strong>No matches</strong>Try “Baguio”, “jeepney” or “jacket”.</div>";
  }

  function openInquiry(itemId) {
    var it = itemId ? byId(itemId) : null;
    var opts = SITE.categories.filter(function (c) { return c !== "All"; }).concat(["Something else"]);
    var html =
      '<form class="form" id="inquiry" novalidate>' +
      '<p class="section-lead" style="font-size:.98rem">' + esc(SITE.reserve.lead) + "</p>" +
      '<div class="field"><label for="f-name">Your name</label><input class="input" id="f-name" name="name" autocomplete="name" required autofocus placeholder="Juan dela Cruz"><span class="field__error">Please add your name.</span></div>' +
      '<div class="field"><label for="f-contact">Email or mobile</label><input class="input" id="f-contact" name="contact" autocomplete="email" required placeholder="you@email.com or 09xx…"><span class="field__error">How can we reach you?</span></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="f-type">Interested in</label><select class="input" id="f-type" name="type">' + opts.map(function (o) { return "<option" + (it && it.category === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="f-date">Preferred date</label><input class="input" id="f-date" name="date" type="date"></div>' +
      "</div>" +
      '<div class="field"><label for="f-msg">Message</label><textarea class="input" id="f-msg" name="message" placeholder="Tell us about your ride…">' + (it ? "I'm interested in: " + esc(it.title) + "\n" : "") + "</textarea></div>" +
      '<label class="switch"><span class="switch__text">Send me road updates<small>New routes and garage slots, once a month.</small></span><input type="checkbox" name="updates" checked><span class="switch__ui"></span></label>' +
      '<button class="btn btn--primary btn--block" type="submit"><span>Send request</span>' + icon("arrow") + "</button>" +
      '<p class="form__note">' + (SITE.forms.endpoint ? "We usually reply within a day." : "Demo mode — requests are kept on this device until a form service is connected.") + "</p>" +
      "</form>";
    openSheet(it ? "Inquire" : "Sumakay — send a request", html, "inquiry");
    $("#inquiry").addEventListener("submit", submitInquiry);
  }
  function submitInquiry(e) {
    e.preventDefault();
    var form = e.target, ok = true;
    ["name", "contact"].forEach(function (n) {
      var input = form.elements[n], field = input.closest(".field");
      var bad = !input.value.trim();
      field.classList.toggle("is-invalid", bad);
      if (bad && ok) { input.focus(); ok = false; }
    });
    if (!ok) return;
    var btn = form.querySelector('[type="submit"]');
    var label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader" aria-hidden="true"></span><span>Sending…</span>';
    var data = {
      name: form.elements.name.value.trim(), contact: form.elements.contact.value.trim(),
      type: form.elements.type.value, date: form.elements.date.value,
      message: form.elements.message.value.trim(), updates: form.elements.updates.checked, at: new Date().toISOString(),
    };
    var done = function (sent) {
      btn.disabled = false; btn.innerHTML = label;
      if (!sent) { var list = store.get("hnk.inquiries", []); list.push(data); store.set("hnk.inquiries", list); }
      closeSheet();
      toast("Salamat, " + data.name.split(" ")[0] + "!", "Your request is in. We'll reach you at " + data.contact + ".", "check");
    };
    if (SITE.forms.endpoint) {
      fetch(SITE.forms.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { done(r.ok); })
        .catch(function () { done(false); });
    } else {
      setTimeout(function () { done(false); }, 900);
    }
  }

  function share(id) {
    var it = byId(id);
    var url = location.origin + location.pathname + "?item=" + encodeURIComponent(id);
    if (navigator.share) {
      navigator.share({ title: it.title + " — " + SITE.brand.name, text: it.subtitle, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied", "Paste it anywhere to share.", "check"); }, function () { toast("Share link", url, "share"); });
    } else {
      toast("Share link", url, "share");
    }
  }

  /* ==========================================================================
     TOASTS
     ========================================================================== */
  function toast(title, text, ic) {
    var wrap = $(".toasts");
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.innerHTML = '<span class="toast__icon">' + icon(ic || "crown") + "</span><div><strong>" + esc(title) + "</strong><span>" + esc(text) + "</span></div>";
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(function () { t.classList.add("is-leaving"); setTimeout(function () { t.remove(); }, 360); }, 3200);
  }

  /* ==========================================================================
     THEME
     ========================================================================== */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var sw = $('[data-action="theme"]');
    sw.setAttribute("aria-checked", String(t === "dark"));
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#1c0a0f" : "#f4ecdf");
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("hnk.theme", next); } catch (e) {}
  }

  /* ==========================================================================
     INSTALL (PWA) — "download" the app to home screen / desktop
     ========================================================================== */
  var deferredPrompt = null;
  var isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(ua);

  function markInstalled() {
    document.documentElement.classList.add("is-installed");
    $$(".install-tab span").forEach(function (s) { s.textContent = "App"; });
  }
  if (isStandalone) markInstalled();

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    markInstalled();
    closeSheet();
    toast("Installed!", SITE.brand.name + " is now on your device.", "check");
  });

  function install() {
    if (deferredPrompt && !isStandalone) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice.outcome !== "accepted") toast("Maybe later", "You can install anytime from the menu.", "download");
        deferredPrompt = null;
      });
      return;
    }
    openInstallGuide();
  }
  function openInstallGuide() {
    var platform = isIOS ? "ios" : isAndroid ? "android" : "desktop";
    var guides = {
      android: [
        "Open this site in <b>Chrome</b>.",
        "Tap the menu " + icon("dots") + " in the top-right corner.",
        "Choose <b>Install app</b> or <b>Add to Home screen</b>.",
        "Open <b>" + esc(SITE.brand.short) + "</b> from your home screen — it runs full-screen like a native app.",
      ],
      ios: [
        "Open this site in <b>Safari</b>.",
        "Tap the Share button " + icon("ios-share") + " at the bottom of the screen.",
        "Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.",
        "Open <b>" + esc(SITE.brand.short) + "</b> from your home screen.",
      ],
      desktop: [
        "Open this site in <b>Chrome</b> or <b>Edge</b>.",
        "Click the install icon " + icon("download") + " at the right end of the address bar.",
        "Click <b>Install</b>. The app gets its own window and a desktop / Start-menu shortcut.",
      ],
    };
    var tabs = [["android", "Android"], ["ios", "iPhone"], ["desktop", "Desktop"]];
    var html =
      (isStandalone ? '<div class="installed-note">' + icon("check") + "You're using the installed app.</div>" : "") +
      '<div class="install-hero"><img class="install-hero__icon" src="icons/icon-192.png" alt="" width="84" height="84">' +
      "<p>Get " + esc(SITE.brand.name) + " on your phone or computer — free, tiny, and it works offline.</p></div>" +
      (deferredPrompt ? '<button class="btn btn--primary btn--block" type="button" data-action="install-now" style="margin-bottom:20px">' + icon("download") + "<span>Install now</span></button>" : "") +
      '<div class="seg" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" data-guide="' + t[0] + '" aria-selected="' + (t[0] === platform) + '">' + t[1] + "</button>";
      }).join("") + "</div>" +
      Object.keys(guides).map(function (k) {
        return '<ol class="steps" data-guide-panel="' + k + '"' + (k === platform ? "" : " hidden") + ">" + guides[k].map(function (s) { return "<li><p>" + s + "</p></li>"; }).join("") + "</ol>";
      }).join("") +
      '<p class="form__note">Installing adds an icon to your device. No app store needed and it updates itself automatically.</p>';
    openSheet("Install the app", html, "install");
  }

  /* ==========================================================================
     SCROLL: app bar, reveal, counters, active section
     ========================================================================== */
  var appbar = $("#appbar");
  var bottombar = $(".bottombar");
  var lastY = window.scrollY;
  var currentSection = "home";
  function onScroll() {
    var y = window.scrollY;
    appbar.classList.toggle("is-solid", y > 40);
    // hide bottom bar while scrolling down fast, show when scrolling up
    if (Math.abs(y - lastY) > 8) {
      bottombar.classList.toggle("is-hidden", y > lastY && y > 400 && sheet.hidden);
      lastY = y;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setBottomTab(name) {
    $$(".bottombar__item").forEach(function (b) { b.classList.toggle("is-active", b.dataset.tab === name); });
  }

  function countUp(el) {
    var target = Number(el.dataset.count);
    if (!target || reduceMotion) { el.textContent = target.toLocaleString(); return; }
    var t0 = null, dur = 1600;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setupObservers() {
    if (!("IntersectionObserver" in window)) {
      $$("[data-reveal]").forEach(function (el) { el.classList.add("is-in"); });
      $$("[data-count]").forEach(countUp);
      return;
    }
    // stagger siblings
    $$("[data-reveal]").forEach(function (el) {
      var sibs = $$(":scope > [data-reveal]", el.parentElement);
      el.style.setProperty("--rd", Math.min(sibs.indexOf(el), 5) * 90 + "ms");
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        $$("[data-count]", en.target).forEach(function (c) { if (!c.dataset.done) { c.dataset.done = "1"; countUp(c); } });
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    $$("[data-reveal]").forEach(function (el) { io.observe(el); });

    var navLinks = $$(".appbar__nav a");
    var map = { home: "home", intro: "home", explore: "explore", routes: "explore", story: "home", proof: "home", reserve: "home" };
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        currentSection = map[id] || "home";
        if (sheet.hidden) setBottomTab(currentSection);
        navLinks.forEach(function (a) { a.classList.toggle("is-current", a.getAttribute("href") === "#" + id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main > section[id]").forEach(function (s) { so.observe(s); });
  }

  /* ==========================================================================
     EVENTS (single delegated listener)
     ========================================================================== */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action],[data-open],[data-save],[data-share],[data-cat],[data-tab-i],[data-route],[data-hint],[data-guide],[data-filter]");
    if (!t) return;

    if (t.dataset.save) { e.preventDefault(); e.stopPropagation(); toggleSave(t.dataset.save, t); return; }
    if (t.dataset.share) { share(t.dataset.share); return; }
    if (t.dataset.open) { e.preventDefault(); openItem(t.dataset.open); return; }
    if (t.dataset.cat) { setCategory(t.dataset.cat); t.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" }); return; }
    if (t.dataset.filter) { e.preventDefault(); setCategory(t.dataset.filter, true); return; }
    if (t.dataset.tabI) {
      showTab = Number(t.dataset.tabI); showItem = 0;
      $$(".tab").forEach(function (b) { b.setAttribute("aria-selected", String(b === t)); });
      renderShowList();
      return;
    }
    if (t.dataset.route) {
      showItem = Number(t.dataset.route);
      $$(".route").forEach(function (r) { r.classList.toggle("is-active", r === t); });
      setShowMedia();
      return;
    }
    if (t.dataset.hint) { var inp = $("#search-input"); inp.value = t.dataset.hint; renderResults(t.dataset.hint); inp.focus(); return; }
    if (t.dataset.guide) {
      $$("[data-guide]").forEach(function (b) { b.setAttribute("aria-selected", String(b === t)); });
      $$("[data-guide-panel]").forEach(function (p) { p.hidden = p.dataset.guidePanel !== t.dataset.guide; });
      return;
    }

    switch (t.dataset.action) {
      case "theme": toggleTheme(); break;
      case "search": openSearch(); break;
      case "saved": openSaved(); break;
      case "install": install(); break;
      case "install-now": install(); break;
      case "inquire": openInquiry(t.dataset.item); break;
      case "deck-next": nextReview(); break;
      case "close-sheet": closeSheet(); break;
    }
  });
  // featured card keyboard
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".featured")) { e.preventDefault(); openItem(e.target.dataset.open); }
    if (!sheet.hidden) return;
    var typing = /input|textarea|select/i.test((e.target.tagName || "")) || e.target.isContentEditable;
    if (!typing && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) { e.preventDefault(); openSearch(); }
  });
  // close sheet when a link inside it navigates to a section
  sheet.addEventListener("click", function (e) { var a = e.target.closest('a[href^="#"]'); if (a) closeSheet(); });

  /* ---------- Online / offline indicator ----------------------------------- */
  function netStatus() {
    var el = slot("net-status")[0];
    if (!el) return;
    var off = navigator.onLine === false;
    el.classList.toggle("is-offline", off);
    el.textContent = off ? "Offline — showing saved copy" : "Works offline";
  }
  window.addEventListener("online", function () { netStatus(); toast("Back online", "You're connected again.", "check"); });
  window.addEventListener("offline", function () { netStatus(); toast("You're offline", "No problem — the app still works.", "crown"); });

  /* ==========================================================================
     BOOT
     ========================================================================== */
  renderStatic();
  renderFilters();
  renderGrid();
  renderShowcase();
  renderDeck();
  bindDeck();
  updateSavedBadge();
  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  netStatus();
  setupObservers();

  // deep link: ?item=id
  var m = location.search.match(/[?&]item=([^&]+)/);
  if (m) setTimeout(function () { openItem(decodeURIComponent(m[1])); }, 400);

  // service worker for offline + installability
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", function () {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              toast("Update ready", "Reload to get the newest version.", "download");
            }
          });
        });
      }).catch(function () {});
    });
  }
})();
