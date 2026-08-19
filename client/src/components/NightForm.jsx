import React from 'react';
import { compressImage } from '../utils/imageCompressor';

export default function NightForm({
  nightData,
  setNightData,
  supplementsList = ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'],
  enforceBlocker = true,
  enforceProteinShakeBlocker = true,
  API_URL = '',
  editingDate,
  cancelEditing,
  onSubmit
}) {
  const [uploadingShakePhoto, setUploadingShakePhoto] = React.useState(false);
  const proteinShake = nightData.proteinShake || { taken: false, photoUrl: '' };

  const handleToggleShakeTaken = () => {
    setNightData({
      ...nightData,
      proteinShake: {
        ...proteinShake,
        taken: !proteinShake.taken
      }
    });
  };

  const handleShakePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    setUploadingShakePhoto(true);
    try {
      const dataUrl = await compressImage(file, 1600, 0.8);
      const targetDate = editingDate || new Date().toISOString().split('T')[0];

      const res = await fetch(`${API_URL}/api/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          pose: 'protein_shake',
          dataUrl
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setNightData({
          ...nightData,
          proteinShake: {
            ...proteinShake,
            taken: true,
            photoUrl: data.url
          }
        });
      } else {
        const errorMsg = data.detail || data.error || (res.status ? `HTTP ${res.status}: ${res.statusText}` : 'Unknown error');
        alert(`Photo upload failed: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
      }
    } catch (err) {
      console.error('Error uploading shake photo:', err);
      alert(`Failed to upload protein shake photo: ${err.message || 'Unknown error'}`);
    } finally {
      setUploadingShakePhoto(false);
    }
  };
  const currentSupplements = typeof nightData.supplements === 'object' && nightData.supplements !== null && !Array.isArray(nightData.supplements)
    ? nightData.supplements
    : {};

  const handleToggleSupplement = (suppName) => {
    const updated = {
      ...currentSupplements,
      [suppName]: !currentSupplements[suppName]
    };
    setNightData({ ...nightData, supplements: updated });
  };

  const allChecked = supplementsList.length > 0 && supplementsList.every(s => Boolean(currentSupplements[s]));
  const completedCount = supplementsList.filter(s => Boolean(currentSupplements[s])).length;

  const handleToggleAll = () => {
    const nextState = !allChecked;
    const updated = {};
    supplementsList.forEach(s => { updated[s] = nextState; });
    setNightData({ ...nightData, supplements: updated });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="section-title" style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          🌙 Night Log & Evening Reflection
        </h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
          Required before bed. Determines evening lock compliance and logs daily nutrition, activity, and supplements.
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

      {/* Card 1: Nutrition & Macros */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🥗 Macronutrients & Nutrition
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log daily calorie targets, macros, water intake, and food quality.</span>
        </div>

        <div className="form-grid-4" style={{ marginBottom: '18px' }}>
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
            <label className="form-label">Food Quality Rating</label>
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
      </div>

      {/* Card 1.5: Required Protein Shake & Proof Photo */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🥤 Required Protein Shake & Proof Photo
              {enforceProteinShakeBlocker && (
                <span style={{
                  fontSize: '0.75rem',
                  background: (proteinShake.taken && proteinShake.photoUrl) ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: (proteinShake.taken && proteinShake.photoUrl) ? '#4ade80' : '#f87171',
                  border: `1px solid ${(proteinShake.taken && proteinShake.photoUrl) ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}>
                  {(proteinShake.taken && proteinShake.photoUrl) ? '✓ Blocker Cleared' : '🔒 Blocker Required'}
                </span>
              )}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Confirmation and proof photo required daily to unlock device.</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: proteinShake.taken ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${proteinShake.taken ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={Boolean(proteinShake.taken)}
              onChange={handleToggleShakeTaken}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600, color: proteinShake.taken ? '#4ade80' : 'var(--text-secondary)' }}>
              I have taken my required daily protein shake
            </span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {proteinShake.photoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src={proteinShake.photoUrl.startsWith('http') ? proteinShake.photoUrl : `${API_URL || ''}${proteinShake.photoUrl}`} 
                  alt="protein shake proof" 
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }} 
                />
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  📷 Change Photo
                  <input type="file" accept="image/*" onChange={handleShakePhotoSelect} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                📷 {uploadingShakePhoto ? 'Uploading...' : 'Upload Proof Photo'}
                <input type="file" accept="image/*" onChange={handleShakePhotoSelect} disabled={uploadingShakePhoto} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Supplement Stack & Digestive Wellness */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              💊 Supplement Stack & Bio-Metrics
              {enforceBlocker && (
                <span style={{
                  fontSize: '0.75rem',
                  background: allChecked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: allChecked ? '#4ade80' : '#f87171',
                  border: `1px solid ${allChecked ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}>
                  {allChecked ? '✓ Blocker Cleared' : `🔒 Blocker Required (${completedCount}/${supplementsList.length})`}
                </span>
              )}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Check off daily supplements taken and record appetite & digestive stress.</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToggleAll}
            style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          >
            {allChecked ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Supplement Checkbox Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {supplementsList.map((supp) => {
            const isChecked = Boolean(currentSupplements[supp]);
            return (
              <label
                key={supp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isChecked ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isChecked ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleSupplement(supp)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary, #6366f1)' }}
                />
                <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
                  {supp}
                </span>
              </label>
            );
          })}
        </div>

        <div className="form-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
        </div>
      </div>

      {/* Card 3: Training & Workouts */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ Activity & Workouts
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log training session details, strength rating, cardio, and daily step volume.</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '18px',
          alignItems: 'start'
        }}>
          {/* Training Day Toggle Card */}
          <div className="form-group">
            <label className="form-label">Training Day</label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm, 8px)',
              background: nightData.trainingDay === 'Yes' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${nightData.trainingDay === 'Yes' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              cursor: 'pointer',
              height: '42px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: nightData.trainingDay === 'Yes' ? '#4ade80' : 'var(--text-secondary)' }}>
                {nightData.trainingDay === 'Yes' ? '💪 Yes (Trained)' : '💤 Rest Day'}
              </span>
              <input
                type="checkbox"
                checked={nightData.trainingDay === 'Yes'}
                onChange={(e) => setNightData({...nightData, trainingDay: e.target.checked ? 'Yes' : 'No'})}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-green, #10b981)' }}
              />
            </label>
          </div>

          {/* Strength Rating Slider */}
          <div className="form-group">
            <label className="form-label">Strength Performance</label>
            <div className="slider-container" style={{ height: '42px', boxSizing: 'border-box' }}>
              <input
                type="range"
                min="1"
                max="10"
                className="slider"
                disabled={nightData.trainingDay === 'No'}
                value={nightData.strengthPerformance}
                onChange={(e) => setNightData({...nightData, strengthPerformance: parseInt(e.target.value)})}
              />
              <span className="slider-val">{nightData.trainingDay === 'No' ? 'N/A' : `${nightData.strengthPerformance}/10`}</span>
            </div>
          </div>

          {/* Cardio Performed Toggle Card */}
          <div className="form-group">
            <label className="form-label">Cardio Performed</label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm, 8px)',
              background: nightData.cardioPerformed === 'Yes' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${nightData.cardioPerformed === 'Yes' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              cursor: 'pointer',
              height: '42px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: nightData.cardioPerformed === 'Yes' ? '#22d3ee' : 'var(--text-secondary)' }}>
                {nightData.cardioPerformed === 'Yes' ? '🏃 Yes (Completed)' : '⛔ None'}
              </span>
              <input
                type="checkbox"
                checked={nightData.cardioPerformed === 'Yes'}
                onChange={(e) => setNightData({...nightData, cardioPerformed: e.target.checked ? 'Yes' : 'No'})}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-cyan, #06b6d4)' }}
              />
            </label>
          </div>

          {/* Daily Steps Input */}
          <div className="form-group">
            <label className="form-label">Daily Steps</label>
            <input
              type="number"
              className="form-input"
              required
              placeholder="e.g. 13250"
              value={nightData.steps}
              onChange={(e) => setNightData({...nightData, steps: e.target.value})}
              style={{ height: '42px', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700 }}>
          🚀 Submit Night Log
        </button>
      </div>
    </form>
  );
}
