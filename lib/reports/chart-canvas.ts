/** Génération de graphiques canvas (PNG) pour exports PDF / Excel côté client. */

export const REPORT_CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#0891b2",
  "#dc2626",
  "#64748b",
  "#ca8a04",
  "#0f766e",
] as const;

export type ChartSeriesPoint = {
  label: string;
  values: Record<string, number>;
};

export type NamedValue = { name: string; value: number };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible.");
  return { canvas, ctx };
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title?: string,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 10);
  ctx.stroke();

  if (title) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px Helvetica, Arial, sans-serif";
    ctx.fillText(title, 18, 26);
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  items: Array<{ label: string; color: string }>,
  x: number,
  y: number,
) {
  ctx.font = "12px Helvetica, Arial, sans-serif";
  let cursorX = x;
  for (const item of items) {
    ctx.fillStyle = item.color;
    roundRect(ctx, cursorX, y - 8, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.fillText(item.label, cursorX + 14, y);
    cursorX += ctx.measureText(item.label).width + 34;
  }
}

/** Diagramme en barres groupées ou empilées. */
export function renderBarChartPng(options: {
  title?: string;
  categories: string[];
  series: Array<{ key: string; label: string; color?: string }>;
  data: Array<Record<string, number | string>>;
  width?: number;
  height?: number;
  stacked?: boolean;
}): string {
  const width = options.width ?? 720;
  const height = options.height ?? 320;
  const { canvas, ctx } = createCanvas(width, height);
  paintBackground(ctx, width, height, options.title);

  const pad = { top: options.title ? 48 : 28, right: 24, bottom: 56, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const series = options.series.map((s, i) => ({
    ...s,
    color: s.color ?? REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length],
  }));

  const values = options.categories.map((cat, idx) => {
    const row = options.data[idx] ?? {};
    return series.map((s) => Number(row[s.key] ?? 0));
  });

  const maxValue = Math.max(
    1,
    ...(options.stacked
      ? values.map((row) => row.reduce((a, b) => a + b, 0))
      : values.flat()),
  );

  drawLegend(
    ctx,
    series.map((s) => ({ label: s.label, color: s.color })),
    pad.left,
    pad.top - 14,
  );

  // Axes
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.stroke();

  // Grid
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Helvetica, Arial, sans-serif";
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + plotH - (plotH * i) / 4;
    const val = Math.round((maxValue * i) / 4);
    ctx.strokeStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.fillText(String(val), 8, y + 3);
  }

  const groupCount = Math.max(1, options.categories.length);
  const groupW = plotW / groupCount;
  const barGap = 4;
  const innerGap = options.stacked ? 0 : 3;
  const barCount = options.stacked ? 1 : series.length;
  const barW = Math.max(
    6,
    (groupW - barGap * 2 - innerGap * (barCount - 1)) / barCount,
  );

  options.categories.forEach((cat, gi) => {
    const baseX = pad.left + gi * groupW + barGap;
    let stackY = 0;
    series.forEach((s, si) => {
      const raw = Number(options.data[gi]?.[s.key] ?? 0);
      const h = (raw / maxValue) * plotH;
      if (options.stacked) {
        const y = pad.top + plotH - stackY - h;
        ctx.fillStyle = s.color;
        roundRect(ctx, baseX, y, groupW - barGap * 2, Math.max(h, 0), 3);
        ctx.fill();
        stackY += h;
      } else {
        const x = baseX + si * (barW + innerGap);
        const y = pad.top + plotH - h;
        ctx.fillStyle = s.color;
        roundRect(ctx, x, y, barW, Math.max(h, 0), 3);
        ctx.fill();
      }
    });

    ctx.fillStyle = "#475569";
    ctx.font = "10px Helvetica, Arial, sans-serif";
    const label =
      cat.length > 12 ? `${cat.slice(0, 11)}…` : cat;
    const textW = ctx.measureText(label).width;
    ctx.fillText(
      label,
      pad.left + gi * groupW + (groupW - textW) / 2,
      pad.top + plotH + 16,
    );
  });

  return canvas.toDataURL("image/png");
}

