/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { GoogleEvent } from './types';

// Augment the window object to avoid TypeScript errors for Google's global objects
declare global {
    interface Window {
        gapi: any;
        google: any;
        tokenClient: any;
        __ENV?: {
            GOOGLE_API_KEY?: string;
            GOOGLE_CLIENT_ID?: string;
        }
    }
}

// --- CONFIGURATION & STATE ---
// Resolve env vars in the browser (works with Vite, Next.js, or a window.__ENV fallback)
const GOOGLE_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_API_KEY) ||
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_GOOGLE_API_KEY) ||
  (window as any).__ENV?.GOOGLE_API_KEY;

const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID) ||
  (window as any).__ENV?.GOOGLE_CLIENT_ID;

let gapiInited = false;
let gisInited = false;

const callbacks = {
    updateSigninStatus: (isSignedIn: boolean) => {},
    updateEvents: (events: GoogleEvent[]) => {},
    updateUser: (user: any | null) => {},
    onReady: () => {},
};


// --- INITIALIZATION ---
function checkInitStatus() {
    if (gapiInited && gisInited) {
        callbacks.onReady();
    }
}

export function initGoogleClient(reactCallbacks: typeof callbacks): boolean {
    Object.assign(callbacks, reactCallbacks);
    
    if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) {
        console.warn("Google API Key or Client ID is missing. Google Calendar feature will be disabled.");
        return false;
    }

    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => window.gapi.load('client', initializeGapiClient);
    gapiScript.onerror = () => {
        console.error("Error loading GAPI script.");
        alert("Fatal Error: Could not load Google API. Please check your network connection or ad blocker.");
    }
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = gisLoaded;
    gisScript.onerror = () => {
        console.error("Error loading GIS script.");
        alert("Fatal Error: Could not load Google Sign-In library. Please check your network connection or ad blocker.");
    }
    document.body.appendChild(gisScript);
    
    return true;
}

async function initializeGapiClient() {
    try {
        await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
        gapiInited = true;
        checkInitStatus();
    } catch (error: any) {
        console.error("Error initializing GAPI client:", error);
        const details = error?.result?.error?.message || error?.message || JSON.stringify(error, null, 2);
        alert(`Could not initialize Google Calendar API. Check your API key & API enablement.\n\n${details}`);
    }
}

function gisLoaded() {
    try {
        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: [
                'https://www.googleapis.com/auth/calendar.readonly',
                'openid',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile'
            ].join(' '),
            callback: tokenCallback,
        });
        gisInited = true;
        checkInitStatus();
    } catch (error: any) {
        console.error("Error initializing Google Sign-In:", error);
        alert(`Could not initialize Google Sign-In. The Client ID may be invalid.\n\n${error?.message || JSON.stringify(error, null, 2)}`);
    }
}

// --- AUTHENTICATION & API CALLS ---

async function tokenCallback(tokenResponse: any) {
    if (tokenResponse.error) {
        console.error("Token callback error:", tokenResponse.error);
        alert(`Google Sign-In Error: ${tokenResponse.error}`);
        return;
    }
    
    if (tokenResponse.access_token) {
        window.gapi.client.setToken({ access_token: tokenResponse.access_token });
        callbacks.updateSigninStatus(true);
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                 headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
            });
            if (!res.ok) throw new Error(`Failed to fetch user info: ${res.statusText}`);
            const user = await res.json();
            callbacks.updateUser(user);

            await listUpcomingEvents();
        } catch (error) {
            console.error("Error after getting token:", error);
            alert("An error occurred while fetching your data after sign-in.");
            handleSignOut();
        }
    }
}

export function handleSignIn() {
    if (gapiInited && gisInited) {
        window.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        alert('Authentication libraries are not loaded yet. Please wait a moment and try again.');
        console.error("SignIn attempt failed: gapiInited=", gapiInited, "gisInited=", gisInited);
    }
}

export function handleSignOut() {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token, () => {
            window.gapi.client.setToken(null);
            callbacks.updateEvents([]);
            callbacks.updateSigninStatus(false);
            callbacks.updateUser(null);
        });
    }
}

async function listUpcomingEvents() {
    try {
        const response = await window.gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 250,
            'orderBy': 'startTime'
        });
        callbacks.updateEvents(response.result.items);
    } catch (err) {
        console.error('Error fetching calendar events:', err);
        const gapiError = err as any;
        if (gapiError.result?.error?.code === 401 || gapiError.result?.error?.code === 403) {
            alert("Your session has expired. Please sign in again.");
            handleSignOut();
        } else {
             alert("Could not fetch calendar events. Please try again later.");
        }
    }
}