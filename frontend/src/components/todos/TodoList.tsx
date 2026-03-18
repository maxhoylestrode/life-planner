import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight, Trash2, ListChecks } from 'lucide-react';
import apiClient from '../../api/client';
import TodoItem, { Todo } from './TodoItem';

interface TodosResponse {
  todos: Todo[];
}

interface TodoListsResponse {
  lists: Array<{
    id: string;
    name: string;
    createdAt: string;
    _count: { todos: number };
  }>;
}

type Priority = 'low' | 'medium' | 'high';

export default function TodoList() {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<Priority>('medium');
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);

  const { data: listsData } = useQuery<TodoListsResponse>({
    queryKey: ['todo-lists'],
    queryFn: async () => {
      const response = await apiClient.get<TodoListsResponse>('/todos/lists');
      return response.data;
    },
  });

  const { data: todosData, isLoading } = useQuery<TodosResponse>({
    queryKey: ['todos', selectedListId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedListId === 'inbox') {
        params.listId = 'inbox';
      } else if (selectedListId) {
        params.listId = selectedListId;
      }
      const response = await apiClient.get<TodosResponse>('/todos', { params });
      return response.data;
    },
  });

  const createTodoMutation = useMutation({
    mutationFn: async (data: { text: string; priority: string; listId?: string | null }) => {
      const response = await apiClient.post('/todos', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; text?: string; priority?: string; completed?: boolean }) => {
      const response = await apiClient.put(`/todos/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.post('/todos/lists', { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
      setNewListName('');
      setShowNewListInput(false);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todos/lists/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setSelectedListId((current) => (current === id ? null : current));
    },
  });

  const handleAddTodo = (e: FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    createTodoMutation.mutate({
      text: newTodoText.trim(),
      priority: newTodoPriority,
      listId:
        selectedListId === 'inbox' || selectedListId === null ? null : selectedListId,
    });

    setNewTodoText('');
  };

  const handleCreateList = (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    createListMutation.mutate(newListName.trim());
  };

  const todos = todosData?.todos ?? [];
  const pendingTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const lists = listsData?.lists ?? [];

  const activeListName =
    selectedListId === null
      ? 'All Tasks'
      : selectedListId === 'inbox'
        ? 'Inbox'
        : lists.find((l) => l.id === selectedListId)?.name || 'Tasks';

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0">
      {/* Lists sidebar */}
      <div className="w-full lg:w-56 xl:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Lists
          </h3>
          <button
            className="p-1 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-primary transition-colors"
            onClick={() => setShowNewListInput((v) => !v)}
            title="New list"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showNewListInput && (
          <form onSubmit={handleCreateList} className="mb-3">
            <div className="flex gap-1">
              <input
                type="text"
                className="input-field text-sm py-1.5 flex-1"
                placeholder="List name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
              >
                Add
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {/* All tasks */}
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
              selectedListId === null
                ? 'bg-primary text-white font-medium'
                : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
            }`}
            onClick={() => setSelectedListId(null)}
          >
            <ListChecks className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">All Tasks</span>
          </button>

          {/* Inbox (no list) */}
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
              selectedListId === 'inbox'
                ? 'bg-primary text-white font-medium'
                : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
            }`}
            onClick={() => setSelectedListId('inbox')}
          >
            <span className="w-4 h-4 flex-shrink-0 text-center">📥</span>
            <span className="flex-1 text-left">Inbox</span>
          </button>

          {/* User lists */}
          {lists.map((list) => (
            <div key={list.id} className="group flex items-center">
              <button
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                  selectedListId === list.id
                    ? 'bg-primary text-white font-medium'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                }`}
                onClick={() => setSelectedListId(list.id)}
              >
                <span className="w-4 h-4 flex-shrink-0 text-center">📋</span>
                <span className="flex-1 text-left truncate">{list.name}</span>
                <span
                  className={`text-xs ${
                    selectedListId === list.id ? 'text-white/70' : 'text-text-muted'
                  }`}
                >
                  {list._count.todos}
                </span>
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 ml-1 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500 transition-all"
                onClick={() => {
                  if (window.confirm(`Delete list "${list.name}"?`)) {
                    deleteListMutation.mutate(list.id);
                  }
                }}
                title="Delete list"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main todos area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-text-primary">{activeListName}</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {pendingTodos.length} pending · {completedTodos.length} done
          </p>
        </div>

        {/* Add todo form */}
        <div className="px-5 py-3 border-b border-border flex-shrink-0">
          <form onSubmit={handleAddTodo} className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1 text-sm py-2.5"
              placeholder="Add a new task..."
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
            />
            <select
              className="input-field text-sm py-2.5 w-28 cursor-pointer"
              value={newTodoPriority}
              onChange={(e) => setNewTodoPriority(e.target.value as Priority)}
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
            </select>
            <button
              type="submit"
              className="btn-primary py-2.5 px-4 text-sm flex-shrink-0"
              disabled={!newTodoText.trim() || createTodoMutation.isPending}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>

        {/* Todo items */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && todos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center animate-fade-in">
              <span className="text-4xl mb-3">✅</span>
              <h3 className="font-semibold text-text-primary mb-1">All clear!</h3>
              <p className="text-text-secondary text-sm">Add a task above to get started</p>
            </div>
          )}

          {!isLoading && pendingTodos.length > 0 && (
            <div className="space-y-2 mb-4">
              {pendingTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={() => updateTodoMutation.mutate({ id: todo.id, completed: true })}
                  onDelete={() => deleteTodoMutation.mutate(todo.id)}
                  onUpdate={(data) => updateTodoMutation.mutate({ id: todo.id, ...data })}
                />
              ))}
            </div>
          )}

          {!isLoading && completedTodos.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary mb-2 transition-colors"
                onClick={() => setCompletedCollapsed((v) => !v)}
              >
                {completedCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Completed ({completedTodos.length})
              </button>

              {!completedCollapsed && (
                <div className="space-y-2 animate-fade-in">
                  {completedTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() =>
                        updateTodoMutation.mutate({ id: todo.id, completed: false })
                      }
                      onDelete={() => deleteTodoMutation.mutate(todo.id)}
                      onUpdate={(data) => updateTodoMutation.mutate({ id: todo.id, ...data })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
