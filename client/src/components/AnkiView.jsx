import React, { useState, useEffect } from 'react';

export default function AnkiView({ API_URL, status, onRefreshStatus }) {
  const [ankiData, setAnkiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Reviewed on Anki Mobile / AnkiWeb');
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState(null);

  const fetchAnkiStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/anki/status`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch Anki status');
      }
      setAnkiData(data);
    } catch (err) {
      console.error('Fetch Anki status error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/anki/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify Anki');
      }
      setAnkiData(prev => ({
        ...prev,
        reachable: data.reachable,
        verified: data.verified,
        reason: data.reason,
        decks: data.decks,
        totalDue: data.totalDue,
        reviewedToday: data.reviewedToday
      }));
      if (onRefreshStatus) onRefreshStatus();
    } catch (err) {
      console.error('Force verify error:', err);
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    setSubmittingOverride(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/anki/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit override');
      }
      setShowOverrideModal(false);
      setOverrideSuccessMsg('Anki requirement marked complete via manual override.');
      fetchAnkiStatus();
      if (onRefreshStatus) onRefreshStatus();
      setTimeout(() => setOverrideSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Override error:', err);
      setError(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResetOverride = async () => {
    try {
      const res = await fetch(`${API_URL}/api/anki/reset-override`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchAnkiStatus();
        if (onRefreshStatus) onRefreshStatus();
      }
    } catch (err) {
      console.error('Reset override error:', err);
    }
  };

  useEffect(() => {
    fetchAnkiStatus();
  }, []);

  const totalDue = ankiData?.totalDue ?? 0;
  const reviewedToday = ankiData?.reviewedToday ?? 0;
  const isReachable = ankiData?.reachable ?? false;
  const isVerified = ankiData?.verified ?? false;
  const isManualOverride = ankiData?.manualOverride ?? false;
  const decks = ankiData?.decks || [];

  return (
    <div className="anki-view-container">
      {/* Header Banner */}
      <div className="form-header glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              🗂️ Anki Flashcard Requirement
            </h1>
            <p className="form-subtitle">
              Daily deck clearance requirement: all active decks must have 0 due cards before the 9:00 PM cutoff.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleForceVerify}
              disabled={verifying || loading}
            >
              {verifying ? '🔄 Verifying...' : '🔄 Refresh / Verify Deck Queue'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => setShowOverrideModal(true)}
            >
              📱 Studied on Mobile
            </button>
          </div>
        </div>
      </div>

      {overrideSuccessMsg && (
        <div className="success-toast" style={{ marginBottom: '1.5rem' }}>
          ✅ {overrideSuccessMsg}
        </div>
      )}

      {error && (
        <div className="warning-banner" style={{ marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Top Status Cards Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.5rem' }}>
        {/* Verification Status */}
        <div className="stat-card glass-card">
          <div className="stat-label">Daily Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className={`status-pill ${isVerified ? 'status-pill-green' : 'status-pill-amber'}`}>
              {isVerified ? (isManualOverride ? '✨ OVERRIDDEN (COMPLETE)' : '✅ ALL DECKS CLEARED') : '⏳ PENDING REVIEWS'}
            </span>
          </div>
          {isManualOverride && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Reason: {ankiData?.overrideReason || 'Manual override'}
              <button 
                onClick={handleResetOverride}
                style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem' }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Due Cards Remaining */}
        <div className="stat-card glass-card">
          <div className="stat-label">Due Cards Queue</div>
          <div className="stat-value text-purple" style={{ fontSize: '2rem', fontWeight: 700 }}>
            {isReachable ? totalDue : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: totalDue === 0 ? '#4ade80' : '#fb923c', marginTop: '0.25rem' }}>
            {totalDue === 0 ? 'Queue is clear (Inbox Zero)' : `${totalDue} card${totalDue === 1 ? '' : 's'} remaining to review`}
          </div>
        </div>

        {/* Reviewed Today */}
        <div className="stat-card glass-card">
          <div className="stat-label">Reviewed Today</div>
          <div className="stat-value text-green" style={{ fontSize: '2rem', fontWeight: 700 }}>
            {isReachable ? reviewedToday : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Total cards studied today in Anki
          </div>
        </div>

        {/* Anki Desktop Connection */}
        <div className="stat-card glass-card">
          <div className="stat-label">Anki Desktop Link</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className={`status-pill ${isReachable ? 'status-pill-green' : 'status-pill-red'}`}>
              {isReachable ? '🟢 CONNECTED (Port 8765)' : '🔴 OFFLINE / CLOSED'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            {isReachable ? 'Syncing live with AnkiConnect' : 'Launch Anki Desktop to sync live stats'}
          </div>
        </div>
      </div>

      {/* Offline Instructions Alert if unreachable */}
      {!isReachable && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fbbf24', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💡 Anki Desktop is not running
          </h3>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.5 }}>
            Habit Armour connects to your desktop Anki app via <strong>AnkiConnect</strong>. To verify your flashcard reviews automatically:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            <li>Open the <strong>Anki</strong> app on your Mac.</li>
            <li>Ensure the <strong>AnkiConnect</strong> add-on is installed in Anki (Tools &gt; Add-ons &gt; Get Add-ons &gt; Code: <code>2055492159</code>).</li>
            <li>Click <strong>"Refresh / Verify Deck Queue"</strong> above.</li>
            <li>If you studied on your phone or AnkiWeb, click <strong>"Studied on Mobile"</strong> to clear the lock.</li>
          </ol>
        </div>
      )}

      {/* Decks Breakdown Table */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>Active Decks Queue</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Decks requiring 0 due cards for daily lock clearance
            </p>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {decks.length} Active {decks.length === 1 ? 'Deck' : 'Decks'}
          </span>
        </div>

        {decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            {loading ? 'Fetching decks from Anki...' : 'No active decks detected. Launch Anki Desktop or check your deck settings.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Deck Name</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Review Due</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Learning</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>New Cards</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Total Cards</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {decks.map(deck => {
                  const dueCount = deck.due_count ?? deck.due ?? 0;
                  const reviewCount = deck.review_count ?? deck.review ?? 0;
                  const learnCount = deck.learn_count ?? deck.learn ?? 0;
                  const newCount = deck.new_count ?? deck.new ?? 0;
                  const totalCount = deck.total_in_deck ?? deck.total ?? 0;
                  const isCleared = Boolean(deck.cleared) || dueCount === 0;
                  return (
                    <tr 
                      key={deck.deck_id || deck.name} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isCleared ? 'transparent' : 'rgba(239, 68, 68, 0.05)'
                      }}
                    >
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 500, color: '#f1f5f9' }}>
                        {deck.name}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          color: reviewCount > 0 ? '#f87171' : '#94a3b8',
                          fontWeight: reviewCount > 0 ? 700 : 400 
                        }}>
                          {reviewCount}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          color: learnCount > 0 ? '#fb923c' : '#94a3b8',
                          fontWeight: learnCount > 0 ? 700 : 400 
                        }}>
                          {learnCount}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', color: '#60a5fa' }}>
                        {newCount}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        {totalCount}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                        <span className={`status-pill ${isCleared ? 'status-pill-green' : 'status-pill-red'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                          {isCleared ? '✓ Cleared' : `⏳ ${dueCount} Due`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '1.75rem', border: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>📱 Manual Anki Review Override</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
              If you finished your daily reviews on AnkiMobile (iOS/Android) or AnkiWeb without syncing to desktop Anki, submit this override to clear your daily habit lock.
            </p>

            <form onSubmit={handleSubmitOverride}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Confirmation Note / Reason</label>
                <input 
                  type="text"
                  className="form-input"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Completed all deck reviews on AnkiMobile iOS app"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowOverrideModal(false)}
                  disabled={submittingOverride}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submittingOverride}
                >
                  {submittingOverride ? 'Saving...' : '✓ Confirm & Clear Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
