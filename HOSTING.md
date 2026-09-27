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

## Option 2: a permanent site on Render (free, about 15 minutes, needs a GitHub account)

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
4. Set `PUBLIC_URL` to `https://bowfall.com`. The server then sends anyone who uses the old onrender.com address or `www.` to `https://bowfall.com`, so everyone shares one address and one sign-in.
5. Use `https://bowfall.com/auth/google/callback` and `https://bowfall.com/auth/discord/callback` as the redirect addresses below.

### Sign in with Google and Discord (optional)

The **Continue with Google** and **Continue with Discord** buttons appear once you give the server each service's client ID and secret. First add one more variable in Render's **Environment**: `PUBLIC_URL` = your site's address, e.g. `https://bowfall.com` (no slash at the end).

**Google**
1. Go to https://console.cloud.google.com, sign in, and create a project (top bar → project picker → **New project**, call it Bowfall).
2. Open **APIs & Services → OAuth consent screen** (it may be called **Google Auth Platform → Branding**). Choose **External**, fill in the app name (Bowfall), your support email and developer email, and save. Under **Audience**, click **Publish app** so anyone can sign in (the app only asks for name and profile picture, so Google doesn't need to review it).
3. Open **Credentials** (or **Clients**) → **Create credentials → OAuth client ID** → application type **Web application**.
4. Under **Authorised redirect URIs** add: `https://bowfall.onrender.com/auth/google/callback` (your address + `/auth/google/callback`). Create it.
5. Copy the **Client ID** and **Client secret** into Render as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Discord**
1. Go to https://discord.com/developers/applications → **New Application**, call it Bowfall.
2. Open **OAuth2**. Under **Redirects** add `https://bowfall.onrender.com/auth/discord/callback` and save.
3. Copy the **Client ID**, click **Reset Secret** and copy the secret. Put them in Render as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.

Save the variables in Render; after the restart the buttons appear on the sign-in page. New players signing in this way pick a player name the first time. Existing players can link Google or Discord (and add or change a password) on their own profile page. Bowfall only receives an ID and a display name from them, no email address.

Good to know:

- On the free plan the server goes to sleep after 15 minutes with nobody connected. The first visit after that takes about 30–60 seconds to wake it.
- Balance data (`data/games.jsonl`) still lives on the server's disk, so it's lost when Render restarts. Use Export on the Balance data screen now and then.
- Each time you push a change to GitHub, Render redeploys automatically. Accounts, stats and forum posts are safe in the database.

Railway (https://railway.app) and Fly.io (https://fly.io) work the same way: the build command is `npm install`, the start command is `npm start`, the server reads the `PORT` it's given, and `DATABASE_URL` points it at Postgres.

## Option 3: same Wi-Fi only

Run `npm start`, find your computer's local IP address (`ipconfig` on Windows, System Settings > Network on a Mac), and have friends open `http://<that IP>:3000`. You may need to let Node through your firewall.

## Tracking down lag

Press **F3** in an online game (or turn on **Options → Graphics → Performance stats**) for a small panel that splits lag into its three possible sources, over the last 10 seconds:

- **Your PC:** frame rate, the slowest frame, and how many frames took over 50 ms. Slow frames here mean the computer (or browser) is the problem; try the Fast resolution setting or fewer particles.
- **Network:** ping and how much it varies (±), and **late packets**: game updates that reached you more than 60 ms after the server's own clock says they were sent. Late packets while your PC and the server look fine mean the connection between you and the server (Wi-Fi, your ISP, or the route to the server's region) is delaying or bunching packets. A steady high ping (over 150 ms) just means you're far from the server.
- **Server:** its CPU use as a share of what the host allows, how long the host held it back (throttling) each second, the longest stall in its game loop, and the slowest simulation tick. A stall over 60 ms, any throttling, or CPU near 100% mean the server is the problem.

The graph shows the gap between each game update (green on time, yellow a little late, red late) and blue ticks for slow frames on your PC. The top line names the likely cause.

Every 10 seconds each player's browser sends a one-line summary to the server. The owner can type **/perf** in any game's chat to see the server's numbers now and over the last 30 seconds, plus the last few players' reports, or open **/api/perf** while signed in for the last two minutes in full.

**Render's free plan** gives the server a tenth of one CPU core, enforced in 100 ms slices: the server may use 10 ms of CPU in each 100 ms, and anything over that waits for the next slice. A 3v3 with five AI players averages about a third of a millisecond of CPU per tick, which fits, but bots, garbage collection and compressing updates cause occasional ticks of 5 to 15 ms, and one of those can use up a whole slice and freeze the game for up to 100 ms. If the Server row shows throttling ("held back") during laggy moments, a paid instance (Starter: half a core) is the fix.

Measured for this project: one 3v3 with five AI players uses roughly 60 to 90 ms of CPU per second on a modern core (the game simulation itself about 20 ms; the rest is networking, timers and garbage collection, some of it on helper threads that also count against the allowance). That is most of the free plan's 100 ms per second, so bursts get throttled; a second game at the same time can't fit at all. The Starter plan (half a core, 500 ms per second) leaves plenty of room for several games.
