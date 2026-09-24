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
5. Open that address, click **Create room**, and send your friends the room link it shows (`.../?room=ABCD`).

Good to know:

- The address changes every time you start the tunnel, and it only works while your computer is on and both commands are running.
- No account is needed. The server is on your machine, so ping is best for people near you.
- Games are recorded to `data/games.jsonl` on your computer, and the Balance data screen reads them.

## Option 2: a permanent site on Render (free, about 15 minutes, needs a GitHub account)

1. Create a GitHub repository and upload the project folder to it. Don't upload `node_modules` or `data`; the `.gitignore` already leaves them out.
2. Sign up at https://render.com with your GitHub account.
3. Choose **New + > Blueprint**, pick your repository, and click **Apply**. Render reads `render.yaml`, installs everything and starts the server.
4. After a few minutes you get an address like `https://bowfall.onrender.com`. Share it with friends and play.

Good to know:

- On the free plan the server goes to sleep after 15 minutes with nobody connected. The first visit after that takes about 30–60 seconds to wake it.
- The free plan has no permanent disk, so recorded balance data (`data/games.jsonl`) is lost whenever Render restarts or redeploys. Use Export on the Balance data screen now and then, or run the server from your own computer when you want to keep the data.
- Each time you push a change to GitHub, Render redeploys automatically.

Railway (https://railway.app) and Fly.io (https://fly.io) work the same way: the build command is `npm install`, the start command is `npm start`, and the server reads the `PORT` it's given.

## Option 3: same Wi-Fi only

Run `npm start`, find your computer's local IP address (`ipconfig` on Windows, System Settings > Network on a Mac), and have friends open `http://<that IP>:3000`. You may need to let Node through your firewall.
