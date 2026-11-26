/* ==========================================================================
   TARA — services
   auth     : sign up / log in (accounts are stored on this device)
   geo      : GPS, address search & reverse geocoding (OpenStreetMap Nominatim)
   places   : featured places + live nearby places (OpenStreetMap Overpass)
   photos   : place photos (Wikipedia)
   weather  : forecast (Open-Meteo)
   All network features fall back gracefully when offline.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, store = T.store;

  function fetchJSON(url, opts, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 12000) : null;
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  T.fetchJSON = fetchJSON;

  /* ======================================================================
     AUTH
     ====================================================================== */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function hash(pw, salt) {
    var text = salt + "::" + pw;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex);
    }
    // fallback (non-secure context): FNV-1a
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Promise.resolve("f" + (h >>> 0).toString(16));
  }

  T.auth = {
    users: function () { return store.get("tara.users", []); },
    // public profile (name + photo) of any account on this device — used on reviews
    profile: function (uid) {
      if (!uid) return null;
      if (uid === "guest") return store.get("tara.guest", null);
      return this.users().filter(function (u) { return u.id === uid; })[0] || null;
    },
    session: function () { return store.get("tara.session", null); },
    current: function () {
      var s = this.session();
      if (!s) return null;
      if (s.guest) return store.get("tara.guest", null);
      return this.users().filter(function (u) { return u.id === s.id; })[0] || null;
    },
    signup: function (f) {
      var email = String(f.email || "").trim().toLowerCase();
      if (!f.name || !email || !f.password) return Promise.reject(new Error("Please fill in all fields."));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error("Please enter a valid email."));
      if (String(f.password).length < 6) return Promise.reject(new Error("Password needs at least 6 characters."));
      var users = this.users();
      var cloud = T.cloud && T.cloud.enabled();
      if (!cloud && users.some(function (u) { return u.email === email; })) return Promise.reject(new Error("An account with this email already exists. Log in instead."));
      var salt = T.uid();
      if (cloud) {
        // online account: works on any phone, trips and reviews are saved on the server
        return T.cloud.signup(email, f.password, String(f.name).trim()).then(function (sess) {
          return hash(f.password, salt).then(function (h) {
            var u = saveUser({ id: sess.user.id, cloud: true, name: String(f.name).trim(), email: email, salt: salt, hash: h, type: f.type || "regular", createdAt: Date.now() });
            store.set("tara.session", { id: u.id });
            T.sync.push();
            return u;
          });
        });
      }
      return hash(f.password, salt).then(function (h) {
        var u = { id: "u_" + T.uid(), name: String(f.name).trim(), email: email, salt: salt, hash: h, type: f.type || "regular", createdAt: Date.now() };
        users.push(u);
        store.set("tara.users", users);
        store.set("tara.session", { id: u.id });
        return u;
      });
    },
    login: function (email, password) {
      email = String(email || "").trim().toLowerCase();
      if (T.cloud && T.cloud.enabled()) return cloudLogin(this, email, password);
      return this.localLogin(email, password);
    },
    localLogin: function (email, password) {
      var u = this.users().filter(function (x) { return x.email === email; })[0];
      if (!u) return Promise.reject(new Error("No account found with that email."));
      return hash(password, u.salt).then(function (h) {
        if (h !== u.hash) throw new Error("Wrong password. Please try again.");
        store.set("tara.session", { id: u.id });
        return u;
      });
    },
    guest: function () {
      var g = store.get("tara.guest", null) || { id: "guest", name: "Traveler", guest: true, type: "regular", createdAt: Date.now() };
      store.set("tara.guest", g);
      store.set("tara.session", { guest: true });
      return g;
    },
    update: function (fields) {
      var s = this.session();
      if (!s) return null;
      if (s.guest) {
        var g = Object.assign(store.get("tara.guest", {}), fields);
        store.set("tara.guest", g);
        return g;
      }
      var users = this.users(), out = null;
      users.forEach(function (u) { if (u.id === s.id) { Object.assign(u, fields); out = u; } });
      if (!store.set("tara.users", users)) return null;
      if (out && out.cloud) {
        T.sync.push();
        if ("name" in fields || "photo" in fields) T.cloud.updateAuthor(out.name, out.photo);
      }
      return out;
    },
    logout: function () {
      var u = this.current();
      if (u && u.cloud && T.cloud) T.cloud.logout();
      store.del("tara.session");
    },
  };

  function saveUser(u) {
    var users = T.auth.users().filter(function (x) { return x.id !== u.id && x.email !== u.email; });
    users.push(u);
    store.set("tara.users", users);
    return u;
  }
  /* Online login. Falls back to this device when offline, and moves an older
     device-only account online the first time you log in with it. */
  function cloudLogin(auth, email, password) {
    var local = auth.users().filter(function (x) { return x.email === email; })[0];
    return T.cloud.login(email, password).then(function (sess) {
      return hash(password, (local && local.salt) || T.uid()).then(function (h) {
        var u = saveUser(Object.assign({}, local && local.cloud ? local : {}, { id: sess.user.id, cloud: true, email: email, salt: (local && local.salt) || null, hash: h,
          name: (local && local.name) || email.split("@")[0], type: (local && local.type) || "regular", createdAt: (local && local.createdAt) || Date.now() }));
        if (!u.salt) { u.salt = T.uid(); return hash(password, u.salt).then(function (h2) { u.hash = h2; saveUser(u); return u; }); }
        return u;
      });
    }).then(function (u) {
      store.set("tara.session", { id: u.id });
      return T.sync.pull().then(function () { return T.auth.current(); }, function () { return T.auth.current(); });
    }).catch(function (err) {
      if (!local) throw err;
      // offline: let a known account in with the password saved on this device
      if (err.offline) return auth.localLogin(email, password);
      // wrong password online, but it's an older device-only account → upload it
      if (!local.cloud && err.status === 400) {
        return auth.localLogin(email, password).then(function (old) {
          return T.cloud.signup(email, password, old.name).then(function (sess) {
            ["trips", "favs"].forEach(function (k) { var v = store.get("tara.u." + old.id + "." + k, null); if (v) store.set("tara.u." + sess.user.id + "." + k, v); });
            var u = saveUser(Object.assign({}, old, { id: sess.user.id, cloud: true }));
            store.set("tara.session", { id: u.id });
            T.sync.push();
            return u;
          });
        }, function () { throw err; });
      }
      throw err;
    });
  }

  /* Per-user data bucket (synced online for online accounts) */
  T.data = {
    key: function (k) { var u = T.auth.current(); return "tara.u." + (u ? u.id : "anon") + "." + k; },
    get: function (k, d) { return store.get(this.key(k), d); },
    set: function (k, v) {
      var ok = store.set(this.key(k), v);
      if (k === "trips" || k === "favs") T.sync.push();
      return ok;
    },
  };

  /* Sync: your profile, trips and saved places ⇄ your online account */
  T.sync = {
    active: function () { var u = T.auth.current(); return !!(u && u.cloud && T.cloud && T.cloud.enabled() && T.cloud.session()); },
    data: function () {
      var u = T.auth.current() || {};
      return { profile: { name: u.name, type: u.type, photo: u.photo || null, home: u.home || null, location: u.location || null },
        trips: T.data.get("trips", []), favs: T.data.get("favs", []) };
    },
    push: function () { if (this.active()) T.cloud.schedulePush(this.data.bind(this)); },
    // download the online copy and use it on this device
    pull: function () {
      if (!this.active()) return Promise.resolve(false);
      var self = this;
      return T.cloud.pull().then(function (row) {
        if (!row) { self.push(); return false; }
        var d = row.data || {}, u = T.auth.current();
        if (d.profile) {
          var users = T.auth.users();
          users.forEach(function (x) { if (x.id === u.id) Object.keys(d.profile).forEach(function (k) { if (d.profile[k] != null) x[k] = d.profile[k]; }); });
          store.set("tara.users", users);
        }
        if (d.trips) store.set("tara.u." + u.id + ".trips", d.trips);
        if (d.favs) store.set("tara.u." + u.id + ".favs", d.favs);
        store.set("tara.cloud.pulledAt", Date.parse(row.updated_at) || Date.now());
        return true;
      });
    },
    // on app start: upload changes made offline, otherwise get changes made on other phones
    boot: function () {
      if (!this.active() || !navigator.onLine) return Promise.resolve(false);
      if (store.get("tara.cloud.dirty", false)) { store.del("tara.cloud.dirty"); this.push(); return Promise.resolve(false); }
      return this.pull().catch(function () { return false; });
    },
  };

  T.traveler = function () {
    var u = T.auth.current();
    var id = (u && u.type) || "regular";
    id = (C.travelerAliases || {})[id] || id;
    return C.travelerTypes.filter(function (t) { return t.id === id; })[0] || C.travelerTypes[0];
  };

  /* ======================================================================
     GEO
     ====================================================================== */
  var NOMINATIM = "https://nominatim.openstreetmap.org";
  var lastNom = 0;
  function nominatim(path) {
    // Respect the 1 request / second usage policy.
    var wait = Math.max(0, lastNom + 1100 - Date.now());
    lastNom = Date.now() + wait;
    return new Promise(function (res) { setTimeout(res, wait); }).then(function () {
      return fetchJSON(NOMINATIM + path, { headers: { "Accept-Language": "en" } }, 10000);
    });
  }

  function labelFrom(addr, fallback) {
    if (!addr) return fallback;
    var brgy = addr.quarter || addr.suburb || addr.village || addr.neighbourhood || addr.hamlet;
    var city = addr.city || addr.town || addr.municipality || addr.city_district;
    var prov = addr.province || addr.state_district || addr.county || (addr.state && !/region|calabarzon|ncr|metro manila/i.test(addr.state) ? addr.state : null);
    if (!prov && addr.state && /metro manila|ncr/i.test(addr.state)) prov = "Metro Manila";
    var parts = [];
    if (brgy) parts.push(/^(brgy|barangay)/i.test(brgy) ? brgy : "Brgy. " + brgy);
    if (city) parts.push(city.replace(/^City of /, "") );
    if (prov && prov !== city) parts.push(prov);
    return parts.length ? parts.join(", ") : fallback;
  }

  T.geo = {
    distance: function (a, b) {
      var R = 6371, toR = Math.PI / 180;
      var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
      var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.sqrt(x));
    },
    gazetteer: function (q) {
      var s = String(q || "").toLowerCase();
      var hit = null;
      C.gazetteer.forEach(function (g) { if (!hit && (s.indexOf(g.key) > -1 || (g.alt && s.indexOf(g.alt) > -1))) hit = g; });
      return hit;
    },
    nearestTown: function (p) {
      var best = null, bd = 1e9, self = this;
      C.gazetteer.forEach(function (g) { var d = self.distance(p, g); if (d < bd) { bd = d; best = g; } });
      return bd < 20 ? best : null;
    },
    locate: function () {
      var self = this;
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) return reject(new Error("Location isn't supported on this browser."));
        navigator.geolocation.getCurrentPosition(function (pos) {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        }, function (err) {
          reject(new Error(err.code === 1 ? "Location permission was denied. You can type your address instead." : "Couldn't get your location. Try again or type your address."));
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
      }).then(function (p) {
        return self.reverse(p.lat, p.lng).then(function (label) {
          return { label: label, lat: p.lat, lng: p.lng, source: "gps", at: Date.now() };
        });
      });
    },
    reverse: function (lat, lng) {
      var self = this;
      return nominatim("/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=" + lat + "&lon=" + lng)
        .then(function (j) { return labelFrom(j.address, j.display_name || null); })
        .catch(function () { return null; })
        .then(function (label) {
          if (label) return label;
          var t = self.nearestTown({ lat: lat, lng: lng });
          return t ? "Near " + t.label : lat.toFixed(4) + ", " + lng.toFixed(4);
        });
    },
    search: function (q) {
      q = String(q || "").trim();
      if (q.length < 3) return Promise.resolve([]);
      return nominatim("/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ph&q=" + encodeURIComponent(q))
        .then(function (list) {
          return list.map(function (r) {
            return { label: labelFrom(r.address, r.name || r.display_name), name: r.name || "", full: r.display_name, lat: Number(r.lat), lng: Number(r.lon), source: "search" };
          });
        })
        .catch(function () {
          var g = T.geo.gazetteer(q);
          return g ? [{ label: q, name: q, full: "Approximate — centered on " + g.label, lat: g.lat, lng: g.lng, source: "approx", approx: true }] : [];
        });
    },
    isMetro: function (p) {
      var m = C.transit.metro;
      return p.lat >= m.minLat && p.lat <= m.maxLat && p.lng >= m.minLng && p.lng <= m.maxLng;
    },
  };

  T.location = {
    get: function () {
      var u = T.auth.current();
      return (u && u.location) || store.get("tara.lastLocation", null) || C.defaultLocation;
    },
    set: function (loc) {
      store.set("tara.lastLocation", loc);
      var u = T.auth.current();
      if (u) T.auth.update({ location: loc, home: u.home || loc });
      document.dispatchEvent(new CustomEvent("tara:location", { detail: loc }));
    },
  };

  /* ======================================================================
     PLACES
     ====================================================================== */
  /* ======================================================================
     DESTINATIONS — province → city hierarchy (Klook-style browsing)
     ====================================================================== */
  if (C.morePlaces) { C.places = C.places.concat(C.morePlaces); delete C.morePlaces; }
  var cityList = [], cityById = {}, provById = {};
  C.destinations.forEach(function (prov) {
    provById[prov.id] = prov;
    prov.cities.forEach(function (c) { c.province = prov.id; c.provinceName = prov.name; cityList.push(c); cityById[c.id] = c; });
  });
  T.dest = {
    provinces: function () { return C.destinations; },
    province: function (id) { return provById[id] || null; },
    cities: function () { return cityList; },
    city: function (id) { return cityById[id] || null; },
    // the city a point belongs to (closest center relative to the city's radius)
    cityOf: function (pt) {
      if (!pt || pt.lat == null) return null;
      var best = null, br = 1e9;
      cityList.forEach(function (c) { var r = T.geo.distance(pt, c) / c.radius; if (r < br) { br = r; best = c; } });
      return br <= 1.15 ? best : null;
    },
    current: function () {
      var loc = T.location.get();
      var byName = null, label = String(loc.label || "").toLowerCase();
      cityList.forEach(function (c) { if (!byName && label.indexOf(c.name.toLowerCase().replace(/ \(.*\)/, "")) > -1) byName = c; });
      return byName || this.cityOf(loc);
    },
    label: function (c) { return c ? c.name + ", " + c.provinceName : ""; },
    places: function (scope) {
      if (!scope) return C.places;
      return C.places.filter(function (p) {
        return scope.type === "province" ? (cityById[p.city] || {}).province === scope.id : p.city === scope.id;
      });
    },
    count: function (scope) { return this.places(scope).length; },
  };

  var index = {};
  C.places.forEach(function (p) {
    p.source = "guide";
    if (!p.city) { var c = T.dest.cityOf(p); p.city = c ? c.id : null; }
    index[p.id] = p;
  });
  // cities as pseudo-places (for photos and maps)
  cityList.forEach(function (c) { index["city:" + c.id] = { id: "city:" + c.id, name: c.name, cat: "other", lat: c.lat, lng: c.lng, wiki: c.wiki, area: c.provinceName }; });
  var osmSaved = store.get("tara.osmplaces", {});
  Object.keys(osmSaved).forEach(function (k) { index[k] = osmSaved[k]; });

  function osmCategory(t) {
    var a = t.amenity, s = t.shop, l = t.leisure, tr = t.tourism, h = t.historic;
    if (a === "cafe") return "cafe";
    if (a === "restaurant" || a === "fast_food" || a === "food_court") return "food";
    if (s === "mall" || s === "department_store") return "mall";
    if (a === "marketplace" || s === "bakery" || s === "confectionery") return "market";
    if (l === "water_park" || l === "resort" || tr === "resort") return "resort";
    if (tr === "theme_park" || tr === "zoo" || tr === "aquarium") return "theme";
    if (tr === "museum") return "museum";
    if (a === "place_of_worship") return "church";
    if (h || tr === "attraction" || tr === "viewpoint") return "heritage";
    if (l === "park" || l === "garden" || l === "nature_reserve") return "park";
    return null;
  }
  function osmAddress(t) {
    var parts = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"] || t["addr:barangay"], t["addr:city"]].filter(Boolean);
    return parts.join(", ");
  }
  function osmHours(oh) {
    if (!oh) return null;
    if (/^24\/7$/.test(oh)) return ["00:00", "23:59"];
    var m = oh.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    return m ? [m[1], m[2]] : null;
  }
  function osmToPlace(el) {
    var t = el.tags || {};
    var cat = osmCategory(t);
    if (!cat || !t.name) return null;
    var lat = el.lat || (el.center && el.center.lat), lng = el.lon || (el.center && el.center.lon);
    if (!lat || !lng) return null;
    var extra = [];
    if (t.cuisine) extra.push(t.cuisine.replace(/_/g, " ").replace(/;/g, ", "));
    if (t.religion && cat === "church") extra.push(t.denomination || t.religion);
    return {
      id: "osm-" + el.type.charAt(0) + el.id, name: t.name, cat: cat, source: "osm",
      area: t["addr:city"] || "", address: osmAddress(t), lat: lat, lng: lng,
      hours: osmHours(t.opening_hours), hoursText: t.opening_hours || "", fee: t.fee === "no" ? 0 : null,
      phone: t.phone || t["contact:phone"] || "", website: t.website || t["contact:website"] || "",
      wiki: t.wikipedia || null, image: /^https:\/\//.test(t.image || "") ? t.image : null,
      desc: extra.length ? extra.join(" · ") : "", visit: cat === "food" || cat === "cafe" ? 60 : cat === "mall" ? 90 : 45,
      price: cat === "food" ? (t.amenity === "fast_food" ? 1 : 2) : null,
      city: (T.dest.cityOf({ lat: lat, lng: lng }) || {}).id || null,
    };
  }

  T.places = {
    featured: function () { return C.places; },
    get: function (id) { return index[id] || null; },
    remember: function (p) {
      if (!p || p.source !== "osm") return;
      index[p.id] = p;
      osmSaved[p.id] = p;
      var keys = Object.keys(osmSaved);
      if (keys.length > 300) delete osmSaved[keys[0]];
      store.set("tara.osmplaces", osmSaved);
    },
    nearby: function (loc, radius) {
      radius = radius || 3000;
      var key = "tara.nearby." + loc.lat.toFixed(2) + "," + loc.lng.toFixed(2);
      var cached = store.get(key, null);
      if (cached && Date.now() - cached.at < 864e5) {
        cached.items.forEach(function (p) { index[p.id] = p; });
        return Promise.resolve(cached.items);
      }
      var a = "(around:" + radius + "," + loc.lat + "," + loc.lng + ")";
      var q = "[out:json][timeout:25];(" +
        'nwr["amenity"~"^(restaurant|fast_food|cafe|food_court|marketplace)$"]["name"]' + a + ";" +
        'nwr["amenity"="place_of_worship"]["name"]' + a + ";" +
        'nwr["shop"~"^(mall|department_store|bakery|confectionery)$"]["name"]' + a + ";" +
        'nwr["leisure"~"^(park|garden|nature_reserve|water_park|resort)$"]["name"]' + a + ";" +
        'nwr["tourism"~"^(museum|attraction|theme_park|viewpoint|zoo|aquarium|resort)$"]["name"]' + a + ";" +
        'nwr["historic"]["name"]' + a + ";" +
        ");out center tags 200;";
      return fetchJSON("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 25000)
        .then(function (j) {
          var seen = {};
          var items = (j.elements || []).map(osmToPlace).filter(function (p) {
            if (!p) return false;
            var k = p.name.toLowerCase();
            if (seen[k]) return false;
            seen[k] = 1;
            // skip duplicates of featured places
            return !C.places.some(function (f) { return f.name.toLowerCase() === k || (T.geo.distance(f, p) < 0.08 && f.cat === p.cat); });
          });
          items.forEach(function (p) { index[p.id] = p; });
          store.set(key, { at: Date.now(), items: items });
          return items;
        });
    },
    query: function (opts) {
      opts = opts || {};
      var near = opts.near || T.location.get();
      var list = C.places.concat(opts.extra || []);
      var q = String(opts.q || "").trim().toLowerCase();
      var sc = opts.scope;
      list = list.filter(function (p) {
        if (sc && sc.type === "city" && p.city !== sc.id) return false;
        if (sc && sc.type === "province" && (T.dest.city(p.city) || {}).province !== sc.id) return false;
        if (opts.cat && p.cat !== opts.cat) return false;
        if (q && [p.name, p.area, p.address, p.desc, T.cat(p.cat).label].join(" ").toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).map(function (p) { return { p: p, d: T.geo.distance(near, p) }; });
      if (opts.within) list = list.filter(function (x) { return x.d <= opts.within; });
      list.sort(opts.sort === "rating"
        ? function (a, b) { return (T.places.score(b.p) || 0) - (T.places.score(a.p) || 0) || a.d - b.d; }
        : function (a, b) { return a.d - b.d; });
      return list;
    },
    /* Reviews are saved in this browser (there is no server yet), so everyone
       using Tara on this device sees them. Each has an id and the author's user id
       so the author can edit or delete it later. */
    /* With the online backend on, reviews are shared with everyone (cached here);
       older reviews saved only on this device are still shown. */
    online: function () { return !!(T.cloud && T.cloud.enabled()); },
    localReviews: function (id) { return store.get("tara.reviews", {})[id] || []; },
    reviews: function (id) {
      var list = this.localReviews(id).slice();
      if (this.online()) list = (T.cloud.cachedReviews(id) || []).concat(list);
      return list.sort(function (a, b) { return b.at - a.at; });
    },
    review: function (id, rid) { return this.reviews(id).filter(function (r) { return r.id === rid; })[0] || null; },
    fetchReviews: function (id) { return this.online() ? T.cloud.fetchReviews(id) : Promise.resolve(this.reviews(id)); },
    isLocalReview: function (rid) { return /^r_/.test(String(rid)); },
    addReview: function (id, r) {
      if (this.online()) {
        if (!T.sync.active()) return Promise.reject(new Error("Please log in with an account to post reviews that everyone can see."));
        return T.cloud.addReview(id, r);
      }
      var all = store.get("tara.reviews", {});
      r.id = r.id || "r_" + T.uid();
      (all[id] = all[id] || []).push(r);
      if (!store.set("tara.reviews", all)) return Promise.reject(new Error("Not enough space on this device — try fewer or smaller photos."));
      return Promise.resolve(r);
    },
    updateReview: function (id, rid, fields) {
      if (this.online() && !this.isLocalReview(rid)) return T.cloud.updateReview(id, rid, fields);
      var all = store.get("tara.reviews", {});
      (all[id] || []).forEach(function (r) { if (r.id === rid) Object.assign(r, fields, { edited: Date.now() }); });
      if (!store.set("tara.reviews", all)) return Promise.reject(new Error("Not enough space on this device — try fewer or smaller photos."));
      return Promise.resolve();
    },
    deleteReview: function (id, rid) {
      if (this.online() && !this.isLocalReview(rid)) return T.cloud.deleteReview(id, rid);
      var all = store.get("tara.reviews", {});
      all[id] = (all[id] || []).filter(function (r) { return r.id !== rid; });
      store.set("tara.reviews", all);
      return Promise.resolve();
    },
    score: function (p) {
      var rv = this.reviews(p.id);
      if (!rv.length) return p.rating || null;
      var sum = rv.reduce(function (s, r) { return s + r.rating; }, 0);
      if (!p.rating) return sum / rv.length;
      return (p.rating * 10 + sum) / (10 + rv.length); // guide score weighs like 10 reviews
    },
    openState: function (p, when) {
      when = when || new Date();
      if (!p.hours) return { known: false, open: null, label: p.hoursText ? "Hours: " + p.hoursText : "Hours not listed" };
      var day = when.getDay();
      var o = T.hm(p.hours[0]), c = T.hm(p.hours[1]);
      if (o === 0 && c >= 1439) return { known: true, open: true, label: "Open 24 hours", allDay: true };
      var mins = when.getHours() * 60 + when.getMinutes();
      var fmt = function (m) { var d = new Date(when); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return T.time(d); };
      if (p.closed && p.closed.indexOf(day) > -1) return { known: true, open: false, closedDay: true, label: "Closed today" };
      if (mins < o) return { known: true, open: false, label: "Opens " + fmt(o) };
      if (mins >= c) return { known: true, open: false, label: "Closed · opens " + fmt(o) };
      return { known: true, open: true, label: "Open · closes " + fmt(c), closesIn: c - mins };
    },
    hoursText: function (p) {
      if (!p.hours) return p.hoursText || "Not listed";
      var o = T.hm(p.hours[0]), c = T.hm(p.hours[1]);
      if (o === 0 && c >= 1439) return "Open 24 hours";
      var d = new Date(); var f = function (m) { d.setHours(Math.floor(m / 60), m % 60, 0, 0); return T.time(d); };
      var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return f(o) + " – " + f(c) + (p.closed && p.closed.length ? " · closed " + p.closed.map(function (x) { return days[x]; }).join(", ") : " · daily");
    },
    fee: function (p, trav) {
      trav = trav || T.traveler();
      if (p.fee === 0) return { amount: 0, label: "Free" };
      if (!p.fee) return { amount: null, label: p.source === "osm" ? "Check on site" : "—" };
      var disc = trav.entry && p.fee.discounted < p.fee.regular;
      var amt = disc ? p.fee.discounted : p.fee.regular;
      return { amount: amt, regular: p.fee.regular, discounted: disc, note: p.fee.note || "", label: T.peso(amt) };
    },
  };

  /* ======================================================================
     PHOTOS (Wikipedia) — lazy, cached
     ====================================================================== */
  var photoCache = store.get("tara.photos", {});
  var pending = {};
  T.photos = {
    url: function (p) {
      if (!p) return Promise.resolve(null);
      if (p.photo) return Promise.resolve(p.photo);
      if (p.image) return Promise.resolve(p.image);
      if (!p.wiki) return Promise.resolve(null);
      var lang = "en", title = p.wiki;
      var m = /^([a-z]{2,3}):(.+)$/.exec(title);
      if (m) { lang = m[1]; title = m[2]; }
      var key = "v2:" + lang + ":" + title;
      if (key in photoCache) return Promise.resolve(photoCache[key] || null);
      if (pending[key]) return pending[key];
      var api = "https://" + lang + ".wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=800&redirects=1&origin=*&titles=" + encodeURIComponent(title);
      pending[key] = fetchJSON(api, null, 10000)
        .then(function (j) {
          var pg = j && j.query && j.query.pages && j.query.pages[0];
          var src = pg && pg.thumbnail && pg.thumbnail.source;
          photoCache[key] = src || "";
          store.set("tara.photos", photoCache);
          return src || null;
        })
        .catch(function () { return null; });
      return pending[key];
    },
    // Fill every [data-photo] element inside root when it scrolls into view.
    hydrate: function (root) {
      var els = T.$$("[data-photo]:not([data-photo-done])", root || document);
      var load = function (el) {
        el.setAttribute("data-photo-done", "1");
        var p = T.places.get(el.getAttribute("data-photo"));
        T.photos.url(p).then(function (src) {
          if (!src) return;
          var img = new Image();
          img.alt = "";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          img.onload = function () { el.appendChild(img); requestAnimationFrame(function () { img.classList.add("is-in"); }); el.classList.add("has-photo"); };
          img.src = src;
        });
      };
      if (!("IntersectionObserver" in window)) return els.forEach(load);
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); load(en.target); } });
      }, { rootMargin: "200px" });
      els.forEach(function (el) { io.observe(el); });
    },
  };

  /* ======================================================================
     WEATHER (Open-Meteo, no key needed)
     ====================================================================== */
  T.weather = {
    get: function (loc) {
      var key = "tara.wx." + loc.lat.toFixed(1) + "," + loc.lng.toFixed(1);
      var c = store.get(key, null);
      if (c && Date.now() - c.at < 36e5) return Promise.resolve(c.data);
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat.toFixed(3) + "&longitude=" + loc.lng.toFixed(3) +
        "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FManila&forecast_days=16";
      return fetchJSON(url, null, 10000).then(function (j) {
        var data = {
          current: j.current ? { temp: j.current.temperature_2m, code: j.current.weather_code } : null,
          daily: (j.daily && j.daily.time || []).map(function (d, i) {
            return { date: d, code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max[i] };
          }),
        };
        store.set(key, { at: Date.now(), data: data });
        return data;
      }).catch(function () { return c ? c.data : null; });
    },
    forDate: function (data, d) {
      if (!data) return null;
      var iso = T.isoDate(d);
      return data.daily.filter(function (x) { return x.date === iso; })[0] || null;
    },
    describe: function (code) {
      if (code == null) return { label: "—", icon: "cloud" };
      if (code === 0) return { label: "Clear", icon: "sun" };
      if (code <= 2) return { label: "Partly cloudy", icon: "cloud-sun" };
      if (code === 3) return { label: "Cloudy", icon: "cloud" };
      if (code === 45 || code === 48) return { label: "Foggy", icon: "cloud" };
      if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
      if (code >= 51) return { label: code >= 80 ? "Rain showers" : "Rain", icon: "rain" };
      return { label: "Cloudy", icon: "cloud" };
    },
  };
})();
