import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useChat } from '../context/ChatContext';

/** Handler compartilhado para os inputs de arquivo (sidebar e clipe do chat). */
export function useExamFileInput() {
  const { uploadExamFile } = useChat();

  return useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Permite reenviar o mesmo arquivo depois (ex.: após bloqueio LGPD).
      event.target.value = '';
      if (file) void uploadExamFile(file);
    },
    [uploadExamFile],
  );
}
