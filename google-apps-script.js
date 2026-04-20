// ============================================================
//  31stFile Newsletter — Google Apps Script Backend
//  ──────────────────────────────────────────────
//  SETUP INSTRUCTIONS:
//  1. Go to script.google.com → New Project (linked to a Google Sheet)
//  2. Paste this entire file as the script content
//  3. Fill in the CONFIGURATION section below with your Zoho details
//  4. Deploy → New Deployment → Web App
//       Execute as: Me
//       Who has access: Anyone
//  5. Copy the Web App URL and paste it into index.html at SCRIPT_URL
// ============================================================

// ──────────────────────────────────────────────────────────────
//  CONFIGURATION  ← fill these in before deploying
// ──────────────────────────────────────────────────────────────
const CONFIG = {
  // Google Sheet tab name (auto-created if missing)
  SHEET_NAME: '31stFile Subscribers',

  // ── Zoho Mail Settings ──────────────────────────────────────
  // Step 1: Log in at mail.zoho.in (or mail.zoho.com)
  // Step 2: Settings → Developer Space → Mail API → Generate Token
  // Step 3: Paste the token below (keep the quotes)
  ZOHO_API_TOKEN: 'YOUR_ZOHO_MAIL_API_TOKEN_HERE',

  // The email address you're sending FROM (must be verified in Zoho)
  ZOHO_FROM_EMAIL: 'partner@31stfile.com',

  // Display name shown in the recipient's inbox
  ZOHO_FROM_NAME: '31stFile Compliance Weekly',

  // Your Zoho Account ID
  // Find it: Log in to mail.zoho.com → visit https://mail.zoho.com/api/accounts
  // Look for the "accountId" field — it's a numeric string e.g. '5000000001'
  ZOHO_ACCOUNT_ID: 'YOUR_ZOHO_ACCOUNT_ID_HERE',

  // Since partner@31stfile.com uses a custom domain, your region is likely:
  // 'mail.zoho.com'  (if you signed up at zoho.com — most common for custom domains)
  // 'mail.zoho.in'   (if you signed up at zoho.in)
  // Try zoho.com first. Check: https://mail.zoho.com/api/accounts
  ZOHO_REGION: 'mail.zoho.com',
};
// ──────────────────────────────────────────────────────────────


// ── Main POST handler (called when the form is submitted) ──────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Create sheet with headers if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      const headers = [['Timestamp', 'Name', 'Email', 'Company', 'Source', 'Email Sent?']];
      sheet.getRange(1, 1, 1, 6).setValues(headers).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Check for duplicate email (compare lowercase)
    const lastRow = sheet.getLastRow();
    const emails = lastRow > 1
      ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat().map(e => String(e).toLowerCase())
      : [];

    if (emails.includes(String(data.email).toLowerCase())) {
      return jsonResponse({ status: 'duplicate', message: 'Email already subscribed' });
    }

    // Send welcome email via Zoho Mail
    let emailSent = 'No';
    try {
      sendWelcomeEmail(data.name, data.email);
      emailSent = 'Yes';
    } catch (mailErr) {
      // Log error but don't block the subscription
      Logger.log('Email send error: ' + mailErr.toString());
      emailSent = 'Error: ' + mailErr.toString().substring(0, 80);
    }

    // Append subscriber row
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name    || '',
      data.email   || '',
      data.company || '',
      data.source  || 'Landing Page',
      emailSent
    ]);

    // Auto-resize columns
    sheet.autoResizeColumns(1, 6);

    return jsonResponse({ status: 'success', message: 'Subscribed!' });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}


