import type { ReactNode } from 'react';

import type { Capability } from './permissions';
import { useCan } from './useCan';

type CanProps = {
  do: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Declarative UI gate: <Can do="players:manage">…</Can> */
export function Can({ do: capability, children, fallback = null }: CanProps) {
  return useCan(capability) ? <>{children}</> : <>{fallback}</>;
}
