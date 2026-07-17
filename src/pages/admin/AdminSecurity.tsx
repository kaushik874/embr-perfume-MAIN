import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Shield, ShieldAlert, Check, X } from "lucide-react";

export function AdminSecurity() {
  const [logins, setLogins] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'logins' | 'actions'>('logins');

  useEffect(() => {
    adminApi.getSecurityLogins().then(r => setLogins(r.attempts));
    adminApi.getSecurityActions().then(r => setActions(r.logs));
  }, []);

  return (
    <AdminLayout>
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8">
        <button onClick={() => setActiveTab('logins')} className={`px-6 py-3 font-semibold flex items-center ${activeTab === 'logins' ? 'border-b-2 border-gold text-gold' : 'text-gray-500'}`}><Shield className="w-4 h-4 mr-2"/> Login Attempts</button>
        <button onClick={() => setActiveTab('actions')} className={`px-6 py-3 font-semibold flex items-center ${activeTab === 'actions' ? 'border-b-2 border-gold text-gold' : 'text-gray-500'}`}><ShieldAlert className="w-4 h-4 mr-2"/> Admin Logs</button>
      </div>

      {activeTab === 'logins' && (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
             <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
               <tr>
                 <th className="px-6 py-4 font-medium">Time</th>
                 <th className="px-6 py-4 font-medium">Email</th>
                 <th className="px-6 py-4 font-medium">IP Address</th>
                 <th className="px-6 py-4 font-medium">Status</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {logins.map(s => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium">{s.email}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{s.ip}</td>
                    <td className="px-6 py-4">
                      {s.success ? <span className="text-green-600 flex items-center"><Check className="w-4 h-4 mr-1"/> Success</span> : <span className="text-red-500 flex items-center"><X className="w-4 h-4 mr-1"/> Failed</span>}
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
           <table className="w-full text-sm text-left">
             <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
               <tr>
                 <th className="px-6 py-4 font-medium">Time</th>
                 <th className="px-6 py-4 font-medium">Admin Email</th>
                 <th className="px-6 py-4 font-medium">Action</th>
                 <th className="px-6 py-4 font-medium">Details</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {actions.map(a => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 text-gray-500">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium">{a.admin_email}</td>
                    <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">{a.action}</span></td>
                    <td className="px-6 py-4 text-gray-500">{a.details}</td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
