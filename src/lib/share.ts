/**
 * Sharing — link out, and card out.
 *
 * Every path here degrades rather than fails. A guest opening a story on a desktop
 * browser, an owner on a phone with no share sheet, and a judge on a laptop with the
 * web build all have to end up with something in their hand. The return value says
 * what actually happened so the caller can tell the user the truth rather than
 * claiming a share that never occurred.
 */

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

interface WebNavigator {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(t: string): Promise<void> };
}

function webNavigator(): WebNavigator | null {
  if (Platform.OS !== 'web') return null;
  return (globalThis as { navigator?: WebNavigator }).navigator ?? null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    const nav = webNavigator();
    if (nav?.clipboard) {
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Share a link. On web this prefers the native share sheet where the browser has one
 * and silently falls back to the clipboard where it does not — which is most desktop
 * browsers, so `copied` is a normal outcome, not an error.
 */
export async function shareLink(url: string, message: string): Promise<ShareOutcome> {
  const nav = webNavigator();
  if (nav?.share) {
    try {
      await nav.share({ text: message, url });
      return 'shared';
    } catch {
      // User dismissed the sheet, or the browser refused. Fall through to clipboard.
    }
  }
  return (await copyText(`${message}\n${url}`)) ? 'copied' : 'failed';
}

/**
 * Rasterise the story card and hand it to the OS share sheet.
 *
 * `captureRef` needs a laid-out native view, so callers must render the card on
 * screen — capturing an offscreen copy produces a blank image on Android.
 */
export async function shareCardImage(
  ref: React.RefObject<unknown>,
  fallbackUrl: string,
  message: string
): Promise<ShareOutcome> {
  try {
    const uri = await captureRef(ref as never, {
      format: 'png',
      quality: 1,
      // A story card is mostly type; PNG at device scale keeps it readable when the
      // recipient's messenger recompresses it.
      result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
    });

    if (Platform.OS === 'web') {
      return downloadDataUri(uri, 'story-card.png') ? 'shared' : 'failed';
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share this story',
        UTI: 'public.png',
      });
      return 'shared';
    }
  } catch {
    // Capture is the part most likely to fail on an unusual device. Never leave the
    // user with nothing — the link still carries the story.
  }
  return shareLink(fallbackUrl, message);
}

function downloadDataUri(dataUri: string, filename: string): boolean {
  try {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return false;
    const a = doc.createElement('a');
    a.href = dataUri;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}
