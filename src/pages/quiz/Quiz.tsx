import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Trophy, ChevronLeft, Star, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { quizApi, bookApi } from '@/utils/api';
import type { QuizQuestion, QuizResult } from '@/types';

export default function Quiz() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [bookTitle, setBookTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [showPointsAnim, setShowPointsAnim] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    async function load() {
      setIsLoading(true);
      try {
        const [quizRes, bookRes, resultsRes] = await Promise.all([
          quizApi.getQuiz(bookId),
          bookApi.getBookById(bookId),
          quizApi.getResults(bookId),
        ]);
        setBookTitle(bookRes.data?.title || '');
        setQuestions(quizRes.data?.questions || []);
        setAnswers(new Array(quizRes.data?.questions?.length || 0).fill(-1));
        const existing = (resultsRes.data || []).find((r: QuizResult) => r.bookId === bookId);
        if (existing) {
          setResult(existing);
          setAlreadyCompleted(true);
        }
      } catch {} finally {
        setIsLoading(false);
      }
    }
    load();
  }, [bookId]);

  async function handleSubmit() {
    if (!bookId || answers.includes(-1)) return;
    setSubmitting(true);
    try {
      const res = await quizApi.submitQuiz({ bookId, answers, questions, timeSpent: 0 });
      setResult(res.data);
      setShowPointsAnim(true);
      setTimeout(() => setShowPointsAnim(false), 3000);
    } catch {} finally {
      setSubmitting(false);
    }
  }

  function selectOption(optIdx: number) {
    if (result) return;
    const next = [...answers];
    next[currentQ] = optIdx;
    setAnswers(next);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <div className="skeleton w-full max-w-2xl h-96" />
      </div>
    );
  }

  if (alreadyCompleted && result) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-accent mb-8 transition-colors duration-micro ease-out-quart"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          {t('common.back')}
        </button>
        <div className="bg-surface rounded-xl border border-border p-10 text-center animate-scale-in">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-success-subtle rounded-lg mb-5">
            <CheckCheck className="w-6 h-6 text-success" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary font-heading mb-1">{bookTitle}</h2>
          <p className="text-sm text-text-tertiary mb-8">{t('quiz.alreadyCompleted')}</p>
          <div className="flex items-center justify-center gap-12">
            <div className="text-center">
              <div className="text-3xl font-mono font-medium text-text-primary tabular-nums">
                {result.correctAnswers}<span className="text-text-tertiary">/{result.totalQuestions}</span>
              </div>
              <div className="text-xs text-text-tertiary mt-1">{t('quiz.correctAnswers')}</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-mono font-medium text-text-primary tabular-nums">
                {result.score}
              </div>
              <div className="text-xs text-text-tertiary mt-1">{t('quiz.score')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (result && !alreadyCompleted) {
    const earned = result.correctAnswers;
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface rounded-xl border border-border p-10 text-center animate-scale-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-warning-subtle rounded-xl mb-5">
            <Trophy className="w-7 h-7 text-warning" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary font-heading mb-6">{t('quiz.completed')}</h2>
          <div className="text-4xl font-mono font-medium text-text-primary tabular-nums mb-2">
            {result.correctAnswers}<span className="text-text-tertiary">/{result.totalQuestions}</span>
          </div>
          <p className="text-sm text-text-tertiary mb-4">{t('quiz.correctAnswers')}</p>
          <div className={`inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-emphasized ease-out-quart ${showPointsAnim ? 'text-warning scale-110' : 'text-text-secondary'}`}>
            <Star className="w-4 h-4 text-warning" strokeWidth={1.5} />
            {t('quiz.pointsEarned')}: {earned}
          </div>
          <div className="mt-8 space-y-2 text-left">
            {questions.map((q, i) => {
              const isCorrect = answers[i] === q.correctAnswer;
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-2.5 text-sm p-3 rounded-lg ${
                    isCorrect ? 'bg-success-subtle' : 'bg-error-subtle'
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-success shrink-0" strokeWidth={1.5} />
                  ) : (
                    <XCircle className="w-4 h-4 text-error shrink-0" strokeWidth={1.5} />
                  )}
                  <span className="text-text-primary">{t('quiz.question')} {i + 1}</span>
                  {!isCorrect && (
                    <span className="text-text-tertiary ml-auto text-xs">
                      {t('quiz.correctAnswers')}: {q.options[q.correctAnswer]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Button className="mt-8" onClick={() => navigate(-1)}>{t('common.back')}</Button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return <div className="text-center py-16 px-4 text-text-tertiary">{t('quiz.noQuestions')}</div>;

  return (
    <div className="max-w-xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-accent mb-8 transition-colors duration-micro ease-out-quart"
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        {t('common.back')}
      </button>

      <div className="mb-6">
        <h1 className="text-lg font-extrabold text-text-primary font-heading">{t('quiz.title')}</h1>
        <p className="text-sm text-text-tertiary mt-0.5">{bookTitle}</p>
      </div>

      <div className="mb-4">
        <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-emphasized ease-out-quart"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-8">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-standard ease-out-quart ${
              i === currentQ
                ? 'bg-accent ring-2 ring-accent ring-offset-2 ring-offset-bg-primary'
                : i < currentQ || answers[i] !== -1
                  ? 'bg-accent'
                  : 'bg-border'
            }`}
          />
        ))}
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono font-medium text-accent tabular-nums">Q{currentQ + 1}</span>
        </div>
        <p className="text-base font-semibold text-text-primary leading-relaxed">{q.question}</p>
      </div>

      <div className="space-y-2.5 mb-8">
        {q.options.map((opt, idx) => {
          const isSelected = answers[currentQ] === idx;
          return (
            <button
              key={idx}
              onClick={() => selectOption(idx)}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-micro ease-out-quart ${
                isSelected
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border hover:border-border-strong hover:bg-surface-raised'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-micro ease-out-quart ${
                    isSelected
                      ? 'border-accent bg-accent'
                      : 'border-border'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                </div>
                <span className={`text-sm ${isSelected ? 'text-accent font-medium' : 'text-text-primary'}`}>
                  {opt}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={currentQ === 0}
          onClick={() => setCurrentQ(currentQ - 1)}
        >
          {t('quiz.previous')}
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button
            disabled={answers[currentQ] === -1}
            onClick={() => setCurrentQ(currentQ + 1)}
          >
            {t('quiz.next')}
          </Button>
        ) : (
          <Button
            disabled={answers.includes(-1)}
            loading={submitting}
            onClick={handleSubmit}
          >
            {t('quiz.submitAll')}
          </Button>
        )}
      </div>
    </div>
  );
}
