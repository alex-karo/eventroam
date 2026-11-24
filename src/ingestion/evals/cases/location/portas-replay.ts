import { candidate } from "../geocoding";

export const cemeteryCandidates = [
  candidate({
    latitude: 42.579634,
    longitude: -8.669209,
    placeId:
      "51b360e28fa25621c05928d36872314a4540f00102f901b5072a4f00000000c00201e203226f70656e7374726565746d61703a76656e75653a7761792f31333238313534353439",
    label: "Cemiterio de Portas, 36675 Portas, Spain",
    countryCode: "ES",
    objectType: "venue",
    originalType: "amenity",
    confidence: 1,
  }),
];

export const venueQueryCandidates = [
  candidate({
    latitude: 42.5802347,
    longitude: -8.656739,
    placeId:
      "51f7031e18405021c0598f407221454a4540f00102f901b2fbef2f00000000c0020192031a43656e74726f206465205361c3ba646520646520506f72746173e203216f70656e7374726565746d61703a76656e75653a7761792f383034323536363930",
    label: "Centro de Saúde de Portas, EP-0507, 36658 Currás, Spain",
    name: "Centro de Saúde de Portas",
    countryCode: "ES",
    locality: "Currás",
    address: "Centro de Saúde de Portas",
    objectType: "venue",
    originalType: "amenity",
    category: "healthcare.clinic_or_praxis",
    confidence: 1,
  }),
  candidate({
    latitude: 42.5791831,
    longitude: -8.6688666,
    placeId:
      "51ffc5d8ae755621c059ad72fcab224a4540f00102f901cd98ef2f00000000c002019203204967726578612064652053616e7461204d6172c3ad6120646520506f72746173e203216f70656e7374726565746d61703a76656e75653a7761792f383034323331333733",
    label: "Igrexa de Santa María de Portas, EP-8004, 36658 Currás, Spain",
    name: "Igrexa de Santa María de Portas",
    countryCode: "ES",
    locality: "Currás",
    address: "Igrexa de Santa María de Portas",
    objectType: "venue",
    originalType: "amenity",
    confidence: 1,
  }),
  candidate({
    latitude: 42.5805583,
    longitude: -8.657162,
    placeId:
      "511059a489775021c059eff5ffbb4f4a4540f00102f901a7fbef2f00000000c00201920312436f6e63656c6c6f20646520506f72746173e203216f70656e7374726565746d61703a76656e75653a7761792f383034323536363739",
    label: "Concello de Portas, EP-0507, 36658 Currás, Spain",
    name: "Concello de Portas",
    countryCode: "ES",
    locality: "Currás",
    address: "Concello de Portas",
    objectType: "venue",
    originalType: "amenity",
    category: "tourism.sights.city_hall",
    confidence: 1,
  }),
];

export const portasCandidates = [
  candidate({
    latitude: 42.5639366,
    longitude: -8.6570848,
    placeId:
      "51bc653d6b6d5021c0593b0213132f484540f00101f9017e47050000000000c00208920306506f72746173",
    label: "Portas, GA, Spain",
    name: "Portas",
    countryCode: "ES",
    locality: "Portas",
    address: "Portas",
    objectType: "locality",
    originalType: "city",
    category: "administrative",
    confidence: 1,
  }),
  candidate({
    latitude: 42.6221422,
    longitude: -7.7237767,
    placeId:
      "515e6d20b825e51ec059123b095ba24f4540f00103f9010063a57c02000000c00208920306506f72746173",
    label: "Portas, Chantada, GA, Spain",
    name: "Portas",
    countryCode: "ES",
    locality: "Chantada",
    address: "Portas",
    objectType: "locality",
    originalType: "city",
    category: "populated_place",
    confidence: 1,
  }),
];
