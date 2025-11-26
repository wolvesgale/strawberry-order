// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 py-16 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">
          いちご販売 受発注モック
        </h1>
        <p className="text-sm text-slate-600">
          グリーンサム向けのいちご受発注システムのモックです。
          下のリンクから画面に移動できます。
        </p>

        <div className="space-y-3">
          <a
            href="/order"
            className="block w-full text-center rounded-md bg-red-600 text-white text-sm font-semibold py-2"
          >
            発注フォームへ
          </a>
          <a
            href="/admin/orders"
            className="block w-full text-center rounded-md border border-slate-300 text-slate-800 text-sm font-semibold py-2 bg-white"
          >
            管理画面（注文一覧）へ
          </a>
        </div>
      </div>
    </main>
  );
}
