// ============================================================
//  31stFile Newsletter — Google Apps Script Backend (COMPLETE)
//  ──────────────────────────────────────────────────────────
//  SETUP (do these once):
//  1. Select "setupMySecrets"   → Run  (saves all credentials)
//  2. Select "testWelcomeEmail" → Run  (confirms email works)
//  3. Add a daily trigger:
//       Triggers (clock icon) → Add Trigger
//       Function: dailyHealthCheck
//       Time-driven → Day timer → 8–9 AM
// ============================================================

const SHEET_NAME     = '31stFile Subscribers';
const ZOHO_REGION    = 'mail.zoho.in';
const ZOHO_API_URL   = 'https://mail.zoho.in';
const SPREADSHEET_ID = '1edVQEgcpz6xMu8yMLuUMCKIFWaPVXAapMpUfsum7tT0';


// ── STEP 1: Set credentials manually in Script Properties ─────
//
//  ⚠️  DO NOT paste credentials into this code file.
//  This file is on GitHub (public). Credentials go in Script Properties only.
//
//  HOW TO SET CREDENTIALS:
//  1. In Apps Script → click ⚙️ gear icon → "Project Settings"
//  2. Scroll to "Script Properties" → "Add script property"
//  3. Add each key-value pair below:
//
//  Key                  | Value
//  ─────────────────────────────────────────────────────────────
//  ZOHO_EMAIL           | partner@31stfile.com
//  ZOHO_ACCOUNT_ID      | 1149820000000002002
//  ZOHO_ACCESS_TOKEN    | (new token from api-console.zoho.in)
//  ZOHO_REFRESH_TOKEN   | (new token from api-console.zoho.in)
//  ZOHO_CLIENT_ID       | (your client ID from api-console.zoho.in)
//  ZOHO_CLIENT_SECRET   | (new secret after regenerating)
//
//  Run this function to verify your properties are saved correctly:
function setupMySecrets() {
  const required = [
    'ZOHO_EMAIL', 'ZOHO_ACCOUNT_ID', 'ZOHO_ACCESS_TOKEN',
    'ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'
  ];
  const props = PropertiesService.getScriptProperties().getProperties();
  let allGood = true;
  required.forEach(key => {
    if (props[key]) {
      Logger.log('✅ ' + key + ' is set.');
    } else {
      Logger.log('❌ ' + key + ' is MISSING — add it in Project Settings → Script Properties.');
      allGood = false;
    }
  });
  if (allGood) {
    Logger.log('');
    Logger.log('✅ All credentials found! Testing sheet connection...');
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      Logger.log('✅ Sheet connected: ' + ss.getName());
      Logger.log('Now run "testWelcomeEmail" to confirm emails work.');
    } catch(e) {
      Logger.log('❌ Sheet connection failed: ' + e.toString());
    }
  }
}


// ── STEP 2: Test email only ───────────────────────────────────
function testWelcomeEmail() {
  try {
    sendWelcomeEmail('Test User', getSecret('ZOHO_EMAIL'));
    Logger.log('✅ EMAIL TEST SUCCESSFUL — check your Zoho inbox!');
  } catch (e) {
    Logger.log('❌ EMAIL TEST FAILED: ' + e.toString());
  }
}


// ── STEP 3: Test full flow (sheet + email together) ───────────
function testFullFlow() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name:      'Test Subscriber',
        email:     'test_' + Date.now() + '@example.com',
        company:   'Test Company',
        timestamp: new Date().toISOString()
      })
    }
  };
  Logger.log('Simulating a form submission...');
  const result = doPost(fakeEvent);
  Logger.log('Result: ' + result.getContent());
  Logger.log('✅ Check your Google Sheet for the new row!');
}


