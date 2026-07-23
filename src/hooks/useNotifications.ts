import { useState, useEffect, useCallback } from 'react';

export type NotificationRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SYSTEM';
export type NotificationStatus = 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  role: NotificationRole;
  status: NotificationStatus;
}

const STORAGE_KEY = 'chainedu_notifications';
const LAST_CLEAR_KEY = 'chainedu_notifs_last_clear';
const CLEAR_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifs = useCallback(() => {
    const now = Date.now();
    const lastClearStr = localStorage.getItem(LAST_CLEAR_KEY);
    const lastClear = lastClearStr ? parseInt(lastClearStr) : 0;

    if (now - lastClear > CLEAR_INTERVAL) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(LAST_CLEAR_KEY, now.toString());
      setNotifications([]);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifs();
    const timer = setInterval(loadNotifs, 1000 * 60 * 60); // Every hour
    return () => clearInterval(timer);
  }, [loadNotifs]);

  const addNotification = (
    title: string, 
    message: string, 
    role: NotificationRole = 'SYSTEM', 
    status: NotificationStatus = 'INFO'
  ) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      title,
      message,
      createdAt: Date.now(),
      read: false,
      role,
      status
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 40); // Keep last 40
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setNotifications([]);
  };

  return { notifications, addNotification, markAsRead, clearAll };
}
