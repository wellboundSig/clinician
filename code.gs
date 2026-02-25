// ============================================================
// Google Apps Script — Signatures Clinician
// Deploy as Web App: Execute as "Me", Access "Anyone"
// ============================================================
//
// SETUP:
//   1. Open your "Signatures Clinician" Google Sheet
//   2. Extensions → Apps Script → paste this code
//   3. Make sure your sheet has headers in Row 1:
//      A: First Name | B: Last Name | C: Discipline | D: Phone | E: Email
//   4. Deploy → New deployment → Web app
//        Execute as: Me
//        Who has access: Anyone
//   5. Copy the Web App URL and paste it into:
//        - generator/script.js  (APPS_SCRIPT_URL)
//        - field/script.js      (APPS_SCRIPT_URL)
// ============================================================

var SHEET_NAME = 'Sheet1'; // Change if your tab has a different name

// ---- GET: Return all signatures as JSON ----
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    var data = sheet.getDataRange().getValues();

    // Row 0 = headers, rows 1+ = data
    var signatures = [];
    for (var i = 1; i < data.length; i++) {
      var firstName = (data[i][0] || '').toString().trim();
      var lastName  = (data[i][1] || '').toString().trim();
      var discipline = (data[i][2] || '').toString().trim();
      var phone     = (data[i][3] || '').toString().trim();
      var email     = (data[i][4] || '').toString().trim();

      if (!firstName && !lastName) continue;

      var key = (lastName + '-' + firstName).toUpperCase().replace(/\s+/g, '-');

      var content = firstName + ' ' + lastName + '\n'
                  + discipline + '\n'
                  + 'Wellbound Certified Home Health Agency' + '\n'
                  + 'Phone | ' + phone + '\n'
                  + 'Email | ' + email;

      signatures.push({ key: key, content: content });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ signatures: signatures }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---- POST: Add a new signature row ----
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);

    var firstName  = (params.firstName  || '').trim();
    var lastName   = (params.lastName   || '').trim();
    var discipline = (params.discipline || '').trim();
    var phone      = (params.phone      || '').trim();
    var email      = (params.email      || '').trim();

    if (!firstName || !lastName) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Name is required' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    sheet.appendRow([firstName, lastName, discipline, phone, email]);

    var content = firstName + ' ' + lastName + '\n'
                + discipline + '\n'
                + 'Wellbound Certified Home Health Agency' + '\n'
                + 'Phone | ' + phone + '\n'
                + 'Email | ' + email;

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, signature: content }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
