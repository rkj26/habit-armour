import React, { useState, useEffect } from 'react';

// Import subcomponents
import WarningBanner from './components/WarningBanner';
import AppSidebar from './components/AppSidebar';
import SiteHeader from './components/SiteHeader';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert';
import { SidebarInset, SidebarProvider } from '@/components/shadcn/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import { TODAY_TABS, WINDOW_TO_TAB } from '@/nav';
import { WifiOff, TriangleAlert, Check } from 'lucide-react';
import { logicalToday } from '@/lib/logicalDay';
import { useDraft } from '@/lib/useDraft';
import { morningJournalBlocker } from './components/MorningJournalForm';
import { nightJournalBlocker } from './components/NightJournalForm';
import { api, API_URL } from './api/client';

const DEFAULT_SUPPLEMENTS = ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];

const suppMap = (list, taken = false) =>
  Object.fromEntries((list || DEFAULT_SUPPLEMENTS).map((s) => [s, taken]));

const EMPTY_MORNING = {
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
  todos: [],
  feeling: ''
};

const EMPTY_NIGHT = {
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  foodQuality: 5,
  waterConsumed: '',
  alcoholConsumed: 'No',
  hunger: 5,
  digestiveStress: 1,
  supplements: suppMap(DEFAULT_SUPPLEMENTS),
  proteinShake: { taken: false, photoUrl: '' },
  trainingDay: 'No',
  strengthPerformance: 5,
  steps: '',
  cardioPerformed: 'No',
  todosCompleted: [],
  feeling: '',
  tomorrow: ''
};