// ── DAILY HEALTH CHECK ────────────────────────────────────────
// Set a trigger: Triggers → Add Trigger → dailyHealthCheck
//   → Time-driven → Day timer → 8-9 AM
//
// Checks if the last welcome email failed and emails you a warning.
// This protects you if the Zoho token ever expires.
function dailyHealthCheck() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
                                .getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return; // no subscribers yet

    // Check the last few rows for email errors
    const lastRow = sheet.getLastRow();
    const checkRows = Math.min(5, lastRow - 1);
    const statuses = sheet.getRange(lastRow - checkRows + 1, 6, checkRows, 1)
                          .getValues().flat();

    const hasError = statuses.some(s => String(s).startsWith('Error') || String(s).startsWith('Err'));

    if (hasError) {
      MailApp.sendEmail({
        to:      'partner@31stfile.com',
        subject: '⚠️ 31stFile Newsletter — Zoho Email Sending Failed',
        body:    'The Zoho welcome email is failing for new subscribers.\n\n' +
                 'Latest statuses: ' + statuses.join(', ') + '\n\n' +
                 'WHAT TO DO:\n' +
                 '1. Go to api-console.zoho.in → Self Client → Generate Code\n' +
                 '2. Exchange for new tokens\n' +
                 '3. Update ZOHO_ACCESS_TOKEN and ZOHO_REFRESH_TOKEN in Script Properties\n' +
                 '4. Run setupMySecrets() again\n\n' +
                 'Sheet: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID
      });
      Logger.log('⚠️ Error detected — warning email sent to partner@31stfile.com');
    } else {
      Logger.log('✅ Daily health check passed — all recent emails sent successfully.');
    }
  } catch (e) {
    Logger.log('❌ Health check error: ' + e.toString());
  }
}


// ── Helper: read a credential from Script Properties ──────────
function getSecret(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error('Missing "' + key + '" — run setupMySecrets() first.');
  return val;
}


// ── Get valid access token (auto-refreshes if expired) ─────────
function getAccessToken() {
  const token = getSecret('ZOHO_ACCESS_TOKEN');

  // Quick validity check
  const testRes = UrlFetchApp.fetch(
    ZOHO_API_URL + '/api/accounts/' + getSecret('ZOHO_ACCOUNT_ID'),
    {
      headers: { 'Authorization': 'Zoho-oauthtoken ' + token },
      muteHttpExceptions: true
    }
  );

  if (testRes.getResponseCode() === 200) return token;

  // Token expired — refresh it
  Logger.log('Access token expired, refreshing...');
  return refreshAccessToken();
}


// ── Refresh the access token using the refresh token ──────────
function refreshAccessToken() {
  const params = {
    client_id:     getSecret('ZOHO_CLIENT_ID'),
    client_secret: getSecret('ZOHO_CLIENT_SECRET'),
    refresh_token: getSecret('ZOHO_REFRESH_TOKEN'),
    grant_type:    'refresh_token'
  };

  const query = Object.keys(params)
    .map(k => k + '=' + encodeURIComponent(params[k]))
    .join('&');

  const res = UrlFetchApp.fetch('https://accounts.zoho.in/oauth/v2/token', {
    method:      'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload:     query,
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  if (!data.access_token) {
    throw new Error('Token refresh failed: ' + res.getContentText());
  }

  PropertiesService.getScriptProperties().setProperty('ZOHO_ACCESS_TOKEN', data.access_token);
  Logger.log('✅ Access token refreshed successfully.');
  return data.access_token;
}


// ── Main POST handler (called when form is submitted) ──────────
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet with headers if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, 6)
           .setValues([['Timestamp', 'Name', 'Email', 'Company', 'Source', 'Email Sent?']])
           .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Duplicate email check
    const lastRow  = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat()
             .map(v => String(v).toLowerCase())
      : [];

    if (existing.includes(String(data.email).toLowerCase())) {
      return jsonResponse({ status: 'duplicate', message: 'Already subscribed.' });
    }

    // Try sending welcome email
    let emailSent = 'No';
    try {
      sendWelcomeEmail(data.name, data.email);
      emailSent = 'Yes';
    } catch (emailErr) {
      emailSent = 'Error: ' + emailErr.toString().substring(0, 120);
      Logger.log('Email error: ' + emailErr.toString());
    }

    // Save subscriber row
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name    || '',
      data.email   || '',
      data.company || '',
      'Landing Page',
      emailSent
    ]);

    return jsonResponse({ status: 'success', message: 'Subscribed!' });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}


