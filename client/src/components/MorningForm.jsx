import React from 'react';
import EditingBanner from './EditingBanner';

export default function MorningForm({ morningData, setMorningData, editingDate, cancelEditing, onSubmit }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="section-title" style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          🌅 Waking Bio-Metrics & Sleep
        </h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
          Required immediately upon waking. Determines morning lock compliance and logs sleep, weight, and recovery metrics.
        </p>
      </div>

      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      {/* Card 1: Waking Bio-Metrics & Sleep */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💤 Waking Weight & Sleep Quality
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Track waking body mass, total sleep duration, device scores, and energy levels.</span>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '18px' }}>
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
            <label className="form-label">Sleep Quality (Device Score)</label>
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
      </div>

      {/* Card 2: Wellness, Mood & Recovery */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧠 Wellness, Mood & DOMS Recovery
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Evaluate subjective mood, stress, potential illness signs, and muscle soreness.</span>
        </div>

        <div className="form-grid-4">
          <div className="form-group">
            <label className="form-label">Mood</label>
            <div className="slider-container">
              <input type="range" min="1" max="10" className="slider" value={morningData.mood} onChange={(e) => setMorningData({...morningData, mood: parseInt(e.target.value)})} />
              <span className="slider-val">{morningData.mood}/10</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Stress Level</label>
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
          <div className="form-group">
            <label className="form-label">Muscle Soreness (DOMS)</label>
            <div className="slider-container">
              <input type="range" min="1" max="10" className="slider" value={morningData.muscleSoreness} onChange={(e) => setMorningData({...morningData, muscleSoreness: parseInt(e.target.value)})} />
              <span className="slider-val">{morningData.muscleSoreness}/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Cardiovascular Vitals */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🩺 Cardiovascular & Vitals
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log resting heart rate and blood pressure measurements.</span>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label className="form-label">Resting Heart Rate (BPM)</label>
            <input type="number" className="form-input" required placeholder="e.g. 58" value={morningData.restingHR} onChange={(e) => setMorningData({...morningData, restingHR: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Blood Pressure (mmHg)</label>
            <input type="text" className="form-input" placeholder="e.g. 120/80" value={morningData.bloodPressure} onChange={(e) => setMorningData({...morningData, bloodPressure: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700 }}>
          🚀 Submit Morning Log
        </button>
      </div>
    </form>
  );
}
