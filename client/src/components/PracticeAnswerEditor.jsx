import React, { useState, useRef, useEffect } from 'react';
import { renderMarkdown } from '../utils/renderMarkdown';
import { compressImage } from '../utils/imageCompressor';

export default function PracticeAnswerEditor({
  question,
  API_URL,
  onClose,
  onAttemptCompleted
}) {
  const [answerMarkdown, setAnswerMarkdown] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [previewTab, setPreviewTab] = useState('split'); // 'split', 'write', 'preview'
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize with scaffolding if empty
  useEffect(() => {
    const isTopic = question.answerTemplate === 'topic';
    if (!answerMarkdown) {
      if (isTopic) {
        setAnswerMarkdown(
`## 1. Mathematical Derivation & Proof
$$
\\text{Write formal equations and derivations here...}
$$

## 2. Intuition & Causal "Why" Breakdown
- **Why each term exists:** 
- **Failure modes prevented:** 

## 3. ELI5 (Explain Like I'm 5)
> Simple intuitive metaphor explaining the core idea without technical jargon:
`
        );
      } else {
        setAnswerMarkdown(
`## 1. Core Claims & Problem Formulation
- 

## 2. Architecture & Mathematical Methodology
- 

## 3. Key Empirical Results & Ablations
- 

## 4. Limitations & Failure Modes
- 

## 5. ELI5 Summary
> Simple analogy explaining the essence of this paper:
`
        );
      }
    }
  }, [question]);

  const insertTextAtCursor = (textToInsert) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setAnswerMarkdown(prev => prev + textToInsert);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = answerMarkdown.substring(0, start);
    const after = answerMarkdown.substring(end);
    const newText = before + textToInsert + after;
    setAnswerMarkdown(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const compressedDataUrl = await compressImage(file, 1600, 0.8);
      const res = await fetch(`${API_URL}/api/practice/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          dataUrl: compressedDataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      const fullImageUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      insertTextAtCursor(`\n![Hand-Drawn Architecture / Proof Diagram](${fullImageUrl})\n`);
    } catch (err) {
      console.error('Image upload error:', err);
      setError(`Image upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitAttempt = async (e) => {
    e.preventDefault();
    if (!answerMarkdown.trim()) {
      setError('Please write an answer before submitting for evaluation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/practice/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          answerMarkdown
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit practice attempt');
      }

      setEvaluationResult(data);
      if (onAttemptCompleted) {
        onAttemptCompleted(data);
      }
    } catch (err) {
      console.error('Attempt submission error:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColorClass = (score) => {
    if (score >= 9) return 'score-mastered';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-developing';
    return 'score-poor';
  };

  return (
    <div className="practice-editor-modal glass-card">
      {/* Top Header */}
      <div className="practice-editor-header">
        <div className="practice-header-left">
          <span className={`badge ${question.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
            {question.answerTemplate === 'paper' ? '📄 RESEARCH PAPER' : '🧠 THEORY TOPIC'}
          </span>
          <span className="badge badge-difficulty">{question.difficulty || 'Medium'}</span>
          <h2 className="practice-item-title">{question.itemTitle || 'Practice Studio'}</h2>
        </div>
        <div className="practice-header-right">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`btn-mode ${previewTab === 'write' ? 'active' : ''}`}
              onClick={() => setPreviewTab('write')}
            >
              ✏️ Write
            </button>
            <button
              type="button"
              className={`btn-mode ${previewTab === 'split' ? 'active' : ''}`}
              onClick={() => setPreviewTab('split')}
            >
              ⚡ Split View
            </button>
            <button
              type="button"
              className={`btn-mode ${previewTab === 'preview' ? 'active' : ''}`}
              onClick={() => setPreviewTab('preview')}
            >
              👁️ Preview
            </button>
          </div>
          <button className="btn-close" onClick={onClose} title="Close Studio">✕</button>
        </div>
      </div>

      {/* Prompt Card */}
      <div className="practice-prompt-card">
        <span className="prompt-label">🎯 ACTIVE RECALL PROMPT:</span>
        <p className="prompt-text">{question.prompt}</p>
        {question.itemNotes && (
          <div className="prompt-notes">
            <strong>Context / Focus:</strong> {question.itemNotes}
          </div>
        )}
      </div>

      {error && (
        <div className="banner banner-error" style={{ margin: '12px 0' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Workspace (Editor / Preview or Results) */}
      {!evaluationResult ? (
        <div className="practice-workspace">
          {/* Math & Formatting Quick Toolbar */}
          <div className="practice-toolbar">
            <div className="toolbar-group">
              <span className="toolbar-label">Scaffold:</span>
              {question.answerTemplate === 'topic' ? (
                <>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 1. Mathematical Derivation & Proof\n$$\n\n$$\n')}
                  >
                    + Proof
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 2. Intuition & Causal "Why" Breakdown\n- **Why each term exists:** \n- **Failure modes prevented:** \n')}
                  >
                    + Intuition
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 3. ELI5 (Explain Like I\'m 5)\n> Simple intuitive metaphor:\n')}
                  >
                    + ELI5
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 1. Core Claims & Problem\n- ')}
                  >
                    + Claims
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 2. Methodology & Architecture\n- ')}
                  >
                    + Method
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 3. Key Results & Ablations\n- ')}
                  >
                    + Results
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 4. Limitations & Failure Modes\n- ')}
                  >
                    + Limits
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## 5. ELI5 Summary\n> ')}
                  >
                    + ELI5
                  </button>
                </>
              )}
            </div>

            <div className="toolbar-group">
              <span className="toolbar-label">Math:</span>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\mathbb{E}_{\\tau \\sim \\pi}[ ]')}>𝔼</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\nabla_\\theta ')}>∇</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\sum_{t=0}^T ')}>∑</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\arg\\max_a ')}>argmax</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\mathcal{L}(\\theta)')}>ℒ(θ)</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\frac{a}{b}')}>a/b</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\sqrt{d_k}')}>√d_k</button>
              <button type="button" className="btn-tool" onClick={() => insertTextAtCursor('\\text{softmax}\\left( \\frac{QK^T}{\\sqrt{d_k}} \\right)V')}>Softmax</button>
            </div>

            <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <button
                type="button"
                className="btn-tool btn-tool-upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? '⏳ Compressing...' : '📷 Add Diagram/Proof Photo'}
              </button>
            </div>
          </div>

          {/* Split Pane Editor / Preview */}
          <div className={`practice-panes pane-${previewTab}`}>
            {(previewTab === 'split' || previewTab === 'write') && (
              <div className="pane-editor">
                <textarea
                  ref={textareaRef}
                  className="practice-textarea"
                  value={answerMarkdown}
                  onChange={(e) => setAnswerMarkdown(e.target.value)}
                  placeholder="Write your rigorous proof, intuitive explanation, and ELI5 here in Markdown + LaTeX..."
                />
              </div>
            )}

            {(previewTab === 'split' || previewTab === 'preview') && (
              <div className="pane-preview">
                <div className="preview-header">LIVE FORMATTED PREVIEW</div>
                <div className="preview-body markdown-rendered">
                  {renderMarkdown(answerMarkdown)}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="practice-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-submit-eval"
              onClick={handleSubmitAttempt}
              disabled={submitting || !answerMarkdown.trim()}
            >
              {submitting ? (
                <span className="eval-loading">
                  <span className="spinner-small" /> Strict Gemini Review in Progress...
                </span>
              ) : (
                '🚀 Submit for Strict Gemini Evaluation'
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Evaluation Results Card */
        <div className="practice-eval-container">
          <div className="eval-header-card">
            <div className={`score-ring ${getScoreColorClass(evaluationResult.attempt.evaluation.score)}`}>
              <span className="score-number">{evaluationResult.attempt.evaluation.score}</span>
              <span className="score-total">/ 10</span>
            </div>
            <div className="eval-summary">
              <h3 className="eval-grade-title">
                {evaluationResult.attempt.evaluation.score >= 9 ? '🌟 Flawless Technical Mastery' :
                 evaluationResult.attempt.evaluation.score >= 7 ? '✅ Solid Technical Understanding' :
                 evaluationResult.attempt.evaluation.score >= 5 ? '⚠️ Developing (Needs Reinforcement)' :
                 '❌ Incomplete / Hand-Wavy (Immediate Repetition Required)'}
              </h3>
              <p className="eval-grade-desc">
                {evaluationResult.attempt.evaluation.score >= 6
                  ? `SM-2 review interval extended to ${evaluationResult.sm2.intervalDays} day(s) (Repetition #${evaluationResult.sm2.repetitions}, Ease Factor: ${evaluationResult.sm2.easeFactor}).`
                  : `Score below threshold. Repetition interval reset to 1 day for reinforcement.`}
              </p>
              <div className="next-due-pill">
                📅 Next Scheduled Review: <strong>{evaluationResult.sm2.dueDate}</strong>
              </div>
            </div>
          </div>

          {/* Flagged Critical Issues (Misused terms, hand-wavy logic, vague claims) */}
          {evaluationResult.attempt.evaluation.flaggedIssues && evaluationResult.attempt.evaluation.flaggedIssues.length > 0 && (
            <div className="flagged-issues-card">
              <h4>🚩 Critical Issues Flagged by Reviewer ({evaluationResult.attempt.evaluation.flaggedIssues.length})</h4>
              <p className="flagged-desc">Vague claims, imprecise terms, or unsupported leaps caught in your explanation:</p>
              <div className="flagged-list">
                {evaluationResult.attempt.evaluation.flaggedIssues.map((issue, idx) => (
                  <div key={idx} className={`flag-item flag-${issue.type}`}>
                    <div className="flag-type-badge">{issue.type.toUpperCase()}</div>
                    <div className="flag-body">
                      <div className="flag-quote">"{issue.quote}"</div>
                      <div className="flag-note">{issue.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Academic Critique */}
          <div className="critique-card glass-card">
            <h4>📝 Comprehensive Reviewer Critique</h4>
            <div className="critique-content markdown-rendered">
              {renderMarkdown(evaluationResult.attempt.evaluation.critique)}
            </div>
          </div>

          {/* Rubric Breakdown */}
          {evaluationResult.attempt.evaluation.rubric && (
            <div className="rubric-card glass-card">
              <h4>📊 Granular Rubric Breakdown</h4>
              <div className="rubric-grid">
                {Object.entries(evaluationResult.attempt.evaluation.rubric).map(([key, val]) => (
                  <div key={key} className="rubric-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="rubric-key">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                      {typeof val === 'object' && val?.score !== undefined && (
                        <span className={`badge ${val.score >= 8 ? 'badge-topic' : val.score >= 6 ? 'badge-difficulty' : 'badge-paper'}`}>
                          {val.score} / 10
                        </span>
                      )}
                    </div>
                    <span className="rubric-val">
                      {typeof val === 'object' && val?.feedback ? val.feedback : (typeof val === 'string' ? val : JSON.stringify(val))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post-Review Actions */}
          <div className="eval-actions">
            <button className="btn btn-secondary" onClick={() => setEvaluationResult(null)}>
              ✏️ Revise & Retake
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              ✅ Done (Return to Study Queue)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
