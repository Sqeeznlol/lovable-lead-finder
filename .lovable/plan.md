

## Problem

The Google Maps link in the Akquise-Modus popup opens via `window.open()`, which gets blocked by Google's consent/redirect page when opened from within a popup context. Copying the URL manually into a new tab works fine.

## Solution

Instead of opening the link with `window.open()`, create a proper `<a href="..." target="_blank" rel="noopener noreferrer">` link styled as a button. This avoids popup-blocker issues and Google's redirect blocking, since the browser treats it as a direct user-initiated navigation rather than a programmatic popup.

## Changes

**File: `src/components/AkquiseMode.tsx`**
- Replace the `<Button onClick={() => window.open(googleMapsUrl)}>` with an `<a>` tag (or `Button asChild` wrapping an `<a>`) that has `href={googleMapsUrl}` and `target="_blank"`.
- This applies to the Google Maps button around line 342-346.

This is a minimal one-line change that should fix the blocking issue entirely.

