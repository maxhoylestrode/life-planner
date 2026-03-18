import NotesList from '../components/notes/NotesList';

export default function Notes() {
  return (
    <div className="h-full flex flex-col page-enter">
      {/* Page header */}
      <div className="px-6 pt-6 pb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Notes</h1>
        <p className="text-text-secondary text-sm mt-0.5">Capture your thoughts and ideas</p>
      </div>

      <div className="flex-1 min-h-0">
        <NotesList />
      </div>
    </div>
  );
}