const emptyWeekly = () => ({
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

/**
 * `parseInt` used to run on every numeric field. Two consequences: targetWeight
 * is a float server-side, so 75.5 was silently saved as 75; and `parseInt('')`
 * is NaN, so clearing a field to retype it snapped the value to 0 mid-edit.
 *
 * An empty string is a legitimate mid-edit state and is kept. Saving one gets a
 * 422 naming the field, which is more useful than writing a 0 nobody asked for.
 */
function coerceConfigValue(type, value, checked) {
  if (type === 'checkbox') return checked;
  if (type !== 'number' || value === '') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  // Sub-tabs of the three grouped pages. Kept separate from `activeTab` so
  // leaving a page and coming back lands you where you were.
  const [todayTab, setTodayTab] = useState('morning');
  const [trainingTab, setTrainingTab] = useState('workouts');
  const [learningTab, setLearningTab] = useState('anki');
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
    supplementsList: DEFAULT_SUPPLEMENTS,
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

  // Drafts are stamped with the logical day they were written on, so a
  // half-finished log from yesterday does not come back this morning.
  const draftsEnabled = !editingDate;
  const [morningData, setMorningData, clearMorningDraft] = useDraft('morning', EMPTY_MORNING, { enabled: draftsEnabled });
  const [nightData, setNightData, clearNightDraft] = useDraft('night', EMPTY_NIGHT, { enabled: draftsEnabled });
  const [weeklyData, setWeeklyData, clearWeeklyDraft] = useDraft('weekly', emptyWeekly(), { enabled: draftsEnabled });

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
    setConfig(prev => ({ ...prev, [name]: coerceConfigValue(type, value, checked) }));
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

  /** Sends you to the page that owns a log window, and to the right tab on it. */
  const openWindow = (windowType) => {
    setActiveTab(WINDOW_TO_TAB[windowType] || windowType);
    if (WINDOW_TO_TAB[windowType] === 'today') setTodayTab(windowType);
  };

  const startEditingLog = (date, windowType) => {
    const entry = history.find(h => h.date === date);
    setEditingDate(date);

    if (windowType === 'morning') {
      setMorningData(entry?.morningData || EMPTY_MORNING);
      openWindow('morning');
    } else if (windowType === 'morningJournal') {
      setMorningData(prev => ({ ...prev, todos: entry?.morningJournalData?.todos || [], feeling: entry?.morningJournalData?.feeling || '' }));
      openWindow('morningJournal');
    } else if (windowType === 'night') {
      const suppList = config.supplementsList || DEFAULT_SUPPLEMENTS;

      if (entry?.nightData) {
        const loadedSupps = entry.nightData.supplements;
        let formattedSupps = suppMap(suppList);
        if (typeof loadedSupps === 'object' && loadedSupps !== null && !Array.isArray(loadedSupps)) {
          formattedSupps = { ...formattedSupps, ...loadedSupps };
        } else if (typeof loadedSupps === 'number') {
          formattedSupps = suppMap(suppList, loadedSupps === 10);
        }
        setNightData({ ...entry.nightData, supplements: formattedSupps });
      } else {
        setNightData({ ...EMPTY_NIGHT, supplements: suppMap(suppList) });
      }
      openWindow('night');
    } else if (windowType === 'nightJournal') {
      setNightData(prev => ({ ...prev, todosCompleted: entry?.nightJournalData?.todosCompleted || [], feeling: entry?.nightJournalData?.feeling || '', tomorrow: entry?.nightJournalData?.tomorrow || '' }));
      openWindow('nightJournal');
    } else if (windowType === 'weekly') {
      setWeeklyData(entry?.weeklyData ? {
        ...entry.weeklyData,
        photos: entry.weeklyData.photos || { front: '', back: '', sideLeft: '', sideRight: '' }
      } : { ...emptyWeekly(), weekCommencing: date });
      openWindow('weekly');
    }
  };

  const cancelEditing = () => {
    setEditingDate(null);
    const suppList = config.supplementsList || DEFAULT_SUPPLEMENTS;

    // Drops the edited entry out of state *and* out of storage, so cancelling
    // never leaves a past day's numbers sitting in today's draft.
    clearMorningDraft(EMPTY_MORNING);
    clearNightDraft({ ...EMPTY_NIGHT, supplements: suppMap(suppList) });
    clearWeeklyDraft(emptyWeekly());
    setActiveTab('history');
  };

  /**
   * Returns a human-readable reason the log can't be submitted yet, or null.
   * Split out so the same rules can drive both the submit guard and (later)
   * a disabled submit button, rather than only firing after a failed click.
   */
  const getSubmitBlocker = (windowType, data) => {
    if (windowType === 'morningJournal') return morningJournalBlocker(data);
    if (windowType === 'nightJournal') return nightJournalBlocker(data);

    if (windowType === 'night' && config.enforceSupplementsBlocker !== false) {
      const suppList = config.supplementsList || DEFAULT_SUPPLEMENTS;
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
      await api.submitLog({ window: windowType, data: dataToSubmit, date: editingDate });
      setSubmitSuccess(`${windowType.toUpperCase()} log ${editingDate ? 'updated' : 'submitted'} successfully!`);
      if (windowType === 'morning') {
        // Sliders keep their positions -- they are calibrated to you, not to today.
        setMorningData(prev => ({ ...prev, wakingWeight: '', sleepHours: '', restingHR: '', bloodPressure: '' }));
      } else if (windowType === 'morningJournal') {
        setMorningData(prev => ({ ...prev, todos: [], feeling: '' }));
      } else if (windowType === 'night') {
        clearNightDraft({ ...EMPTY_NIGHT, supplements: suppMap(config.supplementsList) });
      } else if (windowType === 'nightJournal') {
        setNightData(prev => ({ ...prev, todosCompleted: [], feeling: '', tomorrow: '' }));
      } else if (windowType === 'weekly') {
        clearWeeklyDraft(emptyWeekly());
      }
      setEditingDate(null);
      fetchStatus();
      fetchHistory();
      setTimeout(() => setSubmitSuccess(null), 3000);
      setActiveTab('history');
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

  const todayEntry = history.find(h => h.date === logicalToday());
  const morningTodos = (todayEntry?.morningJournalData?.todos || []).filter(t => t?.text?.trim());

  const stats = getStats();

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        ipInfo={ipInfo}
        triggerTestLock={triggerTestLock}
      />

      <SidebarInset>
        <SiteHeader activeTab={activeTab} status={status} />

        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <WarningBanner status={status} />

          {submitSuccess && (
            <Alert>
              <Check />
              <AlertTitle>{submitSuccess}</AlertTitle>
            </Alert>
          )}

          {offline && (
            <Alert>
              <WifiOff />
              <AlertTitle>Can&apos;t reach Habit Armour</AlertTitle>
              <AlertDescription>
                Everything below is the last state received. Check the server is running.
              </AlertDescription>
            </Alert>
          )}
          {formError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Couldn&apos;t submit</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {configError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Couldn&apos;t save settings</AlertTitle>
              <AlertDescription>{configError}</AlertDescription>
            </Alert>
          )}

          {activeTab === 'today' && (
            <Tabs value={todayTab} onValueChange={setTodayTab} className="gap-6">
              <TabsList>
                {TODAY_TABS.map(({ id, label }) => (
                  <TabsTrigger key={id} value={id}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="morning">
                <MorningForm
                  morningData={morningData}
                  setMorningData={setMorningData}
                  editingDate={editingDate}
                  cancelEditing={cancelEditing}
                  onSubmit={(e) => handleFormSubmit(e, 'morning')}
                />
              </TabsContent>

              <TabsContent value="morningJournal">
                <MorningJournalForm
                  morningData={morningData}
                  setMorningData={setMorningData}
                  editingDate={editingDate}
                  cancelEditing={cancelEditing}
                  onSubmit={(e) => handleFormSubmit(e, 'morningJournal')}
                />
              </TabsContent>

              <TabsContent value="night">
                <NightForm
                  nightData={nightData}
                  setNightData={setNightData}
                  supplementsList={config.supplementsList || DEFAULT_SUPPLEMENTS}
                  enforceBlocker={config.enforceSupplementsBlocker !== false}
                  enforceProteinShakeBlocker={config.enforceProteinShakeBlocker !== false}
                  editingDate={editingDate}
                  cancelEditing={cancelEditing}
                  onSubmit={(e) => handleFormSubmit(e, 'night')}
                />
              </TabsContent>

              <TabsContent value="nightJournal">
                <NightJournalForm
                  nightData={nightData}
                  setNightData={setNightData}
                  status={status}
                  morningTodos={morningTodos}
                  editingDate={editingDate}
                  cancelEditing={cancelEditing}
                  onSubmit={(e) => handleFormSubmit(e, 'nightJournal')}
                />
              </TabsContent>
            </Tabs>
          )}

          {activeTab === 'weekly' && (
            <WeeklyForm
              weeklyData={weeklyData}
              setWeeklyData={setWeeklyData}
              photosRequired={config.weeklyPhotosRequired !== false}
              editingDate={editingDate}
              cancelEditing={cancelEditing}
              onSubmit={(e) => handleFormSubmit(e, 'weekly')}
            />
          )}

          {activeTab === 'training' && (
            <Tabs value={trainingTab} onValueChange={setTrainingTab} className="gap-6">
              <TabsList>
                <TabsTrigger value="workouts">Workouts</TabsTrigger>
                <TabsTrigger value="verification">Verification</TabsTrigger>
              </TabsList>

              <TabsContent value="workouts">
                <HevyView
                  hevyStatus={hevyStatus}
                  hevyWorkouts={hevyWorkouts}
                  workoutsLoading={workoutsLoading}
                  workoutsError={workoutsError}
                  fetchHevyWorkouts={fetchHevyWorkouts}
                />
              </TabsContent>

              <TabsContent value="verification">
                <GymView
                  status={status}
                  config={config}
                  gymVerifyLoading={gymVerifyLoading}
                  gymVerifyResult={gymVerifyResult}
                  gymVerifyError={gymVerifyError}
                  handleVerifyGymWorkout={handleVerifyGymWorkout}
                />
              </TabsContent>
            </Tabs>
          )}

          {activeTab === 'learning' && (
            <Tabs value={learningTab} onValueChange={setLearningTab} className="gap-6">
              <TabsList>
                <TabsTrigger value="anki">Anki</TabsTrigger>
                <TabsTrigger value="practice">Practice</TabsTrigger>
              </TabsList>

              <TabsContent value="anki">
                <AnkiView onRefreshStatus={fetchStatus} />
              </TabsContent>

              <TabsContent value="practice">
                <PracticeView onRefreshStatus={fetchStatus} />
              </TabsContent>
            </Tabs>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView stats={stats} history={history} config={config} />
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              config={config}
              API_URL={API_URL}
              startEditingLog={startEditingLog}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              config={config}
              handleConfigChange={handleConfigChange}
              saveConfig={saveConfig}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
