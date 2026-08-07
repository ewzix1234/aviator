// tests/game.test.js
const assert = require('assert');
const G = require('../game.js');

const mem = (init) => ({ d: init, getItem(k){ return this.d; }, setItem(k, v){ this.d = v; } });
const neuf = () => G.chargerDonnees(mem(null));
// Les dépôts sont bridés à 10 € (et seulement à sec) : pour les scénarios qui ont
// besoin d'un capital de départ, on crédite directement le solde.
const crediter = (d, montant) => { d.solde = G.arrondi2(d.solde + montant); return d; };

// --- tirerCrash : memes probabilites que l'Aviator original (RTP 97 %) ---
assert.strictEqual(G.RTP, 0.97, 'RTP 97 % comme Spribe Aviator');
assert.strictEqual(G.tirerCrash(() => 0), 1.00, 'r=0 -> crash instantane x1.00');
assert.strictEqual(G.tirerCrash(() => 0.02), 1.00, 'r < 0.03 -> crash instantane');
assert.strictEqual(G.tirerCrash(() => 0.5), 1.94, 'r=0.5 -> x1.94 (mediane)');
assert.strictEqual(G.tirerCrash(() => 0.515), 2.00, 'r=0.515 -> x2.00');
assert.strictEqual(G.tirerCrash(() => 0.99999999), G.MULT_MAX, 'plafond x1000000');

// Monte-Carlo : P(atteindre m) doit valoir 0.97 / m, et le RTP 97 % a chaque palier
const N = 200000;
const tirages = new Array(N);
for (let i = 0; i < N; i++) tirages[i] = G.tirerCrash();
// tolerance = 4 ecarts-types de la proportion mesuree (bruit d'echantillonnage)
const tolerance = (p) => 4 * Math.sqrt(p * (1 - p) / N);
for (const m of [1.5, 2, 5, 10, 50]) {
  const attendu = 0.97 / m;
  const p = tirages.filter(c => c >= m).length / N;
  assert.ok(Math.abs(p - attendu) < tolerance(attendu),
    'P(atteindre x' + m + ') = ' + p.toFixed(5) + ', attendu ' + attendu.toFixed(5));
  // le RTP vaut m x P(atteindre m) : encaisser a x2 ou a x50 rapporte pareil sur la duree
  assert.ok(Math.abs(m * p - 0.97) < m * tolerance(attendu),
    'RTP a x' + m + ' = ' + (m * p).toFixed(3) + ', attendu 0.97');
}
// Crashs instantanes : l'avantage maison brut vaut 3 % (tirages sous x1.00), mais le
// multiplicateur est tronque a 2 decimales comme dans le jeu original, donc tout ce qui
// sort sous x1.01 s'affiche x1.00 : P = 1 - 0.97/1.01 = 3.96 %, soit ~1 manche sur 25.
const instantanesAttendu = 1 - 0.97 / 1.01;
const instantanes = tirages.filter(c => c === 1).length / N;
assert.ok(Math.abs(instantanes - instantanesAttendu) < tolerance(instantanesAttendu),
  'crashs instantanes : ' + (instantanes * 100).toFixed(2) + ' %, attendu ' + (instantanesAttendu * 100).toFixed(2) + ' %');

// --- boutique : catalogue ---
assert.strictEqual(G.AVIONS.length, 10, '10 avions au catalogue');
assert.strictEqual(G.AVIONS[0].prix, 0, 'le premier avion est offert');
for (let i = 1; i < G.AVIONS.length; i++) {
  assert.ok(G.AVIONS[i].prix > G.AVIONS[i - 1].prix, 'prix strictement croissants');
}
const dernier = G.AVIONS[G.AVIONS.length - 1];
assert.strictEqual(dernier.prix, 400, 'le plus cher vaut 400 €');
// plafond a 400 €, et les premiers paliers restent consequents
assert.ok(G.AVIONS.every(a => a.prix <= 400), 'aucun avion au-dessus de 400 €');
assert.strictEqual(G.AVIONS[1].prix, 25, 'le 2e avion reste a 25 €');
assert.strictEqual(G.AVIONS[2].prix, 50, 'le 3e avion reste a 50 €');
assert.strictEqual(dernier.nom, 'B-2 Spirit', 'le plus cher est le B-2');
// aucun avion ne touche aux probabilites : le B-2 n'apporte qu'un decor
assert.ok(G.AVIONS.every(a => a.minMult === undefined), 'aucun avion ne modifie les crashs');
assert.strictEqual(dernier.fond, 'furtif', 'le B-2 a un decor de fond');
assert.ok(G.AVIONS.slice(0, -1).every(a => a.fond === undefined), 'le decor est exclusif au B-2');
assert.ok(G.AVIONS.every(a => !/air france|ryanair|easyjet|virgin|united|ups|singapore|antonov|awacs/i.test(a.nom)),
  'les noms ne gardent que le modele');

