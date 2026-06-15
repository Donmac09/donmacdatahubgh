import React, { useState } from 'react';

export default function StoreSetupForm({ currentConfig, onSaveConfig }) {
  const [formData, setFormData] = useState({
    storeName: currentConfig?.storeName || '',
    slug: currentConfig?.slug || '',
    whatsapp: currentConfig?.whatsapp || '',
    welcomeMessage: currentConfig?.welcomeMessage || 'Welcome to our data portal! Fast and reliable data packages delivered instantly.'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Automatically format slugs cleanly as users type
  const handleSlugChange = (e) => {
    const rawVal = e.target.value;
    const cleanSlug = rawVal
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-'); // replace invalid URL symbols with hyphens
    setFormData(prev => ({ ...prev, slug: cleanSlug }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Passes parameters upward to write directly into Supabase/Firebase profiles
      await onSaveConfig(formData);
    } catch (err) {
      console.error("Failed to update portal workspace:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configure Your Storefront</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">Set up custom links and branded text configurations for your customers.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Store Name Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Store Name</label>
          <input 
            type="text"
            required
            placeholder="e.g., Berry's Data Hub"
            value={formData.storeName}
            onChange={(e) => setFormData(prev => ({ ...prev, storeName: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 text-slate-900 transition-colors"
          />
        </div>

        {/* Custom URL Slug Link Mapping */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Custom Link Extension (Slug URL)</label>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
            <span className="bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-500 border-r border-slate-200 flex items-center select-none">
              donmacdata.com/store/
            </span>
            <input 
              type="text"
              required
              placeholder="berrys-hub"
              value={formData.slug}
              onChange={handleSlugChange}
              className="w-full px-3 py-2.5 bg-transparent text-sm font-bold text-indigo-600 focus:outline-none transition-colors"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 px-1 font-medium">
            Your live web target: <span className="underline text-slate-500 font-semibold">donmacdata.com/store/{formData.slug || 'your-name'}</span>
          </p>
        </div>

        {/* WhatsApp Notification Number Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">WhatsApp Orders Receive Number</label>
          <input 
            type="tel"
            required
            placeholder="e.g., 0551234567"
            value={formData.whatsapp}
            onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 text-slate-900 transition-colors"
          />
        </div>

        {/* Welcome Message Text Area */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Storefront Greeting Banner Message</label>
          <textarea 
            rows="3"
            required
            value={formData.welcomeMessage}
            onChange={(e) => setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 text-slate-900 leading-relaxed transition-colors"
          />
        </div>

        {/* Form Execution Handler */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all duration-150 transform active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {isSaving ? 'Updating Storefront...' : 'Save and Activate Workspace'}
        </button>
      </form>
    </div>
  );
}