/** Donut / camembert. */
export function renderDonutChartPng(options: {
  title?: string;
  data: NamedValue[];
  colors?: string[];
  width?: number;
  height?: number;
}): string {
  const width = options.width ?? 420;
  const height = options.height ?? 300;
  const { canvas, ctx } = createCanvas(width, height);
  paintBackground(ctx, width, height, options.title);

  const filtered = options.data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0) || 1;
  const cx = width * 0.38;
  const cy = height * 0.55;
  const radius = Math.min(width, height) * 0.28;
  const inner = radius * 0.55;

  let angle = -Math.PI / 2;
  filtered.forEach((item, i) => {
    const slice = (item.value / total) * Math.PI * 2;
    const color =
      options.colors?.[i] ??
      REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 16px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.round(total)), cx, cy + 2);
  ctx.font = "11px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Total", cx, cy + 16);
  ctx.textAlign = "left";

  let legendY = (options.title ? 52 : 32) + 8;
  filtered.forEach((item, i) => {
    const color =
      options.colors?.[i] ??
      REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length];
    const pct = Math.round((item.value / total) * 100);
    ctx.fillStyle = color;
    roundRect(ctx, width * 0.68, legendY - 8, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "12px Helvetica, Arial, sans-serif";
    ctx.fillText(`${item.name}`, width * 0.68 + 16, legendY);
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${item.value} (${pct}%)`, width * 0.68 + 16, legendY + 14);
    legendY += 34;
  });

  if (filtered.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Aucune donnée", width / 2, height / 2);
  }

  return canvas.toDataURL("image/png");
}

/** Courbe / aires empilées légères. */
export function renderAreaChartPng(options: {
  title?: string;
  points: Array<{ label: string } & Record<string, number | string>>;
  series: Array<{ key: string; label: string; color?: string }>;
  width?: number;
  height?: number;
}): string {
  const width = options.width ?? 720;
  const height = options.height ?? 300;
  const { canvas, ctx } = createCanvas(width, height);
  paintBackground(ctx, width, height, options.title);

  const pad = { top: options.title ? 48 : 28, right: 24, bottom: 48, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const series = options.series.map((s, i) => ({
    ...s,
    color: s.color ?? REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length],
  }));

  drawLegend(
    ctx,
    series.map((s) => ({ label: s.label, color: s.color })),
    pad.left,
    pad.top - 14,
  );

  const maxValue = Math.max(
    1,
    ...options.points.flatMap((p) =>
      series.map((s) => Number(p[s.key] ?? 0)),
    ),
  );

  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.stroke();

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + plotH - (plotH * i) / 4;
    ctx.strokeStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "10px Helvetica, Arial, sans-serif";
    ctx.fillText(String(Math.round((maxValue * i) / 4)), 8, y + 3);
  }

  const n = Math.max(1, options.points.length - 1);

  series.forEach((s) => {
    const coords = options.points.map((p, i) => {
      const x =
        options.points.length === 1
          ? pad.left + plotW / 2
          : pad.left + (plotW * i) / n;
      const y =
        pad.top + plotH - (Number(p[s.key] ?? 0) / maxValue) * plotH;
      return { x, y };
    });

    if (coords.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(coords[0].x, pad.top + plotH);
    coords.forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.lineTo(coords[coords.length - 1].x, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = `${s.color}33`;
    ctx.fill();

    ctx.beginPath();
    coords.forEach((c, i) => {
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    coords.forEach((c) => {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });

  ctx.fillStyle = "#475569";
  ctx.font = "10px Helvetica, Arial, sans-serif";
  options.points.forEach((p, i) => {
    const x =
      options.points.length === 1
        ? pad.left + plotW / 2
        : pad.left + (plotW * i) / n;
    const label =
      String(p.label).length > 10
        ? `${String(p.label).slice(0, 9)}…`
        : String(p.label);
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, x - tw / 2, pad.top + plotH + 16);
  });

  return canvas.toDataURL("image/png");
}

/** Jauge radiale simple (0–100). */
export function renderRadialChartPng(options: {
  title?: string;
  value: number;
  label?: string;
  color?: string;
  width?: number;
  height?: number;
}): string {
  const width = options.width ?? 280;
  const height = options.height ?? 240;
  const { canvas, ctx } = createCanvas(width, height);
  paintBackground(ctx, width, height, options.title);

  const cx = width / 2;
  const cy = height * 0.58;
  const radius = Math.min(width, height) * 0.28;
  const start = Math.PI * 0.75;
  const end = Math.PI * 2.25;
  const pct = Math.max(0, Math.min(100, options.value)) / 100;
  const color = options.color ?? REPORT_CHART_COLORS[0];

  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + (end - start) * pct);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(options.value)}%`, cx, cy + 6);
  ctx.font = "12px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(options.label ?? "Taux", cx, cy + 24);

  return canvas.toDataURL("image/png");
}
