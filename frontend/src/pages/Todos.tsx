import TodoStats from '../components/todos/TodoStats';
import TodoList from '../components/todos/TodoList';

export default function Todos() {
  return (
    <div className="h-full flex flex-col page-enter">
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">To Do</h1>
        <p className="text-text-secondary text-sm mt-0.5">Tackle your tasks, one by one</p>
      </div>

      {/* Stats panel */}
      <div className="px-6 pb-4 flex-shrink-0">
        <TodoStats />
      </div>

      {/* Main list */}
      <div className="flex-1 min-h-0 overflow-hidden border-t border-border">
        <TodoList />
      </div>
    </div>
  );
}
