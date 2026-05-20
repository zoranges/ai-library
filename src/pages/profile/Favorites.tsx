import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, BookOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BookCover from '@/components/BookCover';
import { favoriteApi } from '@/utils/api';
import type { Favorite } from '@/types';

export default function Favorites() {
  const { t } = useTranslation();
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
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-accent/10 flex items-center justify-center">
          <Heart className="w-8 h-8 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-bold text-text-secondary mt-3">{t('common.noData')}</p>
        <Link to="/books" className="inline-block mt-2 text-sm font-bold text-accent hover:text-accent-hover transition-colors">
          {t('home.allBooks')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
      {favorites.map((fav) => (
        <Link key={fav.id} to={`/books/${fav.bookId}`} className="group">
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-1 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-200 relative">
            <div className="h-32 relative">
              <BookCover book={{ id: fav.bookId, fileUrl: fav.book?.fileUrl, fileType: fav.book?.fileType, coverUrl: fav.book?.coverUrl }} className="w-full h-full" iconClassName="w-8 h-8 text-accent/30" />
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(fav.bookId); }}
              disabled={removingId === fav.bookId}
              className="absolute top-2 right-2 p-1 rounded-md text-text-tertiary/0 group-hover:text-text-tertiary hover:text-error hover:bg-error-subtle transition-all duration-micro ease-out-quart"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <div className="p-3">
              <h3 className="text-sm font-bold text-text-primary line-clamp-1 group-hover:text-accent transition-colors duration-200">
                {fav.book?.title || t('books.title')}
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">{fav.book?.author || ''}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
