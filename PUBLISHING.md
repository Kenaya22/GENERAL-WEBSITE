# Publishing Tara

## 1. The website (already live)

Tara is live on GitHub Pages at **https://kenaya22.github.io/general-website/**. Pages publishes from the branch you set in the repository's **Settings → Pages**; right now that's the branch this work is pushed to, so every push updates the site.

After an update, open the app once and pull down to refresh (or close and reopen it). The service worker in `sw.js` downloads the new version because `VERSION` is bumped on every release.

## 2. Online accounts, shared reviews and fare reports (Supabase, free)

Follow **Turn on online accounts** in `README.md` (about 10 minutes): create a Supabase project, run `supabase/schema.sql`, and paste the Project URL and anon key into `js/config.js → backend`.

## 3. AI answers for Ask Tara (optional)

Ask Tara's built-in answers are free and work offline. When it can't answer, it can ask Claude through a small server function. Your API key stays on the server, never in the app.

1. Get an API key at **console.anthropic.com**. Add a few dollars of credit and set a monthly spend limit there.
2. Install the Supabase CLI and link it to your project (`supabase login`, then `supabase link`).
3. Run:
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy ask-tara --no-verify-jwt
   ```
4. Paste the function URL into `js/config.js`:
   ```js
   askUrl: "https://YOUR-PROJECT.supabase.co/functions/v1/ask-tara",
   ```
5. Bump `VERSION` in `sw.js` and push.

How it works:
- The AI is only used when the built-in answers can't handle a question, so most questions cost nothing.
- It sends the question, a few lines of Tara's own data about the place, and the last few chat messages. Answers are labelled "AI answer — may not be exact".
- It uses Claude Opus 5.5 at low effort for short answers. To lower the cost, change `model` in `supabase/functions/ask-tara/index.ts` to `claude-haiku-5-5`.
- Each visitor is limited to about 30 questions an hour.

## 4. Android app on Google Play (PWABuilder)

You need a **Google Play developer account** (one-time US$25, at play.google.com/console).

1. Go to **pwabuilder.com** and enter `https://kenaya22.github.io/general-website/`. It reads `manifest.webmanifest`, which already has icons, a maskable icon, phone screenshots (`icons/store-*.png`) and shortcuts.
2. Choose **Android → Generate package**. Use the package ID `io.github.kenaya22.tara` (or your own) and keep the signing key it creates in a safe place. You need it for every update.
3. In Play Console: **Create app** → upload the `.aab` file → fill in the store listing. Reuse the screenshots in `icons/store-*.png` and the description from the manifest. Then complete the content rating and privacy sections.
   - Privacy answers: location is used on the device only. With online accounts on, you also store email, name, trips, reviews and photos.
   - Category: Travel & Local.
4. **Full-screen app (no address bar):** PWABuilder gives you an `assetlinks.json` file. Google only checks it at the root of the domain (`https://kenaya22.github.io/.well-known/assetlinks.json`).
   - A project site like `/general-website/` can't serve that, so create a repository named **`kenaya22.github.io`** and put the file at `.well-known/assetlinks.json` there.
   - Alternatively, use a custom domain for Tara.
   - Without it, the app still works but shows a small address bar at the top.
5. Submit for review. The first review usually takes a few days.

For later updates, push to GitHub as usual; the Play app loads the website, so most changes appear without a new Play release. Make a new package only when you change the app name, icon or package settings.
