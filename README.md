# School Management System

## Overview

A specialized, production-ready school management platform designed for nursery and preschool operations. This system streamlines the core administrative and financial workflows of early education institutions, replacing manual record-keeping with a secure, digital-first approach. It focuses heavily on financial integrity, student lifecycle management, and operational transparency.

## 🛠 Microservice Architecture

The FeeEase system is built as a distributed microservice architecture to ensure scalability and separation of concerns:

- **[FeeEase Platform](https://github.com/lfgraphics/feeease)**: The central hub and landing page ([feeease.com](https://feeease.com)). Handles school discovery and registration.
- **[Modern Nursery](https://github.com/lfgraphics/feeease)**: This project - the primary School Management System (SMS). A secure, role-based application for registered schools to manage students, fees, and staff.
- **[FeeEase Worker](https://github.com/lfgraphics/feeease-worker)**: A high-performance background worker handling asynchronous tasks such as WhatsApp broadcasting, automated reminders, and future biometric integrations.
- **[Try FeeEase](https://github.com/lfgraphics/try-school-management)**: A browser-based trial environment ([try.feeease.com](https://try.feeease.com)) that allows prospective schools to explore the system with zero-configuration and local storage.

> [!TIP]
> **Automated Updates**: This repository includes a GitHub Action (`.github/workflows/sync-upstream.yml`) that automatically synchronizes forked versions with the upstream `lfgraphics/feeease` repository every day. To enable this, ensure your repository's **Actions Settings** have **Read and write permissions** enabled. If a conflict occurs, the system will automatically open an **Issue** in your repository to notify you.

## Problem It Solves

Running a nursery school involves complex recurring billing (monthly fees, exam fees) and strict student safety requirements. Manual ledgers lead to:

- **Revenue Leakage**: Difficulty in tracking cumulative unpaid dues across months.
- **Operational Friction**: Slow admission processes and manual ID card creation.
- **Financial Opacity**: Lack of verification between cash collected by staff and actual bank deposits.

This system solves these by enforcing a **Maker-Checker** workflow for finances, automating "Expected vs. Collected" calculations, and providing instant operational documents (ID cards, Receipts).

## Target Users

- **Super Admin / Principals**: For high-level financial oversight, staff management, and fee structure configuration.
- **Administrative Staff**: For day-to-day operations like student admission, fee collection, and printing receipts.
- **Attendance Staff**: Dedicated role for daily attendance tracking and holiday management.

## Architecture & Technical Design

### Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19.
- **Database**: MongoDB (via Mongoose) for flexible schema design tailored to hierarchical data.
- **Authentication**: NextAuth.js (v4) with Role-Based Access Control (RBAC).
- **Styling**: Tailwind CSS + Shadcn UI for a responsive, accessible component system.
- **Visualization**: Recharts for financial analytics.
- **PWA**: Native Service Workers + Web Manifest for offline support and installability.

### Design Patterns

- **Server Actions**: Utilizes Next.js Server Actions for all data mutations and fetching, eliminating the need for a separate REST API layer and reducing latency.
- **Aggregated Analytics**: Financial metrics (Revenue, Deficit) are calculated via complex MongoDB Aggregation Pipelines to ensure data accuracy without heavy application-layer processing.
- **Component-Driven UI**: Modular architecture using atomic design principles for reusable UI elements (Forms, Tables, Dialogs).

## Key Features

### 1. Advanced Fee Management

- **Complex Billing Cycles**: Supports Monthly, Examination, and Admission fee structures.
- **Deficit Tracking**: Real-time calculation of "Unpaid" dues based on student admission date vs. current date (Cumulative Debt Logic).
- **Maker-Checker Workflow**: Staff collects fees (status: `pending`), which Admins must verify (status: `verified`) to finalize revenue.
- **Thermal Receipts**: Auto-generated, printable receipts for every transaction.

### 2. Student Administration

- **Digital Admission**: Comprehensive intake forms with validation for documents and guardian details.
- **Bulk Operations**: One-click ID Card generation for entire classes, optimized for A4 printing.
- **Searchable Directory**: Fast, indexed search for students by name or registration number.

### 3. Analytics & Reports

- **Financial Health**: Visual breakdown of Collected vs. Pending vs. Unpaid revenue.
- **Class Performance**: Revenue metrics aggregated by class to identify high-performing or deficit-heavy groups.
- **Real-time Lists**: "Top Unpaid Students" list to prioritize follow-ups.
- **Exportable Reports**: Generate detailed PDF/Excel reports for finances and attendance.

### 4. Attendance Management

- **Daily Tracking**: Efficient interface for marking student attendance.
- **Holiday Calendar**: Manage school holidays and non-instructional days.
- **Attendance Stats**: Visual insights into student presence and absenteeism.

### 5. Staff & Expense Management

- **Teacher Profiles**: Manage staff details and assign roles (Admin, Staff, Attendance Staff).
- **Expense Tracking**: Record and categorize operational expenses.
- **Financial Oversight**: Monitor total expenses against collected revenue.

### 6. Progressive Web App (PWA)

- **Installable**: Add to Home Screen support for iOS and Android devices.
- **Offline Capable**: Service Worker caching ensures core functionality works even with spotty internet.
- **Mobile Optimized**: Responsive design that feels like a native app on mobile devices.

### 7. Students Migration

- **Bulk Upload**: Import student data from CSV files for efficient onboarding.
- **Class Migration**: Seamlessly transfer students between classes while maintaining their unique identifiers.
- **Students Activation & Deactivation**: Easily activate or deactivate students, updating their status and availability in the system.

## Automation & Optimization

- **Fee Calculation**: Automatically determines "Total Expected Revenue" based on active student count and class-specific fee rules, removing manual estimation.
- **ID Card Generation**: Replaces manual design work with programmatic, bulk-printable ID cards using CSS print media queries.
- **Receipt Generation**: Instant thermal-printer friendly receipts upon fee submission.
- **Dynamic Manifest**: Automatically generates web manifest for PWA installation.

## Installation & Setup

### Prerequisites

- Node.js 18+
- MongoDB Instance (Local or Atlas)

### Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd modern-nursery
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure Environment**
   Create a `.env.local` file:

   ```env
   MONGODB_URI=mongodb://localhost:27017/modern-nursery
   NEXTAUTH_SECRET=your-super-secret-key
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Seed Database (Optional)**
   Initialize with default admin and classes:

   ```bash
   pnpm ts-node scripts/seed.ts
   ```

5. **Run Development Server**

   ```bash
   pnpm dev
   ```

6. **System Initialization**
   Initialize with default admin and classes:
   visit the `/init` endpoint in your browser:

   ```bash
   http://localhost:3000/init
   ```

## Engineering Highlights

- **Cumulative Deficit Logic**: The system calculates unpaid fees by iterating from a student's admission date to the current date, checking against paid transactions. This handles edge cases where a student joins mid-year or skips a specific month.
- **Optimized Rendering**: Uses React Server Components (RSC) to render heavy dashboards on the server, sending minimal JS to the client.
- **Print Optimization**: Custom CSS `@media print` rules ensure ID cards and receipts print perfectly on physical media without UI clutter.
- **Type Safety**: End-to-end type safety using TypeScript and Zod for form validation, preventing runtime data corruption.
- **PWA Integration**: Custom service worker and install prompt handling for a seamless mobile experience, including iOS-specific instructions.

## Future Improvements

- **Automated SMS/Email/WhatsApp Notifications**: Integration with Twilio/SendGrid to send automatic payment reminders.
- **Parent Portal**: A read-only view for parents to check fee status and download report cards.
- **Biometric Integration**: Link attendance system with hardware scanners.
