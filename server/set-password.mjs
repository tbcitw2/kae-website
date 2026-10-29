// Set or change the admin password.
// Usage: node server/set-password.mjs            (asks for it, hidden)
//        node server/set-password.mjs --random   (generates one and saves it to data/admin-password.txt)
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './password.mjs';

const dataDir = process.env.KAE_DATA_DIR || join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'data');

// Hidden prompt on a terminal; plain line reading when piped (echo pw | node server/set-password.mjs).
let piped;
function ask(prompt) {
  if (!process.stdin.isTTY) {
    piped ??= new Promise(done => { let all = ''; process.stdin.on('data', c => (all += c)).on('end', () => done(all.split(/\r?\n/))); });
    return piped.then(lines => lines.shift() ?? '');
  }
  return new Promise(done => {
    process.stdout.write(prompt);
    const stdin = process.stdin; let pw = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    stdin.on('data', function onKey(chunk) {
      for (const ch of chunk) {                       // a paste arrives as one chunk
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode(false); stdin.pause(); stdin.off('data', onKey); process.stdout.write('\n'); return done(pw);
        }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f') pw = pw.slice(0, -1); else pw += ch;
      }
    });
  });
}

await mkdir(dataDir, { recursive: true });
let pw;
if (process.argv.includes('--random')) {
  pw = randomBytes(9).toString('base64url');
  await writeFile(join(dataDir, 'admin-password.txt'), pw + '\n', { mode: 0o600 });
  console.log(`Generated a password and saved it to ${join(dataDir, 'admin-password.txt')}`);
} else {
  pw = await ask('New admin password (min 8 characters): ');
  if (pw.length < 8) { console.error('Too short.'); process.exit(1); }
  if ((await ask('Repeat it: ')) !== pw) { console.error('They don’t match.'); process.exit(1); }
}
await writeFile(join(dataDir, 'admin.json'), JSON.stringify({ hash: await hashPassword(pw) }, null, 2), { mode: 0o600 });
console.log('Admin password saved. Log in at /admin/');
