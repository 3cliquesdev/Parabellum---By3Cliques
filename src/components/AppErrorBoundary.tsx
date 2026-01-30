import React from "react";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  handleForceUpdate = async () => {
    try {
      // Importação dinâmica para evitar problemas de circular dependency
      const { hardRefresh } = await import('@/lib/build/ensureLatestBuild');
      await hardRefresh();
    } catch (e) {
      // Fallback: reload simples se a importação falhar
      console.error("Erro ao executar hardRefresh:", e);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md text-center space-y-6">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold">Atualização importante</h1>
            <p className="text-muted-foreground">
              Detectamos que seu navegador está usando uma versão antiga do sistema.
              Para garantir o funcionamento correto, precisamos atualizar agora.
            </p>
            <button
              onClick={this.handleForceUpdate}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Atualizar agora
            </button>
            
            {/* Detalhes técnicos escondidos para devs */}
            {isDev && this.state.error && (
              <details className="text-left text-xs text-muted-foreground mt-4">
                <summary className="cursor-pointer hover:text-foreground transition-colors">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-40 text-destructive">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {"\n\n"}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
