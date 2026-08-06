// game.js — logique pure du jeu (aucun DOM). Testable sous Node.
(function (racine) {
  'use strict';

  // Boutique : l'ordre = l'ordre d'affichage et de prix croissant.
  // `img` pointe vers img/avionN.png (déposer l'image, elle apparaît).
  // `minMult` (optionnel) impose un multiplicateur de crash minimum : bonus
  // caché du dernier avion, jamais annoncé dans l'interface.
  const AVIONS = [
    { id: 'avion1',  nom: 'Air France A220',      img: 'img/avion1.png',  prix: 0 },
    { id: 'avion2',  nom: 'Ryanair 737',          img: 'img/avion2.png',  prix: 25 },
    { id: 'avion3',  nom: 'easyJet A320',         img: 'img/avion3.png',  prix: 50 },
    { id: 'avion4',  nom: 'Virgin Atlantic 787',  img: 'img/avion4.png',  prix: 100 },
    { id: 'avion5',  nom: 'United 777',           img: 'img/avion5.png',  prix: 175 },
    { id: 'avion6',  nom: 'UPS 747 Cargo',        img: 'img/avion6.png',  prix: 275 },
    { id: 'avion7',  nom: 'Singapore A380',       img: 'img/avion7.png',  prix: 400 },
    { id: 'avion8',  nom: 'Antonov An-225',       img: 'img/avion8.png',  prix: 600 },
    { id: 'avion9',  nom: 'E-3 Sentry AWACS',     img: 'img/avion9.png',  prix: 800 },
    { id: 'avion10', nom: 'B-2 Spirit',           img: 'img/avion10.png', prix: 1000, minMult: 5 },
  ];

  const VERSION = 3;              // incrémenter remet les sauvegardes à zéro
  const MISE_MIN = 1;
  const SOLDE_DEPART = 0;
  const DEPOT_MAX = 100000;
  const MAX_CRASHS = 20;

  const DONNEES_DEFAUT = Object.freeze({
    version: VERSION,
    solde: SOLDE_DEPART,
    avion: 'avion1',
    avionsPossedes: ['avion1'],
    capitalHistorique: [],
    bilanHistorique: [],
    crashHistorique: [],
    stats: { totalMise: 0, totalGagne: 0, plusGrosGain: 0, nbParties: 0, totalDepose: 0 },
  });

  function neufDonnees() {
    return JSON.parse(JSON.stringify(DONNEES_DEFAUT));
  }

  function avionParId(id) {
    return AVIONS.find(a => a.id === id) || AVIONS[0];
  }

  function tirerCrash(rnd, minMult) {
    const r = (rnd || Math.random)();
    const brut = 0.99 / (1 - r);
    const crash = Math.max(1.00, Math.min(1000, brut));
    return Math.max(minMult || 1, Math.floor(crash * 100) / 100);
  }

  function chargerDonnees(storage) {
    const defaut = neufDonnees();
    let lu;
    try {
      lu = JSON.parse(storage.getItem('aviator-data'));
    } catch (e) {
      lu = null;
    }
    // sauvegarde absente, illisible ou d'une version antérieure : on repart de zéro
    if (!lu || typeof lu !== 'object' || lu.version !== VERSION) return defaut;
    const d = defaut;
    if (Number.isFinite(lu.solde) && lu.solde >= 0) d.solde = Math.floor(lu.solde);
    if (Array.isArray(lu.avionsPossedes)) {
      const possedes = lu.avionsPossedes.filter(id => AVIONS.some(a => a.id === id));
      if (!possedes.includes(AVIONS[0].id)) possedes.unshift(AVIONS[0].id);
      d.avionsPossedes = possedes;
    }
    if (d.avionsPossedes.includes(lu.avion)) d.avion = lu.avion;
    if (Array.isArray(lu.capitalHistorique)) d.capitalHistorique = lu.capitalHistorique.filter(Number.isFinite);
    if (Array.isArray(lu.bilanHistorique)) d.bilanHistorique = lu.bilanHistorique.filter(Number.isFinite);
    if (Array.isArray(lu.crashHistorique)) d.crashHistorique = lu.crashHistorique.filter(Number.isFinite).slice(-MAX_CRASHS);
    if (lu.stats && typeof lu.stats === 'object') {
      for (const k of ['totalMise', 'totalGagne', 'plusGrosGain', 'nbParties', 'totalDepose']) {
        if (Number.isFinite(lu.stats[k]) && lu.stats[k] >= 0) d.stats[k] = lu.stats[k];
      }
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

  function possede(donnees, id) {
    return donnees.avionsPossedes.includes(id);
  }

  function acheterAvion(donnees, id) {
    const avion = AVIONS.find(a => a.id === id);
    if (!avion) return { ok: false, erreur: 'Avion inconnu.' };
    if (possede(donnees, id)) return { ok: false, erreur: 'Avion déjà débloqué.' };
    if (avion.prix > donnees.solde) return { ok: false, erreur: 'Il te manque ' + (avion.prix - donnees.solde) + ' €.' };
    donnees.solde -= avion.prix;
    donnees.avionsPossedes.push(id);
    return { ok: true };
  }

  function choisirAvion(donnees, id) {
    if (!possede(donnees, id)) return { ok: false, erreur: 'Avion verrouillé.' };
    donnees.avion = id;
    return { ok: true };
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

  function bilan(donnees) {
    return donnees.stats.totalGagne - donnees.stats.totalMise;
  }

  // Repart d'une partie vierge : argent, historiques, stats et avions débloqués.
  // Modifie l'objet en place pour que les références existantes restent valides.
  function reinitialiser(donnees) {
    const vierge = neufDonnees();
    for (const cle of Object.keys(donnees)) delete donnees[cle];
    Object.assign(donnees, vierge);
    return donnees;
  }

  const api = {
    AVIONS, DONNEES_DEFAUT, VERSION, MISE_MIN, SOLDE_DEPART, DEPOT_MAX,
    tirerCrash, chargerDonnees, sauverDonnees, avionParId,
    placerMise, resoudreManche, enregistrerCrash, deposer, bilan,
    possede, acheterAvion, choisirAvion, reinitialiser,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
