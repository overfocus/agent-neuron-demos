// A client for the engine's desk (agent-neuron decision 0008 and 0010): the
// same two calls the page makes, GET /state and POST /answer, with the
// person's own token. One Connection-close request per call: the desk closes
// with the run, and a pooled socket would outlive it.
import http from 'node:http';

/** `{port, token}` from a desk URL `http://127.0.0.1:<port>/?token=<hex>`. */
export function seat(url) {
  const u = new URL(url);
  return { port: Number(u.port), token: u.searchParams.get('token') ?? '', url };
}

function call(seat, method, route, body) {
  return new Promise((resolve, reject) => {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: seat.port,
        path: route,
        method,
        headers: {
          host: `127.0.0.1:${seat.port}`,
          'x-desk-token': seat.token,
          connection: 'close',
          ...(text !== undefined && {
            origin: `http://127.0.0.1:${seat.port}`,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(text),
          }),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            // a plain-text refusal
          }
          resolve({ status: res.statusCode ?? 0, json, raw });
        });
      },
    );
    req.on('error', reject);
    if (text !== undefined) req.write(text);
    req.end();
  });
}

/** The desk as this seat sees it, or null once the desk has closed. */
export async function state(seat) {
  try {
    const r = await call(seat, 'GET', '/state');
    return r.status === 200 ? r.json : null;
  } catch {
    return null;
  }
}

/** One answer: `{item, kind, text?, option?, why?}`. Resolves to {status, json}. */
export function answer(seat, body) {
  return call(seat, 'POST', '/answer', body);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until this seat has a waiting item of its own that `pred` accepts,
 * and return it; null if the desk closes first or `ms` passes.
 */
export async function nextItem(seat, pred = () => true, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const s = await state(seat);
    if (!s || s.over) return null;
    const it = s.items.find((i) => i.status === 'waiting' && i.yours && pred(i));
    if (it) return it;
    await sleep(80);
  }
  return null;
}
