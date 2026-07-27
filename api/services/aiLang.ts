// UI language → the language the AI must respond in
export const AI_LANG_NAMES: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ms: 'Bahasa Melayu',
  ta: 'தமிழ்',
};

export function aiLangCode(language?: string): string {
  const code = (language || 'zh').split('-')[0].toLowerCase();
  return AI_LANG_NAMES[code] ? code : 'zh';
}

export function aiLangInstruction(language?: string): string {
  const code = aiLangCode(language);
  const name = AI_LANG_NAMES[code];
  return `\n\n重要规则：无论用户的消息、书籍内容或上下文是什么语言，你必须始终使用${name}（${code}）回答。所有解释、定义、翻译说明、推荐和回复正文都只能用${name}书写。`;
}
