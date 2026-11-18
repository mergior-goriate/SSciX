export const roles = {
  other: "Outro",
  researcher: "Investigador",
  teacher: "Professor",
  student: "Estudante",
} as const;

export type SocialLink = {
  platform: "Facebook" | "Instagram" | "X" | "LinkedIn" | "Outra";
  url: string;
  public: boolean;
};

export type Profile = {
  name: string;
  slug: string;
  academic_role: keyof typeof roles;
  institution: string;
  country: string;
  city: string;
  specialization: string;
  interests: string;
  biography: string;
  orcid: string;
  education: string;
  experience: string;
  publications: string;
  photo: string;
  keywords: string[];
  social_links: SocialLink[];
  is_public: boolean;
};

export const details = [
  ["institution", "Instituição", 160],
  ["country", "País", 80],
  ["city", "Cidade", 80],
  ["specialization", "Área de especialização", 160],
  ["interests", "Interesses de investigação", 400],
  ["orcid", "ORCID", 19],
] as const;

export const trajectory = [
  ["education", "Formação académica"],
  ["experience", "Experiência e projectos"],
  ["publications", "Publicações e contribuições"],
] as const;
