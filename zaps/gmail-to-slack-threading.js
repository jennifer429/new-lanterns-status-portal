// ============================================================
// Zap: Gmail "Rads Inc." Label → Slack Thread Notification
//
// HOW TO SET UP THIS ZAP:
//   Trigger:  Gmail → New Labeled Email  (label: "Rads Inc.")
//             Set polling interval to 2 minutes (requires paid Zapier plan)
//   Action:   Code by Zapier → Run JavaScript
//
// MAP THESE INPUT DATA FIELDS from the Gmail trigger step:
//   Key          | Gmail field
//   -------------|-----------------------------
//   from         | From
//   to           | To
//   cc           | CC
//   subject      | Subject
//   snippet      | Snippet  (or Body Plain)
//   threadId     | Thread ID   ← critical for reliable threading
//
// BEFORE DEPLOYING:
//   1. Replace SLACK_TOKEN with your Slack Bot Token
//      (Bot needs: chat:write, channels:history, channels:read)
//   2. Replace CHANNEL_ID with the target channel ID
//   3. Fill in TEAM_EMAIL_TO_SLACK_ID with every @newlanterns.org address
//      → Find a Slack User ID: open their profile → ⋮ → Copy member ID
// ============================================================

const SLACK_TOKEN  = 'YOUR_SLACK_BOT_TOKEN';  // ← replace
const CHANNEL_ID   = 'C0AEH3TDY74';           // #rads-inc channel

// Map every @newlanterns.org team member's email → their Slack User ID.
// Only people listed here will be @mentioned when they appear in TO/CC.
const TEAM_EMAIL_TO_SLACK_ID = {
  // 'jennifer@newlanterns.org': 'U_JENNIFER_SLACK_ID',  // ← fill in real IDs
  // 'ryan@newlanterns.org':     'U_RYAN_SLACK_ID',
  // 'add@newlanterns.org':      'U_ADD_SLACK_ID',
};

const NEWLANTERNS_DOMAIN = '@newlanterns.org'; // adjust if your domain differs

// ── Pull in data from the Gmail trigger ──────────────────────────────────────
const from     = inputData.from     || 'Unknown Sender';
const toField  = inputData.to       || '';
const ccField  = inputData.cc       || '';
const subject  = inputData.subject  || '(no subject)';
const threadId = inputData.threadId || null;  // Gmail thread ID — best threading key

// Use snippet if provided; fall back to the plain body, capped at 500 chars
const rawSnippet = (inputData.snippet || inputData.bodyPlain || '').substring(0, 500);
const snippet    = rawSnippet.replace(/<[^>]+>/g, '').trim(); // strip any HTML

// ── Build the thread-marker string ───────────────────────────────────────────
// Using Gmail's threadId means all replies to the same Gmail thread (even with
// "Re:" subject changes) will always land in the same Slack thread.
// Falls back to a normalized subject if threadId wasn't mapped in the trigger.
const normalizedSubject = subject.replace(/^(re:|fwd?:|fw:)\s*/gi, '').trim();
const threadMarker = threadId
  ? '[GMAIL_THREAD:' + threadId + ']'
  : '[THREAD:' + normalizedSubject + ']';

// ── Find @newlanterns.org addresses in TO + CC and map to Slack mentions ─────
const allRecipients = (toField + ',' + ccField).toLowerCase();

const mentionedSlackIds = Object.entries(TEAM_EMAIL_TO_SLACK_ID)
  .filter(([email]) => allRecipients.includes(email.toLowerCase()))
  .map(([, slackId]) => '<@' + slackId + '>');

// Also do a generic check: are any @newlanterns.org addresses present that
// aren't in our map? Useful as a debug warning so you know to add them.
const unknownTeamMembers = (toField + ' ' + ccField)
  .split(/[\s,;]+/)
  .filter(part => part.toLowerCase().includes(NEWLANTERNS_DOMAIN))
  .filter(email => !Object.keys(TEAM_EMAIL_TO_SLACK_ID)
    .some(mapped => email.toLowerCase().includes(mapped.toLowerCase())));

const teamMentionText = mentionedSlackIds.length > 0
  ? mentionedSlackIds.join(' ') + ' '
  : '';

// ── Helper: search Slack channel history for an existing thread marker ────────
// Searches up to 5 pages of 100 messages (500 messages back) with cursor pagination.
async function findExistingThreadTs() {
  let cursor;
  for (let page = 0; page < 5; page++) {
    const params = { channel: CHANNEL_ID, limit: 100 };
    if (cursor) params.cursor = cursor;

    const resp = await fetch('https://slack.com/api/conversations.history', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SLACK_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await resp.json();

    if (!data.ok) {
      throw new Error('Slack history error: ' + data.error);
    }

    for (const msg of (data.messages || [])) {
      if (msg.text && msg.text.includes(threadMarker)) {
        return msg.ts; // found the parent message for this Gmail thread
      }
    }

    // Paginate if more history exists
    if (data.has_more && data.response_metadata && data.response_metadata.next_cursor) {
      cursor = data.response_metadata.next_cursor;
    } else {
      break;
    }
  }
  return null; // no existing Slack thread found → will create a new one
}

// ── Main: post to Slack ───────────────────────────────────────────────────────
const existingThreadTs = await findExistingThreadTs();

let slackResult;

if (existingThreadTs) {
  // ── Reply to the existing Slack thread ─────────────────────────────────────
  const replyText =
    teamMentionText +
    '*From:* ' + from + '\n' +
    '*Subject:* ' + subject + '\n\n' +
    snippet;

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel:   CHANNEL_ID,
      thread_ts: existingThreadTs,
      text:      replyText,
      mrkdwn:    true,
    }),
  });
  slackResult = await resp.json();
  if (!slackResult.ok) throw new Error('Slack reply error: ' + slackResult.error);

  return {
    action:           'replied_to_thread',
    thread_ts:        existingThreadTs,
    new_message_ts:   slackResult.ts,
    subject,
    team_mentions:    mentionedSlackIds,
    unknown_team:     unknownTeamMembers, // add these emails to TEAM_EMAIL_TO_SLACK_ID!
  };

} else {
  // ── Start a new Slack thread ────────────────────────────────────────────────
  // The threadMarker is embedded invisibly at the top so future runs can find it.
  const newMessageText =
    threadMarker + '\n' +          // hidden anchor — DO NOT remove
    teamMentionText +
    ':email: *New Email — Rads Inc.*\n' +
    '*From:* ' + from + '\n' +
    '*To:* '   + toField + '\n' +
    (ccField ? '*CC:* ' + ccField + '\n' : '') +
    '*Subject:* ' + subject + '\n\n' +
    snippet;

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: CHANNEL_ID,
      text:    newMessageText,
      mrkdwn:  true,
    }),
  });
  slackResult = await resp.json();
  if (!slackResult.ok) throw new Error('Slack post error: ' + slackResult.error);

  return {
    action:         'posted_new_thread',
    thread_ts:      slackResult.ts,
    subject,
    team_mentions:  mentionedSlackIds,
    unknown_team:   unknownTeamMembers, // add these emails to TEAM_EMAIL_TO_SLACK_ID!
  };
}
