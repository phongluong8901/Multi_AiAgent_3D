import { ColumnChartSeries, IngestedFileAnalysis } from '../../core/types';

export type ExpertChartType = 'column' | 'line' | 'donut' | 'radar' | 'scatter' | 'histogram';

interface ChartElements {
  chartSec: HTMLElement;
  colTabsEl: HTMLElement;
  typeTabsEl: HTMLElement;
  scatterControlsEl: HTMLElement;
  insightsEl: HTMLElement;
  chartCanvasEl: HTMLElement;
}

interface ParsedNumericColumn {
  colIdx: number;
  name: string;
  values: Array<number | null>;
  finiteValues: number[];
}

const CHART_PALETTE = [
  '#38bdf8',
  '#818cf8',
  '#34d399',
  '#f59e0b',
  '#f472b6',
  '#22d3ee',
  '#a78bfa',
  '#fb7185',
];

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const av = Math.abs(v);
  if (av >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (av >= 10_000) return `${(v / 1_000).toFixed(1).replace(/\.?0+$/, '')}K`;
  if (Number.isInteger(v)) return String(v);
  if (av >= 100) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2).replace(/\.?0+$/, '');
}

function parseCellNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[,%$\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractNumericColumnsFromSample(analysis: IngestedFileAnalysis): ParsedNumericColumn[] {
  const cols = analysis.columns || [];
  const rows = analysis.sample_rows || [];
  const result: ParsedNumericColumn[] = [];

  for (let c = 0; c < cols.length; c++) {
    const values = rows.map((r) => parseCellNumber(r[c]));
    const finiteValues = values.filter((v): v is number => v !== null);
    if (finiteValues.length >= 3) {
      result.push({
        colIdx: c,
        name: cols[c] || `Col_${c + 1}`,
        values,
        finiteValues,
      });
    }
  }
  return result;
}

function computePearson(a: Array<number | null>, b: Array<number | null>): { r: number; n: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== null && bv !== null) {
      xs.push(av);
      ys.push(bv);
    }
  }
  if (xs.length < 3) return null;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den <= 1e-12) return null;
  return { r: num / den, n };
}

function computeSeriesProfile(values: number[]) {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, trendPct: 0, outlierCount: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const first = values[0];
  const last = values[n - 1];
  const trendPct = Math.abs(first) > 1e-9 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const outlierCount = stdDev > 1e-9 ? values.filter((v) => Math.abs(v - mean) > 2 * stdDev).length : 0;
  return { mean, median, stdDev, min, max, trendPct, outlierCount };
}

function getAvailableChartTypes(
  series: ColumnChartSeries,
  analysis: IngestedFileAnalysis,
  sampleNumericCols: ParsedNumericColumn[]
): ExpertChartType[] {
  const pts = series.points || [];
  const available: ExpertChartType[] = [];
  if (pts.length >= 1) available.push('column');
  if (pts.length >= 3 && series.unit_or_kind !== 'frequency') available.push('line');
  if (pts.filter((p) => p.value > 0).length >= 2 && pts.length <= 18) available.push('donut');
  if (pts.length >= 3 || (analysis.numeric_stats && analysis.numeric_stats.length >= 3)) {
    available.push('radar');
  }
  if (sampleNumericCols.length >= 2) {
    available.push('scatter');
  }
  const matchedCol = sampleNumericCols.find((c) => c.name === series.column_name);
  const histLen = matchedCol ? matchedCol.finiteValues.length : pts.length;
  if (histLen >= 4 && series.unit_or_kind !== 'frequency') {
    available.push('histogram');
  }
  return available.length > 0 ? available : ['column'];
}