// ── Send welcome email via Zoho Mail API ──────────────────────
function sendWelcomeEmail(name, email) {
  const firstName = name ? String(name).split(' ')[0] : 'there';
  const zAcc      = getSecret('ZOHO_ACCOUNT_ID');
  const zEmail    = getSecret('ZOHO_EMAIL');
  const authToken = getAccessToken();

  const url = ZOHO_API_URL + '/api/accounts/' + zAcc + '/messages';
  Logger.log('Sending to: ' + email + ' | Account: ' + zAcc);

  const payload = {
    fromAddress: zEmail,
    toAddress:   email,
    subject:     'Welcome to 31stFile Compliance Weekly, ' + firstName + '!',
    content:     buildWelcomeEmailHtml(firstName)
  };

  const res = UrlFetchApp.fetch(url, {
    method:             'POST',
    contentType:        'application/json',
    headers:            { 'Authorization': 'Zoho-oauthtoken ' + authToken },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  Logger.log('Zoho response ' + code + ': ' + res.getContentText());

  if (code !== 200) {
    throw new Error('Zoho API Error ' + code + ': ' + res.getContentText());
  }
}


// ── Build HTML welcome email ───────────────────────────────────
function buildWelcomeEmailHtml(firstName) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + 'body{margin:0;padding:0;background:#F0EDE8;font-family:Arial,sans-serif;}'
    + '.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(11,31,58,0.1);}'
    + '.hdr{background:#0B1F3A;padding:32px 40px;text-align:center;}'
    + '.hdr h1{color:#C9A84C;font-size:24px;margin:0 0 4px;letter-spacing:1px;}'
    + '.hdr p{color:rgba(255,255,255,0.5);font-size:12px;margin:0;letter-spacing:2px;text-transform:uppercase;}'
    + '.body{padding:36px 40px;}'
    + '.body h2{color:#0B1F3A;font-size:20px;margin:0 0 16px;}'
    + '.body p{color:#4A5568;font-size:14.5px;line-height:1.8;margin:0 0 14px;}'
    + '.body ul{padding-left:20px;color:#4A5568;font-size:14px;line-height:2.2;}'
    + '.btn-wrap{text-align:center;margin:28px 0;}'
    + '.btn{display:inline-block;background:#0B1F3A;color:#fff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;}'
    + '.ftr{background:#0B1F3A;padding:22px 40px;text-align:center;}'
    + '.ftr p{color:rgba(255,255,255,0.35);font-size:11px;line-height:1.8;margin:0;}'
    + '.ftr a{color:rgba(255,255,255,0.5);}'
    + '</style></head><body><div class="wrap">'
    + '<div class="hdr"><h1>31stFile</h1><p>Compliance Weekly</p></div>'
    + '<div class="body">'
    + '<h2>Hi ' + firstName + ', you\'re in! 🎉</h2>'
    + '<p>Thank you for subscribing to <strong>31stFile Compliance Weekly</strong> — India\'s CA-curated statutory compliance newsletter built for founders, CFOs, and finance teams.</p>'
    + '<p>Every <strong>Monday morning</strong>, your inbox will carry:</p>'
    + '<ul>'
    + '<li>⚖️ Key tribunal &amp; court rulings — GST, Income Tax, Companies Act</li>'
    + '<li>📅 Compliance due date reminders — never miss a filing again</li>'
    + '<li>📰 Regulatory &amp; legal updates decoded in plain language</li>'
    + '<li>💡 CA insights tailored for Indian startups &amp; SMEs</li>'
    + '</ul>'
    + '<div class="btn-wrap"><a href="https://31stfile.com" class="btn">Explore 31stFile Services →</a></div>'
    + '</div>'
    + '<div class="ftr"><p>You received this because you subscribed at <a href="https://31stfile.com">31stfile.com</a><br>'
    + '<a href="#">Unsubscribe</a> · © 2026 31stFile. All rights reserved.</p></div>'
    + '</div></body></html>';
}


// ── Helpers ───────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ status: 'active', service: '31stFile Newsletter API' });
}
