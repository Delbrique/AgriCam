/**
 * Stockage local, par IndexedDB.
 *
 * Tout est conserve sur le telephone : l'historique reste consultable sans
 * reseau, et aucune photo n'est transmise sans action explicite du producteur.
 * Une file d'attente separee retient ce qui devra remonter au serveur quand la
 * connexion reviendra - uniquement des metadonnees, jamais l'image.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Gravite } from './classes';
import { graviteMax, type Diagnostic } from './pipeline';

const BASE = 'agricam';
const VERSION = 1;

export interface Consultation extends Diagnostic {
  id: string;
  /** Parcelle a laquelle rattacher la consultation, si l'utilisateur en a une. */
  parcelleId?: string;
  /** Correction saisie par l'utilisateur, si le diagnostic etait faux. */
  correction?: { classeId: string; commentaire?: string; date: number };
  /** Vrai une fois la consultation remontee au serveur. */
  synchronisee: boolean;
}

export interface Parcelle {
  id: string;
  nom: string;
  culture: 'tomate' | 'piment' | 'oignon';
  position?: { latitude: number; longitude: number };
  creeeLe: number;
}

let base: Promise<IDBPDatabase> | null = null;

function ouvrir() {
  if (!base) {
    base = openDB(BASE, VERSION, {
      upgrade(db) {
        const c = db.createObjectStore('consultations', { keyPath: 'id' });
        c.createIndex('horodatage', 'horodatage');
        c.createIndex('parcelleId', 'parcelleId');
        c.createIndex('synchronisee', 'synchronisee');

        db.createObjectStore('parcelles', { keyPath: 'id' });
      },
    });
  }
  return base;
}

