import { useState } from 'react';
import { Trash2, Pencil, Check } from 'lucide-react';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  listId?: string;
  list?: { id: string; name: string };
}

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (data: { text?: string; priority?: string }) => void;
}

const PRIORITY_LABELS = {
  high: { label: 'High', emoji: '🔴', classes: 'badge-high' },
  medium: { label: 'Medium', emoji: '🟡', classes: 'badge-medium' },
  low: { label: 'Low', emoji: '🟢', classes: 'badge-low' },
};

export default function TodoItem({ todo, onToggle, onDelete, onUpdate }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  const handleEditSave = () => {
    if (editText.trim() && editText.trim() !== todo.text) {
      onUpdate({ text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditSave();
    if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };

  const priority = PRIORITY_LABELS[todo.priority] || PRIORITY_LABELS.medium;

  return (
    <div
      className={`todo-item group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
        todo.completed
          ? 'bg-surface-elevated/50 border-border/50'
          : 'bg-surface border-border hover:border-primary/30 hover:shadow-warm'
      }`}
    >
      {/* Custom checkbox */}
      <label className="todo-checkbox mt-0.5 cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
          className="sr-only"
        />
        <div className={`checkmark ${todo.completed ? 'bg-primary border-primary' : ''}`}>
          <svg viewBox="0 0 12 10" className={todo.completed ? 'opacity-100' : 'opacity-0'}>
            <polyline points="1.5,5.5 4.5,8.5 10.5,1.5" />
          </svg>
        </div>
      </label>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            className="w-full text-sm bg-surface border border-primary/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleEditKeyDown}
            autoFocus
          />
        ) : (
          <p
            className={`text-sm leading-relaxed cursor-text todo-text ${
              todo.completed ? 'line-through text-text-muted' : 'text-text-primary'
            }`}
            onDoubleClick={() => !todo.completed && setIsEditing(true)}
          >
            {todo.text}
            {todo.completed && <span className="ml-2">✅</span>}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Priority badge */}
          <div className="relative">
            <button
              className={`${priority.classes} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => !todo.completed && setShowPriorityMenu((v) => !v)}
              title="Change priority"
            >
              {priority.emoji} {priority.label}
            </button>
            {showPriorityMenu && !todo.completed && (
              <div className="absolute left-0 top-6 z-10 bg-surface rounded-xl shadow-warm-lg border border-border py-1 min-w-[120px] animate-scale-in">
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-elevated transition-colors text-text-primary"
                    onClick={() => {
                      onUpdate({ priority: p });
                      setShowPriorityMenu(false);
                    }}
                  >
                    {PRIORITY_LABELS[p].emoji} {PRIORITY_LABELS[p].label}
                    {todo.priority === p && <Check className="w-3 h-3 ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List tag */}
          {todo.list && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {todo.list.name}
            </span>
          )}

          {/* Completion time */}
          {todo.completed && todo.completedAt && (
            <span className="text-xs text-text-muted">
              Done {new Date(todo.completedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!todo.completed && (
          <button
            className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
            onClick={() => setIsEditing(true)}
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
