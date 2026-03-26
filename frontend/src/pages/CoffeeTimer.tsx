import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, Trash2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useTheme } from '../hooks/useTheme';

const WORK_DURATION = 30 * 60;
const BREAK_DURATION = 5 * 60;
const TIMER_STATE_KEY = 'coffee-timer-state';

type Phase = 'idle' | 'working' | 'break';

interface Session {
  id: string;
  label: string;
  completedAt: string;
  durationMins: number;
}

// Persisted timer state — uses absolute timestamps so it's accurate across
// tab switches, navigation away, and browser throttling of background timers.
interface TimerState {
  phase: Phase;
  isRunning: boolean;
  endTime: number | null;       // Date.now() ms when current phase ends
  pausedTimeLeft: number;       // seconds left when paused (used when !isRunning)
  workStartTime: number | null; // Date.now() ms when current work phase started
  totalWorkSecs: number;        // accumulated work secs from previous phases
  currentTask: string;
}

const DEFAULT_STATE: TimerState = {
  phase: 'idle',
  isRunning: false,
  endTime: null,
  pausedTimeLeft: WORK_DURATION,
  workStartTime: null,
  totalWorkSecs: 0,
  currentTask: '',
};

function loadTimerState(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveTimerState(s: TimerState) {
  localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(s));
}