function recommendChartType(
  series: ColumnChartSeries,
  available: ExpertChartType[]
): { type: ExpertChartType; reason: string } {
  const pts = series.points || [];
  if (series.unit_or_kind === 'frequency' && available.includes('donut')) {
    return { type: 'donut', reason: 'Dữ liệu phân loại rời rạc: Biểu đồ Tròn/Donut giúp thấy rõ tỷ trọng từng nhóm.' };
  }
  if (series.unit_or_kind === 'overview' && available.includes('radar')) {
    return { type: 'radar', reason: 'Tổng hợp đa chỉ tiêu số: Biểu đồ Radar chuẩn hóa giúp so sánh cân đối giữa các cột.' };
  }
  const looksSequential =
    pts.length >= 3 &&
    pts.some((p) => /\d{4}|t\d|q\d|tháng|ngày|năm|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|^#\d+|^l\d+|^đoạn/i.test(p.label));
  if ((looksSequential || pts.length >= 6) && available.includes('line')) {
    return { type: 'line', reason: 'Chuỗi dữ liệu tuần tự: Biểu đồ Đường nổi bật xu hướng biến thiên & điểm đỉnh/đáy.' };
  }
  return { type: 'column', reason: 'Dữ liệu rời rạc ít điểm: Biểu đồ Cột thể hiện đối chiếu độ lớn trực quan nhất.' };
}

function attachTooltips(stageEl: HTMLElement) {
  const tip = document.createElement('div');
  tip.className = 'fd-svg-tooltip';
  tip.style.display = 'none';
  stageEl.appendChild(tip);

  const targets = stageEl.querySelectorAll<SVGElement>('[data-tip]');
  targets.forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('mouseenter', () => {
      tip.textContent = el.getAttribute('data-tip') || '';
      tip.style.display = 'block';
    });
    el.addEventListener('mousemove', (ev) => {
      const r = stageEl.getBoundingClientRect();
      const x = Math.min(r.width - 150, Math.max(8, ev.clientX - r.left + 12));
      const y = Math.max(6, ev.clientY - r.top - 28);
      tip.style.left = `${Math.round(x)}px`;
      tip.style.top = `${Math.round(y)}px`;
    });
    el.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
    });
  });
}

