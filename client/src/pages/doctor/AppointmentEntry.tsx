import { useSearchParams } from 'react-router';
import BookAppointment from './BookAppointment';
import RegisterNewPatient from './RegisterNewPatient';

/**
 * The `/doctor/appointments/new` entry.
 *
 * Every case goes through the BookAppointment wizard, which lets the doctor
 * either SEARCH & SELECT an existing patient (its default) or quickly register a
 * new one — so booking never forces re-creating a patient who already exists
 * (spec #16). `?edit=<id>` reschedules an appointment; `?patient=<id>` pre-selects
 * a known patient.
 *
 * `?register=1` opts into the full new-patient registration form (all
 * demographics) combined with booking, for a walk-in whose full record is being
 * created up front.
 */
export default function AppointmentEntry() {
  const [search] = useSearchParams();
  if (search.get('register') === '1') return <RegisterNewPatient book />;
  return <BookAppointment />;
}
