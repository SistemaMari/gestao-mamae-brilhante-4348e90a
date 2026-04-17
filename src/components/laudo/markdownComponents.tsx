import type { Components } from 'react-markdown';

type Variante = 'lilas' | 'menta';

const TOKENS = {
  lilas: {
    h3: 'text-[#5B21B6]',
    strong: 'text-[#5B21B6]',
    p: 'text-[#4C1D95]',
    li: 'text-[#4C1D95]',
    blockquote: 'border-l-4 border-[#9b87f5] bg-white/50 text-[#5B21B6]',
  },
  menta: {
    h3: 'text-[#0D7364]',
    strong: 'text-[#0D7364]',
    p: 'text-[#115E59]',
    li: 'text-[#115E59]',
    blockquote: 'border-l-4 border-[#5EEAD4] bg-white/60 text-[#0D7364]',
  },
} as const;

export function buildMarkdownComponents(variante: Variante): Components {
  const t = TOKENS[variante];
  return {
    h3: ({ children }) => (
      <h3 className={`mt-3 mb-1.5 font-heading text-sm font-semibold ${t.h3}`}>{children}</h3>
    ),
    p: ({ children }) => (
      <p className={`text-sm leading-relaxed ${t.p}`}>{children}</p>
    ),
    strong: ({ children }) => (
      <strong className={`font-semibold ${t.strong}`}>{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="list-disc pl-5 space-y-1 my-1.5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 space-y-1 my-1.5">{children}</ol>
    ),
    li: ({ children }) => (
      <li className={`text-sm leading-relaxed ${t.li}`}>{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className={`my-2 rounded-r-md px-3 py-2 text-sm italic ${t.blockquote}`}>
        {children}
      </blockquote>
    ),
    a: ({ children, href }) => (
      <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
  };
}
