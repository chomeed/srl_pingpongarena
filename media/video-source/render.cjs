const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, mode, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/scene.html');
  const total = await p.evaluate(() => TOTAL);
  if (mode === 'preview') {
    const times = [3, 9, 18, 27, 35, 44, 52, 59, 64];
    for (const t of times) {
      const url = await p.evaluate(t => { draw(t); return document.getElementById('c').toDataURL('image/png'); }, t);
      fs.writeFileSync(`${out}/prev-${t}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  } else {
    const fps = 30, n = Math.round(total * fps);
    fs.mkdirSync(out, { recursive: true });
    for (let i = 0; i < n; i += 30) {
      const urls = await p.evaluate(([i, n, fps]) => { const r = []; for (let k = i; k < Math.min(i + 30, n); k++) { draw(k / fps); r.push(document.getElementById('c').toDataURL('image/jpeg', .92)); } return r; }, [i, n, fps]);
      urls.forEach((u, k) => fs.writeFileSync(`${out}/f${String(i + k).padStart(5, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
    }
    console.log('frames', n);
  }
  console.log('total', total, 'errors', errs); await b.close();
})();
