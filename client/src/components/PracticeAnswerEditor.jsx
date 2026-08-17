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

  // Auto-scroll to top when opened
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
    <div className="practice-modal-backdrop">
      <div className="practice-modal-card">
        {/* Top Header */}
        <div className="practice-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge ${question.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
              {question.answerTemplate === 'paper' ? '📄 PAPER' : '🧠 THEORY'}
            </span>
            <span className="badge badge-difficulty">{question.difficulty || 'Hard'}</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{question.itemTitle || 'Active Recall Studio'}</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="view-mode-toggle" style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
              <button
                type="button"
                className={`btn-tool ${previewTab === 'write' ? 'active' : ''}`}
                style={{ border: 'none', background: previewTab === 'write' ? '#ffffff' : 'transparent', boxShadow: previewTab === 'write' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                onClick={() => setPreviewTab('write')}
              >
                ✏️ Editor
              </button>
              <button
                type="button"
                className={`btn-tool ${previewTab === 'split' ? 'active' : ''}`}
                style={{ border: 'none', background: previewTab === 'split' ? '#ffffff' : 'transparent', boxShadow: previewTab === 'split' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                onClick={() => setPreviewTab('split')}
              >
                ⚡ Split View
              </button>
              <button
                type="button"
                className={`btn-tool ${previewTab === 'preview' ? 'active' : ''}`}
                style={{ border: 'none', background: previewTab === 'preview' ? '#ffffff' : 'transparent', boxShadow: previewTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                onClick={() => setPreviewTab('preview')}
              >
                👁️ Preview
              </button>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={onClose}
              title="Close Studio"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="practice-modal-body">
          {/* Prompt Box with Full KaTeX & Markdown Rendering */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '18px 22px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              🎯 ACTIVE RECALL PROMPT:
            </span>
            <div className="due-prompt markdown-rendered" style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--text-primary)' }}>
              {renderMarkdown(question.prompt)}
            </div>
            {question.itemNotes && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Theoretical Context:</strong> {question.itemNotes}
              </div>
            )}
          </div>

          {error && (
            <div className="banner banner-error" style={{ margin: '8px 0' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Main Workspace (Editor / Preview or Results) */}
          {!evaluationResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {/* Math & Scaffolding Toolbar */}
              <div className="practice-editor-toolbar">
                <div className="toolbar-group">
                  <span className="toolbar-label">Templates:</span>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## Mathematical Proof & Derivation\n$$\n\n$$\n')}
                  >
                    + Proof
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## Intuitive Mechanism & "Why" Breakdown\n- **Why this works:** \n- **Failure mode prevented:** \n')}
                  >
                    + Intuition
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    onClick={() => insertTextAtCursor('\n## ELI5 Metaphor\n> ')}
                  >
                    + ELI5
                  </button>
                </div>

                <div className="toolbar-group">
                  <span className="toolbar-label">LaTeX:</span>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$X \\in \\mathbb{R}^{B \\times T}$')}>ℝ^(B×T)</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\text{softmax}\\left( \\frac{QK^T}{\\sqrt{d_k}} \\right)V$')}>Attention</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\nabla_\\theta J(\\theta)$')}>∇θ</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\sum_{t=1}^T$')}>∑</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\mathbb{E}[ ]$')}>𝔼</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$O(T^2) \\to O(T)$')}>O(T)</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\text{RMSNorm}(x)$')}>RMSNorm</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$$\n\\text{VRAM} = 2 \\cdot B \\cdot L \\cdot N_{layers} \\cdot H_{kv} \\cdot d_k \\cdot P_{bytes}\n$$')}>KV Formula</button>
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
                    {uploadingImage ? '⏳ Compressing...' : '📷 Add Diagram Photo'}
                  </button>
                </div>
              </div>

              {/* Split Editor / Preview Panes */}
              <div className={`practice-panes pane-${previewTab}`}>
                {(previewTab === 'split' || previewTab === 'write') && (
                  <div className="pane-editor">
                    <div className="preview-header">LATEX & MARKDOWN EDITOR</div>
                    <textarea
                      ref={textareaRef}
                      className="practice-textarea"
                      value={answerMarkdown}
                      onChange={(e) => setAnswerMarkdown(e.target.value)}
                      placeholder="Write your mathematical derivation, tensor trace, and intuitive explanation here in LaTeX + Markdown..."
                    />
                  </div>
                )}

                {(previewTab === 'split' || previewTab === 'preview') && (
                  <div className="pane-preview">
                    <div className="preview-header">LIVE FORMATTED KATEX PREVIEW</div>
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
                  className="btn btn-primary"
                  onClick={handleSubmitAttempt}
                  disabled={submitting || !answerMarkdown.trim()}
                >
                  {submitting ? (
                    <span>⏳ Strict Gemini Evaluation in Progress...</span>
                  ) : (
                    '🚀 Submit for Rigorous AI Evaluation'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Evaluation Results Card */
            <div className="practice-eval-container">
              <div className="eval-header-card">
                <div className="score-ring">
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
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    📅 Next Scheduled Review: <strong>{evaluationResult.sm2.dueDate}</strong>
                  </div>
                </div>
              </div>

              {/* Flagged Critical Issues */}
              {evaluationResult.attempt.evaluation.flaggedIssues && evaluationResult.attempt.evaluation.flaggedIssues.length > 0 && (
                <div className="flagged-issues-card">
                  <h4 style={{ color: '#9f1239', marginBottom: '8px' }}>🚩 Critical Issues Flagged by Reviewer ({evaluationResult.attempt.evaluation.flaggedIssues.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {evaluationResult.attempt.evaluation.flaggedIssues.map((issue, idx) => (
                      <div key={idx} className="flag-item">
                        <div className="flag-quote">"{issue.quote}"</div>
                        <div className="flag-note">{issue.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic Critique */}
              <div className="critique-card">
                <h4>📝 Comprehensive Reviewer Critique</h4>
                <div className="preview-body markdown-rendered" style={{ padding: '12px 0' }}>
                  {renderMarkdown(evaluationResult.attempt.evaluation.critique)}
                </div>
              </div>

              {/* Rubric Breakdown */}
              {evaluationResult.attempt.evaluation.rubric && (
                <div className="rubric-card">
                  <h4>📊 Granular Rubric Breakdown</h4>
                  <div className="rubric-grid">
                    {Object.entries(evaluationResult.attempt.evaluation.rubric).map(([key, val]) => (
                      <div key={key} className="rubric-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="rubric-key">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                          {typeof val === 'object' && val?.score !== undefined && (
                            <span className="badge badge-topic">
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
      </div>
    </div>
  );
}
