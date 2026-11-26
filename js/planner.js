/* ==========================================================================
   TARA — trip planner
   Builds commute options (what to ride, where to board, fares with
   student/senior/PWD discounts, times) using jeepneys, tricycles, buses,
   LRT-1 / LRT-2 / MRT-3 (with transfers) and common provincial routes;
   then a day itinerary that fills the time until you leave for home,
   with a time-fit check (too many / just right / free time), the return
   trip, budget, reminders and a calendar (.ics) export.
   All fares and times are estimates based on the rules in config.js.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, F = C.fares, TR = C.transit;
  var dist = function (a, b) { return T.geo.distance(a, b); };
  var mins = function (d) { return d.getHours() * 60 + d.getMinutes(); };

  /* ---------- helpers ---------- */
  function rush(d) {
    var day = d.getDay();
    if (day === 0 || day === 6) return 1;
    var h = d.getHours() + d.getMinutes() / 60;
    return C.rushHours.some(function (r) { return h >= r[0] && h < r[1]; }) ? C.rushFactor : 1;
  }
  function quarter(n) { return Math.round(n * 4) / 4; }
  function pt(o, name) { return { name: name || o.name || o.label, lat: o.lat, lng: o.lng }; }

  /* ---------- rail network ---------- */
  var lines = {};
  TR.rail.forEach(function (l) { lines[l.id] = l; });
  function station(lineId, i) {
    var s = lines[lineId].stations[i];
    return { name: s[0] + " Station", short: s[0], lat: s[1], lng: s[2], idx: i, line: lineId };
  }
  function stationIdx(lineId, name) {
    var st = lines[lineId].stations;
    for (var i = 0; i < st.length; i++) if (st[i][0] === name) return i;
    return -1;
  }
  function nearestOnLine(lineId, p) {
    var best = -1, bd = 1e9;
    lines[lineId].stations.forEach(function (s, i) { var d = dist(p, { lat: s[1], lng: s[2] }); if (d < bd) { bd = d; best = i; } });
    return { st: station(lineId, best), d: bd };
  }
  function lineKm(lineId, a, b) {
    var km = 0, lo = Math.min(a, b), hi = Math.max(a, b);
    for (var i = lo; i < hi; i++) km += dist(station(lineId, i), station(lineId, i + 1));
    return km;
  }
  // line-to-line paths (max 2 transfers) using the transfer list
  function linePaths(from, to) {
    if (from === to) return [[]];
    var out = [];
    TR.railTransfers.forEach(function (t) {
      var x = t[0] === from ? t : t[2] === from ? [t[2], t[3], t[0], t[1], t[4]] : null;
      if (!x) return;
      if (x[2] === to) out.push([x]);
      else TR.railTransfers.forEach(function (u) {
        var y = u[0] === x[2] ? u : u[2] === x[2] ? [u[2], u[3], u[0], u[1], u[4]] : null;
        if (y && y !== t && y[2] === to && y[2] !== from) out.push([x, y]);
      });
    });
    return out;
  }
  // best rail journey from point a to point b, or null
  function railRoute(a, b) {
    var best = null;
    Object.keys(lines).forEach(function (la) {
      var sa = nearestOnLine(la, a);
      if (sa.d > 3) return;
      Object.keys(lines).forEach(function (lb) {
        var sb = nearestOnLine(lb, b);
        if (sb.d > 8) return;
        linePaths(la, lb).forEach(function (path) {
          var legs = [], cur = sa.st, ok = true, cost = 0;
          if (sa.d > 0.15) legs.push(sa.d < 1.1 ? walkLeg(a, sa.st) : localLeg(a, sa.st));
          path.concat([null]).forEach(function (tr) {
            if (!ok) return;
            var lineId = cur.line;
            var endIdx = tr ? stationIdx(lineId, tr[1]) : sb.st.idx;
            if (endIdx < 0 || (endIdx === cur.idx && !tr)) { ok = false; return; }
            if (endIdx !== cur.idx) { var r = railLeg(lineId, cur.idx, endIdx); legs.push(r); cost += r.ride + r.wait; }
            if (tr) {
              var nextLine = tr[2], nextIdx = stationIdx(nextLine, tr[3]);
              var w = walkLeg(station(lineId, endIdx), station(nextLine, nextIdx), "transfer to " + lines[nextLine].name);
              w.ride = tr[4]; legs.push(w); cost += tr[4];
              cur = station(nextLine, nextIdx);
            }
          });
          if (!ok || !legs.some(isTrain)) return;
          legs.push(sb.d < 1.1 ? walkLeg(sb.st, b) : localLeg(sb.st, b));
          cost += Math.min(sa.d, 1.1) * 14 + Math.max(0, sa.d - 1.1) * 6 + Math.min(sb.d, 1.1) * 14 + Math.max(0, sb.d - 1.1) * 6 + path.length * 8;
          if (!best || cost < best.cost) best = { legs: legs, cost: cost };
        });
      });
    });
    return best ? best.legs : null;
  }

  /* ---------- leg builders (regular fares, no times yet) ---------- */
  function walkLeg(a, b, note) {
    var km = dist(a, b) * 1.25;
    return { mode: "walk", from: pt(a), to: pt(b), km: km, ride: km / F.walk.speed * 60, wait: 0, fareReg: 0,
      text: "Walk to " + b.name + (note ? " — " + note : "") };
  }
  function trikeLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    var fare = Math.round(F.tricycle.base + Math.max(0, km - F.tricycle.baseKm) * F.tricycle.perKm);
    return { mode: "tricycle", from: pt(a), to: pt(b), km: km, ride: km / F.tricycle.speed * 60, wait: F.tricycle.wait, fareReg: fare, discount: "road", road: true,
      text: "Ride a tricycle to " + b.name, tip: "Say “" + b.name + " po” to the driver. Agree on the fare first for special trips." };
  }
  function jeepLeg(a, b, opts) {
    opts = opts || {};
    var km = dist(a, b) * F.roadFactor;
    var fare = Math.round(F.jeep.base + Math.max(0, km - F.jeep.baseKm) * F.jeep.perKm);
    var long = km > 14 && !opts.sign;
    var speed = km > 10 ? 24 : F.jeep.speed; // highway stretches move faster than city streets
    return { mode: "jeep", from: pt(a), to: pt(b), km: km, ride: km / speed * 60, wait: F.jeep.wait, fareReg: fare, discount: "road", road: true,
      sign: opts.sign, board: opts.board || "",
      text: opts.sign ? "Ride a jeepney going to " + (opts.goes || b.name) + " — signboard says “" + opts.sign + "”" : "Ride a jeepney toward " + (opts.toward || b.name),
      tip: "Tell the driver “Para po sa " + b.name + "”. Pass your fare forward with “Bayad po”." + (long ? " Long route — you may need to transfer once; ask the driver." : "") };
  }
  function localLeg(a, b) {
    var d = dist(a, b);
    if (d < 0.9) return walkLeg(a, b);
    if (d < 3) return trikeLeg(a, b);
    return jeepLeg(a, b);
  }
  function busLeg(a, b, sign, how, goes) {
    var km = dist(a, b) * 1.2;
    var fare = Math.round(F.bus.base + Math.max(0, km - F.bus.baseKm) * F.bus.perKm);
    // long trips use expressways (SLEX, NLEX, TPLEX), so the average speed is higher
    var speed = km > 120 ? 50 : km > 60 ? 42 : km > 30 ? 35 : F.bus.speed;
    return { mode: "bus", from: pt(a), to: pt(b), km: km, ride: km / speed * 60, wait: F.bus.wait, fareReg: fare, discount: "road", road: true,
      sign: sign, text: "Ride a bus going to " + (goes || b.name) + " — signboard says “" + sign + "”", board: how || "",
      tip: "Conductors collect fares on board — tell them where you're getting off." };
  }
  function railLeg(lineId, i, j) {
    var L = lines[lineId], km = lineKm(lineId, i, j);
    var fare = Math.min(L.fare.max, Math.max(L.fare.min, Math.ceil(L.fare.boarding + L.fare.perKm * km)));
    var stops = Math.abs(i - j);
    var dir = j < i ? L.dirs[0] : L.dirs[1];
    var bus = L.mode === "busway";
    return { mode: L.mode || "lrt", line: L.name, from: station(lineId, i), to: station(lineId, j), km: km, ride: km / (L.speed || F.rail.speed) * 60 + stops * 0.6, wait: L.wait || F.rail.wait, fareReg: fare, discount: L.discount || "rail",
      road: bus, text: "Take " + L.name + " " + dir + " to " + station(lineId, j).name, stops: stops,
      board: "Board at " + station(lineId, i).name + (bus ? " (the busway in the middle of EDSA)." : "."),
      tip: stops + " stop" + (stops > 1 ? "s" : "") + (bus ? ". Pay with a beep card at the station; buses come every few minutes." : ". Buy a single-journey ticket or tap a beep card.") };
  }
  function grabLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    return { mode: "grab", from: pt(a), to: pt(b), km: km, ride: km / F.grab.speed * 60, wait: F.grab.wait, fareReg: 0, road: true, perCar: true,
      text: "Book a Grab car or taxi to " + b.name, tip: "Door-to-door. Fare is for the whole car (up to 4 people); surge pricing may apply." };
  }
  function carLeg(a, b) {
    var km = dist(a, b) * F.roadFactor;
    return { mode: "car", from: pt(a), to: pt(b), km: km, ride: km / F.car.speed * 60, wait: 0, fareReg: Math.round(km / F.car.kmPerLiter * F.car.fuelPrice), road: true, perCar: true,
      text: "Drive to " + b.name, tip: "Fuel estimate only. Add expressway tolls and parking." };
  }

  /* metro link between two points (prefers trains when useful) */
  function metroLink(a, b, preferRail) {
    var d = dist(a, b);
    if (d < 1.1) return [walkLeg(a, b)];
    if (preferRail !== false && d > 2) { var r = railRoute(a, b); if (r) return r; }
    return [localLeg(a, b)];
  }

  /* ---------- timing + fares for a sequence of legs ---------- */
  /* ---------- real fares reported by travelers ---------- */
  T.fareReports = {
    all: function () { return T.store.get("tara.fareReports", []); },
    key: function (mode, from, to) { return [mode, String(from || "").toLowerCase(), String(to || "").toLowerCase()].join("|"); },
    add: function (r) { var l = this.all(); r.at = Date.now(); l.push(r); T.store.set("tara.fareReports", l); },
    remove: function (at) { T.store.set("tara.fareReports", this.all().filter(function (r) { return r.at !== at; })); },
    lookup: function (l) {
      if (!l.from || !l.to) return null;
      var k = this.key(l.mode, l.from.name, l.to.name);
      return this.all().filter(function (r) { return r.key === k; }).pop() || null;
    },
  };
  /* first / last trip check: warn when a ride starts outside usual service hours */
  function serviceWindow(l) {
    var S = TR.service || {};
    if (l.mode === "lrt" || l.mode === "busway") return S[l.line] || null;
    if (l.mode === "ferry") return l.hours || S.ferry;
    return S[l.mode] || null;
  }
  function checkService(l) {
    var w = serviceWindow(l);
    delete l.warn;
    if (!w || (w[0] === "00:00" && w[1] >= "23:59")) return;
    var d = new Date(l.start), m = d.getHours() * 60 + d.getMinutes(), o = T.hm(w[0]), c = T.hm(w[1]);
    var fmt = function (x) { var y = new Date(d); y.setHours(Math.floor(x / 60), x % 60, 0, 0); return T.time(y); };
    var name = l.mode === "lrt" || l.mode === "busway" ? l.line : { tricycle: "tricycles", jeep: "jeepneys", bus: "buses", uv: "UV Express vans", p2p: "P2P buses" }[l.mode] || modeName[l.mode];
    if (l.mode === "ferry") {
      if (m > c) l.warn = "The boat usually leaves between " + fmt(o) + " and " + fmt(c) + " — leave home earlier so you make it.";
      else if (m < o) l.warn = "Boats start around " + fmt(o) + " — you'll wait at the port.";
      else if (m > c - 30) l.warn = "Boats stop around " + fmt(c) + " — be at the port early.";
      return;
    }
    if (m < o) l.warn = "First " + name + " usually start around " + fmt(o) + " — you may wait, or take a Grab/taxi for this part.";
    else if (m > c) l.warn = "Last " + name + " usually run until about " + fmt(c) + " — leave earlier, or take a Grab/taxi for this part.";
  }
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
      if (l.mode === "grab") l.fareReg = Math.ceil((F.grab.base + F.grab.perKm * l.km + F.grab.perMin * l.ride * f) / 5) * 5;
      var rep = l.mode !== "walk" && l.mode !== "car" ? T.fareReports.lookup(l) : null;
      if (rep) {
        l.estimate = l.fareReg; l.fareReg = rep.fare; l.reported = true;
        if (rep.sign && (l.mode === "bus" || l.mode === "jeep")) { l.sign = rep.sign; l.text = (l.mode === "bus" ? "Ride a bus" : "Ride a jeepney") + " with signboard “" + rep.sign + "”"; }
      }
      l.fareReg = Math.round(l.fareReg);
      l.fare = Math.round(l.fareReg * (1 - rate)); // fares are paid in whole pesos
      l.saved = l.fareReg - l.fare;
      checkService(l);
      if (l.perCar) carCost += l.fareReg; else { fare += l.fare; fareReg += l.fareReg; }
    });
    var cars = Math.ceil(pax / 4);
    var perPersonCar = carCost * cars / pax;
    return {
      legs: legs, depart: new Date(depart), arrive: t, minutes: Math.round((t - depart) / 60000),
      fare: Math.round(fare + perPersonCar),
      fareReg: Math.round(fareReg + perPersonCar),
      groupFare: Math.round(fare * pax + carCost * cars),
      warns: legs.filter(function (l) { return l.warn; }).length,
      transfers: legs.filter(function (l) { return l.mode !== "walk"; }).length - 1,
      modes: legs.map(function (l) { return l.mode; }),
    };
  }

  /* ---------- candidate routes ---------- */
  function corridorLegs(from, to) {
    var cf = T.dest.cityOf(from), ct = T.dest.cityOf(to);
    if (!cf || !ct) return null;
    for (var i = 0; i < TR.corridors.length; i++) {
      var c = TR.corridors[i], fwd = c.from.indexOf(cf.id) > -1 && c.to.indexOf(ct.id) > -1, rev = c.to.indexOf(cf.id) > -1 && c.from.indexOf(ct.id) > -1;
      if (!fwd && !rev) continue;
      var stops = fwd ? c.stops.slice() : c.stops.slice().reverse();
      var rides = fwd ? c.rides.slice() : c.rides.slice().reverse();
      var legs = dist(from, stops[0]) < 0.35 ? [] : [localLeg(from, stops[0])];
      rides.forEach(function (r, k) {
        var a = stops[k], b = stops[k + 1], sign = fwd ? r.sign : r.back, goes = fwd ? r.goes : r.goesBack;
        var board = "Board at " + a.name + ". Look for “" + sign + "” on the signboard" + (goes ? " (it goes to " + goes + ")" : "") + ".";
        var leg = r.mode === "bus" ? busLeg(a, b, sign, board, goes) : jeepLeg(a, b, { sign: sign, board: board, goes: goes });
        leg.approx = true;
        legs.push(leg);
      });
      var last = stops[stops.length - 1];
      if (dist(last, to) > 0.35) legs.push(localLeg(last, to));
      return legs;
    }
    return null;
  }

  /* two provincial towns on different sides of Metro Manila (e.g. Calamba → Tanay):
     ride into a shared Metro terminal, then out again */
  function viaTerminal(from, to) {
    var near = function (p) { return TR.provincialStops.slice().sort(function (a, b) { return dist(p, a) - dist(p, b); })[0]; };
    var sa = near(from), sb = near(to);
    if (!sa || !sb || sa === sb || dist(from, sa) > 18 || dist(to, sb) > 18) return null;
    var shared = TR.metroTerminals.filter(function (t) { return (sa.terminals || []).indexOf(t.id) > -1 && (sb.terminals || []).indexOf(t.id) > -1; });
    if (!shared.length) return null;
    var term = shared.sort(function (a, b) { return dist(sa, a) + dist(a, sb) - dist(sa, b) - dist(b, sb); })[0];
    if (dist(sa, term) + dist(term, sb) > dist(from, to) * 2.2) return null;
    var legs = (dist(from, sa) < 0.35 ? [] : [localLeg(from, sa)])
      .concat([busLeg(sa, term, term.sign, sa.how, term.name),
        busLeg(term, sb, sb.sign, "Board at " + term.name + ". Look for “" + sb.sign + "” on the signboard.", sb.area)])
      .concat(dist(sb, to) < 0.35 ? [] : [localLeg(sb, to)]);
    legs.forEach(function (l) { if (l.mode === "bus") l.approx = true; });
    return { via: term.name, legs: legs };
  }
  function isTrain(l) { return l.mode === "lrt" || l.mode === "busway"; }
  // island places (Corregidor, Fortune Island…): reach the port, then the boat
  function ferryAt(p) {
    var hit = null;
    C.places.forEach(function (x) { if (!hit && x.ferry && dist(p, x) < 1.5) hit = x; });
    return hit;
  }
  function ferryLeg(a, b, f) {
    return { mode: "ferry", from: pt(a), to: pt(b), km: dist(a, b), ride: f.minutes, wait: 20, fareReg: f.fare || 0, approx: true,
      hours: f.hours, text: "Take the boat to " + b.name, board: "Board at " + (f.port.name) + ".", tip: f.note };
  }
  function p2pLeg(r, rev) {
    var a = rev ? r.to : r.from, b = rev ? r.from : r.to;
    var km = dist(a, b) * 1.25;
    return { mode: "p2p", from: pt(a), to: pt(b), km: km, ride: km / 35 * 60, wait: 15, fareReg: r.fare, discount: "road", road: true, approx: true,
      text: "Ride the " + r.name + " premium bus", board: "Board at " + a.name + ". P2P buses leave at set times — check today's schedule.",
      tip: "Get off at " + b.name + ". Seats are guaranteed and there are fewer stops than regular buses." };
  }
  function uvVariant(legs, stopArea) {
    var out = legs.map(function (l) {
      if (l.mode !== "bus") return l;
      var km = l.km;
      return { mode: "uv", from: l.from, to: l.to, km: km, ride: km / 38 * 60, wait: 15, fareReg: Math.round(l.fareReg * 1.3), discount: "road", road: true, approx: true,
        text: "Ride a UV Express van to " + l.to.name, board: "Vans leave from the UV Express terminal in " + stopArea + " when full — ask locals where it is.",
        tip: "Faster than the bus, with fewer stops. Fares are posted inside the van." };
    });
    return out;
  }
  function candidates(from, to) {
    var fTo = ferryAt(to), fFrom = ferryAt(from);
    if (fTo && dist(from, fTo) > 2) {
      return candidates(from, pt(fTo.ferry.port)).filter(function (c) { return c.kind !== "car" || true; }).map(function (c) {
        return { kind: c.kind, via: c.via, approx: true, legs: c.legs.concat([ferryLeg(fTo.ferry.port, to, fTo.ferry)]) };
      });
    }
    if (fFrom && dist(to, fFrom) > 2) {
      return candidates(pt(fFrom.ferry.port), to).map(function (c) {
        return { kind: c.kind, via: c.via, approx: true, legs: [ferryLeg(from, fFrom.ferry.port, fFrom.ferry)].concat(c.legs) };
      });
    }
    return baseCandidates(from, to).concat(p2pCandidates(from, to));
  }
  function p2pCandidates(from, to) {
    var out = [];
    (TR.p2p || []).forEach(function (r) {
      [false, true].forEach(function (rev) {
        var a = rev ? r.to : r.from, b = rev ? r.from : r.to;
        if (dist(from, a) > 8 || dist(to, b) > 4) return;
        var legs = (dist(from, a) < 0.35 ? [] : [localLeg(from, pt(a))]).concat([p2pLeg(r, rev)]).concat(dist(b, to) < 0.35 ? [] : metroLink(pt(b), to, true));
        out.push({ kind: "commute", via: r.name, legs: legs, approx: true });
      });
    });
    return out;
  }
  function baseCandidates(from, to) {
    var d = dist(from, to);
    var out = [];
    var fm = T.geo.isMetro(from), tm = T.geo.isMetro(to);

    if (d < 1.2) return [{ kind: "walk", legs: [walkLeg(from, to)] }];
    if (d < 3.5) {
      out.push({ kind: "local", legs: [trikeLeg(from, to)] });
      out.push({ kind: "walk", legs: [walkLeg(from, to)] });
      out.push({ kind: "grab", legs: [grabLeg(from, to)] });
      return out;
    }

    var corr = !fm && !tm && d > 8 ? corridorLegs(from, to) : null;
    if (corr) {
      out.push({ kind: "commute", legs: corr, approx: true });
    } else if (d > 22 && fm !== tm) {
      var south = fm ? to : from;
      var stop = TR.provincialStops.slice().sort(function (a, b) { return dist(south, a) - dist(south, b); })[0];
      var terms = TR.metroTerminals.filter(function (t) { return !stop.terminals || stop.terminals.indexOf(t.id) > -1; });
      terms.forEach(function (term) {
        [true, false].forEach(function (rail) {
          var legs;
          if (!fm) {
            legs = (dist(from, stop) < 0.35 ? [] : [localLeg(from, stop)])
              .concat([busLeg(stop, term, term.sign, stop.how, term.name)])
              .concat(metroLink(pt(term), to, rail));
          } else {
            legs = metroLink(from, pt(term), rail)
              .concat([busLeg(term, stop, stop.sign, "Board at " + term.name + ". Look for buses with “" + stop.sign + "” on the signboard.", stop.area)])
              .concat(dist(stop, to) < 0.35 ? [] : [localLeg(stop, to)]);
          }
          // skip unrealistic combos (e.g. a 30 km jeepney ride across Metro Manila)
          if (legs.some(function (l) { return l.mode === "jeep" && !l.sign && l.km > 15; })) return;
          out.push({ kind: "commute", via: term.name, legs: legs, rail: legs.some(isTrain) });
        });
      });
      // UV Express alternative (vans) on the most direct terminal
      var direct = out.filter(function (c) { return !c.rail; })[0];
      if (direct) out.push({ kind: "commute", via: direct.via, legs: uvVariant(direct.legs, stop.area), approx: true, uv: true });
      if (!out.length) terms.slice(0, 1).forEach(function (term) {
        out.push({ kind: "commute", via: term.name, legs: (fm ? metroLink(from, pt(term), true).concat([busLeg(term, stop, stop.sign, "", stop.area)]).concat([localLeg(stop, to)])
          : [localLeg(from, stop), busLeg(stop, term, term.sign, stop.how, term.name)].concat(metroLink(pt(term), to, true))) });
      });
    } else if (d > 22 && viaTerminal(from, to)) {
      out.push({ kind: "commute", via: viaTerminal(from, to).via, legs: viaTerminal(from, to).legs, approx: true });
    } else if (d > 22) {
      {
        var b = busLeg(pt(from, "the nearest bus stop or terminal"), pt(to, "the terminal near " + to.name), "UV EXPRESS / BUS", "Ask at the nearest terminal for a van or bus heading to " + to.name + ".", to.name);
        b.approx = true;
        out.push({ kind: "commute", legs: [b, localLeg(pt(to, "the terminal"), to)], approx: true });
      }
    } else {
      if (fm && tm) { var r = railRoute(from, to); if (r) out.push({ kind: "commute", rail: true, legs: r }); }
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
    if (fastest && (fastest.minutes < cheapest.minutes - 4 || fastest.transfers < cheapest.transfers)) {
      fastest.tag = fastest.transfers < cheapest.transfers ? "Fewer transfers" : "Faster commute";
      res.push(fastest);
    }
    if (!res.some(function (o) { return o.rail; })) {
      var train = commute.filter(function (o) { return o.rail && res.indexOf(o) < 0; }).sort(function (a, b) { return a.minutes - b.minutes; })[0];
      if (train) { train.tag = train.legs.some(function (l) { return l.mode === "lrt"; }) ? "By train" : "EDSA Carousel"; res.push(train); }
    }
    var hasMode = function (o, m) { return o.legs.some(function (l) { return l.mode === m; }); };
    [["p2p", "Premium P2P bus"], ["uv", "UV Express van"]].forEach(function (mt) {
      if (res.some(function (o) { return hasMode(o, mt[0]); })) return;
      var alt = commute.filter(function (o) { return res.indexOf(o) < 0 && hasMode(o, mt[0]); }).sort(function (a, b) { return a.minutes - b.minutes; })[0];
      if (alt) { alt.tag = mt[1]; res.push(alt); }
    });
    if (longWalk) { longWalk.tag = "Walk (free)"; res.push(longWalk); }
    var grab = list.filter(function (o) { return o.kind === "grab"; })[0];
    if (grab) { grab.tag = "Door-to-door"; res.push(grab); }
    var car = list.filter(function (o) { return o.kind === "car"; })[0];
    if (car) { car.tag = "Own car"; res.push(car); }
    res.forEach(function (o, i) { o.id = "opt" + i; o.title = titleFor(o); });
    return res;
  }

  var modeName = { walk: "Walk", tricycle: "Tricycle", jeep: "Jeepney", bus: "Bus", lrt: "Train", busway: "EDSA Carousel", p2p: "P2P bus", uv: "UV Express", ferry: "Ferry", grab: "Grab/Taxi", car: "Car" };
  function legName(l) { return l.mode === "lrt" || l.mode === "busway" ? l.line : modeName[l.mode]; }
  function titleFor(o) {
    var seq = [];
    o.legs.forEach(function (l) { if (l.mode !== "walk" || o.legs.length === 1) { var n = legName(l); if (seq[seq.length - 1] !== n) seq.push(n); } });
    return seq.join(" → ");
  }

  /* ======================================================================
     ITINERARY — day by day, with stopovers and overnight stays
     ====================================================================== */
  function moveLeg(a, b) {
    var d = dist(a, b);
    if (d < 1.2) return walkLeg(a, b);
    if (d < 4) return trikeLeg(a, b);
    return jeepLeg(a, b);
  }
  function notEat(p) { return p.cat !== "food" && p.cat !== "cafe" && p.cat !== "stay" && !p.hub; }
  // all things to do around a stop (city-wide for a city, walking area for a place), minus places already used
  function poolFor(to, used, home, radius) {
    used = used || {};
    var origin = to.placeId ? T.places.get(to.placeId) : null;
    var list = to.cityId && !to.placeId
      ? T.places.query({ near: to, scope: { type: "city", id: to.cityId } }).map(function (x) { return x.p; })
      : T.places.query({ near: to, within: radius || 2.5 }).map(function (x) { return x.p; });
    var fresh = function (p) { return notEat(p) && !used[p.id]; };
    list = list.filter(fresh);
    if (list.length < 4 && !radius) {
      // small town (or already seen on earlier days): add nearby towns' sights in the same province
      var town = T.dest.city(to.cityId) || T.dest.cityOf(to);
      T.places.query({ near: to, within: 16 }).forEach(function (x) {
        var pc = T.dest.city(x.p.city);
        if (town && pc && pc.province !== town.province) return;
        if (list.indexOf(x.p) < 0 && fresh(x.p)) list.push(x.p);
      });
    }
    if (list.length < 3 && Object.keys(used).length) {
      // multi-day trip ran out of new places: look a little farther, any province
      // (skips places that are closer to home than to this stop — you can see those any day)
      T.places.query({ near: to, within: 25 }).forEach(function (x) {
        if (home && dist(home, x.p) < x.d) return;
        if (list.indexOf(x.p) < 0 && fresh(x.p)) list.push(x.p);
      });
    }
    if (origin && fresh(origin) && list.indexOf(origin) < 0) list.unshift(origin);
    return { origin: origin && !origin.hub && !used[origin.id] ? origin : null, list: list };
  }
  function nnOrder(start, places, origin) {
    var shops = places.filter(function (p) { return p.cat === "market"; });
    var rest = places.filter(function (p) { return p.cat !== "market"; });
    var out = [], here = start;
    if (origin && rest.indexOf(origin) > -1) { out.push(origin); rest.splice(rest.indexOf(origin), 1); here = origin; }
    [rest, shops].forEach(function (group) {
      var left = group.slice();
      while (left.length) { left.sort(function (a, b) { return dist(here, a) - dist(here, b); }); here = left.shift(); out.push(here); }
    });
    return out;
  }
  function closedOn(p, d) { return !!(p.closed && p.closed.indexOf(d.getDay()) > -1); }
  function moveInfo(mv, trav) {
    var fareReg = Math.round(mv.fareReg || 0);
    return { mode: mv.mode, minutes: Math.round(mv.wait + mv.ride), km: mv.km, fareReg: fareReg, fare: Math.round(fareReg * (1 - (mv.discount ? trav.road : 0))) };
  }

  function schedule(to, arrive, leaveAt, order, trav, origin, lunchedBefore, usedMap) {
    var t = T.addMin(arrive, 5), prev = to, steps = [], notFit = [], skipped = [], lunched = !!lunchedBefore;
    var splurge = T.places.query({ near: to, within: 1.5, cat: "food" }).filter(function (x) { return x.p.price === 3; })[0];
    var lunch = function (start, near) {
      var food = T.places.query({ near: near, within: 0.9, cat: "food" })
        .filter(function (x) { return !(usedMap && usedMap[x.p.id]); })
        .sort(function (a, b) { return (a.p.price || 2) - (b.p.price || 2) || a.d - b.d; })[0];
      var spot = food && (food.p.price || 2) <= 2 ? food.p : null;
      var mv = spot ? moveLeg(near, spot) : null;
      var s = spot ? T.addMin(start, Math.round(mv.wait + mv.ride)) : start;
      return { kind: "meal", place: spot, name: spot ? "Lunch at " + spot.name : "Lunch nearby (carinderia or fast food)", start: s, end: T.addMin(s, 60),
        move: mv ? moveInfo(mv, trav) : null, cost: spot ? C.mealBudget[spot.price || 2] : C.mealBudget[1],
        tip: spot ? "" : "Budget meals cost about " + T.peso(C.mealBudget[1]) + "." + (splurge ? " Splurge option: " + splurge.p.name + " (about " + T.peso(C.mealBudget[3]) + ")." : "") };
    };
    var lunchDue = function (at) { return !lunched && mins(at) >= 690 && mins(at) < 900; };

    order.forEach(function (p) {
      var mv = moveLeg(prev, p);
      var at = T.addMin(t, Math.round(mv.wait + mv.ride));
      if (lunchDue(at)) {
        var ls = lunch(t, prev);
        if (ls.end <= leaveAt) {
          steps.push(ls); t = ls.end; prev = ls.place || prev; lunched = true;
          mv = moveLeg(prev, p); at = T.addMin(t, Math.round(mv.wait + mv.ride));
        }
      }
      if (closedOn(p, at)) { skipped.push({ place: p, why: "closed on " + T.date(at).split(",")[0] + "s" }); return; }
      var start = at, note = "";
      if (p.hours) {
        var o = T.hm(p.hours[0]), c = T.hm(p.hours[1]);
        if (mins(at) < o) { start = new Date(at); start.setHours(Math.floor(o / 60), o % 60, 0, 0); note = "Opens at " + T.time(start); }
        if (mins(start) + Math.min(p.visit || 45, 30) > c) { skipped.push({ place: p, why: "closes at " + T.time(new Date(new Date(at).setHours(Math.floor(c / 60), c % 60))) }); return; }
      }
      var end = T.addMin(start, p.visit || 45);
      if (end > leaveAt) {
        if (p === origin && (leaveAt - start) / 60000 >= 60) { end = new Date(leaveAt); note = (note ? note + " · " : "") + "Stay until " + T.time(end); }
        else { notFit.push(p); return; }
      }
      if (!lunched && (p.visit || 0) >= 180 && mins(start) < 720 && mins(end) >= 780) { lunched = true; note = (note ? note + " · " : "") + "Have lunch inside — food stalls are available"; }
      var fee = T.places.fee(p, trav);
      steps.push({ kind: "visit", place: p, name: p.name, start: start, end: end, move: moveInfo(mv, trav), note: note,
        fee: fee.amount || 0, feeReg: fee.regular || fee.amount || 0, tip: (p.tips || [])[0] });
      t = end; prev = p;
    });
    if (!lunched && steps.length && mins(t) >= 690 && mins(t) < 900) {
      var l2 = lunch(t, prev);
      if (l2.end <= leaveAt) { steps.push(l2); t = l2.end; prev = l2.place || prev; lunched = true; }
    }
    return { steps: steps, endAt: t, endPoint: prev, notFit: notFit, skipped: skipped, lunched: lunched };
  }

  /* things to do at one stop between arrive and leaveAt.
     ctx: { used: {id:true}, lunched: bool } — include: ordered place ids (kept in that order) */
  function activities(to, arrive, leaveAt, trav, include, ctx) {
    ctx = ctx || {};
    // ctx.block: the trip's other stops — they get their own time, so earlier stops don't use them up
    var pool = poolFor(to, Object.assign({}, ctx.used, ctx.block), ctx.home, ctx.radius), origin = pool.origin, r;
    var rank = function (p) { return (p === origin ? 10 : 0) + (T.places.score(p) || 4); };
    if (include) {
      var chosen = include.map(function (id) { return T.places.get(id); }).filter(function (p) { return p && !(ctx.used && ctx.used[p.id]); });
      r = schedule(to, arrive, leaveAt, chosen, trav, origin, ctx.lunched, ctx.used);
    } else {
      // auto-fill: add the best spots one by one while they still fit before leaving time
      var ranked = pool.list.filter(function (p) { return p === origin || !(p.fee && p.fee.regular >= 500); })
        .filter(function (p) { return !closedOn(p, arrive); })
        .sort(function (a, b) { return rank(b) - rank(a); });
      var picked = [];
      r = schedule(to, arrive, leaveAt, [], trav, origin, ctx.lunched, ctx.used);
      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < ranked.length; i++) {
          if (picked.indexOf(ranked[i]) > -1) continue;
          if ((leaveAt - r.endAt) / 60000 < 25) break;
          if (ctx.maxPicks && picked.length >= ctx.maxPicks) break;
          var trial = picked.concat([ranked[i]]);
          var tr = schedule(to, arrive, leaveAt, nnOrder(to, trial, origin), trav, origin, ctx.lunched, ctx.used);
          if (!tr.notFit.length && tr.skipped.length === r.skipped.length) { picked = trial; r = tr; }
        }
      }
    }
    var available = Math.max(0, Math.round((leaveAt - arrive) / 60000));
    var free = Math.max(0, Math.round((leaveAt - r.endAt) / 60000));
    var inPlan = r.steps.map(function (s) { return s.place && s.place.id; });
    var suggestions = pool.list.filter(function (p) {
      return inPlan.indexOf(p.id) < 0 && !closedOn(p, arrive) && (p.visit || 45) + 10 <= free;
    }).sort(function (a, b) { return rank(b) - rank(a); }).slice(0, 5);
    var overBy = r.notFit.reduce(function (s, p) { return s + (p.visit || 45) + 8; }, 0);
    var steps = r.steps.slice();
    if (free >= 20) steps.push({ kind: "free", name: "Free time" + (ctx.label ? " in " + ctx.label : ""), start: r.endAt, end: new Date(leaveAt),
      tip: suggestions.length ? "Ideas: " + suggestions.slice(0, 3).map(function (p) { return p.name + " (" + T.dur(p.visit || 45) + ")"; }).join(", ") : "Shop for pasalubong, take photos or rest at a café." });
    return {
      steps: steps, endAt: r.endAt, endPoint: r.endPoint, skipped: r.skipped, notFit: r.notFit, pool: pool.list, lunched: r.lunched,
      fit: { available: available, used: available - free, free: free, overBy: overBy, notFit: r.notFit, suggestions: suggestions },
    };
  }

  /* which stops go on which day: more stops than days → split in order;
     fewer stops than days → a stop gets several days (new places each day) */
  function assignStops(nStops, nDays) {
    var out = [], d, i;
    for (d = 0; d < nDays; d++) out.push([]);
    if (nStops >= nDays) {
      var base = Math.floor(nStops / nDays), extra = nStops % nDays, k = 0;
      for (d = 0; d < nDays; d++) for (i = 0; i < base + (d < extra ? 1 : 0); i++) out[d].push(k++);
    } else {
      for (i = 0; i < nStops; i++) for (d = Math.floor(i * nDays / nStops); d < Math.floor((i + 1) * nDays / nStops); d++) out[d].push(i);
    }
    return out;
  }
  function lodgingTier(id) { return C.lodging.filter(function (l) { return l.id === id; })[0] || C.lodging[0]; }
  function areaName(p) {
    var c = T.dest.cityOf(p);
    return c ? c.name : (p.area || p.name || "your last stop").split(",")[0];
  }
  function travFor(t) {
    if (!t) return T.traveler();
    var id = (C.travelerAliases || {})[t.id] || t.id;
    return C.travelerTypes.filter(function (x) { return x.id === id; })[0] || t;
  }

  /* ---------- reminders ---------- */
  function reminders(plan, wx) {
    var out = [], opt = plan.option, trav = plan.traveler;
    var dep = opt.depart, home = plan.fromHome ? "home" : plan.from.name;
    var eve = new Date(dep); eve.setDate(eve.getDate() - 1); eve.setHours(20, 0, 0, 0);
    if (eve > new Date()) out.push({ at: eve, icon: "bag", text: plan.nights ? "Pack tonight: clothes for " + plan.days.length + " days, toiletries, charger, ID and an umbrella." : "Prepare tonight: charge your phone, pack water, snacks and an umbrella." });
    out.push({ at: T.addMin(dep, -30), icon: "bell", text: "Get ready — leave " + home + " in 30 minutes." });
    out.push({ at: dep, icon: "route", text: "Time to leave " + home + "! " + (opt.legs[0] ? opt.legs[0].text + "." : "") });
    if (plan.nights) out.push({ at: null, icon: "bed", text: "Book your " + plan.nights + " night" + (plan.nights > 1 ? "s" : "") + " of " + plan.lodging.label.toLowerCase() + " stay ahead, especially on weekends and holidays." });
    var allLegs = opt.legs.concat(plan.back ? plan.back.legs : []);
    plan.days.forEach(function (d) { d.steps.forEach(function (s) { if (s.kind === "ride") allLegs = allLegs.concat(s.ride.legs); }); });
    if (trav.id !== "regular") {
      var saved = allLegs.reduce(function (s, l) { return s + (l.saved || 0); }, 0);
      out.push({ at: null, icon: "id", text: "Bring your " + trav.id_name + " — your discount saves about " + T.peso(saved) + " on fares" + (plan.fees.saved ? " and " + T.peso(plan.fees.saved) + " on entrance fees" : "") + "." });
    }
    var allModes = allLegs.map(function (l) { return l.mode; });
    if (allModes.indexOf("jeep") > -1 || allModes.indexOf("tricycle") > -1) out.push({ at: null, icon: "wallet", text: "Keep coins and small bills (₱20, ₱50) ready for jeepney and tricycle fares." });
    if (allModes.indexOf("lrt") > -1) out.push({ at: null, icon: "train", text: "Trains: buy a single-journey ticket at the station or load your beep card. Bags go through inspection." });
    if (allModes.indexOf("bus") > -1) out.push({ at: null, icon: "bus", text: "Check where the bus is going on its signboard before boarding, and keep your ticket until you get off." });
    if (allLegs.some(function (l) { return l.approx; })) out.push({ at: null, icon: "info", text: "Some rides follow common commuter routes — confirm with drivers or terminal staff on the day." });
    if (allLegs.some(function (l) { return l.rush; })) out.push({ at: null, icon: "clock", text: "Part of your trip is during rush hour — we've added extra travel time." });
    var day = wx && T.weather.forDate(wx, dep);
    if (day && day.rain >= 40) out.push({ at: null, icon: "rain", text: "Rain is likely (" + day.rain + "%) — bring an umbrella or raincoat." });
    else if (day && day.max >= 33) out.push({ at: null, icon: "sun", text: "Hot day ahead (up to " + Math.round(day.max) + "°C) — bring water, a cap and sunscreen." });
    var dest = plan.stops[0].placeId && T.places.get(plan.stops[0].placeId);
    if (dest && !dest.hub) {
      var st = T.places.openState(dest, opt.arrive);
      if (st.known && !st.open) out.push({ at: null, icon: "clock", text: dest.name + " is closed when you arrive (" + T.time(opt.arrive) + ") — " + st.label.toLowerCase() + "." });
    }
    plan.days.forEach(function (d) {
      var pre = plan.days.length > 1 ? "Day " + (d.index + 1) + ": " : "";
      if (d.fit && d.fit.status === "over") out.push({ at: null, icon: "info", text: pre + "Too many stops — " + d.fit.notFit.map(function (p) { return p.name; }).join(", ") + " won't fit." });
      d.skipped.forEach(function (s) { out.push({ at: null, icon: "info", text: pre + s.place.name + " is skipped — " + s.why + "." }); });
      d.steps.forEach(function (s) {
        if (s.kind === "visit") out.push({ at: T.addMin(s.start, -10), icon: "pin", text: "Next: " + s.name + " at " + T.time(s.start) + (s.tip ? " · " + s.tip : "") });
        if (s.kind === "ride") out.push({ at: T.addMin(s.start, -15), icon: "route", text: "Leave for " + s.to.name + " at " + T.time(s.start) + ". " + (s.ride.legs[0] ? s.ride.legs[0].text + "." : "") });
        if (s.kind === "stay") out.push({ at: T.addMin(s.start, -30), icon: "bed", text: "Check in soon: " + s.name + "." });
      });
    });
    if (plan.back) out.push({ at: T.addMin(plan.back.depart, -20), icon: "home", text: "Leave for home at " + T.time(plan.back.depart) + " (20 min). " + (plan.back.legs[0] ? plan.back.legs[0].text + "." : "") });
    return out;
  }

  /* ---------- public API ---------- */
  T.planner = {
    options: function (from, to, depart, trav, pax) {
      return pickOptions(candidates(from, to).map(function (c) {
        var r = finalize(c.legs, depart, trav, pax);
        r.kind = c.kind; r.via = c.via; r.rail = c.legs.some(isTrain); r.approx = !!c.approx;
        return r;
      }));
    },
    quick: function (from, to) {
      var d = new Date(); d.setHours(8, 0, 0, 0);
      var o = this.options(from, to, d, T.traveler(), 1);
      return o[0] || null;
    },
    pool: function (to, used) { return poolFor(to, used).list; },
    assignStops: assignStops,

    /* input: { from, stops:[...] (or to), depart, traveler, pax, ret, homeBy, days, lodging,
                activities, optionId, include: { dayIndex: [placeIds in order] } } */
    /* With the trip home on, homeBy is the time you want to BE HOME. We work
       backwards: estimate the ride home, leave the last stop early enough,
       then check the real arrival and adjust (a couple of passes). */
    build: function (input) {
      if (!input.ret) return this._build(input);
      var nDays = Math.max(1, Math.min(C.maxDays || 7, Number(input.days) || 1));
      var target = new Date(input.depart);
      target.setDate(target.getDate() + nDays - 1);
      var hb = T.hm(input.homeBy || "19:00");
      target.setHours(Math.floor(hb / 60), hb % 60, 0, 0);
      var lastEnd = T.addMin(target, -120), plan = null;
      for (var pass = 0; pass < 3; pass++) {
        plan = this._build(Object.assign({}, input, { lastEnd: lastEnd }));
        if (!plan.back) break;
        var diff = Math.round((new Date(plan.back.arrive) - target) / 60000);
        if (Math.abs(diff) <= 5 || plan.leaveAdjusted) break;
        lastEnd = T.addMin(lastEnd, -diff);
        lastEnd.setMinutes(Math.floor(lastEnd.getMinutes() / 5) * 5, 0, 0);
      }
      plan.homeTarget = target;
      plan.homeLate = plan.back ? Math.max(0, Math.round((new Date(plan.back.arrive) - target) / 60000)) : 0;
      return plan;
    },
    _build: function (input) {
      var self = this;
      var trav = input.traveler || T.traveler();
      var pax = input.pax || 1;
      var stops = (input.stops && input.stops.length ? input.stops : [input.to]).filter(Boolean);
      var nDays = Math.max(1, Math.min(C.maxDays || 7, Number(input.days) || 1));
      var tier = lodgingTier(input.lodging);
      var actOn = input.activities !== false;
      var include = input.include && typeof input.include === "object" && !Array.isArray(input.include) ? input.include : (Array.isArray(input.include) ? { 0: input.include } : null);
      var depart = new Date(input.depart);
      // intermediate days end at dayEnd (or homeBy); the last day can be set exactly with lastEnd
      var eh = T.hm(input.dayEnd || input.homeBy || "17:00");

      var opts = this.options(input.from, stops[0], depart, trav, pax);
      var option = opts.filter(function (o) { return o.id === input.optionId; })[0] || opts[0];
      var hop = function (a, b, at) {
        var list = self.options(pt(a), b, at, trav, pax);
        var want = option.kind === "grab" || option.kind === "car" ? option.kind : null;
        return (want ? list.filter(function (o) { return o.kind === want; })[0] : null) ||
          list.filter(function (o) { return o.kind !== "grab" && o.kind !== "car"; })[0] || list[0];
      };
      var rideStep = function (o, to) {
        return { kind: "ride", name: "Go to " + to.name, to: to, start: o.depart, end: o.arrive, ride: o, fare: o.fare, title: o.title };
      };

      var assign = assignStops(stops.length, nDays);
      var used = {}, days = [], here = input.from, leaveAdjusted = false;
      for (var d = 0; d < nDays; d++) {
        var start = new Date(depart); start.setDate(depart.getDate() + d);
        var end = new Date(start); end.setHours(Math.floor(eh / 60), eh % 60, 0, 0);
        if (d === nDays - 1 && input.lastEnd) end = new Date(input.lastEnd);
        var dayStops = assign[d].map(function (i) { return stops[i]; });
        var steps = [], skipped = [], pool = [], notFit = [], suggestions = [];
        var fit = { available: 0, used: 0, free: 0, overBy: 0 };
        var ctx = { used: used, lunched: false, home: input.from };
        var incDay = include && include[d] ? include[d].slice() : null;
        var taken = {};
        var t = d === 0 ? option.arrive : start;
        for (var si = 0; si < dayStops.length; si++) {
          var stop = dayStops[si];
          var sameAsLastNight = si === 0 && d > 0 && days[d - 1].stops.indexOf(stop) > -1;
          if (!(d === 0 && si === 0) && !sameAsLastNight && dist(here, stop) > 0.6) {
            var r = hop(here, stop, t);
            var rs = rideStep(r, stop);
            // long ride over lunchtime: eat before boarding
            if (!ctx.lunched && mins(r.depart) >= 660 && mins(r.depart) < 840 && r.minutes >= 90) {
              ctx.lunched = true; rs.cost = C.mealBudget[1];
              rs.tip = "Long ride over lunchtime — buy lunch at the terminal before you board (about " + T.peso(C.mealBudget[1]) + ").";
            }
            steps.push(rs); t = r.arrive;
          }
          if (si === 0 && end <= T.addMin(t, 60)) { end = T.addMin(t, 180); leaveAdjusted = true; }
          // share the rest of the day between this stop and the ones after it
          var ahead = 0, prevP = stop;
          for (var k = si + 1; k < dayStops.length; k++) {
            var q = hop(prevP, dayStops[k], t);
            ahead += q ? q.minutes : 60; prevP = dayStops[k];
          }
          var remaining = dayStops.length - si - 1;
          var avail = (end - t) / 60000 - ahead;
          var stopEnd = remaining ? T.addMin(t, Math.max(45, Math.round(avail / (remaining + 1)))) : new Date(end);
          if (stopEnd > end) stopEnd = new Date(end);
          var inc = null;
          if (incDay) {
            // each chosen place belongs to the stop of the day it is closest to (keeping the traveler's order)
            inc = incDay.filter(function (id) {
              var pl = T.places.get(id);
              if (!pl || taken[id]) return false;
              var best = dayStops.slice().sort(function (x, y) { return dist(x, pl) - dist(y, pl); })[0];
              if (best !== stop) return false;
              taken[id] = 1; return true;
            });
          }
          ctx.label = dayStops.length > 1 || nDays > 1 ? stop.name : "";
          // keep the trip's other named places out of this stop's plan
          var stopIdx = assign[d][si];
          ctx.block = {};
          stops.forEach(function (o2, i2) { if (i2 !== stopIdx && o2.placeId) ctx.block[o2.placeId] = true; });
          // stops close to each other get smaller walking areas
          ctx.radius = null;
          if (stop.placeId && stops.length > 1) {
            var gaps = stops.filter(function (o2, i2) { return i2 !== stopIdx; }).map(function (o2) { return dist(stop, o2); });
            ctx.radius = Math.max(0.8, Math.min(2.5, 0.45 * Math.min.apply(null, gaps)));
          }
          // a stop you stay at for several days spreads its places over those days
          var spanLeft = assign.slice(d).filter(function (a) { return a.indexOf(stopIdx) > -1; }).length;
          ctx.maxPicks = spanLeft > 1 ? Math.max(1, Math.ceil(poolFor(stop, Object.assign({}, used, ctx.block), input.from, ctx.radius).list.length / spanLeft)) : null;
          var act;
          if (actOn) act = activities(stop, t, stopEnd, trav, inc, ctx);
          else {
            var fm = Math.round((stopEnd - t) / 60000);
            act = { steps: fm >= 20 ? [{ kind: "free", name: "Explore " + stop.name + " on your own", start: t, end: stopEnd }] : [], endAt: t, endPoint: stop, skipped: [], notFit: [], pool: [], lunched: false,
              fit: { available: fm, used: fm, free: 0, overBy: 0, notFit: [], suggestions: [] } };
          }
          act.steps.forEach(function (s) { if (s.place && (s.kind === "visit" || s.kind === "meal")) used[s.place.id] = true; });
          steps = steps.concat(act.steps);
          ctx.lunched = act.lunched;
          skipped = skipped.concat(act.skipped);
          notFit = notFit.concat(act.fit.notFit || []);
          suggestions = act.fit.suggestions || suggestions;
          fit.available += act.fit.available; fit.used += act.fit.used; fit.free += act.fit.free; fit.overBy += act.fit.overBy;
          act.pool.forEach(function (p) { if (pool.indexOf(p) < 0) pool.push(p); });
          here = act.endPoint;
          t = act.steps.length && act.steps[act.steps.length - 1].kind === "free" ? stopEnd : act.endAt;
        }
        if (actOn && !steps.some(function (s) { return s.kind === "visit"; })) {
          // nothing new left to see here: point to nearby towns the traveler could add as a stop
          var c0 = T.dest.cityOf(dayStops[0]) || {};
          var near = T.dest.cities().filter(function (c) { return c.id !== c0.id && dist(c, dayStops[0]) < 45 && dist(c, input.from) > dist(c, dayStops[0]); })
            .sort(function (a, b) { return dist(a, dayStops[0]) - dist(b, dayStops[0]); }).slice(0, 3).map(function (c) { return c.name; });
          steps.forEach(function (s) {
            if (s.kind === "free") s.tip = "You've seen the featured spots here. Relax, explore cafés and markets, or add another stop" + (near.length ? " — try " + near.join(", ") : "") + ".";
          });
        }
        fit.notFit = notFit; fit.suggestions = suggestions;
        fit.status = notFit.length ? "over" : fit.free > 45 ? "free" : "right";
        var stay = null;
        if (d < nDays - 1) {
          var next = new Date(start); next.setDate(start.getDate() + 1);
          var dayEnd = t > end ? t : end;
          var rooms = Math.ceil(pax / 2);
          // a real hotel / inn / resort near where the day ends: the traveler's pick, else the nearest at their price level
          var pick = input.stayPick && input.stayPick[d], hotel = null;
          var nearStays = T.places.query({ near: here, within: 15, cat: "stay" });
          if (pick && pick !== "none") hotel = T.places.get(pick);
          else if (!pick) { var same = nearStays.filter(function (x) { return x.p.tier === tier.id; })[0]; hotel = same ? same.p : null; }
          var room = hotel ? hotel.room : tier.room;
          stay = { kind: "stay", name: hotel ? hotel.name : tier.label + " stay near " + areaName(here), tier: hotel ? hotel.tier : tier.id, start: dayEnd, end: next,
            at: hotel ? pt(hotel) : pt(here, areaName(here)), cost: Math.round(room * rooms / pax), room: room, rooms: rooms, hotelId: hotel ? hotel.id : null,
            options: nearStays.length,
            tip: hotel ? (hotel.kind || "Hotel") + " · about " + T.peso(room) + " per room per night (approx. — check the rate before booking)."
              : tier.desc + " · about " + T.peso(tier.room) + " per room per night (sleeps 2)." + (nearStays.length ? " Tap Change to pick a real place." : "") };
          steps.push(stay);
          if (hotel) here = pt(hotel); // the next day starts from the hotel
        }
        days.push({ index: d, date: start, start: d === 0 ? depart : start, end: end, stops: dayStops, steps: steps, skipped: skipped, pool: pool, fit: actOn ? fit : null, endPoint: here, stay: stay });
      }
      var leaveAt = days[days.length - 1].end;
      var back = null;
      if (input.ret) {
        var bopts = this.options(pt(here), input.from, new Date(leaveAt), trav, pax);
        back = bopts.filter(function (o) { return o.kind === option.kind && (!option.rail || o.rail); })[0] || bopts[0];
      }
      var fees = { total: 0, saved: 0 }, meals = 0, moves = 0, rides = 0, stayCost = 0, nights = nDays - 1;
      days.forEach(function (dd) {
        dd.steps.forEach(function (s) {
          fees.total += s.fee || 0; fees.saved += (s.feeReg || 0) - (s.fee || 0);
          if (s.kind === "meal") meals += s.cost || 0;
          if (s.move) moves += s.move.fare || 0;
          if (s.kind === "ride") { rides += s.fare || 0; meals += s.cost || 0; }
          if (s.kind === "stay") stayCost += s.cost || 0;
        });
      });
      meals += nights * tier.meals;
      var fares = option.fare + (back ? back.fare : 0) + moves + rides;
      var per = fares + fees.total + meals + stayCost;
      var plan = {
        v: 2, id: input.id || "t_" + T.uid(),
        from: input.from, fromHome: !input.from.placeId, to: stops[stops.length - 1], stops: stops,
        name: stops.map(function (s) { return s.name; }).join(" → "),
        traveler: trav, pax: pax, ret: !!input.ret, homeBy: input.homeBy, dayEnd: input.dayEnd || null, leaveAt: leaveAt, leaveAdjusted: leaveAdjusted,
        nights: nights, lodging: { id: tier.id, label: tier.label },
        activitiesOn: actOn, include: include,
        options: opts, option: option, back: back, days: days, fees: fees,
        budget: { fares: fares, moves: moves + rides, fees: fees.total, meals: meals, stay: stayCost, perPerson: per, group: Math.round(per * pax) },
        createdAt: Date.now(),
      };
      plan.reminders = reminders(plan, input.weather);
      return plan;
    },

    /* older saved trips (one day, one destination) → current shape */
    normalize: function (t) {
      if (!t) return t;
      if (!t.days && t.day) {
        t.days = [{ index: 0, date: t.option.depart, start: t.option.depart, end: t.leaveAt, stops: [t.to], steps: t.day.steps || [], skipped: t.day.skipped || [], pool: [], fit: t.day.fit || null, stay: null }];
        delete t.day;
      }
      t.stops = t.stops || [t.to];
      t.name = t.name || t.to.name;
      t.nights = t.nights || 0;
      t.fromHome = t.fromHome != null ? t.fromHome : !t.from.placeId;
      t.traveler = travFor(t.traveler);
      return t;
    },
    endTime: function (t) { return new Date(t.back ? t.back.arrive : t.leaveAt || t.option.arrive); },

    /* every step of a trip in order — used by live mode and checklists */
    steps: function (t) {
      var out = [];
      var leg = function (l, key) {
        return { key: key, type: "leg", mode: l.mode, title: l.text, board: l.board || "", tip: l.tip || "", start: new Date(l.start), end: new Date(l.end),
          target: l.to, ride: l.mode !== "walk", fare: l.fare, line: l.line };
      };
      t.option.legs.forEach(function (l, i) { out.push(leg(l, "o" + i)); });
      t.days.forEach(function (d) {
        d.steps.forEach(function (s, i) {
          var key = T.planner.stepKey(d.index, i);
          if (s.kind === "ride") { s.ride.legs.forEach(function (l, j) { var x = leg(l, key + "l" + j); x.day = d.index; out.push(x); }); return; }
          out.push({ key: key, day: d.index, type: s.kind, mode: s.kind, title: s.name, tip: [s.note, s.tip].filter(Boolean).join(" · "), start: new Date(s.start), end: new Date(s.end),
            target: s.place ? { name: s.place.name, lat: s.place.lat, lng: s.place.lng } : s.at || null, place: s.place || null });
        });
      });
      if (t.back) t.back.legs.forEach(function (l, i) { out.push(leg(l, "b" + i)); });
      return out;
    },
    stepKey: function (day, i) { return day === 0 ? "d" + i : "d" + day + "_" + i; },

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
      return T.planner.normalize(o);
    },

    /* Calendar file with alarms so phones remind you even when the app is closed */
    ics: function (plan) {
      var f = function (d) { d = new Date(d); return d.getUTCFullYear() + T.pad(d.getUTCMonth() + 1) + T.pad(d.getUTCDate()) + "T" + T.pad(d.getUTCHours()) + T.pad(d.getUTCMinutes()) + "00Z"; };
      var escI = function (s) { return String(s).replace(/[\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
      var ev = [];
      var add = function (start, end, title, desc, alarm) {
        ev.push(["BEGIN:VEVENT", "UID:" + plan.id + "-" + ev.length + "@tara", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start), "DTEND:" + f(end),
          "SUMMARY:" + escI(title), "DESCRIPTION:" + escI(desc || "")]
          .concat(alarm ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escI(title), "TRIGGER:-PT" + alarm + "M", "END:VALARM"] : [])
          .concat(["END:VEVENT"]).join("\r\n"));
      };
      var legsText = function (o) { return o.legs.map(function (l, i) { return (i + 1) + ". " + T.time(new Date(l.start)) + " " + l.text + (l.fare ? " (" + T.peso(l.fare) + ")" : ""); }).join("\n"); };
      add(plan.option.depart, plan.option.arrive, "Leave home → " + plan.stops[0].name, legsText(plan.option), 30);
      plan.days.forEach(function (d) {
        d.steps.forEach(function (s) {
          if (s.kind === "free") return;
          if (s.kind === "ride") add(s.start, s.end, "Go to " + s.to.name, legsText(s.ride), 15);
          else add(s.start, s.kind === "stay" ? T.addMin(new Date(s.start), 30) : s.end, s.name, [s.note, s.tip].filter(Boolean).join(" · "), 10);
        });
      });
      if (plan.back) add(plan.back.depart, plan.back.arrive, "Head home", legsText(plan.back), 20);
      return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tara//Trip Planner//EN", "CALSCALE:GREGORIAN"].concat(ev).concat(["END:VCALENDAR"]).join("\r\n");
    },
    modeName: modeName,
    legName: legName,
    lodging: lodgingTier,
  };
})();
