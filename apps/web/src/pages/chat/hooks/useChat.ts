import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from 'shared/lib/api';
import type { Message, ChatRoom } from 'shared/types';
import type { User } from 'shared/types';

export function useChat(activeRoom: { id: string; name: string } | null, currentUser: User | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastSeenIds = useRef<Record<string, string>>({});

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

  const fetchMessages = useCallback(async (since_id?: string) => {
    if (!activeRoom) { setMessages([]); return; }
    if (!since_id) setIsLoadingMessages(true);
    
    try {
      let url = `/api/chat?room_id=${activeRoom.id}`;
      if (since_id) url += `&since_id=${since_id}`;
      
      const res = await api(url);
      const json = await res.json();
      if (json.success) {
        const data = json.data || [];
        if (since_id) {
          setMessages(prev => {
            const newMessages = data.filter((m: Message) => !prev.some(p => p.id === m.id));
            return [...prev, ...newMessages];
          });
        } else {
          setMessages(data);
          setHasMore(data.length === 50); // Default limit is 50
        }
        
        if (data.length > 0) {
          // Sync logic is moved to the useEffect below
        }
      }
    } catch (err) { console.error(err); }
    finally { setIsLoadingMessages(false); }
  }, [activeRoom, currentUser?.id]);

  useEffect(() => {
    if (!activeRoom) return;
    // 낙관적 임시 메시지(temp-*)는 숫자 ID가 아니므로 제외
    const numericIds = messages.map((m: Message) => m.id).filter((id) => /^\d+$/.test(id));
    if (numericIds.length === 0) return;

    // Sonyflake ID 는 Number 안전 범위를 넘으므로 BigInt 문자열 비교로 최신 ID 를 구한다.
    const latestId = numericIds.reduce((max, id) => (BigInt(id) > BigInt(max) ? id : max), '0');
    const currentLatest = lastSeenIds.current[activeRoom.id] || '0';

    if (BigInt(latestId) > BigInt(currentLatest)) {
      lastSeenIds.current[activeRoom.id] = latestId;
      localStorage.setItem(`chat_last_seen_${currentUser?.id || 'default'}`, JSON.stringify(lastSeenIds.current));

      api(`/api/chat/rooms/${activeRoom.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_read_message_id: latestId })
      })
        .then(() => window.dispatchEvent(new CustomEvent('refresh_chat_rooms')))
        .catch(console.error);
    }
  }, [messages, activeRoom, currentUser?.id]);

  const fetchMoreMessages = useCallback(async () => {
    if (!activeRoom || isFetchingMore || !hasMore || messages.length === 0) return;
    setIsFetchingMore(true);
    
    try {
      const oldestId = messages[0].id;
      const res = await api(`/api/chat?room_id=${activeRoom.id}&before_id=${oldestId}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data || [];
        if (data.length < 50) setHasMore(false);
        if (data.length > 0) {
          setMessages(prev => {
            const newMessages = data.filter((m: Message) => !prev.some(p => p.id === m.id));
            return [...newMessages, ...prev];
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [activeRoom, isFetchingMore, hasMore, messages]);

  return {
    messages,
    setMessages,
    chatRooms,
    setChatRooms,
    fetchChatRooms,
    fetchMessages,
    fetchMoreMessages,
    isLoadingMessages,
    isFetchingMore,
    hasMore,
    lastSeenIds
  };
}
