/**
 * Cultures les plus diagnostiquees / les plus touchees - barres horizontales
 * du tableau de bord. Alimente par repartitionCultures (lib/tableauDeBord.ts).
 *
 * Anime a l'entree (les barres poussent depuis 0, en cascade entre les deux
 * series), avec un survol qui met la ligne en avant et le total ecrit au
 * bout de la barre - pour eviter l'effet "graphique fige" d'un simple
 * rendu statique.
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
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={donneesPlates}
          layout="vertical"
          margin={{ left: 8, right: 28 }}
          onMouseLeave={() => setActif(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--trait)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--encre-douce)' }} />
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
              // chaque <Bar> ci-dessous - inutile de le re-deviner a partir
              // d'une cle technique.
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
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