function renderSvgColumnChart(series: ColumnChartSeries, stageEl: HTMLElement) {
  const pts = series.points || [];
  if (pts.length === 0) return;

  const W = 640;
  const H = 228;
  const padL = 52;
  const padR = 18;
  const padT = 22;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const vals = pts.map((p) => p.value);
  const maxVal = Math.max(0.0001, ...vals);
  const minVal = Math.min(0, ...vals);
  const span = Math.max(1e-6, maxVal - minVal);
  const zeroY = padT + (maxVal / span) * plotH;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const meanY = padT + ((maxVal - mean) / span) * plotH;

  const gridLines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = padT + ratio * plotH;
    const tickVal = maxVal - ratio * span;
    gridLines.push(
      `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="3,3" />`,
      `<text x="${padL - 7}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9.5">${escapeHtml(fmtNum(tickVal))}</text>`
    );
  }

  const slotW = plotW / pts.length;
  const barW = Math.max(10, Math.min(42, slotW * 0.62));
  const barsSvg: string[] = [];

  pts.forEach((pt, idx) => {
    const cx = padL + slotW * (idx + 0.5);
    const valY = padT + ((maxVal - pt.value) / span) * plotH;
    const barTop = Math.min(zeroY, valY);
    const barH = Math.max(3, Math.abs(valY - zeroY));
    const col = CHART_PALETTE[idx % CHART_PALETTE.length];
    const lblText = pt.label.length > 10 ? `${pt.label.slice(0, 9)}..` : pt.label;
    const showVal = pts.length <= 14 || idx % 2 === 0;

    barsSvg.push(
      `<rect x="${(cx - barW / 2).toFixed(1)}" y="${barTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="4" fill="url(#colGrad${idx % 3})" stroke="${col}" stroke-opacity="0.7" stroke-width="1" data-tip="${escapeHtml(`${pt.label}: ${fmtNum(pt.value)}`)}"/>`,
      showVal
        ? `<text x="${cx.toFixed(1)}" y="${Math.max(11, barTop - 4).toFixed(1)}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-weight="700">${escapeHtml(fmtNum(pt.value))}</text>`
        : '',
      `<text x="${cx.toFixed(1)}" y="${H - 18}" text-anchor="middle" fill="#cbd5e1" font-size="9" transform="${pts.length > 9 ? `rotate(-20 ${cx.toFixed(1)} ${H - 18})` : ''}">${escapeHtml(lblText)}</text>`
    );
  });

  stageEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fd-chart-svg">
      <defs>
        <linearGradient id="colGrad0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient>
        <linearGradient id="colGrad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>
        <linearGradient id="colGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>
      </defs>
      ${gridLines.join('')}
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" stroke="rgba(148,163,184,0.45)" stroke-width="1.2" />
      <line x1="${padL}" y1="${meanY.toFixed(1)}" x2="${W - padR}" y2="${meanY.toFixed(1)}" stroke="#fde047" stroke-width="1.2" stroke-dasharray="5,4" />
      <text x="${W - padR}" y="${Math.max(11, meanY - 4).toFixed(1)}" text-anchor="end" fill="#fde047" font-size="9" font-weight="700">TB: ${escapeHtml(fmtNum(mean))}</text>
      ${barsSvg.join('')}
    </svg>
  `;
  attachTooltips(stageEl);
}

function renderSvgLineChart(series: ColumnChartSeries, stageEl: HTMLElement) {
  const pts = series.points || [];
  if (pts.length < 2) {
    renderSvgColumnChart(series, stageEl);
    return;
  }

  const W = 640;
  const H = 228;
  const padL = 52;
  const padR = 20;
  const padT = 24;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const vals = pts.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const padRange = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.2 || 1;
  const yMin = rawMin >= 0 ? Math.max(0, rawMin - padRange) : rawMin - padRange;
  const yMax = rawMax + padRange;
  const span = Math.max(1e-6, yMax - yMin);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const meanY = padT + ((yMax - mean) / span) * plotH;

  const coords = pts.map((pt, idx) => {
    const x = padL + (pts.length === 1 ? plotW * 0.5 : (idx / (pts.length - 1)) * plotW);
    const y = padT + ((yMax - pt.value) / span) * plotH;
    return { x, y, pt };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const gridLines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = padT + ratio * plotH;
    const tick = yMax - ratio * span;
    gridLines.push(
      `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="3,3" />`,
      `<text x="${padL - 7}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9.5">${escapeHtml(fmtNum(tick))}</text>`
    );
  }

  const stepLabel = Math.max(1, Math.ceil(coords.length / 8));
  const dotsSvg = coords
    .map((c, idx) => {
      const lbl = c.pt.label.length > 9 ? `${c.pt.label.slice(0, 8)}..` : c.pt.label;
      return `
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.6" fill="#0f172a" stroke="#38bdf8" stroke-width="2.4" data-tip="${escapeHtml(`${c.pt.label}: ${fmtNum(c.pt.value)}`)}" />
        ${idx % stepLabel === 0 || idx === coords.length - 1 ? `<text x="${c.x.toFixed(1)}" y="${H - 14}" text-anchor="middle" fill="#cbd5e1" font-size="9">${escapeHtml(lbl)}</text>` : ''}
      `;
    })
    .join('');

  stageEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fd-chart-svg">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${gridLines.join('')}
      <line x1="${padL}" y1="${meanY.toFixed(1)}" x2="${W - padR}" y2="${meanY.toFixed(1)}" stroke="#fde047" stroke-width="1.2" stroke-dasharray="5,4" />
      <text x="${W - padR}" y="${Math.max(12, meanY - 4).toFixed(1)}" text-anchor="end" fill="#fde047" font-size="9" font-weight="700">TB: ${escapeHtml(fmtNum(mean))}</text>
      <path d="${areaPath}" fill="url(#lineAreaGrad)" />
      <path d="${linePath}" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      ${dotsSvg}
    </svg>
  `;
  attachTooltips(stageEl);
}

