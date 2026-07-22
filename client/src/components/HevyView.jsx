import React from 'react';

export default function HevyView({
  hevyStatus,
  hevyWorkouts,
  workoutsLoading,
  workoutsError,
  analysisLoading,
  analysisError,
  analysisText,
  generateAIWorkoutAnalysis
}) {
  const formatBoldText = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      let trimmed = line.trim();
      
      if (trimmed.startsWith('###')) {
        return <h4 key={i} className="md-h4" style={{ marginTop: '12px', marginBottom: '6px', fontWeight: 700 }}>{trimmed.replace('###', '').trim()}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={i} className="md-h3" style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 700 }}>{trimmed.replace('##', '').trim()}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={i} className="md-h2" style={{ marginTop: '20px', marginBottom: '10px', fontWeight: 700 }}>{trimmed.replace('#', '').trim()}</h2>;
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const itemText = trimmed.replace(/^[-*]\s+/, '');
        return (
          <ul key={i} className="md-ul" style={{ margin: '4px 0 4px 16px', paddingLeft: '8px' }}>
            <li>{formatBoldText(itemText)}</li>
          </ul>
        );
      }
      return <p key={i} className="md-p" style={{ margin: '6px 0', lineHeight: '1.5' }}>{formatBoldText(line)}</p>;
    });
  };

  return (
    <div className="hevy-container">
      <div className="section-title">
        <h2>💪 Gym Workouts & AI Coach</h2>
        <p>Sync your training sessions from Hevy and generate AI progress analysis.</p>
      </div>

      {!hevyStatus.hevyApiKeyConfigured ? (
        <div className="settings-section">
          <h3 className="settings-section-title" style={{ color: 'var(--accent-red)', borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
            🔑 Configure Hevy API Key
          </h3>
          <p className="settings-section-desc">To view your gym sessions, open the <strong>.env</strong> file at the root of your project and configure your Hevy API key:</p>
          <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', margin: '12px 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>HEVY_API_KEY=your_hevy_api_key</pre>
          <p className="settings-section-desc" style={{ fontSize: '0.85rem' }}>You can generate an API key via the Hevy web app at <em>hevy.com/settings?developer</em> (requires Hevy Pro).</p>
          <p className="settings-section-desc" style={{ fontSize: '0.85rem' }}>After saving the file, restart the server by running <code>sh install.sh</code> in the project folder.</p>
        </div>
      ) : (
        <div className="hevy-layout">
          {/* AI Coach Panel */}
          <div className="ai-coach-panel">
            <div className="ai-coach-header">
              <div className="ai-coach-title-group">
                <h3 className="settings-section-title" style={{ border: 'none', margin: 0, padding: 0 }}>
                  🤖 Coach Gemini Analysis
                </h3>
                <p className="settings-section-desc" style={{ margin: '4px 0 0 0' }}>Get feedback on volume, overloading, and consistency trends.</p>
              </div>
              {hevyStatus.geminiApiKeyConfigured ? (
                <button 
                  className="btn btn-primary" 
                  disabled={analysisLoading || hevyWorkouts.length === 0} 
                  onClick={generateAIWorkoutAnalysis}
                >
                  {analysisLoading ? 'Analyzing...' : analysisText ? 'Re-run Analysis' : 'Run AI Analysis'}
                </button>
              ) : null}
            </div>

            {!hevyStatus.geminiApiKeyConfigured ? (
              <div className="alert alert-warning" style={{ margin: 0, padding: '16px', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                <p style={{ margin: 0 }}>To enable AI Workout Analysis, please configure your Gemini API Key in the <strong>.env</strong> file:</p>
                <pre style={{ background: '#fcf8e3', padding: '8px', borderRadius: '4px', border: '1px solid #faebcc', margin: '8px 0', fontFamily: 'monospace', fontSize: '0.85rem' }}>GEMINI_API_KEY=your_gemini_api_key</pre>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Get a free API key from Google AI Studio.</p>
              </div>
            ) : (
              <div className="ai-analysis-box">
                {analysisLoading && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <p className="pulse-glow" style={{ fontWeight: 600, margin: 0 }}>🤖 Coach Gemini is analyzing your training volume, progressive overload, and consistency trends...</p>
                  </div>
                )}
                {analysisError && (
                  <p style={{ color: 'var(--accent-red)', fontWeight: 600, margin: 0 }}>Error: {analysisError}</p>
                )}
                {!analysisLoading && !analysisError && !analysisText && (
                  <p className="text-muted" style={{ margin: 0, textAlign: 'center' }}>Click "Run AI Analysis" to critique your recent workouts.</p>
                )}
                {!analysisLoading && !analysisError && analysisText && (
                  <div className="markdown-content">
                    {renderMarkdown(analysisText)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Workouts Grid */}
          <div className="workouts-section">
            <h3 className="settings-section-title" style={{ marginBottom: '16px' }}>📅 Recent Workout Logs</h3>
            {workoutsLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p className="pulse-glow" style={{ fontWeight: 600, margin: 0 }}>Syncing with Hevy...</p>
              </div>
            )}
            {workoutsError && (
              <div className="alert alert-warning" style={{ padding: '16px', background: '#fff5f5', borderLeft: '4px solid var(--accent-red)' }}>
                <p style={{ color: 'var(--accent-red)', fontWeight: 600, margin: 0 }}>Failed to fetch workouts: {workoutsError}</p>
              </div>
            )}
            {!workoutsLoading && !workoutsError && hevyWorkouts.length === 0 && (
              <p className="text-muted" style={{ textAlign: 'center', padding: '40px 0', margin: 0 }}>No workouts found. Log workouts in the Hevy app to sync them here!</p>
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
                                const wt = s.weight_kg !== null && s.weight_kg !== undefined ? `${s.weight_kg} kg` : 'Bodyweight';
                                const reps = s.reps || 0;
                                const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
                                return (
                                  <div key={sIdx} className="workout-set-row">
                                    <span>Set {sIdx + 1}: {reps} reps</span>
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
