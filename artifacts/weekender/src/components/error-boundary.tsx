import { Component, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  resetKey?: any;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 px-4">
          <h1 className="text-4xl font-black text-destructive drop-shadow-md">Oops!</h1>
          <h2 className="text-xl font-bold text-white uppercase">Something went wrong.</h2>
          <p className="text-muted-foreground font-mono max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div className="pt-4">
            <Button onClick={() => this.setState({ hasError: false, error: undefined })} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
