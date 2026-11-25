# Hari ng Kalsada — King of the Road

A general-purpose website that is also an **installable app** (PWA). It opens from a link on any phone or computer, can be installed to the home screen or desktop, and keeps working offline.

Built from the *General-Purpose Web & Installable App Blueprint*. The look follows an editorial style: burgundy and cream bands, Didone serif headlines, and small-caps navigation.

## What's inside

| Blueprint zone | Where it is |
| --- | --- |
| Top app bar: brand, search, light/dark toggle, **Install App** | `<header class="appbar">` |
| Hero: headline, two actions, featured preview | `#home` |
| Interactive hub: filter tabs, cards, heart-to-save | `#explore` |
| Split showcase: media panel and interactive list | `#routes` |
| Proof and highlights: count-up metric, swipeable review deck | `#proof` |
| Modal / slide-over sheet: details, inquiry form, saved list, search, install guide | `#sheet` |
| Mobile bottom bar (Home · Explore · Saved · Get App) and desktop footer | `.bottombar`, `.footer` |

Extras: scroll-reveal motion, animated toasts, an online/offline indicator, shareable item links (`?item=kennon-road`), keyboard search (`/` or `Ctrl/Cmd + K`), reduced-motion support, and safe-area support for notched phones.

## File map

```
index.html            page structure (zones)
css/tokens.css        DESIGN TOKENS: colors, fonts, spacing, radii, motion. Rebrand here.
css/styles.css        layout and components
js/content.js         ALL CONTENT: titles, categories, cards, routes, reviews, FAQs, contact
js/app.js             rendering, interactions, install, offline
manifest.webmanifest  app name, icons, colors (what the installed app looks like)
sw.js                 offline caching (bump VERSION after each change)
icons/                app icons and install screenshots
```

## Customize

1. **Content**: edit `js/content.js`. Every card's `art` draws an illustration in code. To use a real photo instead, add `image: "img/photo.jpg"` to its `art`.
2. **Look**: edit `css/tokens.css` (colors, font pairing, spacing, radii, motion).
3. **Name and icon**: update `manifest.webmanifest`, the `<title>` and meta tags in `index.html`, and the files in `icons/`.
4. **Receive form submissions**: paste a free Formspree or Getform endpoint into `forms.endpoint` in `content.js`. If it's left empty, requests are stored on the visitor's device.
5. After any change, bump `VERSION` in `sw.js` so installed apps pick up the update.

## Run locally

```
python3 -m http.server 8080
# open http://localhost:8080
```

## Publish free on GitHub Pages

1. On GitHub, open the repository → **Settings → Pages**.
2. Under *Build and deployment → Source*, choose **GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow from the **Actions** tab).
4. The site goes live at `https://<your-username>.github.io/<repo-name>/`.

Cloudflare Pages and Vercel also work: there is no build step, so publish the repository root as-is.

## Install / download the app

- **Android (Chrome)**: tap **Install App**, or open the ⋮ menu and choose **Install app**.
- **iPhone (Safari)**: tap Share, then **Add to Home Screen**.
- **Desktop (Chrome/Edge)**: click **Install App** or the install icon in the address bar.

To ship it in the Google Play Store as a real APK/AAB later, put the live URL into [PWABuilder](https://www.pwabuilder.com) and it will package the app for you.
