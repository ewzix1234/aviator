// tests/game.test.js
const assert = require('assert');
const G = require('../game.js');

const mem = (init) => ({ d: init, getItem(k){ return this.d; }, setItem(k, v){ this.d = v; } });
const neuf = () => G.chargerDonnees(mem(null));

// --- tirerCrash ---
assert.strictEqual(G.tirerCrash(() => 0), 1.00, 'r=0 -> x1.00');
assert.strictEqual(G.tirerCrash(() => 0.505), 2.00, 'r=0.505 -> x2.00');
assert.strictEqual(G.tirerCrash(() => 0.9999999), 1000, 'plafond x1000');
let sous2 = 0;
for (let i = 0; i < 10000; i++) if (G.tirerCrash() < 2) sous2++;
assert.ok(sous2 > 4000 && sous2 < 6000, 'mediane ~x2, obtenu ' + sous2);

// bonus caché : minMult impose un plancher
assert.strictEqual(G.tirerCrash(() => 0, 5), 5, 'minMult 5 releve un x1.00 a x5');
assert.strictEqual(G.tirerCrash(() => 0.9, 5), 9.9, 'minMult n abaisse jamais un gros tirage');
for (let i = 0; i < 2000; i++) assert.ok(G.tirerCrash(null, 5) >= 5, 'jamais sous x5 avec minMult');

// --- boutique : catalogue ---
assert.strictEqual(G.AVIONS.length, 10, '10 avions au catalogue');
assert.strictEqual(G.AVIONS[0].prix, 0, 'le premier avion est offert');
for (let i = 1; i < G.AVIONS.length; i++) {
  assert.ok(G.AVIONS[i].prix > G.AVIONS[i - 1].prix, 'prix strictement croissants');
}
const dernier = G.AVIONS[G.AVIONS.length - 1];
assert.strictEqual(dernier.prix, 1000, 'le plus cher vaut 1000 €');
assert.strictEqual(dernier.nom, 'B-2 Spirit', 'le plus cher est le B-2');
assert.strictEqual(dernier.minMult, 5, 'le plus cher garantit x5');
assert.ok(G.AVIONS.slice(0, -1).every(a => a.minMult === undefined), 'aucun autre avion n a de bonus');

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

// --- deposer ---
d = neuf();
let r = G.deposer(d, 50);
assert.strictEqual(r.ok, true);
assert.strictEqual(d.solde, 50);
assert.strictEqual(d.stats.totalDepose, 50);
assert.strictEqual(G.deposer(d, 0).ok, false, 'depot 0 refuse');
assert.strictEqual(G.deposer(d, 2.5).ok, false, 'depot non entier refuse');
assert.strictEqual(G.deposer(d, 999999).ok, false, 'depot > max refuse');

// --- acheterAvion ---
const prix2 = G.AVIONS[1].prix;
d = neuf();
assert.strictEqual(G.acheterAvion(d, 'avion2').ok, false, 'achat sans argent refuse');
G.deposer(d, 200);
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
G.deposer(d, 1000);
assert.strictEqual(G.placerMise(d, 100).ok, true);
assert.strictEqual(d.solde, 900, 'mise deduite');
assert.strictEqual(d.stats.totalMise, 100);
assert.strictEqual(G.placerMise(d, 5000).ok, false, 'solde insuffisant refuse');
assert.strictEqual(G.placerMise(d, 0).ok, false, 'mise < 1 refusee');
assert.strictEqual(G.placerMise(d, 10.5).ok, false, 'mise non entiere refusee');

// --- resoudreManche : gain ---
let res = G.resoudreManche(d, { mise: 100, crash: 5.00, encaisseA: 2.5 });
assert.strictEqual(res.gain, 250, 'gain = mise x mult arrondi');
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
G.deposer(d, 500);
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
