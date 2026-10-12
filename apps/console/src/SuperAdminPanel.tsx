import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@church/shared/auth';
import { ShieldAlert } from 'lucide-react';
import { BRANCHES } from '@church/shared/constants';
import { apiFetchUserRoles, apiUpdateUserRole } from '@church/shared/api';
import type { AdminUser } from '@church/shared/types';

export default function SuperAdminPanel() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);

  const fetchUsers = useCallback(() => {
    apiFetchUserRoles(getToken())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (id: string, role: string, userEmail: string) => {
    const roleLabels: Record<string, string> = {
      user: '一般使用者 (User)',
      admin: '據點管理員 (Admin)',
      system_admin: '系統管理員 (SuperAdmin)',
      inspector: '同工 (Inspector)',
    };
    if (!window.confirm(`確定要將使用者 ${userEmail} 的系統角色變更為「${roleLabels[role]}」嗎？`)) {
      fetchUsers();
      return;
    }

    // 根據變更的角色自動同步據點設定，避免髒資料殘留
    let branch: string | null = null;
    if (role === 'system_admin') {
      branch = '全';
    } else if (role === 'user') {
      branch = null;
    }

    const updateData: { role: string; branch?: string | null } = { role };
    // 如果角色是 system_admin 或是 user，一起發送 branch 設定
    if (role === 'system_admin' || role === 'user') {
      updateData.branch = branch;
    }

    const res = await apiUpdateUserRole(getToken(), id, updateData);
    if (res.ok) fetchUsers();
  };

  const handleBranchChange = async (id: string, branch: string, userEmail: string) => {
    const branchLabel = branch ? `「${branch}」` : '「尚未指派」';
    if (!window.confirm(`確定要將使用者 ${userEmail} 的指派據點變更為 ${branchLabel} 嗎？`)) {
      fetchUsers();
      return;
    }

    const res = await apiUpdateUserRole(getToken(), id, { branch: branch || null });
    if (res.ok) fetchUsers();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm mt-8 animate-in fade-in duration-300">
      <div className="p-6 border-b border-rose-100 flex items-center justify-between bg-rose-50/50 backdrop-blur-sm">
        <h2 className="text-base font-extrabold flex items-center gap-2 text-rose-900 select-none">
          <ShieldAlert className="text-rose-600" size={20} />
          全系統權限控管 (最高權限)
        </h2>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-sm border-collapse bg-white">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-100 select-none">
                <th className="p-4">使用者 Email</th>
                <th className="p-4">系統角色</th>
                <th className="p-4">指派據點</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-800 font-mono text-xs">{u.email}</div>
                    {u.full_name && (
                      <div className="text-[10px] text-slate-400 font-bold mt-1">👤 {u.full_name}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value, u.email)}
                      className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none transition-all shadow-sm cursor-pointer"
                    >
                      <option value="user">一般使用者 (User)</option>
                      <option value="admin">據點管理員 (Admin)</option>
                      <option value="inspector">同工 (Inspector)</option>
                      <option value="system_admin">系統管理員 (SuperAdmin)</option>
                    </select>
                  </td>
                  <td className="p-4">
                    {u.role === 'user' ? (
                      <select
                        disabled
                        value=""
                        className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-slate-50 font-bold text-slate-400 cursor-not-allowed select-none"
                      >
                        <option value="">(不適用)</option>
                      </select>
                    ) : u.role === 'system_admin' ? (
                      <select
                        disabled
                        value="全"
                        className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-slate-50 font-bold text-indigo-400 cursor-not-allowed select-none"
                      >
                        <option value="全">全 (跨據點管理)</option>
                      </select>
                    ) : (
                      <select
                        value={u.branch || ''}
                        onChange={e => handleBranchChange(u.id, e.target.value, u.email)}
                        className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-white font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all shadow-sm cursor-pointer"
                      >
                        <option value="">(尚未指派)</option>
                        <option value="全">全 (跨據點管理)</option>
                        {BRANCHES.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
