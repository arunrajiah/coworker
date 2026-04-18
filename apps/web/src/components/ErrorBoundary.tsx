'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
          <AlertTriangle className="h-10 w-10 text-destructive opacity-60" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
