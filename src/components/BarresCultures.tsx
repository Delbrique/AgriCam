/**
 * Cultures les plus diagnostiquees / les plus touchees - barres horizontales
 * du tableau de bord. Alimente par repartitionCultures (lib/tableauDeBord.ts).
 *
 * Anime a l'entree (les barres poussent depuis 0, en cascade entre les deux
 * series), avec un survol qui met la ligne en avant et le total ecrit au
 * bout de chaque barre. La liste sous le graphique reprend le meme detail
 * que DonutMaladies.tsx juste a cote : sans elle, cette carte restait bien
 * plus courte que sa voisine et la grille (items-stretch) l'etirait quand
 * meme jusqu'a sa hauteur, laissant un grand vide sous le graphique.
 */

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatCulture } from '../lib/tableauDeBord';

const LIBELLE_CULTURE: Record<StatCulture['culture'], string> = {
  tomate: 'Tomate',
  piment: 'Piment',
  oignon: 'Oignon',
};

interface Props {
  donnees: StatCulture[];
}

const STYLE_ETIQUETTE = { fontSize: 12, fontWeight: 700, fill: 'var(--encre)' };
const STYLE_ETIQUETTE_ATTEINTS = { fontSize: 12, fontWeight: 700, fill: 'var(--atteint)' };

export function BarresCultures({ donnees }: Props) {
  const [actif, setActif] = useState<number | null>(null);

  if (donnees.length === 0) {
    return (
      <p className="m-0 text-sm text-encre-douce">
        Aucun diagnostic pour l&apos;instant.
      </p>
    );
  }

  const donneesPlates = donnees.map((d) => ({
    culture: LIBELLE_CULTURE[d.culture],
    nombre: d.nombre,
    atteints: d.nombreAtteints,
  }));

  /** Estompe les lignes non survolees plutot que de les laisser toutes a
   * pleine opacite en permanence - le survol devient un vrai geste, pas un
   * simple changement de couleur de fond. */
  const opaciteDe = (index: number) => (actif === null || actif === index ? 1 : 0.35);

  return (
    <div className="flex flex-col gap-e3">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={donneesPlates}
            layout="vertical"
            margin={{ left: 8, right: 34 }}
            onMouseLeave={() => setActif(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--trait)" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--encre-douce)' }}
            />
            <YAxis
              type="category"
              dataKey="culture"
              width={70}
              tick={{ fontSize: 13, fill: 'var(--encre)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--trait)', opacity: 0.35 }}
              formatter={(valeur, nom) => {
                // `nom` reprend deja le libelle lisible passe via `name` sur
                // chaque <Bar> ci-dessous - inutile de le re-deviner a
                // partir d'une cle technique.
                const nombre = Number(valeur) || 0;
                return [`${nombre} fruit${nombre > 1 ? 's' : ''}`, nom];
              }}
              contentStyle={{
                background: 'var(--carte)',
                border: '1px solid var(--trait)',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="nombre"
              fill="var(--sain)"
              radius={[0, 6, 6, 0]}
              name="Diagnostiqués"
              animationDuration={700}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActif(index)}
            >
              {donneesPlates.map((_, i) => (
                <Cell key={i} fillOpacity={opaciteDe(i)} />
              ))}
              <LabelList dataKey="nombre" position="right" style={STYLE_ETIQUETTE} />
            </Bar>
            <Bar
              dataKey="atteints"
              fill="var(--atteint)"
              radius={[0, 6, 6, 0]}
              name="Atteints/graves"
              animationDuration={700}
              animationBegin={200}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActif(index)}
            >
              {donneesPlates.map((_, i) => (
                <Cell key={i} fillOpacity={opaciteDe(i)} />
              ))}
              <LabelList dataKey="atteints" position="right" style={STYLE_ETIQUETTE_ATTEINTS} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="m-0 flex flex-col gap-e2 p-0 text-sm">
        {donnees.map((d, i) => {
          const pourcentageAtteint = d.nombre > 0 ? Math.round((d.nombreAtteints / d.nombre) * 100) : 0;
          return (
            <li
              key={d.culture}
              className="flex items-center gap-e2"
              style={{ opacity: opaciteDe(i) }}
              onMouseEnter={() => setActif(i)}
              onMouseLeave={() => setActif(null)}
            >
              <span
                className="h-[10px] w-[10px] shrink-0 rounded-full"
                style={{ background: 'var(--sain)' }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{LIBELLE_CULTURE[d.culture]}</span>
              <span className="donnee shrink-0 text-encre-douce">
                {d.nombre} diagnostiqué{d.nombre > 1 ? 's' : ''} · {d.nombreAtteints} atteint
                {d.nombreAtteints > 1 ? 's' : ''} ({pourcentageAtteint}&nbsp;%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
