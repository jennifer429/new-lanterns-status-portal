import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SYSTEM_TYPES } from "./systemConstants";

interface SystemEditRowProps {
  name: string;
  type: string;
  description: string;
  onNameChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SystemEditRow({
  name, type, description,
  onNameChange, onTypeChange, onDescChange,
  onSave, onCancel,
}: SystemEditRowProps) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="System name"
          className="flex-1 h-8 text-sm bg-background/50"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        />
        <select
          value={type}
          onChange={e => onTypeChange(e.target.value)}
          className="h-8 text-sm rounded-md border border-input bg-background/50 px-2 text-foreground"
        >
          {SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Input
        value={description}
        onChange={e => onDescChange(e.target.value)}
        placeholder="Description (optional)"
        className="h-8 text-sm bg-background/50"
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs">Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}
