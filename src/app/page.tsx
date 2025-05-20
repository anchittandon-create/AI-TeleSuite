
import { redirect } from 'next/navigation';

export default function RootPage() { // Renamed component for clarity
  redirect('/home'); // Updated redirect target
}
