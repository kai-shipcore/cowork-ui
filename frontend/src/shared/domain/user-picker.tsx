import { useState } from 'react';
import { Avatar, AvatarFallback } from '@coverland-engineering/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@coverland-engineering/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@coverland-engineering/ui/popover';
import { UserPlus, X } from 'lucide-react';
import type { AppUser } from '@/shared/types/workbench';

/** Deterministic avatar tint so the same person keeps the same colour. */
const AVATAR_TONES = [
  'tone-red',
  'tone-green',
  'tone-blue',
  'tone-amber',
  'tone-violet',
  'tone-cyan',
] as const;

function toneOf(id: string): string {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  user,
  size = 'sm',
}: {
  user: AppUser;
  size?: 'sm' | 'md';
}) {
  return (
    <Avatar className={`user-avatar ${size} ${toneOf(user.id)}`}>
      <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
    </Avatar>
  );
}

interface UserPickerProps {
  /** Currently assigned user, or undefined when unassigned. */
  value?: AppUser;
  /** Candidates; inactive accounts are filtered out by the caller if wanted. */
  users: readonly AppUser[];
  /** Text shown on the trigger while unassigned. */
  placeholder?: string;
  /** Accessible name for the trigger. */
  label: string;
  onChange: (userId: string | undefined) => void;
}

/**
 * Assignee picker — a trigger showing the current person, and a searchable
 * list on click. Search matches name and email, so an address pasted from
 * elsewhere finds its account.
 */
export function UserPicker({
  value,
  users,
  placeholder = '담당자 지정',
  label,
  onChange,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            value ? 'user-picker-trigger' : 'user-picker-trigger empty'
          }
          aria-label={label}
        >
          {value ? (
            <>
              <UserAvatar user={value} />
              <span>{value.name}</span>
            </>
          ) : (
            <>
              <UserPlus aria-hidden="true" />
              <span>{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="user-picker-popover" align="start">
        <Command>
          <CommandInput placeholder="이름 또는 이메일 검색..." />
          <CommandList>
            <CommandEmpty>일치하는 사용자가 없습니다.</CommandEmpty>
            <CommandGroup heading="People">
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email}`}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                >
                  <UserAvatar user={user} />
                  <span className="user-picker-name">{user.name}</span>
                  <span className="user-picker-email">{user.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="unassign clear 해제"
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  <X aria-hidden="true" />
                  <span className="user-picker-name">담당자 해제</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
