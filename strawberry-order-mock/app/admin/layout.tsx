// strawberry-order-mock/app/admin/layout.tsx
import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ここではロールチェックなどは行わない
  // /admin/orders, /admin/users 側で制御する方針
  return <>{children}</>;
}
