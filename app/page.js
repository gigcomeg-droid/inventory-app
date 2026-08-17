import { redirect } from 'next/navigation';

// Root route: simply hand off to /dashboard. middleware.js (owned by the
// backend) is responsible for bouncing unauthenticated visitors to /login,
// so we don't need to duplicate that auth check here.
export default function RootPage() {
  redirect('/dashboard');
}
