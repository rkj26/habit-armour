import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function PerformanceSection({
  performanceData,
  loading,
  allQuestions,
  onStartPractice
}) {
  if (loading && !performanceData) {
    return <div className="loading-state">Loading FSRS performance analytics...</div>;
  }

  if (!performanceData) {
    return (
      <div className="empty-state glass-card">
        <div className="empty-icon">📊</div>
        <h3>No Performance Data Available</h3>
        <p>Complete your first active recall practice session to view your mastery trajectory.</p>
      </div>
    );
  }

  const { summary, topics, questions } = performanceData;

  return (
    <div className="practice-performance-view">
      {/* Top Stat Cards */}
      <div className="perf-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="perf-card glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Active Cards</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{summary.totalQuestions}</div>
        </div>

        <div className="perf-card glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Mean Score</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: summary.overallAverageScore >= 8.0 ? '#22c55e' : summary.overallAverageScore >= 6.5 ? '#3b82f6' : '#eab308', marginTop: '4px' }}>
            {summary.overallAverageScore} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 10</span>
          </div>
        </div>

        <div className="perf-card glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Memory Stability</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
            {summary.averageStabilityDays} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Days</span>
          </div>
        </div>

        <div className="perf-card glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Attempt Logs</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{summary.totalAttempts}</div>
        </div>
      </div>

      {/* Mastery Breakdown */}
      <div className="perf-section glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 14px 0' }}>🏆 Topic Mastery Progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {topics.map(t => (
            <div key={t.itemId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span className={`badge ${t.type === 'paper' ? 'badge-paper' : 'badge-topic'}`} style={{ fontSize: '0.68rem', marginRight: '8px' }}>
                    {t.type.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Avg: <strong>{t.averageScore}/10</strong></span>
                  <span>Mastered: <strong>{t.masteredCount}/{t.questionCount}</strong></span>
                  <span style={{ fontWeight: 700, color: t.masteryRate >= 80 ? '#22c55e' : t.masteryRate >= 50 ? '#3b82f6' : 'var(--text-muted)' }}>
                    {t.masteryRate}%
                  </span>
                </div>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${t.masteryRate}%`,
                    background: t.masteryRate >= 80 ? '#22c55e' : t.masteryRate >= 50 ? '#3b82f6' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Question Matrix */}
      <div className="perf-section glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 14px 0' }}>📋 Question Stability & Retention Table</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {questions.map(q => {
            const fullQ = allQuestions.find(orig => orig.id === q.questionId) || q;

            return (
              <div key={q.questionId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-difficulty" style={{ fontSize: '0.7rem' }}>{q.difficulty}</span>
                    <span className={`badge ${q.itemType === 'paper' ? 'badge-paper' : 'badge-topic'}`} style={{ fontSize: '0.7rem' }}>{q.itemTitle}</span>
                    <span className="badge" style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: q.statusTier === 'Mastered' ? 'rgba(34, 197, 94, 0.15)' : q.statusTier === 'Proficient' ? 'rgba(59, 130, 246, 0.15)' : q.statusTier === 'Developing' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: q.statusTier === 'Mastered' ? '#22c55e' : q.statusTier === 'Proficient' ? '#3b82f6' : q.statusTier === 'Developing' ? '#eab308' : 'var(--text-muted)'
                    }}>
                      {q.statusTier}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Attempts: <strong>{q.totalAttempts}</strong></span>
                    <span>Avg Score: <strong>{q.averageScore}/10</strong></span>
                    <span>Stability: <strong>{q.fsrs.stability}d</strong></span>
                    <span>Due: <strong>{q.fsrs.dueDate || 'Today'}</strong></span>
                  </div>
                </div>

                <div className="markdown-rendered" style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: '8px 0' }}>
                  {renderMarkdown(q.prompt)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => onStartPractice(fullQ)}
                  >
                    ⚡ Practice Question
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
