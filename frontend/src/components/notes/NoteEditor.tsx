import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Palette } from 'lucide-react';
import { NOTE_COLORS, NOTE_COLORS_DARK, LIGHT_TO_DARK, DARK_TO_LIGHT, Note } from './NoteCard';
import { useTheme } from '../../hooks/useTheme';

interface NoteEditorProps {
  note?: Note | null;
  onSave: (data: { title: string; content: string; color: string }) => Promise<void>;
  onClose: () => void;
}

export default function NoteEditor({ note, onSave, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  // color stores the canonical light value
  const [color, setColor] = useState(note?.color || '#FFD9A8');
  const [showColors, setShowColors] = useState(false);
  const { preferences } = useTheme();

  const isDark = useMemo(() => {
    if (!preferences) return false;
    const bg = preferences.colorBackground;
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }, [preferences?.colorBackground]);

  const displayColor = isDark ? (LIGHT_TO_DARK[color] ?? color) : color;
  const pickerColors = isDark ? NOTE_COLORS_DARK : NOTE_COLORS;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      titleRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave({ title: title.trim(), content: content.trim(), color });
      onClose();
    } catch {
      setError('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.metaKey) handleSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: displayColor }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-black/5">
          <h2 className="text-base font-semibold text-text-primary">
            {note ? 'Edit note' : 'New note'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Color picker */}
            <div className="relative">
              <button
                className="p-2 rounded-xl hover:bg-black/5 text-text-secondary transition-colors"
                onClick={() => setShowColors((v) => !v)}
                title="Change color"
              >
                <Palette className="w-4 h-4" />
              </button>
              {showColors && (
                <div className="absolute right-0 top-10 z-10 p-2 bg-surface rounded-xl shadow-warm-lg border border-border flex gap-1.5 animate-scale-in">
                  {pickerColors.map((c) => (
                    <button
                      key={c.value}
                      className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: c.value,
                        borderColor: displayColor === c.value ? 'var(--color-primary)' : 'var(--color-border)',
                      }}
                      title={c.label}
                      onClick={() => {
                        // Save canonical light color
                        setColor(isDark ? (DARK_TO_LIGHT[c.value] ?? c.value) : c.value);
                        setShowColors(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              className="p-2 rounded-xl hover:bg-black/5 text-text-secondary transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <input
            ref={titleRef}
            type="text"
            className="w-full bg-transparent text-xl font-semibold text-text-primary placeholder-text-muted/60 outline-none border-none focus:ring-0"
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />

          <textarea
            className="w-full bg-transparent text-text-secondary placeholder-text-muted/60 outline-none border-none focus:ring-0 resize-none leading-relaxed"
            placeholder="Start writing your note here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            style={{ minHeight: '200px' }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-black/5 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {content.length > 0 && `${content.length} characters`}
            {note && (
              <span className="ml-2">
                · Last edited {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="bg-primary text-white font-medium px-4 py-2 rounded-xl hover:bg-primary-dark active:scale-95 transition-all duration-150 flex items-center gap-2 shadow-warm text-sm disabled:opacity-60"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
