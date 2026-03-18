import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, Trash2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

const WORK_DURATION = 30 * 60;
const BREAK_DURATION = 5 * 60;

type Phase = 'idle' | 'working' | 'break';

interface Session {
  id: string;
  label: string;
  completedAt: string;
  durationMins: number;
}

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
  const totalMins = Math.floor(totalSecs / 60);
  if (totalMins >= 60) return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  return `${totalMins}m`;
}

function formatSessionTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
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
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, i) => {
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
  } catch {
    // AudioContext not available
  }
}

// ─── Coffee Cup SVG ───────────────────────────────────────────────────────────

function CoffeeCup({ fillPercent, phase, isRunning }: { fillPercent: number; phase: Phase; isRunning: boolean }) {
  const cupTopY = 55, cupBottomY = 170, cupLeftX = 25, cupRightX = 155;
  const innerHeight = cupBottomY - cupTopY;
  const liquidHeight = (fillPercent / 100) * innerHeight;
  const liquidY = cupBottomY - liquidHeight;
  const isBreak = phase === 'break';
  const liquidColor = isBreak ? '#6BAF7A' : '#6F4E37';
  const foamColor = isBreak ? '#A8D5B0' : '#C9956C';

  const cupPath = `
    M ${cupLeftX} ${cupTopY}
    L ${cupLeftX + 4} ${cupBottomY - 10}
    Q ${cupLeftX + 4} ${cupBottomY} ${cupLeftX + 14} ${cupBottomY}
    L ${cupRightX - 14} ${cupBottomY}
    Q ${cupRightX - 4} ${cupBottomY} ${cupRightX - 4} ${cupBottomY - 10}
    L ${cupRightX} ${cupTopY} Z
  `;

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
      <line x1={cupLeftX - 6} y1={cupTopY} x2={cupRightX + 6} y2={cupTopY} stroke="#3D2B1F" strokeWidth="3" strokeLinecap="round" />
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

function LabelModal({ defaultLabel, onSave, onSkip }: { defaultLabel: string; onSave: (label: string) => void; onSkip: () => void }) {
  const [label, setLabel] = useState(defaultLabel);
  const inputRef = (el: HTMLInputElement | null) => { if (el) { el.focus(); el.select(); } };

  return (
    <div className="modal-overlay" onClick={onSkip}>
      <div className="modal-content p-6 max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="text-2xl mb-1">☕</div>
        <h2 className="text-lg font-bold text-text-primary mb-1">Session complete!</h2>
        <p className="text-sm text-text-secondary mb-4">What were you working on?</p>
        <form onSubmit={e => { e.preventDefault(); onSave(label.trim() || 'Work session'); }} className="space-y-3">
          <input
            ref={inputRef}
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
  for (const s of [...sessions]) {
    const key = isoDateKey(s.completedAt);
    const existing = groups.find(g => g.dateKey === key);
    if (existing) { existing.items.push(s); existing.totalMins += s.durationMins; }
    else groups.push({ dateKey: key, heading: formatDateHeading(s.completedAt), items: [s], totalMins: s.durationMins });
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-surface-elevated transition-colors"
      >
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
                  <button
                    onClick={() => onDelete(s.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="Delete session"
                  >
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

  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [totalWorkSecs, setTotalWorkSecs] = useState(0);
  const [currentTask, setCurrentTask] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');

  // Fetch sessions from backend
  const { data } = useQuery<{ sessions: Session[] }>({
    queryKey: ['coffee-sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/coffee');
      return res.data;
    },
  });

  const sessions = data?.sessions ?? [];

  const createSession = useMutation({
    mutationFn: async (payload: { label: string; durationMins: number }) => {
      const res = await apiClient.post('/coffee', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coffee-sessions'] }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/coffee/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coffee-sessions'] }),
  });

  const todaySessions = sessions.filter(s => isoDateKey(s.completedAt) === new Date().toDateString());
  const todayMins = todaySessions.reduce((sum, s) => sum + s.durationMins, 0);

  const fillPercent =
    phase === 'working' ? (timeLeft / WORK_DURATION) * 100
    : phase === 'break' ? 0
    : 100;

  // Countdown
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Work time accumulator
  useEffect(() => {
    if (!isRunning || phase !== 'working') return;
    const id = setInterval(() => setTotalWorkSecs(prev => prev + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, phase]);

  // Phase transitions
  useEffect(() => {
    if (timeLeft > 0 || !isRunning) return;
    if (phase === 'working') {
      playChime();
      setPendingLabel(currentTask);
      setShowLabelModal(true);
      setPhase('break');
      setTimeLeft(BREAK_DURATION);
    } else if (phase === 'break') {
      playChime();
      setPhase('working');
      setTimeLeft(WORK_DURATION);
    }
  }, [timeLeft, phase, isRunning, currentTask]);

  const commitSession = (label: string) => {
    createSession.mutate({ label: label || 'Work session', durationMins: 30 });
    setShowLabelModal(false);
  };

  const handleStartPause = () => {
    if (phase === 'idle') setPhase('working');
    setIsRunning(prev => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setPhase('idle');
    setTimeLeft(WORK_DURATION);
    setTotalWorkSecs(0);
    setCurrentTask('');
    setShowLabelModal(false);
  };

  const phaseColors =
    phase === 'break' ? 'bg-success/20 text-success-dark border border-success/30'
    : phase === 'working' ? 'bg-primary/20 text-primary-dark border border-primary/30'
    : 'bg-surface-elevated text-text-secondary border border-border';

  const phaseLabel =
    phase === 'idle' ? 'Ready to work'
    : phase === 'working' ? '☕ Working'
    : '🌿 Break time!';

  return (
    <div className="h-full flex flex-col page-enter overflow-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Coffee Timer</h1>
        <p className="text-text-secondary text-sm mt-0.5">Work 30 min, break 5 min — your cup drains as you go</p>
      </div>

      {/* Timer area */}
      <div className="flex flex-col items-center gap-5 px-6 pb-4">
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${phaseColors}`}>
          {phaseLabel}
        </div>

        {/* Task input */}
        {phase !== 'break' && (
          <div className="w-full max-w-sm">
            <input
              className="input-field text-center text-sm"
              value={currentTask}
              onChange={e => setCurrentTask(e.target.value)}
              placeholder={phase === 'idle' ? 'What will you work on? (optional)' : 'What are you working on?'}
              disabled={phase === 'working' && isRunning}
            />
          </div>
        )}
        {phase === 'working' && isRunning && currentTask && (
          <p className="text-sm text-text-secondary italic -mt-2">"{currentTask}"</p>
        )}

        <CoffeeCup fillPercent={fillPercent} phase={phase} isRunning={isRunning} />

        {/* Timer */}
        <div className="text-center -mt-2">
          <div className="text-6xl font-bold font-mono text-text-primary tracking-tight tabular-nums">
            {formatTime(timeLeft)}
          </div>
          <p className="text-text-muted text-sm mt-1">
            {phase === 'working' ? 'until break' : phase === 'break' ? 'break remaining' : 'ready to start'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${phase === 'break' ? 'bg-success' : 'bg-primary'}`}
            style={{
              width: `${
                phase === 'working' ? (timeLeft / WORK_DURATION) * 100
                : phase === 'break' ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
                : 100
              }%`,
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="btn-secondary" disabled={phase === 'idle'}>
            <RotateCcw className="w-4 h-4" />Reset
          </button>
          <button onClick={handleStartPause} className="btn-primary px-8 py-3 text-base">
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isRunning ? 'Pause' : phase === 'idle' ? 'Start' : 'Resume'}
          </button>
        </div>

        {/* Stats */}
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
              {totalWorkSecs < 60 ? `${totalWorkSecs}s` : formatWorkTotal(totalWorkSecs)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">This session</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border mx-6 my-2" />

      {/* Session log */}
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
