import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useConnect, useAuthStatus, useDisconnect, useSync, useSyncStatus } from '../../hooks/useAuth';
import './ConnectForm.css';

const connectSchema = z.object({
  username: z.string().email('Enter a valid email address'),
  app_password: z.string().min(1, 'App password is required'),
});

type ConnectFormData = z.infer<typeof connectSchema>;

function formatLastSync(isoString: string | null): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return date.toLocaleDateString();
}

export function ConnectForm() {
  const { data: authStatus, isLoading: statusLoading } = useAuthStatus();
  const { data: syncStatus } = useSyncStatus();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const sync = useSync();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
  });

  const onSubmit = async (data: ConnectFormData) => {
    setError(null);
    try {
      await connect.mutateAsync(data);
      reset();
      // Sync after connecting
      await sync.mutateAsync();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to connect');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleSync = async () => {
    try {
      await sync.mutateAsync();
    } catch (err) {
      console.error('Failed to sync:', err);
    }
  };

  if (statusLoading) {
    return <div className="connect-form loading">Loading...</div>;
  }

  if (authStatus?.connected) {
    return (
      <div className="connect-form connected">
        <div className="status">
          <span className="status-dot connected" />
          <span>Connected as {authStatus.username}</span>
        </div>
        <div className="sync-info">
          <span className="sync-label">Last sync:</span>
          <span className="sync-time">{formatLastSync(syncStatus?.last_sync ?? null)}</span>
          {syncStatus?.sync_interval_minutes && (
            <span className="sync-auto">Auto-sync every {syncStatus.sync_interval_minutes}m</span>
          )}
        </div>
        <div className="actions">
          <button
            className="btn btn-secondary"
            onClick={handleSync}
            disabled={sync.isPending}
          >
            {sync.isPending ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="connect-form">
      <h3>Connect to Fastmail</h3>
      <p className="help-text">
        Use your Fastmail email and an{' '}
        <a
          href="https://www.fastmail.help/hc/en-us/articles/360058752854"
          target="_blank"
          rel="noopener noreferrer"
        >
          app-specific password
        </a>
        .
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="username">Email</label>
          <input
            id="username"
            type="email"
            {...register('username')}
            placeholder="you@example.com"
          />
          {errors.username && (
            <span className="error">{errors.username.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="app_password">App Password</label>
          <input
            id="app_password"
            type="password"
            {...register('app_password')}
            placeholder="Enter app password"
          />
          {errors.app_password && (
            <span className="error">{errors.app_password.message}</span>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary full-width"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
