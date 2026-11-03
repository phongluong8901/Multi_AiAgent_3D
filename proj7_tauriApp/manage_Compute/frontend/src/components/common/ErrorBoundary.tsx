import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[REACT_ERROR_BOUNDARY]', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-300 select-none">
                    <div className="p-3 rounded-full bg-rose-950/60 border border-rose-800/60 mb-3 text-rose-400">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                        {this.props.fallbackTitle || 'Component Render Error'}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono max-w-md text-center mb-4 truncate">
                        {this.state.error?.message || 'An unexpected rendering exception occurred.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reload Component</span>
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

