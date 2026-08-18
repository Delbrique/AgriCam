/**
 * Stockage local, par IndexedDB.
 *
 * Tout est conserve sur le telephone : l'historique reste consultable sans
 * reseau, et aucune photo n'est transmise sans action explicite du producteur.
 * Une file d'attente separee retient ce qui devra remonter au serveur quand la
 * connexion reviendra - uniquement des metadonnees, jamais l'image.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Diagnostic } from './pipeline';

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

/**
 * Indice de sante d'une parcelle : moyenne du taux d'infestation sur les
 * consultations des trente derniers jours. Une seule photo ne dit rien d'une
 * parcelle ; une serie, si.
 */
export async function indiceParcelle(
  parcelleId: string,
  fenetreJours = 30,
): Promise<{ taux: number; nbConsultations: number } | null> {
  const db = await ouvrir();
  const toutes = (await db.getAllFromIndex(
    'consultations',
    'parcelleId',
    parcelleId,
  )) as Consultation[];

  const depuis = Date.now() - fenetreJours * 24 * 3600 * 1000;
  const retenues = toutes.filter((c) => c.horodatage >= depuis);
  if (retenues.length === 0) return null;

  const taux =
    retenues.reduce((s, c) => s + c.tauxInfestation, 0) / retenues.length;
  return { taux, nbConsultations: retenues.length };
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
