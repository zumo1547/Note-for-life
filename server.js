// Small local-only server for PDF.js modules. No installation or network account is needed.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const publicFiles = new Set(['index.html', 'styles.css', 'typography.css', 'app.js', 'pdf-reader.mjs', 'text-reader.mjs', 'fonts/IBMPlexSansThai-Regular.ttf', 'fonts/IBMPlexSansThai-Medium.ttf', 'fonts/IBMPlexSansThai-Bold.ttf', 'fonts/OFL.txt', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']);
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
  if (!publicFiles.has(path.relative(root, target).replaceAll('\\', '/'))) { response.writeHead(404).end('Not found'); return; }
  fs.stat(target, (error, stats) => {
    if (error || !stats.isFile()) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': stats.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(target).pipe(response);
  });
});
server.on('error', error => { console.error(`เปิดเว็บไม่สำเร็จ: ${error.message}`); process.exitCode = 1; });
server.listen(8765, '127.0.0.1', () => console.log('เปิดแอปที่ http://127.0.0.1:8765/\nกด Ctrl+C เพื่อปิดเซิร์ฟเวอร์'));
