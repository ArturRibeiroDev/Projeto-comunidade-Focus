import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const forbidden =
  /service_role|DISCORD_BOT_TOKEN|DISCORD_CLIENT_SECRET|DISCORD_WORKER_SECRET|SUPABASE_SERVICE_ROLE_KEY|DB_PASSWORD|DATABASE_PASSWORD|SMTP_PASSWORD|sb_secret_[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const env = loadEnv('production', process.cwd(), '');
const privateValues = Object.entries(env)
  .filter(
    ([key, value]) =>
      /(?:SECRET|PASSWORD|SERVICE_ROLE|BOT_TOKEN|SMTP.*KEY|DATABASE_URL|DB_URL)/i.test(key) &&
      value.length >= 8,
  )
  .map(([, value]) => value);
let failures = 0;
let files = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    files++;
    const content = readFileSync(path).toString('utf8');
    const privilegedJwt = [
      ...content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g),
    ].some((match) => {
      try {
        return JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role';
      } catch {
        return false;
      }
    });
    if (
      forbidden.test(content) ||
      privilegedJwt ||
      privateValues.some((value) => content.includes(value))
    ) {
      console.error(`FAIL sensitive content in ${path}`);
      failures++;
    }
  }
}
scan('dist');
if (failures) process.exitCode = 1;
else
  console.log(
    `PASS dist secret scan: ${files} files; no forbidden names, credential patterns or known private env values`,
  );
