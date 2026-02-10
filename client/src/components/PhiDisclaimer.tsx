/**
 * PHI Disclaimer Component
 * Displays a persistent warning about not sharing Protected Health Information
 */

import { AlertTriangle } from "lucide-react";

export function PhiDisclaimer() {
  return (
    <div className="bg-yellow-900/20 border-t border-yellow-500/30 py-2 px-4">
      <div className="container mx-auto flex items-center justify-center gap-2 text-xs text-yellow-200">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <p className="text-center">
          <span className="font-semibold">PHI Warning:</span> Do not share Protected Health Information (PHI) or patient data in this portal
        </p>
      </div>
    </div>
  );
}
