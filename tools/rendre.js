// Rend un SVG d'un fichier HTML de tools/ en PNG transparent.
// usage : node tools/rendre.js tools/placeholder.html placeholder img/placeholder.png
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [fichier, id, sortie] = process.argv.slice(2);
  if (!fichier || !id || !sortie) {
    console.error('usage: node tools/rendre.js <fichier.html> <id-du-svg> <sortie.png>');
    process.exit(1);
  }
  const nav = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await nav.newPage({ viewport: { width: 1300, height: 700 } });
  await page.goto('file://' + path.resolve(fichier));
  await page.locator('#' + id).screenshot({ path: sortie, omitBackground: true });
  console.log('rendu:', sortie);
  await nav.close();
})().catch((e) => { console.error('ECHEC:', e.message); process.exit(1); });
