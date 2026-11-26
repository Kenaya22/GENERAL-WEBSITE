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
    if (T.live) T.live.stop();
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
    var cls = "avatar" + (size ? " avatar--" + size : "");
    if (u && u.photo) return '<span class="' + cls + ' avatar--img"><img src="' + esc(u.photo) + '" alt=""></span>';
    return '<span class="' + cls + '">' + esc(T.initials(u ? u.name : "?")) + "</span>";
  }
  T.avatar = avatar;
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
    var title = opts.title || (pickMode === "destination" ? "Where to?" : pickMode === "origin" ? "Starting point" : "Your location");
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
  function pickCityBtn(c) {
    var n = T.dest.count({ type: "city", id: c.id });
    return '<button class="pick-item" type="button" data-action="pick-city" data-id="' + c.id + '"><span class="pick-ic cat--other">' + icon("map") + "</span><span><strong>" + esc(c.name) + " (whole city)</strong><small>" + esc(c.provinceName) + " · " + n + " things to do</small></span></button>";
  }
  function pickDefaults() {
    if (pickMode !== "destination") return "";
    var here = T.location.get();
    return '<p class="label">Popular places</p>' + C.dayTrips.concat(["rizal-shrine", "pansol"]).map(function (id) {
      var p = T.places.get(id);
      return p ? pickPlaceBtn(p, T.geo.distance(here, p)) : "";
    }).join("") + '<p class="label">Or plan a whole city</p>' + C.popularCities.slice(0, 6).map(function (id) { return pickCityBtn(T.dest.city(id)); }).join("");
  }
  T.actions["pick-city"] = function (el) {
    var c = T.dest.city(el.dataset.id);
    finishPick({ name: c.name, label: T.dest.label(c), lat: c.lat, lng: c.lng, cityId: c.id });
  };
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
    var cityHits = pickMode === "destination" ? T.dest.cities().filter(function (c) { return c.name.toLowerCase().indexOf(q.toLowerCase()) > -1; }).slice(0, 3) : [];
    var localHtml = (cityHits.length ? '<p class="label">Cities</p>' + cityHits.map(pickCityBtn).join("") : "") +
      (local.length ? '<p class="label">Places</p>' + local.map(function (x) { return pickPlaceBtn(x.p, x.d); }).join("") : "");
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
    finishPick({ name: p.name, label: p.name + ", " + p.area, lat: p.lat, lng: p.lng, placeId: p.id, cityId: p.city });
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
      '<div class="field"><span class="field__label">Fare discount <em class="opt-tag">optional</em></span>' + travelerSeg("regular", "signup-type") +
      '<p class="fine" id="type-note">' + typeNote("regular") + "</p></div>" +
      '<p class="form__error" role="alert" hidden></p>' +
      '<button class="btn btn--primary btn--block" type="submit">Sign up</button>' +
      '<p class="fine center">' + (T.cloud && T.cloud.enabled() ? "Your account works on any phone — log in to see your trips everywhere." : "Your account is saved securely on this device.") + "</p>" +
      '<p class="center">Already have an account? <a class="link" href="#/login">Log in</a></p>' +
      "</form>"), { auth: true });
  };
  function field(name, label, type, ph, ac, eye) {
    return '<label class="field"><span class="field__label">' + label + '</span><span class="input-wrap"><input class="input" name="' + name + '" type="' + type + '" placeholder="' + ph + '" autocomplete="' + ac + '" required>' +
      (eye ? '<button class="input-eye" type="button" data-action="toggle-eye" aria-label="Show password">' + icon("eye") + "</button>" : "") + "</span></label>";
  }
  function travId(id) { return (C.travelerAliases || {})[id] || id || "regular"; }
  function travelerSeg(cur, name) {
    cur = travId(cur);
    return '<div class="seg seg--2" role="radiogroup">' + C.travelerTypes.map(function (t) {
      return '<label class="seg__opt"><input type="radio" name="' + name + '" value="' + t.id + '"' + (t.id === cur ? " checked" : "") + ' data-input="traveler-note"><span>' + esc(t.short) + "</span></label>";
    }).join("") + "</div>";
  }
  function typeNote(id) {
    var t = C.travelerTypes.filter(function (x) { return x.id === travId(id); })[0];
    if (!t || t.id === "regular") return "Regular fares are used by default. Students, seniors and PWD get the same discount — pick it if you have an ID.";
    return "You'll see " + Math.round(t.road * 100) + "% off jeepney, tricycle & bus fares and " + Math.round(t.rail * 100) + "% off LRT/MRT, plus discounted entrance fees. Bring your " + t.id_name + ".";
  }
  T.inputs["traveler-note"] = function (el) {
    var n = $("#type-note");
    if (n) n.textContent = typeNote(el.value);
    if (el.name === "profile-type") { T.auth.update({ type: el.value }); T.toast("Fare type updated", el.value === "regular" ? "Fares now use regular rates." : "Student / senior / PWD discount is on.", "id"); }
    if (el.name === "plan-type") { T.state.draft.type = el.value; T.state.draft.optionId = null; }
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
      .catch(function (err) {
        busy(btn, false);
        if (err.confirm) { T.toast("Almost done!", err.message, "check"); T.router.go("login", true); return; }
        formError(form, err.message);
      });
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
    var curCity = T.dest.current();
    var near = curCity ? T.places.query({ near: here, scope: { type: "city", id: curCity.id }, sort: "rating" }) : [];
    if (near.length < 4) near = T.places.query({ near: here }).slice(0, 8);
    var trip = T.trips.next();
    var html =
      '<section class="home-hero">' +
      '<div class="home-hero__top">' +
      '<button class="loc-chip" type="button" data-action="change-location">' + icon("pin") + "<span><small>You're in</small><strong>" + esc(here.label) + "</strong></span>" + icon("chev-r") + "</button>" +
      '<a href="#/profile" aria-label="Profile">' + avatar(u) + "</a></div>" +
      '<h1 class="home-hero__hi">' + esc(T.greeting()) + ", " + esc((u && u.name || "Traveler").split(" ")[0]) + "!</h1>" +
      '<p class="home-hero__sub">Tara, lakad tayo! Where to today? <span class="wx" id="home-wx"></span></p>' +
      '<a class="search-bar" href="#/explore?focus=1">' + icon("search") + "<span>Search cafés, food, malls, parks…</span></a>" +
      '<div class="quick">' +
      '<a href="#/plan?days=1">' + icon("sun") + "Day trip</a>" +
      '<a href="#/plan?days=2">' + icon("bed") + "Weekend getaway</a>" +
      '<a href="#/explore?cat=food">' + icon("utensils") + "Food trip</a>" +
      '<a href="#/explore?cat=cafe">' + icon("coffee") + "Café hopping</a></div>" +
      heroDeco() +
      "</section>" +
      '<section class="section"><div class="cats">' + C.categories.map(function (c, i) {
        return '<a class="cat-tile cat--' + c.id + '" style="--d:' + i * 40 + 'ms" href="#/explore?cat=' + c.id + '"><span>' + icon(c.icon) + "</span>" + esc(c.short) + "</a>";
      }).join("") + "</div></section>" +
      (trip ? '<section class="section">' + nextTripCard(trip) + "</section>" : "") +
      '<section class="section"><div class="sec-head"><h2>' + icon("fire") + ' Featured trips</h2></div>' +
      '<div class="feature" id="feature">' + C.dayTrips.map(function (id) { var p = T.places.get(id); return p ? featureSlide(p) : ""; }).join("") + "</div>" +
      '<div class="feature-dots" id="feature-dots">' + C.dayTrips.map(function (id, i) { return '<button type="button" data-action="feature-go" data-i="' + i + '" aria-label="Slide ' + (i + 1) + '"' + (i ? "" : ' aria-current="true"') + "></button>"; }).join("") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Trip ideas</h2></div><div class="ideas">' + tripIdeas().map(ideaCard).join("") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Destinations</h2><button class="link-strong" type="button" data-action="home-dest">All destinations</button></div>' +
      '<div class="hscroll hscroll--dest">' + C.popularCities.map(function (id) {
        var c = T.dest.city(id), n = cityCount(c);
        return '<a class="dcard" href="#/city/' + c.id + '"><div class="ph dcard__ph" data-photo="city:' + c.id + '">' + T.art({ name: c.name, cat: "other" }) + '</div><span class="dcard__shade"></span>' +
          '<span class="dcard__body"><small>' + esc(c.provinceName) + "</small><strong>" + esc(c.name) + "</strong><em>" + n + " thing" + (n === 1 ? "" : "s") + " to do</em></span></a>";
      }).join("") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>' + (curCity && near[0] && near[0].p.city === curCity.id ? "Popular in " + esc(curCity.name) : "Popular near you") + '</h2><a href="#/explore">See all</a></div>' +
      '<div class="hscroll">' + near.map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Around ' + esc(here.label.split(",")[0]) + '</h2><a href="#/explore">More</a></div>' +
      '<div class="rows" id="home-nearby">' + loader("Finding places around you…") + "</div></section>" +
      '<section class="section"><div class="sec-head"><h2>Day trips from ' + esc((here.label.split(",")[1] || here.label.split(",")[0]).trim()) + "</h2></div>" +
      '<div class="trip-grid">' + C.dayTrips.map(function (id) { return dayTripCard(T.places.get(id), here); }).join("") + "</div></section>" +
      cafeSection(here, curCity) +
      '<section class="section">' + discountCard() + "</section>" +
      '<a class="made-by" href="#/about"><span class="studio-mark studio-mark--sm" aria-hidden="true"><span>K</span><i>&amp;</i><span>A</span></span><span>Made with love by <b>K &amp; A Studios</b></span>' + icon("chev-r") + "</a>";
    mount(html, { nav: "home" });
    startFeature();

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
  function heroDeco() {
    return '<div class="hero-deco" aria-hidden="true"><span class="hero-sun"></span><span class="hero-cloud hero-cloud--1"></span><span class="hero-cloud hero-cloud--2"></span>' +
      '<span class="hero-road"></span><span class="hero-jeep">' + icon("jeep") + "</span></div>";
  }
  function featureSlide(p) {
    var o = T.planner.quick(T.location.get(), p);
    return '<a class="fslide" href="#/plan?to=' + encodeURIComponent(p.id) + '">' + photo(p, "fslide__ph") + '<span class="fslide__shade"></span>' +
      '<span class="fslide__body">' + catChip(p) + "<strong>" + esc(p.name) + "</strong><small>" + esc(p.area) + "</small>" +
      (o ? "<em>" + icon("clock") + T.dur(o.minutes) + " · from " + T.peso(o.fare) + "</em>" : "") + '<span class="fslide__cta">Plan this trip ' + icon("arrow") + "</span></span></a>";
  }
  var featTimer = null;
  function startFeature() {
    clearInterval(featTimer);
    var box = $("#feature");
    if (!box) return;
    var dots = $$("#feature-dots button");
    var idx = function () { return Math.round(box.scrollLeft / Math.max(1, box.clientWidth)); };
    box.addEventListener("scroll", function () {
      var i = idx();
      dots.forEach(function (d, k) { if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
    }, { passive: true });
    if (T.reduceMotion) return;
    var paused = false;
    box.addEventListener("pointerdown", function () { paused = true; });
    featTimer = setInterval(function () {
      if (!document.body.contains(box)) { clearInterval(featTimer); return; }
      if (paused || document.hidden) return;
      var n = (idx() + 1) % dots.length;
      box.scrollTo({ left: n * box.clientWidth, behavior: "smooth" });
    }, 4500);
  }
  T.actions["feature-go"] = function (el) {
    var box = $("#feature");
    if (box) box.scrollTo({ left: Number(el.dataset.i) * box.clientWidth, behavior: T.reduceMotion ? "auto" : "smooth" });
  };
  function tripIdeas() {
    return [
      { title: "Rizal's hometown", sub: "Shrine, church, plaza & market", photo: "rizal-shrine", href: "#/plan?city=calamba", days: 1 },
      { title: "Intramuros + National Museum", sub: "2 stops · walls, churches & art", photo: "nm-fine-arts", href: "#/plan?stops=intramuros,nm-fine-arts", days: 1 },
      { title: "Tagaytay & Taal weekend", sub: "2 stops · cool air & heritage town", photo: "taal-basilica", href: "#/plan?stops=tagaytay,taal&days=2", days: 2 },
      { title: "Hot spring getaway", sub: "Pansol pools & Los Baños", photo: "pansol", href: "#/plan?stops=pansol,los-banos&days=2", days: 2 },
    ];
  }
  function ideaCard(x) {
    var p = T.places.get(x.photo);
    return '<a class="idea" href="' + x.href + '">' + (p ? photo(p, "idea__ph") : "") + '<span class="idea__shade"></span>' +
      '<span class="idea__badge">' + icon(x.days > 1 ? "bed" : "sun") + (x.days > 1 ? x.days + " days" : "Day tour") + "</span>" +
      '<span class="idea__body"><strong>' + esc(x.title) + "</strong><small>" + esc(x.sub) + "</small></span></a>";
  }
  function cafeSection(here, curCity) {
    var list = curCity ? T.places.query({ near: here, cat: "cafe", scope: { type: "city", id: curCity.id }, sort: "rating" }) : [];
    if (list.length < 2) list = T.places.query({ near: here, cat: "cafe" }).slice(0, 6);
    if (!list.length) return "";
    var where = curCity && list[0].p.city === curCity.id ? curCity.name : "near you";
    return '<section class="section"><div class="sec-head"><h2>' + icon("coffee") + " Coffee break in " + esc(where) + '</h2><a href="#/explore?cat=cafe' + (curCity ? "&city=" + curCity.id : "") + '">See all</a></div>' +
      '<div class="hscroll">' + list.map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>";
  }
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
      return '<div class="note-card note-card--ok">' + icon("id") + "<div><strong>Student / senior / PWD discount is on</strong><p>Fares show " + Math.round(t.road * 100) + "% off jeep, tricycle & bus and " + Math.round(t.rail * 100) + "% off LRT/MRT. Remember your ID.</p></div></div>";
    }
    return '<a class="note-card" href="#/profile">' + icon("id") + "<div><strong>Student, senior or PWD?</strong><p>Optional: turn on your discount for 20% off jeep & bus and 50% off LRT/MRT.</p></div>" + icon("chev-r") + "</a>";
  }
  function nextTripCard(trip) {
    var dep = new Date(trip.option.depart);
    var live = new Date() >= T.addMin(dep, -60);
    return '<a class="next-trip" href="#/' + (live ? "live/" : "trip/") + trip.id + '"><div class="next-trip__top"><span class="badge">' + icon(live ? "route" : "ticket") + (live ? "Trip in progress" : "Next trip") + "</span><span>" + esc(live ? "Open live guide →" : countdown(dep)) + "</span></div>" +
      "<h3>" + esc(trip.name) + "</h3><p>" + esc(T.date(dep)) + " · leave home " + esc(T.time(dep)) + " · " + esc(trip.option.title) + "</p></a>";
  }
  T.actions["home-dest"] = function () { T.pickDest({ onPick: function (sc) { T.router.go(sc.type === "city" ? "city/" + sc.id : "explore?province=" + sc.id); } }); };
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
     DESTINATIONS (Klook-style): pick a city or a whole province
     ====================================================================== */
  var destCb = null;
  function cityCount(c) { return T.dest.count({ type: "city", id: c.id }); }
  function cityTile(c) {
    return '<button class="dest-tile" type="button" data-action="dest-pick" data-type="city" data-id="' + c.id + '">' +
      '<div class="ph dest-tile__ph" data-photo="city:' + c.id + '">' + T.art({ name: c.name, cat: "other" }) + "</div>" +
      '<span class="dest-tile__shade"></span><span class="dest-tile__body"><strong>' + esc(c.name) + "</strong><small>" + esc(c.provinceName) + "</small></span></button>";
  }
  function cityRow(c) {
    var n = cityCount(c);
    return '<button class="pick-item" type="button" data-action="dest-pick" data-type="city" data-id="' + c.id + '">' + icon("pin") +
      "<span><strong>" + esc(c.name) + "</strong><small>" + esc(c.provinceName) + " · " + n + " place" + (n === 1 ? "" : "s") + "</small></span>" + icon("chev-r") + "</button>";
  }
  function destDefault() {
    return '<p class="label">Popular destinations</p><div class="dest-grid">' + C.popularCities.map(function (id) { return cityTile(T.dest.city(id)); }).join("") + "</div>" +
      '<p class="label">Browse by province</p>' + T.dest.provinces().map(function (pv) {
        var n = T.dest.count({ type: "province", id: pv.id });
        return '<details class="prov"><summary><span><strong>' + esc(pv.name) + "</strong><small>" + esc(pv.blurb) + " · " + n + " places</small></span>" + icon("chev-r") + "</summary>" +
          '<button class="pick-item pick-item--all" type="button" data-action="dest-pick" data-type="province" data-id="' + pv.id + '">' + icon("map") + "<span><strong>All of " + esc(pv.name) + "</strong><small>" + pv.cities.length + " cities and towns</small></span></button>" +
          pv.cities.map(cityRow).join("") + "</details>";
      }).join("");
  }
  T.pickDest = function (opts) {
    destCb = opts.onPick;
    var cur = T.dest.current();
    var body = T.sheet.open("Where to explore?",
      '<div class="search-field">' + icon("search") + '<input class="input" type="search" autocomplete="off" data-input="dest-q" placeholder="Search a city, town or province"></div>' +
      (cur ? '<button class="locate-btn" type="button" data-action="dest-pick" data-type="city" data-id="' + cur.id + '">' + icon("locate") + "<span><strong>Near you · " + esc(cur.name) + "</strong><small>" + esc(cur.provinceName) + " · " + cityCount(cur) + " featured places + live places nearby</small></span></button>" : "") +
      '<div id="dest-results">' + destDefault() + "</div>", { size: "tall" });
    T.photos.hydrate(body);
  };
  T.inputs["dest-q"] = function (el) {
    var q = el.value.trim().toLowerCase(), box = $("#dest-results");
    if (!q) { box.innerHTML = destDefault(); T.photos.hydrate(box); return; }
    var provs = T.dest.provinces().filter(function (pv) { return pv.name.toLowerCase().indexOf(q) > -1; });
    var cities = T.dest.cities().filter(function (c) { return (c.name + " " + c.provinceName).toLowerCase().indexOf(q) > -1; });
    box.innerHTML = (provs.length ? '<p class="label">Provinces</p>' + provs.map(function (pv) {
      return '<button class="pick-item" type="button" data-action="dest-pick" data-type="province" data-id="' + pv.id + '">' + icon("map") + "<span><strong>All of " + esc(pv.name) + "</strong><small>" + pv.cities.length + " cities and towns</small></span>" + icon("chev-r") + "</button>";
    }).join("") : "") + (cities.length ? '<p class="label">Cities & towns</p>' + cities.map(cityRow).join("") : "") +
      (!provs.length && !cities.length ? '<p class="fine">No destination matches “' + esc(el.value) + "”. We're adding more cities soon.</p>" : "");
  };
  T.actions["dest-pick"] = function (el) {
    var cb = destCb; destCb = null;
    T.sheet.close();
    if (cb) cb({ type: el.dataset.type, id: el.dataset.id });
  };

  /* ======================================================================
     EXPLORE — places in one destination at a time
     ====================================================================== */
  function scopeLabel(sc) {
    if (!sc) return { name: "All destinations", sub: "Every featured place" };
    if (sc.type === "province") { var pv = T.dest.province(sc.id); return { name: "All of " + pv.name, sub: pv.blurb }; }
    var c = T.dest.city(sc.id); return { name: c.name, sub: c.provinceName };
  }
  function isHereScope(sc) { var cur = T.dest.current(); return !!(sc && cur && sc.type === "city" && sc.id === cur.id); }
  T.views.explore = function (r) {
    var st = T.state.explore;
    if (r.query.city) st.scope = { type: "city", id: r.query.city };
    else if (r.query.province) st.scope = { type: "province", id: r.query.province };
    else if (st.scope === undefined) { var cur = T.dest.current(); st.scope = cur ? { type: "city", id: cur.id } : null; }
    if (r.query.cat != null) st.cat = r.query.cat;
    if (r.query.q != null) st.q = r.query.q;
    var here = T.location.get();
    var lab = scopeLabel(st.scope), mine = isHereScope(st.scope);
    var html =
      '<header class="ex-head">' +
      '<button class="dest-btn" type="button" data-action="explore-dest"><small>' + (mine ? icon("locate") + "Exploring near you" : "Exploring") + "</small>" +
      "<strong>" + esc(lab.name) + icon("chev-r", "dest-btn__chev") + "</strong><span>" + esc(lab.sub) + "</span></button>" +
      (st.scope && st.scope.type === "city" ? '<a class="btn btn--ghost btn--sm" href="#/city/' + st.scope.id + '">' + icon("info") + "City guide</a>" : "") +
      "</header>" +
      '<div class="explore-bar">' +
      '<div class="search-field">' + icon("search") + '<input class="input" id="ex-q" type="search" placeholder="Search in ' + esc(lab.name) + '…" value="' + esc(st.q) + '" data-input="explore-q"' + (r.query.focus ? " autofocus" : "") + "></div>" +
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
    if (!mine && st.scope && st.scope.type === "city") loadCityLive(st.scope.id);
    if (mine && !T.state.nearby.length) {
      $("#ex-live").innerHTML = loader("Loading live places near you…");
      loadNearby(here, function (items) {
        if (!$("#ex-live")) return;
        $("#ex-live").innerHTML = items ? "" : '<p class="fine center">Offline — showing featured places only. Connect to see every restaurant, mall and park near you.</p>';
        if (items) renderExplore();
      });
    }
  };
  T.state.cityLive = T.state.cityLive || {};
  /* live cafés, restaurants, malls… for a chosen city (OpenStreetMap), not only for "near you" */
  function loadCityLive(id) {
    var c = T.dest.city(id), box = $("#ex-live");
    if (!c || T.state.cityLive[id]) return;
    if (box) box.innerHTML = loader("Loading more places in " + c.name + "…");
    T.places.nearby({ lat: c.lat, lng: c.lng }, Math.min(6000, Math.round(c.radius * 1000))).then(function (items) {
      T.state.cityLive[id] = items.filter(function (p) { return p.city === id; });
      if ($("#ex-live")) $("#ex-live").innerHTML = "";
      renderExplore();
    }).catch(function () {
      if ($("#ex-live")) $("#ex-live").innerHTML = '<p class="fine center">Offline — showing featured places in ' + esc(c.name) + " only.</p>";
    });
  }
  function exploreList(scope) {
    var st = T.state.explore, here = T.location.get();
    var sc = scope === undefined ? st.scope : scope;
    var extra = isHereScope(st.scope) || scope === null ? T.state.nearby : [];
    if (sc && sc.type === "city" && T.state.cityLive[sc.id]) extra = extra.concat(T.state.cityLive[sc.id].filter(function (p) { return extra.indexOf(p) < 0; }));
    return T.places.query({ cat: st.cat || null, q: st.q, near: here, sort: st.sort, scope: sc, extra: extra });
  }
  function renderExplore() {
    var st = T.state.explore, here = T.location.get();
    var list = exploreList();
    var box = $("#ex-results"), mapEl = $("#ex-map");
    if (!box) return;
    $("#ex-count").textContent = list.length + " place" + (list.length === 1 ? "" : "s");
    var center = st.scope && st.scope.type === "city" ? T.dest.city(st.scope.id) : list[0] ? list[0].p : here;
    if (st.mode === "map") {
      box.hidden = true; mapEl.hidden = false;
      T._maps.forEach(function (m) { try { m.remove(); } catch (e) {} });
      T._maps = [];
      mapEl.innerHTML = "";
      var m = T.maps.make(mapEl, center, 13);
      if (!m) return;
      var pts = [];
      if (isHereScope(st.scope) || !st.scope) { L.marker([here.lat, here.lng], { icon: T.maps.me() }).addTo(m).bindPopup("You are here"); pts.push([here.lat, here.lng]); }
      list.slice(0, 150).forEach(function (x) {
        var p = x.p;
        L.marker([p.lat, p.lng], { icon: T.maps.pin(p) }).addTo(m)
          .bindPopup('<a class="map-pop" href="#/place/' + encodeURIComponent(p.id) + '"><strong>' + esc(p.name) + "</strong><span>" + esc(T.cat(p.cat).label) + " · " + T.km(x.d) + " from you</span></a>");
        pts.push([p.lat, p.lng]);
      });
      if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
      return;
    }
    box.hidden = false; mapEl.hidden = true;
    var lab = scopeLabel(st.scope);
    var html = list.length ? '<div class="rows">' + list.slice(0, 80).map(function (x) { return placeRow(x.p, x.d); }).join("") + "</div>"
      : empty("search", "Nothing here yet", st.q ? "No match in " + lab.name + "." : "No " + (st.cat ? T.cat(st.cat).label.toLowerCase() : "places") + " listed in " + lab.name + " yet.",
        '<button class="btn btn--ghost" type="button" data-action="explore-dest">' + icon("map") + "Browse other destinations</button>");
    // Search across every destination when the current one has few matches
    if (st.q && st.scope && list.length < 6) {
      var ids = list.map(function (x) { return x.p.id; });
      var others = exploreList(null).filter(function (x) { return ids.indexOf(x.p.id) < 0; }).slice(0, 12);
      if (others.length) html += '<p class="label">In other destinations</p><div class="rows">' + others.map(function (x) { return placeRow(x.p, x.d); }).join("") + "</div>";
    }
    box.innerHTML = html;
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
  T.actions["explore-dest"] = function () {
    T.pickDest({ onPick: function (sc) { T.state.explore.scope = sc; T.state.explore.q = ""; T.router.go("explore", true); } });
  };

  /* ======================================================================
     CITY GUIDE — Klook-style destination page
     ====================================================================== */
  T.views.city = function (r) {
    var c = T.dest.city(r.param);
    if (!c) { mount(pageHead("Destination", { back: true }) + empty("map", "Destination not found", "Try another city.", '<a class="btn btn--primary" href="#/explore">Explore</a>'), { nav: "explore" }); return; }
    var here = T.location.get();
    var d = T.geo.distance(here, c);
    var quick = d > 3 ? T.planner.quick(here, { name: c.name, lat: c.lat, lng: c.lng }) : null;
    var all = T.places.query({ near: c, scope: { type: "city", id: c.id }, sort: "rating" });
    var todo = all.filter(function (x) { return ["food", "cafe", "market", "mall"].indexOf(x.p.cat) < 0; });
    var eat = all.filter(function (x) { return x.p.cat === "food" || x.p.cat === "cafe"; });
    var shop = all.filter(function (x) { return x.p.cat === "market" || x.p.cat === "mall"; });
    var prov = T.dest.province(c.province);
    var dh = function (x) { return { p: x.p, d: T.geo.distance(here, x.p) }; };
    var html =
      '<div class="place-hero">' + '<div class="ph place-hero__ph" data-photo="city:' + c.id + '">' + T.art({ name: c.name, cat: "other" }) + "</div>" + '<div class="place-hero__shade"></div>' +
      '<div class="place-hero__bar"><button class="icon-btn icon-btn--glass" type="button" data-action="back" aria-label="Back">' + icon("chev-l") + '</button><span class="grow"></span></div>' +
      '<div class="place-hero__title"><a class="crumb crumb--light" href="#/explore?province=' + prov.id + '">' + esc(prov.name) + "</a><h1>" + esc(c.name) + "</h1><p>" + esc(c.blurb) + "</p></div></div>" +
      '<div class="place-body">' +
      '<div class="place-stats">' +
      '<div class="stat"><strong class="stat__big">' + all.length + "</strong><small>featured places</small></div>" +
      '<div class="stat"><strong class="stat__big">' + T.km(d) + "</strong><small>from you</small>" + (quick ? "<small>" + T.dur(quick.minutes) + " · from " + T.peso(quick.fare) + "</small>" : "") + "</div>" +
      '<div class="stat"><strong class="stat__big" id="city-wx">—</strong><small>weather now</small></div></div>' +
      '<div class="place-actions"><a class="btn btn--primary" href="#/plan?city=' + c.id + '">' + icon("route") + "Plan a day here</a>" +
      '<a class="btn btn--ghost" href="#/explore?city=' + c.id + '">' + icon("compass") + "All places</a></div>" +
      (todo.length ? '<section class="psec"><div class="sec-head"><h2>Top things to do</h2></div><div class="hscroll">' + todo.map(dh).map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>" : "") +
      (eat.length ? '<section class="psec"><div class="sec-head"><h2>Where to eat</h2></div><div class="rows">' + eat.map(dh).map(function (x) { return placeRow(x.p, x.d); }).join("") + "</div></section>" : "") +
      (shop.length ? '<section class="psec"><div class="sec-head"><h2>Shopping & pasalubong</h2></div><div class="rows">' + shop.map(dh).map(function (x) { return placeRow(x.p, x.d); }).join("") + "</div></section>" : "") +
      (!all.length ? '<p class="muted psec">We\'re still adding featured places in ' + esc(c.name) + ". When you're there, Explore shows live restaurants, malls and parks around you.</p>" : "") +
      '<section class="psec"><h2>Map</h2><div class="mini-map mini-map--tall" id="city-map"></div></section>' +
      '<section class="psec"><h2>More in ' + esc(prov.name) + '</h2><div class="stop-chips">' + prov.cities.filter(function (x) { return x.id !== c.id; }).map(function (x) {
        return '<a class="chip" href="#/city/' + x.id + '">' + icon("pin") + esc(x.name) + "</a>";
      }).join("") + "</div></section>" +
      '<p class="fine">Guide scores, hours and fees are estimates — check with each venue before you go. Cover photo via Wikipedia.</p></div>';
    mount(html, { nav: "explore", cls: "view--place" });
    T.weather.get(c).then(function (w) {
      var el = $("#city-wx");
      if (el && w && w.current) el.textContent = Math.round(w.current.temp) + "°C";
    });
    var m = T.maps.make($("#city-map"), c, 13);
    if (m) {
      var pts = [[c.lat, c.lng]];
      all.forEach(function (x) { L.marker([x.p.lat, x.p.lng], { icon: T.maps.pin(x.p) }).addTo(m).bindPopup('<a class="map-pop" href="#/place/' + encodeURIComponent(x.p.id) + '"><strong>' + esc(x.p.name) + "</strong><span>" + esc(T.cat(x.p.cat).label) + "</span></a>"); pts.push([x.p.lat, x.p.lng]); });
      if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    }
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
      '<div class="place-hero__title">' + catChip(p) + (T.dest.city(p.city) ? ' <a class="crumb crumb--light" href="#/city/' + p.city + '">' + esc(T.dest.city(p.city).provinceName) + " › " + esc(T.dest.city(p.city).name) + "</a>" : "") +
      "<h1>" + esc(p.name) + "</h1><p>" + icon("pin") + esc(p.address || p.area || "") + "</p></div></div>" +
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
      '<section class="psec"><div class="sec-head"><h2>Reviews</h2><button class="btn btn--sm btn--ghost" type="button" data-action="review" data-id="' + esc(p.id) + '">' + icon("chat") + "Write a review</button></div>" +
      '<div id="reviews-box">' + reviewsBox(p, reviews) + "</div></section>" +
      (nearby.length ? '<section class="psec"><div class="sec-head"><h2>Nearby</h2></div><div class="hscroll">' + nearby.map(function (x) { return placeCard(x.p, x.d); }).join("") + "</div></section>" : "") +
      '<p class="fine">' + (p.source === "osm" ? "Place data © OpenStreetMap contributors." : "Guide score, hours and fees are estimates — check with the venue before you go.") + (p.wiki ? " Photo via Wikipedia / Wikimedia Commons." : "") + "</p>" +
      "</div>";
    mount(html, { nav: "explore", cls: "view--place" });
    if (T.places.online()) T.places.fetchReviews(p.id).then(function () {
      var box = $("#reviews-box");
      if (box && T.router.parse().param === p.id) box.innerHTML = reviewsBox(p, T.places.reviews(p.id));
    }).catch(function () {});
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
  /* ---------- Reviews: write, edit, delete, with photos ---------- */
  var rvDraft = { photos: [] };
  function reviewHtml(p, rv) {
    var u = T.auth.current();
    var author = T.auth.profile(rv.uid) || { name: rv.name, photo: rv.photo };
    var mine = u && rv.uid && rv.uid === u.id;
    return '<article class="review">' +
      "<header>" + avatar({ name: author.name || rv.name, photo: author.photo }, "sm") + "<div><strong>" + esc(author.name || rv.name) + "</strong><small>" + esc(T.date(new Date(rv.at))) +
      (rv.edited ? " · edited" : "") + (rv.type && rv.type !== "regular" ? " · student/senior/PWD" : "") + "</small></div>" + T.stars(rv.rating, 13) + "</header>" +
      (rv.text ? "<p>" + esc(rv.text) + "</p>" : "") +
      (rv.photos && rv.photos.length ? '<div class="review__photos">' + rv.photos.map(function (src, i) {
        return '<button type="button" data-action="review-photo" data-id="' + esc(p.id) + '" data-rid="' + esc(rv.id) + '" data-i="' + i + '"><img src="' + esc(src) + '" alt="Photo by ' + esc(author.name || rv.name) + '" loading="lazy"></button>';
      }).join("") + "</div>" : "") +
      (mine ? '<div class="review__own"><button class="btn btn--sm btn--ghost" type="button" data-action="review" data-id="' + esc(p.id) + '" data-rid="' + esc(rv.id) + '">' + icon("edit") + "Edit</button>" +
        '<button class="btn btn--sm btn--ghost danger" type="button" data-action="review-delete" data-id="' + esc(p.id) + '" data-rid="' + esc(rv.id) + '">' + icon("trash") + "Delete</button></div>" : "") +
      "</article>";
  }
  T.reviewHtml = reviewHtml;
  function reviewsBox(p, reviews) {
    return reviews.length ? '<div class="reviews">' + reviews.map(function (rv) { return reviewHtml(p, rv); }).join("") + "</div>"
      : '<p class="muted">No reviews yet. Been here? Share your experience and photos to help other travelers.</p>';
  }
  T.actions.review = function (el) {
    var p = T.places.get(el.dataset.id);
    if (!el.dataset.rid && T.places.online() && !T.sync.active()) {
      T.sheet.open("Log in to review", '<p class="muted">Reviews are shared with every Tara traveler, so you need an account to post one.</p><div class="result__actions"><a class="btn btn--primary" href="#/signup">Create account</a><a class="btn btn--ghost" href="#/login">Log in</a></div>');
      return;
    }
    var rv = el.dataset.rid ? T.places.review(p.id, el.dataset.rid) : null;
    var rating = rv ? rv.rating : 5;
    rvDraft = { photos: rv && rv.photos ? rv.photos.slice() : [] };
    T.sheet.open((rv ? "Edit your review of " : "Review ") + p.name, '<form class="form" data-submit="review" data-id="' + esc(p.id) + '"' + (rv ? ' data-rid="' + esc(rv.id) + '"' : "") + ">" +
      '<div class="star-input" role="radiogroup" aria-label="Your rating">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<label><input type="radio" name="rating" value="' + n + '"' + (n === rating ? " checked" : "") + '><svg aria-hidden="true"><use href="#i-star"/></svg><span class="sr">' + n + " stars</span></label>";
      }).join("") + "</div>" +
      '<label class="field"><span class="field__label">Your comment</span><textarea class="input" name="text" rows="4" placeholder="What did you like? Any tips for other travelers?">' + esc(rv ? rv.text : "") + "</textarea></label>" +
      '<div class="field"><span class="field__label">' + icon("camera") + 'Photos <em class="opt-tag">up to 3</em></span><div class="rv-photos" id="rv-photos"></div></div>' +
      '<p class="form__error" role="alert" hidden></p>' +
      '<button class="btn btn--primary btn--block" type="submit">' + (rv ? "Save changes" : "Post review") + "</button></form>");
    renderRvPhotos();
  };
  function renderRvPhotos() {
    var box = $("#rv-photos");
    if (!box) return;
    box.innerHTML = rvDraft.photos.map(function (src, i) {
      return '<span class="rv-photo"><img src="' + esc(src) + '" alt=""><button type="button" data-action="rv-photo-remove" data-i="' + i + '" aria-label="Remove photo">' + icon("close") + "</button></span>";
    }).join("") + (rvDraft.photos.length < 3 ? '<label class="rv-add">' + icon("image") + '<span>Add photo</span><input type="file" accept="image/*" multiple data-input="rv-photo-file" hidden></label>' : "");
  }
  T.inputs["rv-photo-file"] = function (el) {
    var files = Array.prototype.slice.call(el.files || []).slice(0, 3 - rvDraft.photos.length);
    Promise.all(files.map(function (f) { return T.readImage(f, 900, 0.72); })).then(function (list) {
      rvDraft.photos = rvDraft.photos.concat(list).slice(0, 3);
      renderRvPhotos();
    }).catch(function (e) { T.toast("Photo not added", e.message, "info", "warn"); });
  };
  T.actions["rv-photo-remove"] = function (el) { rvDraft.photos.splice(Number(el.dataset.i), 1); renderRvPhotos(); };
  T.submits.review = function (form) {
    var u = T.auth.current();
    var rating = Number((form.querySelector('[name="rating"]:checked') || {}).value || 5);
    var fields = { rating: rating, text: form.text.value.trim(), photos: rvDraft.photos.slice() };
    var btn = $('[type="submit"]', form);
    busy(btn, true, "Saving…");
    var job = form.dataset.rid ? T.places.updateReview(form.dataset.id, form.dataset.rid, fields)
      : T.places.addReview(form.dataset.id, Object.assign(fields, { uid: u ? u.id : "", name: u ? u.name : "Traveler", authorPhoto: u ? u.photo : null, type: u ? u.type : "", at: Date.now() }));
    job.then(function () {
      T.sheet.close();
      T.toast(form.dataset.rid ? "Review updated" : "Thanks for your review!", form.dataset.rid ? "Your changes are saved." : T.places.online() ? "Every Tara traveler can see it now." : "It now shows on this place's page.", "star");
      T.router.resolve();
    }).catch(function (e) { busy(btn, false); formError(form, e.message); });
  };
  T.actions["review-delete"] = function (el) {
    T.sheet.open("Delete your review?", '<p class="muted">Your rating, comment and photos for this place will be removed.</p><div class="result__actions"><button class="btn btn--danger" type="button" data-action="review-delete-yes" data-id="' + esc(el.dataset.id) + '" data-rid="' + esc(el.dataset.rid) + '">' + icon("trash") + 'Delete review</button><button class="btn btn--ghost" type="button" data-action="close-sheet">Cancel</button></div>');
  };
  T.actions["review-delete-yes"] = function (el) {
    T.places.deleteReview(el.dataset.id, el.dataset.rid).then(function () {
      T.sheet.close();
      T.toast("Review deleted", "", "trash");
      T.router.resolve();
    }).catch(function (e) { T.toast("Couldn't delete", e.message, "info", "warn"); });
  };
  T.actions["review-photo"] = function (el) {
    var rv = T.places.review(el.dataset.id, el.dataset.rid);
    if (!rv) return;
    T.sheet.open("Photo", '<img class="photo-full" src="' + esc(rv.photos[Number(el.dataset.i)]) + '" alt="">', { size: "tall" });
  };

  /* ======================================================================
     PLAN — one destination or several stops, a day tour or several days
     ====================================================================== */
  function defaultDraft() {
    var here = T.location.get();
    var now = new Date(), h = now.getHours();
    var d = new Date(); d.setDate(d.getDate() + (h >= 15 ? 1 : 0));
    var dep = new Date(); dep.setMinutes(Math.ceil((dep.getMinutes() + 20) / 15) * 15, 0, 0);
    var useNow = h >= 5 && h < 15;
    return {
      from: { name: here.label.split(",")[0], label: here.label, lat: here.lat, lng: here.lng },
      stops: [], date: T.isoDate(d), time: useNow && dep.getHours() < 15 ? T.pad(dep.getHours()) + ":" + T.pad(dep.getMinutes()) : "07:00",
      pax: 1, type: "regular", ret: true, homeBy: "19:00", dayEnd: "18:00", activities: true, optionId: null, include: null,
      days: 1, lodging: "budget",
    };
  }
  function placeStop(p) { return { name: p.name, label: p.name + (p.area ? ", " + p.area : ""), lat: p.lat, lng: p.lng, placeId: p.id, cityId: p.city }; }
  function cityStop(c) { return { name: c.name, label: T.dest.label(c), lat: c.lat, lng: c.lng, cityId: c.id }; }
  function locStop(loc) {
    return { name: loc.name || loc.label.split(",")[0], label: loc.label, lat: loc.lat, lng: loc.lng, placeId: loc.placeId,
      cityId: loc.cityId || (loc.placeId && (T.places.get(loc.placeId) || {}).city) || null };
  }
  function draft() {
    var dr = T.state.draft = T.state.draft || defaultDraft();
    if (!dr.stops) dr.stops = dr.to ? [dr.to] : [];
    delete dr.to;
    if (dr.include && Array.isArray(dr.include)) dr.include = { 0: dr.include };
    dr.days = dr.days || 1; dr.lodging = dr.lodging || "budget"; dr.dayEnd = dr.dayEnd || "18:00";
    dr.type = (C.travelerAliases || {})[dr.type] || dr.type || "regular";
    return dr;
  }
  function resetPlan() { var dr = draft(); dr.optionId = null; dr.include = null; T.state.plan = null; }
  T.views.plan = function (r) {
    var dr = draft();
    var q = r.query;
    if (q.to) { var p = T.places.get(q.to); if (p && !(dr.stops.length === 1 && dr.stops[0].placeId === p.id)) { dr.stops = [placeStop(p)]; resetPlan(); } }
    if (q.city) { var cc = T.dest.city(q.city); if (cc && !(dr.stops.length === 1 && dr.stops[0].cityId === cc.id && !dr.stops[0].placeId)) { dr.stops = [cityStop(cc)]; resetPlan(); } }
    if (q.stops) {
      var list = q.stops.split(",").map(function (id) { var pp = T.places.get(id), c2 = T.dest.city(id); return pp ? placeStop(pp) : c2 ? cityStop(c2) : null; }).filter(Boolean);
      if (list.length) { dr.stops = list; resetPlan(); }
    }
    if (q.days) { dr.days = Math.max(1, Math.min(C.maxDays, Number(q.days) || 1)); T.state.plan = null; }
    // the link's settings are applied once; later changes on this screen win
    if (Object.keys(q).length) history.replaceState(null, "", "#/plan");
    var multi = dr.days > 1;
    var html = pageHead("Plan a trip", { sub: "Routes, fares, discounts & a day-by-day plan", sticky: false }) +
      '<form class="plan-form card" data-submit="plan" novalidate>' +
      '<div class="od">' +
      '<button class="od__row" type="button" data-action="plan-from"><span class="od__dot od__dot--from">' + icon("home") + "</span><span><small>Start from</small><strong>" + esc(dr.from.label) + "</strong></span></button>" +
      dr.stops.map(function (s, i) {
        return '<div class="od__stop"><button class="od__row" type="button" data-action="plan-to" data-i="' + i + '"><span class="od__dot od__dot--to">' + (dr.stops.length > 1 ? "<b>" + (i + 1) + "</b>" : icon("pin")) + "</span>" +
          "<span><small>" + (dr.stops.length > 1 ? "Stop " + (i + 1) : "Destination") + "</small><strong>" + esc(s.label) + "</strong></span></button>" +
          '<span class="od__tools">' +
          (dr.stops.length > 1 && i > 0 ? '<button class="icon-btn icon-btn--sm" type="button" data-action="stop-move" data-i="' + i + '" data-d="-1" aria-label="Move up">' + icon("chev-u") + "</button>" : "") +
          (dr.stops.length > 1 && i < dr.stops.length - 1 ? '<button class="icon-btn icon-btn--sm" type="button" data-action="stop-move" data-i="' + i + '" data-d="1" aria-label="Move down">' + icon("chev-d") + "</button>" : "") +
          '<button class="icon-btn icon-btn--sm" type="button" data-action="stop-remove" data-i="' + i + '" aria-label="Remove stop">' + icon("close") + "</button></span></div>";
      }).join("") +
      (dr.stops.length ? "" : '<button class="od__row" type="button" data-action="plan-to" data-i="0"><span class="od__dot od__dot--to">' + icon("pin") + '</span><span><small>Destination</small><strong class="muted">Choose where to go</strong></span></button>') +
      (dr.stops.length ? '<button class="od__add" type="button" data-action="plan-add-stop">' + icon("plus") + "<span>Add a stop</span><small>e.g. Intramuros → National Museum</small></button>" : "") +
      "</div>" +
      '<div class="field"><span class="field__label">' + icon("calendar") + "Trip length</span>" +
      '<div class="seg" role="radiogroup"><label class="seg__opt"><input type="radio" name="trip-len" value="1"' + (multi ? "" : " checked") + ' data-input="trip-len"><span>' + icon("sun") + 'Day tour</span></label>' +
      '<label class="seg__opt"><input type="radio" name="trip-len" value="2"' + (multi ? " checked" : "") + ' data-input="trip-len"><span>' + icon("bed") + "Multi-day</span></label></div></div>" +
      (multi ? '<div class="multi card-in">' +
        '<div class="field"><span class="field__label">' + icon("calendar") + 'Number of days</span><div class="stepper"><button type="button" data-action="days" data-d="-1" aria-label="Fewer days">' + icon("minus") + '</button><output id="days">' + dr.days + " days · " + (dr.days - 1) + " night" + (dr.days > 2 ? "s" : "") + '</output><button type="button" data-action="days" data-d="1" aria-label="More days">' + icon("plus") + "</button></div></div>" +
        '<div class="field"><span class="field__label">' + icon("bed") + "Overnight stay</span>" +
        '<div class="seg seg--3" role="radiogroup">' + C.lodging.map(function (l) {
          return '<label class="seg__opt"><input type="radio" name="lodging" value="' + l.id + '"' + (dr.lodging === l.id ? " checked" : "") + ' data-input="plan-field"><span><b>' + esc(l.label) + "</b><small>" + T.peso(l.room) + "/night</small></span></label>";
        }).join("") + '</div><p class="fine">Each night you stay near where that day ends. Room price is for 2 people and goes into your budget.</p></div></div>' : "") +
      '<div class="grid2">' +
      '<label class="field"><span class="field__label">' + icon("calendar") + (multi ? "Start date" : "Date") + '</span><input class="input" type="date" name="date" value="' + dr.date + '" min="' + T.isoDate(new Date()) + '" data-input="plan-field"></label>' +
      '<label class="field"><span class="field__label">' + icon("home") + 'Leave home at</span><input class="input" type="time" name="time" value="' + dr.time + '" data-input="plan-field"></label>' +
      "</div>" +
      '<div class="grid2">' +
      '<div class="field"><span class="field__label">' + icon("users") + 'Travelers</span><div class="stepper"><button type="button" data-action="pax" data-d="-1" aria-label="Fewer">' + icon("minus") + '</button><output id="pax">' + dr.pax + '</output><button type="button" data-action="pax" data-d="1" aria-label="More">' + icon("plus") + "</button></div></div>" +
      (multi ? timeField("dayEnd", "clock", "End each day at", dr.dayEnd) : timeField("homeBy", dr.ret ? "home" : "clock", dr.ret ? "Arrive home by" : "End my day at", dr.homeBy)) +
      "</div>" +
      (multi && dr.ret ? '<div class="grid2">' + timeField("homeBy", "home", "Arrive home by (last day)", dr.homeBy) + "</div>" : "") +
      (dr.ret ? '<p class="fine home-note">' + icon("info") + "We count backwards from the time you want to arrive home and tell you when to leave.</p>" : "") +
      '<div class="field"><span class="field__label">' + icon("id") + 'Fare discount <em class="opt-tag">optional</em></span>' + travelerSeg(dr.type, "plan-type") + "</div>" +
      switchRow("ret", "Include the trip home", "Plan the ride back home at the end", dr.ret) +
      switchRow("activities", "Plan things to do", "Fill each day with places, a lunch stop and entrance fees", dr.activities) +
      '<button class="btn btn--primary btn--block btn--lg" type="submit">' + icon("sparkle") + (multi ? "Plan my " + dr.days + "-day trip" : "Plan my trip") + "</button>" +
      "</form>" +
      '<div id="plan-out"></div>';
    mount(html, { nav: "plan" });
    if (T.state.plan) renderPlan(T.state.plan, false);
  };
  function timeField(name, ic, label, val) {
    return '<label class="field"><span class="field__label">' + icon(ic) + label + '</span><input class="input" type="time" name="' + name + '" value="' + esc(val) + '" data-input="plan-field"></label>';
  }
  function switchRow(name, title, sub, on) {
    return '<label class="switch"><span><strong>' + title + "</strong><small>" + sub + '</small></span><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + ' data-input="plan-field"><span class="switch__ui"></span></label>';
  }
  T.inputs["plan-field"] = function (el) {
    var dr = draft();
    if (el.type === "checkbox") dr[el.name] = el.checked; else dr[el.name] = el.value;
    if (el.name === "ret") { T.state.plan = null; T.router.resolve(); }
    if (el.name === "time" || el.name === "date") dr.optionId = null;
  };
  T.inputs["trip-len"] = function (el) {
    var dr = draft();
    dr.days = el.value === "1" ? 1 : Math.max(2, dr.days > 1 ? dr.days : 2);
    dr.include = null; T.state.plan = null;
    T.router.resolve();
  };
  T.actions.days = function (el) {
    var dr = draft();
    dr.days = Math.max(2, Math.min(C.maxDays, dr.days + Number(el.dataset.d)));
    dr.include = null; T.state.plan = null;
    $("#days").textContent = dr.days + " days · " + (dr.days - 1) + " night" + (dr.days > 2 ? "s" : "");
    var b = $('.plan-form [type="submit"]'); if (b) b.innerHTML = icon("sparkle") + "Plan my " + dr.days + "-day trip";
  };
  T.actions.pax = function (el) {
    var dr = draft();
    dr.pax = Math.max(1, Math.min(12, dr.pax + Number(el.dataset.d)));
    $("#pax").textContent = dr.pax;
  };
  T.actions["plan-from"] = function () {
    T.pickLocation({ mode: "origin", onPick: function (loc) { draft().from = { name: loc.name || loc.label.split(",")[0], label: loc.label, lat: loc.lat, lng: loc.lng, placeId: loc.placeId }; T.state.plan = null; T.router.resolve(); } });
  };
  T.actions["plan-to"] = function (el) {
    var i = Number(el && el.dataset.i || 0);
    T.pickLocation({ mode: "destination", onPick: function (loc) { var dr = draft(); dr.stops[i] = locStop(loc); resetPlan(); T.router.resolve(); } });
  };
  T.actions["plan-add-stop"] = function () {
    T.pickLocation({ mode: "destination", title: "Add a stop", onPick: function (loc) {
      var dr = draft(), s = locStop(loc);
      if (dr.stops.some(function (x) { return T.geo.distance(x, s) < 0.05; })) { T.toast("Already in your trip", s.name, "info", "warn"); return; }
      dr.stops.push(s); resetPlan(); T.router.resolve();
      T.toast("Stop added", s.name + " is stop " + dr.stops.length + ".", "plus");
    } });
  };
  T.actions["stop-remove"] = function (el) { var dr = draft(); dr.stops.splice(Number(el.dataset.i), 1); resetPlan(); T.router.resolve(); };
  T.actions["stop-move"] = function (el) {
    var dr = draft(), i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= dr.stops.length) return;
    var x = dr.stops[i]; dr.stops[i] = dr.stops[j]; dr.stops[j] = x;
    resetPlan(); T.router.resolve();
  };
  function draftDepart(dr) {
    var p = dr.date.split("-"), t = dr.time.split(":");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1]));
  }
  function buildFromDraft(weather, includeOverride) {
    var dr = draft();
    var trav = C.travelerTypes.filter(function (t) { return t.id === dr.type; })[0] || T.traveler();
    return T.planner.build({ from: dr.from, stops: dr.stops, depart: draftDepart(dr), traveler: trav, pax: dr.pax, ret: dr.ret, homeBy: dr.homeBy, dayEnd: dr.days > 1 ? dr.dayEnd || "18:00" : null,
      days: dr.days, lodging: dr.lodging, activities: dr.activities, optionId: dr.optionId, include: includeOverride !== undefined ? includeOverride : dr.include, weather: weather });
  }
  T.submits.plan = function () {
    var dr = draft();
    if (!dr.stops.length) { T.actions["plan-to"]({ dataset: { i: 0 } }); return; }
    if (T.geo.distance(dr.from, dr.stops[0]) < 0.05) { T.toast("Same place", "Pick a destination different from your starting point.", "info", "warn"); return; }
    var out = $("#plan-out");
    out.innerHTML = '<div class="planning">' + '<span class="road-loader road-loader--lg"><i></i></span><strong>Planning your trip…</strong><span class="muted">Checking routes, fares and things to do' + (dr.days > 1 ? " for " + dr.days + " days" : "") + "</span></div>";
    out.scrollIntoView({ behavior: T.reduceMotion ? "auto" : "smooth", block: "start" });
    var wxP = T.weather.get(dr.stops[0]).catch(function () { return null; });
    var timer = new Promise(function (r) { setTimeout(r, 900); });
    Promise.all([wxP, timer]).then(function (res) {
      T.state.weather = res[0];
      T.state.plan = buildFromDraft(res[0]);
      renderPlan(T.state.plan, true);
    });
  };
  T.actions["plan-option"] = function (el) {
    draft().optionId = el.dataset.id;
    T.state.plan = buildFromDraft(T.state.weather);
    renderPlan(T.state.plan, false);
    // done choosing — jump to the itinerary below
    var it = $("#itinerary");
    if (it) setTimeout(function () { it.scrollIntoView({ behavior: T.reduceMotion ? "auto" : "smooth", block: "start" }); }, 60);
    T.toast("Route chosen", T.state.plan.option.title + " · " + T.peso(T.state.plan.option.fare) + " per person", "check");
  };

  /* ---------- timelines ---------- */
  var modeIcon = { walk: "walk", tricycle: "tricycle", jeep: "jeep", bus: "bus", lrt: "train", grab: "car", car: "car" };
  T.modeIcon = modeIcon;
  // opts: startLabel, startTime, toName ("Arrive at X"), endLabel, check, done, prefix
  function legsTimeline(o, opts) {
    opts = opts || {};
    var start = opts.startLabel ? '<li class="tl__item tl--start"><span class="tl__time">' + T.time(new Date(o.depart)) + '</span><span class="tl__ic">' + icon(opts.startIcon || "home") + '</span><div class="tl__body"><strong>' + esc(opts.startLabel) + "</strong>" + (opts.startSub ? "<p>" + esc(opts.startSub) + "</p>" : "") + "</div></li>" : "";
    return '<ol class="tl">' + start + o.legs.map(function (l, i) {
      var key = (opts.prefix || "o") + i;
      var done = opts.done && opts.done[key];
      return '<li class="tl__item tl--' + l.mode + (done ? " is-done" : "") + '">' +
        '<span class="tl__time">' + T.time(new Date(l.start)) + "</span>" +
        '<span class="tl__ic">' + icon(modeIcon[l.mode]) + "</span>" +
        '<div class="tl__body"><strong>' + esc(l.text) + "</strong>" +
        (l.board ? '<p class="tl__board">' + icon("pin") + esc(l.board) + "</p>" : "") +
        (l.mode !== "walk" && l.mode !== "car" && l.to ? '<p class="tl__off">' + icon("flag") + "<span>Get off at <b>" + esc(l.to.name) + "</b></span></p>" : "") +
        "<p>" + esc(T.planner.legName(l)) + " · " + T.dur(l.minutes) + (l.km > 0.2 ? " · " + T.km(l.km) : "") +
        (l.mode === "walk" ? "" : " · <b>" + (l.perCar ? T.peso(l.fareReg) + " per car" : l.fare ? T.peso(l.fare) : "—") + "</b>" + (l.saved > 0 ? ' <s class="muted">' + T.peso(l.fareReg) + "</s>" : "")) +
        (l.rush ? ' <span class="pill pill--warn">rush hour</span>' : "") + "</p>" +
        (l.tip ? '<p class="tl__tip">' + esc(l.tip) + "</p>" : "") +
        (l.approx ? '<p class="tl__approx">' + icon("info") + "Common commuter route — confirm with the driver or terminal staff.</p>" : "") +
        (opts.check ? '<label class="tl__check"><input type="checkbox" data-input="trip-check" data-key="' + key + '"' + (done ? " checked" : "") + "><span>Done</span></label>" : "") +
        "</div></li>";
    }).join("") +
      '<li class="tl__item tl--arrive"><span class="tl__time">' + T.time(new Date(o.arrive)) + '</span><span class="tl__ic">' + icon(opts.endIcon || "pin") + '</span><div class="tl__body"><strong>' + esc(opts.endLabel || "Arrive at " + (opts.toName || "destination")) + "</strong></div></li></ol>";
  }
  function moveText(mv) {
    if (!mv || mv.minutes < 1) return "";
    if (mv.mode === "walk") return mv.minutes + " min walk";
    return T.planner.modeName[mv.mode] + " " + mv.minutes + " min · " + T.peso(mv.fare);
  }
  function stepIcon(s) {
    if (s.kind === "meal") return "utensils";
    if (s.kind === "free") return "sparkle";
    if (s.kind === "stay") return "bed";
    if (s.kind === "ride") { var l = s.ride.legs.filter(function (x) { return x.mode !== "walk"; })[0] || s.ride.legs[0]; return l ? modeIcon[l.mode] : "route"; }
    return s.place ? T.cat(s.place.cat).icon : "pin";
  }
  function dayTimeline(day, opts) {
    opts = opts || {};
    return '<ol class="tl tl--day">' + day.steps.map(function (s, i) {
      var key = T.planner.stepKey(day.index, i);
      var keys = s.kind === "ride" ? s.ride.legs.map(function (l, j) { return key + "l" + j; }) : [key];
      var done = opts.done && keys.every(function (k) { return opts.done[k]; });
      var p = s.place;
      var mv = moveText(s.move);
      var dur = Math.round((new Date(s.end) - new Date(s.start)) / 60000);
      var money = s.kind === "visit" ? (s.fee ? "<b>" + T.peso(s.fee) + "</b>" + (s.feeReg > s.fee ? ' <s class="muted">' + T.peso(s.feeReg) + "</s>" : "") : "Free")
        : s.kind === "meal" ? "about " + T.peso(s.cost) + "/person" : s.kind === "ride" ? "<b>" + T.peso(s.fare) + "</b>/person" : s.kind === "stay" ? "<b>" + T.peso(s.cost) + "</b>/person" : "";
      var body;
      if (s.kind === "ride") {
        body = "<strong>" + esc(s.name) + "</strong><p>" + T.time(new Date(s.start)) + " – " + T.time(new Date(s.end)) + " · " + T.dur(dur) + " · " + money + "</p>" +
          '<ul class="tl__legs">' + s.ride.legs.map(function (l) {
            return "<li>" + icon(modeIcon[l.mode]) + "<span><b>" + T.time(new Date(l.start)) + "</b> " + esc(l.text) + (l.mode !== "walk" && l.fare ? " · " + T.peso(l.fare) : "") +
              (l.board ? '<small>' + esc(l.board) + "</small>" : "") + (l.mode !== "walk" && l.mode !== "car" ? "<small>Get off at " + esc(l.to.name) + "</small>" : "") + "</span></li>";
          }).join("") + "</ul>";
      } else if (s.kind === "stay") {
        body = "<strong>" + esc(s.name) + "</strong><p>Check in around " + T.time(new Date(s.start)) + " · " + money + (s.rooms > 1 ? " · " + s.rooms + " rooms" : "") + "</p>";
      } else {
        body = (p ? '<a class="tl__name" href="#/place/' + encodeURIComponent(p.id) + '">' + esc(s.name) + "</a>" : "<strong>" + esc(s.name) + "</strong>") +
          "<p>" + T.time(new Date(s.start)) + " – " + T.time(new Date(s.end)) + " · " + T.dur(dur) + (money ? " · " + money : "") + "</p>" +
          (mv ? '<p class="tl__move">' + icon(s.move.mode === "walk" ? "walk" : modeIcon[s.move.mode]) + "Getting there: " + esc(mv) + "</p>" : "");
      }
      return '<li class="tl__item tl--' + s.kind + (done ? " is-done" : "") + '">' +
        '<span class="tl__time">' + T.time(new Date(s.start)) + "</span>" +
        '<span class="tl__ic">' + icon(stepIcon(s)) + "</span>" +
        '<div class="tl__body">' + body +
        (s.note ? '<p class="tl__tip">' + esc(s.note) + "</p>" : "") +
        (s.tip ? '<p class="tl__tip">' + esc(s.tip) + "</p>" : "") +
        (opts.check && s.kind !== "free" ? '<label class="tl__check"><input type="checkbox" data-input="trip-check" data-key="' + keys.join(",") + '"' + (done ? " checked" : "") + "><span>Done</span></label>" : "") +
        "</div></li>";
    }).join("") + "</ol>";
  }
  T.dayTimeline = dayTimeline;

  /* time-fit meter: too many / just right / free time */
  function fitBlock(fit, endAt, endVerb, dayIdx) {
    if (!fit) return "";
    var pct = fit.available ? Math.min(100, Math.round(fit.used / fit.available * 100)) : 0;
    var leave = T.time(new Date(endAt)), verb = endVerb + " " + leave;
    var title, msg, ic;
    if (fit.status === "over") {
      ic = "info"; title = "Too many stops";
      msg = fit.notFit.length + " place" + (fit.notFit.length > 1 ? "s" : "") + " won't fit before you " + verb + " (about " + T.dur(fit.overBy) + " more needed): " +
        fit.notFit.map(function (p) { return esc(p.name) + " (" + T.dur(p.visit || 45) + ")"; }).join(", ") + ". Remove some, leave home earlier, or stay later.";
    } else if (fit.status === "right") {
      ic = "check"; title = "Just right";
      msg = "Your places fill the day nicely until you " + verb + ".";
    } else {
      ic = "clock"; title = T.dur(fit.free) + " free";
      msg = "You still have " + T.dur(fit.free) + " before you " + verb + "." + (fit.suggestions.length ? " Add one of these:" : " Enjoy some free time!");
    }
    return '<div class="fit fit--' + fit.status + '"><div class="fit__top"><strong>' + icon(ic) + title + "</strong><span>" + T.dur(fit.used) + " of " + T.dur(fit.available) + " planned</span></div>" +
      '<div class="fit__bar"><span style="width:' + (fit.status === "over" ? 100 : pct) + '%"></span></div><p>' + msg + "</p>" +
      (fit.status === "free" && fit.suggestions.length ? '<div class="stop-chips">' + fit.suggestions.map(function (p) {
        return '<button class="chip" type="button" data-action="add-stop" data-day="' + (dayIdx || 0) + '" data-id="' + esc(p.id) + '">' + icon("plus") + esc(p.name) + " · " + T.dur(p.visit || 45) + "</button>";
      }).join("") + "</div>" : "") + "</div>";
  }
  function dayVisits(plan, d) { return plan.days[d].steps.filter(function (s) { return s.kind === "visit"; }).map(function (s) { return s.place.id; }); }
  function endVerb(plan, d) { return d === plan.days.length - 1 ? (plan.ret ? "leave for home at" : "end your day at") : "check in for the night at"; }
  function withDay(include, d, ids) { var o = Object.assign({}, include || {}); if (ids) o[d] = ids; else delete o[d]; return Object.keys(o).length ? o : null; }
  T.actions["add-stop"] = function (el) {
    var d = Number(el.dataset.day || 0), dr = draft();
    dr.include = withDay(dr.include, d, dayVisits(T.state.plan, d).concat([el.dataset.id]));
    T.state.plan = buildFromDraft(T.state.weather);
    renderPlan(T.state.plan, false);
    T.toast("Added to your day", T.places.get(el.dataset.id).name, "plus");
  };

  /* ---------- Edit places for one day: pick, then arrange the order ---------- */
  var edit = { day: 0, sel: [] };
  T.actions["edit-stops"] = function (el) {
    var plan = T.state.plan, d = Number(el.dataset.day || 0);
    edit.day = d; edit.sel = dayVisits(plan, d);
    var day = plan.days[d];
    var body = T.sheet.open(plan.days.length > 1 ? "Day " + (d + 1) + " — your places" : "Your places",
      '<p class="muted">Tick places to add them. Use the arrows to put them in the order you want — we follow your order, check opening hours, add lunch and tell you if it all fits before ' + T.time(new Date(day.end)) + ".</p>" +
      '<div id="stops-fit"></div><div id="stops-order"></div>' +
      '<p class="label">Add places</p><div class="stops-list" id="stops-pool"></div>' +
      '<div class="sheet-foot"><button class="btn btn--ghost" type="button" data-action="stops-auto">' + icon("sparkle") + 'Auto-fill</button><button class="btn btn--primary" type="button" data-action="stops-apply">Apply</button></div>', { size: "tall" });
    renderEdit();
    T.photos.hydrate(body);
  };
  function editPool() {
    var plan = T.state.plan, day = plan.days[edit.day];
    var pool = (day.pool || []).slice();
    edit.sel.forEach(function (id) { var p = T.places.get(id); if (p && pool.indexOf(p) < 0) pool.unshift(p); });
    return pool;
  }
  function renderEdit() {
    var plan = T.state.plan, day = plan.days[edit.day];
    var dep = new Date(day.date), days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var ord = $("#stops-order"), poolBox = $("#stops-pool");
    if (!ord) return;
    ord.innerHTML = '<p class="label">Your order · ' + edit.sel.length + " place" + (edit.sel.length === 1 ? "" : "s") + "</p>" + (edit.sel.length ? '<ol class="order-list">' + edit.sel.map(function (id, i) {
      var p = T.places.get(id);
      return '<li class="order-row"><span class="order-row__n">' + (i + 1) + '</span><span class="ph order-row__ph" data-photo="' + esc(p.id) + '">' + T.art(p) + "</span>" +
        '<span class="order-row__body"><strong>' + esc(p.name) + "</strong><small>" + esc(T.cat(p.cat).short) + " · " + T.dur(p.visit || 45) + "</small></span>" +
        '<span class="order-row__tools"><button class="icon-btn icon-btn--sm" type="button" data-action="order-move" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? "" : " disabled") + ">" + icon("chev-u") + "</button>" +
        '<button class="icon-btn icon-btn--sm" type="button" data-action="order-move" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < edit.sel.length - 1 ? "" : " disabled") + ">" + icon("chev-d") + "</button>" +
        '<button class="icon-btn icon-btn--sm" type="button" data-action="order-remove" data-i="' + i + '" aria-label="Remove">' + icon("close") + "</button></span></li>";
    }).join("") + "</ol>" : '<p class="muted">No places yet — tick some below.</p>');
    var rest = editPool().filter(function (p) { return edit.sel.indexOf(p.id) < 0; })
      .sort(function (a, b) { return (T.places.score(b) || 0) - (T.places.score(a) || 0); });
    poolBox.innerHTML = rest.length ? rest.map(function (p) {
      var closed = p.closed && p.closed.indexOf(dep.getDay()) > -1;
      var fee = T.places.fee(p, plan.traveler);
      return '<label class="stop-row' + (closed ? " is-closed" : "") + '"><input type="checkbox" data-input="stop-pick" value="' + esc(p.id) + '"' + (closed ? " disabled" : "") + ">" +
        '<span class="ph stop-row__ph" data-photo="' + esc(p.id) + '">' + T.art(p) + "</span>" +
        '<span class="stop-row__body"><strong>' + esc(p.name) + "</strong><small>" + esc(T.cat(p.cat).short) + " · " + T.dur(p.visit || 45) + " · " + (fee.amount ? T.peso(fee.amount) : fee.amount === 0 ? "Free" : "Fee varies") + "</small>" +
        "<small>" + (closed ? "Closed on " + days[dep.getDay()] + "s" : esc(T.places.hoursText(p))) + "</small></span>" +
        '<span class="stop-row__check">' + icon("plus") + "</span></label>";
    }).join("") : '<p class="muted">Every place nearby is already in your trip.</p>';
    T.photos.hydrate(ord); T.photos.hydrate(poolBox);
    updateStopsFit();
  }
  function updateStopsFit() {
    var box = $("#stops-fit");
    if (!box) return;
    var trial = buildFromDraft(T.state.weather, withDay(draft().include, edit.day, edit.sel.slice()));
    var td = trial.days[edit.day];
    box.innerHTML = fitBlock(td.fit, td.end, endVerb(trial, edit.day), edit.day).replace(/data-action="add-stop"/g, 'data-action="pick-stop-chip"');
  }
  T.inputs["stop-pick"] = function (el) { if (el.checked && edit.sel.indexOf(el.value) < 0) edit.sel.push(el.value); renderEdit(); };
  T.actions["pick-stop-chip"] = function (el) { if (edit.sel.indexOf(el.dataset.id) < 0) edit.sel.push(el.dataset.id); renderEdit(); };
  T.actions["order-move"] = function (el) {
    var i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= edit.sel.length) return;
    var x = edit.sel[i]; edit.sel[i] = edit.sel[j]; edit.sel[j] = x;
    renderEdit();
  };
  T.actions["order-remove"] = function (el) { edit.sel.splice(Number(el.dataset.i), 1); renderEdit(); };
  T.actions["stops-apply"] = function () {
    var dr = draft();
    dr.include = withDay(dr.include, edit.day, edit.sel.slice());
    T.state.plan = buildFromDraft(T.state.weather);
    T.sheet.close();
    renderPlan(T.state.plan, false);
    var f = T.state.plan.days[edit.day].fit;
    if (f) T.toast(f.status === "over" ? "Too many places" : f.status === "right" ? "Just right!" : "Plan updated", f.status === "over" ? f.notFit.length + " won't fit — see the list." : "Your order is saved.", f.status === "over" ? "info" : "check", f.status === "over" ? "warn" : "");
  };
  T.actions["stops-auto"] = function () {
    var dr = draft();
    dr.include = withDay(dr.include, edit.day, null);
    T.state.plan = buildFromDraft(T.state.weather);
    T.sheet.close();
    renderPlan(T.state.plan, false);
    T.toast("Auto-filled your day", "We picked the best-rated places that fit.", "sparkle");
  };

  function budgetCard(plan) {
    var b = plan.budget;
    var legs = plan.option.legs.concat(plan.back ? plan.back.legs : []);
    plan.days.forEach(function (d) { d.steps.forEach(function (s) { if (s.kind === "ride") legs = legs.concat(s.ride.legs); }); });
    var saved = legs.reduce(function (s, l) { return s + (l.saved || 0); }, 0) + (plan.fees.saved || 0);
    var row = function (ic, label, v) { return "<div><span>" + icon(ic) + label + "</span><b>" + T.peso(v) + "</b></div>"; };
    return '<div class="budget">' +
      row("bus", "Fares" + (plan.ret ? " (incl. trip home)" : "") + (b.moves ? " + rides between places" : ""), b.fares) +
      (plan.activitiesOn ? row("ticket", "Entrance fees", b.fees) : "") +
      (b.meals ? row("utensils", "Food (estimate)", b.meals) : "") +
      (plan.nights ? row("bed", plan.lodging.label + " stay · " + plan.nights + " night" + (plan.nights > 1 ? "s" : ""), b.stay) : "") +
      '<div class="budget__total"><span>Total per person</span><b>' + T.peso(b.perPerson) + "</b></div>" +
      (plan.pax > 1 ? "<div><span>" + icon("users") + "For " + plan.pax + " travelers</span><b>" + T.peso(b.group) + "</b></div>" : "") +
      (saved > 0 ? '<p class="budget__save">' + icon("id") + "Your student / senior / PWD discount saves " + T.peso(saved) + " per person</p>" : "") +
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
  function dateRange(plan) {
    var a = new Date(plan.option.depart);
    if (plan.days.length < 2) return T.date(a, true);
    var b = new Date(plan.days[plan.days.length - 1].date);
    return T.date(a) + " – " + T.date(b) + " · " + plan.days.length + " days";
  }
  function homeName(t) { return t.fromHome ? "home" : t.from.name; }
  /* the itinerary cards shared by the plan result and a saved trip */
  function itinerary(plan, opts) {
    opts = opts || {};
    var o = plan.option, multi = plan.days.length > 1;
    var html = '<div class="card"><div class="sec-head"><h3>' + icon("route") + " Getting there</h3><span class=\"muted\">" + T.dur(o.minutes) + " · " + T.peso(o.fare) + "/person</span></div>" +
      legsTimeline(o, { startLabel: plan.fromHome ? "Leave home" : "Leave " + plan.from.name, startSub: plan.from.label, endLabel: "Arrive at " + plan.stops[0].name, check: opts.check, done: plan.done, prefix: "o" }) + "</div>";
    plan.days.forEach(function (d) {
      var title = multi ? "Day " + (d.index + 1) + " · " + T.date(new Date(d.date)) : "Your day in " + plan.stops.map(function (s) { return s.name; }).join(" → ");
      html += '<div class="card day-card"><div class="sec-head"><h3>' + icon(multi ? "calendar" : "sparkle") + " " + esc(title) + "</h3>" +
        (opts.edit && plan.activitiesOn ? '<button class="btn btn--sm btn--ghost" type="button" data-action="edit-stops" data-day="' + d.index + '">' + icon("edit") + "Edit places</button>" : "") + "</div>" +
        (multi ? '<p class="day-card__stops">' + icon("pin") + esc(d.stops.map(function (s) { return s.name; }).join(" → ")) + "</p>" : "") +
        (opts.edit && d.index === plan.days.length - 1 ? homeNote(plan) : "") +
        (opts.edit ? fitBlock(d.fit, d.end, endVerb(plan, d.index), d.index) : "") +
        (d.steps.length ? dayTimeline(d, { check: opts.check, done: plan.done }) : '<p class="muted">No featured spots here yet. Explore nearby places after you arrive.</p>') +
        (d.skipped.length ? '<p class="fine">' + d.skipped.map(function (s) { return esc(s.place.name) + ": " + esc(s.why); }).join(" · ") + "</p>" : "") + "</div>";
    });
    if (plan.back) html += '<div class="card"><div class="sec-head"><h3>' + icon("home") + " Going home</h3><span class=\"muted\">" + T.dur(plan.back.minutes) + " · " + T.peso(plan.back.fare) + "/person</span></div>" +
      legsTimeline(plan.back, { startLabel: "Leave for " + homeName(plan), startIcon: "flag", endLabel: plan.fromHome ? "Arrive home" : "Arrive at " + plan.from.name, endIcon: "home", check: opts.check, done: plan.done, prefix: "b" }) + "</div>";
    return html;
  }
  /* "Be home by" result: when to leave the last stop, and a warning if it can't be done */
  function homeNote(plan) {
    if (!plan.back || !plan.homeTarget) return plan.leaveAdjusted ? '<p class="fine">Your end time was too close to arrival, so we planned until ' + T.time(new Date(plan.leaveAt)) + ".</p>" : "";
    var ok = plan.homeLate <= 10;
    return '<div class="home-by' + (ok ? "" : " home-by--late") + '">' + icon(ok ? "home" : "info") + "<p>" +
      (ok ? "To arrive home by <b>" + T.time(new Date(plan.homeTarget)) + "</b>, leave " + esc(plan.stops[plan.stops.length - 1].name) + " at <b>" + T.time(new Date(plan.back.depart)) + "</b> — you arrive home around " + T.time(new Date(plan.back.arrive)) + "."
        : "You can't arrive home by " + T.time(new Date(plan.homeTarget)) + " with this plan — the ride back takes " + T.dur(plan.back.minutes) + ". You'd arrive home around <b>" + T.time(new Date(plan.back.arrive)) + "</b>. Leave home earlier or pick a later time.") +
      "</p></div>";
  }
  function renderPlan(plan, scroll) {
    var out = $("#plan-out");
    if (!out) return;
    var o = plan.option;
    var html =
      '<section class="result">' +
      '<div class="result__head"><div><p class="eyebrow">' + esc(dateRange(plan)) + "</p><h2>" + esc(plan.fromHome ? "Home" : plan.from.name) + " → " + esc(plan.name) + (plan.ret ? " → Home" : "") + "</h2>" +
      '<p class="muted">' + plan.pax + " traveler" + (plan.pax > 1 ? "s" : "") + " · " + esc(plan.traveler.id === "regular" ? "Regular fares" : "Student / Senior / PWD fares") + (plan.nights ? " · " + plan.nights + " night" + (plan.nights > 1 ? "s" : "") + " " + esc(plan.lodging.label.toLowerCase()) : "") + " " + weatherLine(plan) + "</p></div></div>" +
      '<p class="label">Choose how to get to ' + esc(plan.stops[0].name) + "</p>" +
      '<div class="opts">' + plan.options.map(function (x) {
        return '<button class="opt' + (x.id === o.id ? " is-on" : "") + '" type="button" data-action="plan-option" data-id="' + x.id + '" aria-pressed="' + (x.id === o.id) + '">' +
          '<span class="opt__tag">' + esc(x.tag) + "</span>" +
          '<span class="opt__modes">' + x.legs.filter(function (l, i, a) { return l.mode !== "walk" || a.length === 1; }).map(function (l) { return icon(modeIcon[l.mode]); }).join(icon("chev-r", "sep")) + "</span>" +
          '<span class="opt__title">' + esc(x.title) + "</span>" +
          '<span class="opt__nums"><b>' + T.peso(x.fare) + "</b>" + (x.fareReg > x.fare ? '<s class="muted">' + T.peso(x.fareReg) + "</s>" : "") + "<span>Leave home " + T.time(new Date(x.depart)) + " · arrive " + T.time(new Date(x.arrive)) + " · " + T.dur(x.minutes) + "</span></span>" +
          (x.via ? '<span class="opt__via">via ' + esc(x.via) + "</span>" : "") + "</button>";
      }).join("") + "</div>" +
      '<div id="itinerary" class="itinerary"><p class="label">Your itinerary</p>' + itinerary(plan, { edit: true }) + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("wallet") + " Budget</h3>" + budgetCard(plan) + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("bell") + " Reminders</h3>" + reminderList(plan) + "</div>" +
      '<div class="result__actions">' +
      '<button class="btn btn--primary btn--lg" type="button" data-action="save-trip">' + icon("ticket") + "Save trip</button>" +
      '<button class="btn btn--ghost" type="button" data-action="plan-ics">' + icon("calendar") + "Add to calendar</button>" +
      '<button class="btn btn--ghost" type="button" data-action="plan-share">' + icon("share") + "Share</button></div>" +
      '<p class="fine">Fares, times, room rates and fees are estimates based on standard fare guides and typical traffic. Check signboards, posted fare matrices and venue notices on the day.</p>' +
      "</section>";
    out.innerHTML = html;
    if (scroll) out.scrollIntoView({ behavior: T.reduceMotion ? "auto" : "smooth", block: "start" });
  }
  T.renderPlanTimeline = { legs: legsTimeline, day: dayTimeline, budget: budgetCard, reminders: reminderList };

  T.actions["save-trip"] = function () {
    var saved = T.trips.save(T.state.plan);
    T.toast("Trip saved!", "Find it in Trips. Turn on reminders there.", "ticket");
    T.router.go("trip/" + saved.id);
  };
  T.actions["plan-ics"] = function () { downloadIcs(T.state.plan); };
  T.actions["plan-share"] = function () { shareTrip(T.state.plan); };
  function downloadIcs(plan) {
    var blob = new Blob([T.planner.ics(plan)], { type: "text/calendar" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tara-trip-" + plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    T.toast("Calendar file ready", "Open it to add the trip and its alarms to your calendar.", "calendar");
  }

  /* ---------- Share: easy-to-read text with spacing and icons ---------- */
  var modeEmoji = { walk: "🚶", tricycle: "🛺", jeep: "🚙", bus: "🚌", lrt: "🚆", grab: "🚕", car: "🚗" };
  function shareText(plan) {
    var L = [], tm = function (d) { return T.time(new Date(d)); };
    var blank = function () { if (L[L.length - 1] !== "") L.push(""); };
    L.push("🧳 " + (plan.fromHome ? "Home" : plan.from.name) + " → " + plan.name);
    L.push("📅 " + dateRange(plan));
    L.push("👥 " + plan.pax + " traveler" + (plan.pax > 1 ? "s" : "") + " · " + (plan.traveler.id === "regular" ? "Regular fares" : "Student / Senior / PWD fares"));
    blank();
    L.push("🏠 " + tm(plan.option.depart) + " — Leave " + homeName(plan));
    plan.option.legs.forEach(function (l) { L.push("    " + modeEmoji[l.mode] + " " + tm(l.start) + "  " + l.text + (l.fare ? " (" + T.peso(l.fare) + ")" : "")); });
    L.push("📍 " + tm(plan.option.arrive) + " — Arrive at " + plan.stops[0].name);
    plan.days.forEach(function (d) {
      blank();
      L.push(plan.days.length > 1 ? "☀️ DAY " + (d.index + 1) + " · " + T.date(new Date(d.date)) : "☀️ YOUR DAY");
      d.steps.forEach(function (s) {
        if (s.kind === "visit") L.push("  • " + tm(s.start) + "  " + s.name + (s.fee ? " (" + T.peso(s.fee) + ")" : ""));
        else if (s.kind === "meal") L.push("  🍽️ " + tm(s.start) + "  " + s.name);
        else if (s.kind === "free") L.push("  ✨ " + tm(s.start) + "  " + s.name);
        else if (s.kind === "ride") L.push("  ➡️ " + tm(s.start) + "  " + s.name + " by " + s.ride.title + " (" + T.peso(s.fare) + ")");
        else if (s.kind === "stay") L.push("  🌙 " + tm(s.start) + "  " + s.name + " (" + T.peso(s.cost) + "/person)");
      });
    });
    if (plan.back) {
      blank();
      L.push("🚏 " + tm(plan.back.depart) + " — Leave for " + homeName(plan));
      L.push("🏡 " + tm(plan.back.arrive) + " — " + (plan.fromHome ? "Arrive home" : "Arrive at " + plan.from.name));
    }
    blank();
    var b = plan.budget;
    L.push("💰 Budget: " + T.peso(b.perPerson) + " per person" + (plan.pax > 1 ? " (" + T.peso(b.group) + " for " + plan.pax + ")" : ""));
    L.push("    Fares " + T.peso(b.fares) + (b.fees ? " · Entrance " + T.peso(b.fees) : "") + (b.meals ? " · Food " + T.peso(b.meals) : "") + (b.stay ? " · Stay " + T.peso(b.stay) : ""));
    blank();
    L.push("Planned with Tara 🌴");
    return L.join("\n");
  }
  function shareTrip(plan) {
    var text = shareText(plan);
    var copy = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { T.toast("Itinerary copied", "Paste it in Messenger or Viber.", "check"); });
    };
    T.sheet.open("Share your trip", '<pre class="share-preview">' + esc(text) + "</pre>" +
      '<div class="result__actions">' + (navigator.share ? '<button class="btn btn--primary" type="button" data-action="share-send">' + icon("share") + "Share</button>" : "") +
      '<button class="btn btn--ghost" type="button" data-action="share-copy">' + icon("check") + "Copy text</button></div>");
    T.actions["share-send"] = function () { navigator.share({ title: "Trip: " + plan.name, text: text }).catch(function () {}); };
    T.actions["share-copy"] = copy;
  }
  T.downloadIcs = downloadIcs; T.shareTrip = shareTrip;

  /* ======================================================================
     TRIPS
     ====================================================================== */
  T.views.trips = function (r) {
    var tab = r.query.tab || "upcoming";
    var all = T.trips.all();
    var now = Date.now();
    var up = all.filter(function (t) { return T.planner.endTime(t) >= now; }).sort(function (a, b) { return new Date(a.option.depart) - new Date(b.option.depart); });
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
    var total = T.planner.steps(t).length;
    var done = Object.keys(t.done || {}).filter(function (k) { return t.done[k]; }).length;
    return '<a class="trip-card" href="#/trip/' + t.id + '">' +
      '<span class="trip-card__date"><b>' + dep.getDate() + "</b>" + esc(dep.toLocaleDateString("en-PH", { month: "short" })) + "</span>" +
      '<div class="trip-card__body"><h3>' + esc(t.name) + "</h3><p>Leave " + esc(homeName(t)) + " " + esc(T.time(dep)) + (t.days.length > 1 ? " · " + t.days.length + " days" : "") + "</p>" +
      '<p class="muted">' + esc(t.option.title) + " · " + T.peso(t.budget.perPerson) + "/person</p>" +
      '<div class="progress"><span style="width:' + Math.round(Math.min(done, total) / Math.max(1, total) * 100) + '%"></span></div></div>' +
      (t.notify ? icon("bell", "trip-card__bell") : "") + icon("chev-r") + "</a>";
  }
  T.views.trip = function (r) {
    var t = T.trips.get(r.param);
    if (!t) { mount(pageHead("Trip", { back: true }) + empty("ticket", "Trip not found", "It may have been deleted.", '<a class="btn btn--primary" href="#/trips">My trips</a>'), { nav: "trips" }); return; }
    var dep = new Date(t.option.depart), now = new Date(), endT = T.planner.endTime(t);
    var status = now < dep ? "Leaves " + countdown(dep) : now < endT ? "In progress" : "Completed";
    var last = t.stops[t.stops.length - 1];
    var html = pageHead(esc(t.name), { back: true, sub: esc(dateRange(t)) + " · " + esc(status),
      actions: '<button class="icon-btn" type="button" data-action="trip-delete" data-id="' + t.id + '" aria-label="Delete trip">' + icon("trash") + "</button>" }) +
      '<div class="trip-top card">' +
      '<div class="trip-top__row"><div><small>' + icon("home") + "Leave home</small><b>" + T.time(dep) + "</b></div>" + icon("arrow") +
      "<div><small>" + icon("pin") + "Arrive at " + esc(t.stops[0].name) + "</small><b>" + T.time(new Date(t.option.arrive)) + "</b></div>" +
      (t.back ? icon("arrow") + "<div><small>" + icon("flag") + "Leave for home</small><b>" + T.time(new Date(t.back.depart)) + "</b></div>" + icon("arrow") + "<div><small>" + icon("home") + "Arrive home</small><b>" + T.time(new Date(t.back.arrive)) + "</b></div>" : "") + "</div>" +
      (status !== "Completed" ? '<a class="btn btn--primary btn--block btn--lg live-start" href="#/live/' + t.id + '">' + icon("route") + (status === "In progress" ? "Continue live trip" : "Start live trip") + "</a>" : "") +
      switchRow2("trip-notify", "Remind me", "Notifications for each step while the app is open, plus calendar alarms", t.notify, t.id) +
      '<div class="result__actions result__actions--tight"><button class="btn btn--ghost btn--sm" type="button" data-action="trip-ics" data-id="' + t.id + '">' + icon("calendar") + "Add to calendar</button>" +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="trip-share" data-id="' + t.id + '">' + icon("share") + "Share</button>" +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=' + t.from.lat + "," + t.from.lng + "&destination=" + last.lat + "," + last.lng +
      (t.stops.length > 1 ? "&waypoints=" + t.stops.slice(0, -1).map(function (s) { return s.lat + "," + s.lng; }).join("%7C") : "") + '&travelmode=transit">' + icon("map") + "Google Maps</a></div></div>" +
      '<div class="mini-map mini-map--tall card" id="trip-map"></div>' +
      itinerary(t, { check: true }) +
      '<div class="card"><h3 class="h3">' + icon("bell") + " Reminders</h3>" + reminderList(t) + "</div>" +
      '<div class="card"><h3 class="h3">' + icon("wallet") + " Budget</h3>" + budgetCard(t) + "</div>";
    mount(html, { nav: "trips" });
    var m = T.maps.make($("#trip-map"), t.stops[0], 12);
    if (m) {
      var pts = [[t.from.lat, t.from.lng]];
      t.option.legs.forEach(function (l) { pts.push([l.to.lat, l.to.lng]); });
      L.marker([t.from.lat, t.from.lng], { icon: T.maps.me() }).addTo(m).bindPopup(t.fromHome ? "Home" : esc(t.from.label));
      var n = 0;
      t.days.forEach(function (d) {
        d.steps.forEach(function (s) {
          if (s.place) { n++; L.marker([s.place.lat, s.place.lng], { icon: T.maps.pin(s.place, n) }).addTo(m).bindPopup(esc(s.name)); pts.push([s.place.lat, s.place.lng]); }
          if (s.kind === "ride") s.ride.legs.forEach(function (l) { pts.push([l.to.lat, l.to.lng]); });
          if (s.kind === "stay" && s.at) L.marker([s.at.lat, s.at.lng], { icon: T.maps.pin({ cat: "other" }, "🌙") }).addTo(m).bindPopup(esc(s.name));
        });
      });
      L.polyline(pts, { color: "#f57a3d", weight: 4, opacity: 0.9, dashArray: "8 8" }).addTo(m);
      m.fitBounds(pts, { padding: [24, 24] });
    }
  };
  function switchRow2(action, title, sub, on, id) {
    return '<label class="switch"><span><strong>' + icon("bell") + " " + title + "</strong><small>" + sub + '</small></span><input type="checkbox" data-input="' + action + '" data-id="' + id + '"' + (on ? " checked" : "") + '><span class="switch__ui"></span></label>';
  }
  T.inputs["trip-check"] = function (el) {
    var t = T.trips.get(T.router.parse().param);
    t.done = t.done || {};
    el.dataset.key.split(",").forEach(function (k) { t.done[k] = el.checked; });
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
      '<div class="card profile-card"><label class="avatar-edit" title="Change profile photo">' + avatar(u, "lg") + '<span class="avatar-edit__cam">' + icon("camera") + '</span><input type="file" accept="image/*" data-input="avatar-file" hidden></label>' +
      "<div><h2>" + esc(u.name || "Traveler") + "</h2><p class=\"muted\">" + esc(u.guest ? "Guest — create an account to keep your trips under your name" : u.email || "") + "</p>" +
      (u.photo ? '<button class="link-btn link-btn--inline" type="button" data-action="avatar-remove">Remove photo</button>' : '<p class="fine">Tap the picture to upload a profile photo.</p>') + "</div>" +
      '<button class="icon-btn" type="button" data-action="edit-name" aria-label="Edit name">' + icon("edit") + "</button></div>" +
      '<div class="card"><h3 class="h3">' + icon("id") + " Fare discount</h3>" + travelerSeg(u.type || "regular", "profile-type") + '<p class="fine" id="type-note">' + typeNote(u.type || "regular") + "</p></div>" +
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
      '<a class="made-by" href="#/about"><span class="studio-mark studio-mark--sm" aria-hidden="true"><span>K</span><i>&amp;</i><span>A</span></span><span>Tara is made by <b>K &amp; A Studios</b></span>' + icon("chev-r") + "</a>" +
      '<p class="fine center">Map data © OpenStreetMap contributors · Weather by Open-Meteo · Photos via Wikipedia</p>';
    mount(html, { nav: "profile" });
  };
  T.inputs["avatar-file"] = function (el) {
    var f = el.files && el.files[0];
    if (!f) return;
    T.readImage(f, 320, 0.85).then(function (src) {
      if (!T.auth.update({ photo: src })) throw new Error("Couldn't save the photo.");
      T.toast("Profile photo updated", "Looking good!", "camera");
      T.router.resolve();
    }).catch(function (e) { T.toast("Photo not saved", e.message, "info", "warn"); });
  };
  T.actions["avatar-remove"] = function () { T.auth.update({ photo: null }); T.toast("Photo removed", "", "user"); T.router.resolve(); };
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

  /* ======================================================================
     LIVE TRIP MODE — follows the trip step by step with GPS
     ====================================================================== */
  var live = { watch: null, wake: null, alerted: {}, map: null, me: null, tripId: null };
  T.live = {
    stop: function () {
      if (live.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(live.watch);
      live.watch = null; live.map = null; live.me = null;
      if (live.wake) { try { live.wake.release(); } catch (e) {} live.wake = null; }
    },
  };
  function liveIcon(st) {
    if (st.type === "leg") return modeIcon[st.mode];
    if (st.type === "meal") return "utensils";
    if (st.type === "free") return "sparkle";
    if (st.type === "stay") return "bed";
    return st.place ? T.cat(st.place.cat).icon : "pin";
  }
  function liveAlert(title, body, tripId) {
    T.toast(title, body, "bell");
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
    if (window.Notification && Notification.permission === "granted" && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, { body: body, icon: "icons/icon-192.png", tag: "tara-live-" + tripId, renotify: true, data: { url: "#/live/" + tripId } }); }).catch(function () {});
    }
  }
  T.views.live = function (r) {
    var t = T.trips.get(r.param);
    if (!t) { mount(pageHead("Live trip", { back: true }) + empty("ticket", "Trip not found", "It may have been deleted.", '<a class="btn btn--primary" href="#/trips">My trips</a>'), { nav: "trips" }); return; }
    t.done = t.done || {};
    var steps = T.planner.steps(t);
    var idx = -1;
    for (var i = 0; i < steps.length; i++) if (!t.done[steps[i].key]) { idx = i; break; }
    var doneCount = steps.filter(function (s) { return t.done[s.key]; }).length;
    var pct = Math.round(doneCount / steps.length * 100);

    if (idx < 0) {
      var visited = [];
      t.days.forEach(function (d) { d.steps.forEach(function (s) { if (s.kind === "visit" && s.place) visited.push(s); }); });
      mount(pageHead("Trip complete", { back: true, sub: esc(t.name) }) +
        '<div class="card live-done"><span class="empty__ic">' + icon("check") + "</span><h2>Salamat sa paglalakbay!</h2><p class=\"muted\">You finished every step of your trip to " + esc(t.name) + ".</p></div>" +
        (visited.length ? '<div class="card"><h3 class="h3">' + icon("star") + " Rate the places you visited</h3><div class=\"rows\">" + visited.map(function (s) {
          return '<div class="prow prow--plain">' + photo(s.place, "prow__ph") + '<div class="prow__body"><h3>' + esc(s.place.name) + '</h3><p class="prow__meta">' + ratingInline(s.place) + '</p></div><button class="btn btn--sm btn--ghost" type="button" data-action="review" data-id="' + esc(s.place.id) + '">Review</button></div>';
        }).join("") + "</div></div>" : "") +
        '<div class="result__actions"><a class="btn btn--primary" href="#/plan">' + icon("route") + 'Plan another trip</a><button class="btn btn--ghost" type="button" data-action="live-reset" data-id="' + t.id + '">Restart checklist</button></div>', { nav: "trips" });
      return;
    }

    var cur = steps[idx], now = new Date();
    var early = Math.round((cur.start - now) / 60000), late = Math.round((now - cur.end) / 60000);
    var status = early > 720 ? { cls: "early", ic: "calendar", text: "Trip starts " + T.date(cur.start) + " at " + T.time(cur.start) + " (" + countdown(cur.start) + ")" }
      : early > 5 ? { cls: "early", ic: "clock", text: "Starts at " + T.time(cur.start) + " — in " + T.dur(early) }
      : late > 10 ? { cls: "late", ic: "info", text: "Running about " + T.dur(late) + " behind plan" }
      : { cls: "ok", ic: "check", text: "On schedule" };
    // when late, suggest skipping the lowest-rated remaining stop to still leave on time
    var skipTip = "";
    if (late > 20) {
      var rest = steps.slice(idx + 1).filter(function (s) { return s.type === "visit" && s.place && !t.done[s.key]; })
        .sort(function (a, b) { return (T.places.score(a.place) || 0) - (T.places.score(b.place) || 0); })[0];
      if (rest) skipTip = '<div class="live-skip">' + icon("info") + "<p>To still leave on time" + (t.back ? " at " + T.time(new Date(t.back.depart)) : "") + ", consider skipping <b>" + esc(rest.title) + "</b>.</p>" +
        '<button class="btn btn--sm btn--ghost" type="button" data-action="live-skip" data-key="' + rest.key + '">Skip it</button></div>';
    }
    var tgt = cur.target;
    var gmaps = tgt ? "https://www.google.com/maps/dir/?api=1&destination=" + tgt.lat + "," + tgt.lng + "&travelmode=" + (cur.mode === "walk" ? "walking" : cur.mode === "grab" || cur.mode === "car" ? "driving" : "transit") : "";
    var doneLabel = cur.type === "leg" ? (cur.ride ? "I got off — next step" : "I'm here — next step") : cur.type === "stay" ? "Good morning — start the day" : cur.type === "free" ? "Done — next" : "Done here — next";
    var next = steps.slice(idx + 1, idx + 5);
    var html = pageHead("Live trip", { back: true, sub: esc(t.name) + (t.days.length > 1 && cur.day != null ? " · Day " + (cur.day + 1) : "") + " · step " + (idx + 1) + " of " + steps.length,
      actions: '<button class="icon-btn" type="button" data-action="live-wake" aria-label="Keep screen on" title="Keep screen on">' + icon("sun") + "</button>" }) +
      '<div class="live-progress"><span style="width:' + pct + '%"></span></div>' +
      '<div class="live-status live-status--' + status.cls + '">' + icon(status.ic) + "<span>" + esc(status.text) + "</span></div>" + skipTip +
      '<div class="card live-card">' +
      '<div class="live-card__mode"><span class="tl__ic">' + icon(liveIcon(cur)) + "</span><span>" + esc(cur.type === "leg" ? (cur.line || T.planner.modeName[cur.mode]) : cur.type === "meal" ? "Lunch" : cur.type === "free" ? "Free time" : cur.type === "stay" ? "Overnight stay" : "Visit") + "</span>" +
      '<span class="grow"></span><span class="live-card__time">' + T.time(cur.start) + " – " + T.time(cur.end) + "</span></div>" +
      "<h2>" + esc(cur.title) + "</h2>" +
      (cur.board ? '<p class="tl__board">' + icon("pin") + esc(cur.board) + "</p>" : "") +
      (cur.ride && tgt ? '<p class="live-getoff">' + icon("bell") + "<span>Get off at <b>" + esc(tgt.name) + "</b> — we'll alert you when it's near.</span></p>" : "") +
      (cur.tip ? '<p class="tl__tip">' + esc(cur.tip) + "</p>" : "") +
      (cur.fare ? '<p class="live-fare">' + icon("wallet") + "<span>Fare: <b>" + T.peso(cur.fare) + "</b></span></p>" : "") +
      '<p class="live-dist" id="live-dist">' + (tgt ? icon("locate") + "Finding your location…" : "") + "</p>" +
      '<div class="live-actions"><button class="btn btn--primary btn--lg" type="button" data-action="live-done" data-key="' + cur.key + '">' + icon("check") + esc(doneLabel) + "</button>" +
      (gmaps ? '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + gmaps + '">' + icon("map") + "Directions</a>" : "") + "</div></div>" +
      (tgt ? '<div class="mini-map mini-map--tall card" id="live-map"></div>' : "") +
      (next.length ? '<div class="card"><h3 class="h3">' + icon("list") + ' Up next</h3><ol class="live-next">' + next.map(function (s) {
        return "<li><span class=\"tl__time\">" + T.time(s.start) + '</span><span class="tl__ic">' + icon(liveIcon(s)) + "</span><span>" + esc(s.title) + "</span></li>";
      }).join("") + "</ol></div>" : "") +
      '<p class="fine center">Keep Tara open during your trip. Location is used only on your phone to know when you are near each stop.</p>';
    mount(html, { nav: "trips" });
    live.tripId = t.id;

    if (!tgt) return;
    var m = T.maps.make($("#live-map"), tgt, 15);
    live.map = m;
    if (m) L.marker([tgt.lat, tgt.lng], { icon: T.maps.pin(cur.place || { cat: cur.type === "meal" ? "food" : "other" }) }).addTo(m).bindPopup(esc(tgt.name));
    if (!navigator.geolocation) { $("#live-dist").textContent = "Location isn't available — follow the times shown."; return; }
    live.watch = navigator.geolocation.watchPosition(function (pos) {
      var me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      var d = T.geo.distance(me, tgt);
      var el = $("#live-dist");
      if (el) el.innerHTML = icon("locate") + "<span><b>" + T.km(d) + "</b> to " + esc(tgt.name) + "</span>";
      if (live.map) {
        if (!live.me) { live.me = L.marker([me.lat, me.lng], { icon: T.maps.me() }).addTo(live.map); live.map.fitBounds([[me.lat, me.lng], [tgt.lat, tgt.lng]], { padding: [40, 40], maxZoom: 16 }); }
        else live.me.setLatLng([me.lat, me.lng]);
      }
      var key = cur.key;
      if (cur.ride && d < 0.4 && !live.alerted[key]) {
        live.alerted[key] = true;
        liveAlert("Get ready to get off!", tgt.name + " is about " + T.km(d) + " away.", t.id);
      } else if (cur.type === "leg" && !cur.ride && d < 0.06 && !live.alerted[key]) {
        live.alerted[key] = true;
        markLive(t.id, key, false);
        T.toast("You've arrived", tgt.name, "check");
      } else if ((cur.type === "visit" || cur.type === "meal") && d < 0.08 && !live.alerted[key]) {
        live.alerted[key] = true;
        T.toast("You're at " + tgt.name, "Enjoy! Tap “Done here” when you're ready to move on.", "pin");
      }
    }, function () {
      var el = $("#live-dist");
      if (el) el.textContent = "Location is off — follow the times shown, and tap the button after each step.";
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  };
  function markLive(tripId, key, skipped) {
    var t = T.trips.get(tripId);
    if (!t) return;
    t.done = t.done || {};
    t.done[key] = true;
    if (skipped) { t.skipped = t.skipped || {}; t.skipped[key] = true; }
    T.trips.update(t);
    T.router.resolve();
  }
  T.actions["live-done"] = function (el) { markLive(T.router.parse().param, el.dataset.key, false); };
  T.actions["live-skip"] = function (el) { markLive(T.router.parse().param, el.dataset.key, true); T.toast("Skipped", "Your plan is back on track.", "check"); };
  T.actions["live-reset"] = function (el) {
    var t = T.trips.get(el.dataset.id);
    t.done = {}; t.skipped = {};
    T.trips.update(t);
    T.router.resolve();
  };
  T.actions["live-wake"] = function () {
    if (!navigator.wakeLock) { T.toast("Not supported", "Your browser can't keep the screen on. Adjust screen timeout in phone settings.", "info", "warn"); return; }
    navigator.wakeLock.request("screen").then(function (l) { live.wake = l; T.toast("Screen will stay on", "Until you leave this page.", "sun"); })
      .catch(function () { T.toast("Couldn't keep the screen on", "Try again after tapping the screen.", "info", "warn"); });
  };

  T.views.about = function () {
    mount(pageHead("About", { back: true }) +
      '<div class="about card">' +
      '<div class="studio-mark studio-mark--xl" aria-hidden="true"><span>K</span><i>&amp;</i><span>A</span></div>' +
      "<h2>K &amp; A Studios</h2><p class=\"muted\">Creators of Tara</p>" +
      "<p>Tara is a travel buddy for Filipino commuters and travelers — find places, plan the ride with real signboards and fares, and enjoy a day trip or a few days away without the guesswork.</p>" +
      '<ul class="about__list"><li>' + icon("route") + "Commute plans with student, senior &amp; PWD discounts</li><li>" + icon("calendar") + "Day tours and multi-day trips with stopovers</li><li>" + icon("chat") + "Reviews and photos from fellow travelers</li></ul>" +
      '<a class="btn btn--primary btn--block" href="#/plan">' + icon("sparkle") + "Plan a trip</a></div>" +
      '<p class="fine center">© ' + new Date().getFullYear() + " K &amp; A Studios · Map data © OpenStreetMap contributors · Weather by Open-Meteo · Photos via Wikipedia</p>", { nav: "profile" });
  };

  T.views.notfound = function () { mount(pageHead("Not found", { back: true }) + empty("compass", "Wrong turn", "This page doesn't exist.", '<a class="btn btn--primary" href="#/home">Go home</a>')); };
  T.actions.back = function () { if (history.length > 1) history.back(); else T.router.go("home"); };
})();
