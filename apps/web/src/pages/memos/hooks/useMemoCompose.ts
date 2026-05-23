import { useState, useEffect, useMemo } from 'react';
import { api } from 'shared/lib/api';
import type { User, Memo } from 'shared/types';

interface UseMemoComposeProps {
  currentUserId: string | null;
  users: User[];
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  fetchMemos: () => void;
  t: (key: string) => string;
  formatDateTime: (date: string) => string;
  setIsDetailOpen: (isOpen: boolean) => void;
}

export function useMemoCompose({
  currentUserId,
  users,
  showToast,
  fetchMemos,
  t,
  formatDateTime,
  setIsDetailOpen,
}: UseMemoComposeProps) {
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isSelfWriteMode, setIsSelfWriteMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isReservedSend, setIsReservedSend] = useState(false);
  const [reservedDate, setReservedDate] = useState('');

  // Check sessionStorage for pre-populated recipients (from address book group)
  useEffect(() => {
    const stored = sessionStorage.getItem('compose_recipients');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecipients(parsed);
          setIsComposeOpen(true);
        }
      } catch (_) {/* ignore */}
      sessionStorage.removeItem('compose_recipients');
    }
  }, []);

  useEffect(() => {
    const handleOpenCompose = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsSelfWriteMode(!!customEvent.detail?.self);
      // Accept pre-populated recipients from event detail
      if (customEvent.detail?.recipients) {
        setRecipients(customEvent.detail.recipients);
      } else {
        setRecipients([]);
      }
      setRecipientSearch('');
      setTitle(customEvent.detail?.title || '');
      setContent(customEvent.detail?.content || '');
      setAttachedFiles([]);
      setIsReservedSend(false);
      setReservedDate('');
      setIsComposeOpen(true);
    };

    window.addEventListener('open_compose_memo', handleOpenCompose);
    return () => window.removeEventListener('open_compose_memo', handleOpenCompose);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (recipients.some(r => r.id === u.id)) return false;
      const fullName = `${u.lastname}${u.firstname}`.toLowerCase();
      const login = u.login.toLowerCase();
      const search = recipientSearch.toLowerCase();
      return fullName.includes(search) || login.includes(search);
    });
  }, [users, recipients, recipientSearch]);

  const handleSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetIds: string[] = isSelfWriteMode ? [currentUserId!] : recipients.map(r => String(r.id));
    if (!isSelfWriteMode && targetIds.length === 0) return showToast('수신자를 선택해주세요.', 'warning');
    if (!title.trim()) return showToast('제목을 입력해주세요.', 'warning');
    if (!content.trim() || content === '<p></p>') return showToast('내용을 입력해주세요.', 'warning');

    let reservedIso: string | undefined = undefined;
    if (isReservedSend && reservedDate) {
      reservedIso = new Date(reservedDate).toISOString();
    }

    setSending(true);
    try {
      const res = await api('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_ids: targetIds,
          title: title.trim(),
          content: content.trim(),
          reserved_at: reservedIso,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (attachedFiles.length > 0) {
          const createdMemoIds = json.data?.memo_ids || [];
          for (const file of attachedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('memo_ids', JSON.stringify(createdMemoIds));
            await api('/api/attachments', { method: 'POST', body: formData });
          }
        }
        showToast(isReservedSend ? '쪽지가 예약 발송되었습니다.' : t('memoSendSuccess'), 'success');
        setIsComposeOpen(false);
        setRecipients([]);
        setTitle('');
        setContent('');
        setAttachedFiles([]);
        setIsReservedSend(false);
        setReservedDate('');
        fetchMemos();
      } else showToast(json.error || t('memoSendFail'), 'error');
    } catch (err) {
      console.error(err);
      showToast(t('memoSendFail'), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReply = (memo: Memo) => {
    setIsDetailOpen(false);
    setIsSelfWriteMode(false);
    const targetUser = users.find(u => u.id === memo.sender_id);
    if (targetUser) setRecipients([targetUser]);
    else if (memo.sender_id === currentUserId) setIsSelfWriteMode(true);
    
    setTitle(`Re: ${memo.title}`);
    setContent(`<br><br><hr><p><b>Originally sent by ${memo.sender_login} on ${formatDateTime(memo.created_at)}:</b></p>${memo.content}`);
    setIsComposeOpen(true);
  };

  return {
    isComposeOpen,
    setIsComposeOpen,
    recipients,
    setRecipients,
    title,
    setTitle,
    content,
    setContent,
    sending,
    recipientSearch,
    setRecipientSearch,
    isSelfWriteMode,
    attachedFiles,
    setAttachedFiles,
    filteredUsers,
    handleSendMemo,
    handleReply,
    isReservedSend,
    setIsReservedSend,
    reservedDate,
    setReservedDate,
  };
}
