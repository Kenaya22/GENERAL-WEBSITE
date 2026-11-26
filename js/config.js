/* ==========================================================================
   TARA — CENTRAL CONFIG
   Brand, categories, featured places, transit hubs and fare rules.
   Edit this file to change content; no layout code needs to change.

   NOTE: ratings ("guide score"), hours, entrance fees and fares below are
   estimates for planning. Always check posted fare matrices and venue
   notices. Live nearby places come from OpenStreetMap when online.
   ========================================================================== */
window.TARA = window.TARA || {};

TARA.config = {
  brand: {
    name: "Tara",
    tagline: "Your Philippine travel buddy",
    motto: "Tara, lakad tayo.",
  },

  /* Default spot used before the traveler shares a location. */
  defaultLocation: { label: "Calamba, Laguna", lat: 14.2117, lng: 121.1653, approx: true },

  /* Fallback gazetteer used when the address search service is offline:
     typing any text that contains one of these names lands on its center. */
  gazetteer: [
    { key: "calamba", label: "Calamba, Laguna", lat: 14.2117, lng: 121.1653 },
    { key: "los baños", alt: "los banos", label: "Los Baños, Laguna", lat: 14.1691, lng: 121.2414 },
    { key: "cabuyao", label: "Cabuyao, Laguna", lat: 14.2726, lng: 121.1262 },
    { key: "santa rosa", alt: "sta. rosa", label: "Santa Rosa, Laguna", lat: 14.3123, lng: 121.1114 },
    { key: "biñan", alt: "binan", label: "Biñan, Laguna", lat: 14.3346, lng: 121.0832 },
    { key: "san pedro", label: "San Pedro, Laguna", lat: 14.3595, lng: 121.0473 },
    { key: "san pablo", label: "San Pablo, Laguna", lat: 14.0683, lng: 121.3256 },
    { key: "santa cruz", alt: "sta. cruz", label: "Santa Cruz, Laguna", lat: 14.2784, lng: 121.4163 },
    { key: "tagaytay", label: "Tagaytay, Cavite", lat: 14.1153, lng: 120.9621 },
    { key: "intramuros", label: "Intramuros, Manila", lat: 14.5896, lng: 120.9747 },
    { key: "manila", label: "Manila", lat: 14.5995, lng: 120.9842 },
    { key: "makati", label: "Makati", lat: 14.5547, lng: 121.0244 },
    { key: "pasay", label: "Pasay", lat: 14.5378, lng: 121.0014 },
    { key: "taguig", label: "Taguig (BGC)", lat: 14.5509, lng: 121.0503 },
    { key: "quezon city", label: "Quezon City", lat: 14.6760, lng: 121.0437 },
    { key: "alabang", label: "Alabang, Muntinlupa", lat: 14.4231, lng: 121.0436 },
  ],

  categories: [
    { id: "food", label: "Restaurants", short: "Food", icon: "utensils" },
    { id: "cafe", label: "Cafés", short: "Cafés", icon: "coffee" },
    { id: "mall", label: "Malls", short: "Malls", icon: "bag" },
    { id: "park", label: "Parks & Nature", short: "Parks", icon: "tree" },
    { id: "heritage", label: "Heritage Sites", short: "Heritage", icon: "castle" },
    { id: "museum", label: "Museums", short: "Museums", icon: "columns" },
    { id: "church", label: "Churches", short: "Churches", icon: "church" },
    { id: "resort", label: "Hot Springs & Resorts", short: "Resorts", icon: "waves" },
    { id: "theme", label: "Theme Parks", short: "Theme parks", icon: "ferris" },
    { id: "market", label: "Markets & Pasalubong", short: "Pasalubong", icon: "basket" },
  ],

  /* Featured places. hours: [openHH:MM, closeHH:MM], closed: weekday numbers (0=Sun).
     fee: entrance fee in pesos { regular, discounted } (0 = free).
     price: 1–3 for restaurants. visit: suggested minutes. wiki: Wikipedia title for the photo. */
  places: [
    // ---- Calamba & Laguna -------------------------------------------------
    { id: "rizal-shrine", name: "Rizal Shrine", cat: "heritage", area: "Calamba, Laguna", address: "J.P. Rizal St., Brgy. 5, Calamba", lat: 14.2126, lng: 121.1655,
      rating: 4.7, hours: ["08:00", "17:00"], closed: [1], fee: 0, visit: 60, wiki: "Rizal Shrine (Calamba)",
      desc: "The reconstructed ancestral home where José Rizal was born in 1861, with a garden, period rooms and a small museum of his life and works.",
      tips: ["Closed on Mondays", "Free entrance — log in at the guard desk", "Pair it with the church and the Calamba jar across the street"] },
    { id: "calamba-church", name: "St. John the Baptist Parish", cat: "church", area: "Calamba, Laguna", address: "Poblacion, Calamba", lat: 14.2133, lng: 121.1662,
      rating: 4.6, hours: ["06:00", "19:00"], fee: 0, visit: 20, wiki: "St. John the Baptist Parish Church (Calamba)",
      desc: "The church where Rizal was baptized. Its baptismal font is still on display in the side chapel.",
      tips: ["Dress modestly", "Quiet during Mass"] },
    { id: "calamba-jar", name: "Giant Calamba Claypot", cat: "heritage", area: "Calamba, Laguna", address: "Calamba Plaza, Poblacion", lat: 14.2116, lng: 121.1668,
      rating: 4.3, hours: ["00:00", "23:59"], fee: 0, visit: 15,
      desc: "The city's landmark giant clay jar (calamba), engraved with the names of the barangays. A classic photo stop beside the plaza.",
      tips: ["Best photos late afternoon", "Short walk from the Rizal Shrine"] },
    { id: "sm-calamba", name: "SM City Calamba", cat: "mall", area: "Calamba, Laguna", address: "National Highway, Brgy. Real, Calamba", lat: 14.2049, lng: 121.1555,
      rating: 4.4, hours: ["10:00", "21:00"], fee: 0, visit: 120, wiki: "SM City Calamba",
      desc: "The city's main mall with restaurants, a supermarket, cinemas and a transport terminal nearby on the National Highway.",
      tips: ["Buses to Manila stop along the highway outside", "Free Wi-Fi in the atrium"] },
    { id: "calamba-market", name: "Calamba Public Market", cat: "market", area: "Calamba, Laguna", address: "Poblacion, Calamba", lat: 14.2101, lng: 121.1640,
      rating: 4.1, hours: ["05:00", "19:00"], fee: 0, visit: 45, price: 1,
      desc: "Fresh produce, kakanin and Laguna pasalubong like espasol and buko pie, plus quick lomi and pancit stalls.",
      tips: ["Go early for the freshest goods", "Bring small bills"] },
    { id: "pansol", name: "Pansol Hot Spring Resorts", cat: "resort", area: "Calamba, Laguna", address: "Brgy. Pansol, Calamba", lat: 14.1850, lng: 121.1885,
      rating: 4.4, hours: ["08:00", "22:00"], fee: { regular: 300, discounted: 300, note: "day use varies by resort" }, visit: 240,
      desc: "Calamba is the hot-spring capital of the Philippines. Dozens of private and public resorts with warm spring-fed pools line the road in Pansol.",
      tips: ["Weekday rates are cheaper", "Bring your own food — most resorts allow it", "Book private pools ahead on weekends"] },
    { id: "makiling-gardens", name: "Makiling Botanic Gardens", cat: "park", area: "Los Baños, Laguna", address: "UPLB, Los Baños", lat: 14.1588, lng: 121.2375,
      rating: 4.5, hours: ["08:00", "16:00"], fee: { regular: 50, discounted: 30 }, visit: 120, wiki: "Makiling Botanic Gardens",
      desc: "Cool forest trails, giant trees and a creek at the foot of Mount Makiling inside the University of the Philippines Los Baños.",
      tips: ["Wear walking shoes", "Insect repellent helps", "Last entry around 3 PM"] },
    { id: "buko-pie", name: "The Original Buko Pie", cat: "market", area: "Los Baños, Laguna", address: "National Highway, Brgy. Anos, Los Baños", lat: 14.1782, lng: 121.2290,
      rating: 4.6, hours: ["06:00", "21:00"], fee: 0, visit: 25, price: 1, wiki: "Buko pie",
      desc: "The famous pasalubong stop for freshly baked coconut pie. Expect a queue on weekends — it moves fast.",
      tips: ["Buy early in the day before batches sell out", "Keep pies flat on the ride home"] },
    { id: "enchanted-kingdom", name: "Enchanted Kingdom", cat: "theme", area: "Santa Rosa, Laguna", address: "San Lorenzo Rd, Balibago, Santa Rosa", lat: 14.2829, lng: 121.0975,
      rating: 4.6, hours: ["11:00", "21:00"], closed: [1, 2, 3], fee: { regular: 1300, discounted: 1040, note: "regular day pass, approx." }, visit: 360, wiki: "Enchanted Kingdom",
      desc: "The country's first world-class theme park, with roller coasters, the Grand Carousel and a giant Ferris wheel lit up at night.",
      tips: ["Open Thursday to Sunday (more days in summer)", "Arrive at opening for shorter queues", "Stay for the evening lights"] },
    { id: "nuvali", name: "Nuvali Park & Lake", cat: "park", area: "Santa Rosa, Laguna", address: "Nuvali, Santa Rosa", lat: 14.2420, lng: 121.0565, wiki: "Nuvali",
      rating: 4.5, hours: ["06:00", "21:00"], fee: 0, visit: 90,
      desc: "A wide lake park where you can feed koi, bike the trails and watch the sunset, beside Solenad's restaurants.",
      tips: ["Bike rentals nearby", "Feed the fish at the boardwalk", "Great at golden hour"] },
    { id: "solenad", name: "Ayala Malls Solenad", cat: "mall", area: "Santa Rosa, Laguna", address: "Nuvali, Santa Rosa", lat: 14.2408, lng: 121.0583,
      rating: 4.5, hours: ["10:00", "21:00"], fee: 0, visit: 90,
      desc: "An open-air lifestyle mall with restaurants and cafés around landscaped courtyards next to Nuvali Park.",
      tips: ["Lots of al fresco dining", "Parking fills up on weekend evenings"] },

    // ---- Intramuros & Manila ---------------------------------------------
    { id: "intramuros", name: "Intramuros", cat: "heritage", area: "Manila", address: "Intramuros, Manila", lat: 14.5896, lng: 120.9747,
      rating: 4.7, hours: ["00:00", "23:59"], fee: 0, visit: 30, wiki: "Intramuros", hub: true,
      desc: "The 16th-century walled city of Manila — cobblestone streets, Spanish-era churches, forts and museums, all walkable in a day.",
      tips: ["Wear comfy shoes and bring water", "Rent a bamboo bike or kalesa to cover more ground", "Most museums close on Mondays"] },
    { id: "fort-santiago", name: "Fort Santiago", cat: "heritage", area: "Intramuros, Manila", address: "Sta. Clara St., Intramuros", lat: 14.5946, lng: 120.9703,
      rating: 4.7, hours: ["08:00", "21:00"], fee: { regular: 75, discounted: 50 }, visit: 75, wiki: "Fort Santiago",
      desc: "The citadel at the mouth of the Pasig River where Rizal was imprisoned before his execution. Includes the Rizal Shrine museum and the famous footsteps.",
      tips: ["Bring a valid student, senior or PWD ID for the discount", "Walk the walls for river views"] },
    { id: "manila-cathedral", name: "Manila Cathedral", cat: "church", area: "Intramuros, Manila", address: "Plaza de Roma, Intramuros", lat: 14.5916, lng: 120.9733,
      rating: 4.8, hours: ["07:00", "17:00"], fee: 0, visit: 25, wiki: "Manila Cathedral",
      desc: "The grand Romanesque-revival cathedral on Plaza de Roma, rebuilt eight times since 1581, with stunning stained glass.",
      tips: ["No sleeveless tops or shorts inside", "Check the Mass schedule before visiting"] },
    { id: "san-agustin", name: "San Agustin Church & Museum", cat: "church", area: "Intramuros, Manila", address: "General Luna St., Intramuros", lat: 14.5888, lng: 120.9753,
      rating: 4.8, hours: ["08:00", "18:00"], fee: { regular: 200, discounted: 160, note: "museum entry" }, visit: 60, wiki: "San Agustin Church (Manila)",
      desc: "The oldest stone church in the Philippines (1607) and a UNESCO World Heritage Site, with a trompe-l'œil ceiling and a rich museum.",
      tips: ["The museum entrance is beside the church", "Look up at the painted ceiling"] },
    { id: "casa-manila", name: "Casa Manila Museum", cat: "museum", area: "Intramuros, Manila", address: "Plaza San Luis, Intramuros", lat: 14.5887, lng: 120.9757,
      rating: 4.6, hours: ["09:00", "18:00"], closed: [1], fee: { regular: 75, discounted: 50 }, visit: 45, wiki: "Casa Manila",
      desc: "A reconstructed 19th-century bahay na bato showing how a wealthy Manila family lived during the Spanish era.",
      tips: ["Closed on Mondays", "Right across San Agustin Church"] },
    { id: "baluarte", name: "Baluarte de San Diego", cat: "heritage", area: "Intramuros, Manila", address: "Sta. Lucia St., Intramuros", lat: 14.5869, lng: 120.9725,
      rating: 4.5, hours: ["08:00", "17:00"], closed: [1], fee: { regular: 75, discounted: 50 }, visit: 30, wiki: "Baluarte de San Diego",
      desc: "An ace-of-spades shaped bastion with garden ruins — one of the oldest stone fortifications in Intramuros.",
      tips: ["Quiet and shaded — good rest stop", "Great photo spot from the ramparts"] },
    { id: "bambike", name: "Bambike Ecotours", cat: "heritage", area: "Intramuros, Manila", address: "Plaza San Luis, Intramuros", lat: 14.5891, lng: 120.9750,
      rating: 4.7, hours: ["09:00", "18:00"], fee: { regular: 1200, discounted: 1200, note: "guided bike tour, approx." }, visit: 90,
      desc: "Guided tours of Intramuros on handmade bamboo bicycles — a fun way to see the walls, plazas and churches in two hours.",
      tips: ["Book ahead online on weekends", "Helmets and water included"] },
    { id: "barbaras", name: "Barbara's Heritage Restaurant", cat: "food", area: "Intramuros, Manila", address: "Plaza San Luis, Intramuros", lat: 14.5886, lng: 120.9755,
      rating: 4.5, hours: ["11:00", "21:00"], fee: 0, visit: 75, price: 3,
      desc: "Filipino-Spanish cuisine in a candle-lit colonial dining room, known for its lunch buffet and evening cultural show.",
      tips: ["Reserve for the dinner show", "Lunch buffet is the best value"] },
    { id: "ilustrado", name: "Ilustrado Restaurant", cat: "food", area: "Intramuros, Manila", address: "General Luna St., Intramuros", lat: 14.5881, lng: 120.9740,
      rating: 4.4, hours: ["11:00", "21:00"], fee: 0, visit: 75, price: 3,
      desc: "Old-Manila fine dining in a restored colonial house. Try the paella and the sampaguita ice cream.",
      tips: ["Smart-casual dress", "Quieter on weekdays"] },
    { id: "rizal-park", name: "Rizal Park (Luneta)", cat: "park", area: "Ermita, Manila", address: "Roxas Blvd., Ermita", lat: 14.5826, lng: 120.9787,
      rating: 4.5, hours: ["05:00", "23:00"], fee: 0, visit: 45, wiki: "Rizal Park",
      desc: "Manila's great urban park and the site of the Rizal Monument, with gardens, the dancing fountain and wide lawns.",
      tips: ["The dancing fountain show runs in the evening", "Shaded paths around the Chinese and Japanese gardens"] },
    { id: "nm-fine-arts", name: "National Museum of Fine Arts", cat: "museum", area: "Ermita, Manila", address: "Padre Burgos Ave., Ermita", lat: 14.5868, lng: 120.9810,
      rating: 4.8, hours: ["09:00", "18:00"], closed: [1], fee: 0, visit: 90, wiki: "National Museum of Fine Arts (Manila)",
      desc: "Home of Juan Luna's Spoliarium and the country's finest collection of Filipino art — and it's free.",
      tips: ["Free entrance, closed Mondays", "Deposit large bags at the entrance"] },
    { id: "nm-anthropology", name: "National Museum of Anthropology", cat: "museum", area: "Ermita, Manila", address: "Agrifina Circle, Ermita", lat: 14.5838, lng: 120.9817,
      rating: 4.7, hours: ["09:00", "18:00"], closed: [1], fee: 0, visit: 75, wiki: "National Museum of Anthropology (Manila)",
      desc: "Pre-colonial treasures, the Manunggul Jar and the San Diego shipwreck finds, across from the Fine Arts building.",
      tips: ["Free entrance, closed Mondays"] },
    { id: "binondo-church", name: "Binondo Church", cat: "church", area: "Binondo, Manila", address: "Plaza Lorenzo Ruiz, Binondo", lat: 14.5999, lng: 120.9743,
      rating: 4.6, hours: ["06:00", "20:00"], fee: 0, visit: 20, wiki: "Binondo Church",
      desc: "The Minor Basilica of San Lorenzo Ruiz, with an octagonal bell tower, at the heart of the world's oldest Chinatown.",
      tips: ["Start your Binondo food crawl here"] },
    { id: "binondo-food", name: "Binondo Food Crawl (Ongpin)", cat: "food", area: "Binondo, Manila", address: "Ongpin St., Binondo", lat: 14.6005, lng: 120.9760,
      rating: 4.6, hours: ["08:00", "20:00"], fee: 0, visit: 90, price: 1, wiki: "Binondo",
      desc: "Dumplings, hopia, fried siopao and kiampong along Ongpin Street — the classic Chinatown eat-all-you-can walk.",
      tips: ["Go hungry and share plates", "Bring cash — many stalls don't take cards"] },
    { id: "quiapo-church", name: "Quiapo Church", cat: "church", area: "Quiapo, Manila", address: "Plaza Miranda, Quiapo", lat: 14.5989, lng: 120.9838,
      rating: 4.6, hours: ["05:00", "21:00"], fee: 0, visit: 25, wiki: "Quiapo Church",
      desc: "Home of the Black Nazarene, surrounded by the lively Quiapo market streets.",
      tips: ["Very crowded on Fridays", "Keep valuables in front"] },
    { id: "ocean-park", name: "Manila Ocean Park", cat: "theme", area: "Ermita, Manila", address: "Behind Quirino Grandstand, Luneta", lat: 14.5791, lng: 120.9723,
      rating: 4.3, hours: ["10:00", "18:00"], fee: { regular: 1000, discounted: 800, note: "approx. package" }, visit: 150, wiki: "Manila Ocean Park",
      desc: "An oceanarium with an underwater tunnel, sea-lion shows and the bayside Jellies exhibit.",
      tips: ["Good rainy-day option", "Combine with Rizal Park"] },
    { id: "sm-moa", name: "SM Mall of Asia", cat: "mall", area: "Pasay", address: "Seaside Blvd., Pasay", lat: 14.5350, lng: 120.9822,
      rating: 4.6, hours: ["10:00", "22:00"], fee: 0, visit: 150, wiki: "SM Mall of Asia",
      desc: "One of the biggest malls in Asia, with a bayside promenade, the MOA Eye Ferris wheel and sunset views over Manila Bay.",
      tips: ["Stay for the Manila Bay sunset", "PITX and LRT-1 are a short ride away"] },
  ],

  /* "Day trips" featured on the home screen */
  dayTrips: ["intramuros", "enchanted-kingdom", "makiling-gardens", "nuvali", "rizal-park", "sm-moa"],

  /* ----- Transit network (simplified) ----- */
  transit: {
    // Metro Manila bounding box (rough) — used to decide inter-provincial trips
    metro: { minLat: 14.38, maxLat: 14.78, minLng: 120.90, maxLng: 121.14 },

    // Where to catch buses to Metro Manila from the south
    provincialStops: [
      { id: "calamba", name: "Calamba Crossing bus stop", lat: 14.2073, lng: 121.1565, area: "Calamba",
        how: "Wait along the National Highway near SM City Calamba / Calamba Crossing." },
      { id: "losbanos", name: "Los Baños Crossing bus stop", lat: 14.1795, lng: 121.2366, area: "Los Baños",
        how: "Buses to Manila pass along the National Highway at Crossing." },
      { id: "cabuyao", name: "Cabuyao (Banlic) bus stop", lat: 14.2668, lng: 121.1283, area: "Cabuyao",
        how: "Flag Manila-bound buses along the National Highway." },
      { id: "starosa", name: "Balibago Complex terminal", lat: 14.2914, lng: 121.1063, area: "Santa Rosa",
        how: "Jeeps, vans and buses leave from the Balibago Complex terminal." },
      { id: "binan", name: "Biñan (Pavilion Mall) bus stop", lat: 14.3320, lng: 121.0820, area: "Biñan",
        how: "Catch buses at the SLEX side of Pavilion Mall." },
    ],

    // Metro Manila bus terminals reached from Laguna via SLEX
    metroTerminals: [
      { id: "lawton", name: "Lawton (Liwasang Bonifacio)", sign: "LAWTON", lat: 14.5934, lng: 120.9806 },
      { id: "buendia", name: "Buendia / Gil Puyat terminals", sign: "BUENDIA", lat: 14.5547, lng: 120.9981, station: "Gil Puyat" },
      { id: "pitx", name: "PITX terminal", sign: "PITX", lat: 14.5097, lng: 120.9914, station: "PITX" },
      { id: "alabang", name: "Alabang (Starmall) terminal", sign: "ALABANG", lat: 14.4183, lng: 121.0450 },
    ],

    // LRT-1 stations in line order (north → south)
    lrt1: [
      ["FPJ (Roosevelt)", 14.6575, 121.0213], ["Balintawak", 14.6575, 121.0040], ["Monumento", 14.6543, 120.9839],
      ["5th Avenue", 14.6444, 120.9835], ["R. Papa", 14.6360, 120.9822], ["Abad Santos", 14.6305, 120.9813],
      ["Blumentritt", 14.6226, 120.9829], ["Tayuman", 14.6166, 120.9827], ["Bambang", 14.6112, 120.9824],
      ["Doroteo Jose", 14.6055, 120.9820], ["Carriedo", 14.5992, 120.9813], ["Central Terminal", 14.5928, 120.9817],
      ["United Nations", 14.5826, 120.9846], ["Pedro Gil", 14.5765, 120.9881], ["Quirino", 14.5703, 120.9916],
      ["Vito Cruz", 14.5631, 120.9948], ["Gil Puyat", 14.5543, 120.9971], ["Libertad", 14.5477, 120.9985],
      ["EDSA", 14.5386, 121.0006], ["Baclaran", 14.5343, 120.9983], ["Redemptorist–Aseana", 14.5272, 120.9927],
      ["MIA Road", 14.5197, 120.9925], ["PITX", 14.5100, 120.9916], ["Ninoy Aquino Avenue", 14.4979, 120.9938],
      ["Dr. Santos", 14.4855, 120.9905],
    ],
  },

  /* ----- Fares (estimates) -----
     base: minimum fare covering baseKm; perKm after that.
     speed: average km/h incl. traffic; wait: typical wait in minutes.
     discount: which discount rule applies ("road", "rail" or none). */
  fares: {
    walk: { label: "Walk", speed: 4.5 },
    tricycle: { label: "Tricycle", base: 20, baseKm: 1, perKm: 10, speed: 18, wait: 4, discount: "road" },
    jeep: { label: "Jeepney", base: 13, baseKm: 4, perKm: 1.8, speed: 14, wait: 6, discount: "road" },
    bus: { label: "Provincial bus (aircon)", base: 15, baseKm: 5, perKm: 2.25, speed: 30, wait: 12, discount: "road" },
    lrt: { label: "LRT-1", boarding: 16.25, perKm: 1.47, min: 20, max: 55, speed: 32, wait: 5, discount: "rail" },
    grab: { label: "Grab / taxi", base: 45, perKm: 15, perMin: 2, speed: 24, wait: 8 },
    car: { label: "Own car", kmPerLiter: 11, fuelPrice: 62, speed: 32 },
    roadFactor: 1.3, // straight-line → road distance
  },

  /* Fare discounts by traveler type (RA 11314 students, RA 9994 seniors, RA 10754 PWD).
     LRT/MRT currently give 50% to these groups. */
  travelerTypes: [
    { id: "regular", label: "Regular", road: 0, rail: 0, entry: false },
    { id: "student", label: "Student", road: 0.2, rail: 0.5, entry: true, id_name: "school ID" },
    { id: "senior", label: "Senior citizen", road: 0.2, rail: 0.5, entry: true, id_name: "senior citizen ID" },
    { id: "pwd", label: "PWD", road: 0.2, rail: 0.5, entry: true, id_name: "PWD ID" },
  ],

  /* Peak hours (weekdays) — road legs get slower */
  rushHours: [[6.5, 9.5], [16.5, 20]],
  rushFactor: 1.4,

  mealBudget: { 1: 180, 2: 400, 3: 900 }, // per person
};
