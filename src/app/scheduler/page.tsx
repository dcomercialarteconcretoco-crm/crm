"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    User,
    Calendar as CalendarIcon,
    Video,
    Truck,
    X,
    Users,
    Mail,
    Globe,
    Shield,
    Link as LinkIcon,
    Send,
    CheckCircle2,
    Search,
    Upload,
    Cloud,
    RefreshCw,
    Pencil,
    Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';

const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

import { useApp, CalendarEvent, Invitee } from '@/context/AppContext';

type GoogleTokenClient = {
    requestAccessToken: (options?: { prompt?: string }) => void;
};

type StoredGoogleAuth = {
    accessToken: string;
    email?: string;
    expiresAt?: string;
    updatedAt: string;
};

declare global {
    interface Window {
        google?: {
            accounts?: {
                oauth2?: {
                    initTokenClient: (config: {
                        client_id: string;
                        scope: string;
                        callback: (response: { access_token?: string; error?: string }) => void;
                    }) => GoogleTokenClient;
                };
            };
        };
    }
}

// GOOGLE_CLIENT_ID is set dynamically from settings (Configuración → Google Calendar)
// Falls back to env var if available
let GOOGLE_CLIENT_ID_ENV = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_SCOPE = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function getGoogleAuthStorageKey(userId?: string) {
    return userId ? `crm_google_calendar_auth_${userId}` : 'crm_google_calendar_auth';
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function SchedulerPage() {
    const { clients, sellers, events, addEvent, addNotification, currentUser, updateEvent, deleteEvent, settings } = useApp();
    const GOOGLE_CLIENT_ID = settings.googleClientId?.trim() || GOOGLE_CLIENT_ID_ENV || '';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [calendarDate, setCalendarDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
    const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
    const [googleAccessToken, setGoogleAccessToken] = useState('');
    const [googleAccountEmail, setGoogleAccountEmail] = useState('');
    const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState('');

    // Form State
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        type: 'meeting' as CalendarEvent['type'],
        invitees: [] as Invitee[],
        meetingLink: '',
        description: ''
    });

    const [externalEmail, setExternalEmail] = useState('');
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', date: '', time: '', type: 'meeting' as CalendarEvent['type'] });

    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    // SuperAdmin sees ALL events; other users see only their own
    const currentUserEvents = useMemo(
        () => isSuperAdmin ? [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            : events.filter((event) => event.ownerUserId === currentUser?.id),
        [events, currentUser?.id, isSuperAdmin]
    );

    const handleEditEvent = (event: CalendarEvent) => {
        setEditingEvent(event);
        setEditForm({ title: event.title, date: event.date, time: event.time, type: event.type });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = () => {
        if (!editingEvent) return;
        updateEvent(editingEvent.id, { title: editForm.title, date: editForm.date, time: editForm.time, type: editForm.type });
        setIsEditModalOpen(false);
        setEditingEvent(null);
        addNotification({ title: 'Evento actualizado', description: 'Los cambios quedaron guardados.', type: 'success' });
    };

    const handleDeleteEvent = (eventId: string) => {
        deleteEvent(eventId);
        setIsEditModalOpen(false);
        setEditingEvent(null);
        addNotification({ title: 'Evento eliminado', description: 'La cita fue eliminada de la agenda.', type: 'success' });
    };

    useEffect(() => {
        if (!currentUser) return;

        const legacyEvents = events.filter((event) => !event.ownerUserId);
        legacyEvents.forEach((event) => {
            updateEvent(event.id, {
                ownerUserId: currentUser.id,
                ownerName: currentUser.name,
            });
        });
    }, [currentUser, events, updateEvent]);

    useEffect(() => {
        if (!currentUser) return;

        const raw = localStorage.getItem(getGoogleAuthStorageKey(currentUser.id));
        if (!raw) return;

        try {
            const saved: StoredGoogleAuth = JSON.parse(raw);
            const isExpired = saved?.expiresAt ? new Date(saved.expiresAt).getTime() <= Date.now() : false;
            if (saved?.accessToken && !isExpired) {
                setGoogleAccessToken(saved.accessToken);
                setGoogleAccountEmail(saved.email || '');
                setGoogleTokenExpiresAt(saved.expiresAt || '');
            } else {
                localStorage.removeItem(getGoogleAuthStorageKey(currentUser.id));
            }
        } catch {
            localStorage.removeItem(getGoogleAuthStorageKey(currentUser.id));
        }
    }, [currentUser]);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return;

        const existingScript = document.querySelector('script[data-google-gis="true"]');
        if (existingScript) {
            setIsGoogleReady(Boolean(window.google?.accounts?.oauth2));
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleGis = 'true';
        script.onload = () => setIsGoogleReady(true);
        document.head.appendChild(script);
    }, []);

    const persistGoogleAuth = (accessToken: string, email: string, expiresAt?: string) => {
        if (!currentUser) return;
        localStorage.setItem(getGoogleAuthStorageKey(currentUser.id), JSON.stringify({
            accessToken,
            email,
            expiresAt,
            updatedAt: new Date().toISOString(),
        }));
    };

    const clearGoogleAuth = () => {
        if (!currentUser) return;
        localStorage.removeItem(getGoogleAuthStorageKey(currentUser.id));
        setGoogleAccessToken('');
        setGoogleAccountEmail('');
        setGoogleTokenExpiresAt('');
    };

    const fetchGoogleAccountEmail = async (accessToken: string) => {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) return '';
        const data = await response.json();
        return data.email || '';
    };

    const requestGoogleAccessToken = (prompt: '' | 'consent' = '') =>
        new Promise<string>((resolve, reject) => {
            if (!window.google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
                reject(new Error('Google Calendar no está configurado. Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID.'));
                return;
            }

            googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: GOOGLE_SCOPE,
                callback: (response) => {
                    if (response.error || !response.access_token) {
                        reject(new Error(response.error || 'No se pudo obtener acceso a Google Calendar.'));
                        return;
                    }
                    const expiresIn = (response as { expires_in?: number }).expires_in ?? 3600;
                    const expiresAt = new Date(Date.now() + (expiresIn * 1000) - 60_000).toISOString();
                    setGoogleTokenExpiresAt(expiresAt);
                    resolve(response.access_token);
                },
            });

            googleTokenClientRef.current.requestAccessToken({ prompt });
        });

    const ensureGoogleAccessToken = async () => {
        const tokenStillValid = googleAccessToken && (!googleTokenExpiresAt || new Date(googleTokenExpiresAt).getTime() > Date.now());
        if (tokenStillValid) return googleAccessToken;

        const token = await requestGoogleAccessToken(googleAccessToken ? '' : 'consent');
        const email = await fetchGoogleAccountEmail(token);
        setGoogleAccessToken(token);
        setGoogleAccountEmail(email);
        const expiresAt = new Date(Date.now() + 59 * 60 * 1000).toISOString();
        setGoogleTokenExpiresAt(expiresAt);
        persistGoogleAuth(token, email, expiresAt);
        return token;
    };

    const createGoogleCalendarEvent = async (token: string, event: CalendarEvent) => {
        const startDateTime = new Date(`${event.date}T${event.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                summary: event.title,
                description: event.description || '',
                location: event.location || '',
                start: {
                    dateTime: startDateTime.toISOString(),
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                },
                attendees: event.invitees
                    .filter((invitee) => invitee.email)
                    .map((invitee) => ({ email: invitee.email, displayName: invitee.name })),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Calendar rechazó el evento: ${errorText}`);
        }

        return response.json();
    };

    const syncGoogleEvents = async () => {
        const token = await ensureGoogleAccessToken();
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 9, 0, 23, 59, 59).toISOString();

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                clearGoogleAuth();
            }
            throw new Error(`No se pudo leer Google Calendar: ${errorText}`);
        }

        const payload = await response.json();
        const items = Array.isArray(payload.items) ? payload.items : [];

        let importedCount = 0;
        items.forEach((item: any) => {
            const startDateTime = item.start?.dateTime || item.start?.date;
            if (!startDateTime || !currentUser) return;

            const start = new Date(startDateTime);
            const existing = events.find((event) => event.googleEventId === item.id && event.ownerUserId === currentUser.id);

            const mappedEvent: Partial<CalendarEvent> = {
                title: item.summary || 'Evento de Google Calendar',
                date: start.toISOString().slice(0, 10),
                time: start.toTimeString().slice(0, 5),
                type: 'meeting',
                client: item.attendees?.[0]?.displayName || item.organizer?.email || 'Google Calendar',
                description: item.description || '',
                meetingLink: item.hangoutLink || item.location || '',
                invitees: Array.isArray(item.attendees)
                    ? item.attendees.map((attendee: any, index: number) => ({
                        id: attendee.email || `google-${item.id}-${index}`,
                        name: attendee.displayName || attendee.email || 'Invitado',
                        email: attendee.email || '',
                        type: 'externo' as Invitee['type'],
                    }))
                    : [],
                ownerUserId: currentUser.id,
                ownerName: currentUser.name,
                googleEventId: item.id,
                googleCalendarId: 'primary',
                syncedAt: new Date().toISOString(),
                source: 'google',
            };

            if (existing) {
                updateEvent(existing.id, mappedEvent);
            } else {
                addEvent(mappedEvent as Omit<CalendarEvent, 'id'>);
                importedCount += 1;
            }
        });

        addNotification({
            title: 'Google Calendar sincronizado',
            description: importedCount > 0
                ? `Se importaron ${importedCount} eventos nuevos desde Google Calendar.`
                : 'No había eventos nuevos por importar.',
            type: 'success',
        });
    };

    useEffect(() => {
        if (!googleAccessToken || !currentUser) return;

        let cancelled = false;

        const runInitialSync = async () => {
            try {
                setIsGoogleSyncing(true);
                await syncGoogleEvents();
            } catch (error) {
                if (!cancelled) {
                    addNotification({
                        title: 'Error sincronizando Google Calendar',
                        description: error instanceof Error ? error.message : 'No se pudieron importar eventos.',
                        type: 'alert',
                    });
                }
            } finally {
                if (!cancelled) {
                    setIsGoogleSyncing(false);
                }
            }
        };

        runInitialSync();

        const intervalId = window.setInterval(async () => {
            try {
                await syncGoogleEvents();
            } catch (error) {
                console.warn('Google Calendar auto-sync failed:', error);
            }
        }, 5 * 60 * 1000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [googleAccessToken, googleTokenExpiresAt, currentUser]);

    const handleGoogleConnect = async () => {
        try {
            setIsGoogleConnecting(true);
            const token = await requestGoogleAccessToken('consent');
            const email = await fetchGoogleAccountEmail(token);
            setGoogleAccessToken(token);
            setGoogleAccountEmail(email);
            const expiresAt = new Date(Date.now() + 59 * 60 * 1000).toISOString();
            setGoogleTokenExpiresAt(expiresAt);
            persistGoogleAuth(token, email, expiresAt);
            addNotification({
                title: 'Google Calendar conectado',
                description: email || 'La cuenta quedó lista para sincronizar eventos.',
                type: 'success',
            });
        } catch (error) {
            addNotification({
                title: 'Error conectando Google Calendar',
                description: error instanceof Error ? error.message : 'No se pudo autorizar la cuenta de Google.',
                type: 'alert',
            });
        } finally {
            setIsGoogleConnecting(false);
        }
    };

    const toggleInvitee = (person: any, type: Invitee['type']) => {
        const inviteeId = person.id;
        const exists = form.invitees.find(i => i.id === inviteeId);

        if (exists) {
            setForm(prev => ({ ...prev, invitees: prev.invitees.filter(i => i.id !== inviteeId) }));
        } else {
            setForm(prev => ({
                ...prev,
                invitees: [...prev.invitees, { id: person.id, name: person.name, email: person.email, type }]
            }));
        }
    };

    const addExternal = () => {
        if (!externalEmail.includes('@')) return;
        const newInvitee: Invitee = {
            id: `ext-${Date.now()}`,
            name: externalEmail.split('@')[0],
            email: externalEmail,
            type: 'externo'
        };
        setForm(prev => ({ ...prev, invitees: [...prev.invitees, newInvitee] }));
        setExternalEmail('');
    };

    const handleSave = async () => {
        if (!currentUser) return;

        const localEvent: CalendarEvent = {
            ...form,
            id: Date.now().toString(),
            client: form.invitees[0]?.name || 'Interno',
            ownerUserId: currentUser.id,
            ownerName: currentUser.name,
            source: googleAccessToken ? 'local+google' : 'local',
        };

        try {
            let eventToPersist = localEvent;

            if (googleAccessToken) {
                const googleEvent = await createGoogleCalendarEvent(googleAccessToken, localEvent);
                eventToPersist = {
                    ...localEvent,
                    googleEventId: googleEvent.id,
                    googleCalendarId: 'primary',
                    syncedAt: new Date().toISOString(),
                    meetingLink: googleEvent.hangoutLink || localEvent.meetingLink,
                };
            }

            const { id: _localOnlyId, ...eventPayload } = eventToPersist;
            addEvent(eventPayload);

            // Send email invitations to attendees with email addresses
            const inviteesWithEmail = form.invitees.filter(inv => inv.email?.includes('@'));
            if (inviteesWithEmail.length > 0) {
                fetch('/api/agenda/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: form.title,
                        date: form.date,
                        time: form.time,
                        type: form.type,
                        meetingLink: eventToPersist.meetingLink || '',
                        description: form.description || '',
                        invitees: inviteesWithEmail,
                        organizer: currentUser?.name || 'Arte Concreto',
                    }),
                }).catch(console.error);
            }

            setIsModalOpen(false);
            setForm({
                title: '',
                date: new Date().toISOString().split('T')[0],
                time: '10:00',
                type: 'meeting',
                invitees: [],
                meetingLink: '',
                description: ''
            });

            addNotification({
                title: googleAccessToken ? 'Evento sincronizado con Google' : 'Evento agendado',
                description: googleAccessToken
                    ? 'La cita quedó guardada en el CRM y en tu Google Calendar.'
                    : 'La cita quedó guardada en tu agenda local.',
                type: 'success',
            });
        } catch (error) {
            addNotification({
                title: 'No se pudo guardar el evento',
                description: error instanceof Error ? error.message : 'Falló la sincronización del evento.',
                type: 'alert',
            });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            const lines = text.split('\n');
            let importedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = [];
                let inQuotes = false;
                let currentValue = '';
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"' && line[j + 1] === '"') {
                        currentValue += '"'; j++;
                    } else if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue); currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue);

                if (values.length >= 4) {
                    const rawDateTime = values[0] || '';
                    const clientName = values[1] || 'Sin Cliente';
                    const email = values[2] || '';
                    const phone = values[3] || '';
                    const description = values[4] || '';

                    // Parse Date and Time reasonably well
                    let datePart = new Date().toISOString().split('T')[0];
                    let timePart = '12:00';

                    if (rawDateTime.includes(' ')) {
                        const parts = rawDateTime.split(' ');
                        datePart = parts[0];
                        timePart = parts[1].slice(0, 5); // Take hours and minutes
                    } else if (rawDateTime.includes(':')) {
                        timePart = rawDateTime.slice(0, 5);
                    } else if (rawDateTime.length > 0) {
                        datePart = rawDateTime;
                    }

                    addEvent({
                        title: `Reunión Importada: ${clientName}`,
                        date: datePart,
                        time: timePart,
                        type: 'meeting',
                        client: clientName,
                        description: description,
                        invitees: email ? [{
                            id: `ext-${Date.now()}-${i}`,
                            name: clientName,
                            email: email,
                            type: 'externo'
                        }] : []
                    });
                    importedCount++;
                }
            }

            addNotification({
                title: 'Agenda Actualizada',
                description: `Se importaron ${importedCount} citas.`,
                type: 'success'
            });

            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Agenda Operativa</h1>
                    <p className="page-subtitle">
                        Gestiona visitas, entregas y reuniones. La agenda ahora puede sincronizarse con Google Calendar por usuario.
                    </p>
                    {googleAccessToken && (
                        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                            Google Calendar conectado{googleAccountEmail ? ` · ${googleAccountEmail}` : ''} · Sync cada 5 min
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    {GOOGLE_CLIENT_ID && (
                        <button
                            onClick={handleGoogleConnect}
                            disabled={isGoogleConnecting || !isGoogleReady}
                            className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                        >
                            <Cloud className="w-4 h-4" />
                            <span>
                                {isGoogleConnecting
                                    ? 'Conectando Google...'
                                    : googleAccessToken
                                        ? `Google: ${googleAccountEmail || 'Conectado'}`
                                        : 'Conectar Google'}
                            </span>
                        </button>
                    )}
                    {GOOGLE_CLIENT_ID && (
                        <button
                            onClick={async () => {
                                try {
                                    setIsGoogleSyncing(true);
                                    await syncGoogleEvents();
                                } catch (error) {
                                    addNotification({
                                        title: 'Error sincronizando Google Calendar',
                                        description: error instanceof Error ? error.message : 'No se pudieron importar eventos.',
                                        type: 'alert',
                                    });
                                } finally {
                                    setIsGoogleSyncing(false);
                                }
                            }}
                            disabled={!googleAccessToken || isGoogleSyncing}
                            className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-4 h-4", isGoogleSyncing && "animate-spin")} />
                            <span>{isGoogleSyncing ? 'Sincronizando...' : 'Sync Google'}</span>
                        </button>
                    )}
                    <button
                        onClick={handleImportClick}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        <span>Importar Citas</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Agendar Evento</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Calendar View */}
                <div className="lg:col-span-8">
                    {(() => {
                        const year = calendarDate.getFullYear();
                        const month = calendarDate.getMonth();
                        const today = new Date();
                        const isToday = (d: number) =>
                            d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                        // First weekday of the month (0=Sun)
                        const firstWeekday = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        // Total cells: fill up to multiple of 7
                        const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

                        const openModalOnDay = (day: number) => {
                            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                            setForm(prev => ({ ...prev, date: dateStr }));
                            setIsModalOpen(true);
                        };

                        return (
                            <div className="surface-card overflow-hidden">
                                {/* Calendar Header */}
                                <div className="p-6 border-b border-border flex items-center justify-between">
                                    <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-3">
                                        <CalendarIcon className="text-primary w-5 h-5" />
                                        {MONTH_NAMES[month]} {year}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                                            className="p-2 hover:bg-muted rounded-xl border border-border transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1))}
                                            className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted text-[10px] font-black uppercase tracking-widest"
                                        >Hoy</button>
                                        <button
                                            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                                            className="p-2 hover:bg-muted rounded-xl border border-border transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Day Headers */}
                                <div className="grid grid-cols-7 border-b border-border">
                                    {days.map(day => (
                                        <div key={day} className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center py-2">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7" style={{ minHeight: 480 }}>
                                    {Array.from({ length: totalCells }).map((_, i) => {
                                        const day = i - firstWeekday + 1;
                                        const isValid = day >= 1 && day <= daysInMonth;
                                        const dateStr = isValid
                                            ? `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                                            : '';
                                        const dayEvents = isValid
                                            ? events.filter(e => e.date === dateStr)
                                            : [];

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => isValid && openModalOnDay(day)}
                                                className={clsx(
                                                    "p-2 border-r border-b border-border relative transition-colors",
                                                    isValid ? "cursor-pointer group" : "bg-muted/30",
                                                    isToday(day)
                                                        ? "bg-primary/5"
                                                        : isValid
                                                            ? "rounded-xl border border-border bg-white hover:bg-muted/50"
                                                            : ""
                                                )}
                                            >
                                                {isValid && (
                                                    <>
                                                        <span className={clsx(
                                                            "text-xs font-black w-6 h-6 flex items-center justify-center rounded-lg mb-1 transition-all",
                                                            isToday(day)
                                                                ? "bg-primary text-black"
                                                                : "text-muted-foreground group-hover:text-foreground"
                                                        )}>
                                                            {day}
                                                        </span>
                                                        <div className="space-y-0.5">
                                                            {dayEvents.slice(0, 2).map(ev => (
                                                                <div key={ev.id}
                                                                    onClick={e => { e.stopPropagation(); handleEditEvent(ev); }}
                                                                    className={clsx(
                                                                        "text-[9px] font-black truncate px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity",
                                                                        ev.type === 'visit' ? "bg-primary/15 text-primary" :
                                                                        ev.type === 'meeting' ? "bg-emerald-100 text-emerald-700" :
                                                                        "bg-sky-100 text-sky-700"
                                                                    )}>
                                                                    {ev.time} {ev.title}
                                                                    {ev.ownerName && ev.ownerName !== currentUser?.name && (
                                                                        <span className="opacity-60 ml-1">· {ev.ownerName.split(' ')[0]}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {dayEvents.length > 2 && (
                                                                <div className="text-[9px] font-black text-muted-foreground px-1.5">
                                                                    +{dayEvents.length - 2} más
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Agenda Sidebar */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="surface-card p-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 border-l-4 border-primary pl-3">Próximas Sesiones</h3>
                        <div className="space-y-3">
                            {currentUserEvents.map((event) => (
                                <div key={event.id} className="p-4 bg-white border border-border rounded-xl space-y-3 group hover:border-primary/40 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "p-1.5 rounded-lg border",
                                                event.type === 'visit' ? "bg-primary/10 text-primary border-primary/20" :
                                                    event.type === 'meeting' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-sky-50 text-sky-600 border-sky-200"
                                            )}>
                                                {event.type === 'visit' ? <Truck className="w-3.5 h-3.5" /> :
                                                    event.type === 'meeting' ? <Video className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{event.time} · {event.date}</span>
                                                <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{event.title}</h4>
                                                {event.ownerName && <span className="text-[9px] text-muted-foreground font-bold">{event.ownerName}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                                className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                                                title="Editar evento"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground"
                                                title="Eliminar evento"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                                        <User className="w-3 h-3" />
                                        {event.client}
                                    </div>

                                    {event.meetingLink && (
                                        <a
                                            href={event.meetingLink}
                                            target="_blank"
                                            className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-colors"
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            Entrar a Meet
                                        </a>
                                    )}

                                    {event.invitees.length > 0 && (
                                        <div className="flex -space-x-2">
                                            {event.invitees.slice(0, 3).map((inv, idx) => (
                                                <div key={idx} className="w-6 h-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[9px] font-black text-foreground uppercase" title={inv.name}>
                                                    {inv.name.charAt(0)}
                                                </div>
                                            ))}
                                            {event.invitees.length > 3 && (
                                                <div className="w-6 h-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[9px] font-black text-muted-foreground">
                                                    +{event.invitees.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {event.googleEventId && (
                                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">
                                            Sincronizado con Google Calendar
                                        </div>
                                    )}
                                </div>
                            ))}
                            {currentUserEvents.length === 0 && (
                                <div className="p-4 bg-muted/30 border border-border rounded-xl text-sm font-medium text-muted-foreground">
                                    No tienes eventos propios todavía. Conecta Google o agenda tu primera sesión.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Agendar Evento Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row" style={{ maxHeight: '85vh' }}>
                        {/* Left Side: Form */}
                        <div className="flex-1 p-8 overflow-y-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black text-foreground tracking-tight">Agendar Sesión</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Título del Evento *</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Ej: Revisión de Diseño - Parque del Río"
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Fecha</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Hora</label>
                                        <input
                                            type="time"
                                            value={form.time}
                                            onChange={(e) => setForm({ ...form, time: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Meeting Link */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Link de Reunión (opcional)</label>
                                    <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:bg-white">
                                        <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <input
                                            type="url"
                                            value={form.meetingLink}
                                            onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                                            placeholder="https://meet.google.com/... o Zoom, Teams..."
                                            className="flex-1 bg-transparent text-sm text-foreground outline-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Pega el link de tu reunión de Google Meet, Zoom o Teams.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Invitados seleccionados ({form.invitees.length})</label>
                                    <div className="flex flex-wrap gap-2 min-h-[36px]">
                                        {form.invitees.map((inv) => (
                                            <div key={inv.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                                                {inv.type === 'vendedor' ? <Shield className="w-3 h-3 text-primary" /> :
                                                    inv.type === 'lead' ? <User className="w-3 h-3 text-primary" /> : <Globe className="w-3 h-3 text-primary" />}
                                                <span className="text-[10px] font-black text-primary uppercase">{inv.name}</span>
                                                <button onClick={() => setForm(prev => ({ ...prev, invitees: prev.invitees.filter(i => i.id !== inv.id) }))}>
                                                    <X className="w-3 h-3 text-primary/60 hover:text-red-500 transition-colors" />
                                                </button>
                                            </div>
                                        ))}
                                        {form.invitees.length === 0 && (
                                            <p className="text-xs text-muted-foreground">Selecciona invitados desde el directorio</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Search & Directory */}
                        <div className="w-full md:w-[360px] border-l border-border bg-muted/30 p-6 flex flex-col overflow-hidden">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Directorio & Invitaciones</h3>

                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar prospecto o equipo..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 pl-9 text-sm outline-none focus:border-primary focus:bg-white"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-5">
                                {/* External Invitations */}
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Externo (Otra Empresa)</h4>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            placeholder="correo@empresa.com"
                                            value={externalEmail}
                                            onChange={(e) => setExternalEmail(e.target.value)}
                                            className="flex-1 bg-muted border border-border rounded-xl py-2.5 px-3 text-xs outline-none focus:border-primary focus:bg-white"
                                        />
                                        <button onClick={addExternal} className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl hover:bg-primary hover:text-black transition-all">
                                            <Plus className="w-4 h-4 text-primary" />
                                        </button>
                                    </div>
                                </div>

                                {/* Sellers */}
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Equipo Comercial</h4>
                                    <div className="space-y-1">
                                        {sellers.filter(s => [s.name, s.email || ''].some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))).map(seller => (
                                            <button key={seller.id} onClick={() => toggleInvitee(seller, 'vendedor')}
                                                className={clsx("w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left",
                                                    form.invitees.find(i => i.id === seller.id) ? "bg-primary/10 border-primary/30" : "bg-white border-border hover:border-primary/30"
                                                )}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                                                        {seller.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-foreground">{seller.name}</p>
                                                        <p className="text-[9px] text-muted-foreground uppercase">{seller.role}</p>
                                                    </div>
                                                </div>
                                                {form.invitees.find(i => i.id === seller.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Clients */}
                                <div className="space-y-2 pb-4">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Prospectos / Clientes</h4>
                                    <div className="space-y-1">
                                        {clients.filter(l => [l.name, l.company || '', l.email || ''].some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))).map(lead => (
                                            <button key={lead.id} onClick={() => toggleInvitee(lead, 'lead')}
                                                className={clsx("w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left",
                                                    form.invitees.find(i => i.id === lead.id) ? "bg-primary/10 border-primary/30" : "bg-white border-border hover:border-primary/30"
                                                )}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                                                        {(lead.company || lead.name).charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-foreground">{lead.name}</p>
                                                        <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{lead.company}</p>
                                                    </div>
                                                </div>
                                                {form.invitees.find(i => i.id === lead.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                        {clients.length === 0 && <p className="text-xs text-muted-foreground">No hay clientes registrados aún.</p>}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={!form.title}
                                className="mt-4 bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                <Send className="w-4 h-4" />
                                <span>Guardar Evento</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {isEditModalOpen && editingEvent && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-lg font-black text-foreground tracking-tight">Editar Evento</h2>
                            <button onClick={() => { setIsEditModalOpen(false); setEditingEvent(null); }} className="p-2 hover:bg-muted rounded-xl transition-all">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Título</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Fecha</label>
                                    <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Hora</label>
                                    <input
                                        type="time"
                                        value={editForm.time}
                                        onChange={(e) => setEditForm(f => ({ ...f, time: e.target.value }))}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Tipo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['meeting', 'visit', 'call'] as const).map(t => (
                                        <button key={t} onClick={() => setEditForm(f => ({ ...f, type: t }))}
                                            className={clsx(
                                                'py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all',
                                                editForm.type === t
                                                    ? 'bg-primary text-black border-primary'
                                                    : 'bg-white border-border text-muted-foreground hover:border-primary/40'
                                            )}>
                                            {t === 'meeting' ? 'Reunión' : t === 'visit' ? 'Visita' : 'Llamada'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                            <button
                                onClick={() => handleDeleteEvent(editingEvent.id)}
                                className="bg-red-50 border border-red-200 text-red-600 font-medium rounded-xl px-4 py-2 hover:bg-red-100 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editForm.title}
                                className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 flex items-center gap-2 disabled:opacity-40"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
