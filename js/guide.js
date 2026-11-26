/* ==========================================================================
   TARA — "What is Tara & how to use it" guide (#/guide), open to everyone.
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA, esc = T.esc, icon = T.icon;

  var STEPS = [
    { ic: "pin", title: "Set where you are", text: "On Home, tap the “You’re in” chip at the top. Use your phone’s location or type your address, e.g. Brgy. Lecheria, Calamba. Set your Home in Profile so every trip starts there.", href: "#/home", cta: "Go to Home" },
    { ic: "compass", title: "Explore places", text: "Browse food, cafés, malls, parks, heritage sites, resorts, hotels and pasalubong shops per city. Filter by Open now or price, switch to Map view, and open a place for photos, hours, entrance fees, tips and reviews.", href: "#/explore", cta: "Explore" },
    { ic: "route", title: "Plan a trip", text: "Tap the orange Plan button. Pick where to go (add stopovers if you like), the date, when you leave and when you want to be home, and Day tour or Multi-day. Tara shows what to ride, where to board, the signboard, every fare, a day schedule and the budget.", href: "#/plan", cta: "Plan a trip" },
    { ic: "ticket", title: "Save it and go", text: "Save the plan to Trips. Turn on reminders, add it to your calendar, check the weather, and on the day tap Start live trip — Tara guides you step by step. Send the trip link to friends so they see the same plan.", href: "#/trips", cta: "My trips" },
    { ic: "chat", title: "Ask Tara anytime", text: "Tap the round Tara bubble on any screen and ask in English or Tagalog: “Magkano papuntang Tagaytay?”, “Cafés open now near me”, “Is Fort Santiago open?”. Drag the bubble to move it out of the way.", action: "guide-ask", cta: "Ask a question" },
    { ic: "wallet", title: "Travel together", text: "On a saved trip: split group expenses and see who owes whom, tick off your pasalubong list, and keep a photo diary that becomes a recap picture to post.", href: "#/trips", cta: "Open a trip" },
    { ic: "flag", title: "Earn badges & help others", text: "Tap “I’ve been here” at places you visit to earn badges and level up. Write reviews, report the real fare you paid, and use Fix info when hours or fees are wrong — it makes Tara better for everyone.", href: "#/profile", cta: "My badges" },
  ];
  var EXTRAS = [
    ["id", "Student, senior & PWD discount", "Turn it on in Profile → Fare discount: 20% off jeep, bus and tricycle, 50% off LRT/MRT, and lower entrance fees. Bring your ID."],
    ["download", "Install it like an app", "Android: tap Install app or menu ⋮ → Add to Home screen. iPhone: Share → Add to Home Screen."],
    ["globe", "Tagalog or English", "Profile → App → Language."],
    ["cloud", "Works offline", "Saved trips, places and Ask Tara work without internet once opened online. Photos, live nearby places and weather need data."],
  ];
  var FAQ = [
    ["Is Tara free?", "Yes. No ads, no booking fees — Tara is for planning, not selling."],
    ["Are the fares and hours exact?", "They’re careful estimates. Fares follow LTFRB-style rates and real reports from riders; hours and fees can change, so check big trips with the venue. You can fix wrong info from any place page."],
    ["Do I need an account?", "You can continue as a guest. An account keeps your trips, saved places and badges under your name."],
    ["Is my data private?", "Your location is only used on your phone to find places and plan routes. Trips and photos stay on your device unless you turn on online accounts."],
    ["Which places are covered?", "Metro Manila and all of Calabarzon (Cavite, Laguna, Batangas, Rizal, Quezon), with more provinces being added. Explore also loads live places near any city from OpenStreetMap."],
  ];

  T.views.guide = function () {
    var u = T.auth.current();
    var html = T.ui.pageHead("How Tara works", { back: true }) +
      '<section class="guide-hero">' +
      '<svg class="guide-hero__logo" aria-hidden="true"><use href="#i-logo"/></svg>' +
      "<div><h2>Tara is your travel buddy</h2>" +
      "<p><b>Tara</b> (“let’s go!”) helps Filipino commuters and travelers find places to visit and plan the whole trip — what to ride, where to board, how much it costs with your discount, what to do first and when to head home.</p></div></section>" +
      '<div class="guide-pills"><span>' + icon("route") + "Commute plans</span><span>" + icon("compass") + "Places per city</span><span>" + icon("chat") + "Ask Tara</span><span>" + icon("wallet") + "Fares & budget</span></div>" +
      '<h2 class="guide-h">How to use it</h2>' +
      '<ol class="guide-steps">' + STEPS.map(function (s, i) {
        return '<li class="guide-step" style="--d:' + i * 60 + 'ms"><span class="guide-step__n">' + (i + 1) + '</span><div class="guide-step__body"><h3>' + icon(s.ic) + esc(s.title) + "</h3><p>" + esc(s.text) + "</p>" +
          (u ? (s.href ? '<a class="btn btn--ghost btn--sm" href="' + s.href + '">' + esc(s.cta) + icon("arrow") + "</a>" : '<button class="btn btn--ghost btn--sm" type="button" data-action="' + s.action + '">' + esc(s.cta) + icon("arrow") + "</button>") : "") + "</div></li>";
      }).join("") + "</ol>" +
      '<h2 class="guide-h">Good to know</h2><div class="guide-extras">' + EXTRAS.map(function (x) {
        return '<div class="guide-extra"><span>' + icon(x[0]) + "</span><div><strong>" + esc(x[1]) + "</strong><p>" + esc(x[2]) + "</p></div></div>";
      }).join("") + "</div>" +
      '<h2 class="guide-h">Questions</h2><div class="guide-faq">' + FAQ.map(function (q) {
        return "<details><summary>" + esc(q[0]) + icon("chev-d") + "</summary><p>" + esc(q[1]) + "</p></details>";
      }).join("") + "</div>" +
      '<div class="guide-cta card">' + (u ? '<a class="btn btn--primary btn--block" href="#/plan">' + icon("route") + 'Plan my first trip</a><a class="btn btn--ghost btn--block" href="#/explore">' + icon("compass") + "Explore places</a>"
        : '<a class="btn btn--primary btn--block" href="#/signup">Create free account</a><a class="btn btn--ghost btn--block" href="#/welcome">Back</a>') + "</div>" +
      '<p class="fine center">Made with love by K &amp; A Studios.</p>';
    T.ui.mount(html, { nav: u ? "profile" : "", cls: "view--guide" });
    try { T.store.set("tara.guide.seen", 1); } catch (e) {}
  };
  T.actions["guide-ask"] = function () { if (T.assistant) T.assistant.open(); };

  // first-run card on Home
  T.guideCard = function () {
    if (T.store.get("tara.guide.seen", 0) || T.store.get("tara.guide.hide", 0)) return "";
    return '<section class="section"><div class="card guide-card"><span class="guide-card__ic">' + icon("sparkle") + "</span>" +
      "<div><strong>New to Tara?</strong><small>See what Tara can do and how to plan your first trip in 1 minute.</small></div>" +
      '<a class="btn btn--primary btn--sm" href="#/guide">Show me</a>' +
      '<button class="icon-btn" type="button" data-action="guide-hide" aria-label="Hide">' + icon("close") + "</button></div></section>";
  };
  T.actions["guide-hide"] = function (el) { T.store.set("tara.guide.hide", 1); var s = el.closest(".section"); if (s) s.remove(); };
})();
