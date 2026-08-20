import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export function ItemModal({
  show,
  onClose,
  onSubmit,
  isEditing,
  itemFormType,
  setItemFormType,
  itemFormTitle,
  setItemFormTitle,
  itemFormTags,
  setItemFormTags,
  itemFormNotes,
  setItemFormNotes,
  paperArxivId,
  setPaperArxivId,
  paperAuthors,
  setPaperAuthors,
  paperYear,
  setPaperYear,
  savingItem
}) {
  if (!show) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card">
        <h3>{isEditing ? 'Edit Topic / Paper' : 'Add New Study Topic / Paper'}</h3>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Item Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="itemType"
                  value="topic"
                  checked={itemFormType === 'topic'}
                  onChange={() => setItemFormType('topic')}
                />
                🧠 Theory / Architecture Topic
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="itemType"
                  value="paper"
                  checked={itemFormType === 'paper'}
                  onChange={() => setItemFormType('paper')}
                />
                📄 Landmark Paper
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Proximal Policy Optimization (PPO)"
              value={itemFormTitle}
              onChange={(e) => setItemFormTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              className="input-field"
              placeholder="RL, Policy Gradients, Actor-Critic"
              value={itemFormTags}
              onChange={(e) => setItemFormTags(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Core Focus / Theoretical Notes</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Key mechanisms, equations, or theorems to master..."
              value={itemFormNotes}
              onChange={(e) => setItemFormNotes(e.target.value)}
            />
          </div>

          {itemFormType === 'paper' && (
            <div className="paper-form-section">
              <div className="form-group">
                <label>arXiv ID</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 1707.06347"
                  value={paperArxivId}
                  onChange={(e) => setPaperArxivId(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Authors / Year</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Schulman et al."
                    value={paperAuthors}
                    onChange={(e) => setPaperAuthors(e.target.value)}
                  />
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '100px' }}
                    value={paperYear}
                    onChange={(e) => setPaperYear(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingItem}>
              {savingItem ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QuestionModal({
  show,
  onClose,
  onSubmit,
  items,
  questionItemId,
  setQuestionItemId,
  questionPrompt,
  setQuestionPrompt,
  questionTemplate,
  setQuestionTemplate,
  questionDifficulty,
  setQuestionDifficulty,
  savingQuestion
}) {
  if (!show) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card">
        <h3>Add Active Recall Question</h3>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Target Topic / Paper</label>
            <select
              className="input-field"
              value={questionItemId}
              onChange={(e) => setQuestionItemId(e.target.value)}
            >
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Question Prompt (1–2 min atomic prompt recommended)</label>
            <textarea
              className="input-field"
              rows={4}
              required
              placeholder="State the exact single-concept derivation, tensor trace, or mechanism to recall in 1-2 mins..."
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Answer Template</label>
              <select
                className="input-field"
                value={questionTemplate}
                onChange={(e) => setQuestionTemplate(e.target.value)}
              >
                <option value="topic">Topic: Proof + Intuition + ELI5</option>
                <option value="paper">Paper: Claims + Method + Results + Limits + ELI5</option>
              </select>
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select
                className="input-field"
                value={questionDifficulty}
                onChange={(e) => setQuestionDifficulty(e.target.value)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingQuestion}>
              {savingQuestion ? 'Creating...' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ManualOverrideModal({
  show,
  onClose,
  onSubmit,
  overrideReason,
  setOverrideReason,
  submittingOverride
}) {
  if (!show) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card">
        <h3>Manual Practice Override</h3>
        <p className="modal-desc">
          Mark today's consistent practice requirement as completed without submitting an in-app proof.
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Override Reason</label>
            <input
              type="text"
              className="input-field"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submittingOverride}>
              {submittingOverride ? 'Submitting...' : 'Confirm Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AttemptHistoryModal({
  historyItem,
  onClose,
  loadingHistory,
  historyAttempts
}) {
  if (!historyItem) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card modal-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>📜 Attempt History: {historyItem.title}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {loadingHistory ? (
          <p>Loading historical evaluations...</p>
        ) : historyAttempts.length === 0 ? (
          <p className="empty-subtext">No practice attempts recorded yet for this item.</p>
        ) : (
          <div className="history-attempts-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {historyAttempts.map(att => (
              <div key={att.id} className="history-attempt-card glass-card" style={{ padding: '18px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                <div className="history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="history-date" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    📅 {new Date(att.submittedAt).toLocaleDateString()} {new Date(att.submittedAt).toLocaleTimeString()}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {att.evaluation?.grade && (
                      <span className="badge badge-topic" style={{ fontSize: '0.72rem' }}>
                        Grade {att.evaluation.grade}: {att.evaluation.grade === 4 ? 'Easy' : att.evaluation.grade === 3 ? 'Good' : att.evaluation.grade === 2 ? 'Hard' : 'Again'}
                      </span>
                    )}
                    <span className={`badge ${att.evaluation?.score >= 8.5 ? 'badge-verified' : att.evaluation?.score >= 7.0 ? 'badge-topic' : att.evaluation?.score >= 5.0 ? 'badge-difficulty' : 'badge-danger'}`}>
                      Score: {att.evaluation?.score ?? 'N/A'} / 10
                    </span>
                  </div>
                </div>

                {att.evaluation?.keyImprovements && att.evaluation.keyImprovements.length > 0 && (
                  <div className="improvements-card" style={{ margin: '10px 0', padding: '12px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '6px' }}>
                      💡 KEY IMPROVEMENTS FLAGGED:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.825rem', color: '#1e40af' }}>
                      {att.evaluation.keyImprovements.map((imp, idx) => (
                        <li key={idx} style={{ marginBottom: '3px' }}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {att.evaluation?.idealAnswer && (
                  <div className="model-solution-card" style={{ margin: '10px 0', padding: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5', marginBottom: '6px' }}>
                      🎯 EXEMPLARY MODEL ANSWER & PROOF:
                    </div>
                    <div className="markdown-rendered" style={{ fontSize: '0.85rem' }}>
                      {renderMarkdown(att.evaluation.idealAnswer)}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Reviewer Critique:
                  </span>
                  <div className="history-critique markdown-rendered" style={{ marginTop: '4px', fontSize: '0.88rem' }}>
                    {renderMarkdown(att.evaluation?.critique)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
