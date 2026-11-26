/* ==========================================================================
   TARA — core utilities: DOM helpers, storage, formatting, icons,
   toasts, bottom sheets, hash router, generated place art.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA;

  /* ---------- DOM ---------- */
  T.$ = function (s, r) { return (r || document).querySelector(s); };
  T.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  T.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  T.icon = function (id, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  T.reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Storage (safe in private mode) ---------- */
  T.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------- Formatting ---------- */
  T.peso = function (n, opts) {
    if (n == null || isNaN(n)) return "—";
    var v = Math.round(n * 100) / 100;
    var whole = Math.abs(v - Math.round(v)) < 0.005;
    return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: whole && !(opts && opts.cents) ? 0 : 2, maximumFractionDigits: 2 });
  };
  T.km = function (k) { return k < 1 ? Math.round(k * 1000) + " m" : (k < 10 ? k.toFixed(1) : Math.round(k)) + " km"; };
  T.dur = function (min) {
    min = Math.round(min);
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  };
  T.time = function (d) {
    return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
  };
  T.date = function (d, long) {
    return d.toLocaleDateString("en-PH", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  };
  T.addMin = function (d, m) { return new Date(d.getTime() + m * 60000); };
  T.hm = function (s) { var p = String(s).split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); };
  T.pad = function (n) { return (n < 10 ? "0" : "") + n; };
  T.isoDate = function (d) { return d.getFullYear() + "-" + T.pad(d.getMonth() + 1) + "-" + T.pad(d.getDate()); };
  T.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  T.initials = function (name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); };
  T.greeting = function () {
    var h = new Date().getHours();
    return h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabi";
  };

  T.stars = function (r, size) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      var cls = r >= i - 0.25 ? "on" : r >= i - 0.75 ? "half" : "off";
      out += '<svg class="star ' + cls + '" aria-hidden="true"' + (size ? ' style="width:' + size + "px;height:" + size + 'px"' : "") + '><use href="#i-star"/></svg>';
    }
    return '<span class="stars" aria-label="' + (r ? r.toFixed(1) : 0) + ' out of 5">' + out + "</span>";
  };

  T.cat = function (id) {
    var c = T.config.categories.filter(function (x) { return x.id === id; })[0];
    return c || { id: "other", label: "Place", short: "Place", icon: "pin" };
  };

  /* ---------- Generated place art (used when no photo is available) ---------- */
  var catHue = { food: 22, cafe: 28, mall: 262, park: 150, heritage: 40, museum: 335, church: 215, resort: 188, theme: 340, market: 36, other: 175 };
  T.art = function (place, opts) {
    var c = T.cat(place.cat);
    var h = catHue[c.id] == null ? 175 : catHue[c.id];
    var seed = 0, name = place.name || place.id || "x";
    for (var i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
    var a = seed % 360, b = (seed >> 3) % 70;
    var id = "a" + seed.toString(36) + (opts && opts.k ? opts.k : "");
    return '<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ' 55% 38%)"/><stop offset="1" stop-color="hsl(' + ((h + 30) % 360) + ' 60% 22%)"/></linearGradient></defs>' +
      '<rect width="400" height="260" fill="url(#' + id + ')"/>' +
      [0, 1, 2, 3, 4].map(function (k) {
        return '<path d="M-20 ' + (60 + k * 46 + (b % 20)) + ' C 100 ' + (20 + k * 50) + ', 220 ' + (120 + k * 38) + ', 420 ' + (40 + k * 52 + (a % 30)) + '" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="2"/>';
      }).join("") +
      '<circle cx="' + (300 + (a % 60)) + '" cy="' + (50 + (b % 40)) + '" r="60" fill="#fff" opacity=".06"/>' +
      '<g transform="translate(168 98)" color="#fff" opacity=".9"><svg width="64" height="64"><use href="#i-' + c.icon + '"/></svg></g>' +
      "</svg>";
  };

  /* ---------- Toasts ---------- */
  T.toast = function (title, text, icon, tone) {
    var wrap = T.$(".toasts");
    var el = document.createElement("div");
    el.className = "toast" + (tone ? " toast--" + tone : "");
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="toast__icon">' + T.icon(icon || "check") + "</span><div><strong>" + T.esc(title) + "</strong>" + (text ? "<span>" + T.esc(text) + "</span>" : "") + "</div>";
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(function () { el.classList.add("is-leaving"); setTimeout(function () { el.remove(); }, 320); }, 3400);
  };

  /* ---------- Bottom sheet / slide-over ---------- */
  var sheetEl, lastFocus, onClose;
  T.sheet = {
    open: function (title, html, opts) {
      sheetEl = sheetEl || T.$("#sheet");
      opts = opts || {};
      T.$(".sheet__title", sheetEl).textContent = title;
      var body = T.$(".sheet__body", sheetEl);
      body.innerHTML = html;
      body.scrollTop = 0;
      sheetEl.dataset.size = opts.size || "";
      onClose = opts.onClose || null;
      if (sheetEl.hidden) {
        lastFocus = document.activeElement;
        sheetEl.hidden = false;
        document.body.classList.add("is-locked");
        requestAnimationFrame(function () { requestAnimationFrame(function () { sheetEl.classList.add("is-open"); }); });
      }
      setTimeout(function () {
        var f = T.$("[autofocus]", body) || T.$(".sheet__panel", sheetEl);
        try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
      }, 80);
      return body;
    },
    close: function () {
      if (!sheetEl || sheetEl.hidden) return;
      sheetEl.classList.remove("is-open");
      sheetEl.style.removeProperty("--drag");
      document.body.classList.remove("is-locked");
      var cb = onClose; onClose = null;
      setTimeout(function () { if (!sheetEl.classList.contains("is-open")) { sheetEl.hidden = true; T.$(".sheet__body", sheetEl).innerHTML = ""; } }, 380);
      if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
      if (cb) cb();
    },
    isOpen: function () { return sheetEl && !sheetEl.hidden; },
  };

  /* ---------- Hash router: #/route/param?x=y ---------- */
  T.router = {
    routes: {},
    on: function (name, fn) { this.routes[name] = fn; },
    parse: function () {
      var h = location.hash.replace(/^#\/?/, "");
      var q = {}, qi = h.indexOf("?");
      if (qi > -1) {
        h.slice(qi + 1).split("&").forEach(function (kv) { if (!kv) return; var p = kv.split("="); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); });
        h = h.slice(0, qi);
      }
      var parts = h.split("/").filter(Boolean);
      return { name: parts[0] || "home", param: parts[1] ? decodeURIComponent(parts[1]) : null, query: q };
    },
    go: function (path, replace) {
      var url = "#/" + path.replace(/^#?\/?/, "");
      if (replace) { history.replaceState(null, "", url); this.resolve(); }
      else if (location.hash === url) this.resolve();
      else location.hash = url; // fires hashchange → resolve
    },
    resolve: function () {
      var r = this.parse();
      var fn = this.routes[r.name] || this.routes.notfound;
      if (this.guard) { var redirect = this.guard(r); if (redirect) { this.go(redirect, true); return; } }
      T.sheet.close();
      fn(r);
    },
  };
})();
