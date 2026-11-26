/* ==========================================================================
   TARA — Tagalog / English switch
   Translates the app's buttons, menus, headings and labels. Place
   descriptions and tips stay in English for now.
   How it works: a dictionary of exact UI strings plus a few patterns for
   dynamic labels; a watcher translates every screen, sheet and toast as it
   appears. Setting is saved per device (Profile → App → Language).
   ========================================================================== */
(function () {
  "use strict";
  var T = window.TARA = window.TARA || {};

  var DICT = {
    // navigation
    "Home": "Bahay", "Explore": "Tuklasin", "Plan": "Magplano", "Trips": "Mga Biyahe", "Profile": "Ako",
    "Install app": "I-install ang app", "Install Tara": "I-install ang Tara", "Travel buddy": "Kasama sa biyahe",
    "Your Philippine travel buddy": "Ang iyong kasama sa paglalakbay sa Pilipinas",
    // welcome / auth
    "Create free account": "Gumawa ng libreng account", "Create account": "Gumawa ng account", "Log in": "Mag-log in",
    "Continue as guest": "Magpatuloy bilang bisita", "Discover nearby": "Tuklasin ang malapit", "Plan any trip": "Planuhin ang kahit anong biyahe",
    "Never miss a step": "Walang makakaligtaang hakbang", "Find places. Plan the commute.": "Maghanap ng lugar. Planuhin ang biyahe.",
    "Day itinerary, reminders and calendar alerts.": "Itinerary sa bawat araw, mga paalala at alerto sa kalendaryo.",
    // home
    "You're in": "Nasa", "See all": "Tingnan lahat", "More": "Iba pa", "Destinations": "Mga destinasyon", "All destinations": "Lahat ng destinasyon",
    "Featured trips": "Mga tampok na biyahe", "Trip ideas": "Mga ideya sa biyahe", "Student, senior or PWD?": "Estudyante, senior o PWD?",
    "Weekend getaway": "Weekend getaway", "Food trip": "Food trip", "Café hopping": "Café hopping", "Hot spring getaway": "Hot spring getaway",
    // categories & filters
    "All": "Lahat", "Food": "Pagkain", "Cafés": "Mga café", "Malls": "Mga mall", "Parks": "Mga parke", "Heritage": "Pamana",
    "Museums": "Mga museo", "Churches": "Mga simbahan", "Resorts": "Mga resort", "Theme parks": "Mga theme park", "Pasalubong": "Pasalubong",
    "Stays": "Matutuluyan", "Open now": "Bukas ngayon", "Any price": "Kahit anong presyo", "Free": "Libre", "₱ Budget": "₱ Tipid",
    "₱₱ Mid": "₱₱ Katamtaman", "₱₱₱ Splurge": "₱₱₱ Gastos", "Nearest": "Pinakamalapit", "Top rated": "Pinakamataas ang rating",
    "List": "Listahan", "Map": "Mapa", "City guide": "Gabay sa lungsod", "Exploring near you": "Tinutuklas ang malapit sa iyo", "Exploring": "Tinutuklas",
    "Open 24h": "Bukas 24 oras", "Closed": "Sarado", "New": "Bago",
    // place & city pages
    "About": "Tungkol dito", "Good to know": "Dapat malaman", "Hours": "Oras", "Entrance": "Bayad sa pagpasok", "Time needed": "Oras na kailangan",
    "Tips": "Mga tip", "Location": "Lokasyon", "Reviews": "Mga review", "Write a review": "Sumulat ng review", "Nearby": "Malapit",
    "Plan a trip here": "Magplano papunta rito", "Directions": "Direksyon", "Plan a day here": "Magplano ng isang araw dito", "All places": "Lahat ng lugar",
    "Top things to do": "Mga dapat gawin", "Where to eat": "Saan kakain", "Shopping & pasalubong": "Pamimili at pasalubong",
    "Guide score": "Marka ng gabay", "featured places": "tampok na lugar", "from you": "mula sa iyo", "weather now": "panahon ngayon",
    "Room rate": "Presyo ng kuwarto", "Budget": "Badyet",
    // plan
    "Plan a trip": "Magplano ng biyahe", "Plan my trip": "Planuhin ang biyahe ko", "Plan this trip": "Planuhin ang biyaheng ito",
    "Trip length": "Haba ng biyahe", "Day tour": "Day tour", "Day trip": "Day trip", "Multi-day": "Ilang araw", "Date": "Petsa",
    "Destination": "Destinasyon", "Start from": "Magsimula sa", "Travelers": "Mga kasama", "Traveler": "Biyahero", "Regular": "Regular",
    "Fare discount": "Diskuwento sa pamasahe", "Student · Senior · PWD": "Estudyante · Senior · PWD", "Leave home at": "Aalis ng bahay nang",
    "Arrive home by": "Nasa bahay na bago mag", "To arrive home by": "Para makauwi bago mag", "Add a stop": "Magdagdag ng hintuan",
    "Include the trip home": "Isama ang pag-uwi", "Plan the ride back home at the end": "Planuhin ang pag-uwi sa dulo",
    "Plan things to do": "Planuhin ang mga gagawin", "Fill each day with places, a lunch stop and entrance fees": "Punuin ang bawat araw ng mga lugar, tanghalian at bayad sa pagpasok",
    "Cheapest": "Pinakamura", "Faster commute": "Mas mabilis", "Fewer transfers": "Kaunting palipat", "By train": "Sa tren",
    "Door-to-door": "Hatid-sundo", "Own car": "Sariling sasakyan", "Walk (free)": "Lakad (libre)", "Premium P2P bus": "Premium P2P bus",
    "UV Express van": "UV Express van", "EDSA Carousel": "EDSA Carousel", "Getting there": "Papunta roon", "Going home": "Pauwi",
    "Leave home": "Umalis ng bahay", "Leave for home": "Umuwi na", "Arrive home": "Dating sa bahay", "Get off at": "Bumaba sa",
    "Edit places": "I-edit ang mga lugar", "Free time": "Libreng oras", "Your itinerary": "Ang iyong itinerary", "Reminders": "Mga paalala",
    "Total per person": "Kabuuan bawat tao", "Food (estimate)": "Pagkain (tantiya)", "Entrance fees": "Bayad sa pagpasok",
    "Save trip": "I-save ang biyahe", "Add to calendar": "Idagdag sa kalendaryo", "Share": "Ibahagi", "Report real fare": "Iulat ang totoong pamasahe",
    "Update real fare": "I-update ang totoong pamasahe", "rush hour": "rush hour", "reported fare": "iniulat na pamasahe",
    "Lunch nearby (carinderia or fast food)": "Tanghalian sa malapit (karinderya o fast food)", "Tricycle": "Traysikel", "Jeepney": "Dyip",
    "Bus": "Bus", "Walk": "Lakad", "Car": "Kotse", "Grab/Taxi": "Grab/Taxi", "Ferry": "Bangka",
    "Too many stops": "Sobrang daming hinto", "Just right": "Sakto lang", "Change stay": "Palitan ang tutuluyan", "Choose a real stay": "Pumili ng tutuluyan",
    // trips & live
    "My trips": "Aking mga biyahe", "No upcoming trips": "Walang paparating na biyahe", "Plan, save and track your trips": "Magplano, mag-save at subaybayan ang mga biyahe",
    "Start live trip": "Simulan ang live na biyahe", "Continue live trip": "Ituloy ang live na biyahe", "Live trip": "Live na biyahe",
    "Remind me": "Paalalahanan ako", "Google Maps": "Google Maps", "Done": "Tapos na", "Up next": "Susunod",
    "I got off — next step": "Nakababa na ako — susunod", "On schedule": "Nasa oras", "Trip-day check": "Pagsusuri sa araw ng biyahe",
    "PAGASA typhoon & rain advisories": "Abiso ng PAGASA sa bagyo at ulan", "Live traffic": "Trapiko ngayon",
    "Pasalubong checklist": "Listahan ng pasalubong", "Share list": "Ibahagi ang listahan", "Add": "Idagdag",
    "Group expenses": "Gastos ng grupo", "Add expense": "Idagdag ang gastos", "Paid by": "Nagbayad", "Split among": "Hahatiin sa",
    "Settle up": "Bayaran", "Share summary": "Ibahagi ang buod", "Everyone is even.": "Pantay-pantay na ang lahat.",
    "Trip saved!": "Na-save ang biyahe!", "Find it in Trips. Turn on reminders there.": "Nasa Mga Biyahe ito. I-on doon ang mga paalala.",
    "Get ready — leave home in 30 minutes.": "Maghanda — aalis ng bahay sa loob ng 30 minuto.",
    // profile
    "Saved places": "Mga naka-save na lugar", "Locations": "Mga lokasyon", "Current location": "Kasalukuyang lokasyon", "App": "App",
    "Dark mode": "Dark mode", "Easier on the eyes at night": "Mas magaan sa mata sa gabi", "Notifications": "Mga abiso", "Your data": "Ang iyong data",
    "Exit guest mode": "Lumabas sa guest mode", "Log out": "Mag-log out", "Delete my data": "Burahin ang aking data",
    "Real fares you reported": "Totoong pamasaheng iniulat mo", "Share my fare reports": "Ibahagi ang aking mga ulat sa pamasahe",
    "Tap the heart on any place to save it here.": "I-tap ang puso sa kahit anong lugar para i-save dito.",
    "Language": "Wika", "optional": "opsyonal", "Made with love by": "Gawa nang may pagmamahal ng",
    // placeholders
    "Search cafés, food, malls, parks…": "Maghanap ng café, pagkain, mall, parke…", "Add person": "Magdagdag ng tao",
    "What for? e.g. Bus fare": "Para saan? hal. pamasahe sa bus", "₱ Amount": "₱ Halaga", "Add item, e.g. Buko pie": "Magdagdag, hal. Buko pie",
    "For (optional)": "Para kay (opsyonal)",
    "Ask Tara": "Tanong kay Tara", "Travel helper · works offline": "Katulong sa biyahe · gumagana offline", "Ask about places, routes, fares…": "Magtanong tungkol sa lugar, ruta, pamasahe…",
    "Routes, fares, places & tips — English or Tagalog": "Ruta, pamasahe, lugar at tips — English o Tagalog", "Surprise me": "Sorpresahin mo ako",
    "I've been here": "Nakapunta na ako", "Been here": "Napuntahan na", "Travel badges": "Mga badge sa biyahe", "Unlocked": "Nakuha na",
    "check-ins": "check-in", "towns": "bayan", "provinces": "probinsya", "trips": "biyahe", "Checked in!": "Naka-check in!", "Check-in removed": "Tinanggal ang check-in",
    "See all in Explore": "Tingnan lahat sa Tuklasin", "See place": "Tingnan ang lugar", "Plan a trip": "Magplano ng biyahe", "Plan the full day": "Planuhin ang buong araw", "About this place": "Tungkol sa lugar",
    "Routes, fares, discounts & a day-by-day plan": "Ruta, pamasahe, diskuwento at plano sa bawat araw",
    "Tara, lakad tayo! Where to today?": "Tara, lakad tayo! Saan tayo ngayon?", "Location is off — follow the times shown, and tap the button after each step.": "Patay ang lokasyon — sundin ang oras at i-tap ang button pagkatapos ng bawat hakbang.",
    "Forecast unavailable offline": "Walang forecast kapag offline", "Connect to the internet to check trip-day weather.": "Kumonekta sa internet para makita ang panahon sa araw ng biyahe.",
  };

  // dynamic labels
  var PAT = [
    [/^Your day in (.+)$/, "Ang araw mo sa $1"], [/^Your time in (.+)$/, "Ang oras mo sa $1"],
    [/^Choose how to get to (.+)$/, "Piliin kung paano pumunta sa $1"], [/^Arrive at (.+)$/, "Dating sa $1"],
    [/^More in (.+)$/, "Iba pa sa $1"], [/^Day trips from (.+)$/, "Day trip mula sa $1"], [/^Around (.+)$/, "Paligid ng $1"],
    [/^Popular in (.+)$/, "Sikat sa $1"], [/^Search in (.+)…$/, "Maghanap sa $1…"], [/^(\d+) places?$/, "$1 lugar"],
    [/^(\d+) days$/, "$1 araw"], [/^Day (\d+)(.*)$/, "Araw $1$2"], [/^Upcoming \((\d+)\)$/, "Paparating ($1)"], [/^Past \((\d+)\)$/, "Nakaraan ($1)"],
    [/^Ride a tricycle to (.+)$/, "Sumakay ng traysikel papuntang $1"], [/^Ride a jeepney toward (.+)$/, "Sumakay ng dyip papuntang $1"],
    [/^Ride a jeepney with signboard “(.+)”$/, "Sumakay ng dyip na may karatulang “$1”"], [/^Ride a bus with signboard “(.+)”$/, "Sumakay ng bus na may karatulang “$1”"],
    [/^Walk to (.+)$/, "Maglakad papuntang $1"], [/^Book a Grab car or taxi to (.+)$/, "Mag-book ng Grab o taxi papuntang $1"],
    [/^Take the boat to (.+)$/, "Sumakay ng bangka papuntang $1"], [/^Go to (.+)$/, "Pumunta sa $1"], [/^Lunch at (.+)$/, "Tanghalian sa $1"],
    [/^Next: (.+)$/, "Susunod: $1"], [/^(.+) total$/, "$1 kabuuan"], [/^gets (₱.+)$/, "makakatanggap ng $1"], [/^owes (₱.+)$/, "may utang na $1"],
    [/^(\d+) h (\d+) min free$/, "$1 h $2 min libre"], [/^(\d+) min free$/, "$1 min libre"],
    [/^Leave home (.+) · arrive (.+) · (.+)$/, "Alis $1 · dating $2 · $3"], [/^Starts at (.+) — in (.+)$/, "Magsisimula $1 — sa loob ng $2"],
    [/^(\d+) travelers? · Regular fares$/, "$1 biyahero · Regular na pamasahe"], [/^(\d+) travelers? · Student \/ Senior \/ PWD fares$/, "$1 biyahero · Pamasaheng may diskuwento"],
    [/^Leaves in (.+)$/, "Aalis sa loob ng $1"],
  ];

  function tr(k) {
    if (DICT.hasOwnProperty(k)) return DICT[k];
    // route names like "Tricycle → Jeepney → LRT-1": translate each part that we know
    if (k.indexOf(" → ") > 0) {
      var parts = k.split(" → "), changed = false;
      parts = parts.map(function (x) { if (DICT.hasOwnProperty(x)) { changed = true; return DICT[x]; } return x; });
      if (changed) return parts.join(" → ");
    }
    for (var i = 0; i < PAT.length; i++) if (PAT[i][0].test(k)) return k.replace(PAT[i][0], PAT[i][1]);
    return null;
  }
  function lang() { try { return localStorage.getItem("tara.lang") || "en"; } catch (e) { return "en"; } }

  function apply(root) {
    if (lang() !== "tl" || !root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
    var els = root.querySelectorAll ? root.querySelectorAll("[placeholder]") : [];
    Array.prototype.forEach.call(els, function (e) { var v = tr(e.getAttribute("placeholder")); if (v) e.setAttribute("placeholder", v); });
    if (root.hasAttribute && root.hasAttribute("placeholder")) { var v2 = tr(root.getAttribute("placeholder")); if (v2) root.setAttribute("placeholder", v2); }
  }
  function fixText(n) {
    var p = n.parentElement;
    if (!p || p.closest("script,style,[data-no-i18n],.leaflet-control-attribution")) return;
    var raw = n.nodeValue, k = raw.trim();
    if (!k || k.length > 90) return;
    var v = tr(k);
    if (v && v !== k) n.nodeValue = raw.replace(k, v);
  }

  var observer = null;
  function start() {
    if (lang() !== "tl" || observer || !window.MutationObserver) return;
    document.documentElement.lang = "fil";
    apply(document.body);
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, apply); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  T.i18n = {
    lang: lang,
    t: function (s) { return lang() === "tl" ? (tr(s) || s) : s; },
    set: function (l) { try { localStorage.setItem("tara.lang", l); } catch (e) {} location.reload(); },
    apply: apply,
    start: start,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
