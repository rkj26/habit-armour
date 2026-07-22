import React from 'react';

export default function NightForm({ nightData, setNightData, editingDate, cancelEditing, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="section-title">
        <h2>Nutrition & Daily Training</h2>
        <p>Required before bed. Determines evening lock compliance.</p>
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

      <h3 className="sub-section-title">Macronutrients & Food</h3>
      <div className="form-grid-4">
        <div className="form-group">
          <label className="form-label">Total Calories (kcal)</label>
          <input type="number" className="form-input" required placeholder="e.g. 2400" value={nightData.calories} onChange={(e) => setNightData({...nightData, calories: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Protein (g)</label>
          <input type="number" className="form-input" required placeholder="e.g. 180" value={nightData.protein} onChange={(e) => setNightData({...nightData, protein: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Carbs (g)</label>
          <input type="number" className="form-input" required placeholder="e.g. 220" value={nightData.carbs} onChange={(e) => setNightData({...nightData, carbs: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Fats (g)</label>
          <input type="number" className="form-input" required placeholder="e.g. 70" value={nightData.fats} onChange={(e) => setNightData({...nightData, fats: e.target.value})} />
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Food Quality</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={nightData.foodQuality} onChange={(e) => setNightData({...nightData, foodQuality: parseInt(e.target.value)})} />
            <span className="slider-val">{nightData.foodQuality}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Water Consumed (Liters)</label>
          <input type="number" step="0.1" className="form-input" placeholder="e.g. 3.5" value={nightData.waterConsumed} onChange={(e) => setNightData({...nightData, waterConsumed: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Alcohol Consumed?</label>
          <select className="form-input" value={nightData.alcoholConsumed} onChange={(e) => setNightData({...nightData, alcoholConsumed: e.target.value})}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Hunger / Appetite</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={nightData.hunger} onChange={(e) => setNightData({...nightData, hunger: parseInt(e.target.value)})} />
            <span className="slider-val">{nightData.hunger}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Digestive Stress</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={nightData.digestiveStress} onChange={(e) => setNightData({...nightData, digestiveStress: parseInt(e.target.value)})} />
            <span className="slider-val">{nightData.digestiveStress}/10</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Supplements Rating</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" value={nightData.supplements} onChange={(e) => setNightData({...nightData, supplements: parseInt(e.target.value)})} />
            <span className="slider-val">{nightData.supplements}/10</span>
          </div>
        </div>
      </div>

      <h3 className="sub-section-title">Activity & Workouts</h3>
      <div className="form-grid-4">
        <div className="form-group">
          <label className="form-label" style={{ visibility: 'hidden' }}>Training Day?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
            <input 
              type="checkbox" 
              id="trainingDay"
              checked={nightData.trainingDay === 'Yes'} 
              onChange={(e) => setNightData({...nightData, trainingDay: e.target.checked ? 'Yes' : 'No'})}
              style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="trainingDay" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
              Training Day?
            </label>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Strength Rating</label>
          <div className="slider-container">
            <input type="range" min="1" max="10" className="slider" disabled={nightData.trainingDay === 'No'} value={nightData.strengthPerformance} onChange={(e) => setNightData({...nightData, strengthPerformance: parseInt(e.target.value)})} />
            <span className="slider-val">{nightData.trainingDay === 'No' ? 'N/A' : `${nightData.strengthPerformance}/10`}</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Daily Steps</label>
          <input type="number" className="form-input" required placeholder="e.g. 10450" value={nightData.steps} onChange={(e) => setNightData({...nightData, steps: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ visibility: 'hidden' }}>Cardio Performed?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
            <input 
              type="checkbox" 
              id="cardioPerformed"
              checked={nightData.cardioPerformed === 'Yes'} 
              onChange={(e) => setNightData({...nightData, cardioPerformed: e.target.checked ? 'Yes' : 'No'})}
              style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="cardioPerformed" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
              Cardio Performed?
            </label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg">Submit Night Log</button>
      </div>
    </form>
  );
}