// ── Send welcome HTML email via Zoho Mail API ──────────────────
function sendWelcomeEmail(subscriberName, subscriberEmail) {
  const firstName = subscriberName ? subscriberName.split(' ')[0] : 'there';

  const subject = `Welcome to 31stFile Compliance Weekly, ${firstName}!`;
  const htmlBody = buildWelcomeEmailHtml(firstName);

  const url = `https://${CONFIG.ZOHO_REGION}/api/accounts/${CONFIG.ZOHO_ACCOUNT_ID}/messages`;

  const payload = {
    fromAddress: CONFIG.ZOHO_FROM_EMAIL,
    toAddress:   subscriberEmail,
    subject:     subject,
    mailFormat:  'html',
    content:     htmlBody,
    // Optional plain-text fallback for email clients that don't support HTML
    textBody:    buildPlainTextEmail(firstName),
    askReceipt:  'no'
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Zoho-oauthtoken ' + CONFIG.ZOHO_API_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  Logger.log(`Zoho API response [${responseCode}]: ${responseBody}`);

  if (responseCode !== 200) {
    throw new Error(`Zoho API error ${responseCode}: ${responseBody}`);
  }
}


// ── Build the HTML welcome email body ──────────────────────────
function buildWelcomeEmailHtml(firstName) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to 31stFile Compliance Weekly</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F0EDE8; font-family: 'Georgia', serif; -webkit-text-size-adjust: 100%; }
  img { display: block; border: 0; max-width: 100%; }
  a { text-decoration: none; }
  .email-outer { background: #F0EDE8; padding: 40px 16px; }
  .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(11,31,58,0.08); }
  .email-header { background: #0B1F3A; padding: 36px 48px 40px; text-align: center; position: relative; }
  .email-header::after { content: ''; display: block; height: 3px; background: linear-gradient(90deg, transparent, #C9A84C 30%, #E4C070 50%, #C9A84C 70%, transparent); position: absolute; bottom: 0; left: 0; right: 0; }
  .header-logo { height: 44px; margin: 0 auto 20px; filter: brightness(0) invert(1); }
  .header-pill { display: inline-block; background: rgba(201,168,76,0.18); border: 1px solid rgba(201,168,76,0.4); color: #E4C070; font-family: 'Arial', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; padding: 5px 16px; border-radius: 50px; }
  .hero-band { background: #0B1F3A; padding: 32px 48px 48px; text-align: center; }
  .hero-band h1 { font-family: 'Georgia', 'Times New Roman', serif; font-size: 30px; font-weight: 700; color: #ffffff; line-height: 1.25; margin-bottom: 14px; }
  .hero-band h1 span { color: #C9A84C; }
  .hero-band p { font-family: 'Arial', sans-serif; font-size: 15px; color: rgba(255,255,255,0.62); line-height: 1.7; max-width: 420px; margin: 0 auto; font-weight: 300; }
  .greeting { padding: 40px 48px 24px; border-bottom: 1px solid #F0EDE8; }
  .greeting p { font-family: 'Arial', sans-serif; font-size: 15.5px; color: #3D4A5A; line-height: 1.8; margin-bottom: 14px; }
  .greeting p strong { color: #0B1F3A; font-weight: 600; }
  .greeting .signature { margin-top: 28px; font-family: 'Georgia', serif; font-size: 14px; color: #6B7A8D; font-style: italic; }
  .expect-section { padding: 36px 48px; background: #FAFAF8; }
  .expect-section h2 { font-family: 'Georgia', serif; font-size: 20px; font-weight: 700; color: #0B1F3A; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #C9A84C; display: inline-block; }
  .expect-item { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
  .expect-icon { width: 40px; height: 40px; background: #0B1F3A; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 17px; text-align: center; line-height: 40px; }
  .expect-text h3 { font-family: 'Arial', sans-serif; font-size: 14px; font-weight: 700; color: #0B1F3A; margin-bottom: 4px; letter-spacing: 0.2px; }
  .expect-text p { font-family: 'Arial', sans-serif; font-size: 13.5px; color: #6B7A8D; line-height: 1.65; }
  .cta-block { padding: 32px 48px 36px; text-align: center; border-top: 1px solid #F0EDE8; }
  .cta-block p { font-family: 'Arial', sans-serif; font-size: 14px; color: #6B7A8D; margin-bottom: 20px; line-height: 1.6; }
  .btn-primary { display: inline-block; background: #0B1F3A; color: #ffffff !important; font-family: 'Arial', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; padding: 14px 36px; border-radius: 8px; text-decoration: none; }
  .divider { height: 1px; background: #ECEAE5; margin: 0 48px; }
  .connect-section { padding: 32px 48px; text-align: center; }
  .connect-section p { font-family: 'Arial', sans-serif; font-size: 13px; color: #8A95A3; margin-bottom: 18px; letter-spacing: 0.3px; }
  .social-links { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
  .social-link { display: inline-flex; align-items: center; gap: 7px; background: #F0EDE8; border: 1px solid rgba(11,31,58,0.12); border-radius: 8px; padding: 9px 16px; font-family: 'Arial', sans-serif; font-size: 12.5px; font-weight: 600; color: #0B1F3A !important; text-decoration: none; }
  .social-link .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot-web { background: #C9A84C; } .dot-li { background: #0A66C2; } .dot-mail { background: #34A853; }
  .email-footer { background: #0B1F3A; padding: 28px 48px; text-align: center; }
  .email-footer img { height: 28px; margin: 0 auto 14px; filter: brightness(0) invert(1); }
  .email-footer p { font-family: 'Arial', sans-serif; font-size: 11.5px; color: rgba(255,255,255,0.32); line-height: 1.8; }
  .email-footer a { color: rgba(255,255,255,0.45); text-decoration: underline; }
  .footer-rule { height: 1px; background: rgba(255,255,255,0.08); margin: 14px 0; }
  @media (max-width: 480px) {
    .email-header, .hero-band, .greeting, .expect-section, .cta-block, .connect-section, .email-footer { padding-left: 24px; padding-right: 24px; }
    .divider { margin: 0 24px; }
    .hero-band h1 { font-size: 24px; }
    .social-links { flex-direction: column; align-items: center; }
  }
</style>
</head>
<body>
<div class="email-outer">
<div class="email-container">

  <div class="email-header">
    <img class="header-logo"
         src="https://lottie.host/30ce7548-9cdd-4e66-a656-6f3ffc24ea1f/7Qw5Z1Ef6B.png"
         alt="31stFile" width="140">
    <div class="header-pill">Compliance Weekly</div>
  </div>

  <div class="hero-band">
    <h1>You're in.<br><span>Welcome to the inner circle.</span></h1>
    <p>Penalties don't wait. Deadlines don't remind you.<br>We do — every Monday, from CAs who live this every day.</p>
  </div>

  <div class="greeting">
    <p>Hi <strong>${firstName}</strong>,</p>
    <p>
      Thank you for subscribing to <strong>31stFile Compliance Weekly</strong> — India's CA-curated statutory compliance newsletter built for founders, CFOs, and finance teams who'd rather grow than get penalised.
    </p>
    <p>
      Starting this <strong>Monday</strong>, your inbox will carry everything you need to stay a step ahead of the regulator — without spending hours tracking MCA notices or CBDT circulars yourself.
    </p>
    <div class="signature">— The 31stFile CA Team</div>
  </div>

  <div class="expect-section">
    <h2>What to expect every week</h2>

    <div class="expect-item">
      <div class="expect-icon">⚖️</div>
      <div class="expect-text">
        <h3>Weekly Case Updates</h3>
        <p>Key tribunal rulings &amp; court judgments across GST, Income Tax, Companies Act and ROC — summarised in plain language, zero legalese.</p>
      </div>
    </div>

    <div class="expect-item">
      <div class="expect-icon">📅</div>
      <div class="expect-text">
        <h3>Compliance Due Date Reminders</h3>
        <p>A consolidated, forward-looking calendar of all critical filing dates — GST, TDS, ROC, PF, ESI and more. Never miss one again.</p>
      </div>
    </div>

    <div class="expect-item">
      <div class="expect-icon">📰</div>
      <div class="expect-text">
        <h3>Regulatory &amp; Legal Updates</h3>
        <p>MCA circulars, CBDT notifications, SEBI orders &amp; RBI guidelines decoded the moment they matter — with clear action points for your business.</p>
      </div>
    </div>

    <div class="expect-item">
      <div class="expect-icon">💡</div>
      <div class="expect-text">
        <h3>CA Commentary &amp; Insights</h3>
        <p>Our team distils what each development means for Indian startups &amp; SMEs — so you can make decisions, not just read about them.</p>
      </div>
    </div>
  </div>

  <div class="cta-block">
    <p>Have an urgent compliance query, or thinking about offloading your statutory filings entirely? We'd love to help.</p>
    <a href="https://31stfile.com" class="btn-primary">Explore 31stFile Services →</a>
  </div>

  <div class="divider"></div>

  <div class="connect-section">
    <p>CONNECT WITH US</p>
    <div class="social-links">
      <a href="https://31stfile.com" class="social-link">
        <span class="dot dot-web"></span>
        31stfile.com
      </a>
      <a href="https://www.linkedin.com/company/31st-file/" class="social-link">
        <span class="dot dot-li"></span>
        LinkedIn — 31st File
      </a>
      <a href="mailto:partner@31stfile.com" class="social-link">
        <span class="dot dot-mail"></span>
        partner@31stfile.com
      </a>
    </div>
  </div>

  <div class="email-footer">
    <img src="https://lottie.host/30ce7548-9cdd-4e66-a656-6f3ffc24ea1f/7Qw5Z1Ef6B.png"
         alt="31stFile" width="110">
    <p>CA-led statutory compliance platform for Indian businesses.</p>
    <div class="footer-rule"></div>
    <p>
      You're receiving this because you subscribed at <a href="https://31stfile.com">31stfile.com</a>.<br>
      <a href="#">Unsubscribe</a> &nbsp;·&nbsp; <a href="#">Privacy Policy</a> &nbsp;·&nbsp;
      © 2026 31stFile. All rights reserved.
    </p>
  </div>

</div></div></body>
</html>`;
}


// ── Plain-text fallback email ──────────────────────────────────
function buildPlainTextEmail(firstName) {
  return `Hi ${firstName},

Thank you for subscribing to 31stFile Compliance Weekly!

Every Monday morning, you'll receive:
• Weekly case updates (GST, Income Tax, Companies Act & more)
• Compliance due date reminders — so you never miss a filing
• Regulatory & legal updates decoded in plain language
• CA commentary tailored for Indian startups & SMEs

We're glad to have you with us.

Explore our services: https://31stfile.com
Follow us on LinkedIn: https://www.linkedin.com/company/31st-file/
Have a query? Write to us: partner@31stfile.com

Warm regards,
The 31stFile CA Team

──────────────────────────────────
You received this because you subscribed at 31stfile.com
© 2026 31stFile. All rights reserved.`;
}


// ── Helper: Return JSON response ───────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── GET handler (for testing the script URL in browser) ────────
function doGet(e) {
  return jsonResponse({ status: 'active', service: '31stFile Subscriber API', version: '2.0' });
}


// ── TEST FUNCTION: run this manually to verify Zoho is working ─
// Go to Apps Script → Run → testZohoEmail
// Check "Execution log" to see if it succeeded
function testZohoEmail() {
  try {
    sendWelcomeEmail('Test User', 'YOUR_OWN_EMAIL@gmail.com'); // ← change to your email
    Logger.log('✅ Test email sent successfully!');
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}
