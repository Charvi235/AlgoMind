import StarfieldBackground from "./StarfieldBackground";
import Navbar from "./Navbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AppLayout — persistent shell.
 * Renders the fixed starfield backdrop, sticky Navbar, then the
 * animated page slot (children). Animation is handled by App.tsx
 * using AnimatePresence + Framer Motion so the Navbar never re-mounts.
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      {/* Fixed deep-space backdrop — z-index below everything */}
      <StarfieldBackground />

      {/* Sticky top navbar — never unmounts between route changes */}
      <Navbar />

      {/* Page content slot — centered, max-width, consistent padding */}
      <main className="relative z-0 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 min-h-[calc(100vh-4rem)]">
        {children}
      </main>
    </>
  );
}
