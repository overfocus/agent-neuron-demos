#!/usr/bin/env node
// Compile one recorded companies run into the video's frozen dataset.
//
//   node build-data-companies.mjs <runDir>          → data-companies.js
//
// The run dir holds the run's own records (both takes):
//   companies.network.json / pilot.network.json  the tracked house rules (topology)
//   peers.ours.json / peers.pilot.json           the run's own deployment record
//   wire/stream.jsonl                            take 1: across the boundaries
//   house/stream.jsonl                           take 2: no peers file, in-house
//   wire|house/stderr.log                        the desk lines: who chose what, why
//   wire/journal.log, wire|house/actions.log     our ledger and the clearances
//   chart-room.log, pilot-desk.log, pilot-office.log  the partners' own stderr (ports)
//
// Timeline: the take is re-stamped so the story reads in order. Every event
// keeps its own sequence; the ARR-2 chain (which really overlapped ARR-1's
// settle) shifts as one group to after ARR-1's act, and the house take is
// re-based onto the same axis after take 1 ends. Nothing else is touched, and
// the committed dataset is what every render plays. One interpolation, marked
// where it is used: the wrapper's inner stations (triage, chart, board) are
// spread around their composed answer - the driver hears only the marks, and
// the composition says so on screen.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const readLines = (f) => {
  try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
};
const textOf = (p) => (p ? (p.type === 'text' ? p.text : JSON.stringify(p.data ?? '')) : '');

