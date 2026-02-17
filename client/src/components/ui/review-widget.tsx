import React from 'react';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';
import { Star, ExternalLink } from 'lucide-react';

export interface ReviewWidgetProps {
  platform: 'facebook' | 'trustpilot' | 'g2';
  rating: number;
  totalReviews: number;
  profileUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const platformConfig = {
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    bgColor: '#F0F8FF',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  trustpilot: {
    name: 'Trustpilot',
    color: '#00B67A',
    bgColor: '#F0FFF4',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M12 0L9.2 8.8H0l7.4 5.4L4.6 23L12 17.6L19.4 23l-2.8-8.8L24 8.8h-9.2L12 0z"/>
      </svg>
    ),
  },
  g2: {
    name: 'G2',
    color: '#FF492F',
    bgColor: '#FFF5F5',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.61 0 3.14-.37 4.5-1.03l-1.5-2.6C13.93 20.76 12.99 21 12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9c0 1.66-.45 3.22-1.24 4.56l2.6 1.5C22.63 15.14 23 13.61 23 12c0-6.075-4.925-11-11-11z"/>
        <path d="M16.5 12c0 2.485-2.015 4.5-4.5 4.5S7.5 14.485 7.5 12s2.015-4.5 4.5-4.5 4.5 2.015 4.5 4.5z"/>
      </svg>
    ),
  },
};

const sizeConfig = {
  sm: {
    card: 'p-3',
    logo: 'w-5 h-5',
    star: 'w-3 h-3',
    rating: 'text-lg font-semibold',
    reviews: 'text-xs text-muted-foreground',
    platform: 'text-sm font-medium',
  },
  md: {
    card: 'p-4',
    logo: 'w-6 h-6',
    star: 'w-4 h-4',
    rating: 'text-xl font-bold',
    reviews: 'text-sm text-muted-foreground',
    platform: 'text-base font-semibold',
  },
  lg: {
    card: 'p-6',
    logo: 'w-8 h-8',
    star: 'w-5 h-5',
    rating: 'text-2xl font-bold',
    reviews: 'text-base text-muted-foreground',
    platform: 'text-lg font-semibold',
  },
};

export function ReviewWidget({ 
  platform, 
  rating, 
  totalReviews, 
  profileUrl, 
  className,
  size = 'md' 
}: ReviewWidgetProps) {
  const config = platformConfig[platform];
  const sizeStyles = sizeConfig[size];

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className={cn(sizeStyles.star, "fill-yellow-400 text-yellow-400")}
        />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <div key="half" className="relative">
          <Star className={cn(sizeStyles.star, "text-gray-300")} />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className={cn(sizeStyles.star, "fill-yellow-400 text-yellow-400")} />
          </div>
        </div>
      );
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          className={cn(sizeStyles.star, "text-gray-300")}
        />
      );
    }

    return stars;
  };

  const CardWrapper = profileUrl ? 'a' : 'div';
  const cardProps = profileUrl 
    ? { href: profileUrl, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <CardWrapper {...cardProps}>
      <Card 
        className={cn(
          "transition-all duration-200 hover:shadow-md cursor-pointer border-2",
          profileUrl && "hover:scale-105",
          className
        )}
        style={{ 
          borderColor: config.color + '20',
          backgroundColor: config.bgColor 
        }}
      >
        <CardContent className={cn(sizeStyles.card, "space-y-3")}>
          {/* Header with platform logo and name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div style={{ color: config.color }}>
                {config.logo}
              </div>
              <span className={cn(sizeStyles.platform)} style={{ color: config.color }}>
                {config.name}
              </span>
            </div>
            {profileUrl && (
              <ExternalLink className="w-4 h-4 text-gray-400" />
            )}
          </div>

          {/* Rating and Stars */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={cn(sizeStyles.rating, "text-gray-900")}>
                {rating.toFixed(1)}
              </span>
              <div className="flex items-center space-x-1">
                {renderStars()}
              </div>
            </div>
            
            {/* Review count */}
            <p className={sizeStyles.reviews}>
              Based on {totalReviews.toLocaleString()} review{totalReviews !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  );
}

// Preset configurations for common use cases
export function FacebookReviewWidget(props: Omit<ReviewWidgetProps, 'platform'>) {
  return <ReviewWidget {...props} platform="facebook" />;
}

export function TrustpilotReviewWidget(props: Omit<ReviewWidgetProps, 'platform'>) {
  return <ReviewWidget {...props} platform="trustpilot" />;
}

export function G2ReviewWidget(props: Omit<ReviewWidgetProps, 'platform'>) {
  return <ReviewWidget {...props} platform="g2" />;
}