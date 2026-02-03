import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCalendars, useUpdateCalendar } from '../../hooks/useCalendars';
import { useAuthStatus, useConnect, useDisconnect, useSync, useSyncStatus } from '../../hooks/useAuth';
import type { Calendar } from '../../types/calendar';
import './SettingsModal.css';

type SettingsSection = 'caldav' | 'calendars' | 'ai' | 'integrations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('caldav');
  const { data: calendars = [] } = useCalendars();
  const updateCalendar = useUpdateCalendar();

  // Auth hooks
  const { data: authStatus } = useAuthStatus();
  const { data: syncStatus } = useSyncStatus();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const sync = useSync();
  const [connectError, setConnectError] = useState<string | null>(null);

  // CalDAV settings state
  const [caldavProvider, setCaldavProvider] = useState<string>('fastmail');

  // AI settings state
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openclawKey, setOpenclawKey] = useState('');
  const [openclawEndpoint, setOpenclawEndpoint] = useState('');

  // Integration settings state
  const [unsplashKey, setUnsplashKey] = useState('');
  const [calcomKey, setCalcomKey] = useState('');
  const [calcomUrl, setCalcomUrl] = useState('https://api.cal.com/v1');
  const [immichUrl, setImmichUrl] = useState('');
  const [immichKey, setImmichKey] = useState('');
  const [googlePhotosClientId, setGooglePhotosClientId] = useState('');
  const [googlePhotosClientSecret, setGooglePhotosClientSecret] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
  });

  const onConnectSubmit = async (data: ConnectFormData) => {
    setConnectError(null);
    try {
      await connect.mutateAsync(data);
      reset();
      await sync.mutateAsync();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setConnectError(error.response?.data?.detail || 'Failed to connect');
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

  const handleCalendarVisibilityToggle = async (calendar: Calendar) => {
    try {
      await updateCalendar.mutateAsync({
        id: calendar.id,
        data: { visible: !calendar.visible },
      });
    } catch (error) {
      console.error('Failed to update calendar visibility:', error);
    }
  };

  if (!isOpen) return null;

  const caldavProviders = [
    { id: 'fastmail', name: 'Fastmail', url: 'https://caldav.fastmail.com/', helpUrl: 'https://www.fastmail.help/hc/en-us/articles/360058752854' },
    { id: 'apple', name: 'Apple Calendar (iCloud)', url: 'https://caldav.icloud.com/', helpUrl: 'https://support.apple.com/en-us/102654' },
    { id: 'protonmail', name: 'ProtonMail', url: 'https://calendar.proton.me/api/calendar/v1/', helpUrl: null },
    { id: 'google', name: 'Google Calendar', url: 'https://www.googleapis.com/caldav/v2/', helpUrl: 'https://myaccount.google.com/apppasswords' },
    { id: 'custom', name: 'Custom CalDAV Server', url: '', helpUrl: null },
  ];

  const currentProvider = caldavProviders.find(p => p.id === caldavProvider);

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <nav className="settings-nav">
            <button
              className={`settings-nav-item ${activeSection === 'caldav' ? 'active' : ''}`}
              onClick={() => setActiveSection('caldav')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              CalDAV
              {authStatus?.connected && <span className="nav-status-dot connected" />}
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'calendars' ? 'active' : ''}`}
              onClick={() => setActiveSection('calendars')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Calendars
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveSection('ai')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                <circle cx="8" cy="14" r="1" />
                <circle cx="16" cy="14" r="1" />
              </svg>
              AI
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'integrations' ? 'active' : ''}`}
              onClick={() => setActiveSection('integrations')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Integrations
            </button>
          </nav>

          <div className="settings-content">
            {/* CalDAV Section */}
            {activeSection === 'caldav' && (
              <div className="settings-section">
                <h3>CalDAV Connection</h3>
                <p className="section-description">
                  Connect to your calendar provider using CalDAV protocol.
                </p>

                {/* Connection Status */}
                {authStatus?.connected ? (
                  <div className="connection-status">
                    <div className="connection-info">
                      <div className="connection-header">
                        <span className="status-dot connected" />
                        <span className="connection-label">Connected</span>
                      </div>
                      <div className="connection-details">
                        <div className="detail-row">
                          <span className="detail-label">Account</span>
                          <span className="detail-value">{authStatus.username}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Last sync</span>
                          <span className="detail-value">{formatLastSync(syncStatus?.last_sync ?? null)}</span>
                        </div>
                        {syncStatus?.sync_interval_minutes && (
                          <div className="detail-row">
                            <span className="detail-label">Auto-sync</span>
                            <span className="detail-value">Every {syncStatus.sync_interval_minutes} minutes</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="connection-actions">
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
                ) : (
                  /* Connection Form */
                  <form onSubmit={handleSubmit(onConnectSubmit)} className="connection-form">
                    {connectError && <div className="error-message">{connectError}</div>}

                    <div className="form-group">
                      <label>Provider</label>
                      <select
                        value={caldavProvider}
                        onChange={e => setCaldavProvider(e.target.value)}
                      >
                        {caldavProviders.map(provider => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        {...register('username')}
                        placeholder="you@example.com"
                      />
                      {errors.username && (
                        <span className="field-error">{errors.username.message}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>App Password</label>
                      <input
                        type="password"
                        {...register('app_password')}
                        placeholder="Enter app-specific password"
                      />
                      {errors.app_password && (
                        <span className="field-error">{errors.app_password.message}</span>
                      )}
                      <span className="help-text">
                        Use an app-specific password, not your main account password.
                        {currentProvider?.helpUrl && (
                          <> <a href={currentProvider.helpUrl} target="_blank" rel="noopener noreferrer">Create one here</a></>
                        )}
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Connecting...' : 'Connect'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Calendars Section */}
            {activeSection === 'calendars' && (
              <div className="settings-section">
                <h3>My Calendars</h3>
                <p className="section-description">
                  Manage visibility of your synced calendars.
                </p>

                {calendars.length === 0 ? (
                  <div className="empty-state">
                    <p>No calendars found. Connect to a CalDAV provider first.</p>
                  </div>
                ) : (
                  <div className="calendar-list">
                    {calendars.map((calendar: Calendar) => (
                      <div key={calendar.id} className="calendar-item">
                        <div
                          className="calendar-color"
                          style={{ backgroundColor: calendar.color }}
                        />
                        <span className="calendar-name">{calendar.name}</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={calendar.visible}
                            onChange={() => handleCalendarVisibilityToggle(calendar)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Section */}
            {activeSection === 'ai' && (
              <div className="settings-section">
                <h3>AI Providers</h3>
                <p className="section-description">
                  Configure AI providers for smart features like event suggestions and natural language input.
                </p>

                <div className="provider-group">
                  <h4>OpenAI</h4>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={e => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <span className="help-text">
                      Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Dashboard</a>
                    </span>
                  </div>
                </div>

                <div className="provider-group">
                  <h4>Anthropic</h4>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={e => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                    <span className="help-text">
                      Get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Anthropic Console</a>
                    </span>
                  </div>
                </div>

                <div className="provider-group">
                  <h4>OpenClaw (Self-hosted)</h4>
                  <div className="form-group">
                    <label>Endpoint URL</label>
                    <input
                      type="url"
                      value={openclawEndpoint}
                      onChange={e => setOpenclawEndpoint(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                    />
                  </div>
                  <div className="form-group">
                    <label>API Key (optional)</label>
                    <input
                      type="password"
                      value={openclawKey}
                      onChange={e => setOpenclawKey(e.target.value)}
                      placeholder="Optional API key"
                    />
                    <span className="help-text">
                      For self-hosted LLM servers like Ollama, LocalAI, or vLLM
                    </span>
                  </div>
                </div>

                <button className="btn btn-primary">
                  Save AI Settings
                </button>
              </div>
            )}

            {/* Integrations Section */}
            {activeSection === 'integrations' && (
              <div className="settings-section">
                <h3>Integrations</h3>
                <p className="section-description">
                  Connect external services to enhance your calendar experience.
                </p>

                <div className="provider-group">
                  <h4>Unsplash</h4>
                  <p className="provider-description">
                    High-quality images for event covers and backgrounds.
                  </p>
                  <div className="form-group">
                    <label>Access Key</label>
                    <input
                      type="password"
                      value={unsplashKey}
                      onChange={e => setUnsplashKey(e.target.value)}
                      placeholder="Enter Unsplash access key"
                    />
                    <span className="help-text">
                      Get your key from <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer">Unsplash Developers</a>
                    </span>
                  </div>
                </div>

                <div className="provider-group">
                  <h4>Cal.com</h4>
                  <p className="provider-description">
                    Scheduling infrastructure for booking links.
                  </p>
                  <div className="form-group">
                    <label>API URL</label>
                    <input
                      type="url"
                      value={calcomUrl}
                      onChange={e => setCalcomUrl(e.target.value)}
                      placeholder="https://api.cal.com/v1"
                    />
                  </div>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={calcomKey}
                      onChange={e => setCalcomKey(e.target.value)}
                      placeholder="Enter Cal.com API key"
                    />
                    <span className="help-text">
                      Get your key from <a href="https://app.cal.com/settings/developer/api-keys" target="_blank" rel="noopener noreferrer">Cal.com Settings</a>
                    </span>
                  </div>
                </div>

                <div className="provider-group">
                  <h4>Immich</h4>
                  <p className="provider-description">
                    Self-hosted photo management for event photos.
                  </p>
                  <div className="form-group">
                    <label>Server URL</label>
                    <input
                      type="url"
                      value={immichUrl}
                      onChange={e => setImmichUrl(e.target.value)}
                      placeholder="http://localhost:2283"
                    />
                  </div>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={immichKey}
                      onChange={e => setImmichKey(e.target.value)}
                      placeholder="Enter Immich API key"
                    />
                    <span className="help-text">
                      Generate an API key in Immich under Account Settings
                    </span>
                  </div>
                </div>

                <div className="provider-group">
                  <h4>Google Photos</h4>
                  <p className="provider-description">
                    Access your Google Photos for event memories.
                  </p>
                  <div className="form-group">
                    <label>Client ID</label>
                    <input
                      type="text"
                      value={googlePhotosClientId}
                      onChange={e => setGooglePhotosClientId(e.target.value)}
                      placeholder="Enter OAuth Client ID"
                    />
                  </div>
                  <div className="form-group">
                    <label>Client Secret</label>
                    <input
                      type="password"
                      value={googlePhotosClientSecret}
                      onChange={e => setGooglePhotosClientSecret(e.target.value)}
                      placeholder="Enter OAuth Client Secret"
                    />
                    <span className="help-text">
                      Create OAuth credentials in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>
                    </span>
                  </div>
                </div>

                <button className="btn btn-primary">
                  Save Integration Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
