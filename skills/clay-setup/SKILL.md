# clay-setup — First-Time Setup & SOP

Start here. Run this once per machine to get the full async enrichment loop working reliably every time.

## what you need

- `clay-gtm-cli` npm package
- `cloudflared` (Cloudflare tunnel daemon)
- A Clay table with a Webhook trigger and a final HTTP API callback step

---

## 1. install

```bash
npm install -g clay-gtm-cli

# macOS
brew install cloudflared

# Linux (Ubuntu/Debian)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

## 2. register your table

```bash
clay tables add \
  --name enrich-lead \
  --webhook-url "https://api.clay.com/v3/sources/webhook/YOUR_WEBHOOK_ID" \
  --description "LinkedIn profile enrichment"

clay tables list --pretty
```

## 3. set up the clay table (once in Clay UI)

1. Trigger: **Webhook**
2. Steps: Enrich Person (LinkedIn), Find Work Email (optional)
3. Final step: **HTTP API**
   - Method: POST
   - URL: `{{_callback_url}}` — auto-injected by the CLI per request
   - Body: map enriched columns you want returned

## 4. start the callback listener

### Option A — systemd service (recommended for servers/agents)

```bash
sudo tee /etc/systemd/system/clay-listener.service > /dev/null <<EOF
[Unit]
Description=Clay GTM CLI callback listener
After=network.target

[Service]
ExecStart=/usr/local/bin/clay listen start --port 3456
Restart=always
RestartSec=5
User=$(whoami)
Environment=HOME=$HOME

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable clay-listener
sudo systemctl start clay-listener
clay listen status --pretty
```

### Option B — tmux session (dev machines)

```bash
tmux new-session -d -s clay-listener 'clay listen start --port 3456'
clay listen status --pretty
```

### Option C — foreground (testing only)

```bash
clay listen start --port 3456
```

## 5. smoke test

```bash
clay listen status --pretty

clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/YOUR_PROFILE"}' \
  --wait --timeout 90 --pretty
```

If enriched data returns — fully operational.

---

## SOP: before every enrichment session

```bash
clay listen status --pretty
clay usage show enrich-lead --pretty
clay fire enrich-lead \
  --data '{"linkedin_url": "..."}' \
  --wait --timeout 90 --pretty
```

## troubleshooting

| Symptom                           | Fix                                                 |
| --------------------------------- | --------------------------------------------------- |
| CONFIG_ERROR: No listener running | Run `clay listen start --port 3456`                 |
| TIMEOUT after 60-120s             | Check Clay HTTP API step uses `{{_callback_url}}`   |
| port must be >= 1024 error        | Always use `--port 3456`                            |
| Table hit row limit               | `clay tables reset enrich-lead --webhook-url NEW_URL` |
