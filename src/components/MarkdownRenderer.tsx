import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  return (
    <div className={`markdown-content h-fit p-0 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Style links
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            />
          ),
          // Style code blocks
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-white/10 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            ) : (
              <code className="block bg-white/5 p-3 rounded overflow-x-auto text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          // Style headings
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-semibold" {...props} />,
          // Style lists
          ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
          // Style blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-white/30 pl-4 italic text-white/70 p-0" {...props} />
          ),
          // Style paragraphs
          p: ({ node, ...props }) => <p {...props} />,
          // Style images
          img: ({ node, ...props }: any) => (
            <img
              {...props}
              className="max-w-full h-auto rounded"
              alt={props.alt || "Image"}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

