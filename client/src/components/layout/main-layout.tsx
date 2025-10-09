import { ReactNode, createContext, useContext, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Footer } from "./footer";

interface MainLayoutProps {
  children: ReactNode;
}

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebarState = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarState must be used within MainLayout');
  }
  return context;
};

export function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className={`transition-all duration-300 ${collapsed ? 'md:pl-16' : 'md:pl-64'} pl-0`}>
          <Header />
          <main className="p-4 md:p-6">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
