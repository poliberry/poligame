import { Inbox } from '@novu/react';
import { useAuthStore } from '@/stores/authStore';
import { dark } from '@novu/react/themes';

export function NovuInbox() {
  const { user } = useAuthStore();

  const tabs = [
    // Basic tab with no filtering (shows all notifications)
    {
      label: 'All',
      filter: { tags: [] },
    },
    
    // Filter by tags - shows notifications from workflows tagged "promotions"
    {
      label: 'Promotions',
      filter: { tags: ['promotions'] },
    },
    
    // Filter by multiple tags - shows notifications with either "security" OR "alert" tags
    {
      label: 'Security',
      filter: { tags: ['security', 'alert'] },
    },
  ];

  return <Inbox 
    applicationIdentifier={import.meta.env.VITE_NOVU_APP_ID || ''}
    subscriberId={user?.novuSubscriberId as string}
    tabs={tabs} 
    appearance={{
      // To enable dark theme support, uncomment the following line:
      baseTheme: dark,
      variables: {
        // The `variables` object allows you to define global styling properties that can be reused throughout the inbox.
        // Learn more: https://docs.novu.co/platform/inbox/react/styling#variables
        borderRadius: '0px',
        colorBackground: 'var(--background)',
        colorForeground: 'var(--foreground)',
        colorPrimary: 'var(--theme-accent)'
      },
      elements: {
        // The `elements` object allows you to define styles for these components.
        // Learn more: https://docs.novu.co/platform/inbox/react/styling#elements
      },
      icons: {
        // The `icons` object allows you to define custom icons for the inbox.
      },
    }} 
  />;
}