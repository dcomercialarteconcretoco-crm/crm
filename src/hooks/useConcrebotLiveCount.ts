"use client";

import { useEffect, useState } from 'react';

type WidgetConversation = {
    id: string;
    status?: 'active' | 'closed';
    updatedAt?: string;
    messages?: { role: 'user' | 'assistant'; timestamp?: string }[];
};

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 20 * 1000;

function parseTime(value?: string) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function isLiveOrWaiting(conversation: WidgetConversation) {
    if (conversation.status === 'closed') return false;
    const now = Date.now();
    const messages = conversation.messages || [];
    const lastMessage = messages[messages.length - 1];
    const latestActivity = Math.max(parseTime(conversation.updatedAt), parseTime(lastMessage?.timestamp));

    return latestActivity > 0 && now - latestActivity <= ACTIVE_WINDOW_MS;
}

export function useConcrebotLiveCount() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const refresh = async () => {
            try {
                const res = await fetch('/api/conversations', { cache: 'no-store' });
                if (!res.ok) {
                    if (!cancelled) setCount(0);
                    return;
                }
                const data = await res.json();
                const conversations: WidgetConversation[] = Array.isArray(data.conversations) ? data.conversations : [];
                const nextCount = conversations.filter(isLiveOrWaiting).length;
                if (!cancelled) setCount(nextCount);
            } catch {
                if (!cancelled) setCount(0);
            }
        };

        refresh();
        const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    return count;
}
