"use client";
import Image from 'next/image';
import { Todo } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';

type TodoWithLinks = Todo & {
  dependencies: { dependency: Todo }[];
  dependents: { dependent: Todo }[];
};

function formatDate(value?: string | Date | null) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [newDue, setNewDue] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [newDuration, setNewDuration] = useState<string>('1');
  const [todos, setTodos] = useState<TodoWithLinks[]>([]);
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [imageFetching, setImageFetching] = useState<Record<string, boolean>>({});
  const [openEditor, setOpenEditor] = useState<string | null>(null);
  const [depSelection, setDepSelection] = useState<Record<string, Set<string>>>({});
  const [editingEffort, setEditingEffort] = useState<Record<string, boolean>>({});
  const [effortInput, setEffortInput] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos', { cache: 'no-store' });
      const data = await res.json();
      setTodos(data);
      // preserve per-card image loading states; only set when fetching a new image
      // initialize dependency selection for editor
      const sel: Record<string, Set<string>> = {};
      data.forEach((t: TodoWithLinks) => {
        sel[t.id] = new Set(t.dependencies.map((d) => d.dependency.id));
      });
      setDepSelection(sel);

      // initialize effort edit states
      const edit: Record<string, boolean> = {};
      const vals: Record<string, string> = {};
      data.forEach((t: TodoWithLinks) => {
        edit[t.id] = false;
        vals[t.id] = String(t.durationDays ?? 1);
      });
      setEditingEffort(edit);
      setEffortInput(vals);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    setAdding(true);
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: newDue || undefined, durationDays: Math.max(1, parseInt(newDuration || '1', 10) || 1) }),
      });
      setNewTodo('');
      setNewDue('');
      setNewDuration('1');
      await fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      await fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const toggleDep = (taskId: string, depId: string) => {
    setDepSelection((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[taskId] || []);
      if (set.has(depId)) set.delete(depId);
      else set.add(depId);
      copy[taskId] = set;
      return copy;
    });
  };

  const saveDeps = async (taskId: string) => {
    const dependencyIds = Array.from(depSelection[taskId] || []);
    try {
      const res = await fetch(`/api/todos/${taskId}/dependencies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to save dependencies');
      }
      await fetchTodos();
      setOpenEditor(null);
    } catch (e) {
      console.error('Failed to save dependencies', e);
    }
  };

  const addImageForTask = async (taskId: string) => {
    setImageFetching((s) => ({ ...s, [taskId]: true }));
    try {
      const res = await fetch(`/api/todos/${taskId}/image`, { method: 'POST' });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        alert(msg.error || 'Failed to fetch image');
      }
      setImageLoading((s) => ({ ...s, [taskId]: true }));
      await fetchTodos();
    } catch (e) {
      console.error('Failed to fetch image', e);
    } finally {
      setImageFetching((s) => ({ ...s, [taskId]: false }));
    }
  };

  const startEditEffort = (taskId: string, current: number) => {
    setEditingEffort((prev) => ({ ...prev, [taskId]: true }));
    setEffortInput((prev) => ({ ...prev, [taskId]: String(current) }));
  };

  const cancelEditEffort = (taskId: string) => {
    setEditingEffort((prev) => ({ ...prev, [taskId]: false }));
  };

  const saveEditEffort = async (taskId: string) => {
    const raw = effortInput[taskId] ?? '1';
    const val = Math.max(1, parseInt(raw, 10) || 1);
    try {
      const res = await fetch(`/api/todos/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: val }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        alert(msg.error || 'Failed to update effort');
        return;
      }
      await fetchTodos();
    } catch (e) {
      console.error('Failed to update effort', e);
    } finally {
      setEditingEffort((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const now = useMemo(() => new Date(), [todos.length]);

  // Compute a simple layered layout for graph visualization
  const graph = useMemo(() => {
    const idToNode = new Map<string, TodoWithLinks>();
    todos.forEach((t) => idToNode.set(t.id, t));
    const rev = new Map<string, Set<string>>(); // node -> dependencies
    const adj = new Map<string, Set<string>>(); // dependency -> dependents
    todos.forEach((t) => {
      rev.set(t.id, new Set(t.dependencies.map((d) => d.dependency.id)));
      t.dependencies.forEach((d) => {
        if (!adj.has(d.dependency.id)) adj.set(d.dependency.id, new Set());
        adj.get(d.dependency.id)!.add(t.id);
      });
      if (!adj.has(t.id)) adj.set(t.id, new Set());
    });
    // topo order
    const indeg = new Map<string, number>();
    todos.forEach((t) => indeg.set(t.id, rev.get(t.id)?.size || 0));
    const q: string[] = [];
    for (const [id, d] of Array.from(indeg)) if (d === 0) q.push(id);
    const order: string[] = [];
    let qi = 0;
    while (qi < q.length) {
      const u = q[qi++];
      order.push(u);
      for (const v of Array.from(adj.get(u) || new Set<string>()) as string[]) {
        const nd = (indeg.get(v) || 0) - 1;
        indeg.set(v, nd);
        if (nd === 0) q.push(v);
      }
    }
    const depth = new Map<string, number>();
    for (const id of order) {
      const parents = Array.from(rev.get(id) || []);
      const d = parents.length ? Math.max(...parents.map((p) => (depth.get(p) || 0) + 1)) : 0;
      depth.set(id, d);
    }
    const layers: string[][] = [];
    for (const [id, d] of Array.from(depth)) {
      if (!layers[d]) layers[d] = [];
      layers[d].push(id);
    }
    return { layers, depth };
  }, [todos]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 text-slate-800">
      <div className="max-w-5xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-semibold mb-6">Task Planner</h1>

        <div className="bg-white/80 backdrop-blur rounded-xl shadow p-4 mb-8">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="task-title" className="text-xs font-medium text-slate-600">Title</label>
              <input
                id="task-title"
                type="text"
                className="p-3 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Add a new task"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="task-due" className="text-xs font-medium text-slate-600">Due date</label>
              <input
                id="task-due"
                type="date"
                className="p-3 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                aria-label="Due date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="task-effort" className="text-xs font-medium text-slate-600">Estimated effort (days)</label>
              <input
                id="task-effort"
                type="number"
                min={1}
                className="p-3 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                aria-label="Estimated effort (days)"
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <button
                onClick={handleAddTodo}
                disabled={adding}
                className="w-full px-5 py-3 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {todos.map((todo) => {
            const overdue = todo.dueDate && new Date(todo.dueDate) < now;
            const deps = todo.dependencies.map((d) => d.dependency);
            return (
              <div key={todo.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
                {todo.imageUrl ? (
                  <div className="relative h-40 bg-slate-100">
                    <Image
                      src={todo.imageUrl}
                      alt={todo.title}
                      fill
                      className={`object-cover transition-opacity duration-300 ${imageLoading[todo.id] ? 'opacity-0' : 'opacity-100'}`}
                      onLoadingComplete={() => setImageLoading((s) => ({ ...s, [todo.id]: false }))}
                    />
                    {imageLoading[todo.id] && (
                      <div className="absolute inset-0 animate-pulse bg-slate-200 flex items-center justify-center text-slate-500">Loading image…</div>
                    )}
                  </div>
                ) : (
                  <div className="h-40 bg-slate-50 flex items-center justify-center">
                    <button
                      disabled={!!imageFetching[todo.id]}
                      onClick={() => addImageForTask(todo.id)}
                      className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {imageFetching[todo.id] ? 'Finding image…' : 'Find image'}
                    </button>
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-medium truncate">{todo.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* Due badge */}
                        {(() => {
                          const due = todo.dueDate ? new Date(todo.dueDate) : null;
                          if (!due) return <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">No due date</span>;
                          const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          if (days < 0)
                            return <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">Overdue by {Math.abs(days)}d</span>;
                          if (days === 0)
                            return <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">Due today</span>;
                          return <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">Due in {days}d</span>;
                        })()}
                        {/* Earliest window */}
                        {todo.earliestStart && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                            Earliest: {formatDate(todo.earliestStart)}
                            {todo.earliestFinish ? ` – ${formatDate(todo.earliestFinish)}` : ''}
                          </span>
                        )}
                        {/* Effort */}
                        {!editingEffort[todo.id] && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs">
                            Effort: {todo.durationDays}d
                          </span>
                        )}
                        {/* Critical */}
                        {todo.criticalPath && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">Critical</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-600"
                      title="Delete task"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-sm">
                    <div className="text-slate-600 mb-1">Dependencies:</div>
                    {deps.length ? (
                      <div className="flex flex-wrap gap-2">
                        {deps.map((d) => (
                          <span key={d.id} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs border border-slate-200">
                            {d.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400">None</div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setOpenEditor(openEditor === todo.id ? null : todo.id)}
                      className="text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                      {openEditor === todo.id ? 'Close dependency editor' : 'Edit dependencies'}
                    </button>

                    {openEditor === todo.id && (
                      <div className="mt-3 border border-slate-200 rounded p-3 max-h-60 overflow-auto bg-slate-50">
                        <div className="text-xs text-slate-500 mb-2">Select tasks this one depends on:</div>
                        <div className="flex flex-col gap-1">
                          {todos
                            .filter((t) => t.id !== todo.id)
                            .map((t) => {
                              const checked = depSelection[todo.id]?.has(t.id) || false;
                              return (
                                <label key={t.id} className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="accent-indigo-600"
                                    checked={checked}
                                    onChange={() => toggleDep(todo.id, t.id)}
                                  />
                                  <span>{t.title}</span>
                                </label>
                              );
                            })}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => saveDeps(todo.id)}
                            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setOpenEditor(null)}
                            className="px-3 py-1.5 rounded border border-slate-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Dependency Graph</h2>
          <div className="bg-white rounded-xl shadow p-4 overflow-auto">
            <svg
              width={Math.max(900, (graph.layers.reduce((m, l) => Math.max(m, l?.length || 0), 0) || 1) * 240)}
              height={(graph.layers.length || 1) * 180}
            >
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
                </marker>
              </defs>
              {graph.layers.map((layer, y) =>
                (layer || []).map((id, x) => {
                  const todo = todos.find((t) => t.id === id)!;
                  const deps = todo.dependencies.map((d) => d.dependency.id);
                  const cx = x * 240 + 20;
                  const cy = y * 180 + 20;
                  const esLabel = todo.earliestStart ? formatDate(todo.earliestStart) : null;
                  const efLabel = todo.earliestFinish ? formatDate(todo.earliestFinish) : null;
                  const earliestText = esLabel && efLabel ? `Earliest: ${esLabel} – ${efLabel}` : esLabel ? `Earliest: ${esLabel}` : '';
                  // draw edges from deps to this node
                  return (
                    <g key={id}>
                      {deps.map((fromId) => {
                        const fromDepth = graph.depth.get(fromId) || 0;
                        const fromIndex = graph.layers[fromDepth].indexOf(fromId);
                        const fx = fromIndex * 240 + 20 + 100; // center of node
                        const fy = fromDepth * 180 + 20 + 45;
                        const tx = cx + 100;
                        const ty = cy + 45;
                        return (
                          <line key={fromId + '->' + id} x1={fx} y1={fy} x2={tx} y2={ty} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />
                        );
                      })}
                      <rect x={cx} y={cy} width={200} height={90} rx={10} ry={10} fill={todo.criticalPath ? '#fde68a' : '#e2e8f0'} stroke="#cbd5e1" />
                      <text x={cx + 10} y={cy + 22} fontSize={12} fill="#0f172a">{todo.title}</text>
                      {earliestText && (
                        <text x={cx + 10} y={cy + 38} fontSize={11} fill="#475569">{earliestText}</text>
                      )}
                      <text x={cx + 10} y={cy + 54} fontSize={11} fill="#475569">Effort: {todo.durationDays}d</text>
                      <text x={cx + 10} y={cy + 70} fontSize={11} fill={todo.dueDate && new Date(todo.dueDate) < now ? '#dc2626' : '#475569'}>
                        {todo.dueDate ? `Due: ${formatDate(todo.dueDate)}` : 'No due date'}
                      </text>
                      <title>
                        {`${todo.title}\n${earliestText ? earliestText + '\n' : ''}Effort: ${todo.durationDays}d\n${todo.dueDate ? 'Due: ' + formatDate(todo.dueDate) : 'No due date'}${todo.criticalPath ? '\nCritical path' : ''}`}
                      </title>
                    </g>
                  );
                })
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
