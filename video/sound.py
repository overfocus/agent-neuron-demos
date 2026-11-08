#!/usr/bin/env python3
"""Mix the colony's soundtrack: the chosen music under scene-declared cues.

sound-events.json (written by render.py from the composition) says when every
scene wants a sound: kind, time, gain and any parameter (a distance in ms, a
name). The event effects are synthesized with numpy — sine waves, filtered
noise, envelopes, no samples. The music bed is Kevin's track, decoded with
ffmpeg, trimmed/looped to the cut and normalized; cues land on the picture
because the composition itself computed their times.

  ./.venv/bin/python sound.py
"""
import json
import pathlib
import subprocess
import wave

import numpy as np

HERE = pathlib.Path(__file__).parent
SR = 48000
EVENTS = HERE / "sound-events.json"
OUT = HERE / "soundtrack.wav"
MUSIC = pathlib.Path.home() / "Downloads" / "monume-techno-603966.mp3"


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


def music(length: float) -> np.ndarray:
    """The track: decode with ffmpeg to float32 stereo, trim or loop, normalize."""
    n = int(SR * length)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(MUSIC), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype="<f4").reshape(-1, 2)
    if len(x) * 2 < n * 1:                       # loop if the cut is longer than the track
        reps = int(np.ceil(n / len(x)))
        x = np.tile(x, (reps, 1))
    x = x[:n].astype(np.float64)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 0.78
    fade_in = np.linspace(0, 1, int(0.3 * SR))[:, None]
    x[: len(fade_in)] *= fade_in
    fade_out = np.linspace(1, 0, int(2.2 * SR))[:, None] ** 1.5
    x[-len(fade_out):] *= fade_out
    return x


def has_music() -> bool:
    return MUSIC.exists()


def chord(*sigs):
    """Sum instruments of different lengths, zero-padded to the longest."""
    n = max(len(s) for s in sigs)
    out = np.zeros(n)
    for s in sigs:
        out[: len(s)] += s
    return out


INSTRUMENTS = {
    # kind -> (gain scale, seconds, synth(track gain, param) -> float64)
    "type":   lambda g, p: sine(2400, 0.045, 0.001, 0.03) * 0.10 * g,
    "pop":    lambda g, p: sine(1320, 0.09, 0.002, 0.06) * 0.16 * g,
    "tick":   lambda g, p: sine(1000, 0.035, 0.001, 0.03) * 0.08 * g,
    "whoosh": lambda g, p: sweep_noise(0.22, 1500 / 1, 320, 0.006, 0.16) * (0.20 * min(1.6, 500 / max(240, p or 400))) * g,
    "thud":   lambda g, p: chord(sine(64, 0.5, 0.002, 0.45) * 0.5, noise(0.3, 60, 200, 0.002, 0.3) * 0.2) * 0.85 * g,
    "blip":   lambda g, p: sine(1560, 0.07, 0.002, 0.05) * 0.13 * g,
    "drop":   lambda g, p: chord(sine(880, 1.1, 0.003, 0.5) * 0.22, sine(1320, 1.1, 0.004, 0.65) * 0.16) * g,
    "settle": lambda g, p: chord(sine(220, 3.2, 1.1, 1.4) * 0.16, sine(330, 3.0, 1.3, 1.4) * 0.12,
                                 sine(440, 2.8, 1.5, 1.4) * 0.09, sine(554, 2.6, 1.5, 1.3) * 0.06) * g,
    "stamp":  lambda g, p: chord(sine(110, 1.9, 0.002, 0.9) * 0.4, sine(220, 1.2, 0.3, 0.9) * 0.16,
                                 noise(0.9, 2000, 8000, 0.005, 0.5) * 0.02) * g,
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
    use_music = has_music()
    if use_music:
        mix = music(total)
        print(f"music: {MUSIC.name} under {total:.1f} s of cues")
    else:
        mix = np.zeros((int(SR * total), 2))       # the burrow: filtered noise
        x = np.random.default_rng(1).standard_normal(len(mix))
        keep = np.exp(-2 * np.pi * 220 / SR)
        y = 0.0
        for i in range(len(mix)):
            y = keep * y + (1 - keep) * x[i]
            mix[i, 0] = mix[i, 1] = y * 0.05 * (0.8 + 0.2 * np.sin(2 * np.pi * i / SR * 0.07))
        print(f"soundtrack: {total:.1f} s, {len(events)} cues (no music file: synthesized bed)")
    cue_gain = 0.8 if use_music else 1.0
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
        sig2 = np.repeat(sig[:, None], 2, axis=1) * cue_gain
        mix[at:end] += sig2[: end - at]
    peak = np.max(np.abs(mix)) or 1.0
    if peak > 0.98:
        mix = mix / peak * 0.98
    stereo = mix
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