function renderSvgDonutChart(series: ColumnChartSeries, stageEl: HTMLElement) {
  const positives = (series.points || []).filter((p) => p.value > 0);
  if (positives.length < 2) {
    renderSvgColumnChart(series, stageEl);
    return;
  }

  const sorted = [...positives].sort((a, b) => b.value - a.value);
  const slices = sorted.slice(0, 7);
  if (sorted.length > 7) {
    const restSum = sorted.slice(7).reduce((s, p) => s + p.value, 0);
    slices.push({ label: 'Khác', value: restSum });
  }
  const total = slices.reduce((s, p) => s + p.value, 0) || 1;

  const cx = 108;
  const cy = 108;
  const rOuter = 82;
  const rInner = 46;
  let angleAcc = -Math.PI / 2;
  const paths: string[] = [];
  const legendItems: string[] = [];

  slices.forEach((sl, idx) => {
    const frac = sl.value / total;
    const sweep = Math.max(0.03, frac * Math.PI * 2);
    const a1 = angleAcc;
    const a2 = angleAcc + sweep;
    angleAcc = a2;
    const largeArc = sweep > Math.PI ? 1 : 0;

    const x1o = cx + Math.cos(a1) * rOuter;
    const y1o = cy + Math.sin(a1) * rOuter;
    const x2o = cx + Math.cos(a2) * rOuter;
    const y2o = cy + Math.sin(a2) * rOuter;
    const x2i = cx + Math.cos(a2) * rInner;
    const y2i = cy + Math.sin(a2) * rInner;
    const x1i = cx + Math.cos(a1) * rInner;
    const y1i = cy + Math.sin(a1) * rInner;

    const col = CHART_PALETTE[idx % CHART_PALETTE.length];
    const pct = (frac * 100).toFixed(1);
    const d = [
      `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      `L ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      'Z',
    ].join(' ');

    paths.push(
      `<path d="${d}" fill="${col}" fill-opacity="0.88" stroke="#0f172a" stroke-width="2" data-tip="${escapeHtml(`${sl.label}: ${fmtNum(sl.value)} (${pct}%)`)}" />`
    );

    legendItems.push(`
      <div class="fd-donut-leg-row">
        <span class="fd-donut-swatch" style="background:${col};"></span>
        <span class="fd-donut-leg-lbl" title="${escapeHtml(sl.label)}">${escapeHtml(sl.label)}</span>
        <span class="fd-donut-leg-val">${escapeHtml(fmtNum(sl.value))} (${pct}%)</span>
      </div>
    `);
  });

  stageEl.innerHTML = `
    <div class="fd-donut-wrap">
      <svg viewBox="0 0 216 216" class="fd-donut-svg">
        ${paths.join('')}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#94a3b8" font-size="9.5" font-weight="600">TỔNG CỘNG</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#f8fafc" font-size="14" font-weight="800">${escapeHtml(fmtNum(total))}</text>
      </svg>
      <div class="fd-donut-legend">${legendItems.join('')}</div>
    </div>
  `;
  attachTooltips(stageEl);
}

