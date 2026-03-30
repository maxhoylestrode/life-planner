import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Todo } from '../components/todos/TodoItem';

interface TodoListsResponse {
  lists: Array<{ id: string; name: string; createdAt: string; _count: { todos: number } }>;
}

interface TodosResponse {
  todos: Todo[];
}

export interface UseTodayListReturn {
  todos: Todo[];
  listId: string | null;
  isLoading: boolean;
  createTodo: (text: string, priority: string) => void;
  toggleTodo: (id: string, completed: boolean) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, data: { text?: string; priority?: string }) => void;
}

export function useTodayList(): UseTodayListReturn {
  const queryClient = useQueryClient();

  const { data: listsData, isFetched: listsFetched } = useQuery<TodoListsResponse>({
    queryKey: ['todo-lists'],
    queryFn: async () => {
      const res = await apiClient.get<TodoListsResponse>('/todos/lists');
      return res.data;
    },
  });

  const todayList = listsData?.lists.find(
    (l) => l.name.toLowerCase() === 'today'
  ) ?? null;

  const createListMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/todos/lists', { name: 'Today' });
      return res.data as { list: { id: string; name: string } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });

  useEffect(() => {
    if (listsFetched && !todayList && !createListMutation.isPending) {
      createListMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listsFetched, todayList]);

  const listId = todayList?.id ?? null;

  const { data: todosData, isLoading: todosLoading } = useQuery<TodosResponse>({
    queryKey: ['todos', listId],
    queryFn: async () => {
      const res = await apiClient.get<TodosResponse>('/todos', {
        params: { listId },
      });
      return res.data;
    },
    enabled: Boolean(listId),
    refetchInterval: 120_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['todos', listId] });
    queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
  };

  const createTodoMutation = useMutation({
    mutationFn: async (data: { text: string; priority: string; listId: string }) => {
      const res = await apiClient.post('/todos', data);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await apiClient.put(`/todos/${id}`, { completed });
      return res.data;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todos/${id}`);
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { text?: string; priority?: string } }) => {
      const res = await apiClient.put(`/todos/${id}`, data);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    todos: todosData?.todos ?? [],
    listId,
    isLoading: !listsFetched || todosLoading,
    createTodo: (text, priority) => {
      if (!listId) return;
      createTodoMutation.mutate({ text, priority, listId });
    },
    toggleTodo: (id, completed) => toggleMutation.mutate({ id, completed }),
    deleteTodo: (id) => deleteMutation.mutate(id),
    updateTodo: (id, data) => updateMutation.mutate({ id, data }),
  };
}
