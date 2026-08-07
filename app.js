// app.js — UI : navigation, salon, jeu, boutique, stats
'use strict';

const donnees = Game.chargerDonnees(localStorage);
function sauver() { Game.sauverDonnees(localStorage, donnees); }

const $ = (id) => document.getElementById(id);

// Image de secours tant qu'un fichier d'avion n'a pas été déposé dans img/
const IMG_SECOURS = 'img/placeholder.png';
function avecSecours(img) {
  img.addEventListener('error', () => {
    if (!img.src.endsWith(IMG_SECOURS)) img.src = IMG_SECOURS;
  });
  return img;
}

// --- Solde + ajout d'argent ---
// Les montants s'affichent au centime, sauf quand ils tombent juste (40 € et non 40,00 €).
function eur(v) {
  const n = Game.arrondi2(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function lireMontant(champ) {
  return Game.arrondi2(parseFloat($(champ).value));
}

function majSolde() {
  $('affiche-solde').textContent = eur(donnees.solde);
  // Le bouton d'ajout ne s'allume qu'une fois ruiné : recharge de 10 €, pas avant.
  $('btn-deposer').disabled = !Game.peutDeposer(donnees);
}

$('btn-deposer').addEventListener('click', () => {
  $('message-depot').textContent = '';
  $('voile-depot').classList.remove('cache');
});
$('btn-fermer-depot').addEventListener('click', () => $('voile-depot').classList.add('cache'));
$('btn-depot-10').addEventListener('click', () => {
  const r = Game.deposer(donnees, Game.DEPOT_PAS);
  if (!r.ok) { $('message-depot').textContent = r.erreur; return; }
  sauver(); majSolde();
  if (ecranCourant === 'boutique') dessinerBoutique();
  $('message-depot').textContent = '';
  $('voile-depot').classList.add('cache');
});

// --- Navigation ---
let ecranCourant = 'salon';
function afficherEcran(nom) {
  ecranCourant = nom;
  for (const e of ['salon', 'jeu', 'boutique', 'stats']) {
    $('ecran-' + e).classList.toggle('cache', e !== nom);
  }
  $('btn-retour-salon').classList.toggle('cache', nom === 'salon');
  if (nom === 'stats') dessinerStats();
  if (nom === 'boutique') dessinerBoutique();
}
$('btn-retour-salon').addEventListener('click', () => afficherEcran('salon'));
$('btn-jouer').addEventListener('click', () => afficherEcran('jeu'));
$('btn-stats').addEventListener('click', () => afficherEcran('stats'));
$('btn-boutique').addEventListener('click', () => afficherEcran('boutique'));

// --- Carrousel d'avions (salon) : uniquement les avions débloqués ---
const imageAvion = avecSecours(new Image()); // utilisée aussi par le canvas de vol
let fondCourant = null;                      // décor de l'avion sélectionné (cosmétique)
avecSecours($('img-avion-salon'));

function avionsDisponibles() {
  return Game.AVIONS.filter(a => Game.possede(donnees, a.id));
}

function majAvion() {
  const avion = Game.avionParId(donnees.avion);
  $('img-avion-salon').src = avion.img;
  $('nom-avion').textContent = avion.nom;
  imageAvion.src = avion.img;
  fondCourant = avion.fond || null;
  $('ecran-jeu').classList.toggle('fond-furtif', fondCourant === 'furtif');
  const dispo = avionsDisponibles();
  const seul = dispo.length < 2;
  $('btn-avion-prec').disabled = seul;
  $('btn-avion-suiv').disabled = seul;
  sauver();
}

function decalerAvion(pas) {
  const dispo = avionsDisponibles();
  if (dispo.length < 2) return;
  const i = Math.max(0, dispo.findIndex(a => a.id === donnees.avion));
  const suivant = dispo[(i + pas + dispo.length) % dispo.length];
  Game.choisirAvion(donnees, suivant.id);
  majAvion();
}
$('btn-avion-prec').addEventListener('click', () => decalerAvion(-1));
$('btn-avion-suiv').addEventListener('click', () => decalerAvion(1));

// --- Boutique ---
function dessinerBoutique() {
  $('grille-boutique').innerHTML = Game.AVIONS.map(a => {
    const possede = Game.possede(donnees, a.id);
    const choisi = donnees.avion === a.id;
    const classes = ['carte-avion'];
    if (!possede) classes.push('verrouille');
    if (choisi) classes.push('choisi');
    let bouton;
    if (choisi) bouton = '<button class="secondaire" disabled>✓ Sélectionné</button>';
    else if (possede) bouton = '<button class="secondaire" data-choisir="' + a.id + '">Sélectionner</button>';
    else bouton = '<button data-acheter="' + a.id + '">Acheter</button>';
    // src posé après coup (voir plus bas) pour que le repli soit branché avant le chargement
    return '<div class="' + classes.join(' ') + '">' +
      '<div class="vignette"><img data-src="' + a.img + '" alt="' + a.nom + '"></div>' +
      '<div class="nom">' + a.nom + '</div>' +
      '<div class="prix">' + (possede ? 'Débloqué' : a.prix + ' €') + '</div>' +
      bouton + '</div>';
  }).join('');

  $('grille-boutique').querySelectorAll('img[data-src]').forEach(img => {
    avecSecours(img).src = img.dataset.src;
  });
  $('grille-boutique').querySelectorAll('[data-acheter]').forEach(b => {
    b.addEventListener('click', () => acheter(b.dataset.acheter));
  });
  $('grille-boutique').querySelectorAll('[data-choisir]').forEach(b => {
    b.addEventListener('click', () => {
      Game.choisirAvion(donnees, b.dataset.choisir);
      sauver(); majAvion(); dessinerBoutique();
      messageBoutique(Game.avionParId(donnees.avion).nom + ' sélectionné.', false);
    });
  });
}

function messageBoutique(texte, erreur) {
  const el = $('message-boutique');
  el.textContent = texte;
  el.classList.toggle('erreur', !!erreur);
}

function acheter(id) {
  const r = Game.acheterAvion(donnees, id);
  if (!r.ok) { messageBoutique(r.erreur, true); return; }
  Game.choisirAvion(donnees, id);
  sauver(); majSolde(); majAvion(); dessinerBoutique();
  messageBoutique(Game.avionParId(id).nom + ' débloqué et sélectionné ! ✈️', false);
}

// --- Écran jeu : machine à états ---
// Courbe exponentielle m(t) = e^(k*t), calée sur le rythme de l'Aviator original :
// la manche médiane (crash ~x1.94) dure ~8 s, x5 vers 19 s, x10 vers 28 s — soit la
// fourchette de 8 à 30 s des manches réelles.
const K_CROISSANCE = 0.083;
const DUREE_ATTENTE = 5;              // secondes
const DUREE_APRES_CRASH = 2.5;        // secondes

const etatJeu = {
  phase: 'ATTENTE',        // ATTENTE | VOL | CRASH
  finAttente: 0,           // timestamp ms
  debutVol: 0,             // timestamp ms
  crashA: 1,               // multiplicateur de crash tiré
  finCrash: 0,             // timestamp ms
  miseEnCours: 0,          // 0 = pas de mise placée
  miseProchaine: 0,        // mise placée pendant ATTENTE
  encaisseA: null,         // multiplicateur encaissé cette manche
};

const canvasVol = $('canvas-vol');
const ctxVol = canvasVol.getContext('2d');

function multCourant(maintenant) {
  const t = (maintenant - etatJeu.debutVol) / 1000;
  return Math.exp(K_CROISSANCE * t);
}

function majBandeCrashs() {
  $('bande-crashs').innerHTML = donnees.crashHistorique.slice().reverse().map(c => {
    const classe = c >= 10 ? 'haut' : c >= 2 ? 'moyen' : 'bas';
    return '<span class="puce-crash ' + classe + '">x' + c.toFixed(2) + '</span>';
  }).join('');
}

// Le bouton principal a trois visages :
//   vol en cours avec une mise  -> ENCAISSER (le montant suit le multiplicateur)
//   mise déjà placée            -> rappel, bouton inactif
//   sinon                       -> MISER, à n'importe quel moment : pendant un vol,
//                                  la mise est simplement gardée pour le vol suivant.
function majBoutonAction() {
  const btn = $('btn-action');
  const enVolAvecMise = etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0;
  btn.classList.toggle('mode-encaisser', enVolAvecMise);
  if (enVolAvecMise) {
    // le montant exact est rafraîchi à chaque image par boucleJeu
    btn.textContent = 'ENCAISSER ' + eur(etatJeu.miseEnCours) + ' €';
    btn.disabled = false;
  } else if (etatJeu.miseProchaine > 0) {
    btn.textContent = etatJeu.phase === 'ATTENTE'
      ? 'MISE PLACÉE : ' + eur(etatJeu.miseProchaine) + ' €'
      : 'MISE PLACÉE POUR LE PROCHAIN VOL';
    btn.disabled = true;
  } else {
    btn.textContent = etatJeu.phase === 'ATTENTE' ? 'MISER' : 'MISER (PROCHAIN VOL)';
    btn.disabled = false;
  }
  $('btn-retour-salon').disabled = enVolAvecMise;
}

$('btn-action').addEventListener('click', () => {
  $('message-erreur').textContent = '';
  if (etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0) {
    encaisserMaintenant(performance.now());
  } else if (etatJeu.miseProchaine === 0) {
    const montant = lireMontant('champ-mise');
    const r = Game.placerMise(donnees, Number.isNaN(montant) ? 0 : montant);
    if (!r.ok) { $('message-erreur').textContent = r.erreur; return; }
    etatJeu.miseProchaine = montant;
    sauver(); majSolde();
  }
  majBoutonAction();
});

document.querySelectorAll('.mises-rapides button').forEach(b => {
  b.addEventListener('click', () => {
    $('champ-mise').value = b.dataset.mise === 'max' ? Math.max(Game.MISE_MIN, donnees.solde) : b.dataset.mise;
    $('message-erreur').textContent = '';
  });
});

// multImpose : utilisé par l'auto-encaissement, qui doit tomber pile sur la cible
// demandée et non sur le multiplicateur de l'image courante (qui peut l'avoir dépassée).
function encaisserMaintenant(maintenant, multImpose) {
  const m = Math.min(multImpose || multCourant(maintenant), etatJeu.crashA);
  etatJeu.encaisseA = Math.floor(m * 100) / 100;
  const res = Game.resoudreManche(donnees, { mise: etatJeu.miseEnCours, crash: etatJeu.crashA, encaisseA: etatJeu.encaisseA });
  etatJeu.miseEnCours = 0;
  sauver(); majSolde(); majBoutonAction();
  $('affiche-mult').classList.add('gagne');
  $('message-vol').textContent = 'Encaissé : +' + eur(res.gain) + ' € (x' + etatJeu.encaisseA.toFixed(2) + ')';
}

// --- Mise auto ---
let autoMiseActive = false;
function majBoutonAutoMise() {
  $('btn-auto-mise').textContent = '🔁 Mise auto : ' + (autoMiseActive ? 'ON' : 'OFF');
  $('btn-auto-mise').classList.toggle('actif', autoMiseActive);
}
$('btn-auto-mise').addEventListener('click', () => {
  autoMiseActive = !autoMiseActive;
  $('message-erreur').textContent = '';
  majBoutonAutoMise();
});

function placerMiseAuto() {
  if (!autoMiseActive || etatJeu.miseProchaine > 0) return;
  const montant = parseInt($('champ-mise').value, 10);
  const r = Game.placerMise(donnees, Number.isNaN(montant) ? 0 : montant);
  if (!r.ok) {
    autoMiseActive = false;
    majBoutonAutoMise();
    $('message-erreur').textContent = 'Mise auto désactivée : ' + r.erreur.toLowerCase();
    return;
  }
  etatJeu.miseProchaine = montant;
  sauver(); majSolde();
}

function demarrerAttente(maintenant) {
  etatJeu.phase = 'ATTENTE';
  etatJeu.finAttente = maintenant + DUREE_ATTENTE * 1000;
  // miseProchaine n'est pas remise à zéro ici : elle peut avoir été placée
  // pendant le vol précédent, et l'argent est déjà débité. Seul demarrerVol la consomme.
  etatJeu.encaisseA = null;
  $('affiche-mult').classList.remove('crash', 'gagne');
  placerMiseAuto();
  majBandeCrashs(); majBoutonAction();
}

function demarrerVol(maintenant) {
  etatJeu.phase = 'VOL';
  etatJeu.debutVol = maintenant;
  etatJeu.crashA = Game.tirerCrash();
  etatJeu.miseEnCours = etatJeu.miseProchaine;
  etatJeu.miseProchaine = 0;
  majBoutonAction();
}

function terminerVol(maintenant) {
  etatJeu.phase = 'CRASH';
  etatJeu.finCrash = maintenant + DUREE_APRES_CRASH * 1000;
  Game.enregistrerCrash(donnees, etatJeu.crashA);
  if (etatJeu.miseEnCours > 0) {
    Game.resoudreManche(donnees, { mise: etatJeu.miseEnCours, crash: etatJeu.crashA, encaisseA: null });
    etatJeu.miseEnCours = 0;
    $('message-vol').textContent = 'Crashé… mise perdue 💥';
  } else if (etatJeu.encaisseA === null) {
    $('message-vol').textContent = 'Crashé à x' + etatJeu.crashA.toFixed(2);
  }
  sauver(); majSolde(); majBoutonAction();
}

// Décor du B-2 : écran radar furtif (balayage, cercles de portée, grille, échos).
// Purement décoratif — il tourne aussi pendant l'attente, comme un fond d'écran.
function dessinerFondFurtif(larg, haut, maintenant) {
  const t = maintenant / 1000;
  const cx = larg * 0.5, cy = haut * 0.62;
  const rayon = Math.max(larg, haut) * 0.78;

  const halo = ctxVol.createRadialGradient(cx, cy, 0, cx, cy, rayon);
  halo.addColorStop(0, 'rgba(46, 204, 113, 0.13)');
  halo.addColorStop(0.55, 'rgba(28, 120, 90, 0.06)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctxVol.fillStyle = halo;
  ctxVol.fillRect(0, 0, larg, haut);

  ctxVol.save();
  ctxVol.beginPath(); ctxVol.rect(0, 0, larg, haut); ctxVol.clip();

  // grille fine
  ctxVol.strokeStyle = 'rgba(46, 204, 113, 0.07)';
  ctxVol.lineWidth = 1;
  ctxVol.beginPath();
  for (let x = 0; x <= larg; x += 26) { ctxVol.moveTo(x, 0); ctxVol.lineTo(x, haut); }
  for (let y = 0; y <= haut; y += 26) { ctxVol.moveTo(0, y); ctxVol.lineTo(larg, y); }
  ctxVol.stroke();

  // cercles de portée + croix
  ctxVol.strokeStyle = 'rgba(46, 204, 113, 0.16)';
  for (let i = 1; i <= 4; i++) {
    ctxVol.beginPath();
    ctxVol.arc(cx, cy, (rayon / 4) * i, 0, Math.PI * 2);
    ctxVol.stroke();
  }
  ctxVol.beginPath();
  ctxVol.moveTo(cx, cy - rayon); ctxVol.lineTo(cx, cy + rayon);
  ctxVol.moveTo(cx - rayon, cy); ctxVol.lineTo(cx + rayon, cy);
  ctxVol.stroke();

  // balayage : un tour toutes les 4 s, avec sa traîne
  const angle = (t / 4) * Math.PI * 2;
  const balayage = ctxVol.createConicGradient
    ? ctxVol.createConicGradient(angle - 0.9, cx, cy)
    : null;
  if (balayage) {
    balayage.addColorStop(0, 'rgba(46, 204, 113, 0)');
    balayage.addColorStop(0.22, 'rgba(46, 204, 113, 0.20)');
    balayage.addColorStop(0.25, 'rgba(120, 255, 190, 0.34)');
    balayage.addColorStop(0.26, 'rgba(46, 204, 113, 0)');
    ctxVol.fillStyle = balayage;
    ctxVol.beginPath(); ctxVol.arc(cx, cy, rayon, 0, Math.PI * 2); ctxVol.fill();
  } else {
    ctxVol.strokeStyle = 'rgba(120, 255, 190, 0.30)';
    ctxVol.beginPath();
    ctxVol.moveTo(cx, cy);
    ctxVol.lineTo(cx + Math.cos(angle) * rayon, cy + Math.sin(angle) * rayon);
    ctxVol.stroke();
  }

  // échos radar : ils s'allument au passage du balayage puis s'éteignent
  const echos = [[0.18, 0.30], [0.72, 0.22], [0.86, 0.55], [0.34, 0.68], [0.58, 0.14]];
  echos.forEach(([fx, fy], i) => {
    const ex = fx * larg, ey = fy * haut;
    const aEcho = Math.atan2(ey - cy, ex - cx);
    let ecart = (angle - aEcho) % (Math.PI * 2);
    if (ecart < 0) ecart += Math.PI * 2;
    const vif = Math.max(0, 1 - ecart / (Math.PI * 1.4));
    if (vif <= 0.02) return;
    ctxVol.fillStyle = 'rgba(140, 255, 200, ' + (vif * 0.55).toFixed(3) + ')';
    ctxVol.beginPath();
    ctxVol.arc(ex, ey, 2.5 + (i % 2), 0, Math.PI * 2);
    ctxVol.fill();
  });

  // lignes de scan qui descendent lentement
  ctxVol.fillStyle = 'rgba(46, 204, 113, 0.045)';
  const decalage = (t * 22) % 6;
  for (let y = -6 + decalage; y < haut; y += 6) ctxVol.fillRect(0, y, larg, 1.5);

  ctxVol.restore();
}

function dessinerVol(maintenant) {
  const dpr = window.devicePixelRatio || 1;
  const larg = canvasVol.clientWidth, haut = canvasVol.clientHeight;
  if (larg === 0 || haut === 0) return;
  if (canvasVol.width !== larg * dpr) { canvasVol.width = larg * dpr; canvasVol.height = haut * dpr; }
  ctxVol.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxVol.clearRect(0, 0, larg, haut);

  if (fondCourant === 'furtif') dessinerFondFurtif(larg, haut, maintenant);

  if (etatJeu.phase === 'ATTENTE') return;

  const tFin = etatJeu.phase === 'VOL' ? maintenant : etatJeu.debutVol + Math.log(etatJeu.crashA) / K_CROISSANCE * 1000;
  const duree = Math.max(0.001, (tFin - etatJeu.debutVol) / 1000);
  const mMax = Math.max(2, Math.exp(K_CROISSANCE * duree) * 1.15);
  const margeG = 10, margeB = 14;
  const xDe = (t) => margeG + (t / duree) * (larg * 0.82 - margeG);
  const yDe = (m) => haut - margeB - ((m - 1) / (mMax - 1)) * (haut * 0.8);

  ctxVol.beginPath();
  ctxVol.moveTo(xDe(0), yDe(1));
  const pas = duree / 60;
  for (let t = pas; t <= duree; t += pas) ctxVol.lineTo(xDe(t), yDe(Math.exp(K_CROISSANCE * t)));
  const xBout = xDe(duree), yBout = yDe(Math.exp(K_CROISSANCE * duree));
  ctxVol.lineTo(xBout, yBout);
  ctxVol.strokeStyle = etatJeu.phase === 'CRASH' ? '#E74C3C' : '#E94560';
  ctxVol.lineWidth = 3;
  ctxVol.stroke();
  ctxVol.lineTo(xBout, haut - margeB);
  ctxVol.lineTo(margeG, haut - margeB);
  ctxVol.closePath();
  ctxVol.fillStyle = 'rgba(233, 69, 96, 0.12)';
  ctxVol.fill();

  if (etatJeu.phase === 'VOL' && imageAvion.complete && imageAvion.naturalWidth > 0) {
    const lAvion = Math.min(90, larg * 0.22);
    const hAvion = lAvion * (imageAvion.naturalHeight / imageAvion.naturalWidth);
    const angle = -Math.atan2(yDe(1) - yBout, xBout - xDe(0)) * 0.6;
    ctxVol.save();
    ctxVol.translate(xBout, yBout);
    ctxVol.rotate(angle);
    ctxVol.drawImage(imageAvion, -lAvion * 0.3, -hAvion, lAvion, hAvion);
    ctxVol.restore();
  }
  if (etatJeu.phase === 'CRASH') {
    ctxVol.font = '40px sans-serif';
    ctxVol.fillText('💥', xBout - 20, yBout + 10);
  }
}

function boucleJeu(maintenant) {
  if (etatJeu.phase === 'ATTENTE') {
    const reste = Math.max(0, (etatJeu.finAttente - maintenant) / 1000);
    $('message-vol').innerHTML = 'Prochain vol dans <span id="compte-rebours">' + Math.ceil(reste) + '</span> s';
    $('affiche-mult').textContent = 'x1.00';
    if (maintenant >= etatJeu.finAttente) demarrerVol(maintenant);
  } else if (etatJeu.phase === 'VOL') {
    const m = multCourant(maintenant);
    // L'auto-encaissement est évalué AVANT le crash : une cible atteinte pile au
    // multiplicateur de crash est encaissée, comme dans les vrais jeux de crash.
    // Tester le crash d'abord ferait perdre ces manches et baisserait le RTP à ~96,3 %.
    const auto = parseFloat($('champ-auto').value);
    const autoValide = etatJeu.miseEnCours > 0 && !Number.isNaN(auto) && auto > 1;
    if (autoValide && m >= auto && auto <= etatJeu.crashA) {
      encaisserMaintenant(maintenant, auto);
    } else if (m >= etatJeu.crashA) {
      terminerVol(maintenant);
    } else {
      $('affiche-mult').textContent = 'x' + m.toFixed(2);
      if (etatJeu.miseEnCours > 0) $('btn-action').textContent = 'ENCAISSER ' + eur(etatJeu.miseEnCours * m) + ' €';
      if (etatJeu.encaisseA === null) $('message-vol').textContent = '';
    }
  } else if (etatJeu.phase === 'CRASH') {
    $('affiche-mult').textContent = 'x' + etatJeu.crashA.toFixed(2);
    $('affiche-mult').classList.add('crash');
    if (maintenant >= etatJeu.finCrash) demarrerAttente(maintenant);
  }
  dessinerVol(maintenant);
  requestAnimationFrame(boucleJeu);
}
demarrerAttente(performance.now());
requestAnimationFrame(boucleJeu);

// --- Écran stats ---
let dureeStats = 'tout';
let vueStats = 'capital';
document.querySelectorAll('#selecteur-duree button').forEach(b => {
  b.addEventListener('click', () => {
    dureeStats = b.dataset.duree;
    document.querySelectorAll('#selecteur-duree button').forEach(x => x.classList.toggle('actif', x === b));
    dessinerStats();
  });
});
document.querySelectorAll('#selecteur-vue button').forEach(b => {
  b.addEventListener('click', () => {
    vueStats = b.dataset.vue;
    document.querySelectorAll('#selecteur-vue button').forEach(x => x.classList.toggle('actif', x === b));
    dessinerStats();
  });
});

function dessinerStats() {
  const canvas = $('canvas-stats');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const larg = canvas.clientWidth, haut = canvas.clientHeight;
  if (larg === 0 || haut === 0) return;
  canvas.width = larg * dpr; canvas.height = haut * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, larg, haut);

  // série selon la vue : capital (solde après chaque manche) ou bilan (gagné - misé)
  const tout = vueStats === 'bilan'
    ? [0, ...donnees.bilanHistorique]
    : [Game.SOLDE_DEPART, ...donnees.capitalHistorique];
  const n = dureeStats === 'tout' ? tout.length : Math.min(tout.length, parseInt(dureeStats, 10) + 1);
  const serie = tout.slice(-n);

  const s = donnees.stats;
  const leBilan = Game.bilan(donnees);
  const signe = leBilan > 0 ? '+' : '';
  const classeBilan = leBilan > 0 ? 'positif' : leBilan < 0 ? 'negatif' : '';
  $('resume-stats').innerHTML =
    carte(signe + eur(leBilan) + ' €', 'bilan (gagné - misé)', classeBilan) +
    carte(eur(s.totalDepose) + ' €', 'total ajouté') +
    carte(s.nbParties, 'parties jouées') + carte(eur(s.totalMise) + ' €', 'total misé') +
    carte(eur(s.totalGagne) + ' €', 'total gagné') + carte(eur(s.plusGrosGain) + ' €', 'plus gros gain');

  if (serie.length < 2) {
    ctx.fillStyle = '#9BA4B4';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Joue une partie pour voir ta courbe 📉📈', larg / 2, haut / 2);
    return;
  }

  const mini = Math.min(...serie), maxi = Math.max(...serie);
  const ampli = Math.max(1, maxi - mini);
  const mg = 44, md = 14, mh = 16, mb = 26;
  const x = (i) => mg + (i / (serie.length - 1)) * (larg - mg - md);
  const y = (v) => mh + (1 - (v - mini) / ampli) * (haut - mh - mb);

  // grille : min, milieu, max
  ctx.strokeStyle = 'rgba(155,164,180,0.18)';
  ctx.fillStyle = '#9BA4B4';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  for (const v of [mini, (mini + maxi) / 2, maxi]) {
    ctx.beginPath(); ctx.moveTo(mg, y(v)); ctx.lineTo(larg - md, y(v)); ctx.stroke();
    ctx.fillText(Math.round(v), mg - 6, y(v) + 4);
  }

  // ligne de référence (zéro) si visible
  if (0 >= mini && 0 <= maxi) {
    ctx.strokeStyle = 'rgba(241,196,15,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(mg, y(0)); ctx.lineTo(larg - md, y(0)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // aire + courbe, couleur selon tendance (bilan : au-dessus/en-dessous de zéro)
  const gagne = vueStats === 'bilan'
    ? serie[serie.length - 1] >= 0
    : serie[serie.length - 1] >= serie[0];
  const couleur = gagne ? '#2ECC71' : '#E74C3C';
  ctx.beginPath();
  serie.forEach((v, i) => i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)));
  ctx.strokeStyle = couleur; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(x(serie.length - 1), haut - mb); ctx.lineTo(x(0), haut - mb); ctx.closePath();
  ctx.fillStyle = gagne ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)';
  ctx.fill();

  // point final + valeur
  const dx = x(serie.length - 1), dy = y(serie[serie.length - 1]);
  ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fillStyle = couleur; ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = '#EAEAEA'; ctx.font = 'bold 13px -apple-system, sans-serif';
  const valFin = serie[serie.length - 1];
  ctx.fillText((vueStats === 'bilan' && valFin > 0 ? '+' : '') + eur(valFin) + ' €', Math.min(dx, larg - 40), Math.max(14, dy - 10));

  // libellé axe X
  ctx.fillStyle = '#9BA4B4'; ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText((serie.length - 1) + ' dernière(s) partie(s)', larg / 2, haut - 8);
}

// --- Remise à zéro ---
$('btn-reinit').addEventListener('click', () => $('voile-reinit').classList.remove('cache'));
$('btn-annuler-reinit').addEventListener('click', () => $('voile-reinit').classList.add('cache'));
$('btn-confirmer-reinit').addEventListener('click', () => {
  Game.reinitialiser(donnees);
  sauver();
  // la manche en cours perd son enjeu : on repart proprement d'une phase d'attente
  etatJeu.miseEnCours = 0;
  etatJeu.miseProchaine = 0;
  autoMiseActive = false;
  majBoutonAutoMise();
  demarrerAttente(performance.now());
  majSolde(); majAvion(); dessinerStats();
  $('voile-reinit').classList.add('cache');
  $('message-erreur').textContent = '';
});

function carte(valeur, libelle, classe) {
  return '<div class="carte-stat"><div class="valeur ' + (classe || '') + '">' + valeur + '</div><div class="libelle">' + libelle + '</div></div>';
}

majSolde();
majAvion();
afficherEcran('salon');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
