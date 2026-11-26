/* ==========================================================================
   TARA — views (screens) and their actions
   Every interactive element uses data-action / data-input / data-submit,
   handled by one delegated listener in main.js.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, $ = T.$, $$ = T.$$, esc = T.esc, icon = T.icon;
  var view = function () { return $("#view"); };
  T.actions = T.actions || {};
  T.inputs = T.inputs || {};
  T.submits = T.submits || {};
  T.state = T.state || { plan: null, explore: { cat: "", q: "", sort: "near", mode: "list" }, nearby: [] };
  T._maps = [];

  /* ======================================================================
     SHARED PIECES
     ====================================================================== */
  function mount(html, opts) {
    T._maps.forEach(function (m) { try { m.remove(); } catch (e) {} });
    T._maps = [];
    var v = view();
    v.className = "view" + (opts && opts.cls ? " " + opts.cls : "");
    v.innerHTML = html;
    window.scrollTo(0, 0);
    T.photos.hydrate(v);
    document.body.classList.toggle("is-auth", !!(opts && opts.auth));
    T.setNav && T.setNav(opts && opts.nav);
    return v;
  }
  function pageHead(title, opts) {
    opts = opts || {};
    return '<header class="phead' + (opts.sticky === false ? "" : " phead--sticky") + '">' +
      (opts.back ? '<button class="icon-btn" type="button" data-action="back" aria-label="Back">' + icon("chev-l") + "</button>" : "") +
      '<div class="phead__title"><h1>' + title + "</h1>" + (opts.sub ? "<p>" + opts.sub + "</p>" : "") + "</div>" +
      (opts.actions || "") + "</header>";
  }
  function avatar(u, size) {
    return '<span class="avatar' + (size ? " avatar--" + size : "") + '">' + esc(T.initials(u ? u.name : "?")) + "</span>";
  }
  function catChip(p) {
    var c = T.cat(p.cat);
    return '<span class="cat cat--' + c.id + '">' + icon(c.icon) + esc(c.short) + "</span>";
  }
  function ratingInline(p) {
    var s = T.places.score(p);
    var n = T.places.reviews(p.id).length;
    if (!s) return '<span class="rating rating--new">' + icon("sparkle") + "New</span>";
    return '<span class="rating">' + icon("star") + s.toFixed(1) + (n ? ' <small>(' + n + ")</small>" : "") + "</span>";
  }
  function photo(p, cls) {
    return '<div class="ph ' + (cls || "") + '" data-photo="' + esc(p.id) + '">' + T.art(p) + "</div>";
  }
  function openBadge(p) {
    var st = T.places.openState(p);
    if (!st.known) return "";
    return '<span class="open ' + (st.open ? "is-open" : "is-closed") + '">' + esc(st.allDay ? "Open 24h" : st.open ? "Open now" : "Closed") + "</span>";
  }
  function placeCard(p, d) {
    return '<a class="pcard" href="#/place/' + encodeURIComponent(p.id) + '">' + photo(p, "pcard__ph") +
      '<div class="pcard__body">' + catChip(p) + '<h3 class="pcard__name">' + esc(p.name) + "</h3>" +
      '<p class="pcard__meta">' + ratingInline(p) + '<span class="dot"></span><span>' + T.km(d) + "</span></p></div></a>";
  }
  function placeRow(p, d) {
    var fee = T.places.fee(p);
    var price = p.price ? "₱".repeat(p.price) : fee.amount === 0 ? "Free" : fee.amount ? T.peso(fee.amount) : "";
    return '<a class="prow" href="#/place/' + encodeURIComponent(p.id) + '">' + photo(p, "prow__ph") +
      '<div class="prow__body"><h3>' + esc(p.name) + "</h3>" +
      '<p class="prow__sub">' + catChip(p) + '<span class="muted">' + esc(p.area || p.address || "") + "</span></p>" +
      '<p class="prow__meta">' + ratingInline(p) + '<span class="dot"></span><span>' + T.km(d) + "</span>" +
      (price ? '<span class="dot"></span><span>' + esc(price) + "</span>" : "") + openBadge(p) + "</p></div>" +
      icon("chev-r", "prow__go") + "</a>";
  }
  function empty(ic, title, text, cta) {
    return '<div class="empty">' + '<span class="empty__ic">' + icon(ic) + "</span><strong>" + esc(title) + "</strong><p>" + esc(text) + "</p>" + (cta || "") + "</div>";
  }
  function loader(text) {
    return '<div class="loader-row"><span class="road-loader" aria-hidden="true"><i></i></span><span>' + esc(text || "Loading…") + "</span></div>";
  }
  T.ui = { placeRow: placeRow, placeCard: placeCard, loader: loader };

  /* ---------- Maps (Leaflet + OpenStreetMap tiles) ---------- */
  var catColor = function (c) { return getComputedStyle(document.documentElement).getPropertyValue("--cat-" + (c || "other")).trim() || "#1d6b6b"; };
  T.maps = {
    make: function (el, center, zoom) {
      if (!el) return null;
      if (!window.L) { el.innerHTML = '<div class="map-off">' + icon("map") + "Map unavailable</div>"; return null; }
      var m = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, tap: true }).setView([center.lat, center.lng], zoom || 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      T._maps.push(m);
      setTimeout(function () { m.invalidateSize(); }, 250);
      return m;
    },
    pin: function (p, label) {
      return L.divIcon({ className: "mpin", iconSize: [34, 40], iconAnchor: [17, 38], popupAnchor: [0, -34],
        html: '<span class="mpin__b" style="--c:' + catColor(p.cat) + '">' + (label != null ? "<b>" + label + "</b>" : '<svg><use href="#i-' + T.cat(p.cat).icon + '"/></svg>') + "</span>" });
    },
    me: function () { return L.divIcon({ className: "mme", iconSize: [22, 22], iconAnchor: [11, 11], html: "<span></span>" }); },
  };

  /* ======================================================================
     LOCATION PICKER (sheet)
     ====================================================================== */
  var pickCb = null, pickTimer = null, pickMode = "location";
  T.pickLocation = function (opts) {
    opts = opts || {};
    pickCb = opts.onPick;
    pickMode = opts.mode || "location"; // "location" | "destination" | "origin"
    var title = pickMode === "destination" ? "Where to?" : pickMode === "origin" ? "Starting point" : "Your location";
    var cur = T.location.get();
    var u = T.auth.current();
    var html =
      '<div class="search-field">' + icon("search") + '<input class="input" id="pick-q" type="search" autocomplete="off" autofocus data-input="pick" placeholder="' +
      (pickMode === "destination" ? "Search a place, e.g. Intramuros" : "e.g. Brgy. Lecheria, Calamba, Laguna") + '"></div>' +
      (pickMode !== "destination" ? '<button class="locate-btn" type="button" data-action="pick-gps">' + icon("locate") + '<span><strong>Use my current location</strong><small>Uses your phone’s GPS</small></span></button>' : "") +
      (pickMode === "origin" && u && u.home ? '<button class="pick-item" type="button" data-action="pick-saved" data-k="home">' + icon("home") + "<span><strong>Home</strong><small>" + esc(u.home.label) + "</small></span></button>" : "") +
      (pickMode === "origin" ? '<button class="pick-item" type="button" data-action="pick-saved" data-k="current">' + icon("pin") + "<span><strong>Current location</strong><small>" + esc(cur.label) + "</small></span></button>" : "") +
      '<div id="pick-results" class="pick-list">' + pickDefaults() + "</div>" +
      '<p class="fine">Address search by OpenStreetMap. Typed addresses are matched to the nearest known spot when offline.</p>';
    T.sheet.open(title, html, { size: "tall" });
  };
  function pickDefaults() {
    if (pickMode !== "destination") return "";
    var here = T.location.get();
    return '<p class="label">Popular destinations</p>' + C.dayTrips.concat(["rizal-shrine", "pansol"]).map(function (id) {
      var p = T.places.get(id);
      return p ? pickPlaceBtn(p, T.geo.distance(here, p)) : "";
    }).join("");
  }
  function pickPlaceBtn(p, d) {
    return '<button class="pick-item" type="button" data-action="pick-place" data-id="' + esc(p.id) + '">' +
      '<span class="pick-ic cat--' + T.cat(p.cat).id + '">' + icon(T.cat(p.cat).icon) + "</span><span><strong>" + esc(p.name) + "</strong><small>" + esc(p.area) + (d != null ? " · " + T.km(d) : "") + "</small></span></button>";
  }
  var lastResults = [];
  T.inputs.pick = function (el) {
    var q = el.value.trim();
    var box = $("#pick-results");
    clearTimeout(pickTimer);
    if (!q) { box.innerHTML = pickDefaults(); return; }
    var here = T.location.get();
    var local = T.places.query({ q: q, near: here }).slice(0, 5);
    var localHtml = local.length ? '<p class="label">Places</p>' + local.map(function (x) { return pickPlaceBtn(x.p, x.d); }).join("") : "";
    box.innerHTML = localHtml + (q.length >= 3 ? loader("Searching addresses…") : "");
    if (q.length < 3) return;
    pickTimer = setTimeout(function () {
      T.geo.search(q).then(function (res) {
        if ($("#pick-q") !== el || el.value.trim() !== q) return;
        lastResults = res;
        var addr = res.length ? '<p class="label">Addresses</p>' + res.map(function (r, i) {
          return '<button class="pick-item" type="button" data-action="pick-addr" data-i="' + i + '">' + icon(r.approx ? "info" : "pin") +
            "<span><strong>" + esc(r.name && r.source !== "approx" ? r.name : r.label) + "</strong><small>" + esc(r.approx ? r.full : r.label) + "</small></span></button>";
        }).join("") : (local.length ? "" : '<p class="fine">No matches. Try adding the city, e.g. “Lecheria, Calamba”.</p>');
        box.innerHTML = localHtml + addr;
      });
    }, 650);
  };
  function finishPick(loc) {
    var cb = pickCb; pickCb = null;
    T.sheet.close();
    if (cb) cb(loc);
  }
  T.actions["pick-place"] = function (el) {
    var p = T.places.get(el.dataset.id);
    finishPick({ name: p.name, label: p.name + ", " + p.area, lat: p.lat, lng: p.lng, placeId: p.id });
  };
  T.actions["pick-addr"] = function (el) {
    var r = lastResults[Number(el.dataset.i)];
    var typed = ($("#pick-q") || {}).value || "";
    var label = r.approx ? typed : r.label;
    finishPick({ name: r.name && !r.approx ? r.name : label.split(",")[0], label: label, lat: r.lat, lng: r.lng, approx: !!r.approx, source: r.source });
  };
  T.actions["pick-saved"] = function (el) {
    var u = T.auth.current();
    var loc = el.dataset.k === "home" ? u.home : T.location.get();
    finishPick(Object.assign({ name: loc.label.split(",")[0] }, loc));
  };
  T.actions["pick-gps"] = function (el) {
    el.disabled = true;
    el.querySelector("small").textContent = "Finding you…";
    T.geo.locate().then(function (loc) {
      loc.name = loc.label.split(",")[0];
      finishPick(loc);
    }).catch(function (err) {
      el.disabled = false;
      el.querySelector("small").textContent = "Uses your phone’s GPS";
      T.toast("Location unavailable", err.message, "info", "warn");
    });
  };
  T.changeLocation = function () {
    T.pickLocation({ mode: "location", onPick: function (loc) {
      T.location.set({ label: loc.label, lat: loc.lat, lng: loc.lng, source: loc.source || "search", approx: !!loc.approx, at: Date.now() });
      T.toast("Location updated", loc.label, "pin");
      T.router.resolve();
    } });
  };
  T.actions["change-location"] = function () { T.changeLocation(); };

  /* ======================================================================
     AUTH SCREENS
     ====================================================================== */
  function authShell(inner) {
    return '<div class="auth">' +
      '<div class="auth__art" aria-hidden="true">' + heroArt() + "</div>" +
      '<div class="auth__card">' + inner + "</div></div>";
  }
  function heroArt() {
    return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb07a"/><stop offset=".55" stop-color="#ff8a5c"/><stop offset="1" stop-color="#f7c77a"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#sky)"/><circle cx="290" cy="120" r="46" fill="#fff4d6" opacity=".9"/>' +
      '<path d="M0 190 Q 60 140 120 170 T 240 160 T 400 150 V300 H0z" fill="#1d6b6b" opacity=".55"/>' +
      '<path d="M0 220 Q 90 170 170 205 T 330 190 T 400 200 V300 H0z" fill="#175153"/>' +
      '<path d="M0 250 Q 120 220 220 245 T 400 235 V300 H0z" fill="#0b2b2d"/>' +
      '<path d="M200 300 C 210 270, 230 255, 260 245" stroke="#fbf5ea" stroke-width="3" stroke-dasharray="8 8" fill="none" opacity=".8"/>' +
      '<g fill="#0b2b2d"><path d="M60 236v-26M54 214l6-12 6 12z"/><rect x="58" y="214" width="4" height="22"/><circle cx="60" cy="206" r="10"/><circle cx="340" cy="226" r="12"/><rect x="338" y="226" width="4" height="18"/></g></svg>';
  }
  function brandBlock() {
    return '<div class="auth__brand"><svg class="logo logo--lg" aria-hidden="true"><use href="#i-logo"/></svg><div><h1>Tara</h1><p>' + esc(C.brand.tagline) + "</p></div></div>";
  }
  T.views = {};

  T.views.welcome = function () {
    mount(authShell(brandBlock() +
      '<h2 class="auth__title">Find places. Plan the commute. <em>Tara na!</em></h2>' +
      '<ul class="feature-list">' +
      "<li>" + icon("compass") + "<span><strong>Discover nearby</strong>Restaurants, malls, parks and things to do with ratings and photos.</span></li>" +
      "<li>" + icon("route") + "<span><strong>Plan any trip</strong>What to ride, where to board, how much — with student, senior & PWD discounts.</span></li>" +
      "<li>" + icon("bell") + "<span><strong>Never miss a step</strong>Day itinerary, reminders and calendar alerts.</span></li></ul>" +
      '<a class="btn btn--primary btn--block" href="#/signup">Create free account</a>' +
      '<a class="btn btn--ghost btn--block" href="#/login">Log in</a>' +
      '<button class="link-btn" type="button" data-action="guest">Continue as guest</button>'), { auth: true });
  };
  T.actions.guest = function () { T.auth.guest(); T.router.go("setup", true); };

  T.views.signup = function () {
    mount(authShell(brandBlock() +
      '<h2 class="auth__title">Create your account</h2>' +
      '<form class="form" data-submit="signup" novalidate>' +
      field("name", "Full name", "text", "Juan dela Cruz", "name") +
      field("email", "Email", "email", "you@email.com", "email") +
      field("password", "Password", "password", "At least 6 characters", "new-password", true) +
      '<div class="field"><span class="field__label">I travel as</span>' + travelerSeg("regular", "signup-type") +
      '<p class="fine" id="type-note">' + typeNote("regular") + "</p></div>" +
      '<p class="form__error" role="alert" hidden></p>' +
      '<button class="btn btn--primary btn--block" type="submit">Sign up</button>' +
      '<p class="fine center">Your account is saved securely on this device.</p>' +
      '<p class="center">Already have an account? <a class="link" href="#/login">Log in</a></p>' +
      "</form>"), { auth: true });
  };
  function field(name, label, type, ph, ac, eye) {
    return '<label class="field"><span class="field__label">' + label + '</span><span class="input-wrap"><input class="input" name="' + name + '" type="' + type + '" placeholder="' + ph + '" autocomplete="' + ac + '" required>' +
      (eye ? '<button class="input-eye" type="button" data-action="toggle-eye" aria-label="Show password">' + icon("eye") + "</button>" : "") + "</span></label>";
  }
  function travelerSeg(cur, name) {
    return '<div class="seg seg--4" role="radiogroup">' + C.travelerTypes.map(function (t) {
      return '<label class="seg__opt"><input type="radio" name="' + name + '" value="' + t.id + '"' + (t.id === cur ? " checked" : "") + ' data-input="traveler-note"><span>' + esc(t.label.replace(" citizen", "")) + "</span></label>";
    }).join("") + "</div>";
  }
  function typeNote(id) {
    var t = C.travelerTypes.filter(function (x) { return x.id === id; })[0];
    if (!t || t.id === "regular") return "Choose Student, Senior or PWD to see discounted fares automatically.";
    return "You'll see " + Math.round(t.road * 100) + "% off jeepney, tricycle & bus fares and " + Math.round(t.rail * 100) + "% off LRT/MRT. Bring your " + t.id_name + ".";
  }
  T.inputs["traveler-note"] = function (el) {
    var n = $("#type-note");
    if (n) n.textContent = typeNote(el.value);
    if (el.name === "profile-type") { T.auth.update({ type: el.value }); T.toast("Traveler type updated", "Fares now use " + el.value + " rates.", "id"); }
    if (el.name === "plan-type") { T.state.draft.type = el.value; }
  };
  T.actions["toggle-eye"] = function (el) {
    var inp = el.parentNode.querySelector("input");
    inp.type = inp.type === "password" ? "text" : "password";
  };
  function formError(form, msg) { var e = $(".form__error", form); e.textContent = msg; e.hidden = !msg; }
  function busy(btn, on, text) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>' + esc(text || "Please wait…"); }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
  }
  T.submits.signup = function (form) {
    var btn = $('[type="submit"]', form);
    busy(btn, true, "Creating account…");
    T.auth.signup({ name: form.name.value, email: form.email.value, password: form.password.value, type: (form.querySelector('[name="signup-type"]:checked') || {}).value })
      .then(function (u) { T.toast("Welcome, " + u.name.split(" ")[0] + "!", "Your account is ready.", "check"); T.router.go("setup", true); })
      .catch(function (err) { busy(btn, false); formError(form, err.message); });
  };

  T.views.login = function () {
    mount(authShell(brandBlock() +
      '<h2 class="auth__title">Welcome back</h2>' +
      '<form class="form" data-submit="login" novalidate>' +
      field("email", "Email", "email", "you@email.com", "email") +
      field("password", "Password", "password", "Your password", "current-password", true) +
      '<p class="form__error" role="alert" hidden></p>' +
      '<button class="btn btn--primary btn--block" type="submit">Log in</button>' +
      '<p class="center">New to Tara? <a class="link" href="#/signup">Create an account</a></p>' +
      '<button class="link-btn" type="button" data-action="guest">Continue as guest</button>' +
      "</form>"), { auth: true });
  };
  T.submits.login = function (form) {
    var btn = $('[type="submit"]', form);
    busy(btn, true, "Logging in…");
    T.auth.login(form.email.value, form.password.value)
      .then(function (u) { T.toast("Hi, " + u.name.split(" ")[0] + "!", "Good to see you again.", "check"); T.router.go(u.location ? "home" : "setup", true); })
      .catch(function (err) { busy(btn, false); formError(form, err.message); });
  };

  T.views.setup = function () {
    var u = T.auth.current();
    mount(authShell(brandBlock() +
      '<h2 class="auth__title">Where are you, ' + esc((u && u.name || "Traveler").split(" ")[0]) + "?</h2>" +
      '<p class="muted">We use your location to show places near you and to plan trips from where you are.</p>' +
      '<button class="locate-btn locate-btn--big" type="button" data-action="setup-gps">' + icon("locate") + "<span><strong>Use my current location</strong><small>Fastest — uses GPS</small></span></button>" +
      '<div class="or"><span>or type your address</span></div>' +
      '<button class="input input--btn" type="button" data-action="setup-type">' + icon("search") + "<span>e.g. Brgy. Lecheria, Calamba, Laguna</span></button>" +
      '<div id="setup-result"></div>' +
      '<button class="link-btn" type="button" data-action="setup-skip">Skip for now</button>'), { auth: true });
  };
  function setupDone(loc) {
    var full = { label: loc.label, lat: loc.lat, lng: loc.lng, source: loc.source || "search", approx: !!loc.approx, at: Date.now() };
    T.location.set(full);
    T.auth.update({ home: full, location: full });
    var box = $("#setup-result");
    if (!box) return;
    box.innerHTML = '<div class="setup-ok">' + icon("check") + "<div><strong>" + esc(full.label) + "</strong><small>" + (full.approx ? "Approximate — you can refine it later in Profile." : "Saved as your home location.") + "</small></div></div>" +
      '<div class="mini-map" id="setup-map"></div><a class="btn btn--primary btn--block" href="#/home">Let’s go ' + icon("arrow") + "</a>";
    var m = T.maps.make($("#setup-map"), full, 15);
    if (m) L.marker([full.lat, full.lng], { icon: T.maps.me() }).addTo(m);
  }
  T.actions["setup-gps"] = function (el) {
    busy(el, true, "Finding your location…");
    T.geo.locate().then(function (loc) { busy(el, false); setupDone(loc); }).catch(function (err) { busy(el, false); T.toast("Couldn't locate you", err.message, "info", "warn"); });
  };
  T.actions["setup-type"] = function () { T.pickLocation({ mode: "location", onPick: setupDone }); };
  T.actions["setup-skip"] = function () { T.router.go("home", true); };

  /* ======================================================================
     HOME
     ====================================================================== */
  T.views.home = function () {
    var u = T.auth.current();
    var here = T.location.get();
    var near = T.places.query({ near: here }).slice(0, 8);
    var trip = T.trips.next();
    var html =
      '<section class="home-hero">' +
      '<div class="home-hero__top">' +
      '<button class="loc-chip" type="button" data-action="change-location">' + icon("pin") + "<span><small>You're in</small><strong>" + esc(here.label) + "</strong></span>" + icon("chev-r") + "</button>" +
      '<a href="#/profile" aria-label="Profile">' + avatar(u) + "</a></div>" +
      '<h1 class="home-hero__hi">' + esc(T.greeting()) + ", " + esc((u && u.name || "Traveler").split(" ")[0]) + "!</h1>" +
      '<p class="home-hero__sub">Where do you want to go today? <span class="wx" id="home-wx"></span></p>' +
      '<a class="search-bar" href="#/explore?focus=1">' + icon("search") + "<span>Search restaurants, malls, parks…</span></a>" +
      "</section>" +
      '<section class="section"><div class="cats">' + C.categories.map(function (c) {
        return '<a class="cat-tile cat--' + c.id + '" href="#/explore?cat=' + c.id + '"><span>' + icon(c.icon) + "</span>" + esc(c.short) + "</a>";
      }).join("") + "</div></section>" +
      (trip ? '<section class="section">' + nextTripCard(trip) + "</section>" : "") +
      '<section class="section"><div class="sec-head"><h2>Popular near you</h2><a href="#/explore">See all</a></div>' +
      '<div class="hscroll">' + near.map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Around ' + esc(here.label.split(",")[0]) + '</h2><a href="#/explore">More</a></div>' +
      '<div class="rows" id="home-nearby">' + loader("Finding places around you…") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Day trips from ' + esc((here.label.split(",")[1] || here.label.split(",")[0]).trim()) + "</h2></div>" +
      '<div class="trip-grid">' + C.dayTrips.map(function (id) { return dayTripCard(T.places.get(id), here); }).join("") + "</div></section>" +
      '<section class="section">' + discountCard() + "</section>";
    mount(html, { nav: "home" });

    // weather
    T.weather.get(here).then(function (w) {
      var el = $("#home-wx");
      if (!el || !w || !w.current) return;
      var d = T.weather.describe(w.current.code);
      el.innerHTML = icon(d.icon) + Math.round(w.current.temp) + "°C · " + esc(d.label);
    });
    // live nearby from OpenStreetMap
    loadNearby(here, function (items) {
      var box = $("#home-nearby");
      if (!box) return;
      if (!items) { box.innerHTML = '<p class="fine">Live nearby places need an internet connection. Showing featured places above.</p>'; return; }
      var list = items.map(function (p) { return { p: p, d: T.geo.distance(here, p) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 6);
      box.innerHTML = list.length ? list.map(function (x) { return placeRow(x.p, x.d); }).join("") : '<p class="fine">No listed places within 3 km yet.</p>';
      T.photos.hydrate(box);
    });
  };
  function loadNearby(here, cb) {
    T.places.nearby(here, 3000).then(function (items) { T.state.nearby = items; cb(items); }).catch(function () { cb(null); });
  }
  function dayTripCard(p, here) {
    if (!p) return "";
    var o = T.planner.quick(here, p);
    return '<a class="tcard" href="#/plan?to=' + encodeURIComponent(p.id) + '">' + photo(p, "tcard__ph") +
      '<div class="tcard__shade"></div><div class="tcard__body"><h3>' + esc(p.name) + "</h3>" +
      "<p>" + esc(p.area) + "</p>" +
      (o ? '<p class="tcard__est">' + icon("clock") + T.dur(o.minutes) + '<span class="dot"></span>' + icon("wallet") + "from " + T.peso(o.fare) + "</p>" : "") +
      "</div></a>";
  }
  function discountCard() {
    var t = T.traveler();
    if (t.id !== "regular") {
      return '<div class="note-card note-card--ok">' + icon("id") + "<div><strong>" + esc(t.label) + " discount is on</strong><p>Fares show " + Math.round(t.road * 100) + "% off jeep, tricycle & bus and " + Math.round(t.rail * 100) + "% off LRT. Remember your " + esc(t.id_name) + ".</p></div></div>";
    }
    return '<a class="note-card" href="#/profile">' + icon("id") + "<div><strong>Student, senior or PWD?</strong><p>Get 20% off jeep & bus fares and 50% off LRT. Set your traveler type in Profile.</p></div>" + icon("chev-r") + "</a>";
  }
  function nextTripCard(trip) {
    var dep = new Date(trip.option.depart);
    return '<a class="next-trip" href="#/trip/' + trip.id + '"><div class="next-trip__top"><span class="badge">' + icon("ticket") + "Next trip</span><span>" + esc(countdown(dep)) + "</span></div>" +
      "<h3>" + esc(trip.to.name) + "</h3><p>" + esc(T.date(dep)) + " · leave " + esc(T.time(dep)) + " · " + esc(trip.option.title) + "</p></a>";
  }
  function countdown(d) {
    var ms = d - new Date();
    if (ms < 0) return "Today";
    var h = Math.floor(ms / 36e5), days = Math.floor(h / 24);
    if (days >= 1) return "in " + days + " day" + (days > 1 ? "s" : "");
    if (h >= 1) return "in " + h + " h " + Math.floor((ms % 36e5) / 6e4) + " min";
    return "in " + Math.max(1, Math.floor(ms / 6e4)) + " min";
  }
  T.countdown = countdown;

  /* ======================================================================
     EXPLORE
     ====================================================================== */
  T.views.explore = function (r) {
    var st = T.state.explore;
    if (r.query.cat != null) st.cat = r.query.cat;
    if (r.query.q != null) st.q = r.query.q;
    var here = T.location.get();
    var html = pageHead("Explore", { sub: icon("pin") + '<button class="link" type="button" data-action="change-location">' + esc(here.label) + "</button>", sticky: false }) +
      '<div class="explore-bar">' +
      '<div class="search-field">' + icon("search") + '<input class="input" id="ex-q" type="search" placeholder="Search places, food, malls…" value="' + esc(st.q) + '" data-input="explore-q"' + (r.query.focus ? " autofocus" : "") + "></div>" +
      '<div class="chips" role="tablist">' + ['<button class="chip" type="button" data-action="explore-cat" data-cat="" aria-selected="' + (!st.cat) + '">All</button>'].concat(C.categories.map(function (c) {
        return '<button class="chip" type="button" data-action="explore-cat" data-cat="' + c.id + '" aria-selected="' + (st.cat === c.id) + '">' + icon(c.icon) + esc(c.short) + "</button>";
      })).join("") + "</div>" +
      '<div class="explore-tools"><span class="muted" id="ex-count"></span>' +
      '<label class="select-sm">' + icon("list") + '<select data-input="explore-sort"><option value="near"' + (st.sort === "near" ? " selected" : "") + '>Nearest</option><option value="rating"' + (st.sort === "rating" ? " selected" : "") + ">Top rated</option></select></label>" +
      '<div class="toggle2"><button type="button" data-action="explore-mode" data-mode="list" aria-pressed="' + (st.mode === "list") + '">' + icon("list") + "List</button>" +
      '<button type="button" data-action="explore-mode" data-mode="map" aria-pressed="' + (st.mode === "map") + '">' + icon("map") + "Map</button></div></div></div>" +
      '<div id="ex-results"></div><div id="ex-map" class="ex-map" hidden></div><div id="ex-live"></div>';
    mount(html, { nav: "explore" });
    if (r.query.focus) setTimeout(function () { var i = $("#ex-q"); if (i) i.focus(); }, 50);
    renderExplore();
    var live = $("#ex-live");
    if (!T.state.nearby.length) {
      live.innerHTML = loader("Loading live places near you…");
      loadNearby(here, function (items) {
        if (!$("#ex-live")) return;
        $("#ex-live").innerHTML = items ? "" : '<p class="fine center">Offline — showing featured places only. Connect to see every restaurant, mall and park near you.</p>';
        if (items) renderExplore();
      });
    }
  };
  function exploreList() {
    var st = T.state.explore, here = T.location.get();
    return T.places.query({ cat: st.cat || null, q: st.q, near: here, sort: st.sort, extra: T.state.nearby });
  }
  function renderExplore() {
    var st = T.state.explore, here = T.location.get();
    var list = exploreList();
    var box = $("#ex-results"), mapEl = $("#ex-map");
    if (!box) return;
    $("#ex-count").textContent = list.length + " place" + (list.length === 1 ? "" : "s");
    if (st.mode === "map") {
      box.hidden = true; mapEl.hidden = false;
      T._maps.forEach(function (m) { try { m.remove(); } catch (e) {} });
      T._maps = [];
      mapEl.innerHTML = "";
      var m = T.maps.make(mapEl, here, 13);
      if (!m) return;
      L.marker([here.lat, here.lng], { icon: T.maps.me() }).addTo(m).bindPopup("You are here");
      var pts = [[here.lat, here.lng]];
      list.slice(0, 150).forEach(function (x) {
        var p = x.p;
        L.marker([p.lat, p.lng], { icon: T.maps.pin(p) }).addTo(m)
          .bindPopup('<a class="map-pop" href="#/place/' + encodeURIComponent(p.id) + '"><strong>' + esc(p.name) + "</strong><span>" + esc(T.cat(p.cat).label) + " · " + T.km(x.d) + "</span></a>");
        if (x.d < 8) pts.push([p.lat, p.lng]);
      });
      if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
      return;
    }
    box.hidden = false; mapEl.hidden = true;
    box.innerHTML = list.length ? '<div class="rows">' + list.slice(0, 80).map(function (x) { return placeRow(x.p, x.d); }).join("") + "</div>"
      : empty("search", "No places found", st.q ? "Try a different word or category." : "Nothing in this category yet near you.", "");
    T.photos.hydrate(box);
  }
  var exTimer;
  T.inputs["explore-q"] = function (el) { clearTimeout(exTimer); exTimer = setTimeout(function () { T.state.explore.q = el.value; renderExplore(); }, 180); };
  T.inputs["explore-sort"] = function (el) { T.state.explore.sort = el.value; renderExplore(); };
  T.actions["explore-cat"] = function (el) {
    T.state.explore.cat = el.dataset.cat;
    $$(".chips .chip").forEach(function (c) { c.setAttribute("aria-selected", String(c === el)); });
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: T.reduceMotion ? "auto" : "smooth" });
    renderExplore();
  };
  T.actions["explore-mode"] = function (el) {
    T.state.explore.mode = el.dataset.mode;
    $$(".toggle2 button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === el)); });
    renderExplore();
  };

  /* ======================================================================
     PLACE DETAIL
     ====================================================================== */
  T.views.place = function (r) {
    var p = T.places.get(r.param);
    if (!p) { mount(pageHead("Place", { back: true }) + empty("pin", "Place not found", "It may have been removed or is only available online.", '<a class="btn btn--primary" href="#/explore">Explore places</a>'), { nav: "explore" }); return; }
    T.places.remember(p);
    var here = T.location.get();
    var d = T.geo.distance(here, p);
    var st = T.places.openState(p);
    var fee = T.places.fee(p);
    var trav = T.traveler();
    var score = T.places.score(p);
    var reviews = T.places.reviews(p.id);
    var saved = T.favs.has(p.id);
    var quick = d > 0.3 ? T.planner.quick(here, p) : null;
    var nearby = T.places.query({ near: p, within: 1.5, extra: T.state.nearby }).filter(function (x) { return x.p.id !== p.id; }).slice(0, 8);
    var html =
      '<div class="place-hero">' + photo(p, "place-hero__ph") + '<div class="place-hero__shade"></div>' +
      '<div class="place-hero__bar"><button class="icon-btn icon-btn--glass" type="button" data-action="back" aria-label="Back">' + icon("chev-l") + "</button>" +
      '<span class="grow"></span><button class="icon-btn icon-btn--glass" type="button" data-action="share-place" data-id="' + esc(p.id) + '" aria-label="Share">' + icon("share") + "</button>" +
      '<button class="icon-btn icon-btn--glass" type="button" data-action="fav" data-id="' + esc(p.id) + '" aria-pressed="' + saved + '" aria-label="Save">' + icon(saved ? "heart-fill" : "heart") + "</button></div>" +
      '<div class="place-hero__title">' + catChip(p) + "<h1>" + esc(p.name) + "</h1><p>" + icon("pin") + esc(p.address || p.area || "") + "</p></div></div>" +
      '<div class="place-body">' +
      '<div class="place-stats">' +
      '<div class="stat">' + (score ? '<strong class="stat__big">' + score.toFixed(1) + "</strong>" + T.stars(score, 14) : '<strong class="stat__big">New</strong><small>No ratings yet</small>') + "<small>" + (p.rating ? "Guide score" : "") + (reviews.length ? (p.rating ? " + " : "") + reviews.length + " review" + (reviews.length > 1 ? "s" : "") : "") + "</small></div>" +
      '<div class="stat"><strong class="stat__big">' + T.km(d) + "</strong><small>from you</small>" + (quick ? "<small>" + T.dur(quick.minutes) + " · " + T.peso(quick.fare) + " by commute" + "</small>" : "") + "</div>" +
      '<div class="stat"><strong class="stat__big ' + (st.open ? "ok" : st.known ? "bad" : "") + '">' + (st.known ? (st.open ? "Open" : "Closed") : "—") + "</strong><small>" + esc(st.label) + "</small></div>" +
      "</div>" +
      '<div class="place-actions">' +
      '<a class="btn btn--primary" href="#/plan?to=' + encodeURIComponent(p.id) + '">' + icon("route") + "Plan a trip here</a>" +
      '<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + "," + p.lng + '">' + icon("map") + "Directions</a></div>" +
      (p.desc ? '<section class="psec"><h2>About</h2><p>' + esc(p.desc) + "</p></section>" : "") +
      '<section class="psec"><h2>Good to know</h2><dl class="facts">' +
      "<div><dt>" + icon("clock") + "Hours</dt><dd>" + esc(T.places.hoursText(p)) + "</dd></div>" +
      "<div><dt>" + icon("ticket") + "Entrance</dt><dd>" + (fee.amount == null ? esc(fee.label) : fee.amount === 0 ? "Free" : T.peso(fee.amount) +
        (fee.discounted ? ' <span class="pill pill--ok">' + esc(trav.label) + ' rate</span> <s class="muted">' + T.peso(fee.regular) + "</s>" : (p.fee && p.fee.discounted < p.fee.regular ? ' <span class="muted">(' + T.peso(p.fee.discounted) + " student/senior/PWD)</span>" : "")) +
        (fee.note ? ' <span class="muted">· ' + esc(fee.note) + "</span>" : "")) + "</dd></div>" +
      (p.price ? "<div><dt>" + icon("wallet") + "Budget</dt><dd>" + "₱".repeat(p.price) + ' <span class="muted">· about ' + T.peso(C.mealBudget[p.price]) + " per person</span></dd></div>" : "") +
      (p.visit ? "<div><dt>" + icon("eye") + "Time needed</dt><dd>About " + T.dur(p.visit) + "</dd></div>" : "") +
      (p.phone ? "<div><dt>" + icon("phone") + "Phone</dt><dd><a class=\"link\" href=\"tel:" + esc(p.phone.replace(/\s/g, "")) + '">' + esc(p.phone) + "</a></dd></div>" : "") +
      (p.website ? "<div><dt>" + icon("globe") + "Website</dt><dd><a class=\"link\" target=\"_blank\" rel=\"noopener\" href=\"" + esc(p.website) + '">' + esc(p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")) + "</a></dd></div>" : "") +
      "</dl></section>" +
      (p.tips && p.tips.length ? '<section class="psec"><h2>Tips</h2><ul class="tips">' + p.tips.map(function (t) { return "<li>" + icon("sparkle") + esc(t) + "</li>"; }).join("") + "</ul></section>" : "") +
      '<section class="psec"><h2>Location</h2><div class="mini-map" id="place-map"></div></section>' +
      '<section class="psec"><div class="sec-head"><h2>Reviews</h2><button class="btn btn--sm btn--ghost" type="button" data-action="review" data-id="' + esc(p.id) + '">' + icon("edit") + "Write a review</button></div>" +
      (reviews.length ? '<div class="reviews">' + reviews.map(function (rv) {
        return '<article class="review"><header>' + avatar({ name: rv.name }, "sm") + "<div><strong>" + esc(rv.name) + "</strong><small>" + esc(T.date(new Date(rv.at))) + (rv.type && rv.type !== "regular" ? " · " + esc(rv.type) : "") + "</small></div>" + T.stars(rv.rating, 13) + "</header>" + (rv.text ? "<p>" + esc(rv.text) + "</p>" : "") + "</article>";
      }).join("") + "</div>" : '<p class="muted">No reviews yet. Been here? Share your experience to help other travelers.</p>') + "</section>" +
      (nearby.length ? '<section class="psec"><div class="sec-head"><h2>Nearby</h2></div><div class="hscroll">' + nearby.map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>" : "") +
      '<p class="fine">' + (p.source === "osm" ? "Place data © OpenStreetMap contributors." : "Guide score, hours and fees are estimates — check with the venue before you go.") + (p.wiki ? " Photo via Wikipedia / Wikimedia Commons." : "") + "</p>" +
      "</div>";
    mount(html, { nav: "explore", cls: "view--place" });
    var m = T.maps.make($("#place-map"), p, 16);
    if (m) {
      L.marker([p.lat, p.lng], { icon: T.maps.pin(p) }).addTo(m);
      if (d < 30) { L.marker([here.lat, here.lng], { icon: T.maps.me() }).addTo(m); if (d > 0.2) m.fitBounds([[p.lat, p.lng], [here.lat, here.lng]], { padding: [30, 30], maxZoom: 16 }); }
    }
  };
  T.actions["share-place"] = function (el) {
    var p = T.places.get(el.dataset.id);
    var url = location.origin + location.pathname + "#/place/" + encodeURIComponent(p.id);
    share(p.name + " — Tara", (p.desc || "").slice(0, 120), url);
  };
  function share(title, text, url) {
    if (navigator.share) return navigator.share({ title: title, text: text, url: url }).catch(function () {});
    if (navigator.clipboard) return navigator.clipboard.writeText(url).then(function () { T.toast("Link copied", "Paste it anywhere to share.", "check"); });
    T.toast("Share", url, "share");
  }
  T.share = share;
  T.actions.fav = function (el) {
    var on = T.favs.toggle(el.dataset.id);
    el.setAttribute("aria-pressed", String(on));
    el.innerHTML = icon(on ? "heart-fill" : "heart");
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    T.toast(on ? "Saved" : "Removed from saved", on ? "Find it in Profile → Saved places." : "", on ? "heart-fill" : "heart");
  };
  T.actions.review = function (el) {
    var p = T.places.get(el.dataset.id);
    T.sheet.open("Review " + p.name, '<form class="form" data-submit="review" data-id="' + esc(p.id) + '">' +
      '<div class="star-input" role="radiogroup" aria-label="Your rating">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<label><input type="radio" name="rating" value="' + n + '"' + (n === 5 ? " checked" : "") + '><svg aria-hidden="true"><use href="#i-star"/></svg><span class="sr">' + n + " stars</span></label>";
      }).join("") + "</div>" +
      '<label class="field"><span class="field__label">Your review (optional)</span><textarea class="input" name="text" rows="4" placeholder="What did you like? Any tips for other travelers?"></textarea></label>' +
      '<button class="btn btn--primary btn--block" type="submit">Post review</button></form>');
  };
  T.submits.review = function (form) {
    var u = T.auth.current();
    var rating = Number((form.querySelector('[name="rating"]:checked') || {}).value || 5);
    T.places.addReview(form.dataset.id, { rating: rating, text: form.text.value.trim(), name: u ? u.name : "Traveler", type: u ? u.type : "", at: Date.now() });
    T.sheet.close();
    T.toast("Thanks for your review!", "It helps other travelers.", "star");
    T.router.resolve();
  };

  /* ======================================================================
     PLAN
     ====================================================================== */
  function defaultDraft() {
    var here = T.location.get();
    var now = new Date(), h = now.getHours();
    var d = new Date(); d.setDate(d.getDate() + (h >= 15 ? 1 : 0));
    var dep = new Date(); dep.setMinutes(Math.ceil((dep.getMinutes() + 20) / 15) * 15, 0, 0);
    var useNow = h >= 5 && h < 15;
    return {
      from: { name: here.label.split(",")[0], label: here.label, lat: here.lat, lng: here.lng },
      to: null, date: T.isoDate(d), time: useNow && dep.getHours() < 15 ? T.pad(dep.getHours()) + ":" + T.pad(dep.getMinutes()) : "07:00",
      pax: 1, type: T.traveler().id, ret: true, homeBy: "16:30", activities: true, optionId: null, include: null,
    };
  }
  T.views.plan = function (r) {
    var dr = T.state.draft = T.state.draft || defaultDraft();
    if (r.query.to) {
      var p = T.places.get(r.query.to);
      if (p && (!dr.to || dr.to.placeId !== p.id)) { dr.to = { name: p.name, label: p.name + ", " + p.area, lat: p.lat, lng: p.lng, placeId: p.id }; dr.optionId = null; dr.include = null; T.state.plan = null; }
    }
    var html = pageHead("Plan a trip", { sub: "Routes, fares, discounts & a day plan", sticky: false }) +
      '<form class="plan-form card" data-submit="plan" novalidate>' +
      '<div class="od">' +
      '<button class="od__row" type="button" data-action="plan-from"><span class="od__dot od__dot--from"></span><span><small>From</small><strong>' + esc(dr.from.label) + "</strong></span></button>" +
      '<button class="od__swap icon-btn" type="button" data-action="plan-swap" aria-label="Swap">' + icon("swap") + "</button>" +
      '<button class="od__row" type="button" data-action="plan-to"><span class="od__dot od__dot--to"></span><span><small>To</small><strong class="' + (dr.to ? "" : "muted") + '">' + esc(dr.to ? dr.to.label : "Choose destination") + "</strong></span></button>" +
      "</div>" +
      '<div class="grid2">' +
      '<label class="field"><span class="field__label">' + icon("calendar") + 'Date</span><input class="input" type="date" name="date" value="' + dr.date + '" min="' + T.isoDate(new Date()) + '" data-input="plan-field"></label>' +
      '<label class="field"><span class="field__label">' + icon("clock") + 'Departure</span><input class="input" type="time" name="time" value="' + dr.time + '" data-input="plan-field"></label>' +
      "</div>" +
      '<div class="field"><span class="field__label">' + icon("id") + "Traveler type</span>" + travelerSeg(dr.type, "plan-type") + "</div>" +
      '<div class="grid2">' +
      '<div class="field"><span class="field__label">' + icon("users") + 'Travelers</span><div class="stepper"><button type="button" data-action="pax" data-d="-1" aria-label="Fewer">' + icon("minus") + '</button><output id="pax">' + dr.pax + '</output><button type="button" data-action="pax" data-d="1" aria-label="More">' + icon("plus") + "</button></div></div>" +
      '<label class="field"><span class="field__label">' + icon("home") + 'Head home by</span><input class="input" type="time" name="homeBy" value="' + dr.homeBy + '" data-input="plan-field"' + (dr.ret ? "" : " disabled") + "></label>" +
      "</div>" +
      switchRow("ret", "Include return trip", "Plan the ride back home", dr.ret) +
      switchRow("activities", "Plan my day there", "Things to do in order, lunch stop, entrance fees", dr.activities) +
      '<button class="btn btn--primary btn--block btn--lg" type="submit">' + icon("sparkle") + "Plan my trip</button>" +
      "</form>" +
      '<div id="plan-out"></div>';
    mount(html, { nav: "plan" });
    if (T.state.plan) renderPlan(T.state.plan, false);
  };
  function switchRow(name, title, sub, on) {
    return '<label class="switch"><span><strong>' + title + "</strong><small>" + sub + '</small></span><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + ' data-input="plan-field"><span class="switch__ui"></span></label>';
  }
  T.inputs["plan-field"] = function (el) {
    var dr = T.state.draft;
    if (el.type === "checkbox") dr[el.name] = el.checked; else dr[el.name] = el.value;
    if (el.name === "ret") { var hb = $('[name="homeBy"]'); if (hb) hb.disabled = !el.checked; }
  };
  T.actions.pax = function (el) {
    var dr = T.state.draft;
    dr.pax = Math.max(1, Math.min(12, dr.pax + Number(el.dataset.d)));
    $("#pax").textContent = dr.pax;
  };
  T.actions["plan-from"] = function () {
    T.pickLocation({ mode: "origin", onPick: function (loc) { T.state.draft.from = { name: loc.name || loc.label.split(",")[0], label: loc.label, lat: loc.lat, lng: loc.lng, placeId: loc.placeId }; T.state.plan = null; T.router.resolve(); } });
  };
  T.actions["plan-to"] = function () {
    T.pickLocation({ mode: "destination", onPick: function (loc) { T.state.draft.to = { name: loc.name || loc.label.split(",")[0], label: loc.label, lat: loc.lat, lng: loc.lng, placeId: loc.placeId }; T.state.draft.include = null; T.state.plan = null; T.router.resolve(); } });
  };
  T.actions["plan-swap"] = function () {
    var dr = T.state.draft;
    if (!dr.to) return;
    var a = dr.from; dr.from = dr.to; dr.to = a; dr.include = null; T.state.plan = null;
    T.router.resolve();
  };
  function draftDepart(dr) {
    var p = dr.date.split("-"), t = dr.time.split(":");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1]));
  }
  function buildFromDraft(weather) {
    var dr = T.state.draft;
    var trav = C.travelerTypes.filter(function (t) { return t.id === dr.type; })[0] || T.traveler();
    return T.planner.build({ from: dr.from, to: dr.to, depart: draftDepart(dr), traveler: trav, pax: dr.pax, ret: dr.ret, homeBy: dr.homeBy,
      activities: dr.activities, optionId: dr.optionId, include: dr.include, weather: weather });
  }
  T.submits.plan = function (form) {
    var dr = T.state.draft;
    if (!dr.to) { T.actions["plan-to"](); return; }
    if (T.geo.distance(dr.from, dr.to) < 0.05) { T.toast("Same place", "Pick a destination different from your starting point.", "info", "warn"); return; }
    var out = $("#plan-out");
    out.innerHTML = '<div class="planning">' + '<span class="road-loader road-loader--lg"><i></i></span><strong>Planning your trip…</strong><span class="muted">Checking routes, fares and things to do</span></div>';
    out.scrollIntoView({ behavior: T.reduceMotion ? "auto" : "smooth", block: "start" });
    var wxP = T.weather.get(dr.to).catch(function () { return null; });
    var timer = new Promise(function (r) { setTimeout(r, 900); });
    Promise.all([wxP, timer]).then(function (res) {
      T.state.weather = res[0];
      T.state.plan = buildFromDraft(res[0]);
      renderPlan(T.state.plan, true);
    });
  };
  T.actions["plan-option"] = function (el) {
    T.state.draft.optionId = el.dataset.id;
    T.state.plan = buildFromDraft(T.state.weather);
    renderPlan(T.state.plan, false);
  };
  T.actions["plan-toggle-stop"] = function (el) {
    var plan = T.state.plan;
    var pool = plan.day.pool.map(function (p) { return p.id; });
    var cur = T.state.draft.include || plan.day.steps.filter(function (s) { return s.kind === "visit"; }).map(function (s) { return s.place.id; });
    var id = el.dataset.id;
    var i = cur.indexOf(id);
    if (i > -1) cur.splice(i, 1); else cur.push(id);
    T.state.draft.include = cur.filter(function (x) { return pool.indexOf(x) > -1; });
    T.state.plan = buildFromDraft(T.state.weather);
    renderPlan(T.state.plan, false);
  };

  var modeIcon = { walk: "walk", tricycle: "tricycle", jeep: "jeep", bus: "bus", lrt: "train", grab: "car", car: "car" };
  function legsTimeline(o, opts) {
    opts = opts || {};
    return '<ol class="tl">' + o.legs.map(function (l, i) {
      var key = (opts.prefix || "o") + i;
      var done = opts.done && opts.done[key];
      return '<li class="tl__item tl--' + l.mode + (done ? " is-done" : "") + '">' +
        '<span class="tl__time">' + T.time(new Date(l.start)) + "</span>" +
        '<span class="tl__ic">' + icon(modeIcon[l.mode]) + "</span>" +
        '<div class="tl__body"><strong>' + esc(l.text) + "</strong>" +
        (l.board ? '<p class="tl__board">' + icon("pin") + esc(l.board) + "</p>" : "") +
        "<p>" + esc(T.planner.modeName[l.mode]) + " · " + T.dur(l.minutes) + (l.km > 0.2 ? " · " + T.km(l.km) : "") +
        (l.mode === "walk" ? "" : " · <b>" + (l.perCar ? T.peso(l.fareReg) + " per car" : l.fare ? T.peso(l.fare) : "—") + "</b>" + (l.saved > 0 ? ' <s class="muted">' + T.peso(l.fareReg) + "</s>" : "")) +
        (l.rush ? ' <span class="pill pill--warn">rush hour</span>' : "") + "</p>" +
        (l.tip ? '<p class="tl__tip">' + esc(l.tip) + "</p>" : "") +
        (opts.check ? '<label class="tl__check"><input type="checkbox" data-input="trip-check" data-key="' + key + '"' + (done ? " checked" : "") + "><span>Done</span></label>" : "") +
        "</div></li>";
    }).join("") +
      '<li class="tl__item tl--arrive"><span class="tl__time">' + T.time(new Date(o.arrive)) + '</span><span class="tl__ic">' + icon("pin") + '</span><div class="tl__body"><strong>Arrive at ' + esc(opts.toName || "destination") + "</strong></div></li></ol>";
  }
  function dayTimeline(day, opts) {
    opts = opts || {};
    return '<ol class="tl tl--day">' + day.steps.map(function (s, i) {
      var key = "d" + i, done = opts.done && opts.done[key];
      var p = s.place;
      return '<li class="tl__item tl--' + s.kind + (done ? " is-done" : "") + '">' +
        '<span class="tl__time">' + T.time(new Date(s.start)) + "</span>" +
        '<span class="tl__ic">' + icon(s.kind === "meal" ? "utensils" : T.cat(p.cat).icon) + "</span>" +
        '<div class="tl__body">' + (p ? '<a class="tl__name" href="#/place/' + encodeURIComponent(p.id) + '">' + esc(s.name) + "</a>" : "<strong>" + esc(s.name) + "</strong>") +
        "<p>" + T.time(new Date(s.start)) + " – " + T.time(new Date(s.end)) + (s.walk ? " · " + s.walk + " min walk" : "") +
        (s.kind === "visit" ? " · " + (s.fee ? "<b>" + T.peso(s.fee) + "</b>" + (s.feeReg > s.fee ? ' <s class="muted">' + T.peso(s.feeReg) + "</s>" : "") : "Free") : " · about " + T.peso(s.cost) + "/person") + "</p>" +
        (s.note ? '<p class="tl__tip">' + esc(s.note) + "</p>" : "") +
        (s.tip ? '<p class="tl__tip">' + esc(s.tip) + "</p>" : "") +
        (opts.check ? '<label class="tl__check"><input type="checkbox" data-input="trip-check" data-key="' + key + '"' + (done ? " checked" : "") + "><span>Done</span></label>" : "") +
        "</div></li>";
    }).join("") + "</ol>";
  }
  function budgetCard(plan) {
    var b = plan.budget;
    var savedFares = plan.option.legs.reduce(function (s, l) { return s + (l.saved || 0); }, 0) + (plan.back ? plan.back.legs.reduce(function (s, l) { return s + (l.saved || 0); }, 0) : 0);
    var saved = savedFares + (plan.fees.saved || 0);
    return '<div class="budget">' +
      "<div><span>Fares" + (plan.ret ? " (round trip)" : "") + "</span><b>" + T.peso(b.fares) + "</b></div>" +
      (plan.activitiesOn ? "<div><span>Entrance fees</span><b>" + T.peso(b.fees) + "</b></div><div><span>Food (estimate)</span><b>" + T.peso(b.meals) + "</b></div>" : "") +
      '<div class="budget__total"><span>Total per person</span><b>' + T.peso(b.perPerson) + "</b></div>" +
      (plan.pax > 1 ? "<div><span>For " + plan.pax + " travelers</span><b>" + T.peso(b.group) + "</b></div>" : "") +
      (saved > 0 ? '<p class="budget__save">' + icon("id") + "Your " + esc(plan.traveler.label.toLowerCase()) + " discount saves " + T.peso(saved) + " per person</p>" : "") +
      "</div>";
  }
  function reminderList(plan) {
    return '<ul class="remind">' + plan.reminders.map(function (r) {
      return "<li>" + icon(r.icon) + "<div>" + (r.at ? "<small>" + esc(T.date(new Date(r.at)) + " · " + T.time(new Date(r.at))) + "</small>" : "") + "<p>" + esc(r.text) + "</p></div></li>";
    }).join("") + "</ul>";
  }
  function weatherLine(plan) {
    var w = T.state.weather && T.weather.forDate(T.state.weather, new Date(plan.option.depart));
    if (!w) return "";
    var d = T.weather.describe(w.code);
    return '<span class="wx">' + icon(d.icon) + Math.round(w.min) + "–" + Math.round(w.max) + "°C · " + esc(d.label) + (w.rain != null ? " · " + w.rain + "% rain" : "") + "</span>";
  }
  function renderPlan(plan, scroll) {
    var out = $("#plan-out");
    if (!out) return;
    var o = plan.option;
    var visits = plan.day.steps.filter(function (s) { return s.kind === "visit"; }).map(function (s) { return s.place.id; });
    var html =
      '<section class="result">' +
      '<div class="result__head"><div><p class="eyebrow">' + esc(T.date(new Date(o.depart), true)) + "</p><h2>" + esc(plan.from.name) + " → " + esc(plan.to.name) + "</h2>" +
      '<p class="muted">' + plan.pax + " traveler" + (plan.pax > 1 ? "s" : "") + " · " + esc(plan.traveler.label) + " fares " + weatherLine(plan) + "</p></div></div>" +
      '<p class="label">Choose how to get there</p>' +
      '<div class="opts">' + plan.options.map(function (x) {
        return '<button class="opt' + (x.id === o.id ? " is-on" : "") + '" type="button" data-action="plan-option" data-id="' + x.id + '" aria-pressed="' + (x.id === o.id) + '">' +
          '<span class="opt__tag">' + esc(x.tag) + "</span>" +
          '<span class="opt__modes">' + x.legs.filter(function (l, i, a) { return l.mode !== "walk" || a.length === 1; }).map(function (l) { return icon(modeIcon[l.mode]); }).join(icon("chev-r", "sep")) + "</span>" +
          '<span class="opt__title">' + esc(x.title) + "</span>" +
          '<span class="opt__nums"><b>' + T.peso(x.fare) + "</b>" + (x.fareReg > x.fare ? '<s class="muted">' + T.peso(x.fareReg) + "</s>" : "") + "<span>" + T.dur(x.minutes) + " · arrive " + T.time(new Date(x.arrive)) + "</span></span>" +
          (x.via ? '<span class="opt__via">via ' + esc(x.via) + "</span>" : "") + "</button>";
      }).join("") + "</div>" +
      '<div class="card"><div class="sec-head"><h3>' + icon("route") + " Getting there</h3><span class=\"muted\">" + T.dur(o.minutes) + " · " + T.peso(o.fare) + "/person</span></div>" +
      legsTimeline(o, { toName: plan.to.name }) + "</div>" +
      (plan.activitiesOn ? '<div class="card"><div class="sec-head"><h3>' + icon("sparkle") + " Your day in " + esc(plan.to.name) + "</h3></div>" +
        (plan.day.steps.length ? dayTimeline(plan.day) : '<p class="muted">No featured spots within walking distance yet. Explore nearby places after you arrive.</p>') +
        (plan.day.pool.length ? '<p class="label">Places within walking distance</p><div class="stop-chips">' + plan.day.pool.filter(function (p) { return !p.hub; }).map(function (p) {
          var on = visits.indexOf(p.id) > -1;
          return '<button class="chip" type="button" data-action="plan-toggle-stop" data-id="' + esc(p.id) + '" aria-pressed="' + on + '">' + icon(on ? "check" : "plus") + esc(p.name) + "</button>";
        }).join("") + "</div>" : "") +
        (plan.day.skipped.length ? '<p class="fine">' + plan.day.skipped.map(function (s) { return esc(s.place.name) + ": " + esc(s.why); }).join(" · ") + "</p>" : "") + "</div>" : "") +
      (plan.back ? '<div class="card"><div class="sec-head"><h3>' + icon("home") + " Going home</h3><span class=\"muted\">" + T.dur(plan.back.minutes) + " · " + T.peso(plan.back.fare) + "/person</span></div>" +
        legsTimeline(plan.back, { toName: plan.from.name }) + "</div>" : "") +
      '<div class="card"><h3 class="h3">' + icon("wallet") + " Budget</h3>" + budgetCard(plan) + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("bell") + " Reminders</h3>" + reminderList(plan) + "</div>" +
      '<div class="result__actions">' +
      '<button class="btn btn--primary btn--lg" type="button" data-action="save-trip">' + icon("ticket") + "Save trip</button>" +
      '<button class="btn btn--ghost" type="button" data-action="plan-ics">' + icon("calendar") + "Add to calendar</button>" +
      '<button class="btn btn--ghost" type="button" data-action="plan-share">' + icon("share") + "Share</button></div>" +
      '<p class="fine">Fares, times and fees are estimates based on standard fare guides and typical traffic. Check signboards, posted fare matrices and venue notices on the day.</p>' +
      "</section>";
    out.innerHTML = html;
    if (scroll) out.scrollIntoView({ behavior: T.reduceMotion ? "auto" : "smooth", block: "start" });
  }
  T.renderPlanTimeline = { legs: legsTimeline, day: dayTimeline, budget: budgetCard, reminders: reminderList };

  T.actions["save-trip"] = function () {
    var plan = T.state.plan;
    var saved = T.trips.save(plan);
    T.toast("Trip saved!", "Find it in Trips. Turn on reminders there.", "ticket");
    T.router.go("trip/" + saved.id);
  };
  T.actions["plan-ics"] = function () { downloadIcs(T.state.plan); };
  T.actions["plan-share"] = function () { shareTrip(T.state.plan); };
  function downloadIcs(plan) {
    var blob = new Blob([T.planner.ics(plan)], { type: "text/calendar" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tara-trip-" + plan.to.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    T.toast("Calendar file ready", "Open it to add the trip and its alarms to your calendar.", "calendar");
  }
  function shareTrip(plan) {
    var o = plan.option;
    var lines = ["Trip to " + plan.to.name + " — " + T.date(new Date(o.depart), true)];
    o.legs.forEach(function (l) { lines.push(T.time(new Date(l.start)) + " · " + l.text + (l.fare ? " (" + T.peso(l.fare) + ")" : "")); });
    lines.push("Arrive " + T.time(new Date(o.arrive)));
    plan.day.steps.forEach(function (s) { lines.push(T.time(new Date(s.start)) + " · " + s.name); });
    if (plan.back) lines.push("Head home " + T.time(new Date(plan.back.depart)) + ", arrive " + T.time(new Date(plan.back.arrive)));
    lines.push("Budget: " + T.peso(plan.budget.perPerson) + " per person — planned with Tara");
    var text = lines.join("\n");
    if (navigator.share) navigator.share({ title: "Trip to " + plan.to.name, text: text }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { T.toast("Itinerary copied", "Paste it in Messenger or Viber.", "check"); });
  }
  T.downloadIcs = downloadIcs; T.shareTrip = shareTrip;

  /* ======================================================================
     TRIPS
     ====================================================================== */
  T.views.trips = function (r) {
    var tab = r.query.tab || "upcoming";
    var all = T.trips.all();
    var now = Date.now();
    var up = all.filter(function (t) { return new Date(t.back ? t.back.arrive : t.option.arrive) >= now; }).sort(function (a, b) { return new Date(a.option.depart) - new Date(b.option.depart); });
    var past = all.filter(function (t) { return up.indexOf(t) < 0; }).sort(function (a, b) { return new Date(b.option.depart) - new Date(a.option.depart); });
    var list = tab === "past" ? past : up;
    var html = pageHead("My trips", { sub: up.length ? up.length + " upcoming" : "Plan, save and track your trips" }) +
      '<div class="tabs2"><a href="#/trips" aria-current="' + (tab !== "past") + '">Upcoming (' + up.length + ')</a><a href="#/trips?tab=past" aria-current="' + (tab === "past") + '">Past (' + past.length + ")</a></div>" +
      (list.length ? '<div class="trip-list">' + list.map(tripCard).join("") + "</div>"
        : empty("ticket", tab === "past" ? "No past trips yet" : "No upcoming trips", "Plan a trip and save it here to get step-by-step guidance and reminders.", '<a class="btn btn--primary" href="#/plan">' + icon("route") + "Plan a trip</a>"));
    mount(html, { nav: "trips" });
  };
  function tripCard(t) {
    var dep = new Date(t.option.depart);
    var total = t.option.legs.length + t.day.steps.length + (t.back ? t.back.legs.length : 0);
    var done = Object.keys(t.done || {}).filter(function (k) { return t.done[k]; }).length;
    return '<a class="trip-card" href="#/trip/' + t.id + '">' +
      '<span class="trip-card__date"><b>' + dep.getDate() + "</b>" + esc(dep.toLocaleDateString("en-PH", { month: "short" })) + "</span>" +
      '<div class="trip-card__body"><h3>' + esc(t.to.name) + "</h3><p>" + esc(T.time(dep)) + " from " + esc(t.from.name) + "</p>" +
      '<p class="muted">' + esc(t.option.title) + " · " + T.peso(t.budget.perPerson) + "/person</p>" +
      '<div class="progress"><span style="width:' + Math.round(done / Math.max(1, total) * 100) + '%"></span></div></div>' +
      (t.notify ? icon("bell", "trip-card__bell") : "") + icon("chev-r") + "</a>";
  }
  T.views.trip = function (r) {
    var t = T.trips.get(r.param);
    if (!t) { mount(pageHead("Trip", { back: true }) + empty("ticket", "Trip not found", "It may have been deleted.", '<a class="btn btn--primary" href="#/trips">My trips</a>'), { nav: "trips" }); return; }
    var dep = new Date(t.option.depart), now = new Date();
    var status = now < dep ? "Leaves " + countdown(dep) : now < new Date(t.back ? t.back.arrive : t.option.arrive) ? "In progress" : "Completed";
    var html = pageHead("Trip to " + esc(t.to.name), { back: true, sub: esc(T.date(dep, true)) + " · " + esc(status),
      actions: '<button class="icon-btn" type="button" data-action="trip-delete" data-id="' + t.id + '" aria-label="Delete trip">' + icon("trash") + "</button>" }) +
      '<div class="trip-top card">' +
      '<div class="trip-top__row"><div><small>Leave</small><b>' + T.time(dep) + "</b></div>" + icon("arrow") + "<div><small>Arrive</small><b>" + T.time(new Date(t.option.arrive)) + "</b></div>" +
      (t.back ? icon("home") + "<div><small>Home by</small><b>" + T.time(new Date(t.back.arrive)) + "</b></div>" : "") + "</div>" +
      switchRow2("trip-notify", "Remind me", "Notifications for each step while the app is open, plus calendar alarms", t.notify, t.id) +
      '<div class="result__actions result__actions--tight"><button class="btn btn--ghost btn--sm" type="button" data-action="trip-ics" data-id="' + t.id + '">' + icon("calendar") + "Add to calendar</button>" +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="trip-share" data-id="' + t.id + '">' + icon("share") + "Share</button>" +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=' + t.from.lat + "," + t.from.lng + "&destination=" + t.to.lat + "," + t.to.lng + '&travelmode=transit">' + icon("map") + "Google Maps</a></div></div>" +
      '<div class="mini-map mini-map--tall card" id="trip-map"></div>' +
      '<div class="card"><div class="sec-head"><h3>' + icon("route") + " Getting there</h3><span class=\"muted\">" + T.peso(t.option.fare) + "/person</span></div>" + legsTimeline(t.option, { toName: t.to.name, check: true, done: t.done, prefix: "o" }) + "</div>" +
      (t.day.steps.length ? '<div class="card"><h3 class="h3">' + icon("sparkle") + " Your day</h3>" + dayTimeline(t.day, { check: true, done: t.done }) + "</div>" : "") +
      (t.back ? '<div class="card"><div class="sec-head"><h3>' + icon("home") + " Going home</h3><span class=\"muted\">" + T.peso(t.back.fare) + "/person</span></div>" + legsTimeline(t.back, { toName: t.from.name, check: true, done: t.done, prefix: "b" }) + "</div>" : "") +
      '<div class="card"><h3 class="h3">' + icon("bell") + " Reminders</h3>" + reminderList(t) + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("wallet") + " Budget</h3>" + budgetCard(t) + "</div>";
    mount(html, { nav: "trips" });
    var m = T.maps.make($("#trip-map"), t.to, 12);
    if (m) {
      var pts = [[t.from.lat, t.from.lng]];
      t.option.legs.forEach(function (l) { pts.push([l.to.lat, l.to.lng]); });
      L.polyline(pts, { color: "#f57a3d", weight: 4, opacity: 0.9, dashArray: "8 8" }).addTo(m);
      L.marker([t.from.lat, t.from.lng], { icon: T.maps.me() }).addTo(m).bindPopup(esc(t.from.label));
      t.day.steps.forEach(function (s, i) { if (s.place) L.marker([s.place.lat, s.place.lng], { icon: T.maps.pin(s.place, i + 1) }).addTo(m).bindPopup(esc(s.name)); });
      L.marker([t.to.lat, t.to.lng], { icon: T.maps.pin({ cat: (T.places.get(t.to.placeId) || {}).cat || "other" }) }).addTo(m);
      m.fitBounds(pts, { padding: [24, 24] });
    }
  };
  function switchRow2(action, title, sub, on, id) {
    return '<label class="switch"><span><strong>' + icon("bell") + " " + title + "</strong><small>" + sub + '</small></span><input type="checkbox" data-input="' + action + '" data-id="' + id + '"' + (on ? " checked" : "") + '><span class="switch__ui"></span></label>';
  }
  T.inputs["trip-check"] = function (el) {
    var t = T.trips.get(T.router.parse().param);
    t.done = t.done || {};
    t.done[el.dataset.key] = el.checked;
    T.trips.update(t);
    el.closest(".tl__item").classList.toggle("is-done", el.checked);
  };
  T.inputs["trip-notify"] = function (el) {
    var t = T.trips.get(el.dataset.id);
    var on = el.checked;
    var finish = function (granted) {
      t.notify = on;
      T.trips.update(t);
      T.scheduleReminders && T.scheduleReminders();
      T.toast(on ? "Reminders on" : "Reminders off", on ? (granted ? "We'll notify you at each step while Tara is open. Add to calendar for alarms when it's closed." : "Notifications are blocked — you'll see in-app alerts. Use “Add to calendar” for phone alarms.") : "", "bell");
    };
    if (on && window.Notification && Notification.permission === "default") Notification.requestPermission().then(function (p) { finish(p === "granted"); });
    else finish(window.Notification && Notification.permission === "granted");
  };
  T.actions["trip-ics"] = function (el) { downloadIcs(T.trips.get(el.dataset.id)); };
  T.actions["trip-share"] = function (el) { shareTrip(T.trips.get(el.dataset.id)); };
  T.actions["trip-delete"] = function (el) {
    T.sheet.open("Delete this trip?", '<p class="muted">This removes the trip and its reminders from this device.</p><div class="result__actions"><button class="btn btn--danger" type="button" data-action="trip-delete-yes" data-id="' + el.dataset.id + '">' + icon("trash") + 'Delete trip</button><button class="btn btn--ghost" type="button" data-action="close-sheet">Cancel</button></div>');
  };
  T.actions["trip-delete-yes"] = function (el) {
    T.trips.remove(el.dataset.id);
    T.sheet.close();
    T.toast("Trip deleted", "", "trash");
    T.router.go("trips", true);
  };

  /* ======================================================================
     PROFILE
     ====================================================================== */
  T.views.profile = function () {
    var u = T.auth.current() || {};
    var here = T.location.get();
    var favs = T.favs.list().map(function (id) { return T.places.get(id); }).filter(Boolean);
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var notif = window.Notification ? Notification.permission : "unsupported";
    var html = pageHead("Profile") +
      '<div class="card profile-card">' + avatar(u, "lg") + "<div><h2>" + esc(u.name || "Traveler") + "</h2><p class=\"muted\">" + esc(u.guest ? "Guest — create an account to keep your trips under your name" : u.email || "") + "</p></div>" +
      '<button class="icon-btn" type="button" data-action="edit-name" aria-label="Edit name">' + icon("edit") + "</button></div>" +
      '<div class="card"><h3 class="h3">' + icon("id") + " Traveler type</h3>" + travelerSeg(u.type || "regular", "profile-type") + '<p class="fine" id="type-note">' + typeNote(u.type || "regular") + "</p></div>" +
      '<div class="card"><h3 class="h3">' + icon("pin") + " Locations</h3>" +
      '<button class="pick-item" type="button" data-action="change-location">' + icon("locate") + "<span><strong>Current location</strong><small>" + esc(here.label) + "</small></span>" + icon("edit") + "</button>" +
      '<button class="pick-item" type="button" data-action="set-home">' + icon("home") + "<span><strong>Home</strong><small>" + esc(u.home ? u.home.label : "Not set") + "</small></span>" + icon("edit") + "</button></div>" +
      '<div class="card"><div class="sec-head"><h3>' + icon("heart") + " Saved places</h3><span class=\"muted\">" + favs.length + "</span></div>" +
      (favs.length ? '<div class="rows">' + favs.map(function (p) { return placeRow(p, T.geo.distance(here, p)); }).join("") + "</div>" : '<p class="muted">Tap the heart on any place to save it here.</p>') + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("sparkle") + " App</h3>" +
      '<label class="switch"><span><strong>' + icon("moon") + ' Dark mode</strong><small>Easier on the eyes at night</small></span><input type="checkbox" data-input="theme"' + (dark ? " checked" : "") + '><span class="switch__ui"></span></label>' +
      '<button class="pick-item" type="button" data-action="notif">' + icon("bell") + "<span><strong>Notifications</strong><small>" + (notif === "granted" ? "Allowed" : notif === "denied" ? "Blocked in browser settings" : notif === "unsupported" ? "Not supported on this browser" : "Tap to allow trip reminders") + "</small></span></button>" +
      '<button class="pick-item install-btn" type="button" data-action="install">' + icon("download") + "<span><strong>Install Tara</strong><small>Add to your home screen — works offline</small></span></button></div>" +
      '<div class="card"><h3 class="h3">' + icon("info") + " Your data</h3><p class=\"muted\">Your account, trips, saved places and reviews are stored privately on this device. Nothing is uploaded.</p>" +
      '<div class="result__actions result__actions--tight">' + (u.guest ? '<a class="btn btn--primary btn--sm" href="#/signup">Create account</a>' : "") +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="logout">' + icon("logout") + (u.guest ? "Exit guest mode" : "Log out") + "</button>" +
      '<button class="btn btn--ghost btn--sm danger" type="button" data-action="wipe">' + icon("trash") + "Delete my data</button></div></div>" +
      '<p class="fine center">Tara · Map data © OpenStreetMap contributors · Weather by Open-Meteo · Photos via Wikipedia</p>';
    mount(html, { nav: "profile" });
  };
  T.actions["set-home"] = function () {
    T.pickLocation({ mode: "location", onPick: function (loc) { T.auth.update({ home: { label: loc.label, lat: loc.lat, lng: loc.lng, approx: !!loc.approx } }); T.toast("Home saved", loc.label, "home"); T.router.resolve(); } });
  };
  T.actions["edit-name"] = function () {
    var u = T.auth.current();
    T.sheet.open("Edit name", '<form class="form" data-submit="edit-name"><label class="field"><span class="field__label">Name</span><input class="input" name="name" value="' + esc(u.name) + '" autofocus required></label><button class="btn btn--primary btn--block" type="submit">Save</button></form>');
  };
  T.submits["edit-name"] = function (form) {
    var n = form.name.value.trim();
    if (!n) return;
    T.auth.update({ name: n });
    T.sheet.close();
    T.router.resolve();
  };
  T.inputs.theme = function (el) { T.setTheme(el.checked ? "dark" : "light"); };
  T.actions.notif = function () {
    if (!window.Notification) return T.toast("Not supported", "Use “Add to calendar” for reminders.", "info");
    Notification.requestPermission().then(function () { T.router.resolve(); });
  };
  T.actions.logout = function () { T.auth.logout(); T.state.plan = null; T.state.draft = null; T.router.go("welcome", true); };
  T.actions.wipe = function () {
    T.sheet.open("Delete all data?", '<p class="muted">This deletes every account, trip, review and saved place stored by Tara on this device. This can’t be undone.</p><div class="result__actions"><button class="btn btn--danger" type="button" data-action="wipe-yes">' + icon("trash") + 'Delete everything</button><button class="btn btn--ghost" type="button" data-action="close-sheet">Cancel</button></div>');
  };
  T.actions["wipe-yes"] = function () {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf("tara.") === 0) localStorage.removeItem(k); }); } catch (e) {}
    location.hash = "#/welcome";
    location.reload();
  };

  T.views.notfound = function () { mount(pageHead("Not found", { back: true }) + empty("compass", "Wrong turn", "This page doesn't exist.", '<a class="btn btn--primary" href="#/home">Go home</a>')); };
  T.actions.back = function () { if (history.length > 1) history.back(); else T.router.go("home"); };
})();
