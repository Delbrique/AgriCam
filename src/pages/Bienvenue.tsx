/**
 * Ecran d'accueil, affiche a CHAQUE chargement de l'application (voir
 * App.tsx - le profil enregistre ne sert jamais a sauter cet ecran, par
 * choix delibere : le producteur confirme ses informations a chaque fois,
 * plutot qu'une seule fois pour toutes).
 *
 * Pre-rempli depuis le dernier profil enregistre, pour eviter de tout
 * retaper a chaque passage - seule la validation elle-meme se repete.
 * Pas de compte, pas de mot de passe : tout reste sur l'appareil.
 */
import { useState, type FormEvent } from 'react';
import { MapPin } from 'lucide-react';
import { chargerProfil, enregistrerProfil, type ProfilProducteur } from '../lib/profilProducteur';
import type { Parcelle } from '../lib/stockage';
import { useTraduction } from '../lib/traduction';

interface Props {
  onTermine: (profil: ProfilProducteur) => void;
}

const CULTURES: Parcelle['culture'][] = ['tomate', 'piment', 'oignon'];

export function Bienvenue({ onTermine }: Props) {
  const { t } = useTraduction();
  const profilPrecedent = chargerProfil();
  const [nom, setNom] = useState(profilPrecedent?.nom ?? '');
  const [telephone, setTelephone] = useState(profilPrecedent?.telephone ?? '');
  const [localite, setLocalite] = useState(profilPrecedent?.localite ?? '');
  const [cultures, setCultures] = useState<Parcelle['culture'][]>(profilPrecedent?.cultures ?? []);
  const [position, setPosition] = useState(profilPrecedent?.position);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);

  const LIBELLE_CULTURE: Record<Parcelle['culture'], string> = {
    tomate: t.commun.cultures.tomate,
    piment: t.commun.cultures.piment,
    oignon: t.commun.cultures.oignon,
  };

  function basculerCulture(c: Parcelle['culture']) {
    setCultures((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  /** Facultatif : un refus ne doit jamais empecher de commencer. */
  function localiser() {
    if (!navigator.geolocation) return;
    setLocalisationEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setLocalisationEnCours(false);
      },
      () => setLocalisationEnCours(false),
      { timeout: 4000, maximumAge: 300000 },
    );
  }

  const pretAValider = nom.trim() !== '' && telephone.trim() !== '' && cultures.length > 0;

  function valider(e: FormEvent) {
    e.preventDefault();
    if (!pretAValider) return;
    const profil = enregistrerProfil({
      nom: nom.trim(),
      telephone: telephone.trim(),
      localite: localite.trim(),
      cultures,
      position,
    });
    onTermine(profil);
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-papier px-[var(--pad-page)] py-e6">
      <form onSubmit={valider} className="carte flex w-full max-w-md flex-col gap-e4 p-e5">
        <div className="flex flex-col items-center gap-e2 text-center">
          <img src="/images/agricam-icone.png" alt="" className="h-14 w-14" aria-hidden="true" />
          <h1 className="m-0 text-xl tracking-[-0.025em]">{t.bienvenue.titre}</h1>
          <p className="m-0 text-sm text-encre-douce">{t.bienvenue.intro}</p>
        </div>

        <label className="flex flex-col gap-e1 text-sm">
          {t.bienvenue.nomLabel}
          <input
            className="rounded-xl border border-trait bg-transparent px-e3 py-e2"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={t.bienvenue.nomPlaceholder}
            autoFocus
            required
          />
        </label>

        <label className="flex flex-col gap-e1 text-sm">
          {t.bienvenue.telephoneLabel}
          <input
            type="tel"
            className="rounded-xl border border-trait bg-transparent px-e3 py-e2"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder={t.bienvenue.telephonePlaceholder}
            minLength={8}
            required
          />
        </label>

        <label className="flex flex-col gap-e1 text-sm">
          {t.bienvenue.localiteLabel}
          <input
            className="rounded-xl border border-trait bg-transparent px-e3 py-e2"
            value={localite}
            onChange={(e) => setLocalite(e.target.value)}
            placeholder={t.bienvenue.localitePlaceholder}
          />
        </label>

        <button
          type="button"
          className="bouton-second flex items-center justify-center gap-e2 text-sm"
          onClick={localiser}
          disabled={localisationEnCours || !!position}
        >
          <MapPin size={16} aria-hidden="true" />
          {position
            ? t.bienvenue.positionAcquise
            : localisationEnCours
              ? t.bienvenue.localisationEnCours
              : t.bienvenue.utiliserPosition}
        </button>

        <fieldset className="flex flex-col gap-e2 border-0 p-0">
          <legend className="mb-e1 text-sm">{t.bienvenue.culturesLabel}</legend>
          {CULTURES.map((c) => (
            <label key={c} className="flex items-center gap-e2 text-sm">
              <input
                type="checkbox"
                checked={cultures.includes(c)}
                onChange={() => basculerCulture(c)}
              />
              {LIBELLE_CULTURE[c]}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="bouton-principal" disabled={!pretAValider}>
          {t.bienvenue.commencer}
        </button>
      </form>
    </div>
  );
}
