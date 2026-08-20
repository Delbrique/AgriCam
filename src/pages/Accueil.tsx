/**
 * Page d'accueil.
 *
 * Elle ne sert pas au producteur, qui ira droit au diagnostic - elle sert a
 * qui arrive sans contexte : un jury, un technicien, un partenaire.
 *
 * Le parti pris : MONTRER plutot que decrire. Le bandeau d'ouverture presente
 * une scene de diagnostic - fruits reperes, lesion mise en evidence, verdict -
 * plutot qu'une photo d'illustration. En trois secondes, on comprend ce que
 * fait l'outil, et ce que fait le detecteur que personne d'autre n'embarque.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CLASSES, couleurGravite, type Classe } from '../lib/classes';
import { useTraduction } from '../lib/traduction';
import { historique } from '../lib/stockage';
import { InstallApp } from '../components/InstallApp';
import {
  Camera, ScanEye, Crop, Stethoscope, Flame, ListChecks,
  Target, Timer, Layers, WifiOff,
  Grid2x2, Eye, ShieldQuestion,
} from 'lucide-react';

/**
 * Couleurs des jetons de maladie, par gravité.
 *
 * Chaque jeton porte un fond très désaturé et un texte dans la teinte foncée
 * de la même famille : c'est la règle du contraste sur fond coloré, et cela
 * garde la lisibilité tout en signalant la gravité d'un coup d'œil. Les deux
 * fonctions renvoient des variables CSS (pas des couleurs figées) : le
 * navigateur les réévalue seul quand le thème sombre change --xxx-fond, donc
 * les jetons restent lisibles sans code de theme dedie ici.
 */
function fondGravite(g: string): string {
  return {
    sain: 'var(--sain-fond)',
    alerte: 'var(--alerte-fond)',
    atteint: 'var(--atteint-fond)',
    grave: 'var(--grave-fond)',
  }[g] ?? 'var(--inconnu-fond)';
}

function texteGravite(g: string): string {
  return {
    sain: 'var(--sain)',
    alerte: 'var(--alerte)',
    atteint: 'var(--atteint)',
    grave: 'var(--grave)',
  }[g] ?? 'var(--inconnu)';
}

const CULTURES: Classe['culture'][] = ['tomate', 'piment', 'oignon'];

const ICONES_ETAPES = [Camera, ScanEye, Crop, Stethoscope, Flame, ListChecks];
const ICONES_CHIFFRES = [Target, Timer, Layers, WifiOff];
const ICONES_DISTINCTIONS = [WifiOff, Grid2x2, Eye, ShieldQuestion];

