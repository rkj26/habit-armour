import React from 'react';

export default function Header({ status }) {
  return (
    <header className="main-header">
      <div className="logo-section">
        <div className="logo-icon">
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ width: '18px', height: '18px' }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h1>Habit Armor</h1>
        </div>
      </div>
      <div className="status-badge-container">
        <span className={`status-pill ${status.completed ? 'status-green' : 'status-red'}`}>
          <span className="dot"></span>
          {status.completed ? 'Unlocked' : (status.reason || 'Locked')}
        </span>
      </div>
    </header>
  );
}
