import { UserPlus, X, Search, Check } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface UserData {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}

interface AddMemberModalProps {
  show: boolean;
  onClose: () => void;
  addUserSearch: string;
  setAddUserSearch: (val: string) => void;
  selectedUserIds: Set<string>;
  toggleUserSelection: (uid: string) => void;
  toggleAllAvailable: () => void;
  filteredAvailable: UserData[];
  addRole: string;
  setAddRole: (role: string) => void;
  ROLE_OPTIONS: { value: string; label: string }[];
  handleAddMembers: () => void;
  adding: boolean;
  addError: string;
}

export function AddMemberModal({
  show,
  onClose,
  addUserSearch,
  setAddUserSearch,
  selectedUserIds,
  toggleUserSelection,
  toggleAllAvailable,
  filteredAvailable,
  addRole,
  setAddRole,
  ROLE_OPTIONS,
  handleAddMembers,
  adding,
  addError,
}: AddMemberModalProps) {
  const containerRef = useFocusTrap(show);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
        <CardBody className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 id="add-member-title" className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <UserPlus size={20} className="text-primary" />
              새 멤버 초대
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full border-none bg-transparent cursor-pointer"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>

          {addError && (
            <div className="bg-danger-bg text-danger text-sm p-3 rounded-lg mb-4 border border-danger/20">
              {addError}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Search */}
            <div>
              <label htmlFor="add-user-search" className="form-label mb-2 block text-sm font-medium">사용자 검색</label>
              <Input
                id="add-user-search"
                icon={Search}
                placeholder="이름, 아이디 또는 이메일로 검색..."
                value={addUserSearch}
                onChange={(e) => setAddUserSearch(e.target.value)}
                fullWidth
              />
            </div>

            {/* User Selection List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="form-label text-sm font-medium">
                  {selectedUserIds.size > 0
                    ? `${selectedUserIds.size}명 선택됨`
                    : '추가할 사용자를 선택하세요'}
                </span>
                {filteredAvailable.length > 0 && (
                  <button
                    onClick={toggleAllAvailable}
                    className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer"
                  >
                    {selectedUserIds.size === filteredAvailable.length ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>
              <div
                className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border"
                role="listbox"
                aria-multiselectable="true"
                aria-label="추가할 사용자 목록"
              >
                {filteredAvailable.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted">
                    {addUserSearch ? '검색 결과가 없습니다.' : '추가 가능한 사용자가 없습니다.'}
                  </div>
                ) : (
                  filteredAvailable.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                        selectedUserIds.has(u.id) ? 'bg-primary-bg/20 dark:bg-primary-bg/10' : ''
                      }`}
                      role="option"
                      aria-selected={selectedUserIds.has(u.id)}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-current shrink-0"
                        checked={selectedUserIds.has(u.id)}
                        onChange={() => toggleUserSelection(u.id)}
                        aria-label={`${u.firstname} ${u.lastname} 선택`}
                      />
                      <div className="w-7 h-7 rounded-full bg-primary-bg text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {u.firstname?.[0] || u.login[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {u.firstname} {u.lastname}
                        </div>
                        <div className="text-xs text-muted truncate">@{u.login} · {u.email}</div>
                      </div>
                      {selectedUserIds.has(u.id) && (
                        <Check size={14} className="text-primary shrink-0" />
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="add-role-select" className="form-label mb-2 block text-sm font-medium">프로젝트 권한</label>
              <Select
                id="add-role-select"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                options={ROLE_OPTIONS}
                fullWidth
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" onClick={onClose} fullWidth>취소</Button>
              <Button
                onClick={handleAddMembers}
                disabled={selectedUserIds.size === 0 || adding}
                fullWidth
              >
                {adding ? '추가 중...' : `${selectedUserIds.size}명 초대하기`}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
