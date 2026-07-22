import React, { useState, useEffect } from 'react';
import './App.css';

// Import subcomponents
import WarningBanner from './components/WarningBanner';
import Header from './components/Header';
import Navigation from './components/Navigation';
import MorningForm from './components/MorningForm';
import MorningJournalForm from './components/MorningJournalForm';
import NightForm from './components/NightForm';
import NightJournalForm from './components/NightJournalForm';
import WeeklyForm from './components/WeeklyForm';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import HevyView from './components/HevyView';
import GymView from './components/GymView';
import SettingsView from './components/SettingsView';

// API Base URL - handle Vite dev server (port 5173) and local network IP origin
const API_URL = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin);

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
    googleDocId: "",
    gymLockEnabled: true,
    gymLockStartHour: 21,
    gymMinDurationMinutes: 30,
    gymRoutineVerificationEnabled: true,
    gymMinTotalSets: 12
  });
  const [ipInfo, setIpInfo] = useState('localhost');
  const [history, setHistory] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [testingSync, setTestingSync] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  
  // Gym verification states
  const [gymVerifyLoading, setGymVerifyLoading] = useState(false);
  const [gymVerifyResult, setGymVerifyResult] = useState(null);
  const [gymVerifyError, setGymVerifyError] = useState(null);

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
    journalEntry: ''
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
    journalEntry: ''
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
  const [analysisText, setAnalysisText] = useState(() => {
    try {
      return localStorage.getItem('hevy_ai_analysis') || '';
    } catch {
      return '';
    }
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('hevy_ai_analysis', analysisText);
    } catch (err) {
      console.error('Failed to save AI analysis cache:', err);
    }
  }, [analysisText]);

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

  const handleVerifyGymWorkout = async () => {
    setGymVerifyLoading(true);
    setGymVerifyError(null);
    setGymVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/api/hevy/verify-today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGymVerifyResult({
          success: true,
          workout: data.workout,
          reason: data.reason
        });
        fetchStatus();
      } else {
        setGymVerifyError(data.reason || "Verification failed");
        setGymVerifyResult({
          success: false,
          workout: data.workout,
          reason: data.reason
        });
      }
    } catch (err) {
      setGymVerifyError(err.message);
    } finally {
      setGymVerifyLoading(false);
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
      await fetch(`${API_URL}/api/test-lock`, { method: 'POST' });
      alert("Test lock active for 15 seconds! If your macOS lock daemon is running, your screen will lock in a few seconds.");
      fetchStatus();
    } catch (err) {
      alert("Error triggering test lock: " + err.message);
    }
  };

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

  const startEditingLog = (date, windowType) => {
    const entry = history.find(h => h.date === date);
    setEditingDate(date);
    
    if (windowType === 'morning') {
      setMorningData(entry?.morningData || {
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
        journalEntry: ''
      });
      setActiveTab('morning');
    } else if (windowType === 'morningJournal') {
      setMorningData(prev => ({ ...prev, journalEntry: entry?.morningJournalData?.journalEntry || '' }));
      setActiveTab('morningJournal');
    } else if (windowType === 'night') {
      setNightData(entry?.nightData || {
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
        journalEntry: ''
      });
      setActiveTab('night');
    } else if (windowType === 'nightJournal') {
      setNightData(prev => ({ ...prev, journalEntry: entry?.nightJournalData?.journalEntry || '' }));
      setActiveTab('nightJournal');
    } else if (windowType === 'weekly') {
      setWeeklyData(entry?.weeklyData || {
        weekCommencing: date,
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
      setActiveTab('weekly');
    }
  };

  const cancelEditing = () => {
    setEditingDate(null);
    // Reset forms
    setMorningData({
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
      journalEntry: ''
    });
    setNightData({
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
      journalEntry: ''
    });
    setWeeklyData({
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
    setActiveTab('history');
  };

  const handleFormSubmit = async (e, windowType) => {
    e.preventDefault();
    let dataToSubmit = {};
    if (windowType === 'morning') dataToSubmit = morningData;
    else if (windowType === 'morningJournal') dataToSubmit = morningData;
    else if (windowType === 'night') dataToSubmit = nightData;
    else if (windowType === 'nightJournal') dataToSubmit = nightData;
    else if (windowType === 'weekly') dataToSubmit = weeklyData;

    if (windowType === 'morningJournal' || windowType === 'nightJournal') {
      const words = (dataToSubmit.journalEntry || '').trim().split(/\s+/).filter(Boolean).length;
      if (words < 100) {
        alert(`Journal entry only has ${words} words. A minimum of 100 words is required to submit.`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window: windowType, data: dataToSubmit, date: editingDate })
      });
      if (res.ok) {
        setSubmitSuccess(`${windowType.toUpperCase()} log ${editingDate ? 'updated' : 'submitted'} successfully!`);
        if (windowType === 'morningJournal') {
          setMorningData(prev => ({ ...prev, journalEntry: '' }));
        } else if (windowType === 'nightJournal') {
          setNightData(prev => ({ ...prev, journalEntry: '' }));
        }
        setEditingDate(null);
        fetchStatus();
        fetchHistory();
        setTimeout(() => setSubmitSuccess(null), 3000);
        setActiveTab('history');
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Submission failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submit error: " + err.message);
    }
  };

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

  const stats = getStats();

  return (
    <div className="app-container">
      <WarningBanner status={status} />
      <Header status={status} />

      <div className="dashboard-grid">
        <Navigation 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          status={status}
          ipInfo={ipInfo}
          triggerTestLock={triggerTestLock}
          config={config}
          syncAllUnsynced={syncAllUnsynced}
          syncingAll={syncingAll}
        />

        <main className="main-content glass-card">
          {submitSuccess && <div className="success-toast">{submitSuccess}</div>}

          <div className="tab-pane">
            {activeTab === 'morning' && (
              <MorningForm 
                morningData={morningData}
                setMorningData={setMorningData}
                editingDate={editingDate}
                cancelEditing={cancelEditing}
                onSubmit={(e) => handleFormSubmit(e, 'morning')}
              />
            )}

            {activeTab === 'morningJournal' && (
              <MorningJournalForm 
                morningData={morningData}
                setMorningData={setMorningData}
                editingDate={editingDate}
                cancelEditing={cancelEditing}
                onSubmit={(e) => handleFormSubmit(e, 'morningJournal')}
              />
            )}

            {activeTab === 'night' && (
              <NightForm 
                nightData={nightData}
                setNightData={setNightData}
                editingDate={editingDate}
                cancelEditing={cancelEditing}
                onSubmit={(e) => handleFormSubmit(e, 'night')}
              />
            )}

            {activeTab === 'nightJournal' && (
              <NightJournalForm 
                nightData={nightData}
                setNightData={setNightData}
                status={status}
                editingDate={editingDate}
                cancelEditing={cancelEditing}
                onSubmit={(e) => handleFormSubmit(e, 'nightJournal')}
              />
            )}

            {activeTab === 'weekly' && (
              <WeeklyForm 
                weeklyData={weeklyData}
                setWeeklyData={setWeeklyData}
                editingDate={editingDate}
                cancelEditing={cancelEditing}
                onSubmit={(e) => handleFormSubmit(e, 'weekly')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView 
                stats={stats}
                history={history}
                config={config}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView 
                history={history}
                config={config}
                syncAllUnsynced={syncAllUnsynced}
                syncingAll={syncingAll}
                syncLogEntry={syncLogEntry}
                startEditingLog={startEditingLog}
              />
            )}

            {activeTab === 'hevy' && (
              <HevyView 
                hevyStatus={hevyStatus}
                hevyWorkouts={hevyWorkouts}
                workoutsLoading={workoutsLoading}
                workoutsError={workoutsError}
                analysisLoading={analysisLoading}
                analysisError={analysisError}
                analysisText={analysisText}
                generateAIWorkoutAnalysis={generateAIWorkoutAnalysis}
              />
            )}

            {activeTab === 'gym' && (
              <GymView 
                status={status}
                config={config}
                gymVerifyLoading={gymVerifyLoading}
                gymVerifyResult={gymVerifyResult}
                gymVerifyError={gymVerifyError}
                handleVerifyGymWorkout={handleVerifyGymWorkout}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView 
                config={config}
                handleConfigChange={handleConfigChange}
                testingSync={testingSync}
                testSheetSync={testSheetSync}
                syncStatusMsg={syncStatusMsg}
                saveConfig={saveConfig}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
