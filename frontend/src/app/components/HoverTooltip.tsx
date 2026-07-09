'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const CRM_FIELD_DESCRIPTIONS: Record<string, string> = {
  created_at: 'Lead creation date',
  name: 'Lead name',
  email: 'Primary email',
  country_code: 'Country code',
  mobile_without_country_code: 'Mobile number',
  company: 'Company name',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead owner',
  crm_status: 'Lead status',
  crm_note: 'Notes/remarks',
  data_source: 'Source',
  possession_time: 'Property possession time',
  description: 'Additional description',
};

export function HoverTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleMouseEnter = useCallback(() => {
    if (!content) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
    setShow(true);
  }, [content]);

  const handleMouseLeave = useCallback(() => setShow(false), []);

  return (
    <div
      ref={ref}
      className="relative inline-flex w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && content && mounted && createPortal(
        <div
          className="fixed z-[999] px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-xs leading-relaxed shadow-lg border border-gray-200 dark:border-gray-700 whitespace-normal break-words max-w-sm pointer-events-none"
          style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}
