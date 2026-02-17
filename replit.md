# Overview

This is a full-stack web application for a website creation service called "hayc". The platform allows users to subscribe to different service tiers, track website development progress, and manage their subscriptions. It features a subscription-based business model with integrated payment processing through Stripe, comprehensive admin tools for managing customers and projects, and a multi-language interface supporting English and Greek.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development
- **Routing**: React Router for client-side navigation and protected routes
- **State Management**: TanStack Query for server state management and caching
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **Internationalization**: i18next for multi-language support (English/Greek)
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL with connect-pg-simple for persistent sessions
- **API Design**: RESTful endpoints with consistent error handling and response formatting

## Data Layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for database migrations and schema generation
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Data Models**: Users, subscriptions, website progress tracking, tips, and change requests with status tracking
- **Change Request Lifecycle**: Unique constraint on (userId, domain, monthYear) prevents duplicate monthly change records per domain; status flow from pending → in-progress → completed → confirmed with admin tracking and user feedback
- **Website Project Identification**: Each website project has two key fields:
  - `domain`: Auto-generated unique identifier (format: hayc-{8 random chars}) used internally for tracking, analytics, and change requests
  - `projectName`: User-provided display name (from onboarding "Your site title" field) shown across all UI components for better user experience

## Key Features
- **Subscription Management**: Multi-tier subscription system with monthly/yearly billing
- **Website Progress Tracking**: Stage-based progress system with status updates and notifications
- **Website Change Request System**: Complete lifecycle management with status tracking (pending/in-progress/completed/confirmed), admin tools, and customer feedback collection
- **Email System**: Automated email notifications using Nodemailer with HTML templates
- **File Upload**: Cloudinary integration for asset management
- **Admin Dashboard**: Comprehensive admin interface for user and subscription management
- **Multi-language Support**: Dynamic language switching with persistent preferences

## Authentication & Authorization
- **User Authentication**: Email/password login with secure password hashing using scrypt
- **Role-Based Access**: User roles (subscriber/administrator) with protected routes
- **Session Management**: Server-side sessions with PostgreSQL storage
- **Security**: CSRF protection and secure session configuration

# External Dependencies

## Payment Processing
- **Stripe**: Complete payment processing including checkout sessions, billing portal, and webhook handling
- **Subscription Management**: Automated billing, prorations, and cancellation handling

## Database & Hosting
- **Neon Database**: Serverless PostgreSQL with automatic scaling
- **Database Connection**: WebSocket-based connections for serverless compatibility

## Email Services
- **SMTP Integration**: Custom SMTP configuration for transactional emails
- **Template System**: HTML email templates with multi-language support (English/Greek)
- **Notification Types**: User confirmations, admin notifications, progress updates, payment alerts, and change request completion notices

## File Storage
- **Cloudinary**: Image and file upload service with widget integration
- **Asset Management**: Optimized image delivery and transformation

## Analytics & Tracking
- **Google Analytics**: Production-only page view and event tracking (GA4: G-RGCJJSJEY0)
- **Facebook Pixel**: Production-only conversion tracking with Lead event on contact form submissions
  - Environment Variable: `VITE_FACEBOOK_PIXEL_ID` (required for Facebook Pixel to load)
  - Events Tracked: PageView (automatic), Lead (contact form submission)
- **Cloudflare Turnstile**: CAPTCHA protection on contact form to prevent spam
  - Site Key: `0x4AAAAAACCS5AVJwke-jjgf`
  - Secret Key: Stored in `TURNSTILE_SECRET_KEY` environment variable
- **UTM Parameter Tracking**: Captures META ad tracking parameters from URL on page load
  - Captured Parameters: utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid
  - Storage: SessionStorage with 30-day expiry persistence
  - Implementation: `client/src/lib/utm.ts` utility with automatic initialization in App.tsx
- **HubSpot Integration**: Contact form submissions are automatically sent to HubSpot CRM
  - Environment Variable: `HUBSPOT_API_KEY` (required for HubSpot submissions)
  - Features: Creates or updates contacts with UTM data, lead lifecycle tracking
  - UTM Properties: Both HubSpot default (utm_source, utm_medium, etc.) and custom (hayc_utm_source, etc.) properties

## Development Tools
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Fast production bundling for server-side code
- **Drizzle Kit**: Database schema management and migration tools
- **Tailwind CSS**: Utility-first styling with custom theme configuration