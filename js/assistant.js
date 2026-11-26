/* ==========================================================================
   TARA — "Ask Tara": a travel helper that answers in plain language.
   It runs fully on the phone (works offline) and answers from Tara's own
   guide: places, hours, fees, routes and fares, discounts, pasalubong,
   weather and how to use the app. It understands simple English & Tagalog.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, $ = T.$, $$ = T.$$, esc = T.esc, icon = T.icon;

  /* ---------- text helpers ---------- */
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function has(t, re) { return re.test(t); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- entity index: places, cities and provinces ---------- */
  var GENERIC = "the of de and at in sa ng ni city church park mall beach resort resorts hotel inn cafe coffee restaurant sm national museum shrine san santa santo sta st island mount mt falls market food house plaza town center centre grill kitchen bay real new old".split(" ");
  var AMBIGUOUS_CITY = { real: 1, bay: 1, victoria: 1, rosario: 1, magdalena: 1, liliw: 0 };
  var IDX = null;
  function buildIndex() {
    IDX = [];
    T.dest.provinces().forEach(function (pv) { IDX.push({ type: "province", obj: pv, key: norm(pv.name) }); });
    T.dest.cities().forEach(function (c) {
      var k = norm(c.name);
      if (AMBIGUOUS_CITY[k]) IDX.push({ type: "city", obj: c, key: k + " " + norm(c.provinceName) });
      else IDX.push({ type: "city", obj: c, key: k });
      if (/ city$/.test(k)) IDX.push({ type: "city", obj: c, key: k.replace(/ city$/, "") });
    });
    C.places.forEach(function (p) {
      var full = norm(p.name);
      var short = norm(String(p.name).split(/ \(| — | – | - |, /)[0]);
      IDX.push({ type: "place", obj: p, key: full });
      if (short !== full && short.length >= 4) IDX.push({ type: "place", obj: p, key: short });
      var paren = /\(([^)]+)\)/.exec(p.name);
      if (paren && norm(paren[1]).length >= 5 && !/^(by |approx|from )/.test(norm(paren[1]))) IDX.push({ type: "place", obj: p, key: norm(paren[1]), weak: true });
      // the distinctive words of the name (e.g. "Moonbuckx", "Fort Santiago")
      var sig = short.split(" ").filter(function (w) { return w.length >= 4 && GENERIC.indexOf(w) < 0; });
      if (sig.length) IDX.push({ type: "place", obj: p, words: sig, weak: true });
    });
  }
  // every entity mentioned in a piece of text, best first
  function entities(t) {
    if (!IDX) buildIndex();
    var s = " " + t + " ", hits = [];
    var cityWords = {};
    IDX.forEach(function (e) { if (e.type !== "place" && e.key) e.key.split(" ").forEach(function (w) { cityWords[w] = 1; }); });
    IDX.forEach(function (e) {
      if (e.key) {
        if (e.key.length < 3) return;
        var at = s.indexOf(" " + e.key + " ");
        if (at < 0 && e.key.length >= 6) at = s.indexOf(" " + e.key); // plural / suffix e.g. "intramuross", "sm calambas"
        if (at > -1) hits.push({ type: e.type, obj: e.obj, at: at, score: e.key.length + (e.weak ? 0 : 2) + (e.type === "place" ? 0.5 : 0) });
      } else if (e.words) {
        var words = e.words.filter(function (w) { return !cityWords[w]; });
        if (!words.length) return;
        var ok = words.every(function (w) { return s.indexOf(" " + w + " ") > -1 || (w.length >= 6 && s.indexOf(" " + w) > -1); });
        if (ok) hits.push({ type: "place", obj: e.obj, at: s.indexOf(" " + words[0]), score: words.join(" ").length - 1 });
      }
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    // drop hits that sit inside a better hit (e.g. "calamba" inside "sm city calamba")
    var out = [], seen = {};
    hits.forEach(function (h) {
      var id = h.type + ":" + (h.obj.id || h.obj.name);
      if (seen[id]) return;
      seen[id] = 1;
      out.push(h);
    });
    return out;
  }
  function best(t) { return entities(t)[0] || null; }
  function pointOf(e) {
    if (!e) return T.location.get();
    if (e.type === "place") return e.obj;
    if (e.type === "city") return { name: e.obj.name, label: T.dest.label(e.obj), lat: e.obj.lat, lng: e.obj.lng, cityId: e.obj.id };
    var c = T.dest.cities().filter(function (x) { return x.province === e.obj.id; })[0];
    return c ? { name: e.obj.name, label: e.obj.name, lat: c.lat, lng: c.lng } : T.location.get();
  }
  function nameOf(e) { return e.type === "city" ? T.dest.label(e.obj) : e.obj.name; }

  /* ---------- small renderers ---------- */
  function placeList(list, here) {
    here = here || T.location.get();
    return '<div class="ask-places">' + list.map(function (p) {
      var c = T.cat(p.cat), st = T.places.openState(p), s = T.places.score(p), d = T.geo.distance(here, p);
      var extra = p.cat === "stay" && p.room ? "~" + T.peso(p.room) + "/night" : p.price ? "₱".repeat(p.price) : "";
      return '<a class="ask-place cat--' + c.id + '" href="#/place/' + encodeURIComponent(p.id) + '"><span class="ask-place__ic">' + icon(c.icon) + "</span>" +
        "<span><strong>" + esc(p.name) + "</strong><small>" + (s ? icon("star") + s.toFixed(1) + " · " : "") + T.km(d) + (extra ? " · " + extra : "") +
        (st.known ? ' · <em class="' + (st.open ? "ok" : "bad") + '">' + (st.open ? "Open" : "Closed") + "</em>" : "") + "</small></span>" + icon("chev-r") + "</a>";
    }).join("") + "</div>";
  }
  function btn(href, label, ic) { return '<a class="btn btn--ghost btn--sm" href="' + href + '">' + icon(ic || "arrow") + esc(label) + "</a>"; }
  function actions(list) { return '<div class="ask-actions">' + list.join("") + "</div>"; }
  function para(s) { return "<p>" + s + "</p>"; }
  function plain(s) { return para(esc(s)); }

  /* ---------- category words (English + Tagalog) ---------- */
  var CATS = [
    ["stay", /\b(hotels?|stays?|inns?|accommodations?|lodging|matulog|tulugan|tutuluyan|overnight|transient|staycation|check in sa)\b/],
    ["cafe", /\b(cafes?|coffee|kape|kapihan|milk ?tea|frappe|latte|study spot)\b/],
    ["food", /\b(food|foods|eat|eats|restaurants?|resto|kain|kainan|kakain|kumain|makakain|kainin|lunch|dinner|breakfast|almusal|tanghalian|hapunan|merienda|ulam|lomi|bulalo|silog|samgyup|buffet|gutom|hungry|street food)\b/],
    ["theme", /\b(theme parks?|amusement|rides|enchanted kingdom|for kids|pambata)\b/],
    ["resort", /\b(resorts?|hot springs?|swimming|swim|langoy|pool|beach(es)?|dagat|island|isla|pansol)\b/],
    ["mall", /\b(malls?|shopping|mag ?mall|department store)\b/],
    ["market", /\b(markets?|palengke|tiangge|tiange|ukay( ukay)?|divisoria|bilihan|bargain)\b/],
    ["museum", /\b(museums?|museo|gallery|art)\b/],
    ["church", /\b(churche?s?|simbahan|misa|mass|visita iglesia|cathedral|basilica|parish)\b/],
    ["heritage", /\b(heritage|historical|history|kasaysayan|ruins|ancestral|old town|landmarks?)\b/],
    ["park", /\b(parks?|nature|hikes?|hiking|trail|trek|falls|talon|bundok|mountain|garden|picnic|view ?deck|sunset|camping)\b/],
  ];
  function catOf(t) { for (var i = 0; i < CATS.length; i++) if (CATS[i][1].test(t)) return CATS[i][0]; return null; }

  /* ======================================================================
     ANSWERS
     ====================================================================== */
  var SUGGEST = ["How do I get to Intramuros?", "Cafés open now near me", "Cheap food in Calamba", "Things to do in Tagaytay", "Student discount on fares?", "Surprise me!"];

  function greet() {
    var u = T.auth.current(), n = (u && u.name || "").split(" ")[0];
    return { html: plain(pick(["Hi", "Hello", "Kumusta"]) + (n ? ", " + n : "") + "! I'm Tara, your travel buddy. Ask me how to get somewhere, how much the fare is, what's open, or where to eat — in English or Tagalog."),
      chips: SUGGEST.slice(0, 4) };
  }
  function helpAns() {
    return { html: para("Here's what I can help with:") +
      '<ul class="ask-ul"><li><b>Getting there</b> — “How to get from Calamba to Intramuros?”, “Magkano pamasahe papuntang Tagaytay?”</li>' +
      "<li><b>Places</b> — “Cafés open now”, “Cheap food near me”, “Hotels in Lucena”, “Things to do in Rizal”</li>" +
      "<li><b>Place details</b> — “Is Fort Santiago open?”, “Entrance fee of Enchanted Kingdom”</li>" +
      "<li><b>Trip help</b> — discounts, weather, pasalubong, what to bring, safety, emergency numbers</li>" +
      "<li><b>Using Tara</b> — saving trips, installing the app, splitting expenses, Tagalog mode, badges</li></ul>",
      chips: SUGGEST };
  }
  function emergency() {
    return { html: para("<b>For any emergency in the Philippines, call or text 911</b> (police, fire, ambulance — free from any phone).") +
      '<ul class="ask-ul"><li>Barangay hall or tanod — closest help for lost items, disputes and directions</li>' +
      "<li>Tourist Police / nearest police station — report theft or scams</li>" +
      "<li>PAGASA (pagasa.dost.gov.ph) — typhoon and heavy-rain warnings</li>" +
      "<li>Lost in transit? Tell the driver or conductor first, then the terminal office.</li></ul>" +
      para("Save your home address and a family member's number in your phone notes before you travel."),
      chips: ["What should I bring on a trip?", "Is it going to rain?"] };
  }
  function discountAns(e) {
    var D = C.travelerTypes[1];
    var html = para("<b>Students, seniors (60+) and PWD get the same discounts</b> when they show a valid ID:") +
      '<ul class="ask-ul"><li>Jeepney, bus, tricycle, UV Express: <b>' + Math.round(D.road * 100) + "% off</b></li>" +
      "<li>LRT-1, LRT-2 and MRT-3: <b>" + Math.round(D.rail * 100) + "% off</b></li>" +
      "<li>Many museums, parks and heritage sites have a lower entrance fee</li>" +
      "<li>Seniors and PWD also get 20% off (plus no VAT) at restaurants for their own meal</li></ul>";
    if (e && e.type === "place") {
      var f = e.obj.fee;
      if (f && f.regular) html += para(esc(e.obj.name) + ": regular " + T.peso(f.regular) + (f.discounted < f.regular ? ", with ID <b>" + T.peso(f.discounted) + "</b>" : " — no discount listed") + ".");
    }
    var on = T.traveler().entry;
    html += para(on ? "Your discount is <b>on</b>, so Tara already shows discounted fares." : "Turn it on in <b>Profile → Fare discount</b> and every fare in Tara updates.");
    return { html: html + (on ? "" : actions([btn("#/profile", "Open Profile", "id")])), chips: ["How do I get to Intramuros?", "Free places near me"] };
  }

  /* --- route & fare --- */
  function departNow() {
    var d = new Date(), h = d.getHours();
    if (h >= 5 && h < 19) { d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5 + 10, 0, 0); return { d: d, label: "if you leave now" }; }
    d.setDate(d.getDate() + (h >= 19 ? 1 : 0)); d.setHours(8, 0, 0, 0);
    return { d: d, label: "leaving 8:00 AM" + (h >= 19 ? " tomorrow" : "") };
  }
  function routeAns(fromE, toE, focus) {
    var from = pointOf(fromE), to = pointOf(toE);
    var fromName = fromE ? nameOf(fromE) : (T.location.get().label || "your location");
    var dist = T.geo.distance(from, to);
    if (dist < 0.25) return { html: plain("You're already right there — " + nameOf(toE) + " is just a short walk away!") };
    var dep = departNow(), opts = [];
    try { opts = T.planner.options(from, to, dep.d, T.traveler(), 1) || []; } catch (err) { opts = []; }
    if (!opts.length) return { html: plain("I couldn't work out a route to " + nameOf(toE) + ". Try the planner — you can set the exact start and end points there."), actions: [] };
    var o = opts[0];
    var head = (focus === "fare" ? "The fare from <b>" + esc(fromName) + "</b> to <b>" + esc(nameOf(toE)) + "</b> is about <b>" + T.peso(o.fare) + "</b> per person"
      : "From <b>" + esc(fromName) + "</b> to <b>" + esc(nameOf(toE)) + "</b>: about <b>" + T.dur(o.minutes) + "</b> for <b>" + T.peso(o.fare) + "</b> per person") +
      " (" + T.km(dist) + " away, " + dep.label + ").";
    var steps = '<ol class="ask-steps">' + o.legs.filter(function (l) { return l.mode !== "walk" || l.minutes > 4 || o.legs.length === 1; }).map(function (l) {
      return "<li>" + icon(modeIcon(l.mode)) + "<span>" + esc(l.text) + (l.fare ? " <b>" + T.peso(l.fare) + "</b>" : "") + "</span></li>";
    }).join("") + "</ol>";
    var others = opts.slice(1, 4).map(function (x) {
      return "<li><b>" + esc(x.tag || "Option") + "</b> — " + esc(x.title) + " · " + T.dur(x.minutes) + " · " + T.peso(x.fare) + "</li>";
    }).join("");
    var html = para(head) + para("<b>Best option" + (o.tag ? " (" + esc(o.tag) + ")" : "") + ":</b> " + esc(o.title)) + steps +
      (others ? para("Other ways:") + '<ul class="ask-ul">' + others + "</ul>" : "") +
      (T.traveler().entry ? "" : para('<small class="muted">With a student, senior or PWD ID you pay less — ask me “discount”.</small>')) +
      para('<small class="muted">Fares are estimates; travel time changes with traffic.</small>');
    var planHref = toE.type === "place" ? "#/plan?to=" + encodeURIComponent(toE.obj.id) : toE.type === "city" ? "#/plan?city=" + encodeURIComponent(toE.obj.id) : "#/plan";
    return { html: html + actions([btn(planHref, "Plan the full day", "route"), toE.type === "place" ? btn("#/place/" + encodeURIComponent(toE.obj.id), "About this place", "info") : ""]),
      chips: toE.type === "place" ? ["Is " + toE.obj.name + " open now?", "Food near " + toE.obj.name, "Weather in " + (T.dest.city(toE.obj.city) || {}).name] : ["Things to do in " + nameOf(toE).split(",")[0]] };
  }
  function modeIcon(m) { return { walk: "walk", tricycle: "tricycle", jeep: "jeep", bus: "bus", p2p: "bus", uv: "bus", busway: "bus", lrt: "train", grab: "car", car: "car", ferry: "waves" }[m] || "route"; }

  /* --- place details --- */
  function hoursAns(p) {
    var st = T.places.openState(p);
    var html = para("<b>" + esc(p.name) + "</b> — " + (st.known ? (st.open ? '<span class="ok">open now</span>' : '<span class="bad">closed now</span>') + " · " + esc(st.label) : "hours not listed") + ".") +
      para("Usual hours: " + esc(T.places.hoursText(p)) + ".") +
      (p.source !== "osm" ? para('<small class="muted">Hours can change on holidays — call ahead for big trips.</small>') : "");
    return { html: html + actions([btn("#/place/" + encodeURIComponent(p.id), "See place", "info"), btn("#/plan?to=" + encodeURIComponent(p.id), "Plan a trip", "route")]),
      chips: ["Entrance fee of " + p.name, "How do I get to " + p.name + "?"] };
  }
  function feeAns(p) {
    var f = p.fee, html;
    if (p.cat === "stay") html = para("<b>" + esc(p.name) + "</b>: rooms from about <b>" + T.peso(p.room || 0) + "</b> a night (sleeps 2) — check the latest rate before booking.");
    else if (f === 0) html = para("<b>" + esc(p.name) + "</b> is <b>free</b> to enter.");
    else if (!f) html = para("I don't have the entrance fee for " + esc(p.name) + " yet" + (p.cat === "food" || p.cat === "cafe" ? " — it's a place to eat, so you only pay for what you order" + (p.price ? " (" + C.mealLabel[p.price] + " per person)" : "") : "") + ".");
    else html = para("<b>" + esc(p.name) + "</b>: regular <b>" + T.peso(f.regular) + "</b>" + (f.discounted < f.regular ? ", student / senior / PWD <b>" + T.peso(f.discounted) + "</b>" : "") + (f.note ? " (" + esc(f.note) + ")" : "") + ".");
    return { html: html + actions([btn("#/place/" + encodeURIComponent(p.id), "See place", "info")]), chips: ["Is " + p.name + " open now?", "How do I get to " + p.name + "?"] };
  }
  function placeAns(p) {
    var st = T.places.openState(p), s = T.places.score(p), here = T.location.get(), c = T.dest.city(p.city);
    var o = null;
    try { o = T.planner.quick(here, p); } catch (e) {}
    var fee = T.places.fee(p);
    var html = para("<b>" + esc(p.name) + "</b> · " + esc(T.cat(p.cat).label) + (c ? " in " + esc(c.name) : "") + (s ? " · " + icon("star") + s.toFixed(1) : "")) +
      (p.desc ? plain(p.desc) : "") +
      '<ul class="ask-ul">' + "<li>" + icon("clock") + (st.known ? esc(st.label) : "Hours: " + esc(T.places.hoursText(p).toLowerCase())) + "</li>" +
      (p.cat === "stay" ? "<li>" + icon("bed") + "Rooms from ~" + T.peso(p.room || 0) + "/night</li>" : (p.cat === "food" || p.cat === "cafe") ? (p.price ? "<li>" + icon("wallet") + "About " + esc(C.mealLabel[p.price]) + " per person</li>" : "") : fee.amount != null ? "<li>" + icon("wallet") + "Entrance: " + esc(fee.label) + "</li>" : "") +
      (o ? "<li>" + icon("route") + T.km(T.geo.distance(here, p)) + " from you · about " + T.dur(o.minutes) + " and " + T.peso(o.fare) + " by commute</li>" : "") +
      (p.tips && p.tips[0] ? "<li>" + icon("sparkle") + esc(p.tips[0]) + "</li>" : "") + "</ul>";
    return { html: html + actions([btn("#/place/" + encodeURIComponent(p.id), "See photos & reviews", "image"), btn("#/plan?to=" + encodeURIComponent(p.id), "Plan a trip", "route")]),
      chips: ["How do I get to " + p.name + "?", "Food near " + p.name, "Pasalubong in " + (c ? c.name : "Laguna")] };
  }

  /* --- lists of places --- */
  function searchAns(t, cat, scopeE, nearE) {
    var here = nearE ? pointOf(nearE) : T.location.get();
    var cheap = has(t, /\b(cheap|mura|murang|budget|affordable|sulit|tipid)\b/);
    var free = has(t, /\b(free|libre|walang bayad)\b/);
    var openNow = has(t, /\b(open now|bukas ngayon|open today|open pa|open late|still open|bukas pa)\b/) || has(t, /\bopen\b.*\bnow\b/);
    var scope = null, where = "near you";
    if (scopeE && scopeE.type === "city") { scope = { type: "city", id: scopeE.obj.id }; where = "in " + scopeE.obj.name; }
    else if (scopeE && scopeE.type === "province") { scope = { type: "province", id: scopeE.obj.id }; where = "in " + scopeE.obj.name; }
    else if (nearE) where = "near " + nameOf(nearE);
    var list = T.places.query({ near: here, scope: scope, cat: cat || "" });
    if (!cat) list = list.filter(function (x) { return x.p.cat !== "stay"; });
    if (cheap) list = list.filter(function (x) { return x.p.cat === "stay" ? x.p.tier === "budget" : x.p.price ? x.p.price <= 1 : x.p.fee === 0 || (x.p.fee && x.p.fee.regular <= 100); });
    if (free) list = list.filter(function (x) { return x.p.fee === 0 && ["food", "cafe", "stay"].indexOf(x.p.cat) < 0; });
    if (openNow) list = list.filter(function (x) { var s = T.places.openState(x.p); return s.known && s.open; });
    if (!scope) {
      var close = list.filter(function (x) { return x.d <= 20; });
      list = close.length >= 3 ? close : list.slice(0, 8);
    }
    list.sort(function (a, b) { return ((T.places.score(b.p) || 4) - b.d / 25) - ((T.places.score(a.p) || 4) - a.d / 25); });
    var label = (cheap ? "budget-friendly " : free ? "free " : "") + (cat ? T.cat(cat).label.toLowerCase() : "places") + (openNow ? " open now" : "") + " " + where;
    if (!list.length) {
      return { html: plain("I couldn't find " + label + " in Tara's guide yet." + (openNow ? " Many places may be closed at this hour." : "")) +
        actions([btn("#/explore" + (cat ? "?cat=" + cat : ""), "Browse Explore", "compass")]), chips: [openNow ? (cat ? T.cat(cat).short : "Places") + " " + where : "", "Surprise me!", "Things to do near me"].filter(Boolean) };
    }
    var top = list.slice(0, 5).map(function (x) { return x.p; });
    var ex = "#/explore?" + (cat ? "cat=" + cat + "&" : "") + (scopeE && scopeE.type === "city" ? "city=" + scopeE.obj.id : "");
    return { html: para("Here are " + (list.length > 5 ? "the top 5 of " + list.length + " " : "") + esc(label) + ":") + placeList(top, here) +
      (cat === "stay" ? para('<small class="muted">Rates are approximate per room per night — check before booking.</small>') : "") +
      actions([btn(ex.replace(/[?&]$/, ""), "See all in Explore", "compass")]),
      chips: [top[0] ? "How do I get to " + top[0].name + "?" : "", cheap ? "" : "Cheap " + (cat ? T.cat(cat).short.toLowerCase() : "food") + " " + where, openNow ? "" : (cat ? T.cat(cat).short : "Places") + " open now " + where].filter(Boolean) };
  }
  function cityGuide(e) {
    var scope = e.type === "city" ? { type: "city", id: e.obj.id } : { type: "province", id: e.obj.id };
    var list = T.places.query({ scope: scope, sort: "rating" }).filter(function (x) { return x.p.cat !== "stay"; });
    var cats = {}, top = [];
    list.forEach(function (x) { if (top.length < 6 && (cats[x.p.cat] || 0) < 2) { cats[x.p.cat] = (cats[x.p.cat] || 0) + 1; top.push(x.p); } });
    if (!top.length) return { html: plain("I don't have places listed in " + e.obj.name + " yet. Try Explore for live places nearby.") + actions([btn("#/explore", "Explore", "compass")]) };
    var c = e.type === "city" ? e.obj : null;
    var pasa = c && C.pasalubong && C.pasalubong[c.id];
    var html = para("<b>" + esc(e.obj.name) + "</b>" + (c && c.blurb ? " — " + esc(c.blurb) : "") + " Tara lists <b>" + list.length + "</b> places there. Top picks:") +
      placeList(top) + (pasa ? para("Pasalubong to bring home: " + esc(pasa.join(", ")) + ".") : "");
    return { html: html + actions([c ? btn("#/city/" + c.id, "City guide", "map") : btn("#/explore", "Explore", "compass"), btn(c ? "#/plan?city=" + c.id : "#/plan", "Plan a trip", "route")]),
      chips: ["How do I get to " + e.obj.name + "?", "Cheap food in " + e.obj.name, "Hotels in " + e.obj.name] };
  }
  function pasalubongAns(e) {
    var c = e && e.type === "city" ? e.obj : e && e.type === "place" ? T.dest.city(e.obj.city) : T.dest.current();
    var items = c && C.pasalubong && C.pasalubong[c.id];
    var shops = c ? T.places.query({ scope: { type: "city", id: c.id }, cat: "market" }).slice(0, 4).map(function (x) { return x.p; }) : [];
    if (!items && !shops.length) {
      return { html: plain("Popular pasalubong around Calabarzon: buko pie and espasol (Laguna), tablea and suman (Batangas), Lucban longganisa and broas (Quezon), kasoy and suman (Rizal), and Tagaytay's buko tarts and Bag of Beans cakes."),
        chips: ["Pasalubong in Calamba", "Pasalubong in Los Baños"] };
    }
    return { html: para("Pasalubong from <b>" + esc(c.name) + "</b>: " + esc((items || ["local delicacies"]).join(", ")) + ".") + (shops.length ? para("Where to buy:") + placeList(shops) : "") +
      para('<small class="muted">Tip: on a saved trip, Tara keeps a pasalubong checklist for you.</small>'), chips: ["Things to do in " + c.name] };
  }
  function surpriseAns() {
    var here = T.location.get();
    var list = T.places.query({ near: here }).filter(function (x) { return x.d < 70 && x.p.cat !== "stay" && (T.places.score(x.p) || 0) >= 4.3; });
    var x = pick(list.length ? list : T.places.query({ near: here }).slice(0, 20));
    var r = placeAns(x.p);
    r.html = para(pick(["How about this one?", "Tara, try this!", "Here's an idea:"])) + r.html;
    r.chips = ["Surprise me again!", "How do I get to " + x.p.name + "?"];
    return r;
  }
  function nextTripAns() {
    var t = T.trips.next && T.trips.next();
    if (!t) return { html: plain("You don't have an upcoming trip saved yet. Plan one and I'll remind you of the details.") + actions([btn("#/plan", "Plan a trip", "route")]) };
    return { html: para("Your next trip: <b>" + esc(t.name || t.to.name) + "</b> on <b>" + esc(T.date(new Date(t.option.depart), true)) + "</b>. Leave at <b>" + esc(T.time(new Date(t.option.depart))) + "</b> — about " + T.peso(t.option.fare) + " in fares one way.") +
      actions([btn("#/trip/" + t.id, "Open trip", "ticket")]), chips: ["Is it going to rain?", "What should I bring on a trip?"] };
  }
  function weatherAns(e) {
    var loc = e ? pointOf(e) : T.location.get();
    var nm = e ? nameOf(e) : (T.location.get().label || "your area").split(",").slice(-2).join(",").trim();
    return T.weather.get(loc).then(function (w) {
      if (!w || !w.current) return { html: plain("I can't reach the forecast right now — check your internet connection, or see pagasa.dost.gov.ph.") };
      var d = T.weather.describe(w.current.code), out = para("Right now in <b>" + esc(nm) + "</b>: " + icon(d.icon) + Math.round(w.current.temp) + "°C, " + esc(d.label.toLowerCase()) + ".");
      var tm = T.addMin(new Date(), 1440), f = T.weather.forDate(w, tm);
      var today = T.weather.forDate(w, new Date());
      if (today) out += para("Today: " + Math.round(today.min) + "–" + Math.round(today.max) + "°C, " + today.rain + "% chance of rain." + (today.rain >= 50 ? " Bring an umbrella!" : ""));
      if (f) out += para("Tomorrow: " + esc(T.weather.describe(f.code).label.toLowerCase()) + ", " + Math.round(f.min) + "–" + Math.round(f.max) + "°C, " + f.rain + "% chance of rain.");
      return { html: out, chips: ["What should I bring on a trip?", "Indoor places near me"] };
    }).catch(function () { return { html: plain("I can't reach the forecast right now — try again when you're online.") }; });
  }

  /* --- quick knowledge: app help and travel tips --- */
  var FAQ = [
    [/\b(how (to|do i) use (tara|the app|this)|what is tara|ano ang tara|paano gamitin|guide|tutorial|how does (tara|this app|it) work|how to use)\b/, function () {
      return { html: para("<b>Tara</b> is your travel buddy: find places per city, plan the commute (what to ride, signboards, fares with discounts), get a day schedule and budget, then save the trip and follow it live.") +
        para("Quick start: set your location on Home → explore places → tap the orange <b>Plan</b> button → save the trip → tap <b>Start live trip</b> on the day.") +
        actions([btn("#/guide", "Full guide", "info"), btn("#/plan", "Plan a trip", "route")]), chips: ["How do I get to Intramuros?", "Student discount on fares?"] };
    }],
    [/\b(install|download|i ?download|home screen|play ?store|apk)\b/, function () {
      return { html: para("Tara works like an app:") + '<ul class="ask-ul"><li><b>Android (Chrome)</b>: tap <b>Install app</b> or menu ⋮ → <b>Add to Home screen</b></li><li><b>iPhone (Safari)</b>: tap Share → <b>Add to Home Screen</b></li><li>After installing, saved trips and places work even offline.</li></ul>' };
    }],
    [/\b(language|tagalog mode|english mode|wika|filipino)\b/, function () { return { html: para("Go to <b>Profile → App → Language</b> and pick English or Tagalog. Buttons and menus switch right away.") + actions([btn("#/profile", "Open Profile", "globe")]) }; }],
    [/\b(split|hatian|hati|expenses?|gastos|who owes|utang)\b/, function () { return { html: para("Open a saved trip and scroll to <b>Group expenses</b>. Add your companions, log each expense and who paid — Tara shows who owes whom with the fewest payments, and you can share the summary to your group chat.") + actions([btn("#/trips", "My trips", "ticket")]) }; }],
    [/\b(report (the )?(real )?fares?|fare reports?|real fares?|wrong fare|actual fare|totoong pamasahe)\b/, function () { return { html: para("On any trip plan, tap <b>Report real fare</b> under a ride. Enter what you actually paid (and the signboard). Tara uses your report the next time and you can share your reports from Profile.") }; }],
    [/\b(save|i ?save|bookmark).*(trip|place|plan)|\b(trip|place) .*save/, function () { return { html: para("Tap the <b>heart</b> on any place to save it (see them in Profile). For trips, build a plan in <b>Plan</b> and tap <b>Save trip</b> — it appears in <b>Trips</b> with reminders, checklist and live mode.") }; }],
    [/\b(offline|no internet|walang internet|no signal|walang signal|data)\b/, function () { return { html: para("Saved trips, places and this chat work offline once Tara has been opened online. Live nearby places, photos and weather need internet.") }; }],
    [/\b(badges?|check ?ins?|been here|level|points|xp)\b/, function () { return { html: para("Tap <b>Been here</b> on a place you've visited to check in. Check-ins, saved trips and reviews earn <b>badges</b> and raise your explorer level — see them in Profile.") + actions([btn("#/profile", "My badges", "flag")]) }; }],
    [/\b(review|rate a place|rating)\b/, function () { return { html: para("Open a place and tap <b>Write a review</b>. Add stars, a comment and photos to help other travelers.") }; }],
    [/\b(bring|dalhin|pack|packing|checklist|what to wear|susuotin)\b/, function () {
      return { html: para("A good day-trip kit:") + '<ul class="ask-ul"><li>Valid ID (and student/senior/PWD ID for discounts)</li><li>Coins and small bills — ₱20s, ₱50s and coins for jeeps and tricycles</li><li>Powerbank, water, umbrella or cap, sunscreen</li><li>Face towel and alcohol / wipes</li><li>For beaches and boats: dry bag, slippers, extra clothes</li></ul>' };
    }],
    [/\b(safe|safety|scam|ligtas|snatch|holdap|pickpocket|mandurukot)\b/, function () {
      return { html: '<ul class="ask-ul"><li>Keep your phone and wallet in front pockets or a zipped bag, especially in jeeps and crowded stations</li><li>Agree on the tricycle fare before you ride on special trips</li><li>Use official terminals and marked taxis or Grab at night</li><li>Share your trip with family — tap <b>Share</b> on a saved trip</li><li>Emergency: <b>911</b></li></ul>' };
    }],
    [/\b(budget|how much (do i need|money|should i bring)|magkano (ang )?(dala|budget|kailangan))\b/, function () {
      return { html: para("For a day trip, plan on: fares (both ways) + entrance fees + about " + C.mealLabel[1] + " to " + C.mealLabel[2] + " per meal + ₱200–300 extra for snacks and pasalubong. When you plan a trip, Tara adds this up for you in the <b>Budget</b> card.") + actions([btn("#/plan", "Plan a trip", "route")]) };
    }],
    [/\b(best time|when to (go|visit)|kailan|rush hour|traffic|trapik|trapiko)\b/, function () {
      return { html: para("Leave before <b>6:30 AM</b> or after <b>9:30 AM</b> to dodge the morning rush, and avoid <b>4:30–8 PM</b> on weekdays. Weekdays are less crowded at parks and museums (many museums close on Mondays). Dry season is Dec–May; June–Nov brings rain and typhoons.") };
    }],
    [/\b(grab|taxi|angkas|joyride|move it|motor taxi)\b/, function () {
      return { html: para("Grab and taxis go door-to-door — easiest at night or with a group of 3–4 sharing the fare. Motorcycle taxis (Angkas, JoyRide, Move It) are fast through traffic in Metro Manila. Tara shows a Grab/taxi option in route plans when it makes sense.") };
    }],
    [/\b(beep|stored value|card).*(lrt|mrt|train)|\b(lrt|mrt)\b.*\b(card|beep|ticket)/, function () {
      return { html: para("For LRT-1, LRT-2 and MRT-3 you can buy a single-journey ticket or use a <b>beep card</b> (load at stations). Students, seniors and PWD get 50% off single-journey tickets at the window — show your ID. Avoid rush hour if you have big bags.") };
    }],
  ];

  /* ======================================================================
     ROUTER — understand the question
     ====================================================================== */
  function answer(raw) {
    var t = norm(raw);
    if (!t) return helpAns();
    var words = t.split(" ").length;
    var ents = entities(t), e = ents[0] || null;
    var placeE = ents.filter(function (x) { return x.type === "place"; })[0] || null;
    var areaE = ents.filter(function (x) { return x.type !== "place"; })[0] || null;

    if (words <= 4 && has(t, /^(hi|hello|hey|helo|kumusta|kamusta|musta|good (morning|afternoon|evening|day)|magandang (umaga|hapon|gabi|araw)|yo|uy|hoy|tara)\b/)) return greet();
    if (has(t, /\b(thank|thanks|salamat|ty|tnx|thx)\b/)) return { html: plain(pick(["Walang anuman! Ingat sa biyahe.", "You're welcome! Enjoy the trip.", "Anytime — tara, lakad tayo!"])) };
    if (has(t, /\b(who are you|what are you|sino ka|ano ka|your name|pangalan mo)\b/)) return { html: plain("I'm Tara, the travel helper inside this app. I answer from Tara's own guide of places, routes and fares — so I'm best at questions about getting around and things to do in Metro Manila and Calabarzon.") , chips: SUGGEST.slice(0, 3) };
    if (has(t, /\b(emergency|911|police|pulis|ambulance|ambulansya|hospital|ospital|sunog|hotline|nawawala|naligaw|got lost|i am lost|im lost|aksidente|accident)\b/)) return emergency();
    if (!e && has(t, /\b(what can you|help|tulong|tulungan|commands|options)\b/)) return helpAns();
    if (has(t, /\b(surprise|random|kahit saan|anywhere|bahala ka|where should (i|we) go|saan (kami|ako|tayo) (pupunta|pwede|magandang)|saan maganda|ideas?)\b/) && !catOf(t) && !e) return surpriseAns();
    if (has(t, /\b(my|next|upcoming) trip\b|\bbiyahe ko\b|\blakad ko\b/)) return nextTripAns();
    if (has(t, /\b(discount|discounted|student|students|senior|seniors|pwd|estudyante|diskwento|diskuwento|20 ?percent|50 ?percent)\b/) && !has(t, /\b(how (do|to) (i )?get|papunta|from)\b/)) return discountAns(placeE);
    if (has(t, /\b(weather|panahon|forecast|rain|raining|ulan|uulan|umuulan|bagyo|typhoon|temperature|how hot|mainit)\b/)) return weatherAns(areaE || placeE);
    if (has(t, /\b(pasalubong|souvenirs?|delicacy|delicacies|specialty|kakanin|bring home)\b/)) return pasalubongAns(e);
    for (var i = 0; i < FAQ.length; i++) if (FAQ[i][0].test(t) && !(e && FAQ[i][0].source.indexOf("review") > -1)) return FAQ[i][1](t);

    // routes and fares: "from A to B", "A to B", "papuntang B", "how to get to B", "fare to B"
    var routeWords = /\b(how (do|can|to) (i |we )?(get|go|commute|travel)|get to|go to|going to|getting to|papunta|papuntang|pumunta|pupunta|punta|makarating|commute|byahe|biyahe|sakay|sumakay|route|directions|how far|gaano kalayo|travel time|ilang oras|how long)\b/;
    var fareWords = /\b(fare|fares|pamasahe|plete|magkano)\b/;
    var m = /\b(?:from|mula sa|mula|galing sa|galing) (.+?) (?:to|papunta sa|papuntang|papunta|hanggang) (.+)$/.exec(t) || /^(.+?) (?:to|papuntang|papunta sa|papunta) (.+)$/.exec(t);
    if (m && (routeWords.test(t) || fareWords.test(t) || /^(from|mula|galing)\b/.test(t) || words <= 6)) {
      var a = best(m[1]), b = best(m[2]);
      if (a && b && a.obj !== b.obj) return routeAns(a, b, fareWords.test(t) ? "fare" : "");
      if (b && !a && /\b(here|me|my (house|place|home)|bahay|dito|amin)\b/.test(m[1])) return routeAns(null, b, fareWords.test(t) ? "fare" : "");
    }
    var asksRoute = routeWords.test(t), asksFare = fareWords.test(t) && !has(t, /\b(entrance|ticket|admission|fee|room|hotel|rate)\b/);
    if ((asksRoute || asksFare) && e && (!catOf(t) || placeE === e)) return routeAns(null, e, asksFare ? "fare" : "");

    if (placeE && placeE === e) {
      if (has(t, /\b(open|bukas|close|closed|closing|sarado|hours|oras|what time|anong oras|schedule)\b/)) return hoursAns(placeE.obj);
      if (has(t, /\b(entrance|fee|fees|ticket|tickets|admission|bayad|magkano|how much|price|rate|rates|room)\b/)) return feeAns(placeE.obj);
    }
    var cat = catOf(t);
    if (cat || has(t, /\b(open now|bukas ngayon|cheap|mura|free|libre|near me|nearby|malapit)\b/) && !placeE) {
      var nearE = placeE && has(t, /\b(near|malapit|around|beside|katabi|close to)\b/) ? placeE : null;
      return searchAns(t, cat, nearE ? null : areaE, nearE);
    }
    if (has(t, /\b(things to do|what to do|where to go|pasyalan|puntahan|attractions?|tourist spots?|gala|gagawin|visit|ano meron|anong meron|explore)\b/)) {
      if (areaE) return cityGuide(areaE);
      if (!e) return searchAns(t, null, null, null);
    }
    if (e && e.type === "place") return placeAns(e.obj);
    if (e) return cityGuide(e);
    // last try: free-text search of the guide
    var q = t.replace(/\b(where|is|are|the|a|an|ano|saan|ang|mga|po|ba|may|meron|i|want|gusto|ko|ng|sa|to|in|for|me|show|find|hanap)\b/g, " ").replace(/\s+/g, " ").trim();
    var found = q.length >= 3 ? T.places.query({ q: q }).slice(0, 5).map(function (x) { return x.p; }) : [];
    if (found.length) return { html: para("Here's what I found for “" + esc(q) + "”:") + placeList(found) };
    return { html: plain("Sorry, I didn't get that yet. I'm best with questions about places, routes, fares and trips. Try one of these:"), chips: SUGGEST };
  }

  /* ======================================================================
     CHAT SCREEN
     ====================================================================== */
  var MAX = 40;
  function chatLog() { return T.data.get("chat", []); }
  function saveHistory(h) { T.data.set("chat", h.slice(-MAX)); }
  function bubble(m) {
    if (m.who === "me") return '<div class="msg msg--me"><div class="msg__b">' + esc(m.text) + "</div></div>";
    return '<div class="msg msg--bot"><span class="msg__av" aria-hidden="true"><svg class="logo-av"><use href="#i-logo"/></svg></span><div class="msg__b">' + m.html + "</div></div>";
  }
  function chipsHtml(chips) {
    return chips && chips.length ? '<div class="ask-chips">' + chips.slice(0, 4).map(function (c) { return '<button class="chip chip--sm" type="button" data-action="ask-chip" data-q="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" : "";
  }
  function scrollDown() {
    var pop = $(".askpop__body");
    if (pop && pop.contains($("#chat"))) { pop.scrollTo({ top: pop.scrollHeight, behavior: T.reduceMotion ? "auto" : "smooth" }); return; }
    var last = $("#chat .msg:last-of-type");
    if (last) last.scrollIntoView({ block: "start", behavior: T.reduceMotion ? "auto" : "smooth" });
  }
  var busy = false;
  function ask(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    var box = $("#chat");
    if (!box) { T.router.go("ask?q=" + encodeURIComponent(text)); return; }
    busy = true;
    $$(".ask-chips", box).forEach(function (c) { c.remove(); });
    var h = chatLog();
    h.push({ who: "me", text: text, at: Date.now() });
    box.insertAdjacentHTML("beforeend", bubble({ who: "me", text: text }) + '<div class="msg msg--bot msg--typing" id="typing"><span class="msg__av" aria-hidden="true"><svg class="logo-av"><use href="#i-logo"/></svg></span><div class="msg__b"><i></i><i></i><i></i></div></div>');
    scrollDown();
    var r;
    try { r = answer(text); } catch (err) { r = { html: plain("Oops — something went wrong while answering. Please try asking another way.") }; if (window.console) console.warn(err); }
    Promise.all([Promise.resolve(r), new Promise(function (res) { setTimeout(res, T.reduceMotion ? 50 : 450 + Math.min(600, text.length * 8)); })]).then(function (v) {
      var a = v[0] || { html: plain("…") };
      var ty = $("#typing");
      if (ty) ty.remove();
      busy = false;
      if (!document.body.contains(box)) return;
      h.push({ who: "bot", html: a.html, at: Date.now() });
      saveHistory(h);
      box.insertAdjacentHTML("beforeend", bubble({ who: "bot", html: a.html }) + chipsHtml(a.chips));
      T.photos && T.photos.hydrate && T.photos.hydrate(box);
      scrollDown();
    });
  }

  T.views.ask = function (r) {
    var h = chatLog();
    var intro = greet();
    var html = '<header class="phead phead--sticky ask-head">' +
      '<button class="icon-btn" type="button" data-action="back" aria-label="Back">' + icon("chev-l") + "</button>" +
      '<span class="ask-head__av" aria-hidden="true"><svg class="logo-av"><use href="#i-logo"/></svg></span>' +
      '<div class="phead__title"><h1>Ask Tara</h1><p><span class="dot-live"></span>Travel helper · works offline</p></div>' +
      (h.length ? '<button class="icon-btn" type="button" data-action="ask-clear" aria-label="Clear chat">' + icon("trash") + "</button>" : "") + "</header>" +
      '<div class="chat" id="chat" aria-live="polite">' + bubble({ who: "bot", html: intro.html }) +
      h.map(bubble).join("") + (h.length ? "" : chipsHtml(SUGGEST)) + "</div>" +
      '<form class="ask-bar" data-submit="ask" autocomplete="off"><input class="input" name="q" placeholder="Ask about places, routes, fares…" aria-label="Your question" enterkeyhint="send" maxlength="200">' +
      '<button class="ask-bar__send" type="submit" aria-label="Send">' + icon("arrow") + "</button></form>";
    T.ui.mount(html, { nav: "", cls: "view--ask" });
    var q = r && r.query && r.query.q;
    if (q) { history.replaceState(null, "", "#/ask"); setTimeout(function () { ask(q); }, 250); }
    else setTimeout(scrollDown, 50);
  };
  T.submits.ask = function (form) {
    var v = form.q.value;
    form.q.value = "";
    ask(v);
  };
  T.actions["ask-chip"] = function (el) { ask(el.dataset.q); };
  T.actions["ask-clear"] = function () { T.data.set("asked", T.data.get("asked", 0) + chatLog().filter(function (m) { return m.who === "me"; }).length); T.data.set("chat", []); T.router.resolve(); };

  /* ---------- floating chat bubble: ask anytime, from any screen ---------- */
  var HIDE_ON = { ask: 1, live: 1, welcome: 1, login: 1, signup: 1, setup: 1 };
  var POSK = "tara.bubble.pos";
  function bubbleEl() {
    var el = $(".ask-bubble");
    if (el) return el;
    el = document.createElement("button");
    el.type = "button";
    el.className = "ask-bubble";
    el.setAttribute("aria-label", "Ask Tara — your travel helper");
    el.innerHTML = '<svg class="logo-av" aria-hidden="true"><use href="#i-logo"/></svg><span class="ask-bubble__dot" aria-hidden="true">' + icon("chat") + "</span>";
    document.body.appendChild(el);
    var pos = T.store.get(POSK, null);
    place(el, pos ? pos.side : "right", pos ? pos.y : null);
    drag(el);
    return el;
  }
  function place(el, side, y) {
    var vh = window.innerHeight, min = 80, max = vh - 78 - (window.innerWidth < 980 ? 68 + 12 : 20);
    if (y == null) y = max;
    y = Math.max(min, Math.min(max, y));
    el.dataset.side = side;
    el.style.top = y + "px";
    el.style.left = side === "left" ? "12px" : "auto";
    el.style.right = side === "right" ? "12px" : "auto";
  }
  function drag(el) {
    var sx, sy, ox, oy, moved = false, down = false;
    el.addEventListener("pointerdown", function (e) {
      down = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      moved = true;
      el.classList.add("is-dragging");
      el.style.left = Math.max(4, Math.min(window.innerWidth - 64, ox + dx)) + "px";
      el.style.right = "auto";
      el.style.top = Math.max(60, Math.min(window.innerHeight - 70, oy + dy)) + "px";
    });
    var up = function () {
      if (!down) return;
      down = false;
      el.classList.remove("is-dragging");
      if (!moved) { openPop(); return; }
      var r = el.getBoundingClientRect(), side = r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right";
      place(el, side, r.top);
      T.store.set(POSK, { side: side, y: r.top });
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", function () { down = false; el.classList.remove("is-dragging"); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPop(); } });
  }
  function popEl() {
    var el = $(".askpop");
    if (el) return el;
    el = document.createElement("section");
    el.className = "askpop";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Ask Tara");
    document.body.appendChild(el);
    return el;
  }
  function openPop() {
    if ($("#chat") && T.router.parse().name === "ask") return;
    var el = popEl(), h = chatLog();
    el.innerHTML = '<header class="askpop__head"><span class="ask-head__av" aria-hidden="true"><svg class="logo-av"><use href="#i-logo"/></svg></span>' +
      '<div><strong>Ask Tara</strong><small><span class="dot-live"></span>Ask anything about your trip</small></div>' +
      '<a class="icon-btn" href="#/ask" aria-label="Open full screen">' + icon("chev-u") + "</a>" +
      '<button class="icon-btn" type="button" data-action="askpop-close" aria-label="Close">' + icon("close") + "</button></header>" +
      '<div class="askpop__body"><div class="chat" id="chat" aria-live="polite">' + bubble({ who: "bot", html: greet().html }) +
      h.slice(-12).map(bubble).join("") + chipsHtml(h.length ? ["Surprise me!", "How do I get to Intramuros?", "How to use Tara"] : SUGGEST) + "</div></div>" +
      '<form class="askpop__bar" data-submit="ask" autocomplete="off"><input class="input" name="q" placeholder="Type your question…" aria-label="Your question" enterkeyhint="send" maxlength="200">' +
      '<button class="ask-bar__send" type="submit" aria-label="Send">' + icon("arrow") + "</button></form>";
    el.hidden = false;
    document.body.classList.add("askpop-open");
    requestAnimationFrame(function () { el.classList.add("is-open"); var b = $(".askpop__body"); if (b) b.scrollTop = b.scrollHeight; });
    if (window.innerWidth >= 980) setTimeout(function () { var i = $(".askpop__bar input"); if (i) i.focus(); }, 200);
  }
  function closePop() {
    var el = $(".askpop");
    if (!el || el.hidden) return;
    el.classList.remove("is-open");
    document.body.classList.remove("askpop-open");
    setTimeout(function () { el.hidden = true; el.innerHTML = ""; }, 250);
  }
  T.actions["askpop-close"] = closePop;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  function fab() {
    var r = T.router.parse(), el = bubbleEl();
    var show = !!T.auth.current() && !HIDE_ON[r.name] && !document.body.classList.contains("is-auth");
    el.hidden = !show;
    if (!show) closePop();
    // a friendly hello the first time in a session
    if (show && !sessionStorage.getItem("tara.bubble.hi")) {
      try { sessionStorage.setItem("tara.bubble.hi", "1"); } catch (e) {}
      setTimeout(function () {
        if (el.hidden || $(".askpop.is-open")) return;
        var tip = document.createElement("div");
        tip.className = "ask-tip ask-tip--" + el.dataset.side;
        tip.textContent = "Hi! Ask me anything — fares, routes, places 👋";
        tip.style.top = (parseFloat(el.style.top) + 8) + "px";
        document.body.appendChild(tip);
        setTimeout(function () { tip.classList.add("is-leaving"); setTimeout(function () { tip.remove(); }, 400); }, 4200);
      }, 1500);
    }
  }
  var origResolve = T.router.resolve;
  T.router.resolve = function () { closePop(); var out = origResolve.apply(this, arguments); setTimeout(fab, 0); return out; };
  window.addEventListener("resize", function () { var el = $(".ask-bubble"); if (el) place(el, el.dataset.side, parseFloat(el.style.top)); });
  setTimeout(fab, 300);

  T.assistant = { answer: answer, ask: ask, entities: entities, norm: norm, fab: fab, open: openPop, close: closePop };
})();
