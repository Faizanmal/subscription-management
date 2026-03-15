'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-base';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_at?: string;
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      try {
        return await api.get<Tag[]>('/tags/');
      } catch {
        return [] as Tag[];
      }
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.post<Tag>('/tags/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}
