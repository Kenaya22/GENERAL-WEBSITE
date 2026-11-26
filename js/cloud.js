/* ==========================================================================
   TARA — cloud (optional): online accounts, synced trips and shared reviews
   Uses a free Supabase project (Auth + REST). Turn it on by filling in
   TARA.config.backend.supabaseUrl and supabaseKey (the public "anon" key).
   When it's off, everything keeps working on the device only.
   Tables and security rules: supabase/schema.sql
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, store = T.store;
  var B = (T.config && T.config.backend) || {};
  var URL_ = String(B.supabaseUrl || "").replace(/\/+$/, "");
  var KEY = String(B.supabaseKey || "");
  var SKEY = "tara.cloud.session";

  function session() { return store.get(SKEY, null); }
  function setSession(s) {
    if (!s || !s.access_token) { store.del(SKEY); return null; }
    var out = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } };
    store.set(SKEY, out);
    return out;
  }
  function errText(j, status) {
    var m = j && (j.error_description || j.msg || j.message || j.error);
    if (/invalid login credentials/i.test(m || "")) return "Wrong email or password.";
    if (/already registered|already exists/i.test(m || "")) return "An account with this email already exists. Log in instead.";
    if (/email not confirmed/i.test(m || "")) return "Please confirm your email first — check your inbox, then log in.";
    if (/password/i.test(m || "") && /6|short|weak/i.test(m || "")) return "Password needs at least 6 characters.";
    return m || "Server error (" + status + "). Please try again.";
  }
  function raw(method, path, body, token, extra) {
    var h = { apikey: KEY, Authorization: "Bearer " + (token || KEY), "Content-Type": "application/json" };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return fetch(URL_ + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body) })
      .catch(function () { var e = new Error("You're offline or the server can't be reached."); e.offline = true; throw e; })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var e = new Error(errText(j, r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
  }
  // valid access token (refreshes it when it's about to expire)
  function token() {
    var s = session();
    if (!s) return Promise.reject(new Error("Please log in again."));
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return raw("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }).then(function (j) {
      return setSession(j).access_token;
    });
  }
  function rest(method, path, body, prefer) {
    return token().then(function (tk) { return raw(method, "/rest/v1/" + path, body, tk, prefer ? { Prefer: prefer } : null); });
  }

  /* ---------- review cache (so lists and ratings show instantly) ---------- */
  var RKEY = "tara.cloud.reviews";
  var rcache = store.get(RKEY, {});
  function toLocal(r) {
    return { id: r.id, uid: r.user_id, name: r.author_name || "Traveler", photo: r.author_photo || null, rating: r.rating, text: r.body || "",
      photos: r.photos || [], type: r.discount ? "discount" : "regular", at: Date.parse(r.created_at) || Date.now(), edited: r.edited_at ? Date.parse(r.edited_at) : null };
  }
  function cacheSet(placeId, list) {
    rcache[placeId] = list;
    var keys = Object.keys(rcache);
    if (keys.length > 150) delete rcache[keys[0]];
    if (!store.set(RKEY, rcache)) { rcache = {}; rcache[placeId] = list; store.set(RKEY, rcache); }
  }

  var pushTimer = null;
  T.cloud = {
    enabled: function () { return !!(URL_ && KEY && window.fetch); },
    session: session,
    userId: function () { var s = session(); return s && s.user.id; },

    signup: function (email, password, name) {
      return raw("POST", "/auth/v1/signup", { email: email, password: password, data: { name: name } }).then(function (j) {
        // projects with "Confirm email" on return no session until the email is confirmed
        if (!j || !j.access_token) { var e = new Error("Account created! Check your email to confirm it, then log in."); e.confirm = true; throw e; }
        return setSession(j);
      });
    },
    login: function (email, password) {
      return raw("POST", "/auth/v1/token?grant_type=password", { email: email, password: password }).then(setSession);
    },
    logout: function () {
      var s = session();
      store.del(SKEY);
      if (s) raw("POST", "/auth/v1/logout", {}, s.access_token).catch(function () {});
    },

    /* the signed-in user's private data: profile, trips, saved places */
    pull: function () {
      var id = this.userId();
      return rest("GET", "user_data?id=eq." + id + "&select=data,updated_at").then(function (rows) { return rows && rows[0] ? rows[0] : null; });
    },
    push: function (data) {
      var id = this.userId();
      if (!id) return Promise.resolve();
      return rest("POST", "user_data?on_conflict=id", { id: id, data: data, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
    },
    // save soon (many small changes become one upload)
    schedulePush: function (getData) {
      var self = this;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        self.push(getData()).then(function () { store.set("tara.cloud.pushedAt", Date.now()); })
          .catch(function (e) { if (!e.offline) console.warn("Tara sync:", e.message); store.set("tara.cloud.dirty", true); });
      }, 1200);
    },

    /* shared reviews — everyone can read; only the author can edit or delete */
    cachedReviews: function (placeId) { return rcache[placeId] || null; },
    fetchReviews: function (placeId) {
      return raw("GET", "/rest/v1/reviews?place_id=eq." + encodeURIComponent(placeId) + "&order=created_at.desc&limit=100").then(function (rows) {
        var list = (rows || []).map(toLocal);
        cacheSet(placeId, list);
        return list;
      });
    },
    addReview: function (placeId, r) {
      return rest("POST", "reviews", { place_id: placeId, author_name: r.name, author_photo: r.authorPhoto || null, rating: r.rating, body: r.text, photos: r.photos || [], discount: r.type === "discount" }, "return=representation")
        .then(function (rows) { var x = toLocal(rows[0]); cacheSet(placeId, [x].concat(rcache[placeId] || [])); return x; });
    },
    updateReview: function (placeId, rid, f) {
      return rest("PATCH", "reviews?id=eq." + rid, { rating: f.rating, body: f.text, photos: f.photos || [], edited_at: new Date().toISOString() }, "return=representation")
        .then(function (rows) {
          if (!rows || !rows.length) throw new Error("You can only edit your own review.");
          var x = toLocal(rows[0]);
          cacheSet(placeId, (rcache[placeId] || []).map(function (r) { return r.id === rid ? x : r; }));
          return x;
        });
    },
    deleteReview: function (placeId, rid) {
      return rest("DELETE", "reviews?id=eq." + rid, null, "return=minimal").then(function () {
        cacheSet(placeId, (rcache[placeId] || []).filter(function (r) { return r.id !== rid; }));
      });
    },
    // keep the name and photo on your reviews up to date
    updateAuthor: function (name, photo) {
      var id = this.userId();
      if (!id) return Promise.resolve();
      return rest("PATCH", "reviews?user_id=eq." + id, { author_name: name, author_photo: photo || null }, "return=minimal").catch(function () {});
    },
  };
})();
