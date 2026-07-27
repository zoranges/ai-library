import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { leaderboardApi } from '@/utils/api';

const SESSION_KEY = 'welcome_card_shown';
const FALLBACK_IMAGE = '/card.jpg';

export default function WelcomeCard() {
  const [visible, setVisible] = useState(() => {
    const shown = sessionStorage.getItem(SESSION_KEY);
    return !shown;
  });
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [welcomeImage, setWelcomeImage] = useState<string>(FALLBACK_IMAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardApi.getMySchool()
      .then((res) => {
        const school = res.data;
        if (school?.name) {
          setSchoolName(school.name);
        }
        if (school?.welcomeImage) {
          setWelcomeImage(school.welcomeImage);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!visible) return null;

  const handleClose = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setVisible(false);
  };

  const displayName = schoolName ?? 'AI eBook Library';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-[75vw] w-full animate-in fade-in zoom-in duration-300">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image area */}
        <div className="bg-gray-100">
          <img
            src={welcomeImage}
            alt={displayName}
            className="w-full aspect-[16/9] sm:aspect-[21/9] object-cover"
          />
        </div>

        {/* Text area */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-6">
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-48 bg-white/20 rounded animate-pulse" />
              <div className="h-5 w-36 bg-white/15 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                {displayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-blue-200">
                AI eBook Library — Welcome to your digital reading journey
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
