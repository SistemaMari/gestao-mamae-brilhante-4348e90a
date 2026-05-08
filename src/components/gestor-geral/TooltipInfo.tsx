import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  ariaLabel?: string;
}

export default function TooltipInfo({ text, side = "top", className, ariaLabel }: Props) {
  const isMobile = useIsMobile();

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel ?? "Mais informações"}
      className={cn(
        "inline-flex items-center text-[#94A3B8] hover:text-[#7E69AB] transition-colors",
        className,
      )}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent side={side} className="max-w-[280px] text-xs leading-relaxed">
          {text}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-[280px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
