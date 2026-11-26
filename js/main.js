/* ==========================================================================
   TARA — boot: routes, auth guard, event delegation, trips & favorites
   storage, reminders, theme, install (PWA) and service worker.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, $ = T.$, $$ = T.$$;

  /* ---------- Trips & favorites (per user) ---------- */
  T.trips = {
    raw: function () { return T.data.get("trips", []); },
    all: function () { return this.raw().map(function (t) { return T.planner.unpack(t); }); },
    get: function (id) { return this.all().filter(function (t) { return t.id === id; })[0] || null; },
    save: function (plan) {
      var list = this.raw().filter(function (t) { return t.id !== plan.id; });
      var packed = T.planner.pack(plan);
      packed.savedAt = Date.now();
      packed.done = packed.done || {};
      list.push(packed);
      T.data.set("trips", list);
      updateBadge();
      return T.planner.unpack(packed);
    },
    update: function (trip) {
      var packed = T.planner.pack(trip);
      T.data.set("trips", this.raw().map(function (t) { return t.id === trip.id ? packed : t; }));
    },
    remove: function (id) { T.data.set("trips", this.raw().filter(function (t) { return t.id !== id; })); updateBadge(); },
    next: function () {
      var now = Date.now();
      return this.all().filter(function (t) { return T.planner.endTime(t) >= now; })
        .sort(function (a, b) { return new Date(a.option.depart) - new Date(b.option.depart); })[0] || null;
    },
  };
  T.favs = {
    list: function () { return T.data.get("favs", []); },
    has: function (id) { return this.list().indexOf(id) > -1; },
    toggle: function (id) {
      var l = this.list(), i = l.indexOf(id);
      if (i > -1) l.splice(i, 1); else l.push(id);
      T.data.set("favs", l);
      return i < 0;
    },
  };
  function updateBadge() {
    var b = $("[data-trips-badge]");
    if (!b || !T.auth.current()) return;
    var n = T.trips.all().filter(function (t) { return new Date(t.option.depart) > Date.now(); }).length;
    b.textContent = n; b.hidden = !n;
  }

  /* ---------- Theme ---------- */
  T.setTheme = function (t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("tara.theme", t); } catch (e) {}
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#071f21" : "#175153");
  };

  /* ---------- Nav ---------- */
  T.setNav = function (name) {
    $$("[data-nav]").forEach(function (a) {
      var on = a.dataset.nav === name;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  };

  /* ---------- Routes ---------- */
  var R = T.router;
  ["welcome", "login", "signup", "setup", "home", "explore", "city", "place", "plan", "trips", "trip", "live", "profile", "about", "notfound"].forEach(function (n) {
    R.on(n, function (r) { T.views[n](r); });
  });
  var open = { welcome: 1, login: 1, signup: 1 };
  var anyone = { about: 1 };
  R.guard = function (r) {
    var u = T.auth.current();
    if (anyone[r.name]) return null;
    if (!u && !open[r.name]) return "welcome";
    if (u && open[r.name]) return "home";
    return null;
  };
  window.addEventListener("hashchange", function () { R.resolve(); });

  /* ---------- Delegated events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var fn = T.actions[el.dataset.action];
    if (el.dataset.action === "close-sheet") { e.preventDefault(); T.sheet.close(); return; }
    if (el.dataset.action === "install") { e.preventDefault(); install(); return; }
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  ["input", "change"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var el = e.target.closest("[data-input]");
      if (!el) return;
      var name = el.dataset.input;
      // text fields react on input, others on change
      var isText = el.tagName === "INPUT" && /^(text|search|email|password)$/.test(el.type) || el.tagName === "TEXTAREA";
      if ((type === "input") !== isText && !(type === "input" && (el.type === "date" || el.type === "time"))) return;
      var fn = T.inputs[name];
      if (fn) fn(el, e);
    });
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-submit]");
    if (!f) return;
    e.preventDefault();
    var fn = T.submits[f.dataset.submit];
    if (fn) fn(f, e);
  });
  document.addEventListener("keydown", function (e) {
    if (!T.sheet.isOpen()) return;
    if (e.key === "Escape") { T.sheet.close(); return; }
    if (e.key === "Tab") {
      var panel = $(".sheet__panel");
      var f = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea', panel).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  // drag the sheet handle down to close (mobile)
  (function () {
    var sheet = $("#sheet"), handle = $(".sheet__handle", sheet), y0 = null, dy = 0;
    handle.addEventListener("pointerdown", function (e) { y0 = e.clientY; dy = 0; sheet.classList.add("is-dragging"); handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove", function (e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.setProperty("--drag", dy + "px"); });
    var up = function () { if (y0 == null) return; y0 = null; sheet.classList.remove("is-dragging"); if (dy > 110) T.sheet.close(); else sheet.style.removeProperty("--drag"); };
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  })();

  /* ---------- Reminders (while the app is open) ---------- */
  var timers = [];
  T.scheduleReminders = function () {
    timers.forEach(clearTimeout); timers = [];
    if (!T.auth.current()) return;
    var now = Date.now(), horizon = now + 24 * 36e5;
    T.trips.all().filter(function (t) { return t.notify; }).forEach(function (t) {
      (t.reminders || []).forEach(function (r) {
        if (!r.at) return;
        var at = new Date(r.at).getTime();
        if (at <= now || at > horizon) return;
        timers.push(setTimeout(function () { notify("Tara · " + t.name, r.text, t.id); }, at - now));
      });
    });
  };
  function notify(title, body, tripId) {
    T.toast(title, body, "bell");
    if (window.Notification && Notification.permission === "granted" && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, { body: body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "tara-" + tripId + "-" + Date.now(), data: { url: "#/trip/" + tripId } });
      }).catch(function () {});
    }
  }

  /* ---------- Install (PWA) ---------- */
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add("is-installed");
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", function () { deferred = null; document.documentElement.classList.add("is-installed"); T.sheet.close(); T.toast("Tara installed!", "Open it from your home screen.", "check"); });
  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; });
      return;
    }
    var ua = navigator.userAgent || "";
    var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var android = /android/i.test(ua);
    var k = ios ? "ios" : android ? "android" : "desktop";
    var steps = {
      android: ["Open Tara in <b>Chrome</b>.", "Tap the menu <b>⋮</b> at the top right.", "Tap <b>Install app</b> (or <b>Add to Home screen</b>).", "Open <b>Tara</b> from your home screen."],
      ios: ["Open Tara in <b>Safari</b>.", "Tap the <b>Share</b> button " + T.icon("share") + ".", "Choose <b>Add to Home Screen</b>, then <b>Add</b>.", "Open <b>Tara</b> from your home screen."],
      desktop: ["Open Tara in <b>Chrome</b> or <b>Edge</b>.", "Click the install icon " + T.icon("download") + " in the address bar.", "Click <b>Install</b> — Tara opens in its own window."],
    };
    var tabs = [["android", "Android"], ["ios", "iPhone"], ["desktop", "Computer"]];
    T.sheet.open("Install Tara", (standalone ? '<p class="setup-ok">' + T.icon("check") + "<span>You're already using the installed app.</span></p>" : "") +
      '<div class="install-hero"><img src="icons/icon-192.png" alt="" width="76" height="76"><p>Free, light and works offline. No app store needed.</p></div>' +
      '<div class="seg seg--3">' + tabs.map(function (t) { return '<label class="seg__opt"><input type="radio" name="ig" value="' + t[0] + '"' + (t[0] === k ? " checked" : "") + ' data-input="install-tab"><span>' + t[1] + "</span></label>"; }).join("") + "</div>" +
      Object.keys(steps).map(function (key) { return '<ol class="steps" data-guide="' + key + '"' + (key === k ? "" : " hidden") + ">" + steps[key].map(function (s) { return "<li><p>" + s + "</p></li>"; }).join("") + "</ol>"; }).join(""));
  }
  T.inputs["install-tab"] = function (el) { $$("[data-guide]").forEach(function (o) { o.hidden = o.dataset.guide !== el.value; }); };

  /* ---------- Online / offline ---------- */
  window.addEventListener("offline", function () { T.toast("You're offline", "Saved trips and featured places still work.", "info", "warn"); });
  window.addEventListener("online", function () { T.toast("Back online", "Live places and weather are available again.", "check"); });

  /* ---------- Launch screens: loading → K & A Studios → app ---------- */
  (function splash() {
    var el = $("#splash");
    if (!el) return;
    var seen = false;
    try { seen = sessionStorage.getItem("tara.splash") === "1"; } catch (e) {}
    if (seen) { el.remove(); return; }
    try { sessionStorage.setItem("tara.splash", "1"); } catch (e) {}
    var stage = 0, timers = [];
    var go = function (n) {
      if (n <= stage) return;
      stage = n;
      if (n === 1) el.classList.add("is-studio");
      if (n === 2) { el.classList.add("is-out"); timers.push(setTimeout(function () { el.remove(); }, 600)); }
    };
    var fast = T.reduceMotion;
    timers.push(setTimeout(function () { go(1); }, fast ? 600 : 1500));
    timers.push(setTimeout(function () { go(2); }, fast ? 1800 : 3700));
    el.addEventListener("click", function () { go(stage + 1); });
  })();

  /* ---------- Boot ---------- */
  if (!location.hash) history.replaceState(null, "", "#/" + (T.auth.current() ? "home" : "welcome"));
  R.resolve();
  updateBadge();
  // get trips and profile changes made on other phones
  T.sync.boot().then(function (changed) { if (changed) { updateBadge(); R.resolve(); } });
  window.addEventListener("online", function () { T.sync.boot(); });
  T.scheduleReminders();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) T.scheduleReminders(); });

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var nw = reg.installing;
          if (nw) nw.addEventListener("statechange", function () {
            if (nw.state === "installed" && navigator.serviceWorker.controller) T.toast("Update ready", "Reload to get the newest version of Tara.", "download");
          });
        });
      }).catch(function () {});
    });
  }
})();
