// ============================================================
//  31stFile Newsletter — Google Apps Script Backend (COMPLETE)
//  ──────────────────────────────────────────────────────────
//  HOW TO USE:
//  Step 1 → Select "setupMySecrets"   → click Run  (do once)
//  Step 2 → Select "testWelcomeEmail" → click Run  (verify it works)
//  Step 3 → Deploy as Web App (New Version) → done!
// ============================================================

const SHEET_NAME     = '31stFile Subscribers';
const ZOHO_REGION    = 'mail.zoho.in';
const ZOHO_API_URL   = 'https://mail.zoho.in';
// ✅ Direct link to your Google Sheet — needed for standalone scripts
const SPREADSHEET_ID = '1edVQEgcpz6xMu8yMLuUMCKIFWaPVXAapMpUfsum7tT0';

// ── STEP 1: Run this ONCE to save all credentials ─────────────
function setupMySecrets() {
  PropertiesService.getScriptProperties().setProperties({
    'ZOHO_EMAIL':         'partner@31stfile.com',
    'ZOHO_ACCOUNT_ID':    '1149820000000002002',
    'ZOHO_ACCESS_TOKEN':  '1000.0edb24411ba6516ca0acc72fc197ba74.ad2425e007ed841e4029beead1b67d05',
    'ZOHO_REFRESH_TOKEN': '1000.c4ad2b0f1b712791639f7902d9c1c7ba.1b5d628e9512764e48074f654e1c6187',
    'ZOHO_CLIENT_ID':     '1000.42SLEGBL0CR4ZJIMGL1A9RNZP8FXEY',
    'ZOHO_CLIENT_SECRET': 'a67ce77388ba1b3b02b1dc89073c1497d11f147519'
  });
  Logger.log('✅ Credentials saved!');
  Logger.log('Sheet ID in use: ' + SPREADSHEET_ID);
  // Quick test: verify we can open the sheet
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ Sheet connected: ' + ss.getName());
  } catch(e) {
    Logger.log('❌ Sheet connection failed: ' + e.toString());
  }
}

// ── STEP 2: Run this ONCE to auto-detect your real Account ID ─
// Uses a different endpoint that only needs messages.CREATE scope
function findAndSaveAccountId() {
  try {
    const token = getAccessToken();

    // Try fetching folders — this endpoint works with messages.CREATE scope
    // and returns the accountId in the URL structure
    const res = UrlFetchApp.fetch(ZOHO_API_URL + '/api/accounts/self', {
      headers: { 'Authorization': 'Zoho-oauthtoken ' + token },
      muteHttpExceptions: true
    });
    Logger.log('Self endpoint response: ' + res.getContentText());

    const json = JSON.parse(res.getContentText());

    // Try to extract accountId from various response formats
    let accountId = null;
    if (json.data && json.data.accountId) {
      accountId = json.data.accountId;
    } else if (json.accountId) {
      accountId = json.accountId;
    }

    if (accountId) {
      PropertiesService.getScriptProperties().setProperty('ZOHO_ACCOUNT_ID', accountId);
      Logger.log('✅ Found and saved Account ID: ' + accountId);
      Logger.log('Now run "testWelcomeEmail".');
    } else {
      // If auto-detection fails, guide user to find it manually
      Logger.log('⚠️ Auto-detection did not work. Full response: ' + res.getContentText());
      Logger.log('');
      Logger.log('MANUAL STEPS to find your Account ID:');
      Logger.log('1. Open https://mail.zoho.in in your browser (while logged in)');
      Logger.log('2. Open browser DevTools → Network tab → refresh the page');
      Logger.log('3. Look for any API request URL containing /api/accounts/XXXXXXXXX/');
      Logger.log('4. The long number in that URL is your Account ID');
      Logger.log('5. Run setAccountIdManually("PASTE_ID_HERE") with that number');
    }
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}

// ── Run this if you found your Account ID manually ────────────
function setAccountIdManually(id) {
  if (!id) {
    Logger.log('⚠️ Pass your account ID: setAccountIdManually("YOUR_ID_HERE")');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('ZOHO_ACCOUNT_ID', id);
  Logger.log('✅ Account ID saved: ' + id + '. Now run testWelcomeEmail.');
}

// ── STEP 3: Run this to test email only ───────────────────────
function testWelcomeEmail() {
  try {
    sendWelcomeEmail('Test User', getSecret('ZOHO_EMAIL'));
    Logger.log('✅ EMAIL TEST SUCCESSFUL — check your Zoho inbox!');
  } catch (e) {
    Logger.log('❌ EMAIL TEST FAILED: ' + e.toString());
  }
}

// ── STEP 4: Run this to test the FULL flow (sheet + email) ────
// This simulates exactly what happens when someone submits the form
function testFullFlow() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name:      'Test Subscriber',
        email:     'test_' + Date.now() + '@example.com', // unique so it's never duplicate
        company:   'Test Company',
        timestamp: new Date().toISOString()
      })
    }
  };

  Logger.log('Simulating a form submission...');
  const result = doPost(fakeEvent);
  Logger.log('doPost result: ' + result.getContent());
  Logger.log('✅ Check your Google Sheet — a new row should appear!');
}

