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
    if (!activeRoom || messages.length === 0) return;
    const latestId = Math.max(...messages.map((m: Message) => Number(m.id)));
    const currentLatest = lastSeenIds.current[activeRoom.id] || 0;
    
    if (latestId > currentLatest) {
      lastSeenIds.current[activeRoom.id] = latestId;
      localStorage.setItem(`chat_last_seen_${currentUser?.id || 'default'}`, JSON.stringify(lastSeenIds.current));
      
      api(`/api/chat/rooms/${activeRoom.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_read_message_id: latestId.toString() })
      }).catch(console.error);
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
