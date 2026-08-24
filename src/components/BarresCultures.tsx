/**
 * Cultures les plus diagnostiquees / les plus touchees - barres horizontales
 * du tableau de bord. Alimente par repartitionCultures (lib/tableauDeBord.ts).
 */

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StatCulture } from '../lib/tableauDeBord';

const LIBELLE_CULTURE: Record<StatCulture['culture'], string> = {
  tomate: 'Tomate',
  piment: 'Piment',
  oignon: 'Oignon',
};

interface Props {
  donnees: StatCulture[];
}

export function BarresCultures({ donnees }: Props) {
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

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donneesPlates} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--trait)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--encre-douce)' }} />
          <YAxis
            type="category"
            dataKey="culture"
            width={70}
            tick={{ fontSize: 13, fill: 'var(--encre)' }}
          />
          <Tooltip
            formatter={(valeur, nom) => {
              // `nom` reprend deja le libelle lisible passe via `name` sur
              // chaque <Bar> ci-dessous - inutile (et c'etait le bug ici) de
              // le re-deviner a partir d'une cle technique.
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
          <Bar dataKey="nombre" fill="var(--sain)" radius={[0, 4, 4, 0]} name="Diagnostiqués" />
          <Bar dataKey="atteints" fill="var(--atteint)" radius={[0, 4, 4, 0]} name="Atteints/graves" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
