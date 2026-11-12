import React from "react";

/**
 * Icon set for Statswin.
 *
 * Every icon is a 24x24 glyph drawn on the same grid with 1.75px round strokes
 * and `currentColor`, so the toolbar, dialogs and list actions stay visually
 * consistent (previously a mix of a filled 20x20 glyph, a 294x294 app mark and
 * three unrelated outline shapes).
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Filled statistics mark used as the app logo. */
export function AppIcon(props: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="2.5" y="16" width="4" height="5.5" rx="1.2" />
      <rect x="10" y="8" width="4" height="13.5" rx="1.2" />
      <rect x="17.5" y="3" width="4" height="18.5" rx="1.2" opacity="0.65" />
    </svg>
  );
}

/** Gear. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a1.94 1.94 0 1 1-3.88 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.75-2.75l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a1.94 1.94 0 1 1 0-3.88h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.75-2.75l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a1.94 1.94 0 1 1 3.88 0v.1a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47.97H21a1.94 1.94 0 1 1 0 3.88h-.1a1.6 1.6 0 0 0-1.5.97Z" />
    </Icon>
  );
}

/** Circled "i". */
export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.9h.01" />
    </Icon>
  );
}

/** Arrow down into a tray — export / backup. */
export function BackupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v11" />
      <path d="m7.75 11.25 4.25 4.25 4.25-4.25" />
      <path d="M4.5 16.5v2.25A1.75 1.75 0 0 0 6.25 20.5h11.5a1.75 1.75 0 0 0 1.75-1.75V16.5" />
    </Icon>
  );
}

/** Arrow up out of a tray — import. */
export function ImportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15.5v-11" />
      <path d="m7.75 8.75 4.25-4.25 4.25 4.25" />
      <path d="M4.5 16.5v2.25A1.75 1.75 0 0 0 6.25 20.5h11.5a1.75 1.75 0 0 0 1.75-1.75V16.5" />
    </Icon>
  );
}

/** Document with a folded corner — diagnostics report. */
export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 3.5H7.75A1.75 1.75 0 0 0 6 5.25v13.5a1.75 1.75 0 0 0 1.75 1.75h8.5A1.75 1.75 0 0 0 18 18.75V8Z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9.5 12.5h5" />
      <path d="M9.5 16h3.5" />
    </Icon>
  );
}

/** Globe — language switch. */
export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5h17.6" />
      <path d="M3.2 14.5h17.6" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
    </Icon>
  );
}

/** Trash can — reset / delete. */
export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.75A1.25 1.25 0 0 1 10.75 3.5h2.5a1.25 1.25 0 0 1 1.25 1.25V6.5" />
      <path d="M6.5 6.5 7.4 19a1.75 1.75 0 0 0 1.75 1.5h5.7A1.75 1.75 0 0 0 16.6 19l.9-12.5" />
      <path d="M10.5 10.5v6" />
      <path d="M13.5 10.5v6" />
    </Icon>
  );
}

/** Circle with a check — applied / active. */
export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.25 12.25 2.5 2.5 5-5.5" />
    </Icon>
  );
}

/** GitHub mark (brand glyph, kept filled). */
export function GitHubIcon(props: IconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.47.09.65-.2.65-.45l-.01-1.77c-2.63.57-3.18-1.11-3.18-1.11-.43-1.09-1.05-1.38-1.05-1.38-.86-.59.06-.57.06-.57.95.06 1.45.97 1.45.97.85 1.45 2.22 1.03 2.76.79.09-.61.33-1.03.6-1.27-2.1-.24-4.31-1.05-4.31-4.67 0-1.03.37-1.87.97-2.53-.1-.24-.42-1.2.09-2.5 0 0 .79-.25 2.6.97a9 9 0 0 1 4.73 0c1.8-1.22 2.6-.97 2.6-.97.51 1.3.19 2.26.09 2.5.6.66.97 1.5.97 2.53 0 3.63-2.22 4.43-4.33 4.66.34.29.64.87.64 1.76l-.01 2.6c0 .25.17.55.65.45A9.5 9.5 0 0 0 12 2.5Z" />
    </svg>
  );
}

/** Speech bubble with an exclamation — bug report. */
export function BugIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 8.7 8.7 0 0 1-3.9-.92L3.5 20.5l1.42-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
      <path d="M12 7.75v4.5" />
      <path d="M12 15.5h.01" />
    </Icon>
  );
}

/** Person — author link. */
export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </Icon>
  );
}

/** Chevron pointing down — dropdown affordance. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 10 5 5 5-5" />
    </Icon>
  );
}

/** Close (X). */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6.5 6.5 11 11" />
      <path d="m17.5 6.5-11 11" />
    </Icon>
  );
}

/** Vertical ellipsis — overflow menu. */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Warning triangle — quota banner. */
export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5 3.75 19h16.5Z" />
      <path d="M12 9.5v4.25" />
      <path d="M12 16.75h.01" />
    </Icon>
  );
}
