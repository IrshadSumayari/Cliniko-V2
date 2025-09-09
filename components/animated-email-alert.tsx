import { useState, useEffect } from 'react';
import { Mail, AlertTriangle, X } from 'lucide-react';

const AnimatedEmailAlert = () => {
  const [showEmail, setShowEmail] = useState(false);
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    // Start the animation cycle
    const timer = setTimeout(() => {
      setShowEmail(true);
    }, 1000);

    // Mark as read after a moment
    const readTimer = setTimeout(() => {
      setIsRead(true);
    }, 3000);

    // Reset animation every 8 seconds
    const resetTimer = setInterval(() => {
      setShowEmail(false);
      setIsRead(false);
      setTimeout(() => setShowEmail(true), 1000);
      setTimeout(() => setIsRead(true), 3000);
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(readTimer);
      clearInterval(resetTimer);
    };
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Email Client Interface */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-lg">
        {/* Email Header */}
        <div className="bg-muted/50 border-b border-border p-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">MyPhysioFlow Alerts</span>
        </div>

        {/* Email Notification */}
        <div
          className={`transform transition-all duration-700 ease-out ${
            showEmail ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
          }`}
        >
          <div
            className={`p-4 border-l-4 transition-all duration-300 ${
              isRead ? 'border-l-muted bg-card' : 'border-l-orange-500 bg-orange-50/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`p-1.5 rounded-full transition-all duration-300 ${
                    isRead ? 'bg-muted/50' : 'bg-orange-500/10 animate-pulse'
                  }`}
                >
                  <AlertTriangle
                    className={`h-4 w-4 transition-colors duration-300 ${
                      isRead ? 'text-muted-foreground' : 'text-orange-500'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-sm font-semibold transition-colors duration-300 ${
                        isRead ? 'text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      Action Required: Patient Quota Alert
                    </span>
                    {!isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <p
                    className={`text-xs transition-colors duration-300 mb-2 ${
                      isRead ? 'text-muted-foreground' : 'text-orange-700'
                    }`}
                  >
                    <strong>Sarah Mitchell</strong> has only{' '}
                    <strong>1 EPC session remaining</strong>
                  </p>
                  <p
                    className={`text-xs leading-relaxed transition-colors duration-300 ${
                      isRead ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    Patient needs renewal approval before next appointment on{' '}
                    <strong>March 15</strong>. Risk: $180 session may be unpaid without action.
                  </p>
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <button
                      className={`text-xs px-3 py-1 rounded transition-all duration-300 ${
                        isRead
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      View Patient Details
                    </button>
                  </div>
                </div>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                onClick={() => setIsRead(true)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Email Footer */}
        <div className="bg-muted/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">
            Sent via MyPhysioFlow • Never miss a renewal again
          </p>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-3 text-center">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all duration-300 ${
            showEmail && !isRead
              ? 'bg-orange-500/10 text-orange-600 border border-orange-200'
              : 'bg-muted/50 text-muted-foreground border border-border'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              showEmail && !isRead ? 'bg-orange-500 animate-pulse' : 'bg-muted-foreground'
            }`}
          ></div>
          {showEmail && !isRead ? 'New Alert Received' : 'All caught up'}
        </div>
      </div>
    </div>
  );
};

export default AnimatedEmailAlert;
