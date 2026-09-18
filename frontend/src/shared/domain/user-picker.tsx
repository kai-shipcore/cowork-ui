import type { JSX } from 'react';
import { UserPicker as SharedUserPicker } from '@coverland-engineering/ui/user-picker';
import type { AppUser } from '@/shared/types/workbench';

export { UserAvatar } from '@coverland-engineering/ui/user-picker';

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

/** Keeps Workbench labels while delegating selection to the shared component. */
export function UserPicker({
  value,
  users,
  placeholder = '담당자 지정',
  label,
  onChange,
}: UserPickerProps): JSX.Element {
  return (
    <SharedUserPicker
      value={value}
      users={users}
      placeholder={placeholder}
      label={label}
      onChange={onChange}
      searchPlaceholder="이름 또는 이메일 검색..."
      emptyMessage="일치하는 사용자가 없습니다."
      clearLabel="담당자 해제"
    />
  );
}
