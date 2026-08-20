import React from 'react';

export default function SettingsView({
  config,
  handleConfigChange,
  saveConfig
}) {
  const [newSuppInput, setNewSuppInput] = React.useState('');
  const [newDeckInput, setNewDeckInput] = React.useState('');
  const [newWebsiteInput, setNewWebsiteInput] = React.useState('');
  const suppList = config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
  const ignoredDecksList = Array.isArray(config.ankiIgnoredDecks) ? config.ankiIgnoredDecks : [];
  const allowedWebsitesList = Array.isArray(config.allowedWebsites) 
    ? config.allowedWebsites 
    : ['myfitnesspal.com', 'gemini.google.com', 'claude.ai', 'chatgpt.com', 'arxiv.org'];

  const addWebsite = (siteOrEvent) => {
    let site = typeof siteOrEvent === 'string' ? siteOrEvent : newWebsiteInput;
    if (siteOrEvent && siteOrEvent.preventDefault) siteOrEvent.preventDefault();
    const trimmed = (site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!trimmed) return;
    if (allowedWebsitesList.includes(trimmed)) return;
    const updated = [...allowedWebsitesList, trimmed];
    handleConfigChange({ target: { name: 'allowedWebsites', value: updated } });
    setNewWebsiteInput('');
  };

  const removeWebsite = (siteToRemove) => {
    const updated = allowedWebsitesList.filter(s => s !== siteToRemove);
    handleConfigChange({ target: { name: 'allowedWebsites', value: updated } });
  };

  const addSupplement = (e) => {
    e.preventDefault();
    const trimmed = newSuppInput.trim();
    if (!trimmed) return;
    if (suppList.includes(trimmed)) return;
    const updated = [...suppList, trimmed];
    handleConfigChange({ target: { name: 'supplementsList', value: updated } });
    setNewSuppInput('');
  };

  const removeSupplement = (suppToRemove) => {
    const updated = suppList.filter(s => s !== suppToRemove);
    handleConfigChange({ target: { name: 'supplementsList', value: updated } });
  };

  const addIgnoredDeck = (e) => {
    e.preventDefault();
    const trimmed = newDeckInput.trim();
    if (!trimmed) return;
    if (ignoredDecksList.includes(trimmed)) return;
    const updated = [...ignoredDecksList, trimmed];
    handleConfigChange({ target: { name: 'ankiIgnoredDecks', value: updated } });
    setNewDeckInput('');
  };

  const removeIgnoredDeck = (deckToRemove) => {
    const updated = ignoredDecksList.filter(d => d !== deckToRemove);
    handleConfigChange({ target: { name: 'ankiIgnoredDecks', value: updated } });
  };

  return (
    <div className="settings-container">
      <div className="section-title">
        <h2>Habit Armor Settings</h2>
        <p>Configure device security, lock schedules, and third-party integrations.</p>
      </div>

      {/* Device Lock Window Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">🔒 Hardware Lock Configuration</h3>
        <p className="settings-section-desc">Define the locking hours and warning windows. During warning hours, a grace period timer will trigger before locking your macOS session.</p>
        
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Morning Window (Hours)</label>
            <div className="form-row">
              <div>
                <span className="sub-label">Start Hour (0-23)</span>
                <input type="number" className="form-input" name="morningStart" value={config.morningStart} onChange={handleConfigChange} min="0" max="23" />
              </div>
              <div>
                <span className="sub-label">End Hour (0-23)</span>
                <input type="number" className="form-input" name="morningEnd" value={config.morningEnd} onChange={handleConfigChange} min="0" max="23" />
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Night Window (Hours)</label>
            <div className="form-row">
              <div>
                <span className="sub-label">Start Hour (0-23)</span>
                <input type="number" className="form-input" name="nightStart" value={config.nightStart} onChange={handleConfigChange} min="0" max="23" />
              </div>
              <div>
                <span className="sub-label">End Hour (0-23)</span>
                <input type="number" className="form-input" name="nightEnd" value={config.nightEnd} onChange={handleConfigChange} min="0" max="23" />
              </div>
            </div>
          </div>
        </div>

        <div className="form-group" style={{maxWidth: '240px', marginTop: '14px'}}>
          <label className="form-label">Grace Period (Seconds)</label>
          <input type="number" className="form-input" name="gracePeriodSec" value={config.gracePeriodSec} onChange={handleConfigChange} min="10" max="600" />
          <span className="sub-label">Warning countdown duration before device locks.</span>
        </div>
      </div>

      {/* Allowed Websites Whitelist Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">🌐 Allowed Website Whitelist (During Lock)</h3>
        <p className="settings-section-desc">
          Specify websites you are permitted to visit even when Habit Armour lock is active (e.g. logging calories on MyFitnessPal, consulting AI assistants like Gemini & Claude, or reading research papers on Arxiv).
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {allowedWebsitesList.map((site) => (
            <span
              key={site}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#a5b4fc'
              }}
            >
              🌐 {site}
              <button
                type="button"
                onClick={() => removeWebsite(site)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  padding: '0 2px',
                  lineHeight: 1
                }}
                title={`Remove ${site}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <form onSubmit={addWebsite} style={{ display: 'flex', gap: '10px', maxWidth: '480px', marginBottom: '14px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Add website (e.g. myfitnesspal.com, claude.ai)"
            value={newWebsiteInput}
            onChange={(e) => setNewWebsiteInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            + Add Domain
          </button>
        </form>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Quick Presets:</span>
          {['myfitnesspal.com', 'gemini.google.com', 'claude.ai', 'chatgpt.com', 'arxiv.org', 'wandb.ai'].map((preset) => (
            <button
              key={preset}
              type="button"
              className="btn btn-link"
              style={{ fontSize: '0.78rem', padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: '6px' }}
              onClick={() => addWebsite(preset)}
              disabled={allowedWebsitesList.includes(preset)}
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly Spec Lock Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">📅 Weekly Spec Lock Schedule</h3>
        <p className="settings-section-desc">Configure weekly review and photo verification deadlines.</p>
        
        <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
          <input 
            type="checkbox" 
            id="weeklyLockEnabled" 
            name="weeklyLockEnabled" 
            checked={config.weeklyLockEnabled !== false} 
            onChange={handleConfigChange}
            style={{width: '18px', height: '18px', cursor: 'pointer'}}
          />
          <label htmlFor="weeklyLockEnabled" style={{fontWeight: 600, cursor: 'pointer', userSelect: 'none'}}>
            Enable Weekly Spec Lock Enforcement
          </label>
        </div>

        <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
          <input 
            type="checkbox" 
            id="weeklyPhotosRequired" 
            name="weeklyPhotosRequired" 
            checked={config.weeklyPhotosRequired !== false} 
            onChange={handleConfigChange}
            style={{width: '18px', height: '18px', cursor: 'pointer'}}
          />
          <label htmlFor="weeklyPhotosRequired" style={{fontWeight: 600, cursor: 'pointer', userSelect: 'none'}}>
            🔒 Require Weekly Progress Photos (Front, Back, Side) to clear Weekly Spec Lock
          </label>
        </div>

        {config.weeklyLockEnabled !== false && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Lock Day of Week</label>
              <select
                className="form-input"
                name="weeklyLockDay"
                value={config.weeklyLockDay !== undefined ? config.weeklyLockDay : 0}
                onChange={handleConfigChange}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
              <span className="sub-label">Day on which weekly body specs lock if incomplete.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Weekly Window (Hours)</label>
              <div className="form-row">
                <div>
                  <span className="sub-label">Start Hour (0-23)</span>
                  <input type="number" className="form-input" name="weeklyLockStartHour" value={config.weeklyLockStartHour !== undefined ? config.weeklyLockStartHour : 0} onChange={handleConfigChange} min="0" max="23" />
                </div>
                <div>
                  <span className="sub-label">End Hour (0-24)</span>
                  <input type="number" className="form-input" name="weeklyLockEndHour" value={config.weeklyLockEndHour !== undefined ? config.weeklyLockEndHour : 24} onChange={handleConfigChange} min="0" max="24" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Journal Sync Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">✍️ Daily Journal Sync Settings</h3>
        <p className="settings-section-desc">Sync your morning/night journal entries automatically to a local Obsidian vault, a Google Doc, or both.</p>
        
        <div className="form-group" style={{maxWidth: '400px'}}>
          <label className="form-label">Journal Storage Target</label>
          <select 
            className="form-input" 
            name="journalStorage" 
            value={config.journalStorage || 'none'} 
            onChange={handleConfigChange}
          >
            <option value="none">Disabled (No Sync)</option>
            <option value="obsidian">Local Obsidian Vault</option>
            <option value="gdoc">Google Doc</option>
            <option value="both">Both (Obsidian & Google Doc)</option>
          </select>
        </div>

        {(config.journalStorage === 'obsidian' || config.journalStorage === 'both') && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Obsidian Vault Path</label>
              <input 
                type="text" 
                className="form-input" 
                name="obsidianVaultPath" 
                value={config.obsidianVaultPath || ''} 
                onChange={handleConfigChange} 
                placeholder="e.g. /Users/username/Documents/Obsidian"
                required
              />
              <span className="sub-label">Absolute local system path to your Obsidian vault root folder.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Obsidian Journal Subfolder</label>
              <input 
                type="text" 
                className="form-input" 
                name="obsidianJournalFolder" 
                value={config.obsidianJournalFolder || ''} 
                onChange={handleConfigChange} 
                placeholder="e.g. Journal"
              />
              <span className="sub-label">Optional subfolder inside vault (e.g., 'Journal' or leave empty for root).</span>
            </div>
          </div>
        )}

      </div>



      {/* Gym Lock Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">💪 Gym Lock Configuration</h3>
        <p className="settings-section-desc">Configure the lock schedule and requirements for daily gym workout logs via Hevy API.</p>
        
        <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px'}}>
          <input 
            type="checkbox" 
            id="gymLockEnabled" 
            name="gymLockEnabled" 
            checked={config.gymLockEnabled} 
            onChange={handleConfigChange}
            style={{width: '18px', height: '18px', cursor: 'pointer'}}
          />
          <label htmlFor="gymLockEnabled" style={{fontWeight: 600, cursor: 'pointer', userSelect: 'none'}}>
            Enable Gym Lock Enforcement
          </label>
        </div>

        {config.gymLockEnabled && (
          <>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Lock Start Hour (0-23)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  name="gymLockStartHour" 
                  value={config.gymLockStartHour} 
                  onChange={handleConfigChange} 
                  min="0" 
                  max="23"
                />
                <span className="sub-label">The hour (e.g. 21 for 9:00 PM) at which the lock activates if activity target is not met.</span>
              </div>
              
              <div className="form-group">
                <label className="form-label">Minimum Workout Duration (Minutes)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  name="gymMinDurationMinutes" 
                  value={config.gymMinDurationMinutes} 
                  onChange={handleConfigChange} 
                  min="1"
                />
                <span className="sub-label">Workouts shorter than this duration will fail verification.</span>
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Weekly Active Days Goal</label>
                <input 
                  type="number" 
                  className="form-input" 
                  name="gymWeeklyGoal" 
                  value={config.gymWeeklyGoal !== undefined ? config.gymWeeklyGoal : 5} 
                  onChange={handleConfigChange} 
                  min="1"
                  max="7"
                />
                <span className="sub-label">Target active days per week (default: 5). Once reached, remaining days of the week are unlocked.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Min Steps for Active Day</label>
                <input 
                  type="number" 
                  className="form-input" 
                  name="gymMinSteps" 
                  value={config.gymMinSteps !== undefined ? config.gymMinSteps : 13000} 
                  onChange={handleConfigChange} 
                  min="1000"
                  step="500"
                />
                <span className="sub-label">Daily steps threshold to satisfy active day criteria if no gym/cardio logged (default: 13,000).</span>
              </div>
            </div>

            <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
              <input 
                type="checkbox" 
                id="gymRequireNoConsecutiveRestDays" 
                name="gymRequireNoConsecutiveRestDays" 
                checked={config.gymRequireNoConsecutiveRestDays !== false} 
                onChange={handleConfigChange}
                style={{width: '18px', height: '18px', cursor: 'pointer'}}
              />
              <label htmlFor="gymRequireNoConsecutiveRestDays" style={{fontWeight: 600, cursor: 'pointer', userSelect: 'none'}}>
                🚫 Prevent 2 Consecutive Rest Days (Hard Forcing Function)
              </label>
            </div>
          </>
        )}
      </div>

      {/* Anki Flashcard Requirement Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">🗂️ Anki Flashcard Requirement</h3>
        <p className="settings-section-desc">Automated daily Anki deck completion check via AnkiConnect. Mac enforces a lock if any active deck has pending reviews at the cutoff hour.</p>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <input
            type="checkbox"
            id="ankiLockEnabled"
            name="ankiLockEnabled"
            checked={config.ankiLockEnabled !== false}
            onChange={handleConfigChange}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="ankiLockEnabled" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            Enable Anki Daily Deck Clearance Lock Enforcement
          </label>
        </div>

        {config.ankiLockEnabled !== false && (
          <>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Lock Cutoff Hour (0-23)</label>
                <input
                  type="number"
                  className="form-input"
                  name="ankiLockStartHour"
                  value={config.ankiLockStartHour !== undefined ? config.ankiLockStartHour : 21}
                  onChange={handleConfigChange}
                  min="0"
                  max="23"
                />
                <span className="sub-label">Hour (e.g. 21 for 9:00 PM) when pending Anki decks lock your Mac.</span>
              </div>

              <div className="form-group">
                <label className="form-label">AnkiConnect Endpoint URL</label>
                <input
                  type="text"
                  className="form-input"
                  name="ankiConnectUrl"
                  value={config.ankiConnectUrl || 'http://localhost:8765'}
                  onChange={handleConfigChange}
                  placeholder="http://localhost:8765"
                />
                <span className="sub-label">Local JSON-RPC endpoint for Anki desktop app (default: http://localhost:8765).</span>
              </div>
            </div>

            <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.95rem' }}>
              Excluded / Ignored Decks ({ignoredDecksList.length})
            </h4>
            <p className="settings-section-desc" style={{ marginBottom: '12px' }}>
              Decks in this list will be excluded from the zero-due-card requirement (e.g. archived or suspended decks).
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {ignoredDecksList.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No decks ignored (all decks in Anki are required).
                </span>
              ) : (
                ignoredDecksList.map((deck) => (
                  <span
                    key={deck}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                  >
                    🚫 {deck}
                    <button
                      type="button"
                      onClick={() => removeIgnoredDeck(deck)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '0 2px',
                        lineHeight: 1
                      }}
                      title={`Remove ${deck}`}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            <form onSubmit={addIgnoredDeck} style={{ display: 'flex', gap: '10px', maxWidth: '420px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Deck name to ignore (e.g. Archive)"
                value={newDeckInput}
                onChange={(e) => setNewDeckInput(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                + Ignore Deck
              </button>
            </form>
          </>
        )}
      </div>

      {/* Consistent Practice Lock Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">🧠 Consistent Practice & Active Recall Lock</h3>
        <p className="settings-section-desc">
          Enforce daily deliberate practice on machine learning derivations, alignment proofs, and key papers.
        </p>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <input
            type="checkbox"
            id="practiceLockEnabled"
            name="practiceLockEnabled"
            checked={config.practiceLockEnabled !== false}
            onChange={handleConfigChange}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="practiceLockEnabled" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            Enable Consistent Practice Lock Enforcement
          </label>
        </div>

        {config.practiceLockEnabled !== false && (
          <div className="form-grid" style={{ marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Lock Cutoff Hour (0-23)</label>
              <input
                type="number"
                className="form-input"
                name="practiceLockStartHour"
                value={config.practiceLockStartHour !== undefined ? config.practiceLockStartHour : 21}
                onChange={handleConfigChange}
                min="0"
                max="23"
              />
              <span className="sub-label">Hour (e.g. 21 for 9:00 PM) when pending practice due items lock your device.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Min Daily Proofs to Unlock</label>
              <input
                type="number"
                className="form-input"
                name="practiceMinDueToUnlock"
                value={config.practiceMinDueToUnlock !== undefined ? config.practiceMinDueToUnlock : 1}
                onChange={handleConfigChange}
                min="0"
                max="10"
              />
              <span className="sub-label">Daily practice target (0 = clear all due queue; 1 = at least 1 session required).</span>
            </div>

            <div className="form-group">
              <label className="form-label">New Topic Areas Per Day</label>
              <input
                type="number"
                className="form-input"
                name="practiceNewCardsPerDay"
                value={config.practiceNewCardsPerDay !== undefined ? config.practiceNewCardsPerDay : 1}
                onChange={handleConfigChange}
                min="0"
                max="10"
              />
              <span className="sub-label">How many brand-new topic ladders get introduced per day, each shown as one grouped box.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Review Topic Areas Per Day</label>
              <input
                type="number"
                className="form-input"
                name="practiceReviewTopicsPerDay"
                value={config.practiceReviewTopicsPerDay !== undefined ? config.practiceReviewTopicsPerDay : 1}
                onChange={handleConfigChange}
                min="0"
                max="10"
              />
              <span className="sub-label">How many already-started topics (most overdue for recall first) get surfaced per day. Default is 1 new + 1 review = 2 topic boxes/day. Set higher if you want more than one review topic shown at once.</span>
            </div>
          </div>
        )}
      </div>

      {/* Supplement Stack Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">💊 Daily Supplement Stack & Blocker</h3>
        <p className="settings-section-desc">Manage individual items in your daily supplement stack. When blocker enforcement is active, 100% of these supplements must be checked to submit your Night Log and clear evening hardware lock.</p>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <input
            type="checkbox"
            id="enforceSupplementsBlocker"
            name="enforceSupplementsBlocker"
            checked={config.enforceSupplementsBlocker !== false}
            onChange={handleConfigChange}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="enforceSupplementsBlocker" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            🔒 Enforce Supplement Checklist as Night Lock Blocker (Require 100% completion to submit Night Log)
          </label>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <input
            type="checkbox"
            id="enforceProteinShakeBlocker"
            name="enforceProteinShakeBlocker"
            checked={config.enforceProteinShakeBlocker !== false}
            onChange={handleConfigChange}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="enforceProteinShakeBlocker" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            🥤 🔒 Enforce Daily Protein Shake & Proof Photo as Night Lock Blocker
          </label>
        </div>

        <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '0.95rem' }}>Configured Supplements ({suppList.length})</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {suppList.map((supp) => (
            <span
              key={supp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              💊 {supp}
              <button
                type="button"
                onClick={() => removeSupplement(supp)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  padding: '0 2px',
                  lineHeight: 1
                }}
                title={`Remove ${supp}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <form onSubmit={addSupplement} style={{ display: 'flex', gap: '10px', maxWidth: '420px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Add new supplement (e.g. Magnesium)"
            value={newSuppInput}
            onChange={(e) => setNewSuppInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </form>
      </div>

      {/* Target Metric Configuration */}
      <div className="settings-section">
        <h3 className="settings-section-title">📊 Dashboard Targets & Goals</h3>
        <p className="settings-section-desc">Set personal targets. These targets will be drawn as visual reference indicators and goal lines in the Bio-Analytics Dashboard charts.</p>
        
        <div className="form-grid-4">
          <div className="form-group">
            <label className="form-label">Target Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              className="form-input" 
              name="targetWeight" 
              value={config.targetWeight !== undefined ? config.targetWeight : 75.0} 
              onChange={handleConfigChange} 
              placeholder="e.g. 75.0"
            />
            <span className="sub-label">Used for weight tracking metrics.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Target Protein (g)</label>
            <input 
              type="number" 
              className="form-input" 
              name="targetProtein" 
              value={config.targetProtein !== undefined ? config.targetProtein : 150} 
              onChange={handleConfigChange} 
              placeholder="e.g. 150"
            />
            <span className="sub-label">Daily macro target.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Target Daily Steps</label>
            <input 
              type="number" 
              className="form-input" 
              name="targetSteps" 
              value={config.targetSteps !== undefined ? config.targetSteps : 10000} 
              onChange={handleConfigChange} 
              placeholder="e.g. 10000"
            />
            <span className="sub-label">Daily step threshold.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Target Daily Calories (kcal)</label>
            <input 
              type="number" 
              className="form-input" 
              name="targetCalories" 
              value={config.targetCalories !== undefined ? config.targetCalories : 2500} 
              onChange={handleConfigChange} 
              placeholder="e.g. 2500"
            />
            <span className="sub-label">Daily calorie limit / allowance.</span>
          </div>
        </div>
      </div>

      <div className="form-actions" style={{marginTop: '12px'}}>
        <button type="button" className="btn btn-primary btn-lg" onClick={saveConfig}>Save Configuration</button>
      </div>
    </div>
  );
}
