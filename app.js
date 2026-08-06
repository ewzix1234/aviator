// app.js — UI : navigation, salon, jeu, stats
'use strict';

const donnees = Game.chargerDonnees(localStorage);
function sauver() { Game.sauverDonnees(localStorage, donnees); }

const $ = (id) => document.getElementById(id);

// --- Solde + recharge ---
function majSolde() {
  $('affiche-solde').textContent = donnees.solde;
  $('btn-recharger').classList.toggle('cache', donnees.solde >= Game.MISE_MIN);
}
$('btn-recharger').addEventListener('click', () => {
  donnees.solde = Game.SOLDE_DEPART;
  sauver(); majSolde();
});

// --- Navigation ---
let ecranCourant = 'salon';
function afficherEcran(nom) {
  ecranCourant = nom;
  for (const e of ['salon', 'jeu', 'stats']) {
    $('ecran-' + e).classList.toggle('cache', e !== nom);
  }
  $('btn-retour-salon').classList.toggle('cache', nom === 'salon');
  if (nom === 'stats') dessinerStats();
}
$('btn-retour-salon').addEventListener('click', () => afficherEcran('salon'));
$('btn-jouer').addEventListener('click', () => afficherEcran('jeu'));
$('btn-stats').addEventListener('click', () => afficherEcran('stats'));

// --- Carrousel d'avions (salon) ---
let indexAvion = Math.max(0, Game.AVIONS.findIndex(a => a.id === donnees.avion));
const imageAvion = new Image(); // utilisée aussi par le canvas de vol

function majAvion() {
  const avion = Game.AVIONS[indexAvion];
  $('img-avion-salon').src = avion.img;
  $('nom-avion').textContent = avion.nom;
  imageAvion.src = avion.img;
  donnees.avion = avion.id;
  sauver();
}
$('btn-avion-prec').addEventListener('click', () => {
  indexAvion = (indexAvion - 1 + Game.AVIONS.length) % Game.AVIONS.length;
  majAvion();
});
$('btn-avion-suiv').addEventListener('click', () => {
  indexAvion = (indexAvion + 1) % Game.AVIONS.length;
  majAvion();
});

// --- Écran jeu : machine à états ---
const K_CROISSANCE = 0.075;           // m(t) = e^(k*t) : x2 vers ~9 s
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

function majBoutonAction() {
  const btn = $('btn-action');
  btn.classList.toggle('mode-encaisser', etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0);
  if (etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0) {
    btn.disabled = false;
  } else if (etatJeu.phase === 'ATTENTE') {
    btn.textContent = etatJeu.miseProchaine > 0 ? 'MISE PLACÉE : ' + etatJeu.miseProchaine : 'MISER';
    btn.disabled = etatJeu.miseProchaine > 0;
  } else {
    btn.textContent = 'MISER';
    btn.disabled = true;
  }
  $('btn-retour-salon').disabled = (etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0);
}

$('btn-action').addEventListener('click', () => {
  $('message-erreur').textContent = '';
  if (etatJeu.phase === 'ATTENTE') {
    const montant = parseInt($('champ-mise').value, 10);
    const r = Game.placerMise(donnees, Number.isNaN(montant) ? 0 : montant);
    if (!r.ok) { $('message-erreur').textContent = r.erreur; return; }
    etatJeu.miseProchaine = montant;
    sauver(); majSolde();
  } else if (etatJeu.phase === 'VOL' && etatJeu.miseEnCours > 0) {
    encaisserMaintenant(performance.now());
  }
  majBoutonAction();
});

document.querySelectorAll('.mises-rapides button').forEach(b => {
  b.addEventListener('click', () => {
    $('champ-mise').value = b.dataset.mise === 'max' ? Math.max(Game.MISE_MIN, donnees.solde) : b.dataset.mise;
  });
});

function encaisserMaintenant(maintenant) {
  const m = Math.min(multCourant(maintenant), etatJeu.crashA);
  etatJeu.encaisseA = Math.floor(m * 100) / 100;
  const res = Game.resoudreManche(donnees, { mise: etatJeu.miseEnCours, crash: etatJeu.crashA, encaisseA: etatJeu.encaisseA });
  etatJeu.miseEnCours = 0;
  sauver(); majSolde(); majBoutonAction();
  $('affiche-mult').classList.add('gagne');
  $('message-vol').textContent = 'Encaissé : +' + res.gain + ' 🪙';
}

function demarrerAttente(maintenant) {
  etatJeu.phase = 'ATTENTE';
  etatJeu.finAttente = maintenant + DUREE_ATTENTE * 1000;
  etatJeu.miseProchaine = 0;
  etatJeu.encaisseA = null;
  $('affiche-mult').classList.remove('crash', 'gagne');
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

function dessinerVol(maintenant) {
  const dpr = window.devicePixelRatio || 1;
  const larg = canvasVol.clientWidth, haut = canvasVol.clientHeight;
  if (larg === 0 || haut === 0) return;
  if (canvasVol.width !== larg * dpr) { canvasVol.width = larg * dpr; canvasVol.height = haut * dpr; }
  ctxVol.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxVol.clearRect(0, 0, larg, haut);

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
    if (m >= etatJeu.crashA) {
      terminerVol(maintenant);
    } else {
      $('affiche-mult').textContent = 'x' + m.toFixed(2);
      if (etatJeu.miseEnCours > 0) $('btn-action').textContent = 'ENCAISSER ' + Math.round(etatJeu.miseEnCours * m) + ' 🪙';
      const auto = parseFloat($('champ-auto').value);
      if (etatJeu.miseEnCours > 0 && !Number.isNaN(auto) && auto > 1 && m >= auto) encaisserMaintenant(maintenant);
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
document.querySelectorAll('#selecteur-duree button').forEach(b => {
  b.addEventListener('click', () => {
    dureeStats = b.dataset.duree;
    document.querySelectorAll('#selecteur-duree button').forEach(x => x.classList.toggle('actif', x === b));
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

  // série : capital de départ + solde après chaque manche jouée
  const tout = [Game.SOLDE_DEPART, ...donnees.capitalHistorique];
  const n = dureeStats === 'tout' ? tout.length : Math.min(tout.length, parseInt(dureeStats, 10) + 1);
  const serie = tout.slice(-n);

  const s = donnees.stats;
  $('resume-stats').innerHTML =
    carte(s.nbParties, 'parties jouées') + carte(s.totalMise, 'total misé 🪙') +
    carte(s.totalGagne, 'total gagné 🪙') + carte(s.plusGrosGain, 'plus gros gain 🪙');

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

  // ligne de départ (1000) si visible
  if (Game.SOLDE_DEPART >= mini && Game.SOLDE_DEPART <= maxi) {
    ctx.strokeStyle = 'rgba(241,196,15,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(mg, y(Game.SOLDE_DEPART)); ctx.lineTo(larg - md, y(Game.SOLDE_DEPART)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // aire + courbe, couleur selon tendance
  const gagne = serie[serie.length - 1] >= serie[0];
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
  ctx.fillText(serie[serie.length - 1] + ' 🪙', Math.min(dx, larg - 40), Math.max(14, dy - 10));

  // libellé axe X
  ctx.fillStyle = '#9BA4B4'; ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText((serie.length - 1) + ' dernière(s) partie(s)', larg / 2, haut - 8);
}

function carte(valeur, libelle) {
  return '<div class="carte-stat"><div class="valeur">' + valeur + '</div><div class="libelle">' + libelle + '</div></div>';
}

majSolde();
majAvion();
afficherEcran('salon');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
