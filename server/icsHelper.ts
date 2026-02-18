import { v4 as uuidv4 } from 'uuid';

interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDateTime: Date;
  endDateTime: Date;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: string[];
}

/**
 * Generates an ICS (iCalendar) file content for calendar invites
 * Compatible with Outlook, Google Calendar, and other calendar applications
 */
export function generateICS(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const uid = uuidv4();
  const timestamp = formatDate(new Date());
  const startDate = formatDate(event.startDateTime);
  const endDate = formatDate(event.endDateTime);

  // Build ICS content with proper RFC5545 format
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Room Booking System//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.description) {
    icsContent.push(`DESCRIPTION:${escapeText(event.description)}`);
  }

  if (event.location) {
    icsContent.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.organizerEmail) {
    const organizerName = event.organizerName || event.organizerEmail;
    icsContent.push(`ORGANIZER;CN="${escapeText(organizerName)}":mailto:${event.organizerEmail}`);
  }

  // Add attendees with proper RSVP flags
  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach((attendee) => {
      icsContent.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}`);
    });
  }

  icsContent.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  // Join with CRLF line endings as per RFC5545
  return icsContent.join('\r\n') + '\r\n';
}
