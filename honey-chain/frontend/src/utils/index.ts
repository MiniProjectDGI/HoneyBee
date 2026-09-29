import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BatchStatus, AlertSeverity, QualityStatus, BlockchainRecordStatus, AIModelStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.substring(0, n) + '...' : str;
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  DRAFT: 'Draft',
  COLLECTED: 'Collected',
  PROCESSING: 'Processing',
  QUALITY_TESTING: 'Quality Testing',
  APPROVED: 'Approved',
  PACKAGED: 'Packaged',
  IN_DISTRIBUTION: 'In Distribution',
  AT_RETAILER: 'At Retailer',
  SOLD: 'Sold',
  RECALLED: 'Recalled',
};

export const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  COLLECTED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-orange-100 text-orange-700',
  QUALITY_TESTING: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  PACKAGED: 'bg-teal-100 text-teal-700',
  IN_DISTRIBUTION: 'bg-indigo-100 text-indigo-700',
  AT_RETAILER: 'bg-cyan-100 text-cyan-700',
  SOLD: 'bg-emerald-100 text-emerald-700',
  RECALLED: 'bg-red-100 text-red-700',
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export const QUALITY_STATUS_COLORS: Record<QualityStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  CONDITIONAL_PASS: 'bg-orange-100 text-orange-700',
};

export const BLOCKCHAIN_STATUS_COLORS: Record<BlockchainRecordStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  UNVERIFIED: 'bg-slate-100 text-slate-700',
};

export const AI_STATUS_LABELS: Record<AIModelStatus, string> = {
  MODEL_AVAILABLE: 'Model Available',
  MODEL_UNAVAILABLE: 'Model Unavailable',
  PREDICTION_PENDING: 'Pending',
  PREDICTION_AVAILABLE: 'Available',
  PREDICTION_FAILED: 'Failed',
  INSUFFICIENT_DATA: 'Insufficient Data',
};

export function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
