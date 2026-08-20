import React, { useState, useEffect, useRef } from 'react';
import { Check, Lock, Plus, RefreshCw, TriangleAlert } from 'lucide-react';

import { api } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert';
import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
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

export default function PracticeView({ onRefreshStatus }) {
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
      const [itemsData, questionsData, dueDataRes] = await Promise.all([
        api.practice.items(),
        api.practice.questions(),
        api.practice.due()
      ]);

      // Status and performance are informational -- a failure there should not
      // blank out the queue the lock actually depends on.
      const [statusData, perfData] = await Promise.all([
        api.practice.status().catch(() => null),
        api.practice.performance().catch(() => null)
      ]);

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

      if (editingItemId) {
        await api.practice.updateItem(editingItemId, payload);
      } else {
        await api.practice.createItem(payload);
      }

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
      await api.practice.deleteItem(itemId);
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
      await api.practice.createQuestion({
        itemId: questionItemId,
        prompt: questionPrompt.trim(),
        answerTemplate: questionTemplate,
        difficulty: questionDifficulty
      });

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
      const data = await api.practice.submitAttempt({
        questionId: activeQuestion.id,
        answerMarkdown: answerMarkdown.trim()
      });

      setEvaluationResult(data.attempt);
      fetchPracticeData();
      onRefreshStatus?.();
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
          const data = await api.practice.uploadImage({
            dataUrl: reader.result,
            questionId: activeQuestion?.id || 'practice_image'
          });
          if (!data.url) throw new Error('Image upload returned no URL');

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
      setActiveModelSolution(await api.practice.modelSolution(activeQuestion.id));
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
      await api.practice.override(overrideReason);

      setSuccessMsg('Manual practice override applied for today.');
      setShowOverrideModal(false);
      fetchPracticeData();
      onRefreshStatus?.();
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
      await api.practice.resetOverride();
      setSuccessMsg('Practice override reset.');
      fetchPracticeData();
      onRefreshStatus?.();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewHistory = async (item) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const data = await api.practice.attempts({ itemId: item.id });
      setHistoryAttempts(data.attempts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {practiceStatus && (
            <>
              <Badge variant={practiceStatus.isCompleted ? 'default' : 'destructive'} className="gap-1.5">
                {practiceStatus.isCompleted ? <Check className="size-3" /> : <Lock className="size-3" />}
                {practiceStatus.isCompleted
                  ? practiceStatus.isManualOverride
                    ? 'Override'
                    : 'Unlocked'
                  : `${practiceStatus.completedTodayCount}/${practiceStatus.minRequired} done`}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={practiceStatus.isManualOverride ? handleResetOverride : () => setShowOverrideModal(true)}
              >
                {practiceStatus.isManualOverride ? 'Reset override' : 'Manual override'}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => {
              resetItemForm();
              setItemFormType('topic');
              setShowItemModal(true);
            }}
          >
            <Plus className="size-4" />
            Add topic
          </Button>
          <Button variant="outline" size="icon" onClick={fetchPracticeData} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </div>

      {successMsg && (
        <Alert>
          <Check />
          <AlertTitle>{successMsg}</AlertTitle>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Practice request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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

      <Tabs value={mainTab} onValueChange={setMainTab} className="gap-6">
        <TabsList>
          <TabsTrigger value="due">Due today ({dueQuestions.length})</TabsTrigger>
          <TabsTrigger value="bank">Study bank ({items.length})</TabsTrigger>
          <TabsTrigger value="questions">All questions ({allQuestions.length})</TabsTrigger>
          <TabsTrigger value="performance">Mastery</TabsTrigger>
        </TabsList>

        <TabsContent value="due">
          <DueQueueSection
            dueGroups={dueGroups}
            dueQuestions={dueQuestions}
            dueData={dueData}
            loading={loading}
            expandedDueGroups={expandedDueGroups}
            toggleDueGroupExpand={toggleDueGroupExpand}
            onStartPractice={startPracticeSession}
          />
        </TabsContent>

        <TabsContent value="bank">
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
        </TabsContent>

        <TabsContent value="questions">
          <AllQuestionsSection
            allQuestions={allQuestions}
            loading={loading}
            questionFilter={questionFilter}
            setQuestionFilter={setQuestionFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onStartPractice={startPracticeSession}
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceSection
            performanceData={performanceData}
            loading={loading}
            allQuestions={allQuestions}
            onStartPractice={startPracticeSession}
          />
        </TabsContent>
      </Tabs>

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
