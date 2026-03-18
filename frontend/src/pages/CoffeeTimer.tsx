import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const WORK_DURATION = 30 * 60; // 30 minutes
const BREAK_DURATION = 5 * 60; // 5 minutes

type Phase = 'idle' | 'working' | 'break';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatWorkTotal(totalSecs: number) {
  const totalMins = Math.floor(totalSecs / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${totalMins}m`;
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const freqs = [523.25, 659.25, 783.99]; // C5 E5 G5
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

interface CoffeeCupProps {
  fillPercent: number;
  phase: Phase;
  isRunning: boolean;
}

function CoffeeCup({ fillPercent, phase, isRunning }: CoffeeCupProps) {
  // SVG coordinate system: viewBox="0 0 200 200"
  // Cup body: trapezoid from y=55 to y=170
  const cupTopY = 55;
  const cupBottomY = 170;
  const cupLeftX = 25;
  const cupRightX = 155;
  const innerHeight = cupBottomY - cupTopY; // 115 units
  const liquidHeight = (fillPercent / 100) * innerHeight;
  const liquidY = cupBottomY - liquidHeight;

  const cupPath = `
    M ${cupLeftX} ${cupTopY}
    L ${cupLeftX + 4} ${cupBottomY - 10}
    Q ${cupLeftX + 4} ${cupBottomY} ${cupLeftX + 14} ${cupBottomY}
    L ${cupRightX - 14} ${cupBottomY}
    Q ${cupRightX - 4} ${cupBottomY} ${cupRightX - 4} ${cupBottomY - 10}
    L ${cupRightX} ${cupTopY}
    Z
  `;

  const isBreak = phase === 'break';
  const liquidColor = isBreak ? '#6BAF7A' : '#6F4E37';
  const foamColor = isBreak ? '#A8D5B0' : '#C9956C';

  return (
    <svg viewBox="0 0 200 210" className="w-52 h-52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="cupBodyClip">
          <path d={cupPath} />
        </clipPath>
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

      {/* Cup body fill (background) */}
      <path d={cupPath} fill="url(#cupGrad)" />

      {/* Liquid fill */}
      {fillPercent > 0.5 && (
        <>
          <rect
            clipPath="url(#cupBodyClip)"
            x="0"
            y={liquidY}
            width="200"
            height={liquidHeight + 2}
            fill="url(#liquidGrad)"
          />
          {/* Foam / crema on top of liquid */}
          <ellipse
            clipPath="url(#cupBodyClip)"
            cx="90"
            cy={liquidY}
            rx="57"
            ry="7"
            fill={foamColor}
            opacity="0.75"
          />
        </>
      )}

      {/* Cup body outline */}
      <path
        d={cupPath}
        stroke="#3D2B1F"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Rim */}
      <line
        x1={cupLeftX - 6}
        y1={cupTopY}
        x2={cupRightX + 6}
        y2={cupTopY}
        stroke="#3D2B1F"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Handle */}
      <path
        d="M 151 82 Q 178 82 178 113 Q 178 144 151 144"
        stroke="#3D2B1F"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Saucer */}
      <ellipse
        cx="88"
        cy="183"
        rx="72"
        ry="9"
        fill="#FFF3E8"
        stroke="#3D2B1F"
        strokeWidth="2"
      />

      {/* Steam (animated, only while running and has liquid) */}
      {isRunning && fillPercent > 15 && !isBreak && (
        <>
          <g opacity="0.7">
            <path d="M 58 48 Q 52 38 58 28 Q 64 18 58 8" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
              <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.2s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-4; 0,0" dur="2.2s" repeatCount="indefinite" />
            </path>
          </g>
          <g opacity="0.6">
            <path d="M 80 44 Q 86 34 80 24 Q 74 14 80 4" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
              <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2.7s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2.7s" repeatCount="indefinite" />
            </path>
          </g>
          <g opacity="0.65">
            <path d="M 102 48 Q 96 38 102 28 Q 108 18 102 8" stroke="#C4A090" strokeWidth="2.2" strokeLinecap="round">
              <animate attributeName="opacity" values="0.65;0.2;0.65" dur="2s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-4; 0,0" dur="2s" repeatCount="indefinite" />
            </path>
          </g>
        </>
      )}

      {/* Break: small leaf/plant icon on empty cup */}
      {isBreak && (
        <text x="68" y="125" fontSize="36" textAnchor="middle">
          🌿
        </text>
      )}

      {/* Idle: coffee bean decoration */}
      {phase === 'idle' && (
        <text x="68" y="128" fontSize="32" textAnchor="middle" opacity="0.4">
          ☕
        </text>
      )}
    </svg>
  );
}

export default function CoffeeTimer() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [totalWorkSecs, setTotalWorkSecs] = useState(0);
  const prevPhaseRef = useRef<Phase>('idle');

  const fillPercent =
    phase === 'working'
      ? (timeLeft / WORK_DURATION) * 100
      : phase === 'break'
      ? 0
      : 100;

  // Main countdown
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Work time accumulator
  useEffect(() => {
    if (!isRunning || phase !== 'working') return;
    const id = setInterval(() => {
      setTotalWorkSecs(prev => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, phase]);

  // Phase transitions when timeLeft hits 0
  useEffect(() => {
    if (timeLeft > 0 || !isRunning) return;
    if (phase === 'working') {
      playChime();
      setSessions(s => s + 1);
      setPhase('break');
      setTimeLeft(BREAK_DURATION);
    } else if (phase === 'break') {
      playChime();
      setPhase('working');
      setTimeLeft(WORK_DURATION);
    }
  }, [timeLeft, phase, isRunning]);

  // Track previous phase for transition animation
  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);

  const handleStartPause = () => {
    if (phase === 'idle') setPhase('working');
    setIsRunning(prev => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setPhase('idle');
    setTimeLeft(WORK_DURATION);
    setSessions(0);
    setTotalWorkSecs(0);
  };

  const phaseLabel =
    phase === 'idle'
      ? 'Ready to work'
      : phase === 'working'
      ? '☕ Working'
      : '🌿 Break time!';

  const phaseColors =
    phase === 'break'
      ? 'bg-success/20 text-success-dark border border-success/30'
      : phase === 'working'
      ? 'bg-primary/20 text-primary-dark border border-primary/30'
      : 'bg-surface-elevated text-text-secondary border border-border';

  const subLabel =
    phase === 'working'
      ? 'until break'
      : phase === 'break'
      ? 'break remaining'
      : 'ready to start';

  return (
    <div className="h-full flex flex-col page-enter overflow-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Coffee Timer</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Work 30 min, break 5 min — your cup drains as you go
        </p>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-8">
        {/* Phase badge */}
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${phaseColors}`}>
          {phaseLabel}
        </div>

        {/* Animated coffee cup */}
        <div
          className={`transition-transform duration-300 ${
            phase === 'break' ? 'animate-bounce' : ''
          }`}
          style={phase === 'break' ? { animation: 'none' } : {}}
        >
          <CoffeeCup fillPercent={fillPercent} phase={phase} isRunning={isRunning} />
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className="text-6xl font-bold font-mono text-text-primary tracking-tight tabular-nums">
            {formatTime(timeLeft)}
          </div>
          <p className="text-text-muted text-sm mt-1">{subLabel}</p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              phase === 'break' ? 'bg-success' : 'bg-primary'
            }`}
            style={{
              width: `${
                phase === 'working'
                  ? (timeLeft / WORK_DURATION) * 100
                  : phase === 'break'
                  ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
                  : 100
              }%`,
            }}
          />
        </div>
        <p className="text-xs text-text-muted -mt-4">
          {phase === 'working'
            ? 'Session progress'
            : phase === 'break'
            ? 'Break progress'
            : ''}
        </p>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleReset}
            className="btn-secondary"
            disabled={phase === 'idle'}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button onClick={handleStartPause} className="btn-primary px-8 py-3 text-base">
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isRunning ? 'Pause' : phase === 'idle' ? 'Start' : 'Resume'}
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-2">
          <div className="card px-6 py-4 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-primary">{sessions}</div>
            <div className="text-xs text-text-muted mt-0.5">Sessions</div>
          </div>
          <div className="card px-6 py-4 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-primary">
              {totalWorkSecs < 60 ? `${totalWorkSecs}s` : formatWorkTotal(totalWorkSecs)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">Work time</div>
          </div>
        </div>

        {/* Completed sessions row */}
        {sessions > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
            {Array.from({ length: sessions }).map((_, i) => (
              <span key={i} className="text-xl" title={`Session ${i + 1} complete`}>
                ☕
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
