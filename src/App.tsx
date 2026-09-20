import { Navigate, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/layout/AppShell"
import { DemoPage } from "@/pages/DemoPage"
import { Gallery } from "@/pages/Gallery"
import { Method } from "@/pages/Method"
import { SpendProvider } from "@/lib/spend-context"

export default function App() {
  return (
    <SpendProvider>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Gallery />} />
            <Route path="method" element={<Method />} />
            <Route path="demo/:slug" element={<DemoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </SpendProvider>
  )
}
