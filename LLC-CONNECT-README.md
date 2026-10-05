# README: Funeral Home Locator + Formspree Forms

**Site:** www.lastinglegacycleaners.com (repo `wordresslegacy`, hosted on Vercel)
**Time needed:** about 15 minutes

## What this update does
- Adds a **ZIP code funeral home locator** (homepage, Our Work, a band near the bottom of other pages, and a popup).
- Adds a **Call 317-970-3904** bar at the top of every page and a sticky call bar at the bottom.
- Fixes the **Memorial Service Request form**. It was posting to WordPress `admin-ajax.php`, which returns 403 on Vercel, so submissions were lost. It now posts to **Formspree**.
- Adds a **Request a Call Back** form, which also posts to Formspree.
- Fixes 3 typos: "Search for a Provider here", "Memorial Refinish", and a stray quotation mark in the SMS consent text.

No other page text was changed.

---

## Step 1: Add the files
Copy everything in this folder into the **repo root** (paths match the repo), or run `git apply llc-connect.patch`.

| File | Purpose |
|---|---|
| `api/llc-funeral-homes.js` | **New.** Vercel serverless function that calls Google |
| `llc/llc-connect.js` and `llc/llc-connect.css` | **New.** Locator, forms, call buttons |
| `vercel.json` | **Edited.** Adds a rule so `/api/llc-funeral-homes` is not sent to the backend |
| `*/index.html` (18 pages) | **Edited.** CSS/JS includes, locator spots, form wiring, typo fixes |
| `tools/apply-llc-connect.mjs` | Re-applies all HTML edits after any future WordPress export |

**Important:** keep the `api/` folder at the repo root. Vercel only creates the function if it lives there.

---

## Step 2: Google API setup (required for the locator)
Do these in [Google Cloud Console](https://console.cloud.google.com/) for the project that owns the key:

1. **Billing is enabled** on the project. Google refuses Maps/Places calls without it.
2. **Enable both APIs:** APIs & Services > Library:
   - **Geocoding API**
   - **Places API (New)**. Make sure it says "(New)". The old "Places API" will **not** work.
3. **Key restrictions:** APIs & Services > Credentials > your key:
   - **Application restrictions: None.** Do **not** use HTTP referrers, because the key is called from the server and sends no referrer. Do not use IP addresses either, because Vercel IPs change.
   - **API restrictions:** restrict to **Geocoding API** and **Places API (New)** only.
   - You can reuse the key from the old WordPress plugin (WP Admin > Settings > Funeral ZIP Locator) if it meets the above, or create a new one.
4. **Add the key to Vercel:** Project `wordresslegacy` > Settings > Environment Variables:
   - Name: **`GOOGLE_MAPS_API_KEY`** (exact spelling)
   - Value: the key
   - Environments: **Production** (plus Preview if you test there)
5. **Redeploy after adding the variable.** Vercel only applies environment variables to deployments made **after** they're added.

The key stays on the server. It never appears in the website's code.

Optional variables: `LLC_SEARCH_RADIUS_M` (default `40000`, about 25 miles, max `50000`) and `LLC_RESULTS_LIMIT` (default `6`, max `20`).

---

## Step 3: Commit, push, and deploy
Commit and push to `main`. Vercel deploys automatically.

---

## Step 4: Test the Google locator
Open this in a browser:
```
https://www.lastinglegacycleaners.com/api/llc-funeral-homes?zip=46062
```
✅ **Working** looks like `{"ok":true,"zip":"46062","location":{...},"results":[{"name":"...","phone":"..."}...]}`

| If you see | It means | Fix |
|---|---|---|
| `"code":"no_key"` | The env variable is missing or not live yet | Check the exact name `GOOGLE_MAPS_API_KEY`, then **redeploy** |
| `"The search request was denied..."` | Geocoding API is not enabled, there's no billing, or the key is referrer-restricted | Redo Step 2, items 1 to 3 |
| `"The places service returned an error..."` | **Places API (New)** is not enabled, or not allowed on the key | Enable "Places API (New)" and add it to the key's API restrictions |
| A 404 page, or an HTML or backend response | The function wasn't deployed, or the request went to the backend | Confirm `api/llc-funeral-homes.js` is at the repo root and `vercel.json` has the new first rewrite rule |

Error details also show in Vercel > Project > Logs (search `llc-funeral-homes`).

Then test on the homepage: click **Find a Trusted Provider**, enter `46062`, and confirm funeral home cards appear with **Call** buttons.

---

## Step 5: Test both forms
The site owner is handling the Formspree settings (notification email, reCAPTCHA, domain). **Test after the owner confirms those are done.**

The endpoint is already in the code: `https://formspree.io/f/mdeanrnv`. It appears in the form `action` on the homepage and in `llc/llc-connect.js` (`formspree:`).

1. Open the homepage in Chrome with DevTools > **Network** open.
2. **Memorial Service Request form** (bottom of the homepage, or the **Contact Us** menu link):
   - Fill it out and click Submit.
   - ✅ You should see a `POST` to `formspree.io/f/mdeanrnv` with status **200** and the green "Your submission was successful." message.
   - ❌ There must be **no** request to `admin-ajax.php`.
3. **Request a Call Back form:**
   - Search a ZIP, then click **Have Lasting Legacy call me about this funeral home**.
   - Submit the form. ✅ Expect the same 200 and a "Thank You" screen.
4. Confirm both submissions appear in the Formspree dashboard and arrive by email.

| If you see | Fix |
|---|---|
| A Formspree error that mentions reCAPTCHA | reCAPTCHA must be **off** in the Formspree form settings (owner) |
| `POST` to `admin-ajax.php` / 403 | The new `index.html` isn't deployed, or the browser cached the old page. Hard refresh and confirm the form tag has `data-llc-formspree="service-request"` |
| Submissions blocked by domain | The Formspree "Restrict to Domain" setting must be `lastinglegacycleaners.com` |

Fields Formspree receives:
- **Service request:** `name, email, phone, service, memorial_name, message, sms_consent, terms_agreed`
- **Call back:** `name, phone, email, zip, best_time_to_call, funeral_home, funeral_home_phone, funeral_home_address, message, sms_consent, terms_agreed, source, page_url`

---

## Rules for future edits
- **Don't rename** the form field names or remove `data-llc-formspree="service-request"` from the homepage form.
- If the site is **re-exported from WordPress**, run `node tools/apply-llc-connect.mjs` from the repo root before pushing. It re-adds everything and is safe to run twice.
- If you edit `llc-connect.js` or `.css`, bump `?v=1.0.0` in the page includes so browsers load the new version (the script can do it: change `VERSION` at the top).
- The bottom call bar hides the small third-party "Call Now Button" to avoid overlap. To keep that button, delete the CSS line marked `our dock replaces the small Call Now Button` in `llc-connect.css`.
