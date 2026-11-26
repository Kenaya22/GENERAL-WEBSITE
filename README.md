# Tara — Philippine Travel Guide

**Tara** ("let's go") is a travel guide web app that installs on phones and computers like a native app (PWA) and keeps working offline.

## Features

- **Sign up / log in**: name, email, password and traveler type (Regular, Student, Senior, PWD). Guest mode is available too.
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

**Accounts, trips, reviews and saved places are stored on the visitor's own device.** To sync between devices later, connect a free backend such as Firebase or Supabase in `js/services.js` (`T.auth` and `T.data`).

> Guide scores, hours, entrance fees and fares in `config.js` are estimates for planning. Update them as prices change.

## Files

```
index.html            app shell and icon set
css/tokens.css        design tokens: colors, fonts, spacing, radii, motion
css/app.css           all components and layouts
js/config.js          places, categories, transit hubs, fares, discounts
js/core.js            helpers, router, toasts, sheets, place artwork
js/services.js        accounts, location, places, photos, weather
js/planner.js         route, fare and itinerary engine, reminders, calendar export
js/views.js           screens: welcome, sign-up, home, explore, place, plan, trips, profile
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
