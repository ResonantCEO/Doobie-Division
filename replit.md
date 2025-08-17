# Doobie Division! - E-Commerce & Inventory Management System

## Overview

Doobie Division! is a comprehensive full-stack web application that provides e-commerce storefront functionality combined with robust inventory management capabilities. The system serves multiple user roles (customers, managers, administrators) with different access levels and features including product catalog management, order processing, analytics, and user administration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Query (@tanstack/react-query) for server state
- **Build Tool**: Vite with HMR support
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with optimized indexes
- **Database**: PostgreSQL (via Neon serverless) with performance indexes
- **Caching**: Multi-tier NodeCache system with TTL-based invalidation
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store

### Project Structure
The application follows a monorepo structure with clear separation:
- `client/`: React frontend application
- `server/`: Express backend API
- `shared/`: Common schemas and types shared between frontend and backend
- Root configuration files for tooling (Vite, Tailwind, TypeScript, Drizzle)

## Key Components

### Authentication System
- **Provider**: Replit Auth using OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Role-based Access**: Three user roles (customer, manager, admin) with different permissions
- **Security**: HTTP-only cookies, CSRF protection, secure session handling

### Database Schema
- **Users**: Profile information, roles, and status management
- **Products**: Comprehensive product catalog with categories, pricing, and inventory
- **Categories**: Product categorization system
- **Orders**: Order management with line items and status tracking
- **Inventory Logs**: Audit trail for stock adjustments
- **Notifications**: System notifications for users
- **Sessions**: Authentication session storage

### API Design
- **RESTful Endpoints**: Organized by resource type with proper HTTP methods
- **Role-based Middleware**: Endpoint protection based on user roles
- **Input Validation**: Zod schemas for request validation
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Frontend Features
- **Multi-tab Dashboard**: Storefront, Inventory, Orders, Analytics, Users
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: Automatic data refetching for live inventory updates
- **Component Library**: shadcn/ui for consistent, accessible UI components
- **Form Validation**: Client-side validation with server-side backup

## Data Flow

### User Authentication Flow
1. User attempts to access protected routes
2. Replit Auth redirects to OpenID Connect provider
3. Successful authentication creates user session in PostgreSQL
4. Frontend receives user profile and role information
5. Role-based route protection and UI rendering

### Inventory Management Flow
1. Managers/admins can add/edit products through forms
2. Stock adjustments trigger inventory logs for audit trails
3. Low stock alerts automatically generated based on thresholds
4. Real-time inventory updates across all client sessions

### Order Processing Flow
1. Customers browse products in storefront view
2. Order creation includes validation of stock availability
3. Status updates (pending → processing → shipped → delivered)
4. Analytics aggregation for reporting and insights

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Database ORM and query builder
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form management
- **zod**: Schema validation
- **wouter**: Lightweight routing

### Development Dependencies
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Production bundling

### Authentication Dependencies
- **openid-client**: OpenID Connect implementation
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with HMR
- **Database**: Neon PostgreSQL serverless instance
- **Authentication**: Replit Auth integration
- **Hot Reloading**: Full-stack development with automatic restarts

### Production Build
- **Frontend**: Vite production build with optimizations
- **Backend**: ESBuild bundling for Node.js deployment
- **Static Assets**: Served from dist/public directory
- **Environment Variables**: Database URL, session secrets, OAuth configuration

### Database Management
- **Migrations**: Drizzle Kit for schema migrations
- **Connection Pooling**: Neon serverless with WebSocket connections
- **Schema Versioning**: Version-controlled database schema in shared/schema.ts

The application is designed to be deployed on Replit with integrated authentication, but can be adapted for other platforms with minimal configuration changes.

## Recent Changes

### August 17, 2025 - Performance Optimizations
- **Implemented Query Result Caching**: Added comprehensive caching layer using node-cache for expensive database operations
  - Created four specialized cache instances (query, categories, products, analytics) with different TTL settings
  - Added caching to all analytics methods (getSalesMetrics, getTopProducts, getOrderStatusBreakdown, getSalesTrend, getCategoryBreakdown)
  - Implemented cache invalidation strategies for data consistency
- **Added Database Performance Indexes**: Created 12 new database indexes for optimized query performance
  - Products table indexes: stock, name (full-text search), description (full-text search), SKU
  - Composite indexes: category+stock, active+stock for common query patterns
  - Orders table indexes: customer_id, status, assigned_user_id
  - Order_items table indexes: order_id, product_id, fulfilled
  - Supporting indexes for notifications and inventory_logs tables
- **Optimized Category Hierarchy Queries**: Enhanced getCategories method with caching and improved hierarchical data structure building
- **Fixed LSP Errors**: Reduced TypeScript compilation errors from 49 to 25 by removing duplicate method signatures
- **Impact**: Significantly improved application performance, especially for analytics dashboard and product filtering operations

### August 17, 2025 - Previous Fixes
- **Fixed Stock Validation Error**: Resolved "Failed to validate stock. Please try again." error in shopping cart checkout process
- **Root Cause**: Duplicate method signatures in storage.ts with conflicting return types causing TypeScript compilation errors
- **Solution**: Removed duplicate getProducts method signature and fixed return type to return array of products instead of single product
- **Added Order Notifications**: Implemented automatic notification creation for staff/managers/admins when new orders are placed
- **Impact**: Shopping cart checkout now works correctly and staff receive notifications for new orders in real-time

### August 14, 2025
- **Added Staff Role**: Created new "staff" role that duplicates all manager permissions and access
- **Backend Updates**: Updated all API endpoints to include "staff" alongside "admin" and "manager" in requireRole middleware
- **Frontend Updates**: Added staff role option to user management dropdown and role badge display with purple styling
- **Role Hierarchy**: Customer → Staff → Manager → Admin (Staff and Manager have identical permissions)
- **Impact**: Staff members can now access all inventory management, product creation, order processing, and analytics features

### July 30, 2025
- **Fixed Subcategory Display Issue**: Resolved critical bug where clicking on parent categories (Flower, Concentrates) wasn't showing their subcategories
- **Root Cause**: Backend returned hierarchical category structure with nested `children` arrays, but frontend expected flat array structure for filtering
- **Solution**: Added category flattening logic using `useMemo` to convert nested API response to flat array structure compatible with existing filtering logic
- **Impact**: Subcategory navigation now works correctly - users can click parent categories to see subcategories (Indica/Sativa for Flower, etc.)
- **Code Quality**: Removed all debugging console logs and cleaned up code after successful fix