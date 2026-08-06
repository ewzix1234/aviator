// tests/game.test.js
const assert = require('assert');
const G = require('../game.js');

// --- tirerCrash ---
assert.strictEqual(G.tirerCrash(() => 0), 1.00, 'r=0 -> x1.00');
assert.strictEqual(G.tirerCrash(() => 0.505), 2.00, 'r=0.505 -> x2.00');
assert.strictEqual(G.tirerCrash(() => 0.9999999), 1000, 'plafond x1000');
// médiane ~x2 : sur 10000 tirages, entre 40% et 60% sous x2
let sous2 = 0;
for (let i = 0; i < 10000; i++) if (G.tirerCrash() < 2) sous2++;
assert.ok(sous2 > 4000 && sous2 < 6000, 'mediane ~x2, obtenu ' + sous2);

// --- chargerDonnees ---
const mem = (init) => ({ d: init, getItem(k){ return this.d; }, setItem(k, v){ this.d = v; } });
let d = G.chargerDonnees(mem(null));
assert.strictEqual(d.solde, 0, 'solde par defaut = 0 €');
assert.strictEqual(d.avion, 'lufthansa', 'avion par defaut');
assert.strictEqual(d.stats.totalDepose, 0, 'rien depose par defaut');
d = G.chargerDonnees(mem('{corrompu'));
assert.strictEqual(d.solde, 0, 'json corrompu -> defaut');
d = G.chargerDonnees(mem('{"solde":250,"avion":"emirates"}'));
assert.strictEqual(d.solde, 250, 'solde conserve');
assert.deepStrictEqual(d.capitalHistorique, [], 'champs manquants completes');

// --- migration ancienne sauvegarde (sans totalDepose) ---
d = G.chargerDonnees(mem('{"solde":900,"stats":{"totalMise":200,"totalGagne":100,"plusGrosGain":100,"nbParties":2}}'));
assert.strictEqual(d.stats.totalDepose, 1000, 'migration: solde attribue aux depots (900 - (100-200) = 1000)');
assert.strictEqual(G.bilan(d), -100, 'bilan migre = -100');

// --- sauverDonnees ---
const st = mem(null);
d = G.chargerDonnees(mem('{"solde":250}'));
G.sauverDonnees(st, d);
assert.strictEqual(JSON.parse(st.d).solde, 250, 'sauvegarde ecrite');

// --- deposer ---
d = G.chargerDonnees(mem(null));
let r = G.deposer(d, 50);
assert.strictEqual(r.ok, true);
assert.strictEqual(d.solde, 50, 'depot credite');
assert.strictEqual(d.stats.totalDepose, 50);
r = G.deposer(d, 0);
assert.strictEqual(r.ok, false, 'depot 0 refuse');
r = G.deposer(d, 2.5);
assert.strictEqual(r.ok, false, 'depot non entier refuse');
r = G.deposer(d, 999999);
assert.strictEqual(r.ok, false, 'depot > max refuse');

// --- placerMise ---
d = G.chargerDonnees(mem(null));
G.deposer(d, 1000);
r = G.placerMise(d, 100);
assert.strictEqual(r.ok, true);
assert.strictEqual(d.solde, 900, 'mise deduite');
assert.strictEqual(d.stats.totalMise, 100);
r = G.placerMise(d, 5000);
assert.strictEqual(r.ok, false, 'solde insuffisant refuse');
r = G.placerMise(d, 0);
assert.strictEqual(r.ok, false, 'mise < 1 refusee');
r = G.placerMise(d, 10.5);
assert.strictEqual(r.ok, false, 'mise non entiere refusee');

// --- resoudreManche : gain ---
let res = G.resoudreManche(d, { mise: 100, crash: 5.00, encaisseA: 2.5 });
assert.strictEqual(res.gain, 250, 'gain = mise x mult arrondi');
assert.strictEqual(d.solde, 1150);
assert.strictEqual(d.stats.totalGagne, 250);
assert.strictEqual(d.stats.plusGrosGain, 250);
assert.strictEqual(d.stats.nbParties, 1);
assert.deepStrictEqual(d.capitalHistorique, [1150], 'capital enregistre');
assert.deepStrictEqual(d.bilanHistorique, [150], 'bilan enregistre (250 gagne - 100 mise)');
assert.strictEqual(G.bilan(d), 150, 'bilan positif');

// --- resoudreManche : perte ---
G.placerMise(d, 150); // solde 1000
res = G.resoudreManche(d, { mise: 150, crash: 1.24, encaisseA: null });
assert.strictEqual(res.gain, 0);
assert.strictEqual(d.solde, 1000);
assert.strictEqual(d.stats.nbParties, 2);
assert.deepStrictEqual(d.capitalHistorique, [1150, 1000]);
assert.deepStrictEqual(d.bilanHistorique, [150, 0], 'bilan retombe a 0');
assert.strictEqual(G.bilan(d), 0);

// --- enregistrerCrash ---
for (let i = 0; i < 25; i++) G.enregistrerCrash(d, 1.5 + i);
assert.strictEqual(d.crashHistorique.length, 20, 'historique crash plafonne a 20');
assert.strictEqual(d.crashHistorique[d.crashHistorique.length - 1], 25.5, 'plus recent en dernier');

// --- AVIONS ---
assert.ok(Array.isArray(G.AVIONS) && G.AVIONS.length >= 5, 'au moins 5 avions');
assert.ok(G.AVIONS.every(a => a.id && a.nom && a.img), 'champs avion complets');

console.log('OK — tous les tests game.js passent');
