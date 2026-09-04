import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { sleep } from '../shared/util.js';
import {
  OLJ_BASE_URL,
  OLJ_V2_BASE_URL,
  classifyOljLoginFailure,
  extractApplyPoints,
  extractErrorSnippet,
  extractOljCsrfToken,
  isCloudflareChallenge,
  oljFollowRedirects,
} from './http.js';
import type { OljCookieJar } from './http.js';

export type OljLoginDebug = {
  authStatus?: number;
  authFinalUrl?: string | null;
  authHops?: string[];
  balanceSource?: string | null;
  ssrAttempts?: { url: string; status: number | null; finalUrl?: string | null }[];
  snippet?: string | null;
};

export type OljLoginResult = {
  ok: boolean;
  pointsBalance: number | null;
  detail: string;
  debug?: OljLoginDebug;
};

function redactOljSecrets(value: string): string {
  return value.replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[redacted]"');
}

export async function runOljLogin(): Promise<OljLoginResult> {
  const email = process.env.OLJ_EMAIL;
  const password = process.env.OLJ_PASSWORD;

  if (!email || !password) {
    throw new Error('OLJ_EMAIL or OLJ_PASSWORD secret is not set');
  }

  const jar: OljCookieJar = new Map();

  const loginPage = await oljFollowRedirects(jar, `${OLJ_BASE_URL}/login`, {
    referer: `${OLJ_BASE_URL}/`,
  });

  if (isCloudflareChallenge(loginPage.status, loginPage.body)) {
    throw new Error(`Cloudflare challenged the login page request (status ${loginPage.status})`);
  }
  if (loginPage.status < 200 || loginPage.status >= 300) {
    throw new Error(`Login page unreachable (status ${loginPage.status})`);
  }

  const csrfToken = extractOljCsrfToken(loginPage.body);
  if (!csrfToken) throw new Error('CSRF token not found on login page');

  const auth = await oljFollowRedirects(jar, `${OLJ_BASE_URL}/authenticate`, {
    method: 'POST',
    body: new URLSearchParams({
      'csrf-token': csrfToken,
      'info[email]': email,
      'info[password]': password,
      login: 'Login →',
    }).toString(),
    referer: `${OLJ_BASE_URL}/login`,
  });
  const authHtml = auth.body;

  if (isCloudflareChallenge(auth.status, authHtml)) {
    throw new Error(`Cloudflare challenge intercepted the login request (status ${auth.status})`);
  }

  const authFormReServed =
    authHtml.includes('info[email]') && authHtml.includes('info[password]');
  let loggedIn = auth.status === 200 && !auth.finalUrl.includes('/login') && !authFormReServed;

  const debug: OljLoginDebug = {
    authStatus: auth.status,
    authFinalUrl: auth.finalUrl,
    authHops: auth.hops,
  };

  if (!loggedIn) {
    debug.snippet = redactOljSecrets(extractErrorSnippet(authHtml) ?? '');
    console.error('OnlineJobs.ph login diagnostics:', JSON.stringify(debug));
    return {
      ok: false,
      pointsBalance: null,
      detail: classifyOljLoginFailure(authHtml),
      debug,
    };
  }

  let pointsBalance: number | null = null;
  let balanceSource: string | null = null;

  const DASHBOARD_PATH = '/api/redirects/to-account-dashboard';
  debug.ssrAttempts = [];

  try {
    const dashboard = await oljFollowRedirects(
      jar,
      `${OLJ_V2_BASE_URL}${DASHBOARD_PATH}`,
      { referer: `${OLJ_V2_BASE_URL}/` },
    );
    debug.ssrAttempts.push({
      url: DASHBOARD_PATH,
      status: dashboard.status,
      finalUrl: dashboard.finalUrl,
    });

    pointsBalance = extractApplyPoints(dashboard.body);
    if (pointsBalance !== null) {
      balanceSource = `ssr:${DASHBOARD_PATH}`;
    }
  } catch (error) {
    debug.ssrAttempts.push({
      url: DASHBOARD_PATH,
      status: null,
      finalUrl: redactOljSecrets((error as Error).message.slice(0, 120)),
    });
  }

  debug.balanceSource = balanceSource;

  return {
    ok: true,
    pointsBalance,
    detail: `Authenticated (${balanceSource ?? 'balance not located'})`,
    debug,
  };
}

export const OLJ_POINTS_CAP = 60;

const OLJ_LOGIN_LOG_DOC = 'latest';

export async function recordOljLogin(result: OljLoginResult): Promise<void> {
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const ref = db.collection('oljLoginLogs').doc(OLJ_LOGIN_LOG_DOC);

  const snapshot = await ref.get();
  const current = snapshot.data();
  const isNewDay = current?.date !== date;
  const previousBalance =
    isNewDay && typeof current?.pointsBalance === 'number' ? current.pointsBalance : (current?.previousBalance ?? null);

  const doc: Record<string, unknown> = {
    date,
    status: result.ok ? 'success' : 'failed',
    pointsBalance: result.pointsBalance,
    previousBalance,
    atCap: result.pointsBalance !== null && result.pointsBalance >= OLJ_POINTS_CAP,
    ranAt: Timestamp.now(),
  };

  if (!result.ok) {
    doc.detail = result.detail;
    doc.debug = result.debug ?? null;
  }

  await ref.set(doc);
}

export const oljDailyLogin = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Manila',
    memory: '256MiB',
    timeoutSeconds: 300,
    secrets: ['OLJ_EMAIL', 'OLJ_PASSWORD'],
  },
  async () => {
    const jitterMs = Math.floor(Math.random() * 120_000);
    console.log(`OnlineJobs.ph daily login starting in ${Math.round(jitterMs / 1000)}s`);
    await sleep(jitterMs);

    try {
      const result = await runOljLogin();
      console.log(
        `OnlineJobs.ph login ${result.ok ? 'succeeded' : 'failed'}: ${result.detail} (balance: ${result.pointsBalance ?? 'unknown'})`,
      );
      console.log(`OnlineJobs.ph diagnostics: ${JSON.stringify(result.debug ?? {})}`);
      await recordOljLogin(result);
      if (!result.ok) throw new Error(`OnlineJobs.ph daily login failed: ${result.detail}`);
    } catch (error) {
      console.error('❌ OnlineJobs.ph daily login error:', error);
      throw error;
    }
  },
);

export const oljLoginNow = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: ['OLJ_EMAIL', 'OLJ_PASSWORD', 'OWNER_UID'],
  },
  async (request) => {
    const ownerUid = process.env.OWNER_UID;

    if (!ownerUid) {
      throw new HttpsError('failed-precondition', 'OWNER_UID secret is not set on the backend');
    }

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    if (request.auth.uid !== ownerUid) {
      throw new HttpsError('permission-denied', 'You do not have permission to run this login.');
    }

    try {
      const result = await runOljLogin();
      await recordOljLogin(result);

      if (!result.ok) {
        throw new HttpsError('internal', `OnlineJobs.ph login failed: ${result.detail}`);
      }

      return {
        ok: true,
        pointsBalance: result.pointsBalance,
        detail: result.detail,
        debug: result.debug ?? null,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('❌ OnlineJobs.ph manual login error:', error);
      throw new HttpsError('internal', (error as Error)?.message ?? 'OnlineJobs.ph login crashed');
    }
  },
);
