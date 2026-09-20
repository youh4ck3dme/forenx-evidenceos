import { Navigate, Route, Routes } from 'react-router-dom'
import { WelcomePage } from '@/features/cases/WelcomePage'
import { SandboxPage } from '@/app/SandboxPage'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { useEffect } from 'react'

export function App() {
  const ready = useWorkspaceStore((s) => s.ready)
  const init = useWorkspaceStore((s) => s.init)
  const enteredSandbox = useWorkspaceStore((s) => s.enteredSandbox)

  useEffect(() => {
    if (!ready) void init()
  }, [ready, init])

  return (
    <Routes>
      <Route
        path="/"
        element={
          enteredSandbox ? <Navigate to="/sandbox" replace /> : <WelcomePage />
        }
      />
      <Route path="/sandbox" element={<SandboxPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