// ── Helper: read a credential from Script Properties ──────────
function getSecret(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error('Missing "' + key + '" — please run setupMySecrets() first.');
  return val;
}

// ── Get a valid access token (auto-refreshes if expired) ───────
function getAccessToken() {
  // Try current token first
  const token = getSecret('ZOHO_ACCESS_TOKEN');

  // Quick validity check by testing a lightweight API call
  const testRes = UrlFetchApp.fetch(
    ZOHO_API_URL + '/api/accounts/' + getSecret('ZOHO_ACCOUNT_ID'),
    {
      headers: { 'Authorization': 'Zoho-oauthtoken ' + token },
      muteHttpExceptions: true
    }
  );

  // If token is still valid, return it
  if (testRes.getResponseCode() === 200) return token;

  // Token expired — use refresh token to get a new one
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

  const query = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');

  const res = UrlFetchApp.fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: query,
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  if (!data.access_token) {
    throw new Error('Token refresh failed: ' + res.getContentText());
  }

  // Save the new access token
  PropertiesService.getScriptProperties().setProperty('ZOHO_ACCESS_TOKEN', data.access_token);
  Logger.log('✅ Access token refreshed successfully.');
  return data.access_token;
}

// ── Main POST handler (called when landing page form submits) ──
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    // ✅ FIXED: use openById() — getActiveSpreadsheet() returns null in web app context
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet  = ss.getSheetByName(SHEET_NAME);

    // Create sheet with headers if it doesn't exist yet
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, 6)
           .setValues([['Timestamp', 'Name', 'Email', 'Company', 'Source', 'Email Sent?']])
           .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Duplicate email check
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat().map(v => String(v).toLowerCase())
      : [];
    if (existing.includes(String(data.email).toLowerCase())) {
      return jsonResponse({ status: 'duplicate', message: 'Already subscribed.' });
    }

    // Send welcome email
    let emailSent = 'No';
    try {
      sendWelcomeEmail(data.name, data.email);
      emailSent = 'Yes';
    } catch (emailErr) {
      emailSent = 'Error: ' + emailErr.toString().substring(0, 120);
      Logger.log('Email error: ' + emailErr.toString());
    }

    // Save subscriber row to sheet
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

// ── Send welcome email via Zoho Mail API (OAuth) ───────────────
function sendWelcomeEmail(name, email) {
  const firstName  = name ? String(name).split(' ')[0] : 'there';
  const zAcc       = getSecret('ZOHO_ACCOUNT_ID');
  const zEmail     = getSecret('ZOHO_EMAIL');
  const authToken  = getAccessToken(); // auto-refreshes if expired

  const url = ZOHO_API_URL + '/api/accounts/' + zAcc + '/messages';
  Logger.log('Sending to URL: ' + url);
  Logger.log('From: ' + zEmail + ' | To: ' + email + ' | Account: ' + zAcc);

  // Only the 4 fields Zoho accepts
  const payload = {
    fromAddress: zEmail,
    toAddress:   email,
    subject:     'Welcome to 31stFile Compliance Weekly, ' + firstName + '!',
    content:     buildWelcomeEmailHtml(firstName)
  };

  const res = UrlFetchApp.fetch(url, {
    method:      'POST',
    contentType: 'application/json',
    headers:     { 'Authorization': 'Zoho-oauthtoken ' + authToken },
    payload:     JSON.stringify(payload),
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ status: 'active', service: '31stFile Newsletter API v4' });
}
