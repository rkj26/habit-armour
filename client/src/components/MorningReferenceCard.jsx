import React from 'react';

export default function MorningReferenceCard({ status }) {
  const entry = status?.entry;
  if (!entry) return null;

  const { morningCompleted, morningJournalCompleted, morningData, morningJournalData } = entry;

  // Render nothing if no morning logs were completed today yet
  if (!morningCompleted && !morningJournalCompleted) {
    return (
      <div className="glass-card" style={{ 
        borderLeft: '4px solid var(--color-danger)', 
        background: 'rgba(239, 68, 68, 0.02)',
        padding: '16px 20px',
        marginBottom: '24px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.9rem'
      }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          🌅 <strong>No Morning Logs completed yet today.</strong> Once you fill out your morning metrics and intentions, they will be referenced here to guide your night logging.
        </p>
      </div>
    );
  }

  return (
    <div className="morning-reference-card" style={{ 
      marginBottom: '24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderLeft: '4px solid var(--accent-cyan)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden'
    }}>
      <h3 className="morning-reference-title" style={{ 
        margin: 0,
        padding: '12px 18px',
        background: 'rgba(6, 182, 212, 0.05)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.95rem',
        fontWeight: 700,
        color: 'var(--accent-cyan)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🌅 Today's Morning State & Intentions
      </h3>

      <div style={{ padding: '16px 18px' }}>
        {/* Metrics Grid */}
        {morningCompleted && morningData && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
            gap: '12px',
            marginBottom: morningJournalCompleted && morningJournalData ? '16px' : 0,
            borderBottom: morningJournalCompleted && morningJournalData ? '1px dashed var(--border-color)' : 'none',
            paddingBottom: morningJournalCompleted && morningJournalData ? '16px' : 0
          }}>
            {morningData.wakingWeight && (
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Weight</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{morningData.wakingWeight} kg</strong>
              </div>
            )}
            {morningData.sleepHours && (
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Sleep Duration</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{morningData.sleepHours} hrs</strong>
              </div>
            )}
            {morningData.sleepQualitySelf && (
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Sleep Quality</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{morningData.sleepQualitySelf}/10</strong>
              </div>
            )}
            {morningData.energyLevels && (
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Energy / Mood</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{morningData.energyLevels} / {morningData.mood || 'N/A'}</strong>
              </div>
            )}
            {morningData.restingHR && (
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Resting HR</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{morningData.restingHR} bpm</strong>
              </div>
            )}
          </div>
        )}

        {/* Journal Intentions */}
        {morningJournalCompleted && morningJournalData && (
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              🎯 Morning Intentions
            </span>
            {morningJournalData.journalEntry ? (
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem', 
                lineHeight: '1.6', 
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                background: 'rgba(0, 0, 0, 0.01)',
                padding: '10px 14px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                {morningJournalData.journalEntry}
              </p>
            ) : (
              <div className="morning-reference-grid" style={{
                display: 'grid',
                gap: '8px',
                fontSize: '0.85rem',
                lineHeight: '1.4',
                color: 'var(--text-secondary)'
              }}>
                {morningJournalData.journalQ1 && (
                  <div>
                    <strong>Priority Goals:</strong> {morningJournalData.journalQ1}
                  </div>
                )}
                {morningJournalData.journalQ2 && (
                  <div>
                    <strong>Energy &amp; Mindset:</strong> {morningJournalData.journalQ2}
                  </div>
                )}
                {morningJournalData.journalQ3 && (
                  <div>
                    <strong>Obstacles Plan:</strong> {morningJournalData.journalQ3}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
