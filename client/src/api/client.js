/**
 * The single place that knows how to reach the Habit Armour API.
 *
 * Two problems this replaces:
 *
 *  1. Three different base URLs. App.jsx resolved it correctly, but
 *     WeeklyForm.jsx and HevyView.jsx hardcoded `http://localhost:3000`, so
 *     photo upload and the Hevy view were broken for any client that wasn't
 *     the Mac itself -- exactly the iPhone/LAN case HOST=0.0.0.0 exists for.
 *
 *  2. `fetch` does not throw on 4xx/5xx. Most call sites checked `res.ok` and
 *     a few didn't, so a rejected request looked identical to a successful one
 *     and the form just sat there. Everything here throws ApiError instead.
 */

const VITE_BASE = import.meta.env.VITE_API_URL;

/**
 * Vite's dev server runs on 5173 and proxies nothing, so it needs an absolute
 * URL to port 3000. Everywhere else -- deployed, or opened from a phone over
 * the LAN -- the API is same-origin, and window.location.origin is the only
 * answer that works off-host.
 */
export function resolveBaseUrl() {
  if (VITE_BASE) return VITE_BASE;
  if (typeof window === 'undefined') return '';
  return window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(message, { status, detail, path } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.path = path;
  }

  /** True when the server was unreachable rather than returning an error. */
  get isOffline() {
    return this.status === 0;
  }
}

/**
 * FastAPI's `detail` is a string for HTTPException, a list of
 * {loc, msg} objects for Pydantic validation errors, and a plain object for
 * the shape POST /api/config returns. Flatten all three into one line.
 */
function formatDetail(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body').join('.') : null;
        return field ? `${field}: ${d.msg}` : d?.msg;
      })
      .filter(Boolean);
    return parts.length ? parts.join('; ') : fallback;
  }

  if (typeof detail === 'object') {
    if (detail.fields && typeof detail.fields === 'object') {
      const fields = Object.entries(detail.fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      return detail.message ? `${detail.message} -- ${fields}` : fields;
    }
    if (detail.message) return detail.message;
  }

  return fallback;
}

async function request(path, { method = 'GET', body, signal, ...rest } = {}) {
  const url = `${API_URL}${path}`;
  let res;

  try {
    res = await fetch(url, {
      method,
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });
  } catch (cause) {
    // Network-level failure: server down, wrong host, DNS. Distinguished from
    // an HTTP error so the UI can say "can't reach the server" specifically.
    throw new ApiError("Can't reach Habit Armour. Is the server running?", {
      status: 0,
      detail: cause?.message,
      path,
    });
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(formatDetail(payload?.detail, `Request failed (HTTP ${res.status})`), {
      status: res.status,
      detail: payload?.detail,
      path,
    });
  }

  return payload;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = (path) => request(path, { method: 'DELETE' });

export const api = {
  request,

  getStatus: () => get('/api/status'),
  getIp: () => get('/api/ip'),
  getHistory: () => get('/api/history'),
  getConfig: () => get('/api/config'),
  saveConfig: (config) => post('/api/config', config),
  triggerTestLock: () => post('/api/test-lock'),
  submitLog: ({ window: win, data, date }) => post('/api/submit', { window: win, data, date }),
  uploadPhoto: ({ date, pose, dataUrl }) => post('/api/upload-photo', { date, pose, dataUrl }),

  anki: {
    status: () => get('/api/anki/status'),
    verify: () => post('/api/anki/verify'),
    override: (reason) => post('/api/anki/override', { reason }),
    resetOverride: () => post('/api/anki/reset-override'),
  },

  hevy: {
    status: () => get('/api/hevy/status'),
    workouts: () => get('/api/hevy/workouts'),
    templates: () => get('/api/hevy/templates'),
    uploadWorkout: (payload) => post('/api/hevy/upload-workout', payload),
    verifyToday: () => post('/api/hevy/verify-today'),
    override: () => post('/api/hevy/override', {}),
  },

  practice: {
    items: () => get('/api/practice/items'),
    createItem: (payload) => post('/api/practice/items', payload),
    updateItem: (id, payload) => put(`/api/practice/items/${id}`, payload),
    deleteItem: (id) => del(`/api/practice/items/${id}`),
    questions: (itemId) =>
      get(`/api/practice/questions${itemId ? `?itemId=${encodeURIComponent(itemId)}` : ''}`),
    createQuestion: (payload) => post('/api/practice/questions', payload),
    updateQuestion: (id, payload) => put(`/api/practice/questions/${id}`, payload),
    deleteQuestion: (id) => del(`/api/practice/questions/${id}`),
    due: () => get('/api/practice/due'),
    status: () => get('/api/practice/status'),
    performance: () => get('/api/practice/performance'),
    attempts: ({ itemId, questionId, limit } = {}) => {
      const params = new URLSearchParams();
      if (itemId) params.set('itemId', itemId);
      if (questionId) params.set('questionId', questionId);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return get(`/api/practice/attempts${qs ? `?${qs}` : ''}`);
    },
    submitAttempt: (payload) => post('/api/practice/attempts', payload),
    modelSolution: (id) => post(`/api/practice/questions/${id}/model-solution`),
    uploadImage: (payload) => post('/api/practice/upload-image', payload),
    override: (reason) => post('/api/practice/override', { reason }),
    resetOverride: () => post('/api/practice/reset-override'),
  },
};

export default api;
