import { forwardRef, useState, useId } from 'react';
import { Input } from '@/components/ui/input';
import { validarDataClinica } from '@/lib/dateUtils';

/**
 * DateInput — input de data clínica com validação onBlur (Prompt 34B seção 3.10).
 *
 * Bloqueia datas inválidas no calendário (30/02, 31/04, 31/11) com mensagem
 * inline em vermelho. NÃO bloqueia datas vazias — quem decide se o campo é
 * obrigatório é o form (mesma fonte do isValid usado para "Salvar e finalizar").
 *
 * Contrato:
 *   <DateInput
 *     value={data}
 *     onChange={(v) => setData(v)}
 *     onValidityChange={(valida) => ...} // opcional — caller bloqueia submit
 *   />
 *
 * Quando inválida, expõe via prop opcional `onValidityChange`. O caller deve
 * agregar essa flag com seus outros checks para bloquear o submit dos botões.
 *
 * A spec pede também que o CÁLCULO DE IG não recalcule enquanto a data estiver
 * inválida — manter valor anterior estável. Como o cálculo de IG depende do
 * value bruto e nós só validamos onBlur, basta o caller condicionar o recálculo
 * a `validade === true` (ou usar `validarDataClinica()` diretamente).
 */

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Chamado sempre que a validade muda (true=OK, false=inválida). */
  onValidityChange?: (valida: boolean) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  'aria-invalid'?: boolean;
  /** Wrapper className (afeta o container que inclui mensagem de erro). */
  wrapperClassName?: string;
}

const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  {
    id,
    value,
    onChange,
    onValidityChange,
    className = '',
    disabled,
    min,
    max,
    wrapperClassName = '',
    'aria-invalid': ariaInvalid,
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);
  const resultado = validarDataClinica(value);
  const inválido = touched && !resultado.valida;

  const handleBlur = () => {
    setTouched(true);
    onValidityChange?.(resultado.valida);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoValor = e.target.value;
    onChange(novoValor);
    // Revalida em tempo real após primeiro blur para limpar erro quando user corrige.
    if (touched) {
      const r = validarDataClinica(novoValor);
      onValidityChange?.(r.valida);
    }
  };

  return (
    <div className={`space-y-1 ${wrapperClassName}`}>
      <Input
        ref={ref}
        id={inputId}
        type="date"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        min={min}
        max={max}
        aria-invalid={ariaInvalid ?? inválido}
        aria-describedby={inválido ? errorId : undefined}
        className={`${inválido ? 'border-destructive focus-visible:ring-destructive' : ''} ${className}`}
      />
      {inválido && resultado.valida === false && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {resultado.motivo}
        </p>
      )}
    </div>
  );
});

export default DateInput;
