import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from 'shared/lib/api';
import type { Message, ChatRoom } from 'shared/types';
import type { User } from 'shared/types';

export function useChat(activeRoom: { id: string; name: string } | null, currentUser: User | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const lastSeenIds = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`chat_last_seen_${currentUser?.id || 'default'}`);
      if (saved) lastSeenIds.current = JSON.parse(saved);
    } catch {}
  }, [currentUser?.id]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await api('/api/chat/rooms');
      const json = await res.json();
      if (json.success) setChatRooms(json.data || []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!activeRoom) { setMessages([]); return; }
    setIsLoadingMessages(true);
    try {
      const res = await api(`/api/chat?room_id=${activeRoom.id}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data || [];
        setMessages(data);
        if (data.length > 0) {
          const latestId = Math.max(...data.map((m: Message) => Number(m.id)));
          lastSeenIds.current[activeRoom.id] = latestId;
          localStorage.setItem(`chat_last_seen_${currentUser?.id || 'default'}`, JSON.stringify(lastSeenIds.current));
        }
      }
    } catch (err) { console.error(err); }
    finally { setIsLoadingMessages(false); }
  }, [activeRoom, currentUser?.id]);

  return {
    messages,
    setMessages,
    chatRooms,
    setChatRooms,
    fetchChatRooms,
    fetchMessages,
    isLoadingMessages,
    lastSeenIds
  };
}
