// strawberry-order-mock/app/admin/layout.tsx
import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ここではロールチェックなどは一切行わず、
  // 各ページ側（orders/users）で制御する方針にします。
  return <>{children}</>;
}
