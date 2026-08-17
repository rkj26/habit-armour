import React, { useState, useEffect } from 'react';
import PracticeAnswerEditor from './PracticeAnswerEditor';
import { renderMarkdown } from '../utils/renderMarkdown';

export default function PracticeView({ API_URL, status, onRefreshStatus }) {
  const [practiceStatus, setPracticeStatus] = useState(null);
  const [dueQuestions, setDueQuestions] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active Editor state
  const [activeQuestion, setActiveQuestion] = useState(null);

  // Tab & Filter states
  const [mainTab, setMainTab] = useState('queue'); // 'queue', 'bank', 'history'
  const [bankFilter, setBankFilter] = useState('all'); // 'all', 'topic', 'paper'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormType, setItemFormType] = useState('topic');
  const [itemFormTitle, setItemFormTitle] = useState('');
  const [itemFormTags, setItemFormTags] = useState('');
  const [itemFormNotes, setItemFormNotes] = useState('');
  const [paperArxivId, setPaperArxivId] = useState('');
  const [paperUrl, setPaperUrl] = useState('');
  const [paperAuthors, setPaperAuthors] = useState('');
  const [paperYear, setPaperYear] = useState(new Date().getFullYear());
  const [savingItem, setSavingItem] = useState(false);

  // Add Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionItemId, setQuestionItemId] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionTemplate, setQuestionTemplate] = useState('topic');
  const [questionDifficulty, setQuestionDifficulty] = useState('Medium');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Gemini Question Generator
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateItemId, setGenerateItemId] = useState('');
  const [generateCount, setGenerateCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generateSuccessMsg, setGenerateSuccessMsg] = useState(null);

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Reviewed proofs in physical notebook / paper');
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState(null);

  // Attempt History Drawer / Modal
  const [historyItem, setHistoryItem] = useState(null);
  const [historyAttempts, setHistoryAttempts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchPracticeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, dueRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/api/practice/status`),
        fetch(`${API_URL}/api/practice/due`),
        fetch(`${API_URL}/api/practice/items`)
      ]);

      const statusData = await statusRes.json();
      const dueData = await dueRes.json();
      const itemsData = await itemsRes.json();

      if (!statusRes.ok) throw new Error(statusData.error || 'Failed to fetch practice status');
      if (!dueRes.ok) throw new Error(dueData.error || 'Failed to fetch due queue');
      if (!itemsRes.ok) throw new Error(itemsData.error || 'Failed to fetch study bank');

      setPracticeStatus(statusData);
      setDueQuestions(dueData.dueQuestions || []);
      setItems(itemsData.items || []);
    } catch (err) {
      console.error('Fetch practice error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticeData();
  }, [API_URL]);

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormTitle.trim()) return;

    setSavingItem(true);
    setError(null);
    try {
      const body = {
        type: itemFormType,
        title: itemFormTitle.trim(),
        tags: itemFormTags.split(',').map(s => s.trim()).filter(Boolean),
        notes: itemFormNotes.trim(),
        paper: itemFormType === 'paper' ? {
          arxivId: paperArxivId.trim(),
          url: paperUrl.trim() || (paperArxivId ? `https://arxiv.org/abs/${paperArxivId.trim()}` : ''),
          authors: paperAuthors.split(',').map(s => s.trim()).filter(Boolean),
          year: parseInt(paperYear, 10) || new Date().getFullYear()
        } : null
      };

      const res = await fetch(`${API_URL}/api/practice/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save item');

      setShowItemModal(false);
      setItemFormTitle('');
      setItemFormTags('');
      setItemFormNotes('');
      setPaperArxivId('');
      setPaperUrl('');
      setPaperAuthors('');
      fetchPracticeData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionItemId || !questionPrompt.trim()) return;

    setSavingQuestion(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/practice/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: questionItemId,
          prompt: questionPrompt.trim(),
          answerTemplate: questionTemplate,
          difficulty: questionDifficulty
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create question');

      setShowQuestionModal(false);
      setQuestionPrompt('');
      fetchPracticeData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    if (!generateItemId) return;

    setGenerating(true);
    setError(null);
    setGenerateSuccessMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/practice/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: generateItemId,
          count: parseInt(generateCount, 10) || 3
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions via Gemini');

      setGenerateSuccessMsg(`✨ Successfully generated and added ${data.count} new active recall questions!`);
      fetchPracticeData();
      setTimeout(() => {
        setShowGenerateModal(false);
        setGenerateSuccessMsg(null);
      }, 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    setSubmittingOverride(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/practice/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply manual override');

      setShowOverrideModal(false);
      setOverrideSuccessMsg('Consistent Practice marked complete for today via manual override.');
      fetchPracticeData();
      if (onRefreshStatus) onRefreshStatus();
      setTimeout(() => setOverrideSuccessMsg(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResetOverride = async () => {
    try {
      const res = await fetch(`${API_URL}/api/practice/reset-override`, { method: 'POST' });
      if (res.ok) {
        fetchPracticeData();
        if (onRefreshStatus) onRefreshStatus();
      }
    } catch (err) {
      console.error('Reset override error:', err);
    }
  };

  const handleViewHistory = async (item) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/api/practice/attempts?itemId=${item.id}`);
      const data = await res.json();
      setHistoryAttempts(data.attempts || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (bankFilter !== 'all' && item.type !== bankFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const tagsMatch = item.tags?.some(t => t.toLowerCase().includes(q));
      const notesMatch = item.notes?.toLowerCase().includes(q);
      return titleMatch || tagsMatch || notesMatch;
    }
    return true;
  });

  return (
    <div className="practice-container">
      {/* Top Banner & Heading */}
      <div className="section-title practice-title-row">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🧠 Consistent Practice & Active Recall
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
            Spaced repetition proof mastery for AI Control, RL Derivations, Mechanistic Interpretability & ML Papers.
          </p>
        </div>
        <div className="practice-top-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setItemFormType('topic');
              setShowItemModal(true);
            }}
          >
            ➕ Add Topic / Paper
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (items.length > 0) {
                setGenerateItemId(items[0].id);
                setShowGenerateModal(true);
              } else {
                setError('Create at least one topic or paper before generating questions.');
              }
            }}
          >
            ✨ AI Question Generator
          </button>
          <button className="btn btn-secondary" onClick={fetchPracticeData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {overrideSuccessMsg && (
        <div className="banner banner-success" style={{ marginBottom: '16px' }}>
          ✅ {overrideSuccessMsg}
        </div>
      )}

      {error && (
        <div className="banner banner-error" style={{ marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Due for Review Today</span>
          <span className={`stat-value ${dueQuestions.length > 0 ? 'text-amber' : 'text-green'}`}>
            {dueQuestions.length}
          </span>
          <span className="stat-subtext">
            {dueQuestions.length === 0 ? '🎉 All caught up for today!' : 'Pending active recall questions'}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Completed Today</span>
          <span className="stat-value text-purple">
            {practiceStatus?.completedTodayCount || 0}
          </span>
          <span className="stat-subtext">
            Goal: {practiceStatus?.minRequired || 1} daily deliberate practice(s)
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Study Bank Library</span>
          <span className="stat-value text-blue">
            {items.length}
          </span>
          <span className="stat-subtext">
            {items.reduce((acc, it) => acc + (it.questions?.length || 0), 0) || dueQuestions.length} active recall questions
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Device Lock Status</span>
          <div style={{ marginTop: '6px' }}>
            {practiceStatus?.isCompleted ? (
              <span className="status-pill status-verified">
                ✅ Complete {practiceStatus?.isManualOverride && '(Override)'}
              </span>
            ) : (
              <span className="status-pill status-pending">
                🔒 Practice Required
              </span>
            )}
          </div>
          <div style={{ marginTop: '8px' }}>
            {practiceStatus?.isManualOverride ? (
              <button className="btn-link text-xs" onClick={handleResetOverride}>
                Reset Manual Override
              </button>
            ) : (
              <button className="btn-link text-xs" onClick={() => setShowOverrideModal(true)}>
                Submit Manual Override
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs (Due Queue vs Study Bank) */}
      <div className="practice-nav-tabs">
        <button
          className={`tab-btn ${mainTab === 'due' ? 'active' : ''}`}
          onClick={() => setMainTab('due')}
        >
          📅 Due Practice Queue ({dueQuestions.length})
        </button>
        <button
          className={`tab-btn ${mainTab === 'bank' ? 'active' : ''}`}
          onClick={() => setMainTab('bank')}
        >
          📚 Study Bank & Question Library ({items.length})
        </button>
      </div>

      {/* TAB 1: Due Active Recall Queue */}
      {mainTab === 'due' && (
        <div className="due-queue-container">
          {dueQuestions.length === 0 ? (
            <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>🎉</span>
              <h3>All Due Deliberate Practice Complete</h3>
              <p className="text-secondary">
                You've completed all active recall items scheduled for today. SM-2 intervals have been updated.
              </p>
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setMainTab('bank')}>
                  Explore Study Bank Library
                </button>
              </div>
            </div>
          ) : (
            <div className="due-cards-list">
              {dueQuestions.map(q => (
                <div key={q.id} className="due-question-card">
                  <div className="due-card-header">
                    <div className="due-card-tags">
                      <span className={`badge ${q.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                        {q.answerTemplate === 'paper' ? '📄 PAPER' : '🧠 TOPIC'}
                      </span>
                      <span className="badge badge-difficulty">{q.difficulty || 'Hard'}</span>
                      {q.itemTags && q.itemTags.map((tag, idx) => (
                        <span key={idx} className="badge badge-tag">{tag}</span>
                      ))}
                    </div>
                    <div className="sm2-meta">
                      <span>Reps: <strong>{q.sm2?.repetitions || 0}</strong></span>
                      <span>Interval: <strong>{q.sm2?.intervalDays || 0}d</strong></span>
                      <span>Ease: <strong>{(q.sm2?.easeFactor || 2.5).toFixed(1)}</strong></span>
                    </div>
                  </div>

                  <h3 className="due-item-title">{q.itemTitle}</h3>
                  <div className="due-prompt markdown-rendered" style={{ margin: '14px 0', lineHeight: '1.65' }}>
                    {renderMarkdown(q.prompt)}
                  </div>

                  <div className="due-card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveQuestion(q);
                      }}
                    >
                      ⚡ Start Active Recall Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Study Bank Library */}
      {mainTab === 'bank' && (
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
            {filteredItems.map(item => (
              <div key={item.id} className="bank-item-card">
                <div className="bank-item-header">
                  <span className={`badge ${item.type === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                    {item.type === 'paper' ? '📄 PAPER' : '🧠 THEORY TOPIC'}
                  </span>
                  <div className="bank-item-menu">
                    <button
                      className="btn-icon"
                      title="Generate Questions"
                      onClick={() => {
                        setGenerateItemId(item.id);
                        setShowGenerateModal(true);
                      }}
                    >
                      ✨
                    </button>
                    <button
                      className="btn-icon"
                      title="Add Question"
                      onClick={() => {
                        setQuestionItemId(item.id);
                        setQuestionTemplate(item.type === 'paper' ? 'paper' : 'topic');
                        setShowQuestionModal(true);
                      }}
                    >
                      ➕
                    </button>
                    <button
                      className="btn-icon"
                      title="View Attempt History"
                      onClick={() => handleViewHistory(item)}
                    >
                      📜
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice Editor Studio Modal */}
      {activeQuestion && (
        <PracticeAnswerEditor
          question={activeQuestion}
          API_URL={API_URL}
          onClose={() => setActiveQuestion(null)}
          onAttemptCompleted={() => {
            fetchPracticeData();
            if (onRefreshStatus) onRefreshStatus();
          }}
        />
      )}

      {/* Add Topic / Paper Modal */}
      {showItemModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <h3>Add New Study Item</h3>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Item Type</label>
                <select
                  className="input-field"
                  value={itemFormType}
                  onChange={(e) => setItemFormType(e.target.value)}
                >
                  <option value="topic">🧠 Theory / Derivation Topic</option>
                  <option value="paper">📄 Landmark Research Paper</option>
                </select>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingItem}>
                  {savingItem ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showQuestionModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <h3>Add Active Recall Question</h3>
            <form onSubmit={handleSaveQuestion}>
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
                <label>Question Prompt</label>
                <textarea
                  className="input-field"
                  rows={4}
                  required
                  placeholder="State the exact derivation or claim to prove/synthesize..."
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuestionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingQuestion}>
                  {savingQuestion ? 'Creating...' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gemini AI Question Generator Modal */}
      {showGenerateModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <h3>✨ Gemini AI Question Generator</h3>
            <p className="modal-desc">
              Generate challenging, mathematically demanding active-recall questions for your study items.
            </p>
            {generateSuccessMsg && (
              <div className="banner banner-success" style={{ marginBottom: '12px' }}>
                {generateSuccessMsg}
              </div>
            )}
            <form onSubmit={handleGenerateQuestions}>
              <div className="form-group">
                <label>Target Topic / Paper</label>
                <select
                  className="input-field"
                  value={generateItemId}
                  onChange={(e) => setGenerateItemId(e.target.value)}
                >
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Number of Questions to Draft</label>
                <select
                  className="input-field"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                >
                  <option value={2}>2 Questions</option>
                  <option value={3}>3 Questions (Recommended)</option>
                  <option value={5}>5 Questions</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary" disabled={generating}>
                  {generating ? '✨ Generating via Gemini...' : '✨ Generate & Add to Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <h3>Manual Practice Override</h3>
            <p className="modal-desc">
              Mark today's consistent practice requirement as completed without submitting an in-app proof.
            </p>
            <form onSubmit={handleSubmitOverride}>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowOverrideModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingOverride}>
                  {submittingOverride ? 'Submitting...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attempt History Modal */}
      {historyItem && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card modal-lg">
            <h3>📜 Attempt History: {historyItem.title}</h3>
            {loadingHistory ? (
              <p>Loading historical evaluations...</p>
            ) : historyAttempts.length === 0 ? (
              <p className="empty-subtext">No practice attempts recorded yet for this item.</p>
            ) : (
              <div className="history-attempts-list">
                {historyAttempts.map(att => (
                  <div key={att.id} className="history-attempt-card glass-card">
                    <div className="history-header">
                      <span className="history-date">
                        📅 {new Date(att.submittedAt).toLocaleDateString()} {new Date(att.submittedAt).toLocaleTimeString()}
                      </span>
                      <span className={`badge-score score-${att.evaluation.score >= 8 ? 'high' : att.evaluation.score >= 5 ? 'mid' : 'low'}`}>
                        Score: {att.evaluation.score} / 10
                      </span>
                    </div>
                    <div className="history-critique markdown-rendered">
                      {renderMarkdown(att.evaluation.critique)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setHistoryItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
