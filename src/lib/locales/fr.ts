import type { Traductions } from '../traduction';

export const fr: Traductions = {
  chrome: {
    marque: 'AgriCam',
    sousTitre: 'Diagnostic des cultures maraîchères',
    nav: {
      accueil: 'Accueil',
      diagnostic: 'Diagnostic',
      historique: 'Historique',
      carte: 'Carte',
    },
    enLigne: 'En ligne',
    horsLigne: 'Hors ligne',
    modeleIncompatible: 'Modèle incompatible.',
  },
  accueil: {
    etiquette: 'Maraîchage · Cameroun',
    titre: 'Diagnostiquez vos cultures en une photo',
    accroche:
      'AgriCam aide les producteurs de tomate, de piment et d’oignon à identifier les maladies de leur récolte, à voir sur quoi repose le diagnostic, et à savoir quoi faire — sans connexion internet.',
    boutonDiagnostic: 'Lancer un diagnostic',
    boutonHistorique: 'Voir l’historique',
    diagnosticsLibelle: 'diagnostics effectués sur cet appareil',
    fruitsLibelle: 'fruits analysés au total',
    infestationLibelle: 'taux d’infestation détecté',
    dureeLibelle: 'par diagnostic, mesuré sur cet appareil',
    dureeVide: 'pas encore de diagnostic sur cet appareil',
    reconnuTitre: 'Ce que l’application reconnaît',
    reconnuNote:
      'Neuf états sanitaires sur l’organe récolté — le fruit, ou le bulbe pour l’oignon. Exactitude mesurée à 95,9 % sur le jeu de test.',
    cultures: {
      tomate: { nom: 'Tomate', note: '5 états · repérage automatique' },
      piment: { nom: 'Piment', note: '2 états' },
      oignon: { nom: 'Oignon', note: '2 états · bulbe' },
    },
    etapesTitre: 'Comment ça marche',
    etapesNote: 'Six étapes, toutes exécutées sur votre téléphone.',
    etapes: [
      { titre: 'Photo', texte: 'Cadrez le fruit. L’image ne quitte pas votre téléphone.' },
      { titre: 'Contrôle', texte: 'Netteté et lumière vérifiées. Une photo floue est refusée, avec le geste à faire.' },
      { titre: 'Repérage', texte: 'Le détecteur trouve chaque fruit et le découpe. Le diagnostic porte sur le fruit, pas sur la scène.' },
      { titre: 'Diagnostic', texte: 'Chaque fruit est classé. Sous le seuil de confiance, l’application refuse de trancher.' },
      { titre: 'Explication', texte: 'Une carte de chaleur montre les zones qui ont motivé la décision.' },
      { titre: 'Action', texte: 'Les gestes à poser aujourd’hui — et ce qu’il ne faut surtout pas faire.' },
    ],
    distinctionsTitre: 'Ce qui distingue AgriCam',
    distinctions: [
      { titre: 'Aucun serveur', texte: 'Les deux réseaux tournent dans le navigateur. Une fois chargés, tout fonctionne en mode avion. Votre photo n’est envoyée nulle part.' },
      { titre: 'Plusieurs fruits d’un coup', texte: 'Le détecteur isole chaque fruit et les diagnostique un par un. Vous obtenez un taux d’infestation, pas un verdict isolé.' },
      { titre: 'Une décision vérifiable', texte: 'La carte de chaleur permet de contrôler que le modèle regarde la lésion, et non l’arrière-plan. Un diagnostic invérifiable ne vaut rien.' },
      { titre: 'Le doute est annoncé', texte: 'Quand la confiance est trop faible, l’application le dit au lieu d’inventer. Une erreur assumée coûte moins cher qu’une certitude fausse.' },
    ],
    finalTitre: 'Un fruit sous la main ?',
    finalTexte: 'Le diagnostic prend moins d’une seconde.',
    finalBouton: 'Diagnostiquer maintenant',
  },
};
