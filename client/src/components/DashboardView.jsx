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

export default function DashboardView({ stats, history, config }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  return (
    <div className="dashboard-container" style={{ padding: '4px' }}>
      <div className="section-title">
        <h2>Bio-Analytics Dashboard</h2>
        <p>Real-time aggregated health statistics and visual trend lines.</p>
      </div>

      {/* Grid of Glassmorphic Metric Cards */}
      <div className="dashboard-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Compliance Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderLeft: '4px solid var(--accent-green, #10b981)',
          padding: '24px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Compliance Rate</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.complianceRate}%</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>morning & evening completion</span>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--accent-green, #10b981)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.5rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)'
          }}>🎯</div>
        </div>

        {/* Sleep Card */}
        <div className="metric-card" style={{
          position: 'relative',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderLeft: '4px solid var(--accent-cyan, #06b6d4)',
          padding: '24px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Sleep Duration</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgSleep} hrs</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>last 7 logs average</span>
          </div>
          <div style={{
            background: 'rgba(6, 182, 212, 0.1)',
            color: 'var(--accent-cyan, #06b6d4)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.5rem',
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
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderLeft: '4px solid var(--accent-purple, #a855f7)',
          padding: '24px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Daily Steps</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgSteps}</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>last 7 logs average</span>
          </div>
          <div style={{
            background: 'rgba(168, 85, 247, 0.1)',
            color: 'var(--accent-purple, #a855f7)',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.5rem',
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
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderLeft: '4px solid #f59e0b',
          padding: '24px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Avg Calories Intake</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.avgCalories} kcal</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>last 7 logs average</span>
          </div>
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            padding: '12px',
            borderRadius: '50%',
            fontSize: '1.5rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.15)'
          }}>🔥</div>
        </div>
      </div>

      {history.length < 2 ? (
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
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Weight & Sleep Trend</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-purple)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Weight (kg)
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Sleep (hrs)
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = [...history].reverse().filter(h => h.morningData).slice(-14);
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
                  const x = padL + (i / (pts.length - 1)) * gW;
                  const wVal = parseFloat(p.morningData.wakingWeight) || 0;
                  const sVal = parseFloat(p.morningData.sleepHours) || 0;
                  const yW = padT + gH - ((wVal - wMin) / Math.max(0.1, wMax - wMin)) * gH;
                  const yS = padT + gH - ((sVal - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                  return { x, yW, yS, date: p.date.substring(5), wVal, sVal };
                });

                // Smooth Bezier Curve paths
                const pathW = getBezierPath(coords, 'yW');
                const pathS = getBezierPath(coords, 'yS');
                const areaW = getBezierAreaPath(coords, 'yW', padT + gH);
                const areaS = getBezierAreaPath(coords, 'yS', padT + gH);

                // Compute Y coords for Sleep Target Zone (7-9 hrs)
                const ySleep7 = padT + gH - ((7 - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                const ySleep9 = padT + gH - ((9 - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                const yTargetWeight = padT + gH - ((targetWeight - wMin) / Math.max(0.1, wMax - wMin)) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0.0"/>
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
                      stroke="var(--accent-purple)" 
                      strokeWidth="1.5" 
                      strokeDasharray="2 3" 
                      opacity="0.3"
                    />
                    <text x={padL + 10} y={yTargetWeight - 4} fill="var(--accent-purple)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET WEIGHT ({targetWeight}KG)</text>

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
                        <line 
                          x1={padL} 
                          y1={ySleep7} 
                          x2={w - padR} 
                          y2={ySleep7} 
                          stroke="rgba(6, 182, 212, 0.15)" 
                          strokeDasharray="2 3" 
                        />
                        <line 
                          x1={padL} 
                          y1={ySleep9} 
                          x2={w - padR} 
                          y2={ySleep9} 
                          stroke="rgba(6, 182, 212, 0.15)" 
                          strokeDasharray="2 3" 
                        />
                        <text x={padL + 10} y={Math.min(ySleep7, ySleep9) + 12} fill="rgba(6, 182, 212, 0.35)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>OPTIMAL SLEEP ZONE (7-9H)</text>
                      </>
                    )}

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return (
                        <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                      );
                    })}

                    {/* Shaded Area Fades */}
                    {coords.length > 0 && (
                      <>
                        <path d={areaW} fill="url(#purpleGlow)" style={{ pointerEvents: 'none' }} />
                        <path d={areaS} fill="url(#cyanGlow)" style={{ pointerEvents: 'none' }} />
                      </>
                    )}

                    {/* Glow-filtered Path Lines */}
                    <path d={pathW} fill="none" stroke="var(--accent-purple)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(168, 85, 247, 0.35))' }} />
                    <path d={pathS} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0px 3px 6px rgba(6, 182, 212, 0.35))' }} />

                    {/* Interactive dots and grid ticks */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 7 || i % 2 === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yW} r="3.5" fill="var(--bg-surface)" stroke="var(--accent-purple)" strokeWidth="2" />
                          <circle cx={c.x} cy={c.yS} r="3.5" fill="var(--bg-surface)" stroke="var(--accent-cyan)" strokeWidth="2" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    {/* Grid y-labels for Weight (left) */}
                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{wMax.toFixed(1)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{wMin.toFixed(1)}</text>

                    {/* Grid y-labels for Sleep (right) */}
                    <text x={w - 32} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{sMax.toFixed(1)}h</text>
                    <text x={w - 32} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{sMin.toFixed(1)}h</text>

                    {/* Hover sensor rects */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - gW / (pts.length * 2)}
                        y={padT}
                        width={gW / pts.length}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          setHoveredPoint({
                            chartId: 'weight-sleep',
                            x: c.x,
                            y: Math.min(c.yW, c.yS),
                            date: pts[i].date,
                            lines: [
                              { label: 'Weight', val: `${c.wVal} kg`, color: 'var(--accent-purple)' },
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
              
              {/* Floating Tooltip */}
              {hoveredPoint && hoveredPoint.chartId === 'weight-sleep' && (
                <div className="tooltip-overlay" style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x - 75}px`,
                  top: `${hoveredPoint.y - 85}px`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '135px'
                }}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
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
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Calories Intake</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Calories (kcal)
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = [...history].reverse().filter(h => h.nightData).slice(-14);
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

                const barWidth = Math.max(12, Math.min(24, gW / Math.max(1, pts.length * 1.5)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.5);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.5);
                  const cVal = parseFloat(p.nightData.calories) || 0;
                  const barH = (cVal / maxCal) * gH;
                  const yBar = padT + gH - barH;
                  return { x, yBar, barH, date: p.date.substring(5), cVal };
                });

                // Target calories baseline
                const yTarget = padT + gH - (targetCalories / maxCal) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="barCyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return (
                        <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                      );
                    })}

                    {/* Target baseline */}
                    <line x1={padL} y1={yTarget} x2={w - padR} y2={yTarget} stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={w - padR - 120} y={yTarget - 4} fill="rgba(6, 182, 212, 0.45)" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET CALORIES ({targetCalories} KCAL)</text>

                    {/* Gradient filled bars with rounded tops */}
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

                    {/* Labels & Ticks */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 7 || i % 2 === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    {/* Grid labels */}
                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxCal)}</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0</text>

                    {/* Hover sensor rects */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.5) / 2}
                        y={padT}
                        width={barWidth * 1.5}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          setHoveredPoint({
                            chartId: 'calories-only',
                            x: c.x,
                            y: c.yBar,
                            date: pts[i].date,
                            lines: [
                              { label: 'Calories', val: `${c.cVal} kcal`, color: 'var(--accent-cyan)' }
                            ]
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>
                );
              })()}

              {hoveredPoint && hoveredPoint.chartId === 'calories-only' && (
                <div className="tooltip-overlay" style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x - 70}px`,
                  top: `${hoveredPoint.y - 65}px`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '120px'
                }}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
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
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Macronutrient Breakdown</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="legend-color" style={{background: 'var(--accent-purple)', width: '8px', height: '8px', borderRadius: '50%'}}></span>Protein
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
                const pts = [...history].reverse().filter(h => h.nightData).slice(-14);
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
                  const x = padL + (i / (pts.length - 1)) * gW;
                  const pVal = parseFloat(p.nightData.protein) || 0;
                  const cVal = parseFloat(p.nightData.carbs) || 0;
                  const fVal = parseFloat(p.nightData.fats) || 0;
                  
                  const yProt = padT + gH - (pVal / maxMacro) * gH;
                  const yCarb = padT + gH - (cVal / maxMacro) * gH;
                  const yFat = padT + gH - (fVal / maxMacro) * gH;
                  
                  return { x, yProt, yCarb, yFat, date: p.date.substring(5), pVal, cVal, fVal };
                });

                // Smooth curves
                const pathP = getBezierPath(coords, 'yProt');
                const pathC = getBezierPath(coords, 'yCarb');
                const pathF = getBezierPath(coords, 'yFat');
                const yTargetProtein = padT + gH - (targetProtein / maxMacro) * gH;

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return (
                        <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                      );
                    })}

                    {/* Target Protein line */}
                    <line 
                      x1={padL} 
                      y1={yTargetProtein} 
                      x2={w - padR} 
                      y2={yTargetProtein} 
                      stroke="var(--accent-purple)" 
                      strokeWidth="1.5" 
                      strokeDasharray="2 3" 
                      opacity="0.3"
                    />
                    <text x={padL + 10} y={yTargetProtein - 4} fill="var(--accent-purple)" opacity="0.5" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>TARGET PROTEIN ({targetProtein}G)</text>

                    {/* Bezier paths */}
                    <path d={pathP} fill="none" stroke="var(--accent-purple)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(168, 85, 247, 0.3))' }} />
                    <path d={pathC} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(6, 182, 212, 0.3))' }} />
                    <path d={pathF} fill="none" stroke="#f59e0b" strokeWidth="2" style={{ filter: 'drop-shadow(0px 2px 4px rgba(245, 158, 11, 0.3))' }} />

                    {/* Dots for points */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 7 || i % 2 === 0;
                      return (
                        <g key={i}>
                          <circle cx={c.x} cy={c.yProt} r="3" fill="var(--bg-surface)" stroke="var(--accent-purple)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yCarb} r="3" fill="var(--bg-surface)" stroke="var(--accent-cyan)" strokeWidth="1.5" />
                          <circle cx={c.x} cy={c.yFat} r="3" fill="var(--bg-surface)" stroke="#f59e0b" strokeWidth="1.5" />
                          {showLabel && <text x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text>}
                        </g>
                      );
                    })}

                    {/* Y Axis labels */}
                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxMacro)}g</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0g</text>

                    {/* Hover sensor rects */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - gW / (pts.length * 2)}
                        y={padT}
                        width={gW / pts.length}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          setHoveredPoint({
                            chartId: 'macros',
                            x: c.x,
                            y: Math.min(c.yProt, c.yCarb, c.yFat),
                            date: pts[i].date,
                            lines: [
                              { label: 'Protein', val: `${c.pVal} g`, color: 'var(--accent-purple)' },
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
                <div className="tooltip-overlay" style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x - 70}px`,
                  top: `${hoveredPoint.y - 95}px`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '130px'
                }}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
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
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Daily Steps</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-cyan)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Steps
                </span>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-red)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Goal (10k)
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = [...history].reverse().filter(h => h.nightData).slice(-14);
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
                const barWidth = Math.max(12, Math.min(24, gW / Math.max(1, pts.length * 1.5)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.5);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.5);
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
                        <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0.1"/>
                      </linearGradient>
                      <linearGradient id="barCyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.1"/>
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return (
                        <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                      );
                    })}

                    {/* Goal line */}
                    <line x1={padL} y1={yGoal} x2={w - padR} y2={yGoal} stroke="var(--accent-red)" strokeWidth="1.5" strokeDasharray="3 3" style={{ filter: 'drop-shadow(0 0 2px var(--accent-red))' }} />
                    <text x={w - padR - 110} y={yGoal - 4} fill="var(--accent-red)" opacity="0.6" fontSize="7" fontWeight="600" style={{ letterSpacing: '0.5px' }}>DAILY STEP GOAL ({targetSteps.toLocaleString()})</text>

                    {/* Bars */}
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

                    {/* Labels */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 7 || i % 2 === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    {/* Y Axis labels */}
                    <text x={5} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">{Math.round(maxSteps).toLocaleString()}</text>
                    <text x={5} y={yGoal + 3} fill="var(--accent-red)" opacity="0.75" fontSize="8" fontWeight="600">{(targetSteps / 1000).toFixed(0)}k</text>
                    <text x={5} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0</text>

                    {/* Hover sensors */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.5) / 2}
                        y={padT}
                        width={barWidth * 1.5}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          setHoveredPoint({
                            chartId: 'steps',
                            x: c.x,
                            y: c.yBar,
                            date: pts[i].date,
                            lines: [
                              { label: 'Steps', val: c.sVal.toLocaleString(), color: c.sVal >= 10000 ? 'var(--accent-cyan)' : 'var(--accent-red)' }
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
                <div className="tooltip-overlay" style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x - 70}px`,
                  top: `${hoveredPoint.y - 65}px`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '120px'
                }}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
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
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Habit Compliance History</h3>
              <div className="chart-legend" style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
                <span className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-color" style={{ background: 'var(--accent-green, #10b981)', width: '8px', height: '8px', borderRadius: '50%' }}></span>Completed Habits
                </span>
              </div>
            </div>
            <div className="svg-chart-container" style={{ position: 'relative' }}>
              {(() => {
                const pts = [...history].reverse().slice(-14);
                if (pts.length < 2) return <p className="text-muted text-center py-10" style={{ padding: '60px 0' }}>Need more logs to generate compliance graph...</p>;
                
                const w = 500;
                const h = 200;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const gW = w - padL - padR;
                const gH = h - padT - padB;

                const barWidth = Math.max(12, Math.min(24, gW / Math.max(1, pts.length * 1.5)));
                const totalBarSpace = pts.length * barWidth + (pts.length - 1) * (barWidth * 0.5);
                const startX = padL + (gW - totalBarSpace) / 2 + barWidth / 2;

                const coords = pts.map((p, i) => {
                  const x = startX + i * (barWidth * 1.5);
                  
                  let completed = 0;
                  let total = 4;
                  if (p.morningCompleted) completed++;
                  if (p.morningJournalCompleted) completed++;
                  if (p.nightCompleted) completed++;
                  if (p.nightJournalCompleted) completed++;
                  if (config.gymLockEnabled) {
                    total = 5;
                    if (p.gymCompleted) completed++;
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
                        <stop offset="0%" stopColor="var(--accent-green, #10b981)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--accent-green, #10b981)" stopOpacity="0.15"/>
                      </linearGradient>
                      <linearGradient id="barPurpleGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-purple, #a855f7)" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="var(--accent-purple, #a855f7)" stopOpacity="0.15"/>
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = padT + (idx / 4) * gH;
                      return (
                        <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                      );
                    })}

                    {/* Bars */}
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

                    {/* Labels */}
                    {coords.map((c, i) => {
                      const showLabel = coords.length <= 7 || i % 2 === 0;
                      return showLabel ? <text key={i} x={c.x} y={h - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{c.date}</text> : null;
                    })}

                    {/* Y Axis labels */}
                    <text x={10} y={padT + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">100%</text>
                    <text x={10} y={padT + gH / 2 + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">50%</text>
                    <text x={10} y={padT + gH + 5} fill="var(--text-muted)" fontSize="8" fontWeight="600">0%</text>

                    {/* Hover sensors */}
                    {coords.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x - (barWidth * 1.5) / 2}
                        y={padT}
                        width={barWidth * 1.5}
                        height={gH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const lines = [
                            { label: 'Morning Log', val: c.p.morningCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningCompleted ? 'var(--accent-green)' : 'var(--accent-red)' },
                            { label: 'Morning Journal', val: c.p.morningJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.morningJournalCompleted ? 'var(--accent-green)' : 'var(--accent-red)' },
                            { label: 'Evening Log', val: c.p.nightCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightCompleted ? 'var(--accent-green)' : 'var(--accent-red)' },
                            { label: 'Evening Journal', val: c.p.nightJournalCompleted ? '✅ Done' : '❌ Missed', color: c.p.nightJournalCompleted ? 'var(--accent-green)' : 'var(--accent-red)' }
                          ];
                          if (config.gymLockEnabled) {
                            lines.push({ label: 'Gym Workout', val: c.p.gymCompleted ? '✅ Done' : '❌ Missed', color: c.p.gymCompleted ? 'var(--accent-green)' : 'var(--accent-red)' });
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
                <div className="tooltip-overlay" style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x - 90}px`,
                  top: `${hoveredPoint.y - 120}px`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '160px'
                }}>
                  <div className="tooltip-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>{hoveredPoint.date}</div>
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

        return (
          <div style={{ marginTop: '36px' }}>
            <div className="section-title" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📐 Weekly Body Specs & Measurements
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Track weekly body composition, circumference changes, and trainer response notes.
              </p>
            </div>

            {/* Quick Metrics Grid for Latest Weekly Check-in */}
            {latestWeekly && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '14px',
                marginBottom: '24px'
              }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderLeft: '4px solid #a855f7', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Start Weight</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{latestWeekly.startWeight ? `${latestWeekly.startWeight} kg` : '-'}</div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>w/c {latestWeekly.weekCommencing || 'latest'}</span>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderLeft: '4px solid #3b82f6', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Waist (Umbilical)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{latestWeekly.umbilical ? `${latestWeekly.umbilical} cm` : '-'}</div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderLeft: '4px solid #10b981', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Biceps (L / R)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {latestWeekly.bicepL || latestWeekly.bicepR ? `${latestWeekly.bicepL || '-'}/${latestWeekly.bicepR || '-'} cm` : '-'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Quads (L / R)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {latestWeekly.quadL || latestWeekly.quadR ? `${latestWeekly.quadL || '-'}/${latestWeekly.quadR || '-'} cm` : '-'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderLeft: '4px solid #ec4899', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Glutes & Chest</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    G: {latestWeekly.glutes || '-'} | C: {latestWeekly.chest || '-'} cm
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Log Table */}
            <div className="chart-card glass-card" style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
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
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
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
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'var(--text-primary)' }}>
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
                                      <img src={w.photos[p]} alt={p} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }} />
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
