import React, { useState } from 'react';

export default function HistoryView({
  history,
  config,
  syncAllUnsynced,
  syncingAll,
  syncLogEntry,
  startEditingLog
}) {
  const [expandedEntries, setExpandedEntries] = useState({});

  const toggleEntryExpand = (date) => {
    setExpandedEntries(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const getLogStatusBadge = (entryDate, type, isCompleted) => {
    if (isCompleted) {
      return <span className="badge bg-green">✓ Done</span>;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Future dates
    if (entryDate > todayStr) {
      return <span className="badge" style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-secondary)' }}>Pending</span>;
    }
    
    // Past dates
    if (entryDate < todayStr) {
      return <span className="badge bg-red">✗ Missed</span>;
    }
    
    // Today's date
    const currentHour = new Date().getHours();
    const isMorning = type.startsWith('morning');
    const startHour = isMorning ? (config.morningStart || 5) : (config.nightStart || 20);
    const endHour = isMorning ? (config.morningEnd || 12) : (config.nightEnd || 24);
    
    if (currentHour < startHour) {
      return <span className="badge" style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-secondary)' }}>Pending</span>;
    } else if (currentHour >= startHour && currentHour < endHour) {
      return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>Due Now</span>;
    } else {
      return <span className="badge bg-red">✗ Missed</span>;
    }
  };

  return (
    <div>
      <div className="section-title">
        <h2>Logged Data History</h2>
        <p>All recorded bio-feedback, sleep, nutrition and measurements.</p>
      </div>

      {config.googleSheetsEnabled && config.googleSheetsUrl && history.length > 0 && (
        <div className="sync-header-actions">
          <button 
            className="btn btn-secondary sync-btn-small" 
            onClick={syncAllUnsynced}
            disabled={syncingAll}
          >
            {syncingAll ? 'Syncing...' : '🔄 Sync All Unsynced Logs to Sheets'}
          </button>
        </div>
      )}

      {/* Log a Past/Missed Day widget */}
      <div className="glass-card" style={{ 
        padding: '16px 20px', 
        marginBottom: '24px', 
        display: 'flex', 
        gap: '16px', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        border: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.01)'
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📅 Log a Past/Missed Day
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: '150px', padding: '6px 10px', height: '34px', margin: 0 }}
            id="pastLogDateInput"
            max={new Date().toISOString().split('T')[0]}
          />
          <select 
            className="form-input" 
            style={{ width: '160px', padding: '6px 10px', height: '34px', margin: 0 }}
            id="pastLogTypeInput"
          >
            <option value="morning">Morning Metrics</option>
            <option value="morningJournal">Morning Journal</option>
            <option value="night">Night Metrics</option>
            <option value="nightJournal">Night Journal</option>
            <option value="weekly">Weekly Specs</option>
          </select>
          <button 
            className="btn btn-primary btn-sm" 
            style={{ height: '34px', padding: '0 16px', display: 'flex', alignItems: 'center', fontWeight: 600 }}
            onClick={() => {
              const dateVal = document.getElementById('pastLogDateInput').value;
              const typeVal = document.getElementById('pastLogTypeInput').value;
              if (!dateVal) {
                alert("Please select a date first.");
                return;
              }
              const todayStr = new Date().toISOString().split('T')[0];
              if (dateVal > todayStr) {
                alert("Cannot log future dates.");
                return;
              }
              startEditingLog(dateVal, typeVal);
            }}
          >
            ➕ Start Log
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="no-history text-muted">No logs recorded yet. Start tracking above!</p>
      ) : (
        <div className="table-responsive">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Morning Log</th>
                <th>Morning Journal</th>
                <th>Night Log</th>
                <th>Night Journal</th>
                <th>Weight</th>
                <th>Sleep</th>
                <th>Calories</th>
                <th>Steps</th>
                {config.googleSheetsEnabled && config.googleSheetsUrl && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <React.Fragment key={entry.date}>
                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleEntryExpand(entry.date)}
                  >
                    <td className="font-heading font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: 'none', height: '45px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        transition: 'transform 0.15s ease', 
                        transform: expandedEntries[entry.date] ? 'rotate(90deg)' : 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.65rem'
                      }}>▶</span>
                      {entry.date}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getLogStatusBadge(entry.date, 'morning', entry.morningCompleted)}
                        {config.googleSheetsEnabled && config.googleSheetsUrl && entry.morningCompleted && (
                          <span 
                            className={`sync-status-icon ${entry.morningSynced ? 'synced' : 'unsynced'}`}
                            title={entry.morningSynced ? "Synced to Google Sheets" : "Unsynced"}
                          >
                            {entry.morningSynced ? '✓' : '•'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getLogStatusBadge(entry.date, 'morningJournal', entry.morningJournalCompleted)}
                        {config.googleSheetsEnabled && config.googleSheetsUrl && entry.morningJournalCompleted && (
                          <span 
                            className={`sync-status-icon ${entry.morningJournalSynced ? 'synced' : 'unsynced'}`}
                            title={entry.morningJournalSynced ? "Synced to Google Sheets" : "Unsynced"}
                          >
                            {entry.morningJournalSynced ? '✓' : '•'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getLogStatusBadge(entry.date, 'night', entry.nightCompleted)}
                        {config.googleSheetsEnabled && config.googleSheetsUrl && entry.nightCompleted && (
                          <span 
                            className={`sync-status-icon ${entry.nightSynced ? 'synced' : 'unsynced'}`}
                            title={entry.nightSynced ? "Synced to Google Sheets" : "Unsynced"}
                          >
                            {entry.nightSynced ? '✓' : '•'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getLogStatusBadge(entry.date, 'nightJournal', entry.nightJournalCompleted)}
                        {config.googleSheetsEnabled && config.googleSheetsUrl && entry.nightJournalCompleted && (
                          <span 
                            className={`sync-status-icon ${entry.nightJournalSynced ? 'synced' : 'unsynced'}`}
                            title={entry.nightJournalSynced ? "Synced to Google Sheets" : "Unsynced"}
                          >
                            {entry.nightJournalSynced ? '✓' : '•'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{entry.morningData?.wakingWeight ? `${entry.morningData.wakingWeight} kg` : '-'}</td>
                    <td>{entry.morningData?.sleepHours ? `${entry.morningData.sleepHours} hrs` : '-'}</td>
                    <td>{entry.nightData?.calories ? `${entry.nightData.calories} kcal` : '-'}</td>
                    <td>{entry.nightData?.steps ? parseInt(entry.nightData.steps).toLocaleString() : '-'}</td>
                    {config.googleSheetsEnabled && config.googleSheetsUrl && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {entry.morningCompleted && !entry.morningSynced && (
                            <button 
                              className="btn btn-secondary sync-btn-small"
                              onClick={() => syncLogEntry(entry.date, 'morning')}
                            >
                              Sync Morning
                            </button>
                          )}
                          {entry.morningJournalCompleted && !entry.morningJournalSynced && (
                            <button 
                              className="btn btn-secondary sync-btn-small"
                              onClick={() => syncLogEntry(entry.date, 'morningJournal')}
                            >
                              Sync Morning Journal
                            </button>
                          )}
                          {entry.nightCompleted && !entry.nightSynced && (
                            <button 
                              className="btn btn-secondary sync-btn-small"
                              onClick={() => syncLogEntry(entry.date, 'night')}
                            >
                              Sync Night
                            </button>
                          )}
                          {entry.nightJournalCompleted && !entry.nightJournalSynced && (
                            <button 
                              className="btn btn-secondary sync-btn-small"
                              onClick={() => syncLogEntry(entry.date, 'nightJournal')}
                            >
                              Sync Night Journal
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandedEntries[entry.date] && (
                    <tr className="expanded-row" onClick={(e) => e.stopPropagation()}>
                      <td colSpan={config.googleSheetsEnabled && config.googleSheetsUrl ? "10" : "9"} style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <div className="expanded-journal-grid">
                          <div className="expanded-journal-section">
                            <h4>☀️ Morning Journal</h4>
                            {entry.morningJournalCompleted && entry.morningJournalData ? (
                              <div className="expanded-journal-qa" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                                {entry.morningJournalData.journalEntry ? (
                                  <div>{entry.morningJournalData.journalEntry}</div>
                                ) : (
                                  <>
                                    {entry.morningJournalData.journalQ1 && (
                                      <div style={{ marginBottom: '8px' }}>
                                        <strong>1. Top 3 priority goals:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.morningJournalData.journalQ1}</div>
                                      </div>
                                    )}
                                    {entry.morningJournalData.journalQ2 && (
                                      <div style={{ marginBottom: '8px' }}>
                                        <strong>2. Energetic & emotional tone:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.morningJournalData.journalQ2}</div>
                                      </div>
                                    )}
                                    {entry.morningJournalData.journalQ3 && (
                                      <div>
                                        <strong>3. Obstacles & backup strategy:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.morningJournalData.journalQ3}</div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>No morning journal recorded.</p>
                            )}
                          </div>

                          <div className="expanded-journal-section">
                            <h4>🌙 Evening Retrospective</h4>
                            {entry.nightJournalCompleted && entry.nightJournalData ? (
                              <div className="expanded-journal-qa" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                                {entry.nightJournalData.journalEntry ? (
                                  <div>{entry.nightJournalData.journalEntry}</div>
                                ) : (
                                  <>
                                    {entry.nightJournalData.journalQ1 && (
                                      <div style={{ marginBottom: '8px' }}>
                                        <strong>1. Wins & achievements:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.nightJournalData.journalQ1}</div>
                                      </div>
                                    )}
                                    {entry.nightJournalData.journalQ2 && (
                                      <div style={{ marginBottom: '8px' }}>
                                        <strong>2. Learnings & improvements:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.nightJournalData.journalQ2}</div>
                                      </div>
                                    )}
                                    {entry.nightJournalData.journalQ3 && (
                                      <div>
                                        <strong>3. Tomorrow's primary focus:</strong>
                                        <div style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>{entry.nightJournalData.journalQ3}</div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>No night journal recorded.</p>
                            )}
                            {entry.nightCompleted && entry.nightData?.supplements && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                <strong>💊 Supplements Stack:</strong>{' '}
                                {typeof entry.nightData.supplements === 'object' && entry.nightData.supplements !== null && !Array.isArray(entry.nightData.supplements) ? (
                                  Object.entries(entry.nightData.supplements).filter(([_, v]) => Boolean(v)).map(([k]) => k).join(', ') || 'None'
                                ) : (
                                  `${entry.nightData.supplements}/10`
                                )}
                              </div>
                            )}
                            {entry.nightData?.proteinShake && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <strong>🥤 Protein Shake:</strong>{' '}
                                  <span style={{ color: entry.nightData.proteinShake.taken ? '#4ade80' : '#f87171' }}>
                                    {entry.nightData.proteinShake.taken ? '✓ Taken' : '❌ Not Taken'}
                                  </span>
                                </div>
                                {entry.nightData.proteinShake.photoUrl && (
                                  <a href={entry.nightData.proteinShake.photoUrl} target="_blank" rel="noreferrer" title="Protein Shake Proof">
                                    <img src={entry.nightData.proteinShake.photoUrl} alt="protein shake proof" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                  </a>
                                )}
                              </div>
                            )}
                            {entry.weeklyData?.photos && (entry.weeklyData.photos.front || entry.weeklyData.photos.back || entry.weeklyData.photos.sideLeft || entry.weeklyData.photos.sideRight || entry.weeklyData.photos.side) && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                <strong style={{ display: 'block', marginBottom: '6px' }}>📸 Weekly Progress Photos:</strong>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {['front', 'back', 'sideLeft', 'sideRight', 'side'].map(p => entry.weeklyData.photos[p] ? (
                                    <a key={p} href={entry.weeklyData.photos[p]} target="_blank" rel="noreferrer" title={`${p} pose`}>
                                      <img src={entry.weeklyData.photos[p]} alt={p} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                    </a>
                                  ) : null)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ 
                          marginTop: '16px', 
                          paddingTop: '12px', 
                          borderTop: '1px solid var(--border-color)', 
                          display: 'flex', 
                          gap: '10px', 
                          flexWrap: 'wrap',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>✏️ Log/Modify Day:</span>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.75rem',
                              background: entry.morningCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.05)',
                              color: entry.morningCompleted ? 'var(--text-primary)' : 'var(--accent-red)'
                            }} 
                            onClick={() => startEditingLog(entry.date, 'morning')}
                          >
                            {entry.morningCompleted ? 'Morning Metrics' : '+ Log Morning Metrics'}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.75rem',
                              background: entry.morningJournalCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.05)',
                              color: entry.morningJournalCompleted ? 'var(--text-primary)' : 'var(--accent-red)'
                            }} 
                            onClick={() => startEditingLog(entry.date, 'morningJournal')}
                          >
                            {entry.morningJournalCompleted ? 'Morning Journal' : '+ Log Morning Journal'}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.75rem',
                              background: entry.nightCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.05)',
                              color: entry.nightCompleted ? 'var(--text-primary)' : 'var(--accent-red)'
                            }} 
                            onClick={() => startEditingLog(entry.date, 'night')}
                          >
                            {entry.nightCompleted ? 'Night Metrics' : '+ Log Night Metrics'}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.75rem',
                              background: entry.nightJournalCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.05)',
                              color: entry.nightJournalCompleted ? 'var(--text-primary)' : 'var(--accent-red)'
                            }} 
                            onClick={() => startEditingLog(entry.date, 'nightJournal')}
                          >
                            {entry.nightJournalCompleted ? 'Night Journal' : '+ Log Night Journal'}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.75rem',
                              background: entry.weeklyCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.05)',
                              color: entry.weeklyCompleted ? 'var(--text-primary)' : 'var(--accent-red)'
                            }} 
                            onClick={() => startEditingLog(entry.date, 'weekly')}
                          >
                            {entry.weeklyCompleted ? 'Weekly Specs' : '+ Log Weekly Specs'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
