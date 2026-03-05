# clay-reply-classify — Email Reply Classification + Next Action

Classify an inbound email reply into a category (interested, not interested, referral, objection, timing issue, etc.) and return the recommended next action. Automates reply handling at scale so the agent knows exactly what to do with each response.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name reply-classify \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Classify email replies — category, sentiment, next action"
clay listen start
```

## commands

```bash
# Classify a reply
clay fire reply-classify \
  --data '{
    "reply_text": "Hey, this actually looks interesting. Can we jump on a call next week?",
    "sender_email": "john@acme.com",
    "original_subject": "Quick question on RevOps tooling"
  }' \
  --wait

# Classify with full thread context
clay fire reply-classify \
  --data '{
    "reply_text": "We already use a competitor for this. Thanks anyway.",
    "sender_email": "jane@acme.com",
    "original_subject": "RevOps automation",
    "sequence_step": 2,
    "days_since_first_touch": 8
  }' \
  --wait

# Classify with prospect context (improves routing accuracy)
clay fire reply-classify \
  --data '{
    "reply_text": "Not the right time — budget is locked until Q3.",
    "sender_email": "cro@bigco.com",
    "original_subject": "Scaling RevOps post-Series C",
    "prospect_icp_tier": "A",
    "company_domain": "bigco.com"
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "reply-classify",
  "data": {
    "sender_email": "john@acme.com",
    "classification": "interested",
    "confidence": 0.97,
    "sentiment": "positive",
    "intent": "meeting_request",
    "urgency": "high",
    "key_signals": ["asked for call", "next week availability", "positive tone"],
    "objections": [],
    "timing_signal": "immediate",
    "referral_name": null,
    "next_action": "book_meeting",
    "next_action_detail": "Reply within 1 hour with calendar link. This is a warm reply — high close probability.",
    "suggested_reply": "Great to hear, John! Happy to connect. Here's my calendar: [link]. Do any of these slots work for you?",
    "notify_rep": true,
    "crm_stage_move": "Engaged"
  }
}
```

Classifications:
- `interested` — Wants to learn more or book a call
- `meeting_booked` — Already accepted or booked
- `referral` — Referring to someone else at the company
- `objection_competitor` — Using a competitor
- `objection_budget` — Budget constraint
- `objection_timing` — Wrong time (future pipeline)
- `objection_no_fit` — Doesn't see the fit
- `out_of_office` — OOO reply
- `not_interested` — Hard no
- `unsubscribe_request` — Wants to be removed
- `question` — Asked a clarifying question
- `neutral` — Vague/non-committal reply

## clay table setup

1. Trigger: **Webhook** (forward inbound replies from your ESP via webhook)
2. Steps:
   - AI Classification column (prompt: classify this email reply into category + intent + sentiment)
   - Objection extraction
   - Referral name extraction
   - Next action assignment (formula: classification → action)
   - Suggested reply generation (AI column)
   - Rep notification trigger (HTTP action if `notify_rep: true`)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Classify and only act on interested replies
clay fire reply-classify \
  --data '{"reply_text":"Yes lets talk — when are you free?","sender_email":"cto@startup.com"}' \
  --wait | jq 'select(.data.classification == "interested") | .data.next_action_detail'

# Get suggested reply text
clay fire reply-classify \
  --data '{"reply_text":"This looks relevant, send me more info","sender_email":"vp@acme.com"}' \
  --wait | jq -r '.data.suggested_reply'

# Catch unsubscribe requests before they escalate
clay fire reply-classify \
  --data '{"reply_text":"Please remove me from your list","sender_email":"contact@co.com"}' \
  --wait | jq 'select(.data.classification == "unsubscribe_request") | {email: .data.sender_email, action: "remove_immediately"}'

# Classify objection and extract timing signal
RESULT=$(clay fire reply-classify \
  --data '{"reply_text":"Not now — check back in Q4","sender_email":"cfo@bigco.com"}' \
  --wait)
CLASS=$(echo $RESULT | jq -r '.data.classification')
TIMING=$(echo $RESULT | jq -r '.data.timing_signal')
echo "Classification: $CLASS | Timing: $TIMING"

# Route competitors to nurture, timing objections to future pipeline
clay fire reply-classify \
  --data '{"reply_text":"We just signed with Competitor X last month","sender_email":"vp@co.com"}' \
  --wait | jq 'select(.data.classification == "objection_competitor") | {action: "add_to_competitor_nurture", crm_stage: "Lost - Competitor"}'
```

## row limit

```bash
clay usage show reply-classify
clay tables reset reply-classify --webhook-url https://app.clay.com/webhook/NEW_ID
```