// --- chargerDonnees ---
let d = neuf();
assert.strictEqual(d.solde, 0, 'solde par defaut = 0 €');
assert.deepStrictEqual(d.avionsPossedes, ['avion1'], 'seul le premier avion est debloque');
assert.strictEqual(d.avion, 'avion1');
assert.strictEqual(d.stats.totalDepose, 0);

d = G.chargerDonnees(mem('{corrompu'));
assert.strictEqual(d.solde, 0, 'json corrompu -> defaut');

// sauvegarde d'une version anterieure : remise a zero complete
d = G.chargerDonnees(mem('{"version":2,"solde":5000,"avionsPossedes":["avion1","avion6"]}'));
assert.strictEqual(d.solde, 0, 'ancienne version -> solde remis a 0');
assert.deepStrictEqual(d.avionsPossedes, ['avion1'], 'ancienne version -> avions remis a zero');

// sauvegarde valide de la version courante
d = G.chargerDonnees(mem(JSON.stringify({ version: G.VERSION, solde: 250, avion: 'avion3', avionsPossedes: ['avion1', 'avion3'] })));
assert.strictEqual(d.solde, 250, 'solde conserve');
assert.strictEqual(d.avion, 'avion3', 'avion selectionne conserve');

// avion selectionne non possede : on retombe sur le premier
d = G.chargerDonnees(mem(JSON.stringify({ version: G.VERSION, solde: 10, avion: 'avion6', avionsPossedes: ['avion1'] })));
assert.strictEqual(d.avion, 'avion1', 'avion non possede -> avion1');

// --- deposer : 10 € a la fois, et uniquement a sec ---
assert.strictEqual(G.DEPOT_PAS, 10, 'recharge de 10 €');
d = neuf();
assert.strictEqual(G.peutDeposer(d), true, 'a 0 € on peut recharger');
let r = G.deposer(d, 10);
assert.strictEqual(r.ok, true);
assert.strictEqual(d.solde, 10);
assert.strictEqual(d.stats.totalDepose, 10);
assert.strictEqual(G.peutDeposer(d), false, 'plus de recharge tant qu il reste de l argent');
assert.strictEqual(G.deposer(d, 10).ok, false, 'pas de cumul de depots');
assert.strictEqual(d.solde, 10, 'solde inchange apres un depot refuse');
G.placerMise(d, 10);
G.resoudreManche(d, { mise: 10, crash: 1.2, encaisseA: null }); // ruine
assert.strictEqual(d.solde, 0);
assert.strictEqual(G.deposer(d, 10).ok, true, 'recharge de nouveau possible a 0 €');
assert.strictEqual(d.stats.totalDepose, 20, 'total ajoute cumule');
// montants hors du pas de 10 € refuses, meme a sec
d = neuf();
assert.strictEqual(G.deposer(d, 500).ok, false, 'depot de 500 € refuse');
assert.strictEqual(G.deposer(d, 20).ok, false, 'depot de 20 € refuse');
assert.strictEqual(G.deposer(d, 0).ok, false, 'depot 0 refuse');
assert.strictEqual(G.deposer(d, 9.99).ok, false, 'depot hors pas refuse');
assert.strictEqual(d.solde, 0, 'aucun depot refuse n a credite le solde');
// impossible de s offrir le B-2 (400 €) en enchainant les recharges
d = neuf();
for (let i = 0; i < 200; i++) G.deposer(d, 10);
assert.strictEqual(d.solde, 10, '200 tentatives de recharge ne donnent que 10 €');
assert.strictEqual(G.acheterAvion(d, 'avion10').ok, false, 'le B-2 reste inaccessible sans jouer');

// --- acheterAvion ---
const prix2 = G.AVIONS[1].prix;
d = neuf();
assert.strictEqual(G.acheterAvion(d, 'avion2').ok, false, 'achat sans argent refuse');
crediter(d, 200);
r = G.acheterAvion(d, 'avion2');
assert.strictEqual(r.ok, true, 'achat du 2e avion avec 200 €');
assert.strictEqual(d.solde, 200 - prix2, 'prix deduit');
assert.ok(G.possede(d, 'avion2'), 'avion debloque');
assert.strictEqual(G.acheterAvion(d, 'avion2').ok, false, 'rachat refuse');
r = G.acheterAvion(d, dernier.id);
assert.strictEqual(r.ok, false, 'achat trop cher refuse');
assert.ok(r.erreur.includes(String(dernier.prix - d.solde)), 'message indique le manque, obtenu: ' + r.erreur);

// --- choisirAvion ---
assert.strictEqual(G.choisirAvion(d, dernier.id).ok, false, 'selection d un avion verrouille refusee');
assert.strictEqual(G.choisirAvion(d, 'avion2').ok, true);
assert.strictEqual(d.avion, 'avion2');

