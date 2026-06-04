const http = require('http');
const url = require('url');
const config = require('./config');

async function exchangeCode(code) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
    });

    const res = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });

    return res.json();
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<body>
  <h1>Discord Connection Profile Updater</h1>
  <label>Your User ID: <input id="userId" /></label><br/><br/>
  <label>JSON Payload:<br/><textarea id="payload" rows="10" cols="60"></textarea></label><br/><br/>
  <button onclick="updateProfile()">Update Profile</button>
  <pre id="result"></pre>
  <script>
    async function updateProfile() {
      const discordUserId = document.getElementById("userId").value;
      const jsonString = document.getElementById("payload").value;
      const pre = document.getElementById("result");
      try {
        const res = await fetch("/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discordUserId, jsonString })
        });
        const data = await res.text();
        pre.textContent = data.length === 0 ? "success" : data;
      } catch (e) {
        pre.textContent = "Error: " + e.message;
      }
    }
  </script>
</body>
</html>
    `);
        return;
    }

    if (pathname === '/oauth2') {
        const { code } = parsed.query;
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing code parameter' }));
            return;
        }

        try {
            const data = await exchangeCode(code);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (pathname === '/update-profile' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
            try {
                const { discordUserId, jsonString } = JSON.parse(body);
                const res2 = await fetch(
                    `https://discord.com/api/v9/applications/${config.discordApplicationId}/users/${discordUserId}/identities/0/profile`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bot ${config.botToken}`,
                            'User-Agent':
                                'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
                        },
                        body: jsonString,
                    },
                );
                const data = await res2.text();
                res.writeHead(res2.status, {
                    'Content-Type': 'application/json',
                });
                res.end(data);
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
});
