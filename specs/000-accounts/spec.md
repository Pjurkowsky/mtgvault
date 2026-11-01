# Spec 000: Accounts

Status: Done
Depends on: nothing
Needed by: 001-collection

## Goal

Give each person their own account, so they can keep a private collection,
pick the currency they see prices in, and have a public profile that other
people can visit.

## User stories

- As a new visitor, I create an account with a username, email, password and
  the currency I want to see prices in.
- As a user, I log in and stay logged in between visits.
- As a user, I log out.
- As a user, I change my currency or my password in Settings.
- As anyone, I open a user's profile at `/u/<username>`.

## Acceptance criteria

### Sign up

- **AC-1** The sign-up form asks for username, email, password and currency.
  All four are required.
- **AC-2** The currency field offers USD, EUR and PLN with no option
  preselected. PLN shows a note that its prices are converted from EUR.
- **AC-3** A username has 3 to 30 characters: letters, digits, `_` and `-`.
  Usernames are unique, ignoring case (`Bob` and `bob` cannot both exist).
- **AC-4** Emails are unique, ignoring case.
- **AC-5** Passwords must pass Django's standard password validators. The form
  shows each failed rule next to the field.
- **AC-6** After a successful sign-up the user is logged in and lands on their
  collection.

### Log in and out

- **AC-7** A user logs in with their username or email, plus password.
- **AC-8** A wrong login shows one generic message ("Wrong username/email or
  password") and does not reveal which part was wrong.
- **AC-9** A logged-in user stays logged in across page reloads and browser
  restarts for up to 7 days without activity.
- **AC-10** Log out ends the session on that device and returns to the login
  page.
- **AC-11** Visiting a page that needs login while logged out redirects to the
  login page, then back to the original page after login.

### Settings

- **AC-12** Settings shows the user's username and email (read-only) and their
  currency.
- **AC-13** Changing currency takes effect everywhere in the app right away,
  without logging out.
- **AC-14** A user changes their password by entering the current password and
  the new one. The new password follows AC-5.

### Profile

- **AC-15** `/u/<username>` shows the username and the date the account was
  created. Anyone can open it, logged in or not.
- **AC-16** `/u/<unknown>` shows a "User not found" page.
- **AC-17** The profile never shows email, currency or any private data.
  (Spec 001 adds public locations to this page.)

## Out of scope

- Password reset by email (no email sending yet)
- Email verification
- Changing username or email
- Deleting an account
- Social login (Google, Discord, etc.)
- Avatars, bios, display names

## Assumptions (filled in during writing, not grilled)

- Login accepts username or email (AC-7).
- Session lasts 7 days without activity (AC-9). This matches the current JWT
  refresh-token lifetime.
- Username and email cannot change after sign-up.
