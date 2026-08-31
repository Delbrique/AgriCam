import type { Traductions } from '../traduction';

export const fr: Traductions = {
  chrome: {
    marque: 'AgriCam',
    sousTitre: 'Diagnostic des cultures maraîchères',
    nav: {
      tableauDeBord: 'Tableau de bord',
      diagnostic: 'Diagnostic',
      communaute: 'Communauté',
    },
    modeleIncompatible: 'Modèle incompatible.',
  },
  commun: {
    cultures: { toutes: 'Toutes', tomate: 'Tomate', piment: 'Piment', oignon: 'Oignon' },
  },
  tableauDeBord: {
    salutations: {
      nuit: 'Bonne nuit',
      matin: 'Bonjour',
      apresMidi: 'Bon après-midi',
      soir: 'Bonsoir',
    },
    intro:
      "AgriCam diagnostique les maladies de vos plants de tomate, piment et oignon à partir d'une simple photo, même sans connexion.",
    alertesCritiques: (n) => `${n} alerte${n > 1 ? 's' : ''} critique${n > 1 ? 's' : ''} à vérifier`,
    culturesVontBien: 'Vos cultures se portent bien',
    nouveauDiagnostic: '+ Nouveau diagnostic',
    periodes: { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', tout: 'Tout' },
    chargement: 'Lecture du tableau de bord…',
    variation: (pct) => `${pct > 0 ? '+' : ''}${pct} % vs période précédente`,
    kpi: {
      diagnosticsEffectues: 'diagnostics effectués',
      plantsSains: 'plants sains',
      alertesCritiques: 'alertes critiques',
      maladiePredominante: 'maladie prédominante',
    },
    etatSanitaire: 'État sanitaire',
    repartitionMaladies: 'Répartition des maladies',
    culturesDiagnostiquees: 'Cultures diagnostiquées',
    derniersDiagnostics: 'Derniers diagnostics',
    carteDiagnostics: 'Carte des diagnostics',
    evolutionTemporelle: 'Évolution temporelle',
    recommandations: 'Recommandations',
    exporterCsv: 'Exporter en CSV',
    exporterPdf: 'Exporter en PDF',
  },
  installApp: {
    texte:
      "Installez AgriCam sur votre écran d'accueil : l'application s'ouvre alors comme les autres, et le mode hors ligne est bien plus fiable qu'un simple lien.",
    bouton: "Installer l'application",
  },
  listeDiagnostics: {
    aucunDiagnostic: "Aucun diagnostic pour l'instant.",
    lancerDiagnostic: 'Lancer un diagnostic',
    toutesCultures: 'Toutes cultures',
    tousStatuts: 'Tous statuts',
    statutSain: 'Sain',
    statutSurveiller: 'À surveiller',
    statutCritique: 'Critique',
    statutHorsSujet: 'Hors sujet',
    statutIncertain: 'Incertain',
    aucunFiltre: 'Aucun diagnostic ne correspond à ces filtres.',
    photoNonReconnue: 'Photo non reconnue',
    horsSujetTexte:
      'Cette photo ne ressemblait à aucune des cultures reconnues (tomate, piment, oignon).',
    incertainTexte: 'Confiance insuffisante pour trancher entre les maladies connues.',
    supprimer: 'Supprimer',
    afficherPlus: (n) => `Afficher plus (${n} restants)`,
    dateInstant: 'à l’instant',
    dateMinutes: (n) => `il y a ${n} min`,
    dateHeures: (n) => `il y a ${n} h`,
    dateJours: (n) => `il y a ${n} j`,
    geolocalise: 'géolocalisé',
  },
  donutMaladies: {
    aucune: "Aucune maladie détectée pour l'instant.",
    fruit: (n) => `${n} fruit${n > 1 ? 's' : ''}`,
  },
  barresCultures: {
    aucun: "Aucun diagnostic pour l'instant.",
    diagnostiques: 'Diagnostiqués',
    atteintsGraves: 'Atteints/graves',
    ligneDetail: (n, atteints, pct) =>
      `${n} diagnostiqué${n > 1 ? 's' : ''} · ${atteints} atteint${atteints > 1 ? 's' : ''} (${pct} %)`,
  },
  tendance: {
    titre: 'Maladies fréquentes',
    apparaitra: 'Apparaîtra après vos premiers diagnostics.',
    surCas: (n) => `sur ${n} cas atteints`,
  },
  courbeEvolution: {
    pasAssez: 'Pas encore assez de diagnostics pour tracer une évolution.',
    total: 'Total',
  },
  boutonMiseAJour: {
    verifier: 'Vérifier les mises à jour',
    effectuee: 'Vérification effectuée.',
    indisponible: 'Indisponible sur ce navigateur.',
  },
};