function fromRun(dir) {
  const net = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'demos', 'companies', 'companies.network.json'), 'utf8'));
  const stream = readLines(path.join(dir, 'wire', 'stream.jsonl'));
  const house = readLines(path.join(dir, 'house', 'stream.jsonl'));

  // the deployment the run actually used: who is on which port
  const peers = ['chart-room', 'pilot-desk', 'pilot-office'].map((file) => {
    const raw = fs.readFileSync(path.join(dir, `${file}.log`), 'utf8');
    const m = raw.match(/peer (\S+): listening on 127\.0\.0\.1:(\d+)/);
    return { file, name: m?.[1] ?? file, port: Number(m?.[2] ?? 0) };
  });

  // traces: one per arrival, keyed by the vessel the injection carried
  const traces = new Map(); // trace id -> { vessel, tIn }
  for (const e of stream) {
    if (e.type === 'signal' && e.from === 'arrival') {
      traces.set(e.trace, { vessel: e.payload?.data?.vessel ?? '', info: e.payload?.data ?? {}, tIn: e.t });
    }
  }
  const vesselOf = (e) => traces.get(e.trace)?.vessel ?? '';

  const station = (s, t, extra = {}) => ({ s, t, ...extra });
  const items = []; // one per arrival, in take 1's own (re-stamped) time
  const byTrace = [...traces.entries()].map(([trace, t]) => ({ trace, vessel: t.vessel, info: t.info, tIn: t.tIn }));
  byTrace.sort((a, b) => a.tIn - b.tIn);

  // take 1's own beats, before any re-stamping
  const ev = (pred) => stream.filter(pred);
  const first = (pred) => ev(pred)[0];
  const arr1 = byTrace[0], arr2 = byTrace[1];
  const engAnswer = (tr) => first((e) => e.type === 'answer' && e.from === 'engage' && e.trace === tr);
  const pilotAnswer = (tr) => first((e) => e.type === 'answer' && e.from === 'pilotage' && e.trace === tr);
  const gateAnswer = (tr) => first((e) => e.type === 'answer' && e.from === 'gate' && e.trace === tr);
  const actAnswer = (tr) => first((e) => e.type === 'answer' && e.from === 'act' && e.trace === tr);
  const fileAnswer = (tr) => first((e) => e.type === 'answer' && e.from === 'file' && e.trace === tr);
  const fanout = (tr) => first((e) => e.type === 'signal' && (e.to ?? []).includes('engage') && e.trace === tr);
  const unknownE = first((e) => e.type === 'unknown');

  // ARR-1 keeps the run's clock. ARR-2's whole chain shifts as one group so
  // the story reads after ARR-1 settles (it really overlapped: the run had
  // ARR-2 arriving at 5.0 s and act settling at 7.0 s).
  const act1T = actAnswer(arr1?.trace)?.t ?? gateAnswer(arr1?.trace)?.t ?? 6000;
  const delta = act1T + 1400 - (arr2?.tIn ?? 0);
  const shift = (e) => (e && e.trace === arr2?.trace ? e.t + delta : e?.t ?? 0);

  // the desk's record: who chose what and why, timed by the gate's own reply
  const stderr = fs.readFileSync(path.join(dir, 'wire', 'stderr.log'), 'utf8');
  const desk = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^desk answer: ({.*})/);
    if (!m) continue;
    let a; try { a = JSON.parse(m[1]); } catch { continue; }
    const tr = byTrace.find((t) => textOf(gateAnswer(t.trace)?.payload) === a.text)?.trace;
    desk.push({ vessel: a.text?.match(/ARR-\d/)?.[0] ?? '', who: a.by, option: a.option, why: a.why ?? '', text: a.text ?? '', t: shift(gateAnswer(tr)) || undefined });
  }
  desk.sort((x, y) => (x.t ?? 9e9) - (y.t ?? 9e9));

  // items: the stations each arrival reached, re-stamped
  const buildItem = (tr) => {
    const t = (e) => (e ? shift(e) : undefined);
    const st = [];
    const arr = ev((e) => e.type === 'signal' && e.from === 'arrival' && e.trace === tr)[0];
    if (!arr) return null;
    st.push(station('arrival', t(arr)));
    const cls = first((e) => e.type === 'answer' && e.from === 'classify' && e.trace === tr);
    if (cls) st.push(station('classify', t(cls)));
    const fan = fanout(tr);
    if (fan) for (const to of (fan.to ?? [])) st.push(station(to, t(fan)));
    const file = fileAnswer(tr);
    if (file) st.push(station('file', t(file), { tick: true }));
    const eng = engAnswer(tr);
    if (eng) st.push(station('engage', t(eng), { engaged: true }));
    else st.push(station('engage', t(unknownE), { unknown: true }));
    // the wrapper's inside: their triage, the chart room, the boarding call.
    // The driver hears them as the composed answer's marks: three beats inside
    // the piece. The pilot office's run answers once; its marks ride the
    // payload. Station times come from the events the driver itself reports.
    const pilot = pilotAnswer(tr);
    if (pilot) {
      const d = pilot.payload?.data ?? {};
      const inner = [station('triage', t(pilot) - 2600), station('chart', t(pilot) - 1700), station('board', t(pilot) - 800, { boarded: true })];
      st.push(...inner);
      st.push(station('pilotage', t(pilot), { marks: ['office' in d ? d.office : '', d.room, d.boarded ? 'boarded' : ''].filter(Boolean) }));
    }
    const gAsk = first((e) => e.type === 'signal' && e.from === 'pilotage' && (e.to ?? []).includes('gate') && e.trace === tr);
    if (gAsk) st.push(station('gate', t(gAsk), { ask: true }));
    const gAn = gateAnswer(tr);
    if (gAn) st.push(station('gate', t(gAn), { chose: textOf(gAn.payload).startsWith('clear') ? 'clear' : 'hold' }));
    const act = actAnswer(tr);
    if (act) st.push(station('act', t(act), { cleared: textOf(act.payload) }));
    const quiet = first((e) => e.type === 'quiet' && e.from === 'act' && e.trace === tr);
    if (quiet) st.push(station('act', t(quiet), { quiet: true }));
    return { vessel: traces.get(tr).vessel, info: traces.get(tr).info, tIn: t(arr), stations: st };
  };

  const items1 = byTrace.map((t) => buildItem(t.trace)).filter(Boolean);

  // the unknown, re-stamped like the rest of the ARR-2 chain
  const unknown = { vessel: 'ARR-2', t: shift(unknownE), message: unknownE?.message ?? '', code: unknownE?.code ?? '' };

  // take 2 re-based onto the same axis, after take 1 ends
  const wireEnd = Math.max(...stream.map((e) => shift(e)));
  const base = wireEnd + 1200;
  const hb0 = house.find((e) => e.type === 'signal' && e.from === 'arrival')?.t ?? 0;
  const hshift = (e) => (e.t ?? 0) - hb0 + base;
  const houseTraces = new Map();
  for (const e of house) if (e.type === 'signal' && e.from === 'arrival') houseTraces.set(e.trace, e.payload?.data?.vessel ?? '');
  const houseItems = [...houseTraces.entries()].map(([tr, vessel]) => {
    const st = [];
    const arr = house.find((e) => e.type === 'signal' && e.from === 'arrival' && e.trace === tr);
    st.push(station('arrival', hshift(arr)));
    const cls = house.find((e) => e.type === 'answer' && e.from === 'classify' && e.trace === tr);
    if (cls) st.push(station('classify', hshift(cls)));
    const fan = house.find((e) => e.type === 'signal' && (e.to ?? []).includes('engage') && e.trace === tr);
    if (fan) for (const to of (fan.to ?? [])) st.push(station(to, hshift(fan)));
    const pilot = house.find((e) => e.type === 'answer' && e.from === 'pilotage' && e.trace === tr);
    if (pilot) {
      st.push(station('triage', hshift(pilot) - 2600), station('chart', hshift(pilot) - 1700), station('board', hshift(pilot) - 800));
      st.push(station('pilotage', hshift(pilot)));
    }
    const gAsk = house.find((e) => e.type === 'signal' && e.from === 'pilotage' && (e.to ?? []).includes('gate') && e.trace === tr);
    if (gAsk) st.push(station('gate', hshift(gAsk), { ask: true }));
    const gAn = house.find((e) => e.type === 'answer' && e.from === 'gate' && e.trace === tr);
    if (gAn) st.push(station('gate', hshift(gAn), { chose: textOf(gAn.payload).startsWith('clear') ? 'clear' : 'hold' }));
    const act = house.find((e) => e.type === 'answer' && e.from === 'act' && e.trace === tr);
    if (act) st.push(station('act', hshift(act), { cleared: textOf(act.payload) }));
    return { vessel, info: arr?.payload?.data ?? {}, tIn: hshift(arr), stations: st };
  });
  const hstderr = fs.readFileSync(path.join(dir, 'house', 'stderr.log'), 'utf8');
  const houseDesk = [];
  for (const line of hstderr.split('\n')) {
    const m = line.match(/^desk answer: ({.*})/);
    if (!m) continue;
    let a; try { a = JSON.parse(m[1]); } catch { continue; }
    const vessel = a.text?.match(/ARR-\d/)?.[0] ?? '';
    const tr = [...houseTraces.entries()].find(([tr, v]) => v === vessel)?.[0];
    const gAn = house.find((e) => e.type === 'answer' && e.from === 'gate' && tr !== undefined && e.trace === tr);
    houseDesk.push({ vessel, who: a.by, option: a.option, why: a.why ?? '', text: a.text ?? '', t: gAn ? hshift(gAn) : undefined });
  }
  houseDesk.sort((x, y) => (x.t ?? 9e9) - (y.t ?? 9e9));

  const wireActions = fs.readFileSync(path.join(dir, 'wire', 'actions.log'), 'utf8').trim().split('\n').filter(Boolean);
  const houseActions = fs.readFileSync(path.join(dir, 'house', 'actions.log'), 'utf8').trim().split('\n').filter(Boolean);
  const journal = fs.readFileSync(path.join(dir, 'wire', 'journal.log'), 'utf8').trim().split('\n').filter(Boolean);

  // beats on the re-stamped axis (what the pieces and sound walk)
  const B = {
    fanoutT: shift(fanout(arr1?.trace)), hireT: engAnswer(arr1?.trace)?.t, composedT: pilotAnswer(arr1?.trace)?.t,
    clearT: gateAnswer(arr1?.trace)?.t, actT: actAnswer(arr1?.trace)?.t,
    arr2T: shift(first((e) => e.type === 'signal' && e.from === 'arrival' && e.trace === arr2?.trace)),
    fanout2T: shift(fanout(arr2?.trace)), unknownT: shift(unknownE), answer2T: pilotAnswer(arr2?.trace) ? shift(pilotAnswer(arr2?.trace)) : undefined,
    holdT: gateAnswer(arr2?.trace) ? shift(gateAnswer(arr2?.trace)) : undefined,
    wireEnd, houseStart: base, houseEnd: Math.max(...house.map((e) => hshift(e))),
  };

  const seconds = Math.ceil((B.houseEnd) / 1000) + 1;
  const marks = (pilotAnswer(arr1?.trace)?.payload?.data ?? {});
  const facts = {
    engines: [{ label: 'the quay office', port: null, hosts: 'the run' },
              ...peers.map((p) => ({ label: { 'chart-room': 'the chart room', 'pilot-desk': "the pilot office's dispatch desk", 'pilot-office': 'the pilot office' }[p.file], port: p.port, name: p.name }))],
    companies: 3, boundaries: 2, arrivals: items1.length,
    clearWire: wireActions.length, clearHouse: houseActions.length, filed: journal.length,
    unknowns: stream.filter((e) => e.type === 'unknown').length,
    marks: [marks.office, marks.room, marks.boarded ? 'boarded' : ''].filter(Boolean),
    composed: textOf(pilotAnswer(arr1?.trace)?.payload),
    holdWhy: desk.find((d) => d.option === 'hold')?.why ?? '',
    clearWhy: desk.find((d) => d.option === 'clear')?.why ?? '',
    unknownMessage: unknown.message,
    netName: net.name,
  };
  return {
    version: 1, fps: 60, seconds, wireEnd, peers: peers.map((p) => ({ name: p.name, port: p.port })),
    items: items1, desk, unknown, house: { items: houseItems, desk: houseDesk },
    beats: B, facts,
  };
}

const args = process.argv.slice(2);
const data = fromRun(args[0]);
const file = path.join(HERE, 'data-companies.js');
fs.writeFileSync(file, `window.COMPANIES = ${JSON.stringify(data)};\n`);
console.log(`${file}: ${data.facts.arrivals} arrivals, ${data.facts.clearWire}+${data.facts.clearHouse} clearances, ${data.facts.unknowns} unknown, ${data.facts.filed} filed, run ${data.seconds} s on the merged axis`);
