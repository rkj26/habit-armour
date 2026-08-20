import React, { useState, useEffect } from 'react';
import PracticeAnswerEditor from './PracticeAnswerEditor';
import { renderMarkdown } from '../utils/renderMarkdown';

export default function PracticeView({ API_URL, status, onRefreshStatus }) {
  const [practiceStatus, setPracticeStatus] = useState(null);
  const [dueQuestions, setDueQuestions] = useState([]);
  const [dueGroups, setDueGroups] = useState([]);
  const [dueMetadata, setDueMetadata] = useState({
    dailyTarget: 5,
    completedToday: 0,
    targetMet: false,
    dueCount: 0,
    totalBankCount: 0,
    totalDueBacklog: 0,
    queuedNewTopicsCount: 0,
    newTopicsPerDay: 2
  });
  const [expandedDueGroups, setExpandedDueGroups] = useState({});
  const [allQuestions, setAllQuestions] = useState([]);
  const [items, setItems] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active Editor state
  const [activeQuestion, setActiveQuestion] = useState(null);

  // Tab & Filter states
  const [mainTab, setMainTab] = useState('due'); // 'due', 'all-questions', 'performance', 'bank'
  const [bankFilter, setBankFilter] = useState('all'); // 'all', 'topic', 'paper'
  const [questionFilter, setQuestionFilter] = useState('all'); // 'all', 'due', 'topic', 'paper', 'Hard', 'Medium', 'atomic'
  const [perfFilter, setPerfFilter] = useState('all'); // 'all', 'Mastered', 'Proficient', 'Developing', 'Needs Work'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

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

  // Manual Override Modal

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Reviewed proofs in physical notebook / paper');
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState(null);

  // Attempt History Drawer / Modal
  const [historyItem, setHistoryItem] = useState(null);
  const [historyAttempts, setHistoryAttempts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const getBaseUrl = () => {
    if (API_URL && typeof API_URL === 'string' && API_URL.trim()) {
      return API_URL.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      return window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;
    }
    return '';
  };

  const fetchPracticeData = async () => {
    setLoading(true);
    setError(null);
    const baseUrl = getBaseUrl();
    try {
      const [statusRes, dueRes, itemsRes, questionsRes, perfRes] = await Promise.all([
        fetch(`${baseUrl}/api/practice/status`),
        fetch(`${baseUrl}/api/practice/due`),
        fetch(`${baseUrl}/api/practice/items`),
        fetch(`${baseUrl}/api/practice/questions`),
        fetch(`${baseUrl}/api/practice/performance`)
      ]);

      const statusData = await statusRes.json().catch(() => ({}));
      const dueData = await dueRes.json().catch(() => ({}));
      const itemsData = await itemsRes.json().catch(() => ({}));
      const questionsData = await questionsRes.json().catch(() => ({}));
      const perfData = await perfRes.json().catch(() => ({}));

      if (!statusRes.ok) throw new Error(statusData.detail || statusData.error || 'Failed to fetch practice status');
      if (!dueRes.ok) throw new Error(dueData.detail || dueData.error || 'Failed to fetch due queue');
      if (!itemsRes.ok) throw new Error(itemsData.detail || itemsData.error || 'Failed to fetch study bank');
      if (!questionsRes.ok) throw new Error(questionsData.detail || questionsData.error || 'Failed to fetch questions');

      setPracticeStatus(statusData);
      setDueMetadata(dueData);
      setDueQuestions(dueData.dueQuestions || []);
      setDueGroups(dueData.dueGroups || []);
      setItems(itemsData.items || []);
      setAllQuestions(questionsData.questions || []);
      if (perfRes.ok) setPerformanceData(perfData);
    } catch (err) {
      console.error('Fetch practice error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceBacklog = async (cardsPerDay = 5) => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/balance-backlog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardsPerDay })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || 'Failed to balance backlog');
      }
      setSuccessMsg(`⚡ ${data.message}`);
      fetchPracticeData();
      if (onRefreshStatus) onRefreshStatus();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Balance backlog error:', err);
      setError(`Failed to balance backlog: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticeData();
  }, [API_URL]);

  const toggleItemExpand = (itemId) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

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

      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to save item');

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
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/questions`, {
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
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to create question');

      setShowQuestionModal(false);
      setQuestionPrompt('');
      fetchPracticeData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingQuestion(false);
    }
  };


  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    setSubmittingOverride(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to apply manual override');

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
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/reset-override`, { method: 'POST' });
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
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/attempts?itemId=${item.id}`);
      const data = await res.json();
      setHistoryAttempts(data.attempts || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtered Study Items
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

  // Filtered All Questions
  const filteredQuestions = allQuestions.filter(q => {
    if (questionFilter === 'due') {
      const today = practiceStatus?.today || new Date().toISOString().split('T')[0];
      const dueDate = q.fsrs?.dueDate || q.sm2?.dueDate;
      if (!dueDate || dueDate > today) return false;
    } else if (questionFilter === 'topic') {
      if (q.itemType !== 'topic' && q.answerTemplate !== 'topic') return false;
    } else if (questionFilter === 'paper') {
      if (q.itemType !== 'paper' && q.answerTemplate !== 'paper') return false;
    } else if (questionFilter === 'atomic') {
      if (q.source !== 'gemini-decomposed' && q.source !== 'gemini-generated') return false;
    } else if (questionFilter === 'Hard' || questionFilter === 'Medium' || questionFilter === 'Easy') {
      if (q.difficulty !== questionFilter) return false;
    }

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      const promptMatch = q.prompt?.toLowerCase().includes(sq);
      const titleMatch = q.itemTitle?.toLowerCase().includes(sq);
      const tagsMatch = q.itemTags?.some(t => t.toLowerCase().includes(sq));
      return promptMatch || titleMatch || tagsMatch;
    }
    return true;
  });

  // Filtered Performance Questions
  const filteredPerfQuestions = (performanceData?.questions || []).filter(q => {
    if (perfFilter !== 'all' && q.statusTier !== perfFilter) return false;
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      const promptMatch = q.prompt?.toLowerCase().includes(sq);
      const titleMatch = q.itemTitle?.toLowerCase().includes(sq);
      return promptMatch || titleMatch;
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
            FSRS-5 (DSR Model) spaced repetition for AI Safety, RL Derivations, Mechanistic Interpretability & ML Papers.
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
          <button className="btn btn-secondary" onClick={fetchPracticeData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="banner banner-success" style={{ marginBottom: '16px' }}>
          {successMsg}
        </div>
      )}

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
          <span className="stat-label">Scheduled Due Today</span>
          <span className={`stat-value ${dueQuestions.length > 0 ? (dueQuestions.length > (dueMetadata?.dailyTarget || 5) * 2 ? 'text-amber' : 'text-purple') : 'text-green'}`}>
            {dueQuestions.length}
          </span>
          <span className="stat-subtext">
            {dueQuestions.length === 0 ? '🎉 All caught up for today!' : `Daily Target: ${dueMetadata?.dailyTarget || 5} cards/day`}
          </span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Today's Goal Progress</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: (dueMetadata?.completedToday || 0) >= (dueMetadata?.dailyTarget || 5) ? '#22c55e' : '#a855f7' }}>
              {(dueMetadata?.completedToday || 0) >= (dueMetadata?.dailyTarget || 5) ? '✓ Goal Met' : `${Math.round(((dueMetadata?.completedToday || 0) / (dueMetadata?.dailyTarget || 5)) * 100)}%`}
            </span>
          </div>
          <span className="stat-value text-purple" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {dueMetadata?.completedToday || practiceStatus?.completedTodayCount || 0}
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              / {dueMetadata?.dailyTarget || 5} cards
            </span>
          </span>
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginTop: '8px'
          }}>
            <div style={{
              width: `${Math.min(100, (((dueMetadata?.completedToday || 0) / (dueMetadata?.dailyTarget || 5)) * 100))}%`,
              height: '100%',
              background: (dueMetadata?.completedToday || 0) >= (dueMetadata?.dailyTarget || 5) ? 'linear-gradient(90deg, #22c55e, #4ade80)' : 'linear-gradient(90deg, #6366f1, #a855f7)',
              borderRadius: '3px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Question Bank</span>
          <span className="stat-value text-blue">
            {allQuestions.length}
          </span>
          <span className="stat-subtext">
            Across {items.length} AI Safety / ML topics & papers
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
                🔒 {Math.max(0, (practiceStatus?.minRequired || 1) - (practiceStatus?.completedTodayCount || 0))} Practice Needed to Clear
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

      {/* Main Tabs (Due Queue vs All Questions vs Performance & Mastery vs Study Bank) */}
      <div className="practice-nav-tabs">
        <button
          className={`tab-btn ${mainTab === 'due' ? 'active' : ''}`}
          onClick={() => setMainTab('due')}
        >
          📅 Due Today ({dueQuestions.length})
        </button>
        <button
          className={`tab-btn ${mainTab === 'all-questions' ? 'active' : ''}`}
          onClick={() => setMainTab('all-questions')}
        >
          📖 All Questions & Free Recall ({allQuestions.length})
        </button>
        <button
          className={`tab-btn ${mainTab === 'performance' ? 'active' : ''}`}
          onClick={() => setMainTab('performance')}
        >
          📈 Performance & FSRS Mastery ({allQuestions.length})
        </button>
        <button
          className={`tab-btn ${mainTab === 'bank' ? 'active' : ''}`}
          onClick={() => setMainTab('bank')}
        >
          📚 Study Bank Topics ({items.length})
        </button>
      </div>

      {/* TAB 1: Due Active Recall Queue */}
      {mainTab === 'due' && (
        <div className="due-queue-container">
          {/* Backlog Load Balancer Banner */}
          {dueQuestions.length > (dueMetadata?.dailyTarget || 5) && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <div style={{ flex: '1 1 320px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <span>⚡ Backlog Load Balancer</span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.25)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '10px' }}>
                    {dueQuestions.length} Cards Clumped on Today
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
                  Stagger all unreviewed/backlog cards across upcoming days grouped by topic so you do a crisp <strong>5 cards/day</strong> (~10 mins) without burnout!
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700 }}
                  onClick={() => handleBalanceBacklog(5)}
                  disabled={loading}
                >
                  ⚡ Distribute Backlog (5 cards/day)
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  onClick={() => handleBalanceBacklog(3)}
                  disabled={loading}
                  title="Light pace: 3 cards/day"
                >
                  3 / day
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  onClick={() => handleBalanceBacklog(10)}
                  disabled={loading}
                  title="Fast pace: 10 cards/day"
                >
                  10 / day
                </button>
              </div>
            </div>
          )}

          {dueQuestions.length > 0 && (
            <div className="burnout-safe-banner">
              <span style={{ fontSize: '1.2rem' }}>🛡️</span>
              <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.5' }}>
                <strong>FSRS-5 DSR Pacing:</strong> Aim for 3–5 bite-sized questions (~5–10 mins total). Difficulty, Stability ($S$), and Retrievability ($R$) prevent memory decay while eliminating burnout repeat loops!
              </div>
            </div>
          )}

          {dueMetadata?.queuedNewTopicsCount > 0 && (
            <div className="burnout-safe-banner" style={{ background: '#eef2ff', borderColor: 'rgba(79,70,229,0.25)' }}>
              <span style={{ fontSize: '1.2rem' }}>🗓️</span>
              <div style={{ fontSize: '0.85rem', color: '#4338ca', lineHeight: '1.5' }}>
                <strong>{dueMetadata.queuedNewTopicsCount} more new topic{dueMetadata.queuedNewTopicsCount === 1 ? '' : 's'} queued</strong> — showing {dueMetadata.newTopicsPerDay || 2} new topic area{(dueMetadata.newTopicsPerDay || 2) === 1 ? '' : 's'}/day so you're not flooded. They'll surface on upcoming days (topics you've already started always show their reviews in full). Adjust the pace in Settings.
              </div>
            </div>
          )}

          {dueQuestions.length === 0 ? (
            <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>🎉</span>
              <h3>All Due Deliberate Practice Complete!</h3>
              <p className="text-secondary">
                You've completed all active recall questions scheduled for today. Want to drill ahead in Free Recall mode?
              </p>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => setMainTab('all-questions')}>
                  🚀 Practice Any Question (Free Recall Mode)
                </button>
                <button className="btn btn-secondary" onClick={() => setMainTab('performance')}>
                  View FSRS Mastery Analytics
                </button>
              </div>
            </div>
          ) : (
            <div className="due-cards-list">
              {dueGroups.map(group => {
                const isExpanded = expandedDueGroups[group.itemId] !== false; // default: expanded
                const isReview = group.isReview;
                const doneCount = group.completedTodayCount || 0;
                const totalCount = group.dueCount || group.questions.length;
                const groupTags = (group.itemTags || []).filter(t => !t.startsWith('Section:'));
                const sectionTag = (group.itemTags || []).find(t => t.startsWith('Section:'));

                return (
                  <div key={group.itemId} className="due-topic-group" style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    background: '#ffffff',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '20px',
                    overflow: 'hidden'
                  }}>
                    <div
                      onClick={() => setExpandedDueGroups(prev => ({ ...prev, [group.itemId]: !isExpanded }))}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 20px', cursor: 'pointer', background: '#f8fafc',
                        borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: isReview ? 'rgba(16,185,129,0.15)' : 'rgba(79,70,229,0.15)', color: isReview ? '#059669' : '#4f46e5', fontWeight: 700 }}>
                            {isReview ? '🔁 Review' : '✨ New Topic'}
                          </span>
                          <span className={`badge ${group.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                            {group.answerTemplate === 'paper' ? '📄 PAPER' : '🧠 TOPIC'}
                          </span>
                          {sectionTag && <span className="badge badge-tag">{sectionTag.replace('Section: ', '')}</span>}
                          {groupTags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="badge badge-tag">{tag}</span>
                          ))}
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{group.itemTitle}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="sm2-meta">{doneCount}/{totalCount} done today</span>
                        <span style={{ fontSize: '1.1rem' }}>{isExpanded ? '▼' : '▶'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {group.questions.map((q, qIdx) => {
                          const stab = q.fsrs?.stability ? `${q.fsrs.stability}d` : `${q.sm2?.intervalDays || 0}d`;
                          const retriev = q.fsrs?.retrievability !== undefined ? Math.round(q.fsrs.retrievability * 100) : null;
                          const diff = q.fsrs?.difficulty ? `${q.fsrs.difficulty}/10` : '5.0/10';

                          return (
                            <div key={q.id} className="due-question-card" style={{ marginBottom: 0, opacity: q.completedToday ? 0.6 : 1 }}>
                              <div className="due-card-header">
                                <div className="due-card-tags">
                                  <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 700 }}>#{qIdx + 1}</span>
                                  <span className="badge badge-difficulty">{q.difficulty || 'Medium'}</span>
                                  <span className="badge badge-time">⏱️ ~1-2 min</span>
                                  {q.hasModelSolution && (
                                    <span className="badge badge-cached">⚡ Solution Saved</span>
                                  )}
                                  {q.completedToday && (
                                    <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#059669' }}>✓ Done today</span>
                                  )}
                                </div>
                                <div className="sm2-meta">
                                  <span>Stability: <strong>{stab}</strong></span>
                                  {retriev !== null && (
                                    <span>Recall: <strong style={{ color: retriev >= 90 ? '#166534' : '#ea580c' }}>{retriev}%</strong></span>
                                  )}
                                  <span>Diff: <strong>{diff}</strong></span>
                                </div>
                              </div>

                              <div className="due-prompt markdown-rendered" style={{ margin: '14px 0', lineHeight: '1.65' }}>
                                {renderMarkdown(q.prompt)}
                              </div>

                              <div className="due-card-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: All Questions & Free Recall Library */}
      {mainTab === 'all-questions' && (
        <div className="practice-bank-view">
          {/* Filter Bar */}
          <div className="bank-filter-bar">
            <div className="filter-buttons">
              <button
                className={`btn-filter ${questionFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('all')}
              >
                All ({allQuestions.length})
              </button>
              <button
                className={`btn-filter ${questionFilter === 'due' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('due')}
              >
                📅 Due Today ({dueQuestions.length})
              </button>
              <button
                className={`btn-filter ${questionFilter === 'atomic' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('atomic')}
              >
                ⚡ Atomic Questions ({allQuestions.filter(q => q.source === 'gemini-decomposed' || q.source === 'gemini-generated').length})
              </button>
              <button
                className={`btn-filter ${questionFilter === 'topic' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('topic')}
              >
                🧠 Theory ({allQuestions.filter(q => q.itemType === 'topic' || q.answerTemplate === 'topic').length})
              </button>
              <button
                className={`btn-filter ${questionFilter === 'paper' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('paper')}
              >
                📄 Papers ({allQuestions.filter(q => q.itemType === 'paper' || q.answerTemplate === 'paper').length})
              </button>
            </div>
            <div className="search-box">
              <input
                type="text"
                className="input-field"
                placeholder="Search questions, proofs, concepts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* All Questions List */}
          <div className="due-cards-list">
            {filteredQuestions.length === 0 ? (
              <div className="empty-state card" style={{ padding: '36px', textAlign: 'center' }}>
                <p className="text-secondary">No questions match your current search or filter criteria.</p>
              </div>
            ) : (
              filteredQuestions.map(q => {
                const today = practiceStatus?.today || new Date().toISOString().split('T')[0];
                const dueDate = q.fsrs?.dueDate || q.sm2?.dueDate;
                const isDueToday = dueDate && dueDate <= today;
                const stab = q.fsrs?.stability ? `${q.fsrs.stability}d` : `${q.sm2?.intervalDays || 0}d`;
                const retriev = q.fsrs?.retrievability !== undefined ? Math.round(q.fsrs.retrievability * 100) : null;
                const diff = q.fsrs?.difficulty ? `${q.fsrs.difficulty}/10` : '5.0/10';

                return (
                  <div key={q.id} className="due-question-card">
                    <div className="due-card-header">
                      <div className="due-card-tags">
                        <span className={`badge ${q.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                          {q.answerTemplate === 'paper' ? '📄 PAPER' : '🧠 THEORY'}
                        </span>
                        <span className="badge badge-difficulty">{q.difficulty || 'Medium'}</span>
                        <span className="badge badge-time">
                          ⏱️ ~1-2 min
                        </span>
                        {q.hasModelSolution && (
                          <span className="badge badge-cached">
                            ⚡ Solution Saved
                          </span>
                        )}
                        {q.itemTags && q.itemTags.map((tag, idx) => (
                          <span key={idx} className="badge badge-tag">{tag}</span>
                        ))}
                      </div>
                      <div className="sm2-meta">
                        <span>Stability: <strong>{stab}</strong></span>
                        {retriev !== null && (
                          <span>Recall: <strong style={{ color: retriev >= 90 ? '#166534' : '#ea580c' }}>{retriev}%</strong></span>
                        )}
                        <span>Diff: <strong>{diff}</strong></span>
                        <span>Due: <strong style={{ color: isDueToday ? '#ea580c' : '#4f46e5' }}>{isDueToday ? 'Today' : dueDate || 'Pending'}</strong></span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Topic: {q.itemTitle}
                    </div>

                    <div className="due-prompt markdown-rendered" style={{ margin: '10px 0 14px 0', lineHeight: '1.65' }}>
                      {renderMarkdown(q.prompt)}
                    </div>

                    <div className="due-card-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setActiveQuestion(q);
                        }}
                      >
                        ⚡ Practice Now (Free Recall)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Performance & FSRS Mastery Analytics */}
      {mainTab === 'performance' && (
        <div className="performance-dashboard-view">
          {/* Performance Summary Cards */}
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <span className="stat-label">🌟 Mastered Questions</span>
              <span className="stat-value text-green">
                {performanceData?.summary?.masteredCount || 0}
              </span>
              <span className="stat-subtext">Score ≥ 8.5/10 (FSRS Easy Grade)</span>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <span className="stat-label">✅ Proficient</span>
              <span className="stat-value text-blue">
                {performanceData?.summary?.proficientCount || 0}
              </span>
              <span className="stat-subtext">Score 7.0 – 8.4/10 (FSRS Good Grade)</span>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span className="stat-label">⚡ Developing</span>
              <span className="stat-value text-amber">
                {performanceData?.summary?.developingCount || 0}
              </span>
              <span className="stat-subtext">Score 5.0 – 6.9/10 (FSRS Hard Grade)</span>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <span className="stat-label">🚩 Needs Reinforcement</span>
              <span className="stat-value text-red">
                {performanceData?.summary?.needsWorkCount || 0}
              </span>
              <span className="stat-subtext">Score &lt; 5.0/10 (FSRS Again / Lapse)</span>
            </div>
          </div>

          {/* Topic-Level Mastery Overview */}
          {performanceData?.topics && performanceData.topics.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem' }}>📚 Mastery by Study Topic & Paper</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {performanceData.topics.map(t => (
                  <div key={t.itemId} style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.title}</span>
                      <span className="badge badge-topic">{t.masteryRate}% Mastered</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', margin: '8px 0' }}>
                      <div
                        style={{
                          width: `${t.masteryRate}%`,
                          height: '100%',
                          background: t.masteryRate >= 75 ? '#10b981' : t.masteryRate >= 40 ? '#3b82f6' : '#f59e0b',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{t.questionCount} Questions ({t.attemptCount} Attempts)</span>
                      <span>Avg Score: <strong>{t.averageScore ? `${t.averageScore}/10` : '—'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar for Question Mastery */}
          <div className="bank-filter-bar">
            <div className="filter-buttons">
              <button
                className={`btn-filter ${perfFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPerfFilter('all')}
              >
                All ({performanceData?.questions?.length || 0})
              </button>
              <button
                className={`btn-filter ${perfFilter === 'Mastered' ? 'active' : ''}`}
                onClick={() => setPerfFilter('Mastered')}
              >
                🌟 Mastered ({performanceData?.questions?.filter(q => q.statusTier === 'Mastered').length || 0})
              </button>
              <button
                className={`btn-filter ${perfFilter === 'Proficient' ? 'active' : ''}`}
                onClick={() => setPerfFilter('Proficient')}
              >
                ✅ Proficient ({performanceData?.questions?.filter(q => q.statusTier === 'Proficient').length || 0})
              </button>
              <button
                className={`btn-filter ${perfFilter === 'Developing' ? 'active' : ''}`}
                onClick={() => setPerfFilter('Developing')}
              >
                ⚡ Developing ({performanceData?.questions?.filter(q => q.statusTier === 'Developing').length || 0})
              </button>
              <button
                className={`btn-filter ${perfFilter === 'Needs Work' ? 'active' : ''}`}
                onClick={() => setPerfFilter('Needs Work')}
              >
                🚩 Needs Work ({performanceData?.questions?.filter(q => q.statusTier === 'Needs Work').length || 0})
              </button>
            </div>
            <div className="search-box">
              <input
                type="text"
                className="input-field"
                placeholder="Search FSRS mastery tracker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Per-Question Score History & Trajectory Cards */}
          <div className="due-cards-list">
            {filteredPerfQuestions.length === 0 ? (
              <div className="empty-state card" style={{ padding: '36px', textAlign: 'center' }}>
                <p className="text-secondary">No questions match your current mastery filter.</p>
              </div>
            ) : (
              filteredPerfQuestions.map(q => {
                const fullQ = allQuestions.find(aq => aq.id === q.questionId) || q;
                const stab = q.fsrs?.stability ? `${q.fsrs.stability}d` : `${q.intervalDays}d`;
                const retriev = q.fsrs?.retrievability !== undefined ? Math.round(q.fsrs.retrievability * 100) : null;
                const diff = q.fsrs?.difficulty ? `${q.fsrs.difficulty}/10` : '5.0/10';

                return (
                  <div key={q.questionId} className="due-question-card">
                    <div className="due-card-header">
                      <div className="due-card-tags">
                        <span className={`badge ${
                          q.statusTier === 'Mastered' ? 'badge-verified' :
                          q.statusTier === 'Proficient' ? 'badge-topic' :
                          q.statusTier === 'Developing' ? 'badge-difficulty' : 'badge-danger'
                        }`}>
                          {q.statusTier === 'Mastered' ? '🌟 Mastered' :
                           q.statusTier === 'Proficient' ? '✅ Proficient' :
                           q.statusTier === 'Developing' ? '⚡ Developing' :
                           q.statusTier === 'Needs Work' ? '🚩 Needs Work' : '⚪ Not Started'}
                        </span>
                        <span className="badge badge-difficulty">{q.difficulty}</span>
                        {q.hasModelSolution && (
                          <span className="badge badge-cached">
                            ⚡ Solution Cached in DB
                          </span>
                        )}
                      </div>
                      <div className="sm2-meta">
                        <span>Stability ($S$): <strong>{stab}</strong></span>
                        {retriev !== null && (
                          <span>Recall ($R$): <strong style={{ color: retriev >= 90 ? '#166534' : '#ea580c' }}>{retriev}%</strong></span>
                        )}
                        <span>Diff ($D$): <strong>{diff}</strong></span>
                        <span>Attempts: <strong>{q.totalAttempts}</strong></span>
                        <span>Avg: <strong>{q.averageScore ? `${q.averageScore}/10` : '—'}</strong></span>
                        <span>Due: <strong>{q.dueDate}</strong></span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Topic: {q.itemTitle}
                    </div>

                    <div className="due-prompt markdown-rendered" style={{ margin: '8px 0 12px 0', lineHeight: '1.6' }}>
                      {renderMarkdown(q.prompt)}
                    </div>

                    {/* Historical Score Progression Trajectory */}
                    {q.recentScores && q.recentScores.length > 0 && (
                      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', margin: '10px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          📈 Score Trajectory:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {q.recentScores.map((score, sIdx) => (
                            <React.Fragment key={sIdx}>
                              {sIdx > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>}
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  background: score >= 8.5 ? '#dcfce7' : score >= 7.0 ? '#dbeafe' : score >= 5.0 ? '#fef3c7' : '#fee2e2',
                                  color: score >= 8.5 ? '#166534' : score >= 7.0 ? '#1e40af' : score >= 5.0 ? '#92400e' : '#991b1b'
                                }}
                              >
                                {score}/10
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="due-card-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setActiveQuestion(fullQ);
                        }}
                      >
                        ⚡ Practice Question
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Study Bank Topics & Papers */}
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
            {filteredItems.map(item => {
              const itemQuestions = allQuestions.filter(q => q.itemId === item.id).sort((a, b) => (a.order || 0) - (b.order || 0));
              const isExpanded = !!expandedItems[item.id];

              return (
                <div key={item.id} className="bank-item-card">
                  <div className="bank-item-header">
                    <span className={`badge ${item.type === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
                      {item.type === 'paper' ? '📄 PAPER' : '🧠 THEORY TOPIC'}
                    </span>
                    <div className="bank-item-menu">
                      <button
                        className="btn-icon"
                        title="Add Manual Question"
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
                            No questions added yet. Click ✨ to generate questions via Gemini.
                          </div>
                        ) : (
                          itemQuestions.map((q, qIdx) => (
                            <div key={q.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
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
                                  onClick={() => {
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setActiveQuestion(q);
                                  }}
                                >
                                  ⚡ Practice
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
            })}
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
          <div className="modal-content glass-card modal-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📜 Attempt History: {historyItem.title}</h3>
              <button className="btn-icon" onClick={() => setHistoryItem(null)}>✕</button>
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
              <button type="button" className="btn btn-primary" onClick={() => setHistoryItem(null)}>
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
