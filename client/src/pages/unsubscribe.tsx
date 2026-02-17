import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Loader2, Mail } from "lucide-react";

type UnsubscribeStatus = 'loading' | 'success' | 'already_unsubscribed' | 'expired' | 'invalid' | 'error';

export default function UnsubscribePage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
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
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('unsubscribe.processing', 'Processing your request...')}</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-4 mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-center mb-3">
              {t('unsubscribe.successTitle', 'Successfully Unsubscribed')}
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {message || t('unsubscribe.successMessage', 'You have been successfully unsubscribed. You will no longer receive emails from us.')}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLocation('/')}>
                {t('unsubscribe.backToHome', 'Back to Home')}
              </Button>
            </div>
          </div>
        );

      case 'already_unsubscribed':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-blue-100 p-4 mb-6">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-center mb-3">
              {t('unsubscribe.alreadyTitle', 'Already Unsubscribed')}
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {message || t('unsubscribe.alreadyMessage', 'You have already unsubscribed from our newsletter.')}
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              {t('unsubscribe.backToHome', 'Back to Home')}
            </Button>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-yellow-100 p-4 mb-6">
              <AlertCircle className="h-12 w-12 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-semibold text-center mb-3">
              {t('unsubscribe.expiredTitle', 'Link Expired')}
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {message || t('unsubscribe.expiredMessage', 'This unsubscribe link has expired. Please use the link from a more recent email.')}
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              {t('unsubscribe.backToHome', 'Back to Home')}
            </Button>
          </div>
        );

      case 'invalid':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-red-100 p-4 mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-semibold text-center mb-3">
              {t('unsubscribe.invalidTitle', 'Invalid Link')}
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {message || t('unsubscribe.invalidMessage', 'This unsubscribe link is invalid or has been modified.')}
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              {t('unsubscribe.backToHome', 'Back to Home')}
            </Button>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-red-100 p-4 mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-semibold text-center mb-3">
              {t('unsubscribe.errorTitle', 'Something Went Wrong')}
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {message || t('unsubscribe.errorMessage', 'An error occurred while processing your request. Please try again later.')}
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              {t('unsubscribe.backToHome', 'Back to Home')}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-xl">
            {t('unsubscribe.title', 'Newsletter Unsubscribe')}
          </CardTitle>
          <CardDescription>
            {t('unsubscribe.subtitle', 'Manage your email preferences')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
