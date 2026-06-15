{/* Core Branded Carrier Catalog */}
<div className="xl:col-span-2 space-y-4">
  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
    <h3 className="font-extrabold text-slate-900 text-lg">Product Rate Packages</h3>
    <span className="text-xs text-slate-500 font-medium">Official Provider Channels</span>
  </div>
  
  <div className="space-y-4">
    {Object.entries(PACKAGES).map(([key, group]) => {
      let logoElement = null;
      let containerBorder = "border-slate-100";
      let containerBg = "bg-white";
      const normalizedKey = key.toLowerCase();
      
      // 1. Authentic MTN Logo Render Structure
      if (normalizedKey.includes('mtn')) {
        containerBorder = "border-[#FFCC00]/30";
        containerBg = "bg-[#FFCC00]/5";
        logoElement = (
          <div className="w-[72px] h-[44px] bg-[#FFCC00] rounded-lg flex items-center justify-center p-1 shadow-sm select-none shrink-0 border border-[#E6B800]">
            <div className="w-[52px] h-[30px] border-[2.5px] border-[#002b49] rounded-full flex items-center justify-center">
              <span className="text-[#002b49] font-black text-[11px] tracking-tighter uppercase font-sans">MTN</span>
            </div>
          </div>
        );
      } 
      // 2. Authentic Telecel Logo Render Structure
      else if (normalizedKey.includes('telecel') || normalizedKey.includes('vodafone')) {
        containerBorder = "border-[#E60000]/20";
        containerBg = "bg-[#E60000]/5";
        logoElement = (
          <div className="w-[72px] h-[44px] bg-[#E60000] rounded-lg flex items-center justify-center p-1 shadow-sm select-none shrink-0">
            <div className="flex items-center justify-center gap-0.5">
              {/* Telecel Red Circle & Minimal Typo */}
              <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <span className="text-white font-black text-[12px] tracking-tight lowercase font-sans">telecel</span>
            </div>
          </div>
        );
      } 
      // 3. Authentic AT (AirtelTigo) Logo Render Structure
      else if (normalizedKey.includes('airtel') || normalizedKey.includes('at')) {
        containerBorder = "border-blue-200";
        containerBg = "bg-blue-50/20";
        logoElement = (
          <div className="w-[72px] h-[44px] bg-gradient-to-br from-[#005A9C] via-[#004B84] to-[#E21225] rounded-lg flex items-center justify-center p-1 shadow-sm select-none shrink-0 border border-blue-900/10">
            <span className="text-white font-black text-sm italic tracking-tighter uppercase font-serif">at</span>
          </div>
        );
      }

      return (
        <div 
          key={key} 
          className={`p-2 rounded-2xl border ${containerBorder} ${containerBg} transition-all duration-200 shadow-sm`}
        >
          {/* Header Layout Containing Genuine Logo Dimensions */}
          <div className="flex items-center gap-4 px-3 pt-2 pb-2">
            {logoElement}
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                {group.label || key.replace(/_/g, ' ')}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {group.validity || 'Instant Auto Delivery'}
                </p>
              </div>
            </div>
          </div>

          {/* Secure subcard insertion parameters stay completely preserved */}
          <div className="bg-white rounded-xl border border-slate-100 p-2 mt-1">
            <PackageCard
              groupKey={key}
              group={group}
              pkgConfig={pkgConfig}
              resellerPrices={resellerPrices}
              onBuy={(gk, item, price) => setBuyState({ groupKey: gk, item, price })}
            />
          </div>
        </div>
      );
    })}
  </div>
</div>
