/* ==========================================================================
   TARA — check-ins, badges and explorer levels.
   "Been here" on a place checks you in; check-ins, saved trips and reviews
   earn badges and points. Saved per user on this device.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, $ = T.$, esc = T.esc, icon = T.icon;

  var LEVELS = [
    { at: 0, name: "Bagong Lakad", en: "New explorer" },
    { at: 40, name: "Gala Starter", en: "Getting out there" },
    { at: 100, name: "Lakwatsero", en: "Loves to roam" },
    { at: 200, name: "Road Tripper", en: "Always on the move" },
    { at: 350, name: "Biyahero", en: "Seasoned traveler" },
    { at: 550, name: "Tara Legend", en: "Knows every route" },
  ];
  var IN = function (list) { return function (p) { return list.indexOf(p.cat) > -1; }; };
  var BADGES = [
    { id: "first", icon: "flag", name: "First stop", desc: "Check in at your first place", need: 1, count: function (s) { return s.visits.length; } },
    { id: "explorer", icon: "compass", name: "Explorer", desc: "Check in at 10 places", need: 10, count: function (s) { return s.visits.length; } },
    { id: "trailblazer", icon: "fire", name: "Trailblazer", desc: "Check in at 25 places", need: 25, count: function (s) { return s.visits.length; } },
    { id: "cities", icon: "map", name: "Town hopper", desc: "Visit places in 5 cities or towns", need: 5, count: function (s) { return s.cities; } },
    { id: "provinces", icon: "globe", name: "Province hopper", desc: "Visit 3 provinces", need: 3, count: function (s) { return s.provinces; } },
    { id: "cafe", icon: "coffee", name: "Café crawler", desc: "Check in at 5 cafés", need: 5, count: function (s) { return s.of(IN(["cafe"])); } },
    { id: "food", icon: "utensils", name: "Foodie", desc: "Check in at 5 food spots", need: 5, count: function (s) { return s.of(IN(["food"])); } },
    { id: "history", icon: "castle", name: "History buff", desc: "Visit 5 heritage sites, museums or churches", need: 5, count: function (s) { return s.of(IN(["heritage", "museum", "church"])); } },
    { id: "nature", icon: "tree", name: "Nature lover", desc: "Visit 3 parks or nature spots", need: 3, count: function (s) { return s.of(IN(["park"])); } },
    { id: "beach", icon: "waves", name: "Swim & soak", desc: "Visit 3 resorts, beaches or hot springs", need: 3, count: function (s) { return s.of(IN(["resort"])); } },
    { id: "planner", icon: "route", name: "Planner", desc: "Save your first trip", need: 1, count: function (s) { return s.trips; } },
    { id: "multi", icon: "bed", name: "Weekender", desc: "Save a trip with an overnight stay", need: 1, count: function (s) { return s.multiDay; } },
    { id: "reviewer", icon: "star", name: "Reviewer", desc: "Write 3 reviews", need: 3, count: function (s) { return s.reviews; } },
    { id: "curious", icon: "chat", name: "Curious", desc: "Ask Tara 5 questions", need: 5, count: function (s) { return s.asked; } },
  ];

  function visited() { return T.data.get("visited", {}); }
  function stats() {
    var v = visited(), u = T.auth.current();
    var visits = Object.keys(v).map(function (id) { return T.places.get(id); }).filter(Boolean);
    var cities = {}, provs = {};
    visits.forEach(function (p) { var c = T.dest.city(p.city); if (c) { cities[c.id] = 1; provs[c.province] = 1; } });
    var trips = T.trips.all();
    var all = T.store.get("tara.reviews", {}), reviews = 0;
    Object.keys(all).forEach(function (k) { all[k].forEach(function (r) { if (u && r.uid === u.id) reviews++; }); });
    var asked = T.data.get("chat", []).filter(function (m) { return m.who === "me"; }).length + T.data.get("asked", 0);
    return {
      visits: visits, cities: Object.keys(cities).length, provinces: Object.keys(provs).length,
      trips: trips.length, multiDay: trips.filter(function (t) { return Array.isArray(t.days) ? t.days.length > 1 : (t.days || 1) > 1; }).length,
      reviews: reviews, asked: asked,
      of: function (fn) { return visits.filter(fn).length; },
    };
  }
  function badges(s) {
    s = s || stats();
    return BADGES.map(function (b) { var n = b.count(s); return { b: b, n: Math.min(n, b.need), earned: n >= b.need }; });
  }
  function points(s, bs) {
    return s.visits.length * 10 + s.trips * 15 + s.reviews * 10 + Math.min(s.asked, 10) * 2 + bs.filter(function (x) { return x.earned; }).length * 20;
  }
  function level(pts) {
    var i = 0;
    while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1].at) i++;
    var next = LEVELS[i + 1];
    return { i: i, cur: LEVELS[i], next: next, pct: next ? Math.round((pts - LEVELS[i].at) / (next.at - LEVELS[i].at) * 100) : 100 };
  }
  function summary() {
    var s = stats(), bs = badges(s), pts = points(s, bs);
    return { s: s, badges: bs, points: pts, level: level(pts), earned: bs.filter(function (x) { return x.earned; }).length };
  }

  // remember which badges were already celebrated so we only cheer once
  function celebrate() {
    var seen = T.data.get("badges.seen", null), sum = summary();
    var now = sum.badges.filter(function (x) { return x.earned; }).map(function (x) { return x.b.id; });
    if (seen === null) { T.data.set("badges.seen", now); return; } // first run: no fireworks for old progress
    var fresh = now.filter(function (id) { return seen.indexOf(id) < 0; });
    if (!fresh.length) return;
    T.data.set("badges.seen", seen.concat(fresh));
    fresh.forEach(function (id, k) {
      var b = BADGES.filter(function (x) { return x.id === id; })[0];
      setTimeout(function () { T.toast("Badge unlocked: " + b.name, b.desc + " · see it in Profile", b.icon, "badge"); confetti(); }, 300 + k * 900);
    });
  }
  function confetti() {
    if (T.reduceMotion) return;
    var box = document.createElement("div");
    box.className = "confetti";
    box.setAttribute("aria-hidden", "true");
    var colors = ["#f57a3d", "#ffc24b", "#2fa36b", "#24868a", "#e0457b", "#7b5cd6"];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.25) + "s";
      p.style.setProperty("--x", (Math.random() * 160 - 80) + "px");
      p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 2200);
  }

  /* ---------- UI pieces used by views ---------- */
  function visitBtn(p) {
    var on = !!visited()[p.id];
    return '<button class="btn btn--ghost visit-btn' + (on ? " is-on" : "") + '" type="button" data-action="visit" data-id="' + esc(p.id) + '" aria-pressed="' + on + '">' +
      icon(on ? "check" : "flag") + (on ? "Been here" : "I've been here") + "</button>";
  }
  function levelBar(sum, compact) {
    var L = sum.level;
    return '<div class="lvl' + (compact ? " lvl--compact" : "") + '"><span class="lvl__badge">' + (L.i + 1) + '</span><div class="lvl__body"><strong>' + esc(L.cur.name) + "</strong>" +
      "<small>" + (L.next ? sum.points + " pts · " + (L.next.at - sum.points) + " to " + esc(L.next.name) : sum.points + " pts · top level!") + "</small>" +
      '<span class="lvl__bar"><span style="width:' + L.pct + '%"></span></span></div></div>';
  }
  function profileCard() {
    var sum = summary();
    return '<div class="card badges-card"><div class="sec-head"><h3>' + icon("flag") + ' Travel badges</h3><span class="muted">' + sum.earned + "/" + BADGES.length + "</span></div>" +
      levelBar(sum) +
      '<div class="stat-row"><span><b>' + sum.s.visits.length + "</b>check-ins</span><span><b>" + sum.s.cities + "</b>towns</span><span><b>" + sum.s.provinces + "</b>provinces</span><span><b>" + sum.s.trips + "</b>trips</span></div>" +
      '<div class="badge-grid">' + sum.badges.map(function (x) {
        return '<div class="badge' + (x.earned ? " is-earned" : "") + '" title="' + esc(x.b.desc) + '"><span class="badge__ic">' + icon(x.b.icon) + "</span><strong>" + esc(x.b.name) + "</strong><small>" +
          (x.earned ? "Unlocked" : x.n + "/" + x.b.need) + "</small></div>";
      }).join("") + "</div>" +
      '<p class="fine">Tap <b>I\'ve been here</b> on places you visit. Saved trips, reviews and questions to Ask Tara also earn points.</p></div>';
  }
  function homeCard() {
    var sum = summary(), next = sum.badges.filter(function (x) { return !x.earned; }).sort(function (a, b) { return b.n / b.b.need - a.n / a.b.need; })[0];
    return '<a class="card home-lvl" href="#/profile">' + levelBar(sum, true) +
      (next ? '<span class="home-lvl__next">' + icon(next.b.icon) + "<span>Next badge: <b>" + esc(next.b.name) + "</b> · " + next.n + "/" + next.b.need + "</span></span>" : "") + "</a>";
  }

  T.actions.visit = function (el) {
    var v = visited(), id = el.dataset.id, p = T.places.get(id);
    if (v[id]) { delete v[id]; T.data.set("visited", v); T.toast("Check-in removed", p ? p.name : "", "flag"); }
    else { v[id] = Date.now(); T.data.set("visited", v); T.toast("Checked in!", (p ? p.name : "") + " · +10 pts", "check"); }
    if (p) el.outerHTML = visitBtn(p);
    celebrate();
  };

  window.addEventListener("hashchange", function () { if (T.auth.current()) setTimeout(celebrate, 700); });

  T.engage = { summary: summary, visited: visited, visitBtn: visitBtn, profileCard: profileCard, homeCard: homeCard, celebrate: celebrate, confetti: confetti, BADGES: BADGES };
})();
