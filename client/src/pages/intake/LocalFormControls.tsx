// Local-state wrappers so typing doesn't re-render the whole page.
// They update global state only on blur.
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface LocalInputProps {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
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
  return (
    <Input
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { committed.current = local; onCommit(local); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

interface LocalTextareaProps {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
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
  return (
    <Textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { committed.current = local; onCommit(local); }}
      placeholder={placeholder}
      className={className}
    />
  );
}
