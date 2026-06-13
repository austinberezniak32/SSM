// Thin fetch wrapper. A 401 anywhere kicks the user back to the login screen.
const authListeners = [];
export function whenAuthRequired(fn) { authListeners.push(fn); }

async function request(method, url, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (res.status === 401 && url !== '/api/login') {
    authListeners.forEach(fn => fn());
    throw new Error('Login required');
  }
  let data = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    data = await res.json();
  }
  if (!res.ok) throw new Error((data && data.error) || res.statusText || 'Request failed');
  return data;
}

export const api = {
  get: url => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body ?? {}),
  del: url => request('DELETE', url),
};
