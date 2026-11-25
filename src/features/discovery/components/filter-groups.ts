export const filterGroups = [
  { id: "where", label: "Where", icon: "place" },
  { id: "genre", label: "Music", icon: "music" },
  { id: "more", label: "More", icon: "sliders" },
] as const;

export type FilterGroup = (typeof filterGroups)[number]["id"];
