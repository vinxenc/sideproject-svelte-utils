# 16 · Sign-up with an email code

The account flow the whole suite starts from: sign-up creates an unverified account, mails a six-digit code, and only the code (plus the password) opens a session. Read "Email OTP" in [README.md](../README.md) of the repo and `src/lib/server/email-verification.ts` for the rules behind it. SET-06 creates the run's accounts through the API to save time; this file drives the real pages once.

> Written from the code and run once (see [11-manual-and-gaps.md](11-manual-and-gaps.md)).

**Needs:** SET-01 to SET-07 and the browser signed in as the run's main QA user (SET-06). Mailpit is read from the shell as in "QA accounts" ([01-test-data.md](01-test-data.md)). The file creates two accounts of its own, `qa-ver-<8 hex>@example.test` (name `QA Ver`) and `qa-ver2-<8 hex>@example.test`; write both ids down (look them up by email in the database): [10-cleanup.md](10-cleanup.md) deletes them.

**Rate limits decide the pace here.** The verify call (`email-otp/verify-email`) is limited to 3 per 60 seconds for the whole machine, sign-up and sign-in to 3 per 10 seconds. The order below spends the budget on purpose; wait 60 seconds before starting this file (the earlier accounts spent theirs), and wait another 60 whenever a step answers `429` (that is the limiter, not a failure; the page says `Too many tries. Wait a minute, then try again.`).

This file ends with the browser signed in again as the run's main QA user, because [09-resilience.md](09-resilience.md) needs that.

## VER-01 Sign-up does not sign anyone in

**Steps**

1. Click `Sign out` in the sidebar (the main QA user), wait for `/sign-in`, click `Sign up`.
2. On the form (`Full Name`, `Email`, `Password` with the note `Must be at least 8 characters long.`, `Confirm Password`) fill a different password in the last two fields and press `Create Account`.
3. Fill in `QA Ver`, `qa-ver-<hex>@example.test`, a long password twice, and press `Create Account`. Read the requests with the browser's network tool (`read_network_requests`): the auth client keeps its own reference to `fetch`, so a `fetch` wrapper in the page does not see these calls.
4. Look at the page, its address, `sessionStorage`, `GET /api/auth/get-session`, the database and Mailpit.

**Expected**

