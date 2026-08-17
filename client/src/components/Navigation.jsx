import React from 'react';

export default function Navigation({
  activeTab,
  setActiveTab,
  status,
  ipInfo,
  triggerTestLock
}) {
  const navSections = [
    {
      title: "Daily Habits",
      items: [
        { id: 'morning', label: 'Morning Bio-Log', icon: '☀️' },
        { id: 'morningJournal', label: 'Morning Journal', icon: '📝' },
        { id: 'night', label: 'Night Log', icon: '🌙' },
        { id: 'nightJournal', label: 'Night Journal', icon: '📓' },
        { id: 'weekly', label: 'Weekly Check-in', icon: '📊' },
      ]
    },
    {
      title: "Activity & Mastery",
      items: [
        { id: 'hevy', label: 'Gym & Workouts', icon: '💪' },
        { id: 'anki', label: 'Anki Flashcards', icon: '🗂️' },
        { id: 'practice', label: 'Consistent Practice', icon: '🔬' },
      ]
    },
    {
      title: "System",
      items: [
        { id: 'dashboard', label: 'Analytics Dashboard', icon: '📈' },
        { id: 'history', label: 'Log History', icon: '📜' },
        { id: 'settings', label: 'Settings & Schedules', icon: '⚙️' },
      ]
    }
  ];

  return (
    <aside className="sidebar glass-card">
      <div className="sidebar-nav-container">
        {navSections.map((section, idx) => (
          <div key={section.title} className="sidebar-group">
            <span className="sidebar-group-title">{section.title}</span>
            <nav className="tab-nav-vertical">
              {section.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`tab-btn-vertical ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <span className="tab-icon">{item.icon}</span>
                    <span className="tab-label">{item.label}</span>
                    {isActive && <span className="active-indicator" />}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-security-badge">
          <div className="security-header">
            <span className="security-title">OS Armour</span>
            <span className={`security-pill ${status.locked ? 'pill-locked' : 'pill-unlocked'}`}>
              <span className="pill-dot" />
              {status.locked ? 'LOCKED' : 'PROTECTED'}
            </span>
          </div>
          {status.window && (
            <div className="security-subtext">
              Active window: <strong>{status.window}</strong>
            </div>
          )}
        </div>

        <button className="btn btn-secondary w-full test-lock-btn" onClick={triggerTestLock}>
          ⚡ Test Screen Lock
        </button>

        {ipInfo && (
          <div className="ios-sync-mini">
            <span className="ios-label">iOS Remote Lock:</span>
            <code className="ios-code">http://{ipInfo}:3000/api/status</code>
          </div>
        )}
      </div>
    </aside>
  );
}
