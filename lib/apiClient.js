// Small fetch wrapper for talking to our own /api routes.
// - Always sends/receives JSON.
// - Always includes credentials so the httpOnly session cookie is sent.
// - Throws an Error whose `message` is the server's `{ error }` string on
//   any non-2xx response, so callers can just try/catch and show it.

const BASE_PATH = '/api';

async function request(path, options = {}) {
  const { method = 'GET', body, headers, ...rest } = options;

  const init = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...rest,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_PATH}${path}`, init);
  } catch (err) {
    // Network-level failure (server down, etc.)
    throw new Error('Unable to reach the server. Please try again.');
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (isJson) {
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch (_) {
        // ignore parse errors, fall back to generic message
      }
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  if (isJson) return res.json();
  return res;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  // Returns the raw Response — useful for file downloads (export).
  raw: (path, options) => fetch(`${BASE_PATH}${path}`, { credentials: 'include', ...options }),
};

export default apiClient;
