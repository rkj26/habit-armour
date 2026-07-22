import React from 'react';

export default function Navigation({
  activeTab,
  setActiveTab,
  status,
  ipInfo,
  triggerTestLock,
  config,
  syncAllUnsynced,
  syncingAll
}) {
  return (
    <aside className="sidebar glass-card">
      <nav className="tab-nav-vertical">
        <button className={`tab-btn-vertical ${activeTab === 'morning' ? 'active' : ''}`} onClick={() => setActiveTab('morning')}>
          ☀️ Morning Log
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'morningJournal' ? 'active' : ''}`} onClick={() => setActiveTab('morningJournal')}>
          📝 Morning Journal
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'night' ? 'active' : ''}`} onClick={() => setActiveTab('night')}>
          🌙 Night Log
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'nightJournal' ? 'active' : ''}`} onClick={() => setActiveTab('nightJournal')}>
          📝 Night Journal
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>
          📊 Weekly Specs
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'hevy' ? 'active' : ''}`} onClick={() => setActiveTab('hevy')}>
          💪 Gym Workouts
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'gym' ? 'active' : ''}`} onClick={() => setActiveTab('gym')}>
          🔒 Gym Verification
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          📈 Dashboard
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📜 Log History
        </button>
        <button className={`tab-btn-vertical ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </button>
      </nav>

      <div className="divider" style={{ margin: '0' }}></div>

      <h2 className="sidebar-title">Device Security</h2>
      <div className="sidebar-section">
        <div className="metric-row">
          <span className="metric-label">Status</span>
          <span className={`metric-value ${status.locked ? 'text-red' : 'text-green'}`}>
            {status.locked ? 'LOCKED' : 'UNLOCKED'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Active Window</span>
          <span className="metric-value text-purple">{status.window || 'None'}</span>
        </div>
      </div>

      <div className="sidebar-section ip-card">
        <h3>iOS Integration Link</h3>
        <p className="ip-desc">To lock your iPhone, create a Shortcut automation and point it to this local API:</p>
        <code className="ip-code">http://{ipInfo}:3000/api/status</code>
        <p className="ip-help">Ensure phone is on the same Wi-Fi network.</p>
      </div>

      <div className="sidebar-section">
        <button className="btn btn-secondary w-full" onClick={triggerTestLock}>
          ⚡ Test Screen Lock
        </button>
      </div>

      {config.googleSheetsEnabled && config.googleSheetsUrl && (
        <div className="sidebar-section divider" style={{ paddingTop: '10px' }}>
          <button 
            className="btn btn-primary w-full" 
            onClick={syncAllUnsynced}
            disabled={syncingAll}
          >
            {syncingAll ? 'Syncing...' : '🔄 Sync Unsynced to Sheet'}
          </button>
        </div>
      )}
    </aside>
  );
}
