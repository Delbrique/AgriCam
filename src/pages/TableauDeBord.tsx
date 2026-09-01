/**
 * Tableau de bord.
 *
 * Page d'accueil de l'application : reprend l'ancienne page Historique
 * (voir composant ListeDiagnostics). La carte des foyers geolocalises vit
 * desormais sur sa propre page (voir pages/Carte.tsx) - elle avait ete
 * fusionnee ici un temps pour ne pas disperser le suivi, mais s'est
 * retrouvee etouffee dans le long defilement du tableau de bord. Tout est
 * calcule EN DIRECT depuis l'historique local (voir lib/tableauDeBord.ts) -
 * aucune donnee inventee (pas de meteo, pas de parcelles en hectares, pas de
 * tendance regionale), aucun appel reseau bloquant : la page reste
 * entierement fonctionnelle hors ligne, avec un etat vide honnete tant que
 * l'historique est vide (chaque section degrade proprement d'elle-meme).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bug,
  Download,
  FileDown,
  Percent,
  ScanEye,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  historique,
  parcelles as chargerParcelles,
  type Consultation,
  type Parcelle,
} from '../lib/stockage';
import { classifieurPret } from '../lib/classifieur';
import { nomClasse } from '../lib/classes';
import { detecteurPret } from '../lib/detecteur';
import { prechargerModeles } from '../lib/pipeline';
import {
  calculerKpis,
  filtrerParPeriode,
  filtrerPeriodePrecedente,
  recommandationsCritiques,
  repartitionCultures,
  repartitionMaladies,
  serieTemporelle,
  type KpiTableauDeBord,
  type Periode,
} from '../lib/tableauDeBord';
import { exporterCsv, exporterPdf } from '../lib/export';
import { useTraduction } from '../lib/traduction';
import type { Traductions } from '../lib/traduction';
import { InstallApp } from '../components/InstallApp';
import { ApparitionAuDefilement } from '../components/ApparitionAuDefilement';
import { CompteurAnime } from '../components/CompteurAnime';
import { DonutMaladies } from '../components/DonutMaladies';
import { BarresCultures } from '../components/BarresCultures';
import { CourbeEvolution } from '../components/CourbeEvolution';
import { ListeDiagnostics } from '../components/ListeDiagnostics';
import { SyntheseTableauDeBord } from '../components/SyntheseTableauDeBord';
import { BoutonMiseAJour } from '../components/BoutonMiseAJour';

/** Variation en pourcentage vs la periode precedente de meme duree, ou
 * `null` quand elle n'a pas de sens (periode "tout", periode precedente
 * vide, ou variation nulle - inutile d'afficher "+0 %"). */
function variation(
  actuel: number,
  precedent: number | null | undefined,
  t: Traductions,
): string | null {
  if (precedent === null || precedent === undefined) return null;
  if (precedent === 0) return actuel > 0 ? t.tableauDeBord.variation(100) : null;
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  if (pct === 0) return null;
  return t.tableauDeBord.variation(pct);
}

function salutationSelonHeure(heure: number, t: Traductions): string {
  if (heure < 5) return t.tableauDeBord.salutations.nuit;
  if (heure < 12) return t.tableauDeBord.salutations.matin;
  if (heure < 18) return t.tableauDeBord.salutations.apresMidi;
  return t.tableauDeBord.salutations.soir;
}

/** Une phrase d'humeur, uniquement quand elle dit quelque chose de reel :
 * jamais de fausse note enjouee sur un historique encore vide (deja
 * annonce ailleurs), et priorite aux alertes sur le ton positif. */
function messageEtat(
  kpis: KpiTableauDeBord,
  t: Traductions,
): { texte: string; ton: 'positif' | 'alerte' } | null {
  if (kpis.nbDiagnostics === 0) return null;
  if (kpis.nbAlertesCritiques > 0) {
    return { texte: t.tableauDeBord.alertesCritiques(kpis.nbAlertesCritiques), ton: 'alerte' };
  }
  if (kpis.tauxSain !== null && kpis.tauxSain >= 0.8) {
    return { texte: t.tableauDeBord.culturesVontBien, ton: 'positif' };
  }
  return null;
}

