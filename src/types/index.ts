export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  schoolId: string;
  grade?: string;
  role: 'student' | 'teacher' | 'admin' | 'super_admin';
  points: number;
  level: number;
  preferredLanguage?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  isDeregistered?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface School {
  id: string;
  name: string;
  address?: string;
  district?: string;
  state?: string;
  country?: string;
  contactPhone?: string;
  contactEmail?: string;
  studentCount: number;
  bookCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface BookCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  bookCount: number;
  parentId?: string;
  sortOrder: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
  description?: string;
  categoryId: string;
  category?: BookCategory;
  publisher?: string;
  publishDate?: string;
  pageCount: number;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  ratingCount: number;
  readCount: number;
  favoriteCount: number;
  tags: string[];
  copyright?: string;
  fileUrl?: string;
  fileType?: string;
  textContent?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  book?: Book;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt: string;
  lastPosition?: string;
  isCompleted: boolean;
  completedAt?: string;
  startedAt: string;
}

export interface ReadingSession {
  id: string;
  userId: string;
  bookId: string;
  book?: Book;
  startPage: number;
  endPage: number;
  duration: number;
  startedAt: string;
  endedAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  bookId: string;
  book?: Book;
  createdAt: string;
}

export interface Highlight {
  id: string;
  userId: string;
  bookId: string;
  text: string;
  color: string;
  page: number;
  note?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  bookId: string;
  book?: Book;
  title: string;
  content: string;
  page?: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  order: number;
}

export interface QuizResult {
  id: string;
  userId: string;
  bookId: string;
  book?: Book;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  answers: number[];
  completedAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'reading' | 'quiz' | 'streak' | 'social' | 'special';
  condition: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  achievement?: Achievement;
  unlockedAt: string;
  isNotified: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'reading' | 'quiz' | 'streak' | 'social' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge?: Badge;
  isEquipped: boolean;
  unlockedAt: string;
}

export interface PointRecord {
  id: string;
  userId: string;
  points: number;
  type: 'reading' | 'quiz' | 'achievement' | 'daily' | 'bonus';
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface Admin {
  id: string;
  userId: string;
  user?: User;
  schoolId: string;
  school?: School;
  role: 'admin' | 'super_admin';
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  user?: User;
  schoolId: string;
  school?: School;
  points: number;
  booksRead: number;
  quizzesCompleted: number;
  streak: number;
  level: number;
}

export interface ReadingStats {
  totalBooks: number;
  completedBooks: number;
  totalPages: number;
  totalMinutes: number;
  averageSpeed: number;
  streak: number;
  longestStreak: number;
  quizAverage: number;
  points: number;
  level: number;
  weeklyMinutes: number[];
  monthlyBooks: number[];
  categoryDistribution: { category: string; count: number }[];
}

export interface ReadingGrowth {
  months: string[];
  booksPerMonth: number[];
  minutesPerMonth: number[];
  pointsPerMonth: number[];
  quizzesPerMonth: number[];
  milestones: GrowthMilestone[];
}

export interface GrowthMilestone {
  date: string;
  type: 'book_completed' | 'quiz_mastered' | 'streak_reached' | 'points_earned' | 'level_up';
  title: string;
  description: string;
  icon: string;
}

export interface DashboardData {
  totalStudents: number;
  totalBooks: number;
  totalSchools: number;
  activeReaders: number;
  booksReadThisMonth: number;
  averageQuizScore: number;
  topSchools: School[];
  recentActivities: ActivityItem[];
  readingTrend: { date: string; count: number }[];
}

export interface ActivityItem {
  id: string;
  userId: string;
  user?: User;
  type: 'reading' | 'quiz' | 'achievement' | 'favorite';
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    bookId?: string;
    page?: number;
    type?: 'explain' | 'define' | 'translate' | 'chat' | 'voice';
    books?: Array<{
      id: string;
      title: string;
      author: string;
      coverUrl: string;
      description: string;
      rating: number;
      pageCount: number;
      difficulty: string;
      category?: { name: string; icon?: string; color?: string } | null;
    }>;
  };
}

export interface AIConfig {
  id: string;
  configKey: string;
  configValue: string;
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface DocumentSearchResult {
  page: number;
  text: string;
  context: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

export interface LoginRequest {
  email?: string;
  icNumber?: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
  schoolId: string;
  icNumber: string;
  grade?: string;
  preferredLanguage?: string;
}

export interface BookFilter {
  categoryId?: string;
  difficulty?: Book['difficulty'];
  language?: string;
  search?: string;
  sortBy?: 'title' | 'author' | 'rating' | 'readCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ms' | 'zh' | 'ta';
