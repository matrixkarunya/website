// components/admin/scrollStyles.ts
// Visible, subtle scrollbar for the scrollable body of admin modals.
// - The standard properties cover Firefox and Chrome 121+.
// - The ::-webkit-scrollbar rules cover Safari and older Chromium.
// This also brings the scrollbar back if a global stylesheet hides scrollbars.
export const adminScrollCls =
  'overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.3)_transparent] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25';