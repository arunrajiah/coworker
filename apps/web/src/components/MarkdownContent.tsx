'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  /** Pass true when the bubble is the user-sent message (dark bg) */
  isUser?: boolean
  className?: string
}

export function MarkdownContent({ content, isUser, className }: MarkdownContentProps) {
  return (
    <div className={cn('prose prose-sm max-w-none break-words', isUser && 'prose-invert', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Inline code
        code({ node, className: codeClass, children, ...props }) {
          const isBlock = codeClass?.includes('language-')
          if (isBlock) {
            return (
              <pre className={cn(
                'rounded-lg px-3 py-2.5 text-xs overflow-x-auto my-2',
                isUser
                  ? 'bg-white/10 text-white'
                  : 'bg-muted border border-border text-foreground'
              )}>
                <code className={codeClass} {...props}>
                  {children}
                </code>
              </pre>
            )
          }
          return (
            <code
              className={cn(
                'rounded px-1 py-0.5 text-xs font-mono',
                isUser
                  ? 'bg-white/20 text-white'
                  : 'bg-muted border border-border text-foreground'
              )}
              {...props}
            >
              {children}
            </code>
          )
        },
        // Paragraphs — no extra margin in a compact bubble
        p({ children }) {
          return <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
        },
        li({ children }) {
          return <li className="text-sm leading-relaxed">{children}</li>
        },
        // Headings — scale down inside a chat bubble
        h1({ children }) {
          return <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-sm font-medium mt-1.5 mb-0.5">{children}</h3>
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className={cn(
              'border-l-2 pl-3 my-1.5 italic text-sm',
              isUser ? 'border-white/40 text-white/80' : 'border-border text-muted-foreground'
            )}>
              {children}
            </blockquote>
          )
        },
        // Links
        a({ children, href }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'underline underline-offset-2',
                isUser ? 'text-white/90 hover:text-white' : 'text-primary hover:text-primary/80'
              )}
            >
              {children}
            </a>
          )
        },
        // Horizontal rule
        hr() {
          return <hr className={cn('my-2', isUser ? 'border-white/20' : 'border-border')} />
        },
        // Strong / em
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
