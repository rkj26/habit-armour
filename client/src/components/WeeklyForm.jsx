import React from 'react';

export default function WeeklyForm({ weeklyData, setWeeklyData, editingDate, cancelEditing, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="section-title">
        <h2>Weekly Body Measurements</h2>
        <p>Track body changes over time. Required every Sunday to prevent device locking.</p>
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

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Week Commencing</label>
          <input type="date" className="form-input" required value={weeklyData.weekCommencing} onChange={(e) => setWeeklyData({...weeklyData, weekCommencing: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Start Weight (kg)</label>
          <input type="number" step="0.01" className="form-input" required placeholder="e.g. 79.2" value={weeklyData.startWeight} onChange={(e) => setWeeklyData({...weeklyData, startWeight: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Response Action</label>
          <input type="text" className="form-input" placeholder="Notes/adjustments" value={weeklyData.responseAction} onChange={(e) => setWeeklyData({...weeklyData, responseAction: e.target.value})} />
        </div>
      </div>

      <h3 className="sub-section-title">Circumference Measurements (cm)</h3>
      <div className="form-grid-4">
        <div className="form-group">
          <label className="form-label">Umbilical (Waist)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 84.5" value={weeklyData.umbilical} onChange={(e) => setWeeklyData({...weeklyData, umbilical: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Bicep (Left)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.2" value={weeklyData.bicepL} onChange={(e) => setWeeklyData({...weeklyData, bicepL: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Bicep (Right)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.5" value={weeklyData.bicepR} onChange={(e) => setWeeklyData({...weeklyData, bicepR: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Quad (Left)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.1" value={weeklyData.quadL} onChange={(e) => setWeeklyData({...weeklyData, quadL: e.target.value})} />
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Quad (Right)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.3" value={weeklyData.quadR} onChange={(e) => setWeeklyData({...weeklyData, quadR: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Glutes</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 98.2" value={weeklyData.glutes} onChange={(e) => setWeeklyData({...weeklyData, glutes: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Chest</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 102.4" value={weeklyData.chest} onChange={(e) => setWeeklyData({...weeklyData, chest: e.target.value})} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg">Submit Weekly Specs</button>
      </div>
    </form>
  );
}
