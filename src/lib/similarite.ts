/**
 * Diagnostics similaires - "a-t-on deja vu ce cas ?"
 *
 * Reutilise le vecteur de caracteristiques (sortie du GAP, avant la couche
 * de decision) deja calcule pour chaque fruit - la meme empreinte visuelle
 * qui sert au garde-fou hors sujet (voir classifieur.ts). Deux fruits qui se
 * ressemblent ont des vecteurs proches au sens cosinus, ce qui permet de
 * rapprocher un nouveau diagnostic des cas deja rencontres dans l'historique
 * de CE telephone - sans base vectorielle, sans serveur, juste une
 * comparaison locale au moment ou le producteur consulte son resultat.
 */

import { similariteCosinus } from './classifieur';
import { historique, type Consultation } from './stockage';

export interface CandidatSimilarite {
  id: string;
  embedding: ArrayLike<number>;
}

export interface ResultatSimilarite<T> {
  candidat: T;
  similarite: number;
}

/** En-deca de cette similarite, deux photos ne se "ressemblent" plus
 * vraiment : mieux vaut ne rien afficher que suggerer un rapprochement
 * trompeur entre deux cas sans rapport. */
const SEUIL_SIMILARITE = 0.85;

/**
 * Classe des candidats par similarite decroissante avec la cible, et ne
 * garde que les `limite` premiers au-dela du seuil minimal. Pure : aucun
 * acces IndexedDB, ce qui la rend testable sans base de donnees simulee.
 */
export function plusSimilaires<T extends CandidatSimilarite>(
  cible: ArrayLike<number>,
  candidats: T[],
  limite = 3,
): ResultatSimilarite<T>[] {
  return candidats
    .map((candidat) => ({ candidat, similarite: similariteCosinus(cible, candidat.embedding) }))
    .filter((r) => r.similarite >= SEUIL_SIMILARITE)
    .sort((a, b) => b.similarite - a.similarite)
    .slice(0, limite);
}

/**
 * Relit l'historique local et y cherche les diagnostics visuellement
 * proches du fruit fourni - typiquement celui qui vient d'etre analyse, pas
 * encore enregistre ou tout juste enregistre (auquel cas `idAExclure`
 * l'ecarte de ses propres resultats).
 */
export async function diagnosticsSimilaires(
  embedding: ArrayLike<number>,
  idAExclure?: string,
  limite = 3,
): Promise<ResultatSimilarite<Consultation>[]> {
  const consultations = await historique();

  const candidats = consultations
    .filter((c) => c.id !== idAExclure)
    .flatMap((c) => {
      const principal = c.fruits.find((f) => !f.horsSujet);
      // Les consultations enregistrees avant l'ajout de ce champ n'ont pas
      // d'embedding : les ecarter plutot que planter sur une comparaison
      // impossible.
      if (!principal || !principal.embedding || principal.embedding.length === 0) return [];
      return [{ id: c.id, embedding: principal.embedding, consultation: c }];
    });

  return plusSimilaires(embedding, candidats, limite).map((r) => ({
    candidat: r.candidat.consultation,
    similarite: r.similarite,
  }));
}
