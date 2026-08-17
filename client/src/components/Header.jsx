import React, { useState, useEffect } from 'react';

export default function Header({ status }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocked = status.locked;
  const lockCount = status.lockCount || (isLocked ? 1 : 0);

  return (
    <header className="main-header glass-card">
      <div className="header-brand">
        <div className="brand-logo-icon">
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ width: '20px', height: '20px' }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-title">Habit Armour <span className="version-tag">2.0</span></div>
          <div className="brand-subtitle">OS-Enforced Habit Accountability & Learning Studio</div>
        </div>
      </div>

      <div className="header-meta">
        <div className="header-clock font-mono">
          {timeStr}
        </div>

        <div className="status-badge-container">
          {isLocked ? (
            <span className="status-pill status-red">
              <span className="dot pulse" />
              {lockCount > 1 ? `${lockCount} Breaches Active` : 'Lock Engaged'}
            </span>
          ) : (
            <span className="status-pill status-green">
              <span className="dot" />
              Device Protected
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
