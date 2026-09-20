import { useMemo, type ReactNode } from 'react';
import { MessagesContext, messagesFor, type Language } from './messages';

/** Names the language its children speak, for a test or for a reader's choice. */
export function MessagesProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const messages = useMemo(() => messagesFor(language), [language]);
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}
