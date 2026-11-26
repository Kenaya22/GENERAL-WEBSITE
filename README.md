# Tara — Philippine Travel Guide

**Tara** ("let's go") is a travel guide web app that installs on phones and computers like a native app (PWA) and keeps working offline.

## Features

- **Sign up / log in**: name, email, password and an optional fare discount (Regular by default, or one shared Student / Senior / PWD option). Guest mode is available too.
- **Your location**: use the phone's GPS, or type an address such as *Brgy. Lecheria, Calamba, Laguna*.
- **Explore**: restaurants, cafés, malls, parks, heritage sites, museums, churches, hot springs and resorts, theme parks, and pasalubong spots.
  - Each place shows ratings, photos, distance, open/closed status, hours, entrance fees (with your discount), tips, a map and reviews.
  - List and map views, filters, search, and sorting by nearest or top rated.
- **Trip planner**: for example *Calamba → Intramuros*.
  - Set the date, departure time, number of travelers, return trip and "head home by" time.
  - You get the cheapest, fewest-transfer, Grab/taxi and own-car options.
  - Every step says what to ride, where to board, the signboard to look for, the fare and the time.
  - Discounts apply automatically: 20% off jeepney, tricycle and bus, and 50% off LRT for students, seniors and PWD.
  - Rush hours add extra travel time.
  - A **day itinerary** at the destination puts things to do in order, checks opening hours, adds a lunch stop, and lets you tap places to add or remove them.
  - It also plans the ride home and gives a **budget** (fares, entrance fees, food) and **reminders** (bring your ID, prepare coins, rain alert, when to leave).
- **Trips**: save plans, tick off steps as you go, turn on reminders, **download a calendar file** with alarms, share the itinerary, or open it in Google Maps.
- **Profile**: traveler type, home and current location, saved places, dark mode, notifications, install the app, log out, and delete your data.

### New in version 3
- **Launch screens.** A loading screen, then the **K & A Studios** creator page, then the app (tap to skip; shown once per visit). There's also an About page made by K & A Studios.
- **Multi-day trips.** Pick *Day tour* or *Multi-day* (2–7 days). Each day has its own schedule with new places (no repeats), one lunch, and an overnight stay near where the day ends: Budget, Mid-range or Comfort, added to the budget. The last day ends with the trip home.
- **Stopovers.** Tap **Add a stop** to chain destinations, e.g. Home → Intramuros → National Museum → Home. Stops can be moved up or down. The day's time is shared between stops, with the ride between each pair planned, and stops are spread over the days of a multi-day trip.
- **Arrange your places.** **Edit places** lets you tick places and put them in your own order with up/down arrows; the planner follows that order.
- **Clearer labels.** "Leave home at", "Leave home", "Arrive at …", "Arrive home", and a **Get off at …** line for every ride. Bus and jeepney signs say where they go, e.g. *Ride a bus going to Santa Rosa — signboard says "BALIBAGO / STA. ROSA"*. Liliw and Nagcarlan now route via San Pablo.
- **Choosing a route** jumps straight to your itinerary below.
- **Prices** are whole pesos (no ₱29.75) and food estimates are more realistic.
- **One discount option.** Student, senior and PWD share the same discount, so it's one optional choice. Regular is the default.
- **Livelier home.** Animated hero, quick buttons (Day trip, Weekend getaway, Food trip, Café hopping), a featured-trips slideshow, trip ideas, a café section, and new colourful icons.
- **More places and photos.** Cafés, restaurants and a Rizal monument in Calamba, more Wikipedia photos, and Explore now loads live cafés, restaurants and shops for **any** city you pick (not only where you are).
- **Better sharing.** The shared itinerary has icons, spacing and a section per day, with a preview before you share or copy it.
- **Reviews you can edit.** Write a comment with up to 3 photos, then edit or delete your own review later.
- **Profile photo.** Tap your picture in Profile to upload one; it also shows on your reviews.

