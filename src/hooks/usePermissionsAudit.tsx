import { supabase } from "@/integrations/supabase/client";

export interface AuditUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
}

export interface EffectivePermission {
  permission_key: string;
  allowed: boolean;
  granted_by_roles: string[] | null;
}

export interface SecurityTableCheck {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
}

export interface SecurityRpcCheck {
  function_name: string;
  security_definer: boolean;
  owner: string;
  signature: string;
}

export interface SecurityChecks {
  tables: SecurityTableCheck[];
  rpcs: SecurityRpcCheck[];
  checked_at: string;
}

export const usePermissionsAudit = () => {
  const searchUsers = async (searchTerm: string): Promise<AuditUser[]> => {
    console.log('[usePermissionsAudit] searchUsers:', { searchTerm });
    
    const { data, error } = await supabase.rpc('audit_search_users', { 
      p_search_term: searchTerm || null
    });
    
    if (error) {
      console.error('[usePermissionsAudit] searchUsers error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('[usePermissionsAudit] searchUsers result:', { count: data?.length });
    return (data || []) as AuditUser[];
  };

  const getEffectivePermissions = async (userId: string): Promise<EffectivePermission[]> => {
    console.log('[usePermissionsAudit] getEffectivePermissions:', { userId });
    
    const { data, error } = await supabase.rpc('audit_user_effective_permissions', { 
      p_user_id: userId 
    });
    
    if (error) {
      console.error('[usePermissionsAudit] getEffectivePermissions error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('[usePermissionsAudit] getEffectivePermissions result:', { count: data?.length });
    return (data || []) as EffectivePermission[];
  };

  const getSecurityChecks = async (): Promise<SecurityChecks> => {
    console.log('[usePermissionsAudit] getSecurityChecks');
    
    const { data, error } = await supabase.rpc('audit_security_checks');
    
    if (error) {
      console.error('[usePermissionsAudit] getSecurityChecks error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('[usePermissionsAudit] getSecurityChecks result:', data);
    return data as unknown as SecurityChecks;
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      console.warn('[usePermissionsAudit] exportToCSV: No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (Array.isArray(val)) return `"${val.join(', ')}"`;
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[usePermissionsAudit] exportToCSV:', { filename, rows: data.length });
  };

  return { 
    searchUsers, 
    getEffectivePermissions, 
    getSecurityChecks,
    exportToCSV 
  };
};