function renderSvgRadarChart(
  series: ColumnChartSeries,
  analysis: IngestedFileAnalysis,
  stageEl: HTMLElement
) {
  const useMultiStats =
    series.unit_or_kind === 'overview' && analysis.numeric_stats && analysis.numeric_stats.length >= 3;

  const axes: Array<{ label: string; normPrimary: number; rawPrimary: string; normSecondary?: number; rawSecondary?: string }> = [];

  if (useMultiStats) {
    analysis.numeric_stats.slice(0, 8).forEach((st) => {
      const denom = Math.max(1e-6, Math.abs(st.max));
      const pNorm = Math.max(0.12, Math.min(1.0, Math.abs(st.avg) / denom));
      axes.push({
        label: st.column,
        normPrimary: pNorm,
        rawPrimary: `TB: ${fmtNum(st.avg)}`,
        normSecondary: 1.0,
        rawSecondary: `Max: ${fmtNum(st.max)}`,
      });
    });
  } else {
    const pts = (series.points || []).slice(0, 10);
    if (pts.length < 3) {
      renderSvgColumnChart(series, stageEl);
      return;
    }
    const maxAbs = Math.max(1e-6, ...pts.map((p) => Math.abs(p.value)));
    pts.forEach((p) => {
      axes.push({
        label: p.label,
        normPrimary: Math.max(0.08, Math.min(1.0, Math.abs(p.value) / maxAbs)),
        rawPrimary: `${p.label}: ${fmtNum(p.value)}`,
      });
    });
  }

  const W = 620;
  const H = 236;
  const cx = 240;
  const cy = 118;
  const R = 84;
  const n = axes.length;

  const rings: string[] = [];
  for (let lv = 1; lv <= 4; lv++) {
    const rr = (R * lv) / 4;
    const ptsStr = axes
      .map((_, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
      })
      .join(' ');
    rings.push(`<polygon points="${ptsStr}" fill="none" stroke="rgba(148,163,184,0.22)" stroke-width="1" />`);
  }

  const axisLines: string[] = [];
  const primaryPts: string[] = [];
  const secondaryPts: string[] = [];
  const dots: string[] = [];

  axes.forEach((ax, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const ex = cx + ux * R;
    const ey = cy + uy * R;
    axisLines.push(
      `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="rgba(148,163,184,0.22)" stroke-width="1" />`
    );

    const lx = cx + ux * (R + 18);
    const ly = cy + uy * (R + 14);
    const anchor = ux > 0.25 ? 'start' : ux < -0.25 ? 'end' : 'middle';
    const shortLbl = ax.label.length > 13 ? `${ax.label.slice(0, 12)}..` : ax.label;
    axisLines.push(
      `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}" fill="#cbd5e1" font-size="9.5" font-weight="600">${escapeHtml(shortLbl)}</text>`
    );

    const px = cx + ux * R * ax.normPrimary;
    const py = cy + uy * R * ax.normPrimary;
    primaryPts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    dots.push(
      `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.2" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5" data-tip="${escapeHtml(`${ax.label} -> ${ax.rawPrimary}`)}" />`
    );

    if (ax.normSecondary !== undefined) {
      const sx = cx + ux * R * ax.normSecondary;
      const sy = cy + uy * R * ax.normSecondary;
      secondaryPts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
  });

  stageEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fd-chart-svg">
      ${rings.join('')}
      ${axisLines.join('')}
      ${
        secondaryPts.length >= 3
          ? `<polygon points="${secondaryPts.join(' ')}" fill="rgba(244,114,182,0.12)" stroke="#f472b6" stroke-width="1.6" stroke-dasharray="4,3" />`
          : ''
      }
      <polygon points="${primaryPts.join(' ')}" fill="rgba(56,189,248,0.28)" stroke="#38bdf8" stroke-width="2.4" />
      ${dots.join('')}
      <rect x="430" y="24" width="174" height="${useMultiStats ? 66 : 44}" rx="8" fill="rgba(15,23,42,0.82)" stroke="rgba(148,163,184,0.25)" />
      <circle cx="446" cy="43" r="4.5" fill="#38bdf8" />
      <text x="458" y="46" fill="#e2e8f0" font-size="10.5" font-weight="700">${useMultiStats ? 'Trung bình chuẩn hóa' : escapeHtml(series.column_name.slice(0, 18))}</text>
      ${
        useMultiStats
          ? `<circle cx="446" cy="68" r="4.5" fill="#f472b6" /><text x="458" y="71" fill="#fbcfe8" font-size="10.5" font-weight="600">Biên độ Cực đại (100%)</text>`
          : ''
      }
    </svg>
  `;
  attachTooltips(stageEl);
}

function renderSvgScatterChart(
  colX: ParsedNumericColumn,
  colY: ParsedNumericColumn,
  analysis: IngestedFileAnalysis,
  stageEl: HTMLElement
) {
  const pairs: Array<{ x: number; y: number; rowLbl: string }> = [];
  const len = Math.min(colX.values.length, colY.values.length);
  for (let i = 0; i < len; i++) {
    const vx = colX.values[i];
    const vy = colY.values[i];
    if (vx !== null && vy !== null) {
      const rowLbl = analysis.sample_rows[i]?.[0] || `#${i + 1}`;
      pairs.push({ x: vx, y: vy, rowLbl });
    }
  }
  if (pairs.length < 2) {
    stageEl.innerHTML = '<div style="padding:18px;color:#94a3b8;font-size:11px;">Không đủ cặp điểm số hợp lệ để vẽ biểu đồ Phân tán.</div>';
    return;
  }

  const W = 640;
  const H = 228;
  const padL = 56;
  const padR = 24;
  const padT = 26;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const mapX = (x: number) => padL + ((x - minX) / spanX) * plotW;
  const mapY = (y: number) => padT + ((maxY - y) / spanY) * plotH;

  const corr = computePearson(colX.values, colY.values);
  const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < pairs.length; i++) {
    num += (pairs[i].x - meanX) * (pairs[i].y - meanY);
    den += (pairs[i].x - meanX) ** 2;
  }
  let regLineSvg = '';
  if (den > 1e-9) {
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    const yStart = slope * minX + intercept;
    const yEnd = slope * maxX + intercept;
    regLineSvg = `<line x1="${mapX(minX).toFixed(1)}" y1="${mapY(yStart).toFixed(1)}" x2="${mapX(maxX).toFixed(1)}" y2="${mapY(yEnd).toFixed(1)}" stroke="#f472b6" stroke-width="2" stroke-dasharray="6,4" />`;
  }

  const grids: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const gy = padT + ratio * plotH;
    const yTick = maxY - ratio * spanY;
    grids.push(
      `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="3,3" />`,
      `<text x="${padL - 7}" y="${(gy + 3).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9">${escapeHtml(fmtNum(yTick))}</text>`
    );
    const gx = padL + ratio * plotW;
    const xTick = minX + ratio * spanX;
    grids.push(
      `<line x1="${gx.toFixed(1)}" y1="${padT}" x2="${gx.toFixed(1)}" y2="${padT + plotH}" stroke="rgba(148,163,184,0.1)" />`,
      `<text x="${gx.toFixed(1)}" y="${H - 20}" text-anchor="middle" fill="#94a3b8" font-size="9">${escapeHtml(fmtNum(xTick))}</text>`
    );
  }

  const ptsSvg = pairs
    .map((p) => {
      const px = mapX(p.x);
      const py = mapY(p.y);
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#34d399" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.4" data-tip="${escapeHtml(`${p.rowLbl} | ${colX.name}: ${fmtNum(p.x)} | ${colY.name}: ${fmtNum(p.y)}`)}" />`;
    })
    .join('');

  const rBadge = corr ? `Pearson r = ${corr.r.toFixed(2)} (n=${corr.n})` : `n = ${pairs.length}`;

  stageEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fd-chart-svg">
      ${grids.join('')}
      ${regLineSvg}
      ${ptsSvg}
      <text x="${W / 2}" y="${H - 4}" text-anchor="middle" fill="#bae6fd" font-size="9.5" font-weight="700">X: ${escapeHtml(colX.name)} | Y: ${escapeHtml(colY.name)}</text>
      <rect x="${W - 184}" y="4" width="160" height="18" rx="5" fill="rgba(236,72,153,0.18)" stroke="rgba(244,114,182,0.5)" />
      <text x="${W - 104}" y="16" text-anchor="middle" fill="#fbcfe8" font-size="9.5" font-weight="700">${escapeHtml(rBadge)}</text>
    </svg>
  `;
  attachTooltips(stageEl);
}

function renderSvgHistogramChart(
  series: ColumnChartSeries,
  sampleNumericCols: ParsedNumericColumn[],
  stageEl: HTMLElement
) {
  const matchedCol = sampleNumericCols.find((c) => c.name === series.column_name);
  const vals =
    matchedCol && matchedCol.finiteValues.length >= 4
      ? matchedCol.finiteValues
      : (series.points || []).map((p) => p.value);

  if (vals.length < 4) {
    renderSvgColumnChart(series, stageEl);
    return;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const binCount = Math.min(7, Math.max(4, Math.round(Math.sqrt(vals.length))));
  const width = Math.max(1e-6, (max - min) / binCount);
  const bins: Array<{ from: number; to: number; count: number }> = Array.from(
    { length: binCount },
    (_, i) => ({
      from: min + i * width,
      to: min + (i + 1) * width,
      count: 0,
    })
  );

  for (const v of vals) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }

  const histSeries: ColumnChartSeries = {
    column_name: `${series.column_name} (Phân phối)`,
    unit_or_kind: 'frequency',
    points: bins.map((b) => ({
      label: `${fmtNum(b.from)}-${fmtNum(b.to)}`,
      value: b.count,
    })),
  };
  renderSvgColumnChart(histSeries, stageEl);
}

export function renderDataExpertDashboardCharts(
  analysis: IngestedFileAnalysis,
  els: ChartElements
) {
  const { chartSec, colTabsEl, typeTabsEl, scatterControlsEl, insightsEl, chartCanvasEl } = els;
  const seriesList: ColumnChartSeries[] =
    analysis.column_charts && analysis.column_charts.length > 0
      ? analysis.column_charts
      : analysis.chart_series.length > 0
      ? [{ column_name: 'Tổng quan', unit_or_kind: 'numeric', points: analysis.chart_series }]
      : [];

  if (seriesList.length === 0) {
    chartSec.style.display = 'none';
    return;
  }
  chartSec.style.display = 'block';

  const sampleNumericCols = extractNumericColumnsFromSample(analysis);

  // Pairwise correlation scan across all numeric columns for Data Expert Insights
  let strongestCorr: { a: string; b: string; r: number } | null = null;
  for (let i = 0; i < sampleNumericCols.length; i++) {
    for (let j = i + 1; j < sampleNumericCols.length; j++) {
      const res = computePearson(sampleNumericCols[i].values, sampleNumericCols[j].values);
      if (res && (!strongestCorr || Math.abs(res.r) > Math.abs(strongestCorr.r))) {
        strongestCorr = { a: sampleNumericCols[i].name, b: sampleNumericCols[j].name, r: res.r };
      }
    }
  }

  let activeColIdx = 0;
  let activeChartType: ExpertChartType | null = null;
  let scatterXIdx = 0;
  let scatterYIdx = Math.min(1, Math.max(0, sampleNumericCols.length - 1));

  const TYPE_LABELS: Record<ExpertChartType, string> = {
    column: 'Cột',
    line: 'Đường (Xu hướng)',
    donut: 'Tròn (Tỷ trọng)',
    radar: 'Radar (Đa chiều)',
    scatter: 'Phân tán (Tương quan)',
    histogram: 'Phân phối (Histogram)',
  };

  const renderActive = (autoRecommend: boolean) => {
    const activeSeries = seriesList[activeColIdx] || seriesList[0];
    const available = getAvailableChartTypes(activeSeries, analysis, sampleNumericCols);
    const rec = recommendChartType(activeSeries, available);

    if (autoRecommend || !activeChartType || !available.includes(activeChartType)) {
      activeChartType = rec.type;
    }

    // 1. Update Column Tabs
    colTabsEl.innerHTML = '';
    seriesList.forEach((ser, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fd-col-tab${idx === activeColIdx ? ' active' : ''}`;
      btn.textContent = ser.column_name;
      btn.addEventListener('click', () => {
        activeColIdx = idx;
        renderActive(true);
      });
      colTabsEl.appendChild(btn);
    });

    // 2. Update Chart Type Tabs
    typeTabsEl.innerHTML = '';
    available.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fd-type-tab${t === activeChartType ? ' active' : ''}`;
      btn.textContent = t === rec.type ? `${TYPE_LABELS[t]} [Đề xuất]` : TYPE_LABELS[t];
      btn.addEventListener('click', () => {
        activeChartType = t;
        renderActive(false);
      });
      typeTabsEl.appendChild(btn);
    });

    // 3. Scatter axis selectors when Scatter active
    if (activeChartType === 'scatter' && sampleNumericCols.length >= 2) {
      scatterControlsEl.style.display = 'flex';
      scatterControlsEl.innerHTML = '';

      const lblX = document.createElement('span');
      lblX.textContent = 'Trục X:';
      const selX = document.createElement('select');
      selX.className = 'fd-scatter-select';
      sampleNumericCols.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = c.name;
        if (idx === scatterXIdx) opt.selected = true;
        selX.appendChild(opt);
      });

      const lblY = document.createElement('span');
      lblY.textContent = 'Trục Y:';
      const selY = document.createElement('select');
      selY.className = 'fd-scatter-select';
      sampleNumericCols.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = c.name;
        if (idx === scatterYIdx) opt.selected = true;
        selY.appendChild(opt);
      });

      selX.addEventListener('change', () => {
        scatterXIdx = Number(selX.value) || 0;
        renderActive(false);
      });
      selY.addEventListener('change', () => {
        scatterYIdx = Number(selY.value) || 0;
        renderActive(false);
      });
      scatterControlsEl.append(lblX, selX, lblY, selY);
    } else {
      scatterControlsEl.style.display = 'none';
      scatterControlsEl.innerHTML = '';
    }

    // 4. Data Expert Insights Strip
    const vals = (activeSeries.points || []).map((p) => p.value);
    const prof = computeSeriesProfile(vals);
    const insightBadges: string[] = [`[Đề xuất] ${rec.reason}`];
    if (activeSeries.unit_or_kind !== 'frequency' && vals.length >= 3) {
      const trendLabel =
        Math.abs(prof.trendPct) < 1
          ? 'Đi ngang ổn định'
          : prof.trendPct > 0
          ? `Tăng +${prof.trendPct.toFixed(1)}%`
          : `Giảm ${prof.trendPct.toFixed(1)}%`;
      insightBadges.push(
        `[Xu hướng] ${trendLabel} | TB ${fmtNum(prof.mean)} | Trung vị ${fmtNum(prof.median)} | Độ lệch ${fmtNum(prof.stdDev)}`
      );
      if (prof.outlierCount > 0) {
        insightBadges.push(`[Ngoại lai] Phát hiện ${prof.outlierCount} điểm vượt +/-2 SD.`);
      }
    }
    if (strongestCorr && Math.abs(strongestCorr.r) >= 0.35) {
      const dirTxt = strongestCorr.r >= 0 ? 'đồng biến' : 'nghịch biến';
      insightBadges.push(
        `[Tương quan] "${strongestCorr.a}" & "${strongestCorr.b}" ${dirTxt} (r = ${strongestCorr.r.toFixed(2)}).`
      );
    }
    insightsEl.innerHTML = insightBadges
      .map((line) => `<div class="fd-insight-pill">${escapeHtml(line)}</div>`)
      .join('');

    // 5. Render Active SVG Visualization
    if (activeChartType === 'line') {
      renderSvgLineChart(activeSeries, chartCanvasEl);
    } else if (activeChartType === 'donut') {
      renderSvgDonutChart(activeSeries, chartCanvasEl);
    } else if (activeChartType === 'radar') {
      renderSvgRadarChart(activeSeries, analysis, chartCanvasEl);
    } else if (activeChartType === 'scatter' && sampleNumericCols.length >= 2) {
      renderSvgScatterChart(
        sampleNumericCols[scatterXIdx] || sampleNumericCols[0],
        sampleNumericCols[scatterYIdx] || sampleNumericCols[1],
        analysis,
        chartCanvasEl
      );
    } else if (activeChartType === 'histogram') {
      renderSvgHistogramChart(activeSeries, sampleNumericCols, chartCanvasEl);
    } else {
      renderSvgColumnChart(activeSeries, chartCanvasEl);
    }
  };

  renderActive(true);
}
