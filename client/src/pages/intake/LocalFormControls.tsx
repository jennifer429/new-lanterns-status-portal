// Local-state wrappers so typing doesn't re-render the whole page.
// They update global state only on blur.
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocalInputProps {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  showFilled?: boolean;
}

export function LocalInput({
  value,
  onCommit,
  placeholder,
  className,
  type = "text",
}: LocalInputProps) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setLocal(value);
    }
  }, [value]);
  const isFilled = local.trim().length > 0;
  return (
    <div className="relative">
      <Input
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { committed.current = local; onCommit(local); }}
        placeholder={placeholder}
        className={cn(
          className,
          isFilled && "bg-green-50/50 border-green-200"
        )}
      />
      {isFilled && (
        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600 pointer-events-none" />
      )}
    </div>
  );
}

interface LocalTextareaProps {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
  showFilled?: boolean;
}

export function LocalTextarea({
  value,
  onCommit,
  placeholder,
  className,
}: LocalTextareaProps) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setLocal(value);
    }
  }, [value]);
  const isFilled = local.trim().length > 0;
  return (
    <div className="relative">
      <Textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { committed.current = local; onCommit(local); }}
        placeholder={placeholder}
        className={cn(
          className,
          isFilled && "bg-green-50/50 border-green-200"
        )}
      />
      {isFilled && (
        <CheckCircle2 className="absolute right-3 top-3 w-4 h-4 text-green-600 pointer-events-none" />
      )}
    </div>
  );
}
