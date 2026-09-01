/**
 * genererCsv est la seule partie testable sans DOM (le declenchement du
 * telechargement et la generation du PDF en dependent) - elle doit rester
 * correcte cellule par cellule, notamment l'echappement des virgules.
 */
import { describe, expect, it } from 'vitest';
import { classeParId } from './classes';
import type { Consultation } from './stockage';
import { echapperCsv, genererCsv } from './export';
import { fr } from './locales/fr';

function consultation(overrides: Partial<Consultation>): Consultation {
  return {
    id: 'c1',
    horodatage: Date.parse('2026-08-21T10:00:00Z'),
    fruits: [
      {
        classe: classeParId('Tomato___Anthracnose'),
        confiance: 0.876,
        incertain: false,
        horsSujet: false,
      },
    ],
    nbAtteints: 1,
    ...overrides,
  } as Consultation;
}

describe('genererCsv', () => {
  it('ecrit une ligne d\'entete puis une ligne par consultation', () => {
    const csv = genererCsv([consultation({})], fr, 'fr');
    const lignes = csv.split('\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toBe(
      'date,culture,maladie,gravite,confiance_pct,fruits_analyses,fruits_atteints,latitude,longitude',
    );
  });

  it('arrondit la confiance en pourcentage entier', () => {
    const csv = genererCsv([consultation({})], fr, 'fr');
    expect(csv).toContain(',88,'); // 0.876 -> 88 %
  });

  it('laisse les champs geo vides sans position', () => {
    const csv = genererCsv([consultation({ position: undefined })], fr, 'fr');
    expect(csv.split('\n')[1].endsWith(',,')).toBe(true);
  });

  it('renseigne latitude/longitude quand la position existe', () => {
    const csv = genererCsv(
      [consultation({ position: { latitude: 3.848, longitude: 11.502 } })],
      fr,
      'fr',
    );
    expect(csv).toContain('3.848,11.502');
  });

  it('marque les consultations hors sujet sans inventer de maladie', () => {
    const csv = genererCsv(
      [
        consultation({
          fruits: [{ classe: classeParId('Tomato___Anthracnose'), confiance: 0.9, incertain: false, horsSujet: true }] as Consultation['fruits'],
        }),
      ],
      fr,
      'fr',
    );
    expect(csv.split('\n')[1]).toContain('hors sujet');
  });
});

describe('echapperCsv', () => {
  it('entoure de guillemets et double les guillemets internes quand la valeur contient une virgule', () => {
    expect(echapperCsv('Anthracnose, forme grave')).toBe('"Anthracnose, forme grave"');
    expect(echapperCsv('Il a dit "bonjour"')).toBe('"Il a dit ""bonjour"""');
  });

  it('laisse une valeur simple inchangee', () => {
    expect(echapperCsv('Tomate saine')).toBe('Tomate saine');
  });
});
