import { Component, ReactNode } from 'react';

/**
 * INSTRUMENTAÇÃO TEMPORÁRIA — não permanente.
 * Envolve o bloco de Localização em Consulta1Form pra capturar o erro que
 * está deixando a tela em branco quando a usuária seleciona um estado (UF).
 * Ao invés de derrubar a página toda, mostra o erro numa caixinha vermelha
 * E cospe no console.error o stack completo (que entra no meu contexto no
 * próximo turno). Depois de identificar a causa, este arquivo deve ser removido.
 */
interface Props { children: ReactNode }
interface State { error: Error | null }

export default class LocalizacaoErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[LocalizacaoErrorBoundary] blank-screen catch', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Localização caiu (instrumentação temporária)</p>
          <p className="mt-1 font-mono text-xs break-all">{this.state.error.message}</p>
          <p className="mt-2 text-xs">
            Você pode seguir preenchendo o resto da ficha normalmente. O erro
            completo foi enviado ao console — mande "deu ruim de novo" no chat
            que eu leio e conserto.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
