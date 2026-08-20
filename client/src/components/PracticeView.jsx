import React, { useState, useEffect, useRef } from 'react';
import DueQueueSection from './practice/DueQueueSection';
import ActiveRecallSession from './practice/ActiveRecallSession';
import AllQuestionsSection from './practice/AllQuestionsSection';
import PerformanceSection from './practice/PerformanceSection';
import TopicBankSection from './practice/TopicBankSection';
import {
  ItemModal,
  QuestionModal,
  ManualOverrideModal,
  AttemptHistoryModal
} from './practice/PracticeModals';

export default function PracticeView({ getBaseUrl }) {
  // Navigation & Sub-tabs
  const [mainTab, setMainTab] = useState('due'); // 'due' | 'questions' | 'performance' | 'bank'
  const [bankFilter, setBankFilter] = useState('all'); // 'all' | 'topic' | 'paper'
  const [questionFilter, setQuestionFilter] = useState('all'); // 'all' | 'easy' | 'medium' | 'hard'

  // Data state
  const [items, setItems] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [dueQuestions, setDueQuestions] = useState([]);
  const [dueGroups, setDueGroups] = useState([]);
  const [dueData, setDueData] = useState(null);
  const [practiceStatus, setPracticeStatus] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active Practice Workspace state
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answerMarkdown, setAnswerMarkdown] = useState('');
  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [practiceTimer, setPracticeTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Instant Cached Model Solution state
  const [activeModelSolution, setActiveModelSolution] = useState(null);
  const [loadingModelSolution, setLoadingModelSolution] = useState(false);

  // Search & Accordion Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedDueGroups, setExpandedDueGroups] = useState({});

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormType, setItemFormType] = useState('topic');
  const [itemFormTitle, setItemFormTitle] = useState('');
  const [itemFormTags, setItemFormTags] = useState('');
  const [itemFormNotes, setItemFormNotes] = useState('');
  const [paperArxivId, setPaperArxivId] = useState('');
  const [paperAuthors, setPaperAuthors] = useState('');
  const [paperYear, setPaperYear] = useState(new Date().getFullYear());
  const [editingItemId, setEditingItemId] = useState(null);
  const [savingItem, setSavingItem] = useState(false);

  // Add Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionItemId, setQuestionItemId] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionTemplate, setQuestionTemplate] = useState('topic');
  const [questionDifficulty, setQuestionDifficulty] = useState('Medium');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Reviewed proofs in physical notebook / paper');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Attempt History Drawer / Modal
  const [historyItem, setHistoryItem] = useState(null);
  const [historyAttempts, setHistoryAttempts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchPracticeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();

      const [itemsRes, questionsRes, dueRes, statusRes, perfRes] = await Promise.all([
        fetch(`${baseUrl}/api/practice/items`),
        fetch(`${baseUrl}/api/practice/questions`),
        fetch(`${baseUrl}/api/practice/due`),
        fetch(`${baseUrl}/api/practice/status`),
        fetch(`${baseUrl}/api/practice/performance`)
      ]);

      if (!itemsRes.ok || !questionsRes.ok || !dueRes.ok) {
        throw new Error('Failed to fetch consistent practice datasets');
      }

      const itemsData = await itemsRes.json();
      const questionsData = await questionsRes.json();
      const dueDataRes = await dueRes.json();
      const statusData = statusRes.ok ? await statusRes.json() : null;
      const perfData = perfRes.ok ? await perfRes.json() : null;

      setItems(itemsData.items || []);
      setAllQuestions(questionsData.questions || []);
      setDueQuestions(dueDataRes.dueQuestions || []);
      setDueGroups(dueDataRes.dueGroups || []);
      setDueData(dueDataRes);
      setPracticeStatus(statusData);
      setPerformanceData(perfData);

      if (itemsData.items && itemsData.items.length > 0 && !questionItemId) {
        setQuestionItemId(itemsData.items[0].id);
      }
    } catch (err) {
      console.error('PracticeView fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticeData();
  }, []);

  // Practice Timer Hook
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setPracticeTimer(prev => prev + 1);
      }, 1000);
    } else if (!isTimerRunning && practiceTimer !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, practiceTimer]);

  const startPracticeSession = (question) => {
    setActiveQuestion(question);
    setAnswerMarkdown('');
    setEvaluationResult(null);
    setActiveModelSolution(null);
    setPracticeTimer(0);
    setIsTimerRunning(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closePracticeSession = () => {
    setActiveQuestion(null);
    setAnswerMarkdown('');
    setEvaluationResult(null);
    setActiveModelSolution(null);
    setIsTimerRunning(false);
    setPracticeTimer(0);
  };

  const toggleItemExpand = (itemId) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleDueGroupExpand = (itemId) => {
    setExpandedDueGroups(prev => ({
      ...prev,
      [itemId]: prev[itemId] === undefined ? false : !prev[itemId]
    }));
  };

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormTitle.trim()) return;

    setSavingItem(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const payload = {
        title: itemFormTitle.trim(),
        type: itemFormType,
        tags: itemFormTags,
        notes: itemFormNotes.trim(),
        paper: itemFormType === 'paper' ? {
          arxivId: paperArxivId.trim() || undefined,
          authors: paperAuthors.split(',').map(s => s.trim()).filter(Boolean),
          year: parseInt(paperYear, 10) || new Date().getFullYear(),
          url: paperArxivId.trim() ? `https://arxiv.org/abs/${paperArxivId.trim()}` : undefined
        } : undefined
      };

      const url = editingItemId
        ? `${baseUrl}/api/practice/items/${editingItemId}`
        : `${baseUrl}/api/practice/items`;
      const method = editingItemId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to save study item');

      setSuccessMsg(`Successfully saved "${payload.title}"`);
      setShowItemModal(false);
      resetItemForm();
      fetchPracticeData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItem(false);
    }
  };

  const resetItemForm = () => {
    setItemFormTitle('');
    setItemFormType('topic');
    setItemFormTags('');
    setItemFormNotes('');
    setPaperArxivId('');
    setPaperAuthors('');
    setPaperYear(new Date().getFullYear());
    setEditingItemId(null);
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemFormTitle(item.title);
    setItemFormType(item.type);
    setItemFormTags(item.tags ? item.tags.join(', ') : '');
    setItemFormNotes(item.notes || '');
    if (item.paper) {
      setPaperArxivId(item.paper.arxivId || '');
      setPaperAuthors(item.paper.authors ? item.paper.authors.join(', ') : '');
      setPaperYear(item.paper.year || new Date().getFullYear());
    }
    setShowItemModal(true);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this topic and deactivate its questions?')) return;
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      setSuccessMsg('Item deleted');
      fetchPracticeData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionPrompt.trim() || !questionItemId) return;

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

      setSuccessMsg('Active recall question added to bank');
      setShowQuestionModal(false);
      setQuestionPrompt('');
      fetchPracticeData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleSubmitAttempt = async (e) => {
    e.preventDefault();
    if (!activeQuestion || !answerMarkdown.trim()) return;

    setIsSubmittingAttempt(true);
    setIsTimerRunning(false);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          answerMarkdown: answerMarkdown.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to evaluate answer');

      setEvaluationResult(data.attempt);
      fetchPracticeData();
    } catch (err) {
      setError(err.message);
      setIsTimerRunning(true);
    } finally {
      setIsSubmittingAttempt(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const baseUrl = getBaseUrl();
          const res = await fetch(`${baseUrl}/api/practice/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl,
              questionId: activeQuestion?.id || 'practice_image'
            })
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.detail || 'Image upload failed');

          const imageMarkdown = `\n\n![Proof Sketch / Diagram](${data.url})\n\n`;
          setAnswerMarkdown(prev => prev + imageMarkdown);
        } catch (err) {
          setError(`Upload error: ${err.message}`);
        } finally {
          setImageUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
      setImageUploading(false);
    }
  };

  const fetchModelSolution = async () => {
    if (!activeQuestion) return;
    setLoadingModelSolution(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/questions/${activeQuestion.id}/model-solution`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch master model solution');
      setActiveModelSolution(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingModelSolution(false);
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
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to apply practice override');

      setSuccessMsg('Manual practice override applied for today.');
      setShowOverrideModal(false);
      fetchPracticeData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResetOverride = async () => {
    if (!window.confirm('Reset today’s manual practice override and re-lock requirements?')) return;
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/reset-override`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset override');
      setSuccessMsg('Practice override reset.');
      fetchPracticeData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
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
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="practice-view-container">
      {/* Header & Status Bar */}
      <div className="practice-header glass-card">
        <div className="practice-title-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pillar-icon">🧠</span>
            <div>
              <h1 className="pillar-title">Consistent Practice (FSRS-5 Spaced Repetition)</h1>
              <p className="pillar-subtitle">
                Mathematical active recall for ML theory, RL mechanics, and landmark papers.
              </p>
            </div>
          </div>

          <div className="practice-gate-status">
            {practiceStatus && (
              <div className="gate-badge-wrapper">
                {practiceStatus.isCompleted ? (
                  <span className="badge badge-success">
                    {practiceStatus.isManualOverride ? '⚡ OVERRIDE UNLOCKED' : '🔓 GATE UNLOCKED'}
                  </span>
                ) : (
                  <span className="badge badge-locked">
                    🔒 LOCK ACTIVE ({practiceStatus.completedTodayCount}/{practiceStatus.minRequired} required)
                  </span>
                )}
                {practiceStatus.isManualOverride ? (
                  <button className="btn-link" onClick={handleResetOverride} style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                    Reset Override
                  </button>
                ) : (
                  <button className="btn-link" onClick={() => setShowOverrideModal(true)} style={{ fontSize: '0.75rem' }}>
                    Manual Override
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="practice-tab-nav">
          <button
            className={`practice-tab-btn ${mainTab === 'due' ? 'active' : ''}`}
            onClick={() => setMainTab('due')}
          >
            🎯 Due Today & Queue ({dueQuestions.length})
          </button>
          <button
            className={`practice-tab-btn ${mainTab === 'bank' ? 'active' : ''}`}
            onClick={() => setMainTab('bank')}
          >
            📚 Study Bank ({items.length} Topics)
          </button>
          <button
            className={`practice-tab-btn ${mainTab === 'questions' ? 'active' : ''}`}
            onClick={() => setMainTab('questions')}
          >
            ⚡ All Questions ({allQuestions.length})
          </button>
          <button
            className={`practice-tab-btn ${mainTab === 'performance' ? 'active' : ''}`}
            onClick={() => setMainTab('performance')}
          >
            📊 Mastery & Analytics
          </button>
        </div>

        {/* Top Actions */}
        <div className="practice-top-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              resetItemForm();
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

      {error && (
        <div className="banner banner-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Active Recall Practice Session Workspace Overlay */}
      {activeQuestion && (
        <ActiveRecallSession
          activeQuestion={activeQuestion}
          onClose={closePracticeSession}
          answerMarkdown={answerMarkdown}
          setAnswerMarkdown={setAnswerMarkdown}
          isSubmittingAttempt={isSubmittingAttempt}
          evaluationResult={evaluationResult}
          imageUploading={imageUploading}
          fileInputRef={fileInputRef}
          handleImageUpload={handleImageUpload}
          handleSubmitAttempt={handleSubmitAttempt}
          fetchModelSolution={fetchModelSolution}
          activeModelSolution={activeModelSolution}
          loadingModelSolution={loadingModelSolution}
          practiceTimer={practiceTimer}
        />
      )}

      {/* Main Tab 1: Due Queue */}
      {mainTab === 'due' && (
        <DueQueueSection
          dueGroups={dueGroups}
          dueQuestions={dueQuestions}
          dueData={dueData}
          loading={loading}
          expandedDueGroups={expandedDueGroups}
          toggleDueGroupExpand={toggleDueGroupExpand}
          onStartPractice={startPracticeSession}
        />
      )}

      {/* Main Tab 2: Study Bank Topics & Papers */}
      {mainTab === 'bank' && (
        <TopicBankSection
          items={items}
          allQuestions={allQuestions}
          loading={loading}
          bankFilter={bankFilter}
          setBankFilter={setBankFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          expandedItems={expandedItems}
          toggleItemExpand={toggleItemExpand}
          onAddQuestion={(item) => {
            setQuestionItemId(item.id);
            setQuestionTemplate(item.type === 'paper' ? 'paper' : 'topic');
            setShowQuestionModal(true);
          }}
          onViewHistory={handleViewHistory}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onStartPractice={startPracticeSession}
        />
      )}

      {/* Main Tab 3: All Questions / Free Recall */}
      {mainTab === 'questions' && (
        <AllQuestionsSection
          allQuestions={allQuestions}
          loading={loading}
          questionFilter={questionFilter}
          setQuestionFilter={setQuestionFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onStartPractice={startPracticeSession}
        />
      )}

      {/* Main Tab 4: Performance & Analytics */}
      {mainTab === 'performance' && (
        <PerformanceSection
          performanceData={performanceData}
          loading={loading}
          allQuestions={allQuestions}
          onStartPractice={startPracticeSession}
        />
      )}

      {/* Modals */}
      <ItemModal
        show={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          resetItemForm();
        }}
        onSubmit={handleSaveItem}
        isEditing={Boolean(editingItemId)}
        itemFormType={itemFormType}
        setItemFormType={setItemFormType}
        itemFormTitle={itemFormTitle}
        setItemFormTitle={setItemFormTitle}
        itemFormTags={itemFormTags}
        setItemFormTags={setItemFormTags}
        itemFormNotes={itemFormNotes}
        setItemFormNotes={setItemFormNotes}
        paperArxivId={paperArxivId}
        setPaperArxivId={setPaperArxivId}
        paperAuthors={paperAuthors}
        setPaperAuthors={setPaperAuthors}
        paperYear={paperYear}
        setPaperYear={setPaperYear}
        savingItem={savingItem}
      />

      <QuestionModal
        show={showQuestionModal}
        onClose={() => setShowQuestionModal(false)}
        onSubmit={handleSaveQuestion}
        items={items}
        questionItemId={questionItemId}
        setQuestionItemId={setQuestionItemId}
        questionPrompt={questionPrompt}
        setQuestionPrompt={setQuestionPrompt}
        questionTemplate={questionTemplate}
        setQuestionTemplate={setQuestionTemplate}
        questionDifficulty={questionDifficulty}
        setQuestionDifficulty={setQuestionDifficulty}
        savingQuestion={savingQuestion}
      />

      <ManualOverrideModal
        show={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleSubmitOverride}
        overrideReason={overrideReason}
        setOverrideReason={setOverrideReason}
        submittingOverride={submittingOverride}
      />

      <AttemptHistoryModal
        historyItem={historyItem}
        onClose={() => setHistoryItem(null)}
        loadingHistory={loadingHistory}
        historyAttempts={historyAttempts}
      />
    </div>
  );
}
