import { useState, useMemo } from 'react';
import { Pencil, Trash2, Palette } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  { value: '#FFD9A8', label: 'Warm amber' },
  { value: '#F5B89A', label: 'Peach' },
  { value: '#A8D8AA', label: 'Mint' },
  { value: '#B8B8E8', label: 'Lavender' },
  { value: '#F5E06A', label: 'Lemon' },
  { value: '#D4A8E8', label: 'Lilac' },
];

const NOTE_COLORS_DARK = [
  { value: '#2D2318', label: 'Amber' },
  { value: '#2D1E1A', label: 'Peach' },
  { value: '#1A2C1E', label: 'Mint' },
  { value: '#1C1C2E', label: 'Lavender' },
  { value: '#2A2716', label: 'Lemon' },
  { value: '#231A2C', label: 'Lilac' },
];

// Maps canonical light color → dark display color, and vice versa
const LIGHT_TO_DARK = Object.fromEntries(NOTE_COLORS.map((c, i) => [c.value, NOTE_COLORS_DARK[i].value]));
const DARK_TO_LIGHT = Object.fromEntries(NOTE_COLORS_DARK.map((c, i) => [c.value, NOTE_COLORS[i].value]));

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const mins = Math.floor(diff / (1000 * 60));
      return mins <= 1 ? 'Just now' : `${mins}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteCard({
  note,
  onClick,
  onEdit,
  onDelete,
  onColorChange,
}: NoteCardProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { preferences } = useTheme();

  const isDark = useMemo(() => {
    if (!preferences) return false;
    const bg = preferences.colorBackground;
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }, [preferences?.colorBackground]);

  const displayColor = isDark ? (LIGHT_TO_DARK[note.color] ?? note.color) : note.color;
  const pickerColors = isDark ? NOTE_COLORS_DARK : NOTE_COLORS;

  const handleColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowColorPicker((v) => !v);
  };

  const handleColorSelect = (e: React.MouseEvent, pickedColor: string) => {
    e.stopPropagation();
    // Always save canonical light color so switching themes preserves semantics
    const canonicalColor = isDark ? (DARK_TO_LIGHT[pickedColor] ?? pickedColor) : pickedColor;
    onColorChange(canonicalColor);
    setShowColorPicker(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className="group relative rounded-2xl p-4 cursor-pointer border border-border/60 hover:border-border hover:shadow-warm-md transition-all duration-200 animate-fade-in"
      style={{ backgroundColor: displayColor }}
      onClick={onClick}
    >
      {/* Color accent strip */}
      <div
        className="absolute top-0 left-4 right-4 h-1 rounded-b-full opacity-40"
        style={{ backgroundColor: darkenColor(displayColor) }}
      />

      {/* Content */}
      <div className="pt-1">
        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1.5 line-clamp-2">
          {note.title || 'Untitled'}
        </h3>
        {note.content && (
          <p className="text-text-primary text-xs leading-relaxed line-clamp-4 mb-3">
            {note.content}
          </p>
        )}
        <p className="text-text-secondary text-xs">{formatDate(note.updatedAt)}</p>
      </div>

      {/* Actions - always visible on touch, hover on desktop */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-150">
        <div className="relative">
          <button
            className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface text-text-secondary hover:text-primary shadow-warm transition-all"
            onClick={handleColorClick}
            title="Change color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Color picker popover */}
          {showColorPicker && (
            <div
              className="absolute right-0 top-8 z-10 p-2 bg-surface rounded-xl shadow-warm-lg border border-border flex gap-1.5 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {pickerColors.map((c) => (
                <button
                  key={c.value}
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: displayColor === c.value ? 'var(--color-primary)' : 'var(--color-border)',
                  }}
                  title={c.label}
                  onClick={(e) => handleColorSelect(e, c.value)}
                />
              ))}
            </div>
          )}
        </div>

        <button
          className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface text-text-secondary hover:text-primary shadow-warm transition-all"
          onClick={handleEditClick}
          title="Edit note"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        <button
          className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface text-text-secondary hover:text-red-500 shadow-warm transition-all"
          onClick={handleDeleteClick}
          title="Delete note"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Simple color darkening for accent strip
function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
}

export { NOTE_COLORS, NOTE_COLORS_DARK, LIGHT_TO_DARK, DARK_TO_LIGHT };
