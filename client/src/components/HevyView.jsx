import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function HevyView({
  hevyStatus,
  hevyWorkouts,
  workoutsLoading,
  workoutsError,
  fetchHevyWorkouts
}) {
  const [showCreator, setShowCreator] = useState(false);
  const [creatorMode, setCreatorMode] = useState('quick'); // 'quick' or 'custom'
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  // Quick Cardio Form State
  const [quickActivity, setQuickActivity] = useState('walking');
  const [quickDuration, setQuickDuration] = useState(30);
  const [quickTitle, setQuickTitle] = useState('Outdoor Walk 🌙');
  const [quickNotes, setQuickNotes] = useState('Logged via Habit Armour');

  // Custom Workout Form State
  const [customTitle, setCustomTitle] = useState('Gym Workout Session');
  const [customNotes, setCustomNotes] = useState('Pushed from Habit Armour');
  const [exercisesList, setExercisesList] = useState([
    {
      templateId: '7EB3F7C3', // Chest Press (Machine) default example
      title: 'Chest Press (Machine)',
      sets: [
        { type: 'normal', weight_kg: 40, reps: 10 },
        { type: 'normal', weight_kg: 45, reps: 8 }
      ]
    }
  ]);

  // Exercise Templates State
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    if (hevyStatus?.hevyApiKeyConfigured) {
      fetchTemplates();
    }
  }, [hevyStatus]);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await api.hevy.templates();
      setTemplates(data.exercise_templates || data || []);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const CARDIO_PRESETS = {
    walking: { title: 'Outdoor Walk 🌙', templateId: '33EDD7DB', name: 'Walking' },
    running: { title: 'Running Session 🏃‍♂️', templateId: '33EDD7DB', name: 'Running' },
    elliptical: { title: 'Elliptical Cardio ⚡', templateId: '3303376C', name: 'Elliptical Trainer' },
    cycling: { title: 'Cycling Workout 🚴‍♂️', templateId: 'D8F7F851', name: 'Cycling' }
  };

  const handleSelectQuickPreset = (key) => {
    setQuickActivity(key);
    setQuickTitle(CARDIO_PRESETS[key].title);
  };

  const handleUploadQuickCardio = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const preset = CARDIO_PRESETS[quickActivity];
    const durationSec = Number(quickDuration) * 60;
    const now = new Date();
    const startTime = new Date(now.getTime() - durationSec * 1000).toISOString();
    const endTime = now.toISOString();

    const payload = {
      title: quickTitle || preset.title,
      description: quickNotes,
      start_time: startTime,
      end_time: endTime,
      exercises: [
        {
          exercise_template_id: preset.templateId,
          notes: '',
          sets: [
            {
              type: 'normal',
              duration_seconds: durationSec
            }
          ]
        }
      ]
    };

    try {
      await api.hevy.uploadWorkout(payload);
      setUploadSuccess(`Successfully uploaded "${payload.title}" to Hevy!`);
      if (fetchHevyWorkouts) fetchHevyWorkouts();
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddExerciseRow = () => {
    setExercisesList(prev => [
      ...prev,
      {
        templateId: templates[0]?.id || '7EB3F7C3',
        title: templates[0]?.title || 'Chest Press (Machine)',
        sets: [{ type: 'normal', weight_kg: 30, reps: 10 }]
      }
    ]);
  };

  const handleRemoveExerciseRow = (idx) => {
    setExercisesList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddSetRow = (exIdx) => {
    setExercisesList(prev => {
      const copy = [...prev];
      const ex = { ...copy[exIdx] };
      const lastSet = ex.sets[ex.sets.length - 1] || { type: 'normal', weight_kg: 20, reps: 10 };
      ex.sets = [...ex.sets, { ...lastSet }];
      copy[exIdx] = ex;
      return copy;
    });
  };

  const handleRemoveSetRow = (exIdx, setIdx) => {
    setExercisesList(prev => {
      const copy = [...prev];
      const ex = { ...copy[exIdx] };
      ex.sets = ex.sets.filter((_, i) => i !== setIdx);
      copy[exIdx] = ex;
      return copy;
    });
  };

  const handleSetChange = (exIdx, setIdx, field, val) => {
    setExercisesList(prev => {
      const copy = [...prev];
      const ex = { ...copy[exIdx] };
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: val };
      ex.sets = sets;
      copy[exIdx] = ex;
      return copy;
    });
  };

  const handleUploadCustomWorkout = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const now = new Date();
    const startTime = new Date(now.getTime() - 45 * 60000).toISOString();
    const endTime = now.toISOString();

    const payload = {
      title: customTitle || 'Custom Gym Session',
      description: customNotes,
      start_time: startTime,
      end_time: endTime,
      exercises: exercisesList.map(e => ({
        exercise_template_id: e.templateId,
        notes: '',
        sets: e.sets.map(s => ({
          type: s.type || 'normal',
          weight_kg: Number(s.weight_kg) || 0,
          reps: Number(s.reps) || 0
        }))
      }))
    };

    try {
      await api.hevy.uploadWorkout(payload);
      setUploadSuccess(`Successfully uploaded "${payload.title}" to Hevy!`);
      if (fetchHevyWorkouts) fetchHevyWorkouts();
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };



  return (
    <div className="hevy-container">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            💪 Gym Workouts & Hevy Integration
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
            Sync training logs and post workouts directly to Hevy.
          </p>
        </div>
        {hevyStatus.hevyApiKeyConfigured && (
          <button 
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
            onClick={() => setShowCreator(!showCreator)}
          >
            {showCreator ? '✖️ Close Creator' : '➕ Upload Workout to Hevy'}
          </button>
        )}
      </div>

      {!hevyStatus.hevyApiKeyConfigured ? (
        <div className="settings-section">
          <h3 className="settings-section-title" style={{ color: 'var(--color-danger)', borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
            🔑 Configure Hevy API Key
          </h3>
          <p className="settings-section-desc">To view & upload workouts, open the <strong>.env</strong> file at the root of your project and configure your Hevy API key:</p>
          <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', margin: '12px 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>HEVY_API_KEY=your_hevy_api_key</pre>
          <p className="settings-section-desc" style={{ fontSize: '0.85rem' }}>You can generate an API key via the Hevy web app at <em>hevy.com/settings?developer</em> (requires Hevy Pro).</p>
        </div>
      ) : (
        <div className="hevy-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Interactive Hevy Workout Creator Card */}
          {showCreator && (
            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📤 Create & Upload Workout to Hevy API
                </h3>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
                  <button 
                    type="button" 
                    className={`btn ${creatorMode === 'quick' ? 'btn-primary' : ''}`} 
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }} 
                    onClick={() => setCreatorMode('quick')}
                  >
                    ⚡ Quick Cardio Preset
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${creatorMode === 'custom' ? 'btn-primary' : ''}`} 
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }} 
                    onClick={() => setCreatorMode('custom')}
                  >
                    🏋️ Custom Workout Builder
                  </button>
                </div>
              </div>

              {uploadSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '16px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px 16px', borderRadius: '8px' }}>
                  ✅ {uploadSuccess}
                </div>
              )}
              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: '16px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '8px' }}>
                  ❌ {uploadError}
                </div>
              )}

              {creatorMode === 'quick' ? (
                <form onSubmit={handleUploadQuickCardio} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Cardio Activity Preset:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {Object.keys(CARDIO_PRESETS).map(key => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectQuickPreset(key)}
                        style={{
                          background: quickActivity === key ? 'var(--color-accent)' : 'var(--bg-subtle)',
                          color: quickActivity === key ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${quickActivity === key ? 'var(--color-accent)' : 'var(--border-color)'}`,
                          padding: '12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {CARDIO_PRESETS[key].name}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Workout Title</label>
                      <input 
                        type="text" 
                        value={quickTitle} 
                        onChange={(e) => setQuickTitle(e.target.value)} 
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Duration (Minutes)</label>
                      <input 
                        type="number" 
                        value={quickDuration} 
                        onChange={(e) => setQuickDuration(e.target.value)} 
                        className="form-control" 
                        min="1" 
                        max="300" 
                        required 
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Notes / Description (Optional)</label>
                    <input 
                      type="text" 
                      value={quickNotes} 
                      onChange={(e) => setQuickNotes(e.target.value)} 
                      className="form-control" 
                      placeholder="e.g. Incline 5%, zone 2 cardio" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={uploading} 
                    style={{ alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 700 }}
                  >
                    {uploading ? 'Uploading to Hevy...' : '🚀 Push Session to Hevy'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleUploadCustomWorkout} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Workout Title</label>
                      <input 
                        type="text" 
                        value={customTitle} 
                        onChange={(e) => setCustomTitle(e.target.value)} 
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Notes</label>
                      <input 
                        type="text" 
                        value={customNotes} 
                        onChange={(e) => setCustomNotes(e.target.value)} 
                        className="form-control" 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>Exercises ({exercisesList.length})</label>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={handleAddExerciseRow} 
                        style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'var(--bg-subtle)' }}
                      >
                        ➕ Add Exercise
                      </button>
                    </div>

                    {exercisesList.map((ex, exIdx) => (
                      <div key={exIdx} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <select
                            value={ex.templateId}
                            onChange={(e) => {
                              const selId = e.target.value;
                              const match = templates.find(t => t.id === selId);
                              setExercisesList(prev => {
                                const copy = [...prev];
                                copy[exIdx].templateId = selId;
                                copy[exIdx].title = match?.title || selId;
                                return copy;
                              });
                            }}
                            className="form-control"
                            style={{ maxWidth: '320px', fontWeight: 600 }}
                          >
                            {templates.length > 0 ? (
                              templates.map(t => (
                                <option key={t.id} value={t.id}>{t.title} ({t.primary_muscle_group || 'exercise'})</option>
                              ))
                            ) : (
                              <option value={ex.templateId}>{ex.title}</option>
                            )}
                          </select>

                          {exercisesList.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveExerciseRow(exIdx)} 
                              style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        {/* Sets table */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {ex.sets.map((s, setIdx) => (
                            <div key={setIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '0.85rem', minWidth: '50px', color: 'var(--text-secondary)' }}>Set {setIdx + 1}:</span>
                              <input 
                                type="number" 
                                placeholder="Weight kg" 
                                value={s.weight_kg} 
                                onChange={(e) => handleSetChange(exIdx, setIdx, 'weight_kg', e.target.value)} 
                                className="form-control" 
                                style={{ width: '100px' }} 
                              />
                              <span style={{ fontSize: '0.85rem' }}>kg ×</span>
                              <input 
                                type="number" 
                                placeholder="Reps" 
                                value={s.reps} 
                                onChange={(e) => handleSetChange(exIdx, setIdx, 'reps', e.target.value)} 
                                className="form-control" 
                                style={{ width: '90px' }} 
                              />
                              <span style={{ fontSize: '0.85rem' }}>reps</span>
                              {ex.sets.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveSetRow(exIdx, setIdx)} 
                                  style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          <button 
                            type="button" 
                            onClick={() => handleAddSetRow(exIdx)} 
                            style={{ alignSelf: 'flex-start', marginTop: '6px', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            + Add Set
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={uploading} 
                    style={{ alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 700 }}
                  >
                    {uploading ? 'Uploading Workout...' : '🚀 Push Workout to Hevy'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Workouts Grid */}
          <div className="workouts-section">
            <h3 className="settings-section-title" style={{ marginBottom: '16px' }}>📅 Recent Workout Logs</h3>
            {workoutsLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p className="pulse-glow" style={{ fontWeight: 600, margin: 0 }}>Syncing with Hevy...</p>
              </div>
            )}
            {workoutsError && (
              <div className="alert alert-warning" style={{ padding: '16px', background: '#fff5f5', borderLeft: '4px solid var(--color-danger)' }}>
                <p style={{ color: 'var(--color-danger)', fontWeight: 600, margin: 0 }}>Failed to fetch workouts: {workoutsError}</p>
              </div>
            )}
            {!workoutsLoading && !workoutsError && hevyWorkouts.length === 0 && (
              <p className="text-muted" style={{ textAlign: 'center', padding: '40px 0', margin: 0 }}>No workouts found. Log workouts in the Hevy app or use the Creator above!</p>
            )}
            {!workoutsLoading && !workoutsError && hevyWorkouts.length > 0 && (
              <div className="workouts-grid">
                {hevyWorkouts.map((w) => {
                  const dateStr = w.start_time ? new Date(w.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
                  const durationMins = w.start_time && w.end_time ? Math.round((new Date(w.end_time) - new Date(w.start_time)) / 60000) : null;
                  return (
                    <div key={w.id} className="workout-card">
                      <div className="workout-card-header">
                        <h4>{w.title || 'Workout'}</h4>
                        <div className="workout-meta">
                          <span>📅 {dateStr}</span>
                          {durationMins && <span>⏱️ {durationMins} mins</span>}
                        </div>
                        {w.notes && (
                          <p className="workout-notes">"{w.notes}"</p>
                        )}
                      </div>
                      
                      <div className="workout-exercises" style={{ flexGrow: 1 }}>
                        {w.exercises?.map((e, eIdx) => (
                          <div key={eIdx} className="workout-exercise-item">
                            <h5>{e.title}</h5>
                            <div className="workout-sets-list">
                              {e.sets?.map((s, sIdx) => {
                                const wt = s.weight_kg !== null && s.weight_kg !== undefined ? `${s.weight_kg} kg` : (s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} mins` : 'Bodyweight');
                                const reps = s.reps || (s.duration_seconds ? '' : 0);
                                const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
                                return (
                                  <div key={sIdx} className="workout-set-row">
                                    <span>Set {sIdx + 1}: {reps ? `${reps} reps` : 'Cardio'}</span>
                                    <span style={{ fontWeight: 500 }}>{wt}{rpe}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
