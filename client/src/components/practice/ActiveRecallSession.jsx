import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function ActiveRecallSession({
  activeQuestion,
  onClose,
  answerMarkdown,
  setAnswerMarkdown,
  isSubmittingAttempt,
  evaluationResult,
  imageUploading,
  fileInputRef,
  handleImageUpload,
  handleSubmitAttempt,
  fetchModelSolution,
  activeModelSolution,
  loadingModelSolution,
  practiceTimer
}) {
  if (!activeQuestion) return null;

  return (
    <div className="active-recall-overlay">
      <div className="active-recall-workspace glass-card">
        {/* Workspace Header */}
        <div className="recall-header">
          <div className="recall-title-box">
            <span className="badge badge-topic">{activeQuestion.itemType === 'paper' ? '📄 PAPER' : '🧠 THEORY'}</span>
            <span className="badge badge-difficulty">{activeQuestion.difficulty}</span>
            <span className="badge badge-timer">⏱️ {practiceTimer}s elapsed</span>
            {activeQuestion.hasModelSolution && (
              <span className="badge badge-cached" style={{ fontSize: '0.7rem' }}>⚡ Master Key Saved</span>
            )}
            <h2 className="recall-item-title">{activeQuestion.itemTitle}</h2>
          </div>
          <button className="btn-icon close-btn" onClick={onClose} title="Exit Session">✕</button>
        </div>

        {/* Prompt Card */}
        <div className="recall-prompt-card">
          <div className="prompt-label">PRACTICE PROMPT (ACTIVE RECALL):</div>
          <div className="prompt-content markdown-rendered">
            {renderMarkdown(activeQuestion.prompt)}
          </div>
        </div>

        {/* Evaluation Results Banner (When Submitted) */}
        {evaluationResult && (
          <div className="evaluation-result-container glass-card" style={{ marginTop: '20px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EVALUATION OUTCOME</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: evaluationResult.evaluation.score >= 8.5 ? '#22c55e' : evaluationResult.evaluation.score >= 7.0 ? '#3b82f6' : evaluationResult.evaluation.score >= 5.0 ? '#eab308' : '#ef4444' }}>
                    {evaluationResult.evaluation.score} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 10.0</span>
                  </h3>
                  <span className="badge" style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: evaluationResult.evaluation.grade === 4 ? 'rgba(34, 197, 94, 0.15)' : evaluationResult.evaluation.grade === 3 ? 'rgba(59, 130, 246, 0.15)' : evaluationResult.evaluation.grade === 2 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: evaluationResult.evaluation.grade === 4 ? '#22c55e' : evaluationResult.evaluation.grade === 3 ? '#3b82f6' : evaluationResult.evaluation.grade === 2 ? '#eab308' : '#ef4444'
                  }}>
                    {evaluationResult.evaluation.grade === 4 ? '🌟 Mastered (Easy)' : evaluationResult.evaluation.grade === 3 ? '✓ Good (Solid Pass)' : evaluationResult.evaluation.grade === 2 ? '⚠️ Hard (Minor Gaps)' : '❌ Lapse (Again)'}
                  </span>
                </div>
              </div>

              {evaluationResult.fsrs && (
                <div style={{ textAlign: 'right', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FSRS-5 MEMORY INTERVAL</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                    Next Due: {evaluationResult.fsrs.dueDate} ({evaluationResult.fsrs.intervalDays}d)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Stability: {evaluationResult.fsrs.stability}d • D: {evaluationResult.fsrs.fsrsDifficulty}
                  </div>
                </div>
              )}
            </div>

            {/* Rubric Breakdown */}
            {evaluationResult.evaluation.rubric && Object.keys(evaluationResult.evaluation.rubric).length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>RUBRIC AUDIT</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {Object.entries(evaluationResult.evaluation.rubric).map(([category, item]) => (
                    <div key={category} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>{category}</span>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>{item.score} / 10</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{item.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Critique */}
            {evaluationResult.evaluation.critique && (
              <div style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>ACADEMIC CRITIQUE</h4>
                <div className="markdown-rendered" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {renderMarkdown(evaluationResult.evaluation.critique)}
                </div>
              </div>
            )}

            {/* Flagged Issues */}
            {evaluationResult.evaluation.flaggedIssues && evaluationResult.evaluation.flaggedIssues.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>⚠️ FLAGGED ISSUES</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {evaluationResult.evaluation.flaggedIssues.map((flag, idx) => (
                    <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>[{flag.type}] "{flag.quote}"</div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{flag.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Solution Comparison */}
            {evaluationResult.evaluation.idealAnswer && (
              <div style={{ marginTop: '16px', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>⚡ MASTER MODEL SOLUTION</h4>
                <div className="markdown-rendered" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {renderMarkdown(evaluationResult.evaluation.idealAnswer)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Solution Input Area: Split Markdown Editor & Live Preview */}
        {!evaluationResult && (
          <form onSubmit={handleSubmitAttempt} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                YOUR DERIVATION / SOLUTION (MARKDOWN, CODE, OR INTUITIVE PROSE):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  {imageUploading ? '⏳ Uploading...' : '📷 Attach Diagram / Whiteboard Photo'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  onClick={fetchModelSolution}
                  disabled={loadingModelSolution}
                >
                  {loadingModelSolution ? '⏳ Loading Key...' : '⚡ View Answer Key'}
                </button>
              </div>
            </div>

            {/* Split Editor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', minHeight: '260px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <textarea
                  className="form-input"
                  rows={12}
                  style={{ width: '100%', height: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}
                  placeholder={`Write your derivation, proof, or conceptual mechanics here...

Tip: You can use:
- PyTorch / shorthand: (b, nh, p, dh)
- LaTeX equations: $V^\\pi(s)$ or $$Q(s,a) = R + \\gamma \\mathbb{E}[V(s')]$$
- Intuitive prose, bullet points, or attached handwritten whiteboard photos.`}
                  value={answerMarkdown}
                  onChange={(e) => setAnswerMarkdown(e.target.value)}
                />
              </div>

              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                overflowY: 'auto',
                maxHeight: '400px'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>LIVE PREVIEW:</div>
                <div className="markdown-rendered" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {answerMarkdown.trim() ? renderMarkdown(answerMarkdown) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Live math and markdown rendering will appear here...</span>}
                </div>
              </div>
            </div>

            {/* Answer Key Drawer */}
            {activeModelSolution && (
              <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '14px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8' }}>⚡ REFERENCE MODEL SOLUTION</span>
                  <span className="badge badge-cached" style={{ fontSize: '0.68rem' }}>{activeModelSolution.cached ? 'Saved in DB' : 'Generated via Gemini'}</span>
                </div>
                <div className="markdown-rendered" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {renderMarkdown(activeModelSolution.idealAnswer)}
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSubmittingAttempt || !answerMarkdown.trim()}
              >
                {isSubmittingAttempt ? '🤖 Rigorous Academic Evaluation in Progress...' : '🚀 Submit for AI Grade & Update Spaced Repetition'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
