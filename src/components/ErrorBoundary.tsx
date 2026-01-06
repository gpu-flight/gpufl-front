import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Result } from 'antd';

interface Props {
  children?: ReactNode;
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred.'}
            extra={[
              <Button type="primary" key="home" onClick={() => window.location.href = '/'}>
                Go to Home
              </Button>,
              <Button key="retry" onClick={() => this.setState({ hasError: false })}>
                Try Again
              </Button>,
            ]}
          >
            <div className="desc">
              <Alert
                message="Error Details"
                description={<pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>}
                type="error"
              />
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
