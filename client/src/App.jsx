import React, { useState, useEffect } from 'react';
import './App.css';

// API Base URL - we use relative paths for production builds, but during development we connect to port 3000
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

export default function App() {
  const [activeTab, setActiveTab] = useState('morning');
  const [status, setStatus] = useState({ locked: false, isWarning: false, secondsRemaining: 0, window: null, completed: true, reason: "" });
  const [config, setConfig] = useState({ 
    morningStart: 5, 
    morningEnd: 12, 
    nightStart: 20, 
    nightEnd: 24, 
    gracePeriodSec: 120, 
    googleSheetsUrl: "", 
    googleSheetsEnabled: false,
    journalStorage: "none",
    obsidianVaultPath: "",
    obsidianJournalFolder: "Journal",
    googleDocId: ""
  });
  const [ipInfo, setIpInfo] = useState('localhost');
  const [history, setHistory] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [testingSync, setTestingSync] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null); // Tooltip state: { chartId, x, y, date, lines: [{ label, val, color }] }

  // Form states
  const [morningData, setMorningData] = useState({
    wakingWeight: '',
    sleepHours: '',
    sleepQualitySelf: 5,
    sleepQualityDevice: 70,
    energyLevels: 5,
    mood: 5,
    stress: 5,
    illnessSigns: 1,
    muscleSoreness: 1,
    restingHR: '',
    bloodPressure: '',
    journalQ1: '',
    journalQ2: '',
    journalQ3: ''
  });

  const [nightData, setNightData] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    foodQuality: 5,
    waterConsumed: '',
    alcoholConsumed: 'No',
    hunger: 5,
    digestiveStress: 1,
    supplements: 5,
    trainingDay: 'No',
    strengthPerformance: 5,
    steps: '',
    cardioPerformed: 'No',
    journalQ1: '',
    journalQ2: '',
    journalQ3: ''
  });

  const [weeklyData, setWeeklyData] = useState({
    weekCommencing: new Date().toISOString().split('T')[0],
    startWeight: '',
    responseAction: '',
    umbilical: '',
    bicepL: '',
    bicepR: '',
    quadL: '',
    quadR: '',
    glutes: '',
    chest: ''
  });

  // Hevy Gym & AI States
  const [hevyStatus, setHevyStatus] = useState({ hevyApiKeyConfigured: false, geminiApiKeyConfigured: false });
  const [hevyWorkouts, setHevyWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutsError, setWorkoutsError] = useState(null);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  
  // Expanded history table row details
  const [expandedEntries, setExpandedEntries] = useState({});
  const toggleEntryExpand = (date) => {
    setExpandedEntries(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // Fetch initial info
  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchIP();
    fetchHistory();
    fetchHevyStatus();

    // Poll status every 5 seconds to show warnings/lock updates
    const statusInterval = setInterval(fetchStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      const data = await res.json();
      setStatus(data);
      if (data.window && (data.locked || data.isWarning)) {
        setActiveTab(data.window);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  const fetchHevyStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/hevy/status`);
      const data = await res.json();
      setHevyStatus(data);
      if (data.hevyApiKeyConfigured) {
        fetchHevyWorkouts();
      }
    } catch (err) {
      console.error("Failed to fetch Hevy status:", err);
    }
  };

  const fetchHevyWorkouts = async () => {
    setWorkoutsLoading(true);
    setWorkoutsError(null);
    try {
      const res = await fetch(`${API_URL}/api/hevy/workouts`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const workoutsList = Array.isArray(data) ? data : (data.workouts || []);
      setHevyWorkouts(workoutsList);
    } catch (err) {
      setWorkoutsError(err.message);
    } finally {
      setWorkoutsLoading(false);
    }
  };

  const generateAIWorkoutAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`${API_URL}/api/hevy/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workouts: hevyWorkouts })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAnalysisText(data.analysis);
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error("Failed to fetch config:", err);
    }
  };

  const fetchIP = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ip`);
      const data = await res.json();
      setIpInfo(data.ip);
    } catch (err) {
      console.error("Failed to fetch IP:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value)
    }));
  };

  const saveConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSubmitSuccess("Configuration updated!");
        setTimeout(() => setSubmitSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const triggerTestLock = async () => {
    try {
      const res = await fetch(`${API_URL}/api/test-lock`, { method: 'POST' });
      const data = await res.json();
      alert("Test lock active for 15 seconds! If your macOS lock daemon is running, your screen will lock in a few seconds.");
      fetchStatus();
    } catch (err) {
      alert("Error triggering test lock: " + err.message);
    }
  };

  // Trigger Google Sheet test sync
  const testSheetSync = async () => {
    if (!config.googleSheetsUrl) {
      alert("Please provide a Google Sheets Apps Script Web App URL first.");
      return;
    }
    setTestingSync(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/test-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSheetsUrl: config.googleSheetsUrl })
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg({ success: true, text: "Connection successful! Apps Script is fully responsive." });
      } else {
        setSyncStatusMsg({ success: false, text: `Connection failed: ${data.error || 'Unknown response structure'}` });
      }
    } catch (err) {
      setSyncStatusMsg({ success: false, text: `Request failed: ${err.message}` });
    } finally {
      setTestingSync(false);
    }
  };

  // Sync a single log entry type
  const syncLogEntry = async (date, windowType) => {
    try {
      const res = await fetch(`${API_URL}/api/sync-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, window: windowType })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitSuccess(`${windowType.toUpperCase()} log synced successfully!`);
        fetchHistory();
        setTimeout(() => setSubmitSuccess(null), 3000);
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Sync request failed: ${err.message}`);
    }
  };

  // Sync all unsynced completed logs
  const syncAllUnsynced = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/sync-all`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSubmitSuccess(`Sync complete! Synced ${data.syncedCount} log(s). Errors: ${data.failedCount}`);
        fetchHistory();
        setTimeout(() => setSubmitSuccess(null), 3000);
      } else {
        alert(`Batch sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Sync request failed: ${err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleFormSubmit = async (e, windowType) => {
    e.preventDefault();
    let dataToSubmit = {};
    if (windowType === 'morning') dataToSubmit = morningData;
    else if (windowType === 'morningJournal') dataToSubmit = morningData;
    else if (windowType === 'night') dataToSubmit = nightData;
    else if (windowType === 'nightJournal') dataToSubmit = nightData;
    else if (windowType === 'weekly') dataToSubmit = weeklyData;

    // Validate 50-word minimum count for each question
    if (windowType === 'morningJournal' || windowType === 'nightJournal') {
      const q1Words = (dataToSubmit.journalQ1 || '').trim().split(/\s+/).filter(Boolean).length;
      const q2Words = (dataToSubmit.journalQ2 || '').trim().split(/\s+/).filter(Boolean).length;
      const q3Words = (dataToSubmit.journalQ3 || '').trim().split(/\s+/).filter(Boolean).length;
      
      if (q1Words < 50) {
        alert(`Question 1 only has ${q1Words} words. A minimum of 50 words is required to submit.`);
        return;
      }
      if (q2Words < 50) {
        alert(`Question 2 only has ${q2Words} words. A minimum of 50 words is required to submit.`);
        return;
      }
      if (q3Words < 50) {
        alert(`Question 3 only has ${q3Words} words. A minimum of 50 words is required to submit.`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window: windowType, data: dataToSubmit })
      });
      if (res.ok) {
        setSubmitSuccess(`${windowType.toUpperCase()} log submitted successfully!`);
        if (windowType === 'morningJournal') {
          setMorningData(prev => ({ ...prev, journalQ1: '', journalQ2: '', journalQ3: '' }));
        } else if (windowType === 'nightJournal') {
          setNightData(prev => ({ ...prev, journalQ1: '', journalQ2: '', journalQ3: '' }));
        }
        fetchStatus();
        fetchHistory();
        setTimeout(() => setSubmitSuccess(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Submission failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submit error: " + err.message);
    }
  };

  // Helper to compute stats from log history
  const getStats = () => {
    const morningLogs = history.filter(h => h.morningData);
    const nightLogs = history.filter(h => h.nightData);

    const totalDays = history.length;
    let morningCompliance = 0;
    let morningJournalCompliance = 0;
    let nightCompliance = 0;
    let nightJournalCompliance = 0;

    history.forEach(h => {
      if (h.morningCompleted) {
        morningCompliance++;
        // If morningJournalCompleted is undefined (old record), count it as completed
        if (h.morningJournalCompleted !== false) {
          morningJournalCompliance++;
        }
      } else {
        if (h.morningJournalCompleted) {
          morningJournalCompliance++;
        }
      }

      if (h.nightCompleted) {
        nightCompliance++;
        // If nightJournalCompleted is undefined (old record), count it as completed
        if (h.nightJournalCompleted !== false) {
          nightJournalCompliance++;
        }
      } else {
        if (h.nightJournalCompleted) {
          nightJournalCompliance++;
        }
      }
    });

    const complianceRate = totalDays > 0 ? Math.round(((morningCompliance + morningJournalCompliance + nightCompliance + nightJournalCompliance) / (totalDays * 4)) * 100) : 100;

    const last7Morning = morningLogs.slice(0, 7);
    const last7Night = nightLogs.slice(0, 7);

    const avgSleep = last7Morning.length > 0 ? (last7Morning.reduce((sum, h) => sum + parseFloat(h.morningData.sleepHours || 0), 0) / last7Morning.length).toFixed(1) : '-';
    const avgSteps = last7Night.length > 0 ? Math.round(last7Night.reduce((sum, h) => sum + parseInt(h.nightData.steps || 0), 0) / last7Night.length).toLocaleString() : '-';
    const avgCalories = last7Night.length > 0 ? Math.round(last7Night.reduce((sum, h) => sum + parseInt(h.nightData.calories || 0), 0) / last7Night.length).toLocaleString() : '-';

    return { complianceRate, avgSleep, avgSteps, avgCalories };
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

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      let trimmed = line.trim();
      
      if (trimmed.startsWith('###')) {
        return <h4 key={i} className="md-h4" style={{ marginTop: '12px', marginBottom: '6px', fontWeight: 700 }}>{trimmed.replace('###', '').trim()}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={i} className="md-h3" style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 700 }}>{trimmed.replace('##', '').trim()}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={i} className="md-h2" style={{ marginTop: '20px', marginBottom: '10px', fontWeight: 800 }}>{trimmed.replace('#', '').trim()}</h2>;
      }
      
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        let content = trimmed.substring(1).trim();
        return (
          <li key={i} className="md-li" style={{ marginLeft: '16px', marginBottom: '4px', listStyleType: 'disc' }}>
            {parseBoldText(content)}
          </li>
        );
      }
      
      if (trimmed === '') {
        return <div key={i} style={{ height: '8px' }} />;
      }
      
      return <p key={i} className="md-p" style={{ marginBottom: '8px', lineHeight: 1.5 }}>{parseBoldText(line)}</p>;
    });
  };

  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const stats = getStats();

  return (
    <div className="app-container">
      {/* Top Banner Alert when Grace Period is warning */}
      {status.isWarning && (
        <div className="warning-banner pulse-glow">
          <svg className="icon-warning" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.753-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          <div>
            <strong>HABIT LOCK WARNING:</strong> You have <strong>{status.secondsRemaining} seconds</strong> to complete your <strong>{status.window} log</strong> before your device locks!
          </div>
        </div>
      )}

      {/* Header */}
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
            <h1>HABIT ARMOR</h1>
            <p className="subtitle">Daily bio-tracking and hardware alignment</p>
          </div>
        </div>
        <div className="status-badge-container">
          <span className={`status-pill ${status.completed ? 'status-green' : 'status-red'}`}>
            <span className="dot"></span>
            {status.completed ? 'Unlocked' : (status.reason || 'Locked')}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Sidebar Controls & Navigation */}
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

        {/* Form & Tab Content */}
        <main className="main-content glass-card">
          {submitSuccess && <div className="success-toast">{submitSuccess}</div>}

          <div className="tab-pane">
            {/* Morning Form */}
            {activeTab === 'morning' && (
              <form onSubmit={(e) => handleFormSubmit(e, 'morning')}>
                <div className="section-title">
                  <h2>Waking Bio-Metrics & Sleep</h2>
                  <p>Required immediately upon waking. Determines morning lock compliance.</p>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Waking Weight (kg)</label>
                    <input type="number" step="0.01" className="form-input" required placeholder="e.g. 78.45" value={morningData.wakingWeight} onChange={(e) => setMorningData({...morningData, wakingWeight: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sleep Duration (Hours)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 7.5" value={morningData.sleepHours} onChange={(e) => setMorningData({...morningData, sleepHours: e.target.value})} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Sleep Quality (Self Rated)</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.sleepQualitySelf} onChange={(e) => setMorningData({...morningData, sleepQualitySelf: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.sleepQualitySelf}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sleep Quality (Device Rated)</label>
                    <div className="slider-container">
                      <input type="range" min="0" max="100" className="slider" value={morningData.sleepQualityDevice} onChange={(e) => setMorningData({...morningData, sleepQualityDevice: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.sleepQualityDevice}/100</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Energy Level</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.energyLevels} onChange={(e) => setMorningData({...morningData, energyLevels: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.energyLevels}/10</span>
                    </div>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Mood</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.mood} onChange={(e) => setMorningData({...morningData, mood: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.mood}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stress</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.stress} onChange={(e) => setMorningData({...morningData, stress: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.stress}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Signs of Illness</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.illnessSigns} onChange={(e) => setMorningData({...morningData, illnessSigns: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.illnessSigns}/10</span>
                    </div>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Muscle Soreness (DOMS)</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={morningData.muscleSoreness} onChange={(e) => setMorningData({...morningData, muscleSoreness: parseInt(e.target.value)})} />
                      <span className="slider-val">{morningData.muscleSoreness}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resting HR (BPM)</label>
                    <input type="number" className="form-input" required placeholder="e.g. 58" value={morningData.restingHR} onChange={(e) => setMorningData({...morningData, restingHR: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Pressure</label>
                    <input type="text" className="form-input" placeholder="e.g. 120/80" value={morningData.bloodPressure} onChange={(e) => setMorningData({...morningData, bloodPressure: e.target.value})} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg">Submit Morning Log</button>
                </div>
              </form>
            )}

            {/* Morning Journal Form */}
            {activeTab === 'morningJournal' && (
              <form onSubmit={(e) => handleFormSubmit(e, 'morningJournal')}>
                <div className="section-title">
                  <h2>Daily Intentions & Journal</h2>
                  <p>Daily goals, intentions, and reflection. Requires a minimum of 50 words for each question.</p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>1. What are your top 3 priority goals for today?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Describe your primary focuses..." 
                    value={morningData.journalQ1 || ''} 
                    onChange={(e) => setMorningData({...morningData, journalQ1: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>2. How do you want to show up energetically/emotionally today?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Set your emotional tone and mindset..." 
                    value={morningData.journalQ2 || ''} 
                    onChange={(e) => setMorningData({...morningData, journalQ2: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>3. What potential obstacles do you foresee, and how will you handle them?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Anticipate and prepare..." 
                    value={morningData.journalQ3 || ''} 
                    onChange={(e) => setMorningData({...morningData, journalQ3: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg">Submit Morning Journal</button>
                </div>
              </form>
            )}

            {/* Night Form */}
            {activeTab === 'night' && (
              <form onSubmit={(e) => handleFormSubmit(e, 'night')}>
                <div className="section-title">
                  <h2>Nutrition & Daily Training</h2>
                  <p>Required before bed. Determines evening lock compliance.</p>
                </div>

                <h3 className="sub-section-title">Macronutrients & Food</h3>
                <div className="form-grid-4">
                  <div className="form-group">
                    <label className="form-label">Total Calories (kcal)</label>
                    <input type="number" className="form-input" required placeholder="e.g. 2400" value={nightData.calories} onChange={(e) => setNightData({...nightData, calories: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Protein (g)</label>
                    <input type="number" className="form-input" required placeholder="e.g. 180" value={nightData.protein} onChange={(e) => setNightData({...nightData, protein: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Carbs (g)</label>
                    <input type="number" className="form-input" required placeholder="e.g. 220" value={nightData.carbs} onChange={(e) => setNightData({...nightData, carbs: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fats (g)</label>
                    <input type="number" className="form-input" required placeholder="e.g. 70" value={nightData.fats} onChange={(e) => setNightData({...nightData, fats: e.target.value})} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Food Quality</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={nightData.foodQuality} onChange={(e) => setNightData({...nightData, foodQuality: parseInt(e.target.value)})} />
                      <span className="slider-val">{nightData.foodQuality}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Water Consumed (L)</label>
                    <input type="number" step="0.1" className="form-input" placeholder="e.g. 3.2" value={nightData.waterConsumed} onChange={(e) => setNightData({...nightData, waterConsumed: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ visibility: 'hidden' }}>Alcohol Consumed?</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
                      <input 
                        type="checkbox" 
                        id="alcoholConsumed"
                        checked={nightData.alcoholConsumed === 'Yes'} 
                        onChange={(e) => setNightData({...nightData, alcoholConsumed: e.target.checked ? 'Yes' : 'No'})}
                        style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor="alcoholConsumed" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                        Alcohol Consumed?
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Hunger / Appetite</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={nightData.hunger} onChange={(e) => setNightData({...nightData, hunger: parseInt(e.target.value)})} />
                      <span className="slider-val">{nightData.hunger}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Digestive Stress</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={nightData.digestiveStress} onChange={(e) => setNightData({...nightData, digestiveStress: parseInt(e.target.value)})} />
                      <span className="slider-val">{nightData.digestiveStress}/10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplements Rating</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" value={nightData.supplements} onChange={(e) => setNightData({...nightData, supplements: parseInt(e.target.value)})} />
                      <span className="slider-val">{nightData.supplements}/10</span>
                    </div>
                  </div>
                </div>

                <h3 className="sub-section-title">Activity & Workouts</h3>
                <div className="form-grid-4">
                  <div className="form-group">
                    <label className="form-label" style={{ visibility: 'hidden' }}>Training Day?</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
                      <input 
                        type="checkbox" 
                        id="trainingDay"
                        checked={nightData.trainingDay === 'Yes'} 
                        onChange={(e) => setNightData({...nightData, trainingDay: e.target.checked ? 'Yes' : 'No'})}
                        style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor="trainingDay" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                        Training Day?
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Strength Rating</label>
                    <div className="slider-container">
                      <input type="range" min="1" max="10" className="slider" disabled={nightData.trainingDay === 'No'} value={nightData.strengthPerformance} onChange={(e) => setNightData({...nightData, strengthPerformance: parseInt(e.target.value)})} />
                      <span className="slider-val">{nightData.trainingDay === 'No' ? 'N/A' : `${nightData.strengthPerformance}/10`}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Daily Steps</label>
                    <input type="number" className="form-input" required placeholder="e.g. 10450" value={nightData.steps} onChange={(e) => setNightData({...nightData, steps: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ visibility: 'hidden' }}>Cardio Performed?</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
                      <input 
                        type="checkbox" 
                        id="cardioPerformed"
                        checked={nightData.cardioPerformed === 'Yes'} 
                        onChange={(e) => setNightData({...nightData, cardioPerformed: e.target.checked ? 'Yes' : 'No'})}
                        style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor="cardioPerformed" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                        Cardio Performed?
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg">Submit Night Log</button>
                </div>
              </form>
            )}

            {/* Night Journal Form */}
            {activeTab === 'nightJournal' && (
              <form onSubmit={(e) => handleFormSubmit(e, 'nightJournal')}>
                <div className="section-title">
                  <h2>Evening Reflections & Journal</h2>
                  <p>Evening reflections and daily retrospective. Requires a minimum of 50 words for each question.</p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>1. What went well today and why?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Reflect on achievements and positive moments..." 
                    value={nightData.journalQ1 || ''} 
                    onChange={(e) => setNightData({...nightData, journalQ1: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>2. What could have been executed better or differently?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Analyze areas for improvement..." 
                    value={nightData.journalQ2 || ''} 
                    onChange={(e) => setNightData({...nightData, journalQ2: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 600 }}>3. What is your main priority or focus for tomorrow?</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows="3" 
                    placeholder="Plan your immediate priorities..." 
                    value={nightData.journalQ3 || ''} 
                    onChange={(e) => setNightData({...nightData, journalQ3: e.target.value})}
                    style={{ minHeight: '80px', marginTop: '4px' }}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg">Submit Night Journal</button>
                </div>
              </form>
            )}

            {/* Weekly Form */}
            {activeTab === 'weekly' && (
              <form onSubmit={(e) => handleFormSubmit(e, 'weekly')}>
                <div className="section-title">
                  <h2>Weekly Body Measurements</h2>
                  <p>Track body changes over time. Required every Sunday to prevent device locking.</p>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Week Commencing</label>
                    <input type="date" className="form-input" required value={weeklyData.weekCommencing} onChange={(e) => setWeeklyData({...weeklyData, weekCommencing: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Weight (kg)</label>
                    <input type="number" step="0.01" className="form-input" required placeholder="e.g. 79.2" value={weeklyData.startWeight} onChange={(e) => setWeeklyData({...weeklyData, startWeight: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Response Action</label>
                    <input type="text" className="form-input" placeholder="Notes/adjustments" value={weeklyData.responseAction} onChange={(e) => setWeeklyData({...weeklyData, responseAction: e.target.value})} />
                  </div>
                </div>

                <h3 className="sub-section-title">Circumference Measurements (cm)</h3>
                <div className="form-grid-4">
                  <div className="form-group">
                    <label className="form-label">Umbilical (Waist)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 84.5" value={weeklyData.umbilical} onChange={(e) => setWeeklyData({...weeklyData, umbilical: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bicep (Left)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.2" value={weeklyData.bicepL} onChange={(e) => setWeeklyData({...weeklyData, bicepL: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bicep (Right)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.5" value={weeklyData.bicepR} onChange={(e) => setWeeklyData({...weeklyData, bicepR: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quad (Left)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.1" value={weeklyData.quadL} onChange={(e) => setWeeklyData({...weeklyData, quadL: e.target.value})} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Quad (Right)</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.3" value={weeklyData.quadR} onChange={(e) => setWeeklyData({...weeklyData, quadR: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Glutes</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 98.2" value={weeklyData.glutes} onChange={(e) => setWeeklyData({...weeklyData, glutes: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chest</label>
                    <input type="number" step="0.1" className="form-input" required placeholder="e.g. 102.4" value={weeklyData.chest} onChange={(e) => setWeeklyData({...weeklyData, chest: e.target.value})} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg">Submit Weekly Specs</button>
                </div>
              </form>
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="dashboard-container">
                <div className="section-title">
                  <h2>Bio-Analytics Dashboard</h2>
                  <p>Aggregated stats and visual trend lines from your logs.</p>
                </div>

                {/* Grid of Metric Cards */}
                <div className="dashboard-stats">
                  <div className="metric-card">
                    <h3>Compliance Rate</h3>
                    <div className="value">{stats.complianceRate}%</div>
                    <div className="trend">morning & night completion</div>
                  </div>
                  <div className="metric-card">
                    <h3>Avg Sleep Duration</h3>
                    <div className="value">{stats.avgSleep} hrs</div>
                    <div className="trend">last 7 logs average</div>
                  </div>
                  <div className="metric-card">
                    <h3>Avg Daily Steps</h3>
                    <div className="value">{stats.avgSteps}</div>
                    <div className="trend">last 7 logs average</div>
                  </div>
                  <div className="metric-card">
                    <h3>Avg Calorie Intake</h3>
                    <div className="value">{stats.avgCalories} kcal</div>
                    <div className="trend">last 7 logs average</div>
                  </div>
                </div>

                {history.length < 2 ? (
                  <div className="glass-card no-history">
                    <p className="text-muted">Insufficient history logs to generate graphs. Submit at least 2 logs to see charts.</p>
                  </div>
                ) : (
                  <div className="charts-grid">
                    {/* Weight and Sleep Line Chart */}
                    <div className="chart-card">
                      <div className="chart-header">
                        <h3 className="chart-title">Weight & Sleep Trend</h3>
                        <div className="chart-legend">
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-purple)'}}></span>Weight (kg)</span>
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-cyan)'}}></span>Sleep (hrs)</span>
                        </div>
                      </div>
                      <div className="svg-chart-container">
                        {(() => {
                          const pts = [...history].reverse().filter(h => h.morningData).slice(-7);
                          if (pts.length < 2) return <p className="text-muted text-center py-10">Need more waking morning logs...</p>;
                          
                          const weights = pts.map(p => parseFloat(p.morningData.wakingWeight) || 0);
                          const sleeps = pts.map(p => parseFloat(p.morningData.sleepHours) || 0);
                          
                          const wMin = Math.min(...weights) - 0.5;
                          const wMax = Math.max(...weights) + 0.5;
                          const sMin = Math.max(0, Math.min(...sleeps) - 1);
                          const sMax = Math.max(...sleeps) + 1;

                          const w = 500;
                          const h = 200;
                          const padL = 40;
                          const padR = 40;
                          const padT = 20;
                          const padB = 30;
                          const gW = w - padL - padR;
                          const gH = h - padT - padB;

                          const coords = pts.map((p, i) => {
                            const x = padL + (i / (pts.length - 1)) * gW;
                            const wVal = parseFloat(p.morningData.wakingWeight) || 0;
                            const sVal = parseFloat(p.morningData.sleepHours) || 0;
                            const yW = padT + gH - ((wVal - wMin) / Math.max(0.1, wMax - wMin)) * gH;
                            const yS = padT + gH - ((sVal - sMin) / Math.max(0.1, sMax - sMin)) * gH;
                            return { x, yW, yS, date: p.date.substring(5), wVal, sVal };
                          });

                          const pathW = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yW}`).join(' ');
                          const pathS = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yS}`).join(' ');

                          return (
                            <svg viewBox={`0 0 ${w} ${h}`}>
                              {/* Definitions for Gradients */}
                              <defs>
                                <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.4"/>
                                  <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0.0"/>
                                </linearGradient>
                                <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4"/>
                                  <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0"/>
                                </linearGradient>
                              </defs>

                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map(idx => {
                                const y = padT + (idx / 4) * gH;
                                return (
                                  <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} className="svg-grid-line" />
                                );
                              })}

                              {/* Area under curves */}
                              {coords.length > 0 && (
                                <>
                                  <path d={`${coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yW}`).join(' ')} L ${coords[coords.length-1].x} ${padT + gH} L ${coords[0].x} ${padT + gH} Z`} fill="url(#purpleGlow)" className="svg-area-path" />
                                  <path d={`${coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yS}`).join(' ')} L ${coords[coords.length-1].x} ${padT + gH} L ${coords[0].x} ${padT + gH} Z`} fill="url(#cyanGlow)" className="svg-area-path" />
                                </>
                              )}

                              {/* Paths */}
                              <path d={pathW} className="svg-line-path" stroke="var(--accent-purple)" />
                              <path d={pathS} className="svg-line-path" stroke="var(--accent-cyan)" />

                              {/* Interactive dots and grid ticks */}
                              {coords.map((c, i) => (
                                <g key={i}>
                                  <circle cx={c.x} cy={c.yW} r="4" fill="var(--bg-main)" stroke="var(--accent-purple)" strokeWidth="2" className="svg-dot" />
                                  <circle cx={c.x} cy={c.yS} r="4" fill="var(--bg-main)" stroke="var(--accent-cyan)" strokeWidth="2" className="svg-dot" />
                                  <text x={c.x} y={h - 10} textAnchor="middle" className="svg-label">{c.date}</text>
                                </g>
                              ))}

                              {/* Grid y-labels for Weight (left) */}
                              <text x={10} y={padT + 5} className="svg-label">{wMax.toFixed(1)}</text>
                              <text x={10} y={padT + gH + 5} className="svg-label">{wMin.toFixed(1)}</text>

                              {/* Grid y-labels for Sleep (right) */}
                              <text x={w - 30} y={padT + 5} className="svg-label">{sMax.toFixed(1)}h</text>
                              <text x={w - 30} y={padT + gH + 5} className="svg-label">{sMin.toFixed(1)}h</text>

                              {/* Hover sensor rects */}
                              {coords.map((c, i) => (
                                <rect
                                  key={i}
                                  x={c.x - gW / (pts.length * 2)}
                                  y={padT}
                                  width={gW / pts.length}
                                  height={gH}
                                  fill="transparent"
                                  style={{cursor: 'pointer'}}
                                  onMouseEnter={(e) => {
                                    setHoveredPoint({
                                      chartId: 'weight-sleep',
                                      x: c.x,
                                      y: Math.min(c.yW, c.yS),
                                      date: pts[i].date,
                                      lines: [
                                        { label: 'Weight', val: `${c.wVal} kg`, color: 'var(--accent-purple)' },
                                        { label: 'Sleep', val: `${c.sVal} hrs`, color: 'var(--accent-cyan)' }
                                      ]
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              ))}
                            </svg>
                          );
                        })()}
                        {hoveredPoint && hoveredPoint.chartId === 'weight-sleep' && (
                          <div 
                            className="tooltip-overlay" 
                            style={{ 
                              left: hoveredPoint.x - 70, 
                              top: hoveredPoint.y - 75
                            }}
                          >
                            <div className="tooltip-date">{hoveredPoint.date}</div>
                            {hoveredPoint.lines.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="legend-color" style={{ background: l.color }}></span>
                                  {l.label}:
                                </span>
                                <strong>{l.val}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Calories & Protein Bar/Line Chart */}
                    <div className="chart-card">
                      <div className="chart-header">
                        <h3 className="chart-title">Calories & Protein Intake</h3>
                        <div className="chart-legend">
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-cyan)'}}></span>Calories (kcal)</span>
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-purple)'}}></span>Protein (g)</span>
                        </div>
                      </div>
                      <div className="svg-chart-container">
                        {(() => {
                          const pts = [...history].reverse().filter(h => h.nightData).slice(-7);
                          if (pts.length < 2) return <p className="text-muted text-center py-10">Need more evening nutrition logs...</p>;
                          
                          const calories = pts.map(p => parseFloat(p.nightData.calories) || 0);
                          const proteins = pts.map(p => parseFloat(p.nightData.protein) || 0);
                          
                          const maxCal = Math.max(...calories, 2500);
                          const maxProt = Math.max(...proteins, 150);

                          const w = 500;
                          const h = 200;
                          const padL = 40;
                          const padR = 40;
                          const padT = 20;
                          const padB = 30;
                          const gW = w - padL - padR;
                          const gH = h - padT - padB;

                          const coords = pts.map((p, i) => {
                            const x = padL + (i / (pts.length - 1)) * gW;
                            const cVal = parseFloat(p.nightData.calories) || 0;
                            const pVal = parseFloat(p.nightData.protein) || 0;
                            const barH = (cVal / maxCal) * gH;
                            const yBar = padT + gH - barH;
                            const yProt = padT + gH - (pVal / maxProt) * gH;
                            return { x, yBar, barH, yProt, date: p.date.substring(5), cVal, pVal };
                          });

                          const pathP = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yProt}`).join(' ');

                          return (
                            <svg viewBox={`0 0 ${w} ${h}`}>
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map(idx => {
                                const y = padT + (idx / 4) * gH;
                                return (
                                  <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} className="svg-grid-line" />
                                );
                              })}

                              {/* Bars for Calories */}
                              {coords.map((c, i) => (
                                <rect
                                  key={i}
                                  x={c.x - 10}
                                  y={c.yBar}
                                  width="20"
                                  height={c.barH}
                                  fill="url(#cyanGlow)"
                                  stroke="var(--accent-cyan)"
                                  strokeWidth="1"
                                  className="svg-bar"
                                  rx="2"
                                />
                              ))}

                              {/* Line for Protein */}
                              <path d={pathP} className="svg-line-path" stroke="var(--accent-purple)" strokeWidth="2.5" />

                              {/* Labels & Ticks */}
                              {coords.map((c, i) => (
                                <g key={i}>
                                  <circle cx={c.x} cy={c.yProt} r="4" fill="var(--bg-main)" stroke="var(--accent-purple)" strokeWidth="2" className="svg-dot" />
                                  <text x={c.x} y={h - 10} textAnchor="middle" className="svg-label">{c.date}</text>
                                </g>
                              ))}

                              {/* Grid labels */}
                              <text x={10} y={padT + 5} className="svg-label">{Math.round(maxCal)}</text>
                              <text x={10} y={padT + gH + 5} className="svg-label">0</text>
                              <text x={w - 35} y={padT + 5} className="svg-label">{Math.round(maxProt)}g</text>
                              <text x={w - 35} y={padT + gH + 5} className="svg-label">0g</text>

                              {/* Hover sensor rects */}
                              {coords.map((c, i) => (
                                <rect
                                  key={i}
                                  x={c.x - gW / (pts.length * 2)}
                                  y={padT}
                                  width={gW / pts.length}
                                  height={gH}
                                  fill="transparent"
                                  style={{cursor: 'pointer'}}
                                  onMouseEnter={(e) => {
                                    setHoveredPoint({
                                      chartId: 'calories-protein',
                                      x: c.x,
                                      y: Math.min(c.yBar, c.yProt),
                                      date: pts[i].date,
                                      lines: [
                                        { label: 'Calories', val: `${c.cVal} kcal`, color: 'var(--accent-cyan)' },
                                        { label: 'Protein', val: `${c.pVal} g`, color: 'var(--accent-purple)' }
                                      ]
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              ))}
                            </svg>
                          );
                        })()}
                        {hoveredPoint && hoveredPoint.chartId === 'calories-protein' && (
                          <div 
                            className="tooltip-overlay" 
                            style={{ 
                              left: hoveredPoint.x - 70, 
                              top: hoveredPoint.y - 75
                            }}
                          >
                            <div className="tooltip-date">{hoveredPoint.date}</div>
                            {hoveredPoint.lines.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="legend-color" style={{ background: l.color }}></span>
                                  {l.label}:
                                </span>
                                <strong>{l.val}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily Steps Bar Chart */}
                    <div className="chart-card" style={{gridColumn: 'span 1'}}>
                      <div className="chart-header">
                        <h3 className="chart-title">Daily Steps</h3>
                        <div className="chart-legend">
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-cyan)'}}></span>Steps</span>
                          <span className="legend-item"><span className="legend-color" style={{background: 'var(--accent-red)'}}></span>Goal (10k)</span>
                        </div>
                      </div>
                      <div className="svg-chart-container">
                        {(() => {
                          const pts = [...history].reverse().filter(h => h.nightData).slice(-7);
                          if (pts.length < 2) return <p className="text-muted text-center py-10">Need more evening activity logs...</p>;
                          
                          const steps = pts.map(p => parseInt(p.nightData.steps) || 0);
                          const maxSteps = Math.max(...steps, 12000);

                          const w = 500;
                          const h = 200;
                          const padL = 45;
                          const padR = 20;
                          const padT = 20;
                          const padB = 30;
                          const gW = w - padL - padR;
                          const gH = h - padT - padB;

                          const coords = pts.map((p, i) => {
                            const x = padL + (i / (pts.length - 1)) * gW;
                            const sVal = parseInt(p.nightData.steps) || 0;
                            const barH = (sVal / maxSteps) * gH;
                            const yBar = padT + gH - barH;
                            return { x, yBar, barH, date: p.date.substring(5), sVal };
                          });

                          const yGoal = padT + gH - (10000 / maxSteps) * gH;

                          return (
                            <svg viewBox={`0 0 ${w} ${h}`}>
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map(idx => {
                                const y = padT + (idx / 4) * gH;
                                return (
                                  <line key={idx} x1={padL} y1={y} x2={w - padR} y2={y} className="svg-grid-line" />
                                );
                              })}

                              {/* Goal line (10k steps) */}
                              <line x1={padL} y1={yGoal} x2={w - padR} y2={yGoal} stroke="var(--accent-red)" strokeWidth="1.5" strokeDasharray="4 2" />

                              {/* Bars */}
                              {coords.map((c, i) => (
                                <rect
                                  key={i}
                                  x={c.x - 12}
                                  y={c.yBar}
                                  width="24"
                                  height={c.barH}
                                  fill={c.sVal >= 10000 ? "url(#cyanGlow)" : "rgba(239, 68, 68, 0.2)"}
                                  stroke={c.sVal >= 10000 ? "var(--accent-cyan)" : "var(--accent-red)"}
                                  strokeWidth="1"
                                  className="svg-bar"
                                  rx="3"
                                />
                              ))}

                              {/* Labels */}
                              {coords.map((c, i) => (
                                <text key={i} x={c.x} y={h - 10} textAnchor="middle" className="svg-label">{c.date}</text>
                              ))}

                              {/* Y Axis labels */}
                              <text x={5} y={padT + 5} className="svg-label">{Math.round(maxSteps).toLocaleString()}</text>
                              <text x={5} y={yGoal + 4} className="svg-label" fill="var(--accent-red)">10k</text>
                              <text x={5} y={padT + gH + 5} className="svg-label">0</text>

                              {/* Hover sensors */}
                              {coords.map((c, i) => (
                                <rect
                                  key={i}
                                  x={c.x - gW / (pts.length * 2)}
                                  y={padT}
                                  width={gW / pts.length}
                                  height={gH}
                                  fill="transparent"
                                  style={{cursor: 'pointer'}}
                                  onMouseEnter={(e) => {
                                    setHoveredPoint({
                                      chartId: 'steps',
                                      x: c.x,
                                      y: c.yBar,
                                      date: pts[i].date,
                                      lines: [
                                        { label: 'Steps', val: c.sVal.toLocaleString(), color: c.sVal >= 10000 ? 'var(--accent-cyan)' : 'var(--accent-red)' }
                                      ]
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              ))}
                            </svg>
                          );
                        })()}
                        {hoveredPoint && hoveredPoint.chartId === 'steps' && (
                          <div 
                            className="tooltip-overlay" 
                            style={{ 
                              left: hoveredPoint.x - 70, 
                              top: hoveredPoint.y - 75
                            }}
                          >
                            <div className="tooltip-date">{hoveredPoint.date}</div>
                            {hoveredPoint.lines.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="legend-color" style={{ background: l.color }}></span>
                                  {l.label}:
                                </span>
                                <strong>{l.val}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
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
                                      {entry.morningCompleted && entry.morningData?.journalQ1 ? (
                                        <div className="expanded-journal-qa">
                                          <div className="expanded-journal-qa-item">
                                            <span>1. Top 3 priority goals:</span>
                                            <span>{entry.morningData.journalQ1}</span>
                                          </div>
                                          <div className="expanded-journal-qa-item">
                                            <span>2. Energetic & emotional tone:</span>
                                            <span>{entry.morningData.journalQ2}</span>
                                          </div>
                                          <div className="expanded-journal-qa-item">
                                            <span>3. Obstacles & backup strategy:</span>
                                            <span>{entry.morningData.journalQ3}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>No morning journal recorded.</p>
                                      )}
                                    </div>

                                    <div className="expanded-journal-section">
                                      <h4>🌙 Evening Retrospective</h4>
                                      {entry.nightCompleted && entry.nightData?.journalQ1 ? (
                                        <div className="expanded-journal-qa">
                                          <div className="expanded-journal-qa-item">
                                            <span>1. Wins & achievements:</span>
                                            <span>{entry.nightData.journalQ1}</span>
                                          </div>
                                          <div className="expanded-journal-qa-item">
                                            <span>2. Learnings & improvements:</span>
                                            <span>{entry.nightData.journalQ2}</span>
                                          </div>
                                          <div className="expanded-journal-qa-item">
                                            <span>3. Tomorrow's primary focus:</span>
                                            <span>{entry.nightData.journalQ3}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>No night journal recorded.</p>
                                      )}
                                    </div>
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
            )}

            {/* Gym Workouts Tab */}
            {activeTab === 'hevy' && (
              <div className="hevy-container">
                <div className="section-title">
                  <h2>💪 Gym Workouts & AI Coach</h2>
                  <p>Sync your training sessions from Hevy and generate AI progress analysis.</p>
                </div>

                {!hevyStatus.hevyApiKeyConfigured ? (
                  <div className="settings-section">
                    <h3 className="settings-section-title" style={{ color: 'var(--accent-red)', borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
                      🔑 Configure Hevy API Key
                    </h3>
                    <p className="settings-section-desc">To view your gym sessions, open the <strong>.env</strong> file at the root of your project and configure your Hevy API key:</p>
                    <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', margin: '12px 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>HEVY_API_KEY=your_hevy_api_key</pre>
                    <p className="settings-section-desc" style={{ fontSize: '0.85rem' }}>You can generate an API key via the Hevy web app at <em>hevy.com/settings?developer</em> (requires Hevy Pro).</p>
                    <p className="settings-section-desc" style={{ fontSize: '0.85rem' }}>After saving the file, restart the server by running <code>sh install.sh</code> in the project folder.</p>
                  </div>
                ) : (
                  <div className="hevy-layout">
                    {/* AI Coach Panel */}
                    <div className="ai-coach-panel">
                      <div className="ai-coach-header">
                        <div className="ai-coach-title-group">
                          <h3 className="settings-section-title" style={{ border: 'none', margin: 0, padding: 0 }}>
                            🤖 Coach Gemini Analysis
                          </h3>
                          <p className="settings-section-desc" style={{ margin: '4px 0 0 0' }}>Get feedback on volume, overloading, and consistency trends.</p>
                        </div>
                        {hevyStatus.geminiApiKeyConfigured ? (
                          <button 
                            className="btn btn-primary" 
                            disabled={analysisLoading || hevyWorkouts.length === 0} 
                            onClick={generateAIWorkoutAnalysis}
                          >
                            {analysisLoading ? 'Analyzing...' : analysisText ? 'Re-run Analysis' : 'Run AI Analysis'}
                          </button>
                        ) : null}
                      </div>

                      {!hevyStatus.geminiApiKeyConfigured ? (
                        <div className="alert alert-warning" style={{ margin: 0, padding: '16px', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                          <p style={{ margin: 0 }}>To enable AI Workout Analysis, please configure your Gemini API Key in the <strong>.env</strong> file:</p>
                          <pre style={{ background: '#fcf8e3', padding: '8px', borderRadius: '4px', border: '1px solid #faebcc', margin: '8px 0', fontFamily: 'monospace', fontSize: '0.85rem' }}>GEMINI_API_KEY=your_gemini_api_key</pre>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>Get a free API key from Google AI Studio.</p>
                        </div>
                      ) : (
                        <div className="ai-analysis-box">
                          {analysisLoading && (
                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                              <p className="pulse-glow" style={{ fontWeight: 600, margin: 0 }}>🤖 Coach Gemini is analyzing your training volume, progressive overload, and consistency trends...</p>
                            </div>
                          )}
                          {analysisError && (
                            <p style={{ color: 'var(--accent-red)', fontWeight: 600, margin: 0 }}>Error: {analysisError}</p>
                          )}
                          {!analysisLoading && !analysisError && !analysisText && (
                            <p className="text-muted" style={{ margin: 0, textAlign: 'center' }}>Click "Run AI Analysis" to critique your recent workouts.</p>
                          )}
                          {!analysisLoading && !analysisError && analysisText && (
                            <div className="markdown-content">
                              {renderMarkdown(analysisText)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Workouts Grid */}
                    <div className="workouts-section">
                      <h3 className="settings-section-title" style={{ marginBottom: '16px' }}>📅 Recent Workout Logs</h3>
                      {workoutsLoading && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <p className="pulse-glow" style={{ fontWeight: 600, margin: 0 }}>Syncing with Hevy...</p>
                        </div>
                      )}
                      {workoutsError && (
                        <div className="alert alert-warning" style={{ padding: '16px', background: '#fff5f5', borderLeft: '4px solid var(--accent-red)' }}>
                          <p style={{ color: 'var(--accent-red)', fontWeight: 600, margin: 0 }}>Failed to fetch workouts: {workoutsError}</p>
                        </div>
                      )}
                      {!workoutsLoading && !workoutsError && hevyWorkouts.length === 0 && (
                        <p className="text-muted" style={{ textAlign: 'center', padding: '40px 0', margin: 0 }}>No workouts found. Log workouts in the Hevy app to sync them here!</p>
                      )}
                      {!workoutsLoading && !workoutsError && hevyWorkouts.length > 0 && (
                        <div className="workouts-grid">
                          {hevyWorkouts.map((w) => {
                            const dateStr = w.start_time ? new Date(w.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
                            const durationMins = w.start_time && w.end_time ? Math.round((new Date(w.end_time) - new Date(w.start_time)) / 60000) : null;
                            return (
                              <div key={w.id} className="workout-card">
                                <div className="workout-card-header">
                                  <h4>{w.title || 'Workout'}</h4>
                                  <div className="workout-meta">
                                    <span>📅 {dateStr}</span>
                                    {durationMins && <span>⏱️ {durationMins} mins</span>}
                                  </div>
                                  {w.notes && (
                                    <p className="workout-notes">"{w.notes}"</p>
                                  )}
                                </div>
                                
                                <div className="workout-exercises" style={{ flexGrow: 1 }}>
                                  {w.exercises?.map((e, eIdx) => (
                                    <div key={eIdx} className="workout-exercise-item">
                                      <h5>{e.title}</h5>
                                      <div className="workout-sets-list">
                                        {e.sets?.map((s, sIdx) => {
                                          const wt = s.weight_kg !== null && s.weight_kg !== undefined ? `${s.weight_kg} kg` : 'Bodyweight';
                                          const reps = s.reps || 0;
                                          const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
                                          return (
                                            <div key={sIdx} className="workout-set-row">
                                              <span>Set {sIdx + 1}: {reps} reps</span>
                                              <span style={{ fontWeight: 500 }}>{wt}{rpe}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
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

                <div className="form-actions" style={{marginTop: '12px'}}>
                  <button type="button" className="btn btn-primary btn-lg" onClick={saveConfig}>Save Configuration</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
