/* Lightweight notification sounds via Web Audio API — no asset files needed. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => { /* ignore */ });
  return ctx;
}

function tone(freq: number, durationMs: number, startDelayMs = 0, type: OscillatorType = "sine", gain = 0.12) {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime + startDelayMs / 1000;
  const dur = durationMs / 1000;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function playReady() {
  tone(880, 90);
  tone(1320, 120, 80);
}
export function playError() {
  tone(330, 150, 0, "square", 0.08);
  tone(220, 200, 120, "square", 0.08);
}
export function playSend() {
  tone(660, 50, 0, "sine", 0.06);
}

/** Tab arka plandayken browser notification gönderir. */
export async function notifyReady(title: string, body?: string) {
  if (typeof window === "undefined") return;
  if (document.visibilityState === "visible") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
  }
  try {
    new Notification(title, {
      body,
      icon: "/icon",
      tag: "craftai-ready",
    });
  } catch { /* yok say */ }
}
