import React, { useState, useMemo } from 'react';
import {
  Download,
  Flame,
  Footprints,
  Moon,
  Ruler,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group';

// Reusable Bezier Curve Path Generator
const getBezierPath = (points, keyY) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0][keyY]}`;
  
  let d = `M ${points[0].x} ${points[0][keyY]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    
    // Control points to create smooth transition
    const cp1x = curr.x + (next.x - curr.x) / 3;
    const cp1y = curr[keyY];
    const cp2x = curr.x + 2 * (next.x - curr.x) / 3;
    const cp2y = next[keyY];
    
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next[keyY]}`;
  }
  return d;
};

const getBezierAreaPath = (points, keyY, bottomY) => {
  const linePath = getBezierPath(points, keyY);
  if (!linePath) return '';
  return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
};

// Smart edge-aware tooltip positioning helper
const getSmartTooltipStyle = (hoveredPoint, containerWidth = 500) => {
  if (!hoveredPoint) return {};
  const isLeftEdge = hoveredPoint.x < 110;
  const isRightEdge = hoveredPoint.x > containerWidth - 110;
  
  let leftPos = hoveredPoint.x - 75;
  if (isLeftEdge) leftPos = hoveredPoint.x + 10;
  if (isRightEdge) leftPos = hoveredPoint.x - 145;

  let topPos = hoveredPoint.y - 85;
  if (hoveredPoint.y < 90) topPos = hoveredPoint.y + 15;

  return {
    position: 'absolute',
    left: `${leftPos}px`,
    top: `${topPos}px`,
    zIndex: 50,
    pointerEvents: 'none',
    minWidth: '135px'
  };
};

const TOOLTIP_CLASS = 'bg-popover text-popover-foreground rounded-md border px-3 py-2 shadow-md';

/** One tile in the metric strip. Six near-identical cards used to be six copies. */
function MetricCard({ label, value, unit, icon: Icon, delta, deltaGood, hint }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
          {unit && <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>}
        </CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        {delta ? (
          <Badge variant="outline" className="gap-1 font-normal">
            {deltaGood ? (
              <TrendingUp className="size-3 text-emerald-600" />
            ) : (
              <TrendingDown className="text-destructive size-3" />
            )}
            {delta}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">{hint}</span>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardView({ stats, history, config }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timeRange, setTimeRange] = useState('14D'); // '7D' | '14D' | '30D' | '90D' | 'ALL'
  const [activeSpecKey, setActiveSpecKey] = useState('umbilical'); // 'umbilical' | 'bicepL' | 'quadL' | 'glutes' | 'chest' | 'startWeight'

  // Filter history based on time range selector
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (timeRange === '7D') return sorted.slice(-7);
    if (timeRange === '14D') return sorted.slice(-14);
    if (timeRange === '30D') return sorted.slice(-30);
    if (timeRange === '90D') return sorted.slice(-90);
    return sorted; // ALL
  }, [history, timeRange]);

  // Compute Active Streak & Longest Streak
  const streakInfo = useMemo(() => {
    if (!history || history.length === 0) return { current: 0, max: 0 };
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first
    let current = 0;
    let max = 0;
    let temp = 0;
    let streakBroken = false;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      let reqCount = 4;
      let doneCount = 0;
      if (item.morningCompleted) doneCount++;
      if (item.morningJournalCompleted) doneCount++;
      if (item.nightCompleted) doneCount++;
      if (item.nightJournalCompleted) doneCount++;
      if (config?.gymLockEnabled) {
        reqCount++;
        if (item.gymCompleted) doneCount++;
      }
      if (config?.ankiLockEnabled) {
        reqCount++;
        if (item.ankiCompleted || item.ankiManualOverride) doneCount++;
      }
      if (config?.practiceLockEnabled) {
        reqCount++;
        if (item.practiceCompleted || item.practiceManualOverride) doneCount++;
      }
      const is100 = doneCount === reqCount;
      if (is100) {
        temp++;
        if (!streakBroken) current++;
      } else {
        streakBroken = true;
        temp = 0;
      }
      if (temp > max) max = temp;
    }
    return { current, max };
  }, [history, config]);

  // Compute Period-over-Period Trend Deltas
  const trends = useMemo(() => {
    if (!history || history.length < 4) return { weightDelta: null, sleepDelta: null, stepsDelta: null, caloriesDelta: null };
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const count = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : timeRange === '30D' ? 30 : 14;
    const recent = sorted.slice(-count);
    const previous = sorted.slice(-count * 2, -count);

    const getAvg = (arr, fn) => {
      const vals = arr.map(fn).filter(v => v !== null && !isNaN(v));
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const recentW = getAvg(recent, h => h.morningData?.wakingWeight ? parseFloat(h.morningData.wakingWeight) : null);
    const prevW = getAvg(previous, h => h.morningData?.wakingWeight ? parseFloat(h.morningData.wakingWeight) : null);
    const weightDelta = (recentW !== null && prevW !== null) ? (recentW - prevW).toFixed(1) : null;

    const recentS = getAvg(recent, h => h.morningData?.sleepHours ? parseFloat(h.morningData.sleepHours) : null);
    const prevS = getAvg(previous, h => h.morningData?.sleepHours ? parseFloat(h.morningData.sleepHours) : null);
    const sleepDelta = (recentS !== null && prevS !== null) ? (recentS - prevS).toFixed(1) : null;

    const recentSt = getAvg(recent, h => h.nightData?.steps ? parseInt(h.nightData.steps) : null);
    const prevSt = getAvg(previous, h => h.nightData?.steps ? parseInt(h.nightData.steps) : null);
    const stepsDelta = (recentSt !== null && prevSt !== null) ? Math.round(recentSt - prevSt) : null;

    const recentC = getAvg(recent, h => h.nightData?.calories ? parseFloat(h.nightData.calories) : null);
    const prevC = getAvg(previous, h => h.nightData?.calories ? parseFloat(h.nightData.calories) : null);
    const caloriesDelta = (recentC !== null && prevC !== null) ? Math.round(recentC - prevC) : null;

    return { weightDelta, sleepDelta, stepsDelta, caloriesDelta };
  }, [history, timeRange]);

  // Compute Macronutrient Ratio Split
  const macroRatio = useMemo(() => {
    if (!history || history.length === 0) return { proteinPct: 35, carbsPct: 45, fatsPct: 20, avgP: 0, avgC: 0, avgF: 0 };
    const nightLogs = history.filter(h => h.nightData && h.nightData.protein);
    if (nightLogs.length === 0) return { proteinPct: 35, carbsPct: 45, fatsPct: 20, avgP: 0, avgC: 0, avgF: 0 };

    let sumP = 0, sumC = 0, sumF = 0;
    nightLogs.slice(-14).forEach(h => {
      sumP += parseFloat(h.nightData.protein) || 0;
      sumC += parseFloat(h.nightData.carbs) || 0;
      sumF += parseFloat(h.nightData.fats) || 0;
    });

    const len = Math.min(14, nightLogs.length);
    const avgP = Math.round(sumP / len);
    const avgC = Math.round(sumC / len);
    const avgF = Math.round(sumF / len);

    const pCal = avgP * 4;
    const cCal = avgC * 4;
    const fCal = avgF * 9;
    const totalCal = Math.max(1, pCal + cCal + fCal);

    return {
      avgP, avgC, avgF,
      proteinPct: Math.round((pCal / totalCal) * 100),
      carbsPct: Math.round((cCal / totalCal) * 100),
      fatsPct: Math.round((fCal / totalCal) * 100)
    };
  }, [history]);

  // Data Export Functions
  const exportToCSV = () => {
    if (!history || history.length === 0) return;
    const headers = [
      'Date', 'Waking Weight (kg)', 'Sleep Hours', 'Sleep Quality (Self)', 'Sleep Quality (Device)',
      'Energy Level', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fats (g)', 'Steps',
      'Morning Log', 'Morning Journal', 'Night Log', 'Night Journal', 'Gym Workout', 'Anki Reviews', 'Consistent Practice'
    ];

    const rows = history.map(h => [
      h.date,
      h.morningData?.wakingWeight || '',
      h.morningData?.sleepHours || '',
      h.morningData?.sleepQualitySelf || '',
      h.morningData?.sleepQualityDevice || '',
      h.morningData?.energyLevels || '',
      h.nightData?.calories || '',
      h.nightData?.protein || '',
      h.nightData?.carbs || '',
      h.nightData?.fats || '',
      h.nightData?.steps || '',
      h.morningCompleted ? 'Done' : 'Missed',
      h.morningJournalCompleted ? 'Done' : 'Missed',
      h.nightCompleted ? 'Done' : 'Missed',
      h.nightJournalCompleted ? 'Done' : 'Missed',
      h.gymCompleted ? 'Done' : 'Missed',
      (h.ankiCompleted || h.ankiManualOverride) ? 'Done' : 'Missed',
      (h.practiceCompleted || h.practiceManualOverride) ? 'Done' : 'Missed'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `habit_armour_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (!history) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `habit_armour_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
          >
            {['7D', '14D', '30D', '90D', 'ALL'].map((range) => (
              <ToggleGroupItem key={range} value={range} className="px-3">
                {range}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="size-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToJSON}>
            <Download className="size-4" />
            JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Compliance"
          value={`${stats.complianceRate}%`}
          icon={Target}
          hint={`${streakInfo.current}d streak`}
        />
        <MetricCard
          label="Active streak"
          value={streakInfo.current}
          unit="days"
          icon={Flame}
          hint={`Best ${streakInfo.max} days`}
        />
        <MetricCard
          label="Avg waking weight"
          value={stats.avgWeight !== '-' ? stats.avgWeight : '-'}
          unit={stats.avgWeight !== '-' ? 'kg' : ''}
          icon={Scale}
          delta={trends.weightDelta !== null ? `${trends.weightDelta > 0 ? '+' : ''}${trends.weightDelta} kg` : null}
          deltaGood={parseFloat(trends.weightDelta) <= 0}
          hint="7-day average"
        />
        <MetricCard
          label="Avg sleep"
          value={stats.avgSleep}
          unit="hrs"
          icon={Moon}
          delta={trends.sleepDelta !== null ? `${trends.sleepDelta > 0 ? '+' : ''}${trends.sleepDelta}h` : null}
          deltaGood={parseFloat(trends.sleepDelta) >= 0}
          hint={`${timeRange} average`}
        />
        <MetricCard
          label="Avg steps"
          value={stats.avgSteps}
          icon={Footprints}
          delta={trends.stepsDelta !== null ? `${trends.stepsDelta > 0 ? '+' : ''}${trends.stepsDelta.toLocaleString()}` : null}
          deltaGood={trends.stepsDelta >= 0}
          hint={`${timeRange} average`}
        />
        <MetricCard
          label="Avg calories"
          value={stats.avgCalories}
          unit="kcal"
          icon={Flame}
          delta={trends.caloriesDelta !== null ? `${trends.caloriesDelta > 0 ? '+' : ''}${trends.caloriesDelta} kcal` : null}
          deltaGood={trends.caloriesDelta <= 0}
          hint={`${timeRange} average`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Energy split</CardTitle>
          <CardDescription>
            Last 14 logs — {macroRatio.avgP}g protein, {macroRatio.avgC}g carbs, {macroRatio.avgF}g fats
            per day.
          </CardDescription>
          <CardAction>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>Protein {macroRatio.proteinPct}%</span>
              <span>Carbs {macroRatio.carbsPct}%</span>
              <span>Fats {macroRatio.fatsPct}%</span>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            <div
              className="bg-chart-1"
              style={{ width: `${macroRatio.proteinPct}%` }}
              title={`Protein: ${macroRatio.proteinPct}%`}
            />
            <div
              className="bg-chart-2"
              style={{ width: `${macroRatio.carbsPct}%` }}
              title={`Carbs: ${macroRatio.carbsPct}%`}
            />
            <div
              className="bg-chart-3"
              style={{ width: `${macroRatio.fatsPct}%` }}
              title={`Fats: ${macroRatio.fatsPct}%`}
            />
          </div>
        </CardContent>
      </Card>

      {filteredHistory.length < 2 ? (
        <Card>
          <CardContent className="text-muted-foreground py-14 text-center text-sm">
            Not enough history to draw charts. Submit at least two logs.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-2">
          {/* Weight and Sleep Line Chart */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Weight &amp; sleep</CardTitle>
              <CardDescription>Waking weight against sleep duration, with your targets.</CardDescription>
              <CardAction>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} />Weight (kg)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />Sleep (hrs)
                </span>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="relative">
              {(() => {
                const pts = filteredHistory.filter(h => h.morningData);
                if (pts.length < 2) return <p className="text-muted-foreground py-14 text-center text-sm">Need more waking morning logs...</p>;
                
                const weights = pts.map(p => parseFloat(p.morningData.wakingWeight) || 0);
                const sleeps = pts.map(p => parseFloat(p.morningData.sleepHours) || 0);
                
                const targetWeight = config && config.targetWeight !== undefined ? parseFloat(config.targetWeight) : 75.0;
                
                const wMin = Math.min(...weights, targetWeight) - 0.5;
                const wMax = Math.max(...weights, targetWeight) + 0.5;
                const sMin = Math.max(0, Math.min(...sleeps) - 1);
                const sMax = Math.max(...sleeps) + 1;

                const w = 500;
                const h = 200;
                const padL = 40;
                const padR = 40;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;

                const coords = pts.map((p, i) => {
                  const x = padL + (i / Math.max(1, pts.length - 1)) * gW;
                  const wVal = parseFloat(p.morningData.wakingWeight) || 0;
                  const sVal = parseFloat(p.morningData.sleepHours) || 0;
                  const yW = padT + gH - ((wVal - wMin) / Math.max(0.1, wMax - wMin)) * gH;
                  const yS = padT + gH - ((sVal - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                  return { x, yW, yS, date: p.date.substring(5), wVal, sVal };
                });

                const pathW = getBezierPath(coords, 'yW');
                const pathS = getBezierPath(coords, 'yS');
                const areaW = getBezierAreaPath(coords, 'yW', padT + gH);
                const areaS = getBezierAreaPath(coords, 'yS', padT + gH);

                const ySleep7 = padT + gH - ((7 - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                const ySleep9 = padT + gH - ((9 - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                const yTargetWeight = padT + gH - ((targetWeight - wMin) / Math.max(0.1, wMax - wMin)) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0"/>
                      </linearGradient>
                      <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>

                    {/* Target Weight line */}
                    <line 
                      x1={padL} 
                      y1={yTargetWeight} 
                      x2={w - padR} 
                      y2={yTargetWeight} 
                      stroke="var(--chart-1)" 
                      strokeWidth="1.5" 
                      strokeDasharray="2 3" 
                      opacity="0.3"
                    />
                    <text x={padL + 10} y={yTargetWeight - 4} fill="var(--chart-1)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>Target {targetWeight} kg</text>

                    {/* Shaded Optimal Sleep Zone */}
                    {sMin <= 9 && sMax >= 7 && (
                      <>
                        <rect 
                          x={padL} 
                          y={Math.min(ySleep7, ySleep9)} 
                          width={gW} 
                          height={Math.abs(ySleep7 - ySleep9)} 
                          fill="rgba(6, 182, 212, 0.04)" 
                        />
                        <line x1={padL} y1={ySleep7} x2={w - padR} y2={ySleep7} stroke="rgba(6, 182, 212, 0.15)" strokeDasharray="2 3" />
                        <line x1={padL} y1={ySleep9} x2={w - padR} y2={ySleep9} stroke="rgba(6, 182, 212, 0.15)" strokeDasharray="2 3" />
                        <text x={padL + 10} y={Math.min(ySleep7, ySleep9) + 12} fill="rgba(6, 182, 212, 0.35)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>Optimal sleep 7–9h</text>
                      </>
                    )}

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                    })}

                    {/* Shaded Area Fades */}
                    {coords.length > 0 && (
                      <>
                        <path d={areaW} fill="url(#purpleGlow)" style={{ pointerEvents: 'none' }} />
                        <path d={areaS} fill="url(#cyanGlow)" style={{ pointerEvents: 'none' }} />
                      </>
                    )}

                    {/* Path Lines */}
                    <path d={pathW} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(168, 85, 247, 0.35))' }} />
                    <path d={pathS} fill="none" stroke="var(--chart-2)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(6, 182, 212, 0.35))' }} />

                    {/* Interactive dots */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yW} r="3.5" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="2" />
                          <circle cx={c.x} cy={c.yS} r="3.5" fill="var(--card)" stroke="var(--chart-2)" strokeWidth="2" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    {/* Y-labels Weight (left) & Sleep (right) */}
                    <text x={10} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{wMax.toFixed(1)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{wMin.toFixed(1)}</text>
                    <text x={w - 32} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{sMax.toFixed(1)}h</text>
                    <text x={w - 32} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{sMin.toFixed(1)}h</text>

                    {/* Hover sensor rects */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - gW / Math.max(1, pts.length * 2)}
                        y={padT}
                        width={gW / Math.max(1, pts.length)}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setHoveredPoint({
                            chartId: 'weight-sleep',
                            x: c.x,
                            y: Math.min(c.yW, c.yS),
                            date: pts[i].date,
                            lines: [
                              { label: 'Weight', val: `${c.wVal} kg`, color: 'var(--chart-1)' },
                              { label: 'Sleep', val: `${c.sVal} hrs`, color: 'var(--chart-2)' }
                            ]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}
              
              {hoveredPoint && hoveredPoint.chartId === 'weight-sleep' && (
                <div className={TOOLTIP_CLASS} style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="text-muted-foreground mb-1 border-b pb-1 text-xs font-medium">{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                        {l.label}:
                      </span>
                      <strong className="text-foreground">{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calories Intake Bar Chart */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Calories</CardTitle>
              <CardDescription>Daily intake against your calorie target.</CardDescription>
              <CardAction>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />Calories (kcal)
                </span>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="relative">
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted-foreground py-14 text-center text-sm">Need more evening nutrition logs...</p>;
                
                const targetCalories = config && config.targetCalories !== undefined ? parseInt(config.targetCalories, 10) : 2500;
                const calories = pts.map(p => parseFloat(p.nightData.calories) || 0);
                const maxCal = Math.max(...calories, targetCalories + 200);

                const w = 500;
                const h = 200;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;

                const barWidth = Math.max(6, Math.min(22, gW / Math.max(1, pts.length * 1.4)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.4);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.4);
                  const cVal = parseFloat(p.nightData.calories) || 0;
                  const barH = (cVal / maxCal) * gH;
                  const yBar = padT + gH - barH;
                  return { x, yBar, barH, date: p.date.substring(5), cVal };
                });

                const yTarget = padT + gH - (targetCalories / maxCal) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="barCyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yTarget} x2={w - padR} y2={yTarget} stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={w - padR - 120} y={yTarget - 4} fill="rgba(6, 182, 212, 0.45)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>Target {targetCalories} kcal</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - barWidth / 2}
                        y={c.yBar}
                        width={barWidth}
                        height={Math.max(0.1, c.barH)}
                        fill="url(#barCyanGlow)"
                        stroke="rgba(6, 182, 212, 0.5)"
                        strokeWidth="1"
                        rx="3"
                        ry="3"
                      />
                    ))}

                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={10} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{Math.round(maxCal)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">0</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.4) / 2}
                        y={padT}
                        width={barWidth * 1.4}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setHoveredPoint({
                            chartId: 'calories-only',
                            x: c.x,
                            y: c.yBar,
                            date: pts[i].date,
                            lines: [{ label: 'Calories', val: `${c.cVal} kcal`, color: 'var(--chart-2)' }]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'calories-only' && (
                <div className={TOOLTIP_CLASS} style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="text-muted-foreground mb-1 border-b pb-1 text-xs font-medium">{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                        {l.label}:
                      </span>
                      <strong className="text-foreground">{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Macronutrient Breakdown Line Chart */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Macronutrients</CardTitle>
              <CardDescription>Protein, carbs and fats logged per day.</CardDescription>
              <CardAction>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="bg-chart-1 size-2 rounded-full" />Protein
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-chart-2 size-2 rounded-full" />Carbs
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-chart-3 size-2 rounded-full" />Fats
                </span>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="relative">
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted-foreground py-14 text-center text-sm">Need more evening nutrition logs...</p>;
                
                const targetProtein = config && config.targetProtein !== undefined ? parseInt(config.targetProtein, 10) : 150;
                const proteins = pts.map(p => parseFloat(p.nightData.protein) || 0);
                const carbs = pts.map(p => parseFloat(p.nightData.carbs) || 0);
                const fats = pts.map(p => parseFloat(p.nightData.fats) || 0);
                
                const maxMacro = Math.max(...proteins, ...carbs, ...fats, targetProtein, 120);

                const w = 500;
                const h = 200;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;

                const coords = pts.map((p, i) => {
                  const x = padL + (i / Math.max(1, pts.length - 1)) * gW;
                  const pVal = parseFloat(p.nightData.protein) || 0;
                  const cVal = parseFloat(p.nightData.carbs) || 0;
                  const fVal = parseFloat(p.nightData.fats) || 0;
                  
                  const yProt = padT + gH - (pVal / maxMacro) * gH;
                  const yCarb = padT + gH - (cVal / maxMacro) * gH;
                  const yFat = padT + gH - (fVal / maxMacro) * gH;
                  
                  return { x, yProt, yCarb, yFat, date: p.date.substring(5), pVal, cVal, fVal };
                });

                const pathP = getBezierPath(coords, 'yProt');
                const pathC = getBezierPath(coords, 'yCarb');
                const pathF = getBezierPath(coords, 'yFat');
                const yTargetProtein = padT + gH - (targetProtein / maxMacro) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yTargetProtein} x2={w - padR} y2={yTargetProtein} stroke="var(--chart-1)" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.3" />
                    <text x={padL + 10} y={yTargetProtein - 4} fill="var(--chart-1)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>Target {targetProtein}g protein</text>

                    <path d={pathP} fill="none" stroke="var(--chart-1)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(168, 85, 247, 0.3))' }} />
                    <path d={pathC} fill="none" stroke="var(--chart-2)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(6, 182, 212, 0.3))' }} />
                    <path d={pathF} fill="none" stroke="var(--chart-3)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(245, 158, 11, 0.3))' }} />

                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yProt} r="3" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yCarb} r="3" fill="var(--card)" stroke="var(--chart-2)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yFat} r="3" fill="var(--card)" stroke="var(--chart-3)" strokeWidth="1.5" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    <text x={10} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{Math.round(maxMacro)}g</text>
                    <text x={10} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">0g</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - gW / Math.max(1, pts.length * 2)}
                        y={padT}
                        width={gW / Math.max(1, pts.length)}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setHoveredPoint({
                            chartId: 'macros',
                            x: c.x,
                            y: Math.min(c.yProt, c.yCarb, c.yFat),
                            date: pts[i].date,
                            lines: [
                              { label: 'Protein', val: `${c.pVal} g`, color: 'var(--chart-1)' },
                              { label: 'Carbs', val: `${c.cVal} g`, color: 'var(--chart-2)' },
                              { label: 'Fats', val: `${c.fVal} g`, color: '#f59e0b' }
                            ]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'macros' && (
                <div className={TOOLTIP_CLASS} style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="text-muted-foreground mb-1 border-b pb-1 text-xs font-medium">{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                        {l.label}:
                      </span>
                      <strong className="text-foreground">{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Steps Bar Chart */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Steps</CardTitle>
              <CardDescription>Daily step count against your goal.</CardDescription>
              <CardAction>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />Steps
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--destructive)' }} />Goal
                </span>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="relative">
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted-foreground py-14 text-center text-sm">Need more evening activity logs...</p>;
                const targetSteps = config && config.targetSteps !== undefined ? parseInt(config.targetSteps, 10) : 10000;
                const steps = pts.map(p => parseInt(p.nightData.steps) || 0);
                const maxSteps = Math.max(...steps, targetSteps + 2000);

                const w = 500;
                const h = 200;
                const padL = 45;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;
                const barWidth = Math.max(6, Math.min(22, gW / Math.max(1, pts.length * 1.4)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.4);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.4);
                  const sVal = parseInt(p.nightData.steps) || 0;
                  const barH = (sVal / maxSteps) * gH;
                  const yBar = padT + gH - barH;
                  return { x, yBar, barH, date: p.date.substring(5), sVal };
                });

                const yGoal = padT + gH - (targetSteps / maxSteps) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="barRedGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity="0.1"/>
                      </linearGradient>
                      <linearGradient id="barCyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.1"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yGoal} x2={w - padR} y2={yGoal} stroke="var(--destructive)" strokeWidth="1.5" strokeDasharray="3 3" style={{ filter: 'drop-shadow(0 0 2px var(--destructive))' }} />
                    <text x={w - padR - 110} y={yGoal - 4} fill="var(--destructive)" opacity="0.6" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>Goal {targetSteps.toLocaleString()} steps</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - barWidth / 2}
                        y={c.yBar}
                        width={barWidth}
                        height={Math.max(0.1, c.barH)}
                        fill={c.sVal >= targetSteps ? "url(#barCyanGlow)" : "url(#barRedGlow)"}
                        stroke={c.sVal >= targetSteps ? "rgba(6, 182, 212, 0.5)" : "rgba(239, 68, 68, 0.5)"}
                        strokeWidth="1"
                        rx="3"
                        ry="3"
                      />
                    ))}

                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={5} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{Math.round(maxSteps).toLocaleString()}</text>
                    <text x={5} y={yGoal + 3} fill="var(--destructive)" opacity="0.75" fontSize="8" fontWeight="600">{(targetSteps / 1000).toFixed(0)}k</text>
                    <text x={5} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">0</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.4) / 2}
                        y={padT}
                        width={barWidth * 1.4}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setHoveredPoint({
                            chartId: 'steps',
                            x: c.x,
                            y: c.yBar,
                            date: pts[i].date,
                            lines: [
                              { label: 'Steps', val: c.sVal.toLocaleString(), color: c.sVal >= targetSteps ? 'var(--chart-2)' : 'var(--destructive)' }
                            ]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'steps' && (
                <div className={TOOLTIP_CLASS} style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="text-muted-foreground mb-1 border-b pb-1 text-xs font-medium">{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                        {l.label}:
                      </span>
                      <strong className="text-foreground">{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance History Bar Chart */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
              <CardDescription>Habits completed each day.</CardDescription>
              <CardAction>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: 'var(--color-success)' }} />Completed Habits
                </span>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="relative">
              {(() => {
                const pts = filteredHistory;
                if (pts.length < 2) return <p className="text-muted-foreground py-14 text-center text-sm">Need more logs to generate compliance graph...</p>;
                
                const w = 500;
                const h = 200;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;

                const barWidth = Math.max(6, Math.min(22, gW / Math.max(1, pts.length * 1.4)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.4);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.4);
                  
                  let completed = 0;
                  let total = 4;
                  if (p.morningCompleted) completed++;
                  if (p.morningJournalCompleted) completed++;
                  if (p.nightCompleted) completed++;
                  if (p.nightJournalCompleted) completed++;
                  if (config.gymLockEnabled) {
                    total++;
                    if (p.gymCompleted) completed++;
                  }
                  if (config.ankiLockEnabled) {
                    total++;
                    if (p.ankiCompleted || p.ankiManualOverride) completed++;
                  }
                  if (config.practiceLockEnabled) {
                    total++;
                    if (p.practiceCompleted || p.practiceManualOverride) completed++;
                  }
                  
                  const score = Math.round((completed / total) * 100);
                  const barH = (completed / total) * gH;
                  const yBar = padT + gH - barH;
                  return { x, yBar, barH, date: p.date.substring(5), completed, total, score, p };
                });

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="barGreenGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0.15"/>
                      </linearGradient>
                      <linearGradient id="barPurpleGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                    })}

                    {coords.map((c, i) => {
                      let barColorUrl = "url(#barGreenGlow)";
                      let strokeColor = "rgba(16, 185, 129, 0.5)";
                      if (c.score < 60) {
                        barColorUrl = "url(#barRedGlow)";
                        strokeColor = "rgba(239, 68, 68, 0.5)";
                      } else if (c.score < 100) {
                        barColorUrl = "url(#barPurpleGlow)";
                        strokeColor = "rgba(168, 85, 247, 0.5)";
                      }

                      return (
                        <rect
                          key={i}
                          x={c.x - barWidth / 2}
                          y={c.yBar}
                          width={barWidth}
                          height={Math.max(0.1, c.barH)}
                          fill={barColorUrl}
                          stroke={strokeColor}
                          strokeWidth="1"
                          rx="3"
                          ry="3"
                        />
                      );
                    })}

                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={10} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">100%</text>
                    <text x={10} y={padT + gH / 2 + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">50%</text>
                    <text x={10} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">0%</text>

                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.4) / 2}
                        y={padT}
                        width={barWidth * 1.4}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          const isAnkiDone = c.p.ankiCompleted || c.p.ankiManualOverride;
                          const lines = [
                            { label: 'Morning Log', val: c.p.morningCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningCompleted ? 'var(--color-success)' : 'var(--destructive)' },
                            { label: 'Morning Journal', val: c.p.morningJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningJournalCompleted ? 'var(--color-success)' : 'var(--destructive)' },
                            { label: 'Evening Log', val: c.p.nightCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightCompleted ? 'var(--color-success)' : 'var(--destructive)' },
                            { label: 'Evening Journal', val: c.p.nightJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightJournalCompleted ? 'var(--color-success)' : 'var(--destructive)' }
                          ];
                          if (config.gymLockEnabled) {
                            lines.push({ label: 'Gym Workout', val: c.p.gymCompleted ? '✅ Done' : '❌ Missed', color: c.p.gymCompleted ? 'var(--color-success)' : 'var(--destructive)' });
                          }
                          if (config.ankiLockEnabled) {
                            lines.push({ label: 'Anki Reviews', val: isAnkiDone ? '✅ Done' : '❌ Missed', color: isAnkiDone ? 'var(--color-success)' : 'var(--destructive)' });
                          }
                          const isPracticeDone = c.p.practiceCompleted || c.p.practiceManualOverride;
                          if (config.practiceLockEnabled) {
                            lines.push({ label: 'Consistent Practice', val: isPracticeDone ? '✅ Done' : '❌ Missed', color: isPracticeDone ? 'var(--color-success)' : 'var(--destructive)' });
                          }
                          setHoveredPoint({
                            chartId: 'compliance',
                            x: c.x,
                            y: c.yBar,
                            date: `${c.p.date} (${c.completed}/${c.total} completed)`,
                            lines
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'compliance' && (
                <div className={TOOLTIP_CLASS} style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="text-muted-foreground mb-1 border-b pb-1 text-xs font-medium">{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        {l.label}:
                      </span>
                      <strong style={{ color: l.color }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weekly Body Specs & Measurements Section */}
      {(() => {
        const weeklyLogs = [...history]
          .filter(h => h.weeklyData && (h.weeklyData.weekCommencing || h.weeklyData.startWeight))
          .sort((a, b) => new Date(a.weeklyData?.weekCommencing || a.date) - new Date(b.weeklyData?.weekCommencing || b.date));

        const latestWeekly = weeklyLogs.length > 0 ? weeklyLogs[weeklyLogs.length - 1].weeklyData : null;

        const specLabels = {
          umbilical: 'Waist (Umbilical)',
          bicepL: 'Bicep (Left)',
          quadL: 'Quad (Left)',
          glutes: 'Glutes',
          chest: 'Chest',
          startWeight: 'Start Weight'
        };

        return (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Ruler className="text-primary size-5" />
                  Weekly body specs
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Composition, circumference changes and response notes.
                </p>
              </div>

              <ToggleGroup
                type="single"
                variant="outline"
                value={activeSpecKey}
                onValueChange={(v) => v && setActiveSpecKey(v)}
              >
                {Object.keys(specLabels).map((key) => (
                  <ToggleGroupItem key={key} value={key} className="px-3">
                    {specLabels[key]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Weekly Spec Line Chart */}
            {weeklyLogs.length >= 2 && (
              <Card className="relative">
                <CardHeader>
                  <CardTitle>
                    {specLabels[activeSpecKey]} over time
                  </CardTitle>
                  <CardAction>
                    <span className="text-muted-foreground text-xs">
                      {weeklyLogs.length} check-ins
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent className="relative">
                  {(() => {
                    const validPts = weeklyLogs.filter(w => w.weeklyData && w.weeklyData[activeSpecKey]);
                    if (validPts.length < 2) return <p className="text-muted-foreground py-8 text-center text-sm">Log at least 2 weekly check-ins with {specLabels[activeSpecKey]} data to render trend line...</p>;

                    const vals = validPts.map(w => parseFloat(w.weeklyData[activeSpecKey]) || 0);
                    const vMin = Math.min(...vals) - 1;
                    const vMax = Math.max(...vals) + 1;

                    const w = 500;
                    const h = 160;
                    const padL = 40;
                    const padR = 20;
                    const padT = 20;
                    const padB = 30;
                    const gW = w - padL - padR;
                    const gH = h - padT - padB;

                    const coords = validPts.map((wLog, i) => {
                      const x = padL + (i / Math.max(1, validPts.length - 1)) * gW;
                      const val = parseFloat(wLog.weeklyData[activeSpecKey]) || 0;
                      const y = padT + gH - ((val - vMin) / Math.max(0.1, vMax - vMin)) * gH;
                      return { x, y, val, date: wLog.weeklyData.weekCommencing || wLog.date };
                    });

                    const path = getBezierPath(coords, 'y');
                    const area = getBezierAreaPath(coords, 'y', padT + gH);

                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="purpleSpecGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>

                        {[0, 1, 2, 3].map(idx => {
                          const y = padT + (idx / 3) * gH;
                          return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border)" strokeWidth="1" />;
                        })}

                        <path d={area} fill="url(#purpleSpecGlow)" style={{ pointerEvents: 'none' }} />
                        <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(168, 85, 247, 0.35))' }} />

                        {coords.map((c, i) => (
                          <g key={i}>
                            <circle cx={c.x} cy={c.y} r="4" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="2" />
                            <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">{c.date.substring(5)}</text>
                            <text x={c.x} y={c.y - 8} textAnchor="middle" fill="var(--foreground)" fontSize="8" fontWeight="700">{c.val}</text>
                          </g>
                        ))}

                        <text x={10} y={padT + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{vMax.toFixed(1)}</text>
                        <text x={10} y={padT + gH + 5} fill="var(--muted-foreground)" fontSize="8" fontWeight="600">{vMin.toFixed(1)}</text>
                      </svg>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {latestWeekly && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard
                  label="Start weight"
                  value={latestWeekly.startWeight || '-'}
                  unit={latestWeekly.startWeight ? 'kg' : ''}
                  icon={Scale}
                  hint={`w/c ${latestWeekly.weekCommencing || 'latest'}`}
                />
                <MetricCard
                  label="Waist"
                  value={latestWeekly.umbilical || '-'}
                  unit={latestWeekly.umbilical ? 'cm' : ''}
                  icon={Ruler}
                  hint="Umbilical"
                />
                <MetricCard
                  label="Biceps L / R"
                  value={
                    latestWeekly.bicepL || latestWeekly.bicepR
                      ? `${latestWeekly.bicepL || '-'}/${latestWeekly.bicepR || '-'}`
                      : '-'
                  }
                  unit={latestWeekly.bicepL || latestWeekly.bicepR ? 'cm' : ''}
                  icon={Ruler}
                  hint="Latest check-in"
                />
                <MetricCard
                  label="Quads L / R"
                  value={
                    latestWeekly.quadL || latestWeekly.quadR
                      ? `${latestWeekly.quadL || '-'}/${latestWeekly.quadR || '-'}`
                      : '-'
                  }
                  unit={latestWeekly.quadL || latestWeekly.quadR ? 'cm' : ''}
                  icon={Ruler}
                  hint="Latest check-in"
                />
                <MetricCard
                  label="Glutes / chest"
                  value={`${latestWeekly.glutes || '-'} / ${latestWeekly.chest || '-'}`}
                  unit="cm"
                  icon={Ruler}
                  hint="Latest check-in"
                />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Check-in history</CardTitle>
                <CardAction>
                  <Badge variant="outline">{weeklyLogs.length}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                {weeklyLogs.length < 1 ? (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    No weekly specs recorded yet. Submit one from the weekly check-in tab.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Waist</TableHead>
                        <TableHead>Biceps</TableHead>
                        <TableHead>Quads</TableHead>
                        <TableHead>Glutes</TableHead>
                        <TableHead>Chest</TableHead>
                        <TableHead>Photos</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...weeklyLogs].reverse().map((wLog, i) => {
                        const w = wLog.weeklyData;
                        const poses = ['front', 'back', 'sideLeft', 'sideRight', 'side'].filter(
                          (pose) => w.photos?.[pose]
                        );
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {w.weekCommencing || wLog.date}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.startWeight ? `${w.startWeight} kg` : '-'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.umbilical ? `${w.umbilical} cm` : '-'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.bicepL || w.bicepR ? `${w.bicepL || '-'}/${w.bicepR || '-'}` : '-'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.quadL || w.quadR ? `${w.quadL || '-'}/${w.quadR || '-'}` : '-'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.glutes ? `${w.glutes} cm` : '-'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {w.chest ? `${w.chest} cm` : '-'}
                            </TableCell>
                            <TableCell>
                              {poses.length > 0 ? (
                                <div className="flex gap-1.5">
                                  {poses.map((pose) => (
                                    <a
                                      key={pose}
                                      href={w.photos[pose]}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={`${pose} pose`}
                                    >
                                      <img
                                        src={w.photos[pose]}
                                        alt={pose}
                                        className="size-9 rounded border object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-45 italic">
                              {w.responseAction || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
