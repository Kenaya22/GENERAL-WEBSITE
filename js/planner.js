/* ==========================================================================
   TARA — trip planner
   Builds commute options (what to ride, where to board, fares with
   student/senior/PWD discounts, times), a day itinerary at the destination,
   a return trip, reminders and a calendar (.ics) export.
   All fares and times are estimates based on the rules in config.js.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, F = C.fares;
  var dist = function (a, b) { return T.geo.distance(a, b); };

  /* ---------- helpers ---------- */
  function rush(d) {
    var day = d.getDay();
    if (day === 0 || day === 6) return 1;
    var h = d.getHours() + d.getMinutes() / 60;
    return C.rushHours.some(function (r) { return h >= r[0] && h < r[1]; }) ? C.rushFactor : 1;
  }
  function quarter(n) { return Math.round(n * 4) / 4; }
  function pt(o, name) { return { name: name || o.name || o.label, lat: o.lat, lng: o.lng }; }
  function stationIdx(name) {
    for (var i = 0; i < C.transit.lrt1.length; i++) if (C.transit.lrt1[i][0] === name) return i;
    return -1;
  }
  function station(i) { var s = C.transit.lrt1[i]; return { name: s[0] + " Station", short: s[0], lat: s[1], lng: s[2], idx: i }; }
  function nearestStation(p) {
    var best = -1, bd = 1e9;
    C.transit.lrt1.forEach(function (s, i) { var d = dist(p, { lat: s[1], lng: s[2] }); if (d < bd) { bd = d; best = i; } });
    return { st: station(best), d: bd };
  }
  function lineKm(a, b) {
    var km = 0, lo = Math.min(a, b), hi = Math.max(a, b);
    for (var i = lo; i < hi; i++) km += dist(station(i), station(i + 1));
    return km;
  }

  /* ---------- leg builders (regular fares, no times yet) ---------- */
  function walkLeg(a, b, note) {
    var km = dist(a, b) * 1.25;
    return { mode: "walk", from: a, to: b, km: km, ride: km / F.walk.speed * 60, wait: 0, fareReg: 0,
      text: "Walk to " + b.name + (note ? " — " + note : "") };
  }
  function trikeLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    var fare = Math.round(F.tricycle.base + Math.max(0, km - F.tricycle.baseKm) * F.tricycle.perKm);
    return { mode: "tricycle", from: a, to: b, km: km, ride: km / F.tricycle.speed * 60, wait: F.tricycle.wait, fareReg: fare, discount: "road", road: true,
      text: "Ride a tricycle to " + b.name, tip: "Say “" + b.name + " po” to the driver. Agree on the fare first for special trips." };
  }
  function jeepLeg(a, b, opts) {
    var km = dist(a, b) * F.roadFactor;
    var fare = quarter(F.jeep.base + Math.max(0, km - F.jeep.baseKm) * F.jeep.perKm);
    var long = km > 14;
    return { mode: "jeep", from: a, to: b, km: km, ride: km / F.jeep.speed * 60, wait: F.jeep.wait, fareReg: fare, discount: "road", road: true,
      text: "Ride a jeepney toward " + ((opts && opts.toward) || b.name),
      tip: "Tell the driver “Para po sa " + b.name + "”. Pass your fare forward with “Bayad po”." + (long ? " Long route — you may need to transfer once; ask the driver." : "") };
  }
  function localLeg(a, b) {
    var d = dist(a, b);
    if (d < 0.9) return walkLeg(a, b);
    if (d < 3) return trikeLeg(a, b);
    return jeepLeg(a, b);
  }
  function busLeg(a, b, sign, how) {
    var km = dist(a, b) * 1.2;
    var fare = Math.round(F.bus.base + Math.max(0, km - F.bus.baseKm) * F.bus.perKm);
    return { mode: "bus", from: a, to: b, km: km, ride: km / F.bus.speed * 60, wait: F.bus.wait, fareReg: fare, discount: "road", road: true,
      sign: sign, text: "Ride a bus with signboard “" + sign + "”", board: how || "",
      tip: "Get off at " + b.name + ". Conductors collect fares on board — tell them your stop." };
  }
  function lrtLeg(i, j) {
    var km = lineKm(i, j);
    var fare = Math.min(F.lrt.max, Math.max(F.lrt.min, Math.ceil(F.lrt.boarding + F.lrt.perKm * km)));
    var stops = Math.abs(i - j);
    var bound = j < i ? "Northbound (to FPJ / Monumento)" : "Southbound (to Baclaran / Dr. Santos)";
    return { mode: "lrt", from: station(i), to: station(j), km: km, ride: km / F.lrt.speed * 60 + stops * 0.6, wait: F.lrt.wait, fareReg: fare, discount: "rail",
      text: "Take LRT-1 " + bound + " to " + station(j).name, stops: stops,
      tip: stops + " stop" + (stops > 1 ? "s" : "") + ". Buy a single-journey ticket or tap a beep card." };
  }
  function grabLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    return { mode: "grab", from: a, to: b, km: km, ride: km / F.grab.speed * 60, wait: F.grab.wait, fareReg: 0, road: true, perCar: true,
      text: "Book a Grab car or taxi to " + b.name, tip: "Door-to-door. Fare is for the whole car (up to 4 people); surge pricing may apply." };
  }
  function carLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    return { mode: "car", from: a, to: b, km: km, ride: km / F.car.speed * 60, wait: 0, fareReg: Math.round(km / F.car.kmPerLiter * F.car.fuelPrice), road: true, perCar: true,
      text: "Drive to " + b.name, tip: "Fuel estimate only. Add expressway tolls and parking." };
  }

  /* metro last mile from a terminal/station to a destination (prefers LRT-1) */
  function metroLink(a, b, preferRail) {
    var d = dist(a, b);
    if (d < 1.1) return [walkLeg(a, b)];
    var sa = nearestStation(a), sb = nearestStation(b);
    if (preferRail !== false && sa.d < 1.2 && sb.d < 1.4 && sa.st.idx !== sb.st.idx && d > 2) {
      var legs = [];
      if (sa.d > 0.15) legs.push(walkLeg(a, sa.st));
      legs.push(lrtLeg(sa.st.idx, sb.st.idx));
      legs.push(sb.d < 1.1 ? walkLeg(sb.st, b) : localLeg(sb.st, b));
      return legs;
    }
    return [localLeg(a, b)];
  }

  /* ---------- timing + fares for a sequence of legs ---------- */
  function finalize(legs, depart, trav, pax) {
    var t = new Date(depart), fare = 0, fareReg = 0, carCost = 0;
    legs.forEach(function (l) {
      l.start = new Date(t);
      var f = l.road ? rush(t) : 1;
      l.minutes = Math.round(l.wait + l.ride * f);
      l.rush = f > 1;
      t = T.addMin(t, l.minutes);
      l.end = new Date(t);
      var rate = l.discount === "road" ? trav.road : l.discount === "rail" ? trav.rail : 0;
      if (l.mode === "grab") {
        var drive = l.ride * f;
        l.fareReg = Math.ceil((F.grab.base + F.grab.perKm * l.km + F.grab.perMin * drive) / 5) * 5;
      }
      l.fare = Math.round(l.fareReg * (1 - rate) * 100) / 100;
      l.saved = Math.round((l.fareReg - l.fare) * 100) / 100;
      if (l.perCar) carCost += l.fareReg; else { fare += l.fare; fareReg += l.fareReg; }
    });
    var cars = Math.ceil(pax / 4);
    var perPersonCar = carCost * cars / pax;
    return {
      legs: legs, depart: new Date(depart), arrive: t, minutes: Math.round((t - depart) / 60000),
      fare: Math.round((fare + perPersonCar) * 100) / 100,
      fareReg: Math.round((fareReg + perPersonCar) * 100) / 100,
      groupFare: Math.round((fare * pax + carCost * cars) * 100) / 100,
      transfers: legs.filter(function (l) { return l.mode !== "walk"; }).length - 1,
      modes: legs.map(function (l) { return l.mode; }),
    };
  }

  /* ---------- candidate routes ---------- */
  function candidates(from, to) {
    var d = dist(from, to);
    var out = [];
    var fm = T.geo.isMetro(from), tm = T.geo.isMetro(to);

    if (d < 1.2) {
      out.push({ kind: "walk", legs: [walkLeg(from, to)] });
      return out;
    }
    if (d < 3.5) {
      out.push({ kind: "local", legs: [trikeLeg(from, to)] });
      out.push({ kind: "walk", legs: [walkLeg(from, to)] });
      out.push({ kind: "grab", legs: [grabLeg(from, to)] });
      return out;
    }

    var longHaul = d > 22 && fm !== tm;
    if (longHaul) {
      var south = fm ? to : from;
      var stop = C.transit.provincialStops.slice().sort(function (a, b) { return dist(south, a) - dist(south, b); })[0];
      var stopPt = pt(stop);
      C.transit.metroTerminals.forEach(function (term) {
        var termPt = pt(term);
        [true, false].forEach(function (rail) {
          var legs;
          if (!fm) {
            legs = (dist(from, stopPt) < 0.35 ? [] : [localLeg(from, stopPt)])
              .concat([busLeg(stopPt, termPt, term.sign, stop.how)])
              .concat(metroLink(termPt, to, rail));
          } else {
            var signBack = stop.area.toUpperCase();
            legs = metroLink(from, termPt, rail)
              .concat([busLeg(termPt, stopPt, signBack + " / via SLEX", "Board at " + term.name + ". Look for buses with “" + signBack + "” on the signboard.")])
              .concat(dist(stopPt, to) < 0.35 ? [] : [localLeg(stopPt, to)]);
          }
          out.push({ kind: "commute", via: term.name, legs: legs, rail: legs.some(function (l) { return l.mode === "lrt"; }) });
        });
      });
    } else if (d > 22) {
      // long trip within the same region (e.g. Laguna ↔ Tagaytay): generic bus/van
      var b = busLeg(pt(from, "your bus stop"), pt(to, "the terminal near " + to.name), "UV EXPRESS / BUS", "Ask at the nearest terminal for a van or bus heading to " + to.name + ".");
      out.push({ kind: "commute", legs: [b, localLeg(pt(to, "terminal"), to)] });
    } else {
      if (fm && tm) out.push({ kind: "commute", rail: true, legs: metroLink(from, to, true) });
      out.push({ kind: "commute", legs: [jeepLeg(from, to)] });
    }
    out.push({ kind: "grab", legs: [grabLeg(from, to)] });
    out.push({ kind: "car", legs: [carLeg(from, to)] });
    return out;
  }

  function pickOptions(list) {
    var longWalk = list.filter(function (o) { return o.kind === "walk" && o.minutes > 25; })[0];
    var commute = list.filter(function (o) { return (o.kind === "commute" || o.kind === "local" || o.kind === "walk") && o !== longWalk; });
    var res = [];
    var cheapest = commute.slice().sort(function (a, b) { return a.fare - b.fare || a.minutes - b.minutes; })[0];
    if (cheapest) { cheapest.tag = "Cheapest"; res.push(cheapest); }
    var fastest = commute.filter(function (o) { return o !== cheapest; }).sort(function (a, b) { return a.minutes - b.minutes || a.fare - b.fare; })[0];
    if (fastest && (!cheapest || fastest.minutes < cheapest.minutes - 4 || fastest.transfers < cheapest.transfers)) {
      fastest.tag = fastest.transfers < cheapest.transfers ? "Fewer transfers" : "Faster commute";
      res.push(fastest);
    }
    if (longWalk) { longWalk.tag = "Walk (free)"; res.push(longWalk); }
    var grab = list.filter(function (o) { return o.kind === "grab"; })[0];
    if (grab) { grab.tag = "Door-to-door"; res.push(grab); }
    var car = list.filter(function (o) { return o.kind === "car"; })[0];
    if (car) { car.tag = "Own car"; res.push(car); }
    res.forEach(function (o, i) { o.id = "opt" + i; o.title = titleFor(o); });
    return res;
  }

  var modeName = { walk: "Walk", tricycle: "Tricycle", jeep: "Jeepney", bus: "Bus", lrt: "LRT-1", grab: "Grab/Taxi", car: "Car" };
  function titleFor(o) {
    var seq = [];
    o.legs.forEach(function (l) { if (l.mode !== "walk" || o.legs.length === 1) { var n = modeName[l.mode]; if (seq[seq.length - 1] !== n) seq.push(n); } });
    return seq.join(" → ");
  }

  /* ---------- itinerary at destination ---------- */
  function activities(to, arrive, endBy, trav, include) {
    var origin = to.placeId ? T.places.get(to.placeId) : null;
    var pool = T.places.query({ near: to, within: 1.7 }).map(function (x) { return x.p; })
      .filter(function (p) { return p.cat !== "food" && p.cat !== "cafe" && p.cat !== "market"; });
    if (origin && pool.indexOf(origin) < 0 && origin.cat !== "food") pool.unshift(origin);
    if (include) pool = pool.filter(function (p) { return include.indexOf(p.id) > -1; });
    else {
      // default picks: best-rated, budget-friendly spots (pricey tours can be added by tapping them)
      pool = pool.filter(function (p) { return p === origin || !(p.fee && p.fee.regular >= 500); })
        .sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).slice(0, 6);
    }

    // nearest-neighbour order starting from the arrival point (destination first if it is a place)
    var order = [], here = to, left = pool.slice();
    if (origin && left.indexOf(origin) > -1 && !origin.hub) { order.push(origin); left.splice(left.indexOf(origin), 1); here = origin; }
    while (left.length) {
      left.sort(function (a, b) { return dist(here, a) - dist(here, b); });
      here = left.shift();
      order.push(here);
    }
    order = order.filter(function (p) { return !p.hub; }).slice(0, 7);

    var t = T.addMin(arrive, 5), prev = to, steps = [], lunched = false, skipped = [];
    var lunchSpot = function (near) {
      // cheapest nearby restaurant, then nearest
      var food = T.places.query({ near: near, within: 0.9, cat: "food" })
        .sort(function (a, b) { return (a.p.price || 2) - (b.p.price || 2) || a.d - b.d; })[0];
      return food && (food.p.price || 2) <= 2 ? food.p : null;
    };
    var splurge = T.places.query({ near: to, within: 1.5, cat: "food" }).filter(function (x) { return x.p.price === 3; })[0];
    function meal(spot, start, walk) {
      return { kind: "meal", place: spot, name: spot ? "Lunch at " + spot.name : "Lunch nearby (carinderia or fast food)", start: start, end: T.addMin(start, 60), walk: walk,
        cost: spot ? C.mealBudget[spot.price || 2] : C.mealBudget[1],
        tip: spot ? "" : "Budget meals cost about " + T.peso(C.mealBudget[1]) + "." + (splurge ? " Splurge option: " + splurge.p.name + " (about " + T.peso(C.mealBudget[3]) + ")." : "") };
    }
    for (var i = 0; i < order.length; i++) {
      var p = order[i];
      var walkMin = Math.round(dist(prev, p) * 1.25 / F.walk.speed * 60);
      var at = T.addMin(t, walkMin);
      // lunch break
      if (!lunched && at.getHours() * 60 + at.getMinutes() >= 690) {
        var spot = lunchSpot(prev);
        var lw = spot ? Math.round(dist(prev, spot) * 1.25 / F.walk.speed * 60) : 0;
        var ls = T.addMin(t, lw);
        steps.push(meal(spot, ls, lw));
        t = T.addMin(ls, 60); prev = spot || prev; lunched = true;
        walkMin = Math.round(dist(prev, p) * 1.25 / F.walk.speed * 60);
        at = T.addMin(t, walkMin);
      }
      var st = T.places.openState(p, at);
      var start = at, note = "";
      if (st.closedDay) { skipped.push({ place: p, why: "closed on " + T.date(at).split(",")[0] }); continue; }
      if (p.hours) {
        var o = T.hm(p.hours[0]), c = T.hm(p.hours[1]), m = at.getHours() * 60 + at.getMinutes();
        if (m < o) { start = new Date(at); start.setHours(Math.floor(o / 60), o % 60, 0, 0); note = "Opens at " + T.time(start); }
        if (start.getHours() * 60 + start.getMinutes() + Math.min(p.visit, 30) > c) { skipped.push({ place: p, why: "closes before you'd get there" }); continue; }
      }
      var end = T.addMin(start, p.visit || 45);
      if (end > endBy && p === origin && (endBy - start) / 60000 >= 60) { end = new Date(endBy); note = (note ? note + " · " : "") + "Stay until " + T.time(end) + " to get home on time"; }
      else if (end > endBy) { skipped.push({ place: p, why: "not enough time" }); continue; }
      var fee = T.places.fee(p, trav);
      if (!lunched && p.visit >= 180 && start.getHours() < 12 && end.getHours() >= 13) { lunched = true; note = (note ? note + " · " : "") + "Have lunch inside — food stalls are available"; }
      steps.push({ kind: "visit", place: p, name: p.name, start: start, end: end, walk: walkMin, note: note, fee: fee.amount || 0, feeReg: fee.regular || fee.amount || 0, tip: (p.tips || [])[0] });
      t = end; prev = p;
    }
    if (!lunched && steps.length && t.getHours() * 60 + t.getMinutes() >= 690 && arrive.getHours() < 13) {
      var sp = lunchSpot(prev);
      steps.push(meal(sp, t, 0));
      t = T.addMin(t, 60);
    }
    return { steps: steps, endAt: t, endPoint: prev, skipped: skipped, pool: pool };
  }

  /* ---------- reminders ---------- */
  function reminders(plan, wx) {
    var out = [], opt = plan.option, trav = plan.traveler;
    var dep = opt.depart;
    var eve = new Date(dep); eve.setDate(eve.getDate() - 1); eve.setHours(20, 0, 0, 0);
    if (eve > new Date()) out.push({ at: eve, icon: "bag", text: "Prepare tonight: charge your phone, pack water, snacks and an umbrella." });
    out.push({ at: T.addMin(dep, -30), icon: "bell", text: "Get ready — leave " + plan.from.name + " in 30 minutes." });
    out.push({ at: dep, icon: "route", text: "Time to go! " + (opt.legs[0] ? opt.legs[0].text + "." : "") });
    if (trav.id !== "regular") {
      var saved = opt.legs.reduce(function (s, l) { return s + (l.saved || 0); }, 0) * (plan.ret ? 2 : 1);
      out.push({ at: null, icon: "id", text: "Bring your " + trav.id_name + " — your " + trav.label.toLowerCase() + " discount saves about " + T.peso(saved) + " on fares" + (plan.fees.saved ? " and " + T.peso(plan.fees.saved) + " on entrance fees" : "") + "." });
    }
    if (opt.modes.indexOf("jeep") > -1 || opt.modes.indexOf("tricycle") > -1) out.push({ at: null, icon: "wallet", text: "Keep coins and small bills (₱20, ₱50) ready for jeepney and tricycle fares." });
    if (opt.modes.indexOf("lrt") > -1) out.push({ at: null, icon: "train", text: "LRT-1: buy a single-journey ticket at the station or load your beep card. Bags go through inspection." });
    if (opt.modes.indexOf("bus") > -1) out.push({ at: null, icon: "bus", text: "Check the bus signboard before boarding and keep your ticket until you get off." });
    if (opt.legs.some(function (l) { return l.rush; })) out.push({ at: null, icon: "clock", text: "Part of your trip is during rush hour — we've added extra travel time." });
    var day = wx && T.weather.forDate(wx, dep);
    if (day && day.rain >= 40) out.push({ at: null, icon: "rain", text: "Rain is likely (" + day.rain + "%) — bring an umbrella or raincoat." });
    else if (day && day.max >= 33) out.push({ at: null, icon: "sun", text: "Hot day ahead (up to " + Math.round(day.max) + "°C) — bring water, a cap and sunscreen." });
    var dest = plan.to.placeId && T.places.get(plan.to.placeId);
    if (dest) {
      var st = T.places.openState(dest, opt.arrive);
      if (st.known && !st.open) out.push({ at: null, icon: "clock", text: dest.name + " is closed when you arrive (" + T.time(opt.arrive) + ") — " + st.label.toLowerCase() + ". Consider leaving later." });
    }
    plan.day.skipped.forEach(function (s) { out.push({ at: null, icon: "info", text: s.place.name + " is skipped — " + s.why + "." }); });
    plan.day.steps.forEach(function (s) {
      if (s.kind === "visit") out.push({ at: T.addMin(s.start, -10), icon: "pin", text: "Next: " + s.name + " at " + T.time(s.start) + (s.tip ? " · " + s.tip : "") });
    });
    if (plan.back) out.push({ at: T.addMin(plan.back.depart, -20), icon: "home", text: "Head home in 20 minutes. " + (plan.back.legs[0] ? plan.back.legs[0].text + "." : "") });
    return out;
  }

  /* ---------- public API ---------- */
  T.planner = {
    options: function (from, to, depart, trav, pax) {
      return pickOptions(candidates(from, to).map(function (c) {
        var r = finalize(c.legs, depart, trav, pax);
        r.kind = c.kind; r.via = c.via; r.rail = c.rail;
        return r;
      }));
    },
    quick: function (from, to) {
      var trav = T.traveler();
      var d = new Date(); d.setHours(8, 0, 0, 0);
      var o = this.options(from, to, d, trav, 1);
      return o[0] || null;
    },
    build: function (input) {
      var trav = input.traveler || T.traveler();
      var pax = input.pax || 1;
      var opts = this.options(input.from, input.to, input.depart, trav, pax);
      var option = opts.filter(function (o) { return o.id === input.optionId; })[0] || opts[0];
      var endBy = new Date(input.depart);
      var eh = T.hm(input.homeBy || "16:30");
      endBy.setHours(Math.floor(eh / 60), eh % 60, 0, 0);
      if (endBy <= option.arrive) endBy = T.addMin(option.arrive, 180);
      var day = input.activities === false ? { steps: [], endAt: option.arrive, endPoint: input.to, skipped: [], pool: [] }
        : activities(input.to, option.arrive, endBy, trav, input.include);
      var back = null;
      if (input.ret) {
        var bdep = T.addMin(day.endAt, 10);
        var bopts = this.options(pt(day.endPoint), input.from, bdep, trav, pax);
        back = bopts.filter(function (o) { return o.kind === option.kind && (!option.rail || o.rail); })[0] || bopts[0];
      }
      var fees = day.steps.reduce(function (acc, s) { acc.total += s.fee || 0; acc.saved += (s.feeReg || 0) - (s.fee || 0); return acc; }, { total: 0, saved: 0 });
      var meals = day.steps.reduce(function (s, x) { return s + (x.cost || 0); }, 0);
      var fares = option.fare + (back ? back.fare : 0);
      var plan = {
        id: input.id || "t_" + T.uid(),
        from: input.from, to: input.to, traveler: trav, pax: pax, ret: !!input.ret, homeBy: input.homeBy, activitiesOn: input.activities !== false,
        include: input.include || null,
        options: opts, option: option, back: back, day: day, fees: fees,
        budget: { fares: fares, fees: fees.total, meals: meals, perPerson: fares + fees.total + meals, group: (fares + fees.total + meals) * pax },
        createdAt: Date.now(),
      };
      plan.reminders = reminders(plan, input.weather);
      return plan;
    },

    /* Serialize for storage (Dates → ISO) and back */
    pack: function (plan) {
      return JSON.parse(JSON.stringify(plan, function (k, v) { return k === "pool" || k === "options" ? undefined : v; }));
    },
    unpack: function (o) {
      var re = /^\d{4}-\d{2}-\d{2}T/;
      (function walk(x) {
        if (!x || typeof x !== "object") return;
        Object.keys(x).forEach(function (k) {
          if (typeof x[k] === "string" && re.test(x[k])) x[k] = new Date(x[k]);
          else walk(x[k]);
        });
      })(o);
      return o;
    },

    /* Calendar file with alarms so phones remind you even when the app is closed */
    ics: function (plan) {
      var f = function (d) { return d.getUTCFullYear() + T.pad(d.getUTCMonth() + 1) + T.pad(d.getUTCDate()) + "T" + T.pad(d.getUTCHours()) + T.pad(d.getUTCMinutes()) + "00Z"; };
      var escI = function (s) { return String(s).replace(/[\\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
      var ev = [];
      var add = function (start, end, title, desc, alarm) {
        ev.push(["BEGIN:VEVENT", "UID:" + plan.id + "-" + ev.length + "@tara", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start), "DTEND:" + f(end),
          "SUMMARY:" + escI(title), "DESCRIPTION:" + escI(desc || "")]
          .concat(alarm ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escI(title), "TRIGGER:-PT" + alarm + "M", "END:VALARM"] : [])
          .concat(["END:VEVENT"]).join("\r\n"));
      };
      var legsText = function (o) { return o.legs.map(function (l, i) { return (i + 1) + ". " + T.time(l.start) + " " + l.text + (l.fare ? " (" + T.peso(l.fare) + ")" : ""); }).join("\n"); };
      add(plan.option.depart, plan.option.arrive, "Travel to " + plan.to.name, legsText(plan.option), 30);
      plan.day.steps.forEach(function (s) { add(s.start, s.end, s.name, s.tip || "", 10); });
      if (plan.back) add(plan.back.depart, plan.back.arrive, "Head home to " + plan.from.name, legsText(plan.back), 20);
      return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tara//Trip Planner//EN", "CALSCALE:GREGORIAN"].concat(ev).concat(["END:VCALENDAR"]).join("\r\n");
    },
    modeName: modeName,
  };
})();
