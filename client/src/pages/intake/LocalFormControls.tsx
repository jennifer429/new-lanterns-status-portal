// Local-state wrappers so typing stays snappy. The input is driven by local
// state, but every change is also pushed up to global state (and committed on
// blur) so the parent's `responses` is always current. Committing only on blur
// caused a race: clicking "Save & Continue"/"Complete" read a stale snapshot,
// so the field you just typed looked empty (false "Required" error) and the
// edit could be lost on navigation — especially on the last page.
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
  const isFilled = typeof local === 'string' && local.trim().length > 0;
  return (
    <div className="relative">
      <Input
        type={type}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          committed.current = e.target.value;
          onCommit(e.target.value);
        }}
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
  const isFilled = typeof local === 'string' && local.trim().length > 0;
  return (
    <div className="relative">
      <Textarea
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          committed.current = e.target.value;
          onCommit(e.target.value);
        }}
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
