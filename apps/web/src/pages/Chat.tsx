import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, UserPlus, Users, X, MessageSquare, Paperclip, Download, Trash2, Hash, LogOut, Shield, Check } from 'lucide-react';
import { Button } from 'ui/Button';
import { useToast } from 'ui/Toast';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';

import type { Message, UserInfo } from 'shared/types';
import { useChat } from './chat/hooks/useChat';
import { ChatFileAttachment } from './chat/components/ChatFileAttachment';
import { CreateRoomModal } from './chat/components/CreateRoomModal';
import { UserGroupManager } from './chat/components/UserGroupManager';
import { EmojiPicker } from './chat/components/EmojiPicker';

export default function ChatPage() {
  const { formatTime, t, language } = useLanguage();
  const { showToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeRoom, setActiveRoom] = useState<{ id: string; name: string } | null>(null);
  const activeRoomRef = useRef(activeRoom);

  const [searchParams, setSearchParams] = useSearchParams();
  const roomIdParam = searchParams.get('room');

  const { messages, setMessages, chatRooms, fetchChatRooms, fetchMessages } = useChat(activeRoom, currentUser);

  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomUsers, setCreateRoomUsers] = useState<UserInfo[]>([]);
  const [createRoomSelectedUsers, setCreateRoomSelectedUsers] = useState<string[]>([]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [roomMembers, setRoomMembers] = useState<UserInfo[]>([]);
  const [inviteUsers, setInviteUsers] = useState<UserInfo[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const dragCounter = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('token') ?? '';
    if (!token) return;
    const wsUrl = `${protocol}//${window.location.host}/api/ws/chat?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
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
        }
      } catch (err) { console.error('Failed to parse WS message:', err); }
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [setMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const uploadFile = async (file: File) => {
    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api('/api/attachments', { method: 'POST', body: formData });
      if (!res.ok) return showToast(res.status === 413 ? t('chatUploadLimitError') : t('chatUploadFail'), 'error');
      const json = await res.json();
      if (json.success) {
        if (!activeRoom) return;
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
    finally { setIsUploadingFile(false); setUploadingFileName(''); }
  };

  const handleSendRaw = async () => {
    if (!newMessage.trim() || !activeRoom) return;
    setIsLoading(true);
    try {
      const res = await api('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: activeRoom.id, content: newMessage, author_id: currentUser.id ? String(currentUser.id) : 1 }),
      });
      if (res.ok) { setNewMessage(''); fetchMessages(); }
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => { e.preventDefault(); await handleSendRaw(); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && !isLoading && !isUploadingFile) handleSendRaw();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm(t('chatDeleteConfirm'))) return;
    try {
      const res = await api(`/api/chat/${messageId}`, { method: 'DELETE' });
      if (res.ok) { showToast(t('chatDeleteSuccess'), 'success'); fetchMessages(); }
      else showToast(t('chatDeleteFail'), 'error');
    } catch { showToast(t('chatConnFail'), 'error'); }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !window.confirm(t('chatLeaveConfirm'))) return;
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await uploadFile(e.target.files[0]);
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
    if (isCreateRoomOpen) {
      api('/api/users').then(res => res.json()).then(json => {
        if (json.success) setCreateRoomUsers((json.data || []).filter((u: UserInfo) => u.id !== (currentUser.id ? String(currentUser.id) : 1)));
      });
    }
  }, [isCreateRoomOpen, currentUser.id]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await api('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName, user_id: currentUser.id ? String(currentUser.id) : 1 })
      });
      const json = await res.json();
      if (json.success) {
        for (const userId of createRoomSelectedUsers) {
          await api(`/api/chat/rooms/${json.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        }
        showToast(t('chatRoomCreateSuccess'), 'success');
        setIsCreateRoomOpen(false);
        setNewRoomName('');
        setCreateRoomSelectedUsers([]);
        window.dispatchEvent(new CustomEvent('refresh_chat_rooms'));
        fetchChatRooms();
        setSearchParams({ room: json.id.toString() });
      }
    } catch { showToast(t('errOccurred'), 'error'); }
    finally { setIsCreatingRoom(false); }
  };

  useEffect(() => {
    if (isMembersOpen && activeRoom) api(`/api/chat/rooms/${activeRoom.id}/members`).then(res => res.json()).then(json => setRoomMembers(json.data || []));
  }, [isMembersOpen, activeRoom]);

  useEffect(() => {
    if (isInviteOpen && activeRoom) {
        Promise.all([api('/api/users').then(r => r.json()), api(`/api/chat/rooms/${activeRoom.id}/members`).then(r => r.json())]).then(([uJson, mJson]) => {
            const memberIds = (mJson.data || []).map((m: { user_id: string }) => m.user_id);
            setInviteUsers((uJson.data || []).filter((u: UserInfo) => !memberIds.includes(u.id)));
            setSelectedUsers([]);
        });
    }
  }, [isInviteOpen, activeRoom]);

  const handleInviteUsers = async () => {
    if (selectedUsers.length === 0 || !activeRoom) return;
    setIsInviting(true);
    try {
      for (const userId of selectedUsers) await api(`/api/chat/rooms/${activeRoom.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
      showToast(t('chatInviteSuccessCount').replace('{count}', selectedUsers.length.toString()), 'success');
      setIsInviteOpen(false);
    } catch { showToast(t('chatInviteFail'), 'error'); }
    finally { setIsInviting(false); }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-105px)] relative" onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }} onDrop={async (e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files?.[0]) await uploadFile(e.dataTransfer.files[0]); }}>
      {isDragging && <div className="absolute inset-0 bg-slate-950/40 dark:bg-black/70 backdrop-blur-md z-50 flex items-center justify-center rounded-2xl pointer-events-none border-2 border-dashed border-indigo-500"><div className="bg-white dark:bg-slate-900 px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center"><div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 rounded-full flex items-center justify-center text-indigo-500 animate-bounce"><Paperclip size={28} /></div><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('chatDragDropOverlay')}</p></div></div>}

      <div className="flex-1 flex overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-0 bg-white dark:bg-slate-900">
        {activeRoom ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 min-w-0"><Hash size={17} className="text-slate-400 shrink-0" /><h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{activeRoom.name}</h2></div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setIsMembersOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-transparent cursor-pointer whitespace-nowrap"><Users size={13} />{t('members')}</button>
                <button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors border border-indigo-200 dark:border-indigo-800/60 bg-transparent cursor-pointer whitespace-nowrap"><UserPlus size={13} />{t('chatInviteBtn')}</button>
                <button onClick={handleLeaveRoom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-800/60 bg-transparent cursor-pointer whitespace-nowrap"><LogOut size={13} />{t('chatLeaveBtn')}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-0 custom-scrollbar bg-white dark:bg-slate-900">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-20"><div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Hash size={28} className="text-slate-300 dark:text-slate-600" /></div><div><p className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('welcomeToChannel').replace('{name}', activeRoom.name)}</p><p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{t('sendFirstMessage')}</p></div></div>
              ) : (
                <>
                  {messages.map((msg, index) => {
                    const isMe = msg.author_login === currentUser.login;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isGroupStart = !prevMsg || prevMsg.author_login !== msg.author_login || (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 5 * 60 * 1000;
                    const fileMatch = msg.content.match(/^\[FILE:(\d+):(.+?)\]$/);
                    return (
                      <div key={msg.id}>
                        {(!prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()) && (
                          <div className="flex items-center gap-3 my-5 select-none"><div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" /><span className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-2">{getDateLabel(msg.created_at)}</span><div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" /></div>
                        )}
                        <div className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isGroupStart ? 'mt-4' : 'mt-0.5'}`}>
                          {!isMe && <div className="w-8 shrink-0 self-end mb-0.5">{isGroupStart ? <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold select-none shadow-sm">{(msg.author_name || msg.author_login).slice(0, 2).toUpperCase()}</div> : <div className="w-8" />}</div>}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[65%]`}>
                            {!isMe && isGroupStart && <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 ml-1 select-none">{msg.author_name || msg.author_login}</span>}
                            {fileMatch ? <ChatFileAttachment fileId={fileMatch[1]} filename={fileMatch[2]} isMe={isMe} onPreview={(url, title) => { setPreviewImage(url); setPreviewTitle(title); }} showToast={showToast} t={t} /> : <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'}`}>{msg.content}</div>}
                            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>{isMe && <button onClick={() => handleDeleteMessage(msg.id)} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-none bg-transparent cursor-pointer"><Trash2 size={10} /></button>}<span className="text-xs text-slate-400 dark:text-slate-500 select-none px-0.5">{formatTime(msg.created_at, { hour: '2-digit', minute: '2-digit' })}</span></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="px-4 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              {isUploadingFile && <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-600 dark:text-indigo-400 mb-3"><div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" /><span className="font-semibold truncate">{t('chatUploadingFile')}{uploadingFileName}</span></div>}
              <form onSubmit={handleSend}><div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700/60 focus-within:border-indigo-400 dark:focus-within:border-indigo-600/60 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all"><input type="file" id="chat-file-upload" className="hidden" onChange={handleFileChange} disabled={isLoading || isUploadingFile} /><label htmlFor="chat-file-upload" className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-0.5 cursor-pointer ${isUploadingFile ? 'opacity-40 pointer-events-none' : ''}`}>          {isUploadingFile ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <Paperclip size={15} />}</label><EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isUploadingFile} t={t} /><textarea ref={textareaRef} placeholder={isUploadingFile ? t('chatUploadingPlaceholder') : (t('chatPlaceholder') || '메시지를 입력하세요...')} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} disabled={isLoading || isUploadingFile} rows={1} className="flex-1 min-w-0 bg-transparent border-none outline-none resize-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 max-h-[120px] min-h-[28px] py-1 custom-scrollbar leading-relaxed" /><button type="submit" disabled={!newMessage.trim() || isLoading || isUploadingFile} className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all mb-0.5 border-none cursor-pointer ${newMessage.trim() && !isLoading && !isUploadingFile ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'}`}>{isLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}</button></div><p className="text-xs text-slate-300 dark:text-slate-600 text-right mt-1.5 pr-1 select-none">{t('chatKeyboardShortcut')}</p></form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 gap-4"><div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><MessageSquare size={36} className="text-slate-300 dark:text-slate-600" /></div><div className="text-center"><p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('selectChatRoom')}</p><p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('selectChannelDesc')}</p></div><div className="flex items-center gap-3"><button onClick={() => setIsCreateRoomOpen(true)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-none cursor-pointer font-semibold">+ {t('addNewChannel')}</button><span className="text-slate-300 dark:text-slate-700">|</span><button onClick={() => setIsGroupManagerOpen(true)} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-transparent border-none cursor-pointer font-semibold transition-colors"><Shield size={12} />{t('manageUserGroups')}</button></div></div>
        )}
      </div>

      <CreateRoomModal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} newRoomName={newRoomName} setNewRoomName={setNewRoomName} handleCreateRoom={handleCreateRoom} isCreatingRoom={isCreatingRoom} createRoomUsers={createRoomUsers} createRoomSelectedUsers={createRoomSelectedUsers} handleToggleCreateRoomUser={(id) => setCreateRoomSelectedUsers(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id])} t={t} showToast={showToast} />

      <UserGroupManager
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        t={t}
        showToast={showToast}
      />

      {isMembersOpen && <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-zoom-in overflow-hidden"><div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800"><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Users size={16} className="text-indigo-500" />{t('chatRoomMembers')}</h3><button onClick={() => setIsMembersOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer text-slate-400 transition-colors"><X size={15} /></button></div><div className="p-3 flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">{roomMembers.map(user => (<div key={user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs shrink-0">{(user.firstname || user.login).charAt(0).toUpperCase()}</div><div className="flex flex-col flex-1 min-w-0"><div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : user.login}</div><div className="text-xs text-slate-400 dark:text-slate-500 truncate">{user.email}</div></div></div>))}{roomMembers.length === 0 && <div className="py-10 text-center text-sm text-slate-400">{t('noMembers')}</div>}</div></div></div>}

      {isInviteOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsInviteOpen(false)} /><div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 animate-zoom-in max-h-[80vh] flex flex-col overflow-hidden"><div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0"><h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('chatInviteTitle')}</h3><button onClick={() => setIsInviteOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer text-slate-400 transition-colors"><X size={15} /></button></div><div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 custom-scrollbar"><div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 select-none px-1">{t('chatInviteSelectUser')}</div>{inviteUsers.length > 0 ? inviteUsers.map(user => { const isSelected = selectedUsers.includes(user.id); return (<button key={user.id} type="button" onClick={() => setSelectedUsers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])} className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-indigo-300 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-950/20' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-transparent'}`}><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{(user.firstname || user.login).slice(0, 2).toUpperCase()}</div><div><div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.firstname || user.lastname ? `${user.firstname} ${user.lastname}` : user.login}</div><div className="text-xs text-slate-400 dark:text-slate-500">{user.email}</div></div></div><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{isSelected && <Check size={11} />}</div></button>); }) : <div className="py-12 text-center text-sm text-slate-400">{t('chatInviteNoUsers')}</div>}</div><div className="px-4 py-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0"><Button type="button" variant="secondary" onClick={() => setIsInviteOpen(false)}>{t('cancel')}</Button><Button type="button" onClick={handleInviteUsers} isLoading={isInviting} disabled={selectedUsers.length === 0}>{t('chatInviteActionBtn')} ({selectedUsers.length})</Button></div></div></div>}

      {previewImage && <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => { setPreviewImage(null); setPreviewTitle(''); }} /><div className="relative max-w-[90vw] max-h-[85vh] z-10 flex flex-col items-center animate-zoom-in"><div className="absolute -top-12 left-0 right-0 flex items-center justify-between text-white px-2"><span className="text-sm font-semibold truncate max-w-[70vw]">{previewTitle}</span><div className="flex items-center gap-2"><a href={previewImage} download={previewTitle} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center no-underline" title={t('chatDownload')}><Download size={16} /></a><button onClick={() => { setPreviewImage(null); setPreviewTitle(''); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border-none cursor-pointer text-white flex items-center justify-center"><X size={16} /></button></div></div><div className="bg-slate-900/80 rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[80vh] flex items-center justify-center backdrop-blur-xl"><img src={previewImage} alt={previewTitle} className="max-w-full max-h-[80vh] object-contain select-none" /></div></div></div>}
    </div>
  );
}
