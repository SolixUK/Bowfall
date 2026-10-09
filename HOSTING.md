# Playing with friends

The game server is one small Node.js program (`server.js`). Friends only need a browser. Pick one of these.

## Option 1: from your own computer, with a free tunnel (quickest, about 5 minutes)

Your computer runs the server, and a free Cloudflare tunnel gives it a public web address.

1. Install Node.js 18 or newer from https://nodejs.org.
2. Unzip the project, open a terminal in the folder, and run:
   ```
   npm install
   npm start
   ```
   It prints `Bowfall server running on http://localhost:3000`. Leave it running.
3. Install `cloudflared`:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - Mac: `brew install cloudflared`
   - Or download it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
4. In a second terminal, run:
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
   After a few seconds it prints an address like `https://something-random.trycloudflare.com`.
5. Open that address and click **Play**. In the game, **Play online → Host** creates a game; send your friends the link it shows (`.../play?room=ABCD`).

Good to know:

- The address changes every time you start the tunnel, and it only works while your computer is on and both commands are running.
- No account is needed. The server is on your machine, so ping is best for people near you.
- Games are recorded to `data/games.jsonl` on your computer, and the Balance data screen reads them.

## Option 2: a permanent site on Render (about 15 minutes, needs a GitHub account)

1. Create a GitHub repository and upload the project folder to it. Don't upload `node_modules` or `data`; the `.gitignore` already leaves them out.
2. Sign up at https://render.com with your GitHub account.
3. Choose **New + > Blueprint**, pick your repository, and click **Apply**. Render reads `render.yaml`, installs everything and starts the server in Frankfurt.
4. After a few minutes you get an address like `https://bowfall.onrender.com`. The website is at that address and the game at `/play`.

### Add a database (for accounts, stats and the forum)

Render's free servers wipe their files whenever they restart, and Render's own free database is deleted after 30 days, so use a free Postgres database from Neon:

1. Sign up at https://neon.tech (free plan, no card needed).
2. Create a project. Pick the **AWS Europe (Frankfurt)** region so it's next to your Render server.
3. On the project dashboard click **Connect** and copy the connection string. It looks like `postgresql://user:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
4. In Render, open your **bowfall** service, go to **Environment**, click **Add environment variable**, set the key to `DATABASE_URL` and paste the connection string as the value, then **Save changes**. Render restarts the server, and it creates its tables on first start.
5. Open your site and create the account named **Tom** straight away: that account is the only admin (it can post news, moderate the forum and use the admin chat commands). To use a different name, set an `ADMIN_NAME` variable. Every other account loses admin whenever the server starts.

The server log on Render says `(Postgres database)` when it's connected, or `(local database file)` when `DATABASE_URL` isn't set.

### Your own domain (e.g. bowfall.com)

1. In Render, open the service → **Settings** → **Custom Domains** → **Add Custom Domain**, and add `bowfall.com` (Render also offers `www.bowfall.com`; keep both).
2. Render shows the DNS records to create. At the company you bought the domain from, open its DNS settings and add exactly what Render shows: usually an **A** record for `@` pointing at Render's IP address, and a **CNAME** record for `www` pointing at `bowfall.onrender.com`. Delete any existing "parking" A or CNAME records for `@` and `www`.
3. Back in Render, click **Verify**. Once it's verified Render issues the HTTPS certificate by itself (minutes to a few hours while DNS updates).
4. Set `PUBLIC_URL` to the address your domain settles on: `https://www.bowfall.com` if your domain sends the bare name to `www.` (GoDaddy does), otherwise `https://bowfall.com`. The server sends anyone on the old onrender.com address there.
5. Your sign-in redirect addresses are `PUBLIC_URL` plus `/auth/google/callback` and `/auth/discord/callback`, for example `https://www.bowfall.com/auth/discord/callback`.

### Sign in with Google and Discord (optional)

The **Continue with Google** and **Continue with Discord** buttons appear once you give the server each service's client ID and secret. Before you start, make sure Render's **Environment** has:

- `PUBLIC_URL` = your site's address, e.g. `https://bowfall.com` (no slash at the end).
- `CONTACT_EMAIL` = an address players can write to (shown on the Privacy and Terms pages). Optional, but Google asks for a contact anyway.

Bowfall has a **Privacy** page (`https://bowfall.com/#/privacy`) and a **Terms** page (`https://bowfall.com/#/terms`). Google asks for both.

