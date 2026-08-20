import React from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function TopicBankSection({
  items,
  allQuestions,
  loading,
  bankFilter,
  setBankFilter,
  searchQuery,
  setSearchQuery,
  expandedItems,
  toggleItemExpand,
  onAddQuestion,
  onViewHistory,
  onEditItem,
  onDeleteItem,
  onStartPractice
}) {
  const filteredItems = items.filter(item => {
    if (bankFilter !== 'all' && item.type !== bankFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(q);
      const notesMatch = (item.notes || '').toLowerCase().includes(q);
      const tagsMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
      const arxivMatch = item.paper?.arxivId?.toLowerCase().includes(q);
      if (!titleMatch && !notesMatch && !tagsMatch && !arxivMatch) return false;
    }
    return true;
  });

  return (
    <div className="practice-bank-view">
      {/* Filter Bar */}
      <div className="bank-filter-bar">
        <div className="filter-buttons">
          <button
            className={`btn-filter ${bankFilter === 'all' ? 'active' : ''}`}
            onClick={() => setBankFilter('all')}
          >
            All Topics ({items.length})
          </button>
          <button
            className={`btn-filter ${bankFilter === 'topic' ? 'active' : ''}`}
            onClick={() => setBankFilter('topic')}
          >
            🧠 Theory Topics ({items.filter(i => i.type === 'topic').length})
          </button>
          <button
            className={`btn-filter ${bankFilter === 'paper' ? 'active' : ''}`}
            onClick={() => setBankFilter('paper')}
          >
            📄 Landmark Papers ({items.filter(i => i.type === 'paper').length})
          </button>
        </div>
        <div className="search-box">
          <input
            type="text"
            className="input-field"
            placeholder="Search topics, tags, algorithms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Items Grid */}
      <div className="bank-items-grid">
        {loading ? (
          <div className="loading-state">Loading Study Bank...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="empty-icon">📂</div>
            <h3>No Topics Found</h3>
            <p>No study topics or papers match your search criteria.</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const itemQuestions = allQuestions.filter(q => q.itemId === item.id).sort((a, b) => (a.order || 0) - (b.order || 0));
            const isExpanded = !!expandedItems[item.id];

            return (
              <div key={item.id} className="bank-item-card glass-card">
                <div className="bank-item-header">
                  <span className={`badge ${item.type === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                    {item.type === 'paper' ? '📄 PAPER' : '🧠 THEORY TOPIC'}
                  </span>
                  <div className="bank-item-menu">
                    <button
                      className="btn-icon"
                      title="Add Manual Question"
                      onClick={() => onAddQuestion(item)}
                    >
                      ➕
                    </button>
                    <button
                      className="btn-icon"
                      title="View Attempt History"
                      onClick={() => onViewHistory(item)}
                    >
                      📜
                    </button>
                    <button
                      className="btn-icon"
                      title="Edit Item"
                      onClick={() => onEditItem(item)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      title="Delete Item"
                      onClick={() => onDeleteItem(item.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <h3 className="bank-item-title">{item.title}</h3>
                {item.notes && <p className="bank-item-notes">{item.notes}</p>}

                {item.paper && (
                  <div className="paper-meta-card">
                    {item.paper.arxivId && <div>arXiv: <strong>{item.paper.arxivId}</strong></div>}
                    {item.paper.authors && <div>Authors: <strong>{item.paper.authors.join(', ')}</strong> ({item.paper.year})</div>}
                    {item.paper.url && (
                      <a href={item.paper.url} target="_blank" rel="noreferrer" className="paper-link">
                        🔗 Open Paper URL
                      </a>
                    )}
                  </div>
                )}

                <div className="bank-item-tags">
                  {item.tags && item.tags.map((t, idx) => (
                    <span key={idx} className="badge badge-tag">{t}</span>
                  ))}
                </div>

                {/* Attached Questions Accordion */}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => toggleItemExpand(item.id)}
                  >
                    <span>{isExpanded ? '▼' : '▶'}</span>
                    <span>Attached Active Recall Questions ({itemQuestions.length})</span>
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {itemQuestions.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No questions added yet. Click ➕ to add active recall questions.
                        </div>
                      ) : (
                        itemQuestions.map((q, qIdx) => (
                          <div key={q.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 700 }}>#{qIdx + 1}</span>
                                <span className="badge badge-difficulty" style={{ fontSize: '0.7rem' }}>{q.difficulty}</span>
                                <span className="badge badge-time" style={{ fontSize: '0.68rem' }}>⏱️ ~1-2m</span>
                                {q.hasModelSolution && <span className="badge badge-cached" style={{ fontSize: '0.68rem' }}>⚡ Key Saved</span>}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Due: {q.fsrs?.dueDate || q.sm2?.dueDate || 'Today'}</span>
                            </div>
                            <div className="markdown-rendered" style={{ fontSize: '0.825rem', lineHeight: '1.5', margin: '6px 0' }}>
                              {renderMarkdown(q.prompt)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                onClick={() => onStartPractice(q)}
                              >
                                ⚡ Practice Now
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
