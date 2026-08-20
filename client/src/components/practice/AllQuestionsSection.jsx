import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function AllQuestionsSection({
  allQuestions,
  loading,
  questionFilter,
  setQuestionFilter,
  searchQuery,
  setSearchQuery,
  onStartPractice
}) {
  const filteredQuestions = allQuestions.filter(q => {
    if (questionFilter !== 'all' && q.difficulty.toLowerCase() !== questionFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const qText = searchQuery.toLowerCase();
      const promptMatch = (q.prompt || '').toLowerCase().includes(qText);
      const titleMatch = (q.itemTitle || '').toLowerCase().includes(qText);
      if (!promptMatch && !titleMatch) return false;
    }
    return true;
  });

  return (
    <div className="practice-questions-view">
      {/* Filter Bar */}
      <div className="bank-filter-bar">
        <div className="filter-buttons">
          <button
            className={`btn-filter ${questionFilter === 'all' ? 'active' : ''}`}
            onClick={() => setQuestionFilter('all')}
          >
            All Questions ({allQuestions.length})
          </button>
          <button
            className={`btn-filter ${questionFilter === 'easy' ? 'active' : ''}`}
            onClick={() => setQuestionFilter('easy')}
          >
            🟢 Easy ({allQuestions.filter(q => q.difficulty.toLowerCase() === 'easy').length})
          </button>
          <button
            className={`btn-filter ${questionFilter === 'medium' ? 'active' : ''}`}
            onClick={() => setQuestionFilter('medium')}
          >
            🟡 Medium ({allQuestions.filter(q => q.difficulty.toLowerCase() === 'medium').length})
          </button>
          <button
            className={`btn-filter ${questionFilter === 'hard' ? 'active' : ''}`}
            onClick={() => setQuestionFilter('hard')}
          >
            🔴 Hard ({allQuestions.filter(q => q.difficulty.toLowerCase() === 'hard').length})
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            className="input-field"
            placeholder="Search questions or equations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Questions Grid */}
      <div className="questions-grid">
        {loading ? (
          <div className="loading-state">Loading questions bank...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="empty-icon">🔍</div>
            <h3>No Questions Found</h3>
            <p>No questions matched your search criteria.</p>
          </div>
        ) : (
          filteredQuestions.map(q => (
            <div key={q.id} className="question-card glass-card">
              <div className="question-card-header">
                <div className="question-meta">
                  <span className="badge badge-difficulty">{q.difficulty}</span>
                  <span className={`badge ${q.itemType === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                    {q.itemTitle}
                  </span>
                  {q.hasModelSolution && (
                    <span className="badge badge-cached" style={{ fontSize: '0.68rem' }}>⚡ Key Saved</span>
                  )}
                </div>
                <span className="due-date-pill">Due: {q.fsrs?.dueDate || q.sm2?.dueDate || 'Today'}</span>
              </div>

              <div className="question-prompt markdown-rendered">
                {renderMarkdown(q.prompt)}
              </div>

              <div className="question-card-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => onStartPractice(q)}
                >
                  ⚡ Practice Now (Free Recall)
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
