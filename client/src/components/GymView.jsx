import React from 'react';

export default function GymView({
  status,
  config,
  gymVerifyLoading,
  gymVerifyResult,
  gymVerifyError,
  handleVerifyGymWorkout
}) {
  return (
    <div className="gym-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div className="section-title">
        <h2>💪 Gym Workout Verification</h2>
        <p>Sync and verify your gym routines from Hevy to unlock your computer.</p>
      </div>

      {/* Status Indicator Card */}
      <div className="settings-section" style={{
        background: status.locked && status.window === 'gym' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
        borderLeft: `4px solid ${status.locked && status.window === 'gym' ? 'var(--accent-red)' : 'var(--accent-green)'}`,
        padding: '20px',
        borderRadius: '6px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: status.locked && status.window === 'gym' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              {status.locked && status.window === 'gym' ? '🔒 Locked State Active' : '🔓 Unlocked & Verified'}
            </h3>
            <p className="settings-section-desc" style={{ margin: '8px 0 0 0' }}>
              {status.locked && status.window === 'gym' 
                ? 'Your device is locked because today\'s gym routine was not completed or verified.' 
                : 'Gym requirements for today have been successfully completed!'}
            </p>
          </div>
          <button 
            className={`btn ${status.locked && status.window === 'gym' ? 'btn-danger' : 'btn-success'}`}
            disabled={gymVerifyLoading}
            onClick={handleVerifyGymWorkout}
            style={{ padding: '10px 20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {gymVerifyLoading ? (
              <>🔄 Syncing & Verifying...</>
            ) : (
              <>💪 Verify Workout</>
            )}
          </button>
        </div>

        {gymVerifyError && (
          <div className="alert alert-warning" style={{ marginTop: '16px', background: '#fff5f5', borderLeft: '4px solid var(--accent-red)', padding: '12px' }}>
            <p style={{ color: 'var(--accent-red)', fontWeight: 600, margin: 0 }}>Verification Failed: {gymVerifyError}</p>
          </div>
        )}

        {gymVerifyResult && gymVerifyResult.success && (
          <div className="alert alert-success" style={{ marginTop: '16px', background: '#ecfdf5', borderLeft: '4px solid var(--accent-green)', padding: '12px' }}>
            <p style={{ color: 'var(--accent-green)', fontWeight: 600, margin: 0 }}>Success! {gymVerifyResult.reason}</p>
          </div>
        )}
      </div>

      {/* Workout verification requirements & logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Column: Requirements Checklist */}
        <div className="settings-section" style={{ height: 'fit-content' }}>
          <h4 className="settings-section-title" style={{ fontSize: '1.05rem', marginBottom: '12px' }}>📋 Verification Rules</h4>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🕒</span>
              <span>Lock activates daily at <strong>{config.gymLockStartHour}:00 PM</strong></span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>⏱️</span>
              <span>Workout duration must be <strong>&ge; {config.gymMinDurationMinutes} minutes</strong></span>
            </li>
          </ul>
        </div>

        {/* Right Column: Today's Workout Details */}
        <div className="settings-section" style={{ height: 'fit-content' }}>
          <h4 className="settings-section-title" style={{ fontSize: '1.05rem', marginBottom: '12px' }}>🏋️ Today's Logged Workout</h4>
          {gymVerifyResult?.workout || (status.entry && status.entry.gymWorkoutData) ? (
            (() => {
              const w = gymVerifyResult?.workout || status.entry.gymWorkoutData;
              const durationMins = Math.round((new Date(w.end_time || new Date()) - new Date(w.start_time)) / 60000);
              return (
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '1.1rem' }}>{w.title}</p>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#64748b' }}>
                    🕒 Started: {new Date(w.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({durationMins} mins duration)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {w.exercises?.map((e, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                        <span>{e.title}</span>
                        <span style={{ fontWeight: 500 }}>{e.sets?.length} sets</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-muted" style={{ margin: 0, textAlign: 'center', padding: '20px 0' }}>
              No verified workout found for today. Make sure you complete your session in the Hevy app and hit sync.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
