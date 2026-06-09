import { forwardRef, useEffect, useId } from 'react';
import { Input } from '@/components/ui/input';
import { validarDataClinica } from '@/lib/dateUtils';

/**
 * DateInput — input de data clínica com validação imediata (Prompt 34B seção 3.10).
 *
 * Bloqueia datas inválidas no calendário (30/02, 31/04, 31/11, 29/02 fora de ano
 * bissexto) com mensagem inline em vermelho — exibida assim que o valor é inválido,
 * sem depender de blur. NÃO bloqueia datas vazias — quem decide se o campo é
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
 * value bruto, o caller deve condicionar o recálculo a `validade === true`
 * (ou usar `validarDataClinica()` diretamente).
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
  const resultado = validarDataClinica(value);
  // Vazio conta como válido aqui (a obrigatoriedade do campo é decidida pelo form).
  // Só marca inválido quando há um valor que não é uma data real — ex.: 29/02 em
  // ano não bissexto. O erro passa a aparecer NA HORA, sem depender de blur.
  const inválido = !resultado.valida;

  // Reporta a validade ao caller no mount e a cada mudança de valor — não só no blur.
  // Antes, uma data impossível (digitada ou restaurada de rascunho) não bloqueava o
  // submit nem mostrava o erro até o campo perder o foco, deixando o botão "Salvar e
  // finalizar" apagado sem explicação visível. Agora a validade é sempre consistente.
  useEffect(() => {
    onValidityChange?.(resultado.valida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`space-y-1 ${wrapperClassName}`}>
      <Input
        ref={ref}
        id={inputId}
        type="date"
        value={value}
        onChange={handleChange}
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
