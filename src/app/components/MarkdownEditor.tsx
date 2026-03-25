// 노션 스타일 마크다운 편집기: 클릭하면 편집, 포커스 벗어나면 렌더링
// Enter = 새 문단 (빈 줄 삽입으로 리스트 탈출), Shift+Enter = 같은 블록 내 줄바꿈
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter/Shift+Enter 모두 기본 동작 (단일 \n 삽입)
    // 문단 구분이 필요하면 Enter 두 번 (빈 줄)
    // 별도 인터셉트 없음
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="w-full border border-blue-300 rounded-lg p-3 text-sm resize-none outline-none focus:border-blue-400 bg-white font-mono ring-2 ring-blue-100 flex-1"
        style={{ minHeight: 0 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setEditing(false)}
        placeholder={placeholder || '마크다운으로 설명을 작성하세요…\n\n## 제목\n**볼드** 텍스트\n- 리스트 항목\n\nEnter: 새 문단 / Shift+Enter: 줄바꿈'}
      />
    );
  }

  // 마크다운 렌더링 대신 직접 렌더링하여 완전한 제어
  // \n\n = 문단 구분 (Enter), \n = 줄바꿈 (Shift+Enter, <br>)
  return (
    <div
      className="w-full border border-gray-200 rounded-lg p-3 cursor-text hover:border-gray-300 hover:bg-gray-50/50 transition-colors flex-1 overflow-y-auto"
      style={{ minHeight: 0 }}
      onClick={() => setEditing(true)}
    >
      {value ? (
        <RenderedMarkdown value={value} />
      ) : (
        <p className="text-gray-400 text-sm italic">
          {placeholder || '클릭하여 마크다운으로 설명을 작성하세요…'}
        </p>
      )}
    </div>
  );
}

/**
 * 마크다운 렌더링 컴포넌트
 * - 줄 단위로 렌더링 (Enter = \n = 새 줄)
 * - 빈 줄(\n\n) = 문단 간 여백
 * - 리스트(`-`)는 들여쓰기 + 불릿, 리스트 아닌 줄은 들여쓰기 없음
 */
function RenderedMarkdown({ value }: { value: string }) {
  const lines = value.split('\n');

  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 빈 줄 → 여백
    if (trimmed === '') {
      elements.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // 제목
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-[13px] mt-2 mb-1">{parseInline(trimmed.slice(4))}</h3>);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base mt-2.5 mb-1">{parseInline(trimmed.slice(3))}</h2>);
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg mt-3 mb-1.5">{parseInline(trimmed.slice(2))}</h1>);
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={i} className="my-2 border-gray-200" />);
      i++;
      continue;
    }

    // 리스트 블록: 연속된 `- ` / `* ` 줄을 하나의 <ul>로 묶기
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (lt.startsWith('- ') || lt.startsWith('* ')) {
          listLines.push(lt);
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={`list-${i}`} className="my-1 pl-5 list-disc">
          {listLines.map((ll, idx) => (
            <li key={idx} className="my-0">
              {parseInline(ll.slice(2))}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 인용문
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-gray-300 pl-3 text-gray-600">
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // 일반 텍스트 (들여쓰기 없음)
    elements.push(
      <p key={i} className="pl-0">
        {parseInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div className="text-[13px] leading-[1.6] text-gray-800">
      {elements}
    </div>
  );
}

// ... existing code ...
/** 인라인 마크다운 파싱 (볼드, 이탤릭, 코드, 링크) */
function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // 패턴: **볼드**, *이탤릭*, `코드`, [링크](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      result.push(text.slice(lastIdx, match.index));
    }
    if (match[2]) {
      // 볼드
      result.push(<strong key={match.index} className="text-gray-900">{match[2]}</strong>);
    } else if (match[3]) {
      // 이탤릭
      result.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      // 인라인 코드
      result.push(
        <code key={match.index} className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs">
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      // 링크
      result.push(
        <a key={match.index} href={match[6]} className="text-blue-600 underline">
          {match[5]}
        </a>
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx));
  }
  return result.length > 0 ? result : [text];
}