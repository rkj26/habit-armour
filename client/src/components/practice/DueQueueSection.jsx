import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function DueQueueSection({
  dueGroups,
  dueQuestions,
  dueData,
  loading,
  expandedDueGroups,
  toggleDueGroupExpand,
  onStartPractice
}) {
  return (
    <div className="practice-due-view">
      {/* Session Progress Header */}
      <div className="due-progress-card glass-card">
        <div className="due-progress-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>🎯 Today's Spaced Repetition Queue</h2>
              {dueData?.targetMet && (
                <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px' }}>
                  ✅ DAILY TARGET COMPLETED
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {dueData?.targetMet
                ? `Today's topic area(s) cleared — daily requirement met! Feel free to practice extra due cards below.`
                : `Today: ${dueData?.reviewTopicsPerDay ?? 1} review topic${(dueData?.reviewTopicsPerDay ?? 1) === 1 ? '' : 's'} + ${dueData?.newTopicsPerDay ?? 1} new topic${(dueData?.newTopicsPerDay ?? 1) === 1 ? '' : 's'} (${dueData?.completedToday || 0} question${dueData?.completedToday === 1 ? '' : 's'} completed so far)`}
            </p>
          </div>
          <div className="due-progress-stat">
            <div className="stat-number">{dueData?.topicsCompletedToday ?? 0} / {dueData?.topicsShownToday ?? 0}</div>
            <div className="stat-label">Topic Areas Done</div>
          </div>
        </div>

        <div className="progress-bar-container" style={{ margin: '14px 0 6px 0', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            className="progress-bar-fill"
            style={{
              height: '100%',
              width: `${dueData?.topicsShownToday ? Math.min(100, Math.round((dueData.topicsCompletedToday / dueData.topicsShownToday) * 100)) : 100}%`,
              background: dueData?.targetMet ? '#22c55e' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {dueData && (dueData.totalDueBacklog > dueData.dueCount || dueData.queuedNewTopicsCount > 0 || dueData.queuedReviewTopicsCount > 0) && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>
              ⚡ <strong>Topic Ladder Pacing:</strong> {dueData.topicsShownToday} topic area{dueData.topicsShownToday === 1 ? '' : 's'} today ({dueData.dueCount} question{dueData.dueCount === 1 ? '' : 's'} total).
              {(dueData.queuedReviewTopicsCount > 0 || dueData.queuedNewTopicsCount > 0) && (
                <span>
                  {' '}({[
                    dueData.queuedReviewTopicsCount > 0 ? `${dueData.queuedReviewTopicsCount} review` : null,
                    dueData.queuedNewTopicsCount > 0 ? `${dueData.queuedNewTopicsCount} new` : null,
                  ].filter(Boolean).join(' + ')} topic area{(dueData.queuedReviewTopicsCount + dueData.queuedNewTopicsCount) === 1 ? '' : 's'} queued for upcoming days).
                </span>
              )}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Bank Total: {dueData.totalBankCount} cards
            </span>
          </div>
        )}
      </div>

      {/* Due Cards List */}
      <div className="due-cards-list">
        {loading ? (
          <div className="loading-state">Loading your spaced repetition queue...</div>
        ) : !dueGroups || dueGroups.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="empty-icon">🎉</div>
            <h3>All Spaced Repetition Reviews Clear!</h3>
            <p>You have no pending reviews due today. Explore the Study Bank or practice Free Recall below.</p>
          </div>
        ) : (
          dueGroups.map(group => {
            const isGroupExpanded = expandedDueGroups[group.itemId] !== false; // expanded by default
            const groupCompleted = group.completedTodayCount === group.dueCount;

            return (
              <div
                key={group.itemId}
                className="due-topic-group glass-card"
                style={{
                  marginBottom: '20px',
                  border: groupCompleted ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                  background: groupCompleted ? 'rgba(34, 197, 94, 0.03)' : 'var(--surface-color)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden'
                }}
              >
                {/* Topic Header Accordion Banner */}
                <div
                  onClick={() => toggleDueGroupExpand(group.itemId)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderBottom: isGroupExpanded ? '1px solid var(--border-color)' : 'none',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {isGroupExpanded ? '▼' : '▶'}
                    </span>
                    <span className={`badge ${group.itemType === 'paper' ? 'badge-paper' : 'badge-topic'}`} style={{ fontSize: '0.7rem' }}>
                      {group.itemType === 'paper' ? '📄 PAPER' : '🧠 THEORY TOPIC'}
                    </span>
                    {group.isReview ? (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 600 }}>
                        🔄 ACTIVE REVIEW
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', fontWeight: 600 }}>
                        ✨ NEW TOPIC LADDER
                      </span>
                    )}
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {group.itemTitle}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: groupCompleted ? '#22c55e' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {group.completedTodayCount} / {group.dueCount} completed
                    </span>
                  </div>
                </div>

                {/* Questions Ladder inside this Topic */}
                {isGroupExpanded && (
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {group.questions.map((q, idx) => {
                      const isComplete = q.completedToday;

                      return (
                        <div
                          key={q.id}
                          className="due-question-card"
                          style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: isComplete ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                            background: isComplete ? 'rgba(34, 197, 94, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                            position: 'relative'
                          }}
                        >
                          <div className="due-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div className="due-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 700 }}>
                                #{idx + 1}
                              </span>
                              <span className="badge badge-difficulty" style={{ fontSize: '0.7rem' }}>{q.difficulty}</span>
                              <span className="badge badge-time" style={{ fontSize: '0.68rem' }}>⏱️ ~1-2m</span>

                              {q.fsrs && q.fsrs.repetitions > 0 && (
                                <span className="badge badge-retention" style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                                  🧠 R: {Math.round(q.fsrs.retrievability * 100)}% • Stability: {q.fsrs.stability}d
                                </span>
                              )}

                              {isComplete && (
                                <span className="badge badge-success" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                                  ✓ COMPLETED TODAY
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="due-prompt markdown-rendered" style={{ margin: '14px 0', lineHeight: '1.65' }}>
                            {renderMarkdown(q.prompt)}
                          </div>

                          <div className="due-card-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-primary"
                              onClick={() => onStartPractice(q)}
                            >
                              ⚡ Start Active Recall Practice
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