- Step 2: `Passwords do not match` under the form, no request sent.
- Step 3: the button reads `Creating account…`; one `POST /api/auth/sign-up/email` answers 200; the app goes to `/verify-email`.
- Step 4: heading `Verify your email` and the text `We sent a 6-digit code to qa******@example.test.` (the first two letters of the address, six stars, then the domain); six code boxes in two groups of three; the text `The code expires in 10 minutes.`; `Verify` disabled (it enables at six digits); a disabled button `Resend code in <n>s` counting down from about 60; links `Back to sign in` and `Start over`. **No email field and no password field** (the password is held in the page's memory). The address bar has no email in it; `sessionStorage` key `utilities:verify-email` holds `{email, sentAt}`.
- `GET /api/auth/get-session` returns `null` (no session), the user row has `emailVerified` false.
- Within 10 seconds Mailpit has exactly one message to the address: subject `Verify your email`, from `Utilities <no-reply@localhost>`, text `Your code to verify your email is NNNNNN.` plus a line that it expires in 10 minutes. The code is not in the subject.

## VER-02 A wrong code

**Steps:** type six digits that are not the code (for example `000000`; change it if it equals the real one).

**Expected:** the call `POST /api/auth/email-otp/verify-email` goes out by itself at the sixth digit with `{email, otp, password}`; the answer is 400 with the code `INVALID_OTP`; the page shows `That code is not right, or this email was started with a different password. Check the code, sign up again to start over, or sign in if you already have an account.`; the boxes are cleared and usable again; still no session. (This is verify call 1 of 3.)

## VER-03 Resend

**Steps:** in the page set `sessionStorage` `utilities:verify-email` back to `sentAt` = now minus 61 seconds and reload the page (this also drops the held password, see VER-04). Click `Resend code`. Read Mailpit.

**Expected:** the button reads `Resend code` (enabled) after the reload and the disabled countdown comes back after the click; a notice `A new code is on its way.`; a second message to the address in Mailpit with a code (use the newest one from now on). A resend before the countdown ends is not possible (the button is disabled); a `429` from the server (more than 3 sends a minute) shows `You asked for too many codes. Wait a minute, then try again.`

## VER-04 The password is asked again after a reload, and verifying

**Steps**

1. After the reload of VER-03 look for a password field above the code boxes.
2. Type the newest code with the field empty.
3. Type the right code with a wrong password in the field.
4. Type the right code with the right password.

**Expected**

- Step 1: a `Password` field with the note `The password you chose when you signed up.` (after sign-up in the same page session it is not shown).
- Step 2: no request; the message `Enter your password first.`
- Step 3: the same answer as VER-02 (400 `INVALID_OTP`): the server does not say which of the two was wrong, and a wrong password does not use up a code attempt. (Verify call 2.)
- Step 4: 200; the app goes to `/dashboard` signed in as `QA Ver`: the sidebar footer shows the name and the email; `GET /api/auth/get-session` returns the user with `emailVerified` true; `sessionStorage` no longer has `utilities:verify-email`. The code row is used up. (Verify call 3.)

## VER-05 Signing in before verifying

**Steps**

1. `Sign out`. Make the second account through the API only (QA accounts steps 1, no verify): `qa-ver2-<hex>@example.test`.
2. In the `/sign-in` form (`Email`, `Password`, `Login`) enter its email and its right password and submit, recorder armed.
3. Click `Back to sign in`, enter the same email with a wrong password.

**Expected**

- Step 2: `POST /api/auth/sign-in/email` answers 403 with the code `EMAIL_NOT_VERIFIED` and no session cookie; the app goes to `/verify-email` for that address (with the password held, so no password field), and Mailpit has a fresh message to it (a second one). Do not repeat this sign-in unnecessarily: every unverified sign-in with the right password mails another code.
- Step 3: 401 `INVALID_EMAIL_OR_PASSWORD`, the form shows the server's message, and no mail is sent.

## VER-06 Pages that need or refuse a session

**Steps and expected results**

1. Signed out, with `sessionStorage` empty, open `/verify-email`: the app redirects to `/sign-in` (there is nothing to verify in this tab).
2. Click `Back to sign in` and `Start over` on a pending verify page: they go to `/sign-in` and `/sign-up` and forget the pending verification (reopening `/verify-email` sends you to `/sign-in`).
3. Signed in (after VER-09), `/sign-in`, `/sign-up` and `/verify-email` each redirect (303) to `/dashboard`.
4. Signed out, `/` redirects to `/dashboard`, which redirects to `/sign-in`.

## VER-07 The auth API is narrowed on purpose

Plain HTTP client, `Origin: http://localhost:4173`. The unverified account of VER-05 is the target.

| Request                                                                                                                                                                                                                          | Expected                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in/email-otp`, `/api/auth/email-otp/check-verification-otp`, `/api/auth/forget-password/email-otp`, `/api/auth/email-otp/reset-password`, `/api/auth/send-verification-email`, `GET /api/auth/verify-email` | 404 each (a mailbox alone must never sign in or reset a password)                |
| `POST /api/auth/email-otp/send-verification-otp` `{email, type: "sign-in"}`, and the same with `forget-password`, `change-email`                                                                                                 | 400 `Invalid OTP type`; no mail and no code row                                  |
| `send-verification-otp` `{email: <unknown address>, type: "email-verification"}`                                                                                                                                                 | 200, same answer as for a real address; Mailpit gets nothing for the unknown one |
| `verify-email` `{email, otp: "000000"}` (no password), with a wrong password, and for an unknown email                                                                                                                           | 400 `INVALID_OTP` every time: indistinguishable from a wrong code                |

Count the calls: the three `verify-email` rows spend a whole minute's allowance of verifies, and `send-verification-otp` has its own allowance of 3 per minute (VER-03's resend used one), so wait 60 seconds before the table. The three `Invalid OTP type` rows also count against the send allowance (the answer 400 is given after the limiter ran), so a fourth send in the same minute is answered 429: wait another 60 seconds before the unknown-address row, or run that row first.

## VER-08 Re-claiming an unverified address, and taken addresses

**Steps and expected results**

1. Note the id of the unverified `qa-ver2-…` account. Sign up again with the same email and a **different** password (API). Answer 200; a new message arrives in Mailpit. In the database there is still exactly one user with that email, with a **different id**, `emailVerified` false and a different password hash (the pre-registered account was replaced, so squatting an address cannot block its owner).
2. Sign up with the email of the main QA user (verified), with another password. Answer 200, like a new address; **no** message reaches Mailpit for it (wait 5 seconds); in the database that user's id and `emailVerified` are unchanged; the main password still signs in (VER-09).
3. Account protection: an unverified account that owns data or a session is not replaced. (Cannot be reached through the API alone, because unverified accounts cannot get either; covered by unit tests, see [11-manual-and-gaps.md](11-manual-and-gaps.md).)

## VER-09 Back to the main QA user

**Steps:** sign in as the run's main QA user with `POST /api/auth/sign-in/email` from the page (wait if a `429`), then go to `/photo-video` through a client-side link.

**Expected:** 200, `GET /api/auth/get-session` returns the main user, `/photo-video` shows its library. Run VER-06 step 3 now. Leave the browser here for [09-resilience.md](09-resilience.md).

## VER-10 The limiter itself (optional, run last)

**Steps:** send 4 wrong-code `verify-email` requests for the unverified `qa-ver2-…` address within one minute, then wait 60 seconds and send one more. Separately send 4 `POST /api/auth/sign-in/email` (wrong password) within 10 seconds.

**Expected:** the first three verifies answer 400 `INVALID_OTP`, the fourth 429; after the wait it is 400 again. The fourth sign-in within 10 seconds is 429. Both only slow down this machine's later account creation: wait out the minute before anything else needs a verify.
