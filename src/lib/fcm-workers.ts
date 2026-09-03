// src/lib/fcm-workers.ts
// Sends FCM v1 push notifications using only fetch + crypto.subtle.
// No firebase-admin — works identically on Vercel's Node runtime and on Cloudflare Workers.

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id: string
}

function base64url(input: string | ArrayBuffer): string {
  let str: string
  if (typeof input === 'string') {
    str = btoa(unescape(encodeURIComponent(input)))
  } else {
    const bytes = new Uint8Array(input)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    str = btoa(binary)
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    // Remove literal "\n" (backslash + n as two characters) as a unit FIRST.
    // Doing the general character strip alone would delete the backslash
    // but keep the 'n' (it's a valid base64 letter), leaving stray 'n'
    // characters scattered through the key at every line break.
    .replace(/\\n/g, '')
    // Now strip anything else that isn't valid base64 (real newlines,
    // spaces, quotes, etc).
    .replace(/[^A-Za-z0-9+/=]/g, '')

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`

  const privateKey = await importPrivateKey(serviceAccount.private_key)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken),
  )

  const jwt = `${unsignedToken}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to get FCM access token: ${res.status} ${errText}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export type FcmMessage = {
  token: string
  notification?: { title: string; body: string }
  data?: Record<string, string>
  android?: { priority?: 'normal' | 'high'; ttl?: string }
}

export async function sendFcmMessage(
  serviceAccount: ServiceAccount,
  message: FcmMessage,
): Promise<{ name: string }> {
  const accessToken = await getAccessToken(serviceAccount)
  const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  })

  const responseBody = await res.json()

  if (!res.ok) {
    // Surface FCM's real error string (UNREGISTERED, INVALID_ARGUMENT, NOT_FOUND, etc.)
    throw new Error(`FCM_ERROR ${res.status}: ${JSON.stringify(responseBody)}`)
  }

  return responseBody as { name: string }
}

export function getServiceAccountFromEnv(): ServiceAccount {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing one of FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars',
    )
  }

  // No need to pre-process newlines here — importPrivateKey() strips
  // everything except valid base64 characters, so it doesn't matter
  // whether this env var has real newlines, literal "\n" text, or none.
  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  }
}