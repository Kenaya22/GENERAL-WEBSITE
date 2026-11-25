/* ==========================================================================
   CENTRAL CONTENT CONFIG
   Everything visitors read lives here. Change titles, categories, cards,
   lists, reviews and contact details without touching layout code.

   Artwork: every "art" object draws an illustration in code (no image files
   needed, works offline). scene: "road" | "mountain" | "city" | "coast" | "dial"
   hue: 0–360 color tint. To use a real photo instead, add  image: "img/your-photo.jpg"
   ========================================================================== */

window.SITE = {
  brand: {
    name: "Hari ng Kalsada",
    short: "Hari",
    tagline: "King of the Road",
    est: "Est. 2026 · Manila",
    phone: "+63 900 000 0000",
    email: "hello@yourdomain.ph",
    address: "Daan ng Hari, Metro Manila, Philippines",
  },

  /* Forms: leave empty to keep submissions on the visitor's device (free, no
     backend). Paste a free Formspree / Getform endpoint URL to receive them. */
  forms: { endpoint: "" },

  nav: [
    { label: "Explore", href: "#explore" },
    { label: "Routes", href: "#routes" },
    { label: "Our Story", href: "#story" },
    { label: "Reviews", href: "#proof" },
  ],

  hero: {
    eyebrow: "Ang Hari ng Kalsada",
    title: "Rule the <em>open road.</em>",
    lead:
      "Rides, routes, garages and gear for everyone who keeps the islands moving — from the first jeepney at dawn to the last ride home.",
    primary: { label: "Explore the hub", href: "#explore" },
    secondary: { label: "Install the app", action: "install" },
    featured: {
      label: "Route of the week",
      itemId: "kennon-road",
    },
  },

  intro: {
    eyebrow: "An open-road experience",
    title: "Every kilometre, <em>crowned.</em>",
    caption: "Est. 2026 · Para sa lahat ng nasa kalsada",
    art: { scene: "road", hue: 352, seed: 7 },
  },

  categories: ["All", "Rides", "Routes", "Garage", "Gear"],

  items: [
    {
      id: "kennon-road",
      category: "Routes",
      title: "Kennon Road Ascent",
      subtitle: "Pines, switchbacks & the Lion's Head",
      meta: ["Benguet", "33 km", "Half day"],
      rating: 4.9,
      description:
        "The classic climb to Baguio. Thirty-three kilometres of river gorge, waterfalls and hairpin bends that reward an early start and a steady hand.",
      highlights: ["Best before 8 AM for clear views", "Stop at Lion's Head viewpoint", "Check road advisories in rainy season"],
      art: { scene: "mountain", hue: 350, seed: 11 },
    },
    {
      id: "jeepney-hari",
      category: "Rides",
      title: "Ang Jeepney Hari",
      subtitle: "A hand-painted stainless legend",
      meta: ["Quezon City", "Restored", "22 seats"],
      rating: 5.0,
      description:
        "A fully restored long-body jeepney with chrome horses, hand-lettered panels and a rebuilt diesel heart. Available for photo walks and private city tours.",
      highlights: ["Original 1980s body panels", "Private city tours on weekends", "Photo walks at golden hour"],
      art: { scene: "city", hue: 8, seed: 21 },
    },
    {
      id: "patapat",
      category: "Routes",
      title: "Patapat Viaduct Run",
      subtitle: "A ribbon of road above the sea",
      meta: ["Ilocos Norte", "1.3 km bridge", "Full day"],
      rating: 4.8,
      description:
        "Hugging the cliffs of Pagudpud, the viaduct floats above the West Philippine Sea. Combine it with the Bangui windmills for a perfect coastal loop.",
      highlights: ["Sunrise over the coast", "Bangui windmills nearby", "Blue Lagoon swim stop"],
      art: { scene: "coast", hue: 205, seed: 3 },
    },
    {
      id: "cafe-racer",
      category: "Rides",
      title: "Café Racer 400",
      subtitle: "Clip-ons, tank, and attitude",
      meta: ["Marikina", "Custom build", "400 cc"],
      rating: 4.7,
      description:
        "A lightweight custom café racer built in a Marikina workshop — clip-on bars, a hand-stitched seat and an exhaust note that turns heads on every corner.",
      highlights: ["Hand-stitched leather seat", "Rebuilt carburettor", "Test rides by appointment"],
      art: { scene: "dial", hue: 18, seed: 9 },
    },
    {
      id: "pre-trip",
      category: "Garage",
      title: "Pre-Trip Checkup",
      subtitle: "Thirty points before the long drive",
      meta: ["All vehicles", "45 min", "From ₱650"],
      rating: 4.9,
      description:
        "Brakes, fluids, tyres, lights and belts — a quick, honest inspection before your province trip, with a printed checklist you can keep in the glovebox.",
      highlights: ["30-point inspection", "Printed checklist", "Walk-ins welcome"],
      art: { scene: "dial", hue: 40, seed: 14 },
    },
    {
      id: "marcos-highway",
      category: "Routes",
      title: "Marcos Highway Sunrise",
      subtitle: "Above the clouds before breakfast",
      meta: ["Rizal → Baguio", "Sea of clouds", "Dawn"],
      rating: 4.8,
      description:
        "A wide, sweeping mountain highway with some of the most reliable sea-of-clouds views on Luzon. Bring a jacket — the mornings are cold up top.",
      highlights: ["Sea of clouds at dawn", "Wide shoulders for photo stops", "Strawberry farms nearby"],
      art: { scene: "mountain", hue: 22, seed: 5 },
    },
    {
      id: "detail-session",
      category: "Garage",
      title: "Full Detail Session",
      subtitle: "Showroom shine, inside and out",
      meta: ["Pasig", "4 hours", "From ₱2,400"],
      rating: 4.8,
      description:
        "Clay bar, polish, ceramic sealant and a deep interior clean. Your ride leaves looking better than the day it rolled off the line.",
      highlights: ["Ceramic sealant", "Interior deep clean", "Free pickup within 5 km"],
      art: { scene: "city", hue: 340, seed: 33 },
    },
    {
      id: "night-lights",
      category: "Gear",
      title: "Night Ride Light Kit",
      subtitle: "See and be seen after dark",
      meta: ["Motorcycles", "LED", "₱1,850"],
      rating: 4.6,
      description:
        "Auxiliary LED pods, a reflective vest and a helmet strobe — everything you need to ride the provincial highways safely at night.",
      highlights: ["Plug-and-play wiring", "Weatherproof IP67", "Reflective vest included"],
      art: { scene: "road", hue: 30, seed: 41 },
    },
    {
      id: "quezon-loop",
      category: "Routes",
      title: "Bitukang Manok Loop",
      subtitle: "The famous zig-zag of Quezon",
      meta: ["Quezon", "48 km", "Half day"],
      rating: 4.7,
      description:
        "The serpentine road through Quezon National Park — dense rainforest canopy, mossy rock walls and more bends than you can count.",
      highlights: ["Rainforest canopy", "Mind the blind curves", "Pancit habhab stop in Lucban"],
      art: { scene: "road", hue: 140, seed: 17 },
    },
    {
      id: "road-atlas",
      category: "Gear",
      title: "Road Atlas Vol. 1",
      subtitle: "Luzon's best drives, mapped",
      meta: ["Book", "120 pages", "₱950"],
      rating: 4.9,
      description:
        "A printed atlas of forty hand-picked drives with elevation profiles, fuel stops and the best roadside eats along every route.",
      highlights: ["40 curated routes", "Fuel & food stops", "Fits in a glovebox"],
      art: { scene: "coast", hue: 30, seed: 29 },
    },
    {
      id: "wrench-club",
      category: "Garage",
      title: "Weekend Wrench Club",
      subtitle: "Learn to fix your own ride",
      meta: ["Makati", "Saturdays", "Free"],
      rating: 5.0,
      description:
        "A friendly community workshop. Bring your bike or car, borrow the tools and learn oil changes, brake pads and chain care from volunteer mechanics.",
      highlights: ["Tools provided", "Beginner friendly", "Coffee on the house"],
      art: { scene: "city", hue: 28, seed: 52 },
    },
    {
      id: "crown-jacket",
      category: "Gear",
      title: "Crown Riding Jacket",
      subtitle: "Armoured, ventilated, tropical",
      meta: ["Apparel", "CE armour", "₱6,500"],
      rating: 4.7,
      description:
        "Mesh panels for the heat, CE-rated armour for the road, and the gold crown stitched on the back. Built for Philippine weather.",
      highlights: ["Mesh ventilation", "CE level 2 armour", "Rain liner included"],
      art: { scene: "road", hue: 352, seed: 63 },
    },
  ],

  showcase: {
    eyebrow: "Plan your ride",
    title: "Explore Our Routes",
    aside: "Sample itineraries",
    tabs: [
      {
        label: "Day Ride",
        note: "Back by sunset",
        items: [
          { name: "Tagaytay Ridge", detail: "Taal views · Bulalo stop · 60 km from Manila", aside: "2 h", art: { scene: "mountain", hue: 15, seed: 71 } },
          { name: "Antipolo Hills", detail: "Cathedral · Hinulugang Taktak · Cafés", aside: "1 h", art: { scene: "road", hue: 30, seed: 72 } },
          { name: "Bataan Coastal", detail: "Mt. Samat · Seaside road · Heritage town", aside: "3 h", art: { scene: "coast", hue: 200, seed: 73 } },
        ],
      },
      {
        label: "Night Run",
        note: "City lights & late eats",
        items: [
          { name: "EDSA to Roxas Blvd", detail: "Skyline · Manila Bay sunset · Street food", aside: "45 m", art: { scene: "city", hue: 350, seed: 81 } },
          { name: "BGC Loop", detail: "Neon streets · Night market · Coffee", aside: "30 m", art: { scene: "city", hue: 30, seed: 82 } },
          { name: "Skyway Cruise", detail: "Elevated highway · City panorama", aside: "40 m", art: { scene: "road", hue: 345, seed: 83 } },
        ],
      },
      {
        label: "Weekend Tour",
        note: "Two days, one crown",
        items: [
          { name: "Baguio via Kennon", detail: "Pines · Session Road · Strawberry farms", aside: "2 d", art: { scene: "mountain", hue: 350, seed: 91 } },
          { name: "Ilocos Heritage", detail: "Vigan · Paoay · Patapat Viaduct", aside: "3 d", art: { scene: "coast", hue: 25, seed: 92 } },
          { name: "Quezon Zig-Zag", detail: "Bitukang Manok · Lucban · Kamay ni Hesus", aside: "2 d", art: { scene: "road", hue: 140, seed: 93 } },
        ],
      },
    ],
  },

  story: {
    eyebrow: "Our story",
    // <em> words render as italic gold script over the caps.
    text:
      "Our story began on a jeepney route with a simple vision: to <em>celebrate</em> everyone who keeps the islands moving — drivers, riders and road trippers — and give the <em>kalsada</em> the crown it deserves.",
    art: { scene: "city", hue: 352, seed: 101 },
  },

  proof: {
    eyebrow: "Sabi ng mga hari",
    metric: { value: 1134, label: "Five-star road trips shared by our community" },
    stats: [
      { value: 86, suffix: "+", label: "Routes mapped" },
      { value: 17, suffix: "", label: "Regions covered" },
      { value: 24, suffix: "/7", label: "Roadside tips" },
    ],
    // Sample reviews — replace with your own.
    reviews: [
      { name: "Mang Ernie", role: "Jeepney driver · Quezon City", quote: "Twenty years on the road and this is the first place that treats us drivers like royalty.", rating: 5 },
      { name: "Bea S.", role: "Weekend rider · Pasig", quote: "The Kennon Road guide was spot-on. Left at six, coffee at the top by nine.", rating: 5 },
      { name: "Paolo R.", role: "Road tripper · Cebu", quote: "Installed the app on my phone — the saved routes worked even with no signal in the mountains.", rating: 5 },
      { name: "Joy & Marco", role: "Couple on tour · Ilocos", quote: "Patapat at sunrise. We still talk about it. Salamat, Hari ng Kalsada!", rating: 5 },
      { name: "Tito Ben", role: "Wrench Club regular · Makati", quote: "Learned to change my own brake pads in one Saturday. Free coffee too.", rating: 4 },
    ],
  },

  reserve: {
    eyebrow: "Join the ride",
    title: "Sumakay.",
    lead:
      "Book a route, a garage slot or a jeepney tour — or just ask a question. We reply within a day, usually faster.",
    primary: "Send a request",
    faqs: [
      { q: "How do I install the app?", a: "Tap “Install App” at the top (or “App” in the bottom bar). On iPhone, open the Share menu in Safari and choose “Add to Home Screen”. It takes no storage space to speak of and opens like a native app." },
      { q: "Does it work without signal?", a: "Yes. After your first visit, the app and your saved items are stored on your device, so you can open them in the mountains with no reception." },
      { q: "Is it free?", a: "Browsing, saving and installing are completely free. Garage services and gear have their own prices listed on each card." },
      { q: "Where is my saved list kept?", a: "On your own device, privately. Nothing is uploaded and you don't need an account." },
    ],
  },

  closing: {
    title: "See you on the <em>road.</em>",
    cta: "Plan a ride",
    art: { scene: "road", hue: 348, seed: 120 },
  },

  footer: {
    blurb: "A home for everyone on the Philippine road — rides, routes, garages and gear, in one installable app.",
    columns: [
      { title: "Explore", links: [["Rides", "#explore", "Rides"], ["Routes", "#explore", "Routes"], ["Garage", "#explore", "Garage"], ["Gear", "#explore", "Gear"]] },
      { title: "Company", links: [["Our story", "#story"], ["Reviews", "#proof"], ["Contact", "#reserve"]] },
    ],
  },
};
