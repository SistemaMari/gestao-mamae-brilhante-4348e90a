import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

interface BlockingModalProps {
  open: boolean;
  onClose: () => void;
  tipo: 'pacientes' | 'laudos';
  limite?: number;
}

export default function BlockingModal({ open, onClose, tipo, limite }: BlockingModalProps) {
  const navigate = useNavigate();

  const titulo = tipo === 'pacientes'
    ? 'Limite de pacientes atingido'
    : 'Limite de laudos atingido';

  const mensagem = tipo === 'pacientes'
    ? 'Você atingiu o limite de 3 pacientes do plano Free. Faça upgrade para cadastrar mais pacientes.'
    : `Você atingiu o limite de ${limite ?? 0} laudos do seu plano. Faça upgrade para continuar.`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-clinical-danger-bg">
            <ShieldAlert className="h-6 w-6 text-clinical-danger-icon" />
          </div>
          <DialogTitle className="text-center font-heading">{titulo}</DialogTitle>
          <DialogDescription className="text-center">
            {mensagem}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            className="w-full"
            onClick={() => { onClose(); navigate('/planos'); }}
          >
            Ver planos
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
