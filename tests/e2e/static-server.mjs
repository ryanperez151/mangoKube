import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'out');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function candidates(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/\\/g, '/');
  const clean = decoded === '/' ? '/index.html' : decoded.replace(/\/$/, '');
  if (extname(clean)) return [clean];
  return [`${clean}.html`, `${clean}/index.html`];
}

async function findFile(pathname) {
  for (const candidate of candidates(pathname)) {
    const absolute = resolve(root, `.${candidate}`);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) continue;
    try {
      if ((await stat(absolute)).isFile()) return absolute;
    } catch {}
  }
  return null;
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const file = await findFile(pathname);
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': types[extname(file)] ?? 'application/octet-stream',
  });
  response.end(await readFile(file));
});

server.listen(43175, '127.0.0.1');
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
