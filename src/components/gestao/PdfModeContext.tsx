import { createContext } from 'react';

/**
 * Quando true, componentes filhos suprimem elementos interativos
 * (ícones de tooltip ⓘ, links "Ver pacientes →", etc.) ao serem
 * renderizados off-screen para captura em PDF.
 */
export const PdfModeContext = createContext<boolean>(false);
