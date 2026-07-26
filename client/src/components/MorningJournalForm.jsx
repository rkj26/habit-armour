import React from 'react';

export default function MorningJournalForm({ morningData, setMorningData, editingDate, cancelEditing, onSubmit }) {
  const text = morningData.journalEntry || '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isWordCountMet = wordCount >= 100;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="section-title" style={{ marginBottom: '4px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          📝 Morning Intentions & Journal
        </h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
          Daily goals, intentions, and reflection. Requires a minimum of 100 words to submit and clear lock.
        </p>
      </div>

      {editingDate && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderLeft: '4px solid var(--accent-purple)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <span>⚠️ <strong>Editing Log mode active</strong> for date <strong>{editingDate}</strong>. Submitting will update the database.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditing}>Cancel Edit</button>
        </div>
      )}

      {/* Guiding Questions Card */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.06)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderLeft: '4px solid var(--accent-purple, #6366f1)',
        padding: '18px 22px',
        borderRadius: 'var(--radius-md, 12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
          💡 Guiding Prompts:
        </strong>
        <ol style={{ margin: 0, paddingLeft: '22px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <li>What are your top 3 priority goals for today?</li>
          <li>How do you want to show up energetically/emotionally today?</li>
          <li>What potential obstacles do you foresee, and how will you handle them?</li>
        </ol>
      </div>

      {/* Journal Entry Card */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label className="form-label" style={{ textTransform: 'none', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
            Journal Reflection Entry
          </label>
          <span style={{
            fontSize: '0.78rem',
            background: isWordCountMet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isWordCountMet ? '#4ade80' : '#fbbf24',
            border: `1px solid ${isWordCountMet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            padding: '3px 10px',
            borderRadius: '12px',
            fontWeight: 600
          }}>
            {isWordCountMet ? `✓ ${wordCount} words (Min 100 Met)` : `🔒 ${wordCount} / 100 words minimum`}
          </span>
        </div>
        <textarea 
          className="form-input" 
          required 
          rows="10" 
          placeholder="Write your morning reflection, goals, and intentions here..." 
          value={morningData.journalEntry || ''} 
          onChange={(e) => setMorningData({...morningData, journalEntry: e.target.value})}
          style={{ minHeight: '220px', lineHeight: '1.6', fontSize: '0.95rem', padding: '16px' }}
        />
      </div>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700 }}>
          🚀 Submit Morning Journal
        </button>
      </div>
    </form>
  );
}
