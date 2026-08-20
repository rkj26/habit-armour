import React, { useState, useMemo } from 'react';

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
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 50,
    pointerEvents: 'none',
    minWidth: '135px'
  };
};

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
    <div className="dashboard-container" style={{ padding: '4px' }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Bio-Analytics Dashboard</h2>
          <p>Real-time aggregated health statistics and visual trend lines.</p>
        </div>

        {/* Global Dashboard Control Bar */}
        <div className="dashboard-controls-bar" style={{ margin: 0 }}>
          <div className="time-range-group">
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 6px', fontWeight: 700 }}>Range:</span>
            {['7D', '14D', '30D', '90D', 'ALL'].map(range => (
              <button
                key={range}
                className={`btn-time-range ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-export" onClick={exportToCSV} title="Export history to CSV spreadsheet">
              📥 Export CSV
            </button>
            <button className="btn-export" onClick={exportToJSON} title="Backup full log history to JSON">
              💾 Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Glassmorphic Metric Cards (5 Cards) */}
      <div className="dashboard-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '16px',
        margin: '20px 0 32px 0'
      }}>
        {/* Compliance Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--color-success)',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Compliance Rate</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.complianceRate}%</div>
            <div className="trend-badge trend-badge-up">
              <span>🔥 {streakInfo.current}d streak</span>
            </div>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--color-success)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)'
          }}>🎯</div>
        </div>

        {/* Active Streak Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--color-danger)',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Active Streak</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{streakInfo.current} Days</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Best record: {streakInfo.max} days</span>
          </div>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
          }}>🔥</div>
        </div>

        {/* Avg Waking Weight Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--color-accent)',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Waking Weight</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {stats.avgWeight !== '-' ? `${stats.avgWeight} kg` : '-'}
            </div>
            {trends.weightDelta !== null ? (
              <div className={`trend-badge ${parseFloat(trends.weightDelta) <= 0 ? 'trend-badge-up' : 'trend-badge-down'}`}>
                {parseFloat(trends.weightDelta) >= 0 ? `↑ +${trends.weightDelta} kg` : `↓ ${trends.weightDelta} kg`} vs prev
              </div>
            ) : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>7-day average</span>}
          </div>
          <div style={{
            background: 'rgba(168, 85, 247, 0.1)',
            color: 'var(--color-accent)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.15)'
          }}>⚖️</div>
        </div>

        {/* Sleep Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--accent-cyan, #06b6d4)',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Sleep Duration</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgSleep} hrs</div>
            {trends.sleepDelta !== null ? (
              <div className={`trend-badge ${parseFloat(trends.sleepDelta) >= 0 ? 'trend-badge-up' : 'trend-badge-down'}`}>
                {parseFloat(trends.sleepDelta) >= 0 ? `↑ +${trends.sleepDelta}h` : `↓ ${trends.sleepDelta}h`} vs prev
              </div>
            ) : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{timeRange} average</span>}
          </div>
          <div style={{
            background: 'rgba(6, 182, 212, 0.1)',
            color: 'var(--accent-cyan, #06b6d4)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)'
          }}>😴</div>
        </div>

        {/* Steps Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--color-accent)',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Daily Steps</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgSteps}</div>
            {trends.stepsDelta !== null ? (
              <div className={`trend-badge ${trends.stepsDelta >= 0 ? 'trend-badge-up' : 'trend-badge-down'}`}>
                {trends.stepsDelta >= 0 ? `↑ +${trends.stepsDelta.toLocaleString()}` : `↓ ${trends.stepsDelta.toLocaleString()}`} vs prev
              </div>
            ) : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{timeRange} average</span>}
          </div>
          <div style={{
            background: 'rgba(168, 85, 247, 0.1)',
            color: 'var(--color-accent)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.15)'
          }}>👟</div>
        </div>

        {/* Calories Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid #f59e0b',
          padding: '20px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Calories Intake</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgCalories} <span style={{ fontSize: '1rem', fontWeight: 600 }}>kcal</span></div>
            {trends.caloriesDelta !== null ? (
              <div className={`trend-badge ${trends.caloriesDelta <= 0 ? 'trend-badge-up' : 'trend-badge-neutral'}`}>
                {trends.caloriesDelta >= 0 ? `↑ +${trends.caloriesDelta} kcal` : `↓ ${trends.caloriesDelta} kcal`} vs prev
              </div>
            ) : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{timeRange} average</span>}
          </div>
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.4rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.15)'
          }}>🔥</div>
        </div>
      </div>

      {/* Macronutrient Split Ratio Banner */}
      <div className="glass-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        padding: '18px 24px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🥑 Macronutrient Energy Split Ratio (Last 14 Logs)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Avg Daily Intake: <strong>{macroRatio.avgP}g Protein</strong> | <strong>{macroRatio.avgC}g Carbs</strong> | <strong>{macroRatio.avgF}g Fats</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--color-accent)' }}>● Protein {macroRatio.proteinPct}%</span>
            <span style={{ color: 'var(--accent-cyan)' }}>● Carbs {macroRatio.carbsPct}%</span>
            <span style={{ color: '#f59e0b' }}>● Fats {macroRatio.fatsPct}%</span>
          </div>
        </div>

        <div className="macro-ratio-bar">
          <div className="macro-ratio-segment" style={{ width: `${macroRatio.proteinPct}%`, background: 'var(--color-accent)' }} title={`Protein: ${macroRatio.proteinPct}%`} />
          <div className="macro-ratio-segment" style={{ width: `${macroRatio.carbsPct}%`, background: 'var(--accent-cyan)' }} title={`Carbs: ${macroRatio.carbsPct}%`} />
          <div className="macro-ratio-segment" style={{ width: `${macroRatio.fatsPct}%`, background: '#f59e0b' }} title={`Fats: ${macroRatio.fatsPct}%`} />
        </div>
      </div>

      {filteredHistory.length < 2 ? (
        <div className="glass-card no-history" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
          <p className="text-muted" style={{ margin: 0, fontSize: '1rem' }}>Insufficient history logs to generate graphs. Submit at least 2 logs to see charts.</p>
        </div>
      ) : (
        <div className="charts-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: '24px'
        }}>
          {/* Weight and Sleep Line Chart */}
          <div className="chart-card glass-card" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Weight & Sleep Trend ({timeRange})</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--color-accent)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Weight (kg)
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Sleep (hrs)
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = filteredHistory.filter(h => h.morningData);
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more waking morning logs...</p>;
                
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
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0"/>
                      </linearGradient>
                      <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>

                    {/* Target Weight line */}
                    <line 
                      x1={padL} 
                      y1={yTargetWeight} 
                      x2={w - padR} 
                      y2={yTargetWeight} 
                      stroke="var(--color-accent)" 
                      strokeWidth="1.5" 
                      strokeDasharray="2 3" 
                      opacity="0.3"
                    />
                    <text x={padL + 10} y={yTargetWeight - 4} fill="var(--color-accent)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET WEIGHT ({targetWeight}KG)</text>

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
                        <text x={padL + 10} y={Math.min(ySleep7, ySleep9) + 12} fill="rgba(6, 182, 212, 0.35)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>OPTIMAL SLEEP ZONE (7-9H)</text>
                      </>
                    )}

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
                    })}

                    {/* Shaded Area Fades */}
                    {coords.length > 0 && (
                      <>
                        <path d={areaW} fill="url(#purpleGlow)" style={{ pointerEvents: 'none' }} />
                        <path d={areaS} fill="url(#cyanGlow)" style={{ pointerEvents: 'none' }} />
                      </>
                    )}

                    {/* Path Lines */}
                    <path d={pathW} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(168, 85, 247, 0.35))' }} />
                    <path d={pathS} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(6, 182, 212, 0.35))' }} />

                    {/* Interactive dots */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yW} r="3.5" fill="var(--bg-surface)" stroke="var(--color-accent)" strokeWidth="2" />
                          <circle cx={c.x} cy={c.yS} r="3.5" fill="var(--bg-surface)" stroke="var(--accent-cyan)" strokeWidth="2" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    {/* Y-labels Weight (left) & Sleep (right) */}
                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{wMax.toFixed(1)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{wMin.toFixed(1)}</text>
                    <text x={w - 32} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{sMax.toFixed(1)}h</text>
                    <text x={w - 32} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{sMin.toFixed(1)}h</text>

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
                              { label: 'Weight', val: `${c.wVal} kg`, color: 'var(--color-accent)' },
                              { label: 'Sleep', val: `${c.sVal} hrs`, color: 'var(--accent-cyan)' }
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
                <div style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', margin: '2px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <span className="legend-color" style={{ background: l.color, width: '6px', height: '6px', borderRadius: '50%' }}></span>
                        {l.label}:
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calories Intake Bar Chart */}
          <div className="chart-card glass-card" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Calories Intake ({timeRange})</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Calories (kcal)
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more evening nutrition logs...</p>;
                
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
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yTarget} x2={w - padR} y2={yTarget} stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={w - padR - 120} y={yTarget - 4} fill="rgba(6, 182, 212, 0.45)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET CALORIES ({targetCalories} KCAL)</text>

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
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxCal)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0</text>

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
                            lines: [{ label: 'Calories', val: `${c.cVal} kcal`, color: 'var(--accent-cyan)' }]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'calories-only' && (
                <div style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', margin: '2px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <span className="legend-color" style={{ background: l.color, width: '6px', height: '6px', borderRadius: '50%' }}></span>
                        {l.label}:
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Macronutrient Breakdown Line Chart */}
          <div className="chart-card glass-card" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Macronutrient Breakdown</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="legend-color" style={{background: 'var(--color-accent)', width: '8px', height: '8px', borderRadius: '50%'}}></span>Protein
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="legend-color" style={{background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%'}}></span>Carbs
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="legend-color" style={{background: '#f59e0b', width: '8px', height: '8px', borderRadius: '50%'}}></span>Fats
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more evening nutrition logs...</p>;
                
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
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yTargetProtein} x2={w - padR} y2={yTargetProtein} stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.3" />
                    <text x={padL + 10} y={yTargetProtein - 4} fill="var(--color-accent)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET PROTEIN ({targetProtein}G)</text>

                    <path d={pathP} fill="none" stroke="var(--color-accent)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(168, 85, 247, 0.3))' }} />
                    <path d={pathC} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(6, 182, 212, 0.3))' }} />
                    <path d={pathF} fill="none" stroke="var(--color-warning)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(245, 158, 11, 0.3))' }} />

                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 10 || i % Math.ceil(coords.length / 8) === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yProt} r="3" fill="var(--bg-surface)" stroke="var(--color-accent)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yCarb} r="3" fill="var(--bg-surface)" stroke="var(--accent-cyan)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yFat} r="3" fill="var(--bg-surface)" stroke="var(--color-warning)" strokeWidth="1.5" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxMacro)}g</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0g</text>

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
                              { label: 'Protein', val: `${c.pVal} g`, color: 'var(--color-accent)' },
                              { label: 'Carbs', val: `${c.cVal} g`, color: 'var(--accent-cyan)' },
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
                <div style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', margin: '2px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <span className="legend-color" style={{ background: l.color, width: '6px', height: '6px', borderRadius: '50%' }}></span>
                        {l.label}:
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Steps Bar Chart */}
          <div className="chart-card glass-card" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Daily Steps ({timeRange})</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Steps
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--color-danger)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Goal
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = filteredHistory.filter(h => h.nightData);
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more evening activity logs...</p>;
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
                        <stop offset="0%" stopColor="var(--color-danger)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--color-danger)" stopOpacity="0.1"/>
                      </linearGradient>
                      <linearGradient id="barCyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.1"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
                    })}

                    <line x1={padL} y1={yGoal} x2={w - padR} y2={yGoal} stroke="var(--color-danger)" strokeWidth="1.5" strokeDasharray="3 3" style={{ filter: 'drop-shadow(0 0 2px var(--color-danger))' }} />
                    <text x={w - padR - 110} y={yGoal - 4} fill="var(--color-danger)" opacity="0.6" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>DAILY STEP GOAL ({targetSteps.toLocaleString()})</text>

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
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={5} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxSteps).toLocaleString()}</text>
                    <text x={5} y={yGoal + 3} fill="var(--color-danger)" opacity="0.75" fontSize="8" fontWeight="600">{(targetSteps / 1000).toFixed(0)}k</text>
                    <text x={5} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0</text>

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
                              { label: 'Steps', val: c.sVal.toLocaleString(), color: c.sVal >= targetSteps ? 'var(--accent-cyan)' : 'var(--color-danger)' }
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
                <div style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', margin: '2px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <span className="legend-color" style={{ background: l.color, width: '6px', height: '6px', borderRadius: '50%' }}></span>
                        {l.label}:
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Compliance History Bar Chart */}
          <div className="chart-card glass-card" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Habit Compliance History</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--color-success)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Completed Habits
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = filteredHistory;
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more logs to generate compliance graph...</p>;
                
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
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
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
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">100%</text>
                    <text x={10} y={padT + gH / 2 + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">50%</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0%</text>

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
                            { label: 'Morning Log', val: c.p.morningCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningCompleted ? 'var(--color-success)' : 'var(--color-danger)' },
                            { label: 'Morning Journal', val: c.p.morningJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningJournalCompleted ? 'var(--color-success)' : 'var(--color-danger)' },
                            { label: 'Evening Log', val: c.p.nightCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightCompleted ? 'var(--color-success)' : 'var(--color-danger)' },
                            { label: 'Evening Journal', val: c.p.nightJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightJournalCompleted ? 'var(--color-success)' : 'var(--color-danger)' }
                          ];
                          if (config.gymLockEnabled) {
                            lines.push({ label: 'Gym Workout', val: c.p.gymCompleted ? '✅ Done' : '❌ Missed', color: c.p.gymCompleted ? 'var(--color-success)' : 'var(--color-danger)' });
                          }
                          if (config.ankiLockEnabled) {
                            lines.push({ label: 'Anki Reviews', val: isAnkiDone ? '✅ Done' : '❌ Missed', color: isAnkiDone ? 'var(--color-success)' : 'var(--color-danger)' });
                          }
                          const isPracticeDone = c.p.practiceCompleted || c.p.practiceManualOverride;
                          if (config.practiceLockEnabled) {
                            lines.push({ label: 'Consistent Practice', val: isPracticeDone ? '✅ Done' : '❌ Missed', color: isPracticeDone ? 'var(--color-success)' : 'var(--color-danger)' });
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
                <div style={getSmartTooltipStyle(hoveredPoint)}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
                  {hoveredPoint.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', margin: '2px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        {l.label}:
                      </span>
                      <strong style={{ color: l.color }}>{l.val}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          <div style={{ marginTop: '36px' }}>
            <div className="section-title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📐 Weekly Body Specs & Circumference Trends
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Track weekly body composition, circumference changes, and trainer response notes.
                </p>
              </div>

              {/* Spec Metric Toggle Buttons */}
              <div className="time-range-group">
                {Object.keys(specLabels).map(key => (
                  <button
                    key={key}
                    className={`btn-time-range ${activeSpecKey === key ? 'active' : ''}`}
                    onClick={() => setActiveSpecKey(key)}
                  >
                    {specLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly Spec Line Chart */}
            {weeklyLogs.length >= 2 && (
              <div className="chart-card glass-card" style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                padding: '20px 24px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '24px',
                position: 'relative'
              }}>
                <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                    📊 {specLabels[activeSpecKey]} Progression Over Weeks
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {weeklyLogs.length} historical check-ins
                  </span>
                </div>

                <div className="svg-chart-container" style={{ position: 'relative' }}>
                  {(() => {
                    const validPts = weeklyLogs.filter(w => w.weeklyData && w.weeklyData[activeSpecKey]);
                    if (validPts.length < 2) return <p className="text-muted text-center" style={{ padding: '30px 0' }}>Log at least 2 weekly check-ins with {specLabels[activeSpecKey]} data to render trend line...</p>;

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
                            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>

                        {[0, 1, 2, 3].map(idx => {
                          const y = padT + (idx / 3) * gH;
                          return <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />;
                        })}

                        <path d={area} fill="url(#purpleSpecGlow)" style={{ pointerEvents: 'none' }} />
                        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(168, 85, 247, 0.35))' }} />

                        {coords.map((c, i) => (
                          <g key={i}>
                            <circle cx={c.x} cy={c.y} r="4" fill="var(--bg-surface)" stroke="var(--color-accent)" strokeWidth="2" />
                            <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date.substring(5)}</text>
                            <text x={c.x} y={c.y - 8} textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontWeight="700">{c.val}</text>
                          </g>
                        ))}

                        <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{vMax.toFixed(1)}</text>
                        <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{vMin.toFixed(1)}</text>
                      </svg>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Quick Metrics Grid for Latest Weekly Check-in */}
            {latestWeekly && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '14px',
                marginBottom: '24px'
              }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '4px solid #a855f7', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Start Weight</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{latestWeekly.startWeight ? `${latestWeekly.startWeight} kg` : '-'}</div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>w/c {latestWeekly.weekCommencing || 'latest'}</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '4px solid #3b82f6', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Waist (Umbilical)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{latestWeekly.umbilical ? `${latestWeekly.umbilical} cm` : '-'}</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '4px solid #10b981', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Biceps (L / R)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {latestWeekly.bicepL || latestWeekly.bicepR ? `${latestWeekly.bicepL || '-'}/${latestWeekly.bicepR || '-'} cm` : '-'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Quads (L / R)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {latestWeekly.quadL || latestWeekly.quadR ? `${latestWeekly.quadL || '-'}/${latestWeekly.quadR || '-'} cm` : '-'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderLeft: '4px solid #ec4899', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Glutes & Chest</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    G: {latestWeekly.glutes || '-'} | C: {latestWeekly.chest || '-'} cm
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Log Table */}
            <div className="chart-card glass-card" style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Weekly Check-in History ({weeklyLogs.length})</h4>
              </div>

              {weeklyLogs.length < 1 ? (
                <p className="text-muted text-center py-10" style={{ padding: '30px 0', margin: 0 }}>
                  No weekly specs recorded yet. Submit your weekly check-in via the <strong>Weekly Specs</strong> tab.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Week Commencing</th>
                        <th style={{ padding: '10px' }}>Start Weight</th>
                        <th style={{ padding: '10px' }}>Umbilical (Waist)</th>
                        <th style={{ padding: '10px' }}>Biceps (L / R)</th>
                        <th style={{ padding: '10px' }}>Quads (L / R)</th>
                        <th style={{ padding: '10px' }}>Glutes</th>
                        <th style={{ padding: '10px' }}>Chest</th>
                        <th style={{ padding: '10px' }}>Progress Photos</th>
                        <th style={{ padding: '10px' }}>Response Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...weeklyLogs].reverse().map((wLog, i) => {
                        const w = wLog.weeklyData;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                            <td style={{ padding: '10px', fontWeight: 600 }}>{w.weekCommencing || wLog.date}</td>
                            <td style={{ padding: '10px' }}>{w.startWeight ? `${w.startWeight} kg` : '-'}</td>
                            <td style={{ padding: '10px' }}>{w.umbilical ? `${w.umbilical} cm` : '-'}</td>
                            <td style={{ padding: '10px' }}>{w.bicepL || w.bicepR ? `${w.bicepL || '-'}/${w.bicepR || '-'} cm` : '-'}</td>
                            <td style={{ padding: '10px' }}>{w.quadL || w.quadR ? `${w.quadL || '-'}/${w.quadR || '-'} cm` : '-'}</td>
                            <td style={{ padding: '10px' }}>{w.glutes ? `${w.glutes} cm` : '-'}</td>
                            <td style={{ padding: '10px' }}>{w.chest ? `${w.chest} cm` : '-'}</td>
                            <td style={{ padding: '10px' }}>
                              {w.photos && (w.photos.front || w.photos.back || w.photos.sideLeft || w.photos.sideRight || w.photos.side) ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {['front', 'back', 'sideLeft', 'sideRight', 'side'].map(p => w.photos[p] ? (
                                    <a key={p} href={w.photos[p]} target="_blank" rel="noreferrer" title={`${p} pose`}>
                                      <img src={w.photos[p]} alt={p} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                    </a>
                                  ) : null)}
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>None</span>}
                            </td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '180px' }}>{w.responseAction || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
