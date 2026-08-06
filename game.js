// game.js — logique pure du jeu (aucun DOM). Testable sous Node.
(function (racine) {
  'use strict';

  const AVIONS = [
    { id: 'lufthansa', nom: 'Lufthansa A380', img: 'img/lufthansa.png' },
    { id: 'emirates',  nom: 'Emirates A380',  img: 'img/emirates.png' },
    { id: 'airfrance', nom: 'Air France A380', img: 'img/airfrance.png' },
    { id: 'united',    nom: 'United A380',     img: 'img/united.png' },
    { id: 'british',   nom: 'British Airways A380', img: 'img/british.png' },
  ];

  const MISE_MIN = 1;
  const SOLDE_DEPART = 0;
  const DEPOT_MAX = 100000;
  const MAX_CRASHS = 20;

  const DONNEES_DEFAUT = Object.freeze({
    solde: SOLDE_DEPART,
    avion: 'lufthansa',
    capitalHistorique: [],
    bilanHistorique: [],
    crashHistorique: [],
    stats: { totalMise: 0, totalGagne: 0, plusGrosGain: 0, nbParties: 0, totalDepose: 0 },
  });

  function neufDonnees() {
    return JSON.parse(JSON.stringify(DONNEES_DEFAUT));
  }

  function tirerCrash(rnd) {
    const r = (rnd || Math.random)();
    const brut = 0.99 / (1 - r);
    const crash = Math.max(1.00, Math.min(1000, brut));
    return Math.floor(crash * 100) / 100;
  }

  function chargerDonnees(storage) {
    const defaut = neufDonnees();
    let lu;
    try {
      lu = JSON.parse(storage.getItem('aviator-data'));
    } catch (e) {
      lu = null;
    }
    if (!lu || typeof lu !== 'object') return defaut;
    const d = defaut;
    if (Number.isFinite(lu.solde) && lu.solde >= 0) d.solde = Math.floor(lu.solde);
    if (AVIONS.some(a => a.id === lu.avion)) d.avion = lu.avion;
    if (Array.isArray(lu.capitalHistorique)) d.capitalHistorique = lu.capitalHistorique.filter(Number.isFinite);
    if (Array.isArray(lu.bilanHistorique)) d.bilanHistorique = lu.bilanHistorique.filter(Number.isFinite);
    if (Array.isArray(lu.crashHistorique)) d.crashHistorique = lu.crashHistorique.filter(Number.isFinite).slice(-MAX_CRASHS);
    if (lu.stats && typeof lu.stats === 'object') {
      for (const k of ['totalMise', 'totalGagne', 'plusGrosGain', 'nbParties', 'totalDepose']) {
        if (Number.isFinite(lu.stats[k]) && lu.stats[k] >= 0) d.stats[k] = lu.stats[k];
      }
    }
    // migration des anciennes sauvegardes (avant les dépôts) : le solde existant
    // est considéré comme déposé, pour que le bilan (gagné - misé) reste juste
    if (!(lu.stats && Number.isFinite(lu.stats.totalDepose))) {
      d.stats.totalDepose = Math.max(0, d.solde - (d.stats.totalGagne - d.stats.totalMise));
    }
    if (!Array.isArray(lu.bilanHistorique) && d.capitalHistorique.length > 0) {
      d.bilanHistorique = [];
    }
    return d;
  }

  function sauverDonnees(storage, donnees) {
    storage.setItem('aviator-data', JSON.stringify(donnees));
  }

  function placerMise(donnees, montant) {
    if (!Number.isInteger(montant)) return { ok: false, erreur: 'La mise doit être un nombre entier.' };
    if (montant < MISE_MIN) return { ok: false, erreur: 'Mise minimum : ' + MISE_MIN + ' €.' };
    if (montant > donnees.solde) return { ok: false, erreur: 'Solde insuffisant.' };
    donnees.solde -= montant;
    donnees.stats.totalMise += montant;
    return { ok: true };
  }

  function deposer(donnees, montant) {
    if (!Number.isInteger(montant) || montant < 1) return { ok: false, erreur: 'Montant invalide (minimum 1 €).' };
    if (montant > DEPOT_MAX) return { ok: false, erreur: 'Maximum ' + DEPOT_MAX + ' € par dépôt.' };
    donnees.solde += montant;
    donnees.stats.totalDepose += montant;
    return { ok: true };
  }

  function bilan(donnees) {
    return donnees.stats.totalGagne - donnees.stats.totalMise;
  }

  function resoudreManche(donnees, manche) {
    let gain = 0;
    if (manche.encaisseA !== null && manche.encaisseA !== undefined) {
      gain = Math.round(manche.mise * manche.encaisseA);
      donnees.solde += gain;
      donnees.stats.totalGagne += gain;
      if (gain > donnees.stats.plusGrosGain) donnees.stats.plusGrosGain = gain;
    }
    donnees.stats.nbParties += 1;
    donnees.capitalHistorique.push(donnees.solde);
    donnees.bilanHistorique.push(bilan(donnees));
    return { gain };
  }

  function enregistrerCrash(donnees, crash) {
    donnees.crashHistorique.push(crash);
    if (donnees.crashHistorique.length > MAX_CRASHS) {
      donnees.crashHistorique.splice(0, donnees.crashHistorique.length - MAX_CRASHS);
    }
  }

  const api = {
    AVIONS, DONNEES_DEFAUT, MISE_MIN, SOLDE_DEPART, DEPOT_MAX,
    tirerCrash, chargerDonnees, sauverDonnees,
    placerMise, resoudreManche, enregistrerCrash, deposer, bilan,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
