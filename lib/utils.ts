import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility function to make authenticated API calls
 * Automatically includes the authorization header with the current user's token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    // Get access token from localStorage
    const accessToken = localStorage.getItem('auth-token');

    if (!accessToken) {
      console.error('No access token found in localStorage');
      throw new Error('No authentication token found. Please sign in again.');
    }

    console.log('Making authenticated request to:', url);
    console.log('Token available:', accessToken ? 'Yes' : 'No');

    // Merge headers to include authorization
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    };

    // Make the request with the authorization header
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      console.log(response);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('authenticatedFetch error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to make authenticated request');
  }
}
