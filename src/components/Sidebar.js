import React from 'react';

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeView,
  setActiveView
}) {
  return (
    <aside className={`fixed top-0 left-0 h-full w-64 glass-panel rounded-none border-y-0 border-l-0 border-r border-hairline z-48 p-6 flex flex-col gap-6 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} text-glass-crisp pt-20 bg-white/70`}>
      <div className="flex justify-between items-center border-b border-hairline pb-4">
        <span className="text-xs font-bold text-ink-secondary">행정 시스템 메뉴</span>
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="text-ink-secondary hover:text-ink text-sm font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>
      <nav className="flex flex-col gap-2.5 text-xs font-semibold">
        <button 
          onClick={() => {
            setActiveView('map');
            setIsSidebarOpen(false);
          }} 
          className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-2.5 cursor-pointer border ${activeView === 'map' ? 'text-primary bg-primary/5 border-primary/10' : 'text-ink border-transparent hover:bg-primary/5'}`}
        >
          🗺️ 입지분석 메인 (Map)
        </button>
        <button 
          onClick={() => {
            setActiveView('dashboard');
            setIsSidebarOpen(false);
          }} 
          className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-2.5 cursor-pointer border ${activeView === 'dashboard' ? 'text-primary bg-primary/5 border-primary/10' : 'text-ink border-transparent hover:bg-primary/5'}`}
        >
          📊 이력 대시보드 (Analytics)
        </button>
      </nav>
    </aside>
  );
}
