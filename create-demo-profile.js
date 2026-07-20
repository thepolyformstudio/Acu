const https = require('https');

const API_KEY = 'AIzaSyAw3KNaLua9tXBoJaBa7k8NfEJ0Q14NAcw';
const PROJECT_ID = 'acu1-9f3e8';
const EMAIL = 'demo@acudemo.com';
const PASSWORD = 'Demo123!';

function post(url, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...extraHeaders },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b || '{}') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // Step 1: Sign in and get ID token
  const signIn = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { email: EMAIL, password: PASSWORD, returnSecureToken: true }
  );
  if (signIn.status !== 200) {
    console.error('Sign-in failed:', signIn.body.error?.message);
    process.exit(1);
  }
  const { idToken, localId } = signIn.body;
  console.log('Signed in as:', localId);

  // Step 2: Create Firestore profile
  const now = Date.now();
  const doc = {
    fields: {
      email: { stringValue: EMAIL },
      role: { stringValue: 'student' },
      is_premium: { booleanValue: false },
      is_suspended: { booleanValue: false },
      created_at: { integerValue: String(now) },
      last_active: { integerValue: String(now) },
    }
  };
  const result = await post(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/profiles?documentId=${localId}`,
    doc,
    { Authorization: `Bearer ${idToken}` }
  );
  console.log('Firestore response status:', result.status);
  if (result.status === 200) {
    console.log('Profile created:', result.body.name);
  } else {
    console.error('Firestore error:', result.status, result.body.error?.message);
  }
})().catch(console.error);
