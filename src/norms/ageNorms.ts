/**
 * Age-based sleep norms.
 *
 * Total sleep per 24h comes from published recommendations:
 *  - NSF: National Sleep Foundation, Hirshkowitz et al., Sleep Health 2015 (newborns 0–3 months).
 *  - AASM: American Academy of Sleep Medicine consensus, Paruthi et al., J Clin Sleep Med 2016,
 *    endorsed by the American Academy of Pediatrics (4 months – 5 years, naps included).
 *
 * Wake windows, nap counts, nap length and bedtime are not official guidelines of these
 * organizations. They are widely used pediatric / sleep-consultant reference ranges and are shown
 * in the UI as "ориентир" (a guide), not a norm.
 */

export type Source = 'NSF' | 'AASM';

export interface AgeNorm {
  /** Inclusive lower bound, months */
  fromMonth: number;
  /** Exclusive upper bound, months */
  toMonth: number;
  label: string;
  /** Recommended total sleep per 24h, hours */
  totalSleepH: [number, number];
  totalSleepSource: Source;
  /** Wake window range, minutes: first window of the day tends to the low end, last one to the high end */
  wakeWindowMin: [number, number];
  /** Typical number of daytime naps */
  naps: number;
  /** Range of daytime naps seen at this age */
  napsRange: [number, number];
  /** Typical nap length, minutes — used for planning the rest of the day */
  typicalNapMin: number;
  /** A single nap longer than this is worth shortening, minutes */
  maxNapMin: number;
  /** Bedtime range, minutes from midnight */
  bedtime: [number, number];
}

const t = (h: number, m = 0) => h * 60 + m;

export const AGE_NORMS: AgeNorm[] = [
  {
    fromMonth: 0, toMonth: 1, label: '0–1 мес',
    totalSleepH: [14, 17], totalSleepSource: 'NSF',
    wakeWindowMin: [35, 60], naps: 5, napsRange: [4, 7], typicalNapMin: 60, maxNapMin: 150,
    bedtime: [t(20), t(23)],
  },
  {
    fromMonth: 1, toMonth: 3, label: '1–3 мес',
    totalSleepH: [14, 17], totalSleepSource: 'NSF',
    wakeWindowMin: [60, 90], naps: 4, napsRange: [4, 5], typicalNapMin: 60, maxNapMin: 150,
    bedtime: [t(19, 30), t(22)],
  },
  {
    fromMonth: 3, toMonth: 4, label: '3–4 мес',
    totalSleepH: [14, 17], totalSleepSource: 'NSF',
    wakeWindowMin: [75, 120], naps: 4, napsRange: [3, 5], typicalNapMin: 60, maxNapMin: 120,
    bedtime: [t(19), t(21, 30)],
  },
  {
    fromMonth: 4, toMonth: 6, label: '4–6 мес',
    totalSleepH: [12, 16], totalSleepSource: 'AASM',
    wakeWindowMin: [105, 150], naps: 3, napsRange: [3, 4], typicalNapMin: 60, maxNapMin: 120,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 6, toMonth: 8, label: '6–8 мес',
    totalSleepH: [12, 16], totalSleepSource: 'AASM',
    wakeWindowMin: [120, 180], naps: 3, napsRange: [2, 3], typicalNapMin: 60, maxNapMin: 120,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 8, toMonth: 10, label: '8–10 мес',
    totalSleepH: [12, 16], totalSleepSource: 'AASM',
    wakeWindowMin: [150, 210], naps: 2, napsRange: [2, 2], typicalNapMin: 75, maxNapMin: 120,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 10, toMonth: 12, label: '10–12 мес',
    totalSleepH: [12, 16], totalSleepSource: 'AASM',
    wakeWindowMin: [180, 240], naps: 2, napsRange: [2, 2], typicalNapMin: 75, maxNapMin: 120,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 12, toMonth: 15, label: '12–15 мес',
    totalSleepH: [11, 14], totalSleepSource: 'AASM',
    wakeWindowMin: [180, 270], naps: 2, napsRange: [1, 2], typicalNapMin: 75, maxNapMin: 150,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 15, toMonth: 18, label: '15–18 мес',
    totalSleepH: [11, 14], totalSleepSource: 'AASM',
    wakeWindowMin: [240, 330], naps: 1, napsRange: [1, 2], typicalNapMin: 120, maxNapMin: 180,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 18, toMonth: 24, label: '18–24 мес',
    totalSleepH: [11, 14], totalSleepSource: 'AASM',
    wakeWindowMin: [300, 360], naps: 1, napsRange: [1, 1], typicalNapMin: 120, maxNapMin: 180,
    bedtime: [t(19), t(20, 30)],
  },
  {
    fromMonth: 24, toMonth: 36, label: '2–3 года',
    totalSleepH: [11, 14], totalSleepSource: 'AASM',
    wakeWindowMin: [300, 390], naps: 1, napsRange: [0, 1], typicalNapMin: 105, maxNapMin: 150,
    bedtime: [t(19, 30), t(21)],
  },
  {
    fromMonth: 36, toMonth: 72, label: '3–5 лет',
    totalSleepH: [10, 13], totalSleepSource: 'AASM',
    wakeWindowMin: [360, 720], naps: 0, napsRange: [0, 1], typicalNapMin: 75, maxNapMin: 90,
    bedtime: [t(19, 30), t(21)],
  },
];

