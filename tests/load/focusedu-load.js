import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.FOCUSEDU_LOAD_BASE_URL;
const supabaseUrl = __ENV.FOCUSEDU_LOAD_SUPABASE_URL;
const publishableKey = __ENV.FOCUSEDU_LOAD_SUPABASE_PUBLISHABLE_KEY;
const authToken = __ENV.FOCUSEDU_LOAD_AUTH_TOKEN;

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: Number(__ENV.FOCUSEDU_LOAD_VUS || 2),
      duration: __ENV.FOCUSEDU_LOAD_DURATION || '1m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:read}': ['p(95)<800'],
    'http_req_duration{kind:auth_read}': ['p(95)<800'],
  },
};

function headers(authenticated = false) {
  return {
    apikey: publishableKey,
    ...(authenticated && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export function setup() {
  if (
    __ENV.FOCUSEDU_LOAD_ENVIRONMENT !== 'staging' ||
    !baseUrl ||
    baseUrl !== __ENV.FOCUSEDU_LOAD_CONFIRMED_STAGING_URL
  ) {
    throw new Error('Set staging environment and exact confirmed staging URL before load testing');
  }
  if (!supabaseUrl || !publishableKey || !authToken)
    throw new Error('Staging Supabase URL, public key and test user token required');
}

export default function () {
  const home = http.get(baseUrl, { tags: { kind: 'read' } });
  check(home, {
    'frontend is available': (response) => response.status === 200,
    'frontend has app root': (response) => response.body.includes('<div id="root">'),
  });

  if (supabaseUrl && publishableKey) {
    const anonProjects = http.get(`${supabaseUrl}/rest/v1/projects?select=id&limit=1`, {
      headers: headers(),
      responseCallback: http.expectedStatuses(401, 403),
      tags: { kind: 'read' },
    });
    check(anonProjects, {
      'anon project read is denied': (response) => [401, 403].includes(response.status),
    });

    if (authToken) {
      const profile = http.get(`${supabaseUrl}/auth/v1/user`, {
        headers: headers(true),
        tags: { kind: 'auth_read' },
      });
      check(profile, {
        'auth token is valid': (response) => response.status === 200,
      });
    }
  }

  sleep(1);
}
