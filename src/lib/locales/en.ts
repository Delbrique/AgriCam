import type { Traductions } from '../traduction';

export const en: Traductions = {
  chrome: {
    marque: 'AgriCam',
    sousTitre: 'Diagnosis for vegetable crops',
    nav: {
      accueil: 'Home',
      diagnostic: 'Diagnosis',
      historique: 'History',
      carte: 'Map',
    },
    enLigne: 'Online',
    horsLigne: 'Offline',
    modeleIncompatible: 'Incompatible model.',
  },
  accueil: {
    etiquette: 'Vegetable farming · Cameroon',
    titre: 'Diagnose your crops with a single photo',
    accroche:
      'AgriCam helps tomato, pepper and onion growers identify diseases in their harvest, see what the diagnosis is based on, and know what to do next — with no internet connection.',
    boutonDiagnostic: 'Start a diagnosis',
    boutonHistorique: 'View history',
    chiffres: [
      { valeur: '95.9', unite: '%', libelle: 'accuracy on the test set' },
      { valeur: '0.65', unite: 's', libelle: 'per diagnosis' },
      { valeur: '9', unite: '', libelle: 'states recognised · 3 crops' },
      { valeur: '100', unite: '%', libelle: 'offline · no data ever sent' },
    ],
    reconnuTitre: 'What the app recognises',
    reconnuNote:
      'Nine health states on the harvested organ — the fruit, or the bulb for onion.',
    cultures: {
      tomate: { nom: 'Tomato', note: '5 states · automatic detection' },
      piment: { nom: 'Pepper', note: '2 states' },
      oignon: { nom: 'Onion', note: '2 states · bulb' },
    },
    etapesTitre: 'How it works',
    etapesNote: 'Six steps, all run on your phone.',
    etapes: [
      { titre: 'Photo', texte: 'Frame the fruit. The picture never leaves your phone.' },
      { titre: 'Check', texte: 'Sharpness and light are checked. A blurry photo is rejected, with guidance on what to fix.' },
      { titre: 'Detection', texte: 'The detector finds each fruit and crops it out. The diagnosis is made per fruit, not on the whole scene.' },
      { titre: 'Diagnosis', texte: 'Each fruit is classified. Below the confidence threshold, the app refuses to decide.' },
      { titre: 'Explanation', texte: 'A heat map shows the areas that drove the decision.' },
      { titre: 'Action', texte: 'The steps to take today — and what not to do.' },
    ],
    distinctionsTitre: 'What sets AgriCam apart',
    distinctions: [
      { titre: 'No server', texte: 'Both networks run in the browser. Once loaded, everything works in airplane mode. Your photo is never sent anywhere.' },
      { titre: 'Several fruits at once', texte: 'The detector isolates each fruit and diagnoses them one by one. You get an infestation rate, not a single isolated verdict.' },
      { titre: 'A verifiable decision', texte: 'The heat map lets you check that the model is looking at the lesion, not the background. An unverifiable diagnosis is worthless.' },
      { titre: 'Doubt is disclosed', texte: 'When confidence is too low, the app says so instead of guessing. An admitted error costs less than a false certainty.' },
    ],
    finalTitre: 'Got a fruit at hand?',
    finalTexte: 'The diagnosis takes less than a second.',
    finalBouton: 'Diagnose now',
  },
};
