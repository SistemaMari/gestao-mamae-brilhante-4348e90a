import { createContext, useContext, ReactNode } from "react";

interface ReadOnlyValue {
  readonly: boolean;
  reason?: string;
}

const ReadOnlyContext = createContext<ReadOnlyValue>({ readonly: false });

export function ReadOnlyProvider({
  children,
  readonly,
  reason,
}: {
  children: ReactNode;
  readonly: boolean;
  reason?: string;
}) {
  return (
    <ReadOnlyContext.Provider value={{ readonly, reason }}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
