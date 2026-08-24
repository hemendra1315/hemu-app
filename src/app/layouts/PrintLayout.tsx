import { Outlet } from 'react-router-dom';

/** Chrome-free layout for printable/report preview routes (see print.css `.no-print`). */
export function PrintLayout() {
  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <Outlet />
    </div>
  );
}
