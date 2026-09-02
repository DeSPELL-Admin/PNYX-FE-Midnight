"use client";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  variant: 'border' | 'box';
  onTabChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, variant = 'border', onTabChange }: TabsProps) {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const tabWidthPercent = 100 / tabs.length;

  const isBorder = variant === 'border';

  const containerBase = "relative flex w-full";
  const containerStyle = isBorder
    ? "border-b border-brand-primary-700"
    : "bg-[#252525] p-1.5 rounded-[15px]";

  const buttonBase = "flex-1 font-bold transition-colors z-10 relative";
  const buttonStyle = isBorder
    ? "py-3 px-3 text-md"
    : "py-2.5 px-3 text-sm rounded-[12px]";

  const getButtonColor = (isActive: boolean) => {
    if (isBorder) {
      return isActive ? 'text-point-yellow' : 'text-brand-primary-500';
    }
    return isActive ? 'text-brand-primary-900' : 'text-brand-secondary-600 hover:text-brand-secondary-400';
  };

  const indicatorBase = "absolute transition-transform duration-300 ease-out";
  const indicatorStyle = isBorder
    ? "bottom-0 left-0 h-[2px] bg-point-yellow"
    : "top-1.5 bottom-1.5 left-0 bg-point-yellow rounded-[12px] shadow-sm";

  return (
    <div className={`${containerBase} ${containerStyle}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`${buttonBase} ${buttonStyle} ${getButtonColor(activeTab === tab.id)}`}
        >
          {tab.label}
        </button>
      ))}
      <div
        className={`${indicatorBase} ${indicatorStyle}`}
        style={{
          width: isBorder ? `${tabWidthPercent}%` : `calc((100% - 12px) / ${tabs.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
          left: isBorder ? '0' : '6px',
        }}
      >
        {/* Box variant correction for padding logic */}
        {!isBorder && (
          <div className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
