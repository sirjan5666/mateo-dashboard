/** Indian states and their cities for the registration form (spec 09 §6.1). */

export interface State {
  name: string;
  cities: string[];
}

export const STATES: State[] = [
  { name: 'Delhi', cities: ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Janakpuri'] },
  { name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'] },
  { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad'] },
  { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'] },
  { name: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'] },
  { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'] },
  { name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai'] },
  { name: 'Uttar Pradesh', cities: ['Lucknow', 'Noida', 'Kanpur', 'Varanasi'] },
];

export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Other'];
export const DELIVERY_TYPES = ['Normal', 'C-Section', 'Assisted', 'Other'];
export const RELATIONSHIPS = ['Mother', 'Father', 'Grandparent', 'Legal Guardian', 'Other'];
