import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, Loader2, Mail } from "lucide-react";

type UnsubscribeStatus = 'loading' | 'success' | 'already_unsubscribed' | 'expired' | 'invalid' | 'error';

const HAYC_HOME_URL = "https://hayc.gr/";

export default function UnsubscribePage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const processUnsubscribe = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const lang = i18n.language === 'gr' || i18n.language === 'el' ? 'gr' : 'en';

      if (!token) {
        setStatus('invalid');
        setMessage(t('unsubscribe.missingToken', 'No unsubscribe token provided.'));
        return;
      }

      try {
        const response = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}`);
        const data = await response.json();

        if (data.success) {
          if (data.alreadyUnsubscribed) {
            setStatus('already_unsubscribed');
          } else {
            setStatus('success');
          }
          setMessage(data.message);
        } else {
          if (data.error === 'expired') {
            setStatus('expired');
          } else if (data.error === 'invalid_token' || data.error === 'invalid_signature' || data.error === 'invalid_format') {
            setStatus('invalid');
          } else {
            setStatus('error');
          }
          setMessage(data.message);
        }
      } catch (error) {
        console.error('Unsubscribe error:', error);
        setStatus('error');
        setMessage(t('unsubscribe.error', 'An error occurred. Please try again later.'));
      }
    };

    processUnsubscribe();
  }, [i18n.language, t]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-white/60 mb-4" />
            <p className="text-white/50 font-brand">{t('unsubscribe.processing', 'Processing your request...')}</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-500/20 p-4 mb-6">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white font-brand text-center mb-3">
              {t('unsubscribe.successTitle', 'Successfully Unsubscribed')}
            </h2>
            <p className="text-white/60 font-brand text-center max-w-md mb-6">
              {message || t('unsubscribe.successMessage', 'You have been successfully unsubscribed. You will no longer receive emails from us.')}
            </p>
            <button
              onClick={() => { window.location.href = HAYC_HOME_URL; }}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
            >
              {t('unsubscribe.backToHome', 'Back to Home')}
            </button>
          </div>
        );

      case 'already_unsubscribed':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-blue-500/20 p-4 mb-6">
              <Mail className="h-12 w-12 text-blue-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white font-brand text-center mb-3">
              {t('unsubscribe.alreadyTitle', 'Already Unsubscribed')}
            </h2>
            <p className="text-white/60 font-brand text-center max-w-md mb-6">
              {message || t('unsubscribe.alreadyMessage', 'You have already unsubscribed from our newsletter.')}
            </p>
            <button
              onClick={() => { window.location.href = HAYC_HOME_URL; }}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
            >
              {t('unsubscribe.backToHome', 'Back to Home')}
            </button>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-yellow-500/20 p-4 mb-6">
              <AlertCircle className="h-12 w-12 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white font-brand text-center mb-3">
              {t('unsubscribe.expiredTitle', 'Link Expired')}
            </h2>
            <p className="text-white/60 font-brand text-center max-w-md mb-6">
              {message || t('unsubscribe.expiredMessage', 'This unsubscribe link has expired. Please use the link from a more recent email.')}
            </p>
            <button
              onClick={() => { window.location.href = HAYC_HOME_URL; }}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
            >
              {t('unsubscribe.backToHome', 'Back to Home')}
            </button>
          </div>
        );

      case 'invalid':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-red-500/20 p-4 mb-6">
              <XCircle className="h-12 w-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white font-brand text-center mb-3">
              {t('unsubscribe.invalidTitle', 'Invalid Link')}
            </h2>
            <p className="text-white/60 font-brand text-center max-w-md mb-6">
              {message || t('unsubscribe.invalidMessage', 'This unsubscribe link is invalid or has been modified.')}
            </p>
            <button
              onClick={() => { window.location.href = HAYC_HOME_URL; }}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
            >
              {t('unsubscribe.backToHome', 'Back to Home')}
            </button>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-red-500/20 p-4 mb-6">
              <XCircle className="h-12 w-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white font-brand text-center mb-3">
              {t('unsubscribe.errorTitle', 'Something Went Wrong')}
            </h2>
            <p className="text-white/60 font-brand text-center max-w-md mb-6">
              {message || t('unsubscribe.errorMessage', 'An error occurred while processing your request. Please try again later.')}
            </p>
            <button
              onClick={() => { window.location.href = HAYC_HOME_URL; }}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
            >
              {t('unsubscribe.backToHome', 'Back to Home')}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm">
        <div className="text-center border-b border-white/10 px-6 py-5">
          <h1 className="text-xl font-semibold text-white font-brand">
            {t('unsubscribe.title', 'Newsletter Unsubscribe')}
          </h1>
          <p className="text-sm text-white/50 font-brand mt-1">
            {t('unsubscribe.subtitle', 'Manage your email preferences')}
          </p>
        </div>
        <div className="px-6 py-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