**Google** (about 10 minutes)
1. Go to https://console.cloud.google.com, sign in, and create a project (top bar → project picker → **New project**, call it Bowfall).
2. Open **Google Auth Platform** (in older menus: **APIs & Services → OAuth consent screen**) and click **Get started**. Fill in:
   - App name **Bowfall**, and your user support email.
   - Audience: **External**.
   - Contact information: your email.
3. In **Branding**, add:
   - App home page: `https://bowfall.com`
   - Privacy policy: `https://bowfall.com/#/privacy`
   - Terms of service: `https://bowfall.com/#/terms`
   - Authorised domain: `bowfall.com` (or `onrender.com` if you're still on the Render address).
   - Don't upload a logo for now: a logo makes Google review the app first, which takes days.
4. In **Data access**, you don't need to add anything. Bowfall only asks for the basic `openid`, `email` and `profile` scopes, which need no review.
5. In **Audience**, click **Publish app** (to "In production"). Until you do, only test users you list can sign in.
6. In **Clients**, click **Create client**:
   - Type **Web application**, name Bowfall.
   - Under **Authorised redirect URIs** add `https://bowfall.com/auth/google/callback` (your address + `/auth/google/callback`). Add the onrender.com one too if you use both.
   - Click Create.
7. Copy the **Client ID** and **Client secret** into Render's Environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Discord** (about 5 minutes)
1. Go to https://discord.com/developers/applications → **New Application**, call it Bowfall.
2. Open **OAuth2**. Under **Redirects** add your `PUBLIC_URL` followed by `/auth/discord/callback` (for example `https://www.bowfall.com/auth/discord/callback`) and save.
3. Copy the **Client ID**, click **Reset Secret** and copy the secret. Put them in Render as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.

Save the variables in Render. After the restart the buttons appear on the sign-in page, on the website and in the game.

### A community Discord server (optional)

1. In the Discord app, click **+** (Add a Server) at the bottom of the server list → **Create My Own** → **For a club or community**, and name it Bowfall.
2. Make a few channels: `#announcements` (only you can post: channel settings → Permissions → @everyone → Send Messages off), `#general`, `#looking-for-game`, `#feedback` and `#bug-reports`. Server Settings → **Enable Community** turns on a rules screen and welcome page.
3. Right-click the server → **Invite People** → **Edit invite link**: set **Expire after: Never** and **Max uses: No limit**, then copy the link (`https://discord.gg/…`).
4. In Render, add `DISCORD_INVITE` with that link. A **Join our Discord** button appears on the game's main menu, and a Discord link in the website's menu and footer.

(The sign-in application from the previous section and the community server are separate: one lets players sign in with Discord, the other is where they chat.)

**What players see and what Bowfall keeps:**
- New players signing in this way pick a player name the first time.
- Bowfall receives an ID, a display name (to suggest a player name) and, if Google or Discord has confirmed it, the email address. The email is kept privately for password resets, the same as an email typed in at sign-up.
- Existing players can link Google or Discord, add or change a password and change their email on their profile page under **Signing in**, and can delete their account there too.

**If something goes wrong:** "redirect_uri_mismatch" from Google, or "Invalid OAuth2 redirect_uri" from Discord, means the address in step 6 (or Discord step 2) doesn't exactly match your site. Check it's exactly your `PUBLIC_URL` (including `https://` and `www.` if yours has it) followed by the callback path, with no slash at the end.

## Option 3: same Wi-Fi only

Run `npm start`, find your computer's local IP address (`ipconfig` on Windows, System Settings > Network on a Mac), and have friends open `http://<that IP>:3000`. You may need to let Node through your firewall.

## Tracking down lag

Press **F3** in an online game (or turn on **Options → Graphics → Performance stats**) for a small panel that splits lag into its three possible sources, over the last 10 seconds:

- **Your PC:** frame rate, the slowest frame, and how many frames took over 50 ms. Slow frames here mean the computer (or browser) is the problem; try the Fast resolution setting, Light effects, simple shadows or fewer particles (all in Options → Graphics).
- **Network:** ping and how much it varies (±), and **late packets**: game updates that reached you more than 60 ms after the server's own clock says they were sent. Late packets while your PC and the server look fine mean the connection between you and the server (Wi-Fi, your ISP, or the route to the server's region) is delaying or bunching packets. A steady high ping (over 150 ms) just means you're far from the server.
- **Server:** its CPU use as a share of what the host allows, how long the host held it back (throttling) each second, the longest stall in its game loop, and the slowest simulation tick. A stall over 60 ms, any throttling, or CPU near 100% mean the server is the problem.

