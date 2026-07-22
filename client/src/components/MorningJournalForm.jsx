import React from 'react';

export default function MorningJournalForm({ morningData, setMorningData, editingDate, cancelEditing, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="section-title">
        <h2>Daily Intentions & Journal</h2>
        <p>Daily goals, intentions, and reflection. Requires a minimum of 100 words.</p>
      </div>

      {editingDate && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderLeft: '4px solid var(--accent-purple)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <span>⚠️ <strong>Editing Log mode active</strong> for date <strong>{editingDate}</strong>. Submitting will update the database.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditing}>Cancel Edit</button>
        </div>
      )}

      <div style={{ 
        background: 'var(--bg-surface)', 
        border: '1px solid var(--border-color)', 
        borderLeft: '4px solid var(--accent-purple)', 
        padding: '16px 20px', 
        borderRadius: 'var(--radius-sm)', 
        marginBottom: '20px',
        fontSize: '0.9rem',
        lineHeight: '1.5'
      }}>
        <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Guiding Questions:</strong>
        <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <li>What are your top 3 priority goals for today?</li>
          <li>How do you want to show up energetically/emotionally today?</li>
          <li>What potential obstacles do you foresee, and how will you handle them?</li>
        </ol>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>Journal Entry</label>
        <textarea 
          className="form-input" 
          required 
          rows="10" 
          placeholder="Write your morning reflection here..." 
          value={morningData.journalEntry || ''} 
          onChange={(e) => setMorningData({...morningData, journalEntry: e.target.value})}
          style={{ minHeight: '200px', marginTop: '4px', lineHeight: '1.6' }}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg">Submit Morning Journal</button>
      </div>
    </form>
  );
}
