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
import AnkiView from './components/AnkiView';
import PracticeView from './components/PracticeView';
import SettingsView from './components/SettingsView';
import Gallery from './components/ui/Gallery';
import { Alert, Stack } from './components/ui';
import { api, API_URL } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('morning');
  const [status, setStatus] = useState({ locked: false, isWarning: false, secondsRemaining: 0, window: null, completed: true, reason: "" });
  const [config, setConfig] = useState({ 
    morningStart: 5, 
    morningEnd: 12, 
    nightStart: 20, 
    nightEnd: 24, 
    gracePeriodSec: 120,
    journalStorage: "none",
    obsidianVaultPath: "",
    obsidianJournalFolder: "Journal",
    gymLockEnabled: true,
    gymLockStartHour: 21,
    gymMinDurationMinutes: 30,
    gymRoutineVerificationEnabled: true,
    gymMinTotalSets: 12,
    gymWeeklyGoal: 5,
    gymRequireNoConsecutiveRestDays: true,
    gymMinSteps: 13000,
    weeklyLockEnabled: true,
    weeklyLockDay: 0,
    weeklyLockStartHour: 0,
    weeklyLockEndHour: 24,
    ankiLockEnabled: true,
    ankiLockStartHour: 21,
    ankiConnectUrl: "http://localhost:8765",
    ankiIgnoredDecks: [],
    practiceLockEnabled: true,
    practiceLockStartHour: 21,
    practiceMinDueToUnlock: 1,
    practiceNewCardsPerDay: 1,
    practiceReviewTopicsPerDay: 1,
    supplementsList: ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'],
    enforceSupplementsBlocker: true
  });
  const [ipInfo, setIpInfo] = useState('localhost');
  const [history, setHistory] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [editingDate, setEditingDate] = useState(null);

  // Surfaced to the user instead of dropped into console.error. `offline` is
  // tracked separately because a dead server means everything on screen is
  // stale, which is worth saying once rather than per failed request.
  const [offline, setOffline] = useState(false);
  const [formError, setFormError] = useState(null);
  const [configError, setConfigError] = useState(null);
  
  // Gym verification states
  const [gymVerifyLoading, setGymVerifyLoading] = useState(false);
  const [gymVerifyResult, setGymVerifyResult] = useState(null);
  const [gymVerifyError, setGymVerifyError] = useState(null);

  // Form states with localStorage draft persistence
  const [morningData, setMorningData] = useState(() => {
    try {
      const saved = localStorage.getItem('habitarmour_draft_morning');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load morningData draft:', e);
    }
    return {
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
    };
  });

  const [nightData, setNightData] = useState(() => {
    try {
      const saved = localStorage.getItem('habitarmour_draft_night');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load nightData draft:', e);
    }
    return {
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      foodQuality: 5,
      waterConsumed: '',
      alcoholConsumed: 'No',
      hunger: 5,
      digestiveStress: 1,
      supplements: {
        'Vitamin D3': false,
        'Vitamin K2': false,
        'Omega-3': false,
        'Creatine': false
      },
      proteinShake: { taken: false, photoUrl: '' },
      trainingDay: 'No',
      strengthPerformance: 5,
      steps: '',
      cardioPerformed: 'No',
      journalEntry: ''
    };
  });

  const [weeklyData, setWeeklyData] = useState(() => {
    try {
      const saved = localStorage.getItem('habitarmour_draft_weekly');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load weeklyData draft:', e);
    }
    return {
      weekCommencing: new Date().toISOString().split('T')[0],
      startWeight: '',
      responseAction: '',
      umbilical: '',
      bicepL: '',
      bicepR: '',
      quadL: '',
      quadR: '',
      glutes: '',
      chest: '',
      photos: { front: '', back: '', sideLeft: '', sideRight: '' }
    };
  });

  // Auto-save form drafts to localStorage whenever fields change
  useEffect(() => {
    try {
      if (!editingDate) {
        localStorage.setItem('habitarmour_draft_morning', JSON.stringify(morningData));
      }
    } catch (err) {
      console.error('Failed to save morningData draft:', err);
    }
  }, [morningData, editingDate]);

  useEffect(() => {
    try {
      if (!editingDate) {
        localStorage.setItem('habitarmour_draft_night', JSON.stringify(nightData));
      }
    } catch (err) {
      console.error('Failed to save nightData draft:', err);
    }
  }, [nightData, editingDate]);

  useEffect(() => {
    try {
      if (!editingDate) {
        localStorage.setItem('habitarmour_draft_weekly', JSON.stringify(weeklyData));
      }
    } catch (err) {
      console.error('Failed to save weeklyData draft:', err);
    }
  }, [weeklyData, editingDate]);

  // Hevy Gym States
  const [hevyStatus, setHevyStatus] = useState({ hevyApiKeyConfigured: false, geminiApiKeyConfigured: false });
  const [hevyWorkouts, setHevyWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutsError, setWorkoutsError] = useState(null);

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
      setStatus(await api.getStatus());
      setOffline(false);
    } catch (err) {
      // The 5s poll is the app's heartbeat, so it owns the offline flag.
      if (err.isOffline) setOffline(true);
    }
  };

  const handleVerifyGymWorkout = async () => {
    setGymVerifyLoading(true);
    setGymVerifyError(null);
    setGymVerifyResult(null);
    try {
      const data = await api.hevy.verifyToday();
      setGymVerifyResult({ success: data.success, workout: data.workout, reason: data.error });
      if (data.success) {
        fetchStatus();
      } else {
        setGymVerifyError(data.error || 'Verification failed');
      }
    } catch (err) {
      setGymVerifyError(err.message);
    } finally {
      setGymVerifyLoading(false);
    }
  };

  const fetchHevyStatus = async () => {
    try {
      const data = await api.hevy.status();
      setHevyStatus(data);
      if (data.hevyApiKeyConfigured) {
        fetchHevyWorkouts();
      }
    } catch (err) {
      if (!err.isOffline) setWorkoutsError(err.message);
    }
  };

  const fetchHevyWorkouts = async () => {
    setWorkoutsLoading(true);
    setWorkoutsError(null);
    try {
      const data = await api.hevy.workouts();
      setHevyWorkouts(Array.isArray(data) ? data : data.workouts || []);
    } catch (err) {
      setWorkoutsError(err.message);
    } finally {
      setWorkoutsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setConfig(await api.getConfig());
    } catch (err) {
      if (!err.isOffline) setConfigError(err.message);
    }
  };

  const fetchIP = async () => {
    try {
      const { ip } = await api.getIp();
      setIpInfo(ip);
    } catch {
      // Cosmetic: the sidebar just keeps showing "localhost".
    }
  };

  const fetchHistory = async () => {
    try {
      setHistory(await api.getHistory());
    } catch (err) {
      if (!err.isOffline) setFormError(err.message);
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
    setConfigError(null);
    try {
      // The server validates types and returns 422 with the offending field, so
      // a rejected save now says which value was wrong instead of doing nothing.
      await api.saveConfig(config);
      setSubmitSuccess('Configuration updated!');
      setTimeout(() => setSubmitSuccess(null), 3000);
    } catch (err) {
      setConfigError(err.message);
    }
  };

  const triggerTestLock = async () => {
    setFormError(null);
    try {
      await api.triggerTestLock();
      setSubmitSuccess('Test lock active for 15 seconds. Your screen will lock shortly.');
      setTimeout(() => setSubmitSuccess(null), 5000);
      fetchStatus();
    } catch (err) {
      setFormError(err.message);
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
      const suppList = config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
      const defaultSuppMap = {};
      suppList.forEach(s => { defaultSuppMap[s] = false; });

      if (entry?.nightData) {
        let loadedSupps = entry.nightData.supplements;
        let formattedSupps = { ...defaultSuppMap };
        if (typeof loadedSupps === 'object' && loadedSupps !== null && !Array.isArray(loadedSupps)) {
          formattedSupps = { ...defaultSuppMap, ...loadedSupps };
        } else if (typeof loadedSupps === 'number') {
          suppList.forEach(s => { formattedSupps[s] = loadedSupps === 10; });
        }
        setNightData({ ...entry.nightData, supplements: formattedSupps });
      } else {
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
          supplements: defaultSuppMap,
          trainingDay: 'No',
          strengthPerformance: 5,
          steps: '',
          cardioPerformed: 'No',
          journalEntry: ''
        });
      }
      setActiveTab('night');
    } else if (windowType === 'nightJournal') {
      setNightData(prev => ({ ...prev, journalEntry: entry?.nightJournalData?.journalEntry || '' }));
      setActiveTab('nightJournal');
    } else if (windowType === 'weekly') {
      setWeeklyData(entry?.weeklyData ? {
        ...entry.weeklyData,
        photos: entry.weeklyData.photos || { front: '', back: '', sideLeft: '', sideRight: '' }
      } : {
        weekCommencing: date,
        startWeight: '',
        responseAction: '',
        umbilical: '',
        bicepL: '',
        bicepR: '',
        quadL: '',
        quadR: '',
        glutes: '',
        chest: '',
        photos: { front: '', back: '', sideLeft: '', sideRight: '' }
      });
      setActiveTab('weekly');
    }
  };

  const cancelEditing = () => {
    setEditingDate(null);
    const suppList = config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
    const defaultSuppMap = {};
    suppList.forEach(s => { defaultSuppMap[s] = false; });

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
      supplements: defaultSuppMap,
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
      chest: '',
      photos: { front: '', back: '', sideLeft: '', sideRight: '' }
    });
    setActiveTab('history');
  };

  /**
   * Returns a human-readable reason the log can't be submitted yet, or null.
   * Split out so the same rules can drive both the submit guard and (later)
   * a disabled submit button, rather than only firing after a failed click.
   */
  const getSubmitBlocker = (windowType, data) => {
    if (windowType === 'morningJournal' || windowType === 'nightJournal') {
      const words = (data.journalEntry || '').trim().split(/\s+/).filter(Boolean).length;
      if (words < 100) {
        return `Journal entry has ${words} of the 100 words required to submit.`;
      }
    }

    if (windowType === 'night' && config.enforceSupplementsBlocker !== false) {
      const suppList = config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
      const userSupps = data.supplements || {};
      const missing = suppList.filter(s => !userSupps[s]);
      if (missing.length > 0) {
        return `All supplements must be checked before the night log clears the lock. Missing: ${missing.join(', ')}.`;
      }
    }

    if (windowType === 'night' && config.enforceProteinShakeBlocker !== false) {
      const ps = data.proteinShake;
      if (!ps?.taken || !ps?.photoUrl) {
        return 'The night log needs protein shake confirmation and a proof photo.';
      }
    }

    if (windowType === 'weekly' && config.weeklyPhotosRequired !== false) {
      const photos = data.photos || {};
      const missing = [];
      if (!photos.front) missing.push('Front');
      if (!photos.back) missing.push('Back');
      if (!photos.sideLeft) missing.push('Left side');
      if (!photos.sideRight) missing.push('Right side');
      if (missing.length > 0) {
        return `All 4 weekly progress photos are required. Missing: ${missing.join(', ')}.`;
      }
    }

    return null;
  };

  const handleFormSubmit = async (e, windowType) => {
    e.preventDefault();
    setFormError(null);

    let dataToSubmit = {};
    if (windowType === 'morning') dataToSubmit = morningData;
    else if (windowType === 'morningJournal') dataToSubmit = morningData;
    else if (windowType === 'night') dataToSubmit = nightData;
    else if (windowType === 'nightJournal') dataToSubmit = nightData;
    else if (windowType === 'weekly') dataToSubmit = weeklyData;

    const blocker = getSubmitBlocker(windowType, dataToSubmit);
    if (blocker) {
      setFormError(blocker);
      return;
    }

    try {
      {
        await api.submitLog({ window: windowType, data: dataToSubmit, date: editingDate });
        setSubmitSuccess(`${windowType.toUpperCase()} log ${editingDate ? 'updated' : 'submitted'} successfully!`);
        if (windowType === 'morning') {
          setMorningData(prev => {
            const updated = { ...prev, wakingWeight: '', sleepHours: '', restingHR: '', bloodPressure: '' };
            localStorage.setItem('habitarmour_draft_morning', JSON.stringify(updated));
            return updated;
          });
        } else if (windowType === 'morningJournal') {
          setMorningData(prev => {
            const updated = { ...prev, journalEntry: '' };
            localStorage.setItem('habitarmour_draft_morning', JSON.stringify(updated));
            return updated;
          });
        } else if (windowType === 'night') {
          localStorage.removeItem('habitarmour_draft_night');
        } else if (windowType === 'nightJournal') {
          setNightData(prev => {
            const updated = { ...prev, journalEntry: '' };
            localStorage.setItem('habitarmour_draft_night', JSON.stringify(updated));
            return updated;
          });
        } else if (windowType === 'weekly') {
          localStorage.removeItem('habitarmour_draft_weekly');
        }
        setEditingDate(null);
        fetchStatus();
        fetchHistory();
        setTimeout(() => setSubmitSuccess(null), 3000);
        setActiveTab('history');
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  const getStats = () => {
    const totalDays = history.length;
    const morningLogs = history.filter(h => h.morningData);
    const nightLogs = history.filter(h => h.nightData);

    let morningCompliance = 0;
    let morningJournalCompliance = 0;
    let nightCompliance = 0;
    let nightJournalCompliance = 0;
    let gymCompliance = 0;
    let ankiCompliance = 0;
    let practiceCompliance = 0;
    let slotsPerDay = 4;
    if (config?.gymLockEnabled) slotsPerDay++;
    if (config?.ankiLockEnabled) slotsPerDay++;
    if (config?.practiceLockEnabled) slotsPerDay++;

    history.forEach(h => {
      if (h.morningCompleted) {
        morningCompliance++;
      }
      if (h.morningJournalCompleted) {
        morningJournalCompliance++;
      }
      if (h.nightCompleted) {
        nightCompliance++;
      }
      if (h.nightJournalCompleted) {
        nightJournalCompliance++;
      }

      if (config?.gymLockEnabled && h.gymCompleted) {
        gymCompliance++;
      }

      if (config?.ankiLockEnabled && (h.ankiCompleted || h.ankiManualOverride)) {
        ankiCompliance++;
      }

      if (config?.practiceLockEnabled && (h.practiceCompleted || h.practiceManualOverride)) {
        practiceCompliance++;
      }
    });

    const totalSlots = totalDays * slotsPerDay;
    const totalDone = morningCompliance + morningJournalCompliance + nightCompliance + nightJournalCompliance +
      (config?.gymLockEnabled ? gymCompliance : 0) +
      (config?.ankiLockEnabled ? ankiCompliance : 0) +
      (config?.practiceLockEnabled ? practiceCompliance : 0);
    const complianceRate = totalSlots > 0 ? Math.round((totalDone / totalSlots) * 100) : 100;

    const last7Morning = morningLogs.slice(0, 7);
    const last7Night = nightLogs.slice(0, 7);

    const validWeightLogs = last7Morning.filter(h => h.morningData?.wakingWeight && !isNaN(parseFloat(h.morningData.wakingWeight)));
    const avgWeight = validWeightLogs.length > 0 ? (validWeightLogs.reduce((sum, h) => sum + parseFloat(h.morningData.wakingWeight), 0) / validWeightLogs.length).toFixed(1) : '-';
    const avgSleep = last7Morning.length > 0 ? (last7Morning.reduce((sum, h) => sum + parseFloat(h.morningData.sleepHours || 0), 0) / last7Morning.length).toFixed(1) : '-';
    const avgSteps = last7Night.length > 0 ? Math.round(last7Night.reduce((sum, h) => sum + parseInt(h.nightData.steps || 0), 0) / last7Night.length).toLocaleString() : '-';
    const avgCalories = last7Night.length > 0 ? Math.round(last7Night.reduce((sum, h) => sum + parseInt(h.nightData.calories || 0), 0) / last7Night.length).toLocaleString() : '-';

    return { complianceRate, avgWeight, avgSleep, avgSteps, avgCalories };
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
        />

        <main className="main-content glass-card">
          {submitSuccess && <div className="success-toast">{submitSuccess}</div>}

          <Stack gap={3} style={{ marginBottom: (offline || formError || configError) ? 'var(--space-4)' : 0 }}>
            {offline && (
              <Alert variant="warning" title="Can't reach Habit Armour">
                Everything below is the last state received. Check that the server is running on port{' '}
                {new URL(API_URL || window.location.origin).port || '3000'}.
              </Alert>
            )}
            {formError && (
              <Alert variant="danger" title="Couldn't submit" onDismiss={() => setFormError(null)}>
                {formError}
              </Alert>
            )}
            {configError && (
              <Alert variant="danger" title="Couldn't save settings" onDismiss={() => setConfigError(null)}>
                {configError}
              </Alert>
            )}
          </Stack>

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
                supplementsList={config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine']}
                enforceBlocker={config.enforceSupplementsBlocker !== false}
                enforceProteinShakeBlocker={config.enforceProteinShakeBlocker !== false}
                API_URL={API_URL}
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
                photosRequired={config.weeklyPhotosRequired !== false}
                API_URL={API_URL}
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
                API_URL={API_URL}
                startEditingLog={startEditingLog}
              />
            )}

            {activeTab === 'hevy' && (
              <HevyView 
                hevyStatus={hevyStatus}
                hevyWorkouts={hevyWorkouts}
                workoutsLoading={workoutsLoading}
                workoutsError={workoutsError}
                fetchHevyWorkouts={fetchHevyWorkouts}
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

            {activeTab === 'anki' && (
              <AnkiView 
                API_URL={API_URL}
                status={status}
                onRefreshStatus={fetchStatus}
              />
            )}

            {activeTab === 'practice' && (
              <PracticeView 
                API_URL={API_URL}
                status={status}
                onRefreshStatus={fetchStatus}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView 
                config={config}
                handleConfigChange={handleConfigChange}
                saveConfig={saveConfig}
              />
            )}

            {activeTab === 'gallery' && import.meta.env.DEV && <Gallery />}
          </div>
        </main>
      </div>
    </div>
  );
}
