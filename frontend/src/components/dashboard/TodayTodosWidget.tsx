import { useState, FormEvent } from 'react';
import { Plus, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { useTodayList } from '../../hooks/useTodayList';
import TodoItem from '../todos/TodoItem';

type Priority = 'low' | 'medium' | 'high';

const PRIORITY_LABELS: Record<Priority, string> = {
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

export default function TodayTodosWidget() {
  const { todos, isLoading, createTodo, toggleTodo, deleteTodo, updateTodo } = useTodayList();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  const pending = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    createTodo(trimmed, priority);
    setText('');
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-text-primary">Today's Tasks</h2>
          {todos.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {pending.length} / {todos.length}
            </span>
          )}
        </div>
      </div>

      {/* Add task form */}
      <form onSubmit={handleSubmit} className="px-6 pb-4 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field flex-1 min-h-[48px] text-base"
            placeholder="Add a task for today…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select
            className="input-field min-h-[48px] text-sm px-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            aria-label="Priority"
          >
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="btn-primary min-h-[48px] px-4 flex-shrink-0"
            disabled={!text.trim()}
            aria-label="Add task"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-border/40" />
            ))}
          </div>
        ) : (
          <>
            {pending.length === 0 && completed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="w-12 h-12 text-success mb-3 opacity-60" />
                <p className="text-text-secondary font-medium">Nothing on your plate today</p>
                <p className="text-text-muted text-sm mt-1">Add a task above to get started</p>
              </div>
            )}

            {pending.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => toggleTodo(todo.id, !todo.completed)}
                onDelete={() => deleteTodo(todo.id)}
                onUpdate={(data) => updateTodo(todo.id, data)}
              />
            ))}

            {completed.length > 0 && (
              <div className="mt-4">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors mb-2"
                  onClick={() => setCompletedCollapsed((v) => !v)}
                >
                  {completedCollapsed
                    ? <ChevronRight className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                  {completed.length} completed
                </button>
                {!completedCollapsed && (
                  <div className="space-y-2">
                    {completed.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={() => toggleTodo(todo.id, !todo.completed)}
                        onDelete={() => deleteTodo(todo.id)}
                        onUpdate={(data) => updateTodo(todo.id, data)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
