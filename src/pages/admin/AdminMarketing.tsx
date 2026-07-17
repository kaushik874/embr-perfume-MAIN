import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Mail, MessageSquare, Trash2, CheckCircle } from "lucide-react";

export function AdminMarketing() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'news' | 'msgs'>('news');

  const loadData = () => {
    adminApi.getSubscribers().then(r => setSubscribers(r.subscribers));
    adminApi.getMessages().then(r => setMessages(r.messages));
  };

  useEffect(() => { loadData(); }, []);

  const handleStatus = async (id: number, status: string) => {
    await adminApi.updateMessageStatus(id, status);
    loadData();
  };

  return (
    <AdminLayout>
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8">
        <button onClick={() => setActiveTab('news')} className={`px-6 py-3 font-semibold ${activeTab === 'news' ? 'border-b-2 border-gold text-gold' : 'text-gray-500'}`}>Newsletter</button>
        <button onClick={() => setActiveTab('msgs')} className={`px-6 py-3 font-semibold ${activeTab === 'msgs' ? 'border-b-2 border-gold text-gold' : 'text-gray-500'}`}>Contact Queries</button>
      </div>

      {activeTab === 'news' && (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
             <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
               <tr>
                 <th className="px-6 py-4 font-medium">Email</th>
                 <th className="px-6 py-4 font-medium">Subscribed At</th>
                 <th className="px-6 py-4 font-medium">Action</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {subscribers.map(s => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 font-medium"><Mail className="w-4 h-4 inline mr-2 text-gray-400"/> {s.email}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(s.subscribed_at).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <button onClick={async () => { await adminApi.deleteSubscriber(s.id); loadData(); }} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
                {subscribers.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No subscribers yet.</td></tr>}
             </tbody>
          </table>
        </div>
      )}

      {activeTab === 'msgs' && (
        <div className="space-y-4">
          {messages.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 flex justify-between">
               <div>
                  <h3 className="font-bold">{m.name} <span className="text-gray-500 font-normal">({m.email})</span></h3>
                  <p className="text-sm mt-2 text-gray-700 dark:text-gray-300"><MessageSquare className="w-4 h-4 inline mr-1 text-gray-400"/>{m.query}</p>
                  <p className="text-xs text-gray-500 mt-2">{new Date(m.created_at).toLocaleString()}</p>
               </div>
               <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${m.status === 'replied' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{m.status}</span>
                  {m.status !== 'replied' && (
                    <button onClick={() => handleStatus(m.id, 'replied')} className="block mt-4 text-sm text-green-600 hover:underline"><CheckCircle className="w-4 h-4 inline mr-1"/> Mark Replied</button>
                  )}
               </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-gray-500 text-center py-8">No messages found.</p>}
        </div>
      )}
    </AdminLayout>
  );
}
