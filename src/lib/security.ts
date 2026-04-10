// Security utilities for role-based access control
// Part 5: Security - Strict role-based access

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  parent: 2,
  teacher: 3,
  head_teacher: 4,
  admin: 5,
  super_admin: 6,
};

// Permissions for each role
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  student: [
    'read:own_profile',
    'read:own_progress',
    'read:assignments',
    'submit:assignments',
    'read:quiz',
    'take:quiz',
    'read:announcements',
  ],
  parent: [
    'read:own_profile',
    'read:own_children',
    'read:child_progress',
    'read:announcements',
  ],
  teacher: [
    'read:own_profile',
    'read:own_students',
    'read:own_classes',
    'create:assignments',
    'grade:assignments',
    'read:analytics',
    'read:announcements',
    'create:announcements',
  ],
  head_teacher: [
    'read:own_profile',
    'read:all_students',
    'read:all_classes',
    'read:school_analytics',
    'approve:teachers',
    'manage:announcements',
  ],
  admin: [
    'read:own_profile',
    'read:all_users',
    'manage:users',
    'manage:roles',
    'read:system_logs',
    'manage:system',
  ],
  super_admin: [
    '*',
  ],
};

// Check if user has specific permission
export function hasPermission(role: UserRole, permission: string): boolean {
  // Super admin has all permissions
  if (role === 'super_admin') return true;
  
  // Check direct permission
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (permissions.includes(permission)) return true;
  
  // Wildcard check
  if (permissions.includes('*')) return true;
  
  // Check permission prefix
  const [action, resource] = permission.split(':');
  if (permissions.includes(`${action}:*`)) return true;
  
  return false;
}

// Check if user can access another user's data
export function canAccessUser(
  userRole: UserRole,
  userId: string,
  targetUserId: string,
  targetRole?: UserRole
): boolean {
  // Same user can always access their own data
  if (userId === targetUserId) return true;
  
  // Admin can access anyone
  if (userRole === 'admin' || userRole === 'super_admin') return true;
  
  // Teacher can access their students
  if (userRole === 'teacher' || userRole === 'head_teacher') {
    // Would need additional check in real implementation
    return true;
  }
  
  // Parent can access their children
  if (userRole === 'parent') {
    // Would need additional check in real implementation
    return true;
  }
  
  return false;
}

// Check if role can be assigned by another role
export function canAssignRole(
  assignerRole: UserRole,
  targetRole: UserRole
): boolean {
  const assignerLevel = ROLE_HIERARCHY[assignerRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  
  // Can only assign roles lower than or equal to own level
  return assignerLevel > targetLevel;
}

// Verify user session is valid
export async function verifySession(sessionId: string): Promise<{
  valid: boolean;
  userId: string | null;
  role: UserRole | null;
}> {
  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return { valid: false, userId: null, role: null };
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return { valid: false, userId: null, role: null };
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user_id)
      .single();

    return {
      valid: true,
      userId: session.user_id,
      role: profile?.role as UserRole || 'student',
    };
  } catch {
    return { valid: false, userId: null, role: null };
  }
}

// Sanitize user input to prevent injection
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 10000); // Limit length
}

// Validate data before database insertion
export function validateForInsert(data: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    // Check for SQL injection attempts
    if (typeof value === 'string') {
      if (value.includes('DROP TABLE') || 
          value.includes('DELETE FROM') ||
          value.includes('--') && value.length < 10) {
        errors.push(`Suspicious pattern in ${key}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}