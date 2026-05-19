import { getSupabaseEnv, handleCors, jsonResponse, readJsonBody, requireAuthenticatedUser, requirePost } from '../_shared/http.ts';

const premiumProductIds = new Set([
  'yourfriends_premium_monthly',
  'yourfriends_premium_6_months',
  'yourfriends_premium_yearly',
]);

const appleProductionBaseUrl = 'https://api.storekit.itunes.apple.com';
const appleSandboxBaseUrl = 'https://api.storekit-sandbox.itunes.apple.com';

interface AppleTransactionInfo {
  appAccountToken?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  originalTransactionId?: string;
  productId?: string;
  transactionId?: string;
  type?: string;
}

interface AppleTransactionLookup {
  environment: 'Production' | 'Sandbox';
  transaction: AppleTransactionInfo;
  signedTransactionInfo: string;
}

interface JwtHeader {
  alg: 'ES256';
  kid: string;
  typ: 'JWT';
}

interface JwtPayload {
  iss: string;
  iat: number;
  exp: number;
  aud: 'appstoreconnect-v1';
  bid: string;
}

const textEncoder = new TextEncoder();

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Purchase validation is not configured.' }, 501);

  const appleConfig = getAppleConfig();
  if (!appleConfig.ok) return jsonResponse({ error: appleConfig.error }, 501);

  const auth = await requireAuthenticatedUser(req, 'Sign in before purchasing.');
  if (!auth.ok) return auth.response;
  const { admin, user } = auth;
  const userId = user.id;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const payload = body.value;

  const purchase = payload?.purchase ?? {};
  const requestedProductId = cleanString(payload?.productId || purchase.productId || purchase.id, 120);
  if (!premiumProductIds.has(requestedProductId)) return jsonResponse({ error: 'Unknown Premium product.' }, 400);

  const transactionId = cleanString(purchase.transactionId || purchase.id || purchase.originalTransactionIdIOS, 160);
  if (!transactionId) return jsonResponse({ error: 'Missing Apple transaction ID.' }, 400);

  const lookup = await lookupAppleTransaction(transactionId, appleConfig.value);
  if (!lookup.ok) return jsonResponse({ error: lookup.error }, 402);

  const transaction = lookup.value.transaction;
  if (transaction.bundleId !== appleConfig.value.bundleId) return jsonResponse({ error: 'Purchase was made for a different app.' }, 400);
  if (transaction.productId !== requestedProductId || !premiumProductIds.has(transaction.productId ?? '')) {
    return jsonResponse({ error: 'Purchase product did not match Premium.' }, 400);
  }

  const expirationMs = Number(transaction.expiresDate ?? 0);
  if (!Number.isFinite(expirationMs) || expirationMs <= Date.now()) {
    return jsonResponse({ error: 'Premium subscription is not active.' }, 402);
  }
  const premiumUntil = new Date(expirationMs).toISOString();

  const { error: profileError } = await admin
    .from('profiles')
    .update({ premium_until: premiumUntil })
    .eq('id', userId);
  if (profileError) return jsonResponse({ error: profileError.message }, 500);

  await admin.from('premium_purchase_events').upsert({
    user_id: userId,
    product_id: transaction.productId,
    transaction_id: transaction.transactionId || transactionId,
    purchase_token: transaction.originalTransactionId ?? null,
    platform: 'ios',
    premium_until: premiumUntil,
    raw_purchase: {
      clientPurchase: purchase,
      appleEnvironment: lookup.value.environment,
      signedTransactionInfo: lookup.value.signedTransactionInfo,
      transaction,
    },
    validated_at: new Date().toISOString(),
  }, { onConflict: 'transaction_id' });

  return jsonResponse({ premiumUntil });
});

async function lookupAppleTransaction(transactionId: string, config: AppleConfig) {
  const jwt = await createAppleServerJwt(config);
  const production = await fetchAppleTransaction(appleProductionBaseUrl, transactionId, jwt);
  if (production.ok) return { ok: true as const, value: { ...production.value, environment: 'Production' as const } };

  const sandbox = await fetchAppleTransaction(appleSandboxBaseUrl, transactionId, jwt);
  if (sandbox.ok) return { ok: true as const, value: { ...sandbox.value, environment: 'Sandbox' as const } };

  return { ok: false as const, error: sandbox.error ?? production.error ?? 'Apple could not validate this purchase.' };
}

async function fetchAppleTransaction(baseUrl: string, transactionId: string, jwt: string) {
  const response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    return { ok: false as const, error: `Apple validation failed (${response.status}).` };
  }
  const body = await response.json();
  const signedTransactionInfo = cleanString(body?.signedTransactionInfo, 20000);
  if (!signedTransactionInfo) return { ok: false as const, error: 'Apple did not return transaction info.' };
  return {
    ok: true as const,
    value: {
      signedTransactionInfo,
      transaction: decodeAppleTransactionInfo(signedTransactionInfo),
    },
  };
}

function decodeAppleTransactionInfo(jws: string): AppleTransactionInfo {
  const payload = jws.split('.')[1] ?? '';
  if (!payload) return {};
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  } catch {
    return {};
  }
}

interface AppleConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

function getAppleConfig() {
  const issuerId = Deno.env.get('APPLE_IAP_ISSUER_ID') ?? '';
  const keyId = Deno.env.get('APPLE_IAP_KEY_ID') ?? '';
  const privateKey = (Deno.env.get('APPLE_IAP_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
  const bundleId = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.yourfriends.app';
  if (!issuerId || !keyId || !privateKey || !bundleId) {
    return { ok: false as const, error: 'Apple purchase validation secrets are not configured.' };
  }
  return { ok: true as const, value: { issuerId, keyId, privateKey, bundleId } };
}

async function createAppleServerJwt(config: AppleConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header: JwtHeader = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload: JwtPayload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 900,
    aud: 'appstoreconnect-v1',
    bid: config.bundleId,
  };
  const unsignedJwt = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, textEncoder.encode(unsignedJwt));
  return `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function base64UrlJson(value: Record<string, unknown>) {
  return base64UrlEncode(textEncoder.encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  return base64ToBytes(base64).buffer;
}

function base64UrlToBytes(value: string) {
  return base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/'));
}

function base64ToBytes(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64UrlEncode(value: Uint8Array) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