The graph shows the gap between each game update (green on time, yellow a little late, red late) and blue ticks for slow frames on your PC. The top line names the likely cause.

Every 10 seconds each player's browser sends a one-line summary to the server. The owner can type **/perf** in any game's chat to see the server's numbers now and over the last 30 seconds, plus the last few players' reports, or open **/api/perf** while signed in for the last two minutes in full.

**Render's free plan** gives the server a tenth of one CPU core, enforced in 100 ms slices: the server may use 10 ms of CPU in each 100 ms, and anything over that waits for the next slice. A 3v3 with five AI players averages about a third of a millisecond of CPU per tick, which fits, but bots, garbage collection and compressing updates cause occasional ticks of 5 to 15 ms, and one of those can use up a whole slice and freeze the game for up to 100 ms. If the Server row shows throttling ("held back") during laggy moments, a paid instance (Starter: half a core) is the fix.

Measured for this project: one 3v3 with five AI players uses roughly 60 to 90 ms of CPU per second on a modern core (the game simulation itself about 20 ms; the rest is networking, timers and garbage collection, some of it on helper threads that also count against the allowance). That is most of the free plan's 100 ms per second, so bursts get throttled; a second game at the same time can't fit at all. The Starter plan (half a core, 500 ms per second) leaves plenty of room for several games.

## Payments (Stripe)

The Store's paid items (Supporter membership, Founder pack, donations and single unlocks) use Stripe Checkout. Nothing is sold until you set it up; until then the buttons say payments aren't switched on. Earning and spending Crests works without Stripe.

1. Make a Stripe account (stripe.com) and finish its business details so it can take live payments. You can do all of this in **test mode** first.
2. **Developers → API keys:** copy the secret key (`sk_test_...` in test mode, `sk_live_...` for real).
3. **Developers → Webhooks → Add endpoint:** URL: your `PUBLIC_URL` followed by `/api/stripe/webhook` (e.g. `https://www.bowfall.com/api/stripe/webhook`). Choose these events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its **signing secret** (`whsec_...`).
4. **Settings → Billing → Customer portal:** turn it on, and allow customers to cancel subscriptions. The Store's **Manage membership** button opens it.
5. On Render: **Environment**, add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (never put these in GitHub), and make sure `PUBLIC_URL` is set to your address so Stripe sends buyers back to the right place. Optionally set `FOUNDERS_UNTIL` to a date (e.g. `2027-03-31`) to end Founder pack sales then; the owner can also close or reopen them in game with `/founders off` or `/founders on`.
6. Test with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). When everything works, swap both variables for the live-mode key and a live-mode webhook secret.

Prices are in `lib/economy.js` (`PRICES`, in pence). Stripe charges its own fees per payment. Selling digital content in the UK usually means charging VAT once you pass the registration threshold, and buyers have refund rights: Stripe Tax can handle VAT, and it's worth checking the rules (or asking an accountant) before taking real money.

## Password reset emails

New accounts give an email address, and players can reset a forgotten password from the sign-in page ("Forgot your password?"). The server sends those emails through [Resend](https://resend.com) (free for 3,000 emails a month):

1. Make a Resend account, then under **Domains** add your domain (e.g. `bowfall.com`) and add the DNS records it shows you at your domain registrar. Wait until it says **Verified**.
2. Under **API Keys**, create a key with "Sending access".
3. On Render: **Environment**, add `RESEND_API_KEY` (the key) and `MAIL_FROM` (e.g. `Bowfall <noreply@bowfall.com>`, using the verified domain). Never put these in GitHub. Make sure `PUBLIC_URL` is set too, so the reset links point at your address.

Until both are set, accounts still take emails but the "Forgot your password?" page says emails aren't set up yet (and the server log prints any email it would have sent). Emails are kept private in the account record and are never shown to other players. Players who made accounts before emails were asked for can add one on their profile under **Signing in**.

**Owner commands** (type in any game's chat): `/locks on|off` switches ranked unlocks on or off (off: everything free); `/rotation stone ninja` pins the free picks, `/rotation clear` goes back to the weekly rotation; `/grant <name> supporter <months>|founder|patron|crests <n>|unlock <key>|revoke <what>` for testing and for sorting out support requests; `/feature <arena code> [ranked|off]` for player arenas; `/clan disband <tag>` removes a clan. `/season` shows the ranked season and when it ends; `/season end` ends it now (peaks recorded, rewards paid, ratings softened). `/profile [seconds]` records what the server spends its CPU on while you play (results at `/api/profile` when signed in as the owner).
