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

function dessinerStats() {} // remplacé en Task 5

majSolde();
majAvion();
afficherEcran('salon');