export function TableauDeBord() {
  const { t, langue } = useTraduction();
  const [consultations, setConsultations] = useState<Consultation[] | null>(null);
  const [listeParcelles, setListeParcelles] = useState<Parcelle[]>([]);
  const [periode, setPeriode] = useState<Periode>('semaine');

  const PERIODES: { valeur: Periode; libelle: string }[] = [
    { valeur: 'jour', libelle: t.tableauDeBord.periodes.jour },
    { valeur: 'semaine', libelle: t.tableauDeBord.periodes.semaine },
    { valeur: 'mois', libelle: t.tableauDeBord.periodes.mois },
    { valeur: 'tout', libelle: t.tableauDeBord.periodes.tout },
  ];

  useEffect(() => {
    historique().then(setConsultations);
    chargerParcelles().then(setListeParcelles);
  }, []);

  // Amorce le telechargement du modele des l'arrivee sur le tableau de bord
  // (devenu la page d'accueil) plutot que d'attendre la page Diagnostic :
  // au moins une tentative aura eu lieu avant que le producteur y arrive.
  useEffect(() => {
    if (classifieurPret() && detecteurPret()) return;
    if (!navigator.onLine) return;
    prechargerModeles().catch(() => {
      /* silencieux : signale au premier diagnostic, comme avant */
    });
  }, []);

  function recharger() {
    historique().then(setConsultations);
  }

  const maintenant = Date.now();
  const toutes = consultations ?? [];

  const periodeActuelle = useMemo(
    () => filtrerParPeriode(toutes, periode, maintenant),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toutes, periode],
  );
  const periodePrecedenteConsultations = useMemo(
    () => filtrerPeriodePrecedente(toutes, periode, maintenant),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toutes, periode],
  );

  const kpis = useMemo(() => calculerKpis(periodeActuelle), [periodeActuelle]);
  const kpisPrecedents = useMemo(
    () => (periodePrecedenteConsultations ? calculerKpis(periodePrecedenteConsultations) : null),
    [periodePrecedenteConsultations],
  );
  const donutMaladies = useMemo(() => repartitionMaladies(periodeActuelle), [periodeActuelle]);
  const barresCultures = useMemo(() => repartitionCultures(periodeActuelle), [periodeActuelle]);
  const serie = useMemo(() => serieTemporelle(periodeActuelle), [periodeActuelle]);
  const recommandations = useMemo(
    () => recommandationsCritiques(periodeActuelle),
    [periodeActuelle],
  );

  if (consultations === null) {
    return <p>{t.tableauDeBord.chargement}</p>;
  }

  const maintenantDate = new Date();
  const salutation = salutationSelonHeure(maintenantDate.getHours(), t);
  const humeur = messageEtat(kpis, t);

  return (
    <div className="flex flex-col gap-e6">
      {/* ================= En-tete ================= */}
      <section className="flex flex-col gap-e3">
        <div className="flex items-baseline justify-between gap-e3">
          <span className="text-sm font-semibold text-encre-douce">{salutation} 👋</span>
          <span className="whitespace-nowrap text-xs capitalize text-encre-douce">
            {maintenantDate.toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-e3">
          <div className="min-w-0">
            <h1 className="m-0 text-sm font-normal leading-snug text-encre-douce">
              {t.tableauDeBord.intro}
            </h1>
            {humeur && (
              <p
                key={humeur.texte}
                className="m-0 mt-e1 animate-entree text-sm font-semibold"
                style={{ color: humeur.ton === 'alerte' ? 'var(--atteint)' : 'var(--sain)' }}
              >
                {humeur.ton === 'alerte' ? '⚠️' : '🌱'} {humeur.texte}
              </p>
            )}
          </div>

          <div className="flex items-center gap-e3">
            <Link
              to="/diagnostic"
              className="inline-grid min-h-cible place-items-center whitespace-nowrap rounded bg-encre px-e5 font-semibold text-papier no-underline transition-transform duration-150 hover:scale-105 hover:brightness-110 active:scale-100"
            >
              {t.tableauDeBord.nouveauDiagnostic}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-e2">
          {PERIODES.map(({ valeur, libelle }) => (
            <button
              key={valeur}
              className={
                periode === valeur
                  ? 'min-h-[36px] rounded border border-encre bg-encre px-e3 text-sm font-semibold text-papier'
                  : 'min-h-[36px] rounded border border-trait bg-transparent px-e3 text-sm font-semibold text-encre hover:bg-trait/30'
              }
              onClick={() => setPeriode(valeur)}
              aria-pressed={periode === valeur}
            >
              {libelle}
            </button>
          ))}
        </div>
      </section>

      <InstallApp />

      {/* ================= KPI ================= */}
      {/* items-stretch (deja la valeur par defaut de la grille, precise ici
          pour que ce soit intentionnel) + h-full sur chaque enveloppe : les
          4 tuiles s'alignent toutes sur la plus haute plutot que de suivre
          leur propre contenu - la premiere (avec sa ligne de tendance) sert
          de reference, les autres s'etirent pour la rejoindre. */}
      <section className="grid grid-cols-1 items-stretch gap-e3 bp520:grid-cols-2 bp900:grid-cols-4">
        <ApparitionAuDefilement delai={0} className="flex h-full">
          <CarteKpi
            icone={ScanEye}
            valeurNumerique={kpis.nbDiagnostics}
            libelle={t.tableauDeBord.kpi.diagnosticsEffectues}
            tendance={variation(kpis.nbDiagnostics, kpisPrecedents?.nbDiagnostics, t)}
          />
        </ApparitionAuDefilement>
        <ApparitionAuDefilement delai={80} className="flex h-full">
          <CarteKpi
            icone={Percent}
            valeurNumerique={kpis.tauxSain !== null ? Math.round(kpis.tauxSain * 100) : undefined}
            suffixe=" %"
            libelle={t.tableauDeBord.kpi.plantsSains}
          />
        </ApparitionAuDefilement>
        <ApparitionAuDefilement delai={160} className="flex h-full">
          <CarteKpi
            icone={ShieldAlert}
            valeurNumerique={kpis.nbAlertesCritiques}
            libelle={t.tableauDeBord.kpi.alertesCritiques}
            tendance={variation(kpis.nbAlertesCritiques, kpisPrecedents?.nbAlertesCritiques, t)}
          />
        </ApparitionAuDefilement>
        <ApparitionAuDefilement delai={240} className="flex h-full">
          <CarteKpi
            icone={Bug}
            valeur={
              kpis.maladiePredominante ? nomClasse(kpis.maladiePredominante.classe, langue) : '—'
            }
            libelle={t.tableauDeBord.kpi.maladiePredominante}
            petit
          />
        </ApparitionAuDefilement>
      </section>

      {/* ================= Etat sanitaire ================= */}
      <ApparitionAuDefilement className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.tableauDeBord.etatSanitaire}</h2>
        <div className="grid gap-e4 bp860:grid-cols-2">
          <div className="carte flex flex-col gap-e3">
            <p className="intitule">{t.tableauDeBord.repartitionMaladies}</p>
            <DonutMaladies donnees={donutMaladies} />
          </div>
          <div className="carte flex flex-col gap-e3">
            <p className="intitule">{t.tableauDeBord.culturesDiagnostiquees}</p>
            <BarresCultures donnees={barresCultures} />
          </div>
        </div>
      </ApparitionAuDefilement>

      {/* ================= Derniers diagnostics ================= */}
      <ApparitionAuDefilement className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.tableauDeBord.derniersDiagnostics}</h2>
        <ListeDiagnostics
          consultations={periodeActuelle}
          parcelles={listeParcelles}
          onConsultationSupprimee={recharger}
        />
      </ApparitionAuDefilement>

      {/* ================= Evolution temporelle ================= */}
      <ApparitionAuDefilement className="carte flex flex-col gap-e3">
        <p className="intitule">{t.tableauDeBord.evolutionTemporelle}</p>
        <CourbeEvolution serie={serie} />
      </ApparitionAuDefilement>

      {/* ================= Recommandations ================= */}
      {/* Analyse d'ENSEMBLE du tableau de bord (KPI, repartitions, maladies
          critiques) - pas un conseil maladie par maladie : voir
          SyntheseTableauDeBord.tsx pour la difference avec ConduiteATenir,
          qui porte sur un seul diagnostic. */}
      <ApparitionAuDefilement className="flex flex-col gap-e4">
        <h2 className="text-xl tracking-[-0.025em]">{t.tableauDeBord.recommandations}</h2>
        <div className="carte">
          <SyntheseTableauDeBord
            periodeLibelle={PERIODES.find((p) => p.valeur === periode)?.libelle ?? periode}
            kpis={kpis}
            maladiesCritiques={recommandations}
            repartitionMaladies={donutMaladies}
            repartitionCultures={barresCultures}
          />
        </div>
      </ApparitionAuDefilement>

      {/* ================= Actions rapides ================= */}
      <section className="carte flex flex-wrap items-center gap-e3">
        <Link
          to="/diagnostic"
          className="inline-grid min-h-cible place-items-center whitespace-nowrap rounded bg-encre px-e5 font-semibold text-papier no-underline transition-transform duration-150 hover:scale-105 hover:brightness-110 active:scale-100"
        >
          {t.tableauDeBord.nouveauDiagnostic}
        </Link>
        <button
          type="button"
          className="bouton-second flex items-center gap-e2"
          onClick={() => exporterCsv(consultations, t, langue)}
          disabled={consultations.length === 0}
        >
          <Download size={16} aria-hidden="true" />
          {t.tableauDeBord.exporterCsv}
        </button>
        <button
          type="button"
          className="bouton-second flex items-center gap-e2"
          onClick={() => exporterPdf(consultations, t, langue)}
          disabled={consultations.length === 0}
        >
          <FileDown size={16} aria-hidden="true" />
          {t.tableauDeBord.exporterPdf}
        </button>
        <BoutonMiseAJour />
      </section>
    </div>
  );
}

