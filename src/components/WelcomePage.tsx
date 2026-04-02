import type { ConnectionInfo } from '@/components/ConnectionGroupManager';
import { Button } from '@/components/ui/button';
import { Clock, Database, Keyboard, Plus, Zap } from 'lucide-react';

interface WelcomePageProps {
  connections: ConnectionInfo[];
  recentQueries: any[];
  onNewConnection: () => void;
  onSelectConnection: (connection: ConnectionInfo) => void;
  onSelectQuery?: (sql: string) => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

const AnimatedContainer = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <div
    style={{
      animation: `slideUpFade 0.8s ease-out forwards`,
      animationDelay: `${delay}ms`,
      opacity: 0,
    }}
  >
    {children}
  </div>
);

export function WelcomePage({
  connections,
  recentQueries,
  onNewConnection,
  onSelectConnection,
  onSelectQuery,
  onOpenShortcuts,
}: WelcomePageProps) {
  const recentConnections = connections
    .filter(c => c.last_connected_at)
    .sort((a, b) => new Date(b.last_connected_at!).getTime() - new Date(a.last_connected_at!).getTime())
    .slice(0, 5);

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-dracula-bg via-dracula-bg-hover to-dracula-bg">
      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes floatIn {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animate-float-in {
          animation: floatIn 0.6s ease-out forwards;
        }
        
        .welcome-card {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--color-border);
          background: linear-gradient(135deg, var(--color-bg-surface) 0%, rgba(255,255,255,0.02) 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .welcome-card:hover {
          border-color: var(--color-brand);
          background: linear-gradient(135deg, var(--color-bg-surface) 0%, rgba(189, 147, 249, 0.05) 100%);
          box-shadow: 0 20px 40px rgba(189, 147, 249, 0.15);
          transform: translateY(-8px);
        }
        
        .welcome-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(189, 147, 249, 0.1), transparent);
          transition: left 0.5s ease;
        }
        
        .welcome-card:hover::before {
          left: 100%;
        }
        
        .quick-action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }
        
        .section-title {
          font-size: 1.875rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--color-text);
          display: flex;
          align-items center;
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .section-title-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-brand), var(--color-info));
          border-radius: 8px;
          color: white;
        }
        
        .connection-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 12px;
          background: var(--color-bg-hover);
          border: 1px solid var(--color-border);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .connection-item:hover {
          background: var(--color-bg-active);
          border-color: var(--color-brand);
          transform: translateX(8px);
        }
        
        .connection-icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .query-item {
          padding: 16px;
          border-radius: 12px;
          background: var(--color-bg-hover);
          border-left: 3px solid var(--color-brand);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .query-item:hover {
          background: var(--color-bg-active);
          border-left-color: var(--color-info);
          transform: translateX(6px);
        }
        
        .decorative-dot {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          opacity: 0.05;
          pointer-events: none;
        }
        
        .dot-1 {
          background: var(--color-brand);
          top: -100px;
          right: -100px;
        }
        
        .dot-2 {
          background: var(--color-info);
          bottom: 100px;
          left: -150px;
        }
      `}</style>

      {/* Decorative Elements */}
      <div className="decorative-dot dot-1" />
      <div className="decorative-dot dot-2" />

      <div className="relative max-w-7xl mx-auto px-8 py-16">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Content */}
          <div className="lg:col-span-2">
            <AnimatedContainer delay={0}>
              <div className="mb-12">
                <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-dracula-text leading-tight">
                  Welcome to
                  <br />
                  <span className="relative">
                    <span className="relative z-10">MyLite</span>
                    <span className="absolute bottom-2 left-0 right-0 h-4 bg-dracula-brand/20 blur-sm" />
                  </span>
                </h1>
                <p className="text-lg text-dracula-text-secondary leading-relaxed max-w-md">
                  A lightweight, powerful MySQLclient for developers. Connect to your databases, run queries, and manage your data with elegance.
                </p>
              </div>
            </AnimatedContainer>

            {/* Quick Action Button */}
            <AnimatedContainer delay={120}>
              <Button
                size="lg"
                onClick={onNewConnection}
                className="mb-16 bg-dracula-brand hover:bg-dracula-brand-hover text-dracula-bg font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Start New Connection
              </Button>
            </AnimatedContainer>

            {/* Quick Actions - Asymmetric Layout */}
            <div className="mb-16">
              <div className="section-title">
                <div className="section-title-icon">
                  <Zap className="h-4 w-4" />
                </div>
                Quick Actions
              </div>
              <div className="quick-action-grid">
                {[
                  {
                    icon: Plus,
                    label: 'New Connection',
                    description: 'Create a new database connection',
                    onClick: onNewConnection,
                    color: 'linear-gradient(135deg, #8be9fd, #bd93f9)',
                  },
                  {
                    icon: Keyboard,
                    label: 'Keyboard Shortcuts',
                    description: 'View all available shortcuts',
                    onClick: onOpenShortcuts,
                    color: 'linear-gradient(135deg, #bd93f9, #ff79c6)',
                  },
                ].map((action, idx) => (
                  <AnimatedContainer key={action.label} delay={240 + idx * 80}>
                    <button
                      onClick={action.onClick}
                      className="welcome-card p-6 rounded-xl text-left group"
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white"
                        style={{ background: action.color }}
                      >
                        <action.icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-dracula-text mb-2 group-hover:text-dracula-brand transition-colors">
                        {action.label}
                      </h3>
                      <p className="text-sm text-dracula-text-muted">{action.description}</p>
                    </button>
                  </AnimatedContainer>
                ))}
              </div>
            </div>

            {/* Recent Connections */}
            {recentConnections.length > 0 && (
              <AnimatedContainer delay={400}>
                <div>
                  <div className="section-title">
                    <div className="section-title-icon">
                      <Clock className="h-4 w-4" />
                    </div>
                    Recent Connections
                  </div>
                  <div className="space-y-3">
                    {recentConnections.map((conn, idx) => (
                      <button
                        key={conn.id}
                        onClick={() => onSelectConnection(conn)}
                        className="connection-item w-full text-left"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div
                          className="connection-icon"
                          style={{
                            backgroundColor: conn.color ? `${conn.color}15` : 'var(--color-bg-hover)',
                          }}
                        >
                          <Database
                            className="h-5 w-5"
                            style={{ color: conn.color || 'var(--color-brand)' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-dracula-text truncate">{conn.name}</div>
                          <div className="text-sm text-dracula-text-muted">
                            {conn.host}:{conn.port}
                          </div>
                        </div>
                        <div className="text-xs text-dracula-text-muted whitespace-nowrap">
                          {new Date(conn.last_connected_at!).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </AnimatedContainer>
            )}
          </div>

          {/* Right Column: Visual + Recent Queries */}
          <div className="lg:col-span-1">
            {/* Decorative Visual Section */}
            <AnimatedContainer delay={150}>
              <div className="mb-12 sticky top-8">
                <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-dracula-brand/10 via-dracula-info/5 to-transparent border border-dracula-border/50 backdrop-blur-sm">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-dracula-brand/20 to-dracula-info/20 rounded-full blur-3xl" />
                      <Database className="h-24 w-24 text-dracula-brand/30 relative" />
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedContainer>

            {/* Recent Queries Sidebar */}
            {recentQueries.length > 0 && (
              <AnimatedContainer delay={300}>
                <div>
                  <div className="section-title text-lg">
                    <Zap className="h-5 w-5 text-dracula-warning" />
                    Recent
                  </div>
                  <div className="space-y-3">
                    {recentQueries.slice(0, 4).map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectQuery?.(query.sql)}
                        className="query-item w-full text-left group"
                      >
                        <code className="text-xs font-mono text-dracula-brand group-hover:text-dracula-info transition-colors line-clamp-2">
                          {query.sql.substring(0, 60)}...
                        </code>
                        <div className="flex items-center gap-2 mt-2 text-xs text-dracula-text-muted">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: query.success ? 'var(--color-success)' : 'var(--color-error)' }} />
                          {query.execution_time_ms}ms
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </AnimatedContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
