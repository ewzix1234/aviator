# Aviator — jeu de crash à argent fictif (design)

Date : 2026-08-06
Statut : validé oralement par Elliot, en attente de relecture du document

## Objectif

Mini-jeu type « Aviator » (crash game) pour s'amuser, avec de l'argent **100 % fictif**.
PWA vanilla HTML/CSS/JS, mobile-first, déployée sur GitHub Pages
(`https://ewzix1234.github.io/aviator/`), même stack que musculog et restaurant-pwa.
Aucune dépendance externe, aucun argent réel, aucun compte.

## Écrans

L'app a 3 écrans (sections montrées/cachées dans une seule page) : **Salon**, **Jeu**, **Stats**.
Le solde fictif est affiché en permanence en haut, partagé entre tous les écrans.

### 1. Salon (accueil)

- Solde en haut (ex. 🪙 1 000).
- Au centre : l'avion sélectionné en grand, flèches ◀ ▶ sur les côtés pour changer
  d'avion (carrousel circulaire). Choix mémorisé en localStorage.
- En dessous : gros bouton **JOUER** → écran Jeu.
- Lien/onglet vers **Stats**.

### 2. Jeu

- L'avion sélectionné décolle ; une courbe et le multiplicateur (x1.00 → …) montent
  sur un canvas animé (requestAnimationFrame, ~60 fps).
- Machine à états : `ATTENTE` (mise ouverte, compte à rebours ~5 s) → `VOL`
  (multiplicateur monte) → `CRASH` (avion s'envole/explose, résultats) → retour `ATTENTE`.
- **Mise** : champ montant + boutons rapides (10/50/100/max). Mise placée pendant `ATTENTE`.
- **Encaisser** : bouton pendant `VOL` → gain = mise × multiplicateur courant. Sinon mise perdue au crash.
- **Auto-cashout** : champ optionnel « encaisser à x__ » qui encaisse automatiquement.
- **Historique** : bandeau des derniers multiplicateurs de crash, coloré
  (rouge < x2, vert ≥ x2, doré ≥ x10).
- Bouton **← Salon**, désactivé pendant un vol avec mise active (évite de perdre une mise par erreur).
- **Mise auto** (ajout du 2026-08-07) : interrupteur « 🔁 Mise auto » qui replace
  automatiquement la mise du champ au début de chaque manche. Se désactive tout seul
  (avec message) si la mise devient invalide ou le solde insuffisant. Non persisté :
  repart sur OFF à chaque chargement de page.

### 3. Stats

- **Sélecteur de vue** (ajout 2026-08-07) : **Capital** (solde après chaque manche) ou
  **Bilan ±** (gagné − misé cumulé, positif ou négatif, ligne de zéro en pointillés ;
  courbe verte au-dessus de zéro, rouge en dessous).
- **Sélecteur de durée** : 10 / 25 / 50 dernières parties / **Tout** (depuis le début).
- 6 cartes : bilan (coloré vert/rouge), total ajouté, parties jouées, total misé,
  total gagné, plus gros gain.
- Rendu du graphe en canvas, sans librairie.

## Logique du jeu

- **Tirage du crash** : distribution type Aviator, `crash = max(1.00, 0.99 / (1 - r))`
  avec `r` uniforme [0,1) — médiane ≈ x2, beaucoup de petits crashs, rares gros x50+.
  Plafond raisonnable (ex. x1000).
- **Solde de départ** : 0 € (mise à jour du 2026-08-07 — avant : 1 000 jetons).
  Bouton **＋ Ajouter** toujours visible dans l'en-tête : ouvre une fenêtre de dépôt
  d'argent fictif façon Winamax (montants rapides 10/20/50/100/200/500 € + champ libre,
  plafond 100 000 € par dépôt). Le total déposé est suivi dans `stats.totalDepose`,
  ce qui permet de distinguer le solde du **bilan réel** (gagné − misé).
- **Monnaie** : euros (€) partout, plus de jetons 🪙.
- La logique pure (tirage, gains, historique du capital) vit dans `game.js`, séparée du
  DOM/canvas, pour être testable indépendamment.

## Avions

- 2 avions issus d'images fournies par Elliot (stickers A380 Lufthansa et Emirates),
  **détourées** avec `tools/detourer.swift` (Vision) et copiées dans `img/`.
- 3 livrées **dessinées à la main en SVG** (ajout 2026-08-07) : Air France, United,
  British Airways. Source éditable : `tools/livrees.html` (un `<svg>` par compagnie,
  même gabarit d'A380) ; rendu en PNG transparent 570×260 via Playwright.
- Liste des avions déclarée dans un petit tableau JS (`id`, `nom`, `fichier image`) →
  en ajouter un nouveau = déposer une image + une ligne dans le tableau.

## Données (localStorage, clé unique `aviator-data`)

```json
{
  "solde": 1000,
  "avion": "lufthansa",
  "capitalHistorique": [1000, 950, 1140],
  "crashHistorique": [1.24, 5.6, 2.01],
  "stats": { "totalMise": 0, "totalGagne": 0, "plusGrosGain": 0, "nbParties": 0 }
}
```

- `capitalHistorique` : solde après chaque manche **où une mise a été jouée** (les manches
  regardées sans miser ne comptent pas). Alimente la courbe Stats.
- Écriture après chaque manche ; lecture au chargement avec valeurs par défaut si absent/corrompu.

## Fichiers

```
aviator/
├── index.html        # 3 sections (salon / jeu / stats)
├── style.css         # mobile-first
├── app.js            # UI, navigation, machine à états, canvas
├── game.js           # logique pure (tirage crash, gains, données)
├── sw.js             # service worker (cache offline, versionné)
├── manifest.json     # PWA installable
└── img/              # avions détourés + icônes PWA
```

## Gestion des erreurs

- localStorage corrompu ou absent → réinitialisation aux valeurs par défaut.
- Solde insuffisant → mise refusée avec message, bouton Recharger proposé.
- Images d'avion manquantes → avion de secours dessiné en canvas (simple silhouette).

## Tests

- `game.js` testé à la main via une petite page/console : distribution du tirage
  (médiane ~x2), calcul des gains, bornes (mise > solde, crash à x1.00).
- Test manuel sur mobile (iOS Safari) : responsive, installation PWA, offline.

## Hors scope v1

Faux joueurs animés, double mise simultanée, sons, classements en ligne.
