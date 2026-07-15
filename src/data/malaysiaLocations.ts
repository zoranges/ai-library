export interface District {
  value: string;
  label: string;
}

export interface State {
  value: string;
  label: string;
  districts: District[];
}

const malaysiaLocations: State[] = [
  {
    value: 'Johor',
    label: 'Johor',
    districts: [
      { value: 'Johor Bahru', label: 'Johor Bahru' },
      { value: 'Batu Pahat', label: 'Batu Pahat' },
      { value: 'Muar', label: 'Muar' },
      { value: 'Kluang', label: 'Kluang' },
      { value: 'Segamat', label: 'Segamat' },
      { value: 'Kota Tinggi', label: 'Kota Tinggi' },
      { value: 'Mersing', label: 'Mersing' },
      { value: 'Pontian', label: 'Pontian' },
      { value: 'Kulai', label: 'Kulai' },
      { value: 'Tangkak', label: 'Tangkak' },
    ],
  },
  {
    value: 'Kedah',
    label: 'Kedah',
    districts: [
      { value: 'Kota Setar', label: 'Kota Setar' },
      { value: 'Kubang Pasu', label: 'Kubang Pasu' },
      { value: 'Padang Terap', label: 'Padang Terap' },
      { value: 'Langkawi', label: 'Langkawi' },
      { value: 'Kuala Muda', label: 'Kuala Muda' },
      { value: 'Yan', label: 'Yan' },
      { value: 'Sik', label: 'Sik' },
      { value: 'Baling', label: 'Baling' },
      { value: 'Kulim', label: 'Kulim' },
      { value: 'Bandar Baharu', label: 'Bandar Baharu' },
      { value: 'Pokok Sena', label: 'Pokok Sena' },
      { value: 'Pendang', label: 'Pendang' },
    ],
  },
  {
    value: 'Kelantan',
    label: 'Kelantan',
    districts: [
      { value: 'Kota Bharu', label: 'Kota Bharu' },
      { value: 'Pasir Mas', label: 'Pasir Mas' },
      { value: 'Tumpat', label: 'Tumpat' },
      { value: 'Bachok', label: 'Bachok' },
      { value: 'Tanah Merah', label: 'Tanah Merah' },
      { value: 'Pasir Puteh', label: 'Pasir Puteh' },
      { value: 'Kuala Krai', label: 'Kuala Krai' },
      { value: 'Machang', label: 'Machang' },
      { value: 'Gua Musang', label: 'Gua Musang' },
      { value: 'Jeli', label: 'Jeli' },
    ],
  },
  {
    value: 'Melaka',
    label: 'Melaka',
    districts: [
      { value: 'Melaka Tengah', label: 'Melaka Tengah' },
      { value: 'Alor Gajah', label: 'Alor Gajah' },
      { value: 'Jasin', label: 'Jasin' },
    ],
  },
  {
    value: 'Negeri Sembilan',
    label: 'Negeri Sembilan',
    districts: [
      { value: 'Seremban', label: 'Seremban' },
      { value: 'Port Dickson', label: 'Port Dickson' },
      { value: 'Jelebu', label: 'Jelebu' },
      { value: 'Jempol', label: 'Jempol' },
      { value: 'Kuala Pilah', label: 'Kuala Pilah' },
      { value: 'Rembau', label: 'Rembau' },
      { value: 'Tampin', label: 'Tampin' },
    ],
  },
  {
    value: 'Pahang',
    label: 'Pahang',
    districts: [
      { value: 'Kuantan', label: 'Kuantan' },
      { value: 'Pekan', label: 'Pekan' },
      { value: 'Rompin', label: 'Rompin' },
      { value: 'Maran', label: 'Maran' },
      { value: 'Temerloh', label: 'Temerloh' },
      { value: 'Jerantut', label: 'Jerantut' },
      { value: 'Bentong', label: 'Bentong' },
      { value: 'Raub', label: 'Raub' },
      { value: 'Lipis', label: 'Lipis' },
      { value: 'Cameron Highlands', label: 'Cameron Highlands' },
      { value: 'Bera', label: 'Bera' },
    ],
  },
  {
    value: 'Perak',
    label: 'Perak',
    districts: [
      { value: 'Kinta', label: 'Kinta' },
      { value: 'Larut, Matang & Selama', label: 'Larut, Matang & Selama' },
      { value: 'Kerian', label: 'Kerian' },
      { value: 'Kuala Kangsar', label: 'Kuala Kangsar' },
      { value: 'Batang Padang', label: 'Batang Padang' },
      { value: 'Manjung', label: 'Manjung' },
      { value: 'Hilir Perak', label: 'Hilir Perak' },
      { value: 'Perak Tengah', label: 'Perak Tengah' },
      { value: 'Hulu Perak', label: 'Hulu Perak' },
      { value: 'Kampar', label: 'Kampar' },
      { value: 'Muallim', label: 'Muallim' },
      { value: 'Bagan Datuk', label: 'Bagan Datuk' },
    ],
  },
  {
    value: 'Perlis',
    label: 'Perlis',
    districts: [
      { value: 'Perlis', label: 'Perlis' },
    ],
  },
  {
    value: 'Pulau Pinang',
    label: 'Pulau Pinang',
    districts: [
      { value: 'Timur Laut', label: 'Timur Laut' },
      { value: 'Barat Daya', label: 'Barat Daya' },
      { value: 'Seberang Perai Utara', label: 'Seberang Perai Utara' },
      { value: 'Seberang Perai Tengah', label: 'Seberang Perai Tengah' },
      { value: 'Seberang Perai Selatan', label: 'Seberang Perai Selatan' },
    ],
  },
  {
    value: 'Sabah',
    label: 'Sabah',
    districts: [
      { value: 'Kota Kinabalu', label: 'Kota Kinabalu' },
      { value: 'Penampang', label: 'Penampang' },
      { value: 'Papar', label: 'Papar' },
      { value: 'Tuaran', label: 'Tuaran' },
      { value: 'Kota Belud', label: 'Kota Belud' },
      { value: 'Ranau', label: 'Ranau' },
      { value: 'Kudat', label: 'Kudat' },
      { value: 'Kota Marudu', label: 'Kota Marudu' },
      { value: 'Pitas', label: 'Pitas' },
      { value: 'Sandakan', label: 'Sandakan' },
      { value: 'Beluran', label: 'Beluran' },
      { value: 'Kinabatangan', label: 'Kinabatangan' },
      { value: 'Tawau', label: 'Tawau' },
      { value: 'Lahad Datu', label: 'Lahad Datu' },
      { value: 'Semporna', label: 'Semporna' },
      { value: 'Kunak', label: 'Kunak' },
      { value: 'Keningau', label: 'Keningau' },
      { value: 'Tambunan', label: 'Tambunan' },
      { value: 'Tenom', label: 'Tenom' },
      { value: 'Beaufort', label: 'Beaufort' },
      { value: 'Kuala Penyu', label: 'Kuala Penyu' },
      { value: 'Sipitang', label: 'Sipitang' },
      { value: 'Tongod', label: 'Tongod' },
      { value: 'Nabawan', label: 'Nabawan' },
      { value: 'Putatan', label: 'Putatan' },
    ],
  },
  {
    value: 'Sarawak',
    label: 'Sarawak',
    districts: [
      { value: 'Kuching', label: 'Kuching' },
      { value: 'Bau', label: 'Bau' },
      { value: 'Lundu', label: 'Lundu' },
      { value: 'Samarahan', label: 'Samarahan' },
      { value: 'Serian', label: 'Serian' },
      { value: 'Simunjan', label: 'Simunjan' },
      { value: 'Sri Aman', label: 'Sri Aman' },
      { value: 'Betong', label: 'Betong' },
      { value: 'Saratok', label: 'Saratok' },
      { value: 'Sarikei', label: 'Sarikei' },
      { value: 'Meradong', label: 'Meradong' },
      { value: 'Sibu', label: 'Sibu' },
      { value: 'Kanowit', label: 'Kanowit' },
      { value: 'Mukah', label: 'Mukah' },
      { value: 'Kapit', label: 'Kapit' },
      { value: 'Bintulu', label: 'Bintulu' },
      { value: 'Miri', label: 'Miri' },
      { value: 'Limbang', label: 'Limbang' },
      { value: 'Lawas', label: 'Lawas' },
    ],
  },
  {
    value: 'Selangor',
    label: 'Selangor',
    districts: [
      { value: 'Petaling', label: 'Petaling' },
      { value: 'Klang', label: 'Klang' },
      { value: 'Gombak', label: 'Gombak' },
      { value: 'Hulu Langat', label: 'Hulu Langat' },
      { value: 'Sepang', label: 'Sepang' },
      { value: 'Kuala Langat', label: 'Kuala Langat' },
      { value: 'Kuala Selangor', label: 'Kuala Selangor' },
      { value: 'Hulu Selangor', label: 'Hulu Selangor' },
      { value: 'Sabak Bernam', label: 'Sabak Bernam' },
    ],
  },
  {
    value: 'Terengganu',
    label: 'Terengganu',
    districts: [
      { value: 'Kuala Terengganu', label: 'Kuala Terengganu' },
      { value: 'Kuala Nerus', label: 'Kuala Nerus' },
      { value: 'Marang', label: 'Marang' },
      { value: 'Hulu Terengganu', label: 'Hulu Terengganu' },
      { value: 'Dungun', label: 'Dungun' },
      { value: 'Kemaman', label: 'Kemaman' },
      { value: 'Besut', label: 'Besut' },
      { value: 'Setiu', label: 'Setiu' },
    ],
  },
  {
    value: 'WP Kuala Lumpur',
    label: 'WP Kuala Lumpur',
    districts: [
      { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
    ],
  },
  {
    value: 'WP Putrajaya',
    label: 'WP Putrajaya',
    districts: [
      { value: 'Putrajaya', label: 'Putrajaya' },
    ],
  },
  {
    value: 'WP Labuan',
    label: 'WP Labuan',
    districts: [
      { value: 'Labuan', label: 'Labuan' },
    ],
  },
];

export function getAllStates(): State[] {
  return malaysiaLocations;
}

export function getDistrictsByState(stateValue: string): District[] {
  const state = malaysiaLocations.find((s) => s.value === stateValue);
  return state?.districts ?? [];
}

export function getStateByValue(value: string): State | undefined {
  return malaysiaLocations.find((s) => s.value === value);
}

export default malaysiaLocations;