### Earlier
- **Destinations (Klook-style).** Choose a city or a whole province (Laguna, Metro Manila, Cavite, Batangas, Rizal, Quezon; 22 cities and towns, 63 featured places). Explore only shows places in the destination you picked, and each city has a guide page with top things to do, where to eat, pasalubong, a map and "Plan a day here".
- **Fuller day plans.** "Leave for home at" is your real departure time, and the day fills with the best spots until then. A meter says **Too many stops** (and names the ones that won't fit), **Just right**, or **Free time left** (with suggestions). **Edit stops** lists every place in the area with duration, fee and hours.
- **Live trip mode.** Follow your trip step by step. GPS shows the distance to your next stop and alerts you when it's time to get off. It also tells you if you're running late, suggests what to skip, and can keep the screen on.
- **More transit.** LRT-1, LRT-2 and MRT-3 with transfers. More bus terminals (Cubao, San Pablo, Sta. Cruz, Tagaytay, Batangas, Lipa, Lemery). Common provincial routes such as Calamba → Sta. Rosa → Tagaytay by jeepney.

## Where the data comes from

| Feature | Source | Needs internet |
| --- | --- | --- |
| Featured places, fares, transit hubs, LRT-1 stations | `js/config.js` (edit freely) | No |
| Live places near you | OpenStreetMap (Overpass API) | Yes; cached for 24 h |
| Address search and "where am I" | OpenStreetMap Nominatim | Yes; offline it falls back to the nearest town |
| Place photos | Wikipedia | Yes; cached |
| Weather and rain alerts | Open-Meteo | Yes; cached for 1 h |
| Maps | Leaflet (bundled in `vendor/`) and OpenStreetMap tiles | Tiles need internet |

All of these are free and need no API keys.

**Accounts, trips, reviews, photos and saved places are stored on the visitor's own device.** Reviews are visible to everyone who uses Tara on that same device or browser; to let travelers on other phones see each other's reviews, connect a backend. To sync between devices later, connect a free backend such as Firebase or Supabase in `js/services.js` (`T.auth` and `T.data`).

> Guide scores, hours, entrance fees and fares in `config.js` are estimates for planning. Update them as prices change.

## Files

```
index.html            app shell and icon set
css/tokens.css        design tokens: colors, fonts, spacing, radii, motion
css/app.css           all components and layouts
js/config.js          destinations (province → city), places, rail lines, terminals, routes, fares, discounts
js/core.js            helpers, router, toasts, sheets, place artwork
js/services.js        accounts, location, places, photos, weather
js/planner.js         route, fare and itinerary engine, reminders, calendar export
js/views.js           screens: welcome, sign-up, home, explore, place, plan, trips, profile, about
js/main.js            startup, navigation, reminders, install, offline
sw.js                 offline caching (bump VERSION after each change)
manifest.webmanifest  install settings (name, icons, colors)
```

## Customize

- **Add a place**: copy an entry in `places` in `js/config.js`. Set `wiki` to a Wikipedia title for an automatic photo.
- **Change fares**: edit `fares` and `travelerTypes` in `js/config.js`.
- **Add bus stops or terminals**: edit `transit.provincialStops` and `transit.metroTerminals`.
- **Rebrand**: edit `css/tokens.css`, `manifest.webmanifest` and `icons/`.
- After publishing changes, bump `VERSION` in `sw.js`.

## Run locally

```
python3 -m http.server 8080
# open http://localhost:8080
```

## Publish free on GitHub Pages

1. On GitHub, open the repository → **Settings → Pages** → *Source*: **GitHub Actions**.
2. Push, or run **Actions → Deploy to GitHub Pages**.
3. Open `https://<username>.github.io/<repo>/` on your phone and tap **Install app**.

GPS location only works over HTTPS, which GitHub Pages provides.

To publish on Google Play later, paste the live link into [PWABuilder](https://www.pwabuilder.com) to generate an Android package.
