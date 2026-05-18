import { useEffect, useState } from 'react';
import { BookOpen, Edit3, Trash2, Notebook } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { readingApi } from '@/utils/api';
import type { Note } from '@/types';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await readingApi.getNotes();
        const rawData = res.data;
        if (Array.isArray(rawData)) {
          setNotes(rawData);
        } else if (rawData && Array.isArray((rawData as any).data)) {
          setNotes((rawData as any).data);
        } else {
          setNotes([]);
        }
      } catch {
        setNotes([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await readingApi.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {} finally {
      setDeletingId(null);
    }
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  }

  async function saveEdit() {
    if (!editingNote) return;
    try {
      await readingApi.updateNote(editingNote.id, { title: editTitle, content: editContent });
      setNotes((prev) =>
        prev.map((n) => (n.id === editingNote.id ? { ...n, title: editTitle, content: editContent } : n))
      );
      setEditingNote(null);
    } catch {}
  }

  const grouped = notes.reduce<Record<string, Note[]>>((acc, note) => {
    const key = note.book?.title || 'Unknown Book';
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-accent/10 flex items-center justify-center">
          <Notebook className="w-8 h-8 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-bold text-text-secondary mt-3">No notes yet</p>
        <p className="text-xs text-text-tertiary mt-1">Add some notes while reading</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {Object.entries(grouped).map(([bookTitle, bookNotes]) => (
        <div key={bookTitle}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-3.5 h-3.5 text-text-tertiary" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-text-secondary">{bookTitle}</h3>
          </div>
          <div className="space-y-2">
            {bookNotes.map((note) => (
              <div
                key={note.id}
                className="bg-surface rounded-lg border border-border p-3.5 hover:shadow-1 transition-shadow duration-micro ease-out-quart"
                onMouseEnter={() => setHoveredId(note.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary line-clamp-3">{note.content}</p>
                    <div className="flex items-center gap-2.5 mt-2">
                      {note.page && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-accent bg-accent-subtle rounded tabular-nums">
                          P{note.page}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                        {new Date(note.updatedAt).toLocaleDateString('en-US')}
                      </span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-micro ease-out-quart ${hoveredId === note.id ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                      onClick={() => openEdit(note)}
                      className="p-1.5 text-text-tertiary hover:text-accent hover:bg-accent-subtle rounded-md transition-colors duration-micro ease-out-quart"
                    >
                      <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deletingId === note.id}
                      className="p-1.5 text-text-tertiary hover:text-error hover:bg-error-subtle rounded-md transition-colors duration-micro ease-out-quart"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal isOpen={!!editingNote} onClose={() => setEditingNote(null)} title="Edit Note" footer={
        <>
          <Button variant="ghost" onClick={() => setEditingNote(null)}>Cancel</Button>
          <Button onClick={saveEdit}>Save</Button>
        </>
      }>
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors duration-micro ease-out-quart"
            placeholder="Note title"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors duration-micro ease-out-quart resize-none"
            placeholder="Note content"
          />
        </div>
      </Modal>
    </div>
  );
}
