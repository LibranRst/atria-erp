"use client";

import React, { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { GlobalExpenseDrawer } from "@/components/expense/global-drawer";

type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function MobileShell({ children }: MobileShellProps): React.JSX.Element {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      
      {/* Top AppBar - Fixed, contents centered to match page width */}
      {!isLoginPage && (
        <header className="fixed top-0 left-0 w-full z-50 flex items-center h-14 bg-surface shadow-sm select-none">
          <div className="max-w-md mx-auto w-full px-margin-mobile flex justify-between items-center h-full">
            <div className="flex items-center gap-3">
              <Link 
                href="/profile" 
                className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant active:scale-95 transition-transform shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  alt="Sarah" 
                  className="w-full h-full object-cover" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuADXAgU9ZnQpX6SfXgQYugUs6zX_n5ZV1XzT3Xc0d3G0yfv06OjXLk-TGGlBYiXk8tf9MdiMQcVbLDEq93hiTESrINtDyGHnL4pjx1XN8uwqX5MOijHuYwCpcbc-cqQkVqpYi45yqRRYmD8h3RIOeurq-84cqZ33gtgCs8vmsCbbFt9gvEUp9BKLVNN4g7EdQ7I6Y_5rx_5-58PaiB0aya8NlPT0fvzxtPrvTspuv_czI9U5EpCRvLlY8x_tNrPwgtNZqeO_bLNxXjy" 
                />
              </Link>
              <h1 className="font-display text-display text-primary text-[20px] leading-tight">Finance ERP</h1>
            </div>
            <Link 
              href="/profile" 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors active:scale-95 duration-200 text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
            </Link>
          </div>
        </header>
      )}

      {/* Screen Content - Space-y-lg handles margins between widgets automatically */}
      <main className={`mx-auto max-w-md w-full px-margin-mobile ${
        isLoginPage 
          ? "pt-6 pb-6 min-h-screen flex flex-col justify-center" 
          : "pt-20 pb-40 space-y-lg"
      }`}>
        {children}
      </main>

      {/* Bottom Navigation wrapped in Suspense */}
      {!isLoginPage && (
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      )}

      {/* Global Expense Drawer wrapped in Suspense */}
      {!isLoginPage && (
        <Suspense fallback={null}>
          <GlobalExpenseDrawer />
        </Suspense>
      )}
    </div>
  );
}
