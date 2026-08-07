// game.js — logique pure du jeu (aucun DOM). Testable sous Node.
(function (racine) {
  'use strict';

  // Boutique : l'ordre = l'ordre d'affichage et de prix croissant.
  // `img` pointe vers img/avionN.png (déposer l'image, elle apparaît).
  // `nom` = le modèle seul, sans la compagnie.
  // `fond` (optionnel) : décor animé dessiné derrière la courbe de vol. Purement
  // cosmétique — aucun avion ne modifie les probabilités de crash.
  // Barème plafonné à 400 € : les premiers avions gardent leur prix d'origine
  // (25, 50 €) pour rester de vrais paliers, seul le haut de la gamme est
  // resserré — l'écart entre deux avions grandit donc moins vite qu'avant.
  const AVIONS = [
    { id: 'avion1',  nom: 'A220',       img: 'img/avion1.png',  prix: 0 },
    { id: 'avion2',  nom: '737-800',    img: 'img/avion2.png',  prix: 25 },
    { id: 'avion3',  nom: 'A320',       img: 'img/avion3.png',  prix: 50 },
    { id: 'avion4',  nom: '787-9',      img: 'img/avion4.png',  prix: 80 },
    { id: 'avion5',  nom: '777-300ER',  img: 'img/avion5.png',  prix: 110 },
    { id: 'avion6',  nom: '747-8F',     img: 'img/avion6.png',  prix: 145 },
    { id: 'avion7',  nom: 'A380',       img: 'img/avion7.png',  prix: 190 },
    { id: 'avion8',  nom: 'An-225',     img: 'img/avion8.png',  prix: 250 },
    { id: 'avion9',  nom: 'E-3 Sentry', img: 'img/avion9.png',  prix: 320 },
    { id: 'avion10', nom: 'B-2 Spirit', img: 'img/avion10.png', prix: 400, fond: 'furtif' },
  ];

  const VERSION = 3;              // incrémenter remet les sauvegardes à zéro
  const MISE_MIN = 1;
  const SOLDE_DEPART = 0;
  const DEPOT_PAS = 10;           // on ajoute l'argent 10 € par 10 €
  const MAX_CRASHS = 20;

  // Mêmes probabilités que l'Aviator de Spribe : RTP 97 % (avantage maison 3 %).
  // crash = 0.97 / (1 - r) donne P(atteindre m) = 0.97 / m, donc ~48,5 % de chances
  // d'atteindre x2, 9,7 % d'atteindre x10, et 3 % des manches (r < 0.03) crashent
  // instantanément à x1.00, soit environ 1 manche sur 33.
  const RTP = 0.97;
  const MULT_MAX = 1000000;

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

  // L'argent se compte au centime. Tout calcul passe par ici pour éviter les
  // dérives de virgule flottante (0.1 + 0.2 = 0.30000000000000004).
  function arrondi2(x) {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }

  // Un montant valide : un nombre fini, positif, avec au plus 2 décimales.
  function montantValide(x) {
    return Number.isFinite(x) && x > 0 && arrondi2(x) === x;
  }

  function avionParId(id) {
    return AVIONS.find(a => a.id === id) || AVIONS[0];
  }

  function tirerCrash(rnd) {
    const r = (rnd || Math.random)();
    const brut = RTP / (1 - r);
    const crash = Math.max(1.00, Math.min(MULT_MAX, brut));
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
    // sauvegarde absente, illisible ou d'une version antérieure : on repart de zéro
    if (!lu || typeof lu !== 'object' || lu.version !== VERSION) return defaut;
    const d = defaut;
    if (Number.isFinite(lu.solde) && lu.solde >= 0) d.solde = arrondi2(lu.solde);
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
    if (!montantValide(montant)) return { ok: false, erreur: 'Montant invalide (2 décimales maximum).' };
    if (montant < MISE_MIN) return { ok: false, erreur: 'Mise minimum : ' + MISE_MIN + ' €.' };
    if (montant > donnees.solde) return { ok: false, erreur: 'Solde insuffisant.' };
    donnees.solde = arrondi2(donnees.solde - montant);
    donnees.stats.totalMise = arrondi2(donnees.stats.totalMise + montant);
    return { ok: true };
  }

  // Recharge volontairement avare : 10 € à la fois, et seulement une fois ruiné.
  // Impossible donc de cumuler des dépôts pour s'offrir les gros avions d'entrée :
  // il faut les gagner en jouant.
  function deposer(donnees, montant) {
    if (donnees.solde > 0) {
      return { ok: false, erreur: 'Ajout possible uniquement quand ton solde est à 0 €.' };
    }
    if (montant !== DEPOT_PAS) {
      return { ok: false, erreur: 'Tu peux ajouter ' + DEPOT_PAS + ' € à la fois.' };
    }
    donnees.solde = arrondi2(donnees.solde + montant);
    donnees.stats.totalDepose = arrondi2(donnees.stats.totalDepose + montant);
    return { ok: true };
  }

  function peutDeposer(donnees) {
    return donnees.solde <= 0;
  }

  function possede(donnees, id) {
    return donnees.avionsPossedes.includes(id);
  }

  function acheterAvion(donnees, id) {
    const avion = AVIONS.find(a => a.id === id);
    if (!avion) return { ok: false, erreur: 'Avion inconnu.' };
    if (possede(donnees, id)) return { ok: false, erreur: 'Avion déjà débloqué.' };
    if (avion.prix > donnees.solde) return { ok: false, erreur: 'Il te manque ' + arrondi2(avion.prix - donnees.solde) + ' €.' };
    donnees.solde = arrondi2(donnees.solde - avion.prix);
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
      gain = arrondi2(manche.mise * manche.encaisseA);
      donnees.solde = arrondi2(donnees.solde + gain);
      donnees.stats.totalGagne = arrondi2(donnees.stats.totalGagne + gain);
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
    return arrondi2(donnees.stats.totalGagne - donnees.stats.totalMise);
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
    AVIONS, DONNEES_DEFAUT, VERSION, MISE_MIN, SOLDE_DEPART, DEPOT_PAS, RTP, MULT_MAX,
    tirerCrash, chargerDonnees, sauverDonnees, avionParId,
    placerMise, resoudreManche, enregistrerCrash, deposer, peutDeposer, bilan,
    possede, acheterAvion, choisirAvion, reinitialiser, arrondi2,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