// Fast-forward a running timer through any phase transitions that happened
// while the page was away. Returns the updated state and a count of work
// sessions that completed in the background (so we can auto-save them).
function fastForward(s: TimerState, now: number): { state: TimerState; backgroundSessions: number } {
  if (!s.isRunning || s.endTime === null) return { state: s, backgroundSessions: 0 };

  let { phase, endTime, workStartTime, totalWorkSecs } = s;
  let backgroundSessions = 0;

  while (now >= endTime) {
    if (phase === 'working') {
      // Accumulate work time up to this phase end
      if (workStartTime !== null) totalWorkSecs += Math.floor((endTime - workStartTime) / 1000);
      workStartTime = null;
      backgroundSessions++;
      phase = 'break';
      endTime += BREAK_DURATION * 1000;
    } else {
      // Break ended — start fresh work phase
      phase = 'working';
      workStartTime = endTime;
      endTime += WORK_DURATION * 1000;
    }
  }

  // If we're mid-working-phase, accumulate up to now
  if (phase === 'working' && workStartTime !== null) {
    totalWorkSecs += Math.floor((now - workStartTime) / 1000);
    workStartTime = now; // reset base so we don't double-count
  }

  return {
    state: { ...s, phase, endTime, workStartTime, totalWorkSecs },
    backgroundSessions,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMins(totalMins: number) {
  if (totalMins >= 60) return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  return `${totalMins}m`;
}

function formatWorkTotal(totalSecs: number) {
  const m = Math.floor(totalSecs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function formatSessionTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

function isoDateKey(iso: string) {
  return new Date(iso).toDateString();
}

function playChime() {
  try {
    const ctx = new AudioContext();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch { /* AudioContext not available */ }
}

// ─── Coffee Cup SVG ───────────────────────────────────────────────────────────

function CoffeeCup({ fillPercent, phase, isRunning }: { fillPercent: number; phase: Phase; isRunning: boolean }) {
  const cupTopY = 55, cupBottomY = 170, cupLeftX = 25, cupRightX = 155;
  const liquidHeight = ((fillPercent / 100) * (cupBottomY - cupTopY));
  const liquidY = cupBottomY - liquidHeight;
  const isBreak = phase === 'break';
  const liquidColor = isBreak ? '#6BAF7A' : '#6F4E37';
  const foamColor = isBreak ? '#A8D5B0' : '#C9956C';

  const cupPath = `M ${cupLeftX} ${cupTopY} L ${cupLeftX+4} ${cupBottomY-10}
    Q ${cupLeftX+4} ${cupBottomY} ${cupLeftX+14} ${cupBottomY}
    L ${cupRightX-14} ${cupBottomY} Q ${cupRightX-4} ${cupBottomY} ${cupRightX-4} ${cupBottomY-10}
    L ${cupRightX} ${cupTopY} Z`;

  return (
    <svg viewBox="0 0 200 210" className="w-52 h-52" fill="none">
      <defs>
        <clipPath id="cupBodyClip"><path d={cupPath} /></clipPath>
        <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={liquidColor} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="cupGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFF8F0" />
          <stop offset="40%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF3E8" />
        </linearGradient>
      </defs>
      <path d={cupPath} fill="url(#cupGrad)" />
      {fillPercent > 0.5 && (
        <>
          <rect clipPath="url(#cupBodyClip)" x="0" y={liquidY} width="200" height={liquidHeight + 2} fill="url(#liquidGrad)" />
          <ellipse clipPath="url(#cupBodyClip)" cx="90" cy={liquidY} rx="57" ry="7" fill={foamColor} opacity="0.75" />
        </>
      )}
      <path d={cupPath} stroke="#3D2B1F" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1={cupLeftX-6} y1={cupTopY} x2={cupRightX+6} y2={cupTopY} stroke="#3D2B1F" strokeWidth="3" strokeLinecap="round" />
      <path d="M 151 82 Q 178 82 178 113 Q 178 144 151 144" stroke="#3D2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="88" cy="183" rx="72" ry="9" fill="#FFF3E8" stroke="#3D2B1F" strokeWidth="2" />
      {isRunning && fillPercent > 15 && !isBreak && (
        <>
          <path d="M 58 48 Q 52 38 58 28 Q 64 18 58 8" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.2s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="2.2s" repeatCount="indefinite" />
          </path>
          <path d="M 80 44 Q 86 34 80 24 Q 74 14 80 4" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2.7s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-5;0,0" dur="2.7s" repeatCount="indefinite" />
          </path>
          <path d="M 102 48 Q 96 38 102 28 Q 108 18 102 8" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.65;0.2;0.65" dur="2s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="2s" repeatCount="indefinite" />
          </path>
        </>
      )}
      {isBreak && <text x="68" y="125" fontSize="36" textAnchor="middle">🌿</text>}
      {phase === 'idle' && <text x="68" y="128" fontSize="32" textAnchor="middle" opacity="0.4">☕</text>}
    </svg>
  );
}

// ─── Label Modal ──────────────────────────────────────────────────────────────

function LabelModal({ defaultLabel, onSave, onSkip }: { defaultLabel: string; onSave: (l: string) => void; onSkip: () => void }) {
  const [label, setLabel] = useState(defaultLabel);
  return (
    <div className="modal-overlay" onClick={onSkip}>
      <div className="modal-content p-6 max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="text-2xl mb-1">☕</div>
        <h2 className="text-lg font-bold text-text-primary mb-1">Session complete!</h2>
        <p className="text-sm text-text-secondary mb-4">What were you working on?</p>
        <form onSubmit={e => { e.preventDefault(); onSave(label.trim() || 'Work session'); }} className="space-y-3">
          <input
            autoFocus
            className="input-field"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Feature planning, Client emails…"
          />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onSkip} className="btn-secondary flex-1">Skip</button>
            <button type="submit" className="btn-primary flex-1">
              <Check className="w-4 h-4" />Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Log ──────────────────────────────────────────────────────────────

function SessionLog({ sessions, onDelete }: { sessions: Session[]; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  if (sessions.length === 0) return null;

  const groups: { dateKey: string; heading: string; items: Session[]; totalMins: number }[] = [];
  for (const s of sessions) {
    const key = isoDateKey(s.completedAt);
    const g = groups.find(x => x.dateKey === key);
    if (g) { g.items.push(s); g.totalMins += s.durationMins; }
    else groups.push({ dateKey: key, heading: formatDateHeading(s.completedAt), items: [s], totalMins: s.durationMins });
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-surface-elevated transition-colors">
        <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Session Log</span>
        {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      {open && (
        <div className="space-y-4 pb-8">
          {groups.map(group => (
            <div key={group.dateKey} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-elevated border-b border-border">
                <span className="text-sm font-semibold text-text-primary">{group.heading}</span>
                <span className="text-xs text-text-muted font-medium">
                  {formatMins(group.totalMins)} · {group.items.length} session{group.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {group.items.map((s, idx) => (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${idx < group.items.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="text-lg flex-shrink-0">☕</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{s.label}</p>
                    <p className="text-xs text-text-muted">{formatSessionTime(s.completedAt)} · {s.durationMins} min</p>
                  </div>
                  <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoffeeTimer() {
  const queryClient = useQueryClient();
  const { preferences } = useTheme();

  // Refs for configured durations — updated from preferences but never mid-session
  const workSecsRef = useRef(WORK_DURATION);
  const breakSecsRef = useRef(BREAK_DURATION);
  const timerStateRef = useRef<TimerState | null>(null);

  // Initialise from localStorage so state survives navigation and tab switches
  const [timerState, setTimerState] = useState<TimerState>(() => {
    const saved = loadTimerState();
    if (!saved.isRunning || saved.endTime === null) return saved;
    // Fast-forward through any phase transitions that happened while away
    const { state } = fastForward(saved, Date.now());
    return state;
  });

  // Displayed time left — derived from endTime on each tick
  const [displayedTimeLeft, setDisplayedTimeLeft] = useState<number>(() => {
    const s = timerState;
    if (!s.isRunning || s.endTime === null) return s.pausedTimeLeft;
    return Math.max(0, Math.floor((s.endTime - Date.now()) / 1000));
  });

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');

  // Background-session debt: if sessions completed while navigated away, auto-save them
  const bgSessionsRef = useRef(0);
  useEffect(() => {
    const saved = loadTimerState();
    if (!saved.isRunning || saved.endTime === null) return;
    const { backgroundSessions } = fastForward(saved, Date.now());
    bgSessionsRef.current = backgroundSessions;
  }, []); // run once on mount

  // Keep timerStateRef in sync for use in effects without adding timerState to deps
  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);

  // Apply preference durations — only update display when timer is idle
  useEffect(() => {
    if (!preferences) return;
    workSecsRef.current = preferences.coffeeWorkMins * 60;
    breakSecsRef.current = preferences.coffeeBreakMins * 60;
    if (timerStateRef.current?.phase === 'idle') {
      setDisplayedTimeLeft(workSecsRef.current);
      setTimerState(prev => ({ ...prev, pausedTimeLeft: workSecsRef.current }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.coffeeWorkMins, preferences?.coffeeBreakMins]);

  // Persist timer state to localStorage whenever it changes
  useEffect(() => {
    saveTimerState(timerState);
  }, [timerState]);

  // Tick — uses absolute endTime so it's accurate even after tab throttling
  useEffect(() => {
    if (!timerState.isRunning || timerState.endTime === null) return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((timerState.endTime! - now) / 1000));
      setDisplayedTimeLeft(left);
    };

    tick(); // immediate first tick
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerState.isRunning, timerState.endTime]);

  // Phase transition when displayedTimeLeft hits 0
  const transitioningRef = useRef(false);
  useEffect(() => {
    if (displayedTimeLeft > 0 || !timerState.isRunning || transitioningRef.current) return;
    transitioningRef.current = true;

    if (timerState.phase === 'working') {
      playChime();
      const workSecs = timerState.workStartTime
        ? timerState.totalWorkSecs + Math.floor((Date.now() - timerState.workStartTime) / 1000)
        : timerState.totalWorkSecs;
      const breakEndTime = Date.now() + breakSecsRef.current * 1000;

      setTimerState(prev => ({
        ...prev,
        phase: 'break',
        endTime: breakEndTime,
        pausedTimeLeft: breakSecsRef.current,
        workStartTime: null,
        totalWorkSecs: workSecs,
      }));
      setDisplayedTimeLeft(breakSecsRef.current);
      setPendingLabel(timerState.currentTask);
      setShowLabelModal(true);
    } else if (timerState.phase === 'break') {
      playChime();
      const workEndTime = Date.now() + workSecsRef.current * 1000;
      setTimerState(prev => ({
        ...prev,
        phase: 'working',
        endTime: workEndTime,
        pausedTimeLeft: workSecsRef.current,
        workStartTime: Date.now(),
      }));
      setDisplayedTimeLeft(workSecsRef.current);
    }

    setTimeout(() => { transitioningRef.current = false; }, 1000);
  }, [displayedTimeLeft, timerState]);

  // Auto-save any sessions that completed in the background
  const createSession = useMutation({
    mutationFn: async (payload: { label: string; durationMins: number }) => {
      const res = await apiClient.post('/coffee', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coffee-sessions'] }),
  });

  useEffect(() => {
    if (bgSessionsRef.current > 0) {
      const count = bgSessionsRef.current;
      bgSessionsRef.current = 0;
      for (let i = 0; i < count; i++) {
        createSession.mutate({ label: timerState.currentTask || 'Work session', durationMins: 30 });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data } = useQuery<{ sessions: Session[] }>({
    queryKey: ['coffee-sessions'],
    queryFn: async () => (await apiClient.get('/coffee')).data,
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/coffee/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coffee-sessions'] }),
  });

  const sessions = data?.sessions ?? [];
  const todaySessions = sessions.filter(s => isoDateKey(s.completedAt) === new Date().toDateString());
  const todayMins = todaySessions.reduce((sum, s) => sum + s.durationMins, 0);

  // Live work time = base + time since workStartTime
  const liveWorkSecs = timerState.isRunning && timerState.workStartTime
    ? timerState.totalWorkSecs + Math.floor((Date.now() - timerState.workStartTime) / 1000)
    : timerState.totalWorkSecs;

  const fillPercent =
    timerState.phase === 'working' ? (displayedTimeLeft / workSecsRef.current) * 100
    : timerState.phase === 'break' ? 0
    : 100;

  const commitSession = (label: string) => {
    createSession.mutate({ label: label || 'Work session', durationMins: Math.round(workSecsRef.current / 60) });
    setShowLabelModal(false);
  };

  const handleStartPause = () => {
    const now = Date.now();
    if (!timerState.isRunning) {
      // Start or resume
      const newEndTime = now + timerState.pausedTimeLeft * 1000;
      setTimerState(prev => ({
        ...prev,
        phase: prev.phase === 'idle' ? 'working' : prev.phase,
        isRunning: true,
        endTime: newEndTime,
        workStartTime: (prev.phase === 'idle' || prev.phase === 'working') ? now : null,
      }));
    } else {
      // Pause — snapshot the current timeLeft
      const currentLeft = timerState.endTime
        ? Math.max(0, Math.floor((timerState.endTime - now) / 1000))
        : timerState.pausedTimeLeft;
      const workSecs = timerState.workStartTime && timerState.phase === 'working'
        ? timerState.totalWorkSecs + Math.floor((now - timerState.workStartTime) / 1000)
        : timerState.totalWorkSecs;
      setTimerState(prev => ({
        ...prev,
        isRunning: false,
        endTime: null,
        pausedTimeLeft: currentLeft,
        workStartTime: null,
        totalWorkSecs: workSecs,
      }));
      setDisplayedTimeLeft(currentLeft);
    }
  };

  const handleEndSession = () => {
    playChime();
    const now = Date.now();
    const workSecs = timerState.workStartTime
      ? timerState.totalWorkSecs + Math.floor((now - timerState.workStartTime) / 1000)
      : timerState.totalWorkSecs;
    const breakEndTime = now + breakSecsRef.current * 1000;
    setTimerState(prev => ({
      ...prev,
      phase: 'break',
      isRunning: true,
      endTime: breakEndTime,
      pausedTimeLeft: breakSecsRef.current,
      workStartTime: null,
      totalWorkSecs: workSecs,
    }));
    setDisplayedTimeLeft(breakSecsRef.current);
    setPendingLabel(timerState.currentTask);
    setShowLabelModal(true);
  };

  const handleReset = () => {
    setTimerState({ ...DEFAULT_STATE, pausedTimeLeft: workSecsRef.current });
    setDisplayedTimeLeft(workSecsRef.current);
    setShowLabelModal(false);
  };

  const { phase, isRunning, currentTask } = timerState;

  const phaseColors =
    phase === 'break' ? 'bg-success/20 text-success-dark border border-success/30'
    : phase === 'working' ? 'bg-primary/20 text-primary-dark border border-primary/30'
    : 'bg-surface-elevated text-text-secondary border border-border';

  const phaseLabel = phase === 'idle' ? 'Ready to work' : phase === 'working' ? '☕ Working' : '🌿 Break time!';

  return (
    <div className="h-full flex flex-col page-enter overflow-auto">
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Coffee Timer</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Work {Math.round(workSecsRef.current / 60)} min, break {Math.round(breakSecsRef.current / 60)} min — your cup drains as you go
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 px-6 pb-4">
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${phaseColors}`}>
          {phaseLabel}
        </div>

        {phase !== 'break' && (
          <div className="w-full max-w-sm">
            <input
              className="input-field text-center text-sm"
              value={currentTask}
              onChange={e => setTimerState(prev => ({ ...prev, currentTask: e.target.value }))}
              placeholder={phase === 'idle' ? 'What will you work on? (optional)' : 'What are you working on?'}
              disabled={phase === 'working' && isRunning}
            />
          </div>
        )}
        {phase === 'working' && isRunning && currentTask && (
          <p className="text-sm text-text-secondary italic -mt-2">"{currentTask}"</p>
        )}

        <CoffeeCup fillPercent={fillPercent} phase={phase} isRunning={isRunning} />

        <div className="text-center -mt-2">
          <div className="text-6xl font-bold font-mono text-text-primary tracking-tight tabular-nums">
            {formatTime(displayedTimeLeft)}
          </div>
          <p className="text-text-muted text-sm mt-1">
            {phase === 'working' ? 'until break' : phase === 'break' ? 'break remaining' : 'ready to start'}
          </p>
        </div>

        <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${phase === 'break' ? 'bg-success' : 'bg-primary'}`}
            style={{
              width: `${
                phase === 'working' ? (displayedTimeLeft / workSecsRef.current) * 100
                : phase === 'break' ? ((breakSecsRef.current - displayedTimeLeft) / breakSecsRef.current) * 100
                : 100}%`,
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="btn-secondary" disabled={phase === 'idle'}>
            <RotateCcw className="w-4 h-4" />Reset
          </button>
          <button onClick={handleStartPause} className="btn-primary px-8 py-3 text-base">
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isRunning ? 'Pause' : phase === 'idle' ? 'Start' : 'Resume'}
          </button>
          {phase === 'working' && (
            <button onClick={handleEndSession} className="btn-secondary text-primary border-primary/30">
              <Check className="w-4 h-4" />End Session
            </button>
          )}
        </div>

        <div className="flex gap-4">
          <div className="card px-5 py-3 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-primary">{todaySessions.length}</div>
            <div className="text-xs text-text-muted mt-0.5">Today</div>
          </div>
          <div className="card px-5 py-3 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-primary">{formatMins(todayMins)}</div>
            <div className="text-xs text-text-muted mt-0.5">Today's work</div>
          </div>
          <div className="card px-5 py-3 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-primary">
              {liveWorkSecs < 60 ? `${liveWorkSecs}s` : formatWorkTotal(liveWorkSecs)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">This session</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border mx-6 my-2" />

      <div className="px-6 pb-2">
        <SessionLog sessions={sessions} onDelete={id => deleteSession.mutate(id)} />
      </div>

      {showLabelModal && (
        <LabelModal
          defaultLabel={pendingLabel}
          onSave={commitSession}
          onSkip={() => commitSession('Work session')}
        />
      )}
    </div>
  );
}
