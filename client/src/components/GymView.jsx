import React from 'react';

export default function GymView({
  status,
  config,
  gymVerifyLoading,
  gymVerifyResult,
  gymVerifyError,
  handleVerifyGymWorkout
}) {
  const isGymLocked = status.locked && status.window === 'gym';

  return (
    <div className="gym-container" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="section-title" style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          💪 Gym Workout Verification
        </h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
          Sync and verify your gym routines from Hevy to maintain device clearance and track lifting volume.
        </p>
      </div>

      {/* Status Banner Card */}
      <div style={{
        background: isGymLocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
        border: `1px solid ${isGymLocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
        borderLeft: `5px solid ${isGymLocked ? '#ef4444' : '#22c55e'}`,
        padding: '24px',
        borderRadius: 'var(--radius-md, 14px)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: isGymLocked ? '#f87171' : '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isGymLocked ? '🔒 Lock State Active' : '🔓 Workout Verified & Cleared'}
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {isGymLocked 
                ? 'Device is currently locked because today\'s required workout has not been logged or verified.' 
                : 'Gym requirements for today are verified. Computer lock cleared.'}
            </p>
          </div>
          <button 
            className={`btn ${isGymLocked ? 'btn-danger' : 'btn-primary'}`}
            disabled={gymVerifyLoading}
            onClick={handleVerifyGymWorkout}
            style={{ padding: '12px 24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem' }}
          >
            {gymVerifyLoading ? (
              <>🔄 Syncing & Verifying...</>
            ) : (
              <>💪 Sync & Verify Workout</>
            )}
          </button>
        </div>

        {gymVerifyError && (
          <div style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: '8px' }}>
            <p style={{ color: '#f87171', fontWeight: 600, margin: 0, fontSize: '0.88rem' }}>Verification Failed: {gymVerifyError}</p>
          </div>
        )}

        {gymVerifyResult && gymVerifyResult.success && (
          <div style={{ marginTop: '16px', background: 'rgba(34, 197, 94, 0.12)', borderLeft: '4px solid #22c55e', padding: '12px 16px', borderRadius: '8px' }}>
            <p style={{ color: '#4ade80', fontWeight: 600, margin: 0, fontSize: '0.88rem' }}>Success! {gymVerifyResult.reason}</p>
          </div>
        )}
      </div>

      {/* Weekly Goal & Rest Days Summary Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '12px',
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '2.2rem' }}>🎯</div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Weekly Active Goal</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {status.weeklyActiveCount !== undefined ? status.weeklyActiveCount : 0} / {status.gymWeeklyGoal || config.gymWeeklyGoal || 5} Active Days
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {(status.weeklyActiveCount || 0) >= (status.gymWeeklyGoal || config.gymWeeklyGoal || 5) ? '✓ Weekly target reached!' : `Lifting, Cardio, or ${config.gymMinSteps || 13000} Steps counts`}
            </span>
          </div>
        </div>

        <div style={{
          background: status.isYesterdayActive === false ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
          border: `1px solid ${status.isYesterdayActive === false ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
          borderRadius: '12px',
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '2.2rem' }}>{status.isYesterdayActive === false ? '🚫' : '💪'}</div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Rest Days Rule</span>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: status.isYesterdayActive === false ? '#f87171' : '#4ade80', marginTop: '2px' }}>
              {status.isYesterdayActive === false ? 'Yesterday Skipped -> TODAY MANDATORY' : 'Yesterday Active -> Rest Day Allowed'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Max 1 consecutive rest day allowed
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Verification Rules & Logged Workout Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Left Column: Requirements Checklist */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md, 14px)',
          padding: '24px',
          height: 'fit-content'
        }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            📋 Verification Rules
          </h4>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🕒</span>
              <div>
                <strong>Daily Activation Hour</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Gym lock activates daily at <strong>{config.gymLockStartHour}:00 PM</strong></div>
              </div>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
              <span style={{ fontSize: '1.3rem' }}>⏱️</span>
              <div>
                <strong>Minimum Workout Duration</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Logged session must be <strong>&ge; {config.gymMinDurationMinutes} minutes</strong></div>
              </div>
            </li>
          </ul>
        </div>

        {/* Right Column: Today's Workout Details */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md, 14px)',
          padding: '24px',
          height: 'fit-content'
        }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            🏋️ Logged Routine Details
          </h4>
          {gymVerifyResult?.workout || (status.entry && status.entry.gymWorkoutData) ? (
            (() => {
              const w = gymVerifyResult?.workout || status.entry.gymWorkoutData;
              const durationMins = Math.round((new Date(w.end_time || new Date()) - new Date(w.start_time)) / 60000);
              return (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-accent)' }}>{w.title}</p>
                  <p style={{ margin: '0 0 14px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    🕒 Started: {new Date(w.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({durationMins} mins duration)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {w.exercises?.map((e, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                        <span>{e.title}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{e.sets?.length} sets</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
              No workout verified yet today. Complete your session on Hevy and click <strong>Sync & Verify Workout</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
