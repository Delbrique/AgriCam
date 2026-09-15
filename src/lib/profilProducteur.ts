/**
 * Profil du producteur, saisi une seule fois au tout premier lancement.
 *
 * Stocke en localStorage (et non IndexedDB, comme consultations/parcelles) :
 * une seule petite valeur, lue de facon synchrone des le demarrage pour
 * decider si l'ecran d'accueil doit s'afficher avant le reste de
 * l'application - un aller-retour IndexedDB aurait introduit un flash de
 * contenu evitable a chaque lancement. Aucun compte, aucun mot de passe :
 * tout reste sur l'appareil, coherent avec le reste de l'app (offline-first,
 * connexion faible sur le terrain).
 */
import type { Parcelle } from './stockage';

export interface ProfilProducteur {
  nom: string;
  telephone: string;
  localite: string;
  cultures: Parcelle['culture'][];
  position?: { latitude: number; longitude: number };
  creeLe: number;
}

const CLE_STOCKAGE = 'agricam-profil';

export function chargerProfil(): ProfilProducteur | null {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as ProfilProducteur) : null;
  } catch {
    return null; // stockage indisponible (navigation privee...) : on redemandera.
  }
}

export function enregistrerProfil(profil: Omit<ProfilProducteur, 'creeLe'>): ProfilProducteur {
  const complet: ProfilProducteur = { ...profil, creeLe: Date.now() };
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(complet));
  return complet;
}

/** Premier prenom, pour une salutation courte sur le tableau de bord. */
export function prenom(profil: ProfilProducteur): string {
  return profil.nom.trim().split(/\s+/)[0] ?? '';
}
