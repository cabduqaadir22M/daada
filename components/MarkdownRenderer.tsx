
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const formatText = (text: string) => {
    // Basic regex for code blocks
    const parts = text.split(/(\`\`\`[\s\S]*?\`\`\`)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/\`\`\`(\w+)?\n?([\s\S]*?)\n?\`\`\`/);
        const language = match?.[1] || 'neural_code';
        const code = match?.[2] || '';
        
        return (
          <div key={index} className="my-6 rounded-3xl bg-zinc-950 border border-white/5 overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-6 py-3 bg-zinc-900/50 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{language}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(code)}
                className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-white transition-colors"
              >
                Copy Unit
              </button>
            </div>
            <pre className="p-6 overflow-x-auto bg-black">
              <code className="text-[13px] font-mono text-emerald-400 leading-relaxed block">{code}</code>
            </pre>
          </div>
        );
      }
      
      const inlineRegex = /(\*\*.*?\*\*|\[.*?\]\(.*?\)|https?:\/\/[^\s\n,)]+)/g;
      const inlineParts = part.split(inlineRegex);

      return (
        <span key={index} className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {inlineParts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={i} className="font-black text-black dark:text-white underline decoration-blue-500/30 underline-offset-4">{p.slice(2, -2)}</strong>;
            }
            if (p.startsWith('[') && p.includes('](') && p.endsWith(')')) {
              const match = p.match(/\[(.*?)\]\((.*?)\)/);
              if (match) {
                return (
                  <a 
                    key={i} 
                    href={match[2]} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 dark:text-blue-400 font-black hover:underline decoration-2"
                  >
                    {match[1]}
                  </a>
                );
              }
            }
            if (p.startsWith('http')) {
              const cleanUrl = p.replace(/[.,!?;:]$/, '');
              const suffix = p.slice(cleanUrl.length);
              return (
                <React.Fragment key={i}>
                  <a 
                    href={cleanUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 dark:text-blue-400 font-black hover:underline decoration-2"
                  >
                    {cleanUrl}
                  </a>
                  {suffix}
                </React.Fragment>
              );
            }
            return p;
          })}
        </span>
      );
    });
  };

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:font-black prose-headings:tracking-tight prose-strong:text-black dark:prose-strong:text-white">
      {formatText(content)}
    </div>
  );
};
