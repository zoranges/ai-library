import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function renderMarkdownLine(line: string, i: number): React.ReactNode {
  // Headers
  if (/^#{1,3}\s/.test(line)) {
    const level = line.match(/^(#{1,3})/)![0].length;
    const text = line.replace(/^#{1,3}\s/, '');
    const sizes = ['text-base', 'text-sm', 'text-xs'];
    return <div key={i} className={`${sizes[level - 1]} font-bold mt-2 mb-1 first:mt-0`}>{renderInline(text)}</div>;
  }

  // Code block
  if (line.startsWith('```')) return null;

  // Unordered list
  if (/^[-*]\s/.test(line)) {
    return <li key={i} className="ml-3 list-disc text-[13px] leading-relaxed">{renderInline(line.replace(/^[-*]\s/, ''))}</li>;
  }

  // Ordered list
  if (/^\d+\.\s/.test(line)) {
    return <li key={i} className="ml-3 list-decimal text-[13px] leading-relaxed">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>;
  }

  // Horizontal rule
  if (/^---+$/.test(line.trim())) return <hr key={i} className="my-2 border-border" />;

  // Empty line
  if (!line.trim()) return <div key={i} className="h-1.5" />;

  // Regular paragraph
  return <p key={i} className="text-[13px] leading-relaxed">{renderInline(line)}</p>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Bold and italic
  const regex = /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={match.index}><em>{match[2]}</em></strong>);
    } else if (match[3]) {
      parts.push(<strong key={match.index}>{match[4]}</strong>);
    } else if (match[5]) {
      parts.push(<em key={match.index}>{match[6]}</em>);
    } else if (match[7]) {
      parts.push(<code key={match.index} className="bg-bg-tertiary px-1 py-0.5 rounded text-[12px] text-accent">{match[8]}</code>);
    } else if (match[9]) {
      parts.push(<a key={match.index} href={match[11]} className="text-accent underline" target="_blank" rel="noopener">{match[10]}</a>);
    }
    last = regex.lastIndex;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export default function Markdown({ content, maxLength = 0 }: { content: string; maxLength?: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const displayContent = maxLength > 0 && !expanded && content.length > maxLength
    ? content.slice(0, maxLength) + '...'
    : content;

  const lines = displayContent.split('\n');
  let inCode = false;

  const rendered = lines.map((line, i) => {
    if (line.startsWith('```')) {
      inCode = !inCode;
      if (!inCode) return <div key={i} className="w-full h-px bg-border my-1" />;
      return null;
    }
    if (inCode) {
      return <pre key={i} className="text-[12px] text-text-secondary bg-bg-tertiary px-2 py-1 rounded overflow-x-auto my-0.5">{line}</pre>;
    }
    return renderMarkdownLine(line, i);
  });

  return (
    <div className="min-w-0">
      {rendered}
      {maxLength > 0 && content.length > maxLength && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-accent hover:text-accent-dark mt-1 font-medium"
        >
          {expanded ? t('common.collapse', 'Collapse') : t('common.expandAll', 'Expand all')}
        </button>
      )}
    </div>
  );
}