function identifiant(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enregistrer(
  diagnostic: Diagnostic,
  parcelleId?: string,
): Promise<Consultation> {
  const consultation: Consultation = {
    ...diagnostic,
    id: identifiant(),
    parcelleId,
    synchronisee: false,
  };
  const db = await ouvrir();
  await db.put('consultations', consultation);
  return consultation;
}

export async function historique(limite = 100): Promise<Consultation[]> {
  const db = await ouvrir();
  const tout = await db.getAllFromIndex('consultations', 'horodatage');
  return tout.reverse().slice(0, limite);
}

export async function consultation(id: string): Promise<Consultation | undefined> {
  const db = await ouvrir();
  return db.get('consultations', id);
}

/**
 * Enregistre une correction utilisateur.
 *
 * C'est le mecanisme le plus precieux du dispositif a long terme : chaque
 * correction est une image de terrain camerounaise etiquetee par la personne
 * qui a le fruit en main. C'est exactement ce qui manque au jeu de donnees
 * d'entrainement, constitue de sources etrangeres.
 */
export async function corriger(
  id: string,
  classeId: string,
  commentaire?: string,
): Promise<void> {
  const db = await ouvrir();
  const c = (await db.get('consultations', id)) as Consultation | undefined;
  if (!c) return;
  c.correction = { classeId, commentaire, date: Date.now() };
  c.synchronisee = false;
  await db.put('consultations', c);
}

export async function supprimer(id: string): Promise<void> {
  const db = await ouvrir();
  await db.delete('consultations', id);
}

/* --- Parcelles ---------------------------------------------------------- */

export async function creerParcelle(
  nom: string,
  culture: Parcelle['culture'],
  position?: Parcelle['position'],
): Promise<Parcelle> {
  const p: Parcelle = { id: identifiant(), nom, culture, position, creeeLe: Date.now() };
  const db = await ouvrir();
  await db.put('parcelles', p);
  return p;
}

export async function parcelles(): Promise<Parcelle[]> {
  const db = await ouvrir();
  return db.getAll('parcelles');
}

export async function renommerParcelle(id: string, nom: string): Promise<void> {
  const db = await ouvrir();
  const p = (await db.get('parcelles', id)) as Parcelle | undefined;
  if (!p) return;
  p.nom = nom;
  await db.put('parcelles', p);
}

/** Supprime une parcelle et detache les consultations qui y etaient
 * rattachees, plutot que de les laisser pointer vers un identifiant
 * fantome. */
export async function supprimerParcelle(id: string): Promise<void> {
  const db = await ouvrir();
  const tx = db.transaction(['parcelles', 'consultations'], 'readwrite');
  await tx.objectStore('parcelles').delete(id);

  const index = tx.objectStore('consultations').index('parcelleId');
  let curseur = await index.openCursor(IDBKeyRange.only(id));
  while (curseur) {
    const c = curseur.value as Consultation;
    delete c.parcelleId;
    await curseur.update(c);
    curseur = await curseur.continue();
  }
  await tx.done;
}

/** Rattache (ou detache, si `parcelleId` est absent) une consultation deja
 * enregistree a une parcelle - utilise depuis la fiche de resultat ou la
 * carte, une fois le diagnostic pose. */
export async function rattacherConsultation(
  id: string,
  parcelleId: string | undefined,
): Promise<void> {
  const db = await ouvrir();
  const c = (await db.get('consultations', id)) as Consultation | undefined;
  if (!c) return;
  if (parcelleId) c.parcelleId = parcelleId;
  else delete c.parcelleId;
  await db.put('consultations', c);
}

export interface StatutParcelle {
  tauxRecent: number | null;
  nbRecent: number;
  tauxPrecedent: number | null;
  nbPrecedent: number;
  /** Pire gravite parmi les consultations recentes, pour la puce de couleur. */
  gravitePire: Gravite | null;
  tendance: 'amelioration' | 'stable' | 'aggravation' | null;
}

/** En-deca de cet ecart de taux d'infestation entre les deux fenetres, on
 * affiche "stable" plutot qu'un mouvement qui ne serait que du bruit
 * d'echantillonnage (une ou deux photos de plus d'un cote ou de l'autre). */
const SEUIL_TENDANCE = 0.05;

/**
 * Sante d'une parcelle : moyenne du taux d'infestation sur la fenetre
 * recente, comparee a la fenetre precedente de meme duree. Une seule photo
 * ne dit rien d'une parcelle ; une serie, si - et une comparaison dans le
 * temps encore moins qu'un chiffre isole.
 *
 * Pure (aucun acces IndexedDB) : `statutParcelle` ci-dessous ne fait que lui
 * fournir les consultations d'une parcelle donnee, ce qui la rend testable
 * sans base de donnees simulee.
 */
export function calculerStatutParcelle(
  consultations: Consultation[],
  maintenant: number,
  fenetreJours = 30,
): StatutParcelle {
  const jour = 24 * 3600 * 1000;
  const debutRecent = maintenant - fenetreJours * jour;
  const debutPrecedent = debutRecent - fenetreJours * jour;

  const recentes = consultations.filter((c) => c.horodatage >= debutRecent);
  const precedentes = consultations.filter(
    (c) => c.horodatage >= debutPrecedent && c.horodatage < debutRecent,
  );

  const moyenne = (liste: Consultation[]): number | null =>
    liste.length > 0
      ? liste.reduce((s, c) => s + c.tauxInfestation, 0) / liste.length
      : null;

  const tauxRecent = moyenne(recentes);
  const tauxPrecedent = moyenne(precedentes);

  let tendance: StatutParcelle['tendance'] = null;
  if (tauxRecent !== null && tauxPrecedent !== null) {
    const ecart = tauxRecent - tauxPrecedent;
    tendance =
      ecart > SEUIL_TENDANCE ? 'aggravation' : ecart < -SEUIL_TENDANCE ? 'amelioration' : 'stable';
  }

  return {
    tauxRecent,
    nbRecent: recentes.length,
    tauxPrecedent,
    nbPrecedent: precedentes.length,
    gravitePire: recentes.length > 0 ? graviteMax(recentes.map((c) => c.graviteGlobale)) : null,
    tendance,
  };
}

export async function statutParcelle(
  parcelleId: string,
  fenetreJours = 30,
): Promise<StatutParcelle> {
  const db = await ouvrir();
  const toutes = (await db.getAllFromIndex(
    'consultations',
    'parcelleId',
    parcelleId,
  )) as Consultation[];
  return calculerStatutParcelle(toutes, Date.now(), fenetreJours);
}

/* --- File de synchronisation -------------------------------------------- */

export async function aSynchroniser(): Promise<Consultation[]> {
  const db = await ouvrir();
  const tout = (await db.getAll('consultations')) as Consultation[];
  return tout.filter((c) => !c.synchronisee);
}

export async function marquerSynchronisee(id: string): Promise<void> {
  const db = await ouvrir();
  const c = (await db.get('consultations', id)) as Consultation | undefined;
  if (!c) return;
  c.synchronisee = true;
  await db.put('consultations', c);
}