export function Accueil() {
  const { t, langue } = useTraduction();
  // Duree moyenne d'un diagnostic : mesuree pour de vrai sur cet appareil
  // (dureeMs, calcule dans lib/pipeline.ts a chaque diagnostic), plutot
  // qu'un chiffre fixe invente - la latence reelle varie enormement d'un
  // telephone a l'autre. `null` tant qu'aucun diagnostic n'a encore ete
  // fait ici : jamais de nombre invente pour combler l'attente.
  const [dureeMoyenneS, setDureeMoyenneS] = useState<number | null>(null);

  useEffect(() => {
    historique().then((consultations) => {
      if (consultations.length === 0) return;
      const moyenneMs =
        consultations.reduce((s, c) => s + c.dureeMs, 0) / consultations.length;
      setDureeMoyenneS(moyenneMs / 1000);
    });
  }, []);

  return (
    <div className="flex flex-col gap-e7">
      {/* ================= Ouverture ================= */}
      {/* La photo situe le contexte ; le voile dégradé garantit la lisibilité
          du texte quelle que soit la zone de l'image qu'il recouvre. Le voile
          et les teintes du bandeau restent volontairement fixes (pas de
          variables de theme) : c'est une photo, elle ne s'inverse pas quand
          le site passe en mode sombre. */}
      <section className="relative isolate mt-[calc(-1*var(--e2))] flex min-h-[380px] items-end overflow-hidden rounded-lg before:absolute before:inset-0 before:-z-10 before:content-[''] before:bg-[linear-gradient(100deg,rgba(14,26,19,0.94)_0%,rgba(14,26,19,0.82)_42%,rgba(14,26,19,0.28)_78%,rgba(14,26,19,0.12)_100%)] bp860:min-h-[460px]">
        <img
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_35%]"
          src="/images/maraichage.jpg"
          alt=""
          aria-hidden="true"
        />

        <div className="max-w-[40rem] p-e6 text-chrome-texte bp860:p-e7">
          <p className="mb-e4 inline-block rounded-full border border-[rgba(126,224,138,0.45)] px-e3 py-e1 font-donnee text-xs font-bold uppercase tracking-[0.14em] text-accent">
            {t.accueil.etiquette}
          </p>

          <h1 className="m-0 text-[clamp(1.9rem,5vw,3rem)] leading-[1.05] tracking-[-0.035em] text-chrome-texte [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
            {t.accueil.titre}
          </h1>

          <p className="mt-e4 max-w-[46ch] text-md leading-[1.55] text-[#cfd9d1]">
            {t.accueil.accroche}
          </p>

          <div className="mt-e5 flex flex-wrap gap-e3">
            <Link
              className="inline-grid min-h-cible place-items-center rounded bg-accent px-e5 text-md font-bold text-chrome no-underline hover:bg-accent-survol"
              to="/diagnostic"
            >
              {t.accueil.boutonDiagnostic}
            </Link>
            <Link
              className="inline-grid min-h-cible place-items-center rounded border border-[rgba(242,244,239,0.45)] bg-[rgba(242,244,239,0.1)] px-e5 text-md font-bold text-chrome-texte no-underline hover:bg-[rgba(242,244,239,0.2)]"
              to="/historique"
            >
              {t.accueil.boutonHistorique}
            </Link>
          </div>
        </div>
      </section>

      <InstallApp />

      {/* ================= Chiffres ================= */}
      {/* Format carte, comme les indicateurs d'AgriScan : tuiles autonomes,
          pastille colorée à gauche. Mais les valeurs sont mesurées, pas des
          mots-clés — elles prouvent ce que l'accroche affirme. */}
      <section className="grid grid-cols-1 gap-e3 bp520:grid-cols-2 bp900:grid-cols-4">
        {t.accueil.chiffres
          .map((chiffre, i) => {
            // Index 1 : duree moyenne, remplacee par la vraie mesure de cet
            // appareil des qu'elle existe (voir l'effet ci-dessus).
            if (i !== 1) return chiffre;
            if (dureeMoyenneS === null) {
              return { valeur: '—', unite: '', libelle: t.accueil.dureeVide };
            }
            return {
              valeur: dureeMoyenneS.toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              unite: 's',
              libelle: t.accueil.dureeLibelle,
            };
          })
          .map(({ valeur, unite, libelle }, i) => {
            const Icone = ICONES_CHIFFRES[i];
            return (
              <div key={libelle} className="carte flex items-center gap-e3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sain-fond text-sain"
                  aria-hidden="true"
                >
                  <Icone size={22} strokeWidth={1.75} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="donnee flex items-baseline gap-1 text-xl font-bold leading-none tracking-[-0.02em] text-encre">
                    {valeur}
                    {unite && (
                      <span className="text-[0.5em] font-bold text-encre-douce">{unite}</span>
                    )}
                  </span>
                  <span className="text-sm leading-[1.3] text-encre-douce">{libelle}</span>
                </div>
              </div>
            );
          })}
      </section>

      {/* ================= Ce qui est reconnu ================= */}
      <section className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.accueil.reconnuTitre}</h2>
        <p className="-mt-e3">{t.accueil.reconnuNote}</p>

        <div className="overflow-hidden rounded-lg border border-trait bg-carte">
          {CULTURES.map((cle) => {
            const { nom, note } = t.accueil.cultures[cle];
            const etats = CLASSES.filter((c) => c.culture === cle);
            return (
              <div
                key={cle}
                className="flex flex-col gap-e2 border-b border-trait p-e4 last:border-b-0 bp560:flex-row bp560:items-start bp560:gap-e4"
              >
                <div className="shrink-0 bp560:w-[120px]">
                  <span className="block text-md font-semibold">{nom}</span>
                  <span className="font-donnee text-xs tracking-[0.03em] text-encre-douce">{note}</span>
                </div>

                <ul className="m-0 flex flex-wrap gap-e2 pt-0.5">
                  {etats.map((c) => (
                    <li
                      key={c.id}
                      className="inline-flex items-center gap-e2 rounded-full px-e3 py-e1 text-sm font-medium"
                      style={{
                        background: fondGravite(c.gravite),
                        color: texteGravite(c.gravite),
                      }}
                    >
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: couleurGravite(c.gravite) }}
                        aria-hidden="true"
                      />
                      {c.nom}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= Etapes ================= */}
      <section className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.accueil.etapesTitre}</h2>
        <p className="-mt-e3">{t.accueil.etapesNote}</p>

        <ol className="grid list-none gap-e3 m-0 p-0 bp560:grid-cols-2 bp1000:grid-cols-5">
          {t.accueil.etapes.map(({ titre, texte }, i) => {
            const Icone = ICONES_ETAPES[i];
            return (
              <li key={titre} className="carte">
                <div className="mb-e4 flex items-center justify-between">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl bg-sain-fond text-sain"
                    aria-hidden="true"
                  >
                    <Icone size={22} strokeWidth={1.75} />
                  </span>
                  <span className="donnee text-[2rem] font-bold leading-none text-trait">{i + 1}</span>
                </div>
                <h3 className="mb-e2 text-md">{titre}</h3>
                <p className="m-0 text-sm leading-[1.5] text-encre-douce">{texte}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ================= Distinctions ================= */}
      <section className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.accueil.distinctionsTitre}</h2>
        <div className="grid gap-e3 bp560:grid-cols-2">
          {t.accueil.distinctions.map(({ titre, texte }, i) => {
            const Icone = ICONES_DISTINCTIONS[i];
            return (
              <div key={titre} className="rounded-xl border border-trait bg-carte p-e4">
                <span
                  className="mb-e3 grid h-10 w-10 place-items-center rounded-[10px] bg-sain-fond text-sain"
                  aria-hidden="true"
                >
                  <Icone size={20} strokeWidth={1.75} />
                </span>
                <h3 className="mb-e2 text-md">{titre}</h3>
                <p className="m-0 text-sm leading-[1.5] text-encre-douce">{texte}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= Appel final ================= */}
      <section className="flex flex-col items-center gap-e3 rounded-xl bg-chrome p-e5 text-center text-chrome-texte bp860:p-e7">
        <h2 className="text-xl text-chrome-texte">{t.accueil.finalTitre}</h2>
        <p className="m-0 mb-e2 text-sm text-chrome-texte-douce">{t.accueil.finalTexte}</p>
        <Link
          className="inline-grid min-h-cible place-items-center justify-self-center rounded bg-accent px-e5 text-md font-bold text-chrome no-underline hover:bg-accent-survol"
          to="/diagnostic"
        >
          {t.accueil.finalBouton}
        </Link>
      </section>
    </div>
  );
}
