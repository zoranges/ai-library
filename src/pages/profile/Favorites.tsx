import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, BookOpen, X } from 'lucide-react';
import { favoriteApi } from '@/utils/api';
import type { Favorite } from '@/types';

export default function Favorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await favoriteApi.getFavorites();
        const rawData = res.data;
        if (Array.isArray(rawData)) {
          setFavorites(rawData);
        } else if (rawData && Array.isArray((rawData as any).data)) {
          setFavorites((rawData as any).data);
        } else {
          setFavorites([]);
        }
      } catch {
        setFavorites([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleRemove(bookId: string) {
    setRemovingId(bookId);
    try {
      await favoriteApi.removeFavorite(bookId);
      setFavorites((prev) => prev.filter((f) => f.bookId !== bookId));
    } catch {} finally {
      setRemovingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-lg" />)}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <Heart className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-text-tertiary mb-1">No favorites yet</p>
        <Link to="/books" className="text-sm text-accent hover:text-accent-hover transition-colors duration-micro ease-out-quart">
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
      {favorites.map((fav) => (
        <Link key={fav.id} to={`/books/${fav.bookId}`} className="group">
          <div className="bg-surface rounded-lg border border-border overflow-hidden hover:shadow-2 hover:-translate-y-0.5 transition-all duration-standard ease-out-quart relative">
            <div className="h-32 bg-accent/5 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-accent/20" strokeWidth={1.5} />
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(fav.bookId); }}
              disabled={removingId === fav.bookId}
              className="absolute top-2 right-2 p-1 rounded-md text-text-tertiary/0 group-hover:text-text-tertiary hover:text-error hover:bg-error-subtle transition-all duration-micro ease-out-quart"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <div className="p-3">
              <h3 className="text-sm font-medium text-text-primary line-clamp-1 group-hover:text-accent transition-colors duration-micro ease-out-quart">
                {fav.book?.title || '未知图书'}
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">{fav.book?.author || ''}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
