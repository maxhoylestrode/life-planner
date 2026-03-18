import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText } from 'lucide-react';
import apiClient from '../../api/client';
import NoteCard, { Note } from './NoteCard';
import NoteEditor from './NoteEditor';

interface NotesResponse {
  notes: Note[];
}

export default function NotesList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const { data, isLoading, error } = useQuery<NotesResponse>({
    queryKey: ['notes', search],
    queryFn: async () => {
      const response = await apiClient.get<NotesResponse>('/notes', {
        params: search ? { search } : {},
      });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (noteData: { title: string; content: string; color: string }) => {
      const response = await apiClient.post<{ note: Note }>('/notes', noteData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title: string;
      content: string;
      color: string;
    }) => {
      const response = await apiClient.put<{ note: Note }>(`/notes/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const colorMutation = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const response = await apiClient.put<{ note: Note }>(`/notes/${id}`, { color });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const handleOpenNew = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSave = async (noteData: { title: string; content: string; color: string }) => {
    if (editingNote) {
      await updateMutation.mutateAsync({ id: editingNote.id, ...noteData });
    } else {
      await createMutation.mutateAsync(noteData);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this note?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const notes = data?.notes ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 bg-surface border-b border-border flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            className="input-field pl-9 text-sm py-2"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary text-sm" onClick={handleOpenNew}>
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Notes grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-surface-elevated animate-pulse border border-border"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64 text-red-500">
            <p>Failed to load notes. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center animate-fade-in">
            <div className="w-16 h-16 bg-surface-elevated rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {search ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              {search
                ? `No notes match "${search}"`
                : 'No notes yet — start writing! ✏️'}
            </p>
            {!search && (
              <button className="btn-primary text-sm" onClick={handleOpenNew}>
                <Plus className="w-4 h-4" />
                Write your first note
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && notes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => handleOpenEdit(note)}
                onEdit={() => handleOpenEdit(note)}
                onDelete={() => handleDelete(note.id)}
                onColorChange={(color) => colorMutation.mutate({ id: note.id, color })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Note Editor Modal */}
      {isEditorOpen && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
}
