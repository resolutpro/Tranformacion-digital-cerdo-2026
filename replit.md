# Overview

This is a full-stack livestock traceability management system built with React, Express, and PostgreSQL. The application enables organizations to track livestock batches (lotes) through different production stages (cría, engorde, matadero, secadero, distribución) with IoT sensor monitoring and public QR code traceability features.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Charts**: Recharts for sensor data visualization

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using session-based auth
- **Session Storage**: Express sessions with PostgreSQL store via connect-pg-simple
- **API Design**: RESTful endpoints with consistent error handling
- **Development**: Hot module replacement via Vite integration
- **Health Monitoring**: Built-in health check endpoints for deployment readiness (/health, /api/health)

## Database Design
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema**: Multi-tenant architecture with organization-based data isolation
- **Key Tables**: 
  - Organizations and Users (authentication)
  - Lotes (livestock batches) with templating system
  - Zones (production areas) organized by stages
  - Sensors and SensorReadings (IoT monitoring)
  - Stays (tracking lote movements between zones)
  - QR Snapshots (immutable traceability records)
  - Audit Logs (change tracking)

## Authentication & Authorization
- **Strategy**: Session-based authentication using Passport.js
- **Password Security**: Scrypt hashing with salt
- **Multi-tenancy**: Organization-scoped data access with middleware validation
- **Session Management**: PostgreSQL-backed session store for persistence

## Data Flow Patterns
- **Drag & Drop**: Custom hook system for moving lotes between zones
- **Real-time Updates**: Query invalidation patterns for live data synchronization
- **Simulation Mode**: Built-in sensor data simulation for testing and demos
- **Public Traceability**: Token-based public access to immutable QR snapshots

## IoT Integration Architecture
- **Sensor Management**: MQTT credential generation for device connectivity
- **Data Validation**: Min/max validation ranges for sensor readings
- **Simulation Support**: Burst and single-point data generation for testing
- **Time Series**: Efficient storage and querying of sensor readings with timezone handling

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver for Neon database
- **drizzle-orm**: Type-safe SQL query builder with PostgreSQL dialect
- **express**: Web application framework for Node.js
- **passport**: Authentication middleware with local strategy

## Frontend UI Dependencies
- **@radix-ui/***: Comprehensive set of unstyled UI primitives
- **@tanstack/react-query**: Server state management and caching
- **recharts**: React charting library for sensor data visualization
- **wouter**: Minimalist routing library for React
- **tailwindcss**: Utility-first CSS framework

## Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **drizzle-kit**: Database migration and schema management tools
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling

## Date & Time Handling
- **date-fns**: Date utility library with timezone support via date-fns-tz
- **Europe/Madrid**: Primary timezone for Spanish livestock operations

## Security & Validation
- **zod**: Runtime type validation and schema definition
- **drizzle-zod**: Integration between Drizzle schemas and Zod validation
- **crypto**: Node.js built-in for password hashing and UUID generation

## Session Management
- **express-session**: Session middleware for Express
- **connect-pg-simple**: PostgreSQL session store
- **memorystore**: In-memory session store fallback for development