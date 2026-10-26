import { format, formatDistanceStrict, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ageInMonths } from '../norms/ageNorms';

export { formatDuration } from '../engine/time';

export const fmtTime = (ts: number) => format(ts, 'HH:mm');

export function fmtDay(ts: number): string {
  if (isToday(ts)) return 'Сегодня';
  if (isYesterday(ts)) return 'Вчера';
  return format(ts, 'EEEE, d MMMM', { locale: ru });
}

export const fmtShortDay = (ts: number) => format(ts, 'd MMM', { locale: ru });

/** "2025-09-01" → "6 мес 12 дн" / "1 год 3 мес" */
export function ageLabel(birthDate: string, now = Date.now()): string {
  const months = ageInMonths(birthDate, now);
  if (months < 1) {
    return formatDistanceStrict(new Date(birthDate + 'T00:00:00'), now, { locale: ru, unit: 'day' });
  }
  const whole = Math.floor(months);
  if (whole < 12) return `${whole} мес`;
  const y = Math.floor(whole / 12);
  const m = whole % 12;
  const years = y === 1 ? 'год' : y < 5 ? 'года' : 'лет';
  return m ? `${y} ${years} ${m} мес` : `${y} ${years}`;
}

/** "HH:mm" ↔ minutes from midnight */
export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export const minToHhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** epoch ms ↔ value of <input type="datetime-local"> */
export const toLocalInput = (ts: number) => format(ts, "yyyy-MM-dd'T'HH:mm");
export const fromLocalInput = (s: string) => new Date(s).getTime();

/** Russian plural: plural(3, ['дневной сон', 'дневных сна', 'дневных снов']) → "3 дневных сна" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}
