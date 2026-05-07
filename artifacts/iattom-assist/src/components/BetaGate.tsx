interface BetaGateProps {
  children: React.ReactNode;
}

// Beta gate is disabled — all authenticated users go directly to the dashboard.
// Re-enable by restoring betaAccess/role checks when private beta mode is needed.
export function BetaGate({ children }: BetaGateProps) {
  return <>{children}</>;
}
