// ============================================================
//  31stFile Newsletter — Weekly Broadcast System
//  ──────────────────────────────────────────────────────────
//  Credentials are read from Script Properties (secrets vault).
//  Same 3 Script Properties used by google-apps-script.js:
//    ZOHO_EMAIL         → partner@31stfile.com
//    ZOHO_APP_PASSWORD  → your Zoho app-specific password
//    ZOHO_ACCOUNT_ID    → numeric ID from mail.zoho.com/api/accounts
//
//  SCHEDULE SETUP:
//    Triggers (clock icon) → Add Trigger
//    Function: sendWeeklyNewsletter
//    Event source: Time-driven → Week timer → Every Monday → 7-8 AM
// ============================================================

const ZOHO_REGION_BC   = 'mail.zoho.com'; // change to mail.zoho.in if needed
const FROM_NAME_BC     = '31stFile Compliance Weekly';
const SHEET_NAME_BC    = '31stFile Subscribers';
const LOG_SHEET_NAME   = 'Broadcast Log';
const BATCH_LIMIT      = 200; // emails per run

// Column positions in subscriber sheet (1-indexed)
const COL_EMAIL_BC  = 3; // Column C
const COL_NAME_BC   = 2; // Column B
const COL_STATUS_BC = 7; // Column G (Active / unsubscribed)

// Helper: read from Script Properties
function getBroadcastSecret(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error(`Script Property "${key}" is not set.`);
  return val;
}


// ── MAIN: Send weekly newsletter to all active subscribers ─────
function sendWeeklyNewsletter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_BC);

  if (!sheet) {
    Logger.log('❌ Subscriber sheet not found: ' + SHEET_NAME_BC);
    return;
  }

  // Ensure the Active/Unsubscribed column exists
  ensureStatusColumn(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No subscribers yet.');
    return;
  }

  // Get all subscriber data (skip header row)
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  // Build newsletter content for THIS week
  const newsletter = buildWeeklyNewsletter();

  let sent = 0, skipped = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < data.length && sent < BATCH_LIMIT; i++) {
    const row    = data[i];
    const name   = row[COL_NAME_BC - 1]   || 'Subscriber';
    const email  = row[COL_EMAIL_BC - 1];
    const status = String(row[COL_STATUS_BC - 1]).toLowerCase();

    // Skip empty emails or unsubscribed users
    if (!email || status === 'unsubscribed') {
      skipped++;
      continue;
    }

    try {
      sendNewsletterEmail(name, email, newsletter);
      sent++;
      Utilities.sleep(200); // brief pause between sends to avoid rate limits
    } catch (err) {
      failed++;
      errors.push(`${email}: ${err.toString().substring(0, 100)}`);
      Logger.log('❌ Failed to send to ' + email + ': ' + err);
    }
  }

  // Log this broadcast run
  logBroadcast(ss, newsletter.subject, sent, skipped, failed, errors);

  Logger.log(`✅ Newsletter sent! Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}`);
}


