/**
 * Evolution temporelle - courbe du tableau de bord.
 *
 * Alimentee par serieTemporelle (lib/tableauDeBord.ts), calculee a partir
 * des seules dates de l'historique local. Le total est toujours affiche ;
 * les 3 maladies les plus frequentes sur la periode sont superposees, pour
 * ne pas noyer le graphique si le referentiel entier y passait.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { classeParId, nomClasse } from '../lib/classes';
import type { PointSerie } from '../lib/tableauDeBord';
import { useTraduction } from '../lib/traduction';

const COULEURS_LIGNES = ['var(--atteint)', 'var(--alerte)', 'var(--grave)'];

interface Props {
  serie: PointSerie[];
}

export function CourbeEvolution({ serie }: Props) {
  const { t, langue } = useTraduction();

  if (serie.length === 0) {
    return <p className="m-0 text-sm text-encre-douce">{t.courbeEvolution.pasAssez}</p>;
  }

  const totalParMaladie = new Map<string, number>();
  serie.forEach((p) => {
    Object.entries(p.parMaladie).forEach(([id, n]) => {
      totalParMaladie.set(id, (totalParMaladie.get(id) ?? 0) + n);
    });
  });
  const topMaladies = Array.from(totalParMaladie.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const donnees = serie.map((p) => {
    const point: Record<string, number | string> = {
      date: new Date(p.date).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', {
        day: '2-digit',
        month: '2-digit',
      }),
      total: p.total,
    };
    topMaladies.forEach((id) => {
      point[id] = p.parMaladie[id] ?? 0;
    });
    return point;
  });

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={donnees} margin={{ left: -16, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--trait)" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--encre-douce)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--encre-douce)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--carte)',
              border: '1px solid var(--trait)',
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="total"
            name={t.courbeEvolution.total}
            stroke="var(--sain)"
            strokeWidth={2}
            dot={false}
          />
          {topMaladies.map((id, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              name={(() => {
                const classe = classeParId(id);
                return classe ? nomClasse(classe, langue) : id;
              })()}
              stroke={COULEURS_LIGNES[i % COULEURS_LIGNES.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
