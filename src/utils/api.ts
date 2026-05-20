import type { ApiResponse, LoginRequest, RegisterRequest, BookFilter, PaginatedResponse } from '@/types';

const BASE_URL = '/api';

function getToken(): string | null {
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || errorData.error || `请求失败: ${response.status}`);
    error.response = { data: errorData, status: response.status };
    throw error;
  }

  return response.json();
}

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const authApi = {
  login: (data: LoginRequest) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<any>('/auth/me'),

  forgotPassword: (email: string) =>
    request<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};

export const bookApi = {
  getBooks: (filters?: BookFilter & { page?: number; pageSize?: number }) =>
    request<PaginatedResponse<any>>(`/books${buildQueryString(filters || {})}`),

  getBookById: (id: string) =>
    request<any>(`/books/${id}`),

  getCategories: () =>
    request<any[]>('/books/categories'),

  getBookQuiz: (bookId: string) =>
    request<any>(`/books/${bookId}/quiz`),
};

export const readingApi = {
  getProgress: (bookId: string) =>
    request<any>(`/reading/progress/${bookId}`),

  getProgressList: () =>
    request<any[]>('/reading/progress'),

  saveProgress: (data: { bookId: string; currentPage: number; totalPages: number; percentage: number; isCompleted: boolean; lastPosition?: string }) =>
    request<any>('/reading/progress', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createSession: (data: { bookId: string; startPage: number; endPage: number; duration: number; startedAt: string; endedAt: string }) =>
    request<any>('/reading/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHighlights: (bookId: string) =>
    request<any[]>(`/learning/highlights${buildQueryString({ bookId })}`),

  addHighlight: (data: { bookId: string; text: string; color: string; page: number; note?: string }) =>
    request<any>('/learning/highlights', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getNotes: (bookId?: string) =>
    request<any[]>(`/learning/notes${bookId ? buildQueryString({ bookId }) : ''}`),

  createNote: (data: { bookId: string; title: string; content: string; page?: number; isPublic: boolean }) =>
    request<any>('/learning/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNote: (id: string, data: Partial<{ title: string; content: string; page: number; isPublic: boolean }>) =>
    request<any>(`/learning/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNote: (id: string) =>
    request<void>(`/learning/notes/${id}`, { method: 'DELETE' }),

  getHistory: (params?: { page?: number; pageSize?: number }) =>
    request<PaginatedResponse<any>>(`/reading/history${buildQueryString(params || {})}`),

  getStats: () =>
    request<any>('/reading/stats'),

  getReport: () =>
    request<any>('/reading/report'),
};

export const favoriteApi = {
  getFavorites: (params?: { page?: number; pageSize?: number }) =>
    request<PaginatedResponse<any>>(`/learning/favorites${buildQueryString(params || {})}`),

  addFavorite: (bookId: string) =>
    request<any>('/learning/favorites', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    }),

  removeFavorite: (bookId: string) =>
    request<void>(`/learning/favorites/${bookId}`, { method: 'DELETE' }),

  checkFavorite: (bookId: string) =>
    request<{ isFavorite: boolean }>(`/learning/favorites/check/${bookId}`),

  getBookmarks: (bookId?: string) =>
    request<any[]>(`/learning/bookmarks${bookId ? buildQueryString({ bookId }) : ''}`),

  addBookmark: (data: { bookId: string; cfi: string; label?: string; page?: number }) =>
    request<any>('/learning/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteBookmark: (id: string) =>
    request<void>(`/learning/bookmarks/${id}`, { method: 'DELETE' }),
};

export const quizApi = {
  getQuiz: (bookId: string) =>
    request<any>('/ai/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ bookId, count: 5 }),
    }),

  submitQuiz: (data: { bookId: string; answers: number[]; questions?: Array<{ correctAnswer: number }>; timeSpent: number }) =>
    request<any>('/ai/quiz/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getResults: (bookId?: string) =>
    request<any[]>(`/ai/quiz/results${bookId ? buildQueryString({ bookId }) : ''}`),
};

export const achievementApi = {
  getAchievements: () =>
    request<any[]>('/leaderboard/achievements'),

  getUserAchievements: () =>
    request<any[]>('/auth/me'),

  getBadges: () =>
    request<any[]>('/leaderboard/badges'),

  getUserBadges: () =>
    request<any[]>('/leaderboard/badges'),

  equipBadge: (badgeId: string) =>
    request<void>(`/leaderboard/badges/${badgeId}/equip`, {
      method: 'POST',
    }),
};

export const pointApi = {
  getRecords: (page?: number, pageSize?: number) =>
    request<PaginatedResponse<any>>(`/leaderboard/points${buildQueryString({ page, pageSize })}`),

  getSummary: () =>
    request<any>('/reading/stats'),
};

export const leaderboardApi = {
  getLeaderboard: (params?: { schoolId?: string; district?: string; state?: string; country?: string; period?: 'month' | 'year' | 'all'; region?: string; regionId?: string; type?: string; page?: number; pageSize?: number }) =>
    request<any>(`/leaderboard${buildQueryString(params || {})}`),

  getSchoolLeaderboard: (schoolId: string, params?: { period?: 'month' | 'year' | 'all' }) =>
    request<any[]>(`/leaderboard${buildQueryString({ schoolId, ...params })}`),
};

export const statsApi = {
  getReadingStats: () =>
    request<any>('/reading/stats'),

  getDashboardData: () =>
    request<any>('/admin/dashboard'),
};

export const aiApi = {
  chat: (data: { message: string; bookId?: string; page?: number; pageText?: string }) =>
    request<{ message: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  explain: (data: { text: string; bookId: string; page?: number }) =>
    request<{ explanation: string }>('/ai/explain', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  define: (data: { word: string; bookId: string }) =>
    request<{ definition: string }>('/ai/define', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  translate: (data: { text: string; bookId: string; page?: number }) =>
    request<{ translation: string }>('/ai/translate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  searchInDocument: (bookId: string, query: string) =>
    request<{ results: Array<{ page: number; text: string; context: string }> }>('/ai/search-document', {
      method: 'POST',
      body: JSON.stringify({ bookId, query }),
    }),
};

export const adminApi = {
  getDashboard: (params?: { dateRange?: string }) =>
    request<any>(`/admin/dashboard${buildQueryString(params || {})}`),

  getSchools: (params?: { page?: number; pageSize?: number; search?: string }) =>
    request<PaginatedResponse<any>>(`/admin/schools${buildQueryString(params || {})}`),

  createSchool: (data: any) =>
    request<any>('/admin/schools', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSchool: (id: string, data: any) =>
    request<any>(`/admin/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSchool: (id: string) =>
    request<void>(`/admin/schools/${id}`, { method: 'DELETE' }),

  getStudents: (params?: { page?: number; pageSize?: number; schoolId?: string; search?: string }) =>
    request<PaginatedResponse<any>>(`/admin/students${buildQueryString(params || {})}`),

  getStudentById: (id: string) =>
    request<any>(`/admin/students/${id}`),

  updateStudent: (id: string, data: any) =>
    request<any>(`/admin/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteStudent: (id: string) =>
    request<void>(`/admin/students/${id}`, { method: 'DELETE' }),

  getBooks: (params?: { page?: number; pageSize?: number; search?: string; categoryId?: string }) =>
    request<PaginatedResponse<any>>(`/admin/books${buildQueryString(params || {})}`),

  createBook: (data: FormData) =>
    fetch(`${BASE_URL}/admin/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: data,
    }).then((r) => r.json()),

  updateBook: (id: string, data: FormData) =>
    fetch(`${BASE_URL}/admin/books/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: data,
    }).then((r) => r.json()),

  deleteBook: (id: string) =>
    request<void>(`/admin/books/${id}`, { method: 'DELETE' }),

  getAdmins: () =>
    request<any[]>('/admin/admins'),

  createAdmin: (data: any) =>
    request<any>('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdmin: (id: string, data: any) =>
    request<any>(`/admin/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAdmin: (id: string) =>
    request<void>(`/admin/admins/${id}`, { method: 'DELETE' }),

  getStatistics: (params?: { period?: string; schoolId?: string }) =>
    request<any>(`/admin/statistics${buildQueryString(params || {})}`),

  getLeaderboard: (params?: { schoolId?: string; period?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<any>>(`/admin/leaderboard${buildQueryString(params || {})}`),

  updateAccount: (data: any) =>
    request<any>('/admin/account', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<void>('/admin/account/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadAvatar: (data: { avatar: string }) =>
    request<any>('/admin/account/avatar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAccountDevices: () =>
    request<any[]>('/admin/account/devices'),

  toggleIpBinding: (data: { enabled: boolean }) =>
    request<any>('/admin/account/ip-bind', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    request<void>('/admin/account', { method: 'DELETE' }),

  switchRole: (role: string) =>
    request<void>('/admin/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  deregisterStudent: (id: string) =>
    request<void>(`/admin/students/${id}`, { method: 'DELETE' }),

  reregisterStudent: (id: string) =>
    request<void>(`/admin/students/${id}/reregister`, { method: 'POST' }),

  getStudentReport: (id: string, params?: { startDate?: string; endDate?: string }) =>
    request<any>(`/admin/students/${id}/report${buildQueryString(params || {})}`),

  getTeachers: (params?: { page?: number; pageSize?: number; schoolId?: string }) =>
    request<PaginatedResponse<any>>(`/admin/teachers${buildQueryString(params || {})}`),

  createTeacher: (data: any) =>
    request<any>('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTeacher: (id: string, data: any) =>
    request<any>(`/admin/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTeacher: (id: string) =>
    request<void>(`/admin/teachers/${id}`, { method: 'DELETE' }),

  exportStudentReport: (id: string, params?: { startDate?: string; endDate?: string }) =>
    request<any>(`/admin/export/student-report/${id}${buildQueryString(params || {})}`),

  exportSchoolReport: (schoolId: string) =>
    request<any>(`/admin/export/school-report/${schoolId}`),

  exportStudentsReport: (studentIds: string[]) =>
    request<any>(`/admin/export/students-report?studentIds=${studentIds.join(',')}`),

  getAIConfig: () =>
    request<any[]>('/admin/ai-config'),

  createAIConfig: (data: any) =>
    request<any>('/admin/ai-config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAIConfig: (key: string, data: any) =>
    request<any>(`/admin/ai-config/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAIConfig: (key: string) =>
    request<void>(`/admin/ai-config/${key}`, { method: 'DELETE' }),

  search: (q: string, limit?: number) =>
    request<any>(`/admin/search${buildQueryString({ q, limit })}`),
};

export const userApi = {
  getProfile: () =>
    request<any>('/auth/me'),

  updateProfile: (data: any) =>
    request<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<void>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getReadingHistory: (params?: { page?: number; pageSize?: number }) =>
    request<PaginatedResponse<any>>(`/reading/history${buildQueryString(params || {})}`),
};
