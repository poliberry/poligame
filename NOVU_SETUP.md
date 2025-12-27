# Novu Notification Setup Guide

This guide explains how to set up Novu for desktop notifications in PoliGame.

## Overview

The desktop app now uses [Novu](https://novu.co/) for push notifications instead of Firebase Cloud Messaging. Mobile notifications continue to use FCM/Expo Push Notifications.

## Setup Steps

### 1. Create a Novu Account

1. Go to [https://novu.co/](https://novu.co/)
2. Sign up for a free account (10K events/month free forever)
3. Create a new application in your Novu dashboard

### 2. Get Your Application Identifier

1. In your Novu dashboard, go to **Settings** → **API Keys**
2. Copy your **Application Identifier** (not the API key)
3. Add it to your `.env.local` file:

```env
VITE_NOVU_APPLICATION_IDENTIFIER=your-application-identifier-here
```

### 3. Get Your API Key (for Backend)

1. In your Novu dashboard, go to **Settings** → **API Keys**
2. Copy your **API Key**
3. Set it in your Convex environment:

```bash
npx convex env set NOVU_API_KEY "your-api-key-here"
```

### 4. Create Notification Workflows

In your Novu dashboard, create the following workflows:

#### Workflow: `friend-request`
- **Trigger**: When a friend request is received
- **Channels**: In-App, Push
- **Payload Variables**:
  - `title`: Notification title
  - `body`: Notification body
  - `type`: "friend_request"
  - Additional data fields as needed

#### Workflow: `new-message`
- **Trigger**: When a new message is received
- **Channels**: In-App, Push
- **Payload Variables**:
  - `title`: Notification title
  - `body`: Notification body
  - `type`: "message"
  - Additional data fields as needed

#### Workflow: `game-started`
- **Trigger**: When a friend starts playing a game
- **Channels**: In-App, Push
- **Payload Variables**:
  - `title`: Notification title
  - `body`: Notification body
  - `type`: "game_start"
  - Additional data fields as needed

### 5. Configure Workflow Templates

For each workflow, you can customize:
- **In-App Notification**: The notification that appears in the Novu Inbox component
- **Push Notification**: The system notification (desktop/mobile)
- **Email** (optional): If you want to send emails as well
- **SMS** (optional): If you want to send SMS notifications

### 6. Test the Integration

1. Start your desktop app
2. Log in with a user account
3. The app will automatically:
   - Initialize a Novu session for the user
   - Register the user as a subscriber
   - Start receiving notifications

## How It Works

### Frontend (Desktop App)

1. **NovuProvider**: Wraps the app and provides Novu context
2. **useNovuNotifications Hook**: 
   - Initializes Novu session when user logs in
   - Registers subscriber with Convex backend
   - Handles notification permissions

### Backend (Convex)

1. **registerNovuSubscriber**: Registers a desktop user as a Novu subscriber
2. **removeNovuSubscriber**: Removes a subscriber when user logs out
3. **sendFCMNotification**: Updated to use Novu workflows for desktop, FCM for mobile
4. **sendNovuNotification**: Triggers Novu workflows for desktop notifications

### Notification Flow

1. An event occurs (friend request, message, game start)
2. Backend calls `sendFCMNotification()`
3. For desktop users: Triggers Novu workflow via `sendNovuNotification()`
4. For mobile users: Sends FCM notification (existing flow)
5. Novu delivers the notification to the desktop app
6. Desktop app displays the notification via Novu SDK

## Adding the Inbox Component (Optional)

If you want to show an in-app notification inbox, you can add the Novu Inbox component:

```tsx
import { Inbox } from '@novu/react';

// In your component
<Inbox />
```

This will show a notification center where users can see all their notifications.

## Environment Variables

### Frontend (.env.local)
```env
VITE_NOVU_APPLICATION_IDENTIFIER=your-application-identifier
```

### Backend (Convex)
```bash
npx convex env set NOVU_API_KEY "your-api-key"
```

## Troubleshooting

### Notifications not working?

1. **Check Application Identifier**: Make sure `VITE_NOVU_APPLICATION_IDENTIFIER` is set correctly
2. **Check API Key**: Verify `NOVU_API_KEY` is set in Convex environment
3. **Check Workflows**: Ensure workflows are created with correct identifiers:
   - `friend-request`
   - `new-message`
   - `game-started`
4. **Check Permissions**: Ensure notification permissions are granted
5. **Check Console**: Look for errors in browser console and Convex logs

### Workflow not found errors?

Make sure the workflow identifiers in `convex/notifications.ts` match the workflow identifiers in your Novu dashboard.

## Migration Notes

- **Desktop**: Now uses Novu workflows
- **Mobile**: Still uses FCM/Expo Push (no changes needed)
- **Backend**: `sendFCMNotification()` now routes to Novu for desktop, FCM for mobile
- **Schema**: Added `novuSubscribers` field to users table

## Next Steps

1. Set up your Novu account and get your credentials
2. Create the three workflows mentioned above
3. Add environment variables
4. Test notifications by triggering events (friend requests, messages, etc.)

For more information, visit [Novu Documentation](https://docs.novu.co/).