// --- placerMise ---
d = neuf();
crediter(d, 1000);
assert.strictEqual(G.placerMise(d, 100).ok, true);
assert.strictEqual(d.solde, 900, 'mise deduite');
assert.strictEqual(d.stats.totalMise, 100);
assert.strictEqual(G.placerMise(d, 5000).ok, false, 'solde insuffisant refuse');
assert.strictEqual(G.placerMise(d, 0).ok, false, 'mise < 1 refusee');
assert.strictEqual(G.placerMise(d, 10.005).ok, false, 'mise a plus de 2 decimales refusee');
assert.strictEqual(G.placerMise(d, 10.5).ok, true, 'mise avec centimes acceptee');
assert.strictEqual(d.solde, 889.5, 'centimes deduits');
G.resoudreManche(d, { mise: 10.5, crash: 5, encaisseA: 2 }); // rend 21 €
assert.strictEqual(d.solde, 910.5, 'gain avec centimes credite');

// --- resoudreManche : gain au centime pres ---
d = neuf();
crediter(d, 1000);
G.placerMise(d, 10);
let res = G.resoudreManche(d, { mise: 10, crash: 5, encaisseA: 1.225 });
assert.strictEqual(res.gain, 12.25, '10 € encaisses a x1.225 rendent 12.25 €');
assert.strictEqual(d.solde, 1002.25, 'solde au centime');

d = neuf();
crediter(d, 1000);
G.placerMise(d, 100);
res = G.resoudreManche(d, { mise: 100, crash: 5.00, encaisseA: 2.5 });
assert.strictEqual(res.gain, 250, 'gain = mise x mult');
assert.strictEqual(d.solde, 1150);
assert.strictEqual(d.stats.plusGrosGain, 250);
assert.strictEqual(d.stats.nbParties, 1);
assert.deepStrictEqual(d.capitalHistorique, [1150]);
assert.deepStrictEqual(d.bilanHistorique, [150]);
assert.strictEqual(G.bilan(d), 150, 'bilan positif');

// --- resoudreManche : perte ---
G.placerMise(d, 150); // solde 1000
res = G.resoudreManche(d, { mise: 150, crash: 1.24, encaisseA: null });
assert.strictEqual(res.gain, 0);
assert.strictEqual(d.solde, 1000);
assert.deepStrictEqual(d.bilanHistorique, [150, 0], 'bilan retombe a 0');

// pas de derive en virgule flottante sur une longue serie de centimes
const dDerive = neuf();
crediter(dDerive, 100);
for (let i = 0; i < 300; i++) {
  G.placerMise(dDerive, 1);
  G.resoudreManche(dDerive, { mise: 1, crash: 5, encaisseA: 1.1 });
}
assert.strictEqual(dDerive.solde, G.arrondi2(dDerive.solde), 'solde toujours propre au centime');
assert.strictEqual(dDerive.solde, 130, '100 € + 300 x (1.10 - 1.00) = 130 € exactement');

// --- enregistrerCrash ---
for (let i = 0; i < 25; i++) G.enregistrerCrash(d, 1.5 + i);
assert.strictEqual(d.crashHistorique.length, 20, 'historique plafonne a 20');
assert.strictEqual(d.crashHistorique[d.crashHistorique.length - 1], 25.5, 'plus recent en dernier');

// --- sauverDonnees ---
const st = mem(null);
G.sauverDonnees(st, d);
assert.strictEqual(JSON.parse(st.d).version, G.VERSION, 'version ecrite dans la sauvegarde');

console.log('OK — tous les tests game.js passent');

// --- reinitialiser ---
d = neuf();
crediter(d, 500);
G.acheterAvion(d, 'avion2');
G.placerMise(d, 50);
G.resoudreManche(d, { mise: 50, crash: 3, encaisseA: 2 });
G.enregistrerCrash(d, 3);
const memeObjet = d;
G.reinitialiser(d);
assert.strictEqual(d, memeObjet, 'reinitialise en place (meme reference)');
assert.strictEqual(d.solde, 0, 'solde remis a 0');
assert.deepStrictEqual(d.avionsPossedes, ['avion1'], 'avions reverrouilles');
assert.strictEqual(d.avion, 'avion1', 'avion par defaut reselectionne');
assert.deepStrictEqual(d.capitalHistorique, [], 'historique capital vide');
assert.deepStrictEqual(d.bilanHistorique, [], 'historique bilan vide');
assert.deepStrictEqual(d.crashHistorique, [], 'historique crashs vide');
assert.deepStrictEqual(d.stats, { totalMise: 0, totalGagne: 0, plusGrosGain: 0, nbParties: 0, totalDepose: 0 }, 'stats remises a zero');
assert.strictEqual(d.version, G.VERSION, 'version conservee');
// on peut rejouer normalement apres
assert.strictEqual(G.deposer(d, 10).ok, true, 'depot possible apres remise a zero');

console.log('OK — remise à zéro validée');
