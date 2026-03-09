# clay-gtm-cli — Improvement Backlog

Discovered during live end-to-end testing (2026-03-09). Priority ordered.

---

## High Priority

### 1. clay listen start — add --daemon flag
Problem: Tunnel dies when terminal/session closes. Agents and servers lose --wait functionality after restart.

Fix: --daemon forks to background, writes PID + tunnel URL to ~/.clay/listener.json

```bash
clay listen start --port 3456 --daemon
clay listen status   # reads from file → running, pid 12345, tunnel: https://xxxx.trycloudflare.com
clay listen stop     # kills by PID
```

### 2. clay fire --wait — auto-start listener if not running
Problem: Throws CONFIG_ERROR with no recovery. User has to start listener and re-run.

Option A (best UX): Spin up inline ephemeral listener for that one call, tear down after callback returns. Fully self-contained, zero setup.

Option B: Helpful error:

```
Error: No listener running.
  Start one: clay listen start --port 3456
  Or:        clay fire --wait --auto-listen
```

### 3. Default port must be >= 1024
Problem: Default port throws validation error "Number must be greater than or equal to 1024"
Fix: Default to 3456 in config. Document in clay listen --help.

---

## Medium Priority

### 4. Add clay doctor preflight command

```
clay doctor

✅ clay-gtm-cli v0.1.0
✅ cloudflared v2026.3.0
✅ Listener running on port 3456
✅ Tunnel live: https://xxxx.trycloudflare.com
✅ 2 tables registered
⚠️  enrich-lead: 47,200 / 50,000 rows (94%) — reset soon
✅ Webhook reachable: enrich-lead
```

### 5. Show elapsed time while waiting for callback

Current: `⏳ Waiting for callback (timeout: 120s)...`
Better:

```
⏳ Waiting for callback... 0s
⏳ Waiting for callback... 5s
✅ Callback received (14s)
```

### 6. clay tables list — show row usage inline

```
NAME           ROWS USED    ROW LIMIT    %
enrich-lead    5,200        50,000       10%
outbound-prep  1,100        50,000       2%
```

---

## Low Priority

### 7. clay fire --dry-run flag

Print payload without firing. Useful for debugging before large batches.

```bash
clay fire enrich-lead --data '{"linkedin_url": "..."}' --wait --dry-run
# Would POST: { "linkedin_url": "...", "_callback_url": "https://xxxx.trycloudflare.com/callback/uuid" }
```

### 8. Persist tunnel URL to config after listen start

Write URL to clay config automatically so `clay config get` shows it.

---

## Skills Gaps

### Add clay-setup skill (new)
Full bootstrap doc: install → register table → Clay HTTP API step setup → start persistent listener (systemd/tmux) → smoke test → troubleshooting.

### Update clay-enrich-lead output schema
Real response has nested arrays (current_experience[], experience[], education[], certifications[]) plus num_followers, connections, jobs_count, last_refresh, yearly_revenue_range. Current skill shows a flat simplified shape.

### Add listener prereq note to all --wait skills
One-liner at top of every skill using --wait:

> Prerequisite: Listener must be running. `clay listen status --pretty` to check.
