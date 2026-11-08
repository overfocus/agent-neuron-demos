#!/usr/bin/env python3
"""Synthesize the colony's soundtrack from math — no samples, no stock audio.

sound-events.json (written by render.py from the composition) says when every
scene wants a sound: kind, time, gain and any parameter (a distance in ms, a
name). Each kind is a small numpy instrument; everything sums into
soundtrack.wav, which render.py --mux hands to ffmpeg.

  ./.venv/bin/python sound.py
"""
import json
import pathlib
import wave

import numpy as np

HERE = pathlib.Path(__file__).parent
SR = 48000
EVENTS = HERE / "sound-events.json"
OUT = HERE / "soundtrack.wav"


def t_axis(dur: float) -> np.ndarray:
    n = int(SR * dur)
    return np.arange(n) / SR


def env(n: int, attack: float, decay: float) -> np.ndarray:
    """Attack (seconds) to 1, then exponential decay over the rest."""
    a = max(1, int(attack * SR))
    out = np.ones(n)
    out[:a] = np.linspace(0, 1, a)
    tail = t_axis((n - a) / SR) if n > a else np.zeros(0)
    out[a:] = np.exp(-tail * (6.28 / max(decay, 1e-3)))
    return out


def sine(freq: float, dur: float, attack=0.004, decay=0.12) -> np.ndarray:
    return np.sin(2 * np.pi * freq * t_axis(dur)) * env(int(SR * dur), attack, decay)


def noise(dur: float, lo: float, hi: float, attack=0.01, decay=0.25) -> np.ndarray:
    """Bandpassed white noise: filtered once in the FFT, so no ringing surprises."""
    n = int(SR * dur)
    x = np.random.default_rng(0).standard_normal(n)
    spectrum = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    band = (freqs >= lo) & (freqs <= hi)
    spectrum[~band] = 0
    return np.fft.irfft(spectrum, n) * env(n, attack, decay) * 0.35


def sweep_noise(dur: float, f0: float, f1: float, attack=0.008, decay=0.2) -> np.ndarray:
    """Noise through a moving one-pole lowpass: the swish of the swarm."""
    n = int(SR * dur)
    x = np.random.default_rng(0).standard_normal(n)
    out = np.zeros(n)
    y = 0.0
    fs = np.geomspace(f0, f1, n)
    keep = np.exp(-2 * np.pi * fs / SR)
    for i in range(n):
        y = keep[i] * y + (1 - keep[i]) * x[i]
        out[i] = y
    return out * env(n, attack, decay) * 1.2


def bed(length: float) -> np.ndarray:
    """The burrow: low filtered noise + a slow-breathing floor."""
    n = int(SR * length)
    x = np.random.default_rng(1).standard_normal(n)
    y = np.zeros(n)
    keep = np.exp(-2 * np.pi * 220 / SR)
    for i in range(n):
        y = keep * y + (1 - keep) * x[i]
    lfo = 0.8 + 0.2 * np.sin(2 * np.pi * t_axis(length) * 0.07)
    return y * 0.05 * lfo


INSTRUMENTS = {
    # kind -> (gain scale, seconds, synth(track gain, param) -> float64)
    "type":   lambda g, p: sine(2400, 0.045, 0.001, 0.03) * 0.10 * g,
    "pop":    lambda g, p: sine(1320, 0.09, 0.002, 0.06) * 0.16 * g,
    "tick":   lambda g, p: sine(1000, 0.035, 0.001, 0.03) * 0.08 * g,
    "whoosh": lambda g, p: sweep_noise(0.22, 1500 / 1, 320, 0.006, 0.16) * (0.20 * min(1.6, 500 / max(240, p or 400))) * g,
    "thud":   lambda g, p: (sine(64, 0.5, 0.002, 0.45) * 0.5 + noise(0.3, 60, 200, 0.002, 0.3) * 0.2) * 0.85 * g,
    "blip":   lambda g, p: sine(1560, 0.07, 0.002, 0.05) * 0.13 * g,
    "drop":   lambda g, p: (sine(880, 1.1, 0.003, 0.5) * 0.22 + sine(1320, 1.1, 0.004, 0.65) * 0.16) * g,
    "settle": lambda g, p: (sine(220, 3.2, 1.1, 1.4) * 0.16 + sine(330, 3.0, 1.3, 1.4) * 0.12
                            + sine(440, 2.8, 1.5, 1.4) * 0.09 + sine(554, 2.6, 1.5, 1.3) * 0.06) * g,
    "stamp":  lambda g, p: (sine(110, 1.9, 0.002, 0.9) * 0.4 + sine(220, 1.2, 0.3, 0.9) * 0.16
                            + noise(0.9, 2000, 8000, 0.005, 0.5) * 0.02) * g,
}


def main() -> int:
    total = 0.0
    events = json.loads(EVENTS.read_text()) if EVENTS.exists() else [
        {"t": 0.0, "kind": "bed", "gain": 1, "param": 46.4},
    ]
    for e in events:
        if e["kind"] == "bed":
            total = max(total, float(e["param"]) or 46.4)
        total = max(total, float(e["t"]) + 4.0)
    mix = bed(total)
    print(f"soundtrack: {total:.1f} s, {len(events)} cues")
    for e in events:
        kind, gain, param = e["kind"], float(e.get("gain", 1)), e.get("param")
        if kind == "bed":
            continue
        make = INSTRUMENTS.get(kind)
        if not make:
            continue
        sig = make(gain, param)
        at = int(float(e["t"]) * SR)
        n = len(sig)
        if at >= len(mix):
            continue
        end = min(len(mix), at + n)
        mix[at:end] += sig[: end - at]
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.94
    stereo = np.repeat(mix[:, None], 2, axis=1)
    pcm = (stereo * 32767).astype("<i2")
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"soundtrack: {OUT.name} (peak {peak:.3f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
