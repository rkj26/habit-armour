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
  
  // Model Solution state (Study Mode)
  const [modelSolution, setModelSolution] = useState(null);
  const [loadingModelSolution, setLoadingModelSolution] = useState(false);
  const [showModelSolutionModal, setShowModelSolutionModal] = useState(false);
  const [copiedSolution, setCopiedSolution] = useState(false);

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

  const getBaseUrl = () => {
    if (API_URL && typeof API_URL === 'string' && API_URL.trim()) {
      return API_URL.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      return window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;
    }
    return '';
  };

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
      const compressedDataUrl = await compressImage(file, 1600, 0.85);
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question?.id || 'practice',
          dataUrl: compressedDataUrl
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}: ${res.statusText || 'Upload failed'}`);
      }
      const fullImageUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
      insertTextAtCursor(`\n![Hand-Drawn Architecture / Proof Diagram](${fullImageUrl})\n`);
    } catch (err) {
      console.error('Image upload error:', err);
      setError(`Image upload failed: ${err.message || 'Unknown network error'}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchModelSolution = async () => {
    if (modelSolution) {
      setShowModelSolutionModal(true);
      return;
    }
    setLoadingModelSolution(true);
    setError(null);
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/questions/${question.id}/model-solution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || `HTTP ${res.status}: ${res.statusText || 'Fetch failed'}`);
      setModelSolution(data);
      setShowModelSolutionModal(true);
    } catch (err) {
      console.error('Error fetching model solution:', err);
      setError(`Could not fetch model solution: ${err.message}`);
    } finally {
      setLoadingModelSolution(false);
    }
  };

  const handleCopySolution = (textToCopy) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2500);
  };

  const handleSubmitAttempt = async (e) => {
    e.preventDefault();
    if (!answerMarkdown.trim()) {
      setError('Please write an answer or attach an image before submitting for evaluation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/practice/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          answerMarkdown
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}: ${res.statusText || 'Submission failed'}`);
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

  return (
    <div className="practice-modal-backdrop">
      <div className="practice-modal-card">
        {/* Top Header */}
        <div className="practice-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className={`badge ${question.answerTemplate === 'paper' ? 'badge-paper' : 'badge-topic'}`}>
              {question.answerTemplate === 'paper' ? '📄 PAPER' : '🧠 THEORY'}
            </span>
            <span className="badge badge-difficulty">{question.difficulty || 'Medium'}</span>
            <span className="badge badge-time" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.72rem', fontWeight: 600 }}>
              ⏱️ Target: 1–2 mins
            </span>
            {question.hasModelSolution && (
              <span className="badge badge-cached" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 600 }}>
                ⚡ Cached Key in DB
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{question.itemTitle || 'Active Recall Studio'}</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!evaluationResult && (
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
            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                🎯 ACTIVE RECALL PROMPT:
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                💡 Keep it concise (1–2 min focus)
              </span>
            </div>
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
            <div className="banner banner-error" style={{ margin: '4px 0' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Main Workspace (Editor / Preview or Results) */}
          {!evaluationResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {/* Math, Vision & Scaffolding Toolbar */}
              <div className="practice-editor-toolbar">
                <div className="toolbar-group">
                  <span className="toolbar-label">Scaffolding:</span>
                  <button
                    type="button"
                    className="btn-tool"
                    title="Insert Proof & Derivation Header"
                    onClick={() => insertTextAtCursor('\n## Mathematical Proof & Derivation\n$$\n\n$$\n')}
                  >
                    + Proof
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    title="Insert Intuitive Mechanism Structure"
                    onClick={() => insertTextAtCursor('\n## Causal Mechanism & Intuition\n- **Why this works:** \n- **Failure mode prevented:** \n')}
                  >
                    + Intuition
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    title="Insert Paper Claims & Architecture Structure"
                    onClick={() => insertTextAtCursor('\n## 1. Core Claims & Problem\n- \n\n## 2. Mathematical Methodology\n- \n\n## 3. Key Empirical Results & Limitations\n- \n')}
                  >
                    + Paper
                  </button>
                  <button
                    type="button"
                    className="btn-tool"
                    title="Insert ELI5 Metaphor"
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
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\mathbb{E}_{\\tau \\sim \\pi}[ ]$')}>𝔼</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$\\frac{\\partial L}{\\partial z_i}$')}>∂L/∂z</button>
                  <button type="button" className="btn-tool btn-tool-math" onClick={() => insertTextAtCursor('$$\n\\text{VRAM} = 2 \\cdot B \\cdot L \\cdot N_{layers} \\cdot H_{kv} \\cdot d_k \\cdot P_{bytes}\n$$')}>KV Cache</button>
                </div>

                <div className="toolbar-group" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-tool btn-tool-hint"
                    onClick={handleFetchModelSolution}
                    disabled={loadingModelSolution}
                  >
                    {loadingModelSolution ? '⏳ Generating Key...' : '💡 Study Master Solution Key'}
                  </button>

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
                    {uploadingImage ? '⏳ Uploading...' : '📷 Add Diagram / Proof Photo'}
                  </button>
                </div>
              </div>

              {/* Split Editor / Preview Panes */}
              <div className={`practice-panes pane-${previewTab}`}>
                {(previewTab === 'split' || previewTab === 'write') && (
                  <div className="pane-editor">
                    <div className="preview-header">LATEX & MARKDOWN ACTIVE RECALL EDITOR</div>
                    <textarea
                      ref={textareaRef}
                      className="practice-textarea"
                      value={answerMarkdown}
                      onChange={(e) => setAnswerMarkdown(e.target.value)}
                      placeholder="Write your derivation, proof, tensor trace, or explanation here in LaTeX + Markdown ($...$, $$...$$), or attach a diagram / photo of your handwritten work..."
                    />
                  </div>
                )}

                {(previewTab === 'split' || previewTab === 'preview') && (
                  <div className="pane-preview">
                    <div className="preview-header">LIVE FORMATTED KATEX PREVIEW</div>
                    <div className="preview-body markdown-rendered">
                      {answerMarkdown ? (
                        renderMarkdown(answerMarkdown)
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                          Preview will update dynamically as you type equations or attach drawings...
                        </div>
                      )}
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
                    <span>⏳ Strict Gemini Evaluation & OCR in Progress...</span>
                  ) : (
                    '🚀 Submit for Rigorous AI Evaluation'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Evaluation Results View with Master Model Solution & Actionable Improvements */
            <div className="practice-eval-container">
              <div className="eval-header-card">
                <div className="score-ring">
                  <span className="score-number">{evaluationResult.attempt.evaluation.score}</span>
                  <span className="score-total">/ 10</span>
                </div>
                <div className="eval-summary">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="badge badge-topic" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      FSRS Grade {evaluationResult.fsrs?.grade ? (
                        evaluationResult.fsrs.grade === 4 ? '4: Easy (🌟 Mastered)' :
                        evaluationResult.fsrs.grade === 3 ? '3: Good (✅ Solid)' :
                        evaluationResult.fsrs.grade === 2 ? '2: Hard (⚡ Developing)' :
                        '1: Again (🚩 Lapse)'
                      ) : 'Evaluated'}
                    </span>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem' }}>
                      Target Retention: 90%
                    </span>
                  </div>
                  <h3 className="eval-grade-title" style={{ margin: '4px 0' }}>
                    {evaluationResult.attempt.evaluation.score >= 8.5 ? '🌟 Flawless Technical Mastery' :
                     evaluationResult.attempt.evaluation.score >= 6.5 ? '✅ Solid Technical Understanding' :
                     evaluationResult.attempt.evaluation.score >= 4.0 ? '⚡ Developing (Soft Reinforcement)' :
                     '🚩 Incomplete / Gaps Flagged (1-Day Review)'}
                  </h3>
                  
                  {/* FSRS Metrics Strip */}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    <span>🧠 Memory Stability ($S$): <strong>{evaluationResult.fsrs?.stability ? `${evaluationResult.fsrs.stability}d` : `${evaluationResult.sm2?.intervalDays || 1}d`}</strong></span>
                    <span>📊 Difficulty ($D$): <strong>{evaluationResult.fsrs?.fsrsDifficulty || '5.0'}/10</strong></span>
                    <span>📈 Interval ($I$): <strong>{evaluationResult.fsrs?.intervalDays || evaluationResult.sm2?.intervalDays || 1}d</strong></span>
                    <span>📅 Next Due: <strong style={{ color: '#4f46e5' }}>{evaluationResult.fsrs?.dueDate || evaluationResult.sm2?.dueDate}</strong></span>
                  </div>
                </div>
              </div>

              {/* Key Actionable Improvements & Nuances */}
              {evaluationResult.attempt.evaluation.keyImprovements && evaluationResult.attempt.evaluation.keyImprovements.length > 0 && (
                <div className="improvements-card">
                  <div className="improvements-header">
                    <span style={{ fontSize: '1.1rem' }}>💡</span>
                    <h4 style={{ margin: 0, color: '#1e3a8a' }}>Key Actionable Improvements to Master</h4>
                  </div>
                  <div className="improvements-list">
                    {evaluationResult.attempt.evaluation.keyImprovements.map((imp, idx) => (
                      <div key={idx} className="improvement-item">
                        <span className="improvement-bullet">🎯</span>
                        <div className="improvement-text markdown-rendered">
                          {renderMarkdown(imp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Master Model Solution Card (Exemplary Key) */}
              {evaluationResult.attempt.evaluation.idealAnswer && (
                <div className="model-solution-card">
                  <div className="model-solution-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🎯</span>
                      <h4 style={{ margin: 0, color: '#4f46e5' }}>Exemplary Model Solution & Derivation (Gemini Master Key)</h4>
                    </div>
                    <button
                      type="button"
                      className="btn-tool"
                      onClick={() => handleCopySolution(evaluationResult.attempt.evaluation.idealAnswer)}
                    >
                      {copiedSolution ? '✅ Copied!' : '📋 Copy Solution'}
                    </button>
                  </div>
                  <div className="model-solution-body markdown-rendered">
                    {renderMarkdown(evaluationResult.attempt.evaluation.idealAnswer)}
                  </div>
                </div>
              )}

              {/* Flagged Critical Issues */}
              {evaluationResult.attempt.evaluation.flaggedIssues && evaluationResult.attempt.evaluation.flaggedIssues.length > 0 && (
                <div className="flagged-issues-card">
                  <h4 style={{ color: '#9f1239', marginBottom: '8px' }}>
                    🚩 Critical Issues Flagged by Reviewer ({evaluationResult.attempt.evaluation.flaggedIssues.length})
                  </h4>
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
              {evaluationResult.attempt.evaluation.critique && (
                <div className="critique-card">
                  <h4>📝 Comprehensive Reviewer Critique</h4>
                  <div className="preview-body markdown-rendered" style={{ padding: '12px 0' }}>
                    {renderMarkdown(evaluationResult.attempt.evaluation.critique)}
                  </div>
                </div>
              )}

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

      {/* Standalone On-Demand Model Solution Modal (Study Mode) */}
      {showModelSolutionModal && modelSolution && (
        <div className="modal-backdrop" style={{ zIndex: 10005 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '850px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>🎯</span>
                <h3 style={{ margin: 0, color: '#4f46e5' }}>Master Model Solution Key</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-tool"
                  onClick={() => handleCopySolution(modelSolution.idealAnswer)}
                >
                  {copiedSolution ? '✅ Copied!' : '📋 Copy'}
                </button>
                <button
                  className="btn-icon"
                  onClick={() => setShowModelSolutionModal(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {modelSolution.keyTakeaways && modelSolution.keyTakeaways.length > 0 && (
              <div className="improvements-card" style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a' }}>💡 High-Yield Spaced Repetition Takeaways</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', lineHeight: '1.6', color: '#1e40af' }}>
                  {modelSolution.keyTakeaways.map((t, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="model-solution-body markdown-rendered" style={{ background: '#f8fafc', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              {renderMarkdown(modelSolution.idealAnswer)}
            </div>

            <div className="modal-actions" style={{ marginTop: '18px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowModelSolutionModal(false)}
              >
                Return to Practice Studio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
