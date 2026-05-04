import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  paises: string[];
  valor: string;
  onChange: (v: string) => void;
}

export function SeletorPais({ paises, valor, onChange }: Props) {
  const lista = paises.length > 0 ? paises : ["Brasil"];
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] bg-white">
        <SelectValue placeholder="País" />
      </SelectTrigger>
      <SelectContent>
        {lista.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SeletorPais;
