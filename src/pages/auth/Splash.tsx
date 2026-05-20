import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ArrowRight } from 'lucide-react';

export default function Splash() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex">
      {/* Left: Content */}
      <div className="w-2/5 flex items-center px-12 lg:px-20">
        <div className="max-w-[480px] animate-fade-in">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="h-12 w-12 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
              <BookOpen className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-black text-text-primary font-heading tracking-tight">AI Library</span>
          </div>

          <h1 className="text-[52px] font-black text-text-primary font-heading leading-[1.05] tracking-tight">
            {t('auth.splashTitle')}
          </h1>

          <p className="mt-6 text-[17px] text-text-tertiary leading-relaxed max-w-[400px]">
            {t('auth.splashSubtitle')}
          </p>

          <Link
            to="/login"
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-accent text-white text-[16px] font-bold rounded-xl hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all duration-200 hover:gap-4"
          >
            {t('auth.getStarted')}
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Right: Dato */}
      <div
        className="hidden lg:block lg:w-3/5 bg-cover bg-no-repeat bg-center"
        style={{ backgroundImage: 'url(/启动页的拿督.png)' }}
      />
    </div>
  );
}
