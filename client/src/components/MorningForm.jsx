import React from 'react';

export default function MorningForm({ morningData, setMorningData, editingDate, cancelEditing, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="section-title">
        <h2>Waking Bio-Metrics & Sleep</h2>
        <p>Required immediately upon waking. Determines morning lock compliance.</p>
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

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Waking Weight (kg)</label>
          <input type="number" step="0.01" className="form-input" required placeholder="e.g. 78.45" value={morningData.wakingWeight} onChange={(e) => setMorningData({...morningData, wakingWeight: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Sleep Duration (Hours)</label>
          <input type="number" step="0.1" className="form-input" required placeholder="e.g. 7.5" value={morningData.sleepHours} onChange={(e) => setMorningData({...morningData, sleepHours: e.target.value})} />
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Sleep Quality (Self Rated)</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.sleepQualitySelf} onChange={(e) => setMorningData({...morningData, sleepQualitySelf: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.sleepQualitySelf}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Sleep Quality (Device Rated)</label>
          <div className="slider-container">
            <input type="range" min="0" max="100" className="slider" value={morningData.sleepQualityDevice} onChange={(e) => setMorningData({...morningData, sleepQualityDevice: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.sleepQualityDevice}/100</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Energy Level</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.energyLevels} onChange={(e) => setMorningData({...morningData, energyLevels: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.energyLevels}/10</span>
          </div>
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Mood</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.mood} onChange={(e) => setMorningData({...morningData, mood: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.mood}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Stress</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.stress} onChange={(e) => setMorningData({...morningData, stress: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.stress}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Signs of Illness</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.illnessSigns} onChange={(e) => setMorningData({...morningData, illnessSigns: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.illnessSigns}/10</span>
          </div>
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Muscle Soreness (DOMS)</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={morningData.muscleSoreness} onChange={(e) => setMorningData({...morningData, muscleSoreness: parseInt(e.target.value)})} />
            <span className="slider-val">{morningData.muscleSoreness}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Resting HR (BPM)</label>
          <input type="number" className="form-input" required placeholder="e.g. 58" value={morningData.restingHR} onChange={(e) => setMorningData({...morningData, restingHR: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Blood Pressure</label>
          <input type="text" className="form-input" placeholder="e.g. 120/80" value={morningData.bloodPressure} onChange={(e) => setMorningData({...morningData, bloodPressure: e.target.value})} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg">Submit Morning Log</button>
      </div>
    </form>
  );
}
