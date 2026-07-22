import React from 'react';

export default function SettingsView({
  config,
  handleConfigChange,
  testingSync,
  testSheetSync,
  syncStatusMsg,
  saveConfig
}) {
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

        {(config.journalStorage === 'gdoc' || config.journalStorage === 'both') && (
          <div className="form-group">
            <label className="form-label">Google Doc URL or ID</label>
            <input 
              type="text" 
              className="form-input" 
              name="googleDocId" 
              value={config.googleDocId || ''} 
              onChange={handleConfigChange} 
              placeholder="e.g. https://docs.google.com/document/d/.../edit"
              required
            />
            <span className="sub-label">We'll append journal entries to this document via Google Apps Script.</span>
          </div>
        )}
      </div>

      {/* Google Sheet Sync Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">📊 Google Sheets Sync ("Auto-Adder")</h3>
        <p className="settings-section-desc">Connect your logs dynamically to a Google Sheet using Google Apps Script. View the instruction guide in <a href="/GOOGLE_SHEET_SETUP.md" target="_blank" rel="noopener noreferrer">GOOGLE_SHEET_SETUP.md</a> inside the project folder.</p>
        
        <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px'}}>
          <input 
            type="checkbox" 
            id="googleSheetsEnabled" 
            name="googleSheetsEnabled" 
            checked={config.googleSheetsEnabled} 
            onChange={handleConfigChange}
            style={{width: '18px', height: '18px', cursor: 'pointer'}}
          />
          <label htmlFor="googleSheetsEnabled" style={{fontWeight: 600, cursor: 'pointer', userSelect: 'none'}}>
            Enable Automatic Google Sheet Sync on Submission
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Google Sheets Apps Script Web App URL</label>
          <input 
            type="text" 
            className="form-input" 
            name="googleSheetsUrl" 
            value={config.googleSheetsUrl} 
            onChange={handleConfigChange} 
            placeholder="https://script.google.com/macros/s/.../exec"
            disabled={!config.googleSheetsEnabled}
          />
        </div>

        {config.googleSheetsEnabled && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px'}}>
            <div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={testSheetSync}
                disabled={testingSync}
              >
                {testingSync ? "Testing connection..." : "⚡ Test Sheet Sync"}
              </button>
            </div>
            
            {syncStatusMsg && (
              <div className={`badge ${syncStatusMsg.success ? 'bg-green' : 'bg-red'}`} style={{padding: '10px 14px', width: 'fit-content'}}>
                {syncStatusMsg.text}
              </div>
            )}
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
          <div className="form-grid">
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
              <span className="sub-label">The hour (e.g. 21 for 9:00 PM) at which the device will lock if the workout is not completed.</span>
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
        )}
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
