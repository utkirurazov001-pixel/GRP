/** Chorak hisob-kitoblari */

export function currentQuarter(d = new Date()) {
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 };
}

export function prevQuarter({ year, quarter }) {
  return quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
}

/** Chorak tugash sanasi */
export function quarterEnd(year, quarter) {
  return new Date(Date.UTC(year, quarter * 3, 0, 23, 59, 59));
}

/** Hisobot topshirish muddati: chorak tugagach N kun */
export function reportDeadline(year, quarter, days) {
  const d = quarterEnd(year, quarter);
  return new Date(d.getTime() + days * 86400_000);
}

export function quarterLabel(year, quarter) {
  return `${year}-Q${quarter}`;
}

/** [from..to] choraklar ro'yxati (inklyuziv) */
export function quarterRange(fromYear, fromQ, toYear, toQ) {
  const out = [];
  let y = fromYear, q = fromQ;
  while (y < toYear || (y === toYear && q <= toQ)) {
    out.push({ year: y, quarter: q });
    q++;
    if (q > 4) { q = 1; y++; }
  }
  return out;
}