// ── Send a single newsletter email ────────────────────────────
function sendNewsletterEmail(name, email, newsletter) {
  const firstName = name ? String(name).split(' ')[0] : 'there';
  const htmlBody  = newsletter.htmlBody.replace(/\{\{firstName\}\}/g, firstName);
  const textBody  = newsletter.textBody.replace(/\{\{firstName\}\}/g, firstName);

  // Read credentials from Script Properties (never hardcoded)
  const zohoEmail     = getBroadcastSecret('ZOHO_EMAIL');
  const zohoAppPass   = getBroadcastSecret('ZOHO_APP_PASSWORD');
  const zohoAccountId = getBroadcastSecret('ZOHO_ACCOUNT_ID');
  const basicAuth     = Utilities.base64Encode(`${zohoEmail}:${zohoAppPass}`);

  const url = `https://${ZOHO_REGION_BC}/api/accounts/${zohoAccountId}/messages`;

  const payload = {
    fromAddress: zohoEmail,
    toAddress:   email,
    subject:     newsletter.subject,
    mailFormat:  'html',
    content:     htmlBody,
    textBody:    textBody,
    askReceipt:  'no'
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'Authorization': `Basic ${basicAuth}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error(`Zoho API ${response.getResponseCode()}: ${response.getContentText()}`);
  }
}


// ── Log broadcast results to a sheet ──────────────────────────
function logBroadcast(ss, subject, sent, skipped, failed, errors) {
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.appendRow(['Date', 'Subject', 'Sent', 'Skipped', 'Failed', 'Errors']);
    logSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }
  logSheet.appendRow([
    new Date().toISOString(),
    subject,
    sent,
    skipped,
    failed,
    errors.join(' | ')
  ]);
}


// ── Ensure column G "Status" header exists ────────────────────
function ensureStatusColumn(sheet) {
  if (sheet.getLastColumn() < 7) {
    sheet.getRange(1, 7).setValue('Status').setFontWeight('bold');
  }
}


// ─────────────────────────────────────────────────────────────
//  ✏️  EDIT NEWSLETTER CONTENT HERE EACH WEEK
//  Called by sendWeeklyNewsletter() to build this week's email
// ─────────────────────────────────────────────────────────────
function buildWeeklyNewsletter() {

  // ── CHANGE THESE EACH WEEK ──────────────────────────────────
  const WEEK_DATE    = 'April 21, 2026';           // ← Update each Monday
  const ISSUE_NUMBER = '1';                         // ← Increment each week

  const CASE_UPDATES = `
    <li><strong>GST:</strong> ITAT upholds input tax credit claim for construction materials used in plant — key ruling for manufacturers. [Delhi HC, Apr 2026]</li>
    <li><strong>Income Tax:</strong> CBDT clarifies TDS deduction on software subscription payments made to foreign entities — Section 194J applies.</li>
    <li><strong>Companies Act:</strong> MCA extends deadline for filing of e-form BEN-2 for beneficial owners to May 31, 2026.</li>
  `;

  const DUE_DATES = `
    <li>📅 <strong>Apr 25:</strong> GSTR-3B (monthly, Feb 2026)</li>
    <li>📅 <strong>Apr 30:</strong> TDS/TCS return — Q4 FY2025-26 (Form 24Q/26Q)</li>
    <li>📅 <strong>Apr 30:</strong> PF/ESI contributions for March 2026</li>
    <li>📅 <strong>May 15:</strong> TDS certificate (Form 16A) for Q4</li>
    <li>📅 <strong>May 31:</strong> e-Form BEN-2 (MCA beneficial owner declaration)</li>
  `;

  const REGULATORY_UPDATE = {
    headline: 'SEBI Tightens SME IPO Disclosure Norms',
    body: `SEBI's new circular (Apr 14, 2026) mandates SME companies filing for IPO to disclose all related-party transactions exceeding ₹10 lakh in the last 3 years. Companies in the pipeline should audit their related-party disclosures immediately to avoid delays.`,
  };

  const CA_INSIGHT = {
    headline: 'What The Q4 TDS Deadline Means For Your Business',
    body: `Q4 TDS returns are due April 30. If you have salary payments, vendor payments, or rent exceeding ₹2.4 lakh/year, ensure deductions were made correctly. Late filing penalty is ₹200/day under Section 234E — uncapped. Our team recommends finalising payroll reconciliations by April 25 to give yourself a buffer.`,
  };
  // ── END: EDIT ABOVE ────────────────────────────────────────


  const subject = `📋 31stFile Compliance Weekly — Week of ${WEEK_DATE}`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#F0EDE8; font-family:'Georgia',serif; -webkit-text-size-adjust:100%; }
  img { display:block; border:0; max-width:100%; }
  a { text-decoration:none; }
  .outer { background:#F0EDE8; padding:32px 16px; }
  .container { max-width:620px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid rgba(11,31,58,0.08); }
  /* Header */
  .header { background:#0B1F3A; padding:28px 40px 32px; text-align:center; position:relative; }
  .header::after { content:''; display:block; height:3px; background:linear-gradient(90deg,transparent,#C9A84C 30%,#E4C070 50%,#C9A84C 70%,transparent); position:absolute; bottom:0; left:0; right:0; }
  .logo { height:38px; margin:0 auto 16px; filter:brightness(0) invert(1); }
  .issue-badge { display:inline-block; background:rgba(201,168,76,0.2); border:1px solid rgba(201,168,76,0.45); color:#E4C070; font-family:Arial,sans-serif; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 14px; border-radius:50px; }
  /* Week banner */
  .week-banner { background:#132844; padding:18px 40px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(201,168,76,0.15); }
  .week-banner p { font-family:Arial,sans-serif; font-size:12px; color:rgba(255,255,255,0.5); letter-spacing:0.5px; }
  .week-banner strong { color:#C9A84C; }
  /* Greeting */
  .greeting { padding:32px 40px 20px; border-bottom:1px solid #F0EDE8; }
  .greeting p { font-family:Arial,sans-serif; font-size:15px; color:#3D4A5A; line-height:1.8; margin-bottom:10px; }
  /* Section */
  .section { padding:28px 40px; border-bottom:1px solid #F0EDE8; }
  .section-label { font-family:Arial,sans-serif; font-size:10px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#C9A84C; margin-bottom:10px; }
  .section h2 { font-family:'Georgia',serif; font-size:18px; color:#0B1F3A; margin-bottom:16px; font-weight:700; }
  .section ul { padding-left:18px; }
  .section ul li { font-family:Arial,sans-serif; font-size:13.5px; color:#3D4A5A; line-height:1.75; margin-bottom:10px; }
  /* Card */
  .card { background:#FAFAF8; border:1px solid rgba(11,31,58,0.08); border-radius:10px; padding:20px 24px; margin-top:4px; }
  .card h3 { font-family:'Georgia',serif; font-size:16px; color:#0B1F3A; margin-bottom:8px; font-weight:700; }
  .card p { font-family:Arial,sans-serif; font-size:13.5px; color:#4A5568; line-height:1.75; }
  /* CTA */
  .cta { padding:28px 40px; text-align:center; background:#0B1F3A; }
  .cta p { font-family:Arial,sans-serif; font-size:13px; color:rgba(255,255,255,0.55); margin-bottom:16px; line-height:1.6; }
  .btn { display:inline-block; background:#C9A84C; color:#0B1F3A !important; font-family:Arial,sans-serif; font-size:13px; font-weight:700; padding:12px 30px; border-radius:8px; letter-spacing:0.3px; }
  /* Footer */
  .footer { background:#0B1F3A; padding:24px 40px; text-align:center; }
  .footer p { font-family:Arial,sans-serif; font-size:11px; color:rgba(255,255,255,0.3); line-height:1.8; }
  .footer a { color:rgba(255,255,255,0.45); text-decoration:underline; }
  .footer-rule { height:1px; background:rgba(255,255,255,0.08); margin:14px 0; }
  @media(max-width:480px){
    .header,.week-banner,.greeting,.section,.cta,.footer{padding-left:20px;padding-right:20px;}
    .week-banner{flex-direction:column;gap:4px;text-align:center;}
  }
</style>
</head>
<body>
<div class="outer">
<div class="container">

  <div class="header">
    <img class="logo" src="https://lottie.host/30ce7548-9cdd-4e66-a656-6f3ffc24ea1f/7Qw5Z1Ef6B.png" alt="31stFile" width="130">
    <div class="issue-badge">Compliance Weekly · Issue #${ISSUE_NUMBER}</div>
  </div>

  <div class="week-banner">
    <p>Week of <strong>${WEEK_DATE}</strong></p>
    <p>Sent by <strong>31stFile CA Team</strong></p>
  </div>

  <div class="greeting">
    <p>Hi <strong>{{firstName}}</strong>,</p>
    <p>Here's your Monday compliance briefing — everything you need to stay ahead this week, in under 5 minutes.</p>
  </div>

  <div class="section">
    <p class="section-label">⚖️ Case Updates</p>
    <h2>Key Rulings This Week</h2>
    <ul>
      ${CASE_UPDATES}
    </ul>
  </div>

  <div class="section">
    <p class="section-label">📅 Due Dates</p>
    <h2>Upcoming Deadlines</h2>
    <ul>
      ${DUE_DATES}
    </ul>
  </div>

  <div class="section">
    <p class="section-label">📰 Regulatory Update</p>
    <div class="card">
      <h3>${REGULATORY_UPDATE.headline}</h3>
      <p>${REGULATORY_UPDATE.body}</p>
    </div>
  </div>

  <div class="section">
    <p class="section-label">💡 CA Insight</p>
    <div class="card">
      <h3>${CA_INSIGHT.headline}</h3>
      <p>${CA_INSIGHT.body}</p>
    </div>
  </div>

  <div class="cta">
    <p>Need expert help with filings, compliance, or statutory work? Our CA team is ready.</p>
    <a href="https://31stfile.com" class="btn">Talk to a CA at 31stFile →</a>
  </div>

  <div class="footer">
    <img src="https://lottie.host/30ce7548-9cdd-4e66-a656-6f3ffc24ea1f/7Qw5Z1Ef6B.png" alt="31stFile" width="100">
    <div class="footer-rule"></div>
    <p>
      You're receiving this because you subscribed at <a href="https://31stfile.com">31stfile.com</a>.<br>
      <a href="#">Unsubscribe</a> &nbsp;·&nbsp; <a href="#">Privacy Policy</a> &nbsp;·&nbsp;
      © 2026 31stFile. All rights reserved.
    </p>
  </div>

</div></div></body>
</html>`;

  const textBody = `31stFile Compliance Weekly — Issue #${ISSUE_NUMBER} — ${WEEK_DATE}

Hi {{firstName}},

Here's your Monday compliance briefing.

CASE UPDATES
• GST: ITAT upholds ITC claim for construction materials used in plant.
• Income Tax: CBDT clarifies TDS on software subscription to foreign entities.
• Companies Act: MCA extends BEN-2 deadline to May 31, 2026.

DUE DATES THIS WEEK
• Apr 25: GSTR-3B (monthly)
• Apr 30: TDS/TCS return Q4 FY2025-26
• Apr 30: PF/ESI contributions for March 2026
• May 15: Form 16A (TDS certificate)
• May 31: e-Form BEN-2

REGULATORY UPDATE: ${REGULATORY_UPDATE.headline}
${REGULATORY_UPDATE.body}

CA INSIGHT: ${CA_INSIGHT.headline}
${CA_INSIGHT.body}

──────────────────────────
Explore 31stFile: https://31stfile.com
LinkedIn: https://www.linkedin.com/company/31st-file/
Email: partner@31stfile.com

You're receiving this because you subscribed at 31stfile.com
© 2026 31stFile. All rights reserved.`;

  return { subject, htmlBody, textBody };
}


// ── TEST: Send newsletter to yourself before scheduling ────────
// Change the email below, then Run → testBroadcast
function testBroadcast() {
  const newsletter = buildWeeklyNewsletter();
  try {
    sendNewsletterEmail('Test User', 'partner@31stfile.com', newsletter);
    Logger.log('✅ Test broadcast sent to partner@31stfile.com');
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}
