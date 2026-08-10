import { useSearchParams } from 'react-router';
import BookAppointment from './BookAppointment';
import RegisterNewPatient from './RegisterNewPatient';

/**
 * The `/doctor/appointments/new` entry, which serves three cases:
 *
 *   • brand-new booking (no query)  → register the patient AND book in one form
 *     (RegisterNewPatient in `book` mode). This is what a walk-in needs: a new
 *     patient number is issued as part of booking.
 *   • reschedule (`?edit=<id>`)     → the slot picker, editing an existing
 *     appointment's time — there is no patient to register.
 *   • follow-up for a known patient (`?patient=<id>`) → the slot picker with the
 *     patient pre-selected; re-registering an existing patient would duplicate
 *     them.
 *
 * The last two keep the BookAppointment wizard because they act on a patient who
 * already exists; only a first-time booking goes through registration.
 */
export default function AppointmentEntry() {
  const [search] = useSearchParams();
  const forExisting = !!search.get('edit') || !!search.get('patient');
  return forExisting ? <BookAppointment /> : <RegisterNewPatient book />;
}
