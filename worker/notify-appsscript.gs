// Runs in the owner's Google account (script.google.com). Receives a POST from the
// ift-intake Worker and emails the summary to the owner. Deploy as a Web app:
// Execute as: Me, Who has access: Anyone. Put the shared key below in place of __KEY__.
const KEY = '__KEY__';
const TO = 'jmizrahi99@gmail.com';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.key !== KEY) return out({ ok: false });
    MailApp.sendEmail({ to: TO, subject: String(d.subject).slice(0, 150), body: String(d.body), name: 'Instant Funding Today' });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
