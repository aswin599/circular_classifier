import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Circular, Category, PaginatedResponse, SearchFilters, Stats, User } from '../types';

export interface CircularsQueryParams {
  page?: number;
  limit?: number;
  categoryId?: number | string;
  priority?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  tag?: string;
  senderName?: string;
  endingToday?: boolean | string;
  q?: string;
}

// Circulars
export function useCirculars(params: CircularsQueryParams = {}) {
  return useQuery({
    queryKey: ['circulars', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Circular>>('/api/circulars', { params });
      return response.data;
    },
  });
}

export function useEndingTodayCount() {
  return useQuery({
    queryKey: ['ending-today-count'],
    queryFn: async () => {
      const response = await api.get<{ count: number }>('/api/circulars/ending-today-count');
      return response.data.count;
    },
    refetchInterval: 30000,
  });
}

export function useCircular(id: string | undefined) {
  return useQuery({
    queryKey: ['circular', id],
    queryFn: async () => {
      const response = await api.get<{ circular: Circular }>(`/api/circulars/${id}`);
      return response.data.circular;
    },
    enabled: !!id,
  });
}

export function useMarkCircularRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, read = true }: { id: string; read?: boolean }) => {
      const response = await api.post<{ success: boolean; isRead: boolean }>(
        `/api/circulars/${id}/read`,
        { read }
      );
      return response.data;
    },
    onSuccess: (_data, { read = true }) => {
      // CircularTable plays a row-removal animation (message holds 1000ms,
      // then slide + collapse, row dropped at ~2600ms). The server already
      // excludes read circulars, so invalidating immediately would refetch the
      // list and unmount the row mid-animation. Delay it until the animation
      // has finished so the effect can be seen and still stays consistent.
      const delay = read ? 2800 : 0;
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['circulars'] });
        queryClient.invalidateQueries({ queryKey: ['search'] });
        queryClient.invalidateQueries({ queryKey: ['ending-today-count'] });
      }, delay);
    },
  });
}

export function useSearch(params: SearchFilters) {
  return useQuery({
    queryKey: ['search', params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Circular>>('/api/search', { params });
      return response.data;
    },
  });
}

export function useSearchSuggestions() {
  return useQuery({
    queryKey: ['search-suggestions'],
    queryFn: async () => {
      const response = await api.get<{ categories: Category[]; tags: string[]; priorities: string[] }>(
        '/api/search/suggestions'
      );
      return response.data;
    },
  });
}

// Categories
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<{ data: Category[] }>('/api/categories');
      return response.data.data;
    },
  });
}

// Stats
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await api.get<Stats>('/api/admin/overview');
      return response.data;
    },
    refetchInterval: 30000,
  });
}

// Users (admin)
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<{ data: User[] }>('/api/users');
      return response.data.data;
    },
  });
}

// Mutations
export function useDeleteCircular() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/circulars/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateCircular() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await api.put(`/api/circulars/${id}`, data);
      return response.data.circular as Circular;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars'] });
      queryClient.invalidateQueries({ queryKey: ['circular'] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; keywords: string[]; color?: string }) => {
      const response = await api.post('/api/categories', data);
      return response.data.category as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const response = await api.put(`/api/categories/${id}`, data);
      return response.data.category as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export interface MailboxSyncResult {
  success: boolean;
  accounts: number;
  fetched: number;
  circularsFound: number;
  saved: number;
  duplicates: number;
  skippedNonCirculars: number;
  errors: string[];
}

export function useTriggerEmailFetch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<MailboxSyncResult>('/api/processor/gmail-sync');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useTrainClassifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/processor/train');
      return response.data as { trained: number; categories: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars'] });
    },
  });
}

export interface GmailConnection {
  connected: boolean;
  authProvider?: string;
  expiresAt?: string | null;
  needsRefresh?: boolean;
  email?: string;
}

export function useGmailConnection() {
  return useQuery({
    queryKey: ['gmail-connection'],
    queryFn: async () => {
      const response = await api.get<GmailConnection>('/api/auth/google/connection');
      return response.data;
    },
  });
}

export function useSyncGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { query?: string; limit?: number }) => {
      const response = await api.post('/api/auth/google/fetch', opts ?? {});
      return response.data;
    },
    mutationKey: ['gmail-connection'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-connection'] });
    },
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/auth/google/disconnect');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-connection'] });
    },
  });
}
