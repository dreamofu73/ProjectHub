import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Users, X, MessageSquare, Paperclip, Download, Trash2, Hash, LogOut, Shield, ArrowDown, WifiOff, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { useToast } from 'ui/Toast';
import { ConfirmDialog } from 'ui/ConfirmDialog';
import { useLanguage } from '../context/LanguageContext';
import { api, fetchBlobUrl } from 'shared/lib/api';

import type { Message } from 'shared/types';
import { useChat } from './chat/hooks/useChat';
import { ChatFileAttachment } from './chat/components/ChatFileAttachment';
import { CreateRoomModal } from './chat/components/CreateRoomModal';
import { UserGroupManager } from './chat/components/UserGroupManager';
import { ChatMemberManagerModal } from './chat/components/ChatMemberManagerModal';
import { EmojiPicker } from './chat/components/EmojiPicker';

export default function ChatPage() {
  const { formatTime, t, language } = useLanguage();
  const { showToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeRoom, setActiveRoom] = useState<{ id: string; name: string } | null>(null);
  const activeRoomRef = useRef(activeRoom);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [isSavingRoomName, setIsSavingRoomName] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const roomIdParam = searchParams.get('room');

  const { messages, setMessages, chatRooms, fetchChatRooms, fetchMessages, fetchMoreMessages, isLoadingMessages, isFetchingMore, hasMore } = useChat(activeRoom, currentUser);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isLoadingMessages) {
          fetchMoreMessages();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, isLoadingMessages, fetchMoreMessages]);

  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);


  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadCount, setUploadCount] = useState<{ done: number; total: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ images: { fileId: string; filename: string }[]; index: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const dragCounter = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message?: string; confirmLabel: string; danger?: boolean; action: () => void } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const pendingJumpRef = useRef(true);
  const [wsConnected, setWsConnected] = useState(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const fetchMessagesRef = useRef(fetchMessages);
  useEffect(() => { fetchMessagesRef.current = fetchMessages; }, [fetchMessages]);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowNewMessageButton(false);
  }, []);

  const getDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t('today');
    if (date.toDateString() === yesterday.toDateString()) return t('yesterday');
    return date.toLocaleDateString(language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit' });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '32px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  useEffect(() => { fetchChatRooms(); }, [fetchChatRooms]);

  useEffect(() => {
    if (chatRooms.length > 0) {
      const matched = chatRooms.find(r => String(r.id) === roomIdParam);
      if (matched) setActiveRoom({ id: matched.id, name: matched.name });
      else if (!roomIdParam) setSearchParams({ room: chatRooms[0].id.toString() });
      else setActiveRoom(null);
    } else setActiveRoom(null);
  }, [chatRooms, roomIdParam, setSearchParams]);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { fetchMessages(); }, [activeRoom, fetchMessages]);

  useEffect(() => {
    const handleOpenCreateRoom = () => setIsCreateRoomOpen(true);
    const handleRefreshRooms = () => fetchChatRooms();
    window.addEventListener('open_create_chat_room', handleOpenCreateRoom);
    window.addEventListener('refresh_chat_rooms', handleRefreshRooms);
    return () => {
      window.removeEventListener('open_create_chat_room', handleOpenCreateRoom);
      window.removeEventListener('refresh_chat_rooms', handleRefreshRooms);
    };
  }, [fetchChatRooms]);

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    if (!token) return;
    let closedByUnmount = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/chat?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const wasReconnect = reconnectAttemptsRef.current > 0;
        reconnectAttemptsRef.current = 0;
        setWsConnected(true);
        if (wasReconnect) {
          setMessages(prev => {
            const sinceId = prev.length > 0 ? prev[prev.length - 1].id : undefined;
            fetchMessagesRef.current(sinceId);
            return prev;
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'new_message') {
            const newMsg = payload.data as Message;
            const room = activeRoomRef.current;
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              if (newMsg.room_id === room?.id) return [...prev, newMsg];
              return prev;
            });
          } else if (payload.type === 'delete_message') {
            const deletedId = String(payload.data.id);
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          } else if (payload.type === 'edit_message') {
            const editedId = String(payload.data.id);
            const editedContent = String(payload.data.content);
            const editedAt = payload.data.edited_at ?? new Date().toISOString();
            setMessages(prev => prev.map(m => m.id === editedId ? { ...m, content: editedContent, edited_at: editedAt } : m));
          }
        } catch (err) { console.error('Failed to parse WS message:', err); }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUnmount) return;
        setWsConnected(false);
        // 지수 백오프 재연결 (최대 30초)
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => { ws.close(); };
    };

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [setMessages]);

  // 방 전환 시: 다음 메시지 렌더에서 즉시 하단으로 점프하도록 예약 (버튼 리셋은 아래 스크롤 효과가 처리)
  useEffect(() => { pendingJumpRef.current = true; }, [activeRoom]);

  // 메시지 변경 시 스크롤 처리: 방 전환 직후엔 즉시 하단, 그 외엔 하단 근처일 때만 자동 스크롤
  // (측정/상태 갱신은 페인트 이후 rAF에서 수행)
  useEffect(() => {
    const jump = pendingJumpRef.current;
    pendingJumpRef.current = false;
    requestAnimationFrame(() => {
      if (jump) { scrollToBottom('auto'); return; }
      if (isNearBottom()) scrollToBottom('smooth');
      else setShowNewMessageButton(true);
    });
  }, [messages, isNearBottom, scrollToBottom]);

  // 검색: 매치 인덱스 목록 계산 (파일 메시지 제외, 대소문자 무시)
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as number[];
    return messages.reduce<number[]>((acc, m, i) => {
      if (!m.content.startsWith('[FILE:') && m.content.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [messages, searchQuery]);

  const currentMatchMsgId = searchMatches.length ? messages[searchMatches[Math.min(searchMatchIndex, searchMatches.length - 1)]]?.id : null;

  const searchNext = () => { if (searchMatches.length) setSearchMatchIndex(i => (i + 1) % searchMatches.length); };
  const searchPrev = () => { if (searchMatches.length) setSearchMatchIndex(i => (i - 1 + searchMatches.length) % searchMatches.length); };
  const closeSearch = () => { setShowSearch(false); setSearchQuery(''); setSearchMatchIndex(0); };

  // 검색: 현재 매치를 화면 중앙으로 스크롤
  useEffect(() => {
    if (!showSearch || !currentMatchMsgId) return;
    scrollContainerRef.current?.querySelector(`[data-mid="${currentMatchMsgId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchMsgId, showSearch]);

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlightContent = (text: string) => {
    const q = searchQuery.trim();
    if (!showSearch || !q) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
    return parts.map((p, i) => p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-amber-300 dark:bg-amber-500/70 text-slate-900 rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>);
  };

  // XHR 기반 업로드 (진행률 이벤트 활용). api() fetch와 동일하게 Bearer 토큰 인증.
  const uploadFile = (file: File) => new Promise<void>((resolve) => {
    if (!activeRoom) { resolve(); return; }
    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    setUploadProgress(0);
    const finish = () => { setIsUploadingFile(false); setUploadingFileName(''); setUploadProgress(null); resolve(); };
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments');
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = async () => {
      try {
        if (xhr.status === 413) { showToast(t('chatUploadLimitError'), 'error'); return; }
        if (xhr.status < 200 || xhr.status >= 300) { showToast(t('chatUploadFail'), 'error'); return; }
        const json = JSON.parse(xhr.responseText);
        if (json.success) {
          const attachmentId = json.data.id;
          const filename = json.data.filename || (json.data.attachments && json.data.attachments[0]?.filename) || file.name;
          const fileContent = `[FILE:${attachmentId}:${filename}]`;
          const sendRes = await api('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: activeRoom.id, content: fileContent, author_id: currentUser.id ? String(currentUser.id) : 1 }),
          });
          if (sendRes.ok) fetchMessages();
          else showToast(t('failToSendMessage'), 'error');
        } else showToast(json.error || t('chatUploadError'), 'error');
      } catch { showToast(t('chatConnFail'), 'error'); }
      finally { finish(); }
    };
    xhr.onerror = () => { showToast(t('chatConnFail'), 'error'); finish(); };
    xhr.send(formData);
  });

  // 여러 파일을 순차 업로드 (진행 카운트 표시)
  const uploadFiles = async (files: File[]) => {
    const list = files.filter(Boolean);
    if (list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      setUploadCount(list.length > 1 ? { done: i, total: list.length } : null);
      await uploadFile(list[i]);
    }
    setUploadCount(null);
  };

  // 클립보드 이미지 붙여넣기 업로드
  const handlePaste = (e: React.ClipboardEvent) => {
    const images = Array.from(e.clipboardData.files || []).filter(f => f.type.startsWith('image/'));
    if (images.length) { e.preventDefault(); uploadFiles(images); }
  };

  // 현재 방의 모든 이미지 첨부를 모아 갤러리 형태로 미리보기
  const openPreview = (fileId: string, filename: string) => {
    const imgs = messages
      .map(m => m.content.match(/^\[FILE:(\d+):(.+?)\]$/))
      .filter((mm): mm is RegExpMatchArray => !!mm && /\.(jpg|jpeg|png|gif|webp)$/i.test(mm[2]))
      .map(mm => ({ fileId: mm[1], filename: mm[2] }));
    const list = imgs.length ? imgs : [{ fileId, filename }];
    const index = Math.max(0, list.findIndex(im => im.fileId === fileId));
    setPreviewUrl(null);
    setPreviewZoom(1);
    setPreview({ images: list, index });
  };

  const previewNav = (dir: number) => {
    setPreviewUrl(null);
    setPreviewZoom(1);
    setPreview(p => (p ? { ...p, index: (p.index + dir + p.images.length) % p.images.length } : p));
  };

  // 미리보기: 현재 인덱스 이미지의 blob을 로드
  const previewIndex = preview?.index;
  const previewFileId = preview ? preview.images[preview.index]?.fileId : undefined;
  useEffect(() => {
    if (!previewFileId) return;
    let revoke: string | null = null;
    let active = true;
    fetchBlobUrl(`/api/attachments/${previewFileId}`)
      .then(u => { if (active) { revoke = u; setPreviewUrl(u); } })
      .catch(err => console.error('Preview load error:', err));
    return () => { active = false; if (revoke) URL.revokeObjectURL(revoke); };
  }, [previewFileId, previewIndex]);

  // 미리보기: 키보드(ESC/←→/줌)
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
      else if (e.key === 'ArrowRight') previewNav(1);
      else if (e.key === 'ArrowLeft') previewNav(-1);
      else if (e.key === '+' || e.key === '=') setPreviewZoom(z => Math.min(4, z + 0.25));
      else if (e.key === '-') setPreviewZoom(z => Math.max(1, z - 0.25));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const handleSendRaw = async () => {
    if (!newMessage.trim() || !activeRoom) return;
    const content = newMessage;
    const tempId = `temp-${Date.now()}`;
    // 낙관적 업데이트: 서버 응답 전에 임시 메시지를 즉시 표시
    const optimisticMsg: Message = {
      id: tempId,
      room_id: activeRoom.id,
      author_name: currentUser.firstname ? `${currentUser.firstname} ${currentUser.lastname ?? ''}`.trim() : currentUser.login,
      author_login: currentUser.login,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setIsLoading(true);
    try {
      const res = await api('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: activeRoom.id, content, author_id: currentUser.id ? String(currentUser.id) : 1 }),
      });
      if (res.ok) {
        fetchMessages(); // 서버 정본으로 교체 (임시 메시지 제거됨)
      } else {
        // 실패: 임시 메시지 롤백 + 입력 복원 + 알림
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(content);
        showToast(t('failToSendMessage'), 'error');
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      showToast(t('chatConnFail'), 'error');
    }
    finally { setIsLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => { e.preventDefault(); await handleSendRaw(); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && !isLoading) handleSendRaw();
    }
  };

  const doDeleteMessage = async (messageId: string) => {
    try {
      const res = await api(`/api/chat/${messageId}`, { method: 'DELETE' });
      if (res.ok) { showToast(t('chatDeleteSuccess'), 'success'); fetchMessages(); }
      else showToast(t('chatDeleteFail'), 'error');
    } catch { showToast(t('chatConnFail'), 'error'); }
  };

  const handleDeleteMessage = (messageId: string) => {
    setConfirmDialog({ title: t('delete'), message: t('chatDeleteConfirm'), confirmLabel: t('delete'), danger: true, action: () => doDeleteMessage(messageId) });
  };

  const startEdit = (messageId: string, content: string) => { setEditingId(messageId); setEditingText(content); };
  const submitEdit = async (messageId: string) => {
    const text = editingText.trim();
    if (!text) { setEditingId(null); return; }
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: text, edited_at: new Date().toISOString() } : m)); // 낙관적 반영
    setEditingId(null);
    try {
      const res = await api(`/api/chat/${messageId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) });
      if (!res.ok) { showToast(t('chatEditFail') || '수정에 실패했습니다.', 'error'); fetchMessages(); }
    } catch { showToast(t('chatConnFail'), 'error'); fetchMessages(); }
  };

  const doLeaveRoom = async () => {
    if (!activeRoom) return;
    try {
      const res = await api(`/api/chat/rooms/${activeRoom.id}/leave`, { method: 'POST' });
      if (res.ok) {
        showToast(t('chatLeaveSuccess'), 'success');
        setSearchParams({});
        setActiveRoom(null);
        window.dispatchEvent(new CustomEvent('refresh_chat_rooms'));
        fetchChatRooms();
      }
    } catch { showToast(t('chatConnFail'), 'error'); }
  };

  const handleLeaveRoom = () => {
    if (!activeRoom) return;
    setConfirmDialog({ title: t('chatLeaveBtn'), message: t('chatLeaveConfirm'), confirmLabel: t('confirm'), danger: true, action: doLeaveRoom });
  };

  const handleRenameRoom = async () => {
    if (!activeRoom || !editingRoomName.trim() || editingRoomName === activeRoom.name) {
      setIsEditingRoomName(false);
      return;
    }
    setIsSavingRoomName(true);
    try {
      const res = await api(`/api/chat/rooms/${activeRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingRoomName.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setActiveRoom(prev => prev ? { ...prev, name: editingRoomName.trim() } : prev);
        setIsEditingRoomName(false);
        fetchChatRooms();
        window.dispatchEvent(new CustomEvent('refresh_chat_rooms'));
      } else {
        showToast(json.error || t('errOccurred') || '이름 변경 실패', 'error');
      }
    } catch {
      showToast(t('errOccurred') || '이름 변경 실패', 'error');
    } finally {
      setIsSavingRoomName(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await uploadFiles(files);
    e.target.value = '';
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setNewMessage(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newVal = newMessage.substring(0, start) + emoji + newMessage.substring(end);
    setNewMessage(newVal);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + emoji.length;
      textarea.setSelectionRange(pos, pos);
    });
  }, [newMessage]);



  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-105px)] relative" onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }} onDrop={async (e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; const files = Array.from(e.dataTransfer.files || []); if (files.length) await uploadFiles(files); }}>
      {isDragging && <div className="absolute inset-0 bg-slate-950/40 dark:bg-black/70 backdrop-blur-md z-50 flex items-center justify-center rounded-2xl pointer-events-none border-2 border-dashed border-[var(--primary)]"><div className="bg-[var(--bg-surface)] px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center"><div className="w-14 h-14 bg-[var(--primary)]/10 rounded-full flex items-center justify-center text-[var(--primary)] animate-bounce"><Paperclip size={28} /></div><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('chatDragDropOverlay')}</p></div></div>}

      <div className="flex-1 flex overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm min-h-0 bg-[var(--bg-surface)]">
        {activeRoom ? (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {!wsConnected && (
              <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/95 text-white text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2">
                <WifiOff size={13} className="shrink-0" />
                <span>{t('chatReconnecting') || '연결이 끊겼습니다. 재연결 중…'}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface)]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Hash size={17} className="text-slate-400 shrink-0" />
                {isEditingRoomName ? (
                  <input
                    type="text"
                    value={editingRoomName}
                    onChange={(e) => setEditingRoomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameRoom();
                      else if (e.key === 'Escape') setIsEditingRoomName(false);
                    }}
                    onBlur={() => { if (!isSavingRoomName) setIsEditingRoomName(false); }}
                    className="flex-1 max-w-sm px-2 py-1 text-base font-bold text-[var(--text-primary)] bg-[var(--bg-surface-2)] border border-[var(--border)] rounded outline-none focus:border-[var(--primary)]"
                    autoFocus
                    disabled={isSavingRoomName}
                  />
                ) : (
                  <>
                    <h2 className="text-base font-bold text-[var(--text-primary)] truncate">{activeRoom.name}</h2>
                    <button onClick={() => { setEditingRoomName(activeRoom.name); setIsEditingRoomName(true); }} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer ml-1" title={t('edit') || '이름 변경'} aria-label={t('edit') || '이름 변경'}>
                      <Pencil size={13} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setShowSearch(s => !s)} className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border-none bg-transparent cursor-pointer ${showSearch ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)]'}`} title={t('search') || '검색'} aria-label={t('search') || '검색'}><Search size={15} /></button>
                <button onClick={() => setIsMembersOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors border-none bg-transparent cursor-pointer whitespace-nowrap"><Users size={13} />{t('members')}</button>
                <button onClick={handleLeaveRoom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-800/60 bg-transparent cursor-pointer whitespace-nowrap"><LogOut size={13} />{t('chatLeaveBtn')}</button>
              </div>
            </div>

            {showSearch && (
              <div className="flex items-center gap-2 px-6 py-2 border-b border-[var(--border)] bg-[var(--bg-surface-2)] shrink-0">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) searchPrev(); else searchNext(); } else if (e.key === 'Escape') closeSearch(); }}
                  placeholder={t('chatSearchPlaceholder') || '메시지 검색…'}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-slate-400 dark:placeholder-slate-500"
                />
                <span className="text-xs text-[var(--text-muted)] tabular-nums select-none shrink-0">{searchQuery.trim() ? `${searchMatches.length ? Math.min(searchMatchIndex, searchMatches.length - 1) + 1 : 0}/${searchMatches.length}` : ''}</span>
                <button onClick={searchPrev} disabled={!searchMatches.length} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 border-none bg-transparent cursor-pointer" aria-label={t('prev') || '이전'}><ChevronUp size={14} /></button>
                <button onClick={searchNext} disabled={!searchMatches.length} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 border-none bg-transparent cursor-pointer" aria-label={t('next') || '다음'}><ChevronDown size={14} /></button>
                <button onClick={closeSearch} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer" aria-label={t('cancel')}><X size={14} /></button>
              </div>
            )}

            <div ref={scrollContainerRef} onScroll={() => { if (isNearBottom()) setShowNewMessageButton(false); }} className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-0 custom-scrollbar bg-[var(--bg-surface)]">
              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex flex-col gap-4 py-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`flex gap-3 ${i % 3 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
                      {i % 3 !== 0 && <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] animate-pulse shrink-0" />}
                      <div className="flex flex-col gap-1.5 max-w-[65%]">
                        <div className="h-8 rounded-2xl bg-[var(--bg-surface-2)] animate-pulse" style={{ width: `${120 + (i * 37) % 160}px` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-20"><div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-2)] flex items-center justify-center"><Hash size={28} className="text-[var(--text-muted)]" /></div><div><p className="text-sm font-bold text-[var(--text-secondary)]">{t('welcomeToChannel').replace('{name}', activeRoom.name)}</p><p className="text-xs text-[var(--text-muted)] mt-1.5">{t('sendFirstMessage')}</p></div></div>
              ) : (
                <>
                  {hasMore && (
                    <div ref={observerTarget} className="w-full h-10 flex justify-center items-center shrink-0">
                      {isFetchingMore && <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                  )}
                  {messages.map((msg, index) => {
                    const isMe = msg.author_login === currentUser.login;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isGroupStart = !prevMsg || prevMsg.author_login !== msg.author_login || (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 5 * 60 * 1000;
                    const fileMatch = msg.content.match(/^\[FILE:(\d+):(.+?)\]$/);
                    return (
                      <div key={msg.id} data-mid={msg.id}>
                        {(!prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()) && (
                          <div className="flex items-center gap-3 my-5 select-none"><div className="flex-1 h-px bg-[var(--bg-surface-2)]" /><span className="text-xs font-semibold text-[var(--text-muted)] px-2">{getDateLabel(msg.created_at)}</span><div className="flex-1 h-px bg-[var(--bg-surface-2)]" /></div>
                        )}
                        <div className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isGroupStart ? 'mt-4' : 'mt-0.5'}`}>
                          {!isMe && <div className="w-8 shrink-0 self-end mb-0.5">{isGroupStart ? <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold select-none shadow-sm">{(msg.author_name || msg.author_login).slice(0, 2).toUpperCase()}</div> : <div className="w-8" />}</div>}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[65%]`}>
                            {!isMe && isGroupStart && <span className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 ml-1 select-none">{msg.author_name || msg.author_login}</span>}
                            {fileMatch ? <ChatFileAttachment fileId={fileMatch[1]} filename={fileMatch[2]} isMe={isMe} onPreview={(fileId, filename) => openPreview(fileId, filename)} showToast={showToast} t={t} /> : editingId === msg.id ? (
                              <div className="flex flex-col gap-1.5 w-full min-w-[220px]">
                                <textarea autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)} onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); } else if (e.key === 'Escape') setEditingId(null); }} rows={1} className="px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-[var(--primary)] outline-none resize-none text-[var(--text-primary)] custom-scrollbar leading-relaxed" />
                                <div className={`flex items-center gap-2 text-xs ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <button onClick={() => submitEdit(msg.id)} className="px-2.5 py-1 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary)] text-white font-semibold border-none cursor-pointer transition-colors">{t('save') || '저장'}</button>
                                  <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[var(--text-secondary)] font-semibold border-none cursor-pointer transition-colors">{t('cancel')}</button>
                                </div>
                              </div>
                            ) : <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${isMe ? 'bg-[var(--primary)] text-white rounded-br-sm shadow-sm' : 'bg-[var(--bg-surface-2)] text-[var(--text-primary)] rounded-bl-sm'} ${msg.id === currentMatchMsgId ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}>{highlightContent(msg.content)}</div>}
                            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>{isMe && !fileMatch && <button onClick={() => startEdit(msg.id, msg.content)} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors border-none bg-transparent cursor-pointer" title={t('edit') || '수정'}><Pencil size={10} /></button>}{isMe && <button onClick={() => handleDeleteMessage(msg.id)} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-none bg-transparent cursor-pointer"><Trash2 size={10} /></button>}{msg.edited_at && <span className="text-xs text-[var(--text-muted)] select-none italic px-0.5">{t('chatEdited') || '(수정됨)'}</span>}<span className="text-xs text-[var(--text-muted)] select-none px-0.5">{formatTime(msg.created_at, { hour: '2-digit', minute: '2-digit' })}</span></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {showNewMessageButton && (
              <button
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary)] text-white text-xs font-semibold shadow-lg border-none cursor-pointer animate-in fade-in slide-in-from-bottom-2 transition-colors"
                aria-label={t('chatNewMessagesBtn') || '새 메시지로 이동'}
              >
                <ArrowDown size={14} />{t('chatNewMessagesBtn') || '새 메시지'}
              </button>
            )}

            <div className="px-4 py-4 bg-[var(--bg-surface)] border-t border-[var(--border)] shrink-0">
              {isUploadingFile && (
                <div className="flex flex-col gap-1.5 mb-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-xl text-xs text-[var(--primary)]">
                    <div className="w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="font-semibold truncate flex-1">{t('chatUploadingFile')}{uploadingFileName}{uploadCount ? ` (${uploadCount.done + 1}/${uploadCount.total})` : ''}</span>
                    {uploadProgress !== null && <span className="tabular-nums shrink-0 font-bold">{uploadProgress}%</span>}
                  </div>
                  {uploadProgress !== null && (
                    <div className="h-1 rounded-full bg-[var(--primary)]/20 overflow-hidden">
                      <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
              )}
              <form onSubmit={handleSend}><div className="flex items-end gap-2 bg-[var(--bg-surface-2)] rounded-xl px-3 py-2 border border-[var(--border)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10 transition-all"><input type="file" id="chat-file-upload" multiple className="hidden" onChange={handleFileChange} disabled={isLoading || isUploadingFile} /><label htmlFor="chat-file-upload" className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-0.5 cursor-pointer ${isUploadingFile ? 'opacity-40 pointer-events-none' : ''}`}>          {isUploadingFile ? <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /> : <Paperclip size={15} />}</label><EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isUploadingFile} t={t} /><textarea ref={textareaRef} placeholder={isUploadingFile ? t('chatUploadingPlaceholder') : (t('chatPlaceholder') || '메시지를 입력하세요...')} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} disabled={isLoading} rows={1} className="flex-1 min-w-0 bg-transparent border-none outline-none resize-none text-sm text-[var(--text-primary)] placeholder-slate-400 dark:placeholder-slate-500 max-h-[120px] min-h-[28px] py-1 custom-scrollbar leading-relaxed" /><button type="submit" disabled={!newMessage.trim() || isLoading} className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all mb-0.5 border-none cursor-pointer ${newMessage.trim() && !isLoading ? 'bg-[var(--primary)] hover:bg-[var(--primary)] text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'}`}>{isLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}</button></div><p className="text-xs text-[var(--text-muted)] text-right mt-1.5 pr-1 select-none">{t('chatKeyboardShortcut')}</p></form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-surface)] gap-4"><div className="w-20 h-20 rounded-3xl bg-[var(--bg-surface-2)] flex items-center justify-center"><MessageSquare size={36} className="text-[var(--text-muted)]" /></div><div className="text-center"><p className="text-sm font-semibold text-[var(--text-secondary)]">{t('selectChatRoom')}</p><p className="text-xs text-[var(--text-muted)] mt-1">{t('selectChannelDesc')}</p></div><div className="flex items-center gap-3"><button onClick={() => setIsCreateRoomOpen(true)} className="text-xs text-[var(--primary)] hover:underline bg-transparent border-none cursor-pointer font-semibold">+ {t('addNewChannel')}</button><span className="text-[var(--text-muted)]">|</span><button onClick={() => setIsGroupManagerOpen(true)} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] bg-transparent border-none cursor-pointer font-semibold transition-colors"><Shield size={12} />{t('manageUserGroups')}</button></div></div>
        )}
      </div>

      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        currentUser={currentUser}
        t={t}
        showToast={showToast}
        onRoomCreated={(roomId) => {
          window.dispatchEvent(new CustomEvent('refresh_chat_rooms'));
          fetchChatRooms();
          setSearchParams({ room: roomId });
        }}
      />

      <UserGroupManager
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        t={t}
        showToast={showToast}
      />

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel || t('confirm')}
        cancelLabel={t('cancel')}
        danger={confirmDialog?.danger}
        onConfirm={() => { const c = confirmDialog; setConfirmDialog(null); c?.action(); }}
        onCancel={() => setConfirmDialog(null)}
      />

      <ChatMemberManagerModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        activeRoomId={activeRoom?.id}
        currentUser={currentUser}
        t={t}
        showToast={showToast}
      />

      {preview && (() => {
        const cur = preview.images[preview.index];
        const multiple = preview.images.length > 1;
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setPreview(null)} />
            <div className="relative max-w-[90vw] max-h-[85vh] z-10 flex flex-col items-center animate-zoom-in">
              <div className="absolute -top-12 left-0 right-0 flex items-center justify-between text-white px-2">
                <span className="text-sm font-semibold truncate max-w-[55vw]">{cur?.filename}{multiple ? ` · ${preview.index + 1}/${preview.images.length}` : ''}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewZoom(z => Math.max(1, z - 0.25))} disabled={previewZoom <= 1} className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center" title="축소"><ZoomOut size={16} /></button>
                  <button onClick={() => setPreviewZoom(z => Math.min(4, z + 0.25))} disabled={previewZoom >= 4} className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center" title="확대"><ZoomIn size={16} /></button>
                  {previewUrl && <a href={previewUrl} download={cur?.filename} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center no-underline" title={t('chatDownload')}><Download size={16} /></a>}
                  <button onClick={() => setPreview(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center" title={t('cancel')}><X size={16} /></button>
                </div>
              </div>
              {multiple && (
                <>
                  <button onClick={() => previewNav(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center" aria-label="이전"><ChevronLeft size={22} /></button>
                  <button onClick={() => previewNav(1)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center" aria-label="다음"><ChevronRight size={22} /></button>
                </>
              )}
              <div className="bg-slate-900/80 rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[80vh] flex items-center justify-center backdrop-blur-xl" onWheel={(e) => setPreviewZoom(z => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.25 : -0.25))))}>
                {previewUrl ? (
                  <img src={previewUrl} alt={cur?.filename} draggable={false} style={{ transform: `scale(${previewZoom})`, transition: 'transform 0.15s ease-out' }} className="max-w-full max-h-[80vh] object-contain select-none" />
                ) : (
                  <div className="w-[60vw] max-w-[400px] aspect-video flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" /></div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