function CarteKpi({
  icone: Icone,
  valeur,
  valeurNumerique,
  suffixe = '',
  libelle,
  tendance,
  petit,
}: {
  icone: LucideIcon;
  /** Texte fixe (ex. un nom de maladie) - ignore si valeurNumerique est fourni. */
  valeur?: string;
  /** Anime en comptage de 0 jusqu'a cette valeur (voir CompteurAnime.tsx) -
   * `undefined` retombe sur `valeur`, pour les cas indetermines ("—"). */
  valeurNumerique?: number;
  suffixe?: string;
  libelle: string;
  tendance?: string | null;
  petit?: boolean;
}) {
  const classeValeur = petit
    ? 'donnee truncate text-md font-bold leading-tight tracking-[-0.02em] text-encre'
    : 'donnee truncate text-xl font-bold leading-none tracking-[-0.02em] text-encre';

  return (
    <div className="carte-vivante flex w-full items-center gap-e3">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sain-fond text-sain"
        aria-hidden="true"
      >
        <Icone size={22} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={classeValeur}>
          {valeurNumerique !== undefined ? (
            <CompteurAnime valeur={valeurNumerique} suffixe={suffixe} />
          ) : (
            (valeur ?? '—')
          )}
        </span>
        <span className="text-sm leading-[1.3] text-encre-douce">{libelle}</span>
        {tendance && <span className="donnee text-xs text-encre-douce">{tendance}</span>}
      </div>
    </div>
  );
}
