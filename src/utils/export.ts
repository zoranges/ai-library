import * as XLSX from 'xlsx';

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Report') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    csvRows.push(values.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchAndExport(
  fetchFn: () => Promise<any>,
  dataMapper: (data: any) => Record<string, unknown>[],
  filename: string,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  try {
    const res = await fetchFn();
    const data = dataMapper(res.data || res);
    if (format === 'xlsx') {
      exportToExcel(data, filename);
    } else {
      exportToCSV(data, filename);
    }
  } catch (err) {
    console.error('Export failed:', err);
  }
}

export function mapStudentReport(report: any): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (!report) return rows;

  rows.push({
    'Student Name': report.username,
    'Email': report.email,
    'School': report.schoolName,
    'Grade': report.grade,
    'Books Read': report.readingStats?.totalBooks || 0,
    'Books Completed': report.readingStats?.completedBooks || 0,
    'Total Pages': report.readingStats?.totalPages || 0,
    'Reading Minutes': report.readingStats?.totalMinutes || 0,
    'Average Quiz Score': report.quizStats?.avgScore || 0,
    'Quizzes Taken': report.quizStats?.totalQuizzes || 0,
  });

  if (report.sessions) {
    for (const s of report.sessions) {
      rows.push({
        'Type': 'Reading Session',
        'Book': s.bookTitle || s.bookId,
        'Start Page': s.startPage,
        'End Page': s.endPage,
        'Duration (s)': s.duration,
        'Date': s.endedAt || s.startedAt,
      });
    }
  }

  if (report.quizResults) {
    for (const q of report.quizResults) {
      rows.push({
        'Type': 'Quiz',
        'Book': q.bookTitle || q.bookId,
        'Score': `${q.score}%`,
        'Correct': `${q.correctAnswers}/${q.totalQuestions}`,
        'Date': q.completedAt,
      });
    }
  }

  return rows;
}
