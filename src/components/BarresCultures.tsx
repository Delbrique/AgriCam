/**
 * Cultures les plus diagnostiquees / les plus touchees - barres horizontales
 * du tableau de bord. Alimente par repartitionCultures (lib/tableauDeBord.ts).
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
            formatter={(valeur, cle) => {
              const nombre = Number(valeur) || 0;
              return [
                `${nombre} fruit${nombre > 1 ? 's' : ''}`,
                cle === 'atteints' ? 'atteints/graves' : 'diagnostiqués',
              ];
            }}
            contentStyle={{
              background: 'var(--carte)',
              border: '1px solid var(--trait)',
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Bar dataKey="nombre" fill="var(--sain)" radius={[0, 4, 4, 0]} name="diagnostiqués" />
          <Bar dataKey="atteints" fill="var(--atteint)" radius={[0, 4, 4, 0]} name="atteints/graves" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
