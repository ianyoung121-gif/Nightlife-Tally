# Google Play internal-testing release kit

This kit is the source of truth for the first Android release of The Weekender.
It is deliberately conservative: it records what the app does today and calls
out details that must be verified when the account work lands.

## Android identity

| Field | Value |
| --- | --- |
| App name | The Weekender |
| Android application ID | `com.theweekender.app` |
| First version | `1.0.0` (`versionCode` 1) |
| Release artifact | Android App Bundle (`.aab`) |
| Google Play track | Internal testing |

The application ID is now fixed in `app.json`. Confirm that
`com.theweekender.app` is still unused in the owning Play Console before the
first upload. Once an app bundle is accepted by Google Play, never change this
identifier.

## Store listing

**App name (30 characters):** The Weekender

**Short description (80 characters):** Find nearby bars, see the crowd’s pulse, and plan a better night out.

**Full description:**

The Weekender helps you decide where to go tonight. Discover nearby venues,
explore what the community is enjoying, spin up a spontaneous plan, and build a
date-night itinerary around local spots.

Your location is used only when you choose to enable it, so the app can sort
venues and plans around you. Community drink tallies are designed to show the
shared vibe at a venue, not a personal consumption record. The Weekender
encourages responsible nights out: plan a safe ride and never drink and drive.

**App icon:** `assets/images/icon.png` is a square 1024 × 1024 PNG and is ready
to upload as the Play listing icon.

**Feature graphic:** Not required for an internal-testing-only release. Create
a 1024 × 500 graphic before a production rollout.

**Support contact:** `ianyoung121@hotmail.com`

**Privacy policy URL:** `https://nightlifetally.com/privacy`

**Account deletion URL:** `https://nightlifetally.com/delete-account`

The public policy page is included in the web app at `/privacy`. Publish the
web artifact before entering this URL in Play Console so the live domain serves
the policy.

## Screenshots

Capture at least two phone screenshots from a physical Android device after
installing the release build:

1. **Discover** — community pulse and trending venues.
2. **Nearby** — location permission granted and nearby venues sorted by distance.
3. **Spin** — a completed spin result.
4. **Date Night** — a generated itinerary.

Use a 16:9 or 9:16 Android screenshot, at least 320 px and no more than 3,840
px on either side. Capture real app states only; do not use mocked overlays or
store-only compositing. The four required flows are also listed in the device
test checklist below.

Reference captures of the implemented screens are saved in
`store-assets/01-discover.jpg`, `02-nearby.jpg`, `03-spin.jpg`, and
`04-date-night.jpg`. Replace them with the matching physical-device captures
after the internal build is installed; the saved images are useful framing
references, not evidence of the physical-device acceptance checks.

## Privacy policy and Data Safety

### Published privacy policy

The policy is served at `/privacy` in the web artifact. It describes:

- optional device location used locally to sort nearby venues;
- anonymous aggregate drink-tally information sent to the Weekender service;
- Replit sign-in data used to create and operate a Weekender account;
- no advertising, sale of personal data, or third-party analytics SDKs in the
  current mobile app;
- how to reach support with a privacy or account question.

### Data Safety worksheet

Use this as the answer set for the current Android internal-test build. Review
it again before any release that adds a new identity provider, profile field,
person-linked tally, advertising SDK, or account-deletion flow.

| Play Console question | Answer to enter |
| --- | --- |
| Does the app collect or share required user data types? | **Yes** — Replit sign-in supplies account identity data to operate a Weekender account, and anonymous drink-tally activity is sent to the Weekender service as an aggregate count. |
| Is data encrypted in transit? | **Yes** — the app uses HTTPS for its API calls. |
| Can users request deletion of their data? | **Yes.** Authenticated users can permanently delete their account, saved follows, and active sessions in the Profile screen or at `https://nightlifetally.com/delete-account`. Anonymous tally totals remain aggregate community data because they are not linked to an account. |
| Personal info: name / username and email address | Collected through Replit sign-in for account management and app functionality; stored by the Weekender service, linked to the account, not sold or used for advertising. |
| Photos | Collected when Replit provides a profile image reference; used for account presentation, linked to the account, not sold or used for advertising. |
| User IDs | Collected for account management and app functionality; linked to the account, not sold or used for advertising. |
| Precise location | **Not collected off-device.** It is requested only after the user chooses to enable it, held in app memory, and used locally to rank venues. Do not mark it as shared. |
| App activity: anonymous drink tallies | Disclose as collected for app functionality, retained only as an aggregate count, not shared, and not linked to a person or user account. |
| Device or other IDs | Not collected by the current mobile code. The session token is kept in device secure storage and is not an advertising or device identifier. |
| Sold or shared for advertising | No. |

