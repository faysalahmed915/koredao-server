export interface CampusLocation {
  name: string;
  shortName: string;
  district: string;
  latitude: number;
  longitude: number;
}

export const BANGLADESH_CAMPUSES: Record<string, CampusLocation> = {
  // Public Engineering & Science
  buet: {
    name: 'Bangladesh University of Engineering and Technology (BUET)',
    shortName: 'BUET',
    district: 'Dhaka',
    latitude: 23.7266,
    longitude: 90.3925,
  },
  ruet: {
    name: 'Rajshahi University of Engineering & Technology (RUET)',
    shortName: 'RUET',
    district: 'Rajshahi',
    latitude: 24.3636,
    longitude: 88.6284,
  },
  cuet: {
    name: 'Chittagong University of Engineering & Technology (CUET)',
    shortName: 'CUET',
    district: 'Chittagong',
    latitude: 22.4632,
    longitude: 91.9712,
  },
  kuet: {
    name: 'Khulna University of Engineering & Technology (KUET)',
    shortName: 'KUET',
    district: 'Khulna',
    latitude: 22.9006,
    longitude: 89.5024,
  },
  sust: {
    name: 'Shahjalal University of Science and Technology (SUST)',
    shortName: 'SUST',
    district: 'Sylhet',
    latitude: 24.9229,
    longitude: 91.8344,
  },
  iut: {
    name: 'Islamic University of Technology (IUT)',
    shortName: 'IUT',
    district: 'Gazipur',
    latitude: 23.9878,
    longitude: 90.3804,
  },

  // Major Public General Universities
  du: {
    name: 'University of Dhaka (DU)',
    shortName: 'DU',
    district: 'Dhaka',
    latitude: 23.734,
    longitude: 90.3928,
  },
  ju: {
    name: 'Jahangirnagar University (JU)',
    shortName: 'JU',
    district: 'Savar',
    latitude: 23.8824,
    longitude: 90.2673,
  },
  cu: {
    name: 'University of Chittagong (CU)',
    shortName: 'CU',
    district: 'Chittagong',
    latitude: 22.4716,
    longitude: 91.7877,
  },
  ru: {
    name: 'University of Rajshahi (RU)',
    shortName: 'RU',
    district: 'Rajshahi',
    latitude: 24.3688,
    longitude: 88.6378,
  },
  ku: {
    name: 'Khulna University (KU)',
    shortName: 'KU',
    district: 'Khulna',
    latitude: 22.8025,
    longitude: 89.5332,
  },

  // Leading Private Universities
  nsu: {
    name: 'North South University (NSU)',
    shortName: 'NSU',
    district: 'Dhaka (Bashundhara)',
    latitude: 23.8151,
    longitude: 90.4255,
  },
  bracu: {
    name: 'BRAC University (BRACU)',
    shortName: 'BRACU',
    district: 'Dhaka (Merul Badda)',
    latitude: 23.7719,
    longitude: 90.4264,
  },
  aiub: {
    name: 'American International University-Bangladesh (AIUB)',
    shortName: 'AIUB',
    district: 'Dhaka (Kuratoli)',
    latitude: 23.8223,
    longitude: 90.4278,
  },
  iub: {
    name: 'Independent University, Bangladesh (IUB)',
    shortName: 'IUB',
    district: 'Dhaka (Bashundhara)',
    latitude: 23.8159,
    longitude: 90.4279,
  },
  ewu: {
    name: 'East West University (EWU)',
    shortName: 'EWU',
    district: 'Dhaka (Aftabnagar)',
    latitude: 23.7685,
    longitude: 90.4256,
  },
  diu: {
    name: 'Daffodil International University (DIU)',
    shortName: 'DIU',
    district: 'Ashulia',
    latitude: 23.8769,
    longitude: 90.3204,
  },
  aust: {
    name: 'Ahsanullah University of Science and Technology (AUST)',
    shortName: 'AUST',
    district: 'Dhaka (Tejgaon)',
    latitude: 23.7639,
    longitude: 90.4067,
  },
  uiuniversity: {
    name: 'United International University (UIU)',
    shortName: 'UIU',
    district: 'Dhaka (Madani Avenue)',
    latitude: 23.7979,
    longitude: 90.4497,
  },
};

/**
 * Calculates straight-line distance in kilometers using the Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Finds campus by name or code with fuzzy token matching
 */
export function lookupCampus(query: string): CampusLocation | null {
  if (!query) return null;
  const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [key, campus] of Object.entries(BANGLADESH_CAMPUSES)) {
    if (
      normalized.includes(key) ||
      normalized.includes(campus.shortName.toLowerCase()) ||
      campus.name.toLowerCase().includes(query.toLowerCase())
    ) {
      return campus;
    }
  }

  return null;
}
