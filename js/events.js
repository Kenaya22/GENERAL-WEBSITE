/* ==========================================================================
   TARA — holidays, long weekends and festivals
   "This weekend" card on Home, and Ask Tara answers about holidays/fiestas.
   Dates are the usual ones; the government can move holidays by
   proclamation and towns can shift fiesta dates — check before you go.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, esc = T.esc, icon = T.icon;

  // [date, name, type] — R = regular holiday, S = special non-working day
  var HOLIDAYS = [
    ["2026-11-30", "Bonifacio Day", "R"], ["2026-12-08", "Feast of the Immaculate Conception", "S"], ["2026-12-24", "Christmas Eve", "S"],
    ["2026-12-25", "Christmas Day", "R"], ["2026-12-30", "Rizal Day", "R"], ["2026-12-31", "New Year's Eve", "S"],
    ["2027-01-01", "New Year's Day", "R"], ["2027-02-06", "Chinese New Year", "S"], ["2027-02-25", "EDSA People Power Anniversary", "S"],
    ["2027-03-25", "Maundy Thursday", "R"], ["2027-03-26", "Good Friday", "R"], ["2027-03-27", "Black Saturday", "S"],
    ["2027-04-09", "Araw ng Kagitingan", "R"], ["2027-05-01", "Labor Day", "R"], ["2027-06-12", "Independence Day", "R"],
    ["2027-08-21", "Ninoy Aquino Day", "S"], ["2027-08-30", "National Heroes Day", "R"], ["2027-11-01", "All Saints' Day", "S"],
    ["2027-11-02", "All Souls' Day", "S"], ["2027-11-30", "Bonifacio Day", "R"], ["2027-12-08", "Feast of the Immaculate Conception", "S"],
    ["2027-12-24", "Christmas Eve", "S"], ["2027-12-25", "Christmas Day", "R"], ["2027-12-30", "Rizal Day", "R"], ["2027-12-31", "New Year's Eve", "S"],
  ];
  // [month (1-12), day from, day to, name, city id, note]
  var FESTIVALS = [
    [1, 9, 9, "Feast of the Black Nazarene (Traslacion)", "manila", "Huge procession in Quiapo — very crowded; avoid driving nearby."],
    [1, 10, 20, "Coconut Festival", "san-pablo", "Street dancing and coconut-themed floats in the City of Seven Lakes."],
    [2, 1, 28, "Panagbenga (Flower Festival)", "baguio", "Baguio's flower festival — grand street dance and float parade on the last weekends of February."],
    [3, 10, 20, "Anilag Festival", "santa-cruz", "Laguna's 'festival of festivals' — trade fairs, parades and contests."],
    [4, 25, 30, "Bangus Festival", "dagupan", "Milkfish grilling and street parties in Dagupan."],
    [5, 1, 31, "Maytime pilgrimage to Antipolo", "antipolo", "Pilgrims walk to Antipolo Cathedral through May — expect crowds and traffic."],
    [5, 15, 15, "Pahiyas Festival", "lucban", "Houses covered in colorful kiping and harvest décor — Lucban's most famous day."],
    [5, 15, 15, "Agawan Festival", "sariaya", "Sariaya's harvest feast held with Pahiyas."],
    [5, 17, 19, "Obando Fertility Dance", "obando", "Street dancing for San Pascual Baylon, Santa Clara and the Virgin of Salambao."],
    [6, 12, 12, "Independence Day at Aguinaldo Shrine", "kawit", "Flag-raising rites where independence was declared in 1898."],
    [6, 19, 19, "Rizal's birthday", "calamba", "Programs at the Rizal Shrine and around Calamba's plaza."],
    [6, 24, 24, "Parada ng Lechon", "balayan", "Roast pigs in costume parade through Balayan — and everyone gets doused with water."],
    [7, 23, 23, "Sublian Festival", "batangas-city", "Batangas City's dance festival honoring the Sto. Niño and the Holy Cross."],
    [9, 1, 30, "Turumba Festival", "pakil", "Dancing processions for the Our Lady of Turumba — the biggest in September."],
    [9, 15, 20, "Bañamos Festival", "los-banos", "Los Baños's festival of hot springs, food and street dancing."],
    [11, 23, 23, "Higantes Festival", "angono", "Giant papier-mâché figures parade through Angono, the Art Capital."],
    [12, 16, 24, "Simbang Gabi", "", "Nine dawn (or evening) Masses before Christmas in every parish — bibingka and puto bumbong outside."],
    [12, 12, 20, "Giant Lantern Festival", "san-fernando-pampanga", "Huge electric parols light up San Fernando, Pampanga's Christmas capital."],
  ];

  function d(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function key(x) { return T.isoDate(x); }
  var HMAP = {};
  HOLIDAYS.forEach(function (h) { HMAP[h[0]] = h; });
  function offDay(x) { var w = x.getDay(); return w === 0 || w === 6 || !!HMAP[key(x)]; }
  function startOfDay(x) { var y = new Date(x); y.setHours(0, 0, 0, 0); return y; }

  // runs of 3+ days off in a row (long weekends) within the next N days
  function longWeekends(from, days) {
    var out = [], run = [], t = startOfDay(from);
    for (var i = 0; i < days + 4; i++) {
      var x = new Date(t); x.setDate(t.getDate() + i);
      if (offDay(x)) run.push(x);
      else { if (run.length >= 3 && run.some(function (y) { return HMAP[key(y)]; })) out.push(run); run = []; }
    }
    return out.filter(function (r) { return r[r.length - 1] >= startOfDay(from); });
  }
  function upcomingHolidays(from, days) {
    var a = startOfDay(from), b = new Date(a); b.setDate(a.getDate() + days);
    return HOLIDAYS.map(function (h) { return { date: d(h[0]), name: h[1], type: h[2] }; }).filter(function (h) { return h.date >= a && h.date <= b; });
  }
  function upcomingFestivals(from, days) {
    var a = startOfDay(from), b = new Date(a), out = [];
    b.setDate(a.getDate() + days);
    [a.getFullYear(), a.getFullYear() + 1].forEach(function (y) {
      FESTIVALS.forEach(function (f) {
        var s = new Date(y, f[0] - 1, f[1]), e = new Date(y, f[0] - 1, f[2]);
        if (e >= a && s <= b) out.push({ start: s, end: e, name: f[3], city: T.dest.city(f[4]), note: f[5] });
      });
    });
    return out.sort(function (x, y) { return x.start - y.start; });
  }
  function range(a, b) {
    var same = a.getMonth() === b.getMonth();
    var m = function (x) { return x.toLocaleDateString("en-PH", { month: "short" }); };
    return a.getTime() === b.getTime() ? m(a) + " " + a.getDate() : same ? m(a) + " " + a.getDate() + "–" + b.getDate() : m(a) + " " + a.getDate() + " – " + m(b) + " " + b.getDate();
  }
  function nextWeekend(now) {
    var t = startOfDay(now), w = t.getDay();
    var sat = new Date(t); sat.setDate(t.getDate() + (w === 0 ? -1 : 6 - w));
    var sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return [sat, sun];
  }
  // weekly ideas: a stable pick per week, near the user, mixed categories
  function ideas(n) {
    var here = T.location.get(), wk = Math.floor(Date.now() / 6048e5);
    var list = T.places.query({ near: here }).filter(function (x) { return x.d > 3 && x.d < 80 && ["stay", "food", "cafe", "mall"].indexOf(x.p.cat) < 0 && (T.places.score(x.p) || 0) >= 4.2; });
    var out = [], used = {};
    for (var i = 0; out.length < n && i < list.length * 3; i++) {
      var x = list[(wk * 7 + i * 11) % list.length];
      if (x && !used[x.p.id] && !out.some(function (y) { return y.p.cat === x.p.cat; })) { used[x.p.id] = 1; out.push(x); }
    }
    return out;
  }

  T.events = { holidays: upcomingHolidays, festivals: upcomingFestivals, longWeekends: longWeekends };

  T.weekendCard = function () {
    var now = new Date(), wk = nextWeekend(now), lw = longWeekends(now, 21)[0];
    var hol = upcomingHolidays(now, 30), fes = upcomingFestivals(now, 45).slice(0, 3), idea = ideas(3);
    var head = lw ? "Long weekend: " + range(lw[0], lw[lw.length - 1]) : "This weekend · " + range(wk[0], wk[1]);
    var sub = lw ? lw.length + " days off — " + lw.filter(function (x) { return HMAP[key(x)]; }).map(function (x) { return HMAP[key(x)][1]; }).join(", ") : (hol[0] ? "Next holiday: " + hol[0].name + " (" + range(hol[0].date, hol[0].date) + ")" : "Ideas for a quick getaway");
    return '<section class="section"><div class="card wkend"><div class="wkend__head"><span class="wkend__ic">' + icon(lw ? "fire" : "calendar") + "</span><div><strong>" + esc(head) + "</strong><small>" + esc(sub) + "</small></div></div>" +
      (fes.length ? '<ul class="wkend__fest">' + fes.map(function (f) {
        var href = f.city ? "#/city/" + f.city.id : "#/explore";
        return '<li><a href="' + href + '"><span class="wkend__date"><b>' + f.start.getDate() + "</b><small>" + f.start.toLocaleDateString("en-PH", { month: "short" }) + "</small></span><span><strong>" + esc(f.name) + "</strong><small>" + esc((f.city ? f.city.name + " · " : "") + range(f.start, f.end)) + "</small></span>" + icon("chev-r") + "</a></li>";
      }).join("") + "</ul>" : "") +
      (idea.length ? '<p class="label">Weekend ideas near you</p><div class="wkend__ideas">' + idea.map(function (x) {
        return '<a class="wkend__idea" href="#/place/' + encodeURIComponent(x.p.id) + '">' + T.ui.photo(x.p, "wkend__ph") + "<span><strong>" + esc(x.p.name) + "</strong><small>" + T.km(x.d) + "</small></span></a>";
      }).join("") + "</div>" : "") +
      '<p class="fine">Holiday and festival dates are the usual ones — they can be moved, so check before you go.</p></div></section>';
  };

  // Ask Tara: holidays, long weekends and festivals
  var base = T.assistant && T.assistant.answer;
  if (base) T.assistant.answer = function (raw) {
    var t = T.assistant.norm(raw);
    if (/\b(holiday|holidays|long weekend|walang pasok|day off|piyesta opisyal)\b/.test(t)) {
      var now = new Date(), lws = longWeekends(now, 120), hs = upcomingHolidays(now, 120).slice(0, 6);
      return { html: "<p><b>Upcoming holidays:</b></p><ul class=\"ask-ul\">" + hs.map(function (h) { return "<li>" + esc(T.date(h.date, true)) + " — " + esc(h.name) + (h.type === "R" ? "" : " <small class=\"muted\">(special)</small>") + "</li>"; }).join("") + "</ul>" +
        (lws.length ? "<p><b>Long weekends:</b> " + lws.slice(0, 3).map(function (r) { return esc(range(r[0], r[r.length - 1])) + " (" + r.length + " days)"; }).join(", ") + ".</p>" : "") +
        "<p><small class=\"muted\">Holidays can be moved by proclamation — check the official announcement.</small></p>", chips: ["Festivals this month", "Surprise me!"] };
    }
    if (/\b(fiesta|fiestas|festival|festivals|piyesta|events?|what s happening|anong meron)\b/.test(t)) {
      var fs = upcomingFestivals(new Date(), 90);
      if (!fs.length) return { html: "<p>No big festivals in Tara's list for the next few months. Town fiestas happen all year — ask at the municipal hall.</p>" };
      return { html: "<p><b>Festivals coming up:</b></p><ul class=\"ask-ul\">" + fs.slice(0, 6).map(function (f) { return "<li><b>" + esc(range(f.start, f.end)) + "</b> — " + esc(f.name) + (f.city ? ", " + esc(f.city.name) : "") + ". " + esc(f.note) + "</li>"; }).join("") + "</ul><p><small class=\"muted\">Dates are the usual ones; towns can shift them.</small></p>", chips: ["Next long weekend?"] };
    }
    return base(raw);
  };
})();