The mobile sign-in flow uses Replit OIDC. Review the Play Console definition of
“shared” for identity-provider processing before submission; do not claim that
infrastructure access logs never contain IP addresses without confirming the
production host’s logging policy.

## Content rating worksheet

Complete the current Play Console questionnaire truthfully using these
instructions:

- **Alcohol, tobacco, or drugs:** choose the answer that declares references
  to alcoholic drinks and nightlife. The app shows drink names and tallies but
  does not sell alcohol or instruct users to consume it.
- **Gambling:** no. Spin is a non-monetary activity picker; it does not take
  wagers, use prizes, or simulate casino play.
- **Violence, sexual content, profanity, fear, and controlled substances:**
  no, based on the current app content.
- **User interaction / user-generated content:** no for the current Android
  build. Sign-in and following a bar do not let users publish content visible
  to others. Revisit this if a later release adds public posting or comments.
- **Target audience:** adults of legal drinking age; do not target children.

The final rating is generated by Google Play from the selected answers. Save a
PDF or screenshot of the completed questionnaire with the release record.

## Build and internal-test upload

1. Publish the current API Server and web artifacts before building. The Android
   bundle uses `https://nightlifetally.com`, so that host must serve this
   release’s `/api/auth/user` and `/api/auth/account` endpoints as well as the
   public `/delete-account` page. With no session, this check should return
   `{"user":null}`:

   ```sh
   curl -fsS https://nightlifetally.com/api/auth/user
   ```

2. Install and authenticate the EAS CLI on the release owner’s machine:

   ```sh
   pnpm dlx eas-cli@latest login
   pnpm dlx eas-cli@latest init
   ```

   `init` creates the EAS project and writes its project ID into the Expo
   configuration. Commit that non-secret ID before building.

3. The `play-internal` EAS profile already supplies the public,
   non-secret `EXPO_PUBLIC_API_URL` value as `https://nightlifetally.com`.
   It also supplies the non-secret `EXPO_PUBLIC_REPL_ID` needed by the Replit
   OIDC sign-in flow. The Android app cannot use Replit’s development domain
   in a Play build. Update these values in `eas.json` if the public API address
   or Replit client identity ever changes.

4. Build the signed Play bundle:

   ```sh
   pnpm dlx eas-cli@latest build --platform android --profile play-internal
   ```

5. Download the resulting `.aab` from the EAS build page. In Play Console,
   create the app with package ID `com.theweekender.app`, then upload the
   bundle to **Testing → Internal testing**.

6. Add internal testers by email or Google Group, complete the release notes,
   and roll out the internal release. Alternatively, after configuring a Play
   service account in EAS, submit with:

   ```sh
   pnpm dlx eas-cli@latest submit --platform android --profile play-internal
   ```

Never commit a Play service-account JSON file or any signing credentials.

## Physical Android acceptance checklist

Run this on an Android phone using the Play Internal Testing install:

- [ ] Install from the tester opt-in link and open the app.
- [ ] Deny location, verify the Nearby screen explains how to enable it, then
      enable foreground location and verify nearby distances update.
- [ ] Confirm the app never requests background location.
- [ ] Add a drink tally and confirm only the community aggregate changes; no
      personal drink history is shown.
- [ ] Complete a Spin flow and verify its result can be used without a crash.
- [ ] Generate a Date Night itinerary with location enabled.
- [ ] Background and reopen the app; confirm it resumes without a crash.
- [ ] Test the privacy URL and support contact from the final store listing.
- [ ] Confirm the responsible-night-out message is visible.

Record the device model, Android version, app version, and pass/fail result for
each check before expanding beyond internal testing.