export const SOURCES: Record<Source, { title: string; ref: string; url: string }> = {
  NSF: {
    title: 'National Sleep Foundation',
    ref: "Hirshkowitz M. et al. National Sleep Foundation's sleep time duration recommendations. Sleep Health, 2015",
    url: 'https://doi.org/10.1016/j.sleh.2014.12.010',
  },
  AASM: {
    title: 'American Academy of Sleep Medicine (одобрено AAP)',
    ref: 'Paruthi S. et al. Recommended Amount of Sleep for Pediatric Populations: A Consensus Statement of the AASM. J Clin Sleep Med, 2016',
    url: 'https://doi.org/10.5664/jcsm.5866',
  },
};

/** Whole months between birth and the given moment (fractional, ~30.44 days per month). */
export function ageInMonths(birthDate: string, at: number = Date.now()): number {
  const birth = new Date(birthDate + 'T00:00:00').getTime();
  return Math.max(0, (at - birth) / (30.4375 * 24 * 3600 * 1000));
}

export function normForAge(months: number): AgeNorm {
  return AGE_NORMS.find((n) => months >= n.fromMonth && months < n.toMonth) ?? AGE_NORMS[AGE_NORMS.length - 1];
}

/** AAP safe sleep recommendations (2022 policy statement), shown for infants under 12 months. */
export const SAFE_SLEEP_TIPS = [
  'Укладывайте малыша спать только на спину — и днём, и ночью.',
  'Твёрдый ровный матрас с натянутой простынёй, без наклона.',
  'Никаких подушек, одеял, бортиков и мягких игрушек в кроватке.',
  'Спите в одной комнате с ребёнком, но на разных поверхностях — хотя бы первые 6 месяцев.',
  'Не перегревайте: лёгкая одежда или спальный мешок вместо одеяла.',
  'Соска на время сна снижает риск СВДС; если малыш выплюнул её во сне — не нужно вставлять обратно.',
  'Не оставляйте ребёнка спать на диване, в кресле или в автокресле вне машины.',
];

export const SAFE_SLEEP_SOURCE = {
  title: 'American Academy of Pediatrics',
  ref: 'Moon R.Y. et al. Sleep-Related Infant Deaths: Updated 2022 Recommendations for Reducing Infant Deaths in the Sleep Environment. Pediatrics, 2022',
  url: 'https://doi.org/10.1542/peds.2022-057990',
};
