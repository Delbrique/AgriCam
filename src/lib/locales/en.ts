import type { Traductions } from '../traduction';

export const en: Traductions = {
  chrome: {
    marque: 'AgriCam',
    sousTitre: 'Diagnosis for vegetable crops',
    nav: {
      tableauDeBord: 'Dashboard',
      diagnostic: 'Diagnosis',
      communaute: 'Community',
    },
    modeleIncompatible: 'Incompatible model.',
  },
  commun: {
    cultures: { toutes: 'All', tomate: 'Tomato', piment: 'Pepper', oignon: 'Onion' },
  },
  tableauDeBord: {
    salutations: {
      nuit: 'Good night',
      matin: 'Good morning',
      apresMidi: 'Good afternoon',
      soir: 'Good evening',
    },
    intro:
      'AgriCam diagnoses diseases on your tomato, pepper and onion plants from a simple photo, even without a connection.',
    alertesCritiques: (n) => `${n} critical alert${n > 1 ? 's' : ''} to check`,
    culturesVontBien: 'Your crops are doing well',
    nouveauDiagnostic: '+ New diagnosis',
    periodes: { jour: 'Day', semaine: 'Week', mois: 'Month', tout: 'All' },
    chargement: 'Loading dashboard…',
    variation: (pct) => `${pct > 0 ? '+' : ''}${pct}% vs previous period`,
    kpi: {
      diagnosticsEffectues: 'diagnoses run',
      plantsSains: 'healthy plants',
      alertesCritiques: 'critical alerts',
      maladiePredominante: 'top disease',
    },
    etatSanitaire: 'Plant health',
    repartitionMaladies: 'Disease breakdown',
    culturesDiagnostiquees: 'Crops diagnosed',
    derniersDiagnostics: 'Recent diagnoses',
    carteDiagnostics: 'Diagnosis map',
    evolutionTemporelle: 'Trend over time',
    recommandations: 'Recommendations',
    exporterCsv: 'Export as CSV',
    exporterPdf: 'Export as PDF',
  },
  installApp: {
    texte:
      "Install AgriCam on your home screen: the app then opens like any other, and offline mode is far more reliable than a plain link.",
    bouton: 'Install the app',
  },
  listeDiagnostics: {
    aucunDiagnostic: 'No diagnosis yet.',
    lancerDiagnostic: 'Run a diagnosis',
    toutesCultures: 'All crops',
    tousStatuts: 'All statuses',
    statutSain: 'Healthy',
    statutSurveiller: 'To watch',
    statutCritique: 'Critical',
    statutHorsSujet: 'Off-topic',
    statutIncertain: 'Uncertain',
    aucunFiltre: 'No diagnosis matches these filters.',
    photoNonReconnue: 'Photo not recognized',
    horsSujetTexte: "This photo didn't resemble any of the recognized crops (tomato, pepper, onion).",
    incertainTexte: 'Not enough confidence to decide between the known diseases.',
    supprimer: 'Delete',
    afficherPlus: (n) => `Show more (${n} left)`,
    dateInstant: 'just now',
    dateMinutes: (n) => `${n} min ago`,
    dateHeures: (n) => `${n} h ago`,
    dateJours: (n) => `${n} d ago`,
    geolocalise: 'geolocated',
  },
  donutMaladies: {
    aucune: 'No disease detected yet.',
    fruit: (n) => `${n} fruit${n > 1 ? 's' : ''}`,
  },
  barresCultures: {
    aucun: 'No diagnosis yet.',
    diagnostiques: 'Diagnosed',
    atteintsGraves: 'Affected/severe',
    ligneDetail: (n, atteints, pct) =>
      `${n} diagnosed · ${atteints} affected (${pct}%)`,
  },
  tendance: {
    titre: 'Frequent diseases',
    apparaitra: 'Will appear after your first diagnoses.',
    surCas: (n) => `out of ${n} affected cases`,
  },
  courbeEvolution: {
    pasAssez: 'Not enough diagnoses yet to chart a trend.',
    total: 'Total',
  },
  boutonMiseAJour: {
    verifier: 'Check for updates',
    effectuee: 'Check complete.',
    indisponible: 'Unavailable in this browser.',
  },
};
