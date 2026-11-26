/* ==========================================================================
   TARA — sharing & personal touches
   - Trip links: send a saved plan to a friend; it opens in their Tara.
   - Trip diary: photos and notes per trip, and a picture recap to share.
   - Your own place photos and corrections (hours, fees, pin) that fix the
     guide on your phone and can be sent to the Tara team.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, C = T.config, $ = T.$, esc = T.esc, icon = T.icon, store = T.store;

  /* ======================================================================
     TRIP LINKS — the plan is compressed into the link itself (no server)
     ====================================================================== */
  function b64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64url(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function pipe(bytes, Stream, mode) {
    var cs = new Stream(mode);
    var w = cs.writable.getWriter();
    w.write(bytes); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function slim(plan) {
    var o = T.planner.pack(plan);
    ["done", "expenses", "notify", "savedAt", "diary", "pasalubong"].forEach(function (k) { delete o[k]; });
    return o;
  }
  function encodePlan(plan) {
    var bytes = new TextEncoder().encode(JSON.stringify(slim(plan)));
    if (window.CompressionStream) return pipe(bytes, CompressionStream, "deflate-raw").then(function (z) { return "z" + b64url(z); });
    return Promise.resolve("j" + b64url(bytes));
  }
  function decodePlan(d) {
    var kind = d.charAt(0), bytes = unb64url(d.slice(1));
    var p = kind === "z" ? (window.DecompressionStream ? pipe(bytes, DecompressionStream, "deflate-raw") : Promise.reject(new Error("This browser can't open trip links — update it and try again."))) : Promise.resolve(bytes);
    return p.then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  }
  function linkFor(plan) {
    return encodePlan(plan).then(function (d) { return location.origin + location.pathname + "#/import?d=" + d; });
  }
  T.tripLink = { make: linkFor, decode: decodePlan };

  T.actions["trip-link"] = function (el) {
    var plan = el.dataset.id ? T.trips.get(el.dataset.id) : T.state.plan;
    if (!plan) return;
    linkFor(plan).then(function (url) {
      var title = "Tara trip: " + (plan.name || plan.to.name);
      if (navigator.share) return navigator.share({ title: title, text: title + " — open in Tara to see the full plan:", url: url }).catch(function () {});
      if (navigator.clipboard) return navigator.clipboard.writeText(url).then(function () { T.toast("Trip link copied", "Paste it in your group chat. It opens the same plan in Tara.", "share"); });
      T.sheet.open("Trip link", '<textarea class="input" rows="4" readonly>' + esc(url) + "</textarea>");
    }).catch(function (e) { T.toast("Couldn't make the link", e.message, "info", "warn"); });
  };

  var incoming = null;
  T.views["import"] = function (r) {
    var d = r.query && r.query.d;
    var head = T.ui.pageHead("Shared trip", { back: true, sub: "A friend sent you a Tara plan" });
    if (!d) { T.ui.mount(head + T.ui.empty("ticket", "No trip in this link", "Ask your friend to share the link again.", '<a class="btn btn--primary" href="#/home">Go home</a>'), { nav: "trips" }); return; }
    T.ui.mount(head + T.ui.loader("Opening the trip…"), { nav: "trips" });
    decodePlan(d).then(function (o) {
      var t = T.planner.unpack(o);
      incoming = o;
      var u = T.auth.current();
      var dep = new Date(t.option.depart), past = T.planner.endTime(t) < Date.now();
      var stops = (t.stops || [t.to]).map(function (s) { return s.name; });
      var places = 0;
      (t.days || []).forEach(function (dy) { (dy.steps || []).forEach(function (s) { if (s.kind === "place" || s.kind === "visit") places++; }); });
      var html = head + '<div class="card import-card"><span class="import-card__ic">' + icon("ticket") + "</span>" +
        "<h2>" + esc(t.name || t.to.name) + "</h2>" +
        '<p class="muted">' + esc(T.date(dep, true)) + " · leave " + esc(T.time(dep)) + ((t.days || []).length > 1 ? " · " + t.days.length + " days" : " · day tour") + "</p>" +
        '<ul class="import-card__stops">' + stops.map(function (s) { return "<li>" + icon("pin") + esc(s) + "</li>"; }).join("") + "</ul>" +
        '<div class="stat-row"><span><b>' + T.peso(t.option.fare) + "</b>fare one way</span><span><b>" + T.dur(t.option.minutes) + "</b>travel</span><span><b>" + (t.pax || 1) + "</b>traveler" + ((t.pax || 1) > 1 ? "s" : "") + "</span><span><b>" + stops.length + "</b>stop" + (stops.length > 1 ? "s" : "") + "</span></div>" +
        (past ? '<p class="note note--warn">' + icon("info") + "This trip's date has passed. Save it, then use it as a guide or plan the same places for a new date.</p>" : "") +
        '<p class="fine">Routes start from the sender\'s home. Fares follow their discount setting.</p>' +
        '<div class="result__actions">' + (u ? '<button class="btn btn--primary" type="button" data-action="import-save">' + icon("plus") + "Save to my trips</button>"
          : '<button class="btn btn--primary" type="button" data-action="import-guest">' + icon("plus") + 'Continue as guest & save</button><a class="btn btn--ghost" href="#/login">Log in</a>') +
        '<a class="btn btn--ghost" href="#/plan?stops=' + encodeURIComponent((t.stops || [t.to]).map(function (s) { return s.placeId || s.id || ""; }).filter(Boolean).join(",")) + '">' + icon("route") + "Plan it from my home</a></div></div>";
      T.ui.mount(html, { nav: "trips" });
    }).catch(function (e) {
      T.ui.mount(head + T.ui.empty("ticket", "This link couldn't be opened", e.message || "It may have been cut off when it was sent. Ask for the link again.", '<a class="btn btn--primary" href="#/home">Go home</a>'), { nav: "trips" });
    });
  };
  function saveIncoming() {
    if (!incoming) return;
    var o = JSON.parse(JSON.stringify(incoming));
    o.id = T.uid();
    o.sharedCopy = true;
    var saved = T.trips.save(T.planner.unpack(o));
    T.toast("Trip saved!", "It's in your Trips now.", "ticket");
    T.router.go("trip/" + saved.id);
  }
  T.actions["import-save"] = saveIncoming;
  T.actions["import-guest"] = function () { T.auth.guest(); saveIncoming(); };

  /* ======================================================================
     TRIP DIARY — photos and notes per trip (kept apart from the trip so
     syncing trips stays light)
     ====================================================================== */
  var MAXP = 16;
  function diary(id) { return T.data.get("diary." + id, []); }
  function setDiary(id, list) {
    T.data.set("diary." + id, list);
    return JSON.stringify(T.data.get("diary." + id, null)) === JSON.stringify(list);
  }
  function diaryCard(t) {
    var list = diary(t.id);
    var stops = []; (t.days || []).forEach(function (d) { (d.steps || []).forEach(function (s) { if (s.place && stops.indexOf(s.name) < 0 && s.kind !== "ride") stops.push(s.name); }); });
    if (!stops.length) stops = (t.stops || [t.to]).map(function (s) { return s.name; });
    return '<div class="card diary"><div class="sec-head"><h3>' + icon("camera") + ' Trip diary</h3><span class="muted">' + list.length + " memor" + (list.length === 1 ? "y" : "ies") + "</span></div>" +
      (list.length ? '<div class="diary__grid">' + list.map(function (e, i) {
        return '<figure class="diary__item">' + (e.photo ? '<img src="' + esc(e.photo) + '" alt="" loading="lazy">' : '<span class="diary__note-only">' + icon("edit") + "</span>") +
          "<figcaption>" + (e.where ? "<b>" + esc(e.where) + "</b>" : "") + (e.text ? "<span>" + esc(e.text) + "</span>" : "") + "<small>" + esc(T.date(new Date(e.at)) + " · " + T.time(new Date(e.at))) + "</small></figcaption>" +
          '<button class="icon-btn icon-btn--glass" type="button" data-action="diary-del" data-id="' + t.id + '" data-i="' + i + '" aria-label="Delete memory">' + icon("trash") + "</button></figure>";
      }).join("") + "</div>" : '<p class="muted">Add photos and notes as you go — Tara turns them into a recap picture you can share.</p>') +
      '<form class="diary__add" data-submit="diary-add" data-id="' + t.id + '">' +
      '<label class="diary__pick"><input type="file" accept="image/*" name="photo" data-input="diary-photo">' + icon("image") + "<span>Add photo</span></label>" +
      '<select class="input" name="where" aria-label="Where"><option value="">Where? (optional)</option>' + stops.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("") + "</select>" +
      '<input class="input" name="text" maxlength="160" placeholder="A note — e.g. Best halo-halo ever!">' +
      '<button class="btn btn--primary btn--sm" type="submit">' + icon("plus") + "Save memory</button></form>" +
      (list.length ? '<button class="btn btn--ghost btn--sm" type="button" data-action="diary-recap" data-id="' + t.id + '">' + icon("share") + "Make recap picture</button>" : "") + "</div>";
  }
  T.diaryCard = diaryCard;
  T.inputs["diary-photo"] = function (el) {
    var lab = el.closest(".diary__pick");
    var f = el.files && el.files[0];
    if (!f || !lab) return;
    T.readImage(f, 900, 0.72).then(function (src) {
      lab.dataset.src = src;
      lab.style.backgroundImage = "url(" + src + ")";
      lab.classList.add("has-photo");
    }).catch(function (e) { T.toast("Photo not added", e.message, "info", "warn"); });
  };
  T.submits["diary-add"] = function (form) {
    var lab = form.querySelector(".diary__pick"), src = lab && lab.dataset.src;
    var text = form.text.value.trim(), where = form.where.value;
    if (!src && !text) { T.toast("Add a photo or a note", "", "info", "warn"); return; }
    var id = form.dataset.id, list = diary(id);
    if (src && list.filter(function (e) { return e.photo; }).length >= MAXP) { T.toast("Diary is full", "Up to " + MAXP + " photos per trip — delete one to add more.", "info", "warn"); return; }
    list.push({ at: Date.now(), photo: src || null, text: text, where: where });
    if (!setDiary(id, list)) { T.toast("Not enough space", "Delete some photos from older trips and try again.", "info", "warn"); return; }
    T.toast("Memory saved", where || text || "Photo added", "camera");
    T.router.resolve();
  };
  T.actions["diary-del"] = function (el) {
    var list = diary(el.dataset.id);
    list.splice(Number(el.dataset.i), 1);
    setDiary(el.dataset.id, list);
    T.router.resolve();
  };
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function cover(ctx, img, x, y, w, h) {
    var k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function recap(t) {
    var list = diary(t.id), photos = list.filter(function (e) { return e.photo; }).slice(0, 4);
    var W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    var bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#0f3537"); bg.addColorStop(1, "#175153");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#f57a3d"; g.beginPath(); g.arc(W - 90, 110, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fbf5ea"; g.font = "700 64px Fraunces, Georgia, serif"; g.textBaseline = "top";
    var title = t.name || t.to.name;
    while (g.measureText(title).width > W - 220 && title.length > 10) title = title.slice(0, -2);
    if (title !== (t.name || t.to.name)) title = title.replace(/\s*\S*$/, "") + "…";
    g.fillText(title, 72, 70);
    g.font = "500 34px Inter, system-ui, sans-serif"; g.fillStyle = "rgba(251,245,234,.75)";
    g.fillText(T.date(new Date(t.option.depart), true) + ((t.days || []).length > 1 ? " · " + t.days.length + " days" : ""), 72, 160);
    return Promise.all(photos.map(function (e) { return loadImg(e.photo); })).then(function (imgs) {
      imgs = imgs.filter(Boolean);
      var top = 240, gh = 760, gap = 18, x0 = 72, gw = W - 144;
      var cells = imgs.length === 1 ? [[0, 0, 1, 1]] : imgs.length === 2 ? [[0, 0, .5, 1], [.5, 0, .5, 1]] : imgs.length === 3 ? [[0, 0, .6, 1], [.6, 0, .4, .5], [.6, .5, .4, .5]] : [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
      if (!imgs.length) { g.fillStyle = "rgba(255,255,255,.08)"; roundRect(g, x0, top, gw, gh, 36); g.fill(); }
      imgs.forEach(function (img, i) {
        var cl = cells[i], x = x0 + cl[0] * gw + (cl[0] ? gap / 2 : 0), y = top + cl[1] * gh + (cl[1] ? gap / 2 : 0);
        var w = cl[2] * gw - (cl[2] < 1 ? gap / 2 : 0), h = cl[3] * gh - (cl[3] < 1 ? gap / 2 : 0);
        g.save(); roundRect(g, x, y, w, h, 28); g.clip(); cover(g, img, x, y, w, h); g.restore();
      });
      var notes = list.filter(function (e) { return e.text; }).slice(0, 2);
      g.fillStyle = "#fbf5ea"; g.font = "italic 500 34px Fraunces, Georgia, serif";
      var y = top + gh + 40;
      notes.forEach(function (n) {
        var s = "“" + n.text + "”";
        while (g.measureText(s).width > W - 144 && s.length > 8) s = s.slice(0, -3) + "…”";
        g.fillText(s, 72, y); y += 52;
      });
      var stops = (t.stops || [t.to]).length, places = list.filter(function (e) { return e.where; }).map(function (e) { return e.where; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
      g.font = "600 30px Inter, system-ui, sans-serif"; g.fillStyle = "#ffc24b";
      g.fillText(list.length + (list.length === 1 ? " memory · " : " memories · ") + Math.max(places, stops) + " place" + (Math.max(places, stops) > 1 ? "s" : "") + " · " + T.peso(t.option.fare) + " fare", 72, H - 150);
      g.fillStyle = "rgba(251,245,234,.7)"; g.font = "500 28px Inter, system-ui, sans-serif";
      g.fillText("Planned with Tara — tara, lakad tayo!", 72, H - 96);
      return new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.88); });
    });
  }
  T.actions["diary-recap"] = function (el) {
    var t = T.trips.get(el.dataset.id);
    if (!t) return;
    T.toast("Making your recap…", "", "image");
    recap(t).then(function (blob) {
      var name = "tara-recap-" + String(t.name || t.to.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".jpg";
      var url = URL.createObjectURL(blob);
      T.sheet.open("Your trip recap", '<img class="recap-img" src="' + url + '" alt="Trip recap picture">' +
        '<div class="result__actions"><button class="btn btn--primary" type="button" data-action="recap-share">' + icon("share") + 'Share</button><a class="btn btn--ghost" href="' + url + '" download="' + name + '">' + icon("download") + "Save picture</a></div>", { size: "tall" });
      T.actions["recap-share"] = function () {
        var file = new File([blob], name, { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: "My Tara trip" }).catch(function () {});
        else { var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
      };
    });
  };

  /* ======================================================================
     YOUR PLACE PHOTOS & CORRECTIONS
     ====================================================================== */
  var PHK = "tara.myphotos", EDK = "tara.placeedits";
  var baseUrl = T.photos.url.bind(T.photos);
  T.photos.url = function (p) {
    var mine = p && store.get(PHK, {})[p.id];
    return mine ? Promise.resolve(mine) : baseUrl(p);
  };
  T.actions["place-photo"] = function (el) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      T.readImage(f, 1000, 0.75).then(function (src) {
        var all = store.get(PHK, {});
        all[el.dataset.id] = src;
        var keys = Object.keys(all);
        if (keys.length > 40) delete all[keys[0]];
        if (!store.set(PHK, all)) throw new Error("Not enough space on this device.");
        T.toast("Photo added", "Only you see it — share it with a review so others can too.", "camera");
        T.router.resolve();
      }).catch(function (e) { T.toast("Photo not added", e.message, "info", "warn"); });
    };
    inp.click();
  };
  T.actions["place-photo-rm"] = function (el) {
    var all = store.get(PHK, {}); delete all[el.dataset.id]; store.set(PHK, all);
    T.toast("Your photo removed", "", "image"); T.router.resolve();
  };
  T.hasMyPhoto = function (id) { return !!store.get(PHK, {})[id]; };

  // apply saved corrections to the guide on this phone
  var original = {};
  function applyEdits() {
    var all = store.get(EDK, {});
    Object.keys(all).forEach(function (id) {
      var p = T.places.get(id), e = all[id];
      if (!p) return;
      if (!original[id]) original[id] = { hours: p.hours, closed: p.closed, fee: p.fee, lat: p.lat, lng: p.lng, phone: p.phone, room: p.room };
      if (e.hours) p.hours = e.hours;
      if (e.allDay) p.hours = ["00:00", "23:59"];
      if (e.closed) p.closed = e.closed;
      if (e.fee) p.fee = e.fee;
      if (e.room) p.room = e.room;
      if (e.phone) p.phone = e.phone;
      if (e.lat && e.lng) { p.lat = e.lat; p.lng = e.lng; }
      p.editedByYou = true;
    });
  }
  applyEdits();
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  T.actions["place-edit"] = function (el) {
    var p = T.places.get(el.dataset.id);
    if (!p) return;
    var e = store.get(EDK, {})[p.id] || {};
    var h = p.hours || ["", ""], f = p.fee && typeof p.fee === "object" ? p.fee : null;
    var showFee = ["food", "cafe", "stay"].indexOf(p.cat) < 0;
    T.sheet.open("Fix info for " + p.name,
      '<form class="form" data-submit="place-edit" data-id="' + esc(p.id) + '">' +
      '<p class="muted">Seen something wrong? Fix it here — Tara uses your fix on this phone right away, and you can send it to the Tara team so everyone gets it.</p>' +
      '<div class="row-2"><label class="field"><span class="field__label">Opens</span><input class="input" type="time" name="open" value="' + esc(h[0] || "") + '"></label>' +
      '<label class="field"><span class="field__label">Closes</span><input class="input" type="time" name="close" value="' + esc(h[1] || "") + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="allDay"' + (e.allDay ? " checked" : "") + "><span>Open 24 hours</span></label>" +
      '<div class="field"><span class="field__label">Closed on</span><div class="exp__among">' + DAYS.map(function (d, i) { return '<label><input type="checkbox" name="closed" value="' + i + '"' + ((p.closed || []).indexOf(i) > -1 ? " checked" : "") + "><span>" + d + "</span></label>"; }).join("") + "</div></div>" +
      (showFee ? '<div class="row-2"><label class="field"><span class="field__label">Entrance (regular) ₱</span><input class="input" type="number" min="0" inputmode="numeric" name="fee" value="' + (p.fee === 0 ? 0 : f ? f.regular : "") + '"></label>' +
        '<label class="field"><span class="field__label">Student/Senior/PWD ₱</span><input class="input" type="number" min="0" inputmode="numeric" name="feeD" value="' + (p.fee === 0 ? 0 : f ? f.discounted : "") + '"></label></div>' : "") +
      (p.cat === "stay" ? '<label class="field"><span class="field__label">Room rate per night ₱</span><input class="input" type="number" min="0" inputmode="numeric" name="room" value="' + (p.room || "") + '"></label>' : "") +
      '<label class="field"><span class="field__label">Phone</span><input class="input" type="tel" name="phone" value="' + esc(p.phone || "") + '" placeholder="e.g. 0917 123 4567"></label>' +
      '<label class="check"><input type="checkbox" name="pin"><span>The pin is wrong — I\'m at this place now, use my current location</span></label>' +
      '<label class="field"><span class="field__label">Anything else?</span><textarea class="input" name="note" rows="2" maxlength="300" placeholder="e.g. Moved to the 2nd floor; closed for renovation">' + esc(e.note || "") + "</textarea></label>" +
      '<button class="btn btn--primary btn--block" type="submit">' + icon("check") + "Save fix</button>" +
      (original[p.id] ? '<button class="btn btn--ghost btn--block" type="button" data-action="place-edit-undo" data-id="' + esc(p.id) + '">Undo my fixes</button>' : "") + "</form>", { size: "tall" });
  };
  T.submits["place-edit"] = function (form) {
    var id = form.dataset.id, p = T.places.get(id), all = store.get(EDK, {}), e = {};
    var o = form.open.value, c = form.close.value;
    if (form.allDay.checked) e.allDay = true;
    else if (o && c && (!p.hours || o !== p.hours[0] || c !== p.hours[1])) e.hours = [o, c];
    var closed = Array.prototype.slice.call(form.querySelectorAll('[name="closed"]:checked')).map(function (x) { return Number(x.value); });
    if (JSON.stringify(closed) !== JSON.stringify(p.closed || [])) e.closed = closed;
    if (form.fee && form.fee.value !== "") {
      var r = Number(form.fee.value), dd = form.feeD.value === "" ? r : Number(form.feeD.value);
      var cur = p.fee === 0 ? { regular: 0, discounted: 0 } : p.fee || {};
      if (r > 0 && dd === 0 && !cur.regular) dd = r;
      if (r !== cur.regular || dd !== cur.discounted) e.fee = r === 0 ? 0 : { regular: r, discounted: dd, note: "corrected by you" };
    }
    if (form.room && form.room.value && Number(form.room.value) !== p.room) e.room = Number(form.room.value);
    if (form.phone.value.trim() && form.phone.value.trim() !== (p.phone || "")) e.phone = form.phone.value.trim();
    if (form.note.value.trim()) e.note = form.note.value.trim();
    var done = function () {
      if (!Object.keys(e).length) { T.toast("Nothing changed", "", "info"); return; }
      e.at = Date.now();
      all[id] = Object.assign(all[id] || {}, e);
      store.set(EDK, all);
      applyEdits();
      T.sheet.close();
      T.toast("Thanks — fix saved", "Send it to the Tara team from Profile so everyone gets it.", "check");
      T.router.resolve();
    };
    if (form.pin.checked) {
      T.geo.locate().then(function (loc) {
        if (T.geo.distance(loc, p) > 3) T.toast("You seem far from here", "Pin moved anyway — make sure you're at the place.", "info", "warn");
        e.lat = Math.round(loc.lat * 1e5) / 1e5; e.lng = Math.round(loc.lng * 1e5) / 1e5; done();
      }).catch(function () { T.toast("Location is off", "Turn on location to move the pin. Other fixes were saved.", "info", "warn"); done(); });
    } else done();
  };
  T.actions["place-edit-undo"] = function (el) {
    var id = el.dataset.id, all = store.get(EDK, {});
    delete all[id]; store.set(EDK, all);
    var p = T.places.get(id), o = original[id];
    if (p && o) { Object.keys(o).forEach(function (k) { if (o[k] === undefined) delete p[k]; else p[k] = o[k]; }); delete p.editedByYou; delete original[id]; }
    T.sheet.close(); T.toast("Fixes removed", "", "info"); T.router.resolve();
  };
  function editsText() {
    var all = store.get(EDK, {});
    var L = ["Tara place fixes (" + Object.keys(all).length + ")", ""];
    Object.keys(all).forEach(function (id) {
      var p = T.places.get(id), e = all[id], bits = [];
      if (e.allDay) bits.push("open 24 hours");
      if (e.hours) bits.push("hours " + e.hours.join("–"));
      if (e.closed) bits.push("closed " + (e.closed.length ? e.closed.map(function (i) { return DAYS[i]; }).join(", ") : "never"));
      if (e.fee === 0) bits.push("free entrance");
      else if (e.fee) bits.push("entrance ₱" + e.fee.regular + " / ₱" + e.fee.discounted + " discounted");
      if (e.room) bits.push("room ₱" + e.room + "/night");
      if (e.phone) bits.push("phone " + e.phone);
      if (e.lat) bits.push("pin " + e.lat + "," + e.lng);
      if (e.note) bits.push("note: " + e.note);
      L.push("• " + (p ? p.name : id) + " [" + id + "]: " + bits.join("; "));
    });
    return L.join("\n");
  }
  T.placeEdits = { all: function () { return store.get(EDK, {}); }, text: editsText };
  T.actions["share-edits"] = function () {
    var text = editsText();
    if (navigator.share) navigator.share({ title: "Tara place fixes", text: text }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { T.toast("Fixes copied", "Send them to the Tara team.", "check"); });
  };
  T.editsCard = function () {
    var all = store.get(EDK, {}), ids = Object.keys(all);
    return '<div class="card"><div class="sec-head"><h3>' + icon("edit") + ' Place fixes you made</h3><span class="muted">' + ids.length + "</span></div>" +
      (ids.length ? '<ul class="fare-list">' + ids.slice(-12).reverse().map(function (id) {
        var p = T.places.get(id);
        return '<li><span><b>' + esc(p ? p.name : id) + "</b><small>" + esc(T.date(new Date(all[id].at || Date.now()))) + (all[id].note ? " · " + esc(all[id].note) : "") + '</small></span><a class="icon-btn" href="#/place/' + encodeURIComponent(id) + '" aria-label="Open">' + icon("chev-r") + "</a></li>";
      }).join("") + "</ul>" + '<button class="btn btn--ghost btn--sm" type="button" data-action="share-edits">' + icon("share") + "Send fixes to the Tara team</button>"
        : '<p class="muted">On any place, tap <b>Fix info</b> to correct hours, fees, phone or the map pin.</p>') + "</div>";
  };
})();
