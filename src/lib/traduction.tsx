/**
 * Systeme de traduction maison (FR/EN), sans i18next : l'application ne
 * traduit pour l'instant que le chrome (en-tete/navigation), un volume qui
 * ne justifie pas une dependance supplementaire sur une PWA qui charge deja
 * des modeles tfjs/onnx lourds. Le tableau de bord et le diagnostic restent
 * en francais uniquement, comme avant eux l'historique et la carte.
 *
 * `t` expose directement l'objet de traduction de la langue active : les
 * appelants ecrivent `t.accueil.titre` plutot que `t('accueil.titre')`, ce qui
 * donne l'autocompletion ET une erreur de compilation si une cle manque dans
 * un des deux dictionnaires (voir l'interface Traductions ci-dessous, que
 * fr.ts et en.ts doivent toutes deux respecter).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fr } from './locales/fr';
import { en } from './locales/en';

export interface Traductions {
  chrome: {
    marque: string;
    sousTitre: string;
    nav: {
      tableauDeBord: string;
      diagnostic: string;
      communaute: string;
    };
    modeleIncompatible: string;
    reessayer: string;
  };
  commun: {
    cultures: { toutes: string; tomate: string; piment: string; oignon: string };
    ou: string;
  };
  tableauDeBord: {
    salutations: { nuit: string; matin: string; apresMidi: string; soir: string };
    intro: string;
    alertesCritiques: (n: number) => string;
    culturesVontBien: string;
    nouveauDiagnostic: string;
    periodes: { jour: string; semaine: string; mois: string; tout: string };
    chargement: string;
    variation: (pct: number) => string;
    kpi: {
      diagnosticsEffectues: string;
      plantsSains: string;
      alertesCritiques: string;
      maladiePredominante: string;
    };
    etatSanitaire: string;
    repartitionMaladies: string;
    culturesDiagnostiquees: string;
    derniersDiagnostics: string;
    carteDiagnostics: string;
    evolutionTemporelle: string;
    recommandations: string;
    exporterCsv: string;
    exporterPdf: string;
  };
  installApp: {
    texte: string;
    bouton: string;
  };
  listeDiagnostics: {
    aucunDiagnostic: string;
    lancerDiagnostic: string;
    toutesCultures: string;
    tousStatuts: string;
    statutSain: string;
    statutSurveiller: string;
    statutCritique: string;
    statutHorsSujet: string;
    statutIncertain: string;
    aucunFiltre: string;
    photoNonReconnue: string;
    horsSujetTexte: string;
    incertainTexte: string;
    supprimer: string;
    afficherPlus: (n: number) => string;
    dateInstant: string;
    dateMinutes: (n: number) => string;
    dateHeures: (n: number) => string;
    dateJours: (n: number) => string;
    geolocalise: string;
  };
  donutMaladies: {
    aucune: string;
    fruit: (n: number) => string;
  };
  barresCultures: {
    aucun: string;
    diagnostiques: string;
    atteintsGraves: string;
    ligneDetail: (n: number, atteints: number, pct: number) => string;
  };
  tendance: {
    titre: string;
    apparaitra: string;
    surCas: (n: number) => string;
  };
  courbeEvolution: {
    pasAssez: string;
    total: string;
  };
  boutonMiseAJour: {
    verifier: string;
    effectuee: string;
    indisponible: string;
  };
  syntheseTableauDeBord: {
    aucunDiagnostic: string;
    analyseEnCours: string;
    resumeDiagnostics: (n: number) => string;
    resumeTauxSain: (pct: number) => string;
    resumeAlertesCritiques: (n: number) => string;
    resumeMaladiePredominante: (nom: string, n: number) => string;
  };
  bandeSeverite: {
    diagnosticIncertain: string;
    diagnostic: (nom: string, pct: number) => string;
    retenu: string;
  };
  carteFoyers: {
    vousEtesIci: string;
    vousEtesIciLieu: (lieu: string) => string;
    localisationEnCours: string;
    parcelle: string;
    aucuneParcelle: string;
    aucunGeolocalise: string;
    aucunGeolocaliseCulture: string;
    graviteSain: string;
    graviteAlerte: string;
    graviteAtteint: string;
    graviteGrave: string;
  };
  gestionParcelles: {
    titre: string;
    nouvelleParcelle: string;
    aideRattachement: string;
    nomLabel: string;
    nomPlaceholder: string;
    cultureLabel: string;
    utiliserPosition: string;
    positionIndisponible: string;
    creer: string;
    annuler: string;
    aucuneParcelleTexte: string;
    centrerCarte: string;
    valider: string;
    renommer: (nom: string) => string;
    supprimer: (nom: string) => string;
    consultations: (n: number, pct: number) => string;
    pasEncoreConsultation: string;
    repereeSurCarte: string;
    tendanceHausse: string;
    tendanceBaisse: string;
    tendanceStable: string;
  };
  notificationsFoyers: {
    notifications: string;
    notificationsAvecCompte: (n: number) => string;
    aucuneAlerte: string;
    foyerPossible: (nom: string) => string;
    diagnosticsGroupes: (n: number) => string;
    localiserFoyer: string;
    demanderAssistant: string;
    fermerAlerte: string;
  };
  ficheResultat: {
    verdict: string;
    photoNonReconnue: string;
    rienASignaler: string;
    aSurveiller: string;
    atteinteConfirmee: string;
    atteinteGrave: string;
    fruitsAtteints: (n: number, total: number, pct: number) => string;
    unSeulFruit: string;
    sansDetection: string;
    horsSujetAvis: string;
    fruitsRepere: string;
    toucherFruit: string;
    diagnosticTitre: string;
    agentEnCause: (agent: string) => string;
    zonesAnalysees: string;
    masquer: string;
    afficher: string;
    zonesChaudesTexte: string;
    altZonesChaudes: string;
    altFruitAnalyse: string;
    analyserAutreFruit: string;
    horsSujetTitre: string;
    horsSujetTexte: string;
    incertainTitre: string;
    incertainTexte: (pct: number) => string;
  };
  photoAnnotee: {
    altPhoto: string;
    fruitLabel: (n: number, nom: string) => string;
    photoNonReconnue: string;
  };
  diagnosticsSimilaires: {
    titre: string;
    intro: string;
    ressemblance: (pct: number) => string;
    corrige: string;
  };
  assistant: {
    titre: string;
    ouvrir: string;
    fermer: string;
    reduire: string;
    agrandir: string;
    introTexte: string;
    placeholderQuestion: string;
    joindreFichier: string;
    retirerPiece: string;
    lecturePiece: string;
    dicter: string;
    arreterDictee: string;
    envoyer: string;
    connexionNecessaire: string;
    imageIllisible: string;
    aucunTexteDocument: string;
    documentIllisible: string;
    assistantSansReponse: string;
    ecrit: string;
    imageJointe: string;
  };
  communaute: {
    indisponible: string;
    rejoindre: string;
    seConnecter: string;
    intro: string;
    pseudoLabel: string;
    pseudoPlaceholder: string;
    emailLabel: string;
    motDePasseLabel: string;
    unInstant: string;
    creerMonCompte: string;
    compteCree: string;
    erreurGenerique: string;
    dejaCompte: string;
    creerCompte: string;
    salonGeneralPrefixe: string;
    seDeconnecter: string;
    aucunMessage: string;
    erreurChargement: string;
    erreurEnvoi: string;
    placeholderMessage: string;
    envoyer: string;
    producteur: string;
  };
  errorBoundary: {
    titre: string;
    texte: string;
    recharger: string;
  };
  vueCapture: {
    titre: string;
    introAvant: string;
    introApres: string;
    analyseEnCours: string;
    choisirPhoto: string;
    formats: string;
    leSaviezVous: string;
  };
  qualite: {
    sombre: string;
    surexpose: string;
    monotone: string;
    flou: string;
  };
  diagnostic: {
    analyserQuandMeme: string;
    erreurTelechargement: string;
    erreurEnregistrement: string;
    erreurCorrompu: string;
    erreurGenerique: string;
    fichierIllisible: string;
  };
  conduiteATenir: {
    queFaire: string;
    urgenceAucune: string;
    urgenceSurveiller: string;
    urgenceSous48h: string;
    urgenceImmediat: string;
    ecouterConsignes: string;
    arreterLecture: string;
    ameliorationEnCours: string;
    reessayer: string;
    telechargerPdf: string;
    masquer: string;
    eviterQueCelaRevienne: string;
    aNePasFaire: string;
    serviceIndisponible: string;
    redactionEchouee: string;
    conseilRestValable: string;
  };
}

export type Langue = 'fr' | 'en';

const DICTIONNAIRES: Record<Langue, Traductions> = { fr, en };

const CLE_STOCKAGE = 'agricam-langue';

type ContexteTraduction = {
  langue: Langue;
  changerLangue: (langue: Langue) => void;
  t: Traductions;
};

const ContexteTraductionReact = createContext<ContexteTraduction | null>(null);

function langueInitiale(): Langue {
  const stockee = window.localStorage.getItem(CLE_STOCKAGE);
  if (stockee === 'fr' || stockee === 'en') return stockee;
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function TraductionProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(langueInitiale);

  const changerLangue = useCallback((prochaine: Langue) => {
    window.localStorage.setItem(CLE_STOCKAGE, prochaine);
    setLangue(prochaine);
  }, []);

  const valeur = useMemo(
    () => ({ langue, changerLangue, t: DICTIONNAIRES[langue] }),
    [langue, changerLangue],
  );

  return (
    <ContexteTraductionReact.Provider value={valeur}>
      {children}
    </ContexteTraductionReact.Provider>
  );
}

export function useTraduction(): ContexteTraduction {
  const contexte = useContext(ContexteTraductionReact);
  if (!contexte) {
    throw new Error('useTraduction doit etre utilise dans un <TraductionProvider>.');
  }
  return contexte;
}
