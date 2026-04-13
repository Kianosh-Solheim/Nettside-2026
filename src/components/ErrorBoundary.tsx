import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import Button from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        // Not a JSON error message, use the raw message if available
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-serif mb-4">Something went wrong</h2>
            <p className="text-ink/60 text-sm mb-8 leading-relaxed">
              {isFirestoreError ? (
                <span className="font-mono text-[10px] bg-red-50 p-2 rounded block text-left overflow-auto max-h-32">
                  {errorMessage}
                </span>
              ) : (
                errorMessage
              )}
            </p>
            <Button
              onClick={this.handleReset}
              magnetic={true}
              className="inline-flex items-center space-x-2 px-8 py-4 bg-accent text-paper"
              icon={RefreshCcw}
            >
              <span>Try Again</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